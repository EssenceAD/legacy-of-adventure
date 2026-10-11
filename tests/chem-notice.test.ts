// 핫픽스 12 §6: 케미 알림 다이어트 — 마을 만남은 대화창 없음 · 원정 뒤 3·5단계·처음 발견만 · 하루 3번 · 설정 끄기 · 5단계 칭호
import { beforeEach, describe, expect, it } from 'vitest';
import { CHEM_PAIRS } from '../src/data/chem';
import { pendingEvents, clearEvents } from '../src/world/events';
import { notifyChem, chemUnread, CHEM_TALKS_PER_DAY } from '../src/world/chemNews';
import type { BondGain } from '../src/world/chem';
import { titlesOwned } from '../src/world/meta';
import { setPref } from '../src/save/save';
import { P, uiHooks, type Actor } from '../src/world/state';

const pair = CHEM_PAIRS[0];
let id = 1;
const actor = () => ({ id: id++, name: 'n' + id }) as unknown as Actor;
const gain = (lv: number | null, discovered = false): BondGain => {
  const a = actor();
  const b = actor();
  P.bonds[`${a.id}-${b.id}`] = { pair: pair.id, xp: 0, lv: lv ?? 1 };
  return { pair, a, b, discovered, levelUp: lv };
};
beforeEach(() => {
  clearEvents();
  P.chemNews = { list: [], unread: 0, day: '', shown: 0 };
  P.chem5 = [];
  P.bonds = {};
  setPref('chemNotice', 'important');
  uiHooks.toast = () => {};
});

describe('케미 알림', () => {
  it('마을에서 단계가 올라도 대화창 없음 → 소식으로', () => {
    for (const lv of [2, 3, 4, 5]) expect(notifyChem(gain(lv), 'town')).toBe(false);
    expect(notifyChem(gain(null, true), 'town')).toBe(false);
    expect(pendingEvents()).toBe(0);
    expect(chemUnread()).toBe(5);
  });
  it('원정 뒤: 3·5단계·처음 발견만 대화창, 2·4단계는 소식', () => {
    expect(notifyChem(gain(2), 'party')).toBe(false);
    expect(notifyChem(gain(4), 'party')).toBe(false);
    expect(notifyChem(gain(3), 'party')).toBe(true);
    expect(notifyChem(gain(null, true), 'party')).toBe(true);
    expect(notifyChem(gain(5), 'party')).toBe(true);
    expect(pendingEvents()).toBe(3);
  });
  it(`하루 ${CHEM_TALKS_PER_DAY}번까지 · 나머지는 소식`, () => {
    let shown = 0;
    for (let i = 0; i < 6; i++) if (notifyChem(gain(3), 'party')) shown++;
    expect(shown).toBe(CHEM_TALKS_PER_DAY);
    expect(chemUnread()).toBe(6 - CHEM_TALKS_PER_DAY);
  });
  it('설정 끄기: 대화창 0', () => {
    setPref('chemNotice', 'off');
    expect(notifyChem(gain(5), 'party')).toBe(false);
    expect(notifyChem(gain(null, true), 'party')).toBe(false);
    expect(pendingEvents()).toBe(0);
  });
  it('설정 전부: 원정 2단계도 대화창', () => {
    setPref('chemNotice', 'all');
    expect(notifyChem(gain(2), 'party')).toBe(true);
  });
  it('5단계: 짝 전용 칭호 (손님이 떠나도 남음)', () => {
    notifyChem(gain(5), 'town');
    expect(P.chem5).toContain(pair.id);
    P.bonds = {};
    expect(titlesOwned().some((t) => t.t.includes(pair.name))).toBe(true);
  });
});
