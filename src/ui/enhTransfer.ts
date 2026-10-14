// 웅스 건의 「강화 전수」 창 (플래그 enhTransfer · 실험실) — 대장간 한 화면(smithOne) 행동 판의 [전수]에서 연다
//  고른 장비 하나 기준으로 두 목록: 「이 장비가 받기」(같은 부위 · +3 이상 · 등급 같거나 낮은 것) · 「이 장비가 주기」(이 장비가 +3 이상일 때)
//  줄마다 미리 보기 「+12 → +11 · 금화 … · 가루 …」 · 막히면 이유(회색) → [전수] → 확인 시트 → 실행 → 대장간으로 돌아가 도장 「쿵」
//  남색 기준판 · 기존 줄(.irow)·버튼만 (★ 품질 규칙 1·4) · 새 그림 없음 (도장은 체크인 도장 그림 그대로)
import { DUST_NAME, GRADE_INFO, SLOT_NAME } from '../data/items';
import { giverCands, recvCands, transferEnh, transferPlan, type TransferDone, type TransferPlan } from '../world/enhTransfer';
import { P, S, world, type Item } from '../world/state';
import { $$, esc, fmt, itemCell } from './common';
import { confirmSheet } from './confirmSheet';
import { openWin, toast } from './windows';

/** 한 목록 최대 줄 수 (할 수 있는 것 먼저) */
const MAX_ROWS = 12;
const ownerName = (it: Item) => (it.owner == null ? '' : ((world.home?.actors ?? world.actors).find((a) => a.id === it.owner)?.name ?? ''));
const nameOf = (it: Item) => `${it.name} +${it.enh}`;

/** 비용 글자 「금화 15,000 · 영웅 가루 7,030 · 부적 1」 */
export function costText(p: TransferPlan, recv: Item): string {
  const c = p.cost;
  const parts = [c.gold ? `금화 ${fmt(c.gold)}` : '', `${DUST_NAME[recv.grade]} ${fmt(c.dust)}`, c.charm ? `강화 보호 부적 ${c.charm}` : ''].filter(Boolean);
  return parts.join(' · ');
}
/** 미리 보기 한 줄 「+0 → +11 · 비용 …」 */
export const previewText = (p: TransferPlan, recv: Item) => `+${p.from} → +${Math.max(p.from, p.to)} · 비용 ${costText(p, recv)}`;

function row(giver: Item, recv: Item, other: Item): string {
  const p = transferPlan(giver, recv);
  const g = GRADE_INFO[other.grade];
  const own = ownerName(other);
  const line = p.rule ? `<small class="bad">${esc(p.why)}</small>` : `<small>${esc(previewText(p, recv))}</small>${p.ok ? '' : `<small class="bad">${esc(p.why)}</small>`}`;
  return `<div class="irow tf-row" data-tg="${giver.id}" data-tr="${recv.id}">${itemCell(other)}<span><b style="color:${g.color}">${esc(nameOf(other))}</b><small>${g.name}${own ? ` · ${esc(own)} 착용` : ''}</small>${line}</span><button data-tgo="${giver.id}:${recv.id}" ${p.ok ? '' : 'disabled'}>전수</button></div>`;
}
const rank = (p: TransferPlan) => (p.ok ? 0 : p.rule ? 2 : 1);
function listHtml(pairs: [Item, Item, Item][]): string {
  const sorted = pairs.map((x) => ({ x, p: transferPlan(x[0], x[1]) })).sort((a, b) => rank(a.p) - rank(b.p));
  return sorted
    .slice(0, MAX_ROWS)
    .map(({ x }) => row(...x))
    .join('') + (sorted.length > MAX_ROWS ? `<p class="note">그 밖에 ${sorted.length - MAX_ROWS}개 (할 수 있는 것 · 새 장비 먼저)</p>` : '');
}

