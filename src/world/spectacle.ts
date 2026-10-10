// 베타 4장: 구경거리 사건 10종 — 게임 하루에 0~2번, 마을을 보고 있을 때만. 머리 위 이모트로 표시, 게임 1시간 뒤 사라진다
//  해결(탭 → 고르기)은 ui/spectacle.ts. 여기는 생기기·위치·그리기·탭 판정
import { CONFIG } from '../data/config';
import type { ClassDef } from '../data/classes';
import { tinted } from '../engine/assets';
import { depthActor, scr, sx, sy, TH, view } from '../engine/iso';
import { framesFor, type CharFrames } from '../engine/sprites';
import { absHours, hourNow } from './clock';
import { NL } from './daynight';
import { emote, tour } from './evalTour';
import { evalOpen } from './evaluation';
import { hfx } from './harmony';
import { P, S, world, type Actor, type Building } from './state';
import { entrance, inLand, landBounds, walkable } from './town';

const SP = CONFIG.spectacle;
export type SpecKind = 'quarrel' | 'thief' | 'confess' | 'merchant' | 'bard' | 'lost' | 'sleepy' | 'sparkle' | 'group' | 'secret';
export const SPEC_KINDS: SpecKind[] = ['quarrel', 'thief', 'confess', 'merchant', 'bard', 'lost', 'sleepy', 'sparkle', 'group', 'secret'];
export const SPEC_EMO: Record<SpecKind, string> = {
  quarrel: 'angry', thief: 'question', confess: 'heart', merchant: 'coin', bard: 'music', lost: 'question', sleepy: 'sleep', sparkle: 'sparkle', group: 'alert', secret: 'question',
};

/** 사건에 나오는 코드 도트 사람 (손님이 아닌 사람) */
export interface SpecNpc {
  x: number;
  y: number;
  look: 'thief' | 'merchant' | 'bard' | 'kid' | 'inspector' | 'traveler';
  dir: 1 | -1;
}
export interface Spectacle {
  id: number;
  kind: SpecKind;
  /** 끝나는 게임 시각 (absHours) */
  until: number;
  /** 손님이 주인공인 사건 */
  actors: Actor[];
  npcs: SpecNpc[];
  /** 땅 위 반짝임 · 모닥불 같은 자리 */
  tile?: [number, number];
  near?: Building;
}
export const spectacles: Spectacle[] = [];
let nextId = 1;
const today = { day: 0, n: 0, hour: -1 };

const guests = () => world.actors.filter((a) => !a.role && a.id && !a.hidden && !a.leaving && a.runId == null && a.st !== 'in' && !spectacles.some((s) => s.actors.includes(a)));
const pickN = <T,>(a: T[], n: number) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
const freeTile = (): [number, number] | null => {
  const [a, b] = landBounds();
  for (let i = 0; i < 40; i++) {
    const x = a + Math.floor(Math.random() * (b - a));
    const y = a + Math.floor(Math.random() * (b - a));
    if (inLand(x, y) && walkable(x, y)) return [x, y];
  }
  return null;
};
const nearTile = (o: Building): [number, number] => {
  for (const [dx, dy] of [[o.fw, 1], [-1, 1], [1, o.fh], [0, -1]]) {
    const x = o.tx + dx;
    const y = o.ty + dy;
    if (walkable(x, y)) return [x + 0.3, y + 0.3];
  }
  return [o.tx + o.fw + 0.3, o.ty + o.fh + 0.3];
};

