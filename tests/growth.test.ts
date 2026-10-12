// GROWTH §2~§4 단위 시험: 선물 힌트·♥ · 단골 선물 · ★ 정렬·자동 장착·가장 좋은 걸로 · 강화 규칙(기존 장비 불변) · 소모품 · 고유 장비 · 재련 · 자랑 도배 방지 · 낚시
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { bondById } from '../src/data/bonds';
import { GIFT_HINTS, GUEST_GIFT } from '../src/data/story/gift_hints';
import { FISH } from '../src/data/story/fish';
import { UNIQUES } from '../src/data/story/uniques';
import { makeAdventurer, powerOf } from '../src/world/adventurers';
import { applyBest, autoEquipAll, bestPlan, whoWears } from '../src/world/autoEquip';
import { craftWhet, enhance, enhanceRate, lastEnh, salvage, transcend, transcendRate } from '../src/world/craft';
import { enhRateOf, rollEnhance, rollTranscend } from '../src/world/enhRules';
import { baitLeft, baitMax, cast, cookFish, judge, land, makeBait, pickFish, sellFish, stuffFish, releaseFish, dailyFishing } from '../src/world/fishing';
import { brag, bragAllowed, favRank, guestChemMult, isFav, mealGold, rumorHint, sanitizeGrowth, talkHint, toggleFav, uniqueSalvageMult } from '../src/world/growth';
import { equip, makeItem } from '../src/world/items';
import { buyShop } from '../src/world/meta';
import { createOwner, giveFish, giveGift, giveGuest, tieAvailable } from '../src/world/owner';
import { today } from '../src/world/progress';
import { reforge, reforgeCost, reforgeWhy } from '../src/world/reforge';
import { freshGrowth, P, resetProgress, S, uiHooks, world, type Actor, type Item } from '../src/world/state';
import { addObj, rebuildPaths, startTown } from '../src/world/town';
import { grantUnique, makeUnique, rollUnique, rollUniqueAny, specialSum } from '../src/world/uniques';
import { migrate } from '../src/save/save';

const reg = (lvl = 5): Actor => {
  const a = makeAdventurer(5, 5, { status: 'regular' });
  a.lvl = lvl;
  world.actors.push(a);
  return a;
};
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)];
};

beforeEach(() => {
  resetProgress();
  S.visiting = false as never;
  S.started = true;
  S.land = 5;
  world.home = null as never;
  startTown();
  addObj('smith', 20, 20, { lvl: 5 });
  rebuildPaths();
  world.actors = [];
  P.bag = [];
  P.nextItemId = 1;
  createOwner('주인', 'm', 'knight', 'knight');
});
afterEach(() => vi.restoreAllMocks());

