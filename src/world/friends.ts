// SOCIAL_SPEC §3·§4 「각별한 이웃」 — 내 저장 쪽: 받은 도움 반영 · 🤝 우정 증표 · 편지함 기록
//  도움은 서버(help_events)에 쌓였다가 주인이 접속하면 claim_help()로 가져온다 (서버가 applied_at을 찍어 한 번만)
//  공사 거들기: 남은 시간 −10% (한 번에 최대 30분) · 건물 하나에 친구 도움 합계는 원래 시간의 30%까지 (뚝딱 탭 상한과 따로)
import { CONFIG } from '../data/config';
import { def } from '../data/catalog';
import { markDirty, P, S, world, type Building } from './state';
import { conLeft } from './construct';
import { addCrop } from './facilities';
import { addMail } from './meta';
import type { HelpEvent } from '../net/friends';

const SC = CONFIG.social;
export const social = () => (P.social ??= { tokens: 0, reqSeen: [] });
export function addTokens(n: number) {
  if (n <= 0) return;
  social().tokens += n;
  markDirty();
}

/** 이웃이 보는 내 마을 배치와 같은 좌표로 건물 이름표 (커지는 업그레이드는 공사 전 자리) */
export const conKey = (o: Building) => `${o.kind}@${o.con?.from?.[0] ?? o.tx},${o.con?.from?.[1] ?? o.ty}`;
/** 이웃에게 보여 줄 공사 (1칸 장식 빼고) — { 이름표: [끝 ms, 원래 초] } */
export function conSnapshot(objs: Building[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const o of objs) if (o.con && !(o.fw === 1 && o.fh === 1) && conLeft(o) > 0) out[conKey(o)] = [o.con.end, o.con.total];
  return out;
}

/** 공사 거들기 한 번 → 줄인 초 (0 = 못 줄임: 다 됐거나 친구 도움 상한) */
export function friendCut(o: Building, pct = SC.conCutPct, now = Date.now()): number {
  const c = o.con;
  if (!c) return 0;
  const left = conLeft(o, now);
  const cap = c.total * SC.conFriendCapPct - (c.friendCut ?? 0);
  const cut = Math.max(0, Math.min(left * pct, SC.conCutMaxMin * 60, cap, left));
  if (cut <= 0) return 0;
  c.end -= cut * 1000;
  c.friendCut = (c.friendCut ?? 0) + cut;
  markDirty();
  return cut;
}

/** 선물: 작은 재료 꾸러미 — 지금 땅에서 기를 수 있는 작물 3종 하나씩 → 받은 것 글자 */
function giftKit(): string {
  const pool = Object.entries(CONFIG.garden.crops).filter(([, c]) => ((c as { land?: number }).land ?? 1) <= S.land && (c as { eat?: boolean }).eat !== false);
  const got: string[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const [id, c] = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    addCrop(id, 1);
    got.push(c.name);
  }
  return got.join(' · ');
}

const mins = (sec: number) => (sec >= 60 ? `${Math.round(sec / 60)}분` : `${Math.max(1, Math.round(sec))}초`);
/** 가져온 도움 하나를 내 저장에 반영 → 알림 한 줄 (반영할 게 없으면 그 까닭) */
export function applyHelp(ev: HelpEvent): string {
  const who = ev.nickname || '이웃';
  let line: string;
  if (ev.kind === 'con') {
    const home = world.home?.objs ?? world.objs;
    const o = home.find((b) => b.con && conKey(b) === ev.target);
    const cut = o ? friendCut(o, Math.min(0.5, Math.max(0, ev.amount / 100))) : 0;
    line = o && cut > 0 ? `${who}님이 ${def(o.kind).name} 공사를 거들어 줬어요 (−${mins(cut)})` : `${who}님이 공사를 거들러 왔는데 이미 다 지었어요`;
  } else line = `${who}님이 선물을 두고 갔어요 — ${giftKit() || '작은 꾸러미'}`;
  addMail({ from: 'friend', title: `🤝 ${who}님의 도움`, body: line, reward: {}, thank: ev.id });
  return line;
}
