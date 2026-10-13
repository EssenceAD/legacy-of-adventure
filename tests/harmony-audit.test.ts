// K10 점검: 실제 저장(로컬 전용)에서 어울림마다 「성립 / 1개 모자람(무엇·왜)」 → reports/checkin/harmony.md
//  AUDIT=1 npx vitest run tests/harmony-audit.test.ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { def, type Kind } from '../src/data/catalog';
import { HARMONIES, type HarmonyDef, type HarmonyPart } from '../src/data/harmony';
import { migrate } from '../src/save/save';
import { computeSets, gap } from '../src/world/harmony';
import { P, resetProgress, S, world, type Building } from '../src/world/state';
import { placeLayout } from '../src/world/town';
import { setFlag } from '../src/world/flags';

const SAVES: [string, string][] = [
  ['고느끼 · 꾸무적 여관', 'tests/fixtures/real_gonu_harm.json'],
  ['형철 · 로또1등 여관', 'tests/fixtures/real_hyeongcheol.json'],
];
const H = CONFIG.harmony;
const matches = (p: HarmonyPart, o: Building) => (p.k === 'trophy' ? o.kind.startsWith('trophy_') : p.k === 'plaque' ? o.kind.startsWith('plaque_') : p.k.includes(o.kind));
const pname = (p: HarmonyPart) => (p.k === 'trophy' ? '트로피' : p.k === 'plaque' ? '평가 현판' : p.k.map((k) => def(k as Kind).name).join('/'));

function load(file: string) {
  const d = migrate(JSON.parse(fs.readFileSync(file, 'utf8')));
  resetProgress(d.progress);
  S.visiting = null as never;
  S.land = d.land;
  const r = placeLayout(d.buildings.map((b: { kind: Kind; tx: number; ty: number; lvl: number; hue?: number; flip?: boolean; fromProp?: boolean }) => ({ kind: b.kind, tx: b.tx, ty: b.ty, lvl: b.lvl ?? 1, hue: b.hue ?? null, flip: !!b.flip, extra: b.fromProp ? { fromProp: true } : {} })), d.land);
  return { innName: d.innName as string, moved: r.moved, dropped: r.dropped };
}
/** 이 어울림만, 3개 제한 n으로 계산 */
function alone(h: HarmonyDef, cap: number): boolean {
  const keep = HARMONIES.splice(0, HARMONIES.length, h);
  const pb = H.perBuilding;
  H.perBuilding = cap;
  try {
    return computeSets(world.objs).some((s) => s.id === h.id);
  } finally {
    H.perBuilding = pb;
    HARMONIES.splice(0, HARMONIES.length, ...keep);
  }
}
/** 혼자서도 안 되는 이유 (없는 물건 · 거리 · 줄) */
function why(h: HarmonyDef): string {
  const live = world.objs.filter((o) => o.build === undefined);
  const short = h.parts.map((p) => ({ p, have: live.filter((o) => matches(p, o)).length, need: p.n ?? 1 })).filter((x) => x.have < x.need);
  if (short.length) return '없음: ' + short.map((x) => `${pname(x.p)} ${x.have}/${x.need}`).join(' · ');
  const R = h.range ?? H.range;
  if (h.shape === 'line') {
    const p = h.parts[0];
    const ms = live.filter((o) => matches(p, o));
    let best = 1;
    for (const a of ms)
      for (const dx of [1, 0]) {
        let cur = a, n = 1;
        for (;;) {
          const nx = ms.filter((o) => (dx ? o.ty === cur.ty && o.tx > cur.tx && o.tx - (cur.tx + cur.fw) <= R : o.tx === cur.tx && o.ty > cur.ty && o.ty - (cur.ty + cur.fh) <= R)).sort((x, y) => (dx ? x.tx - y.tx : x.ty - y.ty))[0];
          if (!nx) break;
          n++;
          cur = nx;
        }
        best = Math.max(best, n);
      }
    return `줄: 같은 가로/세로 줄로 사이 ${R}칸 이하 ${p.n}개 필요 — 가장 긴 줄 ${best}개`;
  }
  // 앵커(첫 자리)마다 나머지 자리의 가장 가까운 거리 → 가장 아까운 앵커
  const [first, ...rest0] = h.parts;
  const rest = (first.n ?? 1) > 1 ? [{ ...first, n: (first.n ?? 1) - 1 }, ...rest0] : rest0;
  let bestTxt = '', bestBad = Infinity;
  for (const a of live.filter((o) => matches(first, o))) {
    const parts = rest.map((p) => {
      const ds = live.filter((o) => o !== a && matches(p, o)).map((o) => gap(a, o)).sort((x, y) => x - y);
      const d = ds[(p.n ?? 1) - 1] ?? Infinity;
      return { p, d };
    });
    const bad = parts.filter((x) => x.d > R);
    const score = bad.reduce((s, x) => s + (x.d - R), 0);
    if (score < bestBad) {
      bestBad = score;
      bestTxt = `거리: 기준 ${def(a.kind).name}(${a.tx},${a.ty})에서 ` + bad.map((x) => `${pname(x.p)} ${x.d}칸`).join(' · ') + ` (${R}칸까지)`;
    }
  }
  return bestTxt || '?';
}

