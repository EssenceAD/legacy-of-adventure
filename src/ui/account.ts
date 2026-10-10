// 계정 창: 로그인 · 가입(복구 코드) · 비밀번호 찾기 · 내 계정(로그아웃·복구 코드 다시 받기) · 저장 고르기
// 화면에 '이메일'이라는 말은 안 나온다. 로그인 안 해도 게임은 그대로 (손님 플레이).
import * as game from '../game';
import { checkLastWeek, compareSaves, dailyStats, flushOutbox, pushNow, setCloudReady, useServerSave, type SaveChoice } from '../net/sync';
import { loadBlocks, login, logout, me, online, recover, regenRecovery, sb, signUp } from '../net/server';
import { S } from '../world/state';
import { $, esc, fmt } from './common';
import { closeWin, isWinOpen, onWinClose, openWin, toast } from './windows';

let tab: 'login' | 'signup' | 'recover' = 'login';
/** 아직 못 고른 저장 선택 — 다른 창에 가려지거나 ✕로 닫혀도 다시 띄운다 (고르기 전엔 클라우드에 안 올림) */
let pending: SaveChoice | null = null;
let hooked = false;

const field = (id: string, label: string, type = 'text', ph = '', extra = '') =>
  `<label>${label}<input id="${id}" type="${type}" placeholder="${ph}" autocomplete="off" autocapitalize="off" spellcheck="false" ${extra}></label>`;

export function openAccount() {
  if (!sb) return openWin('계정', '<p class="sub">서버에 연결할 수 없어요. 지금은 이 기기에만 저장돼요.</p>');
  if (online()) return openMine();
  const tabs = `<div class="tabs"><button class="tab ${tab === 'login' ? 'on' : ''}" data-t="login">로그인</button><button class="tab ${tab === 'signup' ? 'on' : ''}" data-t="signup">가입</button><button class="tab ${tab === 'recover' ? 'on' : ''}" data-t="recover">비밀번호 찾기</button></div>`;
  let body = '';
  if (tab === 'login')
    body = `<form class="report acc-form" id="accF">${field('aId', '아이디', 'text', '영어 소문자·숫자·_')}${field('aPw', '비밀번호', 'password')}<button>로그인</button></form>
      <p class="note">로그인하면 폰·PC 어디서든 이어서 하고, 랭킹과 [세계] 채팅을 쓸 수 있어요. 로그인 안 해도 이 기기에서는 그대로 놀 수 있어요.</p>`;
  else if (tab === 'signup')
    body = `<form class="report acc-form" id="accF">${field('aId', '아이디 (4~16자)', 'text', '예) star_inn', 'maxlength="16"')}${field('aPw', '비밀번호 (6자 이상)', 'password')}${field('aPw2', '비밀번호 다시', 'password')}${field('aNick', '닉네임 (2~8자)', 'text', '랭킹·채팅에 보이는 이름', 'maxlength="8"')}<button>가입하기</button></form>
      <p class="note">가입하면 비밀번호를 잊었을 때 쓰는 <b>복구 코드</b>를 한 번 보여 드려요. 꼭 캡처해 두세요.</p>`;
  else
    body = `<form class="report acc-form" id="accF">${field('aId', '아이디')}${field('aCode', '복구 코드', 'text', 'XXXX-XXXX-XXXX-XXXX', 'maxlength="19"')}${field('aPw', '새 비밀번호 (6자 이상)', 'password')}<button>비밀번호 바꾸기</button></form>`;
  openWin('계정', tabs + body);
  document.querySelectorAll<HTMLElement>('.tabs .tab').forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.t as typeof tab;
        openAccount();
      }),
  );
  const v = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value ?? '';
  const form = $('#accF') as HTMLFormElement;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button')!;
    btn.disabled = true;
    try {
      if (tab === 'login') {
        const err = await login(v('aId').trim().toLowerCase(), v('aPw'));
        if (err) return toast(err);
        toast(`${me.profile!.nickname}님, 어서 오세요!`);
        await afterLogin();
      } else if (tab === 'signup') {
        if (v('aPw') !== v('aPw2')) return toast('비밀번호가 서로 달라요');
        const r = await signUp(v('aId').trim().toLowerCase(), v('aPw'), v('aNick'), S.innName);
        if ('error' in r) return toast(r.error);
        showCode(r.code, true);
        void afterLogin(true);
      } else {
        const err = await recover(v('aId').trim().toLowerCase(), v('aCode'), v('aPw'));
        if (err) return toast(err);
        toast('비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요');
        tab = 'login';
        openAccount();
      }
    } finally {
      btn.disabled = false;
    }
  };
}

