// CHECKIN §D2 여관 연감 (무료 시즌 패스) — 시즌 1 = 수확제 (10/22 20:00 ~ 11/05) + 정리 3일 (~ 11/08)
//  도장: 오늘의 장부 셋 다(3) · 수확제 리본 교환(1) · 업적 받기(1) — 마지막 주(11/02~)는 ×2 (따라잡기)
//  30칸 · 한 칸 = 도장 2 · 10·20·30칸 시즌 장식 · 30칸 칭호 「수확의 주인」 · 시즌이 끝나면 남은 도장 30%는 다음 시즌으로
import { ALMANAC, ALMANAC_CELLS, BOOK_AS_MATS, type AlmanacReward } from '../data/harvest_cfg';
import { REGIONS, type RegionId } from '../data/items';
import { flag } from './flags';
import { almanacOn, alState } from './hvLite';
import { topRegion } from './goldsink';
import { addCharm, addWhet, brag } from './growth';
import { hvNow, hvState } from './harvest';
import type { AlmanacState } from './hvState';
import { addMail } from './meta';
import { gotGold, markDirty, P, S, uiHooks } from './state';

export { achStamp, addStamps, almanacOn, alState, inSeason, stampMult } from './hvLite';

/** 닿은 칸 수 (0~30) */
export const cellsReached = (stamps = alState().stamps) => Math.min(ALMANAC.cells, Math.floor(stamps / ALMANAC.perCell));
/** 받을 수 있는 칸 (닿았고 아직 안 받음) */
export function readyCells(): number[] {
  const a = alState();
  const out: number[] = [];
  for (let i = 1; i <= cellsReached(a.stamps); i++) if (!a.claimed.includes(i)) out.push(i);
  return out;
}
/** 빨간 점: 받을 칸이 있다 */
export const almanacDot = () => almanacOn() && readyCells().length > 0;

/** 보상 한 줄 */
export function rewardText(r: AlmanacReward): string {
  const mat = REGIONS[topRegion()].mat;
  switch (r.k) {
    case 'mats': return `${mat} ×${r.n}`;
    case 'dust': return `잿빛 가루 ×${r.n}`;
    case 'shards': return `증표 조각 ×${r.n}`;
    case 'gold': return `금화 ${(r.n * (topRegion() + 1)).toLocaleString('ko-KR')}`;
    case 'book': return `스킬 책 ×${r.n} (준비 중 → ${mat} ×${r.n * BOOK_AS_MATS})`;
    case 'whet': return `행운의 숫돌 ×${r.n}`;
    case 'charm': return `강화 보호 부적 ×${r.n}`;
    case 'ribbon': return `수확 리본 ×${r.n}`;
    case 'tokens': return `인연의 증표 ×${r.n}`;
    case 'deco': return `시즌 장식 「${decoName(r.kind)}」${r.title ? ` · 칭호 「${r.title}」` : ''}`;
  }
}
const DECO_NAMES: Record<string, string> = { harvest_cart: '수확 수레', harvest_table: '수확제 잔칫상', harvest_arch: '수확제 아치' };
const decoName = (k: string) => DECO_NAMES[k] ?? k;

/**
 * 스킬 책 (§F 훈련장·스킬 강화 전 임시): 한 권 = 최고 지역 재료 BOOK_AS_MATS개
 *  F가 들어오면 여기서 P.skillBooks로 바꾼다 (보상 표는 그대로)
 */
