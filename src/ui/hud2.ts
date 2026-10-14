// VISUAL §4 hudV2 · §5 uiKitV2 — 실험실(기본 꺼짐 · 「새 화면 미리 보기」를 켠 기기만)
//  끄면 이 파일은 아무것도 하지 않는다: body 클래스 · 새 버튼 · 소식 띠를 만들지 않고, hudSel()은 받은 그대로 돌려준다.
//  화면 배치는 거의 다 style.css 끝의 body.hud2 / body.ui2 블록이 한다 (원래 HUD 요소는 DOM에 그대로 두고 숨기기만).
import { CONFIG } from '../data/config';
import { abyssOpen } from '../world/abyss';
import { flag } from '../world/flags';
import { feature, featureChapter } from '../world/guide';
import { S } from '../world/state';
import { vis, fsay } from '../world/visual';
import { openAbyss } from './abyss';
import { esc } from './common';
import { openBoard } from './expedition';
import { openHunt } from './hunt';
import { iconSrc, type IconKey } from './kit';
import { openNotices } from './notice';
import { openWin, showObj, toast } from './windows';
import { smithObj } from '../world/craft';
import { smithCond } from '../world/bldStatus';
import { raidTileLock } from '../world/raidWhy';

const on = () => document.body.classList.contains('hud2');

/** 부팅 때 한 번 (글자 크기 변수를 정하기 전에): 켠 기능만 body 클래스 */
export function initVisualClasses() {
  if (vis('hudV2')) document.body.classList.add('hud2');
  if (vis('uiKitV2')) document.body.classList.add('ui2');
}

// ───────── 모험 창: 사냥 · 원정 · 토벌 · 심연 (각각 원래 창을 연다) ─────────

interface AdvItem {
  icon: IconKey;
  name: string;
  sub: string;
  open: () => void;
  /** 잠겼으면 열리는 조건 (격자 메뉴와 같은 글) */
  lock: string | null;
}
function advItems(): AdvItem[] {
  const gate = (f: Parameters<typeof feature>[0]) => (feature(f) ? null : `장부 ${featureChapter(f)}장에 열려요`);
  return [
    { icon: 'm_hunt', name: '사냥', sub: '몬스터 · 장비 · 재료', open: () => openHunt(), lock: gate('hunt') },
    { icon: 'm_expedition', name: '원정', sub: '단골을 보내고 기다리기', open: () => openBoard(), lock: null },
    // 회색 버튼엔 이유: 열려 있어도 지금 못 가면 부제에 짧은 이유 (「오늘 도전 끝 · 내일 0시」)
    { icon: 'm_raid', name: '토벌', sub: (feature('raid') && raidTileLock()?.short) || '주간 · 떠돌이 보스', open: () => openBoard(), lock: gate('raid') },
    {
      icon: 'm_dex',
      name: '심연',
      sub: '끝없는 층 오르기',
      open: () => openAbyss(),
      lock: abyssOpen() ? null : flag('endlessAbyss') ? `심연 사냥 ${CONFIG.hunt.stages}단계를 깨면 열려요` : '준비 중이에요',
    },
  ];
}
export function openAdventure() {
  if (S.visiting) return toast(fsay('이웃 마을에서 돌아온 뒤에 해요', '이웃 마을에서 돌아오시면 해 드릴게요'));
  const items = advItems();
  openWin(
    '모험',
    `<div class="advgrid">${items
      .map(
        (it, i) =>
          `<button class="mtile adv ${it.lock ? 'lock' : ''}" data-adv="${i}"><img src="${iconSrc(it.icon)}" alt=""><span>${esc(it.name)}</span><small>${esc(it.lock ?? it.sub)}</small>${it.lock ? '<u class="lk"></u>' : ''}</button>`,
      )
      .join('')}</div>`,
    'advw',
  );
  document.querySelectorAll<HTMLElement>('[data-adv]').forEach(
    (b) =>
      (b.onclick = () => {
        const it = items[+b.dataset.adv!];
        if (it.lock) return toast(`${it.name}: ${it.lock}`);
        it.open();
      }),
  );
}

// ───────── 소식 띠: 장부 카드 · 평가 · 오늘 목표 · 다음 이야기 · 축복을 4초마다 번갈아 ─────────

interface News {
  key: string;
  icon: string;
  text: string;
  /** 받을 게 있다 (반짝 · 이것끼리만 돈다) */
  hot: boolean;
  tap: () => void;
}
const el = (s: string) => document.querySelector<HTMLElement>(s);
const txt = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

