// CHECKIN §D2 여관 연감 창 — 30칸 도장판 (시즌 1 = 수확제) · 칸마다 보상 · 마지막 주 도장 ×2 · 다음 시즌 30%
import { ALMANAC, ALMANAC_CELLS } from '../data/harvest_cfg';
import { almanacOn, alState, cellsReached, claimCell, readyCells, rewardText, stampMult } from '../world/almanac';
import { hvNow } from '../world/harvest';
import { $$, esc, keepScroll } from './common';
import { iconSrc } from './kit';
import { openWin, toast } from './windows';

const md = (t: number) => {
  const d = new Date(t + 9 * 3600000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
/** 칸 아이콘 (보상 종류) */
function cellIcon(k: string): string {
  const m: Record<string, string> = { mats: 'm_bag', dust: 'cur_dust_n', shards: 'cur_token', gold: 'cur_gold', book: 'skill_book', whet: 'm_smith', charm: 'm_smith', ribbon: 'cur_ribbon', tokens: 'cur_token', deco: 'box_gift' };
  return iconSrc((m[k] ?? 'box_gift') as never, true);
}

export function openAlmanac() {
  if (!almanacOn()) return toast('여관 연감은 시즌 중에만 열려요');
  const a = alState();
  const reached = cellsReached(a.stamps);
  const ready = readyCells();
  const per = ALMANAC.perCell;
  const next = reached >= ALMANAC.cells ? 0 : per - (a.stamps % per);
  const cells = ALMANAC_CELLS.map((r, i) => {
    const n = i + 1;
    const got = a.claimed.includes(n);
    const can = ready.includes(n);
    const big = r.k === 'deco';
    return `<button class="alc ${got ? 'got' : can ? 'ready' : n <= reached ? '' : 'lock'} ${big ? 'big' : ''}" data-alc="${n}" title="${esc(rewardText(r))}"><b>${n}</b><img src="${cellIcon(r.k)}" alt="">${got ? `<img class="stp" src="${iconSrc('stamp_almanac', true)}" alt="받음">` : ''}</button>`;
  }).join('');
  const x2 = stampMult() > 1;
  openWin(
    '여관 연감',
    `<p class="sub"><img class="kic" src="${iconSrc('stamp_almanac', true)}" alt=""> ${esc(ALMANAC.name)} · ${md(ALMANAC.from)} ~ ${md(ALMANAC.to)}</p>
    <div class="bar"><span>도장 ${a.stamps}</span><i><b style="width:${Math.min(100, (reached / ALMANAC.cells) * 100)}%;background:#e8a23a"></b></i><em>${reached}/${ALMANAC.cells}칸</em></div>
    <p class="note">${next ? `다음 칸까지 도장 ${next}개 · ` : ''}한 칸 = 도장 ${per}개${x2 ? ' · <b class="g">마지막 주 — 도장 ×2!</b>' : ''}</p>
    ${ready.length >= 2 ? `<button class="bigbtn sm claimall" id="alAll">모두 받기 (${ready.length})</button>` : ''}
    <div class="algrid">${cells}</div>
    <p class="note" id="alInfo">칸을 누르면 보상을 볼 수 있어요</p>
    <p class="note">도장: 오늘의 장부 셋 다 (3) · 수확제 교환소에서 바꾸기 (1) · 업적 받기 (1)<br>10·20·30칸 시즌 장식 · 30칸 칭호 「${esc(ALMANAC.title)}」 · 못 채우면 모은 도장의 30%가 다음 시즌으로 · 못 받은 칸은 끝날 때 우편으로</p>`,
    'almanac',
  );
  const all = document.getElementById('alAll');
  if (all)
    all.onclick = () => {
      const got = ready.map((n) => claimCell(n, hvNow())).filter(Boolean);
      toast(`연감 ${got.length}칸 받았어요`);
      keepScroll(openAlmanac);
    };
  $$('[data-alc]').forEach(
    (b) =>
      (b.onclick = () => {
        const n = +b.dataset.alc!;
        if (ready.includes(n)) {
          const r = claimCell(n);
          if (r) toast(`연감 ${n}칸 · ${r}`);
          return keepScroll(openAlmanac);
        }
        const info = document.getElementById('alInfo');
        if (info) info.textContent = `${n}칸 · ${rewardText(ALMANAC_CELLS[n - 1])}${a.claimed.includes(n) ? ' · 받음' : n > reached ? ` · 도장 ${n * per}개에 열려요` : ''}`;
      }),
  );
}
