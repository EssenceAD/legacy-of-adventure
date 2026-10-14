// LUXE §1-3 영웅 의상실 (플래그 outfits · 실험실 vis) — 화면 없는 규칙 (화면은 ui/wardrobe.ts · 색 바꾸기는 engine/outfitPaint.ts 한 함수)
//  누가: 영웅 10(heroId) · 전설 14(legendId) · 다섯 별 5(starId) — 각자 2벌 (data/outfits.ts · 형철 표)
//  ① = 인연 「친구」(3단계) 보상 — 오를 때 바로 · 이미 친구 이상인 사람은 불러올 때(odState · dailyOwner) 소급
//      다섯 별은 인연(ties)이 없어서: 합류 + 밤 단골 대화(heart)를 들은 때를 「친구」로 본다
//  ② = 명품관에서 산다 (outfitShopRows · buyOutfit — 상점 §1 명품관 탭이 luxeShopHooks.outfits로 부른다) · 값은 data/luxe_cfg.ts LUXE_OUTFITS
//  입기·벗기는 무료 (wearOutfit) · 플래그를 끄면 그림은 모두 기본 옷 (가진 것·입은 것은 지우지 않는다)
import { charInfo, isOutfitId, OUTFIT_CHARS, OUTFITS, outfitsOf, type OutfitDef } from '../data/outfits';
import { LUXE_OUTFITS } from '../data/luxe_cfg';
import { CLASSES, type ClassDef } from '../data/classes';
import { HEROES } from '../data/heroes';
import { LEGENDS } from '../data/legends';
import { isStarId, STARS } from '../data/fivestars';
import { freshOutfits, markDirty, P, S, uiHooks, type Actor, type OutfitState } from './state';
import { vis } from './visual';

const C = LUXE_OUTFITS;
/** 켜졌나: 플래그(모두) 또는 실험실(이 기기) */
export const outfitsOn = (): boolean => vis('outfits');

/** 빈 칸 바로잡기 (옛 저장 · 모양이 이상한 값) + 「친구」 보상 소급 */
export function odState(): OutfitState {
  const o = (P.outfits ??= freshOutfits()) as OutfitState;
  if (!Array.isArray(o.owned)) o.owned = [];
  o.owned = o.owned.filter((x, i, a) => isOutfitId(x) && a.indexOf(x) === i);
  if (!o.worn || typeof o.worn !== 'object' || Array.isArray(o.worn)) o.worn = {};
  for (const [k, v] of Object.entries(o.worn)) if (!isOutfitId(v) || OUTFITS[v].char !== k || !o.owned.includes(v)) delete o.worn[k];
  if (!Array.isArray(o.got)) o.got = [];
  return o;
}

// ───────── 누구 · 어떤 상태 ─────────

/** 손님 → 의상 캐릭터 키 (의상이 없는 사람이면 null) */
export function charOf(a: Pick<Actor, 'legendId' | 'heroId' | 'starId'> | null | undefined): string | null {
  if (!a) return null;
  const k = isStarId(a.starId) ? a.starId : (a.legendId ?? a.heroId ?? null);
  return k && charInfo(k) ? k : null;
}
/** 초상화 키(legend_x · hero_x · star_x) → 캐릭터 키 */
export function charOfPort(key: string | null | undefined): string | null {
  const m = key ? /^(legend|hero|star)_(.+)$/.exec(key) : null;
  return m && charInfo(m[2]) ? m[2] : null;
}
export const portOfChar = (char: string): string => {
  const t = charInfo(char)?.tier;
  return t === 'star' ? 'star_' + char : t === 'legend' ? 'legend_' + char : 'hero_' + char;
};

