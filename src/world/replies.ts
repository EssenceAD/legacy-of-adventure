// DIRECTION §2-1: 운영자 답장 → 게임 우편함 「운영자의 답장」 (편지마다 한 번 · 넣은 뒤 저장하고 나서 서버에 읽음 표시)
import { markRepliesRead, myReplies, type ReplyRow } from '../net/direction';
import { addMail } from './meta';
import { markDirty, P, uiHooks } from './state';

const STATUS_LINE: Record<string, string> = { 반영: '말씀해 주신 건 게임에 반영했어요. 고마워요!', 보류: '지금은 보류해 두었어요. 더 생각해 볼게요.' };

/** 우편 본문: 보낸 편지 첫머리 · 답장 · (반영이면 버전) */
export function replyMailBody(r: ReplyRow): string {
  const sent = r.body.replace(/^\[[^\]]+\]\s*/, '').replace(/\s+/g, ' ').trim();
  const head = sent ? `「${[...sent].slice(0, 24).join('')}${[...sent].length > 24 ? '…' : ''}」 편지에 답장이 왔어요.` : '보내 주신 편지에 답장이 왔어요.';
  const st = r.status === '반영' && r.ver_fixed ? `v${r.ver_fixed.replace(/^v/i, '').replace(/-beta$/i, '')}에 반영했어요. 고마워요!` : STATUS_LINE[r.status] ?? '';
  return [head, r.reply.trim(), st].filter(Boolean).join(' · ');
}

/**
 * 안 받은 답장을 우편함에 넣는다 → 넣은 수. persist(저장)를 마친 뒤에야 서버에 읽음 표시 (저장 전에 꺼지면 다음에 다시 온다 · 번호로 겹치지 않게)
 */
export async function deliverReplies(persist: () => void = () => {}): Promise<number> {
  const rows = await myReplies();
  if (!rows.length) return 0;
  if (!Array.isArray(P.meta.replied)) P.meta.replied = [];
  const got = P.meta.replied;
  let n = 0;
  for (const r of rows) {
    const key = `${r.id}@${r.replied_at ?? ''}`;
    if (!r.reply || got.includes(key)) continue;
    addMail({ from: 'admin', title: '운영자의 답장', body: replyMailBody(r), reward: {} });
    got.push(key);
    n++;
  }
  if (got.length > 200) got.splice(0, got.length - 200);
  if (n) {
    markDirty();
    uiHooks.toast(`우편함에 운영자의 답장이 ${n}통 왔어요`);
    try {
      persist();
    } catch {
      /* 저장 실패해도 다음에 번호로 걸러진다 */
    }
  }
  await markRepliesRead(rows.map((r) => r.id));
  return n;
}
