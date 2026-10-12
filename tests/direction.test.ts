// DIRECTION_SPEC §1·§3: 여정 칸 수 · 회차의 바람(고르기 · 효과 연결) · 여관 연대기(엔딩 · 옛 저장) · 욕설 거르기 · 크레딧 줄 · 다음 업데이트 카드 · 선물 규칙 · 운영 요약
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { CATALOG, def } from '../src/data/catalog';
import { BOSSES } from '../src/data/bosses';
import { FISH } from '../src/data/story/fish';
import { HARMONIES } from '../src/data/harmony';
import { REGIONS } from '../src/data/items';
import { MYTHIC } from '../src/data/story/mythic';
import { UNIQUES } from '../src/data/story/uniques';
import { creditLine, creditsByVer, normVer } from '../src/data/credits';
import { hasBadWord, rumorProblem } from '../src/data/profanity';
import { makeAdventurer } from '../src/world/adventurers';
import { backfillChronicle } from '../src/world/chronicle';
import { journeyCells, journeyComplete, syncJourney } from '../src/world/journey';
import { titlesOwned } from '../src/world/meta';
import { incomeMult } from '../src/world/owner';
import { regularNeed } from '../src/world/actors';
import { expectOf } from '../src/world/raid';
import { starCap } from '../src/world/legends';
import { cookFish } from '../src/world/fishing';
import { buildCost } from '../src/world/town';
import { finishStory, initStory, retireGoals, startCycle } from '../src/world/story';
import { P, resetProgress, S, world, type Actor } from '../src/world/state';
import {
  ensureWind, heroFirst, pickWind, rollWind, rumorOrder, seedShuffle, windHarvest, windMealGrade, windMoodDecay, windPasser, windQuestGold, windTracks, WIND_IDS, WIND_INFO, type WindId,
} from '../src/world/wind';
import { nextCardHtml, nextDate, nextValid } from '../src/ui/nextCard';
import { giftNote, notesListHtml, type PatchNote } from '../src/ui/update';
import { generalNext } from '../src/ui/chat';
// @ts-expect-error mjs 도구
import { clusterSimilar, getAll, goldOutliers, letterKind, missingEnv, renderMd, summarize } from '../tools/ops_report.mjs';
// @ts-expect-error mjs 도구
import { creditLine as creditLineMjs, fetchCredits } from '../scripts/credits.mjs';

const mk = (kind: string, lvl = 5, name = ''): Actor => Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind, lvl, race: 'human', rarity: 'common', hp: 100, mood: 80, food: 80, ...(name ? { name } : {}) }) as Actor;
beforeEach(() => {
  resetProgress();
  world.objs.length = 0;
  world.actors.length = 0;
  world.home = null;
  S.day = 1;
  S.started = true as never;
  S.visiting = false as never;
  S.innName = '별빛 여관';
  S.gold = 0;
  localStorage.clear();
});

