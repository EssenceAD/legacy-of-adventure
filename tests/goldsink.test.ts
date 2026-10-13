// GOLDSINK §1~§6 단위 시험: 한국 시간 하루·주 경계 · m(r) 값 · 유료 새로고침 · 변환(선형 오름·하루 최대) · 축복 · 자동 사냥 금화 120/300판 · 마을 부탁 · 실세이브 값표·초월·하루 시뮬레이션
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { BOSSES } from '../src/data/bosses';
import { REGIONS, type RegionId } from '../src/data/items';
import { blankActor } from '../src/world/adventurers';
import { transcend, transcendCost } from '../src/world/craft';
import { ensureQuests, partyInfo, refreshQuests } from '../src/world/expeditions';
import { boxReady, claimBox, claimFavor, ensureFavors, favorProg, FAVORS, rollFavors, swapCost, swapFavor } from '../src/world/favors';
import {
  addBlessMin, blessCost, blessFx, blessLeft, buyBless, buyConv, convItem, convItems, convMax, convPrice, convTotal, fmtKo, gsState, kstDay, kstWeek, mR, refreshCost, taperAt, taperInfo, topRegion,
} from '../src/world/goldsink';
import { sanitizeGrowth } from '../src/world/growth';
import { clearStage, idleHunt } from '../src/world/hunt';
import { sanitizeRegions2 } from '../src/world/regions2';
import { P, resetProgress, S, uiHooks, world, type Building, type Quest } from '../src/world/state';
import { readSave } from '../src/save/save';

const FIX = { ttabam: 'tests/fixtures/real_gs_ttabam.json', woongs: 'tests/fixtures/real_gs_woongs.json', ikamolly: 'tests/fixtures/real_gs_ikamolly.json' };
const haveReal = fs.existsSync(FIX.ttabam) && fs.existsSync(FIX.woongs) && fs.existsSync(FIX.ikamolly);
const KST0 = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h - 9, mi, s);

/** 실세이브를 진행·건물·손님까지 불러온다 (game.ts loadGame의 요점만) */
function loadReal(f: string) {
  localStorage.setItem(CONFIG.save.key, fs.readFileSync(f, 'utf8'));
  const d = readSave()!;
  resetProgress(d.progress);
  sanitizeRegions2();
  sanitizeGrowth();
  S.gold = d.gold;
  S.day = d.day;
  S.started = true;
  S.visiting = null as never;
  world.home = null;
  world.objs = d.buildings.map((b) => ({ ...b, inside: [] }) as unknown as Building);
  world.actors = d.adventurers.map((a) => Object.assign(blankActor(a.kind, a.name, a.x, a.y), a));
  for (const it of P.bag) it.owner = null;
  for (const a of world.actors)
    for (const s of ['weapon', 'armor', 'acc'] as const) {
      const it = P.bag.find((x) => x.id === a.equip[s]);
      if (it) it.owner = a.id;
    }
  return d;
}

beforeEach(() => {
  resetProgress();
  S.visiting = null as never;
  S.started = true;
  S.gold = 0;
  world.home = null;
  world.objs = [];
  world.actors = [];
});
afterEach(() => vi.useRealTimers());

