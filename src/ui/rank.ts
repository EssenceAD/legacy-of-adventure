// 랭킹 창 (3단계 6장): 주간 토벌 · 마을 평판 · 도감 — 상위 100 + 내 순위. 누르면 그 마을 방문
import { PORTRAITS } from '../engine/assets';
import { me, mine, online, sb, top, type Board, type RankRow } from '../net/server';
import { myTitle } from '../world/meta';
import { P } from '../world/state';
import { mondayKey } from '../world/raid';
import { themeName, themeOf } from '../world/evaluation';
import { $$, bindTabs, esc, fmt, tabs } from './common';
import { openWin, toast } from './windows';
import { visitUser } from './neighbors';

let cur = 0;
const BOARDS: [Board, string, (n: number) => string][] = [
  ['raidWeek', '주간 토벌', (n) => fmt(n)],
  ['reputation', '마을 평판', (n) => fmt(n)],
  ['dex', '도감', (n) => n.toFixed(1) + '%'],
  ['evalWeek', '평가단', (n) => fmt(n)],
];

const row = (r: RankRow, f: (n: number) => string, mineRow = false) =>
  `<button class="rkrow ${mineRow ? 'me' : ''} ${r.rank <= 3 ? 'top' + r.rank : ''}" data-u="${r.user_id}"><em>${r.rank}</em><img src="${(r.rep_hero && PORTRAITS[r.rep_hero]) || PORTRAITS.hero || ''}" alt=""><span><b>${esc(r.inn_name)}</b><small>${mineRow && myTitle() ? `「${esc(myTitle())}」 ` : ''}${esc(r.nickname)}</small></span><i>${f(r.score)}</i></button>`;

export async function openRank(i = cur) {
  cur = i;
  const [board, name, f] = BOARDS[i];
  if (!sb) return openWin('랭킹', '<p class="sub">서버에 연결할 수 없어요</p>');
  openWin('랭킹', `${tabs(BOARDS.map((b) => b[1]), i, 'rkT')}<p class="note">불러오는 중…</p>`);
  bindTabs('rkT', (k) => void openRank(k));
  const week = mondayKey();
  const [list, my] = await Promise.all([top(board, 100, week), mine(board, week)]);
  if (cur !== i) return;
  const myLine = online()
    ? my.row
      ? `<p class="sub">내 순위</p>${row(my.row, f, true)}<p class="note">전체 ${fmt(my.total)}명 중 상위 ${Math.max(1, Math.round((my.row.rank / Math.max(1, my.total)) * 100))}%</p>`
      : `<p class="note">${board === 'raidWeek' ? '이번 주 토벌 기록이 아직 없어요' : board === 'evalWeek' ? '이번 주 평가 점수가 아직 없어요 (평가단이 오면 올라가요)' : '아직 기록이 없어요 (하루에 한 번 올라가요)'}</p>`
    : '<p class="note">로그인하면 내 이름이 랭킹에 올라가요 (메뉴 → 계정)</p>';
  const note = board === 'raidWeek' ? `이번 주(${week} 월요일부터) 보스에게 준 한 판 최고 피해량 · 매주 월요일 초기화` : board === 'reputation' ? '여관 평판 점수' : board === 'evalWeek' ? `이번 주 여관 평가단 점수 (테마 「${themeName(themeOf(week))}」) · 매주 월요일 새 시즌` : '손님·아이템·영웅 도감 평균 완성률';
  openWin(
    '랭킹',
    `${tabs(BOARDS.map((b) => b[1]), i, 'rkT')}<p class="note">${note}</p>${myLine}<p class="sub">${name} 상위 100</p>
    <div class="rklist">${list.map((r) => row(r, f, r.user_id === me.profile?.id)).join('') || '<p class="note">아직 아무도 없어요 · 첫 번째가 되어 보세요!</p>'}</div>
    <p class="note">누르면 그 마을을 구경해요</p>`,
  );
  bindTabs('rkT', (k) => void openRank(k));
  $$('.rkrow').forEach(
    (b) =>
      (b.onclick = () => {
        const u = b.dataset.u!;
        if (u === me.profile?.id) return toast('내 마을이에요');
        void visitUser(u);
      }),
  );
  void P;
}
