// LUXE §1 명품관 화면 (상점 창 「명품관」 탭 · 규칙은 world/luxeShop.ts · 숫자는 data/luxe_cfg.ts LUXE_SHOP)
//  위에서부터: 이번 주 명품 · 세트 4줄(4점씩) · 영웅 의상(luxeShopHooks.outfits — 의상실이 채운다) · 작은 사치
//  산 장식은 꾸미기 보관함으로 → 창 위 「바로 놓기」
import { def, type Kind } from '../data/catalog';
import { LUXE_SHOP } from '../data/luxe_cfg';
import { sfx } from '../audio/sfx';
import { hourNow } from '../world/clock';
import { hasLux } from '../world/luxury';
import {
  basePrice, buyLuxe, buyWhy, couponLeft, dailySaleKind, kstMonthDay, luxeSets, lxLockWhy, lxNow, lxOn, lxState, nextReturn, ownsLuxe, priceOf, setOwnedN, weekEnd, weekStart, weeklyItem,
} from '../world/luxeShop';
import { S, type StoredObj } from '../world/state';
import { $$, esc, fmt } from './common';
import { confirmSheet } from './confirmSheet';
import { startTakeOut } from './hud';
import { lockAttr, lockNote } from './lockBtn';
import { bindShopTabsBar, shopTabHooks, shopTabsBar } from './shopTabs';
import { closeWin, openWin, thumbOf, toast } from './windows';

/** 의상실 같은 다른 진열 줄 (명품관 「영웅 의상」 칸) — 의상실 쪽이 채운다 · 비면 칸이 안 보인다 */
export interface ShopRow {
  id: string;
  name: string;
  desc?: string;
  /** 썸네일 주소 (없으면 그림 없이) */
  img?: string;
  price: number;
  owned?: boolean;
  /** 막힌 이유 (있으면 회색 + 이유) */
  lock?: string;
  /** 사기 — 실패하면 이유 */
  buy: () => string | null;
}
export const luxeShopHooks: { outfits?: () => ShopRow[] } = {};

const SIZE = (k: string) => {
  const [w, h] = def(k as Kind).size;
  return `${w}×${h}`;
};
const won = (n: number) => `${fmt(n)} G`;
let last: { s: StoredObj; name: string } | null = null;

/** 한 줄 (세트·주간·작은 사치 같은 모양) */
function row(k: string, opt: { sale?: boolean; extra?: string } = {}): string {
  const d = def(k as Kind);
  const one = d.luxe !== 'small';
  const own = one && ownsLuxe(k);
  const p = priceOf(k);
  const why = own ? '' : buyWhy(k);
  const btn = own ? '<button disabled>있어요</button>' : `<button data-lxb="${k}" ${lockAttr(why)}>${won(p)}</button>`;
  const sale = opt.sale ? `<small><i class="lxsale">오늘 −${Math.round(LUXE_SHOP.discount * 100)}%</i> <s>${won(basePrice(k))}</s></small>` : '';
  return `<div class="irow shopi lxrow ${own ? 'sold' : ''} ${opt.sale ? 'sale' : ''}"><img class="lthumb" src="${thumbOf(k as Kind)}" alt=""><span><b>${esc(d.name)}</b>${sale}<small>${SIZE(k)} · ${esc(d.desc)}${opt.extra ?? ''}</small></span>${btn}</div>`;
}

