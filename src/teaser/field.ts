// 티저 6·7번 컷 (전투 2차로 다시 찍음): 실제 전투 그리기(draw.ts)를 그대로 쓰는 가짜 필드
//  6번 사냥: 닌자 몬스터 무리를 연달아 쓰러뜨림 · KILLS 카운터 · 영웅 장비 이름표 + 빛기둥
//  7번 토벌: 이번 주 보스(붉은 무사) 원형 내려찍기 예고 → 파티가 굴러 피함 → 큰 한 방
//  저장 데이터·진짜 전투 상태는 건드리지 않는다 (메모리에서만 만들고 버린다)
import { CLASSES } from '../data/classes';
import { framesFor } from '../engine/sprites';
import { draw, labelsOut, loadFx, numsOut, sheets, digits } from '../combat/draw';
import { loadMon } from '../combat/mon';
import type { Field, Unit } from '../combat/field';
import type { Item } from '../world/state';

export const TF_W = 180;
export const TF_H = 168;
const FOREST = ['na_slime_green', 'na_racoon', 'na_bamboo', 'na_spideryellow'];

/** R27: 7번 컷 보스(붉은 무사) 그림 — 다 받았나 · 받기(캐시된 같은 약속) */
const BOSS = 'nb_samurai';
export const bossSheetReady = (): boolean => !!sheets[BOSS];
export const bossSheet = (): Promise<void> => loadMon(BOSS).then((s) => void (sheets[BOSS] ??= s ?? undefined));

/** 티저 시작 때 미리 (못 받아도 티저는 그대로 흐른다) */
export function preloadTeaserField(): Promise<unknown> {
  return Promise.all([loadFx(), ...[...FOREST, 'nb_samurai'].map(async (id) => (sheets[id] = (await loadMon(id)) ?? undefined))]);
}

const ally = (kind: 'knight' | 'mage' | 'cleric', id: number, x: number, y: number): Unit => ({
  id, team: 'ally', x, y, vx: 0, vy: 0, r: 0.32, hp: 100, max: 100, ax: 1, ay: 0, moving: false, flash: 0, stun: 0, t: id, dead: false, deadT: 0,
  job: kind === 'cleric' ? 'priest' : kind, frames: framesFor('teaser-' + kind, CLASSES[kind]), cd: [0, 0],
});
const mob = (mon: string, id: number, x: number, y: number, o: Partial<Unit> = {}): Unit => ({
  id, team: 'mob', mon, x, y, vx: 0, vy: 0, r: 0.3, hp: 100, max: 100, ax: -1, ay: 0, moving: true, flash: 0, stun: 0, t: Math.random(), dead: false, deadT: 0, st: 'move', ...o,
});

function base(units: Unit[]): Field {
  const allies = units.filter((u) => u.team === 'ally');
  return {
    region: 'forest', stage: 5, rec: 300, units, allies, me: allies[0], proj: [], fx: [], nums: [], drops: [],
    wave: 1, waveLeft: 0, time: 120, stop: 0, shake: 0, shakeAmp: 0, chem: 0, ult: 0, ultName: '', hitsTaken: 0, autoUsed: false, auto: false, kills: 0, chain: 0, chainT: 0,
    done: '', doneT: 0, stick: { x: 0, y: 0 }, holdAtk: 0, nextId: 500, stats: { teleIn: 0, dodged: 0 }, castTxt: '', castT: 0,
    props: [{ x: 4, y: 9, r: 0.35, kind: 'rock' }, { x: 10, y: 5, r: 0.35, kind: 'rock' }],
    mode: 'hunt', killGoal: 30, spawned: 0, elite: null, hit: 0, hitT: 0, streak: 0, streakT: 0, maxStreak: 0, loot: [], picked: [], lootLog: [], dropK: 0, raidDmg: 0, banner: '', bannerT: 0,
  };
}