describe.skipIf(!SAVES.every(([, f]) => fs.existsSync(f)))('K10 어울림 점검 (실제 저장)', () => {
  it('표 만들기', () => {
    const out: string[] = ['# K10 어울림 점검 — 「성립 / 안 됨(무엇·왜)」', '', '**31번 시장 거리 원인 (한 줄)**: 시장 거리는 「술통 더미」 `barrel_stack`이 필요한데, 고느끼가 놓은 건 이름이 똑같이 「술통 더미」인 다른 장식 `barrels`(건설 120G)라서 안 됐어요 — 과일 수레·꽃 수레·간판 기둥·술통은 (16~17, 19~20)에 붙어 있어 거리는 문제없음. 같은 이름 짝이 하나 더: 「장미 아치」 `arbor`(장미 정원 6번) ↔ `rose_arch`(꽃길 45번). 새 규칙에선 같은 이름 장식을 같은 물건으로 봐요.', '', '**개수**: 데이터에 있는 어울림은 45개(id 1~45)예요 (명세의 47개 아님).', '', `어울림 ${HARMONIES.length}개 (데이터 기준 · id 1~45). 거리 = 발자국 가장자리 사이 빈칸. 기본 ${H.range}칸 · 한 물건 최대 ${H.perBuilding}개 어울림.`, ''];
    for (const [who, f] of SAVES) {
      const L = load(f);
      setFlag('harmonyV2', true);
      const v2 = new Set(computeSets(world.objs).map((s) => s.id));
      setFlag('harmonyV2', false);
      const sets = computeSets(world.objs);
      const formed = new Set(sets.map((s) => s.id));
      out.push(`## ${who} (건물·장식 ${world.objs.length}개 · 발견 ${P.harmony.found.length}개 · 배치 옮김 ${L.moved} · 뺌 ${L.dropped})`, '', '| # | 어울림 | 지금(v0.25.3) | 안 되는 이유 (지금 규칙) | 새 규칙(v0.25.4) |', '|---|---|---|---|---|');
      let ok = 0, blocked = 0;
      for (const h of HARMONIES) {
        if (formed.has(h.id)) {
          ok++;
          out.push(`| ${h.id} | ${h.name} | ✓ 성립 (${sets.filter((s) => s.id === h.id).length}세트)${P.harmony.found.includes(h.id) ? '' : ' · ⚠ 아직 미발견'} | | ${v2.has(h.id) ? '✓' : '✗'} |`);
          continue;
        }
        let r: string;
        if (alone(h, H.perBuilding)) {
          r = '**앞 어울림이 물건을 먼저 가져감** (혼자 계산하면 성립)';
          blocked++;
        } else if (alone(h, 99)) {
          r = '**한 물건 최대 3개 제한** (제한 없으면 성립)';
          blocked++;
        } else r = why(h);
        out.push(`| ${h.id} | ${h.name} | ✗${P.harmony.found.includes(h.id) ? ' (예전에 발견)' : ''} | ${r} | ${v2.has(h.id) ? '**✓ 성립**' : '✗'} |`);
      }
      out.push('', `지금 규칙: 성립 ${ok} · 규칙 탓에 막힘 ${blocked} · 나머지는 물건이 없거나 멀리 있음 → 새 규칙: 성립 ${v2.size}`, '');
      setFlag('harmonyV2', true);
    }
    if (process.env.AUDIT) {
      fs.mkdirSync('reports/checkin', { recursive: true });
      fs.writeFileSync('reports/checkin/harmony.md', out.join('\n') + '\n');
    }
    console.log(out.join('\n'));
    expect(out.length).toBeGreaterThan(10);
  });
});