describe('§2 선물 힌트 · ♥/✕ · 하루 한 번', () => {
  it('데이터 파일: 힌트 25명(미미 없음) · 단골 직업 5', () => {
    expect(Object.keys(GIFT_HINTS).length).toBe(26);
    for (const id of Object.keys(GIFT_HINTS)) expect(bondById(id)).toBeTruthy();
    expect(Object.keys(GUEST_GIFT)).toEqual(['knight', 'mage', 'dwarf', 'rogue', 'cleric']);
  });
  it('인연 1단계는 힌트 없음 · 2단계부터 30% like · 4단계부터 hate 섞임 · 본 힌트 기록', () => {
    expect(talkHint('grom', 1, () => 0)).toBeNull();
    expect(talkHint('grom', 2, () => 0.5)).toBeNull();
    expect(GIFT_HINTS.grom.like).toContain(talkHint('grom', 2, seq(0.1, 0.9)));
    expect(P.growth.hints).toContain('grom:like');
    expect(talkHint('grom', 3, seq(0.1, 0.0))).not.toBe(GIFT_HINTS.grom.hate);
    expect(talkHint('grom', 4, seq(0.1, 0.0))).toBe(GIFT_HINTS.grom.hate);
    expect(P.growth.hints).toContain('grom:hate');
  });
  it('[소문] 힌트는 하루 한 번', () => {
    const r1 = rumorHint(tieAvailable, () => 0);
    expect(r1).toMatch(/요즘 「.+」 이런 얘기를 하더라/);
    expect(rumorHint(tieAvailable, () => 0)).toBeNull();
    expect(P.growth.rumorDay).toBe(today());
  });
  it('좋아하는 선물 → ♥ 공개 · 같은 날 두 번 안 됨 (행동력 규칙 그대로)', () => {
    const d = bondById('momo')!;
    P.gifts[d.likes] = 2;
    const r = giveGift('momo', d.likes);
    expect(r.kind).toBe('like');
    expect(P.ties.momo.knowLike).toBe(true);
    expect(giveGift('momo', d.likes).err).toMatch(/이미 선물/);
    expect(P.gifts[d.likes]).toBe(1);
  });
  it('싫어하는 선물 → ✕ 공개', () => {
    const d = bondById('baker')!;
    P.gifts[d.hates] = 1;
    expect(giveGift('baker', d.hates).kind).toBe('hate');
    expect(P.ties.baker.knowHate).toBe(true);
  });
  it('물고기 선물: 좋아하는 사람(fish.ts like)이면 좋아함 · 가방에서 빠짐', () => {
    P.growth.fish.bag.crucian = 1;
    const pts0 = P.ties.momo?.pts ?? 0;
    // 루나는 영입 전이라 못 받음 → 마을 사람으로
    expect(giveFish('luna', 'crucian').err).toBeTruthy();
    const r = giveFish('momo', 'crucian');
    expect(r.kind).toBe('normal');
    expect(P.growth.fish.bag.crucian).toBeUndefined();
    expect(P.ties.momo.pts).toBeGreaterThan(pts0);
  });
  it('단골 선물: 좋아하는 것 → 기분 +20 · 그날 케미 +30% · 하루 한 번', () => {
    const a = reg();
    a.kind = 'mage';
    a.mood = 50;
    P.gifts.candle = 2;
    const r = giveGuest(a, 'candle');
    expect(r.kind).toBe('like');
    expect(a.mood).toBe(70);
    const b = reg();
    expect(guestChemMult(a, b)).toBeCloseTo(1.3);
    expect(giveGuest(a, 'candle').err).toMatch(/이미/);
    const c = reg();
    c.kind = 'dwarf';
    c.mood = 50;
    P.gifts.toy = 1;
    expect(giveGuest(c, 'toy').kind).toBe('normal');
    expect(c.mood).toBe(55);
    expect(guestChemMult(c, b)).toBe(1);
  });
});

