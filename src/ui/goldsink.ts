// GOLDSINK UI: 연금술 공방 「변환」 탭 · 예배당 「축복 받기」 · 게시판 「마을 부탁」 탭 · HUD 축복 아이콘 · 다음 이야기 기다림 한 줄
import { CONFIG } from '../data/config';
import { fLv } from '../world/facilities';
import { boxReady, claimBox, claimFavor, ensureFavors, favorDef, favorDone, favorProg, swapCost, swapFavor } from '../world/favors';
import {
  blessCost, blessed, blessFx, blessLeft, blessRoom, buyBless, buyConv, convItem, convItems, convMax, convPrice, convTotal, fmtKo, gsState, onceDay, onceEver, refreshCost, taperAt, taperInfo,
  untilKstMidnight,
} from '../world/goldsink';
import { storyWaitDay } from '../world/story';
import { bestOf } from '../world/town';
import { P, S, type Building } from '../world/state';
import { track as trackEv } from '../net/telemetry';
import { esc, fmt } from './common';
import { talk } from './dialogue';
import { objExtra, showObj, toast } from './windows';

const GSC = () => CONFIG.goldsink;
const pctS = (v: number) => `${Math.round(v * 100)}%`;
const hm = (ms: number) => {
  const m = Math.ceil(ms / 60000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

// ───────── §2 연금술 변환 ─────────

let alTab = 0;
let matKey = '';
let bossKey = '';
let sel: { key: string; q: number } | null = null;

function convRow(key: string, label: string, pick = ''): string {
  const it = convItem(key);
  if (!it) return '';
  const left = it.cap - it.bought;
  const now = convPrice(it, it.bought);
  const mx = convMax(it);
  const on = sel?.key === key;
  const btn = (q: number, t: string) => `<button data-cq="${key}" data-q="${q}" ${q < 1 || q > mx ? 'disabled' : ''} class="${on && sel!.q === q ? 'on' : ''}">${t}</button>`;
  return `<div class="cvrow ${on ? 'on' : ''}"><span><b>${esc(label)}${it.qty > 1 ? ` ×${it.qty}` : ''}</b>${pick}<small>가진 ${fmt(it.have)} · 지금 ${fmtKo(now)} G · 오늘 ${it.bought}/${it.cap}</small></span><span class="cvq">${left > 0 ? `${btn(1, '1')}${btn(Math.min(10, left), String(Math.min(10, left)))}${btn(mx, `최대${mx ? ` ${mx}` : ''}`)}` : '<em>오늘은 다 샀어요</em>'}</span></div>`;
}
export function convHtml(): string {
  if (!fLv('alchemy')) return '<p class="note">연금술 공방을 지으면 열려요</p>';
  const items = convItems();
  const mats = items.filter((x) => x.key.startsWith('mat:'));
  const boss = items.filter((x) => x.key.startsWith('boss:'));
  if (!mats.some((x) => x.key === matKey)) matKey = mats[mats.length - 1]?.key ?? '';
  if (!boss.some((x) => x.key === bossKey)) bossKey = boss[boss.length - 1]?.key ?? '';
  const select = (id: string, list: typeof items, cur: string) =>
    `<select id="${id}" class="cvsel">${list.map((x) => `<option value="${x.key}" ${x.key === cur ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
  const rows = [
    matKey ? convRow(matKey, '지역 재료', select('cvMat', mats, matKey)) : '',
    convRow('ash', '잿빛 가루'),
    convRow('dustR', '희귀 가루'),
    convRow('dustE', '영웅 가루'),
    convRow('dustL', '전설 가루'),
    bossKey ? convRow(bossKey, '보스 재료', select('cvBoss', boss, bossKey)) : '<p class="note">보스 재료는 처치한 보스 것만 바꿀 수 있어요</p>',
    convRow('whet', '행운의 숫돌'),
  ].join('');
  const it = sel && convItem(sel.key);
  const total = it && sel ? convTotal(it, sel.q) : 0;
  const prev = it && sel
    ? `<div class="cvsum"><span>${esc(it.name)} ${fmt(sel.q * it.qty)}개 · 합계 <b class="g">${fmt(total)} G</b> <small>(금화 ${fmtKo(S.gold)})</small></span><button class="bigbtn sm" id="cvOk" ${total > S.gold ? 'disabled' : ''}>바꾸기</button></div>`
    : '<p class="note">수량을 고르면 합계가 보여요 · 살수록 그날 값이 조금씩 올라요 (한국 시간 0시 초기화)</p>';
  return `<div class="conv"><p class="sub">금화를 녹여 재료·가루로 바꿔요 · 초월에 모자란 재료를 메울 수 있어요</p>${rows}${prev}</div>`;
}
function alchTabs(): string {
  return `<div class="tabs" id="alT"><button class="tab ${alTab ? '' : 'on'}" data-alt="0">물약</button><button class="tab ${alTab ? 'on' : ''}" data-alt="1">변환</button></div>`;
}

// ───────── §3 예배당 축복 ─────────

export function blessHtml(): string {
  const lv = fLv('chapel');
  if (!lv) return '';
  const B = GSC().bless;
  const add = B.perLv * Math.max(0, lv - 1);
  const left = blessLeft();
  const c = blessCost();
  const room = blessRoom();
  return `<div class="bless"><b class="g">✨ 축복</b> <small>현실 ${B.hours}시간 · 최대 ${B.maxHours}시간</small>
    <p class="sub">사냥 경험치 +${pctS(B.xp + add)} · 장비 드랍 +${pctS(B.drop + add)} · 원정 시간 −${pctS(B.expTime + add)} · 손님 기분 떨어짐 −${pctS(B.mood + add)}</p>
    ${left > 0 ? `<p class="sub good">축복 중 · ${hm(left)} 남음</p>` : ''}
    <button class="bigbtn" id="blessB" ${room && S.gold >= c ? '' : 'disabled'}>${left > 0 ? (room ? `연장 +${B.hours}시간` : `최대 ${B.maxHours}시간이에요`) : '축복 받기'} · ${fmtKo(c)} G</button></div>`;
}

// ───────── 건물 창에 붙이기 · 버튼 ─────────

const reshow = (kind: string) => {
  const o = bestOf(kind as never) as Building | undefined;
  if (o && document.getElementById('win')?.classList.contains('on')) showObj(o);
};
let prev: ((o: Building) => string) | null = null;
export function initGoldsinkUI() {
  prev = objExtra.html;
  objExtra.html = (o) => {
    let h = prev!(o);
    if (S.visiting) return h;
    if (o.kind === 'alchemy') {
      if (o.build !== undefined) return h + '<p class="note">연금술 공방을 지으면 「변환」이 열려요</p>';
      h = h.includes('<div class="alch">') ? h.replace('<div class="alch">', () => `${alchTabs()}<div class="alch"${alTab ? ' hidden' : ''}>`) : h + alchTabs();
      return h + (alTab ? convHtml() : '');
    }
    if (o.kind === 'chapel' && o.build === undefined) return h + blessHtml();
    return h;
  };
  addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const tab = t.closest?.('[data-alt]') as HTMLElement | null;
    if (tab) {
      alTab = +tab.dataset.alt!;
      sel = null;
      return reshow('alchemy');
    }
    const q = t.closest?.('[data-cq]') as HTMLElement | null;
    if (q && !(q as HTMLButtonElement).disabled) {
      sel = { key: q.dataset.cq!, q: +q.dataset.q! };
      return reshow('alchemy');
    }
    if (t.closest?.('#cvOk')) return doConvert();
    if (t.closest?.('#blessB')) return doBless();
  });
  addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.id === 'cvMat') matKey = t.value;
    else if (t.id === 'cvBoss') bossKey = t.value;
    else return;
    sel = null;
    reshow('alchemy');
  });
}
function doConvert() {
  if (!sel) return;
  const it = convItem(sel.key);
  const raised = !!it && it.bought > 0;
  const err = buyConv(sel.key, sel.q);
  if (err) return toast(err);
  trackEv('gs_convert', { key: sel.key, q: sel.q });
  toast(`${it?.name ?? ''} +${fmt((it?.qty ?? 1) * sel.q)}`);
  sel = null;
  const after = () => reshow('alchemy');
  // §9 연금술사: 첫 변환 · 오늘 값이 오른 뒤 (하루 한 번)
  if (onceEver('alch1')) talk([['mage', '금화는 무겁지. 이걸 이렇게… 녹여서… 자, 쓸모 있는 걸로 바꿔 줄게. 수수료는 조금 받아.', undefined, '연금술사']], after);
  else if (raised && onceDay('alchUp')) talk([['mage', '오늘은 재료값이 좀 올랐어. 사장님이 많이 사 가서 말이야.', undefined, '연금술사']], after);
  else after();
}
function doBless() {
  const r = buyBless();
  if ('err' in r) return toast(r.err);
  trackEv('gs_bless', { ext: r.ext, left: Math.round(blessLeft() / 60000) });
  const after = () => reshow('chapel');
  // §9 아리아 (하루 한 번씩)
  if (!r.ext && onceDay('aria')) talk([['legend_aria', '오늘 하루도 무사하길. 이 빛이 모험가들 곁에 머물 거예요.', undefined, '아리아']], after);
  else if (r.ext && onceDay('ariaExt')) talk([['legend_aria', '기도가 길어졌네요. 그만큼 오래 지켜 줄 거예요.', undefined, '아리아']], after);
  else {
    toast(`✨ 축복 · ${hm(blessLeft())} 남음`);
    after();
  }
}

