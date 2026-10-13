// ROLES: 직업마다 체력 · 플래그 끄면 예전 체력 · 사제 한 번 살리기 · 조합 예고 +
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer } from '../src/world/adventurers';
import { applyRolesHp, makeField, spawnBoss, step } from '../src/combat/field';
import { REGION_BOSS } from '../src/combat/mons';
import { setFlag } from '../src/world/flags';
import { world, type Actor } from '../src/world/state';

const C = CONFIG.combat;
const mk = (kind: string, lvl = 50): Actor => Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind, lvl, race: 'human', rarity: 'common', hp: 100, mood: 80, food: 80 }) as Actor;
afterEach(() => setFlag('rolesV2', true));

describe('ROLES', () => {
  it('체력: 기사 > 드워프 > 사제 > 도적 > 마법사 · 일반 몬스터 한 대가 기사 10%쯤', () => {
    const ms = [mk('knight'), mk('dwarf'), mk('cleric'), mk('mage')];
    world.actors = ms;
    const f = makeField('abyss', 10, ms, true);
    for (const u of f.allies) u.power = f.rec / 3;
    applyRolesHp(f);
    expect(f.allies[0].max).toBeGreaterThan(C.hpBase + 50 * C.hpPerLv);
    const hp = f.allies.map((u) => u.max);
    expect(hp[0]).toBeGreaterThan(hp[1]);
    expect(hp[1]).toBeGreaterThan(hp[2]);
    expect(hp[2]).toBeGreaterThan(hp[3]);
    expect(f.comboTele).toBeCloseTo(C.roles.comboTele);
  });
  it('플래그를 끄면 예전 체력(120 + 레벨×12) · 조합 예고 없음', () => {
    setFlag('rolesV2', false);
    const ms = [mk('knight'), mk('cleric'), mk('rogue')];
    world.actors = ms;
    const f = makeField('abyss', 10, ms, true);
    for (const u of f.allies) expect(u.max).toBe(C.hpBase + 50 * C.hpPerLv);
    expect(f.roles).toBeFalsy();
  });
  it('사제가 살아 있으면 쓰러진 동료를 3초 뒤 30%로 한 번 일으킨다', () => {
    const ms = [mk('rogue'), mk('cleric')];
    world.actors = ms;
    const f = makeField('forest', 1, ms, false);
    f.units = f.units.filter((u) => u.team === 'ally');
    const boss = (spawnBoss(f, REGION_BOSS.forest, 1e9, 14, 14), f.elite!);
    boss.atk = 1e9;
    const r = f.allies[0];
    r.x = boss.x;
    r.y = boss.y;
    boss.st = 'tele';
    boss.stT = 0;
    boss.tele = { x: boss.x, y: boss.y, r: 1 };
    (boss as never as { curPat: number }).curPat = 1;
    f.allies[1].x = 1;
    f.allies[1].y = 1;
    step(f, 1 / 30);
    expect(r.dead).toBe(true);
    for (let t = 0; t < 3.2; t += 1 / 30) step(f, 1 / 30);
    expect(r.dead).toBe(false);
    expect(r.hp / r.max).toBeGreaterThan(0.25);
    expect(f.rvLeft).toBe(0);
  });
});
