// LUXE §4 방명록: 서버 누적 좋아요 수 → 빨간 점 · 10개마다 우편함 선물 (클라우드 저장 때 같이 · pollMin분마다)
//  선물은 서버 누적 수로만 센다 (world/guestbook.ts takeGifts) → 같은 묶음을 두 번 주지 않는다 · 받은 묶음 수는 세이브(P.guestbook.tens)
import { GB } from '../data/guestbook_cfg';
import { gbState, kstWeekKey, takeGifts } from '../world/guestbook';
import { addMail } from '../world/meta';
import { markDirty } from '../world/state';
import { vis } from '../world/visual';
import { myGuestbook } from './guestbook';
import { online } from './server';
import { track } from './telemetry';

/** 마지막으로 받은 서버 누적 좋아요 (빨간 점) */
export const gbCache = { total: 0, at: 0 };

export async function pollGuestbook(now = Date.now(), force = false): Promise<void> {
  if (!vis('guestbook') || !online()) return;
  if (!force && now - gbCache.at < GB.pollMin * 60000) return;
  gbCache.at = now;
  const b = await myGuestbook(1);
  if (!b) return;
  gbCache.total = b.total;
  const gifts = takeGifts(gbState(), b.total, kstWeekKey(now));
  if (!gifts.length) return;
  for (const r of gifts)
    addMail({
      from: 'system',
      title: '💌 방명록 선물',
      body: `이웃들이 내 마을에 좋아요를 ${GB.giftEvery}개 더 남겼어요! 고마운 마음을 담은 작은 선물이에요.`,
      reward: r.deco ? { deco: r.deco } : { dust: r.dust ?? 0 },
    });
  track('gb_gift', { n: gifts.length, total: b.total });
  markDirty();
}
