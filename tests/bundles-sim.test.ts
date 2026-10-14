// LUXE §3 시뮬레이션 (실세이브 · 로컬 전용): 세이브마다 「지금 바로 채울 수 있는 칸」(방별) + 라이트·헤비 하루 모델로 「며칠에 끝나나」 → reports/luxe/bundles.md
//  BUNDLE_SAVES="dirA;dirB" npx vitest run tests/bundles-sim.test.ts  (tests/fixtures/real_*.json 도 같이 · 없으면 건너뜀 · 실세이브는 커밋하지 않는다)
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/data/config';
import { LUXE, type BundleDef, type BundleSlot, type RoomDef } from '../src/data/luxe_cfg';
import { FISH } from '../src/data/story/fish';
import { readSave } from '../src/save/save';
import { blankActor } from '../src/world/adventurers';
import { bdState, fillableNow, haveOf, recValue, roomOpen, ROOMS } from '../src/world/bundles';
import { setFlag } from '../src/world/flags';
import { chaptersDone } from '../src/world/guide';
import { sanitizeGrowth } from '../src/world/growth';
import { sanitizeRegions2 } from '../src/world/regions2';
import { P, resetProgress, S, world, type Building } from '../src/world/state';
import { fLv, potionSlots } from '../src/world/facilities';

const DIRS = (process.env.BUNDLE_SAVES ?? '').split(';').filter((d) => d && fs.existsSync(d));
const FIX = fs.existsSync('tests/fixtures') ? fs.readdirSync('tests/fixtures').filter((f) => /^real_.*\.json$/.test(f)).map((f) => path.join('tests/fixtures', f)) : [];
const FILES = [...FIX, ...DIRS.flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => path.join(d, f)))];

function load(f: string) {
  localStorage.setItem(CONFIG.save.key, fs.readFileSync(f, 'utf8'));
  const d = readSave()!;
  resetProgress(d.progress);
  sanitizeRegions2();
  sanitizeGrowth();
  S.gold = d.gold;
  S.started = true;
  S.visiting = null as never;
  world.home = null;
  world.objs = d.buildings.map((b) => ({ ...b, inside: [] }) as unknown as Building);
  world.actors = d.adventurers.map((a) => Object.assign(blankActor(a.kind, a.name, a.x, a.y), a));
  bdState();
  return d;
}

