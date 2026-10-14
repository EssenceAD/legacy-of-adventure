// RAIDWEAPON §2 전용 무기: 19자루 · ★5·주인만 · 능력치 식 · 고정 옵션 · 전수 전용→전용 · 조각/상자 · 나오는 곳 · 회관 1번 · ★5 알림 · 플래그 끔 = 아무것도 안 함
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { EX_WEAPONS, exShort } from '../src/data/exweapons';
import { STAR_IDS, STARS } from '../src/data/fivestars';
import { LEGENDS, legendByKey } from '../src/data/legends';
import { REGIONS } from '../src/data/items';
import { appearance, makeLegend } from '../src/world/adventurers';
import { makeStar } from '../src/world/fivestars';
import { setFlag } from '../src/world/flags';
import { exAwakeText, exCanWear, exWhy } from '../src/world/exGate';
import {
  abyssFrags, boxChoices, boxCount, bundleFrags, exBaseStats, exFixedOpt, exRetro, grantEx, makeEx, openBox, raidFrags,
} from '../src/world/exWeapons';
import { addFrags, fragCount, rwState } from '../src/world/frags';
import { equip, makeItem, optSum } from '../src/world/items';
import { transferPlan } from '../src/world/enhTransfer';
import { starUpLegend } from '../src/world/legends';
import { beginRaid, expectOf, settle, weeklyTarget } from '../src/world/raid';
import { clearFloor } from '../src/world/abyss';
import { migrate } from '../src/save/save';
import { P, resetProgress, S, uiHooks, world, type Actor } from '../src/world/state';

const FR = CONFIG.raidWeapon.frag;
const EX = CONFIG.raidWeapon.ex;
let said: string[] = [];
const origAnnounce = uiHooks.announce;
const legend = (key = 'leon', stars = 1) => {
  const a = makeLegend(key, 5, 5);
  a.id = P.nextAdvId++;
  a.status = 'hero';
  a.stars = stars;
  world.actors.push(a);
  return a;
};
const star = (id = STAR_IDS[0], stars = 1) => {
  const a = makeStar(id, 5, 5);
  a.id = P.nextAdvId++;
  a.stars = stars;
  world.actors.push(a);
  return a;
};
beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div>';
  world.actors = [];
  world.home = null;
  S.visiting = null as never;
  S.day = 5;
  setFlag('exWeapons', true);
  setFlag('fiveStars', true);
  said = [];
  uiHooks.announce = (t: string) => void said.push(t);
});
afterEach(() => {
  setFlag('exWeapons', false);
  setFlag('fiveStars', false);
  uiHooks.announce = origAnnounce;
});

describe('카탈로그', () => {
  it('19자루 = 전설 14 + 다섯 별 5 · 키가 모두 진짜 영웅', () => {
    expect(EX_WEAPONS.length).toBe(19);
    expect(EX_WEAPONS.filter((d) => d.owner === 'legend').map((d) => d.id).sort()).toEqual(LEGENDS.map((l) => l.key).sort());
    expect(EX_WEAPONS.filter((d) => d.owner === 'star').map((d) => d.id)).toEqual(STAR_IDS);
    expect(new Set(EX_WEAPONS.map((d) => d.name)).size).toBe(19);
    expect(exShort(EX_WEAPONS.find((d) => d.id === 'woongs')!)).toBe('양손 대검');
  });
});

describe('능력치 · 옵션', () => {
  it('바탕 = 가장 높은 지역 고유 무기(유물 가운데 값) × 1.15 · 유물 등급 · 무기 칸 · 직업 무기', () => {
    const it = makeEx('leon', () => 0.5, 'abyss')!;
    const ri = REGIONS.findIndex((r) => r.id === 'abyss');
    const scale = 6 * CONFIG.items.regionStat ** ri * CONFIG.items.gradeMult.a;
    expect(it.stats.atk).toBe(Math.round(scale * EX.exMult));
    expect(exBaseStats('abyss').atk).toBeGreaterThan(Math.round(scale * 1.14));
    expect(it.grade).toBe('a');
    expect(it.slot).toBe('weapon');
    expect(it.ex).toBe('leon');
    expect(it.wkind).toBe('sword');
    expect(makeEx('nope')).toBeNull();
  });
  it('고정 옵션 1 (스킬 k · 값 50% · 재련 불가) + 일반 2', () => {
    const it = makeEx('grom', () => 0.3, 'forest')!;
    const sk = legendByKey('grom')!.skill;
    expect(it.opts.length).toBe(1 + EX.rolled);
    expect(it.opts[0]).toMatchObject({ k: sk.k, v: Math.round(sk.v * 0.5), u: true });
    expect(it.opts.slice(1).every((o) => !o.u)).toBe(true);
    // 지역 피해 스킬은 그 지역 그대로
    expect(exFixedOpt(EX_WEAPONS.find((d) => d.id === 'vael')!)).toMatchObject({ k: 'regionDmg', region: 'abyss', v: 15 });
    // 다섯 별 스킬
    expect(makeEx('woongs')!.opts[0]).toMatchObject({ k: STARS.woongs.skill.k, v: Math.round(STARS.woongs.skill.v * 0.5) });
  });
});

