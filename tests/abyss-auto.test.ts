// v0.24.4: 끝없는 심연 보스 층(5·10·15) AUTO — 동료가 보스를 때린다 (근접만 있는 파티도)
import { afterEach, describe, expect, it } from 'vitest';
import { makeAdventurer } from '../src/world/adventurers';
import { simAbyssBoss } from '../src/combat/sim';
import { REGION_BOSS } from '../src/combat/mons';
import { setFlag } from '../src/world/flags';
import { world, type Actor } from '../src/world/state';

const mk = (kind: string, lvl = 50): Actor => Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind, lvl, race: 'human', rarity: 'common', hp: 100, mood: 80, food: 80 }) as Actor;
const parties: Record<string, string[]> = {
  melee: ['knight', 'rogue', 'dwarf', 'rogue'],
  mixed: ['knight', 'rogue', 'cleric', 'mage'],
};
afterEach(() => setFlag('aiBossTarget', true));

describe('끝없는 심연 보스 층 AUTO', () => {
  for (const [name, kinds] of Object.entries(parties))
    for (const floor of [5, 10, 15])
      it(`${name} · ${floor}층: 보스 피해 > 0`, () => {
        for (const look of [REGION_BOSS.deep, REGION_BOSS.abyss, REGION_BOSS.forest]) {
          const ms = kinds.map((k) => mk(k));
          world.actors = ms;
          const r = simAbyssBoss(floor, ms, look, 1);
          expect(r.bossMax).toBeGreaterThan(0);
          expect(r.bossDmg).toBeGreaterThan(0);
          // 근접만 있어도 보스 체력을 의미 있게 깎는다
          expect(r.bossDmg / r.bossMax).toBeGreaterThan(0.2);
        }
      });
});
