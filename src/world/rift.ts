// RAIDWEAPON §3' 「하늘 균열」 규칙 (화면 없음 · 시험용) — 서버 supabase/world_raid.sql 이 진짜, 여기는 보여 주기·미리 자르기·보상 편지
//  · 열림: 플래그 worldRaid(또는 실험실) + 토벌이 열린 장부 (feature('raid'))
//  · 하루 3번(서버 my_tries + 이 기기에서 시작했지만 아직 못 올린 판) · 한 판 60초 · 전멸이면 그때까지
//  · 피해 = 필드 전투에서 보스에게 준 피해 그대로 (서버가 파티 전투력 합 × cap · 보스 체력 × hitMaxFrac 으로 자름 — 같은 규칙을 여기서도)
//  · 보상: 서버 world_rewards → world_claim() 한 번 → 우편함 편지 (조각 · 잿빛 가루 · 선택 상자 · 칭호) — 버닝 주말 배수는 riftRewardMult(day)
import { CONFIG } from '../data/config';
import type { RiftBoss, RiftReward } from '../net/worldRaid';
import { feature, featureChapter } from './guide';
import { P, type Mail } from './state';
import { vis } from './visual';
import { nextRiftReset, riftDay } from './riftDay';

export const W = () => CONFIG.raidWeapon.world;
/** 켜졌나: 플래그(모두) 또는 실험실(이 기기) */
export const riftOn = (): boolean => vis('worldRaid');

/** 장부가 모자라 못 들어가는 이유 (열렸으면 null) */
export function riftLock(): string | null {
  if (feature('raid')) return null;
  return `하늘 균열은 장부 ${featureChapter('raid')}장(토벌이 열리면)부터 들어갈 수 있어요`;
}

/** 지금 들어갈 수 있는 균열이 열려 있나 (기간 안 · 시험 보스 포함) */
export const riftActive = (b: RiftBoss | null, now: number): b is RiftBoss => !!b && now >= b.startsAt && now < b.endsAt;

/** 마을 하늘 금 · 오른쪽 위 알약을 보이나 (플래그 · 장부 · 열린 균열 · 이웃 방문 중 아님) */
export function pillVisible(b: RiftBoss | null, now: number, visiting = false): boolean {
  return riftOn() && !visiting && riftLock() == null && riftActive(b, now);
}

/** 오늘 남은 도전 (서버 기록 + 이 기기에서 시작했지만 아직 서버에 못 올린 판) */
export function triesLeft(b: RiftBoss | null, pendingSameBoss = 0): number {
  if (!b) return 0;
  return Math.max(0, (b.triesMax || W().tries) - b.myTries - pendingSameBoss);
}

/** 도전 버튼이 막힌 이유 (null = 갈 수 있음) */
export function startLock(b: RiftBoss | null, now: number, pendingSameBoss = 0, crew = 1): string | null {
  const l = riftLock();
  if (l) return l;
  if (!riftActive(b, now)) return '지금은 열린 균열이 없어요 · 매일 05:00에 새 균열이 열려요';
  if (b.killed) return `균열 너머의 ${b.name}이(가) 쓰러졌어요 · 05:00에 새 균열이 열려요`;
  if (triesLeft(b, pendingSameBoss) <= 0) return `오늘 도전 0/${b.triesMax || W().tries} · 05:00에 채워져요`;
  if (crew <= 0) return '갈 수 있는 단골이 없어요';
  return null;
}

/** 한 판 피해를 서버와 같은 규칙으로 자르기 (보여 줄 숫자 · 서버가 다시 자른다) */
export function clampDmg(dmg: number, power: number, hpMax: number, test = false): number {
  const d = Math.max(0, Math.round(Number.isFinite(dmg) ? dmg : 0));
  const p = Math.max(0, Math.round(Number.isFinite(power) ? power : 0));
  let v = Math.min(d, p * W().cap);
  if (!test) v = Math.min(v, Math.ceil(hpMax * W().hitMaxFrac));
  return v;
}

/** 한 판에 서버가 받아 주는 최대 피해 (전투력 합 × cap · 보스 체력 × hitMaxFrac) */
export const runCap = (b: Pick<RiftBoss, 'hpMax' | 'test'>, power: number) => clampDmg(Number.MAX_SAFE_INTEGER, power, b.hpMax, b.test);
/**
 * 이 판 보스 체력(필드 단위 = 서버 피해 단위): 남은 공용 체력을 이 판 상한 안에서 다 깎을 수 있을 때만 그 체력 (= 진짜 마지막 일격)
 *  아니면 쓰러지지 않는 큰 값 — 승패 없이 60초 동안 피해만
 */
export const localHp = (b: Pick<RiftBoss, 'hpMax' | 'hpLeft' | 'test'>, power: number) => (b.hpLeft > 0 && b.hpLeft <= runCap(b, power) ? b.hpLeft : 1e15);

/** 판이 왜 끝났나: 시간(60초) · 전멸 · 포기 */
export function endReason(r: { win: boolean; timeLeft?: number; quit?: boolean; bossDown?: boolean }): 'time' | 'wipe' | 'quit' | 'kill' {
  if (r.quit) return 'quit';
  if (r.bossDown) return 'kill';
  if (!r.win && (r.timeLeft ?? 0) > 0) return 'wipe';
  return 'time';
}

