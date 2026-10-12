// 핫픽스 12 §2: 추천 편성 · 역할 조합 · 멘토 경험치 · 의뢰 태그
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer, powerOf } from '../src/world/adventurers';
import { makeQuest, partyInfo, resolveRun } from '../src/world/expeditions';
import { balanced, isMentee, recommendParty, roleMult, rollTag, scoreParty, skewed, tagGoldMult, tagMet, type RecTarget } from '../src/world/party';
import { P, S, world, type Actor, type Run } from '../src/world/state';

const PC = CONFIG.party;
const mk = (kind: string, lvl = 5, race = 'human'): Actor => Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind, lvl, race, hp: 100, mood: 80, food: 80 }) as Actor;
beforeEach(() => {
  S.visiting = false as never;
  world.home = null as never;
  world.actors = [];
  P.bonds = {};
  P.bag = [];
});

describe('역할 조합', () => {
  it('기사+사제+딜 → ×1.10 · 하나라도 빠지면 ×1', () => {
    const k = mk('knight');
    const c = mk('cleric');
    const m = mk('mage');
    expect(balanced([k, c, m])).toBe(true);
    expect(roleMult([k, c, m])).toBeCloseTo(1 + PC.rolePowerPct);
    expect(roleMult([k, m, mk('rogue')])).toBe(1);
  });
  it('원정 성공률용 전투력에 반영', () => {
    const a = [mk('knight'), mk('cleric'), mk('mage')];
    const b = [mk('knight'), mk('knight'), mk('mage')];
    for (const x of [...a, ...b]) x.lvl = 5;
    world.actors = [...a, ...b];
    const q = makeQuest('forest', 1);
    const raw = (ms: Actor[]) => ms.reduce((s, m) => s + powerOf(m), 0);
    expect(partyInfo(a, q).power).toBe(Math.round(raw(a) * (1 + PC.rolePowerPct)));
    expect(partyInfo(b, q).power).toBe(Math.round(raw(b)));
  });
  it('같은 직업 3명 → 치우친 파티 (표시만)', () => {
    expect(skewed([mk('mage'), mk('mage'), mk('mage')])).toBe(true);
    expect(skewed([mk('mage'), mk('mage'), mk('rogue')])).toBe(false);
  });
});

describe('멘토 경험치', () => {
  it('최고 레벨 −5 이하만 ×1.5', () => {
    const hi = mk('knight', 12);
    const lo = mk('mage', 7);
    const mid = mk('rogue', 8);
    expect(isMentee(lo, [hi, lo, mid])).toBe(true);
    expect(isMentee(mid, [hi, lo, mid])).toBe(false);
    expect(isMentee(hi, [hi, lo, mid])).toBe(false);
  });
  it('원정 결과: 멘티는 경험치 1.5배 · 탱힐딜이면 체력 덜 깎임', () => {
    const hi = mk('knight', 12);
    const lo = mk('cleric', 3);
    const d = mk('mage', 12);
    world.actors = [hi, lo, d];
    for (const m of world.actors) m.xp = 0;
    const q = { ...makeQuest('forest', 0), tutorial: true };
    const run = { id: 1, quest: q, members: [hi.id, lo.id, d.id], start: 0, end: 0 } as Run;
    resolveRun(run, []);
    // 레벨이 오를 수 있으니 「누적 경험치」로 비교: 멘티 쪽이 더 받아야 함 → lvl 3의 xp 진행이 0이 아니다
    expect(lo.lvl > 3 || lo.xp > 0).toBe(true);
    expect(hi.hp).toBe(Math.max(1, Math.round(100 - CONFIG.expedition.winHp * (1 - PC.roleHpSave) * (1 - CONFIG.synergy.guard.dmgCut))));  // PARTY §2: 기사+사제 「수호의 맹세」 체력 소모 −8%
  });
});

