// BUILDUX §2-3: 보관함 — 철거 대신 「넣어 두기」. 레벨·색·방향은 그대로, 다시 꺼내 놓을 수 있다.
//  환불 철거(팔기)는 보관함 안에서만. 넣어 두기·꺼내 놓기·새로 놓기는 되돌리기(20단계)에 들어간다
import { CATALOG, def } from '../data/catalog';
import { canRemove, isNoRemove, refundOf, removeBuilding } from './demolish';
import { pushUndo } from './decor';
import { addObj, rebuildPaths } from './town';
import { markDirty, P, S, world, type Building, type StoredObj } from './state';
import { track as trackEv } from '../net/telemetry';

export const storeList = (): StoredObj[] => (P.decor.store ??= []).filter((s) => s && s.kind in CATALOG);

/** 넣어 둘 수 없는 까닭 (되면 null) */
export function storeWhy(o: Building): string | null {
  if (S.visiting) return '이웃 마을이에요';
  if (isNoRemove(o) || def(o.kind).fixed) return `${def(o.kind).name}은(는) 넣어 둘 수 없어요`;
  if (o.con || o.build !== undefined) return '공사 중엔 넣어 둘 수 없어요';
  if (!canRemove(o)) return '넣어 둘 수 없어요';
  return null;
}

const snap = (o: Building): StoredObj => ({
  kind: o.kind, lvl: o.lvl, hue: o.hue, flip: !!o.flip,
  ...(o.plots ? { plots: o.plots } : {}), ...(o.builtAt ? { builtAt: o.builtAt } : {}), ...(o.paid ? { paid: o.paid } : {}), ...(o.fromProp ? { fromProp: true } : {}),
});
const revive = (s: StoredObj, tx: number, ty: number, flip = s.flip): Building => {
  const { kind, lvl, hue, plots, builtAt, paid, fromProp } = s;
  return addObj(kind, tx, ty, { lvl, hue, flip, ...(plots ? { plots } : {}), ...(builtAt ? { builtAt } : {}), ...(paid ? { paid } : {}), ...(fromProp ? { fromProp } : {}) });
};

/** 마을 → 보관함 (조용히, 되돌리기 없이) · 성공하면 보관함 항목 */
function stash(o: Building): StoredObj | null {
  if (storeWhy(o)) return null;
  const s = snap(o);
  if (!removeBuilding(o)) return null;
  P.decor.store = [...storeList(), s];
  return s;
}
/** 보관함 → 마을 (같은 항목 객체를 찾아 뺀다) */
function unstash(s: StoredObj, tx: number, ty: number, flip?: boolean): Building | null {
  const list = storeList();
  const i = list.indexOf(s);
  if (i < 0) return null;
  list.splice(i, 1);
  P.decor.store = list;
  return revive(s, tx, ty, flip);
}

/** 넣어 두기 (여러 개면 되돌리기 1단계) · 넣은 수 */
export function putAway(objs: Building[]): number {
  const done: { s: StoredObj; tx: number; ty: number; o: Building | null }[] = [];
  for (const o of objs) {
    const at = { tx: o.tx, ty: o.ty };
    const s = stash(o);
    if (s) done.push({ s, ...at, o: null });
  }
  if (!done.length) return 0;
  rebuildPaths();
  markDirty();
  const name = done.length > 1 ? `${done.length}개` : def(done[0].s.kind).name;
  pushUndo({
    label: `${name} 넣어 두기`,
    undo: () => done.forEach((d) => (d.o = unstash(d.s, d.tx, d.ty))),
    redo: () => done.forEach((d) => d.o && stash(d.o)),
  });
  trackEv('edit_action', { tool: 'store', n: done.length });
  return done.length;
}

/** 보관함에서 꺼내 (tx,ty)에 놓기 — 무료 */
export function takeOut(s: StoredObj, tx: number, ty: number, flip?: boolean): Building | null {
  const o = unstash(s, tx, ty, flip);
  if (!o) return null;
  rebuildPaths();
  markDirty();
  let cur: Building | null = o;
  pushUndo({
    label: `${def(s.kind).name} 꺼내 놓기`,
    undo: () => {
      if (cur && stash(cur)) cur = null;
    },
    redo: () => {
      cur = unstash(s, tx, ty, flip);
    },
  });
  trackEv('edit_action', { tool: 'take_out', n: 1 });
  return o;
}

/** 보관함 안에서만: 팔기(환불 철거) — 되돌릴 수 없다 */
export function refundStored(s: StoredObj): number {
  const list = storeList();
  const i = list.indexOf(s);
  if (i < 0) return 0;
  // v0.24.2: 레벨 기념 장식은 팔 수 없다
  if (def(s.kind).levelDeco) return 0;
  const gold = refundOf({ ...s, tx: 0, ty: 0, fw: 1, fh: 1, inside: [], sprite: '' } as unknown as Building).gold;
  list.splice(i, 1);
  P.decor.store = list;
  S.gold += gold;
  markDirty();
  trackEv('demolish', { kind: s.kind, lvl: s.lvl, refund: gold, stored: true });
  return gold;
}
export const refundOfStored = (s: StoredObj) => refundOf({ ...s, tx: 0, ty: 0, fw: 1, fh: 1, inside: [], sprite: '' } as unknown as Building).gold;

/** 방금 새로 지은 것 되돌리기: 치우고 낸 금화를 그대로 돌려준다 (공사도 취소) */
export function notePlace(o: Building, cost: number) {
  let cur: Building | null = o;
  const { kind, tx, ty, flip } = o;
  pushUndo({
    label: `${def(kind).name} 놓기`,
    undo: () => {
      if (!cur || !world.objs.includes(cur)) return;
      world.objs = world.objs.filter((x) => x !== cur);
      for (const a of world.actors) if (a.door?.o === cur) a.door = null;
      S.gold += cost;
      cur = null;
    },
    redo: () => {
      if (S.gold < cost) return;
      S.gold -= cost;
      cur = addObj(kind, tx, ty, { flip: !!flip, builtAt: Date.now(), ...(o.paid ? { paid: o.paid } : {}), ...(o.con ? { con: { ...o.con }, build: o.build } : {}) });
    },
  });
  trackEv('edit_action', { tool: 'place', n: 1 });
}