/** 마을 전체로 깎은 비율 (0~1) */
export const villageFrac = (b: Pick<RiftBoss, 'hpMax' | 'hpLeft'>) => (b.hpMax > 0 ? Math.max(0, Math.min(1, 1 - b.hpLeft / b.hpMax)) : 0);
/** 「37%」 — 조금이라도 깎였으면 0% 대신 1% · 다 깎였으면 100% */
export function villagePct(b: Pick<RiftBoss, 'hpMax' | 'hpLeft'>): string {
  const f = villageFrac(b);
  const n = b.hpLeft <= 0 ? 100 : f > 0 ? Math.max(1, Math.min(99, Math.floor(f * 100))) : 0;
  return `${n}%`;
}

const kr = (n: number) => Math.round(n).toLocaleString('ko-KR');
/** 결과 한 줄: 「내 피해 ○ · 오늘 순위 ○위 · 마을 전체 ○%」 */
export function resultLine(myDmg: number, rank: number | null, b: Pick<RiftBoss, 'hpMax' | 'hpLeft'>): string {
  return `내 피해 ${kr(myDmg)} · 오늘 순위 ${rank ? `${rank}위` : '—'} · 마을 전체 ${villagePct(b)}`;
}

/** 보스 이름 「균열 너머의 ○○」 */
export const bossTitle = (b: Pick<RiftBoss, 'name' | 'test'>) => `균열 너머의 ${b.name}${b.test ? ' (시험)' : ''}`;

/** 공용 체력이 before → after 로 줄 때 넘은 알림 단계 (0.5 · 0.25 · 0) → 단계마다 한 줄 */
export function noticeLines(name: string, beforeLeft: number, afterLeft: number, hpMax: number, killerInn?: string | null): { t: number; text: string }[] {
  if (!(hpMax > 0)) return [];
  const out: { t: number; text: string }[] = [];
  const b = beforeLeft / hpMax;
  const a = afterLeft / hpMax;
  for (const t of W().notices) {
    if (t <= 0) {
      if (beforeLeft > 0 && afterLeft <= 0) out.push({ t, text: killerInn ? `🌌 ${killerInn}의 마지막 일격! 균열 너머의 ${name}이(가) 쓰러졌어요!` : `🌌 균열 너머의 ${name}이(가) 쓰러졌어요!` });
    } else if (b > t && a <= t && afterLeft > 0) out.push({ t, text: t === 0.5 ? `🌌 균열 너머의 ${name}의 체력이 절반 남았어요!` : `🌌 균열 너머의 ${name}의 체력이 ${Math.round(t * 100)}% 남았어요!` });
  }
  return out;
}

/** 남은 시간 「3시간 12분」 (다음 05:00 또는 보스 끝) */
export function timeLeftText(b: Pick<RiftBoss, 'endsAt'> | null, now: number): string {
  const end = b ? b.endsAt : nextRiftReset(now);
  const m = Math.max(0, Math.floor((end - now) / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}시간 ${m % 60}분` : `${m}분`;
}

// ───────── 보상 → 우편함 ─────────

/**
 * 버닝 주말 조각 배수 — 보상의 day(균열의 하루 'YYYY-MM-DD')가 버닝 기간 안이면 2, 아니면 1.
 *  버닝 모듈(burnWeekend)이 riftMultHook.fn 을 채운다 (채우기 전엔 늘 1). 조각(frags)에만 곱한다 — 가루·상자·칭호는 그대로
 */
export const riftMultHook = { fn: (_day: string): number => 1 };
export function riftRewardMult(day: string): number {
  const m = riftMultHook.fn(day);
  return Number.isFinite(m) && m > 0 ? m : 1;
}

/** 서버 보상 한 줄 → 편지 (보내기 전 모양) */
export function rewardMail(r: RiftReward): Omit<Mail, 'id' | 'at' | 'claimed'> {
  const p = r.payload;
  const mult = riftRewardMult(r.day);
  const frags = p.frags ? Math.floor(p.frags * mult) : 0;
  const burn = mult > 1 && frags ? ` · 🔥 버닝 조각 ×${mult}` : '';
  if (r.kind === 'weekly') {
    const top = p.boxes ? `주간 ${p.rank ?? ''}위 — 선택 상자를 보내요!` : `주간 ${p.rank ?? ''}위 — 무기 조각을 보내요!`;
    return { from: 'rift', title: '🌌 하늘 균열 · 주간 순위 보상', body: `이번 주 합산 피해 ${kr(p.dmg ?? 0)} · ${top}${burn}`, reward: { ...(frags ? { frags } : {}), ...(p.boxes ? { boxes: p.boxes } : {}) }, rid: r.id };
  }
  const parts = [`${r.day.slice(5).replace('-', '/')} 균열 너머의 ${p.name ?? '보스'}`, `내 피해 ${kr(p.dmg ?? 0)}`];
  if (p.rank) parts.push(`그날 ${p.rank}위`);
  if (p.killed) parts.push('처치 성공!');
  return {
    from: 'rift',
    title: p.title ? '🌌 하늘 균열 · 오늘의 영웅!' : '🌌 하늘 균열 · 참여 보상',
    body: parts.join(' · ') + burn,
    reward: { ...(frags ? { frags } : {}), ...(p.dust ? { dust: p.dust } : {}), ...(p.title ? { title: p.title } : {}) },
    rid: r.id,
  };
}

/** 받은 보상들을 편지로 (같은 보상 번호는 한 번만) → 넣은 편지 수 */
export function mailRewards(list: RiftReward[], add: (m: Omit<Mail, 'id' | 'at' | 'claimed'>) => void): number {
  const have = new Set(P.meta.mail.map((m) => m.rid).filter((x): x is number => x != null));
  let n = 0;
  for (const r of list) {
    if (have.has(r.id)) continue;
    have.add(r.id);
    add(rewardMail(r));
    n++;
  }
  return n;
}

/** 시험용: 지금 균열의 하루 */
export const riftToday = (now: number) => riftDay(now);