describe('§3-1 ★ 아끼는 영웅 · 가장 좋은 걸로 · 누가 끼면 좋을까', () => {
  it('★ 최대 6명 · 정렬 순위', () => {
    const list = Array.from({ length: 7 }, () => reg());
    for (let i = 0; i < 6; i++) expect(toggleFav(list[i])).toBeNull();
    expect(toggleFav(list[6])).toMatch(/6명/);
    expect(isFav(list[0])).toBe(true);
    expect(favRank(list[2])).toBe(2);
    expect(favRank(list[6])).toBe(99);
    expect(toggleFav(list[0])).toBeNull();
    expect(isFav(list[0])).toBe(false);
  });
  it('모두 자동 장착: ★가 레벨 높은 단골보다 먼저 가장 좋은 장비를 받는다', () => {
    const hi = reg(30);
    const fav = reg(5);
    toggleFav(fav);
    const best = makeItem('ice', 'l', 'weapon', false);
    best.stats = { atk: 900, mag: 900 };
    const meh = makeItem('forest', 'n', 'weapon', false);
    P.bag.push(meh, best);
    autoEquipAll();
    expect(fav.equip.weapon).toBe(best.id);
    expect(hi.equip.weapon).toBe(meh.id);
  });
  it('가장 좋은 걸로: ★ 아닌 단골 것은 가져오고 ★끼리는 안 뺏는다 · 부위별 미리보기', () => {
    const a = reg(10);
    const other = reg(10);
    const fav2 = reg(10);
    toggleFav(a);
    toggleFav(fav2);
    const w1 = makeItem('ice', 'l', 'weapon', false);
    w1.stats = { atk: 500, mag: 500 };
    const w2 = makeItem('ice', 'l', 'weapon', false);
    w2.stats = { atk: 900, mag: 900 };
    const ar = makeItem('ice', 'e', 'armor', false);
    ar.stats = { def: 300, agi: 300 };
    P.bag.push(w1, w2, ar);
    equip(other, w1);
    equip(fav2, w2);
    const plan = bestPlan(a);
    const slots = plan.slots.map((x) => x.slot).sort();
    expect(slots).toEqual(['armor', 'weapon']);
    expect(plan.slots.find((x) => x.slot === 'weapon')!.to).toBe(w1);
    expect(plan.slots.find((x) => x.slot === 'weapon')!.taker).toBe(other);
    expect(plan.slots.every((x) => x.gain > 0)).toBe(true);
    const before = powerOf(a);
    const r = applyBest(a, plan);
    expect(r.changed).toBe(2);
    expect(powerOf(a)).toBeGreaterThan(before);
    expect(fav2.equip.weapon).toBe(w2.id);
    expect(other.equip.weapon).toBeNull();
  });
  it('누가 끼면 좋을까: 상위 3명 (▲ 큰 순)', () => {
    const xs = [reg(5), reg(20), reg(40), reg(60)];
    const it = makeItem('ice', 'l', 'weapon', false);
    P.bag.push(it);
    const w = whoWears(it);
    expect(w.length).toBe(3);
    expect(w[0].gain).toBeGreaterThanOrEqual(w[1].gain);
    expect(w.map((x) => x.a)).not.toContain(xs[0]);
  });
});