/** 전수 창 — it 을 기준으로 받기·주기 · done(결과, 받은 장비) 은 실행 뒤 (대장간으로 돌아가 도장) */
export function openTransfer(it: Item, back: () => void, done: (r: TransferDone, recv: Item) => void) {
  if (!P.bag.includes(it)) return;
  const g = GRADE_INFO[it.grade];
  const gv = giverCands(it).map((x) => [x, it, x] as [Item, Item, Item]);
  const rv = recvCands(it).map((x) => [it, x, x] as [Item, Item, Item]);
  const recvHtml = gv.length ? listHtml(gv) : '<p class="note">물려줄 장비가 없어요 (같은 부위 · +3 이상 · 등급이 같거나 낮은 것)</p>';
  const giveHtml = it.enh >= 3 ? (rv.length ? listHtml(rv) : '<p class="note">받을 장비가 없어요 (같은 부위 · 등급이 같거나 높은 것)</p>') : '';
  openWin(
    `강화 전수 · ${it.name}`,
    `<div class="idet">${itemCell(it)}<div><b style="color:${g.color}">${esc(nameOf(it))}</b><small>${g.name} ${SLOT_NAME[it.slot]}${ownerName(it) ? ` · ${esc(ownerName(it))} 착용` : ''}</small></div></div>
    <p class="note">강화 단계만 새 장비로 옮겨요 (옵션·고유 옵션·세트는 받는 장비 그대로) · 같은 등급 그대로 · 한 등급 위 −1 · 두 등급 위 −2 · +11 이상은 −1 더 · 유물은 유물끼리만 · 주는 장비는 사라지고 분해 가루를 받아요</p>
    <p class="sub">이 장비가 받기</p><div class="ilist tf-list" id="tfRecv">${recvHtml}</div>
    ${giveHtml ? `<p class="sub">이 장비가 주기</p><div class="ilist tf-list" id="tfGive">${giveHtml}</div>` : ''}
    <p class="note">금화 ${fmt(S.gold)} · ${DUST_NAME[it.grade]} ${fmt(P.dust[it.grade] ?? 0)} · 강화 보호 부적 ${P.growth.charm}</p>
    <div class="btnrow"><button class="bigbtn ghost" id="tfBack">돌아가기</button></div>`,
  );
  ($$('#tfBack')[0] as HTMLElement).onclick = back;
  $$('[data-tgo]').forEach(
    (b) =>
      (b.onclick = async () => {
        const [gi, ri] = b.dataset.tgo!.split(':').map(Number);
        const giver = P.bag.find((x) => x.id === gi);
        const recv = P.bag.find((x) => x.id === ri);
        if (!giver || !recv) return openTransfer(it, back, done);
        const p = transferPlan(giver, recv);
        if (!p.ok) return toast(p.why);
        const wear = p.wearer ? `\n${p.wearer.name}님에게 「${recv.name}」을(를) 끼워 드려요${p.leaves ? `
${p.leaves.name}님이 끼고 있어요 → 벗겨요 (${SLOT_NAME[recv.slot]} 칸은 비어요)` : ''}` : '';
        const ok = await confirmSheet({
          title: '강화를 전수할까요?',
          body: `「${nameOf(giver)}」 → 「${recv.name}」 +${p.from} → +${p.to}\n비용: ${costText(p, recv)}\n「${giver.name}」은(는) 사라지고 ${DUST_NAME[giver.grade]} +${fmt(p.back.dust)}${p.back.ash ? ` · ${DUST_NAME.n} +${p.back.ash}` : ''}을 받아요 (되돌릴 수 없어요)${wear}`,
          ok: '전수하기',
          danger: true,
        });
        if (!ok) return;
        const r = transferEnh(giver, recv);
        if (typeof r === 'string') {
          toast(r);
          return openTransfer(it, back, done);
        }
        toast(`전수 완료 · ${recv.name} +${r.to}${r.wearer ? ` · ${r.wearer.name} 장착` : ''} · ${DUST_NAME[giver.grade]} +${fmt(r.back)}`);
        done(r, recv);
      }),
  );
}
