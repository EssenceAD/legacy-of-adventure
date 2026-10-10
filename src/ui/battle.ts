// 전투 화면 공용 틀 (핫픽스 5): 가로형 고정 장면(356×200) + 장면 위에 겹치는 HUD
//  위 가운데: 이름표 + 굵은 체력바(25% 눈금, 흰색 → 빨강 잔상)   위 오른쪽: 원형 타이머(10초 이하 빨갛게)
//  왼쪽 아래: 파티 초상화 3 + 체력바(대장 금테)                  오른쪽 아래: 반원 스킬 버튼(막기 크게 · 스킬 2 · 합동기 · AUTO)
// 토벌전(ui/raid.ts)과 사냥(ui/hunt.ts)이 함께 쓴다. 장면은 기기 픽셀 정수 배율(README 0장).
import { getPref, setPref } from '../save/save';
import type { Actor } from '../world/state';
import { esc, pic } from './common';
import { dpr, iconSrc, px, type IconKey } from './kit';

export const LW = 356;
export const LH = 200;
/** 줄 3개 (발이 닿는 y) */
export const LANES = [158, 172, 186];

export interface SkillBtn {
  id: 's1' | 's2' | 'combo' | 'block' | 'auto';
  icon: IconKey;
  name: string;
  desc: string;
}

/** 나중에 소리를 넣을 자리 */
export const sfx = (_name: 'tap' | 'skill' | 'block' | 'perfect' | 'hit' | 'crit' | 'win' | 'lose') => {};

export interface BattleView {
  root: HTMLElement;
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** 장면 1픽셀 = CSS 몇 px */
  sc: () => number;
  q: <T extends HTMLElement = HTMLElement>(s: string) => T;
  fit: () => void;
  setTitle: (t: string) => void;
  /** 0~1, 잔상과 함께 */
  setHp: (p: number, text: string) => void;
  setTimer: (sec: number) => void;
  setParty: (hp: number[]) => void;
  /** 남은 비율(0이면 준비) · 남은 초 */
  setCd: (id: 's1' | 's2', f: number, sec: number) => void;
  setChem: (v: number, enabled: boolean) => void;
  setAuto: (on: boolean) => void;
  warnBlock: (on: boolean) => void;
  num: (x: number, y: number, text: string, cls: string) => void;
  cutin: (imgs: string[], text: string) => void;
  flash: () => void;
  /** 세로 화면 기록창에 한 줄 (웨이브 · 처치 · 전리품) */
  log: (text: string, cls?: string) => void;
  destroy: () => void;
}

