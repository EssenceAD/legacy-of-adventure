// LUXE §2 펫 「동물 친구」 — 화면: 만남(반짝 + 「?!」 + 분홍 하트) → 작은 카드(이름 짓기 · 마을에 데려가기)
//  · 마을 펫 누르기 메뉴([쓰다듬기] [이름 바꾸기] [펫 집으로]) · 도감 탭 「동물 친구」 · 활동 힌트 한 줄
import { sfx } from '../audio/sfx';
import { PETS } from '../data/luxe_cfg';
import { queueEvent } from '../world/events';
import { checkBundlePet, closeCard, grantPet, isOut, PET_IDS, petCount, petDef, petHome, petHooks, petName, petOut, petPlaygroundUnlocked, petsOn, petState, patPet, pattedToday, renamePet } from '../world/pets';
import { petDotUrl, petDrawN, petHearts, petPortrait, petRT, petScreen } from '../world/petsDraw';
import { view } from '../engine/iso';
import { S } from '../world/state';
import { vis } from '../world/visual';
import { $$, esc } from './common';
import { closeWin, openWin, pushLayer, toast } from './windows';
import { charLen, submitEnter } from './ime';

// ───────── 만남 ─────────

/** 반짝 + 「?!」 말풍선 + 분홍 하트 입자 (득템 연출 틀 재사용 · 금빛 대신 분홍) */
export function petFanfare(id: string) {
  document.querySelectorAll('.fanfare.ff-pet').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = 'fanfare ff-pet';
  const hearts = Array.from({ length: 14 }, (_, i) => `<i class="ffheart" style="--hx:${Math.round((i / 13) * 100)}%;--hd:${(i % 5) * 0.12}s;--hs:${0.8 + (i % 3) * 0.3}"></i>`).join('');
  el.innerHTML = `<div class="ffflash pink"></div>${hearts}<div class="ffname"><span class="ffq">?!</span><small>동물 친구</small><b>${esc(petDef(id)?.name ?? id)}</b></div>`;
  document.body.appendChild(el);
  sfx('rare');
  setTimeout(() => el.remove(), 1900);
}

/** 카드 (이름 짓기 · 「마을에 데려가기」) — 창이 비었을 때 차례로 */
function queueCard(id: string) {
  queueEvent(() => openPetCard(id), 'pet:' + id, () => petState().card.includes(id));
}
/** 초상 (그림이 없으면 자리표시) */
const portImg = (id: string, cls = '') => `<img class="petimg ${cls}" src="${petPortrait(id)}" alt="" data-pet="${id}">`;
function bindPortraits() {
  $$('img.petimg').forEach((im) => {
    const mark = () => im.classList.add('miss');
    if ((im as HTMLImageElement).complete && !(im as HTMLImageElement).naturalWidth) mark();
    im.addEventListener('error', mark, { once: true });
  });
}

/** 펫 이름 칸 — 10/16: maxlength는 조합 중 마지막 글자를 잘라 먹어서 걸지 않는다 (저장할 때 8자로 · 옆에 「3/8」) */
const NAME_MAX = 8;
const nameInput = (v: string) => `<input id="pcName" value="${esc(v)}" autocomplete="off" enterkeyhint="done"> <small id="pcLen" class="pclen">${charLen(v)}/${NAME_MAX}</small>`;
function bindNameInput(go: () => void) {
  const inp = document.getElementById('pcName') as HTMLInputElement | null;
  const len = document.getElementById('pcLen');
  if (!inp) return;
  const upd = () => {
    if (!len) return;
    const n = charLen(inp.value.trim());
    len.textContent = `${n}/${NAME_MAX}`;
    len.classList.toggle('over', n > NAME_MAX);
  };
  inp.addEventListener('input', upd);
  inp.addEventListener('compositionend', upd);
  // 조합 중 Enter는 글자 확정만 · 다른 전역 단축키(대화 Z·X · 전투 · 마을 단축키)로 새지 않게
  inp.onkeydown = (e) => {
    e.stopPropagation();
    if (submitEnter(e)) {
      e.preventDefault();
      go();
    }
  };
}

