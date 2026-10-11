// 4단계 화면: 「당신은 누구였나요?」(주인 만들기·출신 컷) · 주인 정보창(6각형·달력) · 인연 목록 · 선물 · 엔딩 앨범 · 엔딩 카드
import { BONDS, bondById, GIFT_KEYS, GIFTS, type BondDef, type GiftKey } from '../data/bonds';
import { backupCycle, bindMemoryRow, bindStoryAlbum, giftsHtml, newInn, playCycleOpening, storyAlbumHtml, storyUi } from './story';
import { lastGrant, rememberFav, startCycle, storyLines } from '../world/story';
import { MEMORIES } from '../data/story/v1';
import { musicFlags } from './sound';
import type { ClassDef } from '../data/classes';
import { CONFIG } from '../data/config';
import { ENDINGS, endingById, type EndingDef } from '../data/endings';
import { josa } from '../data/josa';
import { JOBS, LEGACY_ORIGINS, mcPortrait, ORIGINS, OSTAT_DESC, OSTAT_NAME, OSTATS, type Gender, type Job } from '../data/origins';
import { PORTRAITS } from '../engine/assets';
import { canvas } from '../engine/pixel';
import { framesFor } from '../engine/sprites';
import { refreshOwner } from '../world/actors';
import {
  albumCount, bonusText, buyGift, calendar, createOwner, emberText, energyLeft, energyMax, fillT, giveGift, inheritLegacy,
  nameError, originInfo, originTitle, ownerBonus, ownerHooks, SEASON_EVENT, stageName, talkTo, tie, tieAvailable, tieStage,
} from '../world/owner';
import { markDirty, P, S, type TalkLine } from '../world/state';
import { $, $$, esc, fmt } from './common';
import { talk, talkDuo } from './dialogue';
import { closeWin, openWin, setWinLock, toast } from './windows';
import { myTitle } from '../world/meta';

const myPort = () => (P.owner ? PORTRAITS[mcPortrait(P.owner.job, P.owner.gender)] : PORTRAITS.hero) || '';
const portOf = (d: BondDef) => PORTRAITS[d.port] || '';
const JOB_NAME: Record<Job, string> = Object.fromEntries(ORIGINS.map((o) => [o.job, o.jobName])) as Record<Job, string>;

/** 빵집 도라 아줌마 초상화: 따로 그림이 없어 도트 캐릭터로 만든다 */
function makeBakerPortrait() {
  const def: ClassDef = {
    name: '빵집', face: { eyes: 'happy', mouth: 'grin', blush: true }, hair: '#8a5a3a', style: 'braid',
    cloth: '#d8707a', arm: '#f2ead8', pants: '#6a4a3a', boots: '#4a3020', accent: '#efe6cf', weapon: null, apron: '#f8f2e4', bandana: '#f8f2e4',
  };
  const f = framesFor('baker-portrait', def).idle[0];
  const c = canvas(24, 24);
  c.getContext('2d')!.drawImage(f, 0, -6);
  PORTRAITS.baker = c.toDataURL();
}

export function initOwnerUi() {
  makeBakerPortrait();
  ownerHooks.duo = talkDuo;
  ownerHooks.partner = openPartner;
  ownerHooks.ending = playEnding;
  // STORY_V1: 「새 여관 열기」 확인 뒤 유산 화면 (모듈이 서로 부르므로 init에서 잇는다)
  storyUi.legacyCreate = () => openCreate('legacy', () => toast(`${P.owner!.name}${josa(P.owner!.name, '가')} ${S.innName || '여관'}의 새 주인이 되었어요 · ${P.legacy.gen}회차`));
  $('#bOwner').onclick = () => openOwner();
  syncOwnerButton();
}

/** 아래 메뉴의 주인 초상화 버튼 */
export function syncOwnerButton() {
  // 아래 메뉴는 금테 아이콘(m_owner)이라 바꿀 게 없다 (초상화 축소는 정수 배율 규칙에 어긋남)
}

// ═════════════ 주인 만들기 ═════════════

