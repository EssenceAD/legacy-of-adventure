// 오프닝 티저 (약 40초): "이 게임은 이런 게임이다" 미리보기 — 실제 게임 화면을 가짜 상태로 띄우고 카메라·글자로 편집
//  01 「모험의 유산」 88 BPM(1박 0.68초)에 맞춰 컷을 넘긴다. 곡이 재생 중이면 곡 위치가 시계, 아니면 실제 시간.
//  저장 데이터는 절대 건드리지 않는다: 티저 동안 게임은 시작 전(S.started = false)이고, 끝나면 타이틀 배경 마을로 되돌린다.
import { av } from '../engine/ver';
import { harmonyById } from '../data/harmony';
import { HEROES } from '../data/heroes';
import { PORTRAITS } from '../engine/assets';
import { view } from '../engine/iso';
import { teaserEnd, teaserFade, teaserStart, teaserTime } from '../audio/music';
import { onUnlock } from '../audio/engine';
import { sfx, sfxClip } from '../audio/sfx';
import { computeSets } from '../world/harmony';
import { harmonyAnim } from '../world/harmonyDraw';
import { anim, startGradeAnim, teaserView } from '../world/grade';
import { startTour, tour } from '../world/evalTour';
import { S, world } from '../world/state';
import { findKind } from '../world/town';
import { ATTIC_H, ATTIC_W, drawAttic, sceneCanvas, syncCovers, village } from './scenes';
import { teaserFitOn, type FitOpts } from './fit';
import { CONFIG } from '../data/config';
import { bossCut, huntCut, preloadTeaserField, TF_H, TF_W } from './field';
import { flushScene } from '../audio/scene';
import { skipFrame } from '../engine/fps';
import { skipTapOk } from '../ui/touchHints';

/** 전투 컷 캔버스: 논리 TF_W×TF_H를 기기 픽셀 정수배로 (숫자·이름표는 기기 픽셀로 따로) */
function fieldCanvas(host: HTMLElement, fit: FitOpts = {}): { ctx: CanvasRenderingContext2D; k: number } {
  const { cv, sc } = sceneCanvas(host, TF_W, TF_H, 0.6, fit);
  const k = Math.max(1, Math.round(sc * window.devicePixelRatio));
  cv.width = TF_W * k;
  cv.height = TF_H * k;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { ctx, k };
}

const BEAT = 60 / 88;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

interface Cut {
  beats: number;
  cap: string;
  /** 마을(캔버스) 컷이면 무대를 투명하게 */
  world?: boolean;
  trans?: 'flash' | 'sweep';
  enter: (stage: HTMLElement) => void;
  update?: (t: number, dur: number) => void;
}

let stage: HTMLElement;
const portrait = (k: string) => PORTRAITS[k] ?? '';
const el = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  stage.appendChild(d.firstElementChild!);
  const e = stage.lastElementChild as HTMLElement;
  lateFade(e);
  return e;
};

/** 버그 고침: 컷에 쓰는 초상화는 티저 전에 미리 불러 둔다 (빈 칸으로 뜨지 않게) */
const TEASER_PORTRAITS = () => [...HEROES.slice(0, 5).map((h) => 'hero_' + h.id), 'legend_aria', 'mc_knight_f', 'legend_leon'];
const preloaded: HTMLImageElement[] = [];
export function preloadTeaserPortraits() {
  if (preloaded.length) return;
  for (const k of TEASER_PORTRAITS()) {
    const src = portrait(k);
    if (!src) continue;
    const im = new Image();
    im.src = src;
    im.decode?.().catch(() => {});
    preloaded.push(im);
  }
}
/** 그래도 늦은 그림은 그 칸만 0.2초 페이드인 (다른 칸·컷은 그대로 흐른다) */
function lateFade(root: HTMLElement) {
  const imgs = root instanceof HTMLImageElement ? [root] : [...root.querySelectorAll('img')];
  for (const im of imgs) {
    if (im.complete && im.naturalWidth > 0) continue;
    im.classList.add('tlate');
    const show = () => {
      im.classList.remove('tlate');
      im.classList.add('tin');
    };
    im.addEventListener('load', show, { once: true });
  }
}

// ───────── 컷 11개 ─────────

let draw: ((t: number) => void) | null = null;
let fired = new Set<string>();
const once = (k: string, f: () => void) => {
  if (fired.has(k)) return;
  fired.add(k);
  f();
};