describe('§1-1 여정 지도', () => {
  it('새 저장은 모두 0 · 분모: 지역 10 · 엔딩 6 · 신화 9 · 고유 장비 15 · 물고기 20 · 어울림 N', () => {
    const c = Object.fromEntries(journeyCells().map((x) => [x.key, x]));
    expect(Object.values(c).every((x) => x.cur === 0)).toBe(true);
    expect([c.regions.total, c.endings.total, c.mythic.total, c.uniques.total, c.fish.total, c.harmony.total]).toEqual([10, 6, 9, 15, 20, HARMONIES.length]);
    expect(c.regions.total).toBe(REGIONS.length);
    expect(c.diaries.total).toBeGreaterThanOrEqual(14);
    expect(journeyComplete()).toBe(false);
  });
  it('세는 법: 보스 깬 지역 · 스토리 엔딩(겹침 없이) · 회차를 넘은 신화 · 다 읽은 일기 · 얻은 고유 장비 · 낚은 물고기 · 어울림', () => {
    P.hunt.best = { forest: 10, swamp: 9, mine: 10 };
    P.legacy.album = ['story_retire', 'story_hero', 'inn_simple', 'story_hero'];
    P.legacy.mythicMet = ['aria'];
    P.story.mythic = { [MYTHIC[1].key]: { met: true } };
    P.growth.uniques = { [UNIQUES[0].id]: 2, [UNIQUES[1].id]: 0 };
    P.growth.fish.rec = { [FISH[0].id]: { n: 3, max: 30 } };
    P.harmony.found = [1, 2, 3];
    P.diaries = { knight_human: 5, mage_elf: 2 };
    const c = Object.fromEntries(journeyCells().map((x) => [x.key, x.cur]));
    expect(c).toMatchObject({ regions: 2, endings: 2, mythic: MYTHIC[1].key === 'aria' ? 1 : 2, uniques: 1, fish: 1, harmony: 3, diaries: 1 });
  });
  it('다 채우면 칭호 「이야기의 끝을 본 주인」 + 간판 금테 표시 (한 번 채우면 남는다)', () => {
    for (const r of REGIONS) P.hunt.best[r.id] = 10;
    P.legacy.album = ['story_retire', 'story_hero', 'story_love', 'story_legend', 'story_town', 'story_true'];
    P.legacy.mythicMet = MYTHIC.map((m) => m.key);
    for (const u of UNIQUES) P.growth.uniques[u.id] = 1;
    for (const f of FISH) P.growth.fish.rec[f.id] = { n: 1, max: 1 };
    P.harmony.found = HARMONIES.map((h) => h.id);
    for (const c of journeyCells()) if (c.key === 'diaries') expect(c.cur).toBe(0);
    expect(syncJourney()).toBe(false);
    // 일기 다 읽기
    const all = journeyCells().find((c) => c.key === 'diaries')!.total;
    expect(all).toBeGreaterThan(0);
    // 일기: 어떤 키든 다 읽은 것으로
    P.diaries = new Proxy({}, { get: () => 99, ownKeys: () => [], has: () => true }) as Record<string, number>;
    expect(journeyComplete()).toBe(true);
    expect(syncJourney()).toBe(true);
    expect(P.legacy.journeyEnd).toBe(true);
    expect(titlesOwned().some((t) => t.t === CONFIG.direction.journeyTitle)).toBe(true);
    P.diaries = {};
    expect(titlesOwned().some((t) => t.t === CONFIG.direction.journeyTitle)).toBe(true);
  });
  it('새 회차를 열어도 만난 신화는 여정에 남는다', () => {
    P.story.mythic = { [MYTHIC[2].key]: { met: true } };
    startCycle([]);
    expect(P.story.mythic).toEqual({});
    expect(journeyCells().find((c) => c.key === 'mythic')!.cur).toBe(1);
  });
});

