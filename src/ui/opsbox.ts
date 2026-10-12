// DIRECTION §2: 운영자 「제보함」(편지 상태·답장·반영 버전 · 소문 승인 · 함께 만든 사람들 한 줄) · 「소문 보내기」 · 답장 우편 배달
//  서버 함수가 없으면(direction.sql 전) 메뉴에 안 보이고, 불러도 빈 목록 (오류 없이)
import { CONFIG } from '../data/config';
import { rumorProblem } from '../data/profanity';
import {
  adminContributors, adminLetters, adminRumors, adminSetLetter, adminSetNote, adminSetRumor, amAdmin, contributors, loadApprovedRumors, refreshAdmin, rumorSendReady, submitRumor,
  type LetterRow,
} from '../net/direction';
import { me, onAuthChange } from '../net/server';
import { getPref, setPref, writeSave } from '../save/save';
import { deliverReplies } from '../world/replies';
import { S } from '../world/state';
import { $$, esc } from './common';
import { openWin, toast } from './windows';

// ───────── 부팅 · 로그인 때 ─────────

/** 부팅 때 한 번: 운영자 확인 · 함께 만든 사람들 · 승인된 소문 · (로그인하면) 답장 배달 */
export function initDirection() {
  void contributors();
  void loadApprovedRumors();
  onAuthChange(() => {
    void loadApprovedRumors();
    if (S.started) void deliverReplies(safeSave);
  });
}
const safeSave = () => {
  if (S.started && !S.visiting) writeSave();
};
/** 마을이 처음 돌아가기 시작할 때 (main): 답장 배달 */
export function directionStarted() {
  if (me.profile) void deliverReplies(safeSave);
  void refreshAdmin();
}

// ───────── 소문 보내기 ─────────

/** 한국 날짜 (서버 「하루 1개」와 같은 기준) */
export const kstDay = (t = Date.now()) => new Date(t + 9 * 3600000).toISOString().slice(0, 10);
/** 오늘 이미 보냈나 (이 기기 기록 · 서버가 다시 확인) */
export const rumorSentToday = (t = Date.now()) => getPref<string>('rumorDay', '') === kstDay(t);

export function openRumorSend() {
  const ready = rumorSendReady();
  const sent = rumorSentToday();
  const max = CONFIG.direction.rumorMax;
  openWin(
    '소문 보내기',
    `<p class="sub">마을 사람 수다처럼 한 줄 — 운영자가 읽고 고르면 [소문] 채팅에 「— 닉네임」 꼬리표를 달고 섞여 나와요</p>
    <p class="note">하루에 하나 · ${max}자까지 · 고르기 전엔 아무에게도 안 보여요 · 욕설·링크는 못 보내요</p>
    ${!ready ? '<p class="note rsoff">소문 보내기는 아직 준비 중이에요 (로그인 · 서버 준비가 끝나면 열려요)</p>' : sent ? '<p class="note rsoff">오늘은 이미 소문을 보냈어요 · 내일 또 들려주세요</p>' : ''}
    <form class="report" id="rsF"><label>한 줄<input id="rsV" maxlength="${max}" placeholder="예) 요즘 우물가 고양이가 장화를 신고 다닌대" autocomplete="off" ${ready && !sent ? '' : 'disabled'}></label><small id="rsN">0/${max}</small><button ${ready && !sent ? '' : 'disabled'}>보내기</button></form>`,
  );
  const inp = document.getElementById('rsV') as HTMLInputElement;
  const cnt = document.getElementById('rsN')!;
  inp.oninput = () => (cnt.textContent = `${[...inp.value].length}/${max}`);
  (document.getElementById('rsF') as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    if (!rumorSendReady() || rumorSentToday()) return;
    const v = inp.value.replace(/\s+/g, ' ').trim();
    const bad = rumorProblem(v, max);
    if (bad) return toast(bad);
    const btn = document.querySelector('#rsF button') as HTMLButtonElement;
    btn.disabled = true;
    const err = await submitRumor(v);
    if (err) {
      btn.disabled = false;
      if (/하루에 하나/.test(err)) setPref('rumorDay', kstDay());
      return toast(err);
    }
    setPref('rumorDay', kstDay());
    toast('소문을 보냈어요! 운영자가 읽고 골라요');
    openRumorSend();
  };
}

// ───────── 운영자 제보함 ─────────

let oTab = 0;
let oFilter = '';
const ST = ['접수', '반영', '보류'] as const;
const kindOf = (body: string) => /^\[([^\]]+)\]/.exec(body)?.[1] ?? '';

