// RAIDWEAPON §3' 하늘 균열 (worldRaid) — 서버는 가짜(sb.rpc)로: 도전 3번 · 60초 끝 · 전멸 끝 · 피해 자르기(서버와 같은 규칙) · 결과·순위 글 · 알약 조건 · 함수 없음 · 보상 한 번만
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../src/net/server', async (orig) => ({ ...(await orig<typeof import('../src/net/server')>()), sb: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { CONFIG } from '../src/data/config';
import { makeField, step } from '../src/combat/field';
import { riftLook } from '../src/combat/riftLook';
import { me } from '../src/net/server';
import { _resetRiftNet, riftServer, worldClaim, worldCurrent, worldHit, worldRank, worldRoll, type RiftBoss, type RiftReward } from '../src/net/worldRaid';
import { makeAdventurer } from '../src/world/adventurers';
import { setFlag } from '../src/world/flags';
import { fragCount } from '../src/world/frags';
import { claimMail, titlesOwned, addMail } from '../src/world/meta';
import {
  clampDmg, endReason, localHp, runCap, mailRewards, noticeLines, pillVisible, resultLine, rewardMail, riftLock, riftMultHook, riftOn, riftRewardMult, startLock, triesLeft, villagePct,
} from '../src/world/rift';
import { riftDay } from '../src/world/riftDay';
import { P, resetProgress, S, type Actor } from '../src/world/state';

const W = CONFIG.raidWeapon.world;
const NOW = Date.parse('2026-10-15T22:00:00+09:00');
const boss = (o: Partial<RiftBoss> = {}): RiftBoss => ({
  id: 7, name: '하늘을 삼킨 것', look: 'sky', hpMax: 3_000_000, hpLeft: 3_000_000, startsAt: NOW - 3600e3, endsAt: Date.parse('2026-10-16T05:00:00+09:00'), day: '2026-10-15', test: false, killed: false,
  killerInn: null, players: 4, myTries: 0, myTotal: 0, myRank: null, triesMax: 3, now: NOW, ...o,
});
const srvBoss = (o: Record<string, unknown> = {}) => ({
  id: 7, name: '하늘을 삼킨 것', look: 'sky', hp_max: 3000000, hp_left: 2500000, starts_at: '2026-10-15T12:00:00Z', ends_at: '2026-10-15T20:00:00Z', day: '2026-10-15', test: false, killed: false,
  killer_inn: null, players: 5, my_tries: 1, my_total: 400000, my_rank: 2, tries_max: 3, now: '2026-10-15T13:00:00Z', ...o,
});
const mk = (kind: string, lvl = 50): Actor => Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind, lvl, race: 'human', rarity: 'common', hp: 100, mood: 80, food: 80 }) as Actor;
const login = () => (me.profile = { id: 'u-me', login_id: 'tester01', nickname: '시험', inn_name: '시험 여관', rep_hero: null, reputation: 0, codex_pct: 0, created_at: '' });

beforeEach(() => {
  resetProgress();
  S.visiting = null as never;
  rpc.mockReset();
  _resetRiftNet();
  login();
  setFlag('worldRaid', true);
  setFlag('exWeapons', true);
  P.guide.unlocked.push('raid');
  riftMultHook.fn = () => 1;
});
afterEach(() => {
  setFlag('worldRaid', false);
  setFlag('exWeapons', false);
  me.profile = null;
});

describe('열림 · 알약', () => {
  it('플래그 끄면 알약 없음', () => {
    setFlag('worldRaid', false);
    expect(riftOn()).toBe(false);
    expect(pillVisible(boss(), NOW)).toBe(false);
  });
  it('토벌이 안 열린 장부면 알약 없음 · 이유 한 줄', () => {
    P.guide.unlocked = [];
    P.guide.legacy = false;
    expect(riftLock()).toContain('장부');
    expect(pillVisible(boss(), NOW)).toBe(false);
    expect(startLock(boss(), NOW)).toContain('장부');
  });
  it('열린 균열이 있을 때만 · 끝났거나 이웃 방문 중이면 없음', () => {
    expect(riftLock()).toBeNull();
    expect(pillVisible(boss(), NOW)).toBe(true);
    expect(pillVisible(null, NOW)).toBe(false);
    expect(pillVisible(boss({ endsAt: NOW - 1 }), NOW)).toBe(false);
    expect(pillVisible(boss(), NOW, true)).toBe(false);
  });
});

