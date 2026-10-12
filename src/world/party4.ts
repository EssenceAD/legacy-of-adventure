// PARTY §3: 사냥·토벌 4번째 자리 — 훈련장 Lv5 + 장부 8장(장부가 7장까지면 마지막 장) 둘 다 · 열리면 계속 열림
import { CONFIG } from '../data/config';
import { CHAPTERS } from '../data/guide';
import { chaptersDone } from './guide';
import { P, world } from './state';
import { bestOf } from './town';

const C = CONFIG.party4;
/** 장부 조건: 그 장까지 끝냈나 (장부에 그 장이 없으면 마지막 장까지) · 5단계 전 저장(장부 없이 시작)은 끝낸 것으로 */
export const ledgerNeed = () => Math.min(C.chapter, Math.max(...CHAPTERS.map((c) => c.no)));
export const ledgerOk = () => !!P.guide.legacy || chaptersDone() >= ledgerNeed();
/** 훈련장 조건: 우리 마을(이웃 방문 중이어도 집) 훈련장 최고 레벨 */
export const trainingLv = () => bestOf('training', (world.home ?? world).objs, true)?.lvl ?? 0;
export const party4Ready = () => trainingLv() >= C.trainingLv && ledgerOk();
/** 한 번 열리면 계속 (훈련장을 허물어도 줄지 않게) */
export const party4Open = () => !!P.meta.party4 || party4Ready();
/** 사냥·토벌 파티 최대 인원 */
export const huntPartyMax = () => (party4Open() ? C.max : C.base);
