// HARVEST §1·§2 + CHECKIN §D (T2): 날짜 칸 · 리본/호박/대왕 · 교환표 · 오늘의 장부 6중3·받기·주간 상자 · 연감 도장·따라잡기 ×2·30% 넘기기 · 저장 왕복
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { ALMANAC, ALMANAC_CELLS, DAYBOOK, HV, HV_SHOP } from '../src/data/harvest_cfg';
import { CATALOG } from '../src/data/catalog';
import { readSave } from '../src/save/save';
import { setFlag } from '../src/world/flags';
import { carryOf, cellsReached, claimCell, closeSeason } from '../src/world/almanac';
import { canRepick, claimCand, claimDayBox, claimWeekBox, dbState, pickCands, pickedIdx, weekReady } from '../src/world/daybook';
import {
  addRibbons, buyHv, expRibbons, finaleState, harvestFinaleDay, harvestOn, harvestShopOn, hvPhase, hvState, kingDue, launched, notePumpkins, noteKing, pumpkinRibbon, settleAuto, setHvNow,
} from '../src/world/harvest';
import { achStamp, addStamps, almanacOn, alState, dbCount, stampMult } from '../src/world/hvLite';
import { duskOf, isDusk, nightOverlay } from '../src/world/sunset';
import { layout } from '../src/world/harvestDraw';
import { P, resetProgress, S } from '../src/world/state';
import { titlesOwned } from '../src/world/meta';

const at = (s: string) => Date.parse(s);
const FROM = at('2026-10-22T20:00:00+09:00');
const DAY1 = at('2026-10-23T12:00:00+09:00');
const LAST = at('2026-11-03T12:00:00+09:00');

beforeEach(() => {
  resetProgress();
  for (const k of ['harvestFest', 'sunset', 'ledgerDaily', 'almanac', 'leftIcons'] as const) setFlag(k, true);
  setHvNow(DAY1);
  S.visiting = null;
  S.night = false;
});

describe('1-1 날짜 칸 (한국 시간 · 실제 시각)', () => {
  it('시작 전 / 수확제 / 교환소만 / 끝', () => {
    expect(hvPhase(FROM - 1)).toBe('before');
    expect(hvPhase(FROM)).toBe('on');
    expect(hvPhase(at('2026-11-05T23:59:59+09:00'))).toBe('on');
    expect(hvPhase(at('2026-11-06T00:00:00+09:00'))).toBe('shop');
    expect(hvPhase(at('2026-11-08T23:59:59+09:00'))).toBe('shop');
    expect(hvPhase(at('2026-11-09T00:00:00+09:00'))).toBe('after');
  });
  it('기간 함수 + 플래그: 끄면 기간 중에도 없음 · 노을/장부는 시작 뒤 계속', () => {
    expect(harvestOn(DAY1)).toBe(true);
    expect(harvestShopOn(at('2026-11-07T12:00:00+09:00'))).toBe(true);
    expect(harvestOn(at('2026-11-07T12:00:00+09:00'))).toBe(false);
    expect(launched(FROM - 1)).toBe(false);
    expect(launched(at('2027-01-01T00:00:00+09:00'))).toBe(true);
    setFlag('harvestFest', false);
    expect(harvestOn(DAY1)).toBe(false);
    expect(harvestShopOn(DAY1)).toBe(false);
  });
  it('마지막 날 = 11/5 한국 시간 (UTC와 다르게)', () => {
    expect(harvestFinaleDay(at('2026-11-05T00:00:00+09:00'))).toBe(true);
    expect(harvestFinaleDay(at('2026-11-04T23:59:59+09:00'))).toBe(false);
    expect(harvestFinaleDay(at('2026-11-05T23:00:00+09:00'))).toBe(true);
  });
});

