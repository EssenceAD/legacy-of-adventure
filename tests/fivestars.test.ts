// FIVESTARS 「다섯 별의 원정대」 (플래그 fiveStars): 장 열림(3막 전/후) · 5칸 진행 · 합류 → 파티 4곳 · 세트 2/3/4 · 본인 배지 · 내보내기/거절 제외 · 마지막 보상 1번 · 꺼짐이면 아무것도
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { STAR_IDS, STARS } from '../src/data/fivestars';
import { FIVE_DREAM, FIVE_SHARD, FIVE_TITLE } from '../src/data/story/fivestars';
import { makeAdventurer, makeLegend, powerOf } from '../src/world/adventurers';
import { dismissWhy } from '../src/world/dismiss';
import { cameoNext, makeCameo } from '../src/world/easter';
import { partyEligible } from '../src/world/expeditions';
import {
  constellationOn, fiveAtk, fiveGold, fiveHpMult, fiveLedger, fiveNightWin, fiveRaidKill, fiveSetCutDue, fiveState, fiveStealth, fiveTick, fiveTimeCut, fiveWanderMult, isSelfStar, makeStar, setSelfStar, starGoals,
} from '../src/world/fivestars';
import { FLAG_DEFAULTS, setFlag } from '../src/world/flags';
import { optSum } from '../src/world/items';
import { isMythic, mythicAtk, mythicQuestGold, mythicTimeCut } from '../src/world/mythic';
import { partyBlock, partyReady } from '../src/world/partyRules';
import { raidCrew } from '../src/world/raid';
import { propExempt } from '../src/world/storyInbox';
import { P, resetProgress, S, world, type Actor, type Item } from '../src/world/state';
import { readSave } from '../src/save/save';
import { heroCardHtml } from '../src/ui/heroCard';
import { nameTag } from '../src/ui/common';

const F = CONFIG.fiveStars;
function act3(letter = 2) {
  P.story.act = 3;
  P.story.letter = letter;
  P.story.actDay = { 3: S.day };
}
const reg = (lvl = 20) => {
  const a = makeAdventurer(5, 5, { status: 'regular', lvl });
  world.actors.push(a);
  return a;
};
const item = (o: Partial<Item>): Item => {
  const it = { id: P.nextItemId++, region: 'forest', slot: 'weapon', grade: 'e', name: 'x', stats: { atk: 5 }, opts: [], enh: 0, set: false, owner: null, ...o } as Item;
  P.bag.push(it);
  return it;
};
const give = (a: Actor, it: Item) => {
  it.owner = a.id;
  a.equip[it.slot] = it.id;
};
/** 칸을 다 채우고 합류할 때까지 */
function joinAll() {
  const f = fiveState();
  f.done = [...STAR_IDS];
  const out = [];
  for (let i = 0; i < 6; i++) out.push(fiveTick());
  return out;
}

beforeEach(() => {
  resetProgress();
  world.actors.length = 0;
  world.objs.length = 0;
  world.home = null;
  S.day = 5;
  S.night = false;
  S.visiting = null as never;
  setFlag('fiveStars', true);
  setSelfStar(null);
  document.body.innerHTML = '<div id="toast"></div>';
});
afterEach(() => setFlag('fiveStars', false));

describe('플래그', () => {
  it('기본 꺼짐 · public/flags.json도 꺼짐', () => {
    expect(FLAG_DEFAULTS.fiveStars).toBe(false);
    expect(JSON.parse(fs.readFileSync('public/flags.json', 'utf8')).fiveStars).toBe(false);
  });
  it('꺼짐: 3막이어도 장·편지 없음 · 장부 칸 없음 · 꿈 한 줄 없음 · 신화 아님', () => {
    setFlag('fiveStars', false);
    act3();
    expect(fiveTick()).toBeNull();
    expect(P.five.open).toBe(false);
    expect(fiveLedger()).toBeNull();
    const c = makeCameo('woongs', 5, 5);
    const lines = Array.from({ length: 6 }, () => cameoNext(c).line);
    expect(lines).not.toContain(FIVE_DREAM.woongs);
    const a = makeStar('woongs', 5, 5);
    expect(isMythic(a)).toBe(false);
    expect(fiveAtk([a, a])).toBe(1);
  });
});