describe('§1-2 회차의 바람 고르기', () => {
  it('1회차는 없음 · 2회차부터 여섯 중 하나 · 같은 회차·직전이면 늘 같은 바람', () => {
    expect(pickWind(1, '')).toBe('');
    for (let g = 2; g < 60; g++) {
      const w = pickWind(g, '');
      expect(WIND_IDS).toContain(w);
      expect(pickWind(g, '')).toBe(w);
    }
    expect(new Set(Array.from({ length: 60 }, (_, i) => pickWind(i + 2, ''))).size).toBe(6);
  });
  it('직전 바람과 겹치지 않는다 (모든 직전 바람 · 회차 2~200)', () => {
    for (let g = 2; g < 200; g++) for (const prev of WIND_IDS) expect(pickWind(g, prev)).not.toBe(prev);
  });
  it('회차를 계속 열어도 연달아 같은 바람이 없고, 회차 내내 유지 · 1회차는 바람 없음', () => {
    initStory(true);
    expect(P.story.wind).toBe('');
    let prev = '';
    for (let i = 0; i < 40; i++) {
      P.legacy.gen++;
      startCycle([]);
      const w = P.story.wind;
      expect(WIND_IDS).toContain(w);
      expect(w).not.toBe(prev);
      // 회차 안에서 다시 부르는 일(불러오기)엔 그대로
      ensureWind();
      expect(P.story.wind).toBe(w);
      prev = w;
    }
  });
  it('옛 저장: 3회차인데 바람이 없으면 불러올 때 정한다 (연대기의 지난 바람과 다르게)', () => {
    P.legacy.gen = 3;
    P.legacy.chron = [{ at: 1, gen: 2, inn: 'x', ending: 'story_retire', regs: [], wind: pickWind(3, '') || 'calm' }];
    P.story.wind = '';
    ensureWind();
    expect(WIND_IDS).toContain(P.story.wind);
    expect(P.story.wind).not.toBe(P.legacy.chron[0].wind);
    P.story.wind = 'nonsense';
    ensureWind();
    expect(WIND_IDS).toContain(P.story.wind);
  });
  it('rollWind는 지난 바람을 기억한다', () => {
    P.legacy.gen = 2;
    P.story.wind = 'war';
    rollWind();
    expect(P.legacy.lastWind).toBe('war');
    expect(P.story.wind).not.toBe('war');
  });
  it('여섯 바람 모두 이름 · 효과 · 분위기 글이 있다', () => {
    for (const w of WIND_IDS) expect(WIND_INFO[w].name && WIND_INFO[w].fx && WIND_INFO[w].mood).toBeTruthy();
  });
});

describe('§1-2 바람 효과가 실제 계산에 들어간다', () => {
  const setW = (w: WindId | '') => (P.story.wind = w);
  it('축제의 해: 장식 값 −15% (건물은 그대로) · 주점 수입 +10%', () => {
    const deco = (Object.keys(CATALOG) as (keyof typeof CATALOG)[]).find((k) => def(k).deco && def(k).cost >= 100)!;
    const bld = (Object.keys(CATALOG) as (keyof typeof CATALOG)[]).find((k) => !def(k).deco && def(k).cost >= 100 && k !== 'inn')!;
    const d0 = buildCost(deco);
    const b0 = buildCost(bld);
    const t0 = incomeMult('drink');
    setW('festival');
    expect(buildCost(deco)).toBe(Math.round(d0 * 0.85));
    expect(buildCost(bld)).toBe(b0);
    expect(incomeMult('drink')).toBeCloseTo(t0 + 0.1, 5);
    expect(incomeMult('sleep')).toBeCloseTo(1, 5);
  });
  it('별이 많은 해: 하루 별똥별 +1 (보통 1 → 2)', () => {
    const c0 = starCap();
    setW('stars');
    expect(starCap()).toBe(c0 + 1);
  });
  it('풍년: 수확 +30% (소수는 확률) · 물고기 요리 버프 한 단계 위', () => {
    expect(windHarvest(10)).toBe(10);
    setW('harvest');
    expect(windHarvest(10)).toBe(13);
    expect(windHarvest(2, () => 0.99)).toBe(2);
    expect(windHarvest(2, () => 0.1)).toBe(3);
    expect(windMealGrade('n')).toBe('r');
    expect(windMealGrade('l')).toBe('l');
    const f = FISH.find((x) => x.use.includes('cook') && x.grade === 'n')!;
    P.growth.fish.bag = { [f.id]: 1 };
    expect(cookFish(f.id)).toBeNull();
    expect(P.growth.meal!.v).toBe(CONFIG.growth.fish.meal.v.r);
  });
  it('길손의 해: 지나가는 손님 ×1.5 · 단골 기준 −5', () => {
    const n0 = regularNeed();
    expect(windPasser()).toBe(1);
    setW('wayfarer');
    expect(windPasser()).toBe(1.5);
    expect(regularNeed()).toBeCloseTo(n0 - 5, 5);
  });
  it('전쟁의 소문: 토벌 기대·이론 피해 +15% · 원정 금화 −10%', () => {
    const ms = [mk('knight'), mk('mage'), mk('cleric')];
    const e0 = expectOf(ms, BOSSES[0]);
    setW('war');
    const e1 = expectOf(ms, BOSSES[0]);
    expect(e1.target / e0.target).toBeCloseTo(1.15, 2);
    expect(e1.theory / e0.theory).toBeCloseTo(1.15, 2);
    expect(windQuestGold()).toBeCloseTo(0.9, 5);
  });
  it('고요한 해: 기분 떨어지는 양 ×0.5 · 은퇴 목표 −10% · 잔잔한 곡 먼저', () => {
    const g0 = retireGoals().map((g) => g.need);
    setW('calm');
    expect(windMoodDecay()).toBe(0.5);
    const g1 = retireGoals().map((g) => g.need);
    expect(g1.slice(0, 3)).toEqual(g0.slice(0, 3).map((n) => Math.ceil(n * 0.9)));
    expect(windTracks('day', () => 0)).toEqual(['03', '05']);
    expect(windTracks('day', () => 0.99)).toBeNull();
    expect(windTracks('raid', () => 0)).toBeNull();
  });
  it('바람이 없으면 아무 효과 없음 (1회차·옛 저장 그대로)', () => {
    setW('');
    expect([windPasser(), windQuestGold(), windMoodDecay(), windHarvest(7)]).toEqual([1, 1, 1, 7]);
    expect(windTracks('day', () => 0)).toBeNull();
  });
});

