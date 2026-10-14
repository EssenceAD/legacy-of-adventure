// HARVEST_SPEC §1 화면 쪽 — 교환소 창 · 사냥 결과 리본 줄 · 여는 컷 · 마지막 밤(등불 날리기 → 모닥불 곁) · 연대기 쪽 · 장식 효과 · §2 노을 말풍선·첫 노을
import { HV, HV_SHOP } from '../data/harvest_cfg';
import { EXCHANGE_LINES, HARVEST_FINALE, HARVEST_OPEN } from '../data/story/harvest';
import type { Kind } from '../data/catalog';
import { PORTRAITS } from '../engine/assets';
import { goTo } from '../world/actors';
import { closeSeason } from '../world/almanac';
import { hourNow } from '../world/clock';
import { queueEvent } from '../world/events';
import { flag } from '../world/flags';
import { say } from '../world/fx';
import {
  buyHv, checkTitle, finaleState, harvestOn, harvestShopOn, hvChronicle, hvNow, hvPhase, hvState, markFinale, markShopSeen, shopLeft, wantOpening,
} from '../world/harvest';
import { stopLanterns } from '../world/harvestDraw';
import { shopOpen } from '../world/meta';
import { markDirty, P, S, world, type Actor } from '../world/state';
import { duskFirst, duskTick, isDusk, sunsetOn } from '../world/sunset';
import { $$, esc, fmt } from './common';
import { iconSrc } from './kit';
import { playStory } from './story';
import { ledgerHooks } from './daybook';
import { openWin, thumbOf, toast } from './windows';

// ───────── 리본 표시 ─────────

const ribbonImg = (small = true) => `<img class="kic hvrib" src="${iconSrc('cur_ribbon', small)}" width="${small ? 16 : 24}" height="${small ? 16 : 24}" alt="">`;
/** 가방·화폐 줄: 수확 리본 (한 번이라도 모았으면 · 기간이 끝나도 남는다) */
export function ribbonLine(): string {
  const h = hvState();
  if (!flag('harvestFest') || (!h.earned && !h.ribbons)) return '';
  return ` · ${ribbonImg()} 수확 리본 ${fmt(h.ribbons)}`;
}
/** 사냥 결과 카드 한 줄 */
export function hvLootHtml(hv: { ribbons: number; pumpkins: number; king: boolean }): string {
  if (!hv.ribbons) return '';
  const what = [hv.pumpkins ? `호박 도깨비 ${hv.pumpkins}` : '', hv.king ? '황금 호박 대왕' : ''].filter(Boolean).join(' · ');
  return `<div class="loot hvloot"><span class="g">${ribbonImg()} 수확 리본 +${hv.ribbons}${what ? ` <small>(${esc(what)})</small>` : ''}</span></div>`;
}

// ───────── 1-5 교환소 ─────────

let lastLine = '';
/** 수확제 교환소 (빵집 도라 아줌마 · 메뉴 → 상점 「수확제」 탭 · 왼쪽 아이콘) — 같은 창 */
export function openHarvestShop() {
  if (!harvestShopOn()) {
    toast(EXCHANGE_LINES.closed);
    return;
  }
  markShopSeen();
  const h = hvState();
  const ph = hvPhase();
  const line = lastLine || EXCHANGE_LINES.open;
  lastLine = '';
  const rows = HV_SHOP.map((it) => {
    const left = shopLeft(it);
    const got = (h.buy[it.kind] ?? 0);
    const btn = left <= 0 ? '<button disabled>다 바꿈</button>' : `<button data-hvb="${it.kind}" ${h.ribbons >= it.cost ? '' : 'disabled'}>${ribbonImg()} ${it.cost}</button>`;
    return `<div class="irow shopi hvrow ${left <= 0 ? 'sold' : ''}"><img src="${thumbOf(it.kind as Kind)}" alt=""><span>${esc(it.name)}<small>${got}/${it.max}${it.note ? ` · ${esc(it.note)}` : ''}</small></span>${btn}</div>`;
  }).join('');
  const tabs = shopOpen() ? `<div class="tabs" id="hvTabs"><button class="tab" data-hvt="shop">상점</button><button class="tab on">🌾 수확제</button></div>` : '';
  openWin(
    '수확제 교환소',
    `${tabs}<div class="ohd hvhd"><img src="${PORTRAITS.baker ?? ''}" alt=""><div><b>도라 아줌마</b><small>「${esc(line)}」</small></div></div>
    <p class="sub">${ribbonImg(false)} 수확 리본 <b class="g">${fmt(h.ribbons)}</b> · 모은 리본 ${fmt(h.earned)}${ph === 'shop' ? ' · <b>11/8(일) 23:59까지 교환만 열려요</b>' : ' · 교환은 11/8(일)까지'}</p>
    <p class="note">호박 도깨비(사냥) · 원정 성공으로 모아요 · 바꾼 장식은 건설 → 장식 목록에서 무료로 놓아요</p>
    <div class="shop">${rows}</div>`,
    'hvshop',
  );
  const st = document.querySelector<HTMLElement>('#hvTabs [data-hvt="shop"]');
  if (st) st.onclick = () => shopHooks.shop();
  $$('[data-hvb]').forEach(
    (b) =>
      (b.onclick = () => {
        const st0 = P.almanac?.stamps ?? 0;
        const r = buyHv(b.dataset.hvb!);
        if ((P.almanac?.stamps ?? 0) > st0) ledgerHooks.stamp(b);
        if ('err' in r) {
          lastLine = r.err;
          toast(r.err);
        } else {
          lastLine = r.line;
          const it = HV_SHOP.find((x) => x.kind === b.dataset.hvb)!;
          toast(`「${it.name}」을(를) 받았어요 · 건설 → 장식에서 무료로 놓아요`);
        }
        openHarvestShop();
      }),
  );
}
/** 메뉴 상점 창으로 (ui/menu가 채운다 — 순환 import 피하기) */
export const shopHooks = { shop: () => {} };
/** 메뉴 상점 창 맨 위 「상점 · 수확제」 탭 (기간 밖이면 '') */
export function shopTabsHtml(): string {
  return harvestShopOn() ? `<div class="tabs" id="hvTabs"><button class="tab on">상점</button><button class="tab" data-hvt="hv">🌾 수확제</button></div>` : '';
}
export function bindShopTabs() {
  const b = document.querySelector<HTMLElement>('#hvTabs [data-hvt="hv"]');
  if (b) b.onclick = () => openHarvestShop();
}

