// WAYFIND §2 단위 시험: 결의(3연패부터 +1 · 최대 5 · 이기면 초기화 · 첫 돌파 판만 · 끄기) · 전투 배율 · 막혔을 때 카드 · 실세이브 심연 10
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { blankActor } from '../src/world/adventurers';
import { makeField, step } from '../src/combat/field';
import { setFlag } from '../src/world/flags';
import { sanitizeGrowth } from '../src/world/growth';
import { huntCrew, partyPower, recPower } from '../src/world/hunt';
import { recommendParty } from '../src/world/party';
import { huntPartyMax } from '../src/world/party4';
import { sanitizeRegions2 } from '../src/world/regions2';
import { P, resetProgress, S, world, type Actor, type Building } from '../src/world/state';
import { loadReal } from './wf-real';
import { noteHuntResult, resolveOf, stuckStage, wfState } from '../src/world/wayfind';

const FIX = { ika: 'tests/fixtures/real_wf_ikamolly.json', gon: 'tests/fixtures/real_wf_gonukki.json' };
const haveReal = fs.existsSync(FIX.ika) && fs.existsSync(FIX.gon);

beforeEach(() => {
  resetProgress();
  S.started = true;
  world.home = null;
  world.objs = [];
  world.actors = [];
});

describe('§2 결의', () => {
  it('3연패부터 +1 · 최대 5 · 이기면 초기화', () => {
    const seq = [0, 0, 1, 2, 3, 4, 5, 5];
    seq.forEach((want) => expect(noteHuntResult('abyss', 10, false)).toBe(want));
    expect(resolveOf('abyss', 10)).toBe(5);
    expect(stuckStage()).toEqual({ r: 'abyss', s: 10, n: 5 });
    expect(noteHuntResult('abyss', 10, true)).toBe(0);
    expect(resolveOf('abyss', 10)).toBe(0);
    expect(stuckStage()).toBeNull();
  });
  it('이미 첫 돌파한 판에는 쌓이지 않는다', () => {
    P.hunt.firstClear.push('forest-3');
    for (let i = 0; i < 6; i++) noteHuntResult('forest', 3, false);
    expect(resolveOf('forest', 3)).toBe(0);
    expect(wfState().lose['forest-3']).toBeUndefined();
  });
  it('끄면 0 (기록은 남는다)', () => {
    for (let i = 0; i < 4; i++) noteHuntResult('ice', 10, false);
    setFlag('huntResolve', false);
    expect(resolveOf('ice', 10)).toBe(0);
    setFlag('huntResolve', true);
    expect(resolveOf('ice', 10)).toBe(2);
  });
  it('옛 저장(wf 없음)도 칸을 채운다', () => {
    delete (P as { wf?: unknown }).wf;
    expect(wfState().lose).toEqual({});
  });
  it('전투에 결의가 들어간다 (사냥만 · 토벌 아님)', () => {
    const a = blankActor('knight', '가', 0, 0);
    for (let i = 0; i < 5; i++) noteHuntResult('abyss', 10, false);
    expect(makeField('abyss', 10, [a], true).resolve).toBe(3);
    expect(makeField('abyss', 9, [a], true).resolve).toBe(0);
  });
});

/** 추천 파티로 AUTO n판 승률 */
function winRate(ms: Actor[], n: number): number {
  let w = 0;
  for (let i = 0; i < n; i++) {
    for (const m of ms) m.hp = 100;
    const f = makeField('abyss', 10, ms, true);
    const dt = 1 / 30;
    for (let t = 0; t < CONFIG.combat.timeLimit + 5 && !f.done; t += dt) step(f, dt);
    if (f.done === 'win') w++;
  }
  return w / n;
}

describe.skipIf(!haveReal)('§2 실세이브 심연 10', () => {
  for (const [who, f] of Object.entries(FIX)) {
    it(`${who}: 3연패 뒤 결의 · 결의별 AUTO 승률`, () => {
      loadReal(f);
      expect(P.hunt.best.abyss).toBe(9);
      const rec = recPower('abyss', 10);
      const best = recommendParty(huntCrew(), { power: rec, region: 'abyss', min: 1, max: huntPartyMax() })!;
      const pw = partyPower(best.members);
      const rates: number[] = [];
      for (let k = 0; k <= 5; k++) {
        wfState().lose['abyss-10'] = k ? k + 2 : 0;
        rates.push(winRate(best.members, 12));
      }
      console.log(`[wayfind] ${who} 심연10 추천 ${rec} · 추천 파티 ${pw} · 결의 0~5 AUTO 승률`, rates.map((x) => Math.round(x * 100) + '%').join(' '));
      expect(rates[5]).toBeGreaterThanOrEqual(rates[0]);
    });
  }
});