export function giveSkillBooks(n: number): string {
  const r = REGIONS[topRegion()];
  P.mats[r.id as RegionId] = (P.mats[r.id as RegionId] ?? 0) + n * BOOK_AS_MATS;
  return `${r.mat} ×${n * BOOK_AS_MATS}`;
}
function shards(n: number) {
  P.hunt.shards += n;
  while (P.hunt.shards >= 10) {
    P.hunt.shards -= 10;
    P.tokens++;
  }
}
/** 보상 주기 (연감 칸 · 오늘의 장부 상자 공통) */
export function giveReward(r: AlmanacReward) {
  const reg = REGIONS[topRegion()];
  switch (r.k) {
    case 'mats':
      P.mats[reg.id as RegionId] = (P.mats[reg.id as RegionId] ?? 0) + r.n;
      break;
    case 'dust':
      P.dust.n += r.n;
      break;
    case 'shards':
      shards(r.n);
      break;
    case 'gold': {
      const g = r.n * (topRegion() + 1);
      S.gold += g;
      gotGold(g, 'almanac');
      break;
    }
    case 'book':
      giveSkillBooks(r.n);
      break;
    case 'whet':
      addWhet(r.n);
      break;
    case 'charm':
      addCharm(r.n);
      break;
    case 'ribbon': {
      // 리본은 교환에 쓰라고 주는 것 — 「모은 리본」(칭호 기준)에는 넣지 않는다
      hvState().ribbons += r.n;
      break;
    }
    case 'tokens':
      P.tokens += r.n;
      break;
    case 'deco':
      P.meta.giftDeco[r.kind] = (P.meta.giftDeco[r.kind] ?? 0) + 1;
      if (r.title) {
        alState().title = true;
        brag('harvest', null, r.title);
      }
      break;
  }
  markDirty();
}

/** 칸 하나 받기 (1~30) — 보상 글 · 안 되면 null */
export function claimCell(n: number, now = hvNow()): string | null {
  if (!almanacOn(now)) return null;
  const a = alState();
  if (n < 1 || n > ALMANAC.cells || a.claimed.includes(n) || n > cellsReached(a.stamps)) return null;
  a.claimed.push(n);
  const r = ALMANAC_CELLS[n - 1];
  giveReward(r);
  markDirty();
  return rewardText(r);
}

/** 다음 시즌으로 넘길 도장: 못 채웠으면 모은 도장의 30% · 다 채웠으면 넘친 도장의 30% */
export function carryOf(stamps: number): number {
  const full = ALMANAC.cells * ALMANAC.perCell;
  return Math.floor((stamps >= full ? stamps - full : stamps) * ALMANAC.carry);
}
/**
 * 시즌 닫기 (기간이 끝난 뒤 처음): 닿았는데 못 받은 칸은 우편으로 · 넘길 도장 계산 — 한 번만
 *  (플래그를 꺼 둔 동안 끝났어도 다음에 켜졌을 때 닫는다)
 */
export function closeSeason(now = hvNow()): boolean {
  if (!flag('almanac') || now <= ALMANAC.to) return false;
  const a = alState();
  if (a.closed === ALMANAC.season || (!a.stamps && !a.claimed.length)) return false;
  a.closed = ALMANAC.season;
  const left = readyCellsOf(a);
  for (const n of left) {
    a.claimed.push(n);
    const r = ALMANAC_CELLS[n - 1];
    addMail({ from: 'system', title: `여관 연감 ${n}칸 (못 받은 보상)`, body: `${ALMANAC.name}이 끝났어요. 받지 못한 칸의 보상을 보내 드려요 — ${rewardText(r)}`, reward: mailReward(r) });
    if (r.k === 'deco' && r.title) a.title = true;
  }
  a.carry = carryOf(a.stamps);
  markDirty();
  if (a.carry) uiHooks.toast(`여관 연감 시즌 1이 끝났어요 · 도장 ${a.carry}개는 다음 시즌으로 넘어가요`);
  return true;
}
function readyCellsOf(a: AlmanacState): number[] {
  const out: number[] = [];
  for (let i = 1; i <= cellsReached(a.stamps); i++) if (!a.claimed.includes(i)) out.push(i);
  return out;
}
/** 우편으로 줄 수 있는 보상 (우편 칸에 없는 것은 바로 넣고 글만) */
function mailReward(r: AlmanacReward) {
  switch (r.k) {
    case 'gold': return { gold: r.n * (topRegion() + 1) };
    case 'dust': return { dust: r.n };
    case 'tokens': return { tokens: r.n };
    case 'shards': return { shards: r.n };
    case 'deco': return { deco: r.kind };
    default:
      giveReward(r);
      return {};
  }
}
