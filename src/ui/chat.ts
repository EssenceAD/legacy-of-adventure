// 채팅: 화면 아래 2줄이 흘러가고, 누르면 채팅 창 (입력은 내 화면에만 추가).
// 지금 흘러가는 건 [소문] — 마을 사람(NPC)의 가짜 수다. 실유저 채팅([세계])이 붙어도 헷갈리지 않게
// 말머리·글자색을 따로 하고 이름 옆에 '마을 사람'을 붙인다. 문장은 data/chat_pool.json.
import { CLASSES, GUEST_KINDS } from '../data/classes';
import { CONFIG } from '../data/config';
import { HEROES } from '../data/heroes';
import { REGIONS } from '../data/items';
import { NEIGHBORS } from '../data/neighbors';
import POOL from '../data/chat_pool.json';
import { P, S } from '../world/state';
import { openWin } from './windows';

type Channel = '소문' | '세계';
interface Msg {
  ch: Channel;
  who: string;
  text: string;
}

const pool = POOL as unknown as Record<string, unknown>;
/** 아직 없는 기능(토벌·주간 보스·랭킹) 이야기는 3단계 전까지 뺀다 */
const SOON = /토벌|보스|랭킹|주간/;
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
    .replace(/\{숫자\}/g, () => String(2 + ((Math.random() * 40) | 0)));
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
const line = (m: Msg) =>
  m.ch === '소문'
    ? `<span class="ch ch-rumor">[소문]</span> <b class="rumor-who">${esc(m.who)}</b><small class="npc">마을 사람</small> <span class="rumor">${esc(m.text)}</span>`
    : `<span class="ch">[세계]</span> <b>${esc(m.who)}</b>: ${esc(m.text)}`;

function push(m: Msg) {
  log.push(m);
  if (log.length > 60) log.shift();
  const el = document.getElementById('chatlog')!;
  const d = document.createElement('div');
  d.innerHTML = line(m);
  el.appendChild(d);
  while (el.children.length > 2) el.firstChild!.remove();
  const full = document.querySelector('.chatfull');
  if (full) {
    const r = document.createElement('div');
    r.innerHTML = line(m);
    full.appendChild(r);
    full.scrollTop = full.scrollHeight;
  }
}

const rnd = () => CONFIG.chat.minMs + Math.random() * (CONFIG.chat.maxMs - CONFIG.chat.minMs);

/** 다음 소문: 일부는 여러 줄짜리 짧은 대화 */
function next() {
  const C = CONFIG.chat;
  if (THREADS.length && Math.random() < C.threadChance) {
    const t = pick(THREADS);
    t.forEach(([who, text], i) => setTimeout(() => push({ ch: '소문', who, text: fill(text) }), i * C.threadGapMs));
    setTimeout(next, t.length * C.threadGapMs + rnd());
    return;
  }
  const extra = timely();
  const src = extra.length && Math.random() < 0.3 ? extra : GENERAL;
  push({ ch: '소문', who: pick(SPEAKERS), text: fill(fresh(src)) });
  setTimeout(next, rnd());
}

export function initChat() {
  push({ ch: '소문', who: pick(SPEAKERS), text: fill(fresh(GENERAL)) });
  push({ ch: '소문', who: pick(SPEAKERS), text: fill(fresh(GENERAL)) });
  setTimeout(next, rnd());
  document.getElementById('chatlog')!.onclick = openChat;
}

function openChat() {
  openWin(
    '채팅',
    `<p class="note">[소문]은 마을 사람들의 수다예요 (실제 유저 아님)</p><div class="chatfull">${log.map((m) => `<div>${line(m)}</div>`).join('')}</div><form class="chatin" id="chatf"><input id="chatv" maxlength="60" placeholder="메시지 입력" autocomplete="off"><button>전송</button></form>`,
  );
  const list = document.querySelector('.chatfull')!;
  list.scrollTop = list.scrollHeight;
  (document.getElementById('chatf') as HTMLFormElement).onsubmit = (e) => {
    e.preventDefault();
    const inp = document.getElementById('chatv') as HTMLInputElement;
    const v = inp.value.trim();
    if (!v) return;
    push({ ch: '세계', who: S.innName || '나', text: v });
    inp.value = '';
  };
}
