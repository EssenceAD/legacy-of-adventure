// RAIDWEAPON §2 전용 무기 — 화면 (규칙은 world/exWeapons.ts · exGate.ts)
//  · 깨어나는 컷 1.5초: 그 영웅 색 빛기둥 + 무기 아이콘 + 「★ 웅스의 양손 대검이 깨어났습니다!」 (누르면 바로 닫힘)
//  · 선택 상자 창: 조각 n/10 막대 · 상자 수 · 영입한 영웅 중 고르기 (다 있으면 「같은 무기 하나 더」)
//  · 아이템 상세 「전용 무기」 상자 · 가방 줄 · 도감 「영웅」 탭 칸
import { CONFIG } from '../data/config';
import { exShort } from '../data/exweapons';
import { exOwnerKey, exOwnerName, exWhy, exHooks, exHeroColor } from '../world/exGate';
import { josa } from '../data/josa';
import { boxChoices, boxCount, EX_WEAPONS, exDef, exOwned, exOwnedN, exRetro, fragsToBox, makeEx, openBox, recruitedKeys } from '../world/exWeapons';
import { exOn, rwState } from '../world/frags';
import { equip, itemIcon } from '../world/items';
import { grantEx } from '../world/exWeapons';
import { addFrags } from '../world/frags';
import { openBag, showItem } from './guests';
import { markDirty, P, world, type Actor, type Item } from '../world/state';
import { $$, esc } from './common';
import { openWin, toast } from './windows';

const F = () => CONFIG.raidWeapon.frag;
const homeActors = (): Actor[] => world.home?.actors ?? world.actors;

