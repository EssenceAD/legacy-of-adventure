// 베타 1장: 「어울림」 계산 · 효과 · 발견 · 숨은 조합 힌트
//  두(세) 건물·장식이 발자국 가장자리 기준 2칸 이내(대각선 포함)에 있으면 성립. 한 건물에 최대 3개, 같은 어울림은 한 건물에 한 번.
//  같은 조합을 여러 벌 만들면 세트마다 따로 효과(건물 효과). 전역 효과는 조합마다 한 번.
import { CONFIG, type HarmonyFx } from '../data/config';
import { def, type Kind } from '../data/catalog';
import { HARMONIES, harmonyById, type HarmonyDef, type HarmonyPart } from '../data/harmony';
import { hourNow } from './clock';
import { townGrade } from './guide';
import { addRep, stars } from './progress';
import { earn, P, S, world, type Building } from './state';
import { floatW } from './fx';

const H = CONFIG.harmony;
export interface HSet {
  id: number;
  members: Building[];
}

const matches = (p: HarmonyPart, o: Building) =>
  p.k === 'trophy' ? o.kind.startsWith('trophy_') : p.k === 'plaque' ? o.kind.startsWith('plaque_') : p.k.includes(o.kind);

/** 발자국 사이 빈칸 (붙어 있으면 0, 대각선은 큰 쪽) */
export function gap(a: { tx: number; ty: number; fw: number; fh: number }, b: { tx: number; ty: number; fw: number; fh: number }) {
  const gx = Math.max(0, b.tx - (a.tx + a.fw), a.tx - (b.tx + b.fw));
  const gy = Math.max(0, b.ty - (a.ty + a.fh), a.ty - (b.ty + b.fh));
  return Math.max(gx, gy);
}

/** 이 배치에서 성립하는 어울림 전부 (공사 중인 건물은 빼고) */
export function computeSets(objs: Building[]): HSet[] {
  const live = objs.filter((o) => o.build === undefined);
  const has = new Map<Building, Set<number>>();
  const got = (o: Building) => has.get(o) ?? has.set(o, new Set()).get(o)!;
  const free = (o: Building, id: number) => got(o).size < H.perBuilding && !got(o).has(id);
  const out: HSet[] = [];
  for (const h of HARMONIES) {
    const [first, ...rest] = h.parts;
    for (const anchor of live) {
      if (!matches(first, anchor) || !free(anchor, h.id)) continue;
      const chosen = [anchor];
      let ok = true;
      for (const p of rest) {
        const c = live
          .filter((o) => !chosen.includes(o) && matches(p, o) && free(o, h.id) && gap(anchor, o) <= H.range)
          .sort((a, b) => gap(anchor, a) - gap(anchor, b))
          .slice(0, p.n ?? 1);
        if (c.length < (p.n ?? 1)) {
          ok = false;
          break;
        }
        chosen.push(...c);
      }
      if (!ok) continue;
      for (const o of chosen) got(o).add(h.id);
      out.push({ id: h.id, members: chosen });
    }
  }
  return out;
}

// ───────── 지금 마을 (0.5초마다 배치가 바뀌었는지만 본다) ─────────

let sig = '';
let sets: HSet[] = [];
const sigOf = (objs: Building[]) => objs.map((o) => `${o.kind}${o.tx},${o.ty},${o.fw},${o.fh},${o.build === undefined ? 1 : 0}`).join('|');
export function harmonySets(): HSet[] {
  const s = (S.visiting ? S.visiting.id : '') + sigOf(world.objs);
  if (s !== sig) {
    sig = s;
    sets = computeSets(world.objs);
  }
  return sets;
}
const isNight = () => {
  const h = hourNow();
  return h >= H.nightFrom || h < H.nightTo;
};
const fxOf = (id: number): HarmonyFx => H.fx[id] ?? {};

/** 전역 효과 합 (내 마을만 · 조합마다 한 번) */
export function hfx(key: Exclude<keyof HarmonyFx, 'incKind' | 'night' | 'moodNight'>): number {
  if (S.visiting) return 0;
  const ids = new Set(harmonySets().map((s) => s.id));
  let v = 0;
  for (const id of ids) {
    const f = fxOf(id);
    if (f.night && !isNight()) continue;
    v += (f[key] as number | undefined) ?? 0;
  }
  return v;
}
/** 이 건물에 붙은 효과 합 (세트마다) */
export function bfx(o: Building, key: 'trainXp' | 'bath' | 'harvest'): number {
  let v = 0;
  for (const s of harmonySets()) if (s.members.includes(o)) v += fxOf(s.id)[key] ?? 0;
  return v;
}
/** 건물 수입 배율: incKind가 이 건물 종류인 어울림 */
export function incMult(o: Building): number {
  let v = 1;
  for (const s of harmonySets()) {
    if (!s.members.includes(o)) continue;
    const f = fxOf(s.id);
    if (f.incKind === o.kind && f.inc && (!f.night || isNight())) v += f.inc;
  }
  return v;
}
/** 이 건물이 속한 어울림 */
export const setsOf = (o: Building) => harmonySets().filter((s) => s.members.includes(o));

// ───────── 손님 기분 어울림 (범위 안 손님에게 게임 1시간마다) ─────────

let auraHour = -1;
export function tickHarmonyAura() {
  if (S.visiting || !S.started) return;
  const h = Math.floor(S.day * 24 + hourNow());
  if (h === auraHour) return;
  auraHour = h;
  for (const s of harmonySets()) {
    const f = fxOf(s.id);
    if (!f.mood || (f.moodNight && !isNight())) continue;
    for (const a of world.actors) {
      if (a.hidden || a.role || !a.id) continue;
      const near = s.members.some((o) => gap(o, { tx: Math.round(a.x), ty: Math.round(a.y), fw: 1, fh: 1 }) <= H.range);
      if (near) a.mood = Math.min(100, a.mood + f.mood);
    }
  }
}

