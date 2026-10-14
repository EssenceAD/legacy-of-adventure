// 5단계 1장: 가이드 임무 「버나드의 장부」 진행 · 장 보상(기능 열기 · 마을 등급)
import { sfx } from '../audio/sfx';
// 이미 해 둔 일은 그 임무 차례가 오면 바로 완료(받기까지) — 예전 저장도 자연스럽게 따라온다.
import { CHAPTERS, MISSIONS, type GuideCtx, type Mission } from '../data/guide';
import { HEROES } from '../data/heroes';
import { LEGENDS } from '../data/legends';
import { stars } from './progress';
import { CONFIG } from '../data/config';
import { HARMONIES } from '../data/harmony';

/** 평가 점수 (world/evaluation이 채운다 — import가 꼬이지 않게) */
export let evalScoreHook = () => 0;
export const setEvalScoreHook = (f: () => number) => (evalScoreHook = f);
import { markDirty, P, S, uiHooks, world, type TalkLine } from './state';
import { flag } from './flags';

const homeObjs = () => world.home?.objs ?? world.objs;
const homeActors = () => world.home?.actors ?? world.actors;

export function guideCtx(): GuideCtx {
  const C = P.counters;
  const regs = homeActors().filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero'));
  return {
    expeditions: C.expeditions,
    checkins: Math.max(C.checkins ?? 0, C.expeditions > 0 || C.guestTalks > 0 ? 1 : 0),
    quickRuns: C.quickRuns,
    equippedRare: P.bag.some((it) => it.owner != null && it.grade !== 'n'),
    has: (k) => homeObjs().some((o) => o.kind === k && o.build === undefined),
    guestTalks: C.guestTalks,
    goalsClaimed: C.goalsClaimed,
    // 전투 2차: 모든 스테이지가 열려 원래 조건으로 (1차 동안 이미 인정받은 임무는 진행 기록에 남아 그대로)
    huntBest: (r) => P.hunt.best[r] ?? 0,
    huntFirsts: P.hunt.firstClear.length,
    huntAutoUsed: C.huntAutoUsed > 0,
    regulars: regs.length,
    land: world.home?.land ?? S.land,
    stars: stars(),
    rep: Math.floor(P.rep),
    repFor: (s) => CONFIG.reputation.stars[s - 1] ?? 0,
    regionWins: (r) => (r === 'all' ? Object.values(C.regionWins).reduce((s, v) => s + v, 0) : C.regionWins[r as keyof typeof C.regionWins] ?? 0),
    salvaged: C.salvaged,
    enhanceMax: C.enhanceMax,
    crafted: Object.values(C.crafted).reduce((s, v) => s + v, 0),
    raidTries: P.raid.personalBest > 0 || P.raid.tries > 0 || Object.keys(P.raid.kills).length ? 1 : 0,
    // PACE §1-3: 떠돌이 보스 처치도 「토벌 보스 처치하기」로 (raidPace)
    raidKills: P.raid.weeksKilled + (flag('raidPace') ? P.raid.wanderKills ?? 0 : 0),
    heroes: HEROES.filter((h) => P.dex.heroes[h.id]?.recruited).length + LEGENDS.filter((l) => P.legends[l.key]?.st === 'joined').length,
    chem: P.dex.chem.length,
    rumors: Object.keys(P.legends).length,
    harvests: C.harvests,
    regularLv: (lv) => regs.filter((a) => a.lvl >= lv).length,
    itemDex: P.dex.items.length,
    harmonies: P.harmony.found.length,
    hiddenHarmonies: P.harmony.found.filter((id) => !HARMONIES.find((h) => h.id === id)?.open).length,
    evalScore: Math.max(evalScoreHook(), P.evaluation.best >= 3 ? 800 : P.evaluation.best >= 1 ? 300 : 0),
  };
}

/** 지금 임무 (다 끝났으면 null) */
export const currentMission = (): (Mission & { ch: number }) | null => MISSIONS[P.guide.idx] ?? null;
export const chapterOf = (no: number) => CHAPTERS.find((c) => c.no === no)!;
export function missionProgress(m: Mission): { cur: number; need: number; done: boolean } {
  const [cur, need] = m.check(guideCtx());
  return { cur, need, done: cur >= need };
}
/** 끝낸 장 수 */
export const chaptersDone = () => {
  let n = 0;
  for (const c of CHAPTERS) if (c.missions.every((m) => P.guide.claimed.includes(m.id))) n = c.no;
  return n;
};
/** 마을 등급 0 오두막 · 1 쉼터 · 2 마을 · 3 고을 · 4 도시 (임무 장 보상) */
export function townGrade(): number {
  let g = 0;
  for (const c of CHAPTERS) if (c.grade != null && c.missions.every((m) => P.guide.claimed.includes(m.id))) g = Math.max(g, c.grade);
  return g;
}

