// PARTY_SPEC: §1 사냥꾼 손님 · §2 파티 조합 보너스 8개 · §3 4번째 자리 · 토벌 기대 피해(4인·조합) · 사냥꾼 카이팅이 벽·구석에서 끼지 않음
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { CLASS_RACES, CLASS_STATS, CLASS_WEAPON, CLASSES, GUEST_KINDS, HUNTER_DEF } from '../src/data/classes';
import { HUNTER_NAMES, SYNERGY_FIRST } from '../src/data/story/hunter';
import { itemName, WEAPON_KINDS } from '../src/data/items';
import { BOSSES } from '../src/data/bosses';
import { MISSIONS } from '../src/data/guide';
import { makeAdventurer, powerOf } from '../src/world/adventurers';
import { fitsClass } from '../src/world/items';
import { isBalanced, partySynMult, synDamageMult, synergiesOf, synergyFx, synergyHint, takeSynergyLine, SYN_IDS, type SynId } from '../src/world/synergy';
import { checkParty4 } from '../src/world/meta';
import { huntPartyMax, party4Open } from '../src/world/party4';
import { expectOf, rankOf } from '../src/world/raid';
import { roleMult } from '../src/world/party';
import { makeField, roomyDir, spawnBoss, step } from '../src/combat/field';
import { REGION_BOSS } from '../src/combat/mons';
import { P, S, world, type Actor, type Building } from '../src/world/state';
import { dexRatio, GUEST_DEX_TOTAL } from '../src/world/progress';

const mk = (kind: string, lvl = 5): Actor => Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind, lvl, race: 'human', rarity: 'common', hp: 100, mood: 80, food: 80 }) as Actor;
const K = (...ks: string[]) => ks.map((k) => ({ kind: k })) as Actor[];

beforeEach(() => {
  S.visiting = false as never;
  S.started = true as never;
  world.home = null as never;
  world.actors = [];
  world.objs = [];
  P.bonds = {};
  P.bag = [];
  P.meta.mail = [];
  P.meta.party4 = false;
  P.meta.party4Seen = false;
  P.meta.synLine = [];
  P.dex.syn = [];
  P.guide.claimed = [];
  P.guide.legacy = false as never;
});

describe('§1 사냥꾼 손님', () => {
  it('여섯 번째 직업 · 능력치 · 종족 · 무기 활(+15% 규칙 그대로)', () => {
    expect(GUEST_KINDS).toContain('hunter');
    expect(GUEST_KINDS.length).toBe(6);
    expect(CLASS_STATS.hunter).toEqual({ atk: 10, def: 4, mag: 2, agi: 10, luk: 7 });
    expect(CLASS_RACES.hunter).toEqual(['human', 'elf', 'elf', 'halfling']);
    expect(CLASS_WEAPON.hunter).toBe('bow');
    expect(WEAPON_KINDS).toContain('bow');
    expect(CLASSES.hunter).toBe(HUNTER_DEF);
    expect(itemName('forest', 'weapon', 'bow', 0)).toMatch(/활$/);
    expect(fitsClass({ kind: 'hunter' }, { slot: 'weapon', wkind: 'bow' })).toBe(true);
    expect(fitsClass({ kind: 'knight' }, { slot: 'weapon', wkind: 'bow' })).toBe(false);
  });
  it('새 사냥꾼 손님은 사냥꾼 이름표 · 어울리는 종족에서', () => {
    for (let i = 0; i < 20; i++) {
      const a = makeAdventurer(5, 5, { kind: 'hunter' });
      expect(CLASS_RACES.hunter).toContain(a.race);
      expect(HUNTER_NAMES).toContain(a.name);
    }
  });
  it('도감 비율(보상)은 처음 다섯 직업 칸으로 — 사냥꾼 칸이 생겨도 옛 비율이 깎이지 않는다', () => {
    P.dex.guests = ['human|knight|common', 'human|hunter|common'];
    expect(dexRatio('guests')).toBeCloseTo(1 / GUEST_DEX_TOTAL);
    expect(GUEST_DEX_TOTAL).toBe(60);
  });
});

