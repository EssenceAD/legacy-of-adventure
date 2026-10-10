// 채팅: 화면 아래 2줄이 흘러가고, 누르면 채팅 창 (입력은 내 화면에만 추가).
// 지금 흘러가는 건 [소문] — 마을 사람(NPC)의 가짜 수다. 실유저 채팅([세계])이 붙어도 헷갈리지 않게
// 말머리·글자색을 따로 하고 이름 옆에 '마을 사람'을 붙인다. 문장은 data/chat_pool.json.
import { CLASSES, GUEST_KINDS } from '../data/classes';
import { CONFIG } from '../data/config';
import { HEROES } from '../data/heroes';
import { REGIONS } from '../data/items';
import { NEIGHBORS } from '../data/neighbors';
import POOL from '../data/chat_pool.json';
import { P } from '../world/state';
import { bossById } from '../data/bosses';
import { LEGENDS } from '../data/legends';
import { net } from '../net';
import { openWin, toast } from './windows';
import { PORTRAITS } from '../engine/assets';
import { getPref, setPref } from '../save/save';
import { block, blocked, me, online, postNotice, recentChat, reportChat, sb, sendChat, subscribeChat, type ChatRow } from '../net/server';

type Channel = '소문' | '세계' | '알림';
interface Msg {
  ch: Channel;
  who: string;
  text: string;
  /** 서버 줄 번호 · 보낸 사람 · 대표 영웅 */
  id?: number;
  uid?: string;
  hero?: string | null;
}

const pool = POOL as unknown as Record<string, unknown>;
/** 아직 없는 기능(랭킹 — 2차 서버) 이야기는 뺀다 */
const SOON = /랭킹/;
const ok = (s: string) => !SOON.test(s);
const lines = (k: string) => ((pool[k] as string[] | undefined) ?? []).filter(ok);
const GENERAL = [...lines('일상'), ...lines('파밍'), ...lines('영웅'), ...lines('거래·질문'), ...lines('드립')];
const SPEAKERS = (pool['화자'] as string[]) ?? ['마을 사람'];
const THREADS = ((pool['스레드'] as [string, string][][]) ?? []).filter((t) => t.every(([, s]) => ok(s)));
const pick = <T>(a: T[]) => a[(Math.random() * a.length) | 0];

/** 시간대·계절·요일에 맞는 줄 (현실 시각 기준) */
function timely(): string[] {
  const d = new Date();
  const h = d.getHours();
  const slot = h < 5 ? '새벽' : h < 11 ? '아침' : h < 17 ? '점심' : h < 22 ? '저녁' : '새벽';
  const m = d.getMonth() + 1;
  const season = m <= 2 || m === 12 ? '겨울' : m <= 5 ? '봄' : m <= 8 ? '여름' : '가을';
  const day = '일월화수목금토'[d.getDay()];
  const get = (k: string, sub: string) => ((pool[k] as Record<string, string[]>)?.[sub] ?? []).filter(ok);
  return [...get('시간대', slot), ...get('계절', season), ...get('요일', day)];
}

/** {영웅}·{여관}… 을 게임 데이터로 채운다 */
function fill(s: string): string {
  const met = HEROES.filter((h) => P.dex.heroes[h.id]?.appeared);
  const item = P.bag.length ? pick(P.bag).name : '이끼 낀 검';
  return s
    .replace(/\{영웅\}/g, () => pick(met.length ? met : HEROES).name)
    .replace(/\{여관\}/g, () => pick(NEIGHBORS).name)
    .replace(/\{지역\}/g, () => pick(REGIONS).name)
    .replace(/\{직업\}/g, () => CLASSES[pick([...GUEST_KINDS])].name)
    .replace(/\{아이템\}/g, () => item)
    .replace(/\{숫자\}/g, () => String(2 + ((Math.random() * 40) | 0)))
    .replace(/\{보스\}/g, () => bossById(P.raid.bossId)?.name ?? '멧돼지 왕');
}