describe('§1-2 시드 섞기: [소문] · 영웅 첫 등장', () => {
  it('같은 시드면 같은 순서 · 원본은 그대로 · 회차마다 다르다', () => {
    const a = Array.from({ length: 30 }, (_, i) => i);
    expect(seedShuffle(a, 5)).toEqual(seedShuffle(a, 5));
    expect([...seedShuffle(a, 5)].sort((x, y) => x - y)).toEqual(a);
    expect(a[0]).toBe(0);
    expect(rumorOrder(a, 2)).not.toEqual(rumorOrder(a, 3));
  });
  it('[소문] 일반 수다는 회차 순서대로 흘러간다', () => {
    P.legacy.gen = 4;
    const first = Array.from({ length: 5 }, () => generalNext());
    expect(new Set(first).size).toBe(5);
  });
  it('영웅: 1회차는 원래 순서 · 2회차부터 회차 번호로 섞인 순서의 첫 영웅', () => {
    const all = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(heroFirst(['c', 'e'], all, 1)).toBe('c');
    const picks = new Set(Array.from({ length: 20 }, (_, g) => heroFirst(['c', 'e'], all, g + 2)));
    expect(picks).toEqual(new Set(['c', 'e']));
    expect(heroFirst(['c', 'e'], all, 7)).toBe(heroFirst(['c', 'e'], all, 7));
    expect(heroFirst(['d'], all, 9)).toBe('d');
  });
});

