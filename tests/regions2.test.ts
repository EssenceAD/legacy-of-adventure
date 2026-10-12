// REGIONS2: 지역 6~10 — 열림 사슬(별의 심연 x-10 → 해안 … → 길잡이 별 3개 → 4번째 보스 → 지역 10) · 컷 차례 · 옛 저장 바로잡기
//  · 스토리 목표 조정(이미 이룬 목표는 그대로) · 토벌 순환에 별을 삼킨 것 없음 · 데이터(몬스터·보스·소품·트로피 그림)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { BASE_REGIONS, REGIONS } from '../src/data/items';
import { BOSSES, RAID_BOSSES } from '../src/data/bosses';
import { REGION_LINES, SCATTER_CUT, DEEP_OPEN, DEEP_DEFEAT_PLAIN, DEEP_DEFEAT_HERO } from '../src/data/story/regions';
import { MONS, RAID_LOOK_OF, RAID_LOOKS, REGION_BOSS, regionMons } from '../src/combat/mons';
import { THEMES } from '../src/combat/theme';
import { CATALOG } from '../src/data/catalog';
import { P, resetProgress, S } from '../src/world/state';
import { huntRegionOpen, recPower, regionBossOf } from '../src/world/hunt';
import { regionUnlocked } from '../src/world/expeditions';
import { deepDefeatCut, nextRegionCut, newRegionOpen, openNewRegions, regionRumor, sanitizeRegions2, starsHave, takeEnterLines, wantDeepVoice } from '../src/world/regions2';
import { routeGoals } from '../src/world/routes';
import { ensureWeek, maybeWander } from '../src/world/raid';
import { readSave } from '../src/save/save';

const idx = (id: string) => REGIONS.findIndex((r) => r.id === id);
const run = (n = 10) => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = nextRegionCut();
    if (!c) break;
    out.push(`${c.kind}:${c.id}`);
    c.done();
  }
  return out;
};
beforeEach(() => {
  resetProgress();
  S.day = 10;
  P.guide.unlocked = ['hunt'];
  for (const r of ['forest', 'swamp', 'mine', 'ice']) P.hunt.best[r] = 10;
});

describe('지역 표', () => {
  it('지역은 10곳에서 끝 · 새 지역 5곳 (재료·색·세트·형용사)', () => {
    expect(REGIONS.map((r) => r.id)).toEqual(['forest', 'swamp', 'mine', 'ice', 'abyss', 'coast', 'dune', 'ember', 'sky', 'deep']);
    expect(REGIONS.find((r) => r.id === 'deep')!.relic).toBe('별지기의 잔광');
    expect(REGIONS.find((r) => r.id === 'coast')!.mat).toBe('소금 진주');
  });
  it('권장 전투력은 같은 곡선으로 이어진다 (지역마다 ×2.2)', () => {
    expect(recPower('coast', 1) / recPower('abyss', 1)).toBeCloseTo(CONFIG.hunt.regionPower, 1);
    expect(recPower('deep', 10)).toBeGreaterThan(recPower('sky', 10));
  });
  it('몬스터 4~6종 · 체력 0.8~1.5 · 빠르기 1.0~2.4 · 그림 파일', () => {
    for (const r of REGIONS.slice(BASE_REGIONS)) {
      const ms = regionMons(r.id);
      expect(ms.length).toBeGreaterThanOrEqual(5);
      for (const m of ms) {
        expect(m.hp).toBeGreaterThanOrEqual(0.8);
        expect(m.hp).toBeLessThanOrEqual(1.5);
        expect(m.speed).toBeGreaterThanOrEqual(0.9);
        expect(m.speed).toBeLessThanOrEqual(2.4);
        expect(fs.existsSync(`public/assets/mon/${m.id}/sheet.png`), m.id).toBe(true);
      }
      const b = REGION_BOSS[r.id];
      expect(fs.existsSync(`public/assets/mon/${b.id}/meta.json`), b.id).toBe(true);
      expect(MONS.some((m) => m.id === b.minion)).toBe(true);
      expect(THEMES[r.id].props.length).toBe(5);
      for (const k of THEMES[r.id].props) expect(fs.existsSync(`public/assets/combat/props/${k}.png`), k).toBe(true);
    }
    expect(REGION_BOSS.deep.name).toBe('별을 삼킨 것');
    expect(fs.existsSync('public/assets/mon/nb_deep/face.png')).toBe(true);
  });
  it('토벌 보스 4마리: 그림 · 트로피 장식(1×1) · 칭호', () => {
    for (const id of ['leviathan', 'sandblade', 'magma', 'skydragon']) {
      const b = BOSSES.find((x) => x.id === id)!;
      expect(b).toBeDefined();
      const look = RAID_LOOKS.find((l) => l.id === RAID_LOOK_OF[id])!;
      expect(fs.existsSync(`public/assets/mon/${look.id}/face.png`)).toBe(true);
      expect(CATALOG['trophy_' + id as never]).toBeDefined();
      expect(fs.existsSync(`public/assets/sprites/trophy_${id}.png`)).toBe(true);
    }
  });
});

