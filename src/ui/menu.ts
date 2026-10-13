// 5단계 4장: 아이콘 격자 메뉴 (여관 · 모험 · 수집 · 교류 · 상점 · 시스템) — 잠긴 것도 보이게(자물쇠 + 열리는 조건)
// + 업적 · 칭호 · 출석 · 상점 · 우편함 · 안내서 · 설정 · 임무 목록
import { tileDot } from './redDots';
import { ACHIEVEMENTS } from '../data/achieve';
import { flag, type FlagKey } from '../world/flags';
import { MANUAL_V2 } from '../data/story/manual';
import { INBOX_NAME, inboxMode, PROP_FILTER_NAME, propFilterMode, setInboxMode, setPropFilterMode, type InboxMode, type PropFilterMode } from '../world/storyInbox';
import { communityLink, openCommunity } from './community';
import { goalPillOn, setGoalPill } from './goalPill';
import { openFirstsList, setWfBubbles, wfBubblesOn } from './wayfind';
import { PROP_CARD_NAME, propCardMode, setPropCardMode, type PropCardMode } from './propCard';
import { setShakeLv, SHAKE_NAME, shakeLv, type ShakeLv } from '../engine/shake';
import { enterPhoto } from './photo';
import { autoSalvageHtml, bindAutoSalvage } from './bulkSalvage';
import { CHAPTERS } from '../data/guide';
import { CONFIG } from '../data/config';
import * as game from '../game';
import { online, me } from '../net/server';
import { featureChapter, feature, currentMission, missionProgress } from '../world/guide';
import {
  achProgress, achReady, achVisible, ATTEND7, ATTEND28, buyShop, claimAch, claimAllMail, claimMail, ensureShop, mailWaiting, myTitle, rewardLine, setTitle,
  SHOP_FIXED, SHOP_POOL, shopOpen, titlesOwned, deleteMail, deleteReadMail, readMailCount } from '../world/meta';
import { markDirty, P, S, world } from '../world/state';
import { openAccount } from './account';
import { resetBattleHints } from './battle';
import { openDex, openGoals, openLedger } from './book';
import { openChat, rumorEnabled, setRumor } from './chat';
import { setSettle, settleOn } from './daily';
import { bindSoundSettings, soundSettingsHtml } from './sound';
import { $, $$, claimOrder, esc, fmt, keepScroll } from './common';
import { openBoard } from './expedition';
import { openBag, openGuests } from './guests';
import { openHunt } from './hunt';
import { iconSrc, type IconKey } from './kit';
import { openPlace } from './nav';
import { openVillage } from './neighbors';
import { openNotices } from './notice';
import { openJourney } from './journey';
import { openOpsBox, openRumorSend } from './opsbox';
import { amAdmin, rumorSendReady } from '../net/direction';
import { openAlbum, openGifts, openOwner, openTies } from './owner';
import { openRank } from './rank';
import { screen, setFontStep } from './screen';
import { closeWin, helpHook, openReport, openWin, toast } from './windows';
import { setTelemetry, telemetryOn, track as trackEv } from '../net/telemetry';
import { saverOn, setSaver } from '../engine/fps';
import { getPref, setPref, writeSave } from '../save/save';
import { enterSaver, setSsAutoMin, setSsWake, SS_AUTO_OPTS, ssAutoMin, ssWakeOn } from './screenSaver';
import { bindDeleteRow, deleteRowHtml } from './accountDelete';
import { APP_VERSION, openPatchNotes } from './update';
import { labOn, setLab, vis } from '../world/visual';
import { CHEM_NOTICE_NAME, chemNoticeMode, chemUnread, type ChemNotice } from '../world/chemNews';
import { ACTION_NAME, COMBAT_ACTIONS, keyLabel, keysShown, resetKeys, setKey, VILLAGE_ACTIONS, type Action } from '../engine/keys';

const has = (k: string) => (world.home?.objs ?? world.objs).some((o) => o.kind === k && o.build === undefined);

interface Item {
  icon: IconKey;
  name: string;
  open: () => void;
  /** 잠겼으면 열리는 조건 */
  lock?: string | null;
  dot?: boolean;
}

