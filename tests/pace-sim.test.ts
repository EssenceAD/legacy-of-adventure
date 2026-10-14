// PACE §1 시뮬레이션 (reports/pace/raid.md): 주당 토벌 금화·재료 전/후 — 헤비(매일 최대 · 3마리) · 라이트(주 3판)
//  실세이브(tests/fixtures/real_pace_* · 로컬 전용)가 있고 PACE_SIM=1일 때만 돈다. 결과는 표로 찍는다.
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { bossById, type BossDef } from '../src/data/bosses';
import { blankActor } from '../src/world/adventurers';
import { setFlag } from '../src/world/flags';
import { idleHunt } from '../src/world/hunt';
import { huntPartyMax } from '../src/world/party4';
import { beginRaid, challengeChoices, expectOf, pickChallenge, raidCrew, settle, weeklyTarget } from '../src/world/raid';
import { powerOf } from '../src/world/adventurers';
import { P, resetProgress, S, world, type Building } from '../src/world/state';
import { readSave } from '../src/save/save';
import { sanitizeGrowth } from '../src/world/growth';
import { sanitizeRegions2 } from '../src/world/regions2';

const R = CONFIG.raid;
const REAL = { 꾸무적: 'tests/fixtures/real_pace_kkumujeok.json', 머리박고힐: 'tests/fixtures/real_pace_meoribak.json', 솔바람: 'tests/fixtures/real_pace_solbaram.json' };
const run = Object.values(REAL).every((f) => fs.existsSync(f)) && !!process.env.PACE_SIM;
const KST0 = (y: number, mo: number, d: number, h = 0) => Date.UTC(y, mo - 1, d, h - 9);

function load(f: string) {
  localStorage.setItem(CONFIG.save.key, fs.readFileSync(f, 'utf8'));
  const d = readSave()!;
  resetProgress(d.progress);
  sanitizeRegions2();
  sanitizeGrowth();
  S.gold = d.gold;
  S.day = d.day;
  S.started = true as never;
  S.visiting = null as never;
  world.home = null;
  world.objs = d.buildings.map((b) => ({ ...b, inside: [] }) as unknown as Building);
  world.actors = d.adventurers.map((a) => Object.assign(blankActor(a.kind, a.name, a.x, a.y), a));
  for (const a of world.actors) if (a.id) (a.hp = 100), (a.runId = null as never);
  P.runs.length = 0;
  P.raid.week = ''; // 다음 주로 새로
  return d;
}
const party = () => raidCrew().sort((a, b) => powerOf(b) - powerOf(a)).slice(0, huntPartyMax());

type Prof = { name: string; pace: boolean; days: number[]; perDay: number; mode: 'manual' | 'auto'; dmgK?: (b: BossDef) => number };
interface Res { gold: number; mats: number; tries: number; kills: string[] }

/** 한 주 (2026-10-19 월 ~ 25 일) */
function week(p: Prof): Res {
  setFlag('raidPace', p.pace);
  const res: Res = { gold: 0, mats: 0, tries: 0, kills: [] };
  for (let d = 0; d < 7; d++) {
    if (!p.days.includes(d)) continue;
    vi.setSystemTime(KST0(2026, 10, 19 + d, 20));
    for (let i = 0; i < p.perDay; i++) {
      let t = weeklyTarget();
      if (t.hpLeft <= 0) {
        // 헤비: 도전장 — 남은 도전으로 가장 많이 버는 보스
        const ch = challengeChoices();
        if (!ch.length) break;
        const left = (7 - d) * p.perDay - i;
        const ms = party();
        const val = (b: BossDef) => {
          const dmg = p.dmgK ? p.dmgK(b) : expectOf(ms, b).target;
          const per = b.gold * (dmg / (b.power * R.seconds * R.dmgPerPowerSec));
          const k = Math.ceil(b.hp / Math.max(1, dmg));
          return k <= left ? k * per + b.gold * R.killGoldMult : left * per;
        };
        pickChallenge(ch.sort((a, b) => val(b) - val(a))[0].id);
        t = weeklyTarget();
      }
      const ms = party();
      const ex = expectOf(ms, t.boss);
      const dmg = p.dmgK ? p.dmgK(t.boss) : p.mode === 'manual' ? ex.target : Math.round(ex.target * CONFIG.combat.raidAuto);
      P.raid.tries = 0;
      const id = beginRaid();
      if (id == null) break;
      const out = settle(t, ms, dmg, p.mode, ex, id);
      for (const m of ms) m.hp = 100;
      res.gold += out.gold;
      res.mats += out.mats;
      res.tries++;
      if (out.killed) res.kills.push(t.boss.id);
    }
  }
  return res;
}