/**
 * mode: new = 새 게임(오프닝 앞) · existing = 기존 저장에 한 번 · legacy = 유산을 잇는 다음 세대
 * 끝나면 출신 컷을 보여 주고 done
 */
export function openCreate(mode: 'new' | 'existing' | 'legacy', done: () => void) {
  let gender: Gender = 'm';
  let job: Job = 'knight';
  let origin: string = mode === 'legacy' ? 'disciple' : 'knight';
  let name = '';
  // STORY_V1 §5: 유산 시작 선물 (포인트로 고르기)
  const gifts = new Set<string>();
  const draw = () => {
    const prev = P.legacy.prev;
    const jobCards = JOBS.map((j) => {
      const og = ORIGINS.find((o) => o.job === j)!;
      return `<button class="jobc ${j === job ? 'on' : ''}" data-j="${j}"><img src="${PORTRAITS[mcPortrait(j, gender)]}" alt=""><b>${og.jobName}</b><small>${esc(og.title[gender === 'm' ? 0 : 1])}</small></button>`;
    }).join('');
    const og = ORIGINS.find((o) => o.job === job)!;
    const legacyRow =
      mode === 'legacy'
        ? `<div class="crow"><span>출신</span><div class="seg">${[...LEGACY_ORIGINS.map((l) => [l.key, l.title[gender === 'm' ? 0 : 1]]), [og.key, og.title[gender === 'm' ? 0 : 1]]]
            .map(([k, t]) => `<button data-o="${k}" class="${origin === k ? 'on' : ''}">${esc(t)}</button>`)
            .join('')}</div></div>`
        : '';
    const info = originInfo(mode === 'legacy' ? origin : job === og.job ? og.key : origin);
    const linkedNames = info.linked.map((k) => bondById(k)?.name ?? k).join(' · ');
    openWin(
      mode === 'legacy' ? '다음 세대 — 당신은 누구인가요?' : '당신은 누구였나요?',
      `<p class="sub">${mode === 'existing' ? '여관 주인인 「나」를 정해요. 마을과 진행은 그대로예요.' : mode === 'legacy' ? `${esc(prev?.name ?? '앞 주인')}의 여관을 이어받을 새 주인. 마을·영웅·도감은 그대로예요.` : '여관을 물려받기 전, 당신은 모험가였어요.'}</p>
      <div class="crow"><span>성별</span><div class="seg"><button data-g="m" class="${gender === 'm' ? 'on' : ''}">남</button><button data-g="f" class="${gender === 'f' ? 'on' : ''}">여</button></div></div>
      <div class="crow"><span>이름</span><input id="cName" maxlength="${CONFIG.owner.nameMax}" placeholder="${CONFIG.owner.nameMin}~${CONFIG.owner.nameMax}자" value="${esc(name)}" autocomplete="off"></div>
      <div class="crow col"><span>모험가 시절 직업</span><div class="jobs">${jobCards}</div></div>
      ${legacyRow}
      ${mode === 'legacy' ? giftsHtml(gifts) : ''}
      <div class="cinfo"><img src="${PORTRAITS[mcPortrait(job, gender)]}" alt=""><div><b>${esc(info.title[gender === 'm' ? 0 : 1])}</b><p>${esc(info.past)}</p><small>시작 보너스: ${esc(info.perkText)}${linkedNames ? `<br>연결된 영웅: ${esc(linkedNames)} (소문 조건 70% · 인연 1.3배)` : ''}</small></div></div>
      <button class="bigbtn" id="cOk">이 사람으로 시작</button>`,
      'create',
    );
    setWinLock(true);
    const inp = $<HTMLInputElement>('#cName');
    inp.oninput = () => (name = inp.value);
    $$('[data-g]').forEach((b) => (b.onclick = () => ((gender = b.dataset.g as Gender), draw())));
    $$('[data-j]').forEach(
      (b) =>
        (b.onclick = () => {
          job = b.dataset.j as Job;
          if (mode !== 'legacy' || ORIGINS.some((o) => o.key === origin)) origin = ORIGINS.find((o) => o.job === job)!.key;
          draw();
        }),
    );
    $$('[data-o]').forEach((b) => (b.onclick = () => ((origin = b.dataset.o!), draw())));
    $$('[data-gift]').forEach(
      (b) =>
        (b.onclick = () => {
          const g = b.dataset.gift!;
          if (gifts.has(g)) gifts.delete(g);
          else gifts.add(g);
          draw();
        }),
    );
    bindMemoryRow();
    $('#cOk').onclick = () => {
      const err = nameError(name);
      if (err) return toast(err);
      const og2 = ORIGINS.find((o) => o.job === job)!;
      const key = mode === 'legacy' ? origin : og2.key;
      let got: string[] = [];
      if (mode === 'legacy') {
        // STORY_V1 §5: 새 여관 열기 — 회차 저장 백업 · 가장 친했던 단골 기억 → 유산 잇기 → 이번 회차 이야기 처음부터 + 선물
        backupCycle();
        rememberFav();
        inheritLegacy(name, gender, job, key);
        got = startCycle([...gifts]);
      } else createOwner(name, gender, job, key);
      setWinLock(false);
      closeWin();
      refreshOwner();
      syncOwnerButton();
      playCut(mode === 'legacy' ? () => playCycleOpening(got, done) : done);
    };
  };
  draw();
}