function groups(): [string, Item[]][] {
  const gate = (f: Parameters<typeof feature>[0]) => (feature(f) ? null : `장부 ${featureChapter(f)}장`);
  return [
    ['여관', [
      { icon: 'm_owner', name: '주인 정보', open: () => openOwner(), lock: P.owner ? null : '주인을 만들면' },
      { icon: 'm_guests', name: '손님', open: () => openGuests() },
      { icon: 'm_heroes', name: '영웅', open: () => openDex(3) },
      { icon: 'm_bond', name: '인연', open: () => openTies(), lock: P.owner ? null : '주인을 만들면' },
      { icon: 'm_bag', name: '가방', open: () => openBag() },
      { icon: 'm_smith', name: '대장간', open: () => openPlace('smith'), lock: gate('smith') ?? (has('smith') ? null : '대장간을 지으면'), dot: tileDot('smith') },
      { icon: 'm_garden', name: '텃밭', open: () => openPlace('garden'), lock: gate('garden') ?? (has('garden') ? null : '텃밭을 지으면'), dot: tileDot('garden') },
      { icon: 'm_dex', name: '수입 장부', open: () => openLedger(chemUnread() ? 2 : undefined), dot: chemUnread() > 0 },
    ]],
    ['모험', [
      { icon: 'm_quest', name: '임무(장부)', open: () => openGuideList(), dot: tileDot('quest') },
      { icon: 'm_hunt', name: '사냥', open: () => openHunt(), lock: gate('hunt') },
      { icon: 'm_expedition', name: '원정', open: () => openBoard(), dot: tileDot('exp') },
      { icon: 'm_raid', name: '토벌', open: () => openBoard(), lock: gate('raid') },
      { icon: 'm_rank', name: '랭킹', open: () => void openRank() },
      { icon: 'm_quest', name: '오늘의 목표', open: () => openGoals(), dot: tileDot('goals') },
    ]],
    ['수집', [
      { icon: 'm_dex', name: '도감', open: () => openDex() },
      // DIRECTION §1-1: 여정 (완주가 보이게)
      { icon: 'm_quest', name: '여정', open: () => openJourney() },
      { icon: 'm_achieve', name: '업적', open: () => openAchieve(), dot: tileDot('ach') ?? achReady() > 0 },
      { icon: 'm_title', name: '칭호', open: () => openTitles() },
      { icon: 'm_album', name: '엔딩 앨범', open: () => openAlbum() },
      { icon: 'm_album', name: '📷 사진 찍기', open: () => { closeWin(); enterPhoto(); } },
    ]],
    ['교류', [
      { icon: 'm_neighbor', name: '이웃', open: () => void openVillage() },
      { icon: 'm_chat', name: '채팅', open: () => openChat() },
      { icon: 'm_mail', name: '우편함', open: () => openMail(), dot: tileDot('mail') ?? mailWaiting() > 0 },
      { icon: 'm_notice', name: '공지', open: () => openNotices() },
      // DIRECTION §2-3: 소문 보내기 (서버 준비 · 로그인 때만 보인다)
      ...(rumorSendReady() ? [{ icon: 'm_chat' as IconKey, name: '소문 보내기', open: () => openRumorSend() }] : []),
    ]],
    ['상점', [
      { icon: 'm_shop', name: '상점', open: () => openShop(), lock: shopOpen() ? null : `장부 ${featureChapter('shop')}장` },
      { icon: 'm_attendance', name: '출석', open: () => openAttend() },
    ]],
    ['시스템', [
      { icon: 'm_account', name: online() ? '계정' : '로그인', open: () => openAccount() },
      { icon: 'm_settings', name: '설정', open: () => openSettings() },
      // CHECKIN §L1: 화면 보호 (플래그·실험실 끔이면 칸 없음)
      ...(vis('screenSaver') ? [{ icon: 'm_settings' as IconKey, name: '화면 보호', open: () => enterSaver() }] : []),
      { icon: 'm_guide', name: '안내서', open: () => openManual() },
      { icon: 'm_letter', name: '모모에게 편지', open: () => openReport() },
      // DIRECTION §2-1: 운영자 계정만 「제보함」
      ...(amAdmin() ? [{ icon: 'm_mail' as IconKey, name: '제보함', open: () => void openOpsBox() }] : []),
      { icon: 'm_album', name: '만든 사람', open: () => openCredits() },
      { icon: 'm_chat', name: '💬 유저 톡방', open: () => openCommunity('menu') },
    ]],
  ];
}

/** 만든 사람 (크레딧) · 빌려 쓴 그림·글꼴 */
export function openCredits() {
  openWin(
    '만든 사람',
    `<div class="credits"><p class="pn-title">용사님, 체크인하실게요~</p><p class="sub">Legacy of Adventure</p>
    <p class="pn-h">몬스터 · 보스 · 이펙트</p><p>Ninja Adventure Asset Pack — pixel-boy (CC0)</p>
    <p class="pn-h">글꼴</p><p>Galmuri — quiple (SIL Open Font License)</p>
    <p class="sub">그 밖의 그림 · 음악 · 코드는 「용사님, 체크인하실게요~」 제작팀이 만들었어요</p></div>`,
  );
}

/** 격자 메뉴 */
export function openGridMenu() {
  const gs = groups();
  openWin(
    '메뉴',
    `${myTitle() ? `<p class="sub">칭호 「<b class="g">${esc(myTitle())}</b>」</p>` : ''}${gs
      .map(
        ([g, items], gi) =>
          `<section class="mgroup"><div class="mgrp"><b class="g">${g}</b></div><div class="mgrid">${items
            .map(
              (it, i) =>
                `<button class="mtile ${it.lock ? 'lock' : ''}" data-m="${gi}-${i}"><img src="${iconSrc(it.icon)}" alt=""><span>${esc(it.name)}</span>${it.lock ? `<small>${esc(it.lock)}에 열려요</small><u class="lk"></u>` : ''}${it.dot ? '<i class="mdot"></i>' : ''}</button>`,
            )
            .join('')}</div></section>`,
      )
      .join('')}`,
    'menuw',
  );
  $$('[data-m]').forEach(
    (b) =>
      (b.onclick = () => {
        const [gi, i] = b.dataset.m!.split('-').map(Number);
        const it = gs[gi][1][i];
        if (it.lock) return toast(`${it.name}: ${it.lock}에 열려요`);
        it.open();
      }),
  );
}

// ───────── 임무 목록 (버나드의 장부) ─────────

