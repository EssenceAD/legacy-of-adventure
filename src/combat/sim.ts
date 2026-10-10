// 전투 2차 · 시험용 시뮬레이터 (개발 서버 전용): 사람처럼 조작하는 봇으로 한 판을 빨리 돌려 평가·시간을 잰다
//  봇: 가까운 적에게 다가가 연타 · 예고 안이면 (반응 0.25초 뒤) 70% 확률로 구르기 · 스킬은 쿨마다 · 필살기는 차면
import { CONFIG } from '../data/config';
import type { RegionId } from '../data/items';
import type { Actor } from '../world/state';
import { attack, dodge, grade, makeField, skill, step, ultimate, type Field } from './field';

const C = CONFIG.combat;

export interface SimResult {
  win: boolean;
  grade: 'S' | 'A' | 'B';
  time: number;
  hits: number;
  kills: number;
  maxStreak: number;
  items: number;
}

/** 봇 한 판. powerK = 추천 전투력 대비 파티 힘 (1 = 딱 추천) · skill = 0~1 (구르기 성공률·반응) */
export function simulate(region: RegionId, stage: number, members: Actor[], powerK = 1, skillLv = 0.7, auto = false): SimResult {
  const f: Field = makeField(region, stage, members, auto);
  for (const u of f.allies) u.power = (f.rec / 3) * powerK;
  const dt = 1 / 30;
  let react = 0;
  for (let t = 0; t < C.timeLimit + 5 && !f.done; t += dt) {
    if (!auto) brain(f, dt, skillLv, () => (react += dt), () => (react = 0), () => react);
    step(f, dt);
  }
  // 끝 처리(줍기)까지
  for (let i = 0; i < 60; i++) step(f, dt);
  return { win: f.done === 'win', grade: grade(f), time: Math.round(C.timeLimit - f.time), hits: f.hitsTaken, kills: f.kills, maxStreak: f.maxStreak, items: f.picked.length };
}

function brain(f: Field, dt: number, skillLv: number, tick: () => void, reset: () => void, reactT: () => number) {
  const me = f.me;
  if (me.dead) return;
  const mobs = f.units.filter((u) => u.team === 'mob' && !u.dead && u.st !== 'spawn');
  // 예고 안: 반응 시간 뒤 구르기
  const danger = mobs.find((m) => m.st === 'tele' && m.tele && inTele(me.x, me.y, m.tele, me.r));
  if (danger) {
    tick();
    if (reactT() > 0.25 - skillLv * 0.1 && (me.dodgeCd ?? 0) <= 0) {
      reset();
      if (Math.random() < skillLv) {
        const t = danger.tele!;
        const cx = t.x2 != null ? (t.x + t.x2) / 2 : t.x;
        const cy = t.y2 != null ? (t.y + t.y2) / 2 : t.y;
        const l = Math.hypot(me.x - cx, me.y - cy) || 1;
        dodge(f, me, [(me.x - cx) / l, (me.y - cy) / l]);
      }
    }
    return;
  }
  reset();
  let best = null as (typeof mobs)[number] | null;
  let bd = 1e9;
  for (const m of mobs) {
    const d = Math.hypot(m.x - me.x, m.y - me.y);
    if (d < bd) [bd, best] = [d, m];
  }
  if (f.chem >= 100) ultimate(f);
  if (!best) {
    f.stick.x = f.stick.y = 0;
    return;
  }
  const want = me.job === 'mage' || me.job === 'hunter' ? 3 : 0.9;
  if (bd > want) {
    // 월드 방향 → 화면 방향 (조이스틱)
    const wx = (best.x - me.x) / bd;
    const wy = (best.y - me.y) / bd;
    const sx = wx - wy;
    const sy = (wx + wy) / 2;
    const l = Math.hypot(sx, sy) || 1;
    f.stick.x = sx / l;
    f.stick.y = sy / l;
  } else {
    f.stick.x = f.stick.y = 0;
    if (me.cd![0] <= 0) skill(f, me, 0);
    else if (me.cd![1] <= 0) skill(f, me, 1);
    else attack(f, me);
  }
  void dt;
}

function inTele(x: number, y: number, t: { x: number; y: number; r: number; x2?: number; y2?: number; w?: number }, r: number): boolean {
  if (t.x2 == null) return Math.hypot(x - t.x, y - t.y) <= t.r + r + 0.15;
  const dx = t.x2 - t.x;
  const dy = t.y2! - t.y;
  const l2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((x - t.x) * dx + (y - t.y) * dy) / l2));
  return Math.hypot(x - (t.x + dx * k), y - (t.y + dy * k)) <= (t.w ?? 0.5) + r + 0.15;
}