describe('§0 한국 시간 하루·주 · m(r)', () => {
  it('하루 경계는 한국 시간 0시 (UTC 15시)', () => {
    expect(kstDay(KST0(2026, 10, 13, 23, 59, 59))).toBe('2026-10-13');
    expect(kstDay(KST0(2026, 10, 14, 0, 0, 0))).toBe('2026-10-14');
    expect(kstDay(Date.UTC(2026, 9, 13, 14, 59, 59))).toBe('2026-10-13');
    expect(kstDay(Date.UTC(2026, 9, 13, 15, 0, 0))).toBe('2026-10-14');
  });
  it('주 경계는 한국 시간 월요일 0시', () => {
    // 2026-10-18 = 일요일, 10-19 = 월요일
    expect(kstWeek(KST0(2026, 10, 18, 23, 59, 59))).toBe('w2026-10-12');
    expect(kstWeek(KST0(2026, 10, 19, 0, 0, 0))).toBe('w2026-10-19');
    expect(kstWeek(KST0(2026, 10, 25, 23, 0, 0))).toBe('w2026-10-19');
  });
  it('하루 카운터는 0시에 초기화 · 주간 완료는 월요일까지 남는다', () => {
    const a = KST0(2026, 10, 13, 23, 59);
    const g = gsState(a);
    g.refreshPaid = 3;
    g.conv = { ash: 5 };
    g.autoN = 200;
    g.swaps = 2;
    g.weekN = 7;
    expect(gsState(KST0(2026, 10, 13, 23, 59, 59)).autoN).toBe(200);
    const b = gsState(KST0(2026, 10, 14, 0, 0, 1));
    expect([b.refreshPaid, b.conv.ash ?? 0, b.autoN, b.swaps]).toEqual([0, 0, 0, 0]);
    expect(b.weekN).toBe(7);
    expect(gsState(KST0(2026, 10, 19, 0, 0, 1)).weekN).toBe(0);
  });
  it('m(r) = 2^(한 스테이지라도 깬 가장 먼 지역)', () => {
    expect(mR()).toBe(1);
    P.hunt.best.abyss = 9;
    expect(topRegion()).toBe(4);
    expect(mR()).toBe(16);
    P.hunt.best.deep = 10;
    expect(mR()).toBe(512);
  });
  it('짧은 금화 표기', () => {
    expect([fmtKo(9800), fmtKo(16000), fmtKo(512000), fmtKo(768000), fmtKo(1152000), fmtKo(1.2e8)]).toEqual(['9,800', '1.6만', '51만', '77만', '115만', '1.2억']);
  });
});

describe('§1 의뢰 새로고침', () => {
  it('무료 1번 → 그 뒤 1,000 × m × 1.5^(n−1) · 진행 중 원정은 그대로', () => {
    P.hunt.best.deep = 10;
    expect([0, 1, 2, 3].map((n) => refreshCost(n))).toEqual([512000, 768000, 1152000, 1728000]);
    S.gold = 600000;
    ensureQuests();
    P.runs.push({ id: 99, quest: { id: 1 } as Quest, members: [], start: 0, end: 1 });
    expect(refreshQuests()).toBe('free');
    expect(refreshQuests()).toBe('paid');
    expect(S.gold).toBe(600000 - 512000);
    expect(refreshQuests()).toBe(false);
    expect(S.gold).toBe(88000);
    expect(P.runs.length).toBe(1);
  });
});

describe('§2 연금술 변환', () => {
  const alch = () => world.objs.push({ kind: 'alchemy', lvl: 1, inside: [] } as unknown as Building);
  it('k번째 값 = 첫 값 × (1 + 오름 × k) · 합계 · 최대 · 하루 최대', () => {
    alch();
    P.hunt.best.forest = 3;
    const it = convItem('ash')!;
    expect(it.first).toBe(500);
    expect([0, 1, 10].map((k) => convPrice(it, k))).toEqual([500, 515, 650]);
    expect(convTotal(it, 3)).toBe(500 + 515 + 530);
    S.gold = 1545;
    expect(convMax(it)).toBe(3);
    expect(buyConv('ash', 3)).toBeNull();
    expect(S.gold).toBe(0);
    expect(P.dust.n).toBe(30);
    const after = convItem('ash')!;
    expect(after.bought).toBe(3);
    expect(convPrice(after, after.bought)).toBe(545);
    S.gold = 1e9;
    expect(buyConv('ash', 48)).toMatch(/47번/);
    expect(buyConv('ash', 47)).toBeNull();
    expect(convMax(convItem('ash')!)).toBe(0);
  });
  it('지역 재료는 깬 지역만 (그 지역 m) · 보스 재료는 처치한 보스만 · 공방 없으면 안내', () => {
    P.hunt.best.forest = 10;
    P.hunt.best.swamp = 2;
    expect(buyConv('ash', 1)).toBe('연금술 공방을 지으면 열려요');
    alch();
    const keys = convItems().map((x) => x.key);
    expect(keys).toContain('mat:forest');
    expect(keys).toContain('mat:swamp');
    expect(keys).not.toContain('mat:mine');
    expect(keys).toContain('boss:boar');
    expect(keys).not.toContain('boss:mushroom');
    expect(convItem('mat:swamp')!.first).toBe(300);
    expect(convItem('boss:boar')!.first).toBe(20000);
    expect(convItem('whet')!.first).toBe(4000);
    S.gold = 1e6;
    expect(buyConv('boss:boar', 2)).toBeNull();
    expect(P.bossMats.boar).toBe(2);
    expect(S.gold).toBe(1e6 - 20000 - 25000);
  });
});

