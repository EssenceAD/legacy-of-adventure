// MUSIC_PLAN 「2차 추가」 19~27 · J6~J8 + RAIDWEAPON §0 팡파르 반복 줄이기
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// 순환 import 순서: save를 먼저 (ui/sound를 바로 부르면 audio/engine보다 sfx가 먼저 실행된다)
import '../src/save/save';
import { REGIONS } from '../src/data/items';
import { battleScene, huntScene, PLAYLISTS, TRACKS } from '../src/audio/playlists';
import { FANFARE_GAP, makeFanfarePicker, WIN_JINGLES, winFanfare, type WinInfo } from '../src/audio/fanfare';
import { soundSettingsHtml } from '../src/ui/sound';

const PUB = resolve(__dirname, '../public/audio');

describe('곡 목록 · 파일', () => {
  it('목록의 모든 곡이 public/audio/bgm에 있다 (빈 파일 아님)', () => {
    for (const t of Object.values(TRACKS)) {
      const p = resolve(PUB, 'bgm', t.file + '.mp3');
      expect(existsSync(p), p).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(500_000);
    }
  });
  it('상황 목록이 가리키는 곡은 모두 TRACKS에 있다', () => {
    for (const [s, list] of Object.entries(PLAYLISTS)) for (const id of list) expect(TRACKS[id], `${s} → ${id}`).toBeTruthy();
  });
  it('팡파르 J1~J8이 public/audio/jingle에 있다', () => {
    for (let i = 1; i <= 8; i++) expect(existsSync(resolve(PUB, 'jingle', `J${i}.mp3`)), `J${i}`).toBe(true);
  });
  it('새 곡 19~27 이름 (MUSIC_PLAN 표)', () => {
    expect(Object.keys(TRACKS)).toHaveLength(27);
    expect(TRACKS['19'].name).toBe('끝없는 심연');
    expect(TRACKS['20'].name).toBe('바람 부는 들판');
    expect(TRACKS['21'].name).toBe('소금과 모래');
    expect(TRACKS['22'].name).toBe('잿불과 구름');
    expect(TRACKS['23'].name).toBe('거인의 발소리');
    expect(TRACKS['24'].name).toBe('다 같이, 하나의 적');
    expect(TRACKS['25'].name).toBe('다섯 별의 원정대');
    expect(TRACKS['26'].name).toBe('비 오는 여관 창가');
    expect(TRACKS['27'].name).toBe('등불 골목');
  });
  it('설정 「음악 목록」에 27곡 (안 들어 본 곡은 ???)', () => {
    const html = soundSettingsHtml();
    expect(html).toContain('/27)');
    for (const id of Object.keys(TRACKS)) expect(html).toContain(`>${id} `);
  });
});

describe('상황 → 곡', () => {
  it('사냥: 지역 묶음', () => {
    const want: Record<string, string[]> = {
      forest: ['09', '20'],
      swamp: ['09', '20'],
      coast: ['21', '10'],
      dune: ['21', '10'],
      ember: ['22', '10'],
      sky: ['22', '10'],
      deep: ['22', '10'],
      mine: ['10'],
      ice: ['10'],
      abyss: ['10'],
    };
    for (const r of REGIONS) expect(PLAYLISTS[huntScene(r.id) as Exclude<ReturnType<typeof huntScene>, 'none'>], r.id).toEqual(want[r.id]);
  });
  it('마을 낮 26 · 밤 27 추가', () => {
    expect(PLAYLISTS.day).toEqual(['02', '03', '04', '05', '26']);
    expect(PLAYLISTS.night).toEqual(['06', '07', '08', '27']);
  });
  it('토벌 11↔23 · 30% 아래 12 · 보스 연전 19 · 월드 레이드 24 · 다섯 별 25', () => {
    expect(PLAYLISTS.raid).toEqual(['11', '23']);
    expect(PLAYLISTS.raid2).toEqual(['12']);
    expect(PLAYLISTS.abyss_rush).toEqual(['19']);
    expect(PLAYLISTS.world_raid).toEqual(['24']);
    expect(PLAYLISTS.five).toEqual(['25']);
  });
  it('전투 화면: 특별한 전투가 먼저', () => {
    const b = { huntRegion: 'coast', raidLow: false, special: null };
    expect(battleScene('hunt', b)).toBe('hunt_coast');
    expect(battleScene('raid', b)).toBe('raid');
    expect(battleScene('raid', { ...b, raidLow: true })).toBe('raid2');
    expect(battleScene('hunt', { ...b, special: 'five' })).toBe('five');
    expect(battleScene('raid', { ...b, raidLow: true, special: 'world_raid' })).toBe('world_raid');
    expect(battleScene('hunt', { ...b, huntRegion: 'deep', special: 'abyss_rush' })).toBe('abyss_rush');
    expect(battleScene('hunt', { ...b, huntRegion: 'deep' })).toBe('hunt_fire');
  });
});

