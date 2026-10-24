// LUXE §3 마을 회관 꾸러미 화면 (플래그 bundles · 실험실 vis) — 게시판 「마을 회관」 탭
//  위: 회관 그림(town_hall.png — 어둡게 시작 · 방이 완성될 때마다 위에서부터 한 띠씩 밝아짐) · 방 6개 카드 → 방 안: 꾸러미마다 칸 줄 · [바치기]
//  대사(data/story/bundles.ts): 처음 열면 HALL_FIRST · 꾸러미 완성 = BUNDLE_DONE 한 줄(토스트) · 방 완성 = 담당 대사(영입 안 됐으면 버나드 fallback) · 6방 다 = HALL_RESTORED 컷
import { LUXE, type BundleDef, type RoomDef } from '../data/luxe_cfg';
import type { SLine } from '../data/story/v1';
import {
  bdState, bundleDone, bundleDoneLine, hallFirstLines, hallRestoredLines, bundleRewardText, donate, filledN, haveOf, putOf, readySlots, recValue, reservedOf, ROOMS, roomById, roomDone, roomDoneLines, roomDoneN, roomOpen, roomsDoneN, seaLocked, slotFull, slotName, slotWhere,
} from '../world/bundles';
import { track as trackEv } from '../net/telemetry';
import { esc, fmt } from './common';
import { fishImg, openFishing } from './fishing';
import { fishById, fishPool, timeNow } from '../world/fishing';
import { josa } from '../data/josa';

const FISH_TIME_NAME: Record<string, string> = { night: '밤', dawn: '새벽', day: '낮' };
const timeNowName = () => {
  const t = timeNow();
  return t.dawn ? '새벽' : t.night ? '밤' : '낮';
};
import { playStory } from './story';
import { toast } from './windows';
import { mineButton } from './community';

/** 지금 보고 있는 방 ('' = 방 목록) */
let cur = '';
export const resetBundleView = () => void (cur = '');
/** 대사 파일의 연출 키 → 기존 컷 연출 (cam_hall = 저녁 햇살 → dawn · fireworks는 ui/story에 있음) */
const FX_ALIAS: Record<string, string> = { cam_hall: 'dawn' };
const withFx = (ls: SLine[]): SLine[] => ls.map(([w, t, o]) => (o?.fx && FX_ALIAS[o.fx] ? [w, t, { ...o, fx: FX_ALIAS[o.fx] }] : [w, t, o]));

/** 처음 열기: HALL_FIRST (1번) — 다 보면 done */
export function bundleIntro(done: () => void) {
  const lines = hallFirstLines();
  if (!lines) return done();
  trackEv('bundle_open', {});
  playStory(lines, done);
}

/** 회관 그림 (형철 town_hall.png): 무너진 상태 = 같은 그림 어둡고 흐리게 · 고친 방 하나마다 위→아래로 1/6 띠가 밝아진다 (6방 = 다 밝음) */
function hallArt(): string {
  const all = ROOMS().length;
  const n = Math.min(roomsDoneN(), all);
  const cut = all ? Math.round((1 - n / all) * 10000) / 100 : 0;
  const src = 'assets/sprites/town_hall.png';
  return `<div class="bd-hall ${n >= all ? 'full' : ''}" role="img" aria-label="마을 회관 그림 · 고친 방 ${n}/${all}"><div class="bd-art"><img class="bd-ruin" src="${src}" alt=""><img class="bd-lit" src="${src}" alt="" style="clip-path:inset(0 0 ${cut}% 0)"></div></div>
  <p class="sub">${n >= all ? '마을 회관이 다 고쳐졌어요!' : `무너진 마을 회관 · 고친 방 ${n}/${all}`}</p>`;
}

/** 탭 내용 */
export function bundlesHtml(): string {
  const room = cur ? roomById(cur) : null;
  if (room && roomOpen(room)) return roomHtml(room);
  cur = '';
  const cards = ROOMS()
    .map((r) => {
      if (!roomOpen(r)) return `<div class="bd-room lock"><b>🔒 ${esc(r.name)}</b><small>장부 ${r.chapter}장을 마치면 열려요</small></div>`;
      const done = roomDone(r);
      const ready = !done && readySlots(r) > 0;
      return `<button class="bd-room ${done ? 'done' : ''} ${ready ? 'ready' : ''}" data-bdroom="${r.id}"><b>${done ? '✓ ' : ''}${esc(r.name)}</b><small>꾸러미 ${roomDoneN(r)}/${r.bundles.length}${ready ? ' · 바칠 수 있어요' : ''}</small><small class="bd-perk">${esc(r.perk)}</small></button>`;
    })
    .join('');
  const st = bdState();
  return `${hallArt()}<div class="bd-rooms">${cards}</div><p class="note">바친 재료는 사라져요 · 꾸러미는 칸을 다 채우지 않아도 정해진 수만 채우면 완성 · 연금술 예약분은 빼고 바쳐요${st.final ? ' · 「마을 회관」 건물은 꾸미기 보관함에 있어요' : ''}</p>${mineButton('hall')}`;
}