/** 복구 코드: 크게 + 복사 버튼 + 캡처 안내 */
function showCode(code: string, first: boolean) {
  openWin(
    '복구 코드',
    `<p class="sub">${first ? '가입 완료! ' : ''}비밀번호를 잊었을 때 이 코드로 바꿀 수 있어요.</p>
    <div class="rcode" id="rcode">${esc(code)}</div>
    <p class="sub bad">지금 화면을 캡처해 두세요. 이 코드는 다시 보여 드릴 수 없어요.</p>
    <div class="btnrow"><button class="bigbtn" id="rcCopy">복사하기</button><button class="bigbtn ghost" id="rcOk">캡처했어요</button></div>`,
  );
  $('#rcCopy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('복사했어요');
    } catch {
      toast('복사를 못 했어요 · 화면을 캡처해 주세요');
    }
  };
  $('#rcOk').onclick = () => closeWin();
}

function openMine() {
  const p = me.profile!;
  openWin(
    '내 계정',
    `<div class="acc"><div>아이디<b>${esc(p.login_id)}</b></div><div>닉네임<b>${esc(p.nickname)}</b></div><div>여관<b>${esc(p.inn_name)}</b></div><div>저장<b>1분마다 · 앱을 내릴 때 클라우드에</b></div></div>
    <div class="menu"><button id="acSave">지금 클라우드에 저장</button><button id="acCode">복구 코드 다시 받기</button><button id="acOut">로그아웃</button></div>
    <p class="note">다른 기기에서 같은 아이디로 로그인하면 이 마을을 이어서 해요.</p>`,
  );
  $('#acSave').onclick = async () => {
    await pushNow();
    toast('클라우드에 저장했어요');
  };
  $('#acCode').onclick = async () => {
    if (!confirm('새 복구 코드를 받으면 예전 코드는 못 써요. 받을까요?')) return;
    const c = await regenRecovery();
    if (!c) return toast('다시 받지 못했어요');
    showCode(c, false);
  };
  $('#acOut').onclick = async () => {
    await pushNow();
    await logout();
    closeWin();
    toast('로그아웃했어요 · 이 기기에서는 계속 놀 수 있어요');
  };
}

/** 로그인 직후(또는 앱을 켰을 때 로그인이 남아 있으면): 저장 맞추기 → 쌓인 기록 올리기 → 차단 목록 · 통계 */
export async function afterLogin(justSignedUp = false) {
  if (!online()) return;
  setCloudReady(false);
  const choice = justSignedUp ? null : await compareSaves();
  if (choice) askSave(choice);
  else {
    setCloudReady(true);
    await pushNow();
  }
  const f = await flushOutbox();
  if (f.ok || f.rejected) toast(`쌓여 있던 토벌 기록 ${f.ok}개를 올렸어요${f.rejected ? ` (거부 ${f.rejected})` : ''}`);
  await loadBlocks();
  await dailyStats();
  await checkLastWeek();
}

const when = (t: number) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 서버 저장이 더 새로울 때: 어느 쪽을 쓸지 */
function askSave(c: SaveChoice) {
  pending = c;
  // windows.ts ↔ account.ts 순환 import라 처음 쓸 때 건다
  if (!hooked) {
    hooked = true;
    onWinClose(() => {
      if (pending && !isWinOpen() && online()) askSave(pending);
    });
  }
  const card = (x: SaveChoice['server'] | null, label: string) =>
    x ? `<div class="savecard"><b>${label}</b><span>${esc(x.innName || '이름 없는 여관')}</span><small>${when(x.at)} · ${x.day}일차 · 금화 ${fmt(x.gold)}</small></div>` : `<div class="savecard"><b>${label}</b><small>저장 없음</small></div>`;
  openWin(
    '어느 마을로 할까요?',
    `<p class="sub">${!c.local || c.server.at > c.local.at ? '클라우드에 더 최근 저장이 있어요.' : '이 기기에도 다른 마을이 저장돼 있어요.'} 고르기 전에는 클라우드에 올리지 않아요.</p>${card(c.server, '클라우드')}${card(c.local, '이 기기')}
    <div class="btnrow"><button class="bigbtn" id="svServer">클라우드 마을로</button><button class="bigbtn ghost" id="svLocal">이 기기 마을 올리기</button></div>`,
  );
  $('#svServer').onclick = () => {
    pending = null;
    useServerSave(c.data);
    setCloudReady(true);
    closeWin();
    toast('클라우드 마을을 불러와요');
    // 바로 다시 불러온다 (기다리면 자동 저장이 덮어쓸 수 있다)
    if (S.started) game.continueGame();
    else game.refreshTitle();
  };
  $('#svLocal').onclick = async () => {
    pending = null;
    closeWin();
    setCloudReady(true);
    if (!S.started) return toast('이어하기를 누르면 이 기기 마을이 올라가요');
    await pushNow();
    toast('이 기기 마을을 클라우드에 올렸어요');
  };
}
