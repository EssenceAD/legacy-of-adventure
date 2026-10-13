// 5단계 3장: 마을 등급 (오두막 → 쉼터 → 마을 → 고을 → 도시) — 땅 넓히기와 별개로, 장부 장 보상으로 오른다
// 등급이 오르면 길·울타리·바깥 숲·장식·NPC가 바뀐다. 장식은 울타리 밖 개간지와 입구 길에만 놓아 건물과 겹치지 않는다.
import { vis } from './visual';
import { CONFIG } from '../data/config';
import { GRADE_NAMES } from '../data/guide';
import { townGrade } from './guide';
import { P as PG, S } from './state';
import { autoEntranceX, entrance, landBounds } from './town';
import { flag } from './flags';

export { GRADE_NAMES };

/** 개발용: 등급 보기 강제 (-1 = 끔) */
export const gradeDev = { g: -1 };
/** 티저: 연출용 등급 (-1 = 끔 · 배포본에서도 쓴다) */
export const teaserView = { g: -1 };
/** 지금 보이는 마을의 등급 (이웃 방문 중이면 그 마을 등급) */
export function gradeNow(): number {
  if (teaserView.g >= 0 && !anim.on) return teaserView.g;
  if (import.meta.env.DEV && gradeDev.g >= 0 && !anim.on) return gradeDev.g;
  if (S.visiting) return Math.max(0, Math.min(4, S.visiting.grade ?? Math.max(0, S.visiting.land - 1)));
  return anim.on ? anim.from : townGrade();
}

/** 등급이 바뀌는 연출 (위에서 아래로 덮어쓰기 1.5초) */
export const anim = { on: false, from: 0, to: 0, t: 0, dur: 1.5 };
export function startGradeAnim(from: number, to: number) {
  Object.assign(anim, { on: true, from, to, t: 0 });
}
export function stepGradeAnim(dt: number) {
  if (!anim.on) return;
  anim.t += dt;
  if (anim.t >= anim.dur) anim.on = false;
}
/** 덮어쓰기 진행 0~1 */
export const animF = () => (anim.on ? Math.min(1, anim.t / anim.dur) : 1);

export interface Prop {
  k: 'lamppost' | 'stonewall' | 'bench' | 'flowerbed' | 'banner' | 'stall' | 'fountain' | 'gate' | 'sign' | 'flagpole' | 'flower_pot' | 'stone_lantern';
  /** 발자국 왼쪽 위 칸 */
  x: number;
  y: number;
  fw: number;
  fh: number;
  /** FEEDBACK23 §5: 이름표를 직접 정할 때 */
  key?: string;
  /** 핫픽스: 고정 자리 id (g1_lamp_L · g3_fountain · back_pot_L …) */
  id?: string;
}

/**
 * 등급 장식 하나의 이름표 (옮겼는지 기억) — 핫픽스: 좌표 대신 고정 자리 id.
 *  땅 넓히기·입구 옮기기와 상관없이 늘 같은 값 (「종류@slot:id」 — 앞부분은 예전처럼 종류)
 */
export const propKey = (p: Prop) => p.key ?? `${p.k}@slot:${p.id ?? `${p.x},${p.y}`}`;
/** 마을 안으로 옮길 수 있는 장식 (건설 목록에도 있는 것) */
export const MOVABLE_PROPS: Prop['k'][] = ['lamppost', 'bench', 'flowerbed', 'banner', 'stall', 'fountain', 'gate'];

/** 입구 길: 여관 앞 울타리 밖으로 곧게 (쉼터부터 다져진 길) */
export function outerRoad(g = gradeNow()): [number, number][] {
  if (g < 1) return [];
  // v0.25.2 §I #20: 자동 길 끔이면 바깥 길도 안 깐다 (내 마을만 · 이웃 마을은 그대로)
  if (!S.visiting && vis('autoPathNone') && PG.decor?.autoPath === false) return [];
  const [, b] = landBounds();
  const [ex] = entrance();
  const out: [number, number][] = [];
  for (let i = 0; i < 2 + g; i++) out.push([ex, b + i]);
  // 핫픽스 v0.24.6: 지우개로 지운 칸(noPath)은 빼기 (이웃 마을은 그대로)
  if (!S.visiting && flag('autoPathStrict')) { const no = PG.decor?.noPath ?? {}; return out.filter(([x, y]) => !no[`${x},${y}`]); }
  return out;
}