describe('§1-3 여관 연대기', () => {
  it('스토리 엔딩을 보면 한 쪽: 회차 · 여관 이름 · 엔딩 · 단골 셋(레벨 순) · 바람', () => {
    world.actors.push(mk('knight', 9, '가람'), mk('mage', 12, '나래'), mk('cleric', 3, '다온'), mk('rogue', 7, '라희'));
    P.legacy.gen = 3;
    P.story.wind = 'stars';
    initStory(true);
    P.story.wind = 'stars';
    finishStory('retire');
    const c = P.legacy.chron.at(-1)!;
    expect(c).toMatchObject({ gen: 3, inn: '별빛 여관', ending: 'story_retire', wind: 'stars' });
    expect(c.regs.map((r) => r.name)).toEqual(['나래', '가람', '라희']);
    // 같은 회차에 같은 엔딩을 다시 불러도 한 쪽
    finishStory('retire');
    expect(P.legacy.chron.filter((x) => x.ending === 'story_retire').length).toBe(1);
  });
  it('옛 저장: 앨범에 있는 엔딩만큼 최소한의 쪽을 한 번 채운다 (카드가 있으면 회차·시각·가장 친한 단골)', () => {
    world.actors.push(mk('mage', 12, '나래'));
    P.legacy.album = ['story_hero', 'inn_simple', 'nope'];
    P.legacy.cards = { story_hero: { at: 2000, gen: 2, owner: 'x', job: 'knight', gender: 'm', fav: '나래' } } as never;
    expect(backfillChronicle()).toBe(2);
    expect(P.legacy.chron.map((c) => c.ending)).toEqual(['inn_simple', 'story_hero']);
    const h = P.legacy.chron.find((c) => c.ending === 'story_hero')!;
    expect(h).toMatchObject({ gen: 2, at: 2000, old: true, regs: [{ name: '나래', kind: 'mage' }] });
    expect(backfillChronicle()).toBe(0);
    expect(P.legacy.chron.length).toBe(2);
  });
  const real = ['tests/fixtures/real_woongs.json', 'tests/fixtures/real_lotte.json', 'tests/fixtures/real_ttabam.json'].filter((f) => fs.existsSync(f));
  it.skipIf(!real.length)('실제 저장: 불러와 이야기를 맞추면 본 엔딩만큼 연대기가 생기고 다른 칸은 그대로', () => {
    for (const f of real) {
      resetProgress();
      const sv = JSON.parse(fs.readFileSync(f, 'utf8'));
      // 불러오기(mergeProgress)처럼 한 단계 깊이 합치기
      for (const [k, v] of Object.entries(sv.progress ?? {})) {
        const b = (P as never as Record<string, unknown>)[k];
        if (!(k in P) || v == null) continue;
        (P as never as Record<string, unknown>)[k] = b && typeof b === 'object' && !Array.isArray(b) && typeof v === 'object' && !Array.isArray(v) ? { ...b, ...(v as object) } : v;
      }
      P.legacy.chron = [];
      P.legacy.chronV = false;
      const album = [...(P.legacy.album ?? [])];
      initStory(false);
      expect(P.legacy.chron.length).toBeLessThanOrEqual(album.length);
      expect(P.legacy.album).toEqual(album);
      if (P.legacy.gen >= 2) expect(WIND_IDS).toContain(P.story.wind);
      else expect(P.story.wind).toBe('');
    }
  });
});

describe('§2-3 욕설 거르기', () => {
  it('금칙어 · 띄어쓰기/기호로 숨겨도 잡는다 · 흔한 말은 통과', () => {
    expect(hasBadWord('이 시발 여관')).toBe(true);
    expect(hasBadWord('씨 1 발')).toBe(true);
    expect(hasBadWord('F*U*C*K')).toBe(true);
    expect(hasBadWord('새끼 고양이가 우물가에 산대')).toBe(false);
    expect(hasBadWord('불이 꺼져 있었대')).toBe(false);
  });
  it('한 줄 검사: 빈 줄 · 40자 넘음 · 링크 · 욕설', () => {
    expect(rumorProblem('   ')).toMatch(/적어/);
    expect(rumorProblem('가'.repeat(41))).toMatch(/40자/);
    expect(rumorProblem('가'.repeat(40))).toBeNull();
    expect(rumorProblem('여기 와 www.abc.com')).toMatch(/링크/);
    expect(rumorProblem('example.kr 가 봐')).toMatch(/링크/);
    expect(rumorProblem('병 신')).toMatch(/쓸 수 없는/);
    expect(rumorProblem('우물가 고양이가 장화를 신고 다닌대')).toBeNull();
  });
});