/** 출신 이야기 컷: 초상화 + 대사 3~4장 */
function playCut(done: () => void) {
  const o = P.owner!;
  const info = originInfo(o.origin);
  const title = originTitle(o);
  const lines: TalkLine[] = [['narr', `${title} — ${o.name}`], ...info.cut.map((t) => ['me', fillT(t.replace('{호칭}', title))] as TalkLine)];
  talk(lines, done);
}

/** 새 게임 오프닝: 버나드 대사에 출신이 반영된다 */
export function openingFor(): TalkLine[] {
  const o = P.owner;
  const og = o && ORIGINS.find((x) => x.key === o.origin);
  const bern = og ? og.bernard : '자네 눈빛… 어디서 많이 본 눈빛이로군.';
  return [
    ['narr', '골드는 늘 모자랐다.'],
    ['narr', '목숨 걸고 던전에서 번 돈은, 여관 숙박비로 고스란히 사라지곤 했다.'],
    ['keeper', '자네, 셈이 꽤 빠르더군. 내 장부 정리를 그렇게 빨리 하는 사람은 처음 봤네.'],
    ['me', '하하, 맨날 돈이 모자라서 계산만 늘었죠.'],
    ['keeper', bern],
    ['me', '…알아보셨군요. 다 지난 일이에요.'],
    ['keeper', '나도 이제 허리가 예전 같지 않아. 이 여관… 자네가 맡아 주지 않겠나?'],
    ['me', '제가요? 이제 막 칼을 내려놓은 사람인데요?'],
    ['keeper', '칼 쥐는 손이나 장부 쥐는 손이나 매한가지일세. 손님 마음을 읽는 눈이 더 중요하지.'],
    ['keeper', '자, 간판부터 새로 달아야겠지. 여관 이름을 지어 주게.', 'name'],
    ['keeper', '{name}이라… 좋은 이름이군. 손님들이 몰려올 걸세.'],
    ['keeper', '지금은 여관 하나뿐이지만, 울타리를 밀고 땅을 넓혀 가게. 주점도, 온천도, 대장간도 자네 마음대로 지으면 되네.'],
    ['keeper', '다락에 자네 옛 장비 둘 자리도 비워 뒀네. 언젠가 다시 꺼내 볼 날이 올지도 모르지. 허허!'],
    ['narr', '그렇게, 전직 모험가의 여관 마을이 시작되었다.'],
  ];
}

// ═════════════ 주인 정보창 ═════════════

