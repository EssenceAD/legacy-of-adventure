// 배경음악: <audio> 두 개(크로스페이드) → MediaElementSource → 배경음악 볼륨. 지금 상황의 곡만 받는다.
//  마을(낮·밤): 섞어 틀기(직전 곡 빼고) + 곡이 끝나면 20~60초 쉼(그동안 마을 소리) · 전투·이벤트: 끝나면 바로 처음부터
//  상황 전환 1.2초 크로스페이드 · 낮↔밤은 4초 페이드아웃 뒤 새 목록 · 전투에서 마을로 오면 아까 곡의 그 자리에서 이어서
import { getPref, setPref } from '../save/save';
import { bgmBus, ctx, onUnlock } from './engine';
import { PLAYLISTS, TRACKS, VILLAGE, type Scene } from './playlists';
import { windTracks } from '../world/wind';

const DIR = 'audio/bgm/';
interface Deck {
  el: HTMLAudioElement;
  gain: GainNode | null;
  track: string | null;
}
const decks: Deck[] = [];
let cur = 0;
let amb: Deck | null = null;
let ambKey = '';

let scene: Scene = 'none';
let lastPick: Partial<Record<string, string>> = {};
/** 마을 곡을 떠날 때 자리 (돌아오면 이어서) */
const resumeAt: Partial<Record<Scene, { track: string; t: number }>> = {};
let restT = 0;
let resting = false;
let switchT = 0;
let unlocked = false;

export const heard = new Set<string>(getPref<string[]>('heard', []));

function mkDeck(loop = false): Deck {
  const el = new Audio();
  el.preload = 'auto';
  el.loop = loop;
  el.crossOrigin = 'anonymous';
  const d: Deck = { el, gain: null, track: null };
  if (ctx) {
    const src = ctx.createMediaElementSource(el);
    d.gain = ctx.createGain();
    d.gain.gain.value = 0;
    src.connect(d.gain).connect(bgmBus);
  }
  return d;
}

function ramp(d: Deck, to: number, sec: number) {
  if (!ctx || !d.gain) return;
  const t = ctx.currentTime;
  d.gain.gain.cancelScheduledValues(t);
  d.gain.gain.setValueAtTime(d.gain.gain.value, t);
  d.gain.gain.linearRampToValueAtTime(to, t + Math.max(0.01, sec));
}

// 핫픽스 9: 다른 곡끼리는 겹치지 않는다 — 지금 곡 1.0초 페이드아웃 → 0.6초 무음 → 새 곡 1.5초 페이드인
//  (조성이 다른 두 곡이 겹치면 전조처럼 들린다) · 같은 곡을 이어 틀 때만 크로스페이드
const OUT = 1.0;
const GAP = 0.6;
const IN = 1.5;
let startT = 0;
function play(track: string, fade: number, at = 0, loop = false) {
  resting = false;
  clearTimeout(startT);
  const old = decks[cur];
  const busy = !!old?.track && !old.el.paused && (old.gain?.gain.value ?? 0) > 0.01;
  if (busy && old.track !== track) {
    // 지금 곡을 먼저 내리고, 무음 뒤에 새 곡
    ramp(old, 0, OUT);
    const o = old;
    startT = window.setTimeout(() => {
      o.el.pause();
      o.track = null;
      start(track, IN, at, loop);
    }, (OUT + GAP) * 1000);
    ambFade(0, 3);
    return;
  }
  start(track, busy ? fade : Math.max(fade, IN), at, loop);
}
/** 실제로 새 덱에서 틀기 (같은 곡 이어 틀기면 크로스페이드) */
function start(track: string, fade: number, at = 0, loop = false) {
  const old = decks[cur];
  cur = 1 - cur;
  const d = decks[cur];
  d.track = track;
  d.el.loop = loop;
  d.el.src = DIR + TRACKS[track].file + '.mp3';
  const start = () => {
    if (at > 0 && Number.isFinite(d.el.duration) && at < d.el.duration - 2) d.el.currentTime = at;
  };
  d.el.onloadedmetadata = start;
  d.el.onplaying = () => {
    if (!heard.has(track)) {
      heard.add(track);
      setPref('heard', [...heard]);
    }
  };
  d.el.onended = () => onEnded(d);
  // 파일이 없거나 실패하면 조용히 넘어간다 (마을이면 쉼 뒤 다음 곡)
  d.el.onerror = () => {
    if (decks[cur] === d && VILLAGE.has(scene)) rest();
  };
  ramp(d, 1, fade);
  void d.el.play().catch(() => {});
  if (old?.track) {
    ramp(old, 0, fade);
    const o = old;
    window.setTimeout(() => {
      if (decks[cur] !== o) {
        o.el.pause();
        o.track = null;
      }
    }, fade * 1000 + 100);
  }
  ambFade(0, 3);
}

function pick(list: string[], key: string): string {
  // DIRECTION §1-2 고요한 해: 잔잔한 곡 먼저
  list = windTracks(key) ?? list;
  const pool = list.length > 1 ? list.filter((t) => t !== lastPick[key]) : list;
  const t = pool[Math.floor(Math.random() * pool.length)];
  lastPick[key] = t;
  return t;
}