/** 영입했나 (영웅 도감 · 전설 합류 · 다섯 별 합류) */
export function recruited(char: string): boolean {
  const t = charInfo(char)?.tier;
  if (t === 'hero') return !!P.dex?.heroes?.[char]?.recruited;
  if (t === 'legend') return P.legends?.[char]?.st === 'joined';
  if (t === 'star') return !!P.five?.joined?.includes(char);
  return false;
}
/** 「친구」 이상인가 (① 조건) */
export function friendOk(char: string): boolean {
  const t = charInfo(char)?.tier;
  if (t === 'star') return recruited(char) && !!P.five?.heart?.includes(char);
  if (!t) return false;
  return (P.ties?.[char]?.stage ?? 0) >= C.friendStage;
}

export const owns = (id: string): boolean => !!P.outfits?.owned?.includes(id);
/** 지금 입은 의상 (플래그 꺼짐 · 안 입음 · 안 가짐이면 null) — 그림이 매 프레임 부르므로 가볍게 (바로잡기 없음) */
export function wornOf(char: string | null | undefined): string | null {
  if (!char || !outfitsOn()) return null;
  const o = P.outfits;
  const id = o?.worn?.[char];
  return id && OUTFITS[id]?.char === char && o.owned.includes(id) ? id : null;
}
export const wornOfActor = (a: Pick<Actor, 'legendId' | 'heroId' | 'starId'> | null | undefined) => wornOf(charOf(a));

// ───────── 얻기 ─────────

/** 「친구」 보상 ① 주기 — 이미 친구 이상인 사람 전부 (소급 · 플래그와 상관없이 가진 것으로만 · 그림은 켰을 때만) · 새로 준 의상 id */
export function outfitSync(): string[] {
  const o = odState();
  const out: string[] = [];
  for (const c of OUTFIT_CHARS) {
    const id = c.char + '_1';
    if (!o.owned.includes(id) && OUTFITS[id] && friendOk(c.char)) {
      o.owned.push(id);
      out.push(id);
    }
  }
  if (out.length) markDirty();
  return out;
}
/** 인연이 오른 순간 (world/owner.ts tieEvent) — 「친구」가 됐으면 ① + 안내 한 줄 (켰을 때만) */
export function outfitOnTie(char: string, stage: number) {
  if (stage < C.friendStage) return;
  const got = outfitSync();
  const id = char + '_1';
  if (!got.includes(id) || !outfitsOn()) return;
  const o = odState();
  if (!o.got.includes(id)) o.got.push(id);
  uiHooks.toast(`인연 「친구」 보상: ${charInfo(char)?.name ?? ''}의 의상 「${OUTFITS[id].name}」 — 영웅 창 [의상]에서 입혀 봐요`);
}

/** ② 값 */
export function outfitPrice(id: string): number {
  const o = OUTFITS[id];
  const t = o ? charInfo(o.char)?.tier : undefined;
  if (!o || o.n !== 2) return 0;
  if (t === 'hero') return C.price.hero;
  if (t === 'star') return C.price.star;
  return C.price.legend[o.char] ?? C.price.legendDefault;
}

/** 잠긴 의상의 얻는 법 한 줄 */
export function howToGet(id: string): string {
  const o = OUTFITS[id];
  if (!o) return '';
  const t = charInfo(o.char)?.tier;
  if (o.n === 1) return t === 'star' ? '합류 뒤 밤에 말을 걸어 마음을 나누면 (「친구」) 받아요' : '인연 「친구」가 되면 받아요';
  const p = `명품관 ${Math.round(outfitPrice(id) / 10000)}만 금화`;
  return recruited(o.char) ? p : `영입한 뒤 ${p}`;
}