describe('§3-2 강화 재조정', () => {
  const sword = (enh = 0): Item => {
    const it = makeItem('forest', 'r', 'weapon', false);
    it.enh = enh;
    P.bag.push(it);
    P.dust.r = 1e6;
    P.bossMats = { boar: 99 } as never;
    for (const k of Object.keys(P.bossMats)) P.bossMats[k] = 99;
    return it;
  };
  it('성공률 표: 100·95·90·85·80 / 60 / 45 / 32 / 22 / 15', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((e) => enhRateOf(e, 0, 0))).toEqual([1, 0.95, 0.9, 0.85, 0.8, 0.6, 0.45, 0.32, 0.22, 0.15]);
    expect(enhRateOf(7, 0, 0.09)).toBeCloseTo(0.41);
    expect(enhRateOf(0, 0.5, 0.5)).toBe(1);
  });
  it('+7~+10 실패: 30% 하락 · 부적이 막음 · +6 이하 실패는 그대로 · 천장 +3%p (성공하면 0)', () => {
    expect(rollEnhance(6, 0, 0, {}, seq(0.99, 0.1))).toMatchObject({ enh: 5, drop: true, pity: 0.03 });
    expect(rollEnhance(6, 0, 0, {}, seq(0.99, 0.5))).toMatchObject({ enh: 6, drop: false });
    expect(rollEnhance(6, 0, 0, { charm: true }, seq(0.99, 0.1))).toMatchObject({ enh: 6, saved: true });
    expect(rollEnhance(5, 0, 0, {}, seq(0.99, 0.0))).toMatchObject({ enh: 5, drop: false, pity: 0.03 });
    expect(rollEnhance(7, 0.09, 0, {}, seq(0.0, 0.5))).toMatchObject({ enh: 8, pity: 0, ok: true });
  });
  it('대성공: 목표 +9 이하에서 3% → +2 · 목표 +10은 없음', () => {
    expect(rollEnhance(3, 0, 0, {}, seq(0.0, 0.01))).toMatchObject({ enh: 5, great: true });
    expect(rollEnhance(8, 0, 0, {}, seq(0.0, 0.01))).toMatchObject({ enh: 10, great: true });
    expect(rollEnhance(9, 0, 0, {}, seq(0.0, 0.01))).toMatchObject({ enh: 10, great: false });
  });
  it('초월: +11 40% → +20 6% · 실패 +2%p · 단계 유지', () => {
    expect(rollTranscend(10, 0, 0, {}, () => 0.41)).toMatchObject({ enh: 10, ok: false, pity: 0.02 });
    expect(rollTranscend(10, 0, 0, {}, () => 0.39)).toMatchObject({ enh: 11, ok: true });
    expect(rollTranscend(19, 0, 0, {}, () => 0.07)).toMatchObject({ enh: 19, ok: false });
  });
  it('실제 강화: 천장이 장비에 저장되고 화면 성공률에 반영 · 실패 하락', () => {
    const it = sword(7);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const r0 = enhanceRate(it);
    expect(enhance(it)).toBe('fail');
    expect(it.ePity).toBeCloseTo(0.03);
    expect(it.enh).toBe(7);
    expect(enhanceRate(it)).toBeCloseTo(r0 + 0.03);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    // 0.1 < 성공률 → 성공 · 대성공(0.1 ≥ 3%) 아님
    expect(enhance(it)).toBe('ok');
    expect(it.enh).toBe(8);
    expect(it.ePity).toBeUndefined();
  });
  it('기존 장비 강화 수치·능력치는 안 건드린다 (옛 저장을 불러와도 그대로)', () => {
    const it = sword(9);
    it.tPity = 0.25;
    const save = { version: 8, savedAt: 0, land: 5, buildings: [{ kind: 'inn', tx: 10, ty: 10, lvl: 1 }], gold: 1, day: 1, clock: 0, night: false, adventurers: [], innName: 'x', ledger: {}, progress: JSON.parse(JSON.stringify({ ...P, growth: undefined })) };
    const d = migrate(save);
    expect(d.progress.bag[0].enh).toBe(9);
    expect(d.progress.bag[0].tPity).toBe(0.25);
    expect(d.progress.bag[0].stats).toEqual(it.stats);
    expect(d.progress.bag[0].ePity).toBeUndefined();
  });
  it('초월 실제: 천장 2%p', () => {
    const it = sword(10);
    S.gold = 1e9;
    P.mats.forest = 999;
    P.dust.r = 1e6;
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const r0 = transcendRate(it);
    expect(transcend(it)).toBe('fail');
    expect(transcendRate(it)).toBeCloseTo(r0 + 0.02);
  });
});

describe('§3-3 소모품', () => {
  const it8 = () => {
    const it = makeItem('forest', 'r', 'weapon', false);
    it.enh = 8;
    P.bag.push(it);
    P.dust.r = 1e6;
    return it;
  };
  it('부적: 하락을 막을 때만 1개 쓴다', () => {
    const it = it8();
    P.growth.charm = 1;
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    // 0.99 → 실패 · 하락 굴림 0.99 → 하락 없음 → 부적 안 씀
    expect(enhance(it, { charm: true })).toBe('fail');
    expect(P.growth.charm).toBe(1);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.1);
    expect(enhance(it, { charm: true })).toBe('fail');
    expect(lastEnh.saved).toBe(true);
    expect(P.growth.charm).toBe(0);
    expect(it.enh).toBe(8);
    // 부적이 없으면 체크해도 하락
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.1);
    enhance(it, { charm: true });
    expect(it.enh).toBe(7);
  });
  it('숫돌: 이번 시도 +10%p · 1개 씀', () => {
    const it = it8();
    P.growth.whet = 1;
    expect(enhanceRate(it, true) - enhanceRate(it)).toBeCloseTo(0.1);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    enhance(it, { whet: true });
    expect(P.growth.whet).toBe(0);
    expect(lastEnh.usedWhet).toBe(true);
  });
  it('숫돌 만들기: 잿빛 가루 80 + 지역 재료 10 + 금화 2,000 × 지역 배수', () => {
    P.dust.n = 100;
    P.mats.mine = 10;
    S.gold = 6000;
    expect(craftWhet('mine')).toBeNull();
    expect(P.growth.whet).toBe(1);
    expect(P.dust.n).toBe(20);
    expect(P.mats.mine).toBe(0);
    expect(S.gold).toBe(0);
    expect(craftWhet('mine')).toBeTruthy();
  });
  it('증표 상점: 부적 = 인연의 증표 1', () => {
    P.tokens = 1;
    expect(buyShop('charm')).toBeNull();
    expect(P.growth.charm).toBe(1);
    expect(P.tokens).toBe(0);
    expect(buyShop('charm')).toMatch(/증표/);
  });
});

