// CHECKIN §J6 영웅 카드 (플래그 heroCards · 실험실) — 손님·영웅 창 · 원정·사냥·토벌·심연 파티 고르기 · 단골 제안 · 대장간(J7)이 같이 쓰는 부품 하나
//  카드 = 숙박 카드 틀(guestcard_9, 9-slice ×k1) · 초상화가 위쪽을 꽉 채움 · 희귀도 색 테두리 · 왼쪽 위 역할 · 아래 이름·Lv·전투력 · ★ · 못 가면 흐리게 + 이유
//  파티 덱 = 맨 위 고정(자리 칸 · 역할 3칸 · 조합 · 추천 전투력 막대 · [추천 편성][출발]) + 아래 카드 격자(역할 칩 · 정렬)
import { CLASSES, RARITY_INFO } from '../data/classes';
import { GRADE_INFO } from '../data/items';
import { CONFIG } from '../data/config';
import { pairById } from '../data/chem';
import { powerOf } from '../world/adventurers';
import { bondOf } from '../world/chem';
import { isFav } from '../world/growth';
import { isMythic } from '../world/mythic';
import { ROLE_ICON, ROLE_NAME, roleOf, type Role } from '../world/party';
import { awayText, resting, type PartyWhere } from '../world/partyRules';
import { companionText, isCompanion } from '../world/expeditions';
import { ledgerNeed, party4Open } from '../world/party4';
import { markDirty, P, type Actor } from '../world/state';
import { $$, esc, fmt, keepScroll, pic, portrait } from './common';
import { shakeLv } from '../engine/shake';
import { saverOn } from '../engine/fps';
import { vis } from '../world/visual';
import { uiSrc } from './kit';
import { roleRow, synRow } from './partyUi';
import { toast } from './windows';
import { showActor } from './guests';

// ───────── 카드 한 장 ─────────

export type HeroTier = 'common' | 'special' | 'legend' | 'hero' | 'saga' | 'mythic';
export const TIER_NAME: Record<HeroTier, string> = { common: '평범', special: '특별', legend: '전설', hero: '영웅', saga: '전설 영웅', mythic: '신화' };
/** 전설 영웅 금빛 = 마을 HERODOT 이름표의 전설 금색 (world/render.ts drawNamedTags) */
export const SAGA_GOLD = '#ffd36b';
/** 희귀도 색 (있는 색 그대로: 손님 희귀도 · 장비 「영웅」 보라 · 전설 표시 금빛) */
const TIER_COLOR: Record<HeroTier, string> = {
  common: RARITY_INFO.common.color,
  special: RARITY_INFO.special.color,
  legend: RARITY_INFO.legend.color,
  hero: GRADE_INFO.e.color,
  saga: SAGA_GOLD,
  mythic: '#ffd36b',
};
/**
 * 카드 등급: 신화 > 전설 영웅 > 영웅(보라) > 전설 손님(주황) > 특별 > 평범
 *  legendFrame(실험실) 끄면 예전 그대로 — 전설 영웅도 전설 손님과 같은 'legend'
 */
export function heroTier(a: Actor, lf = vis('legendFrame')): HeroTier {
  if (isMythic(a)) return 'mythic';
  if (a.legendId) return lf ? 'saga' : 'legend';
  if (a.heroId) return 'hero';
  return a.rarity === 'legend' ? 'legend' : a.rarity === 'special' ? 'special' : 'common';
}

export interface CardOpts {
  /** md = 격자 카드 · sm = 작은 판(파티 자리 · 대장간 줄) */
  size?: 'md' | 'sm';
  /** 파티에 들어감 */
  on?: boolean;
  /** 못 넣는 이유 (있으면 흐리게 + 이 글) — 안 주면 원정 중 · 쉬는 중을 스스로 */
  why?: string | null;
  /** 갈 수는 있지만 알려 줄 것 (지쳤어요) */
  note?: string | null;
  /** 왼쪽 아래 작은 표 (대장 · AI) */
  badge?: string;
  /** 카드 아래 덧붙일 작은 글(상성 ↑ 같은 것 · html) */
  extra?: string;
  /** 반짝(추천 편성) · 쏙(방금 들어옴) · 하트(케미) */
  glow?: boolean;
  pop?: boolean;
  heart?: boolean;
  /** 누를 수 없는 그림 카드 (단골 제안) */
  still?: boolean;
  /** 원정 중 · 쉬는 중을 스스로 표시할지 (손님 창 = 예) */
  auto?: boolean;
}

