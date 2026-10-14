// 낚시 효과음 합성 (파일 없이 · 왈왈콩선생 건의) — 순수 함수: 샘플 배열만 만든다 (게임은 sfxBus로 재생 · 스크립트는 wav로 뽑기)
//  fish_miss 「퐁당」: 낮은 사인 400→150Hz 0.12초 + 800Hz 아래 노이즈 0.2초, 작게 — 실망보다 「아깝다」
//  fish_catch 「촤악」: 노이즈 0.35초를 4000→1200Hz로 쓸어내리기 + 물방울 2~3개(1.2~2.4kHz 짧은 사인, 0.05~0.25초 사이)
export type FishSfx = 'fish_miss' | 'fish_catch';
export const FISH_SFX = new Set<string>(['fish_miss', 'fish_catch']);

/** 한 극 저역 통과 (fc는 샘플마다 바뀔 수 있음) */
const lpA = (fc: number, sr: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);

export function fishSamples(name: FishSfx, sr: number, rnd: () => number = Math.random): Float32Array {
  if (name === 'fish_miss') {
    const len = Math.round(sr * 0.26);
    const out = new Float32Array(len);
    // 사인 400→150Hz (지수 곡선) · 0.12초 · 5ms 올라가서 빠르게 줄어듦
    let ph = 0;
    const tdur = 0.12;
    for (let i = 0; i < Math.round(sr * tdur); i++) {
      const t = i / sr;
      const f = 400 * Math.pow(150 / 400, t / tdur);
      ph += (2 * Math.PI * f) / sr;
      const env = Math.min(1, t / 0.005) * Math.exp(-t / 0.045);
      out[i] += Math.sin(ph) * env * 0.21;
    }
    // 노이즈 0.2초 · 800Hz 아래 (두 번 걸러 부드럽게)
    let y1 = 0;
    let y2 = 0;
    const a = lpA(800, sr);
    for (let i = 0; i < Math.round(sr * 0.2); i++) {
      const t = i / sr;
      y1 += a * (rnd() * 2 - 1 - y1);
      y2 += a * (y1 - y2);
      const env = Math.min(1, t / 0.01) * Math.exp(-t / 0.07);
      out[i] += y2 * env * 0.45;
    }
    return out;
  }
  // fish_catch
  const len = Math.round(sr * 0.5);
  const out = new Float32Array(len);
  let y1 = 0;
  let y2 = 0;
  const ndur = 0.35;
  for (let i = 0; i < Math.round(sr * ndur); i++) {
    const t = i / sr;
    const fc = 4000 * Math.pow(1200 / 4000, t / ndur);
    const a = lpA(fc, sr);
    y1 += a * (rnd() * 2 - 1 - y1);
    y2 += a * (y1 - y2);
    // 물을 가르는 느낌: 빠르게 올라가 0.35초 동안 줄어듦
    const env = Math.min(1, t / 0.015) * Math.pow(1 - t / ndur, 1.6);
    out[i] += y2 * env * 0.75;
  }
  // 물방울 2~3개: 짧은 사인 블립 (끝에서 살짝 올라가는 음)
  const drops = 2 + (rnd() < 0.5 ? 1 : 0);
  for (let d = 0; d < drops; d++) {
    const at = 0.05 + rnd() * 0.2;
    const f0 = 1200 + rnd() * 1200;
    const bdur = 0.035 + rnd() * 0.02;
    let ph = 0;
    const i0 = Math.round(at * sr);
    for (let i = 0; i < Math.round(bdur * sr) && i0 + i < len; i++) {
      const t = i / sr;
      const f = f0 * (1 + 0.35 * (t / bdur));
      ph += (2 * Math.PI * f) / sr;
      const env = Math.min(1, t / 0.003) * Math.exp(-t / (bdur * 0.35));
      out[i0 + i] += Math.sin(ph) * env * 0.22;
    }
  }
  return out;
}