describe('장 열림 · 5칸', () => {
  it('3막 전 세이브: 장 안 열림', () => {
    P.story.act = 2;
    expect(fiveTick()).toBeNull();
    expect(fiveLedger()).toBeNull();
  });
  it('3막 편지를 받기만 했으면 그날은 기다리고, 하루 지나면 열림', () => {
    act3(1);
    expect(fiveTick()).toBeNull();
    S.day++;
    expect(fiveTick()).toEqual({ kind: 'letter' });
  });
  it('3막 세이브: 편지 → 장 열림 · 기준값 기록 · 5칸 진행', () => {
    act3();
    P.counters.eventsSolved = 7;
    P.counters.guestTalks = 30;
    P.counters.harvests = 50;
    expect(fiveTick()).toEqual({ kind: 'letter' });
    expect(fiveTick()).toBeNull();
    const cells = fiveLedger()!;
    expect(cells.map((c) => c.id)).toEqual(STAR_IDS);
    // 받은 뒤부터 센다
    expect(starGoals('gonu')[0].cur).toBe(0);
    P.counters.eventsSolved += 2;
    expect(starGoals('gonu')[0]).toMatchObject({ cur: 2, need: F.gonu.events });
    P.counters.guestTalks += 9;
    expect(starGoals('walwal')[1]).toMatchObject({ cur: F.walwal.talks, need: F.walwal.talks });
    P.counters.harvests += 2;
    expect(starGoals('warmnight')[1].cur).toBe(2);
    P.counters.regionWins.forest += 4;
    P.counters.regionWins.swamp += 1;
    P.hunt.firstClear.push('mine-1', 'mine-2', 'coast-1');
    expect(starGoals('warmnight')[0].cur).toBe(4);
    expect(starGoals('ikamolly')[1].cur).toBe(5);
  });
  it('웅스: +12 장비 2개 낀 파티로 토벌 처치만 · 왈왈: 밤 원정 모두 체력 60 이상만', () => {
    act3();
    fiveTick();
    const a = reg();
    const b = reg();
    fiveRaidKill([a, b]);
    expect(P.five.woongsKills).toBe(0);
    give(a, item({ enh: 12 }));
    give(b, item({ enh: 13, slot: 'armor' }));
    fiveRaidKill([a, b]);
    expect(starGoals('woongs')[0].cur).toBe(1);
    a.hp = 59;
    b.hp = 90;
    fiveNightWin([a, b]);
    expect(P.five.walwalNights).toBe(0);
    a.hp = 60;
    fiveNightWin([a, b]);
    expect(P.five.walwalNights).toBe(1);
  });
  it('이카몰리 세트: 같은 지역 세트 3부위를 낀 단골', () => {
    act3();
    fiveTick();
    const a = reg();
    for (const slot of ['weapon', 'armor', 'acc'] as const) give(a, item({ slot, set: true, region: 'swamp' }));
    expect(starGoals('ikamolly')[0].cur).toBe(1);
  });
});

