// 5단계 3장: 마을 등급 (오두막 → 쉼터 → 마을 → 고을 → 도시) — 땅 넓히기와 별개로, 장부 장 보상으로 오른다
// 등급이 오르면 길·울타리·바깥 숲·장식·NPC가 바뀐다. 장식은 울타리 밖 개간지와 입구 길에만 놓아 건물과 겹치지 않는다.
import { GRADE_NAMES } from '../data/guide';
import { townGrade } from './guide';
import { P as PG, S } from './state';
import { entrance, landBounds } from './town';

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
}

/** 등급 장식 하나의 이름표 (옮겼는지 기억) */
export const propKey = (p: Prop) => `${p.k}@${p.x},${p.y}`;
/** 마을 안으로 옮길 수 있는 장식 (건설 목록에도 있는 것) */
export const MOVABLE_PROPS: Prop['k'][] = ['lamppost', 'bench', 'flowerbed', 'banner', 'stall', 'fountain', 'gate'];

/** 입구 길: 여관 앞 울타리 밖으로 곧게 (쉼터부터 다져진 길) */
export function outerRoad(g = gradeNow()): [number, number][] {
  if (g < 1) return [];
  const [, b] = landBounds();
  const [ex] = entrance();
  const out: [number, number][] = [];
  for (let i = 0; i < 2 + g; i++) out.push([ex, b + i]);
  return out;
}

/** 등급별 장식 자리 (입구 x · 앞쪽 울타리 b 기준) */
export function gradeProps(g = gradeNow()): Prop[] {
  if (g < 1) return [];
  const [, b] = landBounds();
  const [ex] = entrance();
  const P = (k: Prop['k'], x: number, y: number, fw = 1, fh = 1): Prop => ({ k, x, y, fw, fh });
  const list: Prop[] = [];
  // 쉼터: 첫 가로등 2개 (입구 양옆)
  list.push(P('lamppost', ex - 1, b), P('lamppost', ex + 1, b));
  if (g >= 2) {
    // 마을: 가로등 줄 · 시장 노점 1 · 입구 표지판 · 돌담
    list.push(P('lamppost', ex - 1, b + 2), P('lamppost', ex + 1, b + 2));
    list.push(P('stall', ex + 2, b + 1, 2, 2), P('sign', ex - 2, b + 1));
    list.push(P('stonewall', ex - 3, b), P('stonewall', ex + 3, b));
  }
  if (g >= 3) {
    // 고을: 꽃밭·벤치 · 분수 · 깃발 · 노점 2
    list.push(P('fountain', ex - 5, b + 1, 2, 2), P('flowerbed', ex - 2, b + 3), P('flowerbed', ex + 2, b + 3));
    list.push(P('bench', ex - 3, b + 3), P('bench', ex + 3, b + 3), P('banner', ex - 2, b), P('banner', ex + 2, b));
    list.push(P('stall', ex + 4, b + 2, 2, 2));
  }
  if (g >= 4) {
    // 도시: 마을 정문(아치)
    list.push(P('gate', ex, b + 1));
  }
  // 땅 개편: 개간 대신 꾸밈 — 울타리 바로 바깥 공터 줄(뒤 1칸)에 등급마다 화분·석등·깃발
  const [a] = landBounds();
  const span = b - a;
  if (g >= 1) list.push(P('flower_pot', a - 1, a + Math.floor(span * 0.3)), P('flower_pot', a + Math.floor(span * 0.3), a - 1));
  if (g >= 2) list.push(P('stone_lantern', a - 1, a + Math.floor(span * 0.6)), P('stone_lantern', a + Math.floor(span * 0.6), a - 1));
  if (g >= 3) list.push(P('flagpole', a - 1, a - 1));
  // 베타: 마을 안으로 옮긴 장식은 여기서 빠진다 (내 마을만)
  if (S.visiting) return list;
  return list.filter((p) => !PG.harmony.moved.includes(propKey(p)));
}

/** 등급 NPC (코드 도트): 상인(마을) · 경비병(고을) · 음유시인(도시) */
export function gradeFolk(g = gradeNow()): { who: 'merchant' | 'guard' | 'bard'; x: number; y: number }[] {
  const [, b] = landBounds();
  const [ex] = entrance();
  const out: { who: 'merchant' | 'guard' | 'bard'; x: number; y: number }[] = [];
  if (g >= 2) out.push({ who: 'merchant', x: ex + 2.6, y: b + 3.3 });
  if (g >= 3) out.push({ who: 'guard', x: ex - 0.6, y: b + 1.4 });
  if (g >= 4) out.push({ who: 'bard', x: ex - 3.4, y: b + 2.6 });
  return out;
}

export const gradeName = (g: number) => GRADE_NAMES[Math.max(0, Math.min(4, g))];
