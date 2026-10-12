// 어울림: 24조합 판정 · 2칸 범위 · 세트 중복 규칙
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { def, type Kind } from '../src/data/catalog';
import { HARMONIES } from '../src/data/harmony';
import { computeSets, gap } from '../src/world/harmony';
import type { Building } from '../src/world/state';

const B = (kind: Kind, tx: number, ty: number): Building => {
  const [fw, fh] = def(kind).size;
  return { kind, tx, ty, fw, fh, sprite: null, lvl: 1, hue: null, inside: [] } as unknown as Building;
};
/** 어울림 부품의 첫 종류 (트로피·현판은 아무거나) */
const kindOf = (k: Kind[] | 'trophy' | 'plaque'): Kind => (k === 'trophy' ? ('trophy_boar' as Kind) : k === 'plaque' ? ('plaque_bronze' as Kind) : k[0]);

describe('어울림', () => {
  it('TOWN T4: 44조합 + STORY 「꽃길」 = 45', () => expect(HARMONIES.length).toBe(45));
  it('범위는 2칸 · 한 건물은 최대 3세트', () => {
    expect(CONFIG.harmony.range).toBe(2);
    expect(CONFIG.harmony.perBuilding).toBe(3);
  });
  for (const h of HARMONIES) {
    it(`${h.id}. ${h.name}: 붙여 놓으면 성립`, () => {
      // 앵커를 가운데 두고 나머지를 오른쪽으로 이어 붙인다 (모두 앵커에서 2칸 이내)
      const objs: Building[] = [];
      const [first, ...rest] = h.parts;
      const a = B(kindOf(first.k), 20, 20);
      objs.push(a);
      // TOWN T4: 줄 어울림은 가로 한 줄로 · 여러 채(첫 자리 n)는 앵커 오른쪽으로 이어서
      for (let j = 1; j < (first.n ?? 1); j++) objs.push(B(kindOf(first.k), a.tx + (a.fw + 1) * j, a.ty));
      let i = 0;
      for (const p of rest)
        for (let n = 0; n < (p.n ?? 1); n++, i++) {
          const k = kindOf(p.k);
          const [fw, fh] = def(k).size;
          // 앵커 둘레에 돌아가며 (위·오른쪽·아래·왼쪽)
          const side = i % 4;
          const pos = side === 0 ? [a.tx, a.ty - fh] : side === 1 ? [a.tx + a.fw, a.ty] : side === 2 ? [a.tx, a.ty + a.fh] : [a.tx - fw, a.ty];
          objs.push(B(k, pos[0] + (i >= 4 ? 1 : 0), pos[1]));
        }
      expect(computeSets(objs).some((s) => s.id === h.id)).toBe(true);
    });
  }
  it('TOWN T4: 줄 어울림은 한 줄이어야 (어긋나면 안 됨)', () => {
    const row = [0, 2, 4, 6, 8].map((x) => B('lamppost', 10 + x, 10));
    expect(computeSets(row).some((s) => s.id === 25)).toBe(true);
    const bent = [0, 2, 4, 6].map((x) => B('lamppost', 10 + x, 10)).concat(B('lamppost', 18, 12));
    expect(computeSets(bent).some((s) => s.id === 25)).toBe(false);
    const gapped = [0, 2, 4, 10, 12].map((x) => B('lamppost', 10 + x, 10));
    expect(computeSets(gapped).some((s) => s.id === 25)).toBe(false);
  });
  it('2칸 떨어지면 성립 · 3칸이면 안 됨', () => {
    const inn = B('inn', 10, 10);
    const near = B('statue', 10 + inn.fw + 2, 10);
    const far = B('statue', 10 + inn.fw + 3, 10);
    expect(gap(inn, near)).toBe(2);
    expect(computeSets([inn, near]).some((s) => s.id === 5)).toBe(true);
    expect(computeSets([inn, far]).some((s) => s.id === 5)).toBe(false);
  });
  it('공사 중인 건물은 빼고 센다', () => {
    const t = B('tavern', 10, 10);
    const f = { ...B('fire', 13, 10), build: 5 } as Building;
    expect(computeSets([t, f]).some((s) => s.id === 1)).toBe(false);
  });
  it('같은 어울림은 같은 건물로 두 번 세지 않고, 한 건물은 3세트까지', () => {
    const t = B('tavern', 10, 10);
    const f1 = B('fire', 10 + t.fw, 10);
    const sets = computeSets([t, f1, B('fire', 10, 10 + t.fh)]);
    // 주점 하나 → 흥겨운 밤 한 번만
    expect(sets.filter((s) => s.id === 1).length).toBe(1);
    // 한 건물이 들어간 세트 수 ≤ 3
    const all = [t, f1];
    for (const o of all) expect(sets.filter((s) => s.members.includes(o)).length).toBeLessThanOrEqual(3);
  });
});