/** 능력치 6각형 (SVG) */
function hexagon(stats: Record<string, number>): string {
  const R = 62;
  const cx = 120;
  const cy = 92;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const ring = (f: number) => OSTATS.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const val = OSTATS.map((k, i) => pt(i, (R * Math.max(4, stats[k])) / 100).join(',')).join(' ');
  const labels = OSTATS.map((k, i) => {
    const [x, y] = pt(i, R + 14);
    return `<text x="${x}" y="${y + 4}" text-anchor="middle">${OSTAT_NAME[k]} ${Math.floor(stats[k])}</text>`;
  }).join('');
  return `<svg class="hex" viewBox="0 0 240 184" aria-label="주인 능력치">
    ${[1, 0.66, 0.33].map((f) => `<polygon points="${ring(f)}" class="ring"/>`).join('')}
    <polygon points="${val}" class="val"/>${labels}</svg>`;
}

export function openOwner() {
  const o = P.owner;
  if (!o) return toast('아직 주인이 없어요');
  const c = calendar();
  const linked = o.linked.map((k) => bondById(k)?.name ?? k).join(' · ');
  const tied = BONDS.filter((d) => tieAvailable(d.id) && tieStage(d.id) >= 2).length;
  openWin(
    '주인 정보',
    `<div class="ohd"><img src="${myPort()}" alt=""><div>${myTitle() ? `<small class="g">「${esc(myTitle())}」</small>` : ''}<b>${esc(o.name)}</b><small>${esc(originTitle(o))} · 전직 ${JOB_NAME[o.job] ?? ''}${P.legacy.gen > 1 ? ` · ${P.legacy.gen}대 주인` : ''}</small>
      <small>${c.year}년 차 ${c.name} ${c.dayIn}일째 · 계절 행사 ${SEASON_EVENT[c.season]} +${Math.round(CONFIG.owner.seasonBonus * 100)}%</small></div></div>
    ${hexagon(o.stats)}
    <div class="acc"><div>주인 보너스<b>전투력 +${(ownerBonus() * 100).toFixed(1)}%</b></div><div>오늘 행동력<b>${energyLeft()}/${energyMax()}</b></div>
      ${linked ? `<div>연결된 영웅<b>${esc(linked)}</b></div>` : ''}</div>
    <p class="note ember">${esc(emberText())}${o.ended ? ` · 「${esc(endingById(o.ended)?.title ?? '')}」 뒤로 계속 운영 중` : ''}</p>
    <div class="menu grid"><button id="oTies">인연 (${tied}/${BONDS.length})</button><button id="oGift">선물 가게</button><button id="oAlbum">엔딩 앨범 ${albumCount()}</button><button id="oStat">능력치 설명</button></div>
    ${o.ended ? '<button class="bigbtn" id="oLegacy">새 여관 열기 · 유산을 잇는다</button>' : ''}`,
    'owner',
  );
  $('#oTies').onclick = () => openTies();
  $('#oGift').onclick = () => openGifts();
  $('#oAlbum').onclick = () => openAlbum();
  $('#oStat').onclick = () => {
    openWin(
      '능력치',
      `<div class="acc">${OSTATS.map((k) => `<div>${OSTAT_NAME[k]} ${Math.floor(o.stats[k])}<b>${esc(OSTAT_DESC[k])}</b></div>`).join('')}</div>
      <p class="note">매일 첫 접속 때 모두 +${CONFIG.owner.dailyAll}, 행동마다 조금씩 올라요 (능력치마다 하루 +${CONFIG.owner.actionCapPerDay}까지). 100까지 대략 3~4개월.</p>
      <button class="bigbtn ghost" id="oBack">돌아가기</button>`,
    );
    $('#oBack').onclick = () => openOwner();
  };
  const lg = document.getElementById('oLegacy');
  if (lg) lg.onclick = () => newInn();
}



// ═════════════ 인연 목록 ═════════════

const hearts = (s: number) => '♥'.repeat(s) + '♡'.repeat(5 - s);