export function openGuideList() {
  const cur = currentMission();
  openWin(
    '버나드의 장부',
    `<p class="sub">완료 ${P.guide.claimed.length}/40 · 지금 임무는 화면 왼쪽 위 카드에서 받아요</p>${CHAPTERS.map(
      (c) =>
        `<div class="qhd"><b class="g">${c.no}장 「${esc(c.name)}」</b><span class="note">${esc(c.rewardText)}</span></div><div class="mlist">${c.missions
          .map((m) => {
            const done = P.guide.claimed.includes(m.id);
            const now = cur?.id === m.id;
            const pr = now ? missionProgress(m) : null;
            return `<div class="mrow ${done ? 'done' : now ? 'now' : ''}"><span>${done ? '✓' : now ? '▶' : '·'}</span><b>${now || done ? esc(m.title) : c.no <= (cur?.ch ?? 8) ? esc(m.title) : '???'}</b><em>${done ? '완료' : pr ? `${pr.cur}/${pr.need}` : ''}</em></div>`;
          })
          .join('')}</div>`,
    ).join('')}`,
  );
}

// ───────── 업적 ─────────

export function openAchieve() {
  // 핫픽스 11 §9-1: 받기 가능 → 진행 중(진행률 순) → 받음
  const sorted = claimOrder(ACHIEVEMENTS, (d) => {
    const pr = achProgress(d);
    return { ready: pr.done && !pr.claimed, got: pr.claimed, ratio: pr.cur / Math.max(1, pr.need) };
  });
  const readyIds = sorted.filter((d) => achProgress(d).done && !achProgress(d).claimed).map((d) => d.id);
  const rows = sorted.map((d) => {
    const v = achVisible(d);
    const pr = achProgress(d);
    const rw = [d.reward.gold ? `금화 ${fmt(d.reward.gold)}` : '', d.reward.dust ? `가루 ${d.reward.dust}` : '', d.reward.title ? `칭호 「${d.reward.title}」` : ''].filter(Boolean).join(' · ');
    return `<div class="arow ${pr.claimed ? 'got' : pr.done ? 'ready' : ''}"><span><b>${v ? esc(d.name) : '???'}</b><small>${v ? esc(d.desc) : '숨겨진 업적 · 장부 7장에 보여요'}</small>
      <i class="abar"><u style="width:${(pr.cur / pr.need) * 100}%"></u></i><small>${fmt(pr.cur)}/${fmt(pr.need)} · ${v ? rw : '보상 ???'}</small></span>
      ${pr.claimed ? '<em>받음</em>' : pr.done ? `<button data-a="${d.id}">받기</button>` : ''}</div>`;
  }).join('');
  const got = P.meta.ach.length;
  openWin('업적', `<p class="sub">${got}/${ACHIEVEMENTS.length} · 받을 수 있는 업적 ${achReady()}개</p>${readyIds.length >= 2 ? `<button class="bigbtn sm claimall" id="aAll">모두 받기 (${readyIds.length})</button>` : ''}<div class="alist">${rows}</div>`);
  const aa = document.getElementById('aAll');
  if (aa)
    aa.onclick = () => {
      let gold = 0;
      let dust = 0;
      for (const id of readyIds) {
        const r = claimAch(id);
        gold += r?.gold ?? 0;
        dust += r?.dust ?? 0;
      }
      toast(`업적 보상 ${readyIds.length}개 · ${[gold ? `금화 +${fmt(gold)}` : '', dust ? `가루 +${dust}` : ''].filter(Boolean).join(' · ') || '칭호'}`);
      keepScroll(openAchieve);
    };
  $$('[data-a]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimAch(b.dataset.a!);
        if (!r) return;
        toast(`업적 보상 · ${[r.gold ? `금화 +${fmt(r.gold)}` : '', r.dust ? `가루 +${r.dust}` : '', r.title ? `칭호 「${r.title}」` : ''].filter(Boolean).join(' · ')}`);
        keepScroll(openAchieve);
      }),
  );
}

// ───────── 칭호 ─────────

export function openTitles() {
  const list = titlesOwned();
  const cur = myTitle();
  openWin(
    '칭호',
    `<p class="sub">이름표에 붙는 칭호 (이웃 방문·랭킹 내 줄·메뉴에 보여요)</p>
    <div class="steps">${list.length ? list.map((x) => `<button class="stp ${x.t === cur ? 'cur' : ''}" data-t="${esc(x.t)}"><span style="grid-column:1/3"><b>「${esc(x.t)}」</b><small>${esc(x.from)}</small></span><em>${x.t === cur ? '달고 있음' : '달기'}</em></button>`).join('') : '<p class="note">아직 칭호가 없어요 · 업적·토벌·영웅 세트·엔딩에서 얻어요</p>'}</div>
    ${cur ? '<button class="bigbtn ghost sm" id="tOff">칭호 떼기</button>' : ''}`,
  );
  $$('[data-t]').forEach(
    (b) =>
      (b.onclick = () => {
        setTitle(b.dataset.t!);
        toast(`칭호 「${b.dataset.t}」를 달았어요`);
        openTitles();
      }),
  );
  const off = document.getElementById('tOff');
  if (off)
    off.onclick = () => {
      setTitle('');
      openTitles();
    };
}

// ───────── 출석 ─────────

