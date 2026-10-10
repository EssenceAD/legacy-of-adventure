// 아래에서 올라오는 창: 건설·땅·손님·건물·캐릭터·장부·메뉴·계정·제보
import { CATALOG, def, INSIDE_TEXT, ROOFS, type Kind } from '../data/catalog';
import { CHEM, CLASSES, type ClassKey } from '../data/classes';
import { CONFIG } from '../data/config';
import { IMG, PORTRAITS } from '../engine/assets';
import { canvas, P } from '../engine/pixel';
import { doingText } from '../world/actors';
import { S, world, type Actor, type Building } from '../world/state';
import { buildableKinds } from '../world/town';
import * as game from '../game';
import { addReport } from '../save/save';
import { talk } from './dialogue';
import { startPlace } from './hud';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string) => [...document.querySelectorAll(s)] as T[];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmt = (n: number) => n.toLocaleString('ko-KR');

export function openWin(title: string, html: string, cls = '') {
  $('#winT').textContent = title;
  $('#winB').innerHTML = html;
  $('#win').className = 'win px on ' + cls;
  $('#scrim').classList.add('on');
}
export function closeWin() {
  $('#win').classList.remove('on');
  $('#scrim').classList.remove('on');
}
export const isWinOpen = () => $('#win').classList.contains('on');

let toastTimer = 0;
export function toastHtml(html: string, ms: number = CONFIG.ui.toastMs) {
  const e = $('#toast');
  e.innerHTML = html;
  e.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => e.classList.remove('on'), ms);
}
export const toast = (text: string) => toastHtml(`<span>${esc(text)}</span>`);

export function initWindows() {
  $('#scrim').onclick = closeWin;
  $('#winX').onclick = closeWin;
}

// ───────── 건설 ─────────

/** 건설 목록 썸네일: 부팅 직후 한 번 만들어 둔다 (창을 열 때 만들면 열리는 순간 끊긴다) */
const THUMBS: Partial<Record<Kind, string>> = {};
const THUMB_W = 96;
const THUMB_H = 56;

function fireThumb() {
  const c = canvas(24, 20);
  const p = P(c.getContext('2d')!);
  p.rect(6, 14, 12, 3, '#7a7480');
  p.rect(7, 12, 10, 2, '#6a4428');
  for (let i = -3; i <= 3; i++) for (let j = 0; j < 6 - Math.abs(i); j++) p.px(12 + i, 11 - j, j < 2 ? '#ffe08a' : j < 4 ? '#ff9a3c' : '#e0482e');
  return c;
}

/** 그림을 썸네일 칸 크기에 맞춰 정수 배율로(도트가 뭉개지지 않게) 미리 그려 둔다 */
export function buildThumbs() {
  for (const k of Object.keys(CATALOG) as Kind[]) {
    const sp = CATALOG[k].sprite;
    const src: CanvasImageSource & { width: number; height: number } = sp ? IMG[sp] : fireThumb();
    if (!src) continue;
    const s = Math.max(1, Math.floor(Math.min((THUMB_W * 2) / src.width, (THUMB_H * 2) / src.height)));
    const c = canvas(src.width * s, src.height * s);
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    THUMBS[k] = c.toDataURL();
    // 미리 디코드해 두면 창을 여는 프레임에서 이미지 풀기가 일어나지 않는다
    const im = new Image();
    im.src = THUMBS[k]!;
    im.decode?.().catch(() => {});
    decoded.push(im);
  }
}
/** 디코드된 썸네일을 붙잡아 둔다 (가비지로 버려지지 않게) */
const decoded: HTMLImageElement[] = [];
const thumb = (k: Kind) => THUMBS[k] ?? '';

export function openBuild() {
  if (S.visiting) return;
  const items = buildableKinds()
    .map((k) => {
      const d = def(k);
      const locked = d.unlock > S.land;
      const poor = S.gold < d.cost;
      const sub = locked ? `<small class="lock">땅 ${d.unlock}단계</small>` : `<small>${fmt(d.cost)} G</small>`;
      return `<button data-k="${k}" class="${locked ? 'locked' : ''}" ${poor && !locked ? 'disabled' : ''}><img src="${thumb(k)}" alt=""><b>${d.name}</b>${sub}</button>`;
    })
    .join('');
  openWin('건설', `<p class="sub">원하는 자리에 지어요 · 금화 <b class="g">${fmt(S.gold)}</b></p><div class="cat">${items}</div>`);
  $$('.cat button').forEach(
    (b) =>
      (b.onclick = () => {
        const k = b.dataset.k as Kind;
        if (def(k).unlock > S.land) {
          toast(`땅을 ${def(k).unlock}단계까지 넓히면 지을 수 있어요`);
          return;
        }
        closeWin();
        startPlace(k);
      }),
  );
}