describe.skipIf(!run)('PACE §1 토벌 시뮬레이션', () => {
  it('주당 토벌 금화·재료 전/후 · 하루 자동 사냥 금화', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 배수 비교용: PACE_MULT=0.5,0.3
    const mult0 = [...R.chainMult];
    if (process.env.PACE_MULT) (R as { chainMult: number[] }).chainMult = [1, ...process.env.PACE_MULT.split(',').map(Number)];
    const rows: string[] = [];
    const H = (pace: boolean): Prof => ({ name: 'heavy', pace, days: [0, 1, 2, 3, 4, 5, 6], perDay: pace ? R.triesPerDay : R.paceOff.triesPerDay, mode: 'manual' });
    const L = (pace: boolean, dmgK?: Prof['dmgK']): Prof => ({ name: 'light', pace, days: [0, 3, 5], perDay: 1, mode: 'auto', dmgK });
    for (const [name, f] of Object.entries(REAL)) {
      vi.setSystemTime(KST0(2026, 10, 19, 9));
      load(f);
      const ms = party();
      const pw = ms.reduce((s, a) => s + powerOf(a), 0);
      vi.setSystemTime(KST0(2026, 10, 19, 10));
      const idle = idleHunt(24 * 3600, Infinity);
      const idleGold = idle?.gold ?? 0;
      const auto = P.hunt.auto ? `${P.hunt.auto.region}-${P.hunt.auto.stage} ${P.hunt.auto.members.length}인` : "-";
      // 같은 자리(지역·스테이지)에 가장 센 파티로 맡겼다면
      load(f);
      vi.setSystemTime(KST0(2026, 10, 19, 10));
      if (P.hunt.auto) P.hunt.auto.members = party().map((a) => a.id!);
      const idle4 = idleHunt(24 * 3600, Infinity)?.gold ?? 0;
      const out: Record<string, Res> = {};
      for (const [k, p] of [['hb', H(false)], ['ha', H(true)], ['lb', L(false)], ['la', L(true)]] as const) {
        load(f);
        out[k] = week(p);
      }
      // 약한 라이트(소담 여관 같은): 한 판에 보스 체력의 25% (예전엔 주 3판으로 못 잡음)
      for (const [k, p] of [['wb', L(false, (b) => Math.round(b.hp * 0.25))], ['wa', L(true, (b) => Math.round(b.hp * 0.25))]] as const) {
        load(f);
        out[k] = week(p);
      }
      const ratio = out.ha.gold / Math.max(1, idleGold);
      const ratio4 = out.ha.gold / Math.max(1, idle4);
      rows.push(
        `| ${name} | ${pw.toLocaleString()} | ${bossById(P.raid.bossId)?.name ?? ''} | ${auto} · ${idleGold.toLocaleString()} | ${idle4.toLocaleString()} | ` +
          `${out.hb.gold.toLocaleString()} / ${out.hb.mats} (${out.hb.tries}판 · ${out.hb.kills.join(',')}) | ${out.ha.gold.toLocaleString()} / ${out.ha.mats} (${out.ha.tries}판 · ${out.ha.kills.join(',')}) | ${ratio.toFixed(2)}× (센 파티 ${ratio4.toFixed(2)}×) | ` +
          `${out.lb.gold.toLocaleString()} / ${out.lb.mats} (${out.lb.kills.join(',') || '처치 X'}) | ${out.la.gold.toLocaleString()} / ${out.la.mats} (${out.la.kills.join(',') || '처치 X'}) | ` +
          `${out.wb.gold.toLocaleString()} (${out.wb.kills.join(',') || '처치 X'}) | ${out.wa.gold.toLocaleString()} (${out.wa.kills.join(',') || '처치 X'}) |`,
      );
    }
    console.log(
      [
        '| 세이브 | 파티 전투력 | 첫 보스(10/19 주) | 자동 사냥 하루 금화 (지금 맡긴 그대로) | 같은 자리 센 파티 | 헤비 전 금화/재료 | 헤비 후 금화/재료 | 헤비 후 ÷ 사냥 하루 | 라이트 전 | 라이트 후 | 약한 라이트 전 | 약한 라이트 후 |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|',
        ...rows,
      ].join('\n'),
    );
    setFlag('raidPace', true);
    (R as { chainMult: number[] }).chainMult = mult0;
    console.log('chainMult', R.chainMult.join(' / '), process.env.PACE_MULT ?? '');
    vi.useRealTimers();
    expect(rows.length).toBe(3);
  });
});
