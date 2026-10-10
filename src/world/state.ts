// 게임 한 판의 공유 상태. 모든 world/ ui/ 모듈이 이 객체들을 함께 본다.
import { CONFIG } from '../data/config';
import type { Kind } from '../data/catalog';
import type { ClassKey } from '../data/classes';
import type { Neighbor } from '../data/neighbors';

export interface Building {
  kind: Kind;
  tx: number;
  ty: number;
  fw: number;
  fh: number;
  /** 지금 그림 (레벨업하면 바뀜) */
  sprite: string | null;
  lvl: number;
  /** 지붕 색 hue (null = 원래 색) */
  hue: number | null;
  /** 안에 있는 손님 */
  inside: Actor[];
  /** 공사 중이면 남은 초 */
  build?: number;
  /** 완성·레벨업 때 살짝 튀는 연출 (1 → 0) */
  pop?: number;
}

export type ActorState = 'idle' | 'walk' | 'in' | 'atk' | 'pray' | 'sit';

export interface Actor {
  kind: ClassKey;
  name: string;
  x: number;
  y: number;
  /** 1 = 화면 오른쪽, -1 = 왼쪽(좌우 반전) */
  dir: 1 | -1;
  /** 화면 안쪽(위)으로 걷는 중 → 뒷모습 */
  back: boolean;
  st: ActorState;
  /** 지금 상태의 남은 시간 (초) */
  t: number;
  /** 애니메이션 위상 (모두 같은 박자로 움직이지 않게) */
  ph: number;
  /** npc = 우체부 모모, keeper = 오프닝의 노주인 */
  role?: 'npc' | 'keeper';
  path: [number, number][] | null;
  then?: (() => void) | null;
  lvl: number;
  hp: number;
  food: number;
  mood: number;
  hidden: boolean;
  at: Building | null;
  party?: boolean;
  /** 나타날 때 서서히 보이기 (0.4 → 0) */
  pop?: number;
  bub?: HTMLElement | null;
  /** 노주인 퇴장처럼 사라지는 중 */
  fading?: number;
}

export type IncomeKind = 'sleep' | 'drink' | 'forge' | 'bath' | 'dungeon';

export const S = {
  land: 1,
  night: false,
  /** 0 = 낮 ~ 1 = 밤 (부드럽게 넘어감) */
  nightT: 0,
  day: 1,
  gold: CONFIG.economy.startGold,
  innName: '',
  visiting: null as Neighbor | null,
  /** 오프닝이 끝나 마을이 돌아가는 중 */
  started: false,
  zoom: CONFIG.view.defaultZoom,
  /** 오늘의 수입 (장부) */
  ledger: { sleep: 0, drink: 0, forge: 0, bath: 0, dungeon: 0 } as Record<IncomeKind, number>,
  /** 게임 시간 (초, 멈춰 있으면 안 흐름) */
  time: 0,
  /** 화면 애니메이션 시간 (초) */
  T: 0,
};

export const world = {
  objs: [] as Building[],
  actors: [] as Actor[],
  /** 이웃 방문 중엔 내 마을을 여기 보관 */
  home: null as { objs: Building[]; actors: Actor[]; land: number } | null,
};

// ───────── 게임 시간 예약 (setTimeout 대신: 멈추면 같이 멈춘다) ─────────
interface Job {
  at: number;
  fn: () => void;
}
const jobs: Job[] = [];
export function later(seconds: number, fn: () => void) {
  jobs.push({ at: S.time + seconds, fn });
}
export function runJobs() {
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobs[i].at <= S.time) {
      const j = jobs.splice(i, 1)[0];
      const t0 = performance.now();
      j.fn();
      const ms = performance.now() - t0;
      if (import.meta.env.DEV && ms > 5) console.warn('느린 예약 작업', ms.toFixed(1) + 'ms', j.fn.toString().slice(0, 120));
    }
  }
}
export function clearJobs() {
  jobs.length = 0;
}

export const pick = <T>(a: readonly T[]): T => a[(Math.random() * a.length) | 0];

/** world → ui 알림 통로 (ui 모듈이 시작할 때 채운다. 서로 import가 꼬이지 않게) */
export const uiHooks = {
  toast: (_text: string) => {},
  toastHtml: (_html: string) => {},
};

/** 금화 벌기: 장부에 기록 (이웃 방문 중엔 안 번다) */
export function earn(v: number, kind: IncomeKind) {
  if (S.visiting) return;
  S.gold += v;
  S.ledger[kind] += v;
}

// 저장해야 할 일이 생기면 표시 → main 루프가 곧 저장한다
let dirty = false;
export const markDirty = () => {
  dirty = true;
};
export const takeDirty = () => {
  const d = dirty;
  dirty = false;
  return d;
};
