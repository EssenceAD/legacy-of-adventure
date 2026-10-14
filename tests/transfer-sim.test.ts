// 웅스 건의 「강화 전수」 금화 시뮬레이션 (실세이브 · 로컬 전용) → reports/pace/transfer.md
//  TF_SAVES="dirA;dirB" npx vitest run tests/transfer-sim.test.ts  (세이브 폴더 없으면 건너뜀 · 실세이브는 커밋하지 않는다)
//  세이브마다: 가장 높은 강화 장비(주는 쪽) → 같은 부위 한 등급 위 새 장비 +0(받는 쪽 · 가방에 더 좋은 실물이 있으면 그것)
//   유물 규칙(유물은 유물에게서만): 주는 쪽이 유물이 아니면 받는 쪽 후보에서 유물을 뺀다 (전설 → 전설 새 장비)
//  전수 비용(금화·가루·부적) · 같은 단계를 직접 올릴 때 기댓값(100%) · 지금 가진 것으로 되나
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GRADES, type Grade } from '../src/data/items';
import { transferPlan } from '../src/world/enhTransfer';
import { makeItem } from '../src/world/items';
import { P, S, type Item } from '../src/world/state';
import { expectedBuild } from './transfer-table';
import { loadReal } from './wf-real';

const DIRS = (process.env.TF_SAVES ?? '').split(';').filter((d) => d && fs.existsSync(d));
const FILES = DIRS.flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => path.join(d, f)));
const f0 = (n: number) => Math.round(n).toLocaleString('en-US');

describe.skipIf(!FILES.length)('강화 전수 금화 (실세이브)', () => {
  it('주마다 가장 좋은 장비 한 번 전수', () => {
    const rows: string[] = [];
    for (const f of FILES) {
      loadReal(f);
      if (!P.bag.length) continue;
      const gold = S.gold;
      const best = [...P.bag].sort((a, b) => b.enh - a.enh || GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade))[0];
      // 받는 쪽: 가방의 같은 부위 · 더 높은 등급 중 가장 낮은 단계 / 없으면 한 등급 위 새 장비 +0
      const gi = GRADES.indexOf(best.grade);
      let recv: Item | undefined = P.bag.filter((x) => x !== best && x.slot === best.slot && GRADES.indexOf(x.grade) > gi && (x.grade !== 'a' || best.grade === 'a')).sort((a, b) => a.enh - b.enh)[0];
      let real = true;
      if (!recv) {
        real = false;
        const up = GRADES[Math.min(GRADES.length - 1, gi + 1)] as Grade;
        recv = makeItem(best.region, up === 'a' && best.grade !== 'a' ? best.grade : up, best.slot, false);
        recv.enh = 0;
        P.bag.push(recv);
      }
      const p = transferPlan(best, recv);
      const ex = expectedBuild(Math.max(0, p.to));
      const can = S.gold >= p.cost.gold && (P.dust[recv.grade] ?? 0) >= p.cost.dust && P.growth.charm >= p.cost.charm;
      rows.push(
        `| ${path.basename(path.dirname(f))}/${path.basename(f, '.json')} | ${best.grade} +${best.enh} (${best.slot}) | ${recv.grade} +${recv.enh}${real ? '' : ' (새 장비)'} | +${p.to} | ${f0(p.cost.gold)} | ${f0(p.cost.dust)} | ${p.cost.charm} | ${f0(ex.gold)} · ${f0(ex.dust)} | ${f0(gold)} · ${f0(P.dust[recv.grade] ?? 0)} · 부적 ${P.growth.charm} | ${can ? '됨' : '모자람'} | ${p.why || '-'} |`,
      );
    }
    console.log(['| 세이브 | 주는 장비 | 받는 장비 | 결과 | 금화 | 가루 | 부적 | 직접 올리기 기댓값 (금화 · 가루) | 가진 것 (금화 · 그 등급 가루) | 지금 되나 | 막힌 이유 |', '|---|---|---|---|---|---|---|---|---|---|---|', ...rows].join('\n'));
    expect(rows.length).toBeGreaterThan(0);
  });
});