/** 그리고 화면 캔버스로 (숫자·이름표는 기기 픽셀로 또렷하게) */
function blit(f: Field, lctx: CanvasRenderingContext2D, out: CanvasRenderingContext2D, k: number) {
  draw(lctx, f, TF_W, TF_H);
  out.imageSmoothingEnabled = false;
  out.drawImage(lctx.canvas, 0, 0, TF_W * k, TF_H * k);
  for (const n of numsOut) digits(out, n.text, n.x * k, n.y * k, n.col, Math.max(2, Math.round((n.crit ? 0.75 : 0.5) * k)));
  out.font = `700 ${Math.round(k * 4)}px Galmuri11, sans-serif`;
  out.textAlign = 'center';
  out.textBaseline = 'bottom';
  out.lineWidth = Math.max(2, Math.round(k * 0.7));
  out.strokeStyle = '#140c18';
  for (const l of labelsOut) {
    out.strokeText(l.text, l.x * k, l.y * k);
    out.fillStyle = l.col;
    out.fillText(l.text, l.x * k, l.y * k);
  }
}

/** 6번 사냥 컷. 돌려주는 함수에 t(초)를 주면 그 순간을 그린다 · onKills로 KILLS 수 */
export function huntCut(out: CanvasRenderingContext2D, k: number, onKills: (n: number) => void): (t: number) => void {
  const lc = document.createElement('canvas');
  lc.width = TF_W;
  lc.height = TF_H;
  const lctx = lc.getContext('2d')!;
  lctx.imageSmoothingEnabled = false;
  const me = ally('knight', 1, 7, 7);
  const units: Unit[] = [me, ally('mage', 2, 6, 8.3), ally('cleric', 3, 5.9, 6.4)];
  // 무리: 나를 둘러싸고 다가오는 7마리
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    units.push(mob(FOREST[i % 4], 10 + i, 7 + Math.cos(a) * 2.4, 7 + Math.sin(a) * 2.4));
  }
  const f = base(units);
  const mobs = units.filter((u) => u.team === 'mob');
  let last = 0;
  let killed = 0;
  return (t) => {
    const dt = Math.max(0, Math.min(0.05, t - last));
    last = t;
    f.shake = Math.max(0, f.shake - dt);
    for (const u of f.units) u.t += dt;
    for (const n of f.nums) n.t += dt;
    f.nums = f.nums.filter((n) => n.t < 0.6);
    for (const x of f.fx) x.t += dt;
    f.fx = f.fx.filter((x) => x.t < x.dur);
    for (const l of f.loot) {
      l.t += dt;
      l.vz -= 260 * dt;
      l.z = Math.max(0, l.z + l.vz * dt);
    }
    // 몹은 다가온다
    for (const m of mobs) {
      if (m.dead) {
        m.deadT += dt;
        continue;
      }
      const dx = me.x - m.x;
      const dy = me.y - m.y;
      const l = Math.hypot(dx, dy) || 1;
      if (l > 1.1) {
        m.x += (dx / l) * dt * 0.9;
        m.y += (dy / l) * dt * 0.9;
      }
      m.ax = dx / l;
      m.ay = dy / l;
    }
    // 0.3초마다 한 마리씩: 휘두르고 → 펑
    const want = Math.min(mobs.length, Math.floor((t - 0.25) / 0.3) + 1);
    while (t > 0.25 && killed < want) {
      const m = mobs[killed++];
      const l = Math.hypot(m.x - me.x, m.y - me.y) || 1;
      me.ax = (m.x - me.x) / l;
      me.ay = (m.y - me.y) / l;
      me.swing = me.swingMax = 0.24;
      f.fx.push({ kind: 'slash', x: me.x + me.ax * 0.35, y: me.y + me.ay * 0.35, ax: me.ax, ay: me.ay, t: 0, dur: 0.15, big: killed % 3 === 0 });
      m.dead = true;
      m.deadT = 0;
      m.flash = 0.05;
      f.fx.push({ kind: 'puff', x: m.x, y: m.y, t: 0, dur: 0.5, big: true });
      const crit = killed % 3 === 0;
      f.nums.push({ x: m.x, y: m.y, text: String(crit ? 1384 : 180 + killed * 13), crit, t: 0, dx: 0 });
      f.shake = crit ? 0.1 : 0;
      f.shakeAmp = 2;
      onKills(15 + killed);
      // 다섯째: 영웅 장비가 떨어진다 (빛기둥 + 이름표)
      if (killed === 5) f.loot.push({ x: m.x, y: m.y, z: 0, vz: 70, t: 0, item: { name: '이끼 기사의 투구', grade: 'e' } as Item });
    }
    me.swing = Math.max(0, (me.swing ?? 0) - dt);
    // 쓰러진 몹은 0.5초 뒤 치운다 (그림자도)
    f.units = f.units.filter((u) => !(u.dead && u.deadT > 0.5));
    blit(f, lctx, out, k);
  };
}

