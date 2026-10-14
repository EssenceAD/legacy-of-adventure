// LUXE §1-5 명품관 시뮬 (실세이브 · 로컬 전용 · 없으면 건너뜀): 헤비(롯데캐슬) · 중간(솔바람) · 라이트(소담) 하루 금화 수입 → 「다 사는 데 걸리는 날」 → reports/luxe/shop.md
//  LUXE_SP=<스크래치 폴더> npx vitest run tests/luxe-shop-sim.test.ts  (실세이브는 커밋하지 않는다)
//  하루 수입(실제 하루) = 두 추정 중 큰 값: ① goldLog(한국 날짜 하루 출처별 합 · 저장한 날이면 그날 일부) ② 정산 기록(게임 하루 평균) × 실제 하루에 흐른 게임 날 수(같은 사람의 앞 저장과 비교)
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/guide';
import { LUXE_SHOP } from '../src/data/luxe_cfg';

const SP = process.env.LUXE_SP ?? 'C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad';
/** [이름, 지금 저장, 앞 저장(게임 날 속도용 · 없으면 null)] */
const WHO: [string, string, string, string | null][] = [
  ['heavy', '헤비 · 롯데캐슬', `${SP}/woongs3/save_01.json`, `${SP}/replay/save_05.json`],
  ['middle', '중간 · 솔바람', `${SP}/pace/save_04.json`, 'tests/fixtures/real_lotte.json'],
  ['light', '라이트 · 소담', `${SP}/replay/save_02.json`, null],
];
/** 명세(README) 첫 값 — 시뮬 전 */
const BEFORE = { set: [300000, 800000, 2000000, 5000000], weekly: [20000000, 12000000, 15000000, 10000000, 8000000, 8000000], small: [50000, 50000, 50000, 300000, 150000, 100000] };
const TARGET = { heavyAll: [25, 40], middleOne: [7, 14] };

type Save = { innName: string; gold: number; day: number; savedAt: number; progress: { guide?: { claimed?: string[]; legacy?: boolean }; goldLog?: { day: string; by: Record<string, number> }; daily: { log: { day: number; gold: number }[] } } };
const read = (f: string): Save | null => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Save) : null);
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));
const d1 = (n: number) => (n < 0.1 ? '<0.1' : n.toFixed(1));

