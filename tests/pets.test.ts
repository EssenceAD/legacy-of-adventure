// LUXE §2 펫 「동물 친구」: 확률·천장(정해진 rng) · 활동마다 시도 · 한 번만 · 주방 강아지 1번 · 3마리·효과는 꺼낸 것만 · 쓰다듬기 ×2 · 마이그레이션 · 꺼지면 그대로
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { PETS } from '../src/data/luxe_cfg';
import { FISH } from '../src/data/story/fish';
import { migrate } from '../src/save/save';
import { clearFloor } from '../src/world/abyss';
import { _actorsTest } from '../src/world/actors';
import { makeAdventurer } from '../src/world/adventurers';
import { enhanceCost, harvest, plotsOf, enhance } from '../src/world/craft';
import { makeQuest, resolveRun } from '../src/world/expeditions';
import { brew } from '../src/world/facilities';
import { cast, land } from '../src/world/fishing';
import { setFlag } from '../src/world/flags';
import { clearStage, sweepStage } from '../src/world/hunt';
import { makeItem } from '../src/world/items';
import { catchStar } from '../src/world/legends';
import { achList, achProgress } from '../src/world/meta';
import {
  checkBundlePet, cleanPetIds, closeCard, grantPet, hasPet, PET_IDS, petBrewSave, petCount, petDef, petEnhDust, petExpCut, petFishWin, petFx, petGauge, petHome, petHooks, petHuntGold, petMealMood, petOut, petPlaygroundUnlocked,
  petRaidDmg, petsOut, petSnapshot, petState, petTry, patPet, renamePet,
} from '../src/world/pets';
import { beginRaid, ensureWeek, expectOf, settle, weeklyTarget } from '../src/world/raid';
import { freshPets, P, resetProgress, S, uiHooks, world, type Actor, type Run } from '../src/world/state';
import { addObj, rebuildPaths, startTown } from '../src/world/town';

function fresh() {
  resetProgress();
  S.visiting = null as never;
  S.started = true as never;
  S.land = 5;
  S.gold = 0;
  startTown();
  rebuildPaths();
  setFlag('pets', true);
}
const hi = () => 0.999999;
const lo = () => 0;

describe('펫 — 표 · 확률 · 천장', () => {
  beforeEach(fresh);
  afterEach(() => setFlag('pets', false));

  it('10마리 · 활동 10곳이 하나씩 · 천장 = 확률의 2배 시도', () => {
    expect(PET_IDS).toEqual(['raccoon', 'otter', 'mole', 'salamander', 'griffin', 'tengu', 'starcat', 'slime', 'puppy', 'starfox']);
    expect(new Set(PETS.defs.map((d) => d.src)).size).toBe(10);
    for (const d of PETS.defs) expect(d.pity).toBe(Math.round(2 / d.p));
  });

  it('10마리 모두 그림이 있다 (마을 도트 + 64×64 초상) — 별여우 포함', () => {
    for (const id of PET_IDS) {
      expect(fs.existsSync(`public/assets/pets/pet_${id}.png`), id).toBe(true);
      const pp = fs.readFileSync(`public/assets/portraits/petp_${id}.png`);
      expect([pp.readUInt32BE(16), pp.readUInt32BE(20)], id).toEqual([64, 64]);
    }
  });

  it('rng < p 이면 첫 시도에 만남', () => {
    expect(petTry('fish', lo)).toBe('otter');
    expect(hasPet('otter')).toBe(true);
    expect(petState().got.otter.name).toBe('아기 수달');
  });

  it('운이 없어도 천장(2배) 시도에서 확정 · 그 전엔 안 옴 · 50% 넘으면 힌트 1번', () => {
    const hints: string[] = [];
    petHooks.hint = (id) => hints.push(id);
    const d = petDef('tengu')!;
    for (let i = 1; i < d.pity; i++) expect(petTry('raid', hi)).toBeNull();
    expect(hasPet('tengu')).toBe(false);
    expect(petGauge('tengu')).toBeCloseTo((d.pity - 1) / d.pity);
    expect(hints).toEqual(['tengu']);
    expect(petTry('raid', hi)).toBe('tengu');
    expect(petState().tries.tengu).toBeUndefined();
    petHooks.hint = () => {};
  });

  it('힌트는 게이지 50%를 넘는 그 시도에서', () => {
    const hints: number[] = [];
    petHooks.hint = () => hints.push(petState().tries.starfox);
    for (let i = 0; i < 30; i++) petTry('star', hi);
    expect(hints).toEqual([21]); // 천장 40 → 21/40 > 0.5
    petHooks.hint = () => {};
  });

  it('한 번만: 만난 뒤엔 시도도 안 센다 · grantPet 두 번째는 false', () => {
    petTry('brew', lo);
    expect(petTry('brew', lo)).toBeNull();
    expect(petState().tries.slime).toBeUndefined();
    expect(grantPet('slime')).toBe(false);
    expect(petCount()).toBe(1);
  });

  it('만나면: 카드 대기 · 자리 있으면 마을로 · [소문] 한 줄', () => {
    const rumors: string[] = [];
    const old = uiHooks.rumor;
    uiHooks.rumor = (t) => rumors.push(t);
    S.innName = '솔바람';
    petTry('fish', lo);
    uiHooks.rumor = old;
    expect(rumors).toEqual(['솔바람 여관에 아기 수달이 찾아왔대']);
    uiHooks.rumor = (t) => rumors.push(t);
    S.innName = '롯데캐슬 여관';
    grantPet('mole');
    uiHooks.rumor = old;
    expect(rumors[1]).toBe('롯데캐슬 여관에 꼬마 두더지가 찾아왔대');
    expect(petState().card).toEqual(['otter', 'mole']);
    expect(petState().out).toEqual(['otter', 'mole']);
    expect(closeCard('otter', '  수달이  ')).toBe('out');
    expect(petState().card).toEqual(['mole']);
    expect(petState().got.otter.name).toBe('수달이');
    expect(renamePet('otter', '')).toBe('아기 수달');
  });
});