export function openPetCard(id: string) {
  const d = petDef(id);
  // 이미 본 카드(✕로 닫았거나 다른 길로 봄)는 다시 안 띄운다
  if (!d || !petState().got[id] || !petState().card.includes(id)) return;
  const html = `<div class="petcard"><div class="pcport">${portImg(id)}</div>
    <p class="sub">${esc(d.where)}에서 만났어요!</p>
    <p class="pcfx">${esc(d.fxText)} <small>(마을에 데려간 친구만 · 쓰다듬은 날 ×${PETS.patMult})</small></p>
    <label class="pcname">이름 짓기 ${nameInput(petName(id))}</label>
    <button class="bigbtn" id="pcGo">마을에 데려가기</button></div>`;
  // 창을 ✕로 닫아도 다시 뜨지 않게 여는 순간 「봤음」 (기본 이름 · 자리가 있으면 마을로) — 버튼은 이름만 정한다
  const r = closeCard(id);
  openWin('새 친구!', html);
  bindPortraits();
  let done = false;
  const go = () => {
    // 10/16: 한 번만 (조합 Enter + 확정 Enter로 두 번 돌면 두 번째엔 칸이 없어 기본 이름으로 되돌아갔다)
    if (done) return;
    done = true;
    const inp = document.getElementById('pcName') as HTMLInputElement | null;
    renamePet(id, inp?.value ?? petName(id));
    closeWin();
    if (r === 'out') {
      toast(`${petName(id)}${josaWa(petName(id))} 함께 마을로!`);
      setTimeout(() => petHearts(id, 4), 300);
    } else if (r === 'home') toast(`마을엔 ${PETS.outMax}마리까지 — ${petName(id)}는 펫 집에서 기다려요 (도감 「동물 친구」에서 바꿔요)`);
  };
  const b = document.getElementById('pcGo');
  if (b) b.onclick = go;
  bindNameInput(go);
}
function josaWa(w: string): string {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '와';
  return (c - 0xac00) % 28 ? '과' : '와';
}

