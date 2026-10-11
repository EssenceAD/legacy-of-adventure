// HOTFIX14 §2: 등급별 일괄 분해 — 일반만이면 예전 버튼과 같음 · 끼운·잠금은 늘 빠짐 · 강화·세트는 포함 체크 때만 · 부위별 최고 1개 남김 · 자동 분해 등급
import { beforeEach, describe, expect, it } from 'vitest';
import { REGIONS, SLOTS } from '../src/data/items';
import { CONFIG } from '../src/data/config';
import { bulkPreview, salvageAllCommon, salvageBulk } from '../src/world/craft';
import { addToBag, makeItem } from '../src/world/items';
import { P } from '../src/world/state';

const mk = (grade: 'n' | 'r' | 'e' | 'l', slot = SLOTS[0], extra: Record<string, unknown> = {}) => Object.assign(makeItem(REGIONS[0].id, grade, slot, false), extra);
beforeEach(() => {
  P.bag = [];
  P.dust = { n: 0, r: 0, e: 0, l: 0, a: 0 };
  P.salvage = { grades: ['n'], upgraded: false, keepBest: true, auto: '' };
  P.autoSalvage = false;
});

describe('일괄 분해', () => {
  it('「일반만 · 강화·세트 포함 · 남기기 없음」 = 예전 「안 끼운 일반 장비 모두 분해」', () => {
    P.bag = [mk('n'), mk('n', SLOTS[1], { enh: 2 }), mk('n', SLOTS[2], { set: true }), mk('n', SLOTS[0], { owner: 1 }), mk('n', SLOTS[0], { locked: true }), mk('r')];
    const r = salvageAllCommon();
    expect(r.count).toBe(3);
    expect(r.dust).toBe(3 * CONFIG.smith.salvage.n);
    expect(P.bag.length).toBe(3);
  });
  it('끼운 것·잠금은 늘 빠짐 · 강화·세트는 기본 빠짐', () => {
    P.bag = [mk('r'), mk('r', SLOTS[0], { owner: 2 }), mk('r', SLOTS[0], { locked: true }), mk('r', SLOTS[0], { enh: 1 }), mk('r', SLOTS[0], { set: true })];
    const r = salvageBulk(['r'], { keepBest: false });
    expect(r.count).toBe(1);
    expect(r.dust.r).toBe(CONFIG.smith.salvage.r);
  });
  it('부위별 최고 장비 1개는 남김 (자동 장착 후보가 사라지지 않게)', () => {
    P.bag = SLOTS.flatMap((s) => [mk('n', s), mk('n', s), mk('e', s)]);
    salvageBulk(['n', 'e'], { keepBest: true });
    expect(P.bag.length).toBe(3);
    expect(new Set(P.bag.map((x) => x.slot)).size).toBe(3);
  });
  it('미리 보기 = 실제 분해 (개수·가루)', () => {
    P.bag = [mk('n'), mk('n', SLOTS[1]), mk('r', SLOTS[2]), mk('l', SLOTS[0])];
    const pv = bulkPreview(['n', 'r', 'l'], { keepBest: false });
    const r = salvageBulk(['n', 'r', 'l'], { keepBest: false });
    expect(r.count).toBe(pv.n.n + pv.r.n + pv.l.n);
    expect(r.dust.l).toBe(pv.l.dust);
  });
});

describe('자동 분해 등급', () => {
  const fill = () => {
    while (P.bag.filter((x) => !x.owner).length < 200) P.bag.push(mk('e'));
  };
  it('희귀 이하: 가방이 차면 희귀도 가루로 · 영웅은 남김', () => {
    fill();
    P.salvage.auto = 'r';
    expect(addToBag(mk('r'))).toBe('salvaged');
    expect(addToBag(mk('e'))).toBe('full');
  });
  it('옛 저장 「켬」 = 일반만', () => {
    fill();
    P.autoSalvage = true;
    expect(addToBag(mk('n'))).toBe('salvaged');
    expect(addToBag(mk('r'))).toBe('full');
  });
});
