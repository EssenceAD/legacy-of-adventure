// v0.25.4 CHECKIN §C4 빨간 점 하나의 규칙 (플래그 redDots · 실험실)
//  받을 게 있는 곳에만 작은 빨간 점 하나 — 우편(안 읽음) · 원정(끝남) · 대장간(★ 영웅 장비 강화 가능) · 텃밭(다 자람) · 장부(받을 보상) · 업적 · 오늘의 목표
//  숫자 배지는 「📖 새 이야기 n」 하나만 (건설 버튼의 안 본 장식 수도 점으로)
import { CONFIG } from '../data/config';
import { enhanceBossCost, enhanceCost, ripeCount, smithObj } from './craft';
import { favActors } from './growth';
import { P } from './state';

/** 점을 고르는 데 쓰는 지금 상태 (숫자) — 화면이 모아서 넘긴다 */
export interface DotInput {
  mailUnread: number;
  runsDone: number;
  smithReady: boolean;
  ripe: number;
  missionReady: boolean;
  achReady: number;
  goalsReady: boolean;
  unseenDeco: number;
  /** LUXE §4 방명록: 확인 안 한 새 좋아요 (guestbook 끔이면 0) */
  gbNew?: number;
  /** 다섯 별: 장부 3막 「다섯 별의 원정대」가 열렸는데 아직 못 봄 (fiveStars 끔이면 0) */
  fiveNew?: number;
}
/** 버튼마다 점 하나 켤지 */
export interface DotPlan {
  /** 아래 「원정」 (새 HUD는 「모험」) */
  exp: boolean;
  /** 아래 「메뉴」: 메뉴 안에 받을 것 (우편 · 업적 · 대장간 · 텃밭) */
  menu: boolean;
  /** 아래 「건설」: 안 본 장식 (숫자 대신 점) */
  build: boolean;
  /** 왼쪽 위 장부 카드 */
  mission: boolean;
  /** 메뉴 격자 칸 */
  tiles: { mail: boolean; exp: boolean; smith: boolean; garden: boolean; quest: boolean; ach: boolean; goals: boolean; neighbor: boolean };
  /** LUXE §4 아래 「마을」(이웃) 버튼: 새 좋아요 */
  village: boolean;
}
export function dotPlan(i: DotInput): DotPlan {
  return {
    exp: i.runsDone > 0,
    menu: i.mailUnread > 0 || i.achReady > 0 || i.smithReady || i.ripe > 0 || (i.gbNew ?? 0) > 0 || (i.fiveNew ?? 0) > 0,
    build: i.unseenDeco > 0,
    mission: i.missionReady,
    tiles: { mail: i.mailUnread > 0, exp: i.runsDone > 0, smith: i.smithReady, garden: i.ripe > 0, quest: i.missionReady || (i.fiveNew ?? 0) > 0, ach: i.achReady > 0, goals: i.goalsReady, neighbor: (i.gbNew ?? 0) > 0 },
    village: (i.gbNew ?? 0) > 0,
  };
}

/** 안 읽은 편지 (보상 없는 편지도 — 열면 읽음) */
export const mailUnread = () => P.meta.mail.filter((m) => !m.claimed).length;
/** 결과를 기다리는 원정 */
export const runsDone = () => P.runs.filter((r) => r.result && !r.claimed).length;
/** 대장간: ★ 아끼는 영웅이 끼운 장비 중 지금 가루·보스 재료로 바로 강화할 수 있는 것이 있나 (+10 미만) */
export function smithReady(): boolean {
  const s = smithObj();
  if (!s || s.build !== undefined) return false;
  for (const a of favActors())
    for (const id of Object.values(a.equip ?? {})) {
      const it = P.bag.find((x) => x.id === id);
      if (!it || it.enh >= CONFIG.smith.maxEnhance) continue;
      if (P.dust[it.grade] < enhanceCost(it)) continue;
      const bc = enhanceBossCost(it);
      if (bc && (P.bossMats[bc.boss.id] ?? 0) < bc.n) continue;
      return true;
    }
  return false;
}
export const ripe = () => ripeCount();