/** 카드에 들어갈 것 (시험용으로도) */
export function heroCardData(a: Actor, o: CardOpts = {}) {
  const tier = heroTier(a);
  const role = roleOf(a);
  const auto = o.auto !== false;
  const why = o.why !== undefined ? o.why : auto ? (awayText(a) ?? (resting(a) && (a.status === 'regular' || a.status === 'hero') ? '쉬는 중' : null)) : null;
  const src = portrait(a);
  return {
    tier,
    tierName: TIER_NAME[tier],
    color: TIER_COLOR[tier],
    role,
    roleName: ROLE_NAME[role],
    cls: CLASSES[a.kind as keyof typeof CLASSES]?.name ?? '',
    name: a.name,
    lvl: a.lvl,
    power: Math.round(powerOf(a)),
    fav: isFav(a),
    dim: !!why,
    why: why ?? null,
    src,
    /** 일러스트 초상화가 없으면 도트 얼굴 확대 */
    dot: !!src && src === pic(a) && !a.role && !a.legendId && !a.heroId && !a.cameo,
  };
}

/** 금빛 줄기를 쉴 때: calmWorld · 배터리 절약(saver) — prefers-reduced-motion 은 CSS가 */
const lfCalm = () => vis('calmWorld') || saverOn();

export function heroCardHtml(a: Actor, o: CardOpts = {}): string {
  const d = heroCardData(a, o);
  const sm = o.size === 'sm';
  // legendFrame: 전설 영웅·신화 = 이중 금테 + 네 귀 보석 + 왼쪽 위 왕관 리본(역할은 오른쪽) + 금빛 이름 + 3초마다 빛 한 줄기
  const lf = (d.tier === 'saga' || d.tier === 'mythic') && vis('legendFrame');
  const cls = ['hcd', sm ? 'sm' : 'md', `t-${d.tier}`, lf ? 'lf' : '', lf && lfCalm() ? 'calm' : '', o.on ? 'on' : '', d.dim ? 'dim' : '', o.glow ? 'rglow' : '', o.pop ? 'pop' : '', d.dot ? 'dotf' : ''].filter(Boolean).join(' ');
  const tag = o.still ? 'div' : 'button';
  const title = `${d.name} · ${d.tierName} ${d.cls} · ${d.roleName} · Lv.${d.lvl} · 전투력 ${fmt(d.power)}${d.why ? ` · ${d.why}` : ''}`;
  const role = `<span class="hcd-role r-${d.role}"><i>${ROLE_ICON[d.role]}</i>${sm ? '' : `<small>${d.roleName}</small>`}</span>`;
  const fav = d.fav ? '<b class="hcd-fav">★</b>' : '';
  const heart = o.heart ? `<img class="hcd-heart" src="${uiSrc('heart')}" alt="케미">` : '';
  const badge = o.badge ? `<b class="hcd-badge">${esc(o.badge)}</b>` : '';
  const frame = lf ? `<span class="hcd-lf" aria-hidden="true"></span><span class="hcd-crown"><i></i>${sm ? '' : `<small>${d.tier === 'mythic' ? '신화' : '전설'}</small>`}</span>` : '';
  const pic1 = `<span class="hcd-pic"><img src="${d.src}" alt=""></span>`;
  const txt = sm
    ? `<span class="hcd-txt"><b class="hcd-nm">${esc(d.name)}</b></span>`
    : `<span class="hcd-txt"><b class="hcd-nm">${esc(d.name)}</b><span class="hcd-ln"><small class="hcd-lv">Lv.${d.lvl}</small><em class="hcd-pw">${fmt(d.power)}</em></span>${
        d.why ? `<small class="hcd-why">${esc(d.why)}</small>` : o.note ? `<small class="hcd-note">${esc(o.note)}</small>` : o.extra ? `<small class="hcd-ex">${o.extra}</small>` : ''
      }</span>`;
  return `<${tag} class="${cls}" ${o.still ? '' : `type="button" data-hc="${a.id}" data-id="${a.id}"`} style="--rc:${d.color}" title="${esc(title)}" aria-label="${esc(title)}">${pic1}${frame}${role}${fav}${heart}${badge}${txt}${sm && d.why ? `<small class="hcd-why">${esc(d.why)}</small>` : ''}</${tag}>`;
}