describe('1-4 호박 도깨비 · 대왕 · 리본', () => {
  it('지역 1~5는 1개 · 6~10은 2개', () => {
    expect(pumpkinRibbon('forest')).toBe(1);
    expect(pumpkinRibbon('abyss')).toBe(1);
    expect(pumpkinRibbon('coast')).toBe(2);
    expect(pumpkinRibbon('deep')).toBe(2);
    expect(notePumpkins(3, 'coast')).toBe(6);
    expect(hvState().pumpkins).toBe(3);
  });
  it('누적 15마리마다 대왕 한 번 · 쓰러뜨리면 리본 10', () => {
    notePumpkins(14, 'forest');
    expect(kingDue()).toBe(false);
    notePumpkins(1, 'forest');
    expect(kingDue()).toBe(true);
    const r = hvState().ribbons;
    expect(noteKing()).toBe(HV.ribbonKing);
    expect(hvState().ribbons).toBe(r + 10);
    expect(kingDue()).toBe(false);
    notePumpkins(15, 'forest');
    expect(kingDue()).toBe(true);
  });
  it('맡겨 둔 사냥: 판마다 확률 · 대왕 차례면 같이 (x-10은 미룸)', () => {
    expect(settleAuto('forest', 3, () => 0).pumpkins).toBe(1);
    expect(settleAuto('forest', 3, () => 0.99).pumpkins).toBe(0);
    hvState().pumpkins = 15;
    expect(settleAuto('forest', 10, () => 0.99).king).toBe(false);
    expect(settleAuto('forest', 9, () => 0.99).king).toBe(true);
    setHvNow(at('2026-11-07T12:00:00+09:00'));
    expect(settleAuto('forest', 3, () => 0).ribbons).toBe(0);
  });
  it('원정 성공 리본: 1 · 30분 이상 2 · 기간 밖 0', () => {
    expect(expRibbons(10, DAY1)).toBe(1);
    expect(expRibbons(30, DAY1)).toBe(2);
    expect(expRibbons(30, FROM - 1)).toBe(0);
  });
  it('리본 누적 200 → 칭호 「첫 수확제의 주인」 (쓴 것 포함 · 영구)', () => {
    addRibbons(150);
    hvState().ribbons = 0;
    expect(hvState().title).toBe(false);
    addRibbons(50);
    expect(hvState().title).toBe(true);
    expect(titlesOwned().some((t) => t.t === '첫 수확제의 주인')).toBe(true);
  });
});

describe('1-5 교환소', () => {
  it('교환표: 11종 · 다 사면 850 (명세 표 그대로) · 새 장식은 건설 목록 장식', () => {
    expect(HV_SHOP.length).toBe(11);
    const total = HV_SHOP.reduce((s, x) => s + x.cost * x.max, 0);
    // 명세 표 그대로면 850 (명세 「약 1,000」)
    expect(total).toBeGreaterThan(800);
    expect(total).toBeLessThan(1100);
    for (const x of HV_SHOP) expect((CATALOG as Record<string, { deco?: boolean }>)[x.kind]?.deco).toBe(true);
    expect(CATALOG.pumpkin_carriage.size).toEqual([2, 2]);
  });
  it('값 · 최대 개수 · 모자람 · 선물 장식 · 연감 도장 1 · 끝나면 닫힘', () => {
    hvState().ribbons = 100;
    const r = buyHv('jack_lantern', DAY1);
    expect('line' in r).toBe(true);
    expect(hvState().ribbons).toBe(85);
    expect(P.meta.giftDeco.jack_lantern).toBe(1);
    expect(alState().stamps).toBe(1);
    expect(hvState().deco).toBe(1);
    expect('err' in buyHv('pumpkin_carriage', DAY1)).toBe(true);
    hvState().ribbons = 1000;
    expect('line' in buyHv('pumpkin_carriage', DAY1)).toBe(true);
    expect('err' in buyHv('pumpkin_carriage', DAY1)).toBe(true);
    expect('line' in buyHv('leaf_pile', at('2026-11-08T12:00:00+09:00'))).toBe(true);
    expect('err' in buyHv('leaf_pile', at('2026-11-09T00:00:01+09:00'))).toBe(true);
  });
});

