// LUXE §1 명품관: 장부 4장 열림 · 하나씩 사기(보관함) · 이번 주 명품 순환(월요일 0시 KST · 6주마다) · 쿠폰 1번 · 작은 사치 날짜 할인 · 세트 완성(2칸) · 세트 효과 · 플래그 끔 = 그대로
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATALOG, def, type Kind } from '../src/data/catalog';
import { CONFIG } from '../src/data/config';
import { CHAPTERS } from '../src/data/guide';
import { LUXE_SHOP } from '../src/data/luxe_cfg';
import { readSave } from '../src/save/save';
import { hfx } from '../src/world/harmony';
import {
  buyLuxe, buyWhy, couponLeft, dailySaleKind, kstMonthDay, luxeSetFx, luxeSetsIn, lxLockWhy, lxState, nextReturn, ownsLuxe, priceOf, setLxNow, shopUnlocked, weekStart, weeklyItem,
} from '../src/world/luxeShop';
import { setFlag } from '../src/world/flags';
import { buildableKinds, addObj, rebuildPaths, startTown } from '../src/world/town';
import { freshLuxe, P, resetProgress, S, world, type Building } from '../src/world/state';

const DAY = 86400000;
const PRICE = (k: string) => LUXE_SHOP.sets.flatMap((x) => x.items).find((x) => x.kind === k)!.price;
/** 한국 시간 그 날 h시 */
const kst = (y: number, m: number, d: number, h = 12, mi = 0) => Date.UTC(y, m - 1, d, h - 9, mi);
const chaptersUpTo = (n: number) => (P.guide.claimed = CHAPTERS.filter((c) => c.no <= n).flatMap((c) => c.missions.map((m) => m.id)));
function fresh() {
  resetProgress();
  S.visiting = null as never;
  S.land = 7;
  S.gold = 1e9;
  startTown();
  rebuildPaths();
  P.guide.legacy = false as never;
  chaptersUpTo(99);
  setFlag('luxeShop', true);
  setLxNow(kst(2026, 10, 14));
}

describe('명품관 — 열림 · 사기', () => {
  beforeEach(fresh);
  afterEach(() => {
    setFlag('luxeShop', false);
    setLxNow(null);
  });

  it('장부 4장 전엔 잠김 + 이유 · 4장을 마치면 열림', () => {
    chaptersUpTo(3);
    expect(shopUnlocked()).toBe(false);
    expect(lxLockWhy()).toBe('장부 4장에 열려요');
    expect(buyWhy('moon_lantern')).toBe('장부 4장에 열려요');
    chaptersUpTo(4);
    expect(shopUnlocked()).toBe(true);
    expect(lxLockWhy()).toBe('');
    expect(buyWhy('moon_lantern')).toBe('');
  });

  it('16 세트 장식 + 6 주간 + 6 작은 사치가 장식으로 등록 · 건설 목록엔 없음 · 값은 cfg', () => {
    const set = LUXE_SHOP.sets.flatMap((s) => s.items);
    expect(set.length).toBe(16);
    for (const it of [...set, ...LUXE_SHOP.weekly, ...LUXE_SHOP.small]) {
      expect(it.kind in CATALOG).toBe(true);
      const d = def(it.kind as Kind);
      expect(d.deco).toBe(true);
      expect(d.cost).toBe(it.price);
      expect(buildableKinds()).not.toContain(it.kind);
    }
    expect(set.every((x) => def(x.kind as Kind).unique)).toBe(true);
  });

  it('하나씩만: 사면 보관함으로 · 금화 빠짐 · 두 번째는 막힘 (마을에 놓아도)', () => {
    const g = S.gold;
    const r = buyLuxe('moon_lantern');
    expect('ok' in r).toBe(true);
    expect(S.gold).toBe(g - PRICE('moon_lantern'));
    expect(P.decor.store.some((s) => s.kind === 'moon_lantern' && s.paid === PRICE('moon_lantern'))).toBe(true);
    expect(ownsLuxe('moon_lantern')).toBe(true);
    expect(buyWhy('moon_lantern')).toMatch(/이미 있어요/);
    // 보관함에서 꺼내 마을에 놓아도 하나뿐
    P.decor.store = [];
    addObj('moon_lantern' as Kind, 20, 20);
    expect(buyWhy('moon_lantern')).toMatch(/이미 있어요/);
    expect(lxState().got).toEqual(['moon_lantern']);
    expect(lxState().spent).toBe(PRICE('moon_lantern'));
  });

  it('금화가 모자라면 이유 · 작은 사치는 여러 개', () => {
    S.gold = 10;
    expect(buyWhy('moon_gazebo')).toMatch(/모자라요/);
    S.gold = 1e7;
    expect('ok' in buyLuxe('lx_pot_blue')).toBe(true);
    expect('ok' in buyLuxe('lx_pot_blue')).toBe(true);
    expect(P.decor.store.filter((s) => s.kind === 'lx_pot_blue').length).toBe(2);
  });
});