/** 등급별 장식 자리 (입구 x · 앞쪽 울타리 b 기준) */
/** TOWN T1: 쇼케이스 이웃 마을(실제 유저가 아닌 예시 마을)은 등급 장식 대신 마을마다 다른 입구를 배치표에 직접 둔다 */
export const showcaseVisit = () => !!S.visiting && !S.visiting.uid;
/** 등급별 장식 자리 — 앞쪽 울타리 b · 뒤쪽 울타리 a · 입구 x 기준. id는 땅·입구와 상관없이 고정 */
function slotsFor(g: number, a: number, b: number, ex: number): Prop[] {
  const P = (id: string, k: Prop['k'], x: number, y: number, fw = 1, fh = 1): Prop => ({ id, k, x, y, fw, fh });
  const list: Prop[] = [];
  // 쉼터: 첫 가로등 2개 (입구 양옆)
  list.push(P('g1_lamp_L', 'lamppost', ex - 1, b), P('g1_lamp_R', 'lamppost', ex + 1, b));
  if (g >= 2) {
    // 마을: 가로등 줄 · 시장 노점 1 · 입구 표지판 · 돌담
    list.push(P('g2_lamp_L', 'lamppost', ex - 1, b + 2), P('g2_lamp_R', 'lamppost', ex + 1, b + 2));
    list.push(P('g2_stall', 'stall', ex + 2, b + 1, 2, 2), P('g2_sign', 'sign', ex - 2, b + 1));
    list.push(P('g2_wall_L', 'stonewall', ex - 3, b), P('g2_wall_R', 'stonewall', ex + 3, b));
  }
  if (g >= 3) {
    // 고을: 꽃밭·벤치 · 분수 · 깃발 · 노점 2
    list.push(P('g3_fountain', 'fountain', ex - 5, b + 1, 2, 2), P('g3_flower_L', 'flowerbed', ex - 2, b + 3), P('g3_flower_R', 'flowerbed', ex + 2, b + 3));
    list.push(P('g3_bench_L', 'bench', ex - 3, b + 3), P('g3_bench_R', 'bench', ex + 3, b + 3), P('g3_banner_L', 'banner', ex - 2, b), P('g3_banner_R', 'banner', ex + 2, b));
    list.push(P('g3_stall', 'stall', ex + 4, b + 2, 2, 2));
  }
  if (g >= 4) {
    // 도시: 마을 정문(아치)
    list.push(P('g4_gate', 'gate', ex, b + 1));
  }
  // 땅 개편: 개간 대신 꾸밈 — 울타리 바로 바깥 공터 줄(뒤 1칸)에 등급마다 화분·석등·깃발
  const span = b - a;
  if (g >= 1) list.push(P('back_pot_L', 'flower_pot', a - 1, a + Math.floor(span * 0.3)), P('back_pot_T', 'flower_pot', a + Math.floor(span * 0.3), a - 1));
  if (g >= 2) list.push(P('back_lantern_L', 'stone_lantern', a - 1, a + Math.floor(span * 0.6)), P('back_lantern_T', 'stone_lantern', a + Math.floor(span * 0.6), a - 1));
  if (g >= 3) list.push(P('back_flag', 'flagpole', a - 1, a - 1));
  return list;
}
export function gradeProps(g = gradeNow()): Prop[] {
  if (g < 1 || showcaseVisit()) return [];
  const [a, b] = landBounds();
  // FEEDBACK23 §5: 자리는 자동 입구 기준으로 만들고 옮긴 입구만큼 옆으로 민다 (뒤쪽 줄은 그대로)
  const [ex] = entrance(autoEntranceX());
  const shift = entrance()[0] - ex;
  const list = slotsFor(g, a, b, ex);
  if (shift) for (const p of list) if (!p.id!.startsWith('back_')) p.x += shift;
  // 베타: 마을 안으로 옮긴 장식은 여기서 빠진다 (내 마을만)
  if (S.visiting) return list;
  return list.filter((p) => !PG.harmony.moved.includes(propKey(p)));
}

