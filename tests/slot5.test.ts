// 핫픽스 12 §3: 원정 5번째 자리 — 폐광 의뢰 3번 성공 또는 폐광 사냥 1-10 → 열림 · 접속 때 열리면 모모 편지 · 5명 파티 계산이 깨지지 않음
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer } from '../src/world/adventurers';
import { makeQuest, partyInfo, partyMax, sendParty } from '../src/world/expeditions';
import { checkSlot5 } from '../src/world/meta';
import { P, S, uiHooks, world, type Actor } from '../src/world/state';

const reg = (): Actor => Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { hp: 100, mood: 80, food: 80 });
let talked = 0;
beforeEach(() => {
  S.visiting = false as never;
  world.home = null as never;
  world.actors = [];
  P.meta.slot5 = false;
  P.meta.slot5Seen = false;
  P.meta.mail = [];
  P.counters.regionWins = {} as never;
  P.hunt.best = {};
  P.runs = [];
  talked = 0;
  uiHooks.talk = (() => talked++) as never;
});

describe('원정 5번째 자리', () => {
  it('처음엔 4명 · 조건 전엔 안 열림', () => {
    expect(partyMax()).toBe(CONFIG.expedition.partyMax);
    (P.counters.regionWins as Record<string, number>).mine = 2;
    P.hunt.best.mine = 9;
    expect(checkSlot5()).toBe(false);
    expect(partyMax()).toBe(4);
  });
  it('폐광 의뢰 3번 성공 → 열림 · 모모가 바로 말함', () => {
    (P.counters.regionWins as Record<string, number>).mine = 3;
    expect(checkSlot5()).toBe(true);
    expect(partyMax()).toBe(5);
    expect(talked).toBe(1);
    expect(checkSlot5()).toBe(false);
  });
  it('폐광 사냥 1-10 돌파로도 열림', () => {
    P.hunt.best.mine = CONFIG.hunt.stages;
    expect(checkSlot5()).toBe(true);
  });
  it('이미 폐광까지 간 저장: 접속 때 열고 모모 편지', () => {
    (P.counters.regionWins as Record<string, number>).mine = 7;
    expect(checkSlot5(true)).toBe(true);
    expect(P.meta.mail[0].title).toMatch(/원정 자리 하나 더/);
    expect(talked).toBe(0);
  });
  it('5명 파티: 보낼 수 있고 시간·성공률 계산이 정상 (평균은 인원수로 나눔)', () => {
    P.meta.slot5 = true;
    const ms = [reg(), reg(), reg(), reg(), reg()];
    world.actors = ms;
    const q = makeQuest('forest', 0);
    const i4 = partyInfo(ms.slice(0, 4), q);
    const i5 = partyInfo(ms, q);
    expect(i5.power).toBeGreaterThan(i4.power);
    expect(i5.minutes).toBeGreaterThan(0);
    expect(i5.minutes).toBeLessThanOrEqual(q.minutes);
    expect(i5.success).toBeGreaterThanOrEqual(i4.success);
    const r = sendParty(q, ms);
    expect(typeof r).not.toBe('string');
  });
  it('안 열렸으면 5명은 거절', () => {
    const ms = [reg(), reg(), reg(), reg(), reg()];
    world.actors = ms;
    expect(sendParty(makeQuest('forest', 0), ms)).toMatch(/명이에요/);
  });
});
