// 핫픽스 8 (2-8): 전투 효과음은 코드 합성음 (Suno 파일 hit·crit·skill·block·perfect는 지우지 않고 남겨 둠 — 되돌리기용)
//  AUDIO_SPEC 「예비 합성음 음색」: 노이즈 버스트 · 사인 피치 하강 · FM 벨 · 사각파 · 노이즈 스윕
//  매번 피치 ±5% · 음량 ±15% · 동시에 최대 6개 (같은 이름 80ms 제한은 sfx()가 한다)
import { ctx, sfxBus } from './engine';

const MAX = 6;
let live: number[] = [];
const jit = () => 0.95 + Math.random() * 0.1;
const vj = () => 0.85 + Math.random() * 0.3;

function env(g: GainNode, at: number, peak: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
}
function noiseBuf(dur: number) {
  const n = Math.max(1, Math.floor(ctx!.sampleRate * dur));
  const b = ctx!.createBuffer(1, n, ctx!.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
/** 노이즈 (필터 종류·주파수 · 스윕 끝 주파수) */
function noise(at: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, q = 1) {
  const s = ctx!.createBufferSource();
  s.buffer = noiseBuf(dur);
  const f = ctx!.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
  const g = ctx!.createGain();
  env(g, at, vol, 0.004, dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(at);
  s.stop(at + dur + 0.02);
}
/** 사인/사각/삼각 (피치 f0 → f1) */
function osc(at: number, dur: number, vol: number, type: OscillatorType, f0: number, f1 = f0) {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  const g = ctx!.createGain();
  env(g, at, vol, 0.004, dur);
  o.connect(g).connect(sfxBus);
  o.start(at);
  o.stop(at + dur + 0.02);
}
/** 사각파 듀티 25% (푸리에 계수로) */
function pulse25(at: number, dur: number, vol: number, f: number) {
  const n = 16;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
  const o = ctx!.createOscillator();
  o.setPeriodicWave(ctx!.createPeriodicWave(re, im));
  o.frequency.value = f;
  const g = ctx!.createGain();
  env(g, at, vol, 0.002, dur);
  o.connect(g).connect(sfxBus);
  o.start(at);
  o.stop(at + dur + 0.02);
}
/** FM 벨 (반송파 f · 비율 r) */
function bell(at: number, dur: number, vol: number, f: number, r = 3.5, depth = 1.2) {
  const o = ctx!.createOscillator();
  o.frequency.value = f;
  const m = ctx!.createOscillator();
  m.frequency.value = f * r;
  const mg = ctx!.createGain();
  mg.gain.setValueAtTime(f * depth, at);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, at + dur);
  m.connect(mg).connect(o.frequency);
  const g = ctx!.createGain();
  env(g, at, vol, 0.003, dur);
  o.connect(g).connect(sfxBus);
  m.start(at);
  o.start(at);
  m.stop(at + dur + 0.02);
  o.stop(at + dur + 0.02);
}

export const COMBAT_SYNTH = new Set(['demolish', 'hit', 'crit', 'block', 'perfect', 'skill', 'skill_knight', 'skill_warrior', 'skill_rogue', 'skill_mage', 'skill_priest', 'skill_hunter']);

/** 합성 전투음 한 번 · 너무 많으면(동시 6개) 건너뜀 */
export function combatSynth(name: string, vol = 1): boolean {
  if (!ctx || ctx.state !== 'running') return false;
  const now = ctx.currentTime;
  live = live.filter((t) => t > now);
  if (live.length >= MAX) return true;
  const p = jit();
  const v = vol * vj();
  const t = now + 0.005;
  let dur = 0.1;
  switch (name) {
    case 'hit':
      // 「퍽」: 노이즈 25ms(밴드패스 1.8kHz) + 사인 180→90Hz 60ms
      noise(t, 0.025, 0.5 * v, 'bandpass', 1800 * p, 1800 * p, 1.2);
      osc(t, 0.06, 0.55 * v, 'sine', 180 * p, 90 * p);
      dur = 0.07;
      break;
    case 'crit':
      // 「퍽-챙」: hit + 금속 FM 벨 1.2kHz(비율 3.5) 120ms
      noise(t, 0.025, 0.55 * v, 'bandpass', 1800 * p, 1800 * p, 1.2);
      osc(t, 0.06, 0.6 * v, 'sine', 180 * p, 90 * p);
      bell(t + 0.01, 0.12, 0.22 * v, 1200 * p, 3.5, 1.5);
      dur = 0.14;
      break;
    case 'block':
      // 짧은 금속 「탱」: 사각파 25% 400Hz + 노이즈 하이패스 3kHz 40ms
      pulse25(t, 0.09, 0.22 * v, 400 * p);
      noise(t, 0.04, 0.3 * v, 'highpass', 3000 * p);
      dur = 0.1;
      break;
    case 'perfect':
      // 「티잉~」: FM 벨 2.4kHz 250ms 긴 꼬리 + 위로 오르는 반짝임 3음
      bell(t, 0.5, 0.25 * v, 2400 * p, 3.5, 0.8);
      [0, 1, 2].forEach((i) => bell(t + 0.08 + i * 0.06, 0.18, 0.1 * v, 2400 * p * Math.pow(1.26, i + 1), 2, 0.5));
      dur = 0.55;
      break;
    case 'demolish':
      // 핫픽스 10 철거 「털썩」: 낮은 쿵 + 흙 무너지는 노이즈
      osc(t, 0.3, 0.6 * v, 'sine', 90 * p, 45 * p);
      noise(t + 0.02, 0.35, 0.4 * v, 'lowpass', 900 * p, 200 * p, 0.7);
      dur = 0.4;
      break;
    case 'skill_knight':
      // 낮은 쿵 + 방패 탱
      osc(t, 0.22, 0.6 * v, 'sine', 120 * p, 70 * p);
      pulse25(t + 0.04, 0.08, 0.16 * v, 400 * p);
      noise(t + 0.04, 0.04, 0.2 * v, 'highpass', 3000);
      dur = 0.25;
      break;
    case 'skill_warrior':
      // 바람 가르는 휘익: 노이즈 스윕 400→2kHz
      noise(t, 0.22, 0.45 * v, 'bandpass', 400 * p, 2000 * p, 2);
      dur = 0.23;
      break;
    case 'skill_rogue':
      // 짧은 휙휙 두 번
      noise(t, 0.07, 0.4 * v, 'bandpass', 900 * p, 3000 * p, 2.5);
      noise(t + 0.09, 0.07, 0.4 * v, 'bandpass', 1000 * p, 3400 * p, 2.5);
      dur = 0.17;
      break;
    case 'skill_mage':
      // 화르륵(노이즈 + 로우패스 스윕) + 폭발 펑
      noise(t, 0.3, 0.35 * v, 'lowpass', 600 * p, 3500 * p, 1);
      noise(t + 0.28, 0.25, 0.5 * v, 'lowpass', 900 * p, 120 * p, 0.8);
      osc(t + 0.28, 0.2, 0.45 * v, 'sine', 110 * p, 45 * p);
      dur = 0.55;
      break;
    case 'skill_priest':
      // 맑은 종 화음 (도·미·솔 FM 벨)
      [523.25, 659.25, 783.99].forEach((f, i) => bell(t + i * 0.03, 0.55, 0.12 * v, f * 2 * p, 2, 0.6));
      dur = 0.6;
      break;
    case 'skill_hunter':
      // 활시위 튕(사각파 짧게) + 화살 휙
      pulse25(t, 0.05, 0.25 * v, 220 * p);
      noise(t + 0.04, 0.12, 0.35 * v, 'bandpass', 2500 * p, 1200 * p, 3);
      dur = 0.17;
      break;
    default:
      // 이름 없는 skill: 전사 소리
      noise(t, 0.2, 0.4 * v, 'bandpass', 500 * p, 2000 * p, 2);
      dur = 0.2;
  }
  live.push(now + dur);
  return true;
}