// ───────── 1-2 여는 컷 · 1-7 마지막 밤 ─────────

/** 모닥불 곁에 둘러앉기 (마지막 밤이 끝나면) */
export function gatherAtFire() {
  const fire = world.objs.find((o) => o.kind === 'fire' && o.build === undefined);
  if (!fire || S.visiting) return;
  const spots: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1], [1, 1], [-1, -1], [1, -1], [-2, 0], [2, 0], [0, 2], [0, -2]];
  const who = world.actors.filter((a) => !a.role && a.id && !a.hidden && !a.leaving && !a.party && !a.door && (a.st === 'idle' || a.st === 'walk' || a.st === 'sit'));
  who.slice(0, spots.length).forEach((a: Actor, i) => {
    const [dx, dy] = spots[i];
    goTo(a, fire.tx + dx, fire.ty + dy, () => {
      a.st = 'sit';
      a.at = fire;
      a.dir = a.x < fire.tx + 0.5 ? 1 : -1;
      a.t = 25 + Math.random() * 15;
    });
  });
}
function playFinale() {
  if (finaleState() !== 'play') return;
  markFinale('play');
  playStory(HARVEST_FINALE, () => {
    stopLanterns();
    gatherAtFire();
    toast('연대기에 「첫 번째 수확제」 쪽이 생겼어요 (도감 → 연대기)');
  });
}

// ───────── 0.5초마다 (main) ─────────

let effHour = -1;
/** 마을이 돌아가는 동안: 여는 컷 · 마지막 밤 · 첫 노을 · 노을 말풍선 · 연감 닫기 · 장식 효과 */
export function tickHarvest() {
  if (!S.started || S.visiting) return;
  const now = hvNow();
  if (wantOpening(now))
    queueEvent(() => {
      if (!wantOpening()) return;
      hvState().opened = true;
      markDirty();
      playStory(HARVEST_OPEN);
    }, 'hvOpen');
  const fs = finaleState(now);
  if (fs === 'play') queueEvent(playFinale, 'hvFinale');
  else if (fs === 'missed') markFinale('missed');
  // §2 첫 노을 (첫 원정 뒤 — 온보딩을 막지 않게)
  if (sunsetOn(now) && isDusk() && !P.meta.duskFirst && P.counters.expeditions > 0)
    queueEvent(() => {
      const l = duskFirst();
      if (l) playStory(l);
    }, 'duskFirst');
  duskTick((a, t) => say(a, t));
  closeSeason(now);
  checkTitle();
  decoEffects();
}
/** 1-5 장식 효과 (게임 한 시간마다): 단풍나무 근처 기분 +3 · 호박 마차 근처 기분 +5 · 잔칫상 근처 포만 +5 */
function decoEffects() {
  const hr = hourNow();
  if (hr === effHour) return;
  effHour = hr;
  if (!flag('harvestFest')) return;
  const near = (a: Actor, k: string) => world.objs.some((o) => o.kind === k && o.build === undefined && Math.abs(o.tx + o.fw / 2 - a.x) <= HV.nearR + o.fw / 2 && Math.abs(o.ty + o.fh / 2 - a.y) <= HV.nearR + o.fh / 2);
  if (!world.objs.some((o) => o.kind === 'maple' || o.kind === 'pumpkin_carriage' || o.kind === 'harvest_table')) return;
  for (const a of world.actors) {
    if (a.role || !a.id || a.hidden) continue;
    if (near(a, 'maple')) a.mood = Math.min(100, a.mood + HV.mapleMood);
    if (near(a, 'pumpkin_carriage')) a.mood = Math.min(100, a.mood + HV.carriageMood);
    if (near(a, 'harvest_table')) a.food = Math.min(100, a.food + HV.tableFood);
  }
}

// ───────── 1-7 연대기 쪽 ─────────

/** 도감 → 연대기 맨 위 「첫 번째 수확제」 (마지막 밤을 봤거나 놓쳤을 때) */
export function hvChronHtml(): string {
  const c = hvChronicle();
  if (!c) return '';
  return `<div class="chron hvchron"><div class="chpage"><p class="chno">2026년 가을</p><h4 class="chinn">${esc(c.title)}</h4><p class="hvchb">${esc(c.body)}</p></div></div>`;
}

/** 수확제 기간 중인가 (아이콘 줄 · 메뉴 칸) */
export const hvIconOn = () => harvestOn() || harvestShopOn();