describe('§3-4 고유 장비 · 재련', () => {
  it('15종 · 지역마다 3개 · 유물 · 고유 옵션 1 + 일반 3', () => {
    expect(UNIQUES.length).toBe(15);
    const it = makeUnique(UNIQUES.find((u) => u.id === 'u_ice_w')!);
    expect(it.grade).toBe('a');
    expect(it.name).toBe('텐구 깃털 단검');
    expect(it.wkind).toBe('dagger');
    expect(it.opts.length).toBe(4);
    expect(it.opts.filter((o) => o.u).length).toBe(1);
    expect(it.opts[0]).toMatchObject({ k: 'atkPct', v: 18, u: true });
  });
  it('나오는 곳: 확률 · 지역에 없으면(사냥) null · 8시간 원정은 전체에서', () => {
    expect(rollUnique('forest', 0.005, () => 0.006)).toBeNull();
    const u = rollUnique('forest', 0.005, seq(0.004, 0.0));
    expect(u?.uid).toBe('u_forest_w');
    expect(P.bag).toContain(u);
    expect(P.growth.uniques.u_forest_w).toBe(1);
    expect(rollUnique('coast', 1, () => 0)).toBeNull();
    expect(rollUniqueAny('coast', 1, seq(0, 0.99))?.uid).toBe('u_abyss_c');
  });
  it('처음 얻으면 [알림] 자랑 · 두 번째부터 분해 가루 2배', () => {
    const ann = vi.spyOn(uiHooks, 'announce');
    const d = UNIQUES[0];
    const a1 = grantUnique(d);
    expect(ann).toHaveBeenCalledTimes(1);
    expect(uniqueSalvageMult(a1)).toBe(1);
    P.growth.brag.last = 0;
    const a2 = grantUnique(d);
    expect(ann).toHaveBeenCalledTimes(1);
    expect(uniqueSalvageMult(a2)).toBe(2);
    const n0 = P.dust.a;
    salvage(a2);
    expect(P.dust.a - n0).toBe(CONFIG.smith.salvage.a * 2);
  });
  it('고유 효과: 치명타 · 모든 능력치 +5%', () => {
    const a = reg(10);
    const it = makeUnique(UNIQUES.find((u) => u.id === 'u_abyss_c')!);
    P.bag.push(it);
    const p0 = powerOf(a);
    equip(a, it);
    const p1 = powerOf(a);
    expect(specialSum(a, 'allStat')).toBe(5);
    expect(p1).toBeGreaterThan(p0);
    const m = makeUnique(UNIQUES.find((u) => u.id === 'u_mine_w')!);
    P.bag.push(m);
    equip(a, m);
    expect(specialSum(a, 'crit')).toBe(8);
  });
  it('재련: 랜덤 옵션 하나만 바뀜 · 잠그면 비용 ×2 · 고유 옵션은 그대로', () => {
    const it = makeUnique(UNIQUES[3]);
    P.bag.push(it);
    P.dust.a = 1e6;
    S.gold = 1e8;
    expect(reforgeCost(it, 1).dust).toBe(reforgeCost(it).dust * 2);
    expect(reforgeWhy(it, 0)).toMatch(/잠글 수 없/);
    const u0 = { ...it.opts[0] };
    const keep = { ...it.opts[1] };
    for (let i = 0; i < 30; i++) {
      const r = reforge(it, 1);
      expect('err' in r).toBe(false);
      expect(it.opts[0]).toEqual(u0);
      expect(it.opts[1]).toEqual(keep);
      expect(new Set(it.opts.map((o) => o.k)).size).toBe(4);
    }
    const n = makeItem('forest', 'n', 'weapon', false);
    expect(reforgeWhy(n)).toBeTruthy();
  });
});