// ───────── 파티 덱 ─────────

type Filter = 'all' | Role;
const FILTERS: Filter[] = ['all', 'tank', 'heal', 'dps'];
const SORTS = ['전투력', '레벨', '★'] as const;
let filter: Filter = 'all';
let sortI = 0;
/** 방금 자리에 들어간 사람 (한 번 그릴 때만 쏙) */
let popId = -1;
/** 추천 편성 결과 (한 번 그릴 때만 반짝) */
let glowIds: number[] = [];
export const deckPop = (id: number) => (popId = id);
export const deckGlow = (ids: number[]) => (glowIds = ids.slice());

export interface DeckCfg {
  where: PartyWhere;
  /** 보여 줄 후보 전체 (못 가는 사람 포함) */
  pool: Actor[];
  /** 고른 사람 (순서 = 자리) */
  sel: Actor[];
  max: number;
  block: (a: Actor) => string | null;
  note?: (a: Actor) => string | null;
  extra?: (a: Actor) => string;
  /** 자리 0 = 대장 · 3 = AI (사냥·토벌·심연) */
  lead?: boolean;
  /** 잠긴 자리 칸 (5번째 · 4번째) html */
  lockCell?: string;
  power: number;
  rec: number;
  recLabel?: string;
  /** 막대 아래 한 줄 (성공률 · 시간 …) */
  info?: string;
  synWhere: 'hunt' | 'raid' | 'exp';
  /** 추천 편성 버튼 id (없으면 버튼 없음) · 이유 한 줄 */
  recId?: string;
  recWhy?: string;
  /** 출발 버튼(들) html — 기존 id 그대로 */
  go: string;
  empty: string;
}

/** 케미가 켜진 두 사람 (발견한 케미만 — chemLine과 같은 기준) */
function chemPairs(sel: Actor[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < sel.length; i++)
    for (let j = i + 1; j < sel.length; j++) {
      const bd = bondOf(sel[i], sel[j]);
      const p = bd && pairById(bd.pair);
      if (bd && p && P.dex.chem.includes(p.id)) out.push([i, j]);
    }
  return out;
}

function slotsHtml(c: DeckCfg): string {
  const pairs = chemPairs(c.sel);
  const adj = new Set(pairs.filter(([i, j]) => j === i + 1).map(([i]) => i));
  const cells: string[] = [];
  for (let i = 0; i < c.max; i++) {
    const a = c.sel[i];
    if (i) cells.push(adj.has(i - 1) ? `<i class="hdk-gap on"><img src="${uiSrc('heart')}" alt="케미"></i>` : '<i class="hdk-gap"></i>');
    if (a)
      cells.push(
        heroCardHtml(a, { size: 'sm', on: true, auto: false, why: null, badge: c.lead && i === 0 ? '대장' : c.lead && i === 3 ? 'AI' : '', glow: glowIds.includes(a.id), pop: popId === a.id }).replace(
          'class="hcd ',
          `data-slot="${i}" class="hcd hdk-slot `,
        ),
      );
    else cells.push(`<span class="hdk-slot empty" aria-label="빈 자리"><small>${i + 1}</small></span>`);
  }
  return `<div class="hdk-slots" data-n="${c.max}">${cells.join('')}${c.lockCell ?? ''}</div>`;
}

