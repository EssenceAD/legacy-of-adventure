// PHOTO_SPEC: 사진 모드 — UI 없이 마을만 · 틀(폰 9:19.5 · 1:1 · 16:9) · 시간(지금·아침·노을·밤) · 손님 보이기/숨기기 · 멈추기 · 여관 이름 글씨
//  셔터 → 같은 renderFrame을 오프스크린에 그려 틀만큼 자르고 정수 배율로 크게(폰 배경은 세로 2532px 근처) → 공유 / 다운로드 / 새 창
import { sfx } from '../audio/sfx';
import { clearOverlays } from './overlays';
import { view } from '../engine/iso';
import { photoState, renderFrame } from '../world/render';
import { markDirty, P, S } from '../world/state';
import { track as trackEv } from '../net/telemetry';
import { talk } from './dialogue';
import { toast } from './windows';
import { rememberPhoto } from './chronicle';

export type Frame = 'phone' | 'square' | 'wide';
export type PTime = 'now' | 'morning' | 'sunset' | 'night';
const FRAME_NAME: Record<Frame, string> = { phone: '폰 배경', square: '정사각', wide: '가로' };
const TIME_NAME: Record<PTime, string> = { now: '지금', morning: '아침', sunset: '노을', night: '밤' };
/** 저장 그림의 목표 높이(기기 픽셀) — 가장 가까운 정수 배율로 */
const TARGET_H: Record<Frame, number> = { phone: 2532, square: 2160, wide: 2160 };

const st = { frame: 'phone' as Frame, time: 'now' as PTime, people: true, freeze: false, caption: true };
export const photoOn = () => photoState.on;
/** 사진 모드 동안 손님 움직임 멈춤 (main 이 본다) */
export const photoFrozen = () => photoState.on && st.freeze;

/** 틀 크기(논리 px) — 화면 안 가운데 */
export function frameRect(f: Frame = st.frame, LW = view.LW, LH = view.LH): { x: number; y: number; w: number; h: number } {
  let w: number;
  let h: number;
  if (f === 'phone') {
    h = LH;
    w = Math.round((h * 9) / 19.5);
    if (w > LW) [w, h] = [LW, Math.round((LW * 19.5) / 9)];
  } else if (f === 'square') w = h = Math.min(LW, LH);
  else {
    w = LW;
    h = Math.round((w * 9) / 16);
    if (h > LH) [w, h] = [Math.round((LH * 16) / 9), LH];
  }
  return { x: Math.floor((LW - w) / 2), y: Math.floor((LH - h) / 2), w, h };
}
/** 정수 배율: 목표 높이에 가장 가까운 정수 (1 이상) */
export const photoScale = (f: Frame, h: number) => Math.max(1, Math.round(TARGET_H[f] / h));

function applyTime() {
  photoState.time = st.time;
  photoState.people = st.people;
}

export function enterPhoto() {
  // HOTFIX20 §1: 사진 모드 — 남은 오버레이 정리
  clearOverlays('photo');
  if (photoState.on) return;
  photoState.on = true;
  applyTime();
  document.body.classList.add('photo');
  let bar = document.getElementById('photoBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'photoBar';
    bar.className = 'px';
    document.getElementById('view')!.appendChild(bar);
    const fr = document.createElement('div');
    fr.id = 'photoFrame';
    document.getElementById('view')!.appendChild(fr);
  }
  drawBar();
  syncFrame();
  addEventListener('resize', syncFrame);
}
export function exitPhoto() {
  if (!photoState.on) return;
  photoState.on = false;
  photoState.time = 'now';
  photoState.people = true;
  st.freeze = false;
  document.body.classList.remove('photo');
  document.getElementById('photoBar')?.remove();
  document.getElementById('photoFrame')?.remove();
  removeEventListener('resize', syncFrame);
}