export function openAttend() {
  const a = P.meta.attend;
  const day7 = a.total ? ((a.total - 1) % 7) + 1 : 0;
  const day28 = a.total ? ((a.total - 1) % 28) + 1 : 0;
  const cells = ATTEND7.map((r, i) => `<div class="atc ${i < day7 ? 'got' : ''}"><b>${i + 1}일</b><small>${esc(rewardLine(r))}</small>${i < day7 ? '<i>✓</i>' : ''}</div>`).join('');
  const big = Object.entries(ATTEND28)
    .map(([d, r]) => `<div class="atc big ${+d <= day28 ? 'got' : ''}"><b>${d}일</b><small>${esc(rewardLine(r))}</small>${+d <= day28 ? '<i>✓</i>' : ''}</div>`)
    .join('');
  openWin(
    '출석',
    `<p class="sub">매일 첫 접속 때 도장이 찍혀요 · 보상은 우편함으로 · 누적 ${a.total}일</p>
    <div class="qhd"><b class="g">7일 보상판</b></div><div class="attend">${cells}</div>
    <div class="qhd"><b class="g">28일 누적</b><span class="note">${day28}/28</span></div><div class="attend big">${big}</div>
    <button class="bigbtn" id="atMail">우편함 열기${mailWaiting() ? ` (${mailWaiting()})` : ''}</button>`,
  );
  $('#atMail').onclick = () => openMail();
}

// ───────── 우편함 ─────────

const FROM: Record<string, string> = { attend: '출석', rank: '랭킹', admin: '운영자', prev: '앞 주인', system: '여관' };
let mailDelArmed = false;
export function openMail() {
  const list = P.meta.mail;
  openWin(
    '우편함',
    `<p class="sub">출석·랭킹 보상 · 운영자 선물 · 앞 주인 편지</p>
    <div class="btnrow">${mailWaiting() ? `<button class="bigbtn" id="mlAll">모두 받기 (${mailWaiting()})</button>` : ''}${readMailCount() && flag('mailDelete') ? `<button class="bigbtn ghost ${mailDelArmed ? 'red' : ''}" id="mlDel">${mailDelArmed ? '한 번 더 누르면 지워요' : `읽은 편지 지우기 (${readMailCount()})`}</button>` : ''}</div>
    <div class="mails">${list.length ? list.map((m) => `<div class="mail ${m.claimed ? 'got' : ''}"><span><small>${FROM[m.from] ?? ''} · ${new Date(m.at).toLocaleDateString('ko-KR')}</small><b>${esc(m.title)}</b><small>${esc(m.body)}</small>${m.link === 'kakao' ? communityLink('mail', '톡방 가기 →') : ''}${rewardLine(m.reward) ? `<small class="g">${esc(rewardLine(m.reward))}</small>` : ''}</span>${m.claimed && !flag('mailDelete') ? '<em>받음</em>' : m.claimed ? `<button class="mldel" data-mldel="${m.id}" aria-label="이 편지 지우기">✕</button>` : `<button data-ml="${m.id}">${rewardLine(m.reward) ? '받기' : '읽음'}</button>`}</div>`).join('') : '<p class="note">편지가 없어요</p>'}</div>`,
  );
  $$('[data-ml]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimMail(+b.dataset.ml!);
        if (r && rewardLine(r)) toast(`받았어요 · ${rewardLine(r)}`);
        openMail();
      }),
  );
  $$('[data-mldel]').forEach(
    (b) =>
      (b.onclick = () => {
        deleteMail(+b.dataset.mldel!);
        mailDelArmed = false;
        keepScroll(openMail);
      }),
  );
  const del = document.getElementById('mlDel');
  if (del)
    del.onclick = () => {
      // 실수 방지: 창 안에서 한 번 더 누르기 (confirm() 안 씀)
      if (!mailDelArmed) {
        mailDelArmed = true;
        return openMail();
      }
      mailDelArmed = false;
      const n = deleteReadMail();
      toast(`읽은 편지 ${n}통을 지웠어요`);
      openMail();
    };
  const all = document.getElementById('mlAll');
  if (all)
    all.onclick = () => {
      const n = claimAllMail();
      toast(`${n}통을 받았어요`);
      openMail();
    };
}

// ───────── 상점 ─────────

export function openShop() {
  if (!shopOpen()) return toast(`상점은 장부 ${featureChapter('shop')}장을 마치면 열려요`);
  ensureShop();
  const row = (id: string, daily: boolean) => {
    const it = [...SHOP_POOL, ...SHOP_FIXED].find((x) => x.id === id)!;
    const sold = daily && P.meta.shop.bought.includes(id);
    return `<div class="irow shopi ${sold ? 'sold' : ''}"><img src="${iconSrc(it.icon as IconKey)}" alt=""><span>${esc(it.name)}<small>${esc(it.desc)}</small></span><button data-buy="${id}" ${sold ? 'disabled' : ''}>${sold ? '품절' : it.tokens ? `증표 ${it.tokens}` : `${fmt(it.cost)}G`}</button></div>`;
  };
  openWin(
    '상점',
    `<p class="sub">금화 <b class="g">${fmt(S.gold)}</b> · 오늘의 진열은 매일 바뀌어요</p>
    <div class="qhd"><b class="g">오늘의 진열</b></div><div class="shop">${P.meta.shop.items.map((id) => row(id, true)).join('')}</div>
    <div class="qhd"><b class="g">늘 파는 것</b></div><div class="shop">${SHOP_FIXED.map((x) => row(x.id, false)).join('')}<div class="irow shopi"><img src="${iconSrc('m_bond')}" alt=""><span>선물 가게<small>인연 선물 12종</small></span><button id="shGift">가기</button></div></div>`,
  );
  $$('[data-buy]').forEach(
    (b) =>
      (b.onclick = () => {
        const err = buyShop(b.dataset.buy!);
        if (err) return toast(err);
        toast('샀어요');
        markDirty();
        openShop();
      }),
  );
  $('#shGift').onclick = () => (P.owner ? openGifts() : toast('주인을 만들면 열려요'));
}