describe('열림 사슬', () => {
  it('별의 심연 x-10 → 해안 · 흩어진 별 컷 → 새 지역 해안', () => {
    expect(huntRegionOpen(idx('coast'))).toBe(false);
    expect(nextRegionCut()).toBeNull();
    P.hunt.best.abyss = 10;
    expect(huntRegionOpen(idx('coast'))).toBe(true);
    expect(regionUnlocked(idx('coast'))).toBe(true);
    const c = nextRegionCut()!;
    expect(c.kind).toBe('scatter');
    expect(c.lines).toBe(SCATTER_CUT);
    expect(c.done()).toBe('coast');
    expect(nextRegionCut()).toBeNull();
  });
  it('평판 ★로는 새 지역 의뢰가 안 열린다', () => {
    P.rep = 1e9;
    expect(regionUnlocked(idx('coast'))).toBe(false);
  });
  it('해안 x-10 → 유적 (보스 한 줄 → 별 컷 → 다음 날 편지)', () => {
    P.hunt.best.abyss = 10;
    run();
    P.hunt.best.coast = 10;
    expect(huntRegionOpen(idx('dune'))).toBe(true);
    const c = nextRegionCut()!;
    expect(c.kind).toBe('star');
    expect(c.lines[0]).toEqual(REGION_LINES.coast.boss);
    c.done();
    expect(starsHave()).toBe(1);
    expect(nextRegionCut()).toBeNull();
    S.day++;
    const l = nextRegionCut()!;
    expect(l.kind).toBe('letter');
    expect(l.lines).toBe(REGION_LINES.coast.letter);
    l.done();
    expect(nextRegionCut()).toBeNull();
  });
  it('길잡이 별 3개 저장 → 4번째(하늘) 보스 처치 → 별 컷 → 심연의 바닥 컷 → 지역 10', () => {
    P.hunt.best.abyss = 10;
    for (const r of ['coast', 'dune', 'ember']) P.hunt.best[r] = 10;
    P.hunt.best.sky = 7;
    P.regions2.scatter = true;
    P.regions2.stars = ['coast', 'dune', 'ember'];
    expect(starsHave()).toBe(3);
    expect(huntRegionOpen(idx('deep'))).toBe(false);
    expect(openNewRegions()).toEqual(['coast', 'dune', 'ember', 'sky']);
    expect(run()).toEqual([]);
    P.hunt.best.sky = 10;
    // 보스를 전투 안에서 봤으면 별 컷엔 한 줄 없이
    P.regions2.bossShown.push('sky');
    const c = nextRegionCut()!;
    expect(c.kind).toBe('star');
    expect(c.lines[0]).toEqual(REGION_LINES.sky.star[0]);
    c.done();
    expect(huntRegionOpen(idx('deep'))).toBe(true);
    const d = nextRegionCut()!;
    expect(d.kind).toBe('deepOpen');
    expect(d.lines).toBe(DEEP_OPEN);
    expect(d.done()).toBe('deep');
    expect(regionUnlocked(idx('deep'))).toBe(true);
  });
  it('첫 입장 대사는 한 번 · 소문은 열린 지역 것만', () => {
    expect(regionRumor()).toBeNull();
    P.hunt.best.abyss = 10;
    expect(takeEnterLines('coast')).toBe(REGION_LINES.coast.enter);
    expect(takeEnterLines('coast')).toBeNull();
    expect(takeEnterLines('forest')).toBeNull();
    for (let i = 0; i < 20; i++) expect(regionRumor()).toMatch(/등대|소라게|난파선/);
  });
  it('지역 10 보스: 목소리는 처치 전까지 · 처치 컷은 회차마다 한 번 (용사 루트면 HERO)', () => {
    expect(wantDeepVoice()).toBe(true);
    expect(deepDefeatCut(false)!.lines).toBe(DEEP_DEFEAT_PLAIN);
    expect(wantDeepVoice()).toBe(false);
    expect(wantDeepVoice(true)).toBe(true);
    expect(deepDefeatCut(false)).toBeNull();
    expect(deepDefeatCut(true)!.lines).toBe(DEEP_DEFEAT_HERO);
    expect(P.regions2.deepKills).toBe(3);
  });
  it('지역 10 x-10 보스 재료 = 별을 삼킨 것 (토벌 순환에는 없음)', () => {
    expect(regionBossOf('deep').id).toBe('devourer');
    expect(RAID_BOSSES.some((b) => b.id === 'devourer')).toBe(false);
  });
});