// ───────── 하루 모델 (거친 추정 · 숫자는 이 표 한 곳) ─────────
// 원정 성공은 실세이브 누적(헤비 35~57 · 한 달 넘게)으로 하루 2.5번 · 인연 단계·선물도 실세이브 기준 느리게
// light = 하루 10분 (텃밭 2번 · 미끼 5 + 작물 미끼 10 = 15번 던짐 · 자동 사냥 방치) / heavy = 하루 2~3시간 (텃밭 6번 · 40번 던짐 · 자동 사냥 · 분해 · 토벌 · 변환)
const MODEL = {
  light: { crops: 60, casts: 15, matsPerRegion: 15, dust: { n: 60, r: 6, e: 0.5 }, boss: 0.5, potions: 2, wins: 1, huntClears: 120, abyss: 0.3, x10: 0.05, friends: 0.1, trusted: 0.03, gifts: 1 },
  heavy: { crops: 200, casts: 40, matsPerRegion: 60, dust: { n: 300, r: 40, e: 6 }, boss: 4, potions: 8, wins: 2.5, huntClears: 500, abyss: 1.5, x10: 0.15, friends: 0.25, trusted: 0.07, gifts: 3 },
};
// 헤비지만 낚시는 잘 안 하는 사람 (실세이브 물고기 가방이 거의 비어 있음 · 요리 24회뿐) — 하루 15번
(MODEL as Record<string, unknown>).heavyLowFish = { ...MODEL.heavy, casts: 15 };
type Who = 'light' | 'heavy' | 'heavyLowFish';
/** 물고기 한 마리가 한 번 던질 때 나올 확률 (그 물고기가 잘 잡히는 때에 던진다고 봄) */
function fishP(id: string): { pool: string; p: number } {
  const f = FISH.find((x) => x.id === id)!;
  const W = CONFIG.growth.fish.weight;
  const pool = FISH.filter((x) => x.where === f.where && (!x.time || x.time === f.time || (f.time === 'dawn' && x.time === 'day')));
  const tot = pool.reduce((s, x) => s + (W[x.grade] ?? 1), 0);
  return { pool: `${f.where}:${f.time ?? 'any'}`, p: (W[f.grade] ?? 1) / tot };
}
/** 칸 하나를 채우는 데 드는 「날」 (물고기는 던짐 수로 따로 셈 → casts) */
function slotCost(s: BundleSlot, left: number, who: Who): { days: number; casts?: { pool: string; n: number } } {
  if (left <= 0) return { days: 0 };
  const m = (MODEL as Record<Who, typeof MODEL.heavy>)[who];
  switch (s.k) {
    case 'crop': return { days: left / (s.id === 'starflower' ? m.crops / 20 : m.crops / 4) };
    case 'fish': {
      const { pool, p } = fishP(s.id);
      return { days: 0, casts: { pool, n: left / p } };
    }
    case 'mat': return { days: (P.hunt.best[s.id] ?? 0) > 0 || s.id === 'forest' ? left / m.matsPerRegion : 99 };
    case 'dust': return { days: left / (m.dust[s.id as 'n' | 'r' | 'e'] || 0.01) };
    case 'boss': return { days: (P.raid.kills?.[s.id] ?? 0) > 0 || (P.bossMats[s.id] ?? 0) > 0 ? left / Math.max(0.01, m.boss) : 99 };
    case 'potion': return { days: fLv('alchemy') ? left / m.potions : 99 };
    case 'rec': {
      const rate = { wins: m.wins, huntClears: m.huntClears, abyssBest: m.abyss, regionsX10: m.x10, friends: m.friends, trusted: m.trusted, gifts: m.gifts }[s.id] ?? 0.01;
      return { days: Math.max(0, s.n - recValue(s.id)) / rate };
    }
  }
  return { days: 99 };
}
/** 방 하나: 꾸러미마다 가장 싼 N칸을 고른다 → (물고기 외 가장 오래 걸리는 칸 · 물고기 던짐 수 (풀마다 가장 많이 필요한 것)) */
function roomCost(r: RoomDef, who: Who, castPools: Map<string, number>): number {
  let days = 0;
  for (const b of r.bundles) {
    const costs = b.slots.map((s, i) => {
      const left = Math.max(0, s.n - (s.k === 'rec' ? 0 : haveOf(s)) - (bdState().put[`${b.id}:${i}`] ?? 0));
      const c = slotCost(s, s.k === 'rec' ? s.n : left, who);
      const castDays = c.casts ? c.casts.n / (MODEL as Record<Who, typeof MODEL.heavy>)[who].casts : 0;
      return { c, est: c.days + castDays };
    });
    const pick = costs.sort((a, b2) => a.est - b2.est).slice(0, b.need);
    for (const { c } of pick) {
      days = Math.max(days, c.days);
      if (c.casts) castPools.set(c.casts.pool, Math.max(castPools.get(c.casts.pool) ?? 0, c.casts.n));
    }
  }
  return days;
}
const castDays = (pools: Map<string, number>, who: Who) => [...pools.values()].reduce((s, v) => s + v, 0) / (MODEL as Record<Who, typeof MODEL.heavy>)[who].casts;
/** 헤비 6방 전부 (방마다 따로 + 물고기 던짐은 모든 방이 같이 씀) · 방마다 · 가장 늦는 칸 */
function allRooms(who: Who) {
  const hp = new Map<string, number>();
  const per: Record<string, number> = {};
  let all = 0;
  for (const r of ROOMS()) {
    const pp = new Map<string, number>();
    per[r.id] = Math.max(roomCost(r, who, pp), castDays(pp, who));
    for (const [k, v] of pp) hp.set(k, Math.max(hp.get(k) ?? 0, v));
    all = Math.max(all, per[r.id]);
  }
  return { all: Math.max(all, castDays(hp, who)), per };
}