describe.skipIf(!WHO.every(([, , f]) => fs.existsSync(f)))('LUXE §1-5 명품관 시뮬', () => {
  it('세이브별 하루 수입 · 다 사는 날 → reports/luxe/shop.md', () => {
    const now = {
      set: LUXE_SHOP.sets[0].items.map((x) => x.price),
      weekly: LUXE_SHOP.weekly.map((x) => x.price),
      small: LUXE_SHOP.small.map((x) => x.price),
    };
    const rows: string[] = [];
    const inc: Record<string, number> = {};
    // 게임 날 속도를 모르는 라이트는 중간 사람의 속도를 빌린다
    let speedFallback = 5;
    for (const [id, name, f, prev] of WHO) {
      const s = read(f)!;
      const p = prev ? read(prev) : null;
      const gl = s.progress.goldLog;
      const glSum = gl ? sum(Object.values(gl.by)) : 0;
      const log = s.progress.daily.log.filter((x) => x.day > 0);
      const avg = log.length ? sum(log.map((x) => x.gold)) / log.length : 0;
      const speed = p ? (s.day - p.day) / Math.max(0.25, (s.savedAt - p.savedAt) / 86400000) : speedFallback;
      if (id === 'middle') speedFallback = speed;
      const est = avg * speed;
      inc[id] = Math.max(glSum, est);
      const cl = s.progress.guide?.claimed ?? [];
      let ch = 0;
      for (const c of CHAPTERS) if (c.missions.every((m) => cl.includes(m.id))) ch = c.no;
      rows.push(`| ${name} | ${s.innName} · 장부 ${s.progress.guide?.legacy ? '(옛 저장 · 모두 열림)' : `${ch}장`}${ch >= LUXE_SHOP.chapter || s.progress.guide?.legacy ? '' : ' 🔒'} | ${fmt(s.gold)} | ${gl ? `${fmt(glSum)} (${gl.day})` : '—'} | ${fmt(avg)} × ${speed.toFixed(1)}${p ? '' : ' (중간 속도)'} = ${fmt(est)} | **${fmt(inc[id])}** |`);
    }
    const days = (cost: number, id: string) => cost / inc[id];
    const table = (P: typeof now) => {
      const one = sum(P.set);
      const all = one * 4;
      const out = [`| 누구 | 1점(중심 제외 가장 쌈) | 세트 1개 | 세트 4개 전부 | 이번 주 명품(싼 것~비싼 것) | 작은 사치 6개 |`, '|---|---|---|---|---|---|'];
      for (const [id, name] of WHO) {
        out.push(`| ${name} | ${d1(days(P.set[0], id))}일 | ${d1(days(one, id))}일 | ${d1(days(all, id))}일 | ${d1(days(Math.min(...P.weekly), id))}~${d1(days(Math.max(...P.weekly), id))}일 | ${d1(days(sum(P.small), id))}일 |`);
      }
      return { md: out.join('\n'), heavyAll: days(all, 'heavy'), middleOne: days(one, 'middle') };
    };
    const b = table(BEFORE);
    const a = table(now);
    const ok = (v: number, [lo, hi]: number[]) => (v >= lo && v <= hi ? '✓' : v < lo ? '✗ (너무 빠름)' : '✗ (너무 느림)');
    const md = `# LUXE §1-5 명품관 시뮬 — 하루 금화 수입 대비 「다 사는 날」

만든 것: \`tests/luxe-shop-sim.test.ts\` (실세이브 로컬 전용 · 다시 돌리기: \`npx vitest run tests/luxe-shop-sim.test.ts\`)

## 하루 수입 (실제 하루)

두 추정 중 큰 값: ① \`goldLog\` = 한국 날짜 하루 출처별 금화 합 (저장한 날이면 그날 일부) ② 정산 기록(게임 하루 평균 금화) × 실제 하루에 흐른 게임 날 수(같은 사람의 앞 저장과 비교).

| 누구 | 저장 | 지금 금화 | ① goldLog | ② 정산 × 게임 날/실제 날 | 하루 수입 |
|---|---|---|---|---|---|
${rows.join('\n')}

- 소담은 저장이 하나뿐(4일차)이라 게임 날 속도는 솔바람 것을 빌렸다. 🔒 = 지금은 장부 4장 전이라 명품관이 잠겨 있음 (작은 사치도) — 숫자는 「열렸을 때 이 수입이면」.

## 시뮬 전 (명세 README 값: 세트 30만/80만/200만/500만 · 주간 800만~2,000만 · 작은 사치 5만~30만)

${b.md}

- 목표: 헤비 세트 전부 ${TARGET.heavyAll.join('~')}일 → **${d1(b.heavyAll)}일 ${ok(b.heavyAll, TARGET.heavyAll)}** · 중간 세트 1개 ${TARGET.middleOne.join('~')}일 → **${d1(b.middleOne)}일 ${ok(b.middleOne, TARGET.middleOne)}**

## 시뮬 뒤 (지금 data/luxe_cfg.ts LUXE_SHOP: 세트 ${now.set.map(fmt).join('/')} · 주간 ${now.weekly.map(fmt).join('/')} · 작은 사치 ${now.small.map(fmt).join('/')})

${a.md}

- 목표: 헤비 세트 전부 ${TARGET.heavyAll.join('~')}일 → **${d1(a.heavyAll)}일 ${ok(a.heavyAll, TARGET.heavyAll)}** · 중간 세트 1개 ${TARGET.middleOne.join('~')}일 → **${d1(a.middleOne)}일 ${ok(a.middleOne, TARGET.middleOne)}**

## 판단

- **두 목표를 같은 값으로 동시에 맞출 수 없다.** 헤비(롯데캐슬)의 하루 수입이 중간(솔바람)의 약 ${Math.round(inc.heavy / inc.middle)}배다 (사냥 금화가 지역 2^r배로 커지는 후반 경제). 헤비 세트 전부 25~40일이면 세트 4개 합이 약 ${fmt(inc.heavy * 25)}~${fmt(inc.heavy * 40)}이어야 하고, 그 값이면 중간은 세트 1개에 몇 년이 걸린다.
- 그래서 **중간 목표(세트 1개 7~14일)에 맞춰 세트 값만 내렸다** (30만/80만/200만/500만 → ${now.set.map(fmt).join('/')} · 세트 합 1,190만 → ${fmt(sum(now.set))}). 헤비는 세트를 금방 다 사지만, 「이번 주 명품」(800만~2,000만 · 6주 순환)이 헤비가 매주 돌아올 몫으로 남는다 — 6점을 다 모으려면 어떻게 해도 6주.
- 주간 명품·작은 사치 값은 그대로 (중간에게 주간 명품은 「모아서 노리는」 크기 · 마을 회관 쿠폰이 한 번 무료).
- 헤비 목표까지 맞추려면 값을 금화 출처(사냥 최고 지역)에 따라 키우는 방식(마을 부탁·연금술처럼 「기준 × 2^r」)이 필요하다 — 명품은 모두 같은 값이어야 자랑이 된다는 쪽과 부딪혀서 **형철 판단으로 남김**.
`;
    fs.mkdirSync('reports/luxe', { recursive: true });
    fs.writeFileSync('reports/luxe/shop.md', md);
    // 형철 판정(10/15): 세트 값은 명세 그대로 — 목표(중간 1세트 7~14일)는 표에만 남기고 테스트로 막지 않는다
    expect(a.middleOne).toBeGreaterThan(0);
  });
});