describe('끼우기 조건', () => {
  it('★5 전엔 가방에만 · ★5면 그 영웅만', () => {
    const leon = legend('leon', 4);
    const grom = legend('grom', 5);
    const it = grantEx('leon')!;
    expect(P.bag.includes(it)).toBe(true);
    expect(exWhy(leon, it)).toBe('★5가 되면 깨어나요');
    equip(leon, it);
    expect(it.owner ?? null).toBeNull();
    expect(exCanWear(grom, it)).toBe(false);
    equip(grom, it);
    expect(grom.equip.weapon ?? null).toBeNull();
    leon.stars = 5;
    equip(leon, it);
    expect(it.owner).toBe(leon.id);
    // 고정 옵션이 실제로 더해짐
    expect(optSum(leon, 'chemPct')).toBeGreaterThanOrEqual(legendByKey('leon')!.skill.v * 1.5 + 10);
  });
  it('처음 끼우면 깨어남 알림 1번 · 다섯 별 궤적 색 · 전설 금빛', () => {
    const w = star('woongs', 5);
    const it = grantEx('woongs')!;
    equip(w, it);
    expect(said).toContain('★ 웅스의 양손 대검이 깨어났습니다!');
    expect(exAwakeText(w, EX_WEAPONS.find((d) => d.id === 'woongs')!)).toBe('★ 웅스의 양손 대검이 깨어났습니다!');
    equip(w, it);
    expect(said.filter((s) => s.includes('깨어났습니다')).length).toBe(1);
    expect(rwState().awoke).toEqual(['woongs']);
    expect(appearance(w).def.weaponColor).toBe(STARS.woongs.trail);
    const l = legend('leon', 5);
    expect(appearance(l).def.weaponColor).not.toBe(EX.legendColor); // 아직 전용 무기 없음
    equip(l, grantEx('leon')!);
    expect(appearance(l).def.weaponColor).toBe(EX.legendColor);
  });
  it('★5 알림: 켜졌으면 「깨어날 준비」 · 꺼졌으면 예전 문구', () => {
    const a = legend('aria', 4);
    P.tokens = 99;
    expect(starUpLegend(a)).toBeNull();
    expect(said.at(-1)).toBe('★ 아리아의 유산 무기가 깨어날 준비가 됐어요');
    setFlag('exWeapons', false);
    const b = legend('leon', 4);
    expect(starUpLegend(b)).toBeNull();
    expect(said.at(-1)).toBe('★ 레온의 유산 무기가 깨어났습니다!');
  });
});

describe('전수 — 전용 → 전용만', () => {
  it('전용↔일반은 막히고 전용끼리는 규칙대로', () => {
    S.gold = 1e9;
    const a = grantEx('leon')!;
    const b = grantEx('grom')!;
    const relic = makeItem('abyss', 'a', 'weapon', false);
    P.bag.push(relic);
    a.enh = 8;
    relic.enh = 8;
    expect(transferPlan(relic, b).why).toContain('전용 무기끼리만');
    expect(transferPlan(a, relic).why).toContain('전용 무기에게만');
    expect(transferPlan(a, b).why).not.toContain('전용');
  });
});

