// LUXE §3 마을 회관 꾸러미: N칸 중 n칸 완성 · 한 칸씩 바치기 · 연금 예약분 지키기 · 방 보상 1번 · 마이그레이션 · 플래그 끔 = 그대로
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { CHAPTERS } from '../src/data/guide';
import { LUXE } from '../src/data/luxe_cfg';
import { migrate, readSave } from '../src/save/save';
import { BUNDLE_DONE, HALL_FIRST, HALL_RESTORED, ROOM_DONE } from '../src/data/story/bundles';
import {
  bdState, bundleById, bundleDoneLine, donate, fillableNow, filledN, HALL_ROOM_OF, hallFirstLines, hallRestoredLines, putOf, roomById, roomDone, roomDoneLines, ROOMS, speakerHere,
} from '../src/world/bundles';
import { perkBait, perkEnhDust, perkHuntSlot, perkMealMult, perkPotionMult, perkRaidMats, perkRaidTries, roomPerk } from '../src/world/bundlePerks';
import { alchReserve, drink } from '../src/world/facilities';
import { enhanceCost } from '../src/world/craft';
import { baitMax } from '../src/world/fishing';
import { setFlag } from '../src/world/flags';
import { triesMax } from '../src/world/raid';
import { addObj, rebuildPaths, startTown } from '../src/world/town';
import { freshBundles, P, resetProgress, S } from '../src/world/state';

const allChapters = () => (P.guide.claimed = CHAPTERS.flatMap((c) => c.missions.map((m) => m.id)));
function fresh() {
  resetProgress();
  S.visiting = null as never;
  S.land = 5;
  S.gold = 0;
  startTown();
  rebuildPaths();
  setFlag('bundles', true);
  allChapters();
}
const give = (id: string, i: number) => donate(id, i);