export function openTies() {
  const groups: [string, BondDef['who']][] = [['전설', 'legend'], ['영웅', 'hero'], ['마을 사람', 'villager']];
  openWin(
    '인연',
    `<p class="sub">말 걸기·선물(하루 한 번씩, 행동력 ${energyLeft()}/${energyMax()}) · 함께 원정·토벌로 인연이 깊어져요</p>
    ${groups
      .map(
        ([g, who]) =>
          `<div class="qhd"><b class="g">${g}</b></div><div class="tiegrid">${BONDS.filter((d) => d.who === who)
            .map((d) => {
              const on = tieAvailable(d.id);
              const t = P.ties[d.id];
              const st = t?.stage ?? 1;
              return `<button class="tie ${on ? '' : 'lock'}" data-t="${d.id}"><img src="${portOf(d)}" alt=""><b>${on ? esc(d.name) : '???'}</b><i>${on ? hearts(st) : ''}</i>${t?.rel ? `<u>${t.rel === 'lover' ? '연인' : '전우'}</u>` : ''}</button>`;
            })
            .join('')}</div>`,
      )
      .join('')}`,
    'ties',
  );
  $$('[data-t]').forEach((b) => (b.onclick = () => openTie(b.dataset.t!)));
}

export function openTie(id: string) {
  const d = bondById(id)!;
  if (!tieAvailable(id)) {
    const how = d.who === 'hero' ? '방랑자의 서 영웅: 부탁을 들어주고 동료가 되면' : '전설 영웅: 영입하면';
    openWin('인연', `<div class="ohd"><img class="sil" src="${portOf(d)}" alt=""><div><b>???</b><small>${how} 인연을 쌓을 수 있어요</small></div></div><button class="bigbtn ghost" id="tBack">목록으로</button>`);
    $('#tBack').onclick = () => openTies();
    return;
  }
  const t = tie(id);
  const st = t.stage;
  const toNext = st >= 5 ? '' : ` · 다음 「${stageName(st + 1)}」까지 ${Math.max(0, Math.ceil(st * CONFIG.ties.perStage - t.pts))}`;
  const owned = GIFT_KEYS.filter((g) => (P.gifts[g] ?? 0) > 0);
  openWin(
    `인연 · ${d.name}`,
    `<div class="ohd"><img src="${portOf(d)}" alt=""><div><b>${esc(d.name)} <span class="hearts">${hearts(st)}</span></b><small>${stageName(st)}${t.rel ? ` · ${t.rel === 'lover' ? '연인' : '전우'}` : ''}${toNext}</small>
      <small>${P.owner?.linked.includes(id) ? '연결된 영웅 · 인연 1.3배' : ''}</small></div></div>
    <div class="bar"><span>인연</span><i><b style="width:${t.pts}%;background:#e86a8a"></b></i><em>${Math.floor(t.pts)}</em></div>
    <div class="acc"><div>좋아하는 것<b>${t.knowLike ? GIFTS[d.likes].name : '???'}</b></div><div>싫어하는 것<b>${t.knowHate ? GIFTS[d.hates].name : '???'}</b></div></div>
    <div class="menu grid"><button id="tTalk">말 걸기</button><button id="tShop">선물 가게</button></div>
    <div class="qhd"><b class="g">선물하기</b><span class="note">하루 한 번</span></div>
    <div class="gifts">${owned.length ? owned.map((g) => `<button data-gift="${g}">${GIFTS[g].name} ×${P.gifts[g]}</button>`).join('') : '<p class="note">가방에 선물이 없어요 · 선물 가게에서 사요</p>'}</div>
    <button class="bigbtn ghost" id="tBack">목록으로</button>`,
    'tie1',
  );
  $('#tBack').onclick = () => openTies();
  $('#tShop').onclick = () => openGifts(id);
  $('#tTalk').onclick = () => {
    const err = talkTo(id);
    if (err) return toast(err);
    closeWin();
  };
  $$('[data-gift]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = giveGift(id, b.dataset.gift as GiftKey);
        if (r.err) return toast(r.err);
        closeWin();
        talk([[d.port, r.line!, undefined, d.name], ['narr', r.kind === 'like' ? `${d.name}${josa(d.name, '가')} 좋아하는 것을 알아냈다!` : r.kind === 'hate' ? `${d.name}${josa(d.name, '는')} 이걸 싫어한다…` : '인연이 조금 깊어졌다.']]);
        markDirty();
      }),
  );
}