describe('§2 파티 조합 보너스', () => {
  const cases: [SynId, string[]][] = [
    ['balanced', ['knight', 'mage', 'cleric']],
    ['guard', ['knight', 'cleric']],
    ['shadow', ['rogue', 'hunter']],
    ['starlight', ['mage', 'cleric']],
    ['ironwall', ['dwarf', 'knight']],
    ['barrage', ['hunter', 'mage']],
    ['alley', ['dwarf', 'rogue']],
    ['same', ['mage', 'mage', 'mage']],
  ];
  for (const [id, ks] of cases)
    it(`${id}: ${ks.join('+')} → 켜짐 · 한 명 빼면 꺼짐`, () => {
      expect(synergiesOf(K(...ks))).toContain(id);
      expect(synergiesOf(K(...ks.slice(1)))).not.toContain(id);
      expect(SYNERGY_FIRST[id]).toBeTruthy();
    });
  it('8개 · 여러 개 동시에 (합산)', () => {
    expect(SYN_IDS.length).toBe(8);
    const ids = synergiesOf(K('knight', 'cleric', 'mage', 'hunter'));
    expect(ids).toEqual(expect.arrayContaining(['balanced', 'guard', 'starlight', 'barrage']));
    const fx = synergyFx(K('knight', 'cleric', 'mage', 'hunter'));
    expect(fx.dmgCut).toBeCloseTo(CONFIG.synergy.balanced.dmgCut + CONFIG.synergy.guard.dmgCut);
    expect(fx.cdCut).toBeCloseTo(0.1);
    expect(fx.atk).toBeCloseTo(0.06);
  });
  it('균형: 전사는 방어 — 방어가 이미 있으면 공격 자리도 (옛 탱·힐·딜 조합은 그대로 켜짐)', () => {
    expect(isBalanced(K('knight', 'dwarf', 'cleric'))).toBe(true);
    expect(isBalanced(K('dwarf', 'rogue', 'cleric'))).toBe(true);
    expect(isBalanced(K('knight', 'cleric', 'mage'))).toBe(true);
    expect(isBalanced(K('mage', 'rogue', 'cleric'))).toBe(false);
    expect(isBalanced(K('dwarf', 'cleric'))).toBe(false);
  });
  it('한 우물: 그 직업 기본 능력치 몫만 +15% · 원거리 포화 공격 +6%', () => {
    const ms = [mk('mage'), mk('mage'), mk('mage')];
    world.actors = ms;
    const pw = ms.map((m) => powerOf(m));
    const m = partySynMult(ms, pw);
    expect(m).toBeGreaterThan(1);
    expect(m).toBeLessThanOrEqual(1.15 + 1e-9);
    const bar = [mk('hunter'), mk('mage')];
    expect(partySynMult(bar, bar.map((x) => powerOf(x)))).toBeCloseTo(1.06);
  });
  it('「한 명만 바꾸면 ○○」 힌트: 후보에 있는 직업으로만', () => {
    const ms = [mk('rogue'), mk('knight'), mk('knight')];
    const h = synergyHint(ms, [mk('hunter')], 3);
    expect(h?.inKind).toBe('hunter');
    expect(h?.text).toMatch(/한 명만 바꾸면/);
    expect(synergyHint(ms, [], 3)).toBeNull();
    const h2 = synergyHint([mk('rogue')], [mk('hunter')], 3);
    expect(h2?.text).toMatch(/한 명 더하면 「그림자 사냥」/);
  });
  it('처음 켜질 때 한 줄은 조합마다 한 번 · 도감 「파티」에 적힘', () => {
    const ms = K('rogue', 'hunter');
    expect(takeSynergyLine(ms)?.id).toBe('shadow');
    expect(takeSynergyLine(ms)).toBeNull();
    expect(P.dex.syn).toContain('shadow');
  });
});

describe('§3 4번째 자리', () => {
  const allChapters = () => (P.guide.claimed = MISSIONS.map((m) => m.id));
  const training = (lvl: number) => (world.objs = [{ kind: 'training', tx: 1, ty: 1, lvl } as Building]);
  it('훈련장 Lv5 + 장부 둘 다 → 열림 · 모모 편지 한 번', () => {
    training(5);
    expect(checkParty4()).toBe(false);
    expect(huntPartyMax()).toBe(3);
    allChapters();
    training(4);
    expect(checkParty4()).toBe(false);
    training(5);
    expect(checkParty4()).toBe(true);
    expect(P.meta.mail.length).toBe(1);
    expect(P.meta.mail[0].body).toContain('넷이서도');
    expect(checkParty4()).toBe(false);
    expect(P.meta.mail.length).toBe(1);
    expect(huntPartyMax()).toBe(4);
    // 훈련장을 허물어도 열린 채
    world.objs = [];
    expect(party4Open()).toBe(true);
  });
});