describe('합류 · 파티 · 세트', () => {
  it('칸을 채우면 합류 (신화 · starId · 영웅 동료) → 원정·사냥·토벌·심연 후보', () => {
    act3();
    reg(30);
    fiveTick();
    P.counters.harvests += 99;
    const f = fiveState();
    f.woongsKills = 1;
    const ev = fiveTick()!;
    expect(ev.kind).toBe('join');
    if (ev.kind !== 'join') return;
    expect(ev.id).toBe('woongs');
    const a = ev.actor;
    expect(world.actors).toContain(a);
    expect(a).toMatchObject({ starId: 'woongs', status: 'hero', kind: 'dwarf', race: 'human', name: STARS.woongs.name, rarity: 'legend' });
    expect(a.lvl).toBeGreaterThanOrEqual(F.joinLvlMin);
    expect(isMythic(a)).toBe(true);
    // 파티 후보 (네 곳 한 규칙 + 토벌 후보)
    expect(partyEligible(a)).toBe(true);
    for (const w of ['exp', 'hunt', 'raid', 'abyss'] as const) {
      expect(partyBlock(a, w)).toBeNull();
      expect(partyReady(w)).toContain(a);
    }
    expect(raidCrew()).toContain(a);
    // 내보내기 · 거절 자동화(제안 거르기)에서 빠짐
    expect(dismissWhy(a)).not.toBeNull();
    expect(propExempt({ special: true, regulars: 3, chapters: 3 } as never)).toBe(true);
    // 다시 불러도 두 번 합류하지 않음
    expect(fiveTick()).toBeNull();
    expect(world.actors.filter((x) => x.starId === 'woongs').length).toBe(1);
  });
  it('능력치: 전설 × 1.15 (플래그 끄면 전설 그대로)', () => {
    const s = makeStar('gonu', 5, 5);
    s.lvl = 20;
    const l = makeLegend('nyx', 5, 5);
    l.status = 'hero';
    l.lvl = 20;
    l.kind = 'rogue';
    l.race = s.race;
    const p1 = powerOf(s);
    setFlag('fiveStars', false);
    const p0 = powerOf(s);
    expect(p1 / p0).toBeCloseTo(1.15, 2);
  });
  it('스킬: 웅스 무기 강화 % · 고느끼 치명·은밀 · 이카몰리 시간 · 왈왈 체력 · 따뜻한밤 지역 피해·떠돌이', () => {
    const w = makeStar('woongs', 5, 5);
    w.id = 901;
    world.actors.push(w);
    give(w, item({ enh: 25 }));
    expect(optSum(w, 'atkPct')).toBe(15);
    expect(fiveAtk([w])).toBeCloseTo(1 + F.woongsEnhMax / 100);
    const g = makeStar('gonu', 5, 5);
    expect(optSum(g, 'critPct')).toBe(12);
    expect(fiveStealth([g], 0.6)).toBeCloseTo(0.8);
    expect(fiveStealth([g], 0.3)).toBeCloseTo(0.5);
    const i = makeStar('ikamolly', 5, 5);
    expect(fiveTimeCut([i])).toBeCloseTo(0.1);
    expect(mythicTimeCut([i])).toBeCloseTo(0.1);
    const ww = makeStar('walwal', 5, 5);
    expect(optSum(ww, 'hpSave')).toBe(30);
    const h = makeStar('warmnight', 5, 5);
    expect(optSum(h, 'anyDmg')).toBe(10);
    expect(fiveWanderMult([h])).toBe(1.5);
  });
  it('세트 「다섯 별」 2/3/4', () => {
    const [a, b, c, d] = (['gonu', 'ikamolly', 'walwal', 'warmnight'] as const).map((id) => makeStar(id, 5, 5));
    const x = reg();
    const warm = 1 + F.warmAtk;
    expect(fiveAtk([b, x])).toBe(1);
    expect(fiveAtk([a, b])).toBeCloseTo(1 + F.set2Atk);
    expect(mythicAtk([a, b])).toBeCloseTo(1 + F.set2Atk);
    expect(fiveHpMult([a, b])).toBe(1);
    expect(fiveHpMult([a, b, c])).toBeCloseTo(1 - F.set3Hp);
    expect(fiveGold([a, b, c])).toBe(1);
    expect(fiveGold([a, b, c, d])).toBeCloseTo(1 + F.set4Gold);
    expect(mythicQuestGold([a, b, c, d], false)).toBeCloseTo(1 + F.set4Gold);
    expect(fiveAtk([a, b, c, d])).toBeCloseTo((1 + F.set2Atk) * warm);
    // 4명 첫 전투 컷: 한 번만
    expect(fiveSetCutDue([a, b, c])).toBe(false);
    expect(fiveSetCutDue([a, b, c, d])).toBe(true);
    expect(fiveSetCutDue([a, b, c, d])).toBe(false);
  });
  it('본인 계정: 본인 배지 · 일반 계정: 없음', () => {
    const a = makeStar('ikamolly', 5, 5);
    expect(isSelfStar(a)).toBe(false);
    expect(nameTag(a)).not.toContain('본인');
    expect(heroCardHtml(a)).not.toContain('hcd-me');
    setSelfStar('ikamolly');
    expect(isSelfStar(a)).toBe(true);
    expect(nameTag(a)).toContain('본인');
    expect(heroCardHtml(a)).toContain('hcd-me');
    expect(isSelfStar(makeStar('gonu', 5, 5))).toBe(false);
  });
});