// ───────── 마을 펫 메뉴 ─────────
let menuEl: HTMLElement | null = null;
let dropLayer: (() => void) | null = null;
export function closePetMenu() {
  menuEl?.remove();
  menuEl = null;
  dropLayer?.();
  dropLayer = null;
}
/** 마을 펫을 눌렀을 때 (이웃 마을 펫은 이름만) */
export function openPetMenu(id: string, x: number, y: number, guest = false) {
  closePetMenu();
  const d = petDef(id);
  if (!d) return;
  if (guest || S.visiting) return toast(`${d.name} — ${S.visiting?.name ?? '이웃'} 여관의 친구예요`);
  const patted = pattedToday(id);
  const el = document.createElement('div');
  el.id = 'petmenu';
  el.className = 'pmenu card px';
  el.innerHTML = `<b class="pmname">${esc(petName(id))}</b><small class="pmfx">${esc(d.fxText)}${patted ? ` · 오늘 ×${PETS.patMult}` : ''}</small><button id="ptPat" class="bigbtn sm" ${patted ? 'disabled' : ''}>${patted ? '오늘은 쓰다듬었어요' : '쓰다듬기'}</button><button id="ptName" class="bigbtn sm">이름 바꾸기</button><button id="ptHome" class="bigbtn sm">펫 집으로</button>`;
  document.body.appendChild(el);
  menuEl = el;
  if (vis('backRule')) dropLayer = pushLayer(closePetMenu);
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2))}px`;
  el.style.top = `${Math.max(8, Math.min(innerHeight - r.height - 8, y - r.height - 18))}px`;
  const on = (bid: string, f: () => void) => {
    const b = document.getElementById(bid);
    if (b)
      b.onclick = (e) => {
        e.stopPropagation();
        closePetMenu();
        f();
      };
  };
  on('ptPat', () => {
    const err = patPet(id);
    if (err) return toast(err);
    petHearts(id, 5);
    sfx('coin');
    toast(`${petName(id)} 쓰다듬기 ♥ 오늘 하루 「${d.fxText}」 ×${PETS.patMult}`);
  });
  on('ptName', () => openRename(id));
  on('ptHome', () => {
    petHome(id);
    toast(`${petName(id)}는 펫 집에서 쉬어요`);
  });
  setTimeout(() => {
    const off = (e: Event) => {
      if (!menuEl || menuEl.contains(e.target as Node)) return;
      closePetMenu();
      removeEventListener('pointerdown', off, true);
    };
    addEventListener('pointerdown', off, true);
  }, 0);
}
function openRename(id: string, back?: () => void) {
  openWin('이름 바꾸기', `<div class="petcard"><div class="pcport">${portImg(id)}</div><label class="pcname">새 이름 ${nameInput(petName(id))}</label><button class="bigbtn" id="pcGo">바꾸기</button></div>`);
  bindPortraits();
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    const n = renamePet(id, (document.getElementById('pcName') as HTMLInputElement | null)?.value ?? petName(id));
    toast(`이제 「${n}」예요`);
    if (back) back();
    else closeWin();
  };
  const b = document.getElementById('pcGo');
  if (b) b.onclick = go;
  bindNameInput(go);
}

// ───────── 도감 「동물 친구」 ─────────

export const PET_TAB = '동물 친구';
export function petDexHtml(): string {
  const st = petState();
  const n = petCount();
  const cell = (id: string) => {
    const d = petDef(id)!;
    const g = st.got[id];
    // 못 만난 친구: 마을 도트(투명 바탕)를 까맣게 = 실루엣 (초상은 남색 바탕이라 네모가 된다) · 그림이 없으면 「?」
    if (!g) return `<div class="fcell pcell2 sil"><img class="petimg petsil" src="${petDotUrl(id)}" alt="" data-pet="${id}"><b>???</b><small class="lore">${esc(d.hint)}</small><small>나오는 곳: ${esc(d.where)}</small></div>`;
    const out = st.out.includes(id);
    return `<div class="fcell pcell2 on ${out ? 'out' : ''}">${portImg(id)}<b>${esc(g.name)}</b>${g.name !== d.name ? `<small>${esc(d.name)}</small>` : ''}<small class="g">${esc(d.fxText)}</small>${
      out ? `<button data-pethome="${id}" class="bigbtn sm">펫 집으로</button>` : `<button data-petout="${id}" class="bigbtn sm">마을로 데려가기</button>`
    }<button data-petname="${id}" class="bigbtn sm">이름 바꾸기</button></div>`;
  };
  const full = petPlaygroundUnlocked();
  return `<p class="sub">동물 친구 ${n}/${PET_IDS.length} · 마을에 ${st.out.length}/${PETS.outMax}마리</p>
    <p class="note">활동을 하다 보면 아주 가끔 찾아와요 · 효과는 마을에 데려간 친구만 · 마을에서 누르면 쓰다듬기(하루 1번 · 그날 효과 ×${PETS.patMult})</p>
    ${full ? `<p class="note g">10마리 모두! 칭호 「작은 동물원장」 · 명품관 「펫 놀이터」 열림</p>` : `<p class="note">10마리를 다 만나면 칭호 + 명품관 「펫 놀이터」</p>`}
    <div class="fgrid petgrid">${PET_IDS.map(cell).join('')}</div>`;
}
/** 도감 탭 버튼 (다시 그리기 = again) */
export function bindPetDex(again: () => void) {
  bindPortraits();
  $$('[data-petout]').forEach((b) => (b.onclick = () => {
    const err = petOut(b.dataset.petout!);
    if (err) toast(err);
    again();
  }));
  $$('[data-pethome]').forEach((b) => (b.onclick = () => {
    petHome(b.dataset.pethome!);
    again();
  }));
  $$('[data-petname]').forEach((b) => (b.onclick = () => openRename(b.dataset.petname!, again)));
}

// ───────── 시작 ─────────

let started = false;
/** main이 부른다: 통로 연결 · 못 본 카드 다시 · 주방 첫 펫 확인(3초마다 가볍게) */
export function initPets() {
  if (started) return;
  started = true;
  petHooks.got = (id) => {
    petFanfare(id);
    queueCard(id);
  };
  petHooks.hint = () => toast(PETS.hintLine);
  const tick = () => {
    if (!petsOn() || S.visiting) return;
    checkBundlePet();
    for (const id of petState().card) queueCard(id);
  };
  setTimeout(tick, 4000);
  setInterval(tick, 3000);
}

if (import.meta.env.DEV)
  Object.assign(window, {
    __pets: {
      card: openPetCard, menu: openPetMenu, fanfare: petFanfare, isOut, state: petState, grant: grantPet, rt: petRT, drawN: petDrawN,
      /** 마을 펫의 화면(CSS px) 위치 — 시트 스크립트용 */
      xy: (id: string) => {
        const f = petScreen(id);
        const cv = document.getElementById('scene');
        if (!f || !cv) return null;
        const r = cv.getBoundingClientRect();
        return [r.left + f[0] * view.SC, r.top + (f[1] - 6) * view.SC];
      },
    },
  });