describe('펫 — 활동마다 시도 1', () => {
  beforeEach(fresh);
  afterEach(() => {
    setFlag('pets', false);
    vi.useRealTimers();
  });
  /** 그 펫의 시도가 1 늘었거나(운 좋게) 바로 만났나 */
  const tried = (id: string, f: () => void) => {
    const before = petState().tries[id] ?? 0;
    f();
    expect((petState().tries[id] ?? 0) === before + 1 || hasPet(id)).toBe(true);
  };

  it('사냥 클리어 · 소탕 → 아기 너구리', () => {
    tried('raccoon', () => clearStage('forest', 1, []));
    tried('raccoon', () => sweepStage('forest', 1, [])!);
  });
  it('낚시 성공 → 아기 수달 (던지기만으론 안 셈)', () => {
    P.growth.fish.day = '';
    const c = cast('pond');
    expect(petState().tries.otter ?? 0).toBe(0);
    tried('otter', () => land({ fish: c?.fish ?? FISH[0], size: 10 }));
  });
  it('텃밭 수확 → 꼬마 두더지', () => {
    const o = addObj('garden', 20, 20);
    plotsOf(o)[0] = { crop: 'carrot', at: 1 };
    tried('mole', () => expect(harvest(o, 0)).toBeGreaterThan(0));
  });
  it('강화 시도 → 불도마뱀', () => {
    addObj('smith', 22, 20);
    const it0 = makeItem('forest', 'n');
    P.dust.n = 1e6;
    tried('salamander', () => expect(['ok', 'fail']).toContain(enhance(it0)));
  });
  it('원정 성공 → 아기 그리핀', () => {
    const a = Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind: 'knight', lvl: 10, hp: 100, mood: 80, food: 80 }) as Actor;
    world.actors.push(a);
    const q = { ...makeQuest('forest', 0), tutorial: true };
    tried('griffin', () => resolveRun({ id: 1, quest: q, members: [a.id], start: 0, end: 0 } as Run, []));
  });
  it('토벌 도전 → 꼬마 텐구 (소탕은 안 셈)', () => {
    setFlag('raidPace', true);
    P.counters.regionWins.forest = 3;
    ensureWeek();
    const t = weeklyTarget();
    tried('tengu', () => settle(t, [], 1000, 'manual', expectOf([], t.boss), beginRaid()!));
  });
  it('심연 층 클리어 → 별고양이', () => {
    tried('starcat', () => clearFloor(1, null, hi));
  });
  it('물약 만들기 → 물약 슬라임', () => {
    addObj('alchemy', 24, 20);
    P.crops.cabbage = 10;
    P.crops.wheat = 10;
    tried('slime', () => expect(brew('rest')).toBeNull());
  });
  it('주점 단골 식사 → 배부른 강아지', () => {
    const a = Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind: 'knight', mood: 50, food: 10 }) as Actor;
    const n0 = P.counters.tavernMeals;
    tried('puppy', () => _actorsTest.fillNeeds(a, 'drink'));
    expect(P.counters.tavernMeals).toBe(n0 + 1);
  });
  it('별똥별 잡기 → 별여우', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T22:00:00'));
    S.night = true as never;
    P.starDay = '';
    P.starN = 0;
    P.legends = { luna: { st: 'rumor', gauge: 10 } } as never;
    tried('starfox', () => expect(catchStar()).toBeTruthy());
  });
  it('꺼지면 어느 활동도 안 센다', () => {
    setFlag('pets', false);
    clearStage('forest', 1, []);
    clearFloor(1, null, hi);
    land({ fish: FISH[0], size: 10 });
    expect(petState().tries).toEqual({});
    expect(petTry('fish', lo)).toBeNull();
    expect(petCount()).toBe(0);
  });
  it('이웃 방문 중엔 안 센다', () => {
    S.visiting = { id: 'x' } as never;
    expect(petTry('fish', lo)).toBeNull();
    S.visiting = null as never;
  });
});