/** 기능이 열렸나 (5단계 전 저장은 모두 열림) */
export function feature(f: 'hunt' | 'smith' | 'shop' | 'raid' | 'garden' | 'cottage'): boolean {
  return P.guide.legacy || P.guide.unlocked.includes(f) || P.guide.unlocked.includes('all');
}
/** 잠긴 기능 → 몇 장에 열리는지 */
export function featureChapter(f: string): number {
  return CHAPTERS.find((c) => (c.unlock as string[]).includes(f))?.no ?? 0;
}

/** ui가 채운다: 장 끝 보상 연출 · 마을 등급 연출(2차) */
export const guideHooks = {
  chapterDone: (_no: number) => {},
  gradeUp: (_g: number) => {},
  /** 핫픽스 8: 「자동 사냥 켜 보기」 카드 → 사냥 준비 창 (ui/hunt가 채운다) */
  autoHuntPrep: (): boolean => false,
};

function grant(m: Mission) {
  const r = m.reward;
  if (r.gold) S.gold += r.gold;
  if (r.dust) P.dust.n += r.dust;
  if (r.tokens) P.tokens += r.tokens;
}
export const rewardText = (m: Mission) =>
  [m.reward.gold ? `금화 ${m.reward.gold}` : '', m.reward.dust ? `잿빛 가루 ${m.reward.dust}` : '', m.reward.tokens ? `인연의 증표 ${m.reward.tokens}` : ''].filter(Boolean).join(' · ');

/** 다 한 임무 받기: 보상 + 버나드 한마디 + 다음 임무. 장이 끝나면 장 보상 */
import { track as trackEv } from '../net/telemetry';
import { fsay } from './visual';
export function claimMission(silent = false): TalkLine[] {
  const m = currentMission();
  if (!m || !missionProgress(m).done) return [];
  grant(m);
  P.guide.claimed.push(m.id);
  P.guide.idx++;
  trackEv('guide_step', { ch: m.ch, n: P.guide.idx });
  markDirty();
  if (!silent) sfx('mission');
  const lines: TalkLine[] = silent ? [] : [['keeper', m.line, undefined, '노주인 버나드'], ['narr', `임무 보상: ${rewardText(m)}`]];
  const ch = chapterOf(m.ch);
  if (ch.missions.every((x) => P.guide.claimed.includes(x.id))) {
    const before = P.guide.unlocked.length;
    for (const u of ch.unlock) if (!P.guide.unlocked.includes(u)) P.guide.unlocked.push(u);
    void before;
    guideHooks.chapterDone(ch.no);
    if (ch.grade != null) guideHooks.gradeUp(ch.grade);
  }
  return lines;
}

/** 차례가 온 임무가 이미 해 둔 일이면 바로 완료 (연달아). 몇 개를 넘겼는지 */
export function skipDone(): number {
  let n = 0;
  for (let guard = 0; guard < MISSIONS.length; guard++) {
    const m = currentMission();
    if (!m || !missionProgress(m).done) break;
    claimMission(true);
    n++;
  }
  if (n) uiHooks.toast(fsay(`장부: 이미 해 둔 일 ${n}개를 완료했어요`, `장부: 이미 해 두신 일 ${n}개, 완료로 적어 뒀어요`));
  return n;
}

/**
 * ONBOARDING §2: 1장을 「첫 목표 3개」로 바꾼 뒤 예전 저장 맞추기 — 이미 정찰·모닥불을 한 저장은 체크인도 한 것으로
 *  (장 끝 연출·알림 없이 조용히) · 지금 임무 번호는 받은 목록으로 다시 센다
 */
export function migrateOnboarding() {
  const c = P.guide.claimed;
  if (!c.includes('c1_checkin') && (c.includes('c1_fire') || c.includes('c1_scout') || P.guide.legacy)) c.push('c1_checkin');
  const i = MISSIONS.findIndex((m) => !c.includes(m.id));
  P.guide.idx = i < 0 ? MISSIONS.length : i;
}