/** 전투 화면을 #view 위에 깐다 */
export function mountBattle(opt: { id: string; title: string; members: Actor[]; skills: SkillBtn[]; locked?: Partial<Record<SkillBtn['id'], boolean>> }): BattleView {
  const root = document.createElement('div');
  root.id = opt.id;
  root.className = 'battle';
  const btn = (s: SkillBtn) =>
    `<button class="sk sk-${s.id}" id="b_${s.id}" data-tip="${esc(s.name)}" data-desc="${esc(s.desc)}"><img src="${iconSrc(s.icon)}" alt="">${s.id === 's1' || s.id === 's2' ? `<i class="cdc"></i><em class="cdn"></em>` : ''}${s.id === 'combo' ? '<i class="ring"></i>' : ''}${opt.locked?.[s.id] ? '<u class="lk"></u>' : ''}</button>`;
  root.innerHTML = `
    <div class="rwipe"></div>
    <div class="stage" id="bStage"><canvas id="bCv"></canvas><div class="fx" id="bFx"></div>
      <div class="bhud top"><b class="bname" id="bName">${esc(opt.title)}</b>
        <div class="bhp"><u id="bLag"></u><i id="bBar"></i><s></s><s></s><s></s></div><small id="bHpTxt"></small></div>
      <div class="btimer" id="bTimer">0</div>
      <div class="bparty">${opt.members
        .map((m, i) => `<div class="pp ${i === 0 ? 'lead' : ''}"><img src="${pic(m)}" alt="${esc(m.name)}"><i><b id="bPhp${i}"></b></i></div>`)
        .join('')}</div>
      <div class="bskills">${opt.skills.map(btn).join('')}</div>
      <div class="btip" id="bTip" hidden></div>
    </div>
    <canvas class="bedge" id="bEdgeL"></canvas><canvas class="bedge" id="bEdgeR"></canvas>
    <div class="btouch" id="bTouch"><span>${opt.id === 'hunt' ? '여기를 탭해도 공격' : '탭: 공격 · 위아래로 밀기: 줄 옮기기'}</span></div><div class="blog" id="bLog"></div><div class="bpad" id="bPad"></div>
    <div id="rFlash"></div><div id="rCutin" hidden></div>
    <div class="rov" id="rResult" hidden><div class="card px res" id="rResBody"></div></div>`;
  document.getElementById('view')!.appendChild(root);
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector(s) as T;
  const cv = q<HTMLCanvasElement>('#bCv');
  const ctx = cv.getContext('2d')!;
  cv.width = LW;
  cv.height = LH;
  ctx.imageSmoothingEnabled = false;
  let SC = 1;

  // 장면: 가로형 고정 비율. 기기 픽셀 정수 배율로 화면 너비에 맞춘다
  // 세로 화면(핫픽스 6): 장면은 위쪽 · 아래는 기록창 + 엄지 영역 스킬 버튼. 장면 밖은 하늘/땅 색으로 이어 그린다
  const edgeL = q<HTMLCanvasElement>('#bEdgeL');
  const edgeR = q<HTMLCanvasElement>('#bEdgeR');
  for (const e of [edgeL, edgeR]) {
    e.width = 1;
    e.height = LH;
  }
  let tall = false;
  let geo = { top: 0, h: 0 };
  const fit = () => {
    const r = root.getBoundingClientRect();
    tall = r.height / r.width > 1.3;
    root.classList.toggle('tall', tall);
    const k = Math.max(1, Math.floor(Math.min((r.width * dpr()) / LW, ((tall ? r.height * 0.42 : r.height * 0.9) * dpr()) / LH)));
    SC = k / dpr();
    const w = LW * SC;
    const h = LH * SC;
    const st = q('#bStage');
    st.style.width = w + 'px';
    st.style.height = h + 'px';
    const left = px((r.width - w) / 2);
    st.style.left = left + 'px';
    const top = px(tall ? Math.max(8, r.height * 0.04) : (r.height - h) / 2);
    st.style.top = top + 'px';
    geo = { top, h };
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    root.style.setProperty('--sc', String(SC));
    // HUD도 장면과 함께 정수 배율로 (폰 1 · 장면이 4배면 2)
    root.style.setProperty('--hz', String(Math.max(1, Math.floor(SC / 2))));
    // 장면 양옆: 가장자리 한 줄을 옆으로 늘려 이어 붙인다
    edgeL.style.cssText = `left:0;top:${top}px;width:${left}px;height:${h}px`;
    edgeR.style.cssText = `left:${left + w}px;top:${top}px;width:${r.width - left - w}px;height:${h}px`;
    // 스킬 버튼: 세로면 장면 아래 엄지 영역으로
    const sk = q('.bskills');
    const home = tall ? q('#bPad') : st;
    if (sk.parentElement !== home) home.insertBefore(sk, tall ? null : q('#bTip'));
    q('#bLog').style.top = top + h + 8 + 'px';
    q('#bTouch').style.top = top + h + 'px';
    paintBack();
  };
  /** 장면 맨 윗줄·아랫줄 평균색 → 하늘/땅 배경, 양옆 가장자리 복사 */
  const avg = (y: number) => {
    const d = ctx.getImageData(0, y, LW, 1).data;
    let R = 0, G = 0, B = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) (R += d[i], G += d[i + 1], B += d[i + 2], n++);
    return n ? [R / n, G / n, B / n].map(Math.round) : null;
  };
  let lastBack = '';
  const paintBack = () => {
    if (!tall) {
      root.style.background = '';
      return;
    }
    edgeL.getContext('2d')!.drawImage(cv, 0, 0, 1, LH, 0, 0, 1, LH);
    edgeR.getContext('2d')!.drawImage(cv, LW - 1, 0, 1, LH, 0, 0, 1, LH);
    const sky = avg(0);
    const gr = avg(LH - 1);
    if (!sky || !gr) return;
    const c = (v: number[], f = 1) => `rgb(${v.map((x) => Math.round(x * f)).join(',')})`;
    const mid = geo.top + geo.h / 2;
    const bg = `linear-gradient(to bottom, ${c(sky)} 0, ${c(sky)} ${mid}px, ${c(gr)} ${mid}px, ${c(gr)} ${geo.top + geo.h + 4}px, ${c(gr, 0.45)} 100%)`;
    if (bg !== lastBack) root.style.background = lastBack = bg;
  };
  const backT = window.setInterval(paintBack, 300);
  // 세로 화면: 장면 아래 빈 땅도 장면처럼 (탭 = 공격 · 위아래 밀기 = 줄 이동) → 장면 캔버스로 넘긴다
  const pass = (e: PointerEvent) => cv.dispatchEvent(new PointerEvent(e.type, { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, bubbles: true }));
  for (const t of ['pointerdown', 'pointerup'] as const) q('#bTouch').addEventListener(t, pass);
  addEventListener('resize', fit);

  // 길게 누르면 이름·설명 말풍선 (그때는 눌림으로 치지 않는다)
  let tipT = 0;
  let tipShown = false;
  root.querySelectorAll<HTMLElement>('.sk').forEach((b) => {
    b.addEventListener('pointerdown', () => {
      tipShown = false;
      clearTimeout(tipT);
      tipT = window.setTimeout(() => {
        tipShown = true;
        const t = q('#bTip');
        t.innerHTML = `<b>${b.dataset.tip}</b><small>${b.dataset.desc}</small>`;
        t.hidden = false;
      }, 450);
    });
    const end = () => {
      clearTimeout(tipT);
      q('#bTip').hidden = true;
    };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointerleave', end);
    b.addEventListener(
      'click',
      (e) => {
        if (tipShown) {
          e.stopImmediatePropagation();
          tipShown = false;
        } else sfx('tap');
      },
      true,
    );
  });

  let lag = 1;
  let lagT = 0;
  const view: BattleView = {
    root, cv, ctx, q, fit,
    sc: () => SC,
    setTitle: (t) => (q('#bName').textContent = t),
    setHp(p, text) {
      p = Math.max(0, Math.min(1, p));
      q('#bBar').style.width = p * 100 + '%';
      // 깎이면 흰 잔상이 잠깐 → 빨강으로 천천히 따라 내려온다
      if (p < lag) {
        clearTimeout(lagT);
        const el = q('#bLag');
        el.classList.add('white');
        lagT = window.setTimeout(() => {
          el.classList.remove('white');
          lag = p;
          el.style.width = p * 100 + '%';
        }, 300);
      } else {
        lag = p;
        q('#bLag').style.width = p * 100 + '%';
      }
      q('#bHpTxt').textContent = text;
    },
    setTimer(sec) {
      const el = q('#bTimer');
      el.textContent = String(Math.ceil(sec));
      el.classList.toggle('low', sec <= 10);
    },
    setParty(hp) {
      hp.forEach((v, i) => {
        const b = root.querySelector<HTMLElement>('#bPhp' + i);
        if (b) b.style.width = Math.max(0, Math.min(1, v)) * 100 + '%';
      });
    },
    setCd(id, f, sec) {
      const b = q('#b_' + id);
      if (!b) return;
      const was = b.classList.contains('cool');
      // 시계 방향으로 걷히는 어두운 덮개
      (b.querySelector('.cdc') as HTMLElement).style.background = f > 0 ? `conic-gradient(transparent ${(1 - f) * 360}deg, rgba(10,8,20,.72) 0)` : 'none';
      (b.querySelector('.cdn') as HTMLElement).textContent = f > 0 ? String(Math.ceil(sec)) : '';
      b.classList.toggle('cool', f > 0);
      if (was && f <= 0) {
        b.classList.remove('pop');
        void b.offsetWidth;
        b.classList.add('pop');
      }
    },
    setChem(v, enabled) {
      const b = q('#b_combo');
      if (!b) return;
      (b.querySelector('.ring') as HTMLElement).style.background = `conic-gradient(#ff7aa8 ${v * 3.6}deg, rgba(255,255,255,.12) 0)`;
      b.classList.toggle('ready', enabled && v >= 100);
      (b as HTMLButtonElement).disabled = !enabled || v < 100;
    },
    setAuto: (on) => q('#b_auto')?.classList.toggle('on', on),
    warnBlock: (on) => q('#b_block')?.classList.toggle('warn', on),
    num(x, y, text, cls) {
      const e = document.createElement('div');
      e.className = 'dmg ' + cls;
      e.textContent = text;
      e.style.left = px(x * SC) + 'px';
      e.style.top = px(y * SC) + 'px';
      q('#bFx').appendChild(e);
      setTimeout(() => e.remove(), 900);
    },
    cutin(imgs, text) {
      const c = q('#rCutin');
      c.innerHTML = `<div class="band"></div>${imgs[0] ? `<img class="l" src="${imgs[0]}" alt="">` : ''}${imgs[1] ? `<img class="r" src="${imgs[1]}" alt="">` : ''}<div class="t">${esc(text)}</div>`;
      c.hidden = false;
      view.flash();
      setTimeout(() => (c.hidden = true), 1400);
    },
    flash() {
      const f = q('#rFlash');
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
    },
    log(text, cls = '') {
      const box = q('#bLog');
      const e = document.createElement('div');
      e.className = 'bl ' + cls;
      e.textContent = text;
      box.appendChild(e);
      while (box.children.length > 5) box.firstElementChild!.remove();
    },
    destroy() {
      clearInterval(backT);
      removeEventListener('resize', fit);
      root.remove();
    },
  };
  return view;
}