/** 지금 생길 수 있나 · 만들기 (실패하면 null) */
export function spawn(kind: SpecKind): Spectacle | null {
  const until = absHours() + (kind === 'merchant' ? SP.merchantHours : SP.hours);
  const ev: Spectacle = { id: nextId++, kind, until, actors: [], npcs: [] };
  const [ex, ey] = entrance();
  switch (kind) {
    case 'quarrel':
    case 'confess': {
      const g = pickN(guests(), 2);
      if (g.length < 2) return null;
      ev.actors = g;
      break;
    }
    case 'sleepy': {
      const g = guests();
      const d = g.filter((a) => a.kind === 'dwarf');
      const a = (d.length ? d : g)[0];
      if (!a) return null;
      ev.actors = [a];
      break;
    }
    case 'thief': {
      const o = world.objs.find((b) => b.kind === 'stall' && b.build === undefined) ?? world.objs.find((b) => b.kind === 'tavern') ?? world.objs.find((b) => b.kind === 'inn');
      if (!o) return null;
      const [x, y] = nearTile(o);
      ev.near = o;
      ev.npcs = [{ x, y, look: 'thief', dir: -1 }];
      break;
    }
    case 'merchant':
      ev.npcs = [{ x: ex + 0.8, y: ey + 0.2, look: 'merchant', dir: -1 }];
      break;
    case 'bard': {
      const f = world.objs.find((b) => b.kind === 'fire');
      if (!f) return null;
      ev.near = f;
      ev.tile = [f.tx, f.ty];
      ev.npcs = [{ x: f.tx + 1.2, y: f.ty + 0.4, look: 'bard', dir: -1 }];
      break;
    }
    case 'lost': {
      const t = freeTile();
      if (!t) return null;
      ev.npcs = [{ x: t[0] + 0.5, y: t[1] + 0.5, look: 'kid', dir: 1 }];
      break;
    }
    case 'sparkle': {
      const t = freeTile();
      if (!t) return null;
      ev.tile = t;
      break;
    }
    case 'group':
      ev.npcs = [0, 1, 2].map((k) => ({ x: ex - 0.6 + k * 0.6, y: ey + 0.7 + (k % 2) * 0.3, look: 'traveler' as const, dir: -1 as const }));
      break;
    case 'secret': {
      if (!evalOpen() || !P.evaluation.season || P.evaluation.secretDone) return null;
      const t = freeTile();
      if (!t) return null;
      ev.npcs = [{ x: t[0] + 0.5, y: t[1] + 0.5, look: 'inspector', dir: 1 }];
      break;
    }
  }
  spectacles.push(ev);
  return ev;
}

/** 어느 사건이 생길지 (술통 창고가 있으면 곯아떨어진 드워프 ↑ · 평가 시즌엔 암행 한 번) */
function roll(): SpecKind {
  const w: [SpecKind, number][] = SPEC_KINDS.map((k) => [k, SP.weight[k] * (k === 'sleepy' ? 1 + hfx('drunk') * SP.drunkBoost : 1)]);
  const sum = w.reduce((s, [, v]) => s + v, 0);
  let r = Math.random() * sum;
  for (const [k, v] of w) if ((r -= v) <= 0) return k;
  return 'sparkle';
}

/** 게임 1시간마다: 오래된 사건은 사라지고, 가끔 새 사건 (하루 최대 SP.perDay) */
export function tickSpectacle(viewing: boolean) {
  if (S.visiting || !S.started) return;
  const now = absHours();
  for (let i = spectacles.length - 1; i >= 0; i--) {
    const s = spectacles[i];
    const gone = now >= s.until || s.actors.some((a) => !world.actors.includes(a) || a.hidden || a.leaving);
    if (gone) spectacles.splice(i, 1);
  }
  const h = Math.floor(now);
  if (h === today.hour) return;
  today.hour = h;
  if (today.day !== S.day) Object.assign(today, { day: S.day, n: 0 });
  if (!viewing || tour.on || today.n >= SP.perDay || spectacles.length >= 2) return;
  if (hourNow() < 7 || Math.random() > SP.chancePerHour) return;
  for (let i = 0; i < 4; i++) {
    if (spawn(roll())) {
      today.n++;
      return;
    }
  }
}

export const removeSpectacle = (s: Spectacle) => {
  const i = spectacles.indexOf(s);
  if (i >= 0) spectacles.splice(i, 1);
};

// ───────── 위치 · 탭 · 그리기 ─────────

/** 이모트를 띄울 화면 좌표 (논리 px) — 사건마다 하나 이상 */
export function specPoints(s: Spectacle): [number, number][] {
  if (s.actors.length) return s.actors.map((a) => { const [X, Y] = scr(a.x, a.y); return [X, Y - 34]; });
  if (s.npcs.length) return s.npcs.slice(0, 1).map((n) => [Math.round(view.OX + sx(n.x, n.y)), Math.round(view.OY + sy(n.x, n.y) + TH / 2) - 38]);
  if (s.tile) return [[Math.round(view.OX + sx(s.tile[0] + 0.5, s.tile[1] + 0.5)), Math.round(view.OY + sy(s.tile[0] + 0.5, s.tile[1] + 0.5)) - 10]];
  return [];
}
/** 탭한 자리의 사건 */
export function spectacleAt(mx: number, my: number): Spectacle | null {
  for (const s of spectacles) {
    for (const [x, y] of specPoints(s)) if (Math.hypot(mx - x, my - (y + 14)) < 18) return s;
  }
  return null;
}

