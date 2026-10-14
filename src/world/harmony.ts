// 베타 1장: 「어울림」 계산 · 효과 · 발견 · 숨은 조합 힌트
//  두(세) 건물·장식이 발자국 가장자리 기준 2칸 이내(대각선 포함)에 있으면 성립. 한 건물에 최대 3개, 같은 어울림은 한 건물에 한 번.
//  같은 조합을 여러 벌 만들면 세트마다 따로 효과(건물 효과). 전역 효과는 조합마다 한 번.
import { CONFIG, type HarmonyFx } from '../data/config';
import { seasonLock } from './decodrop';
import { def, type Kind } from '../data/catalog';
import { HARMONIES, harmonyById, type HarmonyDef, type HarmonyPart } from '../data/harmony';
import { hourNow } from './clock';
import { townGrade } from './guide';
import { addRep, stars } from './progress';
import { earn, P, S, world, type Building } from './state';
import { floatW } from './fx';
import { dailyAdd } from './daily';
import { flag } from './flags';
import { josa } from '../data/josa';

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

/** TOWN T4: 앵커에서 오른쪽(가로) 또는 아래(세로)로 같은 줄에 이어지는 n개 (사이 빈칸 R 이하) */
function lineFrom(anchor: Building, p: HarmonyPart, live: Building[], R: number, ok: (o: Building) => boolean, m: (p: HarmonyPart, o: Building) => boolean = matches): Building[] | null {
  const n = p.n ?? 1;
  for (const dx of [1, 0] as const) {
    const out = [anchor];
    let cur = anchor;
    while (out.length < n) {
      const next = live
        .filter((o) => !out.includes(o) && m(p, o) && ok(o) && (dx ? o.ty === cur.ty && o.tx > cur.tx && o.tx - (cur.tx + cur.fw) <= R : o.tx === cur.tx && o.ty > cur.ty && o.ty - (cur.ty + cur.fh) <= R))
        .sort((a, b) => (dx ? a.tx - b.tx : a.ty - b.ty))[0];
      if (!next) break;
      out.push(next);
      cur = next;
    }
    if (out.length >= n) return out;
  }
  return null;
}