describe('§3-5 [알림] 자랑 도배 방지', () => {
  it('같은 사람 10분에 1번 · 같은 종류 하루 3번 · 끄기', () => {
    let t = 1_000_000;
    expect(bragAllowed('enh10', t)).toBe(true);
    expect(bragAllowed('relic', t + 60_000)).toBe(false);
    t += 10 * 60_000;
    expect(bragAllowed('enh10', t)).toBe(true);
    t += 10 * 60_000;
    expect(bragAllowed('enh10', t)).toBe(true);
    t += 10 * 60_000;
    expect(bragAllowed('enh10', t)).toBe(false);
    expect(bragAllowed('unique', t)).toBe(true);
    P.growth.bragOff = true;
    expect(bragAllowed('fish', t + 3_600_000)).toBe(false);
  });
  it('+10 강화 성공 → 자랑', () => {
    const ann = vi.spyOn(uiHooks, 'announce');
    const it = makeItem('forest', 'r', 'weapon', false);
    it.enh = 9;
    P.bag.push(it);
    P.dust.r = 1e6;
    for (const b of ['boar', 'mushroom', 'golem', 'wyvern', 'eye']) P.bossMats[b] = 9;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(enhance(it)).toBe('ok');
    expect(it.enh).toBe(10);
    expect(ann).toHaveBeenCalled();
    expect(String(ann.mock.calls[0][0])).toMatch(/\+10 강화에 성공/);
    expect(brag('enh10', it)).toBe(false);
  });
});

