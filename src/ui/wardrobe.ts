// LUXE §1-3 영웅 의상실 화면 (플래그 outfits · 실험실 vis) — 영웅 창 [의상] → 2×n 미리보기 칸
//  칸 = 기본 옷 · ① · ② : 입은 모습(마을 도트 · 초상화) · 잠김은 실루엣 + 얻는 법 · 누르면 바로 입힘 (무료)
//  색 바꾸기는 engine/outfitPaint.ts 한 함수 (도트 dressGrid · 초상화 portSrc)
import { framesFor } from '../engine/sprites';
import { canvas } from '../engine/pixel';
import { appearance } from '../world/adventurers';
import { charInfo, OUTFITS } from '../data/outfits';
import { buyOutfit, charOf, howToGet, outfitShopRows, outfitsOn, outfitSync, portOfChar, wardrobeCells, wearOutfit } from '../world/outfits';
import type { ShopRow } from './luxeShop';
import { world, type Actor } from '../world/state';
import { track as trackEv } from '../net/telemetry';
import { $$, esc } from './common';
import { portSrc } from './outfitPort';
import { openWin, toast } from './windows';
import { LUXE_OUTFITS } from '../data/luxe_cfg';

const SIL = '#2a2238';

/** 그 사람의 그 의상 마을 도트 (앞모습 대기 1장 · id null = 기본 옷) — silhouette이면 검은 실루엣 */
export function dotPreview(a: Actor, id: string | null, silhouette = false): string {
  const { key, def } = appearance(a, id);
  const f = framesFor(key, def).idle[0];
  const c = canvas(f.width, f.height);
  const x = c.getContext('2d')!;
  x.drawImage(f, 0, 0);
  if (silhouette) {
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = SIL;
    x.fillRect(0, 0, c.width, c.height);
  }
  return c.toDataURL();
}

/** 마을에 있는 그 캐릭터 (영입한 사람) */
export function actorOfChar(char: string): Actor | null {
  const list = world.home?.actors ?? world.actors;
  return list.find((x) => !x.role && charOf(x) === char) ?? null;
}

/** 명품관 줄 미리보기: 그 의상 도트 (마을에 없으면 초상화) */
/** 명품관 「영웅 의상」 칸: 의상실 ② 의상 줄을 명품관 진열 줄 모양으로 (ui/luxeShop.ts luxeShopHooks) */
export function outfitShopRowsForLuxe(): ShopRow[] {
  const tier = { hero: '영웅', legend: '전설', star: '다섯 별' } as const;
  return outfitShopRows().map((r) => ({
    id: r.id,
    name: `${r.who} · ${r.name}`,
    desc: `${tier[r.tier]} 의상 ②`,
    img: outfitPreview(r.id),
    price: r.price,
    owned: r.owned,
    lock: r.owned ? undefined : r.why || undefined,
    buy: () => {
      const x = buyOutfit(r.id);
      return x.ok ? null : x.msg;
    },
  }));
}
export function outfitPreview(id: string): string {
  const o = OUTFITS[id];
  if (!o) return '';
  const a = actorOfChar(o.char);
  return a ? dotPreview(a, id) : portSrc(portOfChar(o.char), id);
}

/** 영웅 창 [의상] 버튼 (켰을 때 · 의상이 있는 영입 동료만 · 이웃 구경 중엔 없음) */
export function wardrobeBtnHtml(a: Actor, visiting: boolean): string {
  if (!outfitsOn() || visiting || a.status !== 'hero') return '';
  return charOf(a) ? '<button class="bigbtn sm" id="aWardrobe">의상</button>' : '';
}
export function bindWardrobeBtn(a: Actor, back: () => void) {
  const b = document.getElementById('aWardrobe');
  if (b) b.onclick = () => openWardrobe(a, back);
}

/** 의상 색 점 줄 (형철 「의상실 색 점 크게」): 옷 · 바지 · 포인트 · 덧색 — 칸마다 큼직하게 (기본 옷은 없음) */
function swatchRow(id: string | null): string {
  const o = id ? OUTFITS[id] : null;
  if (!o) return '';
  const cols = [o.cloth, o.pants, o.accent, o.extra].filter((c): c is string => !!c && /^#[0-9a-f]{3,8}$/i.test(c));
  return `<span class="wd-sw" aria-hidden="true">${cols.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
}

/** 옷장 창 */
export function openWardrobe(a: Actor, back?: () => void) {
  const char = charOf(a);
  if (!char || !outfitsOn()) return;
  outfitSync();
  const port = portOfChar(char);
  const frameOnly = LUXE_OUTFITS.portrait.frameOnly.includes(char);
  const cells = wardrobeCells(char)
    .map((c, i) => {
      const lock = !c.owned;
      const dot = dotPreview(a, c.id, lock);
      // 도트가 칸의 주인공 · 초상화는 작은 배지 (테두리만 바뀌는 초상화면 더 작게)
      const face = lock ? '' : `<img class="wd-face ${frameOnly ? 'sm' : ''}" src="${portSrc(port, c.id)}" alt="">`;
      const tag = c.worn ? '<em class="wd-on">입는 중</em>' : lock ? '<em class="wd-lock">🔒 잠김</em>' : '<em>입히기</em>';
      const sub = lock ? `<small class="wd-how">${esc(c.how || howToGet(c.id ?? ''))}</small>` : `<small>${c.n === 0 ? '처음 옷' : c.n === 1 ? '① 인연 「친구」 선물' : '② 명품관'}</small>`;
      return `<button class="wd-cell ${c.worn ? 'on' : ''} ${lock ? 'lock' : ''}" data-i="${i}" ${lock ? 'aria-disabled="true"' : ''}>
        <span class="wd-pic"><img class="wd-dot" src="${dot}" alt="">${face}</span>
        <b>${esc(c.name)}</b>${swatchRow(c.id)}${sub}${tag}</button>`;
    })
    .join('');
  const name = charInfo(char)?.name ?? a.name;
  openWin(
    `${name} · 의상`,
    `<p class="sub">색 바꾸기 의상 — 마을 · 전투 · 파티 칸 · 카드 · 대화 초상화 · 이웃 목록 모두 같은 옷이에요. 바꾸기는 무료.</p>
    <div class="wd-grid">${cells}</div>
    ${back ? '<div class="btnrow"><button class="bigbtn sm ghost" id="wdBack">← 영웅 창</button></div>' : ''}`,
  );
  const list = wardrobeCells(char);
  $$('.wd-cell').forEach(
    (b) =>
      (b.onclick = () => {
        const c = list[Number(b.dataset.i)];
        if (!c) return;
        if (!c.owned) return toast(c.how);
        if (c.worn) return;
        if (!wearOutfit(char, c.id)) return;
        trackEv('outfit_wear', { char, id: c.id ?? 'base' });
        toast(c.id ? `「${c.name}」으로 갈아입었어요` : '기본 옷으로 갈아입었어요');
        openWardrobe(a, back);
      }),
  );
  const bk = document.getElementById('wdBack');
  if (bk && back) bk.onclick = back;
}