// ───────── §1 게시판 새로고침 버튼 · §5 마을 부탁 탭 ─────────

/** 새로고침 버튼 글: 「새로고침 (무료 1)」 → 「새로고침 · 51만 G」 */
export function refreshBtn(): string {
  const free = CONFIG.expedition.freeRefreshPerDay - P.quests.refreshUsed;
  if (free > 0) return `<button id="qRef">새로고침 (무료 ${free})</button>`;
  const cost = refreshCost();
  return `<button id="qRef" class="paid" ${S.gold >= cost ? '' : 'disabled'}>새로고침 · ${fmtKo(cost)} G</button>`;
}
/** 남은 의뢰가 0~1개면 한 줄 */
export const refreshHint = () => (P.quests.list.length <= 1 ? '<p class="note qhint">새로고침하면 새 의뢰가 와요</p>' : '');
/** 유료 새로고침 첫 번째(하루 한 번) 버나드 */
export function afterPaidRefresh(done: () => void) {
  if (onceDay('bernard')) talk([['keeper', '급한 의뢰를 찾는 건가. 수소문 값은 좀 드네.']], done);
  else done();
}

export function favorsHtml(): string {
  const list = ensureFavors();
  const g = gsState();
  const F = GSC().favor;
  const rows = list
    .map((f, i) => {
      const d = favorDef(f.id);
      if (!d) return '';
      const p = favorProg(f);
      const done = favorDone(f);
      const sc = swapCost();
      const act = f.claimed
        ? '<button disabled>받음</button>'
        : done
          ? `<button class="rd" data-fc="${i}">받기</button>`
          : `<button data-fs="${i}" ${S.gold >= sc ? '' : 'disabled'}>바꾸기${sc ? ` · ${fmtKo(sc)} G` : ' (무료)'}</button>`;
      return `<div class="fvrow ${f.claimed ? 'got' : done ? 'ready' : ''}"><span><b>${esc(d.text)}</b><i><u style="width:${Math.round((p / f.target) * 100)}%"></u></i><small>${p}/${f.target} · 보상 ${esc(d.reward())}</small></span>${act}</div>`;
    })
    .join('');
  const nDone = list.filter((f) => f.claimed).length;
  const box = g.box ? '<p class="note">보너스 상자를 받았어요 · 내일 새 부탁이 와요</p>' : `<button class="bigbtn ${boxReady() ? 'flash' : ''}" id="fvBox" ${boxReady() ? '' : 'disabled'}>🎁 보너스 상자 (${nDone}/${list.length})</button>`;
  const h = Math.floor(untilKstMidnight() / 3600000);
  return `<p class="sub">마을 사람들 부탁 · 하루 ${F.perDay}개 · ${h}시간 뒤 새 부탁</p>${rows || '<p class="note">오늘은 부탁이 없어요</p>'}${box}
    <p class="note">이번 주 ${Math.min(g.weekN, F.weekGoal)}/${F.weekGoal}${g.letter ? ' · 감사 편지 받음!' : ` · ${F.weekGoal}개면 모모가 감사 편지를 가져와요`}</p>`;
}
/** 게시판 마을 부탁 탭 버튼 (다시 그리기는 redraw) */
export function bindFavors(redraw: () => void) {
  document.querySelectorAll<HTMLElement>('[data-fc]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimFavor(+b.dataset.fc!);
        if (!r) return;
        trackEv('gs_favor', { n: gsState().weekN });
        toast(`부탁 완료! ${r.reward}`);
        if (r.letter) talk([['post', '이번 주 부탁 다 들어주셨다고 마을에서 감사 편지가 왔어요! …저도 같이 썼어요.']], redraw);
        else redraw();
      }),
  );
  document.querySelectorAll<HTMLElement>('[data-fs]').forEach(
    (b) =>
      (b.onclick = () => {
        const err = swapFavor(+b.dataset.fs!);
        if (err) return toast(err);
        redraw();
      }),
  );
  const bx = document.getElementById('fvBox');
  if (bx)
    bx.onclick = () => {
      const r = claimBox();
      if (!r) return;
      trackEv('gs_box', {});
      toast(`🎁 ${r}`);
      redraw();
    };
}
/** 마을 부탁 탭을 처음 열 때 모모 */
export function favorIntro(done: () => void) {
  if (onceEver('momoFavor')) talk([['post', '사장님! 마을 사람들 부탁이 붙었어요. 세 개만 들어주면 제가 상자 하나 몰래 가져다드릴게요!']], done);
  else done();
}

