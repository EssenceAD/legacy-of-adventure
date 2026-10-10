// 효과음 · 팡파르: Suno로 만든 파일 (public/audio/sfx/*.wav 미리 받기 · jingle/J1~J5.mp3 처음 쓸 때 받기)
//  동시 최대 8개 · 같은 소리 50ms 안 겹침 금지 · 잦은 소리는 재생 속도를 살짝 흔든다. 파일이 없으면 부드러운 합성음(예비)
import { ctx, duck, onUnlock, sfxBus } from './engine';

export type SfxName =
  | 'tap' | 'open' | 'close' | 'coin' | 'build' | 'place_bad' | 'levelup' | 'fail' | 'item' | 'rare' | 'harmony' | 'mission' | 'chapter' | 'grade_up'
  | 'hit' | 'crit' | 'skill' | 'block' | 'perfect' | 'win' | 'lose' | 'event' | 'heart' | 'eval_bronze' | 'eval_silver' | 'eval_gold' | 'eval_legend'
  | 'record' | 'night' | 'legend';

const BASE = 'audio/';
const FILE_SFX = ['tap', 'open', 'close', 'coin', 'build', 'place_bad', 'mission', 'event', 'heart', 'night', 'item', 'rare', 'fail', 'hit', 'crit', 'skill', 'block', 'perfect'] as const;
/** 팡파르: [파일, 음량, 덕킹 초] */
const JINGLE: Partial<Record<SfxName, [string, number, number]>> = {
  levelup: ['J1', 0.9, 0],
  chapter: ['J1', 1, 2.4],
  win: ['J1', 1, 2.4],
  lose: ['J2', 1, 2.6],
  grade_up: ['J3', 1, 3],
  eval_bronze: ['J3', 0.6, 3],
  eval_silver: ['J3', 0.8, 3],
  eval_gold: ['J3', 1, 3],
  eval_legend: ['J3', 1, 4],
  harmony: ['J4', 1, 0],
  legend: ['J4', 1, 2.6],
  record: ['J5', 1, 0],
};
const WOBBLE = new Set<SfxName>(['hit', 'coin', 'tap', 'crit']);

const buf: Record<string, AudioBuffer | null | undefined> = {};
async function load(path: string): Promise<AudioBuffer | null> {
  if (buf[path] !== undefined) return buf[path] ?? null;
  buf[path] = null;
  try {
    const r = await fetch(BASE + path);
    if (!r.ok) throw new Error(String(r.status));
    const b = await ctx!.decodeAudioData(await r.arrayBuffer());
    buf[path] = b;
    return b;
  } catch {
    buf[path] = null;
    return null;
  }
}
/** 첫 터치 뒤: 짧은 효과음 18개를 미리 받는다 (합쳐서 2MB) */
onUnlock(() => {
  for (const n of FILE_SFX) void load(`sfx/${n}.wav`);
});

let playing = 0;
const last: Partial<Record<string, number>> = {};

function playBuffer(b: AudioBuffer, vol: number, when: number, rate = 1) {
  if (!ctx || playing >= 8) return;
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(g).connect(sfxBus);
  playing++;
  s.onended = () => {
    playing--;
    s.disconnect();
    g.disconnect();
  };
  s.start(when);
}

/** 효과음 하나 (소리가 아직 안 열렸거나 꺼져 있으면 조용히) */
/** 개발용: 최근에 부른 효과음 */
export const sfxLog: string[] = [];
export function sfx(name: SfxName | string) {
  if (import.meta.env.DEV) {
    sfxLog.push(name);
    if (sfxLog.length > 60) sfxLog.shift();
  }
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if ((last[name] ?? -1) > now - 0.05) return;
  last[name] = now;
  const n = name as SfxName;
  const jg = JINGLE[n];
  if (jg) {
    const [file, vol, dk] = jg;
    if (dk) duck(dk);
    void load(`jingle/${file}.mp3`).then((b) => {
      if (b) playBuffer(b, vol, ctx!.currentTime + 0.02);
      else synth(n);
    });
    // 전설 평가: J3 뒤 0.8초 늦게 J4를 겹친다
    if (n === 'eval_legend') void load('jingle/J4.mp3').then((b) => b && playBuffer(b, 1, ctx!.currentTime + 0.8));
    return;
  }
  const b = buf[`sfx/${n}.wav`];
  if (b) playBuffer(b, 1, now, WOBBLE.has(n) ? 0.95 + Math.random() * 0.1 : 1);
  else synth(n);
}

