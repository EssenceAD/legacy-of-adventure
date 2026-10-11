// 장부 임무 ↔ 실제 행동 (핫픽스 8 2-10 재발 방지)
//  「임무 설명에 적힌 행동을 실제로 했을 때 완료되는지」를 표로 검사한다.
//  ① 연결표: 임무마다 그 행동을 하는 코드(파일 · 함수)가 임무가 보는 값(카운터 등)을 실제로 올리는지 — 소스에서 확인
//  ② 동작: 그 값을 행동만큼 올리면 임무 check가 완료가 되는지
//  새 임무를 넣고 표에 안 적으면 실패한다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { MISSIONS } from '../src/data/guide';
import { missionProgress } from '../src/world/guide';
import { CONFIG } from '../src/data/config';
import { P, S, world, type Building } from '../src/world/state';
import { noteAutoUsed } from '../src/world/hunt';

const src = (f: string) => fs.readFileSync(f, 'utf8');
type Row = { act: () => void; sites?: [string, RegExp][] };
const C = () => P.counters;
const build = (kind: string) => () => void world.objs.push({ kind, tx: 0, ty: 0, fw: 1, fh: 1, lvl: 1, hue: null, inside: [], sprite: null } as unknown as Building);
const huntBest = (r: string, s: number) => () => void (P.hunt.best[r] = s);
const rep = (star: number) => () => void (P.rep = CONFIG.reputation.stars[star - 1] ?? 0);
const land = (l: number) => () => void (S.land = l);

/** 임무 → 행동 · 그 행동을 하는 코드가 값을 올리는 곳 */
const TABLE: Record<string, Row> = {
  c1_scout: { act: () => void (C().expeditions = 1), sites: [['src/world/expeditions.ts', /counters\.expeditions\+\+|C\.expeditions\+\+/]] },
  c1_fire: { act: build('fire') },
  c1_talk: { act: () => void (C().guestTalks = 1), sites: [['src/ui/guests.ts', /guestTalks\+\+/]] },
  c1_equip: { act: () => void P.bag.push({ id: 9e6, grade: 'r', owner: 1 } as never) },
  c1_quick: { act: () => void (C().quickRuns = 2), sites: [['src/world/expeditions.ts', /quickRuns\+\+/]] },
  c1_goal: { act: () => void (C().goalsClaimed = 1), sites: [['src/world/progress.ts', /goalsClaimed\+\+/]] },
  c2_well: { act: build('well') },
  c2_harm: { act: () => void P.harmony.found.push(2) },
  c2_hunt1: { act: huntBest('forest', 1), sites: [['src/world/hunt.ts', /P\.hunt\.best\[r\] = Math\.max/]] },
  // 2-10: 사냥터 「자동 사냥 켜기」(setAuto) · 전투 중 AUTO 버튼 · 오토 전투로 시작 — 모두 noteAutoUsed
  c2_auto: {
    act: () => noteAutoUsed(),
    sites: [
      ['src/world/hunt.ts', /export function setAuto[\s\S]*?noteAutoUsed\(\)/],
      ['src/combat/ui.ts', /press\('#cbAuto'[\s\S]*?noteAutoUsed\(\)/],
      ['src/combat/ui.ts', /if \(auto && F\.mode === 'hunt'\) noteAutoUsed\(\)/],
    ],
  },
  c2_hunt5: { act: huntBest('forest', 5) },
  c2_reg: { act: () => void world.actors.push(...[1, 2, 3].map((id) => ({ id, status: 'regular', lvl: 1 }) as never)) },
  c2_land: { act: land(2) },
  c3_star2: { act: rep(2) },
  c3_land3: { act: land(3) },
  c3_board: { act: build('board') },
  c3_tavern: { act: build('tavern') },
  c3_training: { act: build('training') },
  c3_hidden: { act: () => void P.harmony.found.push(7) },
  c3_boss: { act: huntBest('forest', 10) },
  c4_smith: { act: build('smith') },
  c4_salvage: { act: () => void (C().salvaged = 3), sites: [['src/world/craft.ts', /salvaged \+?=|salvaged\+\+/]] },
  c4_enh: { act: () => void (C().enhanceMax = 3), sites: [['src/world/craft.ts', /enhanceMax/]] },
  c4_craft: { act: () => void (C().crafted = { forest: 1 } as never), sites: [['src/world/craft.ts', /crafted\[/]] },
  c4_wins: { act: () => void (C().regionWins = { forest: 10, swamp: 0, mine: 0, ice: 0, abyss: 0 } as never), sites: [['src/world/expeditions.ts', /regionWins\[/]] },
  c4_hunt2: { act: huntBest('swamp', 1) },
  c4_eval: { act: () => void (P.evaluation.best = 1) },
  c5_raid: { act: () => void (P.raid.tries = 1), sites: [['src/world/raid.ts', /P\.raid\.tries\+\+/]] },
  c5_swamp: { act: huntBest('swamp', 5) },
  c5_hero: { act: () => void (P.dex.heroes.kael = { recruited: true } as never) },
  c5_reglv: { act: () => void world.actors.push({ id: 77, status: 'regular', lvl: 10 } as never) },
  c5_swampwin: { act: () => void (C().regionWins = { forest: 0, swamp: 3, mine: 0, ice: 0, abyss: 0 } as never) },
  c6_star3: { act: rep(3) },
  c6_land4: { act: land(4) },
  c6_chem: { act: () => void P.dex.chem.push('a|b' as never) },
  c6_harvest: { act: () => void (C().harvests = 3), sites: [['src/world/craft.ts', /counters\.harvests\+\+/]] },
  c6_rumor: { act: () => void (P.legends.aria = { st: 'rumor' } as never) },
  c6_dex: { act: () => void P.dex.items.push(...Array.from({ length: 20 }, (_, i) => `i${i}` as never)) },
  c6_eval: { act: () => void (P.evaluation.best = 3) },
  c7_star4: { act: rep(4) },
  c7_land5: { act: land(5) },
  c7_bath: { act: build('bath') },
  c7_kill: { act: () => void (P.raid.weeksKilled = 1) },
  c7_heroes: { act: () => void ['kael', 'brok', 'lira'].forEach((h) => (P.dex.heroes[h] = { recruited: true } as never)) },
};

describe('장부 임무 ↔ 실제 행동', () => {
  it('모든 임무가 표에 있다 (새 임무는 표에 행동을 적어야 한다)', () => {
    expect(MISSIONS.map((m) => m.id).filter((id) => !TABLE[id])).toEqual([]);
  });
  for (const m of MISSIONS) {
    const row = TABLE[m.id];
    if (!row) continue;
    it(`${m.id} 「${m.title}」`, () => {
      // 행동을 하는 코드가 그 값을 올리는가
      for (const [f, re] of row.sites ?? []) expect(re.test(src(f)), `${f}에 ${re}`).toBe(true);
      // 행동만큼 올리면 완료가 되는가
      row.act();
      expect(missionProgress(m).done, `${m.id}: 행동 뒤에도 완료가 안 됨 ${JSON.stringify(missionProgress(m))}`).toBe(true);
    });
  }
});