describe('토벌 순환', () => {
  afterEach(() => vi.useRealTimers());
  it('열린 지역 보스만 돌아가며 · 별을 삼킨 것은 절대 안 나옴 · 떠돌이도 없음', () => {
    for (const r of REGIONS) P.hunt.best[r.id] = 10;
    P.regions2.stars = ['coast', 'dune', 'ember', 'sky'];
    vi.useFakeTimers();
    const seen = new Set<string>();
    for (let w = 0; w < 30; w++) {
      vi.setSystemTime(new Date(2026, 0, 5 + w * 7, 12));
      P.raid.week = '';
      ensureWeek();
      seen.add(P.raid.bossId);
    }
    expect(seen.has('devourer')).toBe(false);
    expect([...seen].sort()).toEqual(RAID_BOSSES.map((b) => b.id).sort());
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(maybeWander('deep')).toBeNull();
    expect(maybeWander('coast')?.id).toBe('leviathan');
    vi.restoreAllMocks();
  });
  it('새 지역이 닫혀 있으면 새 보스도 안 나옴', () => {
    P.hunt.best.abyss = 10;
    vi.useFakeTimers();
    const seen = new Set<string>();
    for (let w = 0; w < 12; w++) {
      vi.setSystemTime(new Date(2026, 0, 5 + w * 7, 12));
      P.raid.week = '';
      ensureWeek();
      seen.add(P.raid.bossId);
    }
    // 해안까지 열림 → 바다 용까지
    expect(seen.has('leviathan')).toBe(true);
    expect(seen.has('sandblade')).toBe(false);
  });
});

describe('스토리 목표 조정 (§0)', () => {
  beforeEach(() => {
    P.story.route = 'hero';
    P.story.seen = [];
  });
  it('용사 h_abyss = 심연의 바닥 x-9 · 진 엔딩 x_abyss = 심연의 바닥 x-10', () => {
    P.hunt.best.abyss = 10;
    let g = routeGoals('hero').find((x) => x.id === 'h_abyss')!;
    expect(g.title).toBe('심연의 바닥 x-9 돌파');
    expect(g.done).toBe(false);
    P.hunt.best.deep = 9;
    g = routeGoals('hero').find((x) => x.id === 'h_abyss')!;
    expect(g.done).toBe(true);
    const x = routeGoals('true').find((q) => q.id === 'x_abyss')!;
    expect(x.title).toBe('심연의 바닥 x-10 (열쇠 지참)');
    expect(x.done).toBe(false);
  });
  it('예전 조건으로 이미 이룬 목표는 이룬 그대로', () => {
    P.hunt.best.abyss = 10;
    P.story.seen = ['goal:h_abyss', 'goal:x_abyss'];
    expect(routeGoals('hero').find((x) => x.id === 'h_abyss')!.done).toBe(true);
    expect(routeGoals('true').find((x) => x.id === 'x_abyss')!.done).toBe(true);
  });
});

describe('옛 저장', () => {
  const load = (raw: string) => {
    localStorage.setItem(CONFIG.save.key, raw);
    const d = readSave()!;
    resetProgress(d.progress);
    sanitizeRegions2();
    return d;
  };
  it('새 지역 칸은 0으로 채우고 있는 값은 그대로 · 저장 버전 그대로', () => {
    const raw = JSON.parse(fs.readFileSync('tests/fixtures/beta_town.json', 'utf8'));
    const before = { ...raw.progress.mats };
    const d = load(JSON.stringify(raw));
    expect(d.version).toBe(CONFIG.save.version);
    for (const [k, v] of Object.entries(before)) expect(P.mats[k as never]).toBe(v);
    for (const r of REGIONS.slice(BASE_REGIONS)) {
      expect(P.mats[r.id]).toBe(0);
      expect(P.pity[r.id]).toBe(0);
      expect(P.counters.regionWins[r.id]).toBe(0);
    }
    expect(P.regions2.scatter).toBe(false);
    expect(P.regions2.stars).toEqual([]);
  });
  const REAL = 'tests/fixtures/real_woongs.json';
  it.skipIf(!fs.existsSync(REAL))('실제 저장(심연 x-10): 불러오면 지역 6이 바로 열리고 흩어진 별 컷이 한 번', () => {
    const raw = fs.readFileSync(REAL, 'utf8');
    const old = JSON.parse(raw).progress;
    load(raw);
    expect(newRegionOpen(idx('coast'))).toBe(true);
    expect(P.hunt.best.abyss).toBe(old.hunt.best.abyss);
    expect(P.mats.abyss).toBe(old.mats.abyss);
    expect(run()).toEqual(['scatter:abyss']);
    expect(run()).toEqual([]);
  });
});