// ═════════════ 선물 가게 ═════════════

export function openGifts(back?: string) {
  openWin(
    '선물 가게',
    `<p class="sub">금화 ${fmt(S.gold)} · 사람마다 좋아하는 것 하나, 싫어하는 것 하나가 있어요</p>
    <div class="shop">${GIFT_KEYS.map((g) => `<div class="irow"><span>${GIFTS[g].name}<small>가방 ${P.gifts[g] ?? 0}</small></span><button data-buy="${g}">${fmt(GIFTS[g].cost)}G</button></div>`).join('')}</div>
    <button class="bigbtn ghost" id="gBack">${back ? '돌아가기' : '주인 정보'}</button>`,
  );
  $$('[data-buy]').forEach(
    (b) =>
      (b.onclick = () => {
        const err = buyGift(b.dataset.buy as GiftKey);
        if (err) return toast(err);
        toast(`${GIFTS[b.dataset.buy as GiftKey].name}${josa(GIFTS[b.dataset.buy as GiftKey].name, '을')} 샀어요`);
        openGifts(back);
      }),
  );
  $('#gBack').onclick = () => (back ? openTie(back) : openOwner());
}

// ═════════════ 엔딩 앨범 ═════════════

const ownerPortOf = (card: { job: Job; gender: Gender }) => PORTRAITS[mcPortrait(card.job, card.gender)] || '';

function cardHtml(e: EndingDef, big = false): string {
  const card = P.legacy.cards[e.id];
  if (!card) return '';
  const partner = e.partner ? bondById(e.partner) : card.partner ? bondById(card.partner) : null;
  return `<div class="ecard ${big ? 'big' : ''} t-${e.type}"><div class="eports"><img src="${ownerPortOf(card)}" alt="">${partner ? `<img src="${portOf(partner)}" alt="">` : ''}</div>
    <b>${esc(e.title)}</b><small>${esc(card.owner)}${partner ? ` · ${esc(partner.name)}${card.rel ? ` (${card.rel === 'lover' ? '연인' : '전우'})` : ''}` : ''} · ${card.gen}대</small></div>`;
}

export function openAlbum() {
  const groups: [string, EndingDef['type']][] = [['모험 엔딩', 'adventure'], ['여관 엔딩', 'inn'], ['진짜 엔딩', 'true'], ['특별', 'solo']];
  openWin(
    `엔딩 앨범 ${albumCount()}`,
    `<p class="sub">지금까지 본 엔딩 전부 (새 여관을 열어도 남아요) · 유산 보너스는 이 마을에서 본 엔딩만큼 쌓여요 (지금 ${P.legacy.seen.length}개) · 유산 포인트 ${P.legacy.pts}</p>
    ${groups
      .map(
        ([g, ty]) =>
          `<div class="qhd"><b class="g">${g}</b></div><div class="album">${ENDINGS.filter((e) => e.type === ty)
            .map((e) =>
              P.legacy.album.includes(e.id)
                ? `<button class="acell seen" data-e="${e.id}">${cardHtml(e)}</button>`
                : `<div class="acell"><span class="silh">?</span><small>${esc(e.hint)}</small></div>`,
            )
            .join('')}</div>`,
      )
      .join('')}
    ${storyAlbumHtml()}
    <button class="bigbtn ghost" id="aBack">주인 정보</button>`,
    'albumw',
  );
  $$('[data-e]').forEach((b) => (b.onclick = () => replayEnding(b.dataset.e!)));
  bindStoryAlbum(openAlbum);
  $('#aBack').onclick = () => openOwner();
}

function epilogue(e: EndingDef, rel?: 'lover' | 'comrade'): TalkLine[] {
  const lines = [...e.lines, ...(rel === 'lover' ? e.lover ?? [] : rel === 'comrade' ? e.comrade ?? [] : [])];
  return [['narr', `— ${e.title} —`], ...lines.map((t) => ['narr', fillT(t)] as TalkLine)];
}

