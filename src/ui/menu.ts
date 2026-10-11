// 5단계 4장: 아이콘 격자 메뉴 (여관 · 모험 · 수집 · 교류 · 상점 · 시스템) — 잠긴 것도 보이게(자물쇠 + 열리는 조건)
// + 업적 · 칭호 · 출석 · 상점 · 우편함 · 안내서 · 설정 · 임무 목록
import { ACHIEVEMENTS } from '../data/achieve';
import { goalPillOn, setGoalPill } from './goalPill';
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
  SHOP_FIXED, SHOP_POOL, shopOpen, titlesOwned,
} from '../world/meta';
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
import { openAlbum, openGifts, openOwner, openTies } from './owner';
import { openRank } from './rank';
import { screen, setFontStep } from './screen';
import { closeWin, helpHook, openReport, openWin, toast } from './windows';
import { setTelemetry, telemetryOn, track as trackEv } from '../net/telemetry';
import { saverOn, setSaver } from '../engine/fps';
import { setPref } from '../save/save';
import { CHEM_NOTICE_NAME, chemNoticeMode, chemUnread, type ChemNotice } from '../world/chemNews';
import { ACTION_NAME, COMBAT_ACTIONS, keyLabel, keysFor, resetKeys, setKey, VILLAGE_ACTIONS, type Action } from '../engine/keys';

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
      { icon: 'm_smith', name: '대장간', open: () => openPlace('smith'), lock: gate('smith') ?? (has('smith') ? null : '대장간을 지으면') },
      { icon: 'm_garden', name: '텃밭', open: () => openPlace('garden'), lock: gate('garden') ?? (has('garden') ? null : '텃밭을 지으면') },
      { icon: 'm_dex', name: '수입 장부', open: () => openLedger(chemUnread() ? 2 : undefined), dot: chemUnread() > 0 },
    ]],
    ['모험', [
      { icon: 'm_quest', name: '임무(장부)', open: () => openGuideList() },
      { icon: 'm_hunt', name: '사냥', open: () => openHunt(), lock: gate('hunt') },
      { icon: 'm_expedition', name: '원정', open: () => openBoard() },
      { icon: 'm_raid', name: '토벌', open: () => openBoard(), lock: gate('raid') },
      { icon: 'm_rank', name: '랭킹', open: () => void openRank() },
      { icon: 'm_quest', name: '오늘의 목표', open: () => openGoals() },
    ]],
    ['수집', [
      { icon: 'm_dex', name: '도감', open: () => openDex() },
      { icon: 'm_achieve', name: '업적', open: () => openAchieve(), dot: achReady() > 0 },
      { icon: 'm_title', name: '칭호', open: () => openTitles() },
      { icon: 'm_album', name: '엔딩 앨범', open: () => openAlbum() },
      { icon: 'm_album', name: '📷 사진 찍기', open: () => { closeWin(); enterPhoto(); } },
    ]],
    ['교류', [
      { icon: 'm_neighbor', name: '이웃', open: () => void openVillage() },
      { icon: 'm_chat', name: '채팅', open: () => openChat() },
      { icon: 'm_mail', name: '우편함', open: () => openMail(), dot: mailWaiting() > 0 },
      { icon: 'm_notice', name: '공지', open: () => openNotices() },
    ]],
    ['상점', [
      { icon: 'm_shop', name: '상점', open: () => openShop(), lock: shopOpen() ? null : `장부 ${featureChapter('shop')}장` },
      { icon: 'm_attendance', name: '출석', open: () => openAttend() },
    ]],
    ['시스템', [
      { icon: 'm_account', name: online() ? '계정' : '로그인', open: () => openAccount() },
      { icon: 'm_settings', name: '설정', open: () => openSettings() },
      { icon: 'm_guide', name: '안내서', open: () => openManual() },
      { icon: 'm_letter', name: '모모에게 편지', open: () => openReport() },
      { icon: 'm_album', name: '만든 사람', open: () => openCredits() },
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
export function openMail() {
  const list = P.meta.mail;
  openWin(
    '우편함',
    `<p class="sub">출석·랭킹 보상 · 운영자 선물 · 앞 주인 편지</p>
    ${mailWaiting() ? `<button class="bigbtn" id="mlAll">모두 받기 (${mailWaiting()})</button>` : ''}
    <div class="mails">${list.length ? list.map((m) => `<div class="mail ${m.claimed ? 'got' : ''}"><span><small>${FROM[m.from] ?? ''} · ${new Date(m.at).toLocaleDateString('ko-KR')}</small><b>${esc(m.title)}</b><small>${esc(m.body)}</small>${rewardLine(m.reward) ? `<small class="g">${esc(rewardLine(m.reward))}</small>` : ''}</span>${m.claimed ? '<em>받음</em>' : `<button data-ml="${m.id}">${rewardLine(m.reward) ? '받기' : '읽음'}</button>`}</div>`).join('') : '<p class="note">편지가 없어요</p>'}</div>`,
  );
  $$('[data-ml]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimMail(+b.dataset.ml!);
        if (r && rewardLine(r)) toast(`받았어요 · ${rewardLine(r)}`);
        openMail();
      }),
  );
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
    return `<div class="irow shopi ${sold ? 'sold' : ''}"><img src="${iconSrc(it.icon as IconKey)}" alt=""><span>${esc(it.name)}<small>${esc(it.desc)}</small></span><button data-buy="${id}" ${sold ? 'disabled' : ''}>${sold ? '품절' : `${fmt(it.cost)}G`}</button></div>`;
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

export function openSettings() {
  openWin(
    '설정',
    `${soundSettingsHtml()}<div class="menu saverrow"><label class="tog"><input type="checkbox" id="mSaver" ${saverOn() ? 'checked' : ''}> 배터리 절약</label><p class="note">화면을 조금 덜 자주 그려서 덜 뜨거워져요</p></div><div class="fsrow">글자 크기 ${CONFIG.UI_SCALE.userLabels.map((l, i) => `<button class="tab ${i === screen.fontStep ? 'on' : ''}" data-fs="${i}">${l}</button>`).join('')}</div>
    <div class="menu">${autoSalvageHtml('mAuto')}<label class="tog"><input type="checkbox" id="mRumor" ${rumorEnabled() ? 'checked' : ''}> 채팅에 [소문](마을 사람 수다) 보기</label><label class="tog">케미 알림 <select id="mChem">${(['all', 'important', 'off'] as const).map((k) => `<option value="${k}" ${chemNoticeMode() === k ? 'selected' : ''}>${CHEM_NOTICE_NAME[k]}</option>`).join('')}</select></label><label class="tog">화면 흔들림 <select id="mShake">${(['off', 'low', 'normal'] as const).map((k) => `<option value="${k}" ${shakeLv() === k ? 'selected' : ''}>${SHAKE_NAME[k]}</option>`).join('')}</select></label><label class="tog"><input type="checkbox" id="mSettle" ${settleOn() ? 'checked' : ''}> 하루 마감 정산 카드 보기</label><label class="tog"><input type="checkbox" id="mGoalPill" ${goalPillOn() ? 'checked' : ''}> 「🎯 오늘」 목표 알약 보기</label><label class="tog">단골 제안 카드 <select id="mPropCard">${(['full', 'simple'] as const).map((k) => `<option value="${k}" ${propCardMode() === k ? 'selected' : ''}>${PROP_CARD_NAME[k]}</option>`).join('')}</select></label><label class="tog"><input type="checkbox" id="mTele" ${telemetryOn() ? 'checked' : ''}> 플레이 기록 보내기 (개인정보 없이 · 게임 개선용)</label>
    <button id="mKeys">⌨ 단축키 바꾸기 (PC)</button><button id="mIntro">오프닝 다시 보기</button><button id="mHints">전투 안내 다시 보기</button><button id="mLetter">모모에게 편지 (버그 제보)</button><button id="mTitle">타이틀로</button></div>
    ${online() ? `<p class="note">로그인: ${esc(me.profile!.nickname)}</p>` : ''}`,
  );
  $$('[data-fs]').forEach(
    (b) =>
      (b.onclick = () => {
        setFontStep(+b.dataset.fs!);
        $$('[data-fs]').forEach((x) => x.classList.toggle('on', x === b));
      }),
  );
  bindAutoSalvage('mAuto');
  ($('#mRumor') as HTMLInputElement).onchange = (e) => setRumor((e.target as HTMLInputElement).checked);
  ($('#mSaver') as HTMLInputElement).onchange = (e) => {
    setSaver((e.target as HTMLInputElement).checked);
    trackEv('saver', { on: saverOn() });
  };
  $('#mLetter').onclick = () => openReport();
  $('#mKeys').onclick = () => openKeys();
  bindSoundSettings();
  ($('#mChem') as HTMLSelectElement).onchange = (e) => {
    const v = (e.target as HTMLSelectElement).value;
    setPref('chemNotice', v);
    trackEv('chem_notice', { mode: v });
    toast(`케미 알림: ${CHEM_NOTICE_NAME[v as ChemNotice]}`);
  };
  ($('#mShake') as HTMLSelectElement).onchange = (e) => {
    setShakeLv((e.target as HTMLSelectElement).value as ShakeLv);
    toast(`화면 흔들림: ${SHAKE_NAME[(e.target as HTMLSelectElement).value as ShakeLv]}`);
  };
  ($('#mSettle') as HTMLInputElement).onchange = (e) => setSettle((e.target as HTMLInputElement).checked);
  ($('#mGoalPill') as HTMLInputElement).onchange = (e) => setGoalPill((e.target as HTMLInputElement).checked);
  ($('#mPropCard') as HTMLSelectElement).onchange = (e) => setPropCardMode((e.target as HTMLSelectElement).value as PropCardMode);
  ($('#mTele') as HTMLInputElement).onchange = (e) => setTelemetry((e.target as HTMLInputElement).checked);
  $('#mHints').onclick = () => {
    resetBattleHints();
    toast('다음 토벌·사냥 첫 판에 안내가 다시 나와요');
  };
  $('#mIntro').onclick = () => {
    closeWin();
    game.replayOpening();
  };
  $('#mTitle').onclick = () => {
    closeWin();
    game.toTitle();
  };
}

// ───────── 핫픽스 12 §5: 단축키 바꾸기 ─────────
let keyWait: Action | null = null;
let keyListen: ((e: KeyboardEvent) => void) | null = null;
export function openKeys() {
  const row = (a: Action) => `<button class="stp keyrow ${keyWait === a ? 'cur' : ''}" data-act="${a}"><span style="grid-column:1/3"><b>${ACTION_NAME[a]}</b></span><em>${keyWait === a ? '누를 키…' : keysFor(a).map(keyLabel).join(' / ')}</em></button>`;
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

export const MANUAL: { key: string; icon: IconKey; title: string; lines: string[] }[] = [
  { key: 'start', icon: 'm_quest', title: '처음 시작', lines: ['왼쪽 위 임무 카드가 늘 다음 할 일을 알려 줘요.', '카드를 누르면 그곳으로 가고, 손가락이 눌러야 할 버튼을 톡톡 가리켜요.', '다 하면 카드가 반짝 — 눌러서 보상을 받아요.'] },
  { key: 'build', icon: 'm_smith', title: '건설 · 땅', lines: ['울타리 안 풀밭은 전부 지을 수 있는 땅이에요. 아래 「건설」에서 골라 원하는 칸에 지어요.', '땅을 넓히면 숲을 베어 내요 — 울타리 밖 「땅 넓히기」 팻말을 눌러도 돼요.', '잠긴 건물은 무엇을 하면 열리는지 적혀 있어요 (땅 단계 · 평판 · 장부).', '여관 본관은 Lv.10, 주점은 Lv.6까지 — 레벨마다 모습이 조금씩 바뀌어요.'] },
  { key: 'guests', icon: 'm_guests', title: '손님 · 단골', lines: ['손님은 기분이 좋으면 떠날 때 단골이 되겠다고 해요.', '단골은 원정·사냥·토벌에 데려갈 수 있어요.', '손님을 눌러 말을 걸면 기분이 조금 좋아져요.'] },
  { key: 'expedition', icon: 'm_expedition', title: '원정', lines: ['의뢰 게시판에서 의뢰를 골라 파티를 보내요.', '짧은 원정(1분)은 자주, 긴 원정은 잘 때.', '진행 바를 누르면 원정 일지를 볼 수 있어요.'] },
  { key: 'hunt', icon: 'm_hunt', title: '사냥', lines: ['지역마다 10스테이지, x-10은 지역 보스.', '깬 스테이지는 「맡겨 두기」로 마을에서 계속 사냥 · 꺼 둬도 방치 보상.', '전투력이 모자라면 장비·레벨·케미로 올리고 다시!'] },
  { key: 'raid', icon: 'm_raid', title: '토벌', lines: ['매주 월요일 보스가 바뀌어요. 체력은 주간 동안 이어서 깎여요.', '번쩍이면 막기를 꾹 — 완벽하게 막으면 보스가 기절.', '한 판 피해량으로 주간 랭킹에 올라요.'] },
  { key: 'smith', icon: 'm_smith', title: '대장간', lines: ['분해 → 가루 → 강화(+10까지), 재료로 세트 장비 제작.', '지역 보스 재료는 사냥 x-10과 토벌에서 얻어요.'] },
  { key: 'dex', icon: 'm_dex', title: '도감', lines: ['손님·아이템·케미·영웅을 모으면 모든 전투력이 올라요.', '도감 하나를 100% 채우면 유산의 기념비가 열려요.'] },
  { key: 'owner', icon: 'm_owner', title: '주인 · 인연', lines: ['주인 능력치는 매일·행동마다 조금씩 올라요.', '영웅·전설·마을 사람에게 말 걸기·선물로 인연을 쌓아요.', '언젠가 방랑의 불씨가 타오르면… 엔딩을 고를 수 있어요.'] },
  { key: 'grade', icon: 'm_neighbor', title: '마을 등급', lines: ['장부 장을 마칠 때마다 마을 등급이 올라요.', '오두막 → 쉼터 → 마을 → 고을 → 도시. 길·담·장식·NPC가 바뀌어요.'] },
  { key: 'collect', icon: 'm_achieve', title: '업적 · 칭호', lines: ['업적을 이루면 금화·가루·칭호를 받아요.', '칭호는 메뉴 → 칭호에서 달아요.'] },
  { key: 'shop', icon: 'm_shop', title: '상점 · 출석 · 우편함', lines: ['상점 진열은 매일 바뀌어요.', '매일 첫 접속 때 출석 도장 — 보상은 우편함으로.'] },
];

/** 창 제목 → 안내서 쪽 */
export const HELP_OF: [RegExp, string][] = [
  [/^원정|의뢰/, 'expedition'], [/^사냥/, 'hunt'], [/^토벌/, 'raid'], [/^건설|땅 넓히기/, 'build'], [/^손님|단골/, 'guests'], [/대장간|텃밭/, 'smith'], [/^도감/, 'dex'],
  [/^주인|^인연|선물/, 'owner'], [/^업적|^칭호/, 'collect'], [/^상점|^출석|^우편함/, 'shop'], [/장부|오늘의 목표/, 'start'],
];

export function openManual(key?: string) {
  const page = MANUAL.find((p) => p.key === key);
  if (page) {
    openWin(`안내서 · ${page.title}`, `<div class="mpage"><img src="${iconSrc(page.icon)}" alt=""><div>${page.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div></div><button class="bigbtn ghost sm" id="mnBack">목차</button>`);
    $('#mnBack').onclick = () => openManual();
    return;
  }
  openWin('여관 운영 안내서', `<p class="sub">기능마다 한 쪽씩 · 창 오른쪽 위 「?」를 누르면 그 쪽이 바로 열려요</p><div class="mgrid">${MANUAL.map((p) => `<button class="mtile" data-mn="${p.key}"><img src="${iconSrc(p.icon)}" alt=""><span>${esc(p.title)}</span></button>`).join('')}</div>`);
  $$('[data-mn]').forEach((b) => (b.onclick = () => openManual(b.dataset.mn)));
}

/** 부팅 때: 창마다 「?」 → 안내서 그 쪽 */
export function initMenu() {
  helpHook.page = (title) => (title.startsWith('안내서') || title === '여관 운영 안내서' ? null : HELP_OF.find(([re]) => re.test(title))?.[1] ?? null);
  helpHook.open = (k) => openManual(k);
}
