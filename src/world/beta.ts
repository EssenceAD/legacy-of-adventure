// 베타 6장: 저장 v6 마이그레이션 — 마을이 처음 돌아갈 때 한 번
//  · 이미 성립한 어울림은 「발견」 처리 (연출 없이) · 보상은 우편 한 통으로
//  · 장부: 이미 끝낸 장에 끼워 넣은 베타 임무는 받은 걸로 · 지금 임무 번호를 다시 맞춘다
import { CHAPTERS, MISSIONS } from '../data/guide';
import { harmonyById } from '../data/harmony';
import { checkDiscover, harmonyGold } from './harmony';
import { addMail } from './meta';
import { addRep } from './progress';
import { CONFIG } from '../data/config';
import { markDirty, P } from './state';

/** 장부 임무 번호를 받은 목록에 맞춘다 (임무가 끼워 넣어져도 어긋나지 않게) */
export function syncGuideIdx() {
  const i = MISSIONS.findIndex((m) => !P.guide.claimed.includes(m.id));
  P.guide.idx = i < 0 ? MISSIONS.length : i;
}

export function betaMigrate() {
  if (!P.harmony.migrate) return;
  P.harmony.migrate = false;
  for (const c of CHAPTERS) {
    const doneBefore = c.missions.filter((m) => !m.beta).every((m) => P.guide.claimed.includes(m.id));
    if (doneBefore) for (const m of c.missions) if (m.beta && !P.guide.claimed.includes(m.id)) P.guide.claimed.push(m.id);
  }
  syncGuideIdx();
  const fresh = checkDiscover(true);
  if (fresh.length) {
    const gold = fresh.reduce((s, x) => s + harmonyGold(x.id), 0);
    addRep(CONFIG.harmony.rep * fresh.length);
    addMail({
      from: 'system',
      title: `어울림 ${fresh.length}개 발견`,
      body: `이미 마을에 어울림이 있었어요: ${fresh.map((s) => `「${harmonyById(s.id).name}」`).join(' ')} · 평판 +${CONFIG.harmony.rep * fresh.length}`,
      reward: { gold },
    });
  }
  markDirty();
}