describe('이번 주 명품 — 순환', () => {
  beforeEach(fresh);
  afterEach(() => {
    setFlag('luxeShop', false);
    setLxNow(null);
  });

  it('월요일 0시(KST)에 바뀐다: 일요일 23:59 ≠ 월요일 00:00', () => {
    const sun = kst(2026, 10, 18, 23, 59);
    const mon = kst(2026, 10, 19, 0, 0);
    expect(weekStart(mon)).toBe(mon);
    expect(weekStart(sun)).toBe(kst(2026, 10, 12, 0, 0));
    expect(weeklyItem(sun).kind).toBe('gold_carriage');
    expect(weeklyItem(mon).kind).toBe('dragon_nest');
    // UTC로는 일요일 15:00 = KST 월요일 0시 (기기 시계 시간대와 상관없음)
    expect(new Date(mon).getUTCDay()).toBe(0);
  });

  it('6주마다 같은 것이 돌아온다 · 「다음에 돌아오는 날」 = 6주 뒤 월요일', () => {
    const t0 = kst(2026, 10, 14);
    const seen: string[] = [];
    for (let w = 0; w < 12; w++) seen.push(weeklyItem(t0 + w * 7 * DAY).kind);
    expect(seen.slice(0, 6)).toEqual(LUXE_SHOP.weekly.map((x) => x.kind));
    expect(seen.slice(6)).toEqual(seen.slice(0, 6));
    expect(nextReturn('gold_carriage', t0)).toBe(kst(2026, 11, 23, 0, 0));
    expect(kstMonthDay(nextReturn('gold_carriage', t0))).toBe('11월 23일');
    // 이번 주가 아닌 것: 가장 가까운 앞날
    expect(nextReturn('dragon_nest', t0)).toBe(kst(2026, 10, 19, 0, 0));
    // 아주 먼 앞날·지난날도 같은 순환 (음수 주)
    expect(weeklyItem(kst(2026, 9, 1)).kind).toBe(LUXE_SHOP.weekly[((Math.round((weekStart(kst(2026, 9, 1)) - kst(2026, 10, 12, 0)) / (7 * DAY)) % 6) + 6) % 6].kind);
  });

  it('그 주에만 산다 · 이번 주 것은 금화로', () => {
    expect(buyWhy('dragon_nest')).toMatch(/이번 주 명품이 아니에요 · 10월 19일/);
    S.gold = 2e7;
    expect('ok' in buyLuxe('gold_carriage')).toBe(true);
    expect(S.gold).toBe(0);
    setLxNow(kst(2026, 10, 19, 0, 0));
    S.gold = 2e7;
    expect(buyWhy('gold_carriage')).toMatch(/이미 있어요/);
    expect('ok' in buyLuxe('dragon_nest')).toBe(true);
  });

  it('마을 회관 쿠폰: 「이번 주 명품」만 · 한 번 무료 · 다 쓰면 끝', () => {
    expect(couponLeft()).toBe(0);
    expect(buyWhy('gold_carriage', { coupon: true })).toBe('쿠폰이 없어요');
    P.bundles.coupon = 1;
    expect(buyWhy('moon_lantern', { coupon: true })).toMatch(/이번 주 명품/);
    S.gold = 5;
    const r = buyLuxe('gold_carriage', { coupon: true });
    expect('ok' in r && r.paid).toBe(0);
    expect(S.gold).toBe(5);
    expect(P.bundles.coupon).toBe(0);
    expect(lxState().coupons).toBe(1);
    expect(P.decor.store.find((s) => s.kind === 'gold_carriage')?.paid).toBe(0);
    setLxNow(kst(2026, 10, 19));
    expect(buyWhy('dragon_nest', { coupon: true })).toBe('쿠폰이 없어요');
  });
});

describe('작은 사치 — 오늘 할인', () => {
  beforeEach(fresh);
  afterEach(() => {
    setFlag('luxeShop', false);
    setLxNow(null);
  });
  it('한국 날짜로 정해진다 (같은 날 = 같은 것 · 0시에 바뀔 수 있음) · −30%', () => {
    const a = dailySaleKind(kst(2026, 10, 14, 0, 1));
    expect(dailySaleKind(kst(2026, 10, 14, 23, 59))).toBe(a);
    const kinds = new Set<string>();
    for (let d = 0; d < 30; d++) kinds.add(dailySaleKind(kst(2026, 10, 1) + d * DAY));
    expect(kinds.size).toBeGreaterThan(2);
    const t = kst(2026, 10, 14);
    setLxNow(t);
    const k = dailySaleKind(t);
    const base = LUXE_SHOP.small.find((x) => x.kind === k)!.price;
    expect(priceOf(k, t)).toBe(Math.round(base * 0.7));
    const other = LUXE_SHOP.small.find((x) => x.kind !== k)!;
    expect(priceOf(other.kind, t)).toBe(other.price);
    // 세트·주간은 할인 없음
    expect(priceOf('moon_lantern', t)).toBe(PRICE('moon_lantern'));
  });
});