/** 마을 곡이 끝남 → 20~60초 쉼 (마을 소리) → 다음 곡 */
function onEnded(d: Deck) {
  if (decks[cur] !== d || scene === 'none' || teaserMode) return;
  // 2차 추가: 전투 곡이 둘 이상이면 끝나고 바로 다른 곡 (사냥 09↔20 · 토벌 11↔23 …)
  if (!VILLAGE.has(scene)) {
    const list = PLAYLISTS[scene];
    if (list.length > 1 && !previewing) play(pick(list, scene), 1.2, 0, false);
    return;
  }
  d.track = null;
  rest();
}
/** 전투·이벤트 곡: 하나면 그 곡 반복 · 둘 이상이면 번갈아 (직전 곡 빼고) */
function playScene(s: Exclude<Scene, 'none'>, fade: number) {
  const list = PLAYLISTS[s];
  if (list.length > 1) play(pick(list, s), fade, 0, false);
  else play(list[0], fade, 0, true);
}
function rest() {
  clearTimeout(restT);
  resting = true;
  ambOn(scene === 'night' ? 'amb_night' : 'amb_day');
  restT = window.setTimeout(() => {
    resting = false;
    if (VILLAGE.has(scene)) play(pick(PLAYLISTS[scene as 'day'], scene), 1.2);
  }, (20 + Math.random() * 40) * 1000);
}

// ───────── 마을 소리 (쉼 동안 루프 · 이미 아주 작게 맞춰 둔 파일이라 더 키우지 않는다) ─────────

function ambOn(key: string) {
  if (!amb) return;
  if (ambKey !== key) {
    ambKey = key;
    amb.el.src = `audio/amb/${key}.mp3`;
    amb.el.onerror = () => {};
  }
  void amb.el.play().catch(() => {});
  ramp(amb, 1, 2);
}
function ambFade(to: number, sec: number) {
  if (!amb || !amb.gain) return;
  ramp(amb, to, sec);
  if (to === 0) window.setTimeout(() => amb!.gain!.gain.value < 0.01 && amb!.el.pause(), sec * 1000 + 100);
}

// ───────── 상황 바꾸기 ─────────

export function setScene(next: Scene) {
  if (teaserMode) return;
  if (next === scene || !unlocked) {
    if (!unlocked) scene = next;
    return;
  }
  const prev = scene;
  scene = next;
  clearTimeout(restT);
  clearTimeout(switchT);
  const d = decks[cur];
  // 마을 곡을 떠날 때 자리 기억
  if (VILLAGE.has(prev) && d.track && !d.el.paused) resumeAt[prev] = { track: d.track, t: d.el.currentTime };
  if (next === 'none') {
    clearTimeout(startT);
    ramp(d, 0, 1.2);
    ambFade(0, 1.2);
    return;
  }
  // 낮 ↔ 밤: 핫픽스 9 — 곡 중간엔 바꾸지 않는다. 지금 곡은 끝까지, 끝나고 쉼 뒤에 새 목록에서 고른다
  if (VILLAGE.has(prev) && VILLAGE.has(next)) {
    if (resting) return rest();
    return;
  }
  const raidSwap = prev === 'raid' && next === 'raid2';
  if (VILLAGE.has(next)) {
    const r = resumeAt[next];
    delete resumeAt[next];
    if (r) return play(r.track, 1.2, r.t);
    return play(pick(PLAYLISTS[next as 'day'], next), 1.2);
  }
  playScene(next, raidSwap ? 2 : 1.2);
}
export const currentScene = () => scene;

/** 설정 「음악 목록」 미리 듣기 */
let previewing = false;
export function previewTrack(id: string | null) {
  if (!unlocked) return;
  if (id) {
    previewing = true;
    clearTimeout(restT);
    play(id, 0.6, 0, true);
  } else if (previewing) {
    previewing = false;
    const s = scene;
    scene = 'none';
    setScene(s);
  }
}
export const isPreviewing = () => previewing;

/** 첫 터치: 덱을 만들고 지금 상황 곡을 0.8초 페이드인 */
onUnlock(() => {
  decks.push(mkDeck(), mkDeck());
  amb = mkDeck(true);
  unlocked = true;
  const s = scene;
  scene = 'none';
  if (s === 'none') return;
  if (VILLAGE.has(s)) play(pick(PLAYLISTS[s as 'day'], s), 0.8);
  else {
    scene = s;
    playScene(s, 0.8);
  }
  scene = s;
});

/** 개발용: 덱 상태 */
/** 핫픽스 9 확인용: 두 덱이 동시에 소리 나는가 (겹침 측정) */
export const overlapNow = () => decks.length === 2 && decks.every((d) => !d.el.paused && (d.gain?.gain.value ?? 0) > 0.01);
export const deckState = () => ({
  scene,
  resting,
  decks: decks.map((d) => ({ track: d.track, paused: d.el.paused, t: Math.round(d.el.currentTime * 10) / 10, gain: d.gain ? Math.round(d.gain.gain.value * 100) / 100 : null, err: d.el.error?.code ?? 0 })),
  amb: amb ? { key: ambKey, paused: amb.el.paused, gain: amb.gain?.gain.value } : null,
});
/** 개발용: 지금 곡을 끝 sec초 전으로 */
export const devSeekEnd = (sec = 1) => {
  const d = decks[cur];
  if (d && Number.isFinite(d.el.duration)) d.el.currentTime = Math.max(0, d.el.duration - sec);
};

// ───────── 티저: 01의 처음 40초 (박자 맞추기용 시각 · 끝 페이드) ─────────

let teaserMode = false;
export function teaserStart() {
  teaserMode = true;
  if (!unlocked) return;
  clearTimeout(restT);
  clearTimeout(switchT);
  play('01', 0.3, 0, false);
}
/** 티저 곡의 지금 위치 (초) — 재생 중이 아니면 null */
export function teaserTime(): number | null {
  const d = decks[cur];
  return teaserMode && d && d.track === '01' && !d.el.paused && d.el.currentTime > 0 ? d.el.currentTime : null;
}
export const teaserFade = (sec: number) => decks[cur] && ramp(decks[cur], 0, sec);
export function teaserEnd() {
  teaserMode = false;
  // 디렉터가 다시 지금 상황 곡을 고르게
  scene = 'none';
}