describe('§2-1 크레딧 줄 · §3-1 정기/핫픽스', () => {
  it('「💌 제보: 웅스 · 고느끼」 — 겹친 이름·빈 이름 빼고 처음 순서 · 없으면 빈 줄 (게임·스크립트 같은 모양)', () => {
    expect(creditLine(['웅스', '고느끼', '웅스', ' '])).toBe('💌 제보: 웅스 · 고느끼');
    expect(creditLine([])).toBe('');
    expect(creditLineMjs(['웅스', '고느끼', '웅스'])).toBe(creditLine(['웅스', '고느끼']));
    expect(normVer('v0.23.0-beta')).toBe('0.23.0');
    const m = creditsByVer([{ ver_fixed: 'v0.23.0', nickname: 'a' }, { ver_fixed: '0.23.0-beta', nickname: 'b' }, { ver_fixed: '', nickname: 'c' }]);
    expect(m.get('0.23.0')).toEqual(['a', 'b']);
    expect(m.size).toBe(1);
  });
  it('패치 노트 탭: 그 버전 아래 크레딧 줄 · 정기/핫픽스 표시', () => {
    const list: PatchNote[] = [
      { version: '0.23.0-beta', date: 'd', title: 't', items: ['x'], fixes: [], kind: '정기' },
      { version: '0.22.1-beta', date: 'd', title: 't2', items: [], fixes: ['y'], kind: '핫픽스' },
    ];
    const h = notesListHtml(list, new Map([['0.23.0', ['웅스', '고느끼']]]));
    expect(h).toContain('💌 제보: 웅스 · 고느끼');
    expect(h.match(/pn-credit/g)?.length).toBe(1);
    expect(h).toContain('pnk hot');
    expect(notesListHtml(list)).not.toContain('pn-credit');
  });
  it('업데이트 선물은 정기 업데이트에만 (핫픽스 선물은 건너뛰고 그 아래 정기 선물 · kind 없는 옛 노트는 정기)', () => {
    const list: PatchNote[] = [
      { version: '0.23.1-beta', date: '', title: '', items: [], fixes: [], kind: '핫픽스', gift: { gold: 1 } },
      { version: '0.23.0-beta', date: '', title: '', items: [], fixes: [], kind: '정기', gift: { gold: 2 } },
      { version: '0.22.0-beta', date: '', title: '', items: [], fixes: [], gift: { gold: 3 } },
    ];
    expect(giftNote(list, '0.23.1-beta')?.gift?.gold).toBe(2);
    expect(giftNote(list, '0.22.5-beta')?.gift?.gold).toBe(3);
    expect(giftNote(list.slice(0, 1), '0.23.1-beta')).toBeUndefined();
  });
  it('실제 패치 노트 파일은 그대로 읽힌다 (kind 없어도)', () => {
    const notes = JSON.parse(fs.readFileSync('public/patchnotes.json', 'utf8')) as PatchNote[];
    expect(notesListHtml(notes)).toContain(notes[0].version);
  });
});

describe('§3-2 다음 업데이트 카드 (public/next.json)', () => {
  const now = new Date(2026, 9, 13, 12);
  it('「다음 업데이트 · 10/15(목) · 제목 외」 + 항목 + 이미지', () => {
    expect(nextDate('2026-10-15')).toBe('10/15(목)');
    const h = nextCardHtml({ date: '2026-10-15', title: '새 사냥 지역 5곳', items: ['a', 'b'], image: 'next/regions.png' }, '', now);
    expect(h).toContain('다음 업데이트');
    expect(h).toContain('10/15(목) · 새 사냥 지역 5곳 외');
    expect(h).toContain('src="next/regions.png"');
    expect(h.match(/<li>/g)?.length).toBe(2);
  });
  it('없음 · 빈 파일 · 지난 날짜면 숨김 · 위험한 이미지 경로는 빼고', () => {
    expect(nextCardHtml(null, '', now)).toBe('');
    expect(nextCardHtml({ date: '', title: '', items: [] }, '', now)).toBe('');
    expect(nextCardHtml(JSON.parse(fs.readFileSync('public/next.json', 'utf8')), '', now)).toBe('');
    expect(nextValid({ date: '2026-10-12', title: 'x' }, now)).toBe(false);
    expect(nextValid({ date: '2026-10-13', title: 'x' }, now)).toBe(true);
    const h = nextCardHtml({ title: 'x', image: 'javascript:alert(1)' }, '', now);
    expect(h).not.toContain('<img');
    expect(nextCardHtml({ title: 'x', image: 'https://evil/x.png' }, '', now)).not.toContain('<img');
    expect(nextCardHtml({ title: '<b>x</b>' }, '', now)).toContain('&lt;b&gt;');
  });
});