export interface OutfitShopRow {
  id: string;
  /** 캐릭터 키 · 이름 · 영웅/전설/다섯 별 */
  char: string;
  who: string;
  tier: 'hero' | 'legend' | 'star';
  /** 초상화 키 (legend_x · hero_x · star_x) — 미리보기는 ui/wardrobe.ts outfitPreview(id) */
  port: string;
  name: string;
  price: number;
  owned: boolean;
  /** 지금 살 수 있나 · 못 사면 이유 */
  can: boolean;
  why: string;
}
/** 명품관 「영웅 의상」 줄: 영입한 사람의 ② (꺼짐이면 빈 줄) — 영웅 → 전설 → 다섯 별, 값 순 */
export function outfitShopRows(): OutfitShopRow[] {
  if (!outfitsOn()) return [];
  odState();
  const rank = { hero: 0, legend: 1, star: 2 } as const;
  return OUTFIT_CHARS.filter((c) => recruited(c.char))
    .map((c): OutfitShopRow => {
      const id = c.char + '_2';
      const price = outfitPrice(id);
      const owned = owns(id);
      const why = owned ? '가지고 있어요' : S.gold < price ? '금화가 모자라요' : '';
      return { id, char: c.char, who: c.name, tier: c.tier, port: portOfChar(c.char), name: OUTFITS[id].name, price, owned, can: !owned && !why, why };
    })
    .sort((a, b) => rank[a.tier] - rank[b.tier] || a.price - b.price);
}
/** ② 사기 — 성공이면 ok (입히기는 따로 · 영웅 창 [의상]) */
export function buyOutfit(id: string): { ok: boolean; msg: string } {
  if (!outfitsOn()) return { ok: false, msg: '아직 열리지 않았어요' };
  const o = OUTFITS[id];
  if (!o || o.n !== 2) return { ok: false, msg: '살 수 없는 의상이에요' };
  const st = odState();
  if (st.owned.includes(id)) return { ok: false, msg: '이미 가지고 있어요' };
  if (!recruited(o.char)) return { ok: false, msg: '먼저 영입해야 해요' };
  const price = outfitPrice(id);
  if (S.gold < price) return { ok: false, msg: '금화가 모자라요' };
  S.gold -= price;
  st.owned.push(id);
  markDirty();
  return { ok: true, msg: `${charInfo(o.char)?.name ?? ''}의 의상 「${o.name}」을 들였어요 — 영웅 창 [의상]에서 입혀 봐요` };
}

/** 입히기 (id) · 기본 옷으로 (null) — 무료 · 가진 것만 */
export function wearOutfit(char: string, id: string | null): boolean {
  const st = odState();
  if (id === null) {
    delete st.worn[char];
    markDirty();
    return true;
  }
  if (!st.owned.includes(id) || OUTFITS[id]?.char !== char) return false;
  st.worn[char] = id;
  markDirty();
  return true;
}

/** 옷장 칸: 기본 옷 + 2벌 (가졌나 · 입었나 · 잠김이면 얻는 법) */
export function wardrobeCells(char: string): { id: string | null; name: string; owned: boolean; worn: boolean; how: string; n: 0 | 1 | 2 }[] {
  const st = odState();
  const worn = st.worn[char] ?? null;
  return [
    { id: null, name: '기본 옷', owned: true, worn: !worn, how: '', n: 0 as const },
    ...outfitsOf(char).map((o: OutfitDef) => ({ id: o.id, name: o.name, owned: st.owned.includes(o.id), worn: worn === o.id, how: howToGet(o.id), n: o.n })),
  ];
}

// ───────── 초상화가 쓰는 원래 겉모습 (그림 없이 데이터만) ─────────

/** 캐릭터 기본 정의 (직업 · 머리색 · 이름 있는 겉모습 열쇠) — 초상화 색 바꾸기의 「원래 옷 색」 기준 */
export function charBaseDef(char: string): ClassDef | null {
  const t = charInfo(char)?.tier;
  if (t === 'star' && isStarId(char)) {
    const s = STARS[char];
    return { ...CLASSES[s.kind], hair: s.hair, named: 'star_' + char, mythic: true };
  }
  const l = t === 'legend' ? LEGENDS.find((x) => x.key === char) : null;
  if (l) return { ...CLASSES[l.kind], hair: l.hair, named: char };
  const h = t === 'hero' ? HEROES.find((x) => x.id === char) : null;
  if (h) return { ...CLASSES[h.kind], hair: h.hair, named: char };
  return null;
}