const log: Msg[] = [];
/** 같은 줄은 한동안 다시 안 나오게 */
const recent: string[] = [];
function fresh(list: string[]): string {
  const c = list.filter((s) => !recent.includes(s));
  const s = pick(c.length ? c : list);
  recent.push(s);
  if (recent.length > 40) recent.shift();
  return s;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** [세계] 이름표 옆 대표 영웅 초상화 (작게) */
const face = (key?: string | null) => (key && PORTRAITS[key] ? `<img class="chface" src="${PORTRAITS[key]}" alt="">` : '');
const line = (m: Msg) =>
  m.ch === '알림'
    ? `<span class="ch ch-notice">[알림]</span> <b class="notice">${esc(m.text)}</b>`
    : m.ch === '소문'
    ? `<span class="ch ch-rumor">[소문]</span> <b class="rumor-who">${esc(m.who)}</b><small class="npc">마을 사람</small> <span class="rumor">${esc(m.text)}</span>`
    : `<span class="ch">[세계]</span> ${face(m.hero)}<b>${esc(m.who)}</b>: ${esc(m.text)}`;

/** 마지막 [세계] 말이 온 시각 — 2분 넘게 조용해야 [소문]이 흐른다 */
let lastWorld = 0;
const seen = new Set<number>();

function push(m: Msg) {
  if (m.uid && blocked.has(m.uid)) return;
  if (m.id != null) {
    if (seen.has(m.id)) return;
    seen.add(m.id);
  }
  if (m.ch === '세계') lastWorld = Date.now();
  log.push(m);
  if (log.length > 80) log.shift();
  const el = document.getElementById('chatlog')!;
  const d = document.createElement('div');
  d.innerHTML = line(m);
  el.appendChild(d);
  while (el.children.length > 2) el.firstChild!.remove();
  const full = document.querySelector('.chatfull');
  if (full) {
    const r = document.createElement('div');
    r.innerHTML = line(m);
    r.dataset.i = String(log.length - 1);
    full.appendChild(r);
    full.scrollTop = full.scrollHeight;
  }
}

const rnd = () => CONFIG.chat.minMs + Math.random() * (CONFIG.chat.maxMs - CONFIG.chat.minMs);
const rumorOn = () => !getPref<boolean>('rumorOff', false);
export function setRumor(on: boolean) {
  setPref('rumorOff', !on);
}
export const rumorEnabled = rumorOn;

/** 다음 소문: [세계]가 조용할 때만. 일부는 여러 줄짜리 짧은 대화 */
function next() {
  const C = CONFIG.chat;
  if (!rumorOn() || Date.now() - lastWorld < CONFIG.cloud.rumorQuietMs) {
    setTimeout(next, rnd());
    return;
  }
  if (THREADS.length && Math.random() < C.threadChance) {
    const t = pick(THREADS);
    t.forEach(([who, text], i) => setTimeout(() => push({ ch: '소문', who, text: fill(text) }), i * C.threadGapMs));
    setTimeout(next, t.length * C.threadGapMs + rnd());
    return;
  }
  // 소문 열린 전설 영웅이 있으면 가끔 그 힌트
  const heard = LEGENDS.filter((d) => P.legends[d.key]?.st === 'rumor');
  if (heard.length && Math.random() < 0.15) {
    push({ ch: '소문', who: '소문 수집가', text: pick(heard).hint });
    setTimeout(next, rnd());
    return;
  }
  const extra = timely();
  const src = extra.length && Math.random() < 0.3 ? extra : GENERAL;
  push({ ch: '소문', who: pick(SPEAKERS), text: fill(fresh(src)) });
  setTimeout(next, rnd());
}

/** [소문] 한 줄 바로 (전설 소문이 처음 열릴 때) */
export function rumorNow(text: string) {
  if (rumorOn()) push({ ch: '소문', who: '소문 수집가', text });
}

const fromRow = (r: ChatRow): Msg =>
  r.channel === 'notice'
    ? { ch: '알림', who: '알림', text: r.body, id: r.id }
    : { ch: '세계', who: r.nickname, text: r.body, id: r.id, uid: r.user_id ?? undefined, hero: r.rep_hero };

export async function initChat() {
  // 로그인 안 했을 때의 [알림](내 마을 일)은 net.chat에서 온다
  net.chat.subscribe((m) => push({ ch: m.ch, who: m.who, text: m.text }));
  document.getElementById('chatlog')!.onclick = openChat;
  if (rumorOn()) {
    push({ ch: '소문', who: pick(SPEAKERS), text: fill(fresh(GENERAL)) });
    push({ ch: '소문', who: pick(SPEAKERS), text: fill(fresh(GENERAL)) });
  }
  setTimeout(next, rnd());
  // [세계]·[알림]: 서버 최근 50줄 + 실시간
  if (!sb) return;
  try {
    for (const r of await recentChat(50)) {
      const m = fromRow(r);
      push(m);
      // 지난 기록은 '조용함' 판정에 안 넣는다
      if (m.ch === '세계') lastWorld = new Date(r.created_at).getTime();
    }
  } catch {
    /* 서버가 안 되면 소문만 */
  }
  subscribeChat((r) => push(fromRow(r)));
}

function openChat() {
  openWin(
    '채팅',
    `<p class="note">[세계] 실제 유저 · [소문] 마을 사람들의 수다(실제 유저 아님) · [알림] 소식${online() ? ' · 남의 말을 누르면 차단·신고' : ''}</p>
    <div class="chatfull">${log.map((m, i) => `<div data-i="${i}">${line(m)}</div>`).join('')}</div>
    <form class="chatin" id="chatf"><input id="chatv" maxlength="100" placeholder="${online() ? '[세계]에 말하기 (100자)' : '로그인하면 [세계] 채팅을 쓸 수 있어요'}" autocomplete="off"><button>전송</button></form>
    <label class="tog"><input type="checkbox" id="rumorT" ${rumorOn() ? 'checked' : ''}> [소문] 보기</label>`,
  );
  const list = document.querySelector('.chatfull') as HTMLElement;
  list.scrollTop = list.scrollHeight;
  list.onclick = async (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    const m = row && log[+row.dataset.i!];
    if (!m || m.ch !== '세계' || !m.uid || !online() || m.uid === me.profile?.id) return;
    const act = prompt(`${m.who}님의 말: "${m.text}"\n1 = 차단(이 사람 말 안 보기)  2 = 신고`, '');
    if (act === '1') {
      await block(m.uid);
      toast(`${m.who}님을 차단했어요`);
      openChat();
    } else if (act === '2' && m.id != null) toast((await reportChat(m.id)) ? '신고했어요. 운영자가 확인할게요' : '신고하지 못했어요');
  };
  (document.getElementById('rumorT') as HTMLInputElement).onchange = (e) => setRumor((e.target as HTMLInputElement).checked);
  (document.getElementById('chatf') as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    const inp = document.getElementById('chatv') as HTMLInputElement;
    const v = inp.value.trim();
    if (!v) return;
    if (!online()) return toast('로그인하면 [세계] 채팅을 쓸 수 있어요 (메뉴 → 계정)');
    const err = await sendChat(v.slice(0, 100));
    if (err) return toast(err);
    inp.value = '';
  };
}

/** [알림]: 로그인했으면 서버가 문장을 만들어 모두에게 (실시간으로 돌아온다), 아니면 내 화면에만 */
export function announce(text: string, kind?: 'legend' | 'boss_kill' | 'rank1', arg?: string) {
  if (online() && kind) void postNotice(kind, arg ?? '');
  else net.chat.announce(text);
}