// ───────── §4 사냥 창 한 줄 ─────────

export function taperLine(): string {
  const t = taperInfo();
  const m = Math.round(t.mult * 100);
  const nx = t.upto ? taperAt(t.upto) : 0;
  return t.mult >= 1
    ? `<p class="note gsTaper">오늘 자동 사냥 금화 ${m}% · ${t.n}/${t.upto}판</p>`
    : `<p class="note gsTaper">오늘 자동 사냥 금화 ${m}% (재료는 그대로) · ${t.n}판${t.upto ? ` · ${t.upto}판부터 ${Math.round(nx * 100)}%` : ''}</p>`;
}

// ───────── HUD: 축복 아이콘 · §6 다음 이야기 ─────────

export function storyWaitText(): string {
  const d = storyWaitDay();
  if (!d || S.visiting) return '';
  return `다음 이야기: ${d}일차 (지금 ${S.day}일차) · ☾로 밤을 넘기면 하루가 빨리 가요`;
}
export function tickGoldsinkHud() {
  const hud = document.getElementById('hud');
  if (!hud) return;
  // 축복 아이콘 (상태 카드 오른쪽 아래 배지 — 폰에서 줄이 넘치지 않게)
  const r1 = document.querySelector('.top .stat');
  let bi = document.getElementById('blessIco');
  const on = !S.visiting && blessed();
  if (!bi && on && r1) {
    bi = document.createElement('span');
    bi.id = 'blessIco';
    bi.title = '예배당 축복';
    bi.onclick = () => toast(`✨ 축복 · 사냥 경험치 +${pctS(blessFx('xp'))} · 드랍 +${pctS(blessFx('drop'))} · ${hm(blessLeft())} 남음`);
    r1.appendChild(bi);
  }
  if (bi) {
    bi.hidden = !on;
    const t = on ? `✨${hm(blessLeft())}` : '';
    if (bi.textContent !== t) bi.textContent = t;
  }
  // 다음 이야기 기다림 (장부 카드 자리 — 장부 카드가 떠 있으면 카드의 「🌙 ○일차에 다음 이야기」가 대신한다)
  let sw = document.getElementById('storyWait');
  const txt = S.started ? storyWaitText() : '';
  if (!sw && txt) {
    sw = document.createElement('div');
    sw.id = 'storyWait';
    sw.className = 'px';
    hud.appendChild(sw);
  }
  if (sw) {
    const battle = !!document.querySelector('.battle, .cbt');
    sw.hidden = !txt || battle;
    if (sw.textContent !== txt) sw.textContent = txt;
    // 왼쪽 위 줄(상태 카드 · 장부 카드 · 평가 바 · 오늘 목표 알약) 중 가장 아래 것 밑에
    if (!sw.hidden) {
      const hb = hud.getBoundingClientRect();
      let bottom = 0;
      for (const sel of ['.top .stat', '#mission', '#evalbar', '#goalPill']) {
        const e = document.querySelector<HTMLElement>(sel);
        if (!e || e.hidden || !e.offsetParent) continue;
        bottom = Math.max(bottom, e.getBoundingClientRect().bottom - hb.top);
      }
      const want = bottom ? `${Math.round(bottom + 6)}px` : '';
      if (sw.style.top !== want) sw.style.top = want;
    }
  }
}