describe('§4 낚시', () => {
  it('데이터 20종: 연못 10 · 해안 10 · 박제 가능 4', () => {
    expect(FISH.length).toBe(20);
    expect(FISH.filter((f) => f.where === 'pond').length).toBe(10);
    expect(FISH.filter((f) => f.use.includes('trophy')).length).toBe(4);
  });
  it('미끼: 하루 5 + 여관 5레벨마다 +1 · 작물 1개 = 1 · 다 쓰면 못 던짐', () => {
    const inn = world.objs.find((o) => o.kind === 'inn')!;
    inn.lvl = 5;
    expect(baitMax()).toBe(6);
    inn.lvl = 1;
    expect(baitMax()).toBe(5);
    for (let i = 0; i < 5; i++) expect(cast('pond')).not.toBeNull();
    expect(baitLeft()).toBe(0);
    expect(cast('pond')).toBeNull();
    expect(makeBait()).toMatch(/작물/);
    P.crops.carrot = 2;
    expect(makeBait()).toBeNull();
    expect(baitLeft()).toBe(1);
    expect(P.crops.carrot).toBe(1);
    expect(cast('pond')).not.toBeNull();
  });
  it('판정 창: 입질 뒤 창 안만 성공 (기본 0.5초 · 희귀할수록 짧음)', () => {
    const c = { bite: 2, win: 0.5 };
    expect(judge(c, 1.99)).toBe(false);
    expect(judge(c, 2)).toBe(true);
    expect(judge(c, 2.5)).toBe(true);
    expect(judge(c, 2.51)).toBe(false);
    expect(FISH.find((f) => f.id === 'kingkoi')!.win).toBeLessThan(FISH.find((f) => f.id === 'minnow')!.win);
  });
  it('시간대: 밤 물고기는 낮에 안 나온다', () => {
    for (let i = 0; i < 200; i++) {
      const f = pickFish('pond', Math.random, { night: false, dawn: false });
      expect(f.time === 'night' || f.time === 'dawn').toBe(false);
    }
    const night = new Set(Array.from({ length: 400 }, () => pickFish('sea', Math.random, { night: true, dawn: false }).id));
    expect(night.has('flyingfish')).toBe(false);
  });
  it('기록 · 최대어 · 전설은 자랑 · 쓰임(팔기·요리·박제·놓아주기)', () => {
    const ann = vi.spyOn(uiHooks, 'announce');
    const koi = FISH.find((f) => f.id === 'koi')!;
    expect(land({ fish: koi, size: 40 })).toMatchObject({ first: true, record: true });
    expect(land({ fish: koi, size: 35 })).toMatchObject({ first: false, record: false });
    expect(P.growth.fish.rec.koi).toEqual({ n: 2, max: 40 });
    const king = FISH.find((f) => f.id === 'kingkoi')!;
    land({ fish: king, size: 120 });
    expect(ann).toHaveBeenCalledTimes(1);
    const g0 = S.gold;
    expect(sellFish('koi')).toBe(60);
    expect(S.gold).toBe(g0 + 60);
    expect(cookFish('kingkoi')).toMatch(/요리할 수 없/);
    P.growth.fish.bag.mackerel = 1;
    expect(cookFish('mackerel')).toBeNull();
    expect(mealGold()).toBeCloseTo(0.05);
    expect(stuffFish('kingkoi')).toBeNull();
    expect(P.meta.giftDeco.fish_kingkoi).toBe(1);
    P.growth.fish.bag.starwhale = 1;
    expect(releaseFish('starwhale')).toBeTruthy();
    expect(P.growth.fish.whaleDay).toBe(today());
    P.growth.fish.whaleDay = '2000-01-01';
    dailyFishing();
    expect(P.meta.mail.some((m) => m.title.includes('바다의 노래'))).toBe(true);
  });
});

describe('저장: growth 칸 바로잡기 · 옛 저장', () => {
  it('없으면 기본값 · 이상한 값은 걸러냄 · 있는 값은 그대로', () => {
    (P as { growth: unknown }).growth = { favs: [3, 'x'], charm: 2, fish: { bag: { koi: 2, nope: 3 } }, uniques: { u_ice_w: 1, bad: 2 } };
    sanitizeGrowth();
    expect(P.growth.favs).toEqual([3]);
    expect(P.growth.charm).toBe(2);
    expect(P.growth.fish.bag).toEqual({ koi: 2 });
    expect(P.growth.uniques).toEqual({ u_ice_w: 1 });
    expect(P.growth.hints).toEqual([]);
    (P as { growth: unknown }).growth = undefined;
    sanitizeGrowth();
    expect(P.growth).toEqual(freshGrowth());
  });
  it.skipIf(!fs.existsSync('tests/fixtures/real_ttabam.json'))('실제 저장: 불러와도 장비 강화 수치 그대로', () => {
    for (const f of fs.readdirSync('tests/fixtures').filter((x) => x.startsWith('real_'))) {
      const raw = JSON.parse(fs.readFileSync(`tests/fixtures/${f}`, 'utf8'));
      const d = migrate(JSON.parse(JSON.stringify(raw)));
      expect(d).toBeTruthy();
      const want = (raw.progress?.bag ?? []).map((it: Item) => [it.id, it.enh, JSON.stringify(it.stats)]);
      const got = d.progress.bag.map((it: Item) => [it.id, it.enh, JSON.stringify(it.stats)]);
      expect(got).toEqual(want);
    }
  });
});