const CUTS: Cut[] = [
  {
    beats: 4,
    cap: '한때, 당신은 모험가였다.',
    enter: () => {
      el(`<div class="tledger"><i class="glow"></i><img src="${av('assets/icons/m_quest.png')}" alt=""></div>`);
    },
    update: (t) => stage.querySelector('.tledger')!.classList.toggle('open', t > 0.9),
  },
  {
    beats: 4,
    cap: '이제는 낡은 여관 하나뿐.',
    world: true,
    enter: () => {
      village(0, true, { keeper: true });
      el(`<div class="tbook"><img src="${av('assets/icons/m_quest.png')}" alt=""></div>`);
    },
    update: (t) => {
      const b = stage.querySelector<HTMLElement>('.tbook');
      if (b) b.style.opacity = t > 1.2 ? '1' : '0';
    },
  },
  {
    beats: 9,
    cap: '손님을 맞고, 마을을 키우고.',
    world: true,
    trans: 'sweep',
    enter: () => village(0, false),
    update: (t) => {
      // 1.2초마다 한 등급씩 덮어쓰기 · 낮밤도 휙휙
      const step = Math.min(4, Math.floor((t - 0.4) / 1.2) + 1);
      if (t < 0.4 || step <= teaserView.g) return;
      const from = teaserView.g;
      anim.dur = 1.0;
      village(step, step % 2 === 1);
      teaserView.g = step;
      startGradeAnim(from, step);
    },
  },
  {
    beats: 4,
    cap: '건물을 어울리게 놓으면 — 이야기가 생긴다.',
    world: true,
    enter: () => {
      anim.on = false;
      village(4, false, { bench: true });
      view.cam.x = 40;
    },
    update: (t) => {
      view.cam.x = Math.round(40 - t * 22);
      if (t > 0.6)
        once('harm', () => {
          const s = computeSets(world.objs).find((x) => x.id === 2) ?? computeSets(world.objs)[0];
          if (s) harmonyAnim.push({ set: s, t0: S.T });
          sfx('harmony', { force: true });
        });
      if (t > 1.3)
        once('banner', () =>
          el(`<div class="tbanner"><img src="${av('assets/emotes/emo_sparkle.png')}" alt=""><span><small>새 어울림 발견!</small><b>${harmonyById(2).name}</b><em>${harmonyById(2).text}</em></span><img src="${av('assets/emotes/emo_sparkle.png')}" alt=""></div>`),
        );
    },
  },
  {
    beats: 4,
    cap: '소문을 따라 찾아오는 전설의 영웅들.',
    enter: () => {
      stage.classList.add('dark');
      HEROES.slice(0, 5).forEach((h, i) => el(`<img class="tcard" data-i="${i}" src="${portrait('hero_' + h.id)}" alt="">`));
      el(`<div class="tlegend"><img src="${portrait('legend_aria')}" alt=""><b>전설 · 성녀 아리아</b></div>`);
    },
    update: (t) => {
      const r = stage.getBoundingClientRect();
      const f = Math.min(1, t / 0.9);
      stage.querySelectorAll<HTMLElement>('.tcard').forEach((c) => {
        const i = +c.dataset.i! - 2;
        const w = c.offsetWidth;
        c.style.left = Math.round(r.width / 2 - w / 2 + i * w * 0.46 * f) + 'px';
        c.style.top = Math.round(r.height * 0.36 + Math.abs(i) * i * 0 + Math.abs(i) * 10 * f) + 'px';
        c.style.zIndex = String(10 - Math.abs(i));
      });
      stage.querySelector('.tlegend')!.classList.toggle('on', t > 1.7);
    },
  },
  {
    beats: 4,
    cap: '숲으로, 늪으로, 심연으로.',
    trans: 'flash',
    enter: () => {
      // 전투 2차로 다시 찍음: 새 쿼터뷰 필드 · 닌자 몬스터 무리 · KILLS · 장비 이름표 드랍
      stage.classList.add('dark');
      const host = el('<div class="tscene"></div>');
      const { ctx, k } = fieldCanvas(host);
      const kills = el('<div class="tkills"><b>15</b> KILLS</div>');
      draw = huntCut(ctx, k, (n) => ((kills.querySelector('b') as HTMLElement).textContent = String(n)));
    },
    update: (t) => draw?.(t),
  },
  {
    beats: 4,
    cap: '매주 찾아오는 거대한 적.',
    enter: () => {
      // 전투 2차로 다시 찍음: 이번 주 보스(붉은 무사) · 내려찍기 예고 → 굴러 피하기 → 큰 한 방
      stage.classList.add('dark');
      const host = el('<div class="tscene"></div>');
      // FIRSTLOOK §4: 꽉 채울 때 보스가 통째로 보이게
      const { ctx, k } = fieldCanvas(host, { focus: CONFIG.firstLook.teaser.bossFocus });
      const bar = el('<div class="tbossbar"><span>붉은 무사</span><i><u></u></i></div>');
      const bd = bossCut(ctx, k);
      draw = (t) => {
        bd(t);
        (bar.querySelector('u') as HTMLElement).style.width = t > 1.7 ? '62%' : '100%';
        if (t > 1.2) once('slam', () => sfx('crit'));
      };
    },
    update: (t) => draw?.(t),
  },
  {
    beats: 4,
    cap: '여관 평가단의 별을 받아라.',
    world: true,
    enter: () => {
      village(4, false, { bench: true });
      startTour(() => {});
    },
    update: (t) => {
      if (t > 0.7)
        once('heart', () => {
          const inn = findKind('inn');
          if (inn) tour.emotes.push({ o: inn, k: 'heart', t0: S.T });
        });
      if (t > 1.4)
        once('plaque', () => {
          el(`<div class="tplaque"><img src="${av('assets/sprites/plaque_gold.png')}" alt=""><b>골드</b></div>`);
          stage.classList.add('shake');
          sfxClip('J3', 0.9);
        });
    },
  },
  {
    beats: 6,
    cap: '함께한 시간만큼 깊어지는 인연.',
    enter: () => {
      stage.classList.add('dark');
      el(`<div class="tduo"><img src="${portrait('mc_knight_f')}" alt=""><img class="r" src="${portrait('legend_leon')}" alt=""></div>`);
      el(`<div class="thearts">${`<img src="${av('assets/ui/heart.png')}" alt="">`.repeat(5)}</div>`);
    },
    update: (t) => stage.querySelectorAll('.thearts img').forEach((h, i) => h.classList.toggle('on', t > 0.6 + i * 0.5)),
  },
  {
    beats: 7,
    cap: '그리고 언젠가 — 다시 떠날 날이 온다.',
    enter: () => {
      stage.classList.add('dark');
      const host = el('<div class="tscene attic"></div>');
      const a = sceneCanvas(host, ATTIC_W, ATTIC_H, 0.62, { contain: true });
      draw = (t) => {
        drawAttic(a.ctx, t);
        // 천천히 줌인: 정수 배율로 한 단계 (도트가 번지지 않게)
        if (t > 2.4 && !a.cv.dataset.z) {
          a.cv.dataset.z = '1';
          // FIRSTLOOK §4: 꽉 채울 땐 방 전체(창·상자·칼)가 보이게 — 한 단계 더 당기지 않음
          if (host.classList.contains('cover')) return;
          const k = Math.round(a.sc * window.devicePixelRatio) + 1;
          a.cv.style.width = (ATTIC_W * k) / window.devicePixelRatio + 'px';
          a.cv.style.height = (ATTIC_H * k) / window.devicePixelRatio + 'px';
        }
      };
    },
    update: (t) => draw?.(t),
  },
  {
    beats: 6,
    cap: '',
    trans: 'flash',
    enter: () => {
      // FIRSTLOOK §4 (flTeaserFit): 마을 낮(3번째 컷)을 어둡게 깔고 큰 제목
      if (teaserFitOn()) {
        const c = CONFIG.firstLook.title;
        anim.on = false;
        village(c.g, c.night);
        stage.classList.add('world', 'fit');
        el('<i class="tdim"></i>');
      } else stage.classList.add('dark');
      $('#teaser').classList.add('open');
      el(`<div class="tlogo"><div class="ko"><small class="ko1">용사님,</small><span class="ko2">체크인하실게요<i class="wave">~</i></span></div><div class="en">LEGACY OF ADVENTURE</div><p>당신의 이야기는, 다음 세대의 유산이 된다.</p><button class="bigbtn" id="tGo">${auto ? '시작하기' : '타이틀로'}</button></div>`);
      $('#tGo').onclick = finish;
    },
  },
];
const START: number[] = [];
CUTS.reduce((s, c) => (START.push(s), s + c.beats * BEAT), 0);
const TOTAL = START[START.length - 1] + CUTS[CUTS.length - 1].beats * BEAT;

