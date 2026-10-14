// 이웃 마을: 실제 유저 마을(villages.snapshot) + 예시 마을. 그릴 때 핫픽스 4 배치 검사(placeLayout)를 그대로 거친다.
import type { Kind } from '../data/catalog';
import { mythicHeart } from '../world/mythic';
import { CATALOG } from '../data/catalog';
import { NEIGHBORS, type Neighbor } from '../data/neighbors';
import * as game from '../game';
import { PORTRAITS } from '../engine/assets';
import { getVillage, likeVillage, listVillages, myVillage, online, pioneerOfUid, pioneers, sb, type VillageRow } from '../net/server';
import { CONFIG } from '../data/config';
import { bigMapShift } from '../save/save';
import { S } from '../world/state';
import { $$, bindTabs, esc, fmt, tabs } from './common';
import { gbHasNew, gbOn, lastTopHtml, loadGuestbook } from './guestbook';
import { isWinOpen, openWin, toast } from './windows';

/** 서버 마을 모습 → 이웃 (모양이 이상하면 null — 화면은 안 깨지게) */
export function toNeighbor(r: VillageRow): Neighbor | null {
  const s = r.snapshot as { v?: number; land?: number; innName?: string; owner?: string; layout?: unknown[]; repHero?: string | null; grade?: number };
  if (!s || !Array.isArray(s.layout)) return null;
  const layout = s.layout
    .filter((e): e is unknown[] => Array.isArray(e) && typeof e[0] === 'string' && (e[0] as string) in CATALOG)
    .map((e) => [e[0] as Kind, Number(e[1]), Number(e[2]), Number(e[3]) || 1, typeof e[4] === 'number' ? e[4] : null, !!e[5]] as Neighbor['layout'][number]);
  if (!layout.some((e) => e[0] === 'inn')) return null;
  // 땅 개편 전(v1, 맵 14) 마을: 내 저장과 같은 규칙으로 좌표를 옮긴다
  // LAND2: v1(맵 14) → v7 옮김 + 8 · v2(맵 24) → +8
  const ver = s.v ?? 1;
  if (ver < 3) {
    const k = (ver < 2 ? bigMapShift(Number(s.land) || 1) : 0) + CONFIG.v7.shift;
    for (const e of layout) {
      e[1] += k;
      e[2] += k;
    }
  }
  return {
    id: 'u:' + r.user_id,
    uid: r.user_id,
    name: (s.innName || '이름 없는 여관').slice(0, 12),
    // GUEST_SPEC §2: 주인 이름이 없으면(게스트) 「○○ 여관 주인」
    owner: (s.owner || '').slice(0, 8),
    land: Math.max(1, Math.min(CONFIG.land.length, Math.floor(Number(s.land) || 1))),
    like: r.likes ?? 0,
    repHero: s.repHero ?? null,
    grade: Math.max(0, Math.min(4, Math.floor(Number(s.grade) || 0))),
    title: typeof (s as { title?: unknown }).title === 'string' ? ((s as { title: string }).title).slice(0, 12) : '',
    layout,
    // FEEDBACK23 §5: 옮긴 입구 (v3부터만 · 숫자가 아니면 자동)
    ...(ver >= 3 && Number.isFinite((s as { ent?: unknown }).ent) ? { ent: Math.round(Number((s as { ent: number }).ent)) } : {}),
  };
}

let real: Neighbor[] = [];
let mineRow: Neighbor | null = null;
let more = false;
/** LUXE §4: 「🏆 지난주 인기 마을」 줄 (guestbook 끔·서버 준비 전이면 '') */
let topRow = '';
let page = CONFIG.cloud.neighborPage;
/** 「주인 ○○」 · 이름이 없으면 「○○ 여관 주인」 */
export const ownerLine = (v: Neighbor) => (v.owner ? `주인 ${v.owner}` : `${v.name} 주인`);

/** LUXE §4: 이웃 창 탭 (0 이웃 여관 · 1 방명록) — guestbook 켰을 때만 탭이 보인다 */
let nbTab = 0;
const NB_TABS = ['이웃 여관', '방명록'];
const tabBar = (i: number) => (gbOn() && sb ? tabs(NB_TABS, i, 'nbT') : '');
function bindNbTabs() {
  if (!gbOn() || !sb) return;
  bindTabs('nbT', (k) => void openVillage(k));
  // 새 좋아요 → 「방명록」 탭에 빨간 점 (redDots 규칙: 받을 것이 있는 곳에만)
  document.querySelector<HTMLElement>('#nbT .tab[data-t="1"]')?.classList.toggle('rdot', gbHasNew());
}