function seg<T extends string>(name: string, cur: T, opts: Record<T, string>) {
  return `<div class="pseg" data-seg="${name}">${(Object.keys(opts) as T[]).map((k) => `<button data-v="${k}" class="${k === cur ? 'on' : ''}">${opts[k]}</button>`).join('')}</div>`;
}
function drawBar() {
  const bar = document.getElementById('photoBar');
  if (!bar) return;
  bar.innerHTML = `${seg('frame', st.frame, FRAME_NAME)}${seg('time', st.time, TIME_NAME)}
    <div class="pseg"><button id="phPeople" class="${st.people ? 'on' : ''}">손님 ${st.people ? '보임' : '숨김'}</button><button id="phFreeze" class="${st.freeze ? 'on' : ''}">${st.freeze ? '멈춤' : '움직임'}</button><button id="phCap" class="${st.caption ? 'on' : ''}">이름 ${st.caption ? '넣기' : '빼기'}</button></div>
    <div class="pact"><button id="phExit">나가기</button><button id="phShot" class="shot" aria-label="찍기">📷</button></div>`;
  bar.querySelectorAll<HTMLElement>('[data-seg] button').forEach(
    (b) =>
      (b.onclick = () => {
        const which = b.parentElement!.dataset.seg as 'frame' | 'time';
        if (which === 'frame') st.frame = b.dataset.v as Frame;
        else st.time = b.dataset.v as PTime;
        applyTime();
        drawBar();
        syncFrame();
      }),
  );
  bar.querySelector<HTMLElement>('#phPeople')!.onclick = () => {
    st.people = !st.people;
    applyTime();
    drawBar();
  };
  bar.querySelector<HTMLElement>('#phFreeze')!.onclick = () => {
    st.freeze = !st.freeze;
    drawBar();
  };
  bar.querySelector<HTMLElement>('#phCap')!.onclick = () => {
    st.caption = !st.caption;
    drawBar();
  };
  bar.querySelector<HTMLElement>('#phExit')!.onclick = exitPhoto;
  bar.querySelector<HTMLElement>('#phShot')!.onclick = () => void shoot();
}
/** 화면의 틀 표시 (바깥은 어둡게) */
function syncFrame() {
  const el = document.getElementById('photoFrame');
  if (!el) return;
  const r = frameRect();
  Object.assign(el.style, { left: `${r.x * view.SC}px`, top: `${r.y * view.SC}px`, width: `${r.w * view.SC}px`, height: `${r.h * view.SC}px` });
}

/** 마을만 그린 사진 (캔버스) — 테스트에서도 쓴다 */
export function capture(f: Frame = st.frame, caption = st.caption): HTMLCanvasElement {
  const full = document.createElement('canvas');
  full.width = view.LW;
  full.height = view.LH;
  const fctx = full.getContext('2d')!;
  fctx.imageSmoothingEnabled = false;
  renderFrame(fctx, 0);
  const r = frameRect(f);
  const k = photoScale(f, r.h);
  const out = document.createElement('canvas');
  out.width = r.w * k;
  out.height = r.h * k;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  // 글씨는 논리 해상도에서 찍고 함께 키운다 (도트 글꼴이 또렷하게)
  const crop = document.createElement('canvas');
  crop.width = r.w;
  crop.height = r.h;
  const c = crop.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(full, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  if (caption) {
    const text = `${S.visiting ? S.visiting.name : S.innName || '내 여관'} · ${S.visiting ? '' : `${S.day}일차`}`.replace(/ · $/, '');
    c.font = '8px "Galmuri9"';
    c.textBaseline = 'alphabetic';
    c.fillStyle = 'rgba(28,16,24,.8)';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.fillText(text, 6 + dx, r.h - 6 + dy);
    c.fillStyle = '#fff3d6';
    c.fillText(text, 6, r.h - 6);
  }
  o.drawImage(crop, 0, 0, r.w * k, r.h * k);
  return out;
}

async function shoot() {
  sfx('build', { vol: 0.6 });
  flash();
  const cv = capture();
  // DIRECTION §1-3: 마지막 한 장은 여관 연대기 사진으로
  rememberPhoto(cv);
  const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'));
  trackEv('photo', { frame: st.frame, time: st.time, people: st.people, w: cv.width, h: cv.height });
  P.counters.photos = (P.counters.photos ?? 0) + 1;
  markDirty();
  if (!blob) return toast('사진을 만들지 못했어요');
  const name = `inn_${S.day}d_${st.frame}_${st.time}.png`;
  await saveBlob(blob, name);
  if (!P.meta.photoHint) {
    P.meta.photoHint = true;
    talk([['post', '예쁘다~ 배경화면으로 해 보세요!']]);
  }
}
/** 공유 → 다운로드 → 새 창(길게 눌러 저장) */
export async function saveBlob(blob: Blob, name: string): Promise<'share' | 'download' | 'window'> {
  try {
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '내 여관' });
      return 'share';
    }
  } catch (e) {
    // 사용자가 공유를 닫은 것 (AbortError)이면 그대로 끝
    if ((e as Error)?.name === 'AbortError') return 'share';
  }
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    if ('download' in a) {
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('사진을 저장했어요');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return 'download';
    }
  } catch {
    /* 새 창으로 */
  }
  const w = window.open();
  if (w) w.document.write(`<body style="margin:0;background:#111;color:#eee;font-family:sans-serif;text-align:center"><p>사진을 길게 눌러 저장하세요</p><img src="${url}" style="max-width:100%"></body>`);
  return 'window';
}
function flash() {
  const f = document.createElement('div');
  f.className = 'photoflash';
  document.getElementById('view')!.appendChild(f);
  setTimeout(() => f.remove(), 400);
}