describe('다섯 다 모이면', () => {
  it('마지막 컷 · 열쇠 조각 · 깃발 · 칭호 1번만 · 별자리', () => {
    act3();
    fiveTick();
    const ev = joinAll();
    expect(ev.filter((e) => e?.kind === 'join').length).toBe(5);
    expect(ev.some((e) => e?.kind === 'final')).toBe(true);
    expect(P.legacy.shards.filter((s) => s === FIVE_SHARD).length).toBe(1);
    expect(P.decor.store.filter((s) => s.kind === 'five_flag').length).toBe(1);
    expect(P.titles.filter((t) => t === FIVE_TITLE).length).toBe(1);
    expect(constellationOn()).toBe(true);
    // 다시 돌려도 더 안 줌
    for (let i = 0; i < 5; i++) expect(fiveTick()).toBeNull();
    P.five.final = false; // (만약 기록이 꼬여도) 보상은 겹치지 않게
    fiveTick();
    expect(P.legacy.shards.filter((s) => s === FIVE_SHARD).length).toBe(1);
    expect(P.decor.store.filter((s) => s.kind === 'five_flag').length).toBe(1);
    expect(P.titles.filter((t) => t === FIVE_TITLE).length).toBe(1);
  });
  it('합류했는데 마을에 없으면 다시 들인다 (잃지 않음)', () => {
    act3();
    fiveTick();
    joinAll();
    world.actors = world.actors.filter((a) => a.starId !== 'gonu');
    fiveTick();
    expect(world.actors.filter((a) => a.starId === 'gonu').length).toBe(1);
  });
  it('2막부터 카메오 꿈 한 줄 · 합류한 개척자는 꿈 없음', () => {
    P.story.act = 2;
    const c = makeCameo('gonu', 5, 5);
    const lines = Array.from({ length: 6 }, () => cameoNext(c).line);
    expect(lines).toContain(FIVE_DREAM.gonu);
    P.story.act = 1;
    const c1 = makeCameo('gonu', 5, 5);
    expect(Array.from({ length: 6 }, () => cameoNext(c1).line)).not.toContain(FIVE_DREAM.gonu);
  });
});