describe('펫 — 마을 회관 「주방」 강아지', () => {
  beforeEach(fresh);
  afterEach(() => setFlag('pets', false));

  it('petGrant 가 있으면 배부른 강아지 1번 · petGiven 표시', () => {
    P.bundles.petGrant = 'dog';
    P.bundles.petGiven = false;
    expect(checkBundlePet()).toBe('puppy');
    expect(P.bundles.petGiven).toBe(true);
    expect(hasPet('puppy')).toBe(true);
    expect(checkBundlePet()).toBeNull();
    expect(petCount()).toBe(1);
  });
  it('이미 강아지가 있으면 표시만 (두 번 안 줌)', () => {
    grantPet('puppy', 'meal');
    P.bundles.petGrant = 'dog';
    expect(checkBundlePet()).toBeNull();
    expect(P.bundles.petGiven).toBe(true);
    expect(petCount()).toBe(1);
  });
  it('꺼져 있으면 기다렸다가 켜지면 준다', () => {
    setFlag('pets', false);
    P.bundles.petGrant = 'dog';
    expect(checkBundlePet()).toBeNull();
    expect(P.bundles.petGiven).toBe(false);
    setFlag('pets', true);
    expect(checkBundlePet()).toBe('puppy');
  });
  it('주방을 안 고쳤으면 없음', () => {
    expect(checkBundlePet()).toBeNull();
  });
});

describe('펫 — 마을 3마리 · 효과 · 쓰다듬기', () => {
  beforeEach(fresh);
  afterEach(() => setFlag('pets', false));

  it('4번째는 펫 집 · 꺼내기는 3마리까지 · 집으로 보내면 자리', () => {
    for (const id of ['raccoon', 'otter', 'mole', 'salamander']) grantPet(id);
    expect(petsOut()).toEqual(['raccoon', 'otter', 'mole']);
    expect(petOut('salamander')).toMatch(/3마리/);
    petHome('mole');
    expect(petOut('salamander')).toBeNull();
    expect(petsOut()).toEqual(['raccoon', 'otter', 'salamander']);
    expect(petSnapshot()).toEqual(['raccoon', 'otter', 'salamander']);
  });

  it('효과는 꺼낸 펫만', () => {
    expect(petHuntGold()).toBe(1);
    grantPet('raccoon');
    grantPet('otter');
    grantPet('griffin');
    grantPet('tengu');
    grantPet('salamander');
    expect(petsOut()).toEqual(['raccoon', 'otter', 'griffin']);
    expect(petHuntGold()).toBeCloseTo(1.02);
    expect(petFishWin()).toBeCloseTo(0.03);
    expect(petExpCut()).toBeCloseTo(0.03);
    expect(petRaidDmg()).toBe(1); // 텐구는 집에
    expect(petEnhDust(1000)).toBe(1000);
    petHome('raccoon');
    petOut('salamander');
    expect(petHuntGold()).toBe(1);
    expect(petEnhDust(1000)).toBe(980);
    expect(petEnhDust(1)).toBe(1);
  });

  it('강화 비용에도 붙는다 (꺼낸 불도마뱀)', () => {
    const it0 = makeItem('forest', 'n');
    it0.enh = 9;
    const c0 = enhanceCost(it0);
    grantPet('salamander');
    expect(enhanceCost(it0)).toBe(Math.max(1, Math.round(c0 * 0.98)));
  });

  it('쓰다듬기: 하루 1번 · 그날 효과 ×2 · 다음 날 다시 ×1', () => {
    grantPet('raccoon');
    const t = Date.UTC(2026, 9, 14, 3);
    expect(petFx('raccoon', t)).toBe(1);
    expect(patPet('raccoon', t)).toBeNull();
    expect(patPet('raccoon', t + 3600e3)).toMatch(/벌써/);
    expect(petFx('raccoon', t)).toBe(2);
    expect(petFx('raccoon', t + 864e5)).toBe(1);
    expect(patPet('raccoon', t + 864e5)).toBeNull();
  });

  it('쓰다듬어도 집에 있으면 효과 0', () => {
    grantPet('slime');
    patPet('slime');
    petHome('slime');
    expect(petFx('slime')).toBe(0);
    expect(petBrewSave(lo)).toBe(false);
    petOut('slime');
    expect(petBrewSave(lo)).toBe(true);
  });

  it('배부른 강아지: 식사한 손님 기분 +1 (꺼냈을 때만)', () => {
    const a = Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind: 'knight', mood: 50, food: 10 }) as Actor;
    grantPet('puppy');
    expect(petMealMood()).toBe(1);
    petHome('puppy');
    expect(petMealMood()).toBe(0);
    void a;
  });

  it('업적: 첫 펫 · 5 · 10 · 10마리 = 펫 놀이터', () => {
    const ach = (id: string) => achProgress(achList().find((d) => d.id === id)!);
    expect(ach('pet1').done).toBe(false);
    grantPet('otter');
    expect(ach('pet1').done).toBe(true);
    for (const id of PET_IDS) grantPet(id);
    expect(ach('pet5').done).toBe(true);
    expect(ach('pet10').done).toBe(true);
    expect(petPlaygroundUnlocked()).toBe(true);
    expect(achList().find((d) => d.id === 'pet10')!.reward.title).toBe('작은 동물원장');
    expect(achList().find((d) => d.id === 'pet1')!.reward.title).toBe('동물 친구');
  });
});