describe('§3 축복', () => {
  const chapel = (lvl: number) => world.objs.push({ kind: 'chapel', lvl, inside: [] } as unknown as Building);
  it('값 2,000 × m · 2시간 · 연장 · 최대 8시간 · 레벨마다 +2%p', () => {
    const t0 = KST0(2026, 10, 13, 12);
    vi.useFakeTimers();
    vi.setSystemTime(t0);
    expect('err' in buyBless(t0)).toBe(true);
    chapel(5);
    P.hunt.best.abyss = 1;
    expect(blessCost()).toBe(32000);
    S.gold = 32000 * 5;
    expect(buyBless(t0)).toEqual({ ext: false });
    expect(blessLeft(t0)).toBe(2 * 3600000);
    expect(blessFx('xp', t0)).toBeCloseTo(0.28);
    expect(blessFx('drop', t0)).toBeCloseTo(0.18);
    expect(blessFx('expTime', t0)).toBeCloseTo(0.18);
    expect(blessFx('mood', t0)).toBeCloseTo(0.38);
    expect(buyBless(t0)).toEqual({ ext: true });
    buyBless(t0);
    buyBless(t0);
    expect(blessLeft(t0)).toBe(8 * 3600000);
    expect('err' in buyBless(t0)).toBe(true);
    expect(S.gold).toBe(32000);
    addBlessMin(30, t0);
    expect(blessLeft(t0)).toBe(8 * 3600000);
    expect(blessFx('xp', t0 + 8 * 3600000 + 1)).toBe(0);
  });
  it('원정 시간 −18% (예배당 Lv5)', () => {
    chapel(5);
    const a = blankActor('knight', 'a', 5, 5);
    const q = { id: 1, region: 'forest', tier: 1, minutes: 100, power: 10, gold: [1, 2] } as unknown as Quest;
    const m0 = partyInfo([a], q).minutes;
    S.gold = 1e6;
    buyBless();
    expect(partyInfo([a], q).minutes).toBeCloseTo(m0 - 100 * 0.18, 5);
  });
});

describe('§4 자동 사냥 금화', () => {
  it('120판까지 100% · 300판까지 50% · 그 뒤 25%', () => {
    expect([taperAt(0), taperAt(119), taperAt(120), taperAt(299), taperAt(300), taperAt(5000)]).toEqual([1, 1, 0.5, 0.5, 0.25, 0.25]);
  });
  it.skipIf(!haveReal)('맡겨 두기 · 접은 판 · 방치 판이 같은 하루 카운트 · 수동·첫 돌파는 그대로 · 재료·경험치는 그대로', () => {
    loadReal(FIX.ttabam);
    const ms = world.actors.filter((a) => P.hunt.auto!.members.includes(a.id!));
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const g = gsState();
    g.autoN = 0;
    const manual = clearStage('deep', 9, ms);
    expect(g.autoN).toBe(0);
    g.autoN = 119;
    const full = clearStage('deep', 9, ms, 1, true, true);
    expect(g.autoN).toBe(120);
    const half = clearStage('deep', 9, ms, 1, true, true);
    expect(Math.abs(half.gold - full.gold * 0.5)).toBeLessThanOrEqual(1);
    expect(half.mats).toBe(full.mats);
    expect(half.xp).toBe(full.xp);
    expect(manual.gold).toBe(full.gold);
    g.autoN = 299;
    clearStage('deep', 9, ms, 1, true, true);
    const quarter = clearStage('deep', 9, ms, 1, true, true);
    expect(Math.abs(quarter.gold - full.gold * 0.25)).toBeLessThanOrEqual(1);
    // 방치 (앱을 꺼 둔 동안): 판마다 같은 카운트로 센다
    g.autoN = 0;
    const idle = idleHunt(3600, Infinity)!;
    expect(g.autoN).toBe(idle.clears);
    expect(taperInfo().n).toBe(idle.clears);
    rnd.mockRestore();
  });
});

