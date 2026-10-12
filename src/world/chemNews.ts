// 핫픽스 12 §6: 케미 알림 다이어트 — 마을 만남은 조용히(♥ 말풍선만) · 대화창은 원정을 같이 다녀와서 3·5단계·처음 발견일 때만,
//  하루 최대 3번 · 나머지는 「케미 소식」(장부 탭 · 빨간 점) · 설정 「전부 / 중요한 것만(기본) / 끄기」 · 5단계 보상(전용 합동 오의 · 칭호)
import { orderPair, pairById, type ChemPair } from '../data/chem';
import { getPref, setPref } from '../save/save';
import { track } from '../net/telemetry';
import { pairOf, type BondGain } from './chem';
import { queueEvent } from './events';
import { today } from './progress';
import { markDirty, P, uiHooks, type Actor } from './state';

export type ChemNotice = 'all' | 'important' | 'off';
export const CHEM_NOTICE_NAME: Record<ChemNotice, string> = { all: '전부', important: '중요한 것만', off: '끄기' };
export const chemNoticeMode = (): ChemNotice => getPref<ChemNotice>('chemNotice', 'important');
let quietN = 0;
/** HOTFIX18 §3: 예전 설정이 「전부」로 남은 기기는 한 번 「중요만」으로 (설정에서 다시 켤 수 있다) · 바꿨으면 true */
export function migrateChemNotice(): boolean {
  if (getPref<boolean>('chemFix18', false)) return false;
  setPref('chemFix18', true);
  if (getPref<string>('chemNotice', 'important') !== 'all') return false;
  setPref('chemNotice', 'important');
  return true;
}
/** 하루에 대화창으로 뜨는 케미 이벤트 최대 */
export const CHEM_TALKS_PER_DAY = 3;
const NEWS_KEEP = 40;

const news = () => P.chemNews;
/** 안 읽은 케미 소식 수 (빨간 점) */
export const chemUnread = () => news().unread;
export function readChemNews() {
  if (!news().unread) return;
  news().unread = 0;
  markDirty();
}
function pushNews(text: string) {
  const n = news();
  n.list.unshift({ t: Date.now(), text });
  n.list.length = Math.min(n.list.length, NEWS_KEEP);
  n.unread++;
  markDirty();
}
/** 오늘 대화창을 하나 더 띄워도 되나 (띄우면 센다) */
function takeTalkSlot(): boolean {
  const n = news();
  if (n.day !== today()) {
    n.day = today();
    n.shown = 0;
  }
  if (n.shown >= CHEM_TALKS_PER_DAY) return false;
  n.shown++;
  return true;
}

const lineOf = (g: BondGain) => (g.discovered && !g.levelUp ? `새 케미 「${g.pair.name}」 — ${g.a.name} & ${g.b.name}` : `♥ ${g.pair.name} ${g.levelUp}단계 — ${g.a.name} & ${g.b.name}`);

/**
 * 친밀도가 올랐다 — 어디서(마을·원정) 올랐는지에 따라 대화창 / 소식만.
 * @returns 대화창을 띄웠나
 */
export function notifyChem(g: BondGain, from: 'town' | 'party'): boolean {
  if (!g.discovered && !g.levelUp) return false;
  if (g.levelUp === 5) unlock5(g.pair);
  const mode = chemNoticeMode();
  const important = g.discovered || g.levelUp === 3 || g.levelUp === 5;
  const want = mode === 'all' ? from === 'party' || important : mode === 'important' ? from === 'party' && important : false;
  if (!want || (mode !== 'all' && !takeTalkSlot())) {
    pushNews(lineOf(g));
    // HOTFIX18 §3: 대화창 없이 소식에만 쌓이는 줄은 50개마다 한 번 (하루 600건이 넘던 기록)
    if (++quietN >= 50) {
      track('chem_news', { n: quietN, mode });
      quietN = 0;
    }
    return false;
  }
  chemTalk(g.a, g.b, g.levelUp, g.discovered);
  track('chem_notice', { how: 'talk', from, lv: g.levelUp ?? 0, mode });
  return true;
}

/** 대화창 — 처음 발견이면 마주친 대사, 단계 오름이면 그 단계 대화 */
export function chemTalk(a: Actor, b: Actor, lv: number | null, discovered = false) {
  const pair = pairOf(a, b);
  if (!pair) return;
  const [f, s] = orderPair(pair, a, b);
  const t = lv ? pair.talks[lv - 2] : null;
  const lines: [string, string][] = [];
  if (discovered && !lv) lines.push(['narr', `새 케미 발견! 「${pair.name}」 ${f.name} & ${s.name}`], ['@' + f.id, pair.meet[0]], ['@' + s.id, pair.meet[1]]);
  else if (t) {
    lines.push(['narr', `「${pair.name}」 ${f.name} & ${s.name} — 친밀도 ${lv}단계!`], ['@' + f.id, t[0]], ['@' + s.id, t[1]]);
    if (lv === 5) lines.push(['narr', `5단계 보상: 둘이 같이 싸우면 전용 합동 오의 「${ultName5(pair)}」 · 칭호 「${title5(pair)}」`]);
  }
  if (lines.length) queueEvent(() => uiHooks.talk(lines));
}

// ───────── 5단계 보상 ─────────
/** 짝 전용 합동 오의 이름 */
export const ultName5 = (p: ChemPair) => `${p.name} · 합동 오의`;
/** 짝 전용 칭호 */
export const title5 = (p: ChemPair) => `${p.name} ♥5`;
/** 5단계를 찍은 짝 (손님이 떠나도 칭호는 남는다) */
function unlock5(p: ChemPair) {
  if (P.chem5.includes(p.id)) return;
  P.chem5.push(p.id);
  markDirty();
  uiHooks.toast(`케미 5단계! 칭호 「${title5(p)}」 · 전용 합동 오의가 열렸어요`);
}
export const chem5Titles = () => P.chem5.map((id) => pairById(id)).filter((p): p is ChemPair => !!p);