export function openLuxeShop() {
  if (!lxOn()) return toast('준비 중이에요');
  const why = lxLockWhy();
  if (why) return toast(why);
  const st = lxState();
  st.seen = true;
  const now = lxNow();
  const wk = weeklyItem(now);
  st.week = new Date(weekStart(now)).toISOString().slice(0, 10);
  const cp = couponLeft();
  // 이번 주 명품
  const wOwn = ownsLuxe(wk.kind);
  const wWhy = wOwn ? '' : buyWhy(wk.kind, {}, now);
  const back = kstMonthDay(nextReturn(wk.kind, now));
  const end = kstMonthDay(weekEnd(now) - 1);
  const nxt = LUXE_SHOP.weekly[(LUXE_SHOP.weekly.findIndex((x) => x.kind === wk.kind) + 1) % LUXE_SHOP.weekly.length];
  const wBtns = wOwn
    ? '<button disabled>있어요</button>'
    : `<button data-lxb="${wk.kind}" ${lockAttr(wWhy)}>${won(wk.price)}</button>${cp > 0 ? `<button class="lxcp" data-lxc="${wk.kind}">쿠폰 무료</button>` : ''}`;
  const week = `<div class="qhd"><b class="g">✨ 이번 주 명품</b></div>
    <div class="irow shopi lxrow lxweek ${wOwn ? 'sold' : ''}"><img class="lthumb" src="${thumbOf(wk.kind as Kind)}" alt=""><span><b>${esc(def(wk.kind as Kind).name)}</b><small>${SIZE(wk.kind)} · ${end}(일)까지 · 6주마다 돌아와요</small><small class="g">다음에 돌아오는 날: ${back}</small></span><div class="lxbtns">${wBtns}</div></div>
    ${wOwn ? '' : lockNote(wWhy)}<p class="note">다음 주: ${esc(def(nxt.kind as Kind).name)}${cp > 0 ? ` · 마을 회관 쿠폰 ${cp}장 — 「이번 주 명품」 하나를 무료로` : ''}</p>`;
  // 세트 4줄
  const done = new Set(luxeSets().map((h) => h.set.id));
  const sets = LUXE_SHOP.sets
    .map((s) => {
      const n = setOwnedN(s);
      return `<div class="qhd"><b class="g">${esc(s.name)}</b> <small>${n}/4${done.has(s.id) ? ' · <b class="g">세트 완성 ✓</b>' : ''} · ${esc(s.text)}</small></div><div class="shop">${s.items.map((it) => row(it.kind)).join('')}</div>`;
    })
    .join('');
  // 영웅 의상 (의상실이 채우면)
  const outfits = luxeShopHooks.outfits?.() ?? [];
  const oRows = outfits.length
    ? `<div class="qhd"><b class="g">👗 영웅 의상</b></div><div class="shop">${outfits
        .map((r) => `<div class="irow shopi lxrow ${r.owned ? 'sold' : ''}">${r.img ? `<img class="lthumb" src="${esc(r.img)}" alt="">` : '<span></span>'}<span><b>${esc(r.name)}</b>${r.desc ? `<small>${esc(r.desc)}</small>` : ''}</span>${r.owned ? '<button disabled>있어요</button>' : `<button data-lxo="${esc(r.id)}" ${lockAttr(r.lock)}>${won(r.price)}</button>`}</div>`)
        .join('')}</div>`
    : '';
  // 작은 사치
  const sale = dailySaleKind(now);
  const small = `<div class="qhd"><b class="g">작은 사치</b> <small>여러 개 · 매일 하나 −30%</small></div><div class="shop">${LUXE_SHOP.small.map((it) => row(it.kind, { sale: it.kind === sale })).join('')}</div>`;
  const banner = last ? `<div class="lxgot"><span>📦 「${esc(last.name)}」을(를) 보관함에 넣었어요</span><button class="bigbtn sm" id="lxPlace">바로 놓기</button></div>` : '';
  openWin(
    '명품관',
    `${shopTabsBar('luxe')}<p class="sub">금화 <b class="g">${fmt(S.gold)}</b>${cp > 0 ? ` · 쿠폰 ${cp}장` : ''} · 산 장식은 꾸미기 보관함으로 (하나씩)</p>${banner}${week}${sets}<p class="note">세트 4점을 중심 장식(4번째)에서 ${LUXE_SHOP.setRange}칸 안에 모아 두면 「명품 세트」 — 반짝이 + 작은 효과</p>${oRows}${small}`,
    'lxshop',
  );
  bindShopTabsBar();
  const pl = document.getElementById('lxPlace');
  if (pl && last) {
    const s = last.s;
    pl.onclick = () => {
      last = null;
      closeWin();
      startTakeOut(s);
    };
  }
  $$('[data-lxb]').forEach((b) => (b.onclick = () => void buy(b.dataset.lxb!, false)));
  $$('[data-lxc]').forEach((b) => (b.onclick = () => void buy(b.dataset.lxc!, true)));
  $$('[data-lxo]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = outfits.find((x) => x.id === b.dataset.lxo);
        const err = r?.buy() ?? '없는 의상이에요';
        if (err) return toast(err);
        sfx('rare');
        toast(`「${r!.name}」을(를) 들였어요`);
        openLuxeShop();
      }),
  );
}

async function buy(k: string, coupon: boolean) {
  const name = def(k as Kind).name;
  const p = coupon ? 0 : priceOf(k);
  // 비싼 것(세트·주간)은 한 번 더 묻는다
  if (def(k as Kind).luxe !== 'small' && !(await confirmSheet({ title: `${name}을(를) 들일까요?`, body: coupon ? '마을 회관 쿠폰 1장으로 무료 · 보관함으로 들어가요' : `${won(p)} · 보관함으로 들어가요`, ok: coupon ? '쿠폰 쓰기' : '들이기' }))) return;
  const r = buyLuxe(k, { coupon });
  if ('err' in r) return toast(r.err);
  sfx('rare');
  last = { s: r.ok, name };
  toast(`✨ ${name} · 보관함에 넣었어요`);
  openLuxeShop();
  // 「바로 놓기」 줄이 보이게 맨 위로
  document.getElementById('winB')?.scrollTo(0, 0);
}

/** 부팅 때 한 번: 탭 연결 · 꽃 시계탑 종 (대형 시계탑과 같은 때 · 둘 다 있으면 한 번) */
export function initLuxeShop() {
  shopTabHooks.luxe = () => openLuxeShop();
  let lastH = -1;
  setInterval(() => {
    if (!S.started || S.visiting || document.hidden) return;
    const h = hourNow();
    if (h !== lastH && h % 6 === 0 && lastH !== -1 && hasLux('flower_clock') && !hasLux('grand_clock')) sfx('mission', { vol: 0.5 });
    lastH = h;
  }, 1000);
}
