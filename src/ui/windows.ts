// 아래에서 올라오는 창: 건설·땅·손님·건물·캐릭터·장부·메뉴·계정·제보
import { CATALOG, def, INSIDE_TEXT, ROOFS, type Kind } from '../data/catalog';
import { CONFIG } from '../data/config';
import { baseKey, FIRE_FRAMES, IMG, PORTRAITS } from '../engine/assets';
import { canvas } from '../engine/pixel';
import { stars } from '../world/progress';
import { S, type Building } from '../world/state';
import { buildableKinds, maxLevel, nextLevelCost } from '../world/town';
import { openBoard } from './expedition';
import { openGarden, openSmith } from './smith';
import { feature, featureChapter } from '../world/guide';
import { decoLock } from '../world/harmony';
import { online, sendLetter } from '../net/server';
import * as game from '../game';
import { addReport } from '../save/save';
import { talk } from './dialogue';
import { startMove, startPlace } from './hud';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string) => [...document.querySelectorAll(s)] as T[];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmt = (n: number) => n.toLocaleString('ko-KR');

/** 창 제목 → 안내서 쪽 (ui/menu가 채운다): 「?」 버튼 */
export const helpHook = { page: (_title: string): string | null => null, open: (_key: string) => {} };

export function openWin(title: string, html: string, cls = '') {
  $('#winT').textContent = title;
  const hp = helpHook.page(title);
  const hb = $('#winHelp');
  hb.hidden = !hp;
  if (hp) hb.onclick = () => helpHook.open(hp);
  $('#winB').innerHTML = html;
  $('#win').className = 'win px on ' + cls;
  $('#scrim').classList.add('on');
}
const closeHooks: (() => void)[] = [];
/** 창이 닫힌 뒤 (다음 창이 바로 열리면 그 뒤) 부를 것 — 놓치면 안 되는 창(저장 고르기)을 다시 띄울 때 */
export const onWinClose = (f: () => void) => closeHooks.push(f);
export function closeWin() {
  $('#win').classList.remove('on');
  $('#scrim').classList.remove('on');
  setTimeout(() => closeHooks.forEach((f) => f()), 0);
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

/** 꼭 골라야 하는 창(주인 만들기·엔딩 뒤 선택): ✕·바깥 눌러 닫기를 막는다 */
let winLocked = false;
export function setWinLock(v: boolean) {
  winLocked = v;
  $('#winX').hidden = v;
}
const userClose = () => !winLocked && closeWin();

export function initWindows() {
  $('#scrim').onclick = userClose;
  $('#winX').onclick = userClose;
}

// ───────── 건설 ─────────

/** 건설 목록 썸네일: 부팅 직후 한 번 만들어 둔다 (창을 열 때 만들면 열리는 순간 끊긴다) */
const THUMBS: Partial<Record<Kind, string>> = {};
const THUMB_W = 96;
const THUMB_H = 56;

/** 모닥불 썸네일 = campfire.png 1번 프레임 */
const fireThumb = () => FIRE_FRAMES[0] ?? canvas(32, 34);

/** 창 맨 아래에 「옮기기 · 방향」 버튼 (던전처럼 고정된 건물·이웃 마을은 없음) */
export function appendMoveButton(o: Building) {
  if (S.visiting || def(o.kind).fixed || o.build !== undefined) return;
  const b = document.createElement('button');
  b.className = 'bigbtn sm ghost';
  b.id = 'moveB';
  b.textContent = '옮기기 · 방향 바꾸기 ↻';
  b.onclick = () => {
    closeWin();
    startMove(o);
  };
  $('#winB').appendChild(b);
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

const GATED: Partial<Record<Kind, 'smith' | 'garden' | 'cottage'>> = { smith: 'smith', garden: 'garden', cottage: 'cottage' };

export function openBuild() {
  if (S.visiting) return;
  const card = (k: Kind) => {
      const d = def(k);
      // 베타: 어울림 장식 열림 조건
      const dl = decoLock(k);
      const noStar = (d.stars ?? 0) > stars();
      // 5단계: 장부 장 보상으로 여는 건물 (대장간 3장 · 텃밭·별채 5장)
      const gate = GATED[k];
      const noGuide = !!gate && !feature(gate);
      const locked = d.unlock > S.land || noStar || noGuide || !!dl;
      const poor = S.gold < d.cost;
      // 5단계: 잠긴 건 회색 + 무엇을 하면 열리는지 한 줄
      const why = dl ? dl : noGuide ? `장부 ${featureChapter(gate!)}장에 열려요` : d.unlock > S.land ? `땅 ${d.unlock}단계에 열려요` : noStar ? `평판 ★${d.stars}에 열려요` : '';
      const sub = why ? `<small class="lock">${why}</small>` : `<small>${fmt(d.cost)} G</small>`;
      return `<button data-k="${k}" class="${locked ? 'locked' : ''}" ${poor && !locked ? 'disabled' : ''}><img src="${thumb(k)}" alt=""><b>${d.name}</b>${sub}${locked ? '<u class="lk"></u>' : ''}</button>`;
    };
  const kinds = buildableKinds().filter((k) => decoLock(k) !== 'hide');
  // 건물 → 장식 (장식은 어울림 재료)
  const items = kinds.filter((k) => !def(k).deco || k === 'board').map(card).join('') + '</div><p class="sub">장식 · 가까이 두면 「어울림」이 생겨요</p><div class="cat">' + kinds.filter((k) => def(k).deco && k !== 'board').map(card).join('');
  openWin('건설', `<div class="tabs" id="bT"><button class="tab on">건물</button><button class="tab" id="toLand">땅 넓히기</button></div><p class="sub">원하는 자리에 지어요 · 금화 <b class="g">${fmt(S.gold)}</b></p><div class="cat">${items}</div>`);
  $('#toLand').onclick = openLand;
  $$('.cat button').forEach(
    (b) =>
      (b.onclick = () => {
        const k = b.dataset.k as Kind;
        const dl = decoLock(k);
        if (dl && dl !== 'hide') {
          toast(dl);
          return;
        }
        const gate = GATED[k];
        if (gate && !feature(gate)) {
          toast(`버나드의 장부 ${featureChapter(gate)}장을 마치면 지을 수 있어요`);
          return;
        }
        if (def(k).unlock > S.land) {
          toast(`땅을 ${def(k).unlock}단계까지 넓히면 지을 수 있어요`);
          return;
        }
        if ((def(k).stars ?? 0) > stars()) {
          toast(`평판 ★${def(k).stars}이 되면 지을 수 있어요`);
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
      const need = CONFIG.landStars[i] ?? 0;
      const right = st === S.land ? '현재' : st < S.land ? '완료' : `${fmt(L.cost)}G`;
      const req = st > S.land && need ? ` · <span class="${stars() >= need ? 'good' : 'bad'}">평판 ★${need}</span>` : '';
      return `<button class="stp ${st === S.land ? 'cur' : ''}" data-l="${st}" ${st !== S.land + 1 ? 'disabled' : ''}><span style="grid-column:1/3"><b>${st}단계 · ${L.size}칸</b><small>${L.opens}${req}</small></span><em>${right}</em></button>`;
    })
    .join('');
  const note = S.land >= CONFIG.land.length ? '최대 크기예요!' : '한 단계씩 넓힐 수 있어요';
  openWin('땅 넓히기', `<div class="tabs"><button class="tab" id="toBuild">건물</button><button class="tab on">땅 넓히기</button></div><p class="sub">울타리를 밀어서 마을 땅을 넓혀요 · 최대 ${CONFIG.land.length}단계</p><div class="steps">${rows}</div><p class="note">${note}</p>`);
  $$('.stp').forEach(
    (b) =>
      (b.onclick = () => {
        const l = +b.dataset.l!;
        if (l !== S.land + 1) return;
        const cost = CONFIG.land[l - 1].cost;
        const need = CONFIG.landStars[l - 1] ?? 0;
        if (stars() < need) {
          toast(`평판 ★${need}이 필요해요 · 오늘의 목표에서 평판을 확인해요`);
          return;
        }
        if (S.gold < cost) {
          toast(`금화가 모자라요 (${fmt(cost)}G 필요)`);
          return;
        }
        closeWin();
        game.expandLand(l);
      }),
  );
  $('#toBuild').onclick = openBuild;
}

const portrait = (k: string) => PORTRAITS[k] || '';

// ───────── 건물 안 엿보기 ─────────

/** 건물 창 아래에 덧붙일 줄 (베타: 어울림 — ui/harmony가 채운다) */
export const objExtra = { html: (_o: Building) => '' };

export function showObj(o: Building) {
  const d = def(o.kind);
  if (!S.visiting) {
    if (o.kind === 'smith' && o.build === undefined) return openSmith(o);
    if (o.kind === 'garden' && o.build === undefined) return openGarden(o);
    if (o.kind === 'board' || o.kind === 'dungeon') {
      openBoard();
      return appendMoveButton(o);
    }
  }
  const cost = nextLevelCost(o);
  const canUp = cost != null;
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
  const grows = d.up && o.sprite && baseKey(o.sprite) !== d.up.sprite ? '더 큰 건물로 · ' : '';
  const up = canUp && !S.visiting ? `<button class="bigbtn" id="upB">Lv.${o.lvl + 1}/${maxLevel(o.kind)} · ${grows}${d.levelText ?? ''} (${fmt(cost!)} G)</button>` : '';
  openWin(
    d.name + (o.lvl > 1 ? ' Lv.' + o.lvl : ''),
    `<p class="sub">${d.desc}</p>${S.visiting ? '' : objExtra.html(o)}${showInside ? `<b class="g">안에 있는 손님</b><div class="inside">${inside}</div>` : ''}${roofs}${up}`,
  );
  $$('.roofs button').forEach(
    (b) =>
      (b.onclick = () => {
        game.setRoof(o, b.dataset.h === 'null' ? null : +b.dataset.h!);
        $$('.roofs button').forEach((x) => x.classList.toggle('on', x === b));
      }),
  );
  appendMoveButton(o);
  const ub = document.getElementById('upB');
  if (ub) ub.onclick = () => game.upgrade(o);
}

// ───────── 메뉴·계정 ─────────


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
        const kind = ($('#rk') as HTMLSelectElement).value;
        addReport({ kind, text, at: Date.now() });
        // 로그인했으면 서버(bug_letters)로도
        if (online()) void sendLetter(`[${kind}] ${text}`, document.querySelector('.ver')?.textContent ?? '');
        closeWin();
        talk([['post', '편지 잘 받았어요! 답장은 공지에서 확인해 주세요~']]);
      };
    },
  );
}
