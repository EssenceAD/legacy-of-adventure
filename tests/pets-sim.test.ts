// LUXE §2 펫 시뮬레이션: 라이트·헤비 하루 활동 수(거친 추정) → 첫 펫 / 5마리 / 10마리까지 며칠 → reports/luxe/pets.md
//  PETS_SIM=1 npx vitest run tests/pets-sim.test.ts  (확률·천장은 data/luxe_cfg.ts PETS 그대로 · 정해진 난수)
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PETS, type PetSrc } from '../src/data/luxe_cfg';

// ───────── 하루 활동 수 (시도 = 펫 확률을 한 번 굴리는 일) — 가정은 이 표 한 곳 ─────────
//  model: §3 꾸러미 시뮬(reports/luxe/bundles.md)과 같은 하루 모델 — light 하루 10분 · heavy 하루 2~3시간
//  real: 실세이브 누적 ÷ 현실 30일 (형철 = 헤비 기준 · 따밤/웅스 = 중간) — 강화·물약은 카운터가 없어 추정
const RATES: Record<string, Record<PetSrc, number>> = {
  'light (model)': { hunt: 120, fish: 10, harvest: 12, enhance: 3, expedition: 1, raid: 1, abyss: 0.5, brew: 2, meal: 40, star: 0.5 },
  'heavy (model)': { hunt: 500, fish: 28, harvest: 36, enhance: 30, expedition: 2.5, raid: 3, abyss: 10, brew: 8, meal: 300, star: 1 },
  'heavy (real pace)': { hunt: 82, fish: 1.6, harvest: 3.4, enhance: 10, expedition: 2.7, raid: 0.6, abyss: 1, brew: 1, meal: 286, star: 0.5 },
  'mid (real pace)': { hunt: 20, fish: 0.3, harvest: 1.1, enhance: 3, expedition: 1.3, raid: 0.3, abyss: 0, brew: 0.5, meal: 70, star: 0.3 },
};
/** 마을 회관 「주방」 완성 날 (§3 시뮬: 라이트 2~3일 · 헤비 1일 — 장부 3장이 열린 뒤) */
const KITCHEN: Record<string, number> = { 'light (model)': 3, 'heavy (model)': 1, 'heavy (real pace)': 2, 'mid (real pace)': 4 };
const RUNS = 4000;
const CAP = 3650;

/** 정해진 난수 (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 시도 수 (확률 p · 천장 pity에서 확정) */
function tries(p: number, pity: number, r: () => number): number {
  for (let n = 1; n < pity; n++) if (r() < p) return n;
  return pity;
}
/** 기댓값 (닫힌 식): Σ_{k<pity} (1−p)^k */
const expTries = (p: number, pity: number) => (1 - (1 - p) ** pity) / p;

function simulate(who: string) {
  const R = RATES[who];
  const r = rng(12345);
  const ks = [1, 5, 10];
  const sums = ks.map(() => 0);
  const p90 = ks.map(() => [] as number[]);
  const perPet: Record<string, number> = {};
  for (let i = 0; i < RUNS; i++) {
    const days = PETS.defs.map((d) => {
      const rate = R[d.src];
      let t = rate > 0 ? Math.ceil(tries(d.p, d.pity, r) / rate) : CAP;
      if (d.id === PETS.bundlePet) t = Math.min(t, KITCHEN[who]);
      t = Math.min(CAP, t);
      perPet[d.id] = (perPet[d.id] ?? 0) + t / RUNS;
      return t;
    });
    days.sort((a, b) => a - b);
    ks.forEach((k, j) => {
      sums[j] += days[k - 1] / RUNS;
      p90[j].push(days[k - 1]);
    });
  }
  const q = (a: number[], f: number) => a.sort((x, y) => x - y)[Math.floor(a.length * f)];
  return { mean: sums, p90: p90.map((a) => q(a, 0.9)), perPet };
}

