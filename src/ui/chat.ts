// 채팅: 화면 아래 2줄이 흘러가고, 누르면 채팅 창 (입력은 내 화면에만 추가).
// 지금은 가짜 데이터 — 나중에 실시간 채팅으로 바꾼다.
import { CONFIG } from '../data/config';
import { S } from '../world/state';
import { openWin } from './windows';

type Msg = [channel: '세계' | '거래' | '길드', who: string, text: string];

const CHAT: Msg[] = [
  ['세계', '피핀아빠', '온천 지었더니 기분 수치 미쳤음'],
  ['세계', '엘린느', '달빛 쉼터 구경 오세요~ 지붕 보라색임'],
  ['거래', '두린7', '심연의 반지 삽니다 귓주세요'],
  ['세계', '모험왕', '드워프랑 도적 케미 대사 뭐임 ㅋㅋㅋ'],
  ['길드', '별빛', '오늘 밤 던전 같이 가실 분'],
];
/** 내가 쓴 말 (이 화면에만) */
const mine: Msg[] = [];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const line = (c: Msg) => `<span class="ch ch-${c[0]}">[${c[0]}]</span> <b>${esc(c[1])}</b>: ${esc(c[2])}`;

let ci = 0;
function tick() {
  const el = document.getElementById('chatlog')!;
  const d = document.createElement('div');
  d.innerHTML = line(CHAT[ci++ % CHAT.length]);
  el.appendChild(d);
  while (el.children.length > 2) el.firstChild!.remove();
}

export function initChat() {
  tick();
  tick();
  setInterval(tick, CONFIG.ui.chatTickMs);
  document.getElementById('chatlog')!.onclick = openChat;
}

function openChat() {
  openWin(
    '채팅',
    `<div class="chatfull">${[...CHAT, ...mine].map((c) => `<div>${line(c)}</div>`).join('')}</div><form class="chatin" id="chatf"><input id="chatv" maxlength="60" placeholder="메시지 입력" autocomplete="off"><button>전송</button></form>`,
  );
  const list = document.querySelector('.chatfull')!;
  list.scrollTop = list.scrollHeight;
  (document.getElementById('chatf') as HTMLFormElement).onsubmit = (e) => {
    e.preventDefault();
    const inp = document.getElementById('chatv') as HTMLInputElement;
    const v = inp.value.trim();
    if (!v) return;
    const m: Msg = ['세계', S.innName || '나', v];
    mine.push(m);
    const d = document.createElement('div');
    d.innerHTML = line(m);
    list.appendChild(d);
    list.scrollTop = list.scrollHeight;
    inp.value = '';
  };
}