interface Row { file: string; name: string; ch: number; alch: number; rooms: { id: string; open: boolean; slots: number; total: number; bundles: number; nb: number; done: boolean }[]; dayOne: number; light: { kitchen: number }; heavy: { all: number; per: Record<string, number> }; heavyLow: { all: number; per: Record<string, number> } }
const rows: Row[] = [];

describe.skipIf(!DIRS.length)('LUXE §3 꾸러미 시뮬레이션', () => {
  it('세이브마다 지금 채울 수 있는 칸 · 며칠', () => {
    setFlag('bundles', true);
    for (const f of FILES) {
      const d = load(f);
      const rooms = ROOMS().map((r) => {
        const x = fillableNow(r);
        return { id: r.id, open: roomOpen(r), slots: x.slots, total: x.total, bundles: x.bundles, nb: r.bundles.length, done: roomOpen(r) && x.done };
      });
      // 라이트: 주방 (지금 가진 것 + 하루 모델)
      const lp = new Map<string, number>();
      const kd = roomCost(ROOMS()[0], 'light', lp);
      const kitchen = Math.max(kd, castDays(lp, 'light'));
      const H = allRooms('heavy');
      const HL = allRooms('heavyLowFish');
      rows.push({ file: path.basename(path.dirname(f)) + '/' + path.basename(f), name: d.innName, ch: chaptersDone(), alch: potionSlots(), rooms, dayOne: rooms.filter((r) => r.done).length, light: { kitchen }, heavy: H, heavyLow: HL });
    }
    setFlag('bundles', false);
    expect(rows.length).toBe(FILES.length);
  });
});