/**
 * 핫픽스: 옛 이름표(「종류@x,y」 좌표)를 고정 자리 id로 — 땅 단계마다 그때 자리와 맞춰 보고,
 *  안 맞으면 같은 종류·같은 줄에서 가장 가까운 자리 → 그래도 없으면 같은 종류의 남은 자리.
 *  이미 마을 안에 놓인 장식은 건드리지 않는다. 바뀐 개수를 돌려준다.
 */
export function migrateGradeKeys(): number {
  const moved = PG.harmony.moved;
  if (!moved.some((k) => !k.includes('@slot:'))) return 0;
  const ex = autoEntranceX();
  const stages = CONFIG.land.map((_, i) => i + 1);
  const all = stages.map((st) => {
    const [a, b] = landBounds(st);
    return { a, b, slots: slotsFor(4, a, b, ex) };
  });
  const taken = new Set(moved.filter((k) => k.includes('@slot:')));
  const out: string[] = [];
  let n = 0;
  for (const key of moved) {
    if (key.includes('@slot:')) {
      out.push(key);
      continue;
    }
    const m = /^([a-z_]+)@(-?\d+),(-?\d+)$/.exec(key);
    if (!m) {
      out.push(key);
      continue;
    }
    const [, k, xs, ys] = m;
    const [x, y] = [+xs, +ys];
    const free = (p: Prop) => !taken.has(propKey(p));
    let hit: Prop | undefined;
    // ① 그 땅 단계의 자리와 좌표가 딱 맞는 것
    for (const st of all) if (!hit) hit = st.slots.find((p) => p.k === k && p.x === x && p.y === y && free(p));
    // ② 같은 종류 · 같은 줄(앞 울타리·뒤 울타리 기준 거리) 중 x가 가장 가까운 것
    if (!hit) {
      let best = 1e9;
      for (const st of all)
        for (const p of st.slots) {
          if (p.k !== k || !free(p)) continue;
          const sameRow = p.id!.startsWith('back_') ? p.x - st.a === x - st.a || p.y - st.a === y - st.a : p.y - st.b === y - st.b;
          const d = Math.abs(p.x - x) + Math.abs(p.y - y);
          if (sameRow && d < best) [best, hit] = [d, p];
        }
    }
    // ③ 같은 종류의 남은 자리
    if (!hit) hit = all[all.length - 1].slots.find((p) => p.k === k && free(p));
    if (!hit) {
      // 남는 자리가 없는 같은 종류 (이미 복사돼 두 번 옮긴 것) — 어느 자리와도 안 맞는 이름표로 (종류별 개수는 그대로)
      let i = 1;
      while (out.includes(`${k}@slot:extra_${i}`)) i++;
      out.push(`${k}@slot:extra_${i}`);
      n++;
      continue;
    }
    const nk = propKey({ ...hit, key: undefined });
    taken.add(nk);
    out.push(nk);
    n++;
  }
  PG.harmony.moved = [...new Set(out)];
  return n;
}

/** 등급 NPC (코드 도트): 상인(마을) · 경비병(고을) · 음유시인(도시) */
export function gradeFolk(g = gradeNow()): { who: 'merchant' | 'guard' | 'bard'; x: number; y: number }[] {
  if (showcaseVisit()) return [];
  const [, b] = landBounds();
  const [ex] = entrance();
  const out: { who: 'merchant' | 'guard' | 'bard'; x: number; y: number }[] = [];
  if (g >= 2) out.push({ who: 'merchant', x: ex + 2.6, y: b + 3.3 });
  if (g >= 3) out.push({ who: 'guard', x: ex - 0.6, y: b + 1.4 });
  if (g >= 4) out.push({ who: 'bard', x: ex - 3.4, y: b + 2.6 });
  return out;
}

export const gradeName = (g: number) => GRADE_NAMES[Math.max(0, Math.min(4, g))];
