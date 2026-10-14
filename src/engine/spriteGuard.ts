// SPRLOST: 깨진 그림 지키기 — 화면에 붙이는 부분
//  · 앱으로 돌아오면(visibilitychange → visible) · 화면 크기가 바뀌면(resize · 채팅창 키보드) · bfcache 복귀(pageshow) → 다시 불러오기 횟수 0
//  · 안전망: 그리려던 그림 중 30% 넘게 3초 넘게 못 그리면 원본 그림을 모두 다시 받는다 (새로고침 아님) · 그래도 안 되면 윗줄 「그림 다시 불러오기」
//  · 폰(data-size=phone) · 큰 마을(100채 넘게)이면 그림 캐시 상한을 낮춘다
import { CONFIG } from '../data/config';
import { applyCacheCaps, refetchAllSprites, reloadCounts, resetReloadCounters, setFetchFailForTest, takeDrawStats } from './assets';
import { cacheCaps, lostSent, reportLost, SpriteWatch, type CacheCaps } from './spriteLost';

const watch = new SpriteWatch();
let btn: HTMLElement | null = null;
let buildings = () => 0;
let capAt = -Infinity;
let last = { n: 0, bad: 0 };
let refetches = 0;
let watching = true;
/** 개발·측정: 상한을 손으로 정하기 (null = 자동) */
let capOverride: CacheCaps | null = null;

export function initSpriteGuard(o: { button: HTMLElement | null; buildings: () => number }) {
  btn = o.button;
  buildings = o.buildings;
  btn?.addEventListener('click', () => void refetch('button'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resetReloadCounters();
  });
  addEventListener('resize', resetReloadCounters);
  addEventListener('pageshow', resetReloadCounters);
  checkCaps(performance.now());
}

function checkCaps(now: number) {
  if (now - capAt < CONFIG.render.spriteGuard.capCheckMs) return;
  capAt = now;
  applyCacheCaps(capOverride ?? cacheCaps(document.documentElement.dataset.size, buildings()));
}

function show(on: boolean) {
  if (btn) btn.hidden = !on;
}

async function refetch(why: 'auto' | 'button') {
  if (watch.busy) return;
  watch.start();
  refetches++;
  try {
    const r = await refetchAllSprites();
    reportLost('refetch', `${why}:${r.ok}/${r.fail}`);
  } finally {
    watch.done(performance.now());
  }
}

/** 마을을 그린 직후 프레임마다 (그린 프레임만) */
export function spriteGuardFrame(now = performance.now()) {
  last = takeDrawStats();
  checkCaps(now);
  if (!watching) return;
  const act = watch.frame(last.n, last.bad, now);
  if (act === 'refetch') void refetch('auto');
  else if (act === 'button') {
    show(true);
    reportLost('refetch_fail', 'all');
  } else if (act === 'recovered') {
    show(false);
    reportLost('refetch_ok', 'all');
  }
}

/** 개발·e2e (__spriteGuard) */
export function spriteGuardDebug() {
  return {
    last,
    counts: reloadCounts(),
    refetches,
    stage: watch.stage,
    events: lostSent,
    fetchFail: setFetchFailForTest,
    watch: (on: boolean) => {
      watching = on;
    },
    caps: (c: CacheCaps | null) => {
      capOverride = c;
      capAt = -Infinity;
      checkCaps(performance.now());
    },
  };
}