describe.skipIf(!process.env.PETS_SIM)('펫 시뮬 → reports/luxe/pets.md', () => {
  it('라이트·헤비 첫 펫 / 5 / 10', () => {
    const who = Object.keys(RATES);
    const res = Object.fromEntries(who.map((w) => [w, simulate(w)]));
    const f = (n: number) => (n >= CAP ? '못 얻음' : n >= 100 ? `${Math.round(n)}일` : `${n.toFixed(1)}일`);
    const lines: string[] = [];
    lines.push('# LUXE §2 펫 「동물 친구」 시뮬 — 첫 펫 / 5마리 / 10마리까지 (현실 날짜)', '');
    lines.push(`- 확률·천장: data/luxe_cfg.ts PETS 그대로 (천장 = 확률의 2배 시도 확정) · 몬테카를로 ${RUNS}번 · 정해진 난수`);
    lines.push('- 하루 활동 수(= 시도)는 거친 추정 — 아래 표. model = §3 꾸러미 시뮬과 같은 하루 모델 · real pace = 실세이브 누적 ÷ 현실 30일(가정)');
    lines.push('- 배부른 강아지는 마을 회관 「주방」 완성(확정 경로) 날과 식사 확률 중 빠른 쪽');
    lines.push('- 한 사람이 모든 활동을 그 비율로 한다고 봄 (어떤 활동을 아예 안 하면 그 펫은 천장까지 안 옴 — 0인 칸은 「못 얻음」)', '');
    lines.push('## 하루 시도 수 (가정)', '', `| 활동 | ${who.join(' | ')} |`, `|---|${who.map(() => '---').join('|')}|`);
    for (const d of PETS.defs) lines.push(`| ${d.where} (${d.name}) | ${who.map((w) => RATES[w][d.src]).join(' | ')} |`);
    lines.push('', '## 결과 — 평균 (90% 사람은 이 안에)', '', `| | ${who.join(' | ')} |`, `|---|${who.map(() => '---').join('|')}|`);
    ['첫 펫', '5마리', '10마리'].forEach((name, j) => lines.push(`| ${name} | ${who.map((w) => `${f(res[w].mean[j])} (${f(res[w].p90[j])})`).join(' | ')} |`));
    lines.push('', '## 펫마다 평균 며칠 (기대 시도 = (1−(1−p)^천장)/p ≈ 0.86/p)', '', `| 펫 | 기대 시도 | 천장 | ${who.join(' | ')} |`, `|---|---|---|${who.map(() => '---').join('|')}|`);
    for (const d of PETS.defs) lines.push(`| ${d.name} | ${Math.round(expTries(d.p, d.pity))} | ${d.pity} | ${who.map((w) => f(res[w].perPet[d.id])).join(' | ')} |`);
    lines.push('', '## 읽기', '');
    lines.push(`- 라이트(모델): 첫 펫 ${f(res['light (model)'].mean[0])} — 주방 확정 경로 덕에 첫 주 안 · 5마리 ${f(res['light (model)'].mean[1])} · 10마리 ${f(res['light (model)'].mean[2])}.`);
    lines.push(`- 헤비(모델): 5마리 ${f(res['heavy (model)'].mean[1])} · 10마리 ${f(res['heavy (model)'].mean[2])}.`);
    lines.push('- 마지막 펫을 막는 건 대개 「하루 몇 번 안 되는 활동」(원정 성공 · 토벌 도전 · 심연 · 별똥별) — 천장이 2배라 운이 없어도 그 활동 기대 횟수의 2배 안에 온다.');
    lines.push('- 실세이브 속도(real pace)로는 낚시·텃밭·물약을 거의 안 해서 수달·두더지·슬라임이 오래 걸린다 → 그 활동을 하게 만드는 「작은 이유」(펫)로 동작. 숫자를 바꿀지는 판정 뒤.');
    lines.push('- **주의: 별여우** — 별똥별은 「소문 난 전설」이 있을 때만 뜬다(legends.ts starAvailable). 전설을 다 영입한 사람은 별이 안 떠서 천장도 못 채운다 → 대안 경로가 필요하면 판정 후 (예: 별이 안 뜨는 사람은 밤마다 시도 1).');
    lines.push('- 10마리 모두 그림 있음 (별여우 포함) — 못 만난 친구는 도감에서 실루엣.');
    lines.push('- **제안 (판정 대기 · 지금 숫자는 명세 그대로)**: 10마리를 늦추는 1등은 아기 그리핀(원정 성공은 하루 1~3번뿐인데 1/250) — 1/60·천장 120이면 라이트 그리핀 ≈ 52일 → 헤비 ≈ 21일. 라이트는 별고양이(심연)도 길다 — 1/60·천장 120 후보.');
    fs.mkdirSync('reports/luxe', { recursive: true });
    fs.writeFileSync('reports/luxe/pets.md', lines.join('\n') + '\n');
    console.log(lines.join('\n'));
    expect(res['light (model)'].mean[0]).toBeLessThanOrEqual(KITCHEN['light (model)']);
  });
});