export async function openVillage(tab = 0) {
  if (S.visiting) {
    game.goHome();
    return;
  }
  nbTab = gbOn() && sb ? tab : 0;
  if (nbTab === 1) {
    let n = 0;
    const draw = (html: string) => {
      // 불러오는 사이 창을 닫았거나 다른 창·탭으로 갔으면 다시 열지 않는다
      if (n++ > 0 && (nbTab !== 1 || !isWinOpen() || S.visiting || document.getElementById('winT')?.textContent !== '마을 · 이웃 여관')) return;
      openWin('마을 · 이웃 여관', tabBar(1) + html);
      bindNbTabs();
    };
    await loadGuestbook(draw, (u) => void visitUser(u));
    return;
  }
  const liked = game.likedSet();
  const fakeRows = NEIGHBORS.map(
    (v, i) => `<button class="stp" data-f="${i}"><span style="grid-column:1/3"><b>${v.name}</b><small>예시 마을 · 주인 ${v.owner} · 땅 ${v.land}단계</small></span><em>♥ ${fmt(v.like + (liked.has(v.id) ? 1 : 0))}</em></button>`,
  ).join('');
  const draw = (loading: boolean) => {
    // GUEST_SPEC §2: 내 여관을 맨 위에 고정 (♥ 확인용 · 누르면 아무 일 없음)
    const mineRowHtml = mineRow ? `<div class="stp real mine"><img src="${(mineRow.repHero && PORTRAITS[mineRow.repHero]) || PORTRAITS.hero || ''}" alt=""><span><b>내 여관 · ${esc(mineRow.name)}</b><small>이웃들이 보는 내 마을</small></span><em>♥ ${fmt(mineRow.like)}</em></div>` : '';
    const realRows = real
      .map(
        (v, i) =>
          `<button class="stp real${v.uid && pioneerOfUid(v.uid) ? ' pioneer' : ''}" data-r="${i}"><img src="${(v.repHero && PORTRAITS[v.repHero]) || PORTRAITS.hero || ''}" alt=""><span><b>${esc(v.name)}</b><small>${esc(ownerLine(v))} · 땅 ${v.land}단계</small></span><em>♥ ${fmt(v.like)}</em></button>`,
      )
      .join('');
    openWin(
      '마을 · 이웃 여관',
      `${tabBar(0)}<p class="sub">다른 여관주인의 마을을 구경하고 좋아요를 남겨요${online() ? ' (마을마다 하루 한 번)' : ' · 로그인하면 좋아요가 서버에 남아요'}</p>
      ${sb ? `<p class="sub g">실제 여관 <small>최근 ${CONFIG.cloud.neighborDays}일 · ♥ 많은 순</small></p><div class="steps">${topRow}${mineRowHtml}${loading ? '<p class="note">불러오는 중…</p>' : realRows || '<p class="note">아직 다른 여관이 없어요</p>'}${more && !loading ? '<button class="bigbtn sm ghost" id="nbMore">더 보기</button>' : ''}</div>` : ''}
      <p class="sub g">예시 마을</p><div class="steps">${fakeRows}</div>`,
    );
    bindNbTabs();
    const tb = document.querySelector<HTMLElement>('[data-gbtop]');
    if (tb) tb.onclick = () => void visitUser(tb.dataset.gbtop!);
    game.setVisitList([...real, ...NEIGHBORS]);
    $$('.stp[data-f]').forEach((b) => (b.onclick = () => game.visit(NEIGHBORS[+b.dataset.f!])));
    $$('.stp[data-r]').forEach((b) => (b.onclick = () => game.visit(real[+b.dataset.r!])));
    const mb = document.getElementById('nbMore');
    if (mb) mb.onclick = () => void load(page + CONFIG.cloud.neighborPage);
  };
  const load = async (n: number) => {
    page = n;
    const [rows, mine, , top] = await Promise.all([listVillages(n), myVillage(), pioneers(), lastTopHtml()]);
    topRow = top;
    more = rows.length > n;
    real = rows.slice(0, n).map(toNeighbor).filter((x): x is Neighbor => !!x);
    mineRow = mine ? toNeighbor(mine) : null;
    // 불러오는 사이 창을 닫았거나(이웃 방문·다른 창) 방문 중이면 다시 열지 않는다 — 닫힌 창도 제목(#winT)은 남아 있어서 예전엔 늦게 온 응답이 목록 창을 다시 띄웠다 (돌아온 마을에서 끊긴 단골 제안이 막힘)
    if (nbTab === 0 && isWinOpen() && !S.visiting && document.getElementById('winT')?.textContent === '마을 · 이웃 여관') draw(false);
  };
  draw(!!sb);
  if (!sb) return;
  await load(CONFIG.cloud.neighborPage);
}

/** 랭킹에서 누르면 그 마을로 */
export async function visitUser(uid: string) {
  const r = await getVillage(uid);
  const v = r && toNeighbor(r);
  if (!v) return toast('아직 마을 모습이 없는 여관이에요');
  game.visit(v);
}

/** 실제 마을 좋아요: 서버가 하루 한 번만 받는다 (숫자가 그대로면 오늘 이미 누른 것) */
export async function likeReal(v: Neighbor): Promise<boolean> {
  const before = v.like;
  const r = await likeVillage(v.uid!);
  if (typeof r !== 'number') {
    toast(r.error);
    return false;
  }
  v.like = r;
  if (r !== before) mythicHeart(v.uid!);
  if (r === before) {
    toast('오늘은 이미 좋아요를 남겼어요 · 내일 또 와 주세요');
    return false;
  }
  return true;
}