describe('펫 — 저장 · 꺼짐', () => {
  beforeEach(fresh);
  afterEach(() => setFlag('pets', false));

  it('옛 저장(칸 없음) → 빈 펫 칸', () => {
    const d = migrate(JSON.parse(fs.readFileSync('tests/fixtures/v6.json', 'utf8')));
    expect(d).toBeTruthy();
    resetProgress(d.progress);
    expect(petState()).toEqual(freshPets());
  });

  it('망가진 칸 바로잡기', () => {
    P.pets = { got: { otter: { name: '', at: 'x' }, bogus: { name: 'a', at: 1 } }, out: ['otter', 'otter', 'mole', 3], tries: { otter: 5, mole: 'a', raccoon: 7, nope: 1 }, hint: 'x', pat: { otter: 5, mole: '2026-10-14' }, card: ['otter', 'mole'] } as never;
    const st = petState();
    expect(Object.keys(st.got)).toEqual(['otter']);
    expect(st.got.otter.name).toBe('아기 수달');
    expect(st.got.otter.at).toBe(0);
    expect(st.out).toEqual(['otter']);
    expect(st.tries).toEqual({ raccoon: 7 });
    expect(st.hint).toEqual([]);
    expect(st.pat).toEqual({ mole: '2026-10-14' });
    expect(st.card).toEqual(['otter']);
  });

  it('펫 칸 없는 옛 progress 도 resetProgress 뒤 그대로 쓸 수 있다', () => {
    const p = JSON.parse(JSON.stringify(P));
    delete p.pets;
    resetProgress(p);
    grantPet('mole');
    expect(petCount()).toBe(1);
  });

  it('꺼지면: 효과 0 · 업적 목록에서 빠짐 · 놀이터 잠김 · 꺼낸 펫 안 보임 (만난 건 그대로)', () => {
    for (const id of PET_IDS) grantPet(id);
    patPet('raccoon');
    setFlag('pets', false);
    expect(petFx('raccoon')).toBe(0);
    expect(petHuntGold()).toBe(1);
    expect(petFishWin()).toBe(0);
    expect(petEnhDust(500)).toBe(500);
    expect(petsOut()).toEqual([]);
    expect(petSnapshot()).toEqual([]);
    expect(petPlaygroundUnlocked()).toBe(false);
    expect(achList().some((d) => d.stat === 'pets')).toBe(false);
    expect(petCount()).toBe(10);
  });

  it('이웃 모습의 펫 id 정리 (아는 id · 겹침 없이 · 3개)', () => {
    expect(cleanPetIds(['otter', 'otter', 'x', 1, 'mole', 'slime', 'puppy'])).toEqual(['otter', 'mole', 'slime']);
    expect(cleanPetIds('otter')).toEqual([]);
  });

  it('설정 숫자 config 한 곳 (CONFIG를 건드리지 않음)', () => {
    expect((CONFIG as Record<string, unknown>).pets).toBeUndefined();
  });
});
