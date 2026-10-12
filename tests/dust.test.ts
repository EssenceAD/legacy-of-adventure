// HOTFIX21: 잿빛 가루 수급 — 희귀 이상 분해 때 잿빛도 · 가루 바꾸기(반대 방향 없음) · 모자란 만큼 채우기 · 일괄 분해 합계
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeItem } from '../src/world/items';
import { bulkPreview, fillAsh, salvage, salvageBulk, salvageText, swapDust } from '../src/world/craft';
import { P, resetProgress } from '../src/world/state';

const SM = CONFIG.smith;
beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div>';
});
const put = (g: 'n' | 'r' | 'e' | 'l' | 'a') => {
  const it = makeItem('abyss', g);
  P.bag.push(it);
  return it;
};

describe('분해', () => {
  it('희귀 +10 · 영웅 +20 · 전설 +40 · 유물 +60 잿빛 (일반은 그대로)', () => {
    for (const [g, ash] of [['n', 0], ['r', 10], ['e', 20], ['l', 40], ['a', 60]] as const) {
      resetProgress();
      salvage(put(g));
      expect(P.dust[g]).toBe(SM.salvage[g] + (g === 'n' ? 0 : 0));
      expect(P.dust.n).toBe(g === 'n' ? SM.salvage.n : ash);
    }
    expect(salvageText('r')).toBe(`푸른 가루 +${SM.salvage.r} · 잿빛 가루 +10`);
    expect(salvageText('n')).toBe(`잿빛 가루 +${SM.salvage.n}`);
  });
  it('일괄 분해: 미리보기·결과에 잿빛 합계', () => {
    put('r');
    put('e');
    P.salvage.keepBest = false;
    const pv = bulkPreview(['r', 'e'], { keepBest: false, upgraded: true });
    expect(pv.r.ash).toBe(10);
    expect(pv.e.ash).toBe(20);
    const r = salvageBulk(['r', 'e'], { keepBest: false, upgraded: true });
    expect(r.dust.n).toBe(30);
    expect(P.dust.n).toBe(30);
  });
});

describe('가루 바꾸기', () => {
  it('푸른 1 → 잿빛 5 · 보랏빛 1 → 12 · 황금 1 → 30 · 가진 것만큼만 · 잿빛/별빛은 못 바꿈', () => {
    P.dust.r = 3;
    P.dust.e = 1;
    P.dust.l = 1;
    expect(swapDust('r', 10)).toBe(15);
    expect(P.dust.r).toBe(0);
    expect(swapDust('e', 1)).toBe(12);
    expect(swapDust('l', 1)).toBe(30);
    expect(P.dust.n).toBe(57);
    P.dust.a = 5;
    expect(swapDust('a', 1)).toBe(0);
    expect(swapDust('n', 1)).toBe(0);
  });
  it('채우기: 푸른 → 보랏빛 → 황금 순으로 모자란 만큼만', () => {
    P.dust.r = 2;
    P.dust.e = 10;
    expect(fillAsh(30)).toBe(10 + 24);
    expect(P.dust.r).toBe(0);
    expect(P.dust.e).toBe(8);
  });
});
