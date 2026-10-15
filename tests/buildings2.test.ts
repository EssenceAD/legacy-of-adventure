// BUILDINGS2_SPEC (10/16): 땅 6~10 새 건물 7 · 장식 35 — 목록 · 건설 목록 · 효과 숫자
import { beforeEach, describe, expect, it } from 'vitest';
import LIST from '../src/data/buildings2.json';
import { CATALOG, def, type Kind } from '../src/data/catalog';
import { CONFIG } from '../src/data/config';
import { addObj, buildableKinds, canPlace, rebuildPaths, sizeFor, startTown } from '../src/world/town';
import { setFlag } from '../src/world/flags';
import { P, S, world } from '../src/world/state';
import { b2, bake, breadStay, dailyBank, dailyStoreKit, millCut, stageMood, storeMult, academyXp, dockReward, dockTrophy } from '../src/world/buildings2';
import { computeSets } from '../src/world/harmony';

const place = (k: Kind, lvl = 1) => {
  const [w, h] = sizeFor(k, 1);
  for (let y = 0; y < 44; y++) for (let x = 0; x < 44; x++) if (canPlace({ kind: k, tx: x, ty: y, fw: w, fh: h })) return addObj(k, x, y, { lvl });
  throw new Error('no spot ' + k);
};
beforeEach(() => {
  S.visiting = false as never;
  S.land = 10;
  S.night = false;
  S.gold = 1_000_000;
  startTown();
  world.actors = [];
  P.b2 = { flour: 0, bread: 0, bakeAt: 0, kitDay: '', bankDay: '' };
  P.meta.mail = [];
  P.crops = {};
  setFlag('buildings2', true);
  rebuildPaths();
});

describe('BUILDINGS2 목록', () => {
  it('새 건물 7 · 장식 35 — 모두 카탈로그에 · 그림 키 = 이름', () => {
    expect(LIST.buildings).toHaveLength(7);
    expect(LIST.decos).toHaveLength(35);
    for (const it of [...LIST.buildings, ...LIST.decos]) {
      const d = (CATALOG as Record<string, ReturnType<typeof def>>)[it.key];
      expect(d, it.key).toBeTruthy();
      expect(d.sprite).toBe(it.key);
      expect(d.size).toEqual(it.size);
    }
  });
  it('건물: 한 채 · 땅 6~10 · Lv5까지 (값 ×1.5 2.2 3.2 4.5)', () => {
    for (const b of LIST.buildings) {
      const d = def(b.key as Kind);
      expect(d.unique).toBe(true);
      expect(d.unlock).toBe(b.land);
      expect(d.levels).toEqual([1.5, 2.2, 3.2, 4.5].map((k) => Math.round(b.cost * k)));
    }
  });
  it('장식 값: 1칸 5만 · 2칸 10만 · 4칸 20만', () => {
    for (const d of LIST.decos) expect(def(d.key as Kind).cost).toBe(d.size[0] * d.size[1] >= 4 ? 200000 : d.size[0] * d.size[1] === 2 ? 100000 : 50000);
  });
  it('건설 목록: 땅 10이면 새 건물 7 + 장식 29 · 우정 상점 6은 숨김 · 플래그 끄면 다 숨김', () => {
    const ks = buildableKinds();
    const b2k = ks.filter((k) => def(k).b2);
    expect(b2k.filter((k) => !def(k).deco)).toHaveLength(7);
    expect(b2k.filter((k) => def(k).deco)).toHaveLength(29);
    expect(ks).not.toContain('friend_bench');
    setFlag('buildings2', false);
    expect(buildableKinds().some((k) => def(k).b2)).toBe(false);
  });
});

describe('BUILDINGS2 효과', () => {
  it('없으면 효과 0', () => {
    expect(millCut(100)).toBe(0);
    expect(breadStay()).toBe(1);
    expect(dockReward()).toBe(0);
    expect(dockTrophy()).toBe(1);
    expect(academyXp()).toBe(0);
    expect(dailyBank('2026-10-16')).toBe(0);
    expect(dailyStoreKit('2026-10-16')).toBeNull();
  });
  it('잡화점: 주점 ×1.2 · 하루 한 번 꾸러미 3종', () => {
    place('general_store' as Kind);
    expect(storeMult(1)).toBe(1.2);
    const got = dailyStoreKit('2026-10-16');
    expect(got).toBeTruthy();
    expect(Object.values(P.crops).reduce((s, v) => s + v, 0)).toBe(CONFIG.buildings2.store.kitN * 2);
    expect(dailyStoreKit('2026-10-16')).toBeNull();
  });
  it('음유시인 무대: 밤에만 기분 +5', () => {
    place('bard_stage' as Kind);
    expect(stageMood()).toBe(0);
    S.night = true;
    expect(stageMood()).toBe(5);
  });
  it('방앗간: 20% 밀가루 (소수점은 확률)', () => {
    place('grain_mill' as Kind);
    expect(millCut(10, () => 0.99)).toBe(2);
    expect(millCut(3, () => 0)).toBe(1);
    expect(millCut(3, () => 0.99)).toBe(0);
  });
  it('빵집: 10분마다 밀가루 1 → 빵 1 · 재고 상한 · 빵이 있으면 숙박비 +10% (하나 먹음)', () => {
    place('bakery' as Kind);
    const st = b2();
    st.flour = 5;
    st.bakeAt = 1_000_000;
    expect(bake(1_000_000 + 25 * 60000)).toBe(2);
    expect([st.flour, st.bread]).toEqual([3, 2]);
    expect(breadStay()).toBeCloseTo(1.1);
    expect(st.bread).toBe(1);
    st.flour = 100;
    st.bread = 0;
    expect(bake(st.bakeAt + 10 * 60 * 60000)).toBe(20);
  });
  it('은행: 처음 본 날은 기준만 · 다음 날 이자 우편 (상한 = 땅 × 20만)', () => {
    place('bank' as Kind);
    expect(dailyBank('2026-10-16')).toBe(0);
    S.gold = 10_000_000;
    expect(dailyBank('2026-10-17')).toBe(50_000);
    expect(P.meta.mail[0].reward.gold).toBe(50_000);
    expect(dailyBank('2026-10-17')).toBe(0);
    S.gold = 1_000_000_000;
    expect(dailyBank('2026-10-18')).toBe(10 * 200_000);
  });
  it('선착장 +20% · 박제 ×1.5 · 마법 학원 경험치 +10%', () => {
    place('fishing_dock' as Kind);
    place('mage_academy' as Kind);
    expect(dockReward()).toBeCloseTo(0.2);
    expect(dockTrophy()).toBe(1.5);
    expect(academyXp()).toBeCloseTo(0.1);
  });
  it('어울림: 빵 굽는 냄새 · 작은 항구 · 한밤의 공연', () => {
    const near = (anchor: Kind, parts: Kind[]) => {
      const a = place(anchor);
      let i = 0;
      for (const k of parts) {
        const [w, h] = sizeFor(k, 1);
        for (const [dx, dy] of [[-1, 0], [a.fw, 0], [0, -1], [0, a.fh], [-1, 1], [a.fw, 1], [1, -1], [1, a.fh], [-1, 2], [a.fw, 2]]) {
          const t = { kind: k, tx: a.tx + dx, ty: a.ty + dy, fw: w, fh: h };
          if (canPlace(t)) {
            addObj(k, t.tx, t.ty);
            i++;
            break;
          }
        }
      }
      return i;
    };
    expect(near('bakery' as Kind, ['stone_oven', 'bread_rack'] as Kind[])).toBe(2);
    expect(computeSets(world.objs).some((s) => s.id === 46)).toBe(true);
  });
});
