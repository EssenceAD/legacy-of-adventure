// PACE §2 시뮬레이션 (실세이브 · 로컬 전용): 맡겨 둔 사냥 3칸이면 하루 금화가 몇 % 늘고 지역 재료가 몇 배 들어오나 → reports/pace/hunt.md
//  HSLOT_SAVES="dirA;dirB" npx vitest run tests/hunt-slots-sim.test.ts  (세이브 폴더 없으면 건너뜀 · 실세이브는 커밋하지 않는다)
import { afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/data/config';
import { REGIONS, type RegionId } from '../src/data/items';
import { blankActor, powerOf } from '../src/world/adventurers';
import { setFlag } from '../src/world/flags';
import { gsState } from '../src/world/goldsink';
import { sanitizeGrowth } from '../src/world/growth';
import { autoTick, best, huntCrew, idleHunt, partyPower, recPower, setAuto, syncAutos } from '../src/world/hunt';
import { huntPartyMax } from '../src/world/party4';
import { sanitizeRegions2 } from '../src/world/regions2';
import { P, resetProgress, S, world, type Actor, type Building } from '../src/world/state';
import { readSave } from '../src/save/save';
import { CHAPTERS } from '../src/data/guide';

const DIRS = (process.env.HSLOT_SAVES ?? '').split(';').filter((d) => d && fs.existsSync(d));
const FILES = DIRS.flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => path.join(d, f)));
const H = CONFIG.hunt;

function load(f: string) {
  localStorage.setItem(CONFIG.save.key, fs.readFileSync(f, 'utf8'));
  const d = readSave()!;
  resetProgress(d.progress);
  sanitizeRegions2();
  sanitizeGrowth();
  S.gold = d.gold;
  S.started = true;
  S.visiting = null as never;
  world.home = null;
  world.objs = d.buildings.map((b) => ({ ...b, inside: [] }) as unknown as Building);
  world.actors = d.adventurers.map((a) => Object.assign(blankActor(a.kind, a.name, a.x, a.y), a));
  for (const it of P.bag) it.owner = null;
  for (const a of world.actors)
    for (const s of ['weapon', 'armor', 'acc'] as const) {
      const it = P.bag.find((x) => x.id === a.equip[s]);
      if (it) it.owner = a.id;
    }
  // 시뮬레이션은 모두 집에 있다고 본다 (원정 중이면 칸이 멈추니까)
  for (const a of world.actors) a.runId = null;
  P.hunt.autos = [];
  syncAutos();
  return d;
}
/** 같은 난수열 (판마다 같은 주사위) */
function seed(n = 12345) {
  let x = n;
  vi.spyOn(Math, 'random').mockImplementation(() => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648));
}
/** 이 파티가 맡길 수 있는 가장 높은 (지역, 스테이지) · avoid 지역은 될 수 있으면 피한다 */
function pickStage(ms: Actor[], avoid: string[]): { r: RegionId; s: number } | null {
  const pw = partyPower(ms);
  const cands: { r: RegionId; s: number; i: number }[] = [];
  REGIONS.forEach((reg, i) => {
    for (let s = best(reg.id); s >= 1; s--) if (pw >= recPower(reg.id, s) * H.autoRatio) return void cands.push({ r: reg.id, s, i });
  });
  if (!cands.length) return null;
  const score = (c: { s: number; i: number }) => c.i * 100 + c.s;
  const fresh = cands.filter((c) => !avoid.includes(c.r)).sort((a, b) => score(b) - score(a));
  return fresh[0] ?? cands.sort((a, b) => score(b) - score(a))[0];
}
/** today = 세이브 그대로 1칸 · best1 = 가장 센 파티로 가장 높은 곳 1칸 · top3 = 3칸 모두 맡길 수 있는 가장 높은 곳(중복 OK, 금화 최악) · spread = 세이브 0번 칸 + 다른 지역 2칸(재료용) */
type Mode = 'today' | 'best1' | 'top3' | 'spread';
/** 하루: 켜 둔 ticks판(30초마다) + 꺼 둔 16시간 */
function day(f: string, mode: Mode, ticks: number) {
  load(f);
  setFlag('huntSlots', mode === 'top3' || mode === 'spread');
  P.guide.claimed = CHAPTERS.flatMap((c) => c.missions.map((m) => m.id));
  const max = huntPartyMax();
  if (mode === 'best1' || mode === 'top3') P.hunt.auto = null;
  let a0 = P.hunt.auto;
  if (!a0) {
    const ms = huntCrew().sort((x, y) => powerOf(y) - powerOf(x)).slice(0, max);
    const st = pickStage(ms, []);
    if (st) setAuto(st.r, st.s, ms, 0);
    a0 = P.hunt.auto;
  }
  const slots: string[] = a0 ? [`${a0.region} ${a0.stage}`] : [];
  if ((mode === 'top3' || mode === 'spread') && a0) {
    const used = new Set(a0.members);
    for (let k = 1; k < 3; k++) {
      const ms = huntCrew()
        .filter((a) => !used.has(a.id!))
        .sort((x, y) => powerOf(y) - powerOf(x))
        .slice(0, max);
      if (!ms.length) break;
      const st = pickStage(ms, mode === 'spread' ? [a0.region, ...slots.map((x) => x.split(' ')[0])] : []);
      if (!st) break;
      const err = setAuto(st.r, st.s, ms, k);
      if (err) break;
      for (const m of ms) used.add(m.id!);
      slots.push(`${st.r} ${st.s}`);
    }
  }
  seed();
  gsState().autoN = 0;
  const g0 = S.gold;
  const m0 = { ...P.mats } as Record<string, number>;
  const b0 = { ...P.bossMats } as Record<string, number>;
  let now = P.hunt.idleAt;
  for (let t = 0; t < ticks; t++) autoTick((now += H.autoSeconds * 1000));
  const online = S.gold - g0;
  const g1 = S.gold;
  idleHunt(16 * 3600, Infinity);
  const idle = S.gold - g1;
  const mats: Record<string, number> = {};
  for (const r of REGIONS) {
    const d = (P.mats[r.id] ?? 0) - (m0[r.id] ?? 0);
    if (d) mats[r.id] = d;
  }
  const bossMats = Object.keys(P.bossMats).reduce((t, k) => t + ((P.bossMats[k] ?? 0) - (b0[k] ?? 0)), 0);
  const by = P.goldLog?.by ?? {};
  const other = ['quest', 'sleep', 'drink', 'bath', 'forge', 'stall'].reduce((t, k) => t + (by[k] ?? 0), 0);
  vi.restoreAllMocks();
  return { online, idle, hunt: online + idle, other, mats, matsN: Object.values(mats).reduce((t, v) => t + v, 0), bossMats, slots };
}