// ───────── 진행 ─────────

let on = false;
let auto = false;
let cur = -1;
let t = 0;
let lastPerf = 0;
let skipped = false;
/** FIRSTLOOK §3: 건너뛰기 버튼이 나타난 때 */
let skipShownAt = 0;
let faded = false;
let raf = 0;
let saved: { land: number; night: boolean; nightT: number; innName: string; cam: [number, number]; zoom: number; focus: { m: number; size: number } } | null = null;
let onDone: () => void = () => {};

export const teaserOn = () => on;
export const teaserCut = () => cur;

function showCut(i: number) {
  cur = i;
  const c = CUTS[i];
  stage.innerHTML = '';
  stage.className = 'tstage' + (c.world ? ' world' : '');
  draw = null;
  fired = new Set();
  harmonyAnim.length = 0;
  tour.on = false;
  tour.emotes.length = 0;
  const cap = $('#tCap');
  cap.textContent = c.cap;
  cap.classList.remove('on');
  void cap.offsetWidth;
  if (c.cap) cap.classList.add('on');
  if (c.trans === 'flash') pulse('#tFlash');
  if (c.trans === 'sweep') pulse('#tWipe');
  c.enter(stage);
}
function pulse(sel: string) {
  const f = $(sel);
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
}

function frame(now: number) {
  if (!on) return;
  // 핫픽스 11: 최대 60fps (배터리 절약 30)
  if (skipFrame(lastPerf, now)) {
    raf = requestAnimationFrame(frame);
    return;
  }
  const mt = skipped ? null : teaserTime();
  if (mt != null) t = mt;
  else t += Math.min(0.1, (now - lastPerf) / 1000);
  lastPerf = now;
  let i = CUTS.length - 1;
  while (i > 0 && t < START[i]) i--;
  if (i !== cur) showCut(i);
  const c = CUTS[i];
  const lt = t - START[i];
  const dur = c.beats * BEAT;
  c.update?.(lt, dur);
  syncCovers(stage);
  // 글자: 컷 끝 0.3초 전에 사라진다
  if (lt > dur - 0.3 && i < CUTS.length - 1) $('#tCap').classList.remove('on');
  // 마지막 컷: 2초 페이드아웃
  if (!faded && t > TOTAL - 2) {
    faded = true;
    teaserFade(2);
  }
  // FIRSTLOOK §3: 건너뛰기가 막 나타난 때 (터치면 0.35초 동안 안 먹음)
  const sk = $('#tSkip');
  const hide = t < 2 || i === CUTS.length - 1;
  if (sk.hidden && !hide) skipShownAt = performance.now();
  sk.hidden = hide;
  raf = requestAnimationFrame(frame);
}