/** 첫 판 안내: 말풍선을 순서대로 (설정에서 다시 볼 수 있다) */
export function battleHints(view: BattleView, key: string, lines: string[]) {
  if (getPref<boolean>('hint-' + key, false)) return;
  setPref('hint-' + key, true);
  const tip = view.q('#bTip');
  let i = 0;
  const next = () => {
    if (!view.root.isConnected) return;
    if (i >= lines.length) {
      tip.hidden = true;
      return;
    }
    tip.innerHTML = `<img src="${iconSrc('skill_attack')}" alt=""><b>${esc(lines[i++])}</b>`;
    tip.hidden = false;
    setTimeout(next, 2600);
  };
  setTimeout(next, 1500);
}
export const resetBattleHints = () => {
  setPref('hint-raid', false);
  setPref('hint-hunt', false);
};

/** 캐릭터 그림을 장면에 2배로 (발 = y) */
export function drawChar(ctx: CanvasRenderingContext2D, fr: HTMLCanvasElement, x: number, y: number, flip = false) {
  const w = fr.width * 2;
  const h = fr.height * 2;
  if (flip) {
    ctx.save();
    ctx.translate(Math.round(x + w), Math.round(y - h + 2));
    ctx.scale(-1, 1);
    ctx.drawImage(fr, 0, 0, w, h);
    ctx.restore();
  } else ctx.drawImage(fr, Math.round(x), Math.round(y - h + 2), w, h);
}