describe('명품 세트 — 완성 · 효과', () => {
  beforeEach(fresh);
  afterEach(() => {
    setFlag('luxeShop', false);
    setLxNow(null);
  });
  const place = (kinds: [string, number, number][]) => kinds.map(([k, x, y]) => addObj(k as Kind, x, y));

  it('중심(4점)에서 2칸 안에 셋 → 완성 · 3칸 떨어지면 아님', () => {
    // 초승달 정자 3×3 @ (14,14)-(16,16)
    const ms = place([['moon_gazebo', 14, 14], ['moon_lantern', 18, 14], ['silver_bench', 14, 18], ['moon_pond', 11, 14]]);
    expect(luxeSetsIn(world.objs).map((h) => h.set.id)).toEqual(['moon']);
    // 벤치를 3칸 떨어지게
    ms[2].ty = 20;
    expect(luxeSetsIn(world.objs)).toEqual([]);
  });

  it('효과: 광장 = 피해 +1% · 꽃 = 손님 +3% · 서재 = 경험치 +2% (hfx에 더해짐) · 달빛 = 밤 기분', () => {
    const d0 = hfx('dmg');
    const a0 = hfx('arrive');
    place([['victory_arch', 14, 14], ['flag_pole', 16, 14], ['weapon_rack', 13, 13], ['hero_trainer', 14, 16]]);
    place([['flower_clock', 22, 14], ['flower_tower', 25, 14], ['flower_swing', 21, 14], ['flower_carousel', 22, 17]]);
    place([['star_library', 22, 22], ['star_telescope', 24, 22], ['float_books', 21, 22], ['armillary', 22, 24]]);
    expect(luxeSetFx('dmg')).toBeCloseTo(0.01);
    expect(luxeSetFx('arrive')).toBeCloseTo(0.03);
    expect(luxeSetFx('xp')).toBeCloseTo(0.02);
    expect(hfx('dmg') - d0).toBeCloseTo(0.01);
    expect(hfx('arrive') - a0).toBeCloseTo(0.03);
    // 이웃 마을을 보는 중엔 0
    S.visiting = { id: 'x' } as never;
    expect(luxeSetFx('dmg')).toBe(0);
    S.visiting = null as never;
  });

  it('공사 중인 장식은 세지 않는다', () => {
    const ms = place([['moon_gazebo', 14, 14], ['moon_lantern', 18, 14], ['silver_bench', 14, 18], ['moon_pond', 11, 14]]);
    (ms[1] as Building).build = 0.5;
    expect(luxeSetsIn(world.objs)).toEqual([]);
  });
});

describe('플래그 끔 = 아무것도 안 함 · 저장', () => {
  beforeEach(fresh);
  afterEach(() => setLxNow(null));

  it('끄면 못 사고 · 세트 효과 0 · 산 것은 그대로', () => {
    buyLuxe('moon_lantern');
    addObj('victory_arch' as Kind, 14, 14);
    addObj('flag_pole' as Kind, 16, 14);
    addObj('weapon_rack' as Kind, 13, 13);
    addObj('hero_trainer' as Kind, 14, 16);
    expect(luxeSetFx('dmg')).toBeCloseTo(0.01);
    setFlag('luxeShop', false);
    const g = S.gold;
    expect(buyWhy('silver_bench')).toBe('준비 중이에요');
    expect('err' in buyLuxe('silver_bench')).toBe(true);
    expect(S.gold).toBe(g);
    expect(luxeSetFx('dmg')).toBe(0);
    expect(P.decor.store.some((s) => s.kind === 'moon_lantern')).toBe(true);
  });

  it('옛 저장(칸 없음) → 기본값 · 망가진 값 바로잡기', () => {
    resetProgress({ luxe: undefined as never });
    expect(lxState()).toEqual(freshLuxe());
    P.luxe = { got: ['moon_lantern', 'moon_lantern', 'nope', 3], spent: NaN, coupons: -2, seen: 'y', week: 5 } as never;
    const st = lxState();
    expect(st.got).toEqual(['moon_lantern']);
    expect(st.spent).toBe(0);
    expect(st.coupons).toBe(0);
    expect(st.seen).toBe(false);
    expect(st.week).toBe('');
  });

  it('실제 저장(tests/fixtures/real_*.json) 불러오기: luxe 기본값 · 금화·보관함·건물 그대로 (켬/끔)', () => {
    const files = fs.existsSync('tests/fixtures') ? fs.readdirSync('tests/fixtures').filter((f) => /^real_.*\.json$/.test(f)) : [];
    for (const f of files) {
      const raw = fs.readFileSync(`tests/fixtures/${f}`, 'utf8');
      localStorage.setItem(CONFIG.save.key, raw);
      const d = readSave();
      if (!d) continue;
      expect(d.progress.luxe).toEqual(freshLuxe());
      for (const on of [false, true]) {
        setFlag('luxeShop', on);
        resetProgress(d.progress);
        world.objs = d.buildings.map((b) => ({ ...b, inside: [] }) as unknown as Building);
        lxState();
        const store = P.decor.store.length;
        expect(luxeSetFx('dmg')).toBe(0);
        expect(P.decor.store.length).toBe(store);
        expect(world.objs.length).toBe(d.buildings.length);
      }
    }
    setFlag('luxeShop', false);
  });
});