export async function openOpsBox(tab = oTab) {
  if (!amAdmin()) return toast('운영자만 볼 수 있어요');
  oTab = tab;
  const head = `<div class="tabs" id="opT">${['편지', '소문', '함께 만든 사람들'].map((n, i) => `<button class="tab ${i === tab ? 'on' : ''}" data-ot="${i}">${n}</button>`).join('')}</div>`;
  openWin('제보함', `${head}<p class="note">불러오는 중…</p>`, 'wide');
  let body = '';
  if (tab === 0) {
    const list = await adminLetters(oFilter || null);
    body = `<div class="tabs sm">${['', ...ST].map((s) => `<button class="tab ${s === oFilter ? 'on' : ''}" data-of="${s}">${s || '전체'}</button>`).join('')}</div>${list.length ? list.map(letterCard).join('') : '<p class="note">편지가 없어요</p>'}`;
  } else if (tab === 1) {
    const list = await adminRumors('pending');
    body = list.length
      ? list.map((r) => `<div class="opc"><p><b>${esc(r.nickname ?? '?')}</b> <small>${new Date(r.created_at).toLocaleString('ko-KR')}</small></p><p class="opbody">${esc(r.body)}</p><div class="btnrow"><button class="bigbtn sm" data-rm="${r.id}:approved">승인</button><button class="bigbtn ghost sm" data-rm="${r.id}:rejected">거절</button></div></div>`).join('')
      : '<p class="note">기다리는 소문이 없어요</p>';
  } else {
    const list = await adminContributors();
    body = `<p class="note">반영 ${CONFIG.direction.contributorMin}건 이상이면 도감 「함께 만든 사람들」에 올라가요 (개척자는 늘)</p>${list.length ? list.map((c) => `<div class="opc"><p><b>${esc(c.nickname)}</b> <small>반영 ${c.fixed_n}건${c.pioneer ? ' · 개척자' : ''}</small></p><input class="opline" data-nl="${c.user_id}" maxlength="60" value="${esc(c.line ?? '')}" placeholder="한 줄 (60자)"><button class="bigbtn sm" data-ns="${c.user_id}">저장</button></div>`).join('') : '<p class="note">아직 반영된 제보가 없어요</p>'}`;
  }
  // 다른 창으로 바뀌었으면 덮어쓰지 않는다
  if (!document.getElementById('opT')) return;
  openWin('제보함', head + body, 'wide');
  $$('[data-ot]').forEach((b) => (b.onclick = () => void openOpsBox(+b.dataset.ot!)));
  $$('[data-of]').forEach((b) => (b.onclick = () => ((oFilter = b.dataset.of ?? ''), void openOpsBox(0))));
  $$('[data-ls]').forEach(
    (b) =>
      (b.onclick = async () => {
        const id = +b.dataset.ls!;
        const v = (k: string) => (document.querySelector(`[data-l${k}="${id}"]`) as HTMLInputElement | null)?.value ?? '';
        const ok = await adminSetLetter(id, { status: v('st'), reply: v('rp'), ver: v('vf') });
        toast(ok ? '저장했어요' : '저장하지 못했어요');
        if (ok) void openOpsBox(0);
      }),
  );
  $$('[data-rm]').forEach(
    (b) =>
      (b.onclick = async () => {
        const [id, st] = b.dataset.rm!.split(':');
        const ok = await adminSetRumor(+id, st as 'approved' | 'rejected');
        toast(ok ? (st === 'approved' ? '승인했어요' : '거절했어요') : '바꾸지 못했어요');
        void openOpsBox(1);
      }),
  );
  $$('[data-ns]').forEach(
    (b) =>
      (b.onclick = async () => {
        const uid = b.dataset.ns!;
        const line = (document.querySelector(`[data-nl="${uid}"]`) as HTMLInputElement).value;
        toast((await adminSetNote(uid, line)) ? '저장했어요' : '저장하지 못했어요');
      }),
  );
}

function letterCard(l: LetterRow): string {
  const k = kindOf(l.body);
  return `<div class="opc st-${l.status}"><p><b>${esc(l.nickname ?? '?')}</b> <small>${new Date(l.created_at).toLocaleString('ko-KR')} · ${esc(l.app_version ?? '')} · 반영 ${l.fixed_n}건${k ? ` · ${esc(k)}` : ''}</small></p>
  <p class="opbody">${esc(l.body.replace(/^\[[^\]]+\]\s*/, ''))}</p>
  <div class="oprow"><select data-lst="${l.id}">${ST.map((s) => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}</select><input data-lvf="${l.id}" maxlength="32" placeholder="반영 버전 (예: 0.23.0)" value="${esc(l.ver_fixed ?? '')}"></div>
  <textarea data-lrp="${l.id}" rows="2" maxlength="1000" placeholder="답장 (쓰면 그 유저 우편함에 「운영자의 답장」)">${esc(l.reply ?? '')}</textarea>
  <div class="btnrow"><small>${l.reply ? (l.reply_read ? '답장 읽음' : '답장 배달 대기') : ''}</small><button class="bigbtn sm" data-ls="${l.id}">저장</button></div></div>`;
}

if (import.meta.env.DEV) Object.assign(window, { __openRumorSend: openRumorSend, __openOpsBox: openOpsBox });
