// 핫픽스 11 §11: 건물 그리기 순서 — 옆에 붙인 작은 건물이 큰 건물에 먹히지 않게 (발판 기준 위상 정렬)
import { describe, expect, it } from 'vitest';
import { depthBuilding } from '../src/engine/iso';
import { orderThings } from '../src/world/render';

type T = { id: string; d: number; tx: number; ty: number; fw: number; fh: number };
const mk = (id: string, tx: number, ty: number, fw: number, fh: number): T => ({ id, d: depthBuilding(tx, ty, fw, fh), tx, ty, fw, fh });
// 그림이 겹친다고 치고 (모든 쌍을 비교)
const BIG = { l: 0, r: 100, t: 0, b: 100 };
const order = (list: T[]) => orderThings(list, () => BIG).map((t) => t.id);

describe('3×3 건물 둘레 8곳의 1×1', () => {
  // 훈련장 (5,5) 3×3 → x 5..7, y 5..7 · x·y가 클수록 화면 앞
  const big = () => mk('big', 5, 5, 3, 3);
  const cases: [string, number, number, 'small-first' | 'big-first' | 'depth'][] = [
    ['오른쪽 옆 (x+)', 8, 6, 'big-first'], // 형철 배치: 과녁이 훈련장 오른쪽 옆 → 과녁이 나중(앞)
    ['오른쪽 옆 뒷줄', 8, 5, 'big-first'],
    ['오른쪽 옆 앞줄', 8, 7, 'big-first'],
    ['앞 (y+)', 6, 8, 'big-first'],
    ['왼쪽 옆 (x-)', 4, 6, 'small-first'],
    ['뒤 (y-)', 6, 4, 'small-first'],
    ['앞 모서리 (x+ y+)', 8, 8, 'big-first'],
    ['뒤 모서리 (x- y-)', 4, 4, 'small-first'],
    ['오른쪽-뒤 대각선', 8, 4, 'depth'],
    ['왼쪽-앞 대각선', 4, 8, 'depth'],
  ];
  for (const [nm, x, y, want] of cases)
    it(nm, () => {
      const small = mk('small', x, y, 1, 1);
      const o = order([small, big()]);
      if (want === 'big-first') expect(o).toEqual(['big', 'small']);
      else if (want === 'small-first') expect(o).toEqual(['small', 'big']);
      else expect(o).toEqual([small, big()].sort((p, q) => p.d - q.d).map((t) => t.id));
    });

  it('예전 숫자 정렬은 오른쪽 옆을 틀리게 놓았다 (회귀 확인)', () => {
    // 오른쪽 옆 뒷줄 (형철 스크린샷 자리): 예전 깊이값 tx+ty+3.5 < 훈련장 tx+ty+4.5
    const small = mk('small', 8, 5, 1, 1);
    expect(small.d).toBeLessThan(big().d); // 숫자로는 과녁이 먼저(뒤) → 훈련장이 덮었다
    expect(order([small, big()])).toEqual(['big', 'small']);
  });
});

describe('4×4 여관 옆 2×2 별채', () => {
  const inn = () => mk('inn', 4, 4, 4, 4);
  it('오른쪽 옆 별채는 여관 뒤에 그린다', () => expect(order([mk('cot', 8, 5, 2, 2), inn()])).toEqual(['inn', 'cot']));
  it('앞 별채는 여관 뒤에 그린다', () => expect(order([mk('cot', 5, 8, 2, 2), inn()])).toEqual(['inn', 'cot']));
  it('왼쪽·뒤 별채는 여관보다 먼저', () => {
    expect(order([inn(), mk('cot', 2, 5, 2, 2)])).toEqual(['cot', 'inn']);
    expect(order([inn(), mk('cot', 5, 2, 2, 2)])).toEqual(['cot', 'inn']);
  });
  it('겹치지 않는 것끼리는 깊이값 순서 그대로', () => {
    const far = orderThings([mk('a', 0, 0, 1, 1), mk('b', 10, 10, 1, 1)], (t) => ({ l: t.tx * 100, r: t.tx * 100 + 10, t: 0, b: 10 })).map((t) => t.id);
    expect(far).toEqual(['a', 'b']);
  });
});