let styled = false;
function style() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
#exCut{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(10,6,20,.78);animation:exFade .25s ease-out;cursor:pointer;touch-action:manipulation}
#exCut .pil{position:absolute;left:50%;top:0;bottom:0;width:120px;transform:translateX(-50%);background:linear-gradient(90deg,transparent,var(--hc) 35%,#fff 50%,var(--hc) 65%,transparent);opacity:.55;animation:exPil 1.5s ease-out forwards;image-rendering:pixelated}
#exCut .wpn{position:relative;width:96px;height:96px;image-rendering:pixelated;filter:drop-shadow(0 0 10px var(--hc));animation:exRise .6s ease-out}
#exCut .txt{position:relative;margin-top:18px;padding:8px 14px;max-width:min(92vw,520px);text-align:center;font-weight:700;color:#fff6d0;background:rgba(20,12,30,.85);border:2px solid #ffd36b;border-radius:6px;text-shadow:0 1px 0 #000}
#exCut .skip{position:absolute;bottom:18px;right:18px;font-size:12px;color:#cdbfe0;opacity:.8}
@keyframes exFade{from{opacity:0}to{opacity:1}}
@keyframes exPil{0%{transform:translateX(-50%) scaleX(.1);opacity:0}25%{transform:translateX(-50%) scaleX(1);opacity:.75}100%{transform:translateX(-50%) scaleX(.6);opacity:.35}}
@keyframes exRise{from{transform:translateY(30px) scale(.6);opacity:0}to{transform:none;opacity:1}}
.ic.ex{--gc:#ffd36b !important;box-shadow:0 0 0 1px #ffd36b,0 0 6px rgba(255,211,107,.6)}
.ic.ex.sleep img{filter:grayscale(.6) brightness(.8)}
.exbox{margin:6px 0;padding:8px;border:1px solid #ffd36b;border-radius:6px;background:rgba(255,211,107,.08)}
.exbox .zz{color:#cdbfe0}
.exfr{display:flex;align-items:center;gap:8px;margin:6px 0}
.exfr .bar{flex:1;height:8px;background:#2a2236;border:1px solid #5a4a70;border-radius:4px;overflow:hidden}
.exfr .bar i{display:block;height:100%;background:linear-gradient(90deg,#c08a2a,#ffd36b)}
.exlist{display:flex;flex-direction:column;gap:6px}
.exrow{display:flex;align-items:center;gap:8px;padding:6px;border:1px solid #4a3a60;border-radius:6px;background:rgba(255,255,255,.03)}
.exrow img{width:32px;height:32px;image-rendering:pixelated}
.exrow span{flex:1;display:flex;flex-direction:column}
.exrow small{opacity:.8}
.exdex{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:6px 0}
.exdex div{display:flex;align-items:center;gap:6px;padding:5px;border:1px solid #4a3a60;border-radius:6px}
.exdex div.on{border-color:#ffd36b;background:rgba(255,211,107,.07)}
.exdex img{width:24px;height:24px;image-rendering:pixelated}
.exdex div:not(.on) img{filter:brightness(0) opacity(.45)}
.exdex b{font-size:12px}.exdex small{font-size:11px;opacity:.8}
`;
  document.head.appendChild(s);
}

// ───────── 깨어나는 컷 ─────────

export function playAwakeCut(it: Pick<Item, 'slot' | 'grade' | 'region' | 'wkind' | 'ex'>, color: string, text: string, ms = CONFIG.raidWeapon.ex.cutMs) {
  if (typeof document === 'undefined') return;
  style();
  document.getElementById('exCut')?.remove();
  const d = document.createElement('div');
  d.id = 'exCut';
  d.style.setProperty('--hc', color);
  d.innerHTML = `<i class="pil"></i><img class="wpn" src="${itemIcon(it)}" alt=""><div class="txt">${esc(text)}</div><small class="skip">누르면 넘기기</small>`;
  const close = () => d.remove();
  d.onclick = close;
  document.body.appendChild(d);
  window.setTimeout(close, ms);
}

// ───────── 아이템 상세 · 가방 ─────────

/** 아이템 상세 「전용 무기」 상자 (전용 무기가 아니면 '') + [주인에게 끼우기] */
export function exItemHtml(it: Item): string {
  const d = exDef(it.ex);
  if (!d) return '';
  style();
  const owner = homeActors().find((a) => exOwnerKey(a) === d.id && a.status === 'hero');
  const why = owner ? exWhy(owner, it) : '';
  const worn = owner && it.owner === owner.id;
  const state = !exOn()
    ? '<p class="zz">아직 잠들어 있어요</p>'
    : !owner
      ? `<p class="zz">${esc(exOwnerName(d))}님을 영입하면 낄 수 있어요 · ★${CONFIG.raidWeapon.ex.needStars}가 되면 깨어나요</p>`
      : worn
        ? `<p class="g">✦ ${esc(owner.name)}님 손에서 깨어나 있어요</p>`
        : why
          ? `<p class="zz">🔒 ${esc(why)} (지금 ★${owner.stars ?? 1})</p>`
          : `<button class="bigbtn sm" data-exwear="${owner.id}">${esc(owner.name)}님에게 끼우기</button>`;
  return `<div class="exbox"><b class="g">전용 무기 · ${esc(exOwnerName(d))}</b><small> — 그 영웅만 낄 수 있어요 · 강화·초월·재련은 유물 규칙 그대로 · 전수는 전용 무기끼리만</small>${state}</div>`;
}
/** 아이템 상세 그린 뒤 버튼 묶기 (redraw = 다시 그리기) */
export function bindExItem(it: Item, redraw: () => void) {
  $$('[data-exwear]').forEach(
    (b) =>
      (b.onclick = () => {
        const a = homeActors().find((x) => x.id === +b.dataset.exwear!);
        if (!a || !P.bag.includes(it)) return;
        const w = exWhy(a, it);
        if (w) return toast(w);
        equip(a, it);
        markDirty();
        redraw();
      }),
  );
}
/** 가방 맨 위 한 줄: 무기 조각 · 상자 [열기] (꺼져 있으면 '') */
export function exBagLine(): string {
  if (!exOn()) return '';
  style();
  exRetro();
  const st = rwState();
  const n = boxCount();
  return `<div class="exfr"><span>🗡 무기 조각 <b>${st.frags}</b></span><span class="bar"><i style="width:${(fragsToBox() / F().perBox) * 100}%"></i></span><span>${fragsToBox()}/${F().perBox}</span><button class="bigbtn sm" data-exbox ${n ? '' : 'disabled'}>선택 상자 ${n}</button></div>`;
}
export function bindExBag(back: () => void) {
  $$('[data-exbox]').forEach((b) => (b.onclick = () => openExBox(back)));
}

// ───────── 선택 상자 ─────────

export function openExBox(back: () => void = () => {}) {
  style();
  const st = rwState();
  const n = boxCount();
  const ch = boxChoices();
  const rows = ch.defs
    .map((d) => {
      const prev = makePreview(d.id);
      return `<div class="exrow"><img src="${itemIcon({ slot: 'weapon', grade: 'a', region: prev?.region ?? 'forest', wkind: prev?.wkind, ex: d.id })}" alt=""><span><b class="g">${esc(d.name)}</b><small>${esc(exOwnerName(d))} 전용${exOwned(d.id) ? ' · 하나 더 (재료·전수용)' : ''}</small></span><button class="bigbtn sm" data-expick="${d.id}" ${n ? '' : 'disabled'}>고르기</button></div>`;
    })
    .join('');
  openWin(
    '무기 선택 상자',
    `<div class="exfr"><span>🗡 조각 <b>${st.frags}</b></span><span class="bar"><i style="width:${(fragsToBox() / F().perBox) * 100}%"></i></span><span>상자 <b>${n}</b></span></div>
    <p class="note">조각 ${F().perBox}개 = 상자 1 · 영입한 영웅 중 아직 전용 무기가 없는 사람 것을 골라요${ch.dup ? ' · 모두 가졌으니 같은 무기 하나 더(재료·전수용)' : ''} · 그 영웅이 ★${CONFIG.raidWeapon.ex.needStars}가 되면 깨어나요</p>
    <div class="exlist">${rows || '<p class="note">전설이나 다섯 별 영웅을 먼저 영입해요</p>'}</div>
    <button class="bigbtn sm ghost" id="exBack">← 돌아가기</button>`,
  );
  $$('[data-expick]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = openBox(b.dataset.expick!);
        if (typeof r === 'string') return toast(r);
        const d = exDef(r.ex)!;
        playAwakeCut(r, exHeroColor(d.id), `🎁 「${d.name}」${josa(d.name, '를')} 받았어요!`, 1200);
        openExBox(back);
      }),
  );
  const bk = document.getElementById('exBack');
  if (bk) bk.onclick = back;
}
const PREV: Record<string, Item> = {};
/** 미리보기용 (아이디 소비 없이 무기 종류만) */
function makePreview(id: string): Pick<Item, 'region' | 'wkind'> | null {
  if (PREV[id]) return PREV[id];
  const keep = P.nextItemId;
  const it = makeEx(id, () => 0.5);
  P.nextItemId = keep;
  if (it) PREV[id] = it;
  return it;
}

// ───────── 도감 「영웅」 탭 ─────────

/** 전용 무기 19칸 (모은 것 ✦ · 없는 것 실루엣) — 꺼져 있으면 '' */
export function exDexHtml(): string {
  if (!exOn()) return '';
  style();
  const rec = new Set(recruitedKeys());
  const cells = EX_WEAPONS.map((d) => {
    const on = exOwned(d.id);
    const prev = makePreview(d.id);
    const icon = itemIcon({ slot: 'weapon', grade: 'a', region: prev?.region ?? 'forest', wkind: prev?.wkind, ex: d.id }, true);
    const awake = rwState().awoke.includes(d.id);
    return `<div class="${on ? 'on' : ''}"><img src="${icon}" alt=""><span><b>${on ? '✦ ' : ''}${on ? esc(exShort(d)) : '???'}</b><br><small>${esc(exOwnerName(d))}${on ? (awake ? ' · 깨어남' : ' · 잠듦') : rec.has(d.id) ? ' · 상자에서' : ''}</small></span></div>`;
  }).join('');
  return `<p class="sub g">전용 무기 ${exOwnedN()}/${EX_WEAPONS.length}</p><div class="exdex">${cells}</div>`;
}

let started = false;
/** main이 부른다: 컷 통로 */
export function initExWeapons() {
  if (started) return;
  started = true;
  exHooks.cut = (_a, it, color, text) => playAwakeCut(it, color, text);
}

// 시트·검사용 (개발/봇 빌드만)
if (import.meta.env.DEV)
  Object.assign(window, {
    __ex: { grant: grantEx, frags: addFrags, box: openExBox, cut: playAwakeCut, bag: openBag, item: (id: number) => { const it = P.bag.find((x) => x.id === id); if (it) showItem(it); }, state: rwState, color: exHeroColor, equip, dex: exDexHtml },
  });
