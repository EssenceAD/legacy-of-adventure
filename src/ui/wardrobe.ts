// LUXE §1-3 영웅 의상실 화면 (플래그 outfits · 실험실 vis) — 영웅 창 [의상] → 2×n 미리보기 칸
//  칸 = 기본 옷 · ① · ② : 입은 모습(마을 도트 · 초상화) · 잠김은 실루엣 + 얻는 법 · 누르면 바로 입힘 (무료)
//  색 바꾸기는 engine/outfitPaint.ts 한 함수 (도트 dressGrid · 초상화 portSrc)
import { framesFor } from '../engine/sprites';
import { canvas } from '../engine/pixel';
import { appearance } from '../world/adventurers';
import { charInfo, OUTFITS } from '../data/outfits';
import { charOf, howToGet, outfitsOn, outfitSync, portOfChar, wardrobeCells, wearOutfit } from '../world/outfits';
import { world, type Actor } from '../world/state';
import { track as trackEv } from '../net/telemetry';
import { $$, esc } from './common';
import { portSrc } from './outfitPort';
import { openWin, toast } from './windows';

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

/** 옷장 창 */
export function openWardrobe(a: Actor, back?: () => void) {
  const char = charOf(a);
  if (!char || !outfitsOn()) return;
  outfitSync();
  const port = portOfChar(char);
  const cells = wardrobeCells(char)
    .map((c, i) => {
      const lock = !c.owned;
      const dot = dotPreview(a, c.id, lock);
      const face = lock ? '' : `<img class="wd-face" src="${portSrc(port, c.id)}" alt="">`;
      const tag = c.worn ? '<em class="wd-on">입는 중</em>' : lock ? '<em class="wd-lock">🔒 잠김</em>' : '<em>입히기</em>';
      const sub = lock ? `<small class="wd-how">${esc(c.how || howToGet(c.id ?? ''))}</small>` : `<small>${c.n === 0 ? '처음 옷' : c.n === 1 ? '① 인연 「친구」 선물' : '② 명품관'}</small>`;
      return `<button class="wd-cell ${c.worn ? 'on' : ''} ${lock ? 'lock' : ''}" data-i="${i}" ${lock ? 'aria-disabled="true"' : ''}>
        <span class="wd-pic"><img class="wd-dot" src="${dot}" alt="">${face}</span>
        <b>${esc(c.name)}</b>${sub}${tag}</button>`;
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