// ───────── 설정 (예전 메뉴의 설정 칸) ─────────

/** VISUAL 실험실: 「새 화면 미리 보기」 — 운영자(또는 테스터 공개 플래그)만 · 이미 켠 기기는 끌 수 있게 늘 보임 */
function labRowHtml(): string {
  if (!amAdmin() && !flag('visualLabOpen') && !labOn()) return '';
  return `<label class="tog"><input type="checkbox" id="mLab" ${labOn() ? 'checked' : ''}> 새 화면 미리 보기 <small>(실험 중 · 팔레트·조용한 숲·새 HUD·창 틀 · 이 기기만 · 바꾸면 다시 불러와요)</small></label>`;
}

/** CHECKIN §A1 「단골 제안 받을 손님」 · §A2 「곁이야기」 — 케미 알림 옆 (플래그를 끄면 줄도 없음) */
function checkinRowsHtml(): string {
  const a1 = vis('propFilter') ? `<label class="tog">단골 제안 받을 손님 <select id="mPropF">${(['useful', 'all', 'none'] as const).map((k) => `<option value="${k}" ${propFilterMode() === k ? 'selected' : ''}>${PROP_FILTER_NAME[k]}</option>`).join('')}</select></label>` : '';
  const a2 = vis('storyInbox') ? `<label class="tog">곁이야기 <select id="mInbox">${(['collect', 'now'] as const).map((k) => `<option value="${k}" ${inboxMode() === k ? 'selected' : ''}>${INBOX_NAME[k]}</option>`).join('')}</select></label>` : '';
  return a1 + a2;
}

// ───────── CHECKIN §L1 화면 보호 줄 · §C2 진동 줄 ─────────
/** 화면 보호: 자동 n분 · 화면 켜 두기 · [지금 켜기] (screenSaver 끔이면 빈 문자열) */
function saverRowsHtml(): string {
  if (!vis('screenSaver')) return '';
  return `<label class="tog">화면 보호 자동으로 <select id="mSsAuto">${SS_AUTO_OPTS.map((m) => `<option value="${m}" ${ssAutoMin() === m ? 'selected' : ''}>${m ? `${m}분 뒤` : '끔'}</option>`).join('')}</select></label>
    <label class="tog"><input type="checkbox" id="mSsWake" ${ssWakeOn() ? 'checked' : ''}> 화면 보호 중 화면 켜 두기 <small>(폰이 꺼지지 않게)</small></label>
    <button id="mSsGo">화면 보호 지금 켜기</button>`;
}
function bindSaverRows() {
  const a = document.getElementById('mSsAuto') as HTMLSelectElement | null;
  if (a) a.onchange = () => setSsAutoMin(+a.value);
  const w = document.getElementById('mSsWake') as HTMLInputElement | null;
  if (w) w.onchange = () => setSsWake(w.checked);
  const g = document.getElementById('mSsGo');
  if (g) g.onclick = () => enterSaver();
}
/** 진동 (J4 누르는 느낌이 읽는다: getPref('haptics', true)) */
export const hapticsOn = () => getPref<boolean>('haptics', true);