/** 티저 시작. auto = 처음 실행(끝나면 주인공 만들기) */
export function playTeaser(isAuto: boolean, done: () => void) {
  if (on) return;
  on = true;
  auto = isAuto;
  onDone = done;
  saved = { land: S.land, night: S.night, nightT: S.nightT, innName: S.innName, cam: [view.cam.x, view.cam.y], zoom: S.zoom, focus: { ...view.focus } };
  S.innName = '솔바람 여관';
  void preloadTeaserField();
  preloadTeaserPortraits();
  $('#title').hidden = true;
  const root = $('#teaser');
  root.hidden = false;
  root.classList.remove('open');
  stage = $('#tStage');
  $('#tSkip').onclick = () => {
    if (!skipTapOk(skipShownAt)) return;
    skipped = true;
    t = START[CUTS.length - 1];
    teaserFade(1.5);
    faded = true;
  };
  cur = -1;
  t = 0;
  skipped = false;
  faded = false;
  teaserStart();
  lastPerf = performance.now();
  raf = requestAnimationFrame(frame);
}

function finish() {
  if (!on) return;
  on = false;
  cancelAnimationFrame(raf);
  teaserView.g = -1;
  anim.on = false;
  tour.on = false;
  tour.emotes.length = 0;
  harmonyAnim.length = 0;
  stage.innerHTML = '';
  $('#teaser').hidden = true;
  if (saved) {
    S.innName = saved.innName;
    S.zoom = saved.zoom;
    [view.cam.x, view.cam.y] = saved.cam;
    view.focus = saved.focus;
  }
  teaserEnd();
  $('#title').hidden = false;
  onDone();
  // 티저 중 미뤄 둔 마을 소리·알림
  flushScene();
}

/** 처음 실행: 「터치해서 시작」 → 첫 터치(소리 잠금 해제)와 함께 티저 */
export function teaserTouchGate(done: () => void) {
  preloadTeaserPortraits();
  const root = $('#teaser');
  root.hidden = false;
  root.classList.add('gate');
  // FIRSTLOOK §4 (flTeaserFit): 「터치해서 시작」 = 타이틀과 같은 얼굴 (어둡게 깐 마을 낮 + 큰 제목 · 뒤 마을은 titleBackdrop)
  const gate = root.querySelector<HTMLElement>('.tgate');
  if (gate && teaserFitOn() && !gate.querySelector('.logo'))
    gate.innerHTML = `<div class="logo"><div class="ko"><small class="ko1">용사님,</small><span class="ko2">체크인하실게요<i class="wave">~</i></span></div><div class="en">LEGACY OF ADVENTURE</div></div><span class="tgo">${gate.textContent}</span>`;
  $('#title').hidden = true;
  const go = () => {
    root.removeEventListener('pointerdown', go);
    root.classList.remove('gate');
    // 소리가 열리면 바로 (소리를 못 쓰는 기기면 조금 뒤에)
    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      playTeaser(true, done);
    };
    onUnlock(() => setTimeout(begin, 60));
    setTimeout(begin, 700);
  };
  root.addEventListener('pointerdown', go);
}