/** 맨 위 고정 판 */
export function deckTopHtml(c: DeckCfg): string {
  const ratio = c.rec > 0 ? Math.min(1, c.power / c.rec) : 1;
  const ok = c.power >= c.rec;
  const bar = `<div class="hdk-pw ${ok ? 'ok' : 'low'}"><i><b style="width:${Math.round(ratio * 100)}%"></b></i><span>전투력 <b>${fmt(c.power)}</b> / ${c.recLabel ?? '추천'} ${fmt(c.rec)}</span></div>`;
  const ready = c.pool.filter((a) => !c.block(a));
  const rec = c.recId ? `<button class="bigbtn sm ghost" id="${c.recId}" ${ready.length ? '' : 'disabled'}>추천 편성</button>` : '';
  return `<div class="hdk-top">${slotsHtml(c)}<div class="hdk-rs">${roleRow(c.sel)}${synRow(c.sel, ready, c.max, c.synWhere)}</div>${bar}${c.info ? `<p class="hdk-info">${c.info}</p>` : ''}<div class="hdk-btns">${rec}${c.go}</div></div>`;
}

const sortKey = (a: Actor) => [powerOf(a), a.lvl * 1e6 + powerOf(a), (isFav(a) ? 1e12 : 0) + powerOf(a)][sortI];
/** legendFrame: 정렬 값이 같으면 전설 영웅(신화 포함) 먼저 (끄면 0 = 예전 그대로) */
export const sagaFirst = (a: Pick<Actor, 'legendId'>, lf = vis('legendFrame')) => (lf && a.legendId ? 1 : 0);

/** 아래 카드 격자 (역할 칩 · 정렬) — 못 가는 사람은 맨 뒤 */
export function deckGridHtml(c: DeckCfg): string {
  const ids = new Set(c.sel.map((a) => a.id));
  const shown = c.pool
    .filter((a) => filter === 'all' || roleOf(a) === filter)
    .sort((a, b) => +!!c.block(a) - +!!c.block(b) || sortKey(b) - sortKey(a) || sagaFirst(b) - sagaFirst(a));
  const chips = FILTERS.map((f) => `<button class="${f === filter ? 'on' : ''}" data-hf="${f}" title="${f === 'all' ? '전체' : ROLE_NAME[f]}" aria-label="${f === 'all' ? '전체' : ROLE_NAME[f]}">${f === 'all' ? '전체' : `${ROLE_ICON[f]}<small>${ROLE_NAME[f]}</small>`}</button>`).join('');
  // 정렬은 한 버튼(누를 때마다 전투력 → 레벨 → ★) — 폭 360에서도 칩과 한 줄
  const sorts = `<button class="on" data-hs="${(sortI + 1) % SORTS.length}" title="정렬 바꾸기">정렬 · ${SORTS[sortI]}</button>`;
  const cards = shown
    .map((a) => {
      const i = c.sel.findIndex((x) => x.id === a.id);
      const why = c.block(a);
      // 동행(방문 중인 전설)은 네 화면 모두 같은 표시
      const extra = `${isCompanion(a) && !why ? esc(companionText(a)) + ' ' : ''}${c.extra?.(a) ?? ''}`;
      return heroCardHtml(a, { on: ids.has(a.id), why, note: c.note?.(a) ?? null, extra, auto: false, badge: i < 0 ? '' : c.lead && i === 0 ? '대장' : `${i + 1}번` });
    })
    .join('');
  return `<div class="hdk-bar"><div class="sortb hdk-f">${chips}</div><div class="sortb hdk-s">${sorts}</div></div><div class="hcgrid hdk-grid${c.pool.length <= 12 ? ' few' : ''}">${cards || `<p class="note">${esc(c.empty)}</p>`}</div>${c.recWhy ? `<p class="hdk-why">💡 추천: ${esc(c.recWhy)}</p>` : ''}`;
}