// ───────── CHECKIN §C2 설정 3탭 (settingsTabs) — 기본 / 알림 / 계정 ─────────
export type SettingsTab = 'base' | 'noti' | 'acct';
const STAB_NAME: Record<SettingsTab, string> = { base: '기본', noti: '알림', acct: '계정' };
let sTab: SettingsTab = 'base';
export function openSettings(tab?: SettingsTab) {
  if (!vis('settingsTabs')) return openSettingsClassic();
  if (tab && tab in STAB_NAME) sTab = tab;
  const tabs = `<div class="tabs stabs">${(Object.keys(STAB_NAME) as SettingsTab[]).map((k) => `<button class="tab ${k === sTab ? 'on' : ''}" data-stab="${k}">${STAB_NAME[k]}</button>`).join('')}</div>`;
  let body = '';
  if (sTab === 'base')
    body = `${soundSettingsHtml()}<div class="fsrow">글자 크기 ${CONFIG.UI_SCALE.userLabels.map((l, i) => `<button class="tab ${i === screen.fontStep ? 'on' : ''}" data-fs="${i}">${l}</button>`).join('')}</div>
    <div class="menu saverrow"><label class="tog"><input type="checkbox" id="mSaver" ${saverOn() ? 'checked' : ''}> 배터리 절약 <small>(화면을 조금 덜 자주 그려서 덜 뜨거워져요)</small></label>
    <label class="tog"><input type="checkbox" id="mHaptic" ${hapticsOn() ? 'checked' : ''}> 진동 <small>(버튼을 누를 때 짧게 · 안드로이드)</small></label>${saverRowsHtml()}${labRowHtml()}</div>
    <div class="menu">${autoSalvageHtml('mAuto')}<button id="mIntro">오프닝 다시 보기</button><button id="mHints">전투 안내 다시 보기</button></div>`;
  else if (sTab === 'noti')
    body = `<div class="menu">${checkinRowsHtml()}<label class="tog"><input type="checkbox" id="mRumor" ${rumorEnabled() ? 'checked' : ''}> 채팅에 [소문](마을 사람 수다) 보기</label><label class="tog"><input type="checkbox" id="mBrag" ${P.growth.bragOff ? 'checked' : ''}> 내 자랑 알림 끄기 <small>(득템·강화를 [알림]에 안 올려요)</small></label><label class="tog">케미 알림 <select id="mChem">${(['all', 'important', 'off'] as const).map((k) => `<option value="${k}" ${chemNoticeMode() === k ? 'selected' : ''}>${CHEM_NOTICE_NAME[k]}</option>`).join('')}</select></label><label class="tog"><input type="checkbox" id="mWfBub" ${wfBubblesOn() ? 'checked' : ''}> 길잡이 말풍선 (안 해 본 것 「!」)</label><label class="tog"><input type="checkbox" id="mGoalPill" ${goalPillOn() ? 'checked' : ''}> 「🎯 오늘」 목표 알약 보기</label><label class="tog"><input type="checkbox" id="mSettle" ${settleOn() ? 'checked' : ''}> 하루 마감 정산 카드 보기</label><label class="tog">단골 제안 카드 <select id="mPropCard">${(['full', 'simple'] as const).map((k) => `<option value="${k}" ${propCardMode() === k ? 'selected' : ''}>${PROP_CARD_NAME[k]}</option>`).join('')}</select></label><label class="tog">화면 흔들림 <select id="mShake">${(['off', 'low', 'normal'] as const).map((k) => `<option value="${k}" ${shakeLv() === k ? 'selected' : ''}>${SHAKE_NAME[k]}</option>`).join('')}</select></label></div>`;
  else
    body = `<div class="menu"><p class="note">${online() ? `로그인: ${esc(me.profile!.nickname)} · 폰·PC 어디서든 이어서 해요` : '로그인하지 않았어요 · 이 기기에만 저장돼요'}</p><button id="mAcct">${online() ? '계정 · 클라우드 저장' : '로그인 · 가입'}</button><button id="mKeys">⌨ 단축키 바꾸기 (PC)</button><label class="tog"><input type="checkbox" id="mTele" ${telemetryOn() ? 'checked' : ''}> 플레이 기록 보내기 (개인정보 없이 · 게임 개선용)</label><button id="mLetter">모모에게 편지 (버그 제보)</button><p class="note">버전 v${esc(APP_VERSION)}</p><button id="mNotes">패치노트</button><button id="mTitle">타이틀로</button></div>${deleteRowHtml()}`;
  openWin('설정', tabs + body);
  $$('[data-stab]').forEach((b) => (b.onclick = () => openSettings(b.dataset.stab as SettingsTab)));
  bindSettings();
  bindSaverRows();
  const hp = document.getElementById('mHaptic') as HTMLInputElement | null;
  if (hp) hp.onchange = () => setPref('haptics', hp.checked);
  const ac = document.getElementById('mAcct');
  if (ac) ac.onclick = () => openAccount();
  const pn = document.getElementById('mNotes');
  if (pn) pn.onclick = () => void openPatchNotes();
  if (sTab === 'acct') bindDeleteRow(!online());
}