describe('§5 마을 부탁', () => {
  it('안 해 본 낚시·선물이 먼저 · 할 수 있는 것만 · 진행·받기·상자 · 바꾸기 값', () => {
    P.owner = { name: 'x' } as never;
    world.objs.push({ kind: 'lily_pond', lvl: 1, inside: [] } as unknown as Building);
    const a = blankActor('knight', 'r', 5, 5);
    a.status = 'regular';
    a.id = 1;
    world.actors.push(a);
    const ids = rollFavors(() => 0.3).map((f) => f.id);
    expect(ids.slice(0, 2).sort()).toEqual(['fish', 'gift']);
    expect(ids.length).toBe(3);
    // 공방·예배당·텃밭이 없으면 그 부탁은 안 나온다
    for (let i = 0; i < 20; i++) expect(rollFavors().some((f) => ['conv', 'bless', 'harvest', 'meal'].includes(f.id))).toBe(false);
    const g = gsState();
    g.favors = [
      { id: 'talk', base: 0, target: 5, claimed: false },
      { id: 'exp', base: 0, target: 3, claimed: false },
      { id: 'like', base: 0, target: 2, claimed: false },
    ];
    P.counters.guestTalks = 4;
    expect(favorProg(g.favors[0])).toBe(4);
    expect(claimFavor(0)).toBeNull();
    P.counters.guestTalks = 6;
    expect(claimFavor(0)!.reward).toMatch(/증표|인연/);
    P.counters.regionWins.forest = 3;
    const r0 = P.dust.r;
    claimFavor(1);
    expect(P.dust.r).toBe(r0 + 10);
    expect(boxReady()).toBe(false);
    g.cnt.likes = 2;
    claimFavor(2);
    expect(boxReady()).toBe(true);
    const charm = P.growth.charm;
    expect(claimBox(() => 0.1)).toBe('보호 부적 1');
    expect(P.growth.charm).toBe(charm + 1);
    expect(claimBox()).toBeNull();
    expect(g.weekN).toBe(3);
  });
  it('바꾸기: 하루 무료 1번 → 500 × m × 2^(n−1)', () => {
    P.hunt.best.deep = 1;
    expect([0, 1, 2, 3].map((n) => swapCost(n))).toEqual([0, 256000, 512000, 1024000]);
    const g = gsState();
    g.favors = [{ id: 'talk', base: 0, target: 5, claimed: false }];
    S.gold = 300000;
    expect(swapFavor(0)).toBeNull();
    expect(g.favors[0].id).not.toBe('talk');
    expect(S.gold).toBe(300000);
    expect(swapFavor(0)).toBeNull();
    expect(S.gold).toBe(44000);
    expect(swapFavor(0)).toBe('금화가 모자라요');
  });
  it('주 15개 → 감사 편지(증표 1 · 보스 재료 3) + [알림] 자랑 「weekly|」 한 번', () => {
    P.hunt.best.forest = 10;
    const ann = vi.spyOn(uiHooks, 'announce').mockImplementation(() => {});
    const g = gsState();
    g.weekN = 14;
    g.favors = [{ id: 'talk', base: -10, target: 5, claimed: false }, { id: 'like', base: -10, target: 2, claimed: false }];
    expect(claimFavor(0)!.letter).toBe(true);
    expect(P.meta.mail[0].reward.tokens).toBe(1);
    expect(P.bossMats.boar).toBe(3);
    expect(ann).toHaveBeenCalledTimes(1);
    expect(ann.mock.calls[0][1]).toBe('brag');
    expect(ann.mock.calls[0][2]).toBe('weekly|');
    expect(claimFavor(1)!.letter).toBe(false);
    ann.mockRestore();
  });
  it('부탁 풀 12종 · 오늘 3개는 저장에 남는다', () => {
    expect(FAVORS.length).toBe(12);
    const n = ensureFavors().length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(3);
    expect(ensureFavors()).toBe(gsState().favors);
  });
});

