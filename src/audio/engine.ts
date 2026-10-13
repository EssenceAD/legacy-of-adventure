// 소리 엔진: AudioContext · 마스터/배경음악/효과음 볼륨 · 첫 터치 잠금 해제 · 앱을 내리면 멈춤 · 덕킹
//  설정은 기기별 localStorage (세이브 데이터가 아니다). 터치 전에는 아무것도 만들지도 틀지도 않는다.
import { getPref, setPref } from '../save/save';
import { vis } from '../world/visual';

export interface SoundPrefs {
  bgmOn: boolean;
  bgmVol: number;
  sfxOn: boolean;
  sfxVol: number;
  muted: boolean;
}
const DEF: SoundPrefs = { bgmOn: true, bgmVol: 0.4, sfxOn: true, sfxVol: 0.7, muted: false };
export const prefs: SoundPrefs = { ...DEF, ...getPref<Partial<SoundPrefs>>('sound', {}) };
export const savePrefs = () => setPref('sound', prefs);
/** CHECKIN §K1: 이 기기에서 소리 설정을 한 번도 저장한 적 없나 (처음 켬) */
let freshSound = getPref<unknown>('sound', null) === null;
/** CHECKIN §K1 (sound70): 처음 켤 때 배경음악 70% — 소리를 처음 여는 터치에서 (설정을 바꿀 때 저장된다) */
function firstRunVolume() {
  if (freshSound && vis('sound70') && prefs.bgmVol === DEF.bgmVol) prefs.bgmVol = 0.7;
  freshSound = false;
}
/** CHECKIN §C2: 세이브의 설정값을 받은 뒤 다시 읽기 */
export function reloadSoundPrefs() {
  freshSound = false;
  Object.assign(prefs, DEF, getPref<Partial<SoundPrefs>>('sound', {}));
  applyPrefs(false);
}

export let ctx: AudioContext | null = null;
let master: GainNode;
/** 배경음악·마을 소리 (설정 볼륨) → 덕킹 → 마스터 */
export let bgmBus: GainNode;
let duckNode: GainNode;
let talkNode: GainNode | null = null;
/** 대화 덕킹: on이면 배경음악 60% */
export function talkDuck(on: boolean) {
  if (!ctx || !talkNode) return;
  const to = on ? 0.6 : 1;
  if (Math.abs(talkNode.gain.value - to) < 0.01) return;
  talkNode.gain.setTargetAtTime(to, ctx.currentTime, 0.15);
}
export let sfxBus: GainNode;

const unlockFns: (() => void)[] = [];
/** 첫 터치로 소리가 열리면 (배경음악 시작 · 효과음 미리 받기) */
export const onUnlock = (f: () => void) => {
  if (ctx) f();
  else unlockFns.push(f);
};
export const ready = () => !!ctx && ctx.state === 'running';

function build() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC({ latencyHint: 'interactive' });
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  duckNode = ctx.createGain();
  duckNode.connect(master);
  bgmBus = ctx.createGain();
  // 핫픽스 9: 대화창이 떠 있는 동안 배경음악 60% (곡은 바꾸지 않는다)
  talkNode = ctx.createGain();
  talkNode.connect(duckNode);
  bgmBus.connect(talkNode);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  applyPrefs(false);
}

/** 볼륨·켜기를 노드에 (부드럽게) */
export function applyPrefs(save = true) {
  if (save) savePrefs();
  if (!ctx) return;
  const t = ctx.currentTime;
  bgmBus.gain.setTargetAtTime(prefs.bgmOn ? prefs.bgmVol : 0, t, 0.05);
  sfxBus.gain.setTargetAtTime(prefs.sfxOn ? prefs.sfxVol : 0, t, 0.02);
  fadeMaster(prefs.muted ? 0 : 1, 0.15);
}

function fadeMaster(to: number, sec: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(to, t + sec);
}

/** 터치마다: 처음이면 만들고, 멈춰 있으면(전화·다른 앱) 다시 */
function onGesture() {
  if (!ctx) {
    firstRunVolume();
    build();
    const c = ctx as AudioContext | null;
    if (!c) return;
    void c.resume().then(() => {
      fadeMaster(prefs.muted ? 0 : 1, 0.8);
      unlockFns.splice(0).forEach((f) => f());
    });
    return;
  }
  if (document.visibilityState === 'visible' && ctx.state !== 'running') void ctx.resume().then(() => fadeMaster(prefs.muted ? 0 : 1, 0.4));
}

let hideT = 0;
export function initAudioEngine() {
  for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) addEventListener(ev, onGesture, { capture: true, passive: true });
  // 앱을 내리면 0.3초 페이드아웃 → 멈춤, 돌아오면 다시 페이드인
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    clearTimeout(hideT);
    if (document.visibilityState === 'hidden') {
      fadeMaster(0, 0.3);
      hideT = window.setTimeout(() => void ctx?.suspend(), 320);
    } else {
      void ctx.resume().then(() => fadeMaster(prefs.muted ? 0 : 1, 0.6)).catch(() => {});
    }
  });
}

/** 큰 효과음 동안 배경음악을 40%로 (sec초 뒤 되돌림) */
export function duck(sec: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  duckNode.gain.cancelScheduledValues(t);
  duckNode.gain.setValueAtTime(duckNode.gain.value, t);
  duckNode.gain.linearRampToValueAtTime(0.4, t + 0.15);
  duckNode.gain.setValueAtTime(0.4, t + Math.max(0.2, sec));
  duckNode.gain.linearRampToValueAtTime(1, t + Math.max(0.2, sec) + 0.8);
}

export function toggleMute(): boolean {
  prefs.muted = !prefs.muted;
  applyPrefs();
  return prefs.muted;
}