describe('조각 · 선택 상자', () => {
  it('10 = 상자 1 · 영입한 영웅 중 없는 사람만 · 다 있으면 같은 것 하나 더', () => {
    legend('leon', 1);
    star('gonu', 1);
    addFrags(25, 'test');
    expect(fragCount()).toBe(25);
    expect(boxCount()).toBe(2);
    expect(boxChoices().defs.map((d) => d.id)).toEqual(['leon', 'gonu']);
    expect(openBox('grom')).toBe('고를 수 없는 무기예요');
    const it = openBox('leon');
    expect(typeof it).toBe('object');
    expect(fragCount()).toBe(15);
    expect(boxChoices()).toEqual({ defs: [EX_WEAPONS.find((d) => d.id === 'gonu')], dup: false });
    openBox('gonu');
    expect(fragCount()).toBe(5);
    expect(boxCount()).toBe(0);
    expect(typeof openBox('leon')).toBe('string');
    const ch = boxChoices();
    expect(ch.dup).toBe(true);
    expect(ch.defs.map((d) => d.id)).toEqual(['leon', 'gonu']);
    rwState().boxes = 1;
    expect(boxCount()).toBe(1);
    openBox('leon');
    expect(rwState().boxes).toBe(0);
    expect(fragCount()).toBe(5);
    expect(rwState().got.leon).toBe(2);
  });
  it('영입한 영웅이 없으면 열 수 없음', () => {
    addFrags(10, 'test');
    expect(openBox('leon')).toContain('영입');
  });
});

describe('나오는 곳', () => {
  it('주간 토벌: 첫 보스 1 · 연속 2·3번째는 50%', () => {
    expect(raidFrags(1)).toBe(FR.raidFirst);
    expect(raidFrags(2, () => 0.1)).toBe(FR.raidChainN);
    expect(raidFrags(3, () => 0.9)).toBe(0);
    expect(fragCount()).toBe(FR.raidFirst + FR.raidChainN);
  });
  it('settle: 주간 보스를 잡으면 조각 · 못 잡으면 0', () => {
    S.started = true as never;
    const t = weeklyTarget();
    const r1 = settle(t, [], 1, 'manual', expectOf([], t.boss), beginRaid()!);
    expect(r1.frags ?? 0).toBe(0);
    const t2 = weeklyTarget();
    const r2 = settle(t2, [], t2.hpLeft + 10, 'manual', expectOf([], t2.boss), beginRaid()!);
    expect(r2.killed).toBe(true);
    expect(r2.frags).toBe(1);
    expect(fragCount()).toBe(1);
  });
  it('심연 25층마다 1 · 같은 주에 같은 층 다시는 X · 새 주엔 다시', () => {
    const now = Date.UTC(2026, 9, 14, 3);
    expect(abyssFrags(24, now)).toBe(0);
    expect(abyssFrags(25, now)).toBe(1);
    expect(abyssFrags(25, now)).toBe(0);
    expect(abyssFrags(50, now)).toBe(1);
    expect(abyssFrags(25, now + 7 * 864e5)).toBe(1);
    expect(fragCount()).toBe(3);
    clearFloor(75, null, () => 0.99, now);
    expect(fragCount()).toBe(4);
  });
  it('회관 「토벌 전리품」: 5 · 1번만 · 이미 고친 옛 저장도 exRetro로 한 번', () => {
    P.bundles.rooms = ['raid'];
    exRetro();
    expect(fragCount()).toBe(FR.bundle);
    exRetro();
    expect(bundleFrags()).toBe(0);
    expect(fragCount()).toBe(FR.bundle);
    expect(rwState().bundle).toBe(true);
  });
});

describe('플래그 끔 · 저장', () => {
  it('끄면 조각·상자·나오는 곳 모두 아무것도 안 함 · 끼울 수도 없음', () => {
    setFlag('exWeapons', false);
    P.bundles.rooms = ['raid'];
    addFrags(10, 'test');
    expect(raidFrags(1)).toBe(0);
    expect(abyssFrags(25)).toBe(0);
    expect(bundleFrags()).toBe(0);
    expect(fragCount()).toBe(0);
    expect(rwState().bundle).toBe(false);
    const a = legend('leon', 5);
    const it = makeEx('leon')!;
    P.bag.push(it);
    equip(a, it);
    expect(it.owner ?? null).toBeNull();
    expect(typeof openBox('leon')).toBe('string');
  });
  it('옛 저장 = 조각 0 · 망가진 값 바로잡기', () => {
    const d = migrate({ version: 8, buildings: [{ kind: 'inn', tx: 5, ty: 5 }], progress: {} }) as { progress: { raidWeapon?: unknown } };
    expect(d).toBeTruthy();
    (P as { raidWeapon: unknown }).raidWeapon = { frags: 'x', got: [], awoke: [1, 'leon', 'leon'] };
    const st = rwState();
    expect(st).toMatchObject({ frags: 0, boxes: 0, got: {}, awoke: ['leon'], bundle: false, abyssHi: 0 });
  });
});
void ({} as Actor);