function openSettingsClassic() {
  openWin(
    '설정',
    `${soundSettingsHtml()}<div class="menu saverrow"><label class="tog"><input type="checkbox" id="mSaver" ${saverOn() ? 'checked' : ''}> 배터리 절약</label><p class="note">화면을 조금 덜 자주 그려서 덜 뜨거워져요</p>${saverRowsHtml()}${labRowHtml()}</div><div class="fsrow">글자 크기 ${CONFIG.UI_SCALE.userLabels.map((l, i) => `<button class="tab ${i === screen.fontStep ? 'on' : ''}" data-fs="${i}">${l}</button>`).join('')}</div>
    <div class="menu">${autoSalvageHtml('mAuto')}<label class="tog"><input type="checkbox" id="mRumor" ${rumorEnabled() ? 'checked' : ''}> 채팅에 [소문](마을 사람 수다) 보기</label><label class="tog"><input type="checkbox" id="mBrag" ${P.growth.bragOff ? 'checked' : ''}> 내 자랑 알림 끄기 <small>(득템·강화를 [알림]에 안 올려요)</small></label><label class="tog">케미 알림 <select id="mChem">${(['all', 'important', 'off'] as const).map((k) => `<option value="${k}" ${chemNoticeMode() === k ? 'selected' : ''}>${CHEM_NOTICE_NAME[k]}</option>`).join('')}</select></label>${checkinRowsHtml()}<label class="tog">화면 흔들림 <select id="mShake">${(['off', 'low', 'normal'] as const).map((k) => `<option value="${k}" ${shakeLv() === k ? 'selected' : ''}>${SHAKE_NAME[k]}</option>`).join('')}</select></label><label class="tog"><input type="checkbox" id="mSettle" ${settleOn() ? 'checked' : ''}> 하루 마감 정산 카드 보기</label><label class="tog"><input type="checkbox" id="mGoalPill" ${goalPillOn() ? 'checked' : ''}> 「🎯 오늘」 목표 알약 보기</label><label class="tog"><input type="checkbox" id="mWfBub" ${wfBubblesOn() ? 'checked' : ''}> 길잡이 말풍선 (안 해 본 것 「!」)</label><label class="tog">단골 제안 카드 <select id="mPropCard">${(['full', 'simple'] as const).map((k) => `<option value="${k}" ${propCardMode() === k ? 'selected' : ''}>${PROP_CARD_NAME[k]}</option>`).join('')}</select></label><label class="tog"><input type="checkbox" id="mTele" ${telemetryOn() ? 'checked' : ''}> 플레이 기록 보내기 (개인정보 없이 · 게임 개선용)</label>
    <button id="mKeys">⌨ 단축키 바꾸기 (PC)</button><button id="mIntro">오프닝 다시 보기</button><button id="mHints">전투 안내 다시 보기</button><button id="mLetter">모모에게 편지 (버그 제보)</button><button id="mTitle">타이틀로</button></div>
    ${online() ? `<p class="note">로그인: ${esc(me.profile!.nickname)}</p>` : ''}`,
  );
  bindSettings();
  bindSaverRows();
}
/** 설정 창 줄 연결 — 예전 창·3탭 같이 (지금 창에 있는 줄만) */
function bindSettings() {
  // 탭에선 그 탭의 줄만 있다 — 없는 줄은 버리는 빈 요소에 연결
  const el = (id: string): HTMLElement => document.getElementById(id) ?? document.createElement('input');
  $$('[data-fs]').forEach(
    (b) =>
      (b.onclick = () => {
        setFontStep(+b.dataset.fs!);
        $$('[data-fs]').forEach((x) => x.classList.toggle('on', x === b));
      }),
  );
  bindAutoSalvage('mAuto');
  (el('mRumor') as HTMLInputElement).onchange = (e) => setRumor((e.target as HTMLInputElement).checked);
  (el('mBrag') as HTMLInputElement).onchange = (e) => {
    P.growth.bragOff = (e.target as HTMLInputElement).checked;
    markDirty();
  };
  (el('mSaver') as HTMLInputElement).onchange = (e) => {
    setSaver((e.target as HTMLInputElement).checked);
    trackEv('saver', { on: saverOn() });
    // 마을 캔버스 배율 상한이 바뀐다 (절약 1.5배) — 화면 크기 다시 맞추기
    dispatchEvent(new Event('resize'));
  };
  el('mLetter').onclick = () => openReport();
  el('mKeys').onclick = () => openKeys();
  const lab = el('mLab') as HTMLInputElement | null;
  if (lab)
    lab.onchange = () => {
      setLab(lab.checked);
      trackEv('visual_lab', { on: lab.checked });
      toast(lab.checked ? '새 화면으로 다시 불러와요…' : '원래 화면으로 다시 불러와요…');
      writeSave();
      setTimeout(() => location.reload(), 600);
    };
  bindSoundSettings();
  (el('mChem') as HTMLSelectElement).onchange = (e) => {
    const v = (e.target as HTMLSelectElement).value;
    setPref('chemNotice', v);
    trackEv('chem_notice', { mode: v });
    toast(`케미 알림: ${CHEM_NOTICE_NAME[v as ChemNotice]}`);
  };
  const pf = el('mPropF') as HTMLSelectElement | null;
  if (pf)
    pf.onchange = () => {
      setPropFilterMode(pf.value as PropFilterMode);
      trackEv('prop_filter', { mode: pf.value });
      toast(`단골 제안 받을 손님: ${PROP_FILTER_NAME[pf.value as PropFilterMode]}`);
    };
  const ib = el('mInbox') as HTMLSelectElement | null;
  if (ib)
    ib.onchange = () => {
      setInboxMode(ib.value as InboxMode);
      trackEv('story_inbox', { mode: ib.value });
      toast(`곁이야기: ${INBOX_NAME[ib.value as InboxMode]}`);
    };
  (el('mShake') as HTMLSelectElement).onchange = (e) => {
    setShakeLv((e.target as HTMLSelectElement).value as ShakeLv);
    toast(`화면 흔들림: ${SHAKE_NAME[(e.target as HTMLSelectElement).value as ShakeLv]}`);
  };
  (el('mSettle') as HTMLInputElement).onchange = (e) => setSettle((e.target as HTMLInputElement).checked);
  (el('mGoalPill') as HTMLInputElement).onchange = (e) => setGoalPill((e.target as HTMLInputElement).checked);
  (el('mWfBub') as HTMLInputElement).onchange = (e) => setWfBubbles((e.target as HTMLInputElement).checked);
  (el('mPropCard') as HTMLSelectElement).onchange = (e) => setPropCardMode((e.target as HTMLSelectElement).value as PropCardMode);
  (el('mTele') as HTMLInputElement).onchange = (e) => setTelemetry((e.target as HTMLInputElement).checked);
  el('mHints').onclick = () => {
    resetBattleHints();
    toast('다음 토벌·사냥 첫 판에 안내가 다시 나와요');
  };
  el('mIntro').onclick = () => {
    closeWin();
    game.replayOpening();
  };
  el('mTitle').onclick = () => {
    closeWin();
    game.toTitle();
  };
}

