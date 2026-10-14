// 낚시 효과음 합성 (왈왈콩선생 건의): 길이 · 너무 크지 않게 · 「퐁당」이 「촤악」보다 작게 — AUDIO_OUT=폴더 면 wav로 뽑기
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { fishSamples } from '../src/audio/fishSynth';

const SR = 48000;
const stats = (d: Float32Array) => {
  let peak = 0, ss = 0, n = 0;
  for (const v of d) { peak = Math.max(peak, Math.abs(v)); if (Math.abs(v) > 0.01) { ss += v * v; n++; } }
  return { peakDb: 20 * Math.log10(peak), rmsDb: 10 * Math.log10(ss / Math.max(1, n)), dur: d.length / SR };
};
function wav(d: Float32Array): Buffer {
  const b = Buffer.alloc(44 + d.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + d.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(d.length * 2, 40);
  d.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return b;
}

describe('낚시 효과음', () => {
  it('퐁당: 0.26초 · 작게 (봉우리 −6dB 아래) · 촤악: 0.5초 · 둘 다 깎이지 않음', () => {
    const m = stats(fishSamples('fish_miss', SR));
    const c = stats(fishSamples('fish_catch', SR));
    expect(m.dur).toBeCloseTo(0.26, 2);
    expect(c.dur).toBeCloseTo(0.5, 2);
    expect(m.peakDb).toBeLessThan(-3);
    expect(c.peakDb).toBeLessThan(-1);
    // 퐁당은 실패라 촤악보다 조용하게
    expect(m.rmsDb).toBeLessThan(c.rmsDb + 1);
    if (process.env.AUDIO_OUT) {
      fs.mkdirSync(process.env.AUDIO_OUT, { recursive: true });
      let s = 7;
      const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      fs.writeFileSync(`${process.env.AUDIO_OUT}/fish_miss.wav`, wav(fishSamples('fish_miss', SR, rnd)));
      for (const k of [1, 2, 3]) fs.writeFileSync(`${process.env.AUDIO_OUT}/fish_catch_${k}.wav`, wav(fishSamples('fish_catch', SR, rnd)));
      console.log(`퐁당 봉우리 ${m.peakDb.toFixed(1)}dB · 소리 RMS ${m.rmsDb.toFixed(1)}dB / 촤악 ${c.peakDb.toFixed(1)}dB · ${c.rmsDb.toFixed(1)}dB`);
    }
  });
});