// ───────── 발견 ─────────

/** ui가 채운다: 발견 연출 (점선 · 배너) */
export const harmonyHooks = { found: (_s: HSet, _gold: number) => {} };
export const harmonyGold = (id: number) => H.goldStep * Math.ceil(id / 6);

/** 새로 성립한 조합을 「발견」 처리 (보상 포함). silent면 연출 없이 목록만 (돌려준다) */
export function checkDiscover(silent = false): HSet[] {
  if (S.visiting || !S.started) return [];
  const fresh: HSet[] = [];
  for (const s of harmonySets()) {
    if (P.harmony.found.includes(s.id) || fresh.some((f) => f.id === s.id)) continue;
    fresh.push(s);
  }
  for (const s of fresh) {
    P.harmony.found.push(s.id);
    delete P.harmony.hint[s.id];
    if (silent) continue;
    const g = harmonyGold(s.id);
    S.gold += g;
    addRep(H.rep);
    harmonyHooks.found(s, g);
  }
  return fresh;
}

// ───────── 숨은 조합 힌트 (게임 하루에 하나씩 더 구체해진다) ─────────

/** 힌트 단계: 처음 공개 조합은 3, 숨은 조합은 1(분위기)부터 */
export const hintLv = (h: HarmonyDef) => (h.open ? 3 : Math.max(1, P.harmony.hint[h.id] ?? 1));
const partName = (p: HarmonyPart) => {
  const n = p.k === 'trophy' ? '트로피' : p.k === 'plaque' ? '평가 현판' : def(p.k[0] as Kind).name;
  return p.n && p.n > 1 ? `${n} ${p.n}개` : n;
};
export const partsText = (h: HarmonyDef) => h.parts.map(partName).join(' + ');
/** 숨은 조합 힌트 한 줄 (단계별) */
export function hintText(h: HarmonyDef, lv = hintLv(h)): string {
  if (lv >= 3) return partsText(h);
  if (lv === 2) return `${h.hint} (${partName(h.parts[0])} + ???)`;
  return h.hint;
}
/** 하루가 지나면: 아직 못 찾은 숨은 조합 하나의 힌트를 한 단계 */
export function advanceHint(): HarmonyDef | null {
  if (P.harmony.hintDay === S.day) return null;
  P.harmony.hintDay = S.day;
  const h = HARMONIES.find((x) => !x.open && !P.harmony.found.includes(x.id) && hintLv(x) < 3);
  if (!h) return null;
  P.harmony.hint[h.id] = hintLv(h) + 1;
  return h;
}
/** 특정 조합 힌트를 한 단계 (평가단 아쉬움 힌트) */
export function bumpHint(id: number) {
  const h = harmonyById(id);
  if (h.open || P.harmony.found.includes(id)) return;
  P.harmony.hint[id] = Math.min(3, hintLv(h) + 1);
}

/** 매일 평판 (여신의 가호 +1 · 광장 +2) */
export function dailyHarmonyRep(): number {
  const v = hfx('repDay');
  if (v > 0) addRep(v);
  return v;
}

// ───────── 장식 열림 조건 ─────────

const own = (k: Kind) => world.objs.some((o) => o.kind === k);
/** 잠겨 있으면 이유 한 줄 · 목록에서 아예 숨길 것은 'hide' */
export function decoLock(k: Kind): string | null | 'hide' {
  const g = townGrade();
  switch (k) {
    case 'barrels':
      return own('tavern') ? null : '주점이 있으면 열려요';
    case 'target':
      return own('training') ? null : '훈련장이 있으면 열려요';
    case 'arbor':
      return own('garden') ? null : '텃밭이 있으면 열려요';
    case 'lamppost':
      return g >= 1 ? null : '마을 등급 「쉼터」에 열려요';
    case 'statue':
      return stars() >= 2 ? null : '평판 ★2에 열려요';
    case 'stall':
      return g >= 2 ? null : '마을 등급 「마을」에 열려요';
    case 'fountain':
      return g >= 3 ? null : '마을 등급 「고을」에 열려요';
    case 'banner':
      return P.trophies.length ? null : '토벌 보스를 처음 쓰러뜨리면 열려요';
    case 'gate':
      return g >= 4 ? null : '마을 등급 「도시」에 열려요';
    case 'plaque_bronze':
    case 'plaque_silver':
    case 'plaque_gold':
      return P.harmony.plaques.includes(k) ? null : 'hide';
  }
  return null;
}

// ───────── 매 프레임 (main): 발견 · 기분 어울림 · 노점 수입 ─────────

let acc = 0;
let stallHour = -1;
export function tickHarmony(dt: number) {
  if (S.visiting || !S.started) return;
  acc += dt;
  if (acc < 0.5) return;
  acc = 0;
  checkDiscover();
  tickHarmonyAura();
  // 노점: 게임 1시간마다 지나가는 손님이 들러 금화 (손님이 마을에 있을 때)
  const h = Math.floor(S.day * 24 + hourNow());
  if (h === stallHour) return;
  stallHour = h;
  if (!world.actors.some((a) => !a.hidden && !a.role && a.id)) return;
  for (const o of world.objs) {
    if (o.kind !== 'stall' || o.build !== undefined) continue;
    const g = Math.round(H.stallGold * incMult(o) * (1 + hfx('gold')));
    earn(g, 'stall');
    floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 40, '+' + g);
  }
}