const LOOKS: Record<SpecNpc['look'], ClassDef> = {
  thief: { name: '좀도둑', face: { eyes: 'dot', mouth: 'grin', brow: 'angry' } as ClassDef['face'], hair: '#2a2430', style: 'short', cloth: '#2a2a3a', arm: '#2a2a3a', pants: '#1e1e28', boots: '#18141c', accent: '#5a5a6a', weapon: 'dagger', hood: '#22222e' },
  merchant: { name: '떠돌이 상인', face: { eyes: 'happy', mouth: 'grin' } as ClassDef['face'], hair: '#8a5a3a', style: 'short', cloth: '#8a5a2a', arm: '#efe0bf', pants: '#4a3a2a', boots: '#3a2a1a', accent: '#ffd36b', weapon: null, bandana: '#2a6ab8' },
  bard: { name: '음유시인', face: { eyes: 'sparkle', mouth: 'tiny', blush: true } as ClassDef['face'], hair: '#e8c070', style: 'long', cloth: '#b84a6a', arm: '#b84a6a', pants: '#5a2a3a', boots: '#3a2418', accent: '#ffd36b', weapon: 'book', hat: 'wizard', hatc: '#8a2a4a' },
  kid: { name: '길 잃은 아이', face: { eyes: 'sparkle', mouth: 'tiny', blush: true } as ClassDef['face'], hair: '#c8784a', style: 'braid', cloth: '#5a9ad8', arm: '#5a9ad8', pants: '#3a5a8a', boots: '#4a2a1a', accent: '#ffd36b', weapon: null },
  inspector: { name: '수상한 손님', face: { eyes: 'calm', mouth: 'flat', brow: 'angry' } as ClassDef['face'], hair: '#3a2a24', style: 'short', cloth: '#5a3a6a', arm: '#5a3a6a', pants: '#2a2440', boots: '#3a2418', accent: '#e8b94a', weapon: 'book', hat: 'feather', hatc: '#2a2440' },
  traveler: { name: '여행자', face: { eyes: 'dot', mouth: 'grin' } as ClassDef['face'], hair: '#6a4028', style: 'short', cloth: '#6a8a4a', arm: '#6a8a4a', pants: '#4a3a2a', boots: '#3a2a1a', accent: '#c9a24a', weapon: 'staff' },
};
const FR: Partial<Record<string, CharFrames>> = {};

export const spectacleThings = () =>
  spectacles.flatMap((s) => s.npcs.map((n) => ({ d: depthActor(n.x, n.y), tx: Math.floor(n.x), ty: Math.floor(n.y), fw: 1, fh: 1, sn: n })));

export function drawSpecNpc(ctx: CanvasRenderingContext2D, n: SpecNpc) {
  const fr = (FR[n.look] ||= framesFor('spec-' + n.look, LOOKS[n.look]));
  const img = tinted(fr.idle[Math.floor(S.T * 1.6 + n.x) % 2], NL);
  const X = Math.round(view.OX + sx(n.x, n.y));
  const Y = Math.round(view.OY + sy(n.x, n.y) + TH / 2);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#1c1018';
  ctx.fillRect(X - 5, Y - 1, 10, 2);
  ctx.globalAlpha = n.look === 'thief' ? 0.85 : 1;
  if (n.dir > 0) ctx.drawImage(img, X - 12, Y - 32);
  else {
    ctx.save();
    ctx.translate(X + 12, Y - 32);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** 이모트 (머리 위 · 반짝이는 땅은 땅 위) — 2배, 살짝 둥실 */
export function drawSpectacleEmotes(ctx: CanvasRenderingContext2D) {
  for (const s of spectacles) {
    const im = emote(SPEC_EMO[s.kind]);
    if (!im.complete) continue;
    const bob = Math.round(Math.sin(S.T * 4 + s.id));
    for (const [x, y] of specPoints(s)) ctx.drawImage(im, Math.round(x - im.width), Math.round(y - im.height * 2 + bob), im.width * 2, im.height * 2);
  }
}