describe('§3-3 운영 요약 (가짜 데이터 · 읽기 전용)', () => {
  const fx = JSON.parse(fs.readFileSync('tests/fixtures/ops_sample.json', 'utf8'));
  it('기기 · 신규 · 이탈 · 오류 · 제보 분류(비슷한 것 묶음) · 금화 이상 · 채팅', () => {
    const r = summarize(fx);
    expect(r).toMatchObject({ devices: 6, newDevices: 1, newAccounts: 1, churn: 1, letters: 4, chat: 2, notices: 1 });
    expect(r.errors[0]).toMatchObject({ msg: 'Script error.', n: 2 });
    expect(Object.keys(r.byKind)).toEqual(['버그', '건의', '칭찬']);
    expect(r.byKind['버그'][0].items.length).toBe(2);
    expect(r.gold.outliers.map((o: { nick: string }) => o.nick)).toEqual(['카타']);
    const md = renderMd(r);
    expect(md).toContain('# 운영 요약 · 2026-10-13');
    expect(md).toContain('비슷한 것 2통');
  });
  it('조각 함수: 편지 종류 · 묶기 · 금화 이상 · 빠진 키', () => {
    expect(['[버그 제보] a', '[개선 건의] b', '[칭찬] c', '그냥'].map(letterKind)).toEqual(['버그', '건의', '칭찬', '기타']);
    const g = clusterSimilar([{ body: '[버그 제보] 낚시 미끼가 사라졌어요' }, { body: '[버그 제보] 미끼가 낚시하다 사라져요' }, { body: '[버그 제보] 토벌 화면이 멈춰요' }]);
    expect(g.map((x: { items: unknown[] }) => x.items.length)).toEqual([2, 1]);
    expect(goldOutliers([{ name: 'gold_gain', user_id: 'a', props: { total: 10 } }]).outliers).toEqual([]);
    expect(missingEnv({ SUPABASE_URL: 'x' })).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
  });
  it('서버 읽기는 GET만 · 1000줄씩 나눠 받는다', async () => {
    const calls: { url: string; method: string; range: string }[] = [];
    const fake = async (url: string, o: { method: string; headers: Record<string, string> }) => {
      calls.push({ url, method: o.method, range: o.headers.Range });
      const n = calls.length === 1 ? 1000 : 3;
      return { ok: true, json: async () => Array.from({ length: n }, (_, i) => ({ i })) };
    };
    const rows = await getAll({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'k' }, 'play_events', 'select=id', { fetchImpl: fake });
    expect(rows.length).toBe(1003);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    expect(calls.map((c) => c.range)).toEqual(['0-999', '1000-1999']);
    expect(calls[0].url).toBe('https://x.supabase.co/rest/v1/play_events?select=id');
  });
  it('scripts/credits.mjs: 그 버전 닉네임만 (가짜 서버)', async () => {
    const fake = async (_u: string, o: { body: string }) => ({ ok: true, json: async () => [{ ver_fixed: '0.23.0', nickname: JSON.parse(o.body).p_ver }, { ver_fixed: '0.22.0', nickname: 'x' }] });
    expect(await fetchCredits('v0.23.0-beta', { url: 'u', key: 'k', fetchImpl: fake })).toEqual(['0.23.0']);
    const missing = async () => ({ ok: false, status: 404, text: async () => '{"code":"PGRST202","message":"Could not find the function public.letter_credits"}' });
    await expect(fetchCredits('0.23.0', { url: 'u', key: 'k', fetchImpl: missing })).rejects.toThrow(/direction\.sql/);
  });
});
