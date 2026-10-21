// EX_SALVAGE_1021 (이카몰리 사고): 전용 무기는 일괄·자동 분해에 안 들어감 · 받으면 🔒 · 한 개 분해는 조각 10 · 잃은 사람 조각 환불(한 번)
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { bulkExSkipped, bulkTargets, salvage, salvageOne } from '../src/world/craft';
import { exRefundLost, grantEx, makeEx } from '../src/world/exWeapons';
import { setFlag } from '../src/world/flags';
import { rwState } from '../src/world/frags';
import { offerItem } from '../src/world/legends';
import { P, resetProgress, S, world } from '../src/world/state';

const PER = CONFIG.raidWeapon.frag.perBox;
beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div>';
  world.actors = [];
  S.visiting = null as never;
  setFlag('exWeapons', true);
});
afterEach(() => setFlag('exWeapons', false));

describe('전용 무기 분해 막기', () => {
  it('받으면 🔒 · 잠금을 풀어도 일괄 분해(유물 포함 · 강화 포함 · 최고 남기기 끔)에 안 들어감', () => {
    const ex = grantEx('woongs', () => 0.5)!;
    expect(ex.locked).toBe(true);
    ex.locked = false;
    expect(bulkTargets(['n', 'r', 'e', 'l', 'a'], { upgraded: true, keepBest: false })).not.toContain(ex);
    expect(bulkExSkipped()).toBe(1);
  });
  it('한 개 분해: 조각 10 돌려받음 · 전수(salvage 직접)는 조각 없음', () => {
    const a = makeEx('woongs', () => 0.5)!;
    const b = makeEx('woongs', () => 0.5)!;
    a.locked = b.locked = false;
    P.bag.push(a, b);
    const f0 = rwState().frags;
    expect(salvageOne(a)).toBeGreaterThan(0);
    expect(rwState().frags).toBe(f0 + PER);
    salvage(b);
    expect(rwState().frags).toBe(f0 + PER);
  });
  it('스칼렛에게 바치기도 막힘', () => {
    const ex = makeEx('woongs', () => 0.5)!;
    P.bag.push(ex);
    expect(offerItem(ex.id)).toMatch(/전용 무기/);
    expect(P.bag).toContain(ex);
  });
});

describe('잃은 전용 무기 조각 환불', () => {
  it('받은 수 − 가진 수만큼 한 번 · 편지로 조각', () => {
    grantEx('woongs', () => 0.5);
    const lostOne = grantEx('woongs', () => 0.5)!;
    P.bag.splice(P.bag.indexOf(lostOne), 1); // 예전 일괄 분해로 사라짐
    const mails = P.meta.mail.length;
    expect(exRefundLost()).toBe(1);
    expect(P.meta.mail.length).toBe(mails + 1);
    expect(P.meta.mail[0]).toMatchObject({ title: '전용 무기 조각 환불', reward: { frags: PER } });
    expect(rwState().refunded.woongs).toBe(1);
    expect(exRefundLost()).toBe(0);
  });
  it('다 가지고 있으면 아무것도 안 함', () => {
    grantEx('woongs', () => 0.5);
    expect(exRefundLost()).toBe(0);
  });
});