/** 이 배치에서 성립하는 어울림 전부 (공사 중인 건물은 빼고) — K10 harmonyV2면 새 규칙 */
export function computeSets(objs: Building[]): HSet[] {
  return flag('harmonyV2') ? computeSetsV2(objs) : computeSetsV1(objs);
}
/** 옛 규칙 (v0.25.3까지): 한 물건 최대 3개 · 어울림 순서대로 세트를 다 만든다 · 거리는 첫 자리(앵커) 기준 */
function computeSetsV1(objs: Building[]): HSet[] {
  const live = objs.filter((o) => o.build === undefined);
  const has = new Map<Building, Set<number>>();
  const got = (o: Building) => has.get(o) ?? has.set(o, new Set()).get(o)!;
  const free = (o: Building, id: number) => got(o).size < H.perBuilding && !got(o).has(id);
  const out: HSet[] = [];
  for (const h of HARMONIES) {
    const [first, ...rest] = h.parts;
    const R = h.range ?? H.range;
    for (const anchor of live) {
      if (!matches(first, anchor) || !free(anchor, h.id)) continue;
      // TOWN T4: 줄 어울림 — 같은 줄(가로 또는 세로)로 사이 R칸 이하씩 N개
      if (h.shape === 'line') {
        const line = lineFrom(anchor, first, live, R, (o) => free(o, h.id));
        if (!line) continue;
        for (const o of line) got(o).add(h.id);
        out.push({ id: h.id, members: line });
        continue;
      }
      const chosen = [anchor];
      let ok = true;
      // TOWN T4: 첫 자리에 n(여러 채·여러 그루)이 있으면 앵커와 같은 종류를 더 찾는다
      if ((first.n ?? 1) > 1) {
        const more = live.filter((o) => o !== anchor && matches(first, o) && free(o, h.id) && gap(anchor, o) <= R).sort((a, b) => gap(anchor, a) - gap(anchor, b)).slice(0, (first.n ?? 1) - 1);
        if (more.length < (first.n ?? 1) - 1) continue;
        chosen.push(...more);
      }
      for (const p of rest) {
        const c = live
          .filter((o) => !chosen.includes(o) && matches(p, o) && free(o, h.id) && gap(anchor, o) <= R)
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

// ───────── K10 harmonyV2: 「모아 놨는데 안 생김」 고치기 ─────────
/** 이름이 같은 장식은 같은 물건으로 본다 (술통 더미 barrels·barrel_stack · 장미 아치 arbor·rose_arch) */
const SAME: Partial<Record<Kind, Kind[]>> = { barrels: ['barrel_stack'], barrel_stack: ['barrels'], arbor: ['rose_arch'], rose_arch: ['arbor'] };
const matches2 = (p: HarmonyPart, o: Building) => matches(p, o) || (Array.isArray(p.k) && p.k.some((k) => SAME[k]?.includes(o.kind)));
/** 1칸 장식은 어울림 개수 제한 없음 (큰 건물만 capOf) */
const smallDeco = (o: Building) => !!def(o.kind).deco && o.fw === 1 && o.fh === 1;
/** 형철 #22: 큰 건물 한 채가 낄 수 있는 어울림 수 — 2×2는 4 · 3×3은 6 · 나머지는 perBuilding(3) */
export const capOf = (o: { fw: number; fh: number }) => H.perBuildingBySize[`${o.fw}x${o.fh}`] ?? H.perBuilding;
/** 앵커에서 시작해 이 어울림 한 세트 (못 만들면 null) — 구역 어울림은 「이어진 덩어리」: 새 부품은 이미 고른 부품 중 하나와 R칸 안 */
function setFrom(h: HarmonyDef, anchor: Building, live: Building[], ok: (o: Building) => boolean): Building[] | null {
  const [first, ...rest] = h.parts;
  const R = h.range ?? H.range;
  if (!matches2(first, anchor) || !ok(anchor)) return null;
  if (h.shape === 'line') return lineFrom(anchor, first, live, R, ok, matches2);
  const chosen = [anchor];
  if (h.zone) {
    const need = h.parts.map((p, i) => ({ p, n: (p.n ?? 1) - (i === 0 ? 1 : 0) }));
    for (;;) {
      const open = need.filter((x) => x.n > 0);
      if (!open.length) return chosen;
      let best: Building | null = null;
      let bx: (typeof need)[number] | null = null;
      let bd = Infinity;
      for (const x of open)
        for (const o of live) {
          if (chosen.includes(o) || !matches2(x.p, o) || !ok(o)) continue;
          const d = Math.min(...chosen.map((c) => gap(c, o)));
          if (d < bd) (bd = d), (best = o), (bx = x);
        }
      if (!best || !bx || bd > R) return null;
      chosen.push(best);
      bx.n--;
    }
  }
  if ((first.n ?? 1) > 1) {
    const more = live.filter((o) => o !== anchor && matches2(first, o) && ok(o) && gap(anchor, o) <= R).sort((a, b) => gap(anchor, a) - gap(anchor, b)).slice(0, (first.n ?? 1) - 1);
    if (more.length < (first.n ?? 1) - 1) return null;
    chosen.push(...more);
  }
  for (const p of rest) {
    const c = live
      .filter((o) => !chosen.includes(o) && matches2(p, o) && ok(o) && gap(anchor, o) <= R)
      .sort((a, b) => gap(anchor, a) - gap(anchor, b))
      .slice(0, p.n ?? 1);
    if (c.length < (p.n ?? 1)) return null;
    chosen.push(...c);
  }
  return chosen;
}
/** 새 규칙: ① 어울림마다 먼저 한 세트씩 ② 그다음 남은 물건으로 추가 세트 (건물 효과 중복용 · 전역 효과는 원래대로 어울림마다 한 번) */
export function computeSetsV2(objs: Building[]): HSet[] {
  const live = objs.filter((o) => o.build === undefined);
  const has = new Map<Building, Set<number>>();
  const got = (o: Building) => has.get(o) ?? has.set(o, new Set()).get(o)!;
  const free = (o: Building, id: number) => !got(o).has(id) && (smallDeco(o) || got(o).size < capOf(o));
  const out: HSet[] = [];
  const take = (h: HarmonyDef, m: Building[]) => {
    for (const o of m) got(o).add(h.id);
    out.push({ id: h.id, members: m });
  };
  for (const h of HARMONIES)
    for (const a of live) {
      const m = setFrom(h, a, live, (o) => free(o, h.id));
      if (m) {
        take(h, m);
        break;
      }
    }
  for (const h of HARMONIES)
    for (const a of live) {
      const m = setFrom(h, a, live, (o) => free(o, h.id));
      if (m) take(h, m);
    }
  return out;
}
/** 어울림 보기에서 부품 하나를 누르면: 이 물건이 낄 수 있는 어울림과 진행 (「시장 거리 3/4 — 과일 수레가 없어요」) */
export function partProgress(o: Building): string[] {
  const live = world.objs.filter((x) => x.build === undefined);
  const lines: string[] = [];
  const sets = harmonySets();
  for (const h of HARMONIES) {
    if (!h.parts.some((p) => matches2(p, o))) continue;
    const known = h.open || P.harmony.found.includes(h.id) || hintLv(h) >= 2;
    const name = known ? h.name : '???';
    if (sets.some((s) => s.id === h.id && s.members.includes(o))) {
      lines.push(`${name} ✓`);
      continue;
    }
    // 이 물건 둘레(구역은 이어진 덩어리 · 나머지는 R칸)에서 채워지는 자리 세기
    const R = h.range ?? H.range;
    const chosen = [o];
    const need = h.parts.map((p) => ({ p, n: p.n ?? 1 }));
    const mine = need.find((x) => matches2(x.p, o));
    if (mine) mine.n--;
    for (const x of need)
      while (x.n > 0) {
        const c = live.filter((y) => !chosen.includes(y) && matches2(x.p, y) && (h.zone ? chosen.some((z) => gap(z, y) <= R) : gap(o, y) <= R))[0];
        if (!c) break;
        chosen.push(c);
        x.n--;
      }
    const total = h.parts.reduce((s, p) => s + (p.n ?? 1), 0);
    const miss = need.filter((x) => x.n > 0);
    const missTxt = known ? miss.map((x) => partName({ ...x.p, n: x.n })).join(' · ') : '무언가';
    lines.push(`${name} ${total - miss.reduce((s, x) => s + x.n, 0)}/${total}${miss.length ? ` — ${missTxt}${josa(missTxt, '이')} 없어요` : ''}${h.shape === 'line' ? ' (같은 줄로)' : ''}`);
  }
  return lines.slice(0, 3);
}
/** 로드 때 다시 계산: 이미 조건을 채운 어울림은 바로 발견 (보상은 우편) · 다 모았으면 칭호 */
export function recountHarmony(mail: (title: string, body: string, gold: number) => void): number {
  if (!flag('harmonyV2') || S.visiting) return 0;
  const fresh = checkDiscover(true);
  if (fresh.length) {
    const gold = fresh.reduce((s, x) => s + harmonyGold(x.id), 0);
    addRep(H.rep * fresh.length);
    mail(`어울림 ${fresh.length}개 발견`, `모아 둔 어울림이 이제 성립해요: ${fresh.map((s) => `「${harmonyById(s.id).name}」`).join(' ')} · 평판 +${H.rep * fresh.length}`, gold);
  }
  if (!P.harmony.allDone && HARMONIES.every((h) => P.harmony.found.includes(h.id))) {
    P.harmony.allDone = true;
    if (!P.titles.includes('어울림 장인')) P.titles.push('어울림 장인');
    harmonyHooks.complete();
  }
  return fresh.length;
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
export const harmonyHooks = { found: (_s: HSet, _gold: number) => {}, complete: () => {} };
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
    dailyAdd('newHarm');
  }
  // TOWN T4: 어울림 도감을 다 채우면 칭호 「어울림 장인」 + 분수 하나 (선물 장식)
  if (!silent && !P.harmony.allDone && HARMONIES.every((h) => P.harmony.found.includes(h.id))) {
    P.harmony.allDone = true;
    if (!P.titles.includes('어울림 장인')) P.titles.push('어울림 장인');
    harmonyHooks.complete();
  }
  return fresh;
}

// ───────── 숨은 조합 힌트 (게임 하루에 하나씩 더 구체해진다) ─────────

/** 힌트 단계: 처음 공개 조합은 3, 숨은 조합은 1(분위기)부터 */
export const hintLv = (h: HarmonyDef) => (h.open ? 3 : Math.max(1, P.harmony.hint[h.id] ?? 1, flag('harmonyV2') && world.objs.some((o) => h.parts.some((p) => matches2(p, o))) ? 2 : 1));
const partName = (p: HarmonyPart) => {
  const n = p.k === 'trophy' ? '트로피' : p.k === 'plaque' ? '평가 현판' : def(p.k[0] as Kind).name;
  return p.n && p.n > 1 ? `${n} ${p.n}개` : n;
};
export const partsText = (h: HarmonyDef) => h.parts.map(partName).join(' + ');
/** 숨은 조합 힌트 한 줄 (단계별) */
export function hintText(h: HarmonyDef, lv = hintLv(h)): string {
  if (lv >= 3) return partsText(h);
  if (lv === 2) return flag('harmonyV2') ? `${h.hint} (${partsText(h)})` : `${h.hint} (${partName(h.parts[0])} + ???)`;
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
    // DECO_DROP §1: 계절 장식 (눈사람은 겨울에만 살 수 있다)
    case 'snowman':
      return seasonLock(k);
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