function slotRow(b: BundleDef, i: number, done: boolean): string {
  const s = b.slots[i];
  const put = putOf(b, i);
  const full = slotFull(b, i);
  const rec = s.k === 'rec';
  const have = haveOf(s);
  const rsv = reservedOf(s);
  const ic = s.k === 'fish' ? fishImg(s.id, 'fishic bd-ic') : '';
  const state = rec ? `지금 ${fmt(recValue(s.id))}` : `가진 수 ${fmt(have)}${rsv ? ` <span class="bd-rsv">(연금 예약 ${fmt(rsv)} 빼고)</span>` : ''}`;
  const btn = full
    ? '<em class="bd-ok">✓</em>'
    : done
      ? ''
      : rec
        ? `<button data-bdgive="${b.id}:${i}" ${recValue(s.id) >= s.n ? '' : 'disabled'}>기록 바치기</button>`
        : `<button data-bdgive="${b.id}:${i}" ${have > 0 ? '' : 'disabled'}>바치기</button>`;
  // FISH_QOL_1019 A: 물고기 칸을 누르면 그 낚시 창으로
  return `<div class="bd-slot ${full ? 'full' : ''}${s.k === 'fish' ? ' fishgo' : ''}" ${s.k === 'fish' ? `data-bdfish="${s.id}"` : ''}>${ic}<span><b>${esc(slotName(s))} ${rec ? '' : `${fmt(put)}/`}${fmt(s.n)}</b><i><u style="width:${Math.round((Math.min(s.n, rec ? recValue(s.id) : put) / s.n) * 100)}%"></u></i><small>${full ? '채웠어요' : state} · ${esc(slotWhere(s))}</small></span>${btn}</div>`;
}

function roomHtml(r: RoomDef): string {
  const bundles = r.bundles
    .map((b) => {
      const done = bundleDone(b);
      const n = filledN(b);
      return `<div class="bd-bundle ${done ? 'done' : ''}"><div class="bd-bh"><b>${done ? '✓ ' : ''}${esc(b.name)} 꾸러미</b><small>${done ? '완성!' : `${b.slots.length}칸 중 ${b.need}칸 · 지금 ${n}/${b.need}`}</small></div>${b.slots.map((_, i) => slotRow(b, i, done)).join('')}</div>`;
    })
    .join('');
  return `<div class="bd-top"><button class="ghost" id="bdBack">‹ 방 목록</button><b>${esc(r.name)}</b></div>
  <p class="sub">${roomDone(r) ? '✓ 완성한 방 · ' : ''}방 완성 보상: ${esc(r.perk)}<br><small>꾸러미 하나 완성: ${esc(bundleRewardText(r))}</small></p>${bundles}`;
}

const top = () => {
  const w = document.getElementById('winB');
  if (w) w.scrollTop = 0;
};
/** 버튼 묶기 (다시 그리기는 redraw) */
export function bindBundles(redraw: () => void) {
  document.querySelectorAll<HTMLElement>('[data-bdroom]').forEach(
    (b) =>
      (b.onclick = () => {
        cur = b.dataset.bdroom!;
        redraw();
        top();
      }),
  );
  const back = document.getElementById('bdBack');
  if (back)
    back.onclick = () => {
      cur = '';
      redraw();
      top();
    };
  document.querySelectorAll<HTMLElement>('[data-bdfish]').forEach(
    (row) =>
      (row.onclick = (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const f = fishById(row.dataset.bdfish!);
        if (!f) return;
        if (f.where === 'sea' && seaLocked()) return toast('「가라앉은 등대 해안」은 별의 심연 10단계를 돌파하면 열려요');
        openFishing(f.where);
        if (!fishPool(f.where).includes(f)) toast(`지금은 ${timeNowName()}이에요 — ${f.name}${josa(f.name, '은')} ${FISH_TIME_NAME[f.time!]}에 나와요`);
      }),
  );
  document.querySelectorAll<HTMLElement>('[data-bdgive]').forEach(
    (b) =>
      (b.onclick = () => {
        const [id, i] = b.dataset.bdgive!.split(':');
        const r = donate(id, +i);
        if (typeof r === 'string') return toast(r);
        if (r.room) {
          toast(`🏛 ${r.room.name} 완성! ${r.room.perk}`);
          const fin = r.final;
          const B = LUXE.bundles;
          const finale = () => {
            toast(`칭호 「${B.finalTitle}」 · 「이번 주 명품」 쿠폰 ${B.finalCoupon}장 · 「마을 회관」 건물은 꾸미기 보관함에`);
            redraw();
          };
          playStory(roomDoneLines(r.room.id), () => (fin ? playStory(withFx(hallRestoredLines()), finale) : redraw()));
          return;
        }
        toast(r.bundle ? `${bundleDoneLine()} (${r.bundle})` : `${r.gave}개 바쳤어요`);
        redraw();
      }),
  );
}