afterAll(() => {
  if (!rows.length) return;
  const R = ROOMS();
  const dd = (v: number) => (v >= 99 ? '—' : v.toFixed(1));
  const head = `| 세이브 | 여관 | 장부 | ${R.map((r) => r.name).join(' | ')} | 첫날 끝나는 방 |\n|---|---|---|${R.map(() => '---').join('|')}|---|`;
  const body = rows
    .map((w) => `| ${w.file} | ${w.name} | ${w.ch} | ${w.rooms.map((r) => (!r.open ? '🔒' : `${r.slots}/${r.total}칸 · 꾸러미 ${r.bundles}/${r.nb}${r.done ? ' ✅' : ''}`)).join(' | ')} | **${w.dayOne}** |`)
    .join('\n');
  const est = rows
    .map((w) => `| ${w.name} (${w.file}) | ${w.light.kitchen.toFixed(1)}일 | ${dd(w.heavy.all)} | ${dd(w.heavyLow.all)} | ${R.map((r) => `${dd(w.heavy.per[r.id])}·${dd(w.heavyLow.per[r.id])}`).join(' / ')} |`)
    .join('\n');
  const cfg = R.map((r) => `- **${r.name}** (장부 ${r.chapter}장~): ${r.bundles.map((b: BundleDef) => `${b.name} ${b.need}/${b.slots.length} (${b.slots.map((s) => `${s.id} ${s.n}`).join(' · ')})`).join(' / ')}`).join('\n');
  const md = `# LUXE §3 마을 회관 꾸러미 — 시뮬레이션

생성: \`BUNDLE_SAVES=... npx vitest run tests/bundles-sim.test.ts\` (실세이브 ${rows.length}개 · 실세이브는 저장소 밖)

## 0. 결론 (${new Date().toISOString().slice(0, 10)})
- 첫날(지금 가진 것만) 끝나는 방: 롯데캐슬 최신(woongs3) **${rows.find((w) => w.file.startsWith('woongs3'))?.dayOne ?? '?'}방** (토벌 전리품) · 다른 헤비 1~2방 (대장간 · 토벌) → **4방 기준 안 넘음 — 수량 올리지 않음.**
- 라이트 모델 주방: 명세 첫 안이면 4.3~4.6일 (생선 꾸러미 물고기 수가 병목) → 생선·잔칫상 물고기 수를 내림 → 빈 가방에서 3.1~3.4일, 물고기가 조금 있으면 1~2일.
- 헤비 모델 6방 전부: 명세 첫 안(원정 성공 50·100·200)이면 쉼터가 두 달(실세이브 원정 성공 누적 35~57) → 50·75·100 으로 → 16~21일 (나머지 방은 1주 안 · 마지막은 쉼터 원정·인연 기록).
- 바꾼 숫자 (data/luxe_cfg.ts만): 주방 생선 송사리 10→6 · 붕어 5→4 · 미꾸라지 8→5 · 정어리 8→5 · 가자미 5→4 · 잔칫상 고등어 5→3 · 쉼터 원정 성공 기록 100→75 · 200→100.
- 주의: 헤비는 대장간(지역 재료·가루가 수천)과 토벌(보스 재료 수백)을 첫날 끝낸다 — 기준(4방) 안이라 그대로 둠. 더 길게 하고 싶으면 대장간 가루 n 300→3000 · 토벌 첫 보스 5→20 같은 식으로 config만.

## 1. 지금 바로 채울 수 있는 칸 (방별 · 「칸 n/전체 · 그걸로 끝나는 꾸러미」 · ✅ = 첫날 방 완성)
연금 예약분 작물은 뺀 수 · 기록 칸(쉼터)은 지금 기록이 닿았나 · 같은 재료를 여러 칸이 쓰면 앞 칸부터 나눠 씀.

${head}
${body}

**기준: 롯데캐슬이 첫날 4방 넘게 끝나면 수량을 올린다.**

## 2. 며칠 걸리나 (거친 추정 · 지금 가진 것 + 하루 모델)
하루 모델 (tests/bundles-sim.test.ts MODEL): 라이트(하루 10분) = 작물 ${MODEL.light.crops} · 낚시 ${MODEL.light.casts}번 · 지역 재료 ${MODEL.light.matsPerRegion}/지역 · 가루 잿빛 ${MODEL.light.dust.n} · 원정 성공 ${MODEL.light.wins} / 헤비 = 작물 ${MODEL.heavy.crops} · 낚시 ${MODEL.heavy.casts}번 · 지역 재료 ${MODEL.heavy.matsPerRegion}/지역 · 가루 잿빛 ${MODEL.heavy.dust.n}·푸른 ${MODEL.heavy.dust.r}·보랏빛 ${MODEL.heavy.dust.e} · 보스 재료 ${MODEL.heavy.boss}/보스(토벌·심연·변환) · 원정 성공 ${MODEL.heavy.wins} · 사냥 클리어 ${MODEL.heavy.huntClears}.
물고기는 그 물고기가 나오는 때(낮·밤·새벽)·곳에 던진다고 보고 등급 가중치로 확률을 냄 · 같은 곳의 물고기는 한 번에 같이 모임. 장부 장 잠김은 빼고(다 열렸다고 보고) 셈. 「—」 = 아직 못 가는 지역·보스·공방 없음 (그 세이브로는 끝 못 냄).

| 여관 | 라이트 모델로 주방 | 헤비(낚시 40번)로 6방 전부 | 헤비(낚시 15번)로 6방 전부 | 방별 낚시 40·15 (${R.map((r) => r.name).join(' / ')}) |
|---|---|---|---|---|
${est}

목표: 라이트 주방 2~3일 · 헤비 전부 3~4주(21~28일).

## 3. 꾸러미 수량 (data/luxe_cfg.ts)
${cfg}
`;
  fs.mkdirSync('reports/luxe', { recursive: true });
  fs.writeFileSync('reports/luxe/bundles.md', md);
});