describe('§2·§3 토벌 기대 피해', () => {
  const boss = BOSSES[0];
  it('4명이면 4명 기준 (전투력 합만큼) · 조합 보너스 포함', () => {
    const a = [mk('knight'), mk('knight'), mk('knight')];
    const d = mk('knight');
    world.actors = [...a, d];
    const e3 = expectOf(a, boss);
    const e4 = expectOf([...a, d], boss);
    // 같은 직업 넷 → 한 우물 그대로 · 사람 수만큼 늘어난다
    expect(e4.target / e3.target).toBeCloseTo((powerOf(a[0]) * 4) / (powerOf(a[0]) * 3), 1);
  });
  it('조합 덕에 S/A가 쉬워지지 않게: 기대치에 조합 배율이 그대로 곱해진다', () => {
    const plain = [mk('knight'), mk('knight'), mk('mage')];
    const syn = [mk('knight'), mk('dwarf'), mk('cleric'), mk('rogue')];
    world.actors = [...plain, ...syn];
    const ks: number[] = [];
    for (const ms of [plain, syn]) {
      const fx = synergyFx(ms);
      const pw = ms.map((m) => powerOf(m));
      const raw = pw.reduce((s, v) => s + v, 0);
      const ex = expectOf(ms, boss);
      const synM = partySynMult(ms, pw, fx) * roleMult(ms) * synDamageMult(fx);
      // target ÷ (raw × synM) 이 두 파티에서 같다 (상성 1 기준) → 실제 피해가 synM만큼 늘면 등급 비율은 그대로
      ks.push(ex.target / (raw * synM * ex.affinity));
    }
    expect(ks[1] / ks[0]).toBeCloseTo(1, 2);
    // 같은 피해 비율이면 같은 등급
    expect(rankOf(100, 100)).toBe(rankOf(1.3 * 100, 1.3 * 100));
  });
});

describe('§1 사냥꾼 카이팅', () => {
  it('구석에서 물러날 방향은 늘 안쪽', () => {
    const N = CONFIG.combat.field;
    for (const [x, y] of [[0.6, 0.6], [N - 0.6, 0.6], [0.6, N - 0.6], [N - 0.6, N - 0.6]]) {
      const away: [number, number] = [x < N / 2 ? -1 : 1, y < N / 2 ? -1 : 1];
      const [dx, dy] = roomyDir({ x, y }, away);
      expect(dx * (N / 2 - x) + dy * (N / 2 - y)).toBeGreaterThan(0);
    }
  });
  it('구석·벽에 몰려도 끼지 않고 필드 안에서 계속 움직인다 (보스가 쫓아와도)', () => {
    const N = CONFIG.combat.field;
    for (const [sx, sy] of [[0.6, 0.6], [N - 0.6, N / 2], [N / 2, N - 0.6], [N - 0.6, N - 0.6]]) {
      const h = mk('hunter', 10);
      world.actors = [h];
      const f = makeField('forest', 10, [h], true, { mode: 'raid', raid: { look: REGION_BOSS.forest, hp: 1e9, seconds: 60, power: 100 } });
      const u = f.allies[0];
      u.x = sx;
      u.y = sy;
      u.hp = u.max = 1e9;
      const b = f.elite!;
      b.x = sx + (sx < N / 2 ? 1.2 : -1.2);
      b.y = sy + (sy < N / 2 ? 1.2 : -1.2);
      b.st = 'move';
      let path = 0;
      let px = u.x;
      let py = u.y;
      let maxStill = 0;
      let still = 0;
      for (let t = 0; t < 12; t += 1 / 30) {
        step(f, 1 / 30);
        expect(u.x).toBeGreaterThanOrEqual(0.3);
        expect(u.x).toBeLessThanOrEqual(N - 0.3);
        expect(u.y).toBeGreaterThanOrEqual(0.3);
        expect(u.y).toBeLessThanOrEqual(N - 0.3);
        const mv = Math.hypot(u.x - px, u.y - py);
        path += mv;
        // 끼임 = 보스가 바짝 붙어 있는데 (2칸 안) 거의 못 움직이는 시간 (사거리 안에서 서서 쏘는 건 괜찮다)
        still = mv < 0.002 && Math.hypot(b.x - u.x, b.y - u.y) < 2 ? still + 1 / 30 : 0;
        maxStill = Math.max(maxStill, still);
        px = u.x;
        py = u.y;
      }
      expect(path).toBeGreaterThan(3);
      // 1.5초 넘게 한 자리에 붙박이지 않는다
      expect(maxStill).toBeLessThan(1.5);
    }
  });
  it('보스 + 부하 + 4인: 한 판이 깨지지 않고 돈다', () => {
    const ms = [mk('knight', 10), mk('hunter', 10), mk('mage', 10), mk('cleric', 10)];
    world.actors = ms;
    const f = makeField('forest', 9, ms, true);
    expect(f.allies.length).toBe(4);
    spawnBoss(f, REGION_BOSS.forest, 1e6, 6, 6);
    for (let t = 0; t < 20; t += 1 / 30) step(f, 1 / 30);
    expect(f.syn?.ids).toEqual(expect.arrayContaining(['balanced', 'guard', 'starlight', 'barrage']));
    expect(f.allies[0].cdMax![0]).toBeCloseTo(CONFIG.combat.skillCd[0] * 0.9);
  });
});