/** 사냥·토벌·심연 4번째 자리: 안 열렸으면 잠긴 칸(조건) · 처음 4명 채우면 「봤음」 (partyUi.slotRow와 같은 규칙) */
export function lock4Cell(sel: Actor[], max: number): string {
  if (party4Open() && sel.length >= 4 && !P.meta.party4Seen) {
    P.meta.party4Seen = true;
    markDirty();
  }
  return max < 4 ? `<span class="pty-slot lock" title="훈련장 Lv5 + 장부 ${ledgerNeed()}장">🔒<small>훈련장 Lv5 · 장부 ${ledgerNeed()}장</small></span>` : '';
}

/** 덱 전체 (위 고정 + 격자) */
export const deckHtml = (c: DeckCfg) => `${deckTopHtml(c)}${deckGridHtml(c)}`;

/** 길게 누르면 상세 · 짧게 누르면 fn (긴 누름 뒤의 click은 무시) */
export function bindPress(el: HTMLElement, tap: () => void, long: () => void) {
  let t = 0;
  let fired = false;
  let sx = 0;
  let sy = 0;
  el.addEventListener('pointerdown', (e) => {
    fired = false;
    sx = e.clientX;
    sy = e.clientY;
    clearTimeout(t);
    t = window.setTimeout(() => {
      fired = true;
      long();
    }, CONFIG.placement.longPressMs + 50);
  });
  const cancel = () => clearTimeout(t);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > CONFIG.feedback23.longPressSlopPx) cancel();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.onclick = () => {
    if (fired) return void (fired = false);
    tap();
  };
}

/**
 * 덱 누르기 연결: 카드 = 넣기/빼기 (못 가면 이유 한 줄) · 자리 카드 = 빼기 · 길게 = 상세 · 칩·정렬 = 다시 그리기
 *  toggle(id)는 다시 그리기까지 (보통 keepScroll(() => openX()))
 */
export function bindDeck(c: DeckCfg, toggle: (id: number) => void, redraw: () => void) {
  const byId = new Map(c.pool.map((a) => [a.id, a]));
  for (const a of c.sel) byId.set(a.id, a);
  const selIds = new Set(c.sel.map((a) => a.id));
  $$('#winB .hcd[data-hc]').forEach((el) => {
    const a = byId.get(+el.dataset.hc!);
    if (!a) return;
    bindPress(
      el,
      () => {
        const why = c.block(a);
        if (why && !selIds.has(a.id)) return toast(`${a.name} · ${why}`);
        if (!selIds.has(a.id)) {
          if (c.sel.length >= c.max) return toast(`파티는 ${c.max}명까지예요 · 위 자리 카드를 눌러 빼요`);
          popId = a.id;
        }
        toggle(a.id);
      },
      () => showActor(a),
    );
  });
  $$('#winB [data-hf]').forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.hf as Filter;
        keepScroll(redraw);
      }),
  );
  $$('#winB [data-hs]').forEach(
    (b) =>
      (b.onclick = () => {
        sortI = +b.dataset.hs!;
        keepScroll(redraw);
      }),
  );
  // 한 번 그린 연출은 지움 (다음 그리기엔 없음) · 반짝은 누르면 바로 끝
  popId = -1;
  if (glowIds.length) {
    glowIds = [];
    const calm = shakeLv() === 'off';
    const els = $$('#winB .hcd.rglow');
    els.forEach((e) => e.classList.toggle('calm', calm));
    const end = () => els.forEach((e) => e.classList.remove('rglow', 'calm'));
    setTimeout(end, calm ? 300 : 900);
    document.getElementById('winB')?.addEventListener('pointerdown', end, { once: true });
  }
}

/** 시험용 */
export const _deck = { state: () => ({ filter, sortI, popId, glowIds }), reset: () => ((filter = 'all'), (sortI = 0), (popId = -1), (glowIds = [])) };