function collect(): News[] {
  const out: News[] = [];
  const m = el('#mission');
  if (m && !m.hidden && m.innerHTML) {
    const t = [txt(m.querySelector('b')), txt(m.querySelector('em'))].filter(Boolean).join(' · ');
    if (t) out.push({ key: 'mission', icon: iconSrc('m_quest', true), text: t, hot: m.classList.contains('done'), tap: () => m.click() });
  }
  const ev = el('#evalbar');
  if (ev && !ev.hidden && ev.innerHTML) {
    const t = txt(ev.querySelector('span'));
    if (t) out.push({ key: 'eval', icon: ev.querySelector('img')?.getAttribute('src') ?? '', text: t, hot: false, tap: () => ev.click() });
  }
  const gp = el('#goalPill');
  if (gp && !gp.hidden && gp.textContent) {
    out.push({ key: 'goal', icon: '', text: txt(gp), hot: gp.classList.contains('ready'), tap: () => gp.click() });
  }
  const sw = el('#storyWait');
  if (sw && !sw.hidden && sw.textContent) {
    const t = txt(sw);
    out.push({ key: 'story', icon: '', text: t, hot: false, tap: () => toast(t) });
  }
  const bi = el('#blessIco');
  if (bi && !bi.hidden && bi.textContent) {
    out.push({ key: 'bless', icon: '', text: `예배당 축복 ${txt(bi).replace('✨', '✨ ')} 남음`, hot: false, tap: () => bi.click() });
  }
  return out;
}

let band: HTMLButtonElement | null = null;
let idx = 0;
let shownKey = '';
let flipAt = 0;
let cur: News | null = null;
const ROTATE_MS = 4000;

function drawBand(now: number) {
  if (!band) return;
  const all = collect();
  const hot = all.filter((n) => n.hot);
  const list = hot.length ? hot : all;
  band.hidden = !list.length;
  if (!list.length) return (cur = null);
  if (now >= flipAt) {
    flipAt = now + ROTATE_MS;
    const at = list.findIndex((n) => n.key === shownKey);
    idx = at < 0 ? 0 : (at + 1) % list.length;
  } else {
    // 보던 게 사라지면 다음 것
    const at = list.findIndex((n) => n.key === shownKey);
    idx = at < 0 ? Math.min(idx, list.length - 1) : at;
  }
  cur = list[idx];
  shownKey = cur.key;
  const html = `${cur.icon ? `<img src="${cur.icon}" alt="">` : ''}<span>${esc(cur.text)}</span>${list.length > 1 ? `<i>${idx + 1}/${list.length}</i>` : ''}`;
  if (band.innerHTML !== html) band.innerHTML = html;
  band.classList.toggle('hot', cur.hot);
  band.setAttribute('aria-label', cur.text);
}

// ───────── 아래 5칸 + 배지 따라 하기 ─────────

function navBtn(id: string, icon: IconKey, label: string, after: Element | null, click: () => void, extra = '') {
  const b = document.createElement('button');
  b.id = id;
  b.innerHTML = `<img class="kic" src="${iconSrc(icon)}" alt="">${label}${extra}`;
  b.onclick = click;
  const nav = el('nav.dk')!;
  nav.insertBefore(b, after);
  return b;
}

function mirror() {
  const nd = el('#bNotice .dot');
  const bd = el('#bNews .dot');
  if (nd && bd && bd.hidden !== nd.hidden) bd.hidden = nd.hidden;
  // 대장간 칸: 대장간이 없으면 회색 잠금 · 할 일이 있으면 점 (건물 말풍선과 같은 조건)
  const sb = el('#bSmith');
  if (sb) {
    const has = !!smithObj();
    sb.classList.toggle('locked', !has);
    const dot = sb.querySelector<HTMLElement>('.dot');
    const want = has && !!smithCond();
    if (dot && dot.hidden === want) dot.hidden = !want;
  }
  const ex = el('#bExp');
  const ad = el('#bAdv');
  if (ex && ad) ad.classList.toggle('ready', ex.classList.contains('ready'));
}

/** 아래 칸 「대장간」: 가장 높은 레벨 대장간 → 건물을 누른 것과 같은 창 */
function openSmithTab() {
  const o = smithObj();
  if (!o) return toast('대장간을 지으면 열려요');
  showObj(o);
}
/** 부팅 때 (initHud 뒤): 새 HUD를 켰을 때만 버튼·띠를 만든다 */
export function initHud2() {
  if (!on()) return;
  navBtn('bAdv', 'm_hunt', '모험', el('#bGuest'), openAdventure);
  navBtn('bNews', 'm_notice', '소식', el('#bMenu2'), openNotices, '<i class="dot" hidden></i>');
  // 아래 6칸 (최근 7일 화면 열기 3위인 대장간에 바로 가는 길) — 대장간 건물을 누른 것과 같은 창 (K9)
  navBtn('bSmith', 'm_smith', '대장간', el('#bMenu2'), openSmithTab, '<i class="dot" hidden></i>');
  const bi = el('#bBuild img.kic') as HTMLImageElement | null;
  if (bi) bi.src = iconSrc('m_neighbor');
  band = document.createElement('button');
  band.id = 'newsBand';
  band.hidden = true;
  band.onclick = (e) => {
    e.stopPropagation();
    cur?.tap();
  };
  // 상태줄과 띠 사이 (상태줄을 누르면 여관 정보 카드가 띠 아래로 펼쳐진다)
  el('#hud')!.appendChild(band);
  mirror();
  setInterval(() => {
    if (document.hidden) return;
    mirror();
    drawBand(performance.now());
  }, 500);
}