describe('1-7 마지막 밤', () => {
  it('11/5 밤에만 · 놓치면 11/8까지 다음 접속 · 그 뒤는 연대기만 · 참여 안 한 여관은 없음', () => {
    const night5 = at('2026-11-05T21:00:00+09:00');
    expect(finaleState(night5, true)).toBe(null);
    hvState().opened = true;
    expect(finaleState(at('2026-11-04T23:00:00+09:00'), true)).toBe(null);
    expect(finaleState(night5, false)).toBe(null);
    expect(finaleState(night5, true)).toBe('play');
    expect(finaleState(at('2026-11-07T10:00:00+09:00'), false)).toBe('play');
    expect(finaleState(at('2026-11-09T10:00:00+09:00'), false)).toBe('missed');
    hvState().finale = 1;
    expect(finaleState(night5, true)).toBe(null);
  });
});

describe('§D2 여관 연감', () => {
  it('시즌 밖엔 도장 없음 · 마지막 주 ×2 · 업적은 한 번만', () => {
    expect(addStamps(3, FROM - 1)).toBe(0);
    expect(almanacOn(at('2026-11-09T00:00:01+09:00'))).toBe(false);
    expect(addStamps(3, DAY1)).toBe(3);
    expect(stampMult(LAST)).toBe(2);
    expect(addStamps(3, LAST)).toBe(6);
    expect(achStamp('a1', DAY1)).toBe(1);
    expect(achStamp('a1', DAY1)).toBe(0);
    expect(alState().stamps).toBe(10);
  });
  it('30칸 · 한 칸 = 도장 2 · 받은 칸은 다시 못 받음 · 30칸 칭호', () => {
    expect(ALMANAC_CELLS.length).toBe(30);
    for (const n of [10, 20, 30]) expect(ALMANAC_CELLS[n - 1].k).toBe('deco');
    alState().stamps = 5;
    expect(cellsReached()).toBe(2);
    expect(claimCell(3, DAY1)).toBe(null);
    expect(claimCell(1, DAY1)).toBeTruthy();
    expect(claimCell(1, DAY1)).toBe(null);
    alState().stamps = 60;
    expect(claimCell(30, DAY1)).toContain('수확의 주인');
    expect(alState().title).toBe(true);
    expect(titlesOwned().some((t) => t.t === ALMANAC.title)).toBe(true);
  });
  it('따라잡기 ×2 — 마지막 주만 하루 장부(3) = 6', () => {
    expect(addStamps(DAYBOOK.stamps, at('2026-11-01T23:59:00+09:00'))).toBe(3);
    expect(addStamps(DAYBOOK.stamps, at('2026-11-02T00:00:00+09:00'))).toBe(6);
    expect(addStamps(DAYBOOK.stamps, at('2026-11-08T23:00:00+09:00'))).toBe(6);
  });
  it('남은 도장 30%는 다음 시즌으로 (못 채움 = 모은 것의 30% · 다 채움 = 넘친 것의 30%)', () => {
    expect(carryOf(20)).toBe(6);
    expect(carryOf(59)).toBe(17);
    expect(carryOf(60)).toBe(0);
    expect(carryOf(80)).toBe(6);
  });
  it('시즌 닫기: 못 받은 칸 우편 · 넘길 도장 · 한 번만 · 다음 시즌 시작 때 더함', () => {
    alState().stamps = 9;
    alState().claimed = [1];
    expect(closeSeason(at('2026-11-08T23:00:00+09:00'))).toBe(false);
    expect(closeSeason(at('2026-11-09T01:00:00+09:00'))).toBe(true);
    expect(alState().claimed.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(P.meta.mail.filter((m) => /연감/.test(m.title)).length).toBe(3);
    expect(alState().carry).toBe(2);
    expect(closeSeason(at('2026-11-10T01:00:00+09:00'))).toBe(false);
    // 다음 시즌 (시즌 id가 바뀌면) 넘긴 도장으로 시작
    P.almanac.season = 'old';
    P.almanac.carry = 4;
    expect(alState().stamps).toBe(4);
    expect(alState().season).toBe(ALMANAC.season);
  });
});

describe('§D1 오늘의 장부', () => {
  it('하루 후보 6 (열어 둔 것만) · 안 고르면 앞의 3개 · 3개 골라 담기 · 받으면 못 바꿈', () => {
    const d = dbState(DAY1, () => 0.3);
    expect(d.cands.length).toBeGreaterThanOrEqual(3);
    expect(d.cands.length).toBeLessThanOrEqual(DAYBOOK.cands);
    expect(new Set(d.cands.map((c) => c.id)).size).toBe(d.cands.length);
    expect(pickedIdx(d)).toEqual([0, 1, 2]);
    expect(pickCands([0, 1], d)).toBeTruthy();
    expect(pickCands([0, 0, 1], d)).toBeTruthy();
    const last = d.cands.length - 1;
    expect(pickCands([last, 1, 0], d)).toBe(null);
    expect(pickedIdx(d).sort()).toEqual([0, 1, last].sort());
    // 진행: 기록 값이 목표만큼 오르면 완료 (사진 · 손님 맞이 등)
    for (const i of pickedIdx(d)) d.cands[i].base -= d.cands[i].target;
    const i0 = pickedIdx(d)[0];
    expect(claimCand(i0, DAY1)).toBeTruthy();
    expect(canRepick(d)).toBe(false);
    expect(pickCands([0, 1, 2], d)).toBeTruthy();
    // 안 고른 후보는 못 받음
    const other = d.cands.findIndex((_, i) => !pickedIdx(d).includes(i));
    if (other >= 0) {
      d.cands[other].base -= d.cands[other].target;
      expect(claimCand(other, DAY1)).toBe(null);
    }
  });
  it('셋 다 → 상자 + 연감 도장 3 (마지막 주 6) · 상자 한 번', () => {
    const d = dbState(LAST, () => 0.3);
    for (const i of pickedIdx(d)) {
      d.cands[i].base -= d.cands[i].target;
      claimCand(i, LAST);
    }
    const r = claimDayBox(LAST, () => 0.5);
    expect(r?.stamps).toBe(6);
    expect(claimDayBox(LAST)).toBe(null);
    expect(d.weekN).toBe(3);
  });
  it('주간: 완료 누적 7·14·21에 상자 · 주가 바뀌면 처음부터', () => {
    const d = dbState(DAY1);
    d.weekN = 14;
    expect(weekReady(d)).toEqual([7, 14]);
    expect(claimWeekBox(21, DAY1)).toBe(null);
    expect(claimWeekBox(7, DAY1)).toBeTruthy();
    expect(claimWeekBox(7, DAY1)).toBe(null);
    const nextWeek = dbState(at('2026-10-27T09:00:00+09:00'));
    expect(nextWeek.weekN).toBe(0);
    expect(nextWeek.weekBox).toEqual([]);
  });
  it('한국 시간 0시에 새 장부 (같은 날이면 그대로)', () => {
    const d = dbState(at('2026-10-23T23:50:00+09:00'), () => 0.1);
    const ids = d.cands.map((c) => c.id).join();
    expect(dbState(at('2026-10-23T23:59:00+09:00'), () => 0.9).cands.map((c) => c.id).join()).toBe(ids);
    const n = dbState(at('2026-10-24T00:01:00+09:00'), () => 0.9);
    expect(n.day).toBe('2026-10-24');
    expect(n.picked).toEqual([]);
  });
  it('장부 기록 (progress.track → dbCount)', () => {
    dbCount('guestArrive');
    dbCount('guestArrive', 2);
    expect(P.daybook.cnt.guestArrive).toBe(3);
  });
});

describe('§2 노을', () => {
  it('17→19 노을 0→1 · 19→22 노을 → 밤 · 22시에 밤과 같게 · 등불 19시 반부터 0.5 → 22시 1', () => {
    expect(duskOf(10 * 60)).toEqual({ sun: 0, night: 0, light: 0 });
    expect(duskOf(12 * 60).sun).toBeCloseTo(0.5);
    expect(duskOf(13 * 60).sun).toBeCloseTo(1);
    expect(duskOf(13 * 60).light).toBe(0);
    expect(duskOf(13 * 60 + 30).light).toBeCloseTo(0.5 + 0.5 / 6);
    const late = duskOf(15 * 60 + 59.9);
    expect(late.night).toBeGreaterThan(0.99);
    expect(late.sun).toBeLessThan(0.01);
    expect(duskOf(16 * 60)).toEqual({ sun: 0, night: 1, light: 1 });
    expect(isDusk(11 * 60)).toBe(true);
    expect(isDusk(16 * 60)).toBe(false);
  });
  it('밤 색조 덧칠: 실제 밤 단계까지 더 물들이는 색 (이미 같으면 없음)', () => {
    expect(nightOverlay(1, 1)).toBe(null);
    expect(nightOverlay(0.5, 0.6)).toBe(null);
    expect(nightOverlay(1, 0)).toEqual([55, 80, 165]);
    const half = nightOverlay(1, 0.5)!;
    // c(1)/c(0.5) per channel
    expect(half[0]).toBe(Math.round((255 * 55) / 155));
  });
});

describe('1-3 가을 자동 장식 자리', () => {
  it('등급 장식·길과 겹치지 않고 울타리 밖 · 아치는 길 끝', () => {
    const list = layout(2, 8, 22, 14);
    expect(list.length).toBeGreaterThanOrEqual(10);
    const keys = list.map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of list) expect(p.x >= 8 && p.x < 22 && p.y >= 8 && p.y < 22).toBe(false);
    expect(list.find((p) => p.k === 'harvest_arch')).toMatchObject({ x: 14, y: 22 + 1 + 2 });
  });
});