describe('RAIDWEAPON §0 팡파르', () => {
  const base: WinInfo = { mode: 'hunt', first: false, boss: false, auto: false, folded: false, bossDown: false };
  it('반복 사냥 · 자동 사냥 · 접은 판 = 팡파르 없음', () => {
    expect(winFanfare(base)).toBe(false);
    expect(winFanfare({ ...base, auto: true })).toBe(false);
    expect(winFanfare({ ...base, boss: true, auto: true })).toBe(false);
    expect(winFanfare({ ...base, first: true, folded: true })).toBe(false);
    expect(winFanfare({ ...base, force: true, folded: true })).toBe(false);
  });
  it('의미 있는 승리 = 팡파르', () => {
    expect(winFanfare({ ...base, first: true })).toBe(true);
    expect(winFanfare({ ...base, first: true, auto: true })).toBe(true);
    expect(winFanfare({ ...base, boss: true })).toBe(true);
    expect(winFanfare({ ...base, mode: 'raid', bossDown: true, auto: true })).toBe(true);
    expect(winFanfare({ ...base, mode: 'raid', bossDown: false })).toBe(false);
    // 심연: 부르는 쪽이 보스 층만 true
    expect(winFanfare({ ...base, force: true })).toBe(true);
    expect(winFanfare({ ...base, first: true, force: false })).toBe(false);
  });
  it('승리: J1·J6·J7 돌려 쓰기 (직전과 다름) · 같은 팡파르 45초에 한 번', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const p = makeFanfarePicker(rnd);
    const seen: string[] = [];
    const at: Record<string, number> = {};
    let t = 0;
    for (let i = 0; i < 200; i++, t += 20) {
      const f = p.pick('win', t);
      if (!f) continue;
      expect(WIN_JINGLES).toContain(f);
      if (seen.length) expect(f).not.toBe(seen[seen.length - 1]);
      if (at[f] != null) expect(t - at[f]).toBeGreaterThanOrEqual(FANFARE_GAP);
      at[f] = t;
      seen.push(f);
    }
    expect(new Set(seen)).toEqual(new Set(WIN_JINGLES));
  });
  it('짧은 시간에 연달아 이기면 세 번째 뒤로는 coin(null)', () => {
    const p = makeFanfarePicker(() => 0);
    const got = [0, 5, 10, 15, 20].map((t) => p.pick('win', t));
    expect(got.slice(0, 3).every(Boolean)).toBe(true);
    expect(new Set(got.slice(0, 3)).size).toBe(3);
    expect(got[3]).toBeNull();
    expect(got[4]).toBeNull();
    expect(p.pick('win', 46)).toBe(got[0]);
  });
  it('레벨 업 = J8 · 45초에 한 번 · chapter = J1 (승리 J1과 같은 45초)', () => {
    const p = makeFanfarePicker(() => 0);
    expect(p.pick('levelup', 0)).toBe('J8');
    expect(p.pick('levelup', 30)).toBeNull();
    expect(p.pick('levelup', 45)).toBe('J8');
    expect(p.pick('chapter', 100)).toBe('J1');
    expect(p.pick('win', 110)).not.toBe('J1');
  });
});
