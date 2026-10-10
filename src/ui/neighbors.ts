// 이웃 마을: 실제 유저 마을(villages.snapshot) + 예시 마을. 그릴 때 핫픽스 4 배치 검사(placeLayout)를 그대로 거친다.
import type { Kind } from '../data/catalog';
import { CATALOG } from '../data/catalog';
import { NEIGHBORS, type Neighbor } from '../data/neighbors';
import * as game from '../game';
import { PORTRAITS } from '../engine/assets';
import { getVillage, likeVillage, listVillages, online, sb, type VillageRow } from '../net/server';
import { S } from '../world/state';
import { $$, esc, fmt } from './common';
import { openWin, toast } from './windows';

/** 서버 마을 모습 → 이웃 (모양이 이상하면 null — 화면은 안 깨지게) */
export function toNeighbor(r: VillageRow): Neighbor | null {
  const s = r.snapshot as { land?: number; innName?: string; owner?: string; layout?: unknown[]; repHero?: string | null; grade?: number };
  if (!s || !Array.isArray(s.layout)) return null;
  const layout = s.layout
    .filter((e): e is unknown[] => Array.isArray(e) && typeof e[0] === 'string' && (e[0] as string) in CATALOG)
    .map((e) => [e[0] as Kind, Number(e[1]), Number(e[2]), Number(e[3]) || 1, typeof e[4] === 'number' ? e[4] : null, !!e[5]] as Neighbor['layout'][number]);
  if (!layout.some((e) => e[0] === 'inn')) return null;
  return {
    id: 'u:' + r.user_id,
    uid: r.user_id,
    name: (s.innName || '이름 없는 여관').slice(0, 12),
    owner: (s.owner || '여관 주인').slice(0, 8),
    land: Math.max(1, Math.min(5, Math.floor(Number(s.land) || 1))),
    like: r.likes ?? 0,
    repHero: s.repHero ?? null,
    grade: Math.max(0, Math.min(4, Math.floor(Number(s.grade) || 0))),
    title: typeof (s as { title?: unknown }).title === 'string' ? ((s as { title: string }).title).slice(0, 12) : '',
    layout,
  };
}

let real: Neighbor[] = [];

export async function openVillage() {
  if (S.visiting) {
    game.goHome();
    return;
  }
  const liked = game.likedSet();
  const fakeRows = NEIGHBORS.map(
    (v, i) => `<button class="stp" data-f="${i}"><span style="grid-column:1/3"><b>${v.name}</b><small>예시 마을 · 주인 ${v.owner} · 땅 ${v.land}단계</small></span><em>♥ ${fmt(v.like + (liked.has(v.id) ? 1 : 0))}</em></button>`,
  ).join('');
  const draw = (loading: boolean) => {
    const realRows = real
      .map(
        (v, i) =>
          `<button class="stp real" data-r="${i}"><img src="${(v.repHero && PORTRAITS[v.repHero]) || PORTRAITS.hero || ''}" alt=""><span><b>${esc(v.name)}</b><small>주인 ${esc(v.owner)} · 땅 ${v.land}단계</small></span><em>♥ ${fmt(v.like)}</em></button>`,
      )
      .join('');
    openWin(
      '마을 · 이웃 여관',
      `<p class="sub">다른 여관주인의 마을을 구경하고 좋아요를 남겨요${online() ? ' (마을마다 하루 한 번)' : ' · 로그인하면 좋아요가 서버에 남아요'}</p>
      ${sb ? `<p class="sub g">실제 여관</p><div class="steps">${loading ? '<p class="note">불러오는 중…</p>' : realRows || '<p class="note">아직 다른 여관이 없어요</p>'}</div>` : ''}
      <p class="sub g">예시 마을</p><div class="steps">${fakeRows}</div>`,
    );
    $$('.stp[data-f]').forEach((b) => (b.onclick = () => game.visit(NEIGHBORS[+b.dataset.f!])));
    $$('.stp[data-r]').forEach((b) => (b.onclick = () => game.visit(real[+b.dataset.r!])));
  };
  draw(!!sb);
  if (!sb) return;
  real = (await listVillages(20)).map(toNeighbor).filter((x): x is Neighbor => !!x);
  if (document.getElementById('winT')?.textContent === '마을 · 이웃 여관') draw(false);
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
  if (r === before) {
    toast('오늘은 이미 좋아요를 남겼어요 · 내일 또 와 주세요');
    return false;
  }
  return true;
}