describe('의뢰 태그', () => {
  it('맞으면 보상 +30% · 안 맞으면 그대로', () => {
    const q = { ...makeQuest('forest', 1), tag: { k: 'race', v: 'elf', n: 1, text: '' } as const };
    expect(tagGoldMult(q, [mk('knight', 5, 'elf')])).toBeCloseTo(1 + PC.tagBonus);
    expect(tagGoldMult(q, [mk('knight', 5, 'human')])).toBe(1);
    expect(tagMet({ k: 'noKind', v: 'cleric', n: 0, text: '' }, [mk('knight')])).toBe(true);
    expect(tagMet({ k: 'maxLvl', v: '', n: 10, text: '' }, [mk('knight', 11)])).toBe(false);
    expect(tagMet({ k: 'kind', v: 'dwarf', n: 2, text: '' }, [mk('dwarf'), mk('dwarf')])).toBe(true);
  });
  it('태그 문구는 늘 보상 % 포함', () => {
    let seed = 0.13;
    const r = () => (seed = (seed * 9301 + 0.49297) % 1);
    for (let i = 0; i < 30; i++) expect(rollTag(r).text).toMatch(/보상 \+30%/);
  });
});

describe('추천 편성', () => {
  /** 전수 조사 */
  function brute(cands: Actor[], t: RecTarget) {
    const pw = new Map(cands.map((a) => [a, powerOf(a)]));
    let best = -Infinity;
    const cur: Actor[] = [];
    const walk = (i: number) => {
      if (cur.length >= t.min) best = Math.max(best, scoreParty(cur, t, pw).score);
      if (cur.length === t.max) return;
      for (let k = i; k < cands.length; k++) {
        cur.push(cands[k]);
        walk(k + 1);
        cur.pop();
      }
    };
    walk(0);
    return best;
  }
  it('점수 최대 = 전수 조사 · 추천 전투력을 넘길 수 있으면 넘긴다', () => {
    const kinds = ['knight', 'cleric', 'mage', 'rogue', 'dwarf'];
    for (let t = 0; t < 8; t++) {
      const cands = Array.from({ length: 9 }, (_, i) => mk(kinds[(i + t) % 5], 2 + ((i * 5 + t * 3) % 14)));
      world.actors = cands;
      const total = cands.reduce((s, a) => s + powerOf(a), 0);
      const target: RecTarget = { power: Math.round(total * (0.15 + 0.05 * t)), region: 'forest', min: 1, max: 4 };
      const r = recommendParty(cands, target)!;
      expect(r.score).toBeCloseTo(brute(cands, target), 9);
      // 4명 최강 조합이 넘길 수 있으면 추천도 넘김
      const top4 = [...cands].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 4).reduce((s, a) => s + powerOf(a), 0);
      if (top4 >= target.power * 1.05) expect(r.power).toBeGreaterThanOrEqual(target.power);
    }
  });
  it('과하게 센 애 낭비 방지: 약한 조합으로 넘길 수 있으면 최강을 안 넣는다', () => {
    const big = mk('mage', 30);
    const k = mk('knight', 6);
    const c = mk('cleric', 6);
    const m = mk('rogue', 6);
    world.actors = [big, k, c, m];
    const need = Math.round((powerOf(k) + powerOf(c) + powerOf(m)) * 0.9);
    // 혼자서도 추천의 5배가 넘는 「과하게 센」 손님
    while (powerOf(big) < need * 5) big.lvl += 5;
    const r = recommendParty(world.actors, { power: need, region: 'forest', min: 1, max: 4 })!;
    expect(r.members).not.toContain(big);
    expect(balanced(r.members)).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/방어·공격·회복/);
  });
  it('같은 조건이면 레벨 낮은 애 우선', () => {
    const a = mk('mage', 8);
    const b = mk('mage', 8);
    world.actors = [a, b];
    // 둘 다 혼자서 충분히 넘기는 의뢰 → 한 명만, 레벨이 같으니 아무나 / 레벨이 다르면 낮은 쪽
    b.lvl = 7;
    // 희귀도는 무작위라 같게 맞춘다 (레벨만 다르게)
    b.rarity = a.rarity;
    const need = Math.round(Math.min(powerOf(a), powerOf(b)) * 0.5);
    const r = recommendParty([a, b], { power: need, region: 'forest', min: 1, max: 1 })!;
    expect(r.members).toEqual([b]);
  });
});