// ───────── 예비 합성음 (파일을 못 받았을 때만) — 사인·삼각 + FM 벨, 부드럽게 ─────────

const NOTE = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** 음 하나: 사인/삼각 + (bell이면 FM) · 로우패스 6kHz */
function tone(midi: number, at: number, dur: number, vol = 0.18, type: OscillatorType = 'triangle', bell = false) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = NOTE(midi);
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6000;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  if (bell) {
    const m = ctx.createOscillator();
    m.frequency.value = NOTE(midi) * 3.5;
    const mg = ctx.createGain();
    mg.gain.value = NOTE(midi) * 1.2;
    m.connect(mg).connect(o.frequency);
    m.start(at);
    m.stop(at + dur);
  }
  o.connect(g).connect(lp).connect(sfxBus);
  o.start(at);
  o.stop(at + dur + 0.02);
}
function noise(at: number, dur: number, vol = 0.2, cutoff = 2000) {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource();
  s.buffer = b;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(lp).connect(g).connect(sfxBus);
  s.start(at);
}
const seq = (notes: number[], step: number, dur: number, bell = true, vol = 0.16) => {
  const t = ctx!.currentTime + 0.1;
  notes.forEach((m, i) => tone(m, t + i * step, dur, vol, 'sine', bell));
};
function synth(n: SfxName) {
  if (!ctx) return;
  const t = ctx.currentTime + 0.1;
  switch (n) {
    case 'tap': return tone(84, t, 0.04, 0.08, 'triangle');
    case 'open': return seq([72, 79], 0.05, 0.12, false, 0.1);
    case 'close': return seq([79, 72], 0.05, 0.12, false, 0.1);
    case 'coin': return seq([88, 93], 0.06, 0.25);
    case 'build': noise(t, 0.18, 0.3, 900); return tone(43, t, 0.25, 0.2, 'sine');
    case 'place_bad': return seq([50, 46], 0.09, 0.14, false, 0.14);
    case 'fail': return seq([67, 63, 58], 0.1, 0.2, false);
    case 'item': return seq([76, 79, 83, 88], 0.05, 0.25);
    case 'rare': noise(t + 0.25, 0.5, 0.06, 6000); return seq([76, 79, 83, 88, 91, 95], 0.05, 0.4);
    case 'mission': return seq([84, 79], 0.12, 0.4);
    case 'event': return seq([79, 86], 0.08, 0.2, false, 0.12);
    case 'heart': return seq([77, 81], 0.14, 0.35, false, 0.12);
    case 'hit': return noise(t, 0.06, 0.25, 2500);
    case 'crit': noise(t, 0.1, 0.35, 4000); return tone(91, t, 0.12, 0.1, 'triangle');
    case 'skill': return seq([67, 71, 74, 79, 83], 0.025, 0.12, false, 0.1);
    case 'block': return tone(74, t, 0.3, 0.16, 'sine', true);
    case 'perfect': return tone(91, t, 0.6, 0.16, 'sine', true);
    case 'night': return seq([60, 57], 0.35, 0.4, false, 0.06);
    case 'lose': return seq([67, 63, 60, 55], 0.18, 0.5, false);
    case 'grade_up':
    case 'eval_bronze':
    case 'eval_silver':
    case 'eval_gold':
    case 'eval_legend':
      return seq([84, 84, 84], 0.45, 1.4, true, 0.14);
    default:
      // 팡파르류: 4음 위로
      return seq([72, 76, 79, 84], 0.09, 0.5);
  }
}

/** 팡파르 앞부분만 (dur초 뒤 0.3초에 걸쳐 줄인다) — 티저 현판 「쾅」 */
export function sfxClip(file: string, dur: number, vol = 1) {
  if (!ctx || ctx.state !== 'running') return;
  void load("jingle/" + file + ".mp3").then((b) => {
    if (!b || !ctx) return;
    const s = ctx.createBufferSource();
    s.buffer = b;
    const g = ctx.createGain();
    const t = ctx.currentTime + 0.02;
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.3);
    s.connect(g).connect(sfxBus);
    s.start(t);
    s.stop(t + dur + 0.35);
  });
}