/** 7번 토벌 컷: 붉은 무사 · 0.4초 예고 원 → 1.2초 내려찍기(파티는 구름) → 1.7초 큰 한 방 */
export function bossCut(out: CanvasRenderingContext2D, k: number): (t: number) => void {
  const lc = document.createElement('canvas');
  lc.width = TF_W;
  lc.height = TF_H;
  const lctx = lc.getContext('2d')!;
  lctx.imageSmoothingEnabled = false;
  const me = ally('knight', 1, 6, 8.5);
  const boss = mob('nb_samurai', 9, 7.5, 7.2, { r: 0.8, st: 'move', moving: false, boss: { id: 'nb_samurai', name: '붉은 무사', pats: ['', '', ''], r: 0.8, minion: '' }, hp: 1000, max: 1000 });
  const units: Unit[] = [me, ally('mage', 2, 5, 9.2), ally('cleric', 3, 5.2, 7.6), boss];
  const f = base(units);
  let last = 0;
  return (t) => {
    const dt = Math.max(0, Math.min(0.05, t - last));
    last = t;
    f.shake = Math.max(0, f.shake - dt);
    for (const u of f.units) u.t += dt;
    for (const n of f.nums) n.t += dt;
    f.nums = f.nums.filter((n) => n.t < 0.6);
    for (const x of f.fx) x.t += dt;
    f.fx = f.fx.filter((x) => x.t < x.dur);
    if (t > 0.4 && t < 1.2) {
      boss.st = 'tele';
      boss.teleMax = 0.8;
      boss.stT = 1.2 - t;
      boss.tele = { x: boss.x, y: boss.y, r: 2 };
    }
    if (t >= 1.2 && boss.st === 'tele') {
      boss.st = 'strike';
      boss.stT = 0.35;
      boss.tele = undefined;
      f.fx.push({ kind: 'ring', x: boss.x, y: boss.y, t: 0, dur: 0.45, r: 2 });
      f.shake = 0.2;
      f.shakeAmp = 4;
      // 파티는 바깥으로 굴러 피했다
      for (const a of f.allies) {
        a.dodge = 0.3;
        a.vx = (a.x - boss.x) * 4;
        a.vy = (a.y - boss.y) * 4;
      }
    }
    if (boss.st === 'strike') {
      boss.stT! -= dt;
      if (boss.stT! <= 0) boss.st = 'recover';
    }
    for (const a of f.allies) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vx *= 0.85;
      a.vy *= 0.85;
      a.dodge = Math.max(0, (a.dodge ?? 0) - dt);
    }
    if (t > 1.7 && !f.nums.some((n) => n.crit) && boss.hp === 1000) {
      boss.hp = 620;
      // R27: 흰 번쩍임(통째로 흰 실루엣)은 티저에선 뺀다 — 한 프레임만 잡혀도 「흰 덩어리」로 보인다 · 맞은 느낌은 베기·큰 숫자·흔들림·체력 막대로
      me.swing = me.swingMax = 0.24;
      f.fx.push({ kind: 'slash', x: boss.x - 0.6, y: boss.y + 0.4, ax: 1, ay: -0.3, t: 0, dur: 0.18, big: true });
      f.nums.push({ x: boss.x, y: boss.y - 0.5, text: '12480', crit: true, t: 0, dx: 0 });
      f.shake = 0.12;
      f.shakeAmp = 3;
    }
    me.swing = Math.max(0, (me.swing ?? 0) - dt);
    boss.flash = Math.max(0, boss.flash - dt);
    blit(f, lctx, out, k);
  };
}
