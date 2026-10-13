// CHECKIN §J6 영웅 카드 · 파티 후보 한 규칙 (partyRulesV2) — 네 화면(원정·사냥·토벌·심연) 같은 후보 · 같은 이유 · 추천 편성 네 곳
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeAdventurer } from '../src/world/adventurers';
import { setFlag } from '../src/world/flags';
import { huntCrew } from '../src/world/hunt';
import { raidCrew } from '../src/world/raid';
import { awayText, partyBlock, partyNote, partyPool, partyReady, recommendFor, type PartyWhere } from '../src/world/partyRules';
import { P, resetProgress, world, type Actor, type Run } from '../src/world/state';
import { heroCardData, heroCardHtml, heroTier } from '../src/ui/heroCard';

const ALL: PartyWhere[] = ['exp', 'hunt', 'raid', 'abyss'];
const mk = (o: Partial<Actor>) => {
  const a = makeAdventurer(5, 5, { status: 'regular', ...o } as never);
  a.id = P.nextAdvId++;
  a.hp = 100;
  Object.assign(a, o);
  world.actors.push(a);
  return a;
};
let knight: Actor, cleric: Actor, mage: Actor, luna: Actor, tired: Actor, away: Actor, visitor: Actor;
beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div><div id="over"></div>';
  world.actors = [];
  knight = mk({ kind: 'knight', name: '기사' } as never);
  cleric = mk({ kind: 'cleric', name: '사제' } as never);
  mage = mk({ kind: 'mage', name: '마법사' } as never);
  tired = mk({ kind: 'rogue', name: '지친이' } as never);
  tired.hp = 10;
  away = mk({ kind: 'dwarf', name: '원정이' } as never);
  const run = { id: 7, start: Date.now() - 60e3, end: Date.now() + 3 * 60e3 + 500, members: [away.id], quest: { id: 1, region: 'forest', tier: 0, power: 10, minutes: 4, gold: [1, 1] } } as unknown as Run;
  P.runs = [run];
  away.runId = 7;
  P.legends.luna = { st: 'visit', gauge: 100, until: Date.now() + 2 * 864e5, prog: 0 };
  luna = mk({ status: 'visitor', kind: 'rogue', name: '루나' } as never);
  luna.legendId = 'luna';
  visitor = mk({ status: 'visitor', kind: 'mage', name: '손님' } as never);
});
afterEach(() => {
  setFlag('partyRulesV2', true);
  setFlag('legendCompanion', true);
});

describe('파티 후보 한 규칙 (partyRulesV2)', () => {
  it('네 화면 모두: 단골·동행은 후보, 그냥 방문 손님은 아님', () => {
    for (const w of ALL) {
      expect(partyBlock(knight, w)).toBeNull();
      expect(partyBlock(luna, w)).toBeNull();
      expect(partyBlock(visitor, w)).not.toBeNull();
    }
    expect(partyPool()).toContain(luna);
    expect(partyPool()).not.toContain(visitor);
  });
  it('원정 중이면 네 화면 모두 흐리게 + 「원정 중 3분」', () => {
    expect(awayText(away)).toBe('원정 중 3분');
    for (const w of ALL) expect(partyBlock(away, w)).toBe('원정 중 3분');
    expect(partyPool()).toContain(away);
    for (const w of ALL) expect(partyReady(w)).not.toContain(away);
  });
  it('지친 사람(체력 30 미만): 원정·토벌은 「쉬는 중」으로 막고, 사냥·심연은 갈 수 있고 「지쳤어요」', () => {
    expect(partyBlock(tired, 'exp')).toMatch(/^쉬는 중/);
    expect(partyBlock(tired, 'raid')).toMatch(/^쉬는 중/);
    expect(partyBlock(tired, 'hunt')).toBeNull();
    expect(partyBlock(tired, 'abyss')).toBeNull();
    expect(partyNote(tired, 'hunt')).toBe('체력 10 · 지쳤어요');
    expect(partyNote(tired, 'exp')).toBeNull();
    expect(partyNote(knight, 'hunt')).toBeNull();
  });
  it('토벌 후보(raidCrew)에 동행 — 플래그 끄면 예전처럼 빠짐 · 사냥(huntCrew)은 원래 동행 포함', () => {
    expect(raidCrew()).toContain(luna);
    expect(raidCrew()).not.toContain(tired);
    expect(raidCrew()).not.toContain(away);
    expect(huntCrew()).toContain(luna);
    setFlag('partyRulesV2', false);
    expect(raidCrew()).not.toContain(luna);
    expect(raidCrew()).toContain(knight);
  });
  it('토벌 후보 = 토벌에서 넣을 수 있는 사람 (같은 규칙)', () => {
    expect(new Set(raidCrew())).toEqual(new Set(partyReady('raid')));
  });
  it('추천 편성은 네 곳 모두 결과가 있고, 못 가는 사람은 안 고름', () => {
    for (const w of ALL) {
      const best = recommendFor(w, { power: 50, region: 'forest', min: 1, max: 3 });
      expect(best, w).not.toBeNull();
      expect(best!.members.length).toBeGreaterThan(0);
      expect(best!.members).not.toContain(away);
      expect(best!.members).not.toContain(visitor);
      if (w === 'exp' || w === 'raid') expect(best!.members).not.toContain(tired);
    }
  });
});

describe('영웅 카드 데이터', () => {
  it('원정 중 → 흐리게 「원정 중 3분」 · 지친 단골 → 「쉬는 중」 · 보통은 안 흐림', () => {
    expect(heroCardData(away)).toMatchObject({ dim: true, why: '원정 중 3분' });
    expect(heroCardData(tired)).toMatchObject({ dim: true, why: '쉬는 중' });
    expect(heroCardData(knight)).toMatchObject({ dim: false, why: null });
    // 파티 화면은 이유를 직접 준다 (사냥: 지쳐도 안 흐림)
    expect(heroCardData(tired, { why: null })).toMatchObject({ dim: false });
  });
  it('역할 · 희귀도 · ★', () => {
    expect(heroCardData(knight).roleName).toBe('방어');
    expect(heroCardData(cleric).roleName).toBe('회복');
    expect(heroCardData(mage).roleName).toBe('공격');
    expect(heroTier(luna)).toBe('legend');
    knight.rarity = 'special';
    expect(heroCardData(knight).tierName).toBe('특별');
    expect(heroCardHtml(knight)).not.toContain('hcd-fav');
    P.growth.favs = [knight.id];
    expect(heroCardData(knight).fav).toBe(true);
    expect(heroCardHtml(knight)).toContain('hcd-fav');
  });
  it('카드 html: 큰 카드엔 이름·Lv·전투력 · 작은 판(sm)은 이름만 · 흐린 카드엔 이유', () => {
    const md = heroCardHtml(knight);
    expect(md).toContain('class="hcd md');
    expect(md).toContain(`Lv.${knight.lvl}`);
    expect(md).toContain('hcd-pw');
    const sm = heroCardHtml(knight, { size: 'sm' });
    expect(sm).toContain('class="hcd sm');
    expect(sm).not.toContain('hcd-pw');
    expect(heroCardHtml(away)).toContain('원정 중 3분');
    expect(heroCardHtml(knight, { still: true })).toMatch(/^<div /);
  });
});