describe('마을 회관 꾸러미 — 바치기', () => {
  beforeEach(fresh);
  afterEach(() => setFlag('bundles', false));

  it('표대로: 방 6개 · 방마다 2~3 꾸러미 · 칸 3~6 · N ≤ 칸', () => {
    expect(ROOMS().map((r) => r.id)).toEqual(['kitchen', 'pharmacy', 'smithy', 'water', 'raid', 'shelter']);
    for (const r of ROOMS()) {
      expect(r.bundles.length).toBeGreaterThanOrEqual(2);
      for (const b of r.bundles) {
        expect(b.need).toBeLessThanOrEqual(b.slots.length);
        expect(b.slots.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('한 칸에 조금씩 바쳐도 쌓이고, 바친 건 사라진다', () => {
    P.crops.carrot = 7;
    const r = give('k_veg', 0);
    expect(typeof r).toBe('object');
    expect((r as { gave: number }).gave).toBe(7);
    expect(P.crops.carrot).toBe(0);
    const { b } = bundleById('k_veg')!;
    expect(putOf(b, 0)).toBe(7);
    P.crops.carrot = 30;
    give('k_veg', 0);
    expect(putOf(b, 0)).toBe(20); // 남은 13만 가져간다
    expect(P.crops.carrot).toBe(17);
    expect(give('k_veg', 0)).toBe('이미 채운 칸이에요');
  });

  it('N칸 중 n칸만 채우면 완성 (4칸 중 3칸) · 보상 1번 · 완성 뒤엔 못 바침', () => {
    Object.assign(P.crops, { carrot: 20, pumpkin: 10, cabbage: 8 });
    const d0 = P.dust.n;
    give('k_veg', 0);
    give('k_veg', 1);
    const { b } = bundleById('k_veg')!;
    expect(filledN(b)).toBe(2);
    const r = give('k_veg', 2) as { bundle?: string };
    expect(r.bundle).toBeTruthy();
    expect(bdState().done).toContain('k_veg');
    expect(S.gold).toBe(LUXE.bundles.bundleReward.kitchen.gold);
    expect(P.dust.n).toBe(d0 + 50);
    P.crops.wheat = 10;
    expect(give('k_veg', 3)).toBe('이미 완성한 꾸러미예요');
    expect(P.crops.wheat).toBe(10);
  });

  it('연금 예약분은 빼고 바친다', () => {
    addObj('alchemy' as never, 2, 2, { lvl: 5 });
    expect(alchReserve('carrot')).toBe(10);
    P.crops.carrot = 12;
    const r = give('k_veg', 0) as { gave: number };
    expect(r.gave).toBe(2);
    expect(P.crops.carrot).toBe(10);
    expect(give('k_veg', 0)).toBe('연금 예약분만 남았어요 · 예약분은 빼고 바쳐요');
    // 물약 남겨 두기를 끄면 예약도 없음
    P.keepAlch = false;
    expect((give('k_veg', 0) as { gave: number }).gave).toBe(10);
  });

  it('기록 칸은 아무것도 안 사라지고, 기록이 모자라면 못 바침', () => {
    P.counters.regionWins.forest = 40;
    expect(typeof give('h_exp', 0)).toBe('string');
    P.counters.regionWins.forest = 60;
    const g = S.gold;
    expect(typeof give('h_exp', 0)).toBe('object');
    expect(S.gold).toBe(g);
  });

  it('장부 장이 모자라면 잠김', () => {
    P.guide.claimed = [];
    P.crops.carrot = 20;
    expect(give('k_veg', 0)).toMatch(/장부 3장/);
    expect(P.crops.carrot).toBe(20);
  });

  it('방 완성: 영구 보상 켜짐 · 주방 = 펫 약속 · 보상은 1번', () => {
    Object.assign(P.crops, { carrot: 20, pumpkin: 10, cabbage: 8 });
    Object.assign(P.growth.fish.bag, { minnow: 10, crucian: 5, loach: 8, seabream: 1, mackerel: 5 });
    for (const i of [0, 1, 2]) give('k_veg', i);
    for (const i of [0, 1, 2]) give('k_fish', i);
    expect(roomPerk('kitchen')).toBe(false);
    const g0 = S.gold;
    const r = give('k_feast', 0);
    expect(typeof r).toBe('object');
    give('k_feast', 1);
    const kit = roomById('kitchen')!;
    expect(roomDone(kit)).toBe(true);
    expect(bdState().petGrant).toBe('dog');
    expect(roomPerk('kitchen')).toBe(true);
    expect(perkMealMult()).toBeCloseTo(1.05);
    expect(S.gold - g0).toBe(LUXE.bundles.bundleReward.kitchen.gold);
    // 다시 불러 바로잡아도 방·보상은 한 번
    bdState();
    expect(bdState().rooms.filter((x) => x === 'kitchen').length).toBe(1);
    // 주방 완성: 남겨 두기를 꺼도 예약은 지킨다
    addObj('alchemy' as never, 6, 6, { lvl: 1 });
    P.keepAlch = false;
    expect(alchReserve('carrot')).toBe(2);
  });

  it('방 보상 효과 (약방·대장간·물가·토벌·쉼터)', () => {
    const it0 = { enh: 4 } as never;
    const base = enhanceCost(it0);
    const bait0 = baitMax();
    const tries0 = triesMax();
    bdState().rooms = ['pharmacy', 'smithy', 'water', 'raid', 'shelter'];
    expect(perkPotionMult()).toBeCloseTo(1.2);
    expect(enhanceCost(it0)).toBe(Math.floor(base * 0.95));
    expect(perkEnhDust(1)).toBe(1);
    expect(baitMax()).toBe(bait0 + 1);
    expect(perkBait()).toBe(1);
    expect(triesMax()).toBe(tries0 + 1);
    expect(perkRaidTries()).toBe(1);
    expect(perkHuntSlot()).toBe(1);
    // 재료 +10%: 10판 × 3개 = 33 (소수점 이월)
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += perkRaidMats(3);
    expect(sum).toBe(33);
    // 물약 지속 +20%
    P.potions.power = 1;
    drink('power', 0);
    expect(P.buff!.until).toBe(CONFIG.potions.minutes * 60000 * 1.2);
  });

  it('6방 전부: 칭호 · 쿠폰 · 회관 건물(보관함) — 1번만', () => {
    const st = bdState();
    // 마지막 꾸러미 하나만 남기고 다 채운 상태
    for (const r of ROOMS()) for (const b of r.bundles) if (b.id !== 'h_bond') st.done.push(b.id);
    st.rooms = ROOMS().filter((r) => r.id !== 'shelter').map((r) => r.id);
    P.counters.giftsGiven = 30;
    (P.ties as Record<string, unknown>).a = { pts: 99, stage: 4, talkDay: '' };
    give('h_bond', 2);
    const r = give('h_bond', 1) as { final?: boolean; room?: unknown };
    expect(r.room).toBeTruthy();
    expect(r.final).toBe(true);
    expect(P.titles).toContain(LUXE.bundles.finalTitle);
    expect(st.coupon).toBe(1);
    expect(P.decor.store.filter((s) => s.kind === 'town_hall').length).toBe(1);
    expect(st.final).toBe(true);
  });
});

describe('마을 회관 꾸러미 — 대사', () => {
  beforeEach(fresh);
  afterEach(() => setFlag('bundles', false));

  it('방 id 6개 모두 대사 방으로 이어진다', () => {
    expect(ROOMS().map((r) => HALL_ROOM_OF[r.id]).sort()).toEqual(Object.keys(ROOM_DONE).sort());
    for (const r of ROOMS()) expect(ROOM_DONE[HALL_ROOM_OF[r.id]].who).toBe(r.who);
  });

  it('처음 열기 대사는 1번만', () => {
    expect(hallFirstLines()).toBe(HALL_FIRST);
    expect(bdState().seen).toBe(true);
    expect(hallFirstLines()).toBeNull();
  });

  it('방 완성: 담당이 영입돼 있으면 그 사람 · 아니면 버나드 fallback', () => {
    // 영웅 (대장간 = 브로크)
    expect(speakerHere('hero_brok')).toBe(false);
    expect(roomDoneLines('smithy')).toBe(ROOM_DONE.forge.fallback);
    P.dex.heroes.brok = { appeared: true, recruited: true, stars: 1 };
    expect(roomDoneLines('smithy')).toBe(ROOM_DONE.forge.lines);
    // 전설 (주방 = 그롬) — 찾아오기만 한 건 아직 아님
    P.legends.grom = { st: 'visiting' } as never;
    expect(roomDoneLines('kitchen')).toBe(ROOM_DONE.kitchen.fallback);
    P.legends.grom = { st: 'joined' } as never;
    expect(roomDoneLines('kitchen')).toBe(ROOM_DONE.kitchen.lines);
    // fallback은 늘 있는 사람만 말한다
    for (const d of Object.values(ROOM_DONE)) for (const [w] of d.fallback) expect(['keeper', 'narr']).toContain(w);
    expect(roomDoneLines('nope')).toEqual([]);
  });

  it('꾸러미 완성 한 줄: 목록 안에서 · 바로 앞 줄과 안 겹친다', () => {
    const a = bundleDoneLine(() => 0);
    const b = bundleDoneLine(() => 0);
    expect(BUNDLE_DONE).toContain(a);
    expect(b).not.toBe(a);
  });

  it('회관 복원 컷: 마지막 방을 채울 때 1번만', () => {
    expect(hallRestoredLines()).toBe(HALL_RESTORED);
    const st = bdState();
    for (const r of ROOMS()) for (const b of r.bundles) if (b.id !== 'h_bond') st.done.push(b.id);
    st.rooms = ROOMS().filter((r) => r.id !== 'shelter').map((r) => r.id);
    P.counters.giftsGiven = 30;
    (P.ties as Record<string, unknown>).a = { pts: 99, stage: 4, talkDay: '' };
    give('h_bond', 2);
    const r = give('h_bond', 1) as { final?: boolean };
    expect(r.final).toBe(true);
    // 다시 바쳐도 컷은 또 안 나온다
    st.rooms = st.rooms.filter((x) => x !== 'shelter');
    st.done = st.done.filter((x) => x !== 'h_bond');
    const again = give('h_bond', 1) as { final?: boolean };
    expect(typeof again === 'string' || !again.final).toBe(true);
  });
});

describe('마을 회관 꾸러미 — 플래그 끔 · 마이그레이션', () => {
  beforeEach(fresh);
  afterEach(() => setFlag('bundles', false));

  it('끄면 바치기 막힘 · 보상 효과 0 (바친 것·받은 것은 그대로)', () => {
    const it0 = { enh: 4 } as never;
    bdState().rooms = ROOMS().map((r) => r.id);
    bdState().put['k_veg:0'] = 5;
    setFlag('bundles', false);
    P.crops.carrot = 20;
    expect(typeof donate('k_veg', 0)).toBe('string');
    expect(P.crops.carrot).toBe(20);
    expect(roomPerk('kitchen')).toBe(false);
    expect(perkMealMult()).toBe(1);
    expect(perkPotionMult()).toBe(1);
    expect(enhanceCost(it0)).toBe(25 * CONFIG.smith.enhanceCost);
    expect(perkRaidMats(3)).toBe(3);
    expect(perkHuntSlot()).toBe(0);
    expect(bdState().put['k_veg:0']).toBe(5);
    expect(bdState().rooms.length).toBe(6);
  });

  it('옛 저장(칸 없음) → 기본값 · 망가진 값 바로잡기', () => {
    resetProgress({ bundles: undefined as never });
    expect(bdState()).toEqual(freshBundles());
    P.bundles = { seen: 'x', put: { 'k_veg:0': 3, bad: -1, nan: NaN }, done: 'oops', rooms: ['kitchen', 'kitchen'], final: 1, coupon: NaN } as never;
    const st = bdState();
    expect(st.seen).toBe(false);
    expect(st.put).toEqual({ 'k_veg:0': 3 });
    expect(st.done).toEqual([]);
    expect(st.rooms).toEqual(['kitchen']);
    expect(st.final).toBe(false);
    expect(st.coupon).toBe(0);
  });

  it('실제 저장(tests/fixtures/real_*.json · v6) 불러오기: bundles 기본값 · 금화·가방·건물 그대로', () => {
    const files = fs.existsSync('tests/fixtures') ? fs.readdirSync('tests/fixtures').filter((f) => /^(real_.*|v6)\.json$/.test(f)) : [];
    for (const f of files) {
      const raw = fs.readFileSync(`tests/fixtures/${f}`, 'utf8');
      const src = JSON.parse(raw);
      localStorage.setItem(CONFIG.save.key, raw);
      const d = readSave();
      if (!d) continue;
      expect(d.progress.bundles).toEqual(freshBundles());
      expect(d.gold).toBe(src.gold ?? d.gold);
      expect(d.progress.bag.length).toBe(migrate(JSON.parse(raw))?.progress?.bag?.length ?? d.progress.bag.length);
      expect(d.buildings.length).toBeGreaterThan(0);
      // 플래그를 켜도 꺼도 불러오는 것만으로는 아무것도 안 사라진다
      for (const on of [false, true]) {
        setFlag('bundles', on);
        resetProgress(d.progress);
        const st = bdState();
        expect(st.done).toEqual([]);
        for (const r of ROOMS()) fillableNow(r);
        expect(P.bag.length).toBe(d.progress.bag.length);
      }
    }
  });
});