// 실제 저장 리플레이 (로컬 전용 fixtures): 플래그 켬/끔 모두 — 불러오고 3막으로 올려 다섯을 다 합류시켜도 금화·아이템·건물·단골이 줄지 않는다
const REAL = fs.existsSync('tests/fixtures') ? fs.readdirSync('tests/fixtures').filter((f) => f.startsWith('real_') && f.endsWith('.json')) : [];
describe.skipIf(!REAL.length)('실제 저장 리플레이', () => {
  for (const f of REAL)
    for (const on of [false, true])
      it(`${f} · fiveStars ${on ? '켬' : '끔'}`, () => {
        const raw = JSON.parse(fs.readFileSync('tests/fixtures/' + f, 'utf8'));
        localStorage.setItem(CONFIG.save.key, JSON.stringify(raw));
        const d = readSave()!;
        expect(d).not.toBeNull();
        resetProgress(d.progress);
        S.gold = d.gold;
        S.day = d.day;
        world.objs = d.buildings.map((b) => ({ ...b, inside: [] }) as never);
        world.actors = d.adventurers.map((a) => Object.assign(makeAdventurer(a.x, a.y), a));
        setFlag('fiveStars', on);
        const before = { gold: S.gold, items: P.bag.length, objs: world.objs.length, advs: world.actors.length, enh: P.bag.reduce((s, it) => s + it.enh, 0), store: P.decor.store.length };
        for (let i = 0; i < 3; i++) fiveTick();
        // 3막으로 올리고 다섯 다
        act3();
        fiveTick();
        joinAll();
        expect(S.gold).toBeGreaterThanOrEqual(before.gold);
        expect(P.bag.length).toBe(before.items);
        expect(P.bag.reduce((s, it) => s + it.enh, 0)).toBe(before.enh);
        expect(world.objs.length).toBe(before.objs);
        expect(world.actors.length).toBe(before.advs + (on ? 5 : 0));
        expect(P.decor.store.length).toBe(before.store + (on ? 1 : 0));
        // 저장 → 다시 불러오기: starId 그대로
        if (on) {
          const re = JSON.parse(JSON.stringify({ ...raw, progress: P, adventurers: world.actors.map((a) => ({ ...a, at: null, bub: null, door: null, path: null, then: null })) }));
          localStorage.setItem(CONFIG.save.key, JSON.stringify(re));
          const d2 = readSave()!;
          expect(d2.adventurers.filter((a) => a.starId).length).toBe(5);
          expect(d2.progress.five.joined.length).toBe(5);
        }
      });
});

describe('§5 다섯 번째 개척자 왈왈콩선생', () => {
  it('꺼짐: 개척자 넷 그대로 · 크레딧 넷 · 왈왈 편지 없음', async () => {
    const { pioneerIds, isPioneer, pioneerCredit, cameoPick } = await import('../src/world/easter');
    const { PIONEER_CREDIT } = await import('../src/data/story/easter');
    setFlag('fiveStars', false);
    expect(pioneerIds()).toEqual(['woongs', 'gonu', 'warmnight', 'ikamolly']);
    expect(isPioneer('walwal')).toBe(false);
    expect(pioneerCredit()).toBe(PIONEER_CREDIT);
    for (let i = 0; i < 50; i++) expect(cameoPick(null)).not.toBe('walwal');
  });
  it('켬: 다섯 · 크레딧 다섯 이름 · 칭호·장식 데이터 · 카메오 대사', async () => {
    const { pioneerIds, isPioneer, pioneerCredit, PIONEER_DECO } = await import('../src/world/easter');
    const { PIONEERS, CAMEO, LETTERS, isPioneerCredit } = await import('../src/data/story/easter');
    expect(pioneerIds()).toContain('walwal');
    expect(isPioneer('walwal')).toBe(true);
    expect(pioneerCredit()).toContain('왈왈콩선생');
    expect(isPioneerCredit(pioneerCredit())).toBe(true);
    expect(PIONEERS.walwal).toMatchObject({ title: '밤길의 선생님', deco: 'night_bell', decoName: '밤길 방울' });
    expect(PIONEER_DECO.night_bell).toBe('walwal');
    expect(CAMEO.walwal.length).toBeGreaterThan(0);
    expect(LETTERS.walwal.some((l) => l[2]?.fx === 'drop')).toBe(true);
  });
  it('밤길 방울: 밤에만 원정 시간 −3% · 근처 손님 기분 +', async () => {
    const { pioneerExpCut, bellAura } = await import('../src/world/easter');
    world.objs.push({ kind: 'night_bell', tx: 5, ty: 5, fw: 1, fh: 1, inside: [] } as never);
    S.night = false;
    expect(pioneerExpCut()).toBe(0);
    S.night = true;
    expect(pioneerExpCut()).toBeCloseTo(F.bellNightCut);
    const a = reg();
    a.x = 5.5;
    a.y = 5.5;
    a.mood = 50;
    bellAura(10);
    expect(a.mood).toBeGreaterThan(50);
    setFlag('fiveStars', false);
    expect(pioneerExpCut()).toBe(0);
  });
});