describe('저장 (T2)', () => {
  it('옛 저장(수확제 칸 없음) → 기본값 · 다른 진행 그대로', () => {
    for (const v of [5, 6]) {
      const old = JSON.parse(fs.readFileSync(`tests/fixtures/v${v}.json`, 'utf8'));
      localStorage.setItem(CONFIG.save.key, JSON.stringify(old));
      const s = readSave()!;
      expect(s.progress.harvest.ribbons).toBe(0);
      expect(s.progress.harvest.finale).toBe(0);
      expect(s.progress.daybook.cands).toEqual([]);
      expect(s.progress.almanac.stamps).toBe(0);
      expect(s.progress.meta.duskFirst).toBe(false);
      expect(s.gold).toBe(old.gold);
    }
  });
  it('수확제 칸 왕복 (저장 → 불러오기)', () => {
    const old = JSON.parse(fs.readFileSync('tests/fixtures/v6.json', 'utf8'));
    localStorage.setItem(CONFIG.save.key, JSON.stringify(old));
    const s = readSave()!;
    s.progress.harvest = { ...s.progress.harvest, ribbons: 42, earned: 250, pumpkins: 31, king: 2, kingUsed: 2, deco: 4, buy: { jack_lantern: 3, pumpkin_carriage: 1 }, opened: true, finale: 1, title: true };
    s.progress.daybook = { ...s.progress.daybook, day: '2026-10-23', cands: [{ id: 'photo', target: 1, base: 3, claimed: true }], picked: [0], weekN: 5, weekBox: [], cnt: { guestArrive: 9 } };
    s.progress.almanac = { ...s.progress.almanac, season: 'hv1', stamps: 33, claimed: [1, 2, 3], carry: 0, title: false, ach: ['x'] };
    localStorage.setItem(CONFIG.save.key, JSON.stringify(s));
    const r = readSave()!;
    expect(r.progress.harvest).toEqual(s.progress.harvest);
    expect(r.progress.daybook).toEqual(s.progress.daybook);
    expect(r.progress.almanac).toEqual(s.progress.almanac);
  });
  it('저장 버전은 그대로 (올리지 않음 · LAND10이 9로)', () => expect(CONFIG.save.version).toBe(9));
});