const rows: string[] = [];
const SLOT_GOLD = H.slotGold;
afterAll(() => {
  setFlag('huntSlots', false);
  H.slotGold = SLOT_GOLD;
  if (!rows.length) return;
  fs.mkdirSync('reports/pace', { recursive: true });
  fs.writeFileSync('reports/pace/hunt.md', rows.join('\n') + '\n');
});

describe.skipIf(!FILES.length)('PACE §2 시뮬레이션 (실세이브)', () => {
  it('3칸 하루 금화 +15% 이내 · 지역 재료 몇 배', () => {
    const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
    const pct = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toFixed(1)}%` : '-');
    const PATS = [
      { name: '실제형 (켜 둔 128판 + 꺼 둔 16시간)', ticks: 128 },
      { name: '헤비 (켜 둔 8시간 960판 + 꺼 둔 16시간)', ticks: 960 },
    ];
    // 명세 값 0.4부터 내려가며 고른다 (CONFIG 값이 이미 낮춰져 있어도 표는 0.4부터)
    const gold0 = 0.4;
    // 배수 후보: 지금 값부터 0.05씩 내려가며 「같은 칸 중복(최악)」 헌트 금화가 +15% 이내인 첫 값
    const tryX = [gold0, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1].filter((x, i, a) => x <= gold0 && a.indexOf(x) === i);
    const worstBy: Record<string, number> = {};
    const base: Record<string, ReturnType<typeof day>> = {};
    const best1: Record<string, ReturnType<typeof day>> = {};
    for (const f of FILES)
      for (const p of PATS) {
        base[`${f}|${p.ticks}`] = day(f, 'today', p.ticks);
        best1[`${f}|${p.ticks}`] = day(f, 'best1', p.ticks);
      }
    /** 비교 기준 = 지금 1칸으로 낼 수 있는 더 큰 쪽 (세이브 그대로 · 가장 높은 곳) */
    const ref = (k: string) => (best1[k].hunt >= base[k].hunt ? best1[k] : base[k]);
    for (const x of tryX) {
      H.slotGold = x;
      let worst = -Infinity;
      for (const f of FILES)
        for (const p of PATS) {
          const b = ref(`${f}|${p.ticks}`);
          if (!b.hunt) continue;
          const d = day(f, 'top3', p.ticks);
          worst = Math.max(worst, (d.hunt - b.hunt) / b.hunt);
        }
      worstBy[x] = worst;
    }
    // 0.05 단위로 고른 뒤 0.01 단위로 다듬는다 (+15% 이내 가장 큰 값)
    let pick = tryX.find((x) => worstBy[x] <= 0.15) ?? tryX[tryX.length - 1];
    for (let x = Math.round((pick + 0.04) * 100) / 100; x > pick; x = Math.round((x - 0.01) * 100) / 100) {
      if (x > gold0) continue;
      H.slotGold = x;
      let worst = -Infinity;
      for (const f of FILES)
        for (const p of PATS) {
          const b = ref(`${f}|${p.ticks}`);
          if (b.hunt) worst = Math.max(worst, (day(f, 'top3', p.ticks).hunt - b.hunt) / b.hunt);
        }
      worstBy[x] = worst;
      if (worst <= 0.15) {
        pick = x;
        break;
      }
    }
    H.slotGold = pick;
    rows.push('# PACE §2 자동 사냥 여러 파티 — 시뮬레이션', '');
    rows.push(`- 세이브: ${FILES.map((f) => path.basename(path.dirname(f)) + '/' + path.basename(f)).join(' · ')} (실세이브 · 로컬 전용)`);
    rows.push('- 방법: 세이브를 불러와 모두 집에 있다고 보고, 같은 난수열로 「켜 둔 n판(30초마다 칸 전부 한 판) + 꺼 둔 16시간 방치」를 돌린다. GOLDSINK 하루 판 수 비율(taper)은 칸 전체가 같이 센다. 방치 금화 상한은 없다고 봄(최악).');
    rows.push('- **지금(기준)** = 1칸으로 낼 수 있는 더 큰 쪽: 세이브의 맡겨 둔 사냥 그대로 / 가장 센 파티로 맡길 수 있는 가장 높은 곳.');
    rows.push('- 3칸 = 0번 칸 다음으로 남은 손님 중 센 순서로 4명씩 2칸 더:');
    rows.push('  - **최악(금화)**: 세 칸 모두 그 파티가 맡길 수 있는 가장 높은 곳 (같은 스테이지 중복 OK) — 배수는 이걸로 고른다');
    rows.push('  - **고루(재료용)**: 0번 칸은 세이브 그대로, 2·3칸은 다른 지역 중 맡길 수 있는 가장 높은 곳');
    rows.push('', `## 2·3칸 금화 배수 고르기 (기준: 최악 3칸의 하루 사냥 금화가 지금보다 +15% 이내)`, '', '| 배수 | 최악 증가 |', '|---|---|');
    for (const x of Object.keys(worstBy).map(Number).sort((a, b) => b - a)) rows.push(`| ×${x} | ${(worstBy[x] * 100).toFixed(1)}% |`);
    rows.push('', `→ **slotGold = ${pick}**${pick !== gold0 ? ` (명세 0.4에서 낮춤 — CONFIG.hunt.slotGold)` : ' (명세 그대로)'}`, '');
    for (const p of PATS) {
      rows.push(`## ${p.name} · slotGold ${pick}`, '', '| 세이브 | 칸 (고루) | 지금 사냥 금화 (기준) | 3칸 최악 | 3칸 고루 | 하루 전체 금화(의뢰·여관 포함) 최악 | 지역 재료 지금 → 고루 |', '|---|---|---|---|---|---|---|');
      for (const f of FILES) {
        const b = ref(`${f}|${p.ticks}`);
        const b0 = base[`${f}|${p.ticks}`];
        const d = day(f, 'top3', p.ticks);
        const s = day(f, 'spread', p.ticks);
        const tot = (x: typeof b) => x.hunt + x.other;
        rows.push(
          `| ${path.basename(path.dirname(f))}/${path.basename(f, '.json')} | ${s.slots.join(' · ')} | ${fmt(b.hunt)}${b === b0 ? '' : ' (가장 높은 곳)'} | ${fmt(d.hunt)} (${pct(d.hunt, b.hunt)}) | ${fmt(s.hunt)} (${pct(s.hunt, b.hunt)}) | ${pct(tot(d), tot(b))} | ${fmt(b0.matsN)} (${Object.keys(b0.mats).length}지역) → ${fmt(s.matsN)} (${Object.keys(s.mats).length}지역) **×${(s.matsN / Math.max(1, b0.matsN)).toFixed(2)}** · ${Object.entries(s.mats)
            .map(([r, n]) => `${r} ${fmt(n)}`)
            .join(', ')} |`,
        );
        expect(d.hunt).toBeGreaterThan(0);
      }
      rows.push('');
    }
    rows.push('- 재료는 판마다 같은 양(지역 배수 없음)이라 3칸이면 지역 재료가 거의 3배 — 새 지역 2곳이 맡겨 두기로 들어온다. 장비 확률·경험치는 칸마다 그대로.');
    rows.push('- 금화: 2·3칸 배수 + 하루 판 수 비율(taper)을 칸 전체가 같이 쓰기 때문에, 0번 칸도 비율이 빨리 내려간다 → 3칸 금화 증가가 작다.');
    rows.push('- **판정 필요(형철)**: 실제형 하루(켜 둔 128판)에서는 3칸이 오히려 사냥 금화 −5~−13%다. 하루 판 수(taper 120/300판)를 세 칸이 같이 빨리 채워서 0번 칸 금화 비율이 일찍 0.5·0.25로 내려가기 때문. 「1칸은 지금 그대로」를 글자 그대로 지키려면 2·3칸은 taper 판 수를 세지 않게(비율만 읽게) 바꿀 수 있다 — 그러면 같은 +15% 기준에서 slotGold ≈ 0.07이 된다. 지금 코드는 「autoGoldMult 위에 곱」(같이 센다) + 0.2.');
    rows.push('- 방치 금화 상한(다음 목표 비용 × capShare)은 칸 전체 하나라 실제로는 위 방치 금화보다 작거나 같다.');
    expect(worstBy[pick]).toBeLessThanOrEqual(0.15 + 1e-9);
    // CONFIG 값이 시뮬레이션이 고른 값과 같아야 한다 (바꾸면 다시 돌려 표를 갱신)
    expect(SLOT_GOLD).toBe(pick);
    console.log(rows.join('\n'));
  }, 600_000);
});
