// GROWTH §1: 원정 시간 고정 7단계 — 게시판 보장(짧은·중간·긴) · 최고 지역 · 1·10분은 최고−1 · 옛 저장 단계 번호 옮기기 · 하루 원정 금화 전/후 (실제 저장)
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { REGIONS } from '../src/data/items';
import { ensureQuests, migrateTiers, refreshQuests, regionUnlocked } from '../src/world/expeditions';
import { P, resetProgress } from '../src/world/state';

const E = CONFIG.expedition;
beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div>';
  P.counters.expeditions = 5;
});
const openUpTo = (n: number) => {
  for (const r of REGIONS.slice(0, n)) P.hunt.best[r.id] = 10;
  P.guide.claimed = [];
};

describe('7단계 게시판', () => {
  it('시간은 단계 고정 · 짧은·중간·긴 하나씩 이상 · 긴 것 중 하나는 최고 지역 · 1·10분은 최고 지역 −1까지', () => {
    for (let k = 0; k < 200; k++) {
      P.quests.day = '';
      ensureQuests();
      const L = P.quests.list.filter((q) => !q.tutorial && !q.guild);
      for (const q of L) expect(q.minutes).toBe(E.tierMinutes[q.tier]);
      for (const g of E.tierGroups) expect(L.some((q) => g.includes(q.tier))).toBe(true);
      const open = REGIONS.filter((_, i) => regionUnlocked(i));
      const top = open[open.length - 1].id;
      if (open.length > 1) {
        expect(L.filter((q) => q.tier >= 4).some((q) => q.region === top)).toBe(true);
        for (const q of L.filter((x) => x.tier <= 1 && x.region !== 'forest')) expect(q.region).not.toBe(top);
      }
    }
  });
  it('옛 4단계 저장: 게시판·진행 중 의뢰 단계 번호만 옮김 (시간·금화 그대로) · 한 번만', () => {
    const q = (tier: number, minutes: number) => ({ id: tier + 10, region: 'forest' as const, tier, power: 100, minutes, gold: [10, 20] as [number, number] });
    P.quests.list = [q(0, 1), q(1, 10), q(2, 60), q(3, 480)];
    P.runs = [{ id: 1, quest: q(3, 480), members: [], start: 0, end: 1 }];
    P.quests.t7 = undefined;
    migrateTiers();
    expect(P.quests.list.map((x) => x.tier)).toEqual([0, 1, 3, 6]);
    expect(P.quests.list.map((x) => x.minutes)).toEqual([1, 10, 60, 480]);
    expect(P.runs[0].quest.tier).toBe(6);
    migrateTiers();
    expect(P.quests.list.map((x) => x.tier)).toEqual([0, 1, 3, 6]);
  });
});

// 하루 원정 금화 (게시판 하루치 + 무료 새로고침 1번 = 의뢰를 다 보냈을 때 기대 금화) — 전: 옛 4단계 굴림을 그대로 흉내
const SAVES = 'C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/replay2';
describe.skipIf(!fs.existsSync(SAVES))('하루 원정 금화 전/후 (실제 저장)', () => {
  it('±20% 안', () => {
    const rows: string[] = [];
    for (const f of fs.readdirSync(SAVES).filter((x) => x.endsWith('.json'))) {
      const sv = JSON.parse(fs.readFileSync(`${SAVES}/${f}`, 'utf8'));
      resetProgress(sv.progress);
      P.counters.expeditions = 5;
      const open = REGIONS.filter((_, i) => regionUnlocked(i));
      const goldOf = (r: number, tierReward: number) => ((E.baseGold[0] + E.baseGold[1]) / 2) * tierReward * Math.pow(CONFIG.economy.regionReward, r);
      const N = 400;
      // 전: 옛 굴림 (지역 pow(rand,0.7) · 단계 35/35/20/10 · 보상 [0.5,3,8,20] · 1분 하나 보장)
      let before = 0;
      for (let k = 0; k < N; k++)
        for (let day = 0; day < 2; day++) {
          const n = E.questsMin + Math.floor(Math.random() * (E.questsMax - E.questsMin + 1));
          let quick = false;
          for (let i = 0; i < n; i++) {
            const r = Math.min(open.length - 1, Math.floor(Math.pow(Math.random(), 0.7) * open.length));
            const t = Math.random();
            const tier = t < 0.35 ? 0 : t < 0.7 ? 1 : t < 0.9 ? 2 : 3;
            if (tier === 0) quick = true;
            before += goldOf(r, [0.5, 3, 8, 20][tier]);
          }
          if (!quick) before += goldOf(0, 0.5);
        }
      // 후: 실제 코드
      let after = 0;
      for (let k = 0; k < N; k++) {
        P.quests.day = '';
        P.quests.refreshUsed = 0;
        ensureQuests();
        for (const q of P.quests.list) if (!q.guild) after += (q.gold[0] + q.gold[1]) / 2;
        refreshQuests();
        for (const q of P.quests.list) if (!q.guild) after += (q.gold[0] + q.gold[1]) / 2;
      }
      const ratio = after / before;
      expect(ratio).toBeGreaterThan(0.8);
      expect(ratio).toBeLessThan(1.25);
      rows.push(`${sv.innName} 지역${open.length}: 전 ${Math.round(before / N)} → 후 ${Math.round(after / N)} (${(ratio * 100).toFixed(0)}%)`);
    }
    console.log(rows.join('\n'));
    expect(rows.length).toBeGreaterThan(0);
  });
});
