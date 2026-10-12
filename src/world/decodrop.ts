// DECO_DROP: 꾸미기 장식 41종 건설 목록 · 묶음 탭 · 안 본 장식 NEW · 장식 도감(모은 종류) · 계절 장식
import { CATALOG, def, type Kind } from '../data/catalog';
import { CONFIG } from '../data/config';
import { markDirty, P, S, world } from './state';
import { storeList } from './store';

const D = () => CONFIG.deco;
/** 41종 (CONFIG.deco 표 순서) */
export const DROP_KINDS = [...Object.values(D().land).flatMap((r) => Object.keys(r)), ...Object.keys(D().seasonal)] as Kind[];
export const isDropKind = (k: string) => (DROP_KINDS as string[]).includes(k);
/** 묶음 탭 이름 (없으면 '마을') */
export function groupOf(k: string): string {
  for (const [g, ks] of Object.entries(D().groups)) if (ks.includes(k)) return g;
  return '마을';
}
export const GROUPS = () => Object.keys(D().groups);

/** 계절 장식: 지금 살 수 있나 (산 건 계속 둔다) — 아니면 까닭 */
export function seasonLock(k: string, now = new Date()): string | null {
  const s = D().seasonal[k];
  if (!s) return null;
  return s.months.includes(now.getMonth() + 1) ? null : '겨울(12~2월)에만 살 수 있어요';
}

const seen = () => (P.decor.seen ??= []);
/** 지금 땅에서 열린 장식 (계절 장식은 철일 때만) */
export function openDrops(land = S.land): Kind[] {
  return DROP_KINDS.filter((k) => def(k).unlock <= land && !seasonLock(k));
}
/** 건설 창에서 아직 못 본 열린 장식 */
export const unseenDrops = (): Kind[] => openDrops().filter((k) => !seen().includes(k));
export function markSeen(ks: Kind[]) {
  const s = seen();
  let ch = false;
  for (const k of ks) if (!s.includes(k)) (s.push(k), (ch = true));
  if (ch) markDirty();
}

/** 장식 도감: 한 번이라도 가진 장식 종류 (지금 마을 · 보관함 · 산 기록) */
export function ownedDrops(): Kind[] {
  const o = new Set<string>(P.decor.owned ?? []);
  for (const b of world.home?.objs ?? world.objs) if (isDropKind(b.kind)) o.add(b.kind);
  for (const s of storeList()) if (isDropKind(s.kind)) o.add(s.kind);
  return DROP_KINDS.filter((k) => o.has(k));
}
/** 새로 산 장식 기록 · 처음 산 종류면 true (오늘의 목표 「새 장식 1종」) */
export function noteBought(k: Kind): boolean {
  if (!isDropKind(k)) return false;
  const first = !ownedDrops().includes(k);
  const o = (P.decor.owned ??= []);
  if (!o.includes(k)) o.push(k);
  markDirty();
  return first;
}
/** 도감 보상: 받을 수 있는 단계 */
export const bookSteps = () => D().book.map((b, i) => ({ ...b, i, done: ownedDrops().length >= b.n, got: (P.decor.bookGot ?? []).includes(i) }));
export function claimBook(i: number): { gold: number; title: string } | null {
  const st = bookSteps()[i];
  if (!st || !st.done || st.got) return null;
  (P.decor.bookGot ??= []).push(i);
  S.gold += st.gold;
  if (st.title && !P.titles.includes(st.title)) P.titles.push(st.title);
  markDirty();
  return { gold: st.gold, title: st.title };
}
/** 땅 단계가 오르면 새로 열린 장식 수 */
export const newAtLand = (land: number) => Object.keys(D().land[land] ?? {}).filter((k) => k in CATALOG).length;