describe('하루 3번 (토벌과 따로)', () => {
  it('서버 기록 + 못 올린 판을 센다', () => {
    expect(triesLeft(boss())).toBe(W.tries);
    expect(triesLeft(boss({ myTries: 2 }))).toBe(1);
    expect(triesLeft(boss({ myTries: 2 }), 1)).toBe(0);
    expect(startLock(boss({ myTries: 3 }), NOW)).toBe('오늘 도전 0/3 · 05:00에 채워져요');
    expect(startLock(boss({ myTries: 2 }), NOW, 1)).toContain('0/3');
    expect(startLock(boss({ myTries: 2 }), NOW)).toBeNull();
    // 토벌 도전 횟수와 상관없음
    P.raid.tries = 99;
    expect(startLock(boss(), NOW)).toBeNull();
  });
  it('쓰러졌거나 단골이 없으면 막힘', () => {
    expect(startLock(boss({ killed: true, hpLeft: 0 }), NOW)).toContain('쓰러졌어요');
    expect(startLock(boss(), NOW, 0, 0)).toContain('단골');
  });
});

describe('전투: 60초 · 전멸', () => {
  const party = () => [mk('knight'), mk('dwarf'), mk('cleric')];
  it('60초가 다 되면 끝 (승패 없음 · 피해만)', () => {
    const f = makeField('deep', 10, party(), true, { mode: 'raid', raid: { look: riftLook('sky'), hp: 1e12, seconds: W.seconds, power: 100 }, world: true, music: 'world_raid', noFold: true });
    expect(f.world).toBe(true);
    expect(f.time).toBe(W.seconds);
    // (멈칫·필살기 컷 동안은 시간이 멈춘다 — 토벌과 같음)
    for (let t = 0; t < 200 && !f.done; t += 1 / 30) step(f, 1 / 30);
    expect(f.done).toBe('win');
    expect(f.time).toBeLessThanOrEqual(0);
    expect(f.raidDmg).toBeGreaterThan(0);
    expect(endReason({ win: true, timeLeft: 0 })).toBe('time');
  });
  it('파티가 쓰러지면 그때까지 피해로 끝', () => {
    const ms = party().map((a) => Object.assign(a, { lvl: 1 }));
    const f = makeField('deep', 10, ms, true, { mode: 'raid', raid: { look: riftLook('frost'), hp: 1e12, seconds: W.seconds, power: 5e7 }, world: true });
    for (let t = 0; t < 70 && !f.done; t += 1 / 30) step(f, 1 / 30);
    expect(f.done).toBe('lose');
    expect(f.time).toBeGreaterThan(0);
    expect(endReason({ win: false, timeLeft: f.time })).toBe('wipe');
    expect(endReason({ win: false, timeLeft: 0, quit: true })).toBe('quit');
  });
  it('보스 3종 순환 그림 (없는 키는 하늘을 삼킨 것)', () => {
    expect(riftLook('sky').id).toBe('rift_sky');
    expect(riftLook('ember').name).toBe('균열 너머의 잿불 거인');
    expect(riftLook('frost').minion).toBe(W.bosses.frost.minion);
    expect(riftLook('???').id).toBe('rift_sky');
  });
});

