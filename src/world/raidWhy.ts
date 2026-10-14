// 전역 규칙 「회색 버튼엔 이유」 · 토벌: 왜 지금 토벌을 못 하나 (화면 없는 규칙 — 시험용)
//  순서: 장부(기능 잠김) → 이번 주 보스 처치(도전장/월요일) → 오늘 도전 다 씀 → 갈 단골 없음 → 파티 비어 있음
//  text = 버튼을 눌렀을 때 토스트 · 버튼 아래 한 줄 / short = 모험 창 토벌 칸 부제 (짧게)
import { CONFIG } from '../data/config';
import { feature, featureChapter } from './guide';
import { partyPool, rulesV2 } from './partyRules';
import { challengeChoices, ensureWeek, raidCrew, triesLeft, triesMax, wanderTarget, type RaidTarget } from './raid';
import { P, world, type Actor } from './state';

export type RaidLockKey = 'chapter' | 'dead' | 'tries' | 'crew' | 'pick';
export interface RaidLock {
  key: RaidLockKey;
  text: string;
  short: string;
}

const homeActors = () => world.home?.actors ?? world.actors;
/** 토벌 후보 전체 (못 가는 사람 포함) — 단골·영웅 (+ 동행) */
function pool(): Actor[] {
  if (rulesV2()) return partyPool();
  return homeActors().filter((a) => !a.role && !a.leaving && (a.status === 'regular' || a.status === 'hero'));
}
/** 체력이 minHp 에 닿을 때까지 (쉬는 손님 회복: 게임 1시간에 4 · 오프라인 회복과 같은 값) — 분 */
export function restMinutes(hp: number): number {
  const need = Math.max(0, CONFIG.expedition.minHp - hp);
  if (!need) return 0;
  const sec = (need / 4) * CONFIG.clock.realSecondsPerGameHour;
  return Math.max(1, Math.ceil(sec / 60));
}
/** 「갈 수 있는 단골이 없어요 · 원정 중 n명 · 지침 n명 (쉬면 ○분 뒤)」 */
export function noCrewText(): string {
  const all = pool();
  const away = all.filter((a) => a.runId != null).length;
  const tired = all.filter((a) => a.runId == null && a.hp < CONFIG.expedition.minHp);
  const parts = ['갈 수 있는 단골이 없어요'];
  if (away) parts.push(`원정 중 ${away}명`);
  if (tired.length) parts.push(`지침 ${tired.length}명 (쉬면 ${restMinutes(Math.max(...tired.map((a) => a.hp)))}분 뒤)`);
  if (!all.length) parts.push('단골이 생기면 같이 가요');
  return parts.join(' · ');
}
/** 이번 주 보스를 잡았을 때 */
export function deadText(): string {
  if (challengeChoices().length) return '이번 주 보스를 잡았어요 → 도전장으로 다음 보스';
  return '이번 주 보스를 잡았어요 · 월요일에 새 보스가 와요';
}
export const triesText = () => `오늘 도전 0/${triesMax()} · 내일 0시에 채워져요`;

/** 이 토벌 창에서 시작 버튼이 막힌 이유 (null = 갈 수 있음) · picked = 지금 파티 인원 */
export function raidLock(t: RaidTarget | null, picked: number): RaidLock | null {
  if (!feature('raid')) {
    const s = `장부 ${featureChapter('raid')}장에 열려요`;
    return { key: 'chapter', text: s, short: s };
  }
  if (t?.kind === 'weekly' && P.raid.hpLeft <= 0) return { key: 'dead', text: deadText(), short: challengeChoices().length ? '도전장 고르기' : '이번 주 처치 완료' };
  if (triesLeft() <= 0) return { key: 'tries', text: triesText(), short: '오늘 도전 끝 · 내일 0시' };
  if (!raidCrew().length) return { key: 'crew', text: noCrewText(), short: '갈 수 있는 단골이 없어요' };
  if (picked <= 0) return { key: 'pick', text: '파티에 단골을 넣어 주세요', short: '' };
  return null;
}
/** 모험 창 토벌 칸 부제 (막혔으면 짧은 이유 · 아니면 null) — 떠돌이 보스가 있으면 주간 처치는 이유가 아님 */
export function raidTileLock(): RaidLock | null {
  if (!feature('raid')) return raidLock(null, 0);
  ensureWeek();
  const weeklyDone = P.raid.hpLeft <= 0 && !challengeChoices().length;
  if (weeklyDone && !wanderTarget()) return { key: 'dead', text: deadText(), short: '이번 주 처치 완료 · 월요일' };
  const l = raidLock(null, 1);
  return l && l.key !== 'pick' ? l : null;
}