function replayEnding(id: string) {
  const e = endingById(id)!;
  musicFlags.ending = e.type === 'inn' ? 'ending_inn' : 'ending_adv';
  const card = P.legacy.cards[id];
  closeWin();
  talk(epilogue(e, card?.rel), () => openWin(e.title, `${cardHtml(e, true)}<p class="note">유산 보너스: ${esc(bonusText(e))}</p><button class="bigbtn ghost" id="aBack2">앨범으로</button>`, 'endw'));
  setTimeout(() => {
    const b = document.getElementById('aBack2');
    if (b) b.onclick = () => openAlbum();
  }, 0);
}

// ═════════════ 다시 떠난다: 동료 고르기 · 엔딩 ═════════════

function openPartner(list: BondDef[], solo: boolean, done: (id: string | null) => void) {
  openWin(
    '누구와 떠날까요?',
    `<p class="sub">인연 「인연」 단계의 동료와 함께, 또는 홀로</p>
    <div class="steps">${list.map((d) => `<button class="stp" data-p="${d.id}"><img class="sp" src="${portOf(d)}" alt=""><span><b>${esc(d.name)}</b><small>${P.ties[d.id]?.rel === 'lover' ? '연인' : '전우'}${P.owner?.linked.includes(d.id) ? ' · 옛 인연' : ''}</small></span><em>›</em></button>`).join('')}
    ${solo ? '<button class="stp" data-p=""><span><b>홀로 떠난다</b><small>담력이 충분하다</small></span><em>›</em></button>' : ''}</div>
    <p class="note">창을 닫으면 다음 밤에 다시 물어요.</p>`,
  );
  $$('[data-p]').forEach(
    (b) =>
      (b.onclick = () => {
        closeWin();
        done(b.dataset.p || null);
      }),
  );
}

/** 엔딩: 에필로그 → 엔딩 카드 → 유산을 잇는다 / 계속 운영한다 */
function playEnding(ids: string[], partner: string | null, rel: 'lover' | 'comrade' | undefined) {
  const main = endingById(ids[0])!;
  musicFlags.ending = main.type === 'inn' ? 'ending_inn' : 'ending_adv';
  const extra = ids.slice(1).map((i) => endingById(i)!);
  const lines: TalkLine[] = [...epilogue(main, main.type === 'adventure' ? rel : undefined), ...extra.flatMap((e) => epilogue(e, rel))];
  // STORY_V1 §5: 엔딩을 볼 때마다 기억 조각 하나 · 유산 포인트
  const g = lastGrant;
  const mem = g.mem >= 0 ? MEMORIES[g.mem] : null;
  if (mem) lines.push(['narr', `기억 조각을 얻었다 — ${mem.title}`], ...storyLines(mem.lines).map((x) => x.line));
  const p = partner ? bondById(partner) : null;
  const show = () => {
    openWin(
      '엔딩',
      `${[main, ...extra].map((e) => cardHtml(e, true)).join('')}
      <p class="sub">엔딩 앨범에 기록되었어요 (${albumCount()})</p>
      <p class="note">유산 보너스: ${[main, ...extra].map((e) => esc(bonusText(e))).join(' · ')} · 유산 포인트 +${g.pts} (모은 포인트 ${P.legacy.pts})</p>
      <div class="btnrow"><button class="bigbtn" id="eNext">유산을 잇는다</button><button class="bigbtn ghost" id="eStay">계속 운영한다</button></div>
      <p class="note">유산을 이으면 마을·영웅·도감은 그대로, 새 주인으로 처음부터. 계속 운영해도 나중에 주인 정보에서 이을 수 있어요.</p>`,
      'endw',
    );
    setWinLock(true);
    $('#eNext').onclick = () => {
      setWinLock(false);
      openCreate('legacy', () => toast(`${P.owner!.name}${josa(P.owner!.name, '가')} 새 주인이 되었어요 · ${P.legacy.gen}대`));
    };
    $('#eStay').onclick = () => {
      setWinLock(false);
      closeWin();
      toast('같은 주인으로 계속 운영해요');
    };
  };
  if (p) talkDuo(lines, p.port, show);
  else talk(lines, show);
}