// ───────── 땅 넓히기 ─────────

export function openLand() {
  if (S.visiting) return;
  const rows = CONFIG.land
    .map((L, i) => {
      const st = i + 1;
      const right = st === S.land ? '현재' : st < S.land ? '완료' : `${fmt(L.cost)}G`;
      return `<button class="stp ${st === S.land ? 'cur' : ''}" data-l="${st}" ${st !== S.land + 1 ? 'disabled' : ''}><span style="grid-column:1/3"><b>${st}단계 · ${L.size}칸</b><small>${L.opens}</small></span><em>${right}</em></button>`;
    })
    .join('');
  const note = S.land >= CONFIG.land.length ? '최대 크기예요!' : '한 단계씩 넓힐 수 있어요';
  openWin('땅 넓히기', `<p class="sub">울타리를 밀어서 마을 땅을 넓혀요 · 최대 ${CONFIG.land.length}단계</p><div class="steps">${rows}</div><p class="note">${note}</p>`);
  $$('.stp').forEach(
    (b) =>
      (b.onclick = () => {
        const l = +b.dataset.l!;
        if (l !== S.land + 1) return;
        const cost = CONFIG.land[l - 1].cost;
        if (S.gold < cost) {
          toast(`금화가 모자라요 (${fmt(cost)}G 필요)`);
          return;
        }
        closeWin();
        game.expandLand(l);
      }),
  );
}

// ───────── 손님 ─────────

function bar(label: string, v: number, color: string) {
  return `<div class="bar"><span>${label}</span><i><b style="width:${v}%;background:${color}"></b></i><em>${v}</em></div>`;
}
const portrait = (k: string) => PORTRAITS[k] || '';

export function openGuests() {
  const guests = world.actors.filter((a) => !a.role);
  if (!guests.length) return;
  openWin(
    `손님 ${guests.length}명`,
    `<div class="glist">${guests
      .map((a, i) => `<button data-i="${i}"><img src="${portrait(a.kind)}" alt=""><span>${esc(a.name)} · Lv.${a.lvl} ${CLASSES[a.kind].name}</span><em>${doingText(a)}</em></button>`)
      .join('')}</div>`,
  );
  $$('.glist button').forEach((b) => (b.onclick = () => showActor(guests[+b.dataset.i!])));
}

export function showActor(a: Actor) {
  const pals = CHEM.filter((x) => x[0] === a.kind || x[1] === a.kind).map((x) => (x[0] === a.kind ? x[1] : x[0]));
  const chips = pals.map((p) => `<span class="chip"><img src="${portrait(p)}" alt="">${CLASSES[p as ClassKey].name}와 케미</span>`).join('');
  openWin(
    a.name,
    `<div class="who"><img class="port" src="${portrait(a.kind)}" alt=""><div><p class="sub">Lv.${a.lvl} ${CLASSES[a.kind].name} · ${doingText(a)}</p>${bar('체력', a.hp, '#e0544a')}${bar('포만', a.food, '#e8a23a')}${bar('기분', a.mood, '#6fb04b')}</div></div><div class="chips">${chips}<span class="chip q">??? 미발견</span></div>`,
  );
}

// ───────── 건물 안 엿보기 ─────────