describe('피해 자르기 (서버 world_hit 과 같은 규칙)', () => {
  it('전투력 합 × cap · 보스 최대 체력 × hitMaxFrac (시험 보스는 체력 줄 없음)', () => {
    expect(clampDmg(1e9, 1000, 1e9)).toBe(1000 * W.cap);
    expect(clampDmg(5e6, 1e6, 3e6)).toBe(Math.ceil(3e6 * W.hitMaxFrac));
    expect(clampDmg(5e6, 1e6, 3000, true)).toBe(5e6);
    expect(clampDmg(-5, 100, 1e6)).toBe(0);
    expect(clampDmg(NaN, 100, 1e6)).toBe(0);
    expect(clampDmg(1234.6, 100, 1e6)).toBe(1235);
  });
  it('이 판 보스 체력: 남은 공용 체력을 상한 안에서 다 깎을 수 있을 때만 쓰러짐 (진짜 마지막 일격)', () => {
    expect(runCap(boss(), 1000)).toBe(1000 * W.cap);
    expect(runCap(boss(), 1e7)).toBe(Math.ceil(3e6 * W.hitMaxFrac));
    expect(localHp(boss({ hpLeft: 50000 }), 1000)).toBe(50000);
    expect(localHp(boss({ hpLeft: 2e6 }), 1e7)).toBeGreaterThan(1e12);
    expect(localHp(boss({ hpLeft: 0 }), 1000)).toBeGreaterThan(1e12);
  });
});

describe('결과 · 순위 글', () => {
  it('「내 피해 ○ · 오늘 순위 ○위 · 마을 전체 ○%」', () => {
    expect(resultLine(123456, 4, { hpMax: 1000, hpLeft: 630 })).toBe('내 피해 123,456 · 오늘 순위 4위 · 마을 전체 37%');
    expect(resultLine(0, null, { hpMax: 1000, hpLeft: 1000 })).toBe('내 피해 0 · 오늘 순위 — · 마을 전체 0%');
    expect(villagePct({ hpMax: 1e6, hpLeft: 1e6 - 1 })).toBe('1%');
    expect(villagePct({ hpMax: 1e6, hpLeft: 1 })).toBe('99%');
    expect(villagePct({ hpMax: 1e6, hpLeft: 0 })).toBe('100%');
  });
  it('50% · 25% · 처치 알림 (넘을 때 한 번)', () => {
    expect(noticeLines('서리 뱀', 600, 450, 1000).map((l) => l.text)).toEqual(['🌌 균열 너머의 서리 뱀의 체력이 절반 남았어요!']);
    expect(noticeLines('서리 뱀', 600, 200, 1000).map((l) => l.t)).toEqual([0.5, 0.25]);
    expect(noticeLines('서리 뱀', 100, 0, 1000, '솔바람 여관')[0].text).toBe('🌌 솔바람 여관의 마지막 일격! 균열 너머의 서리 뱀이(가) 쓰러졌어요!');
    expect(noticeLines('서리 뱀', 400, 300, 1000)).toEqual([]);
  });
  it('균열의 하루 = 05:00 KST 에 바뀜', () => {
    expect(riftDay(Date.parse('2026-10-16T04:59:00+09:00'))).toBe('2026-10-15');
    expect(riftDay(Date.parse('2026-10-16T05:00:00+09:00'))).toBe('2026-10-16');
  });
});