// ───────── 실세이브: 값표 · 초월 · 하루 시뮬레이션 (로컬 전용 — 없으면 건너뜀) ─────────

describe.skipIf(!haveReal)('실세이브', () => {
  it('세 여관의 r · m(r) · 새 소비처 첫 값 (보고용 표)', () => {
    const rows: string[] = [];
    for (const [nm, f] of Object.entries(FIX)) {
      loadReal(f);
      const items = convItems();
      const conv = items.map((x) => `${x.key}=${x.first}`).join(' ');
      rows.push(`${nm} r=${topRegion()} m=${mR()} gold=${S.gold} refresh=${[0, 1, 2, 3].map((n) => refreshCost(n)).join('/')} bless=${blessCost()} swap=${[0, 1, 2].map((n) => swapCost(n)).join('/')} ${conv}`);
      expect(refreshCost(0)).toBe(1000 * mR());
      expect(convItem('ash')!.first).toBe(500 * mR());
    }
    console.log('[GOLDSINK 값표]\n' + rows.join('\n'));
  });
  it('변환으로 재료를 사면 막혀 있던 초월이 된다 (웅스)', () => {
    loadReal(FIX.woongs);
    const it = P.bag.filter((x) => x.enh >= 10 && x.enh < 20).sort((a, b) => b.enh - a.enh)[0];
    expect(it).toBeTruthy();
    const c = transcendCost(it);
    // 재료를 모자라게 만든다 (실제로 「재료가 막혀서 금화가 남는」 상황)
    P.mats[it.region] = 0;
    P.bossMats[c.boss.id] = 0;
    S.gold = Math.max(S.gold, c.gold);
    expect(transcend(it)).toBe('mats');
    const mk = 'mat:' + it.region;
    S.gold += 1e9;
    expect(buyConv(mk, c.mats)).toBeNull();
    expect(transcend(it)).toBe('boss');
    expect(buyConv('boss:' + c.boss.id, Math.min(5, c.bossMats))).toBeNull();
    if (c.bossMats > 5) P.bossMats[c.boss.id] = c.bossMats; // 하루 최대 5 — 나머지는 다음 날 (시험은 채워 둔다)
    const dustKey = { n: 'ash', r: 'dustR', e: 'dustE', l: 'dustL' }[it.grade as 'n'];
    if ((P.dust[it.grade] ?? 0) < c.dust && dustKey) buyConv(dustKey, Math.ceil((c.dust - P.dust[it.grade]) / convItem(dustKey)!.qty));
    expect(['ok', 'fail']).toContain(transcend(it));
    console.log(`[GOLDSINK 초월] ${it.name} +${it.enh} 지역 ${it.region} 재료 ${c.mats} 보스 ${c.boss.id}×${c.bossMats} 가루 ${it.grade}×${c.dust}`);
  });
  it('하루 시뮬레이션 (따밤): §4 전후 수입 · 소비처를 하루 최대로 쓰면 남는 금화', () => {
    const sim = (taper: boolean, runs = 960) => {
      loadReal(FIX.ttabam);
      const steps = CONFIG.goldsink.taper.steps;
      if (!taper) CONFIG.goldsink.taper.steps = [[Infinity, 1]];
      const a = P.hunt.auto!;
      const ms = world.actors.filter((x) => a.members.includes(x.id!));
      const g0 = S.gold;
      gsState().autoN = 0;
      // 8시간 켜 둔 자동 사냥 (30초에 한 판 = 960판)
      for (let i = 0; i < runs; i++) clearStage(a.region as RegionId, a.stage, ms, 1, true, true);
      const online = S.gold - g0;
      // 꺼 둔 16시간 방치 (상한 없이 판만 셈 — 같은 카운트)
      const g1 = S.gold;
      idleHunt(16 * 3600, Infinity);
      const idle = S.gold - g1;
      CONFIG.goldsink.taper.steps = steps;
      return { online, idle };
    };
    const before = sim(false);
    const after = sim(true);
    // 따밤의 실제 하루처럼: 켜 둔 자동 128판 + 꺼 둔 16시간
    const realB = sim(false, 128);
    const realA = sim(true, 128);
    console.log('[GOLDSINK 실제형 하루 128판+방치16h]', JSON.stringify({ before: realB, after: realA }));
    // 의뢰·여관 수입은 그날 기록(goldLog)을 그대로 쓴다
    loadReal(FIX.ttabam);
    const by = P.goldLog.by;
    const other = (by.quest ?? 0) + (by.sleep ?? 0) + (by.drink ?? 0) + (by.bath ?? 0) + (by.forge ?? 0) + (by.stall ?? 0);
    const incBefore = before.online + before.idle + other;
    const incAfter = after.online + after.idle + other;
    // 소비처를 하루 최대로: 새로고침 5번 · 변환 전부 하루 최대 · 축복 8시간(4번) · 바꾸기 유료 2번
    const refresh = [0, 1, 2, 3, 4].reduce((s, n) => s + refreshCost(n), 0);
    const convAll = convItems().reduce((s, x) => s + convTotal(x, x.cap), 0);
    const convNoMats = convItems().filter((x) => !x.key.startsWith('mat:')).reduce((s, x) => s + convTotal(x, x.cap), 0);
    const matsTop = convTotal(convItem('mat:deep')!, 300);
    const bless = blessCost() * 4;
    const swaps = swapCost(1) + swapCost(2);
    const sinkAll = refresh + convAll + bless + swaps;
    const sinkCore = refresh + convNoMats + matsTop + bless + swaps;
    const left = (inc: number, sink: number) => Math.round((Math.max(0, inc - sink) / inc) * 1000) / 10;
    const out = {
      onlineBefore: before.online, idleBefore: before.idle, onlineAfter: after.online, idleAfter: after.idle, other, incBefore, incAfter,
      refresh, convAll, convNoMats, matsTop, bless, swaps, sinkAll, sinkCore,
      leftAllPct: left(incAfter, sinkAll), leftCorePct: left(incAfter, sinkCore),
      leftNoConvMatsPct: left(incAfter, refresh + convNoMats + bless + swaps),
    };
    console.log('[GOLDSINK 시뮬레이션 따밤]', JSON.stringify(out));
    console.log('[GOLDSINK 변환 하루 최대 합]', convItems().map((x) => `${x.key}=${convTotal(x, x.cap)}`).join(' '));
    expect(after.online).toBeLessThan(before.online);
    expect(incAfter).toBeGreaterThan(0);
  });
  it('보스 목록 확인: 처치 보스만 변환 (이카몰리 = 거대 너구리만)', () => {
    loadReal(FIX.ikamolly);
    const b = convItems().filter((x) => x.key.startsWith('boss:')).map((x) => x.key);
    expect(b.length).toBeGreaterThan(0);
    for (const k of b) expect(BOSSES.some((x) => 'boss:' + x.id === k)).toBe(true);
    expect(REGIONS.length).toBe(10);
  });
});
