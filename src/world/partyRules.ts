// CHECKIN §J6 파티 후보 한 규칙 (플래그 partyRulesV2 · 형철 결정 — 켬)
//  원정·사냥·토벌·심연 네 파티 고르기가 같은 후보 목록 · 같은 「못 가는 이유」 · 추천 편성은 네 곳 모두
//  - 후보 = 단골 · 영웅 · 방문 중인 전설(동행 · legendCompanion) — 토벌·심연도 동행이 갈 수 있다
//  - 못 가는 사람도 목록에 남는다(흐리게 + 이유): 원정 중 n분 · 떠나는 중 · 쉬는 중(체력 30 미만 — 원정·토벌만 막음)
//  - 사냥·심연은 체력이 낮아도 갈 수 있다(예전 그대로) — 대신 「체력 n · 지쳤어요」를 같은 자리에 보여 준다
import { CONFIG } from '../data/config';
import { partyEligible } from './expeditions';
import { flag } from './flags';
import { recommendParty, type RecPick, type RecTarget } from './party';
import { P, world, type Actor } from './state';

export type PartyWhere = 'exp' | 'hunt' | 'raid' | 'abyss';
export const rulesV2 = () => flag('partyRulesV2');
const homeActors = () => world.home?.actors ?? world.actors;
const minHp = () => CONFIG.expedition.minHp;

/** 짧은 남은 시간 (「3분」 · 「1시간 5분」 · 「30초」) */
export function shortLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}시간${Math.floor((s % 3600) / 60) ? ` ${Math.floor((s % 3600) / 60)}분` : ''}`;
  if (s >= 60) return `${Math.floor(s / 60)}분`;
  return `${s}초`;
}
/** 원정 중이면 「원정 중 3분」 (돌아오는 중이면 「돌아오는 중」) */
export function awayText(a: Actor, now = Date.now()): string | null {
  if (a.runId == null) return null;
  const r = P.runs.find((x) => x.id === a.runId);
  if (!r) return '원정 중';
  if (r.result || r.end <= now) return '돌아오는 중';
  return `원정 중 ${shortLeft(r.end - now)}`;
}
/** 체력이 낮아 원정·토벌을 못 가는가 */
export const resting = (a: Actor) => a.hp < minHp();

/** 이 화면 파티에 못 넣는 이유 (null = 넣을 수 있음) — 네 화면 한 규칙 */
export function partyBlock(a: Actor, where: PartyWhere): string | null {
  if (!partyEligible(a)) return '방문 손님은 파티에 못 가요';
  const away = awayText(a);
  if (away) return away;
  if (a.leaving) return '떠나는 중';
  if ((where === 'exp' || where === 'raid') && resting(a)) return `쉬는 중 · 체력 ${minHp()} 미만`;
  return null;
}
/** 갈 수는 있지만 알려 줄 것 (사냥·심연: 체력 낮음) */
export function partyNote(a: Actor, where: PartyWhere): string | null {
  if ((where === 'hunt' || where === 'abyss') && resting(a) && !partyBlock(a, where)) return `체력 ${Math.round(a.hp)} · 지쳤어요`;
  return null;
}
/** 화면에 보여 줄 후보 전체 (못 가는 사람 포함) */
export const partyPool = (): Actor[] => homeActors().filter((a) => partyEligible(a) && !a.leaving);
/** 지금 넣을 수 있는 사람 */
export const partyReady = (where: PartyWhere): Actor[] => partyPool().filter((a) => !partyBlock(a, where));

/** 네 화면 추천 편성 (같은 recommendParty — 넣을 수 있는 사람만) */
export function recommendFor(where: PartyWhere, t: RecTarget, cands: Actor[] = partyReady(where)): RecPick | null {
  return recommendParty(cands.filter((a) => !partyBlock(a, where) && a.hp >= 1), t);
}