describe('서버 부르기 (가짜)', () => {
  it('지금 보스 · 한 판 올리기 · 순위', async () => {
    rpc.mockImplementation(async (fn: string, a: Record<string, unknown>) => {
      if (fn === 'world_current') return { data: a.p_test ? null : srvBoss(), error: null };
      if (fn === 'world_hit') return { data: { r: 'ok', dmg: 60000, killed_now: false, ...srvBoss({ my_tries: 2, hp_left: 2440000 }) }, error: null };
      // R31: user_id·닉네임 없음 · 내 줄은 mine · 내 순위/피해 합은 서버 my_rank·my_total (auth.uid())
      if (fn === 'world_rank') return { data: { boss_id: 7, day: '2026-10-15', week_start: '2026-10-12', name: '하늘을 삼킨 것', day_rows: [{ rank: 1, inn_name: '솔바람 여관', rep_hero: null, dmg: 900000, mine: false }, { rank: 2, inn_name: '시험 여관', rep_hero: null, dmg: 460000, mine: true }], my_rank: 2, my_total: 460000, week_rows: [], my_week_rank: null, my_week_total: 0 }, error: null };
      return { data: null, error: null };
    });
    const b = await worldCurrent();
    expect(b).toMatchObject({ id: 7, hpLeft: 2500000, myTries: 1, myRank: 2, players: 5 });
    expect(await worldCurrent(true)).toBeNull();
    const h = await worldHit(7, 99999.4, 1000);
    expect(rpc).toHaveBeenLastCalledWith('world_hit', { p_boss: 7, p_dmg: 99999, p_power: 1000 });
    expect(h.ok && h.dmg).toBe(60000);
    expect(h.ok && h.boss.myTries).toBe(2);
    const r = await worldRank(30);
    expect(r !== 'missing' && r?.dayRows[0].inn_name).toBe('솔바람 여관');
    expect(r !== 'missing' && r?.meDay).toEqual({ rank: 2, dmg: 460000 });
    expect(r !== 'missing' && r?.meWeek).toBeNull();
    expect(r !== 'missing' && r?.dayRows.map((x) => x.mine)).toEqual([false, true]);
    expect(r !== 'missing' && Object.keys(r!.dayRows[0])).not.toContain('user_id');
  });
  it('하루 3번 넘으면 서버가 tries', async () => {
    rpc.mockResolvedValue({ data: { r: 'tries', ...srvBoss({ my_tries: 3 }) }, error: null });
    const h = await worldHit(7, 1000, 100);
    expect(h).toMatchObject({ ok: false, why: 'tries' });
    expect(!h.ok && h.boss && triesLeft(h.boss)).toBe(0);
  });
  it('SQL이 아직 없으면(함수 없음) 조용히 — 오류 없이 null · 다시 안 물음', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.world_current in the schema cache' } });
    await expect(worldRoll()).resolves.toBeUndefined();
    expect(riftServer.missing).toBe(true);
    expect(await worldCurrent()).toBeNull();
    expect(await worldRank(30)).toBe('missing');
    expect(await worldHit(7, 1, 1)).toMatchObject({ ok: false, why: 'missing' });
    expect(await worldClaim()).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('네트워크 오류는 null (missing 아님)', async () => {
    rpc.mockRejectedValue(new Error('offline'));
    expect(await worldCurrent()).toBeNull();
    expect(riftServer.missing).toBe(false);
    expect(await worldHit(7, 1, 1)).toMatchObject({ ok: false, why: 'net' });
  });
  it('로그인 안 했으면 서버를 안 부른다', async () => {
    me.profile = null;
    expect(await worldCurrent()).toBeNull();
    expect(await worldHit(7, 1, 1)).toMatchObject({ ok: false, why: 'login' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('보상 → 우편함 (한 번만)', () => {
  const rows: RiftReward[] = [
    { id: 11, kind: 'daily', day: '2026-10-15', week: null, payload: { frags: 4, dust: 40, title: '균열의 영웅', rank: 2, killed: true, dmg: 900000, name: '하늘을 삼킨 것' } },
    { id: 12, kind: 'weekly', day: '2026-10-18', week: '2026-10-12', payload: { boxes: 1, rank: 1, dmg: 5e6 } },
  ];
  it('서버가 claimed 로 바꾼 줄을 편지로 · 같은 번호는 다시 안 넣음', async () => {
    rpc.mockResolvedValueOnce({ data: rows.map((r) => ({ ...r, payload: r.payload })), error: null });
    const got = await worldClaim();
    expect(got.map((r) => r.id)).toEqual([11, 12]);
    expect(mailRewards(got, addMail)).toBe(2);
    expect(mailRewards(got, addMail)).toBe(0);
    expect(P.meta.mail.filter((m) => m.from === 'rift')).toHaveLength(2);
  });
  it('편지를 열면 조각 · 상자 · 하루 칭호', () => {
    mailRewards(rows, addMail);
    const d = P.meta.mail.find((m) => m.rid === 11)!;
    const w = P.meta.mail.find((m) => m.rid === 12)!;
    const dust0 = P.dust.n;
    claimMail(d.id);
    expect(fragCount()).toBe(4);
    expect(P.dust.n).toBeGreaterThan(dust0);
    expect(titlesOwned().some((t) => t.t === '균열의 영웅')).toBe(true);
    claimMail(w.id);
    expect(P.raidWeapon.boxes).toBe(1);
    expect(claimMail(d.id)).toBeNull();
    expect(fragCount()).toBe(4);
  });
  it('칭호는 받은 균열의 하루 동안만', () => {
    mailRewards(rows.slice(0, 1), addMail);
    const d = P.meta.mail.find((m) => m.rid === 11)!;
    claimMail(d.id);
    d.reward.titleUntil = '2000-01-01';
    expect(titlesOwned().some((t) => t.t === '균열의 영웅')).toBe(false);
  });
  it('버닝 배수 (기본 1 · 버닝 모듈이 hook 을 채우면 조각만 ×)', () => {
    expect(riftRewardMult('2026-10-17')).toBe(1);
    riftMultHook.fn = (day) => (day === '2026-10-17' || day === '2026-10-18' ? 2 : 1);
    const m = rewardMail({ id: 1, kind: 'daily', day: '2026-10-17', week: null, payload: { frags: 2, dust: 40 } });
    expect(m.reward).toEqual({ frags: 4, dust: 40 });
    expect(m.body).toContain('버닝');
    expect(rewardMail({ id: 2, kind: 'daily', day: '2026-10-16', week: null, payload: { frags: 2 } }).reward.frags).toBe(2);
    riftMultHook.fn = () => NaN;
    expect(riftRewardMult('2026-10-17')).toBe(1);
  });
});

describe('R31 (10/15 형철) — 순위 user_id 없음 · 내 순위는 서버', () => {
  const rankData = (o: Record<string, unknown>) => ({ boss_id: 7, day: '2026-10-15', week_start: '2026-10-12', name: '하늘을 삼킨 것', day_rows: [], week_rows: [], ...o });
  it('내 순위 = 서버 my_rank·my_total (줄에서 user_id 를 찾지 않는다)', async () => {
    rpc.mockResolvedValue({ data: rankData({ day_rows: [{ rank: 1, inn_name: '솔바람 여관', rep_hero: 'hero', dmg: 9e5, mine: false, user_id: 'u-me' }], my_rank: 31, my_total: 1234, my_week_rank: 4, my_week_total: 99999 }), error: null });
    const r = await worldRank(30);
    if (!r || r === 'missing') throw new Error('rank');
    // 서버가 실수로 user_id 를 보내도 버린다 · 내 줄 표시는 mine 만
    expect(r.dayRows[0]).toEqual({ rank: 1, inn_name: '솔바람 여관', rep_hero: 'hero', dmg: 9e5, mine: false });
    expect(r.meDay).toEqual({ rank: 31, dmg: 1234 });
    expect(r.meWeek).toEqual({ rank: 4, dmg: 99999 });
  });
  it('테스트 계정은 서버가 순위에서 뺀다 → my_rank null · 피해 합만 (줄·순위 번호·주간 합산 제외는 SQL world_ranked)', async () => {
    rpc.mockResolvedValue({ data: rankData({ my_rank: null, my_total: 5000, my_week_rank: null, my_week_total: 0 }), error: null });
    const r = await worldRank(30);
    if (!r || r === 'missing') throw new Error('rank');
    expect(r.meDay).toEqual({ rank: null, dmg: 5000 });
    expect(r.meWeek).toBeNull();
  });
  it('로그인 안 했으면 내 순위 없음 · 순위 번호 없는 줄은 버림', async () => {
    me.profile = null;
    rpc.mockResolvedValue({ data: rankData({ day_rows: [{ inn_name: '이상한 줄' }, { rank: 1, inn_name: 'A', dmg: 1 }], my_rank: 1, my_total: 1 }), error: null });
    const r = await worldRank(30);
    if (!r || r === 'missing') throw new Error('rank');
    expect(r.dayRows.map((x) => x.inn_name)).toEqual(['A']);
    expect(r.meDay).toBeNull();
  });
});

describe('R31 — SQL ↔ config 같은 숫자 (supabase/world_raid.sql world_c)', async () => {
  const fs = await import('node:fs');
  const sql = fs.readFileSync('supabase/world_raid.sql', 'utf8');
  const c = (k: string) => {
    const m = sql.match(new RegExp(`when '${k}'\\s+then\\s+([0-9.]+)`));
    if (!m) throw new Error(`world_c ${k} 없음`);
    return Number(m[1]);
  };
  it('체력 규칙: 첫 300만 · 둘째 600만 · ×1.15 / ×0.8 · [300만, 3,000만]', () => {
    expect(W.hpFirst).toBe(3_000_000);
    expect(W.hpSecond).toBe(6_000_000);
    expect([W.hpMin, W.hpMax, W.killMult, W.missMult]).toEqual([3_000_000, 30_000_000, 1.15, 0.8]);
    expect(c('hp_first')).toBe(W.hpFirst);
    expect(c('hp_second')).toBe(W.hpSecond);
    expect(c('hp_min')).toBe(W.hpMin);
    expect(c('hp_max')).toBe(W.hpMax);
    expect(c('kill_mult')).toBe(W.killMult);
    expect(c('miss_mult')).toBe(W.missMult);
    expect(sql).toContain("select public.world_seed(3000000, 'sky');");
    expect(sql).not.toContain('86400');
  });
  it('나머지 상수도 같다 (도전 · 상한 · 보상)', () => {
    expect([c('tries'), c('cap'), c('flag_ratio'), c('hit_max_frac')]).toEqual([W.tries, W.cap, W.flagRatio, W.hitMaxFrac]);
    expect([c('d_frags'), c('d_dust'), c('d_kill'), c('d_top_n'), c('d_top')]).toEqual([W.daily.frags, W.daily.dust, W.daily.kill, W.daily.topN, W.daily.top]);
    expect([c('w_box_top'), c('w_frag_top'), c('w_frag_n')]).toEqual([W.weekly.boxTop, W.weekly.fragTop, W.weekly.fragN]);
  });
  it('world_rank 는 user_id·nickname 을 내보내지 않음 · world_seed 첫 줄은 잠금 · 순위는 world_ranked 하나로', () => {
    const rank = sql.slice(sql.indexOf('create or replace function public.world_rank('), sql.indexOf('-- ───────── 6.'));
    expect(rank).not.toMatch(/'user_id'|'nickname'/);
    expect(rank).toContain("'my_rank'");
    expect(rank).toContain("'my_week_total'");
    expect(rank.match(/public\.world_ranked\(t\.user_id\)/g)).toHaveLength(2);
    const seed = sql.slice(sql.indexOf('create or replace function public.world_seed('));
    expect(seed.slice(seed.indexOf('begin'), seed.indexOf('begin') + 80)).toMatch(/^begin\s+perform pg_advisory_xact_lock\(hashtext\('world_roll'\)\);/);
    expect(sql).not.toMatch(/join public\.profiles p on p\.id = t\.user_id where not coalesce\(p\.is_test/);
  });
});

describe('R31 — 창이 열려 있으면 서재 쪽지(이야기 대사)를 미룬다', () => {
  it('창이 열려 있는 동안 · 닫은 뒤 잠깐(다른 창으로 넘어가는 사이)도 기다린 뒤 보여 줌', async () => {
    if (!document.getElementById('win')) document.body.insertAdjacentHTML('beforeend', '<div id="win"></div>');
    for (const id of ['winT', 'winB', 'winF', 'winBack', 'scrim']) if (!document.getElementById(id)) document.body.insertAdjacentHTML('beforeend', `<div id="${id}"></div>`);
    const { winSettling } = await import('../src/ui/story');
    const { closeWin } = await import('../src/ui/windows');
    const win = document.getElementById('win')!;
    win.classList.remove('on');
    const t0 = performance.now() + 10_000;
    expect(winSettling(t0)).toBe(false);
    win.classList.add('on');
    expect(winSettling(t0)).toBe(true);
    closeWin(true);
    await new Promise((r) => setTimeout(r, 5));
    const t1 = performance.now();
    expect(winSettling(t1)).toBe(true); // 막 닫음 → 아직 기다림
    expect(winSettling(t1 + 2000)).toBe(false); // 닫고 1.5초 뒤 → 보여 줌
  }, 20000); // 무거운 모듈을 처음 불러오는 시험이라 전체 실행 땐 5초를 넘기기도 함
});