// ───────── 핫픽스 12 §5: 단축키 바꾸기 ─────────
let keyWait: Action | null = null;
let keyListen: ((e: KeyboardEvent) => void) | null = null;
export function openKeys() {
  const row = (a: Action) => `<button class="stp keyrow ${keyWait === a ? 'cur' : ''}" data-act="${a}"><span style="grid-column:1/3"><b>${ACTION_NAME[a]}</b></span><em>${keyWait === a ? '누를 키…' : keysShown(a).map(keyLabel).join(' / ')}</em></button>`;
  openWin(
    '단축키',
    `<p class="sub">바꿀 동작을 누르고, 쓰고 싶은 키를 눌러요 (Esc = 그만두기)</p>
    <div class="qhd"><b class="g">전투</b></div><div class="steps">${COMBAT_ACTIONS.map(row).join('')}</div>
    <div class="qhd"><b class="g">마을</b></div><div class="steps">${VILLAGE_ACTIONS.map(row).join('')}</div>
    <button class="bigbtn ghost sm" id="kReset">기본값으로 되돌리기</button>`,
  );
  $$('[data-act]').forEach(
    (b) =>
      (b.onclick = () => {
        keyWait = b.dataset.act as Action;
        keepScroll(openKeys);
      }),
  );
  $('#kReset').onclick = () => {
    resetKeys();
    keyWait = null;
    toast('단축키를 기본값으로 되돌렸어요');
    trackEv('keybind_change', { action: 'reset' });
    keepScroll(openKeys);
  };
  if (keyListen) removeEventListener('keydown', keyListen, true);
  keyListen = null;
  if (!keyWait) return;
  keyListen = (e: KeyboardEvent) => {
    // 창이 닫혔으면 기다리기 그만 (다음 키를 먹지 않게)
    if (!keyWait || !document.querySelector('#winB [data-act]')) {
      keyWait = null;
      if (keyListen) removeEventListener('keydown', keyListen, true);
      keyListen = null;
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    const a = keyWait;
    keyWait = null;
    if (keyListen) removeEventListener('keydown', keyListen, true);
    keyListen = null;
    if (e.key === 'Escape') return keepScroll(openKeys);
    const clash = setKey(a, e.key);
    if (clash) toast(`「${keyLabel(e.key.toLowerCase())}」는 이미 「${ACTION_NAME[clash]}」에 쓰고 있어요`);
    else {
      toast(`${ACTION_NAME[a]} = ${keyLabel(e.key.toLowerCase())}`);
      trackEv('keybind_change', { action: a, key: e.key.toLowerCase().slice(0, 12) });
    }
    keepScroll(openKeys);
  };
  addEventListener('keydown', keyListen, true);
}

// ───────── 안내서 「여관 운영 안내서」 ─────────

/** 안내서 v2 (17쪽 · 문구는 data/story/manual.ts 그대로) — 아이콘은 있는 것 중 가까운 것 */
const MANUAL_ICON: Record<string, IconKey> = { fishing: 'm_garden', legends: 'm_heroes', story: 'm_album', social: 'm_chat' };
export const MANUAL: { key: string; icon: IconKey; title: string; lines: string[] }[] = MANUAL_V2.map((p) => ({ ...p, icon: MANUAL_ICON[p.key] ?? (p.icon as IconKey) }));

/** 창 제목 → 안내서 쪽 */
export const HELP_OF: [RegExp, string][] = [
  [/^원정|의뢰/, 'expedition'], [/^사냥/, 'hunt'], [/^토벌/, 'raid'], [/^건설|땅 넓히기/, 'build'], [/^손님|단골/, 'guests'], [/대장간|텃밭/, 'smith'], [/^도감/, 'dex'],
  [/^주인|^인연|선물/, 'owner'], [/^업적|^칭호/, 'collect'], [/^상점|^출석|^우편함/, 'shop'], [/장부|오늘의 목표/, 'start'],
  // DIRECTION: 여정 → 이야기 쪽 · 소문 보내기 → 이웃·채팅 쪽
  [/^여정/, 'story'], [/^소문 보내기/, 'social'],
];

/** v0.25.2: 「@플래그 」 줄은 켜졌을 때만 · 「!플래그 」 줄은 꺼졌을 때만 (형철 확인 전 기능의 안내 줄) */
export const manualLines = (lines: string[]) =>
  lines.flatMap((l) => {
    const m = /^([@!])([A-Za-z0-9]+) /.exec(l);
    if (!m) return [l];
    return vis(m[2] as FlagKey) === (m[1] === '@') ? [l.slice(m[0].length)] : [];
  });
export function openManual(key?: string) {
  const page = MANUAL.find((p) => p.key === key);
  if (page) {
    openWin(`안내서 · ${page.title}`, `<div class="mpage"><img src="${iconSrc(page.icon)}" alt=""><div>${manualLines(page.lines).map((l) => `<p>${esc(l)}</p>`).join('')}</div></div><button class="bigbtn ghost sm" id="mnBack">목차</button>`);
    $('#mnBack').onclick = () => openManual();
    return;
  }
  openWin('여관 운영 안내서', `<p class="sub">기능마다 한 쪽씩 · 창 오른쪽 위 「?」를 누르면 그 쪽이 바로 열려요</p><div class="mgrid">${MANUAL.map((p) => `<button class="mtile" data-mn="${p.key}"><img src="${iconSrc(p.icon)}" alt=""><span>${esc(p.title)}</span></button>`).join('')}</div><button class="bigbtn sm" id="mnFirsts">✓ 처음 해 보기</button>`);
  $$('[data-mn]').forEach((b) => (b.onclick = () => openManual(b.dataset.mn)));
  $('#mnFirsts').onclick = () => openFirstsList();
}

/** 부팅 때: 창마다 「?」 → 안내서 그 쪽 */
export function initMenu() {
  helpHook.page = (title) => (title.startsWith('안내서') || title === '여관 운영 안내서' ? null : HELP_OF.find(([re]) => re.test(title))?.[1] ?? null);
  helpHook.open = (k) => openManual(k);
}