export function showObj(o: Building) {
  const d = def(o.kind);
  const canUp = !!d.up && o.sprite !== d.up.sprite;
  const act = d.act;
  const doing = (act && INSIDE_TEXT[act]) || '머무는 중';
  const inside = o.inside.map((a) => `<div><img src="${portrait(a.kind)}" alt="">${esc(a.name)} · ${doing}</div>`).join('') || '<div>지금은 비어 있어요</div>';
  const showInside = act && !['train', 'farm', 'fire', 'dungeon'].includes(act);
  const roofs =
    d.roofable && !S.visiting
      ? `<p class="sub" style="margin-top:10px">지붕 색</p><div class="roofs">${ROOFS.map(
          ([n, h]) => `<button data-h="${h}" title="${n}" aria-label="${n}" class="${o.hue === h ? 'on' : ''}" style="background:${h == null ? '#8a8a96' : `hsl(${h} 55% 45%)`}"></button>`,
        ).join('')}</div>`
      : '';
  const up = canUp && !S.visiting ? `<button class="bigbtn" id="upB">레벨업 · 더 큰 건물로 (${fmt(d.up!.cost)} G)</button>` : '';
  openWin(
    d.name + (o.lvl > 1 ? ' Lv.' + o.lvl : ''),
    `<p class="sub">${d.desc}</p>${showInside ? `<b class="g">안에 있는 손님</b><div class="inside">${inside}</div>` : ''}${roofs}${up}`,
  );
  $$('.roofs button').forEach(
    (b) =>
      (b.onclick = () => {
        game.setRoof(o, b.dataset.h === 'null' ? null : +b.dataset.h!);
        $$('.roofs button').forEach((x) => x.classList.toggle('on', x === b));
      }),
  );
  const ub = document.getElementById('upB');
  if (ub) ub.onclick = () => game.upgrade(o);
}

// ───────── 장부: 오늘의 수입 ─────────

export function openLedger() {
  const L = S.ledger;
  const rows: [string, number, string][] = [
    ['숙박', L.sleep, '#e8a23a'],
    ['주점', L.drink, '#e8a23a'],
    ['대장간', L.forge, '#e8a23a'],
    ['온천', L.bath, '#e8a23a'],
    ['던전', L.dungeon, '#9a7aff'],
  ];
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const total = rows.reduce((s, r) => s + r[1], 0);
  const bars = rows
    .map(([n, v, c]) => `<div class="bar"><span>${n}</span><i><b style="width:${Math.round((v / max) * 100)}%;background:${c}"></b></i><em>${fmt(v)}</em></div>`)
    .join('');
  openWin('장부', `<p class="sub">${S.day}일차 · 오늘의 수입</p>${bars}<p class="ledger-total">합계 ${fmt(total)} G</p><p class="note">날이 밝으면 새 장부가 시작돼요</p>`);
}

// ───────── 메뉴·계정 ─────────

export function openMenu() {
  openWin('메뉴', `<div class="menu"><button id="mIntro">오프닝 다시 보기</button><button id="mAcc">계정 · 클라우드 저장</button><button id="mTitle">타이틀로</button></div>`);
  $('#mIntro').onclick = () => {
    closeWin();
    game.replayOpening();
  };
  $('#mTitle').onclick = () => {
    closeWin();
    game.toTitle();
  };
  $('#mAcc').onclick = () =>
    openWin(
      '계정 · 클라우드',
      `<p class="sub">아이디로 로그인하면 폰·PC 어디서든 이어서 해요. 마을은 1분마다, 그리고 앱을 닫을 때 자동으로 클라우드에 저장돼요.</p><div class="acc"><div>아이디<b>(준비 중)</b></div><div>마지막 저장<b>이 기기 · 자동 저장</b></div><div>연결 기기<b>이 기기</b></div></div><p class="note">로그인·클라우드 저장은 다음 단계에서 열려요. 지금은 이 기기에만 저장돼요.</p>`,
    );
}

// ───────── 우체부 모모: 제보 편지 ─────────

export function openReport() {
  talk(
    [
      ['post', '안녕하세요! 우체부 모모예요.'],
      ['post', '버그나 아쉬운 점이 있으면 편지로 남겨 주세요. 개발자님께 꼭 전해 드릴게요!'],
    ],
    () => {
      openWin(
        '모모에게 편지 쓰기',
        `<form class="report" id="rep"><label>종류<select id="rk"><option>버그 제보</option><option>개선 건의</option><option>칭찬</option></select></label><label>내용<textarea id="rt" rows="4" maxlength="300" placeholder="예) 온천 옆에서 손님이 길을 잃었어요"></textarea></label><button>편지 보내기</button></form>`,
      );
      ($('#rep') as HTMLFormElement).onsubmit = (e) => {
        e.preventDefault();
        const text = ($('#rt') as HTMLTextAreaElement).value.trim();
        if (!text) {
          toast('내용을 적어 주세요');
          return;
        }
        addReport({ kind: ($('#rk') as HTMLSelectElement).value, text, at: Date.now() });
        closeWin();
        talk([['post', '편지 잘 받았어요! 답장은 공지에서 확인해 주세요~']]);
      };
    },
  );
}
