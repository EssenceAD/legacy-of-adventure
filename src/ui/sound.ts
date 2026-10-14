// 소리 화면: 상황 → 배경음악 고르기(0.5초마다) · 설정 「소리」 묶음 · 음악 목록 · 스피커 버튼(전체 음소거) · 버튼 「톡」
import { applyPrefs, initAudioEngine, prefs, toggleMute } from '../audio/engine';
import { heard, isPreviewing, previewTrack, setScene } from '../audio/music';
import { battleScene, TRACKS, type BattleSpecial, type Scene } from '../audio/playlists';
import { sfx } from '../audio/sfx';
import { P as PX } from '../engine/pixel';
import { hourNow, onNightFlip } from '../world/clock';
import { tour } from '../world/evalTour';
import { S } from '../world/state';
import { ownerHooks } from '../world/owner';
import { isBondUp, isTalking } from './dialogue';
import { talkDuck } from '../audio/engine';
import { currentScene } from '../audio/music';
import { onWinClose } from './windows';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

/** 이벤트 곡 (owner·dialogue가 켠다): 엔딩 > 불씨 > 인연 */
export const musicFlags = { ending: null as null | 'ending_adv' | 'ending_inn', ember: false, five: false };
/** 사냥 지역 · 토벌 보스 체력 30% 아래 · 특별한 전투(다섯 별 세트 첫 판 · 보스 연전 · 월드 레이드) — 전투 화면이 알려 준다 */
export const battleMusic = { huntRegion: 'forest', raidLow: false, special: null as BattleSpecial };

function wanted(): Scene {
  const titleOn = !$('#title').hidden || !S.started;
  const winCls = $('#win').className;
  if (musicFlags.ending && (isTalking() || (winCls.includes('endw') && winCls.includes(' on')))) return musicFlags.ending;
  if (musicFlags.ending) musicFlags.ending = null;
  if (titleOn) return 'title';
  if (musicFlags.ember && isTalking()) return 'ember';
  if (musicFlags.ember) musicFlags.ember = false;
  // MUSIC 2차: 다섯 별 합류 컷 + 이어지는 대화
  if (musicFlags.five && (document.getElementById('fiveCut') || isTalking())) return 'five';
  musicFlags.five = false;
  // 핫픽스 9: 곡 15(인연)는 인연 단계가 오르는 긴 대화에만 · 다른 대화·사건은 곡을 바꾸지 않고 덕킹
  if (isTalking() && isBondUp()) return 'bond';
  if (document.getElementById('hunt')) return battleScene('hunt', battleMusic);
  if (document.getElementById('raid')) return battleScene('raid', battleMusic);
  battleMusic.raidLow = false;
  if (tour.on) return 'eval';
  if (S.visiting) return 'neighbor';
  const h = hourNow();
  return h >= 19 || h < 5 ? 'night' : 'day';
}

let acc = 0;
let lastSwitch = -1e9;
/** 전투·타이틀·엔딩처럼 바로 바꿔야 하는 장면 */
const URGENT = /^(hunt|raid|title|ending|ember|none|five|abyss_rush|world_raid)/;
export function tickSound(dt: number) {
  acc += dt;
  if (acc < 0.5) return;
  acc = 0;
  // 대화창(인연 단계 이벤트 빼고): 곡은 그대로 · 음량 60%
  talkDuck(isTalking() && !isBondUp());
  if (isPreviewing()) return;
  const w = wanted();
  const now = performance.now();
  if (w !== currentScene()) {
    // 핫픽스 9: 장면이 10초 안에 또 바뀌면 곡을 바꾸지 않는다 (전투·타이틀은 바로)
    if (!URGENT.test(w) && !URGENT.test(currentScene()) && now - lastSwitch < 10000) return;
    lastSwitch = now;
  }
  setScene(w);
}

// ───────── 스피커 아이콘 (코드 도트 12×12) ─────────

function speakerIcon(muted: boolean): string {
  const c = document.createElement('canvas');
  c.width = 12;
  c.height = 12;
  const p = PX(c.getContext('2d')!);
  const w = '#efe2c6';
  p.rect(1, 4, 3, 4, w);
  p.rect(4, 3, 1, 6, w);
  p.rect(5, 2, 1, 8, w);
  p.rect(6, 1, 1, 10, w);
  if (muted) {
    for (let i = 0; i < 4; i++) {
      p.px(8 + i, 4 + i, '#ff7a7a');
      p.px(11 - i, 4 + i, '#ff7a7a');
    }
  } else {
    p.rect(8, 5, 1, 2, w);
    p.rect(10, 3, 1, 6, w);
    p.px(9, 4, w);
    p.px(9, 7, w);
  }
  return c.toDataURL();
}
function syncSpeakers() {
  const src = speakerIcon(prefs.muted);
  document.querySelectorAll<HTMLImageElement>('.spk img').forEach((im) => (im.src = src));
  document.querySelectorAll<HTMLButtonElement>('.spk').forEach((b) => b.setAttribute('aria-label', prefs.muted ? '소리 켜기' : '소리 끄기'));
}

// ───────── 설정 「소리」 ─────────

export function soundSettingsHtml(): string {
  const list = Object.entries(TRACKS)
    .map(([id, t]) => (heard.has(id) ? `<button class="trk" data-trk="${id}">${id} ${t.name}</button>` : `<button class="trk unk" disabled>${id} ???</button>`))
    .join('');
  return `<div class="snd"><p class="sub">소리</p>
    <label class="tog"><input type="checkbox" id="sBgm" ${prefs.bgmOn ? 'checked' : ''}> 배경음악 <input type="range" id="sBgmV" min="0" max="100" value="${Math.round(prefs.bgmVol * 100)}"></label>
    <label class="tog"><input type="checkbox" id="sSfx" ${prefs.sfxOn ? 'checked' : ''}> 효과음 <input type="range" id="sSfxV" min="0" max="100" value="${Math.round(prefs.sfxVol * 100)}"></label>
    <label class="tog"><input type="checkbox" id="sFan" ${prefs.fanfareOn !== false ? 'checked' : ''}> 팡파르 <small>승리·레벨업 음악 (끄면 작은 동전 소리만)</small></label>
    <button class="trk" id="sCbTest">전투 소리 미리 듣기</button>
    <details class="tracks"><summary>음악 목록 (${heard.size}/${Object.keys(TRACKS).length}) · 들어 본 곡만 · 누르면 미리 듣기</summary><div>${list}</div><button id="sStop" class="trk">미리 듣기 멈추기</button></details></div>`;
}
export function bindSoundSettings() {
  const ch = (id: string, f: (v: HTMLInputElement) => void) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.oninput = el.onchange = () => f(el);
  };
  ch('sBgm', (e) => ((prefs.bgmOn = e.checked), applyPrefs()));
  ch('sSfx', (e) => ((prefs.sfxOn = e.checked), applyPrefs(), sfx('tap')));
  ch('sFan', (e) => ((prefs.fanfareOn = e.checked), applyPrefs(), sfx('tap')));
  ch('sBgmV', (e) => ((prefs.bgmVol = +e.value / 100), applyPrefs(), sfx('tap')));
  ch('sSfxV', (e) => ((prefs.sfxVol = +e.value / 100), applyPrefs(), sfx('tap')));
  document.querySelectorAll<HTMLButtonElement>('[data-trk]').forEach((b) => (b.onclick = () => previewTrack(b.dataset.trk!)));
  // 핫픽스 8 (2-8): 전투 합성음 미리 듣기 — 타격 · 치명타 · 막기 · 완벽 · 직업 스킬 6
  const cb = document.getElementById('sCbTest');
  if (cb)
    cb.onclick = () =>
      ['hit', 'hit', 'crit', 'block', 'perfect', 'skill_knight', 'skill_warrior', 'skill_rogue', 'skill_mage', 'skill_priest', 'skill_hunter'].forEach((n, i) =>
        setTimeout(() => sfx(n), i * 420),
      );
  const st = document.getElementById('sStop');
  if (st) st.onclick = () => previewTrack(null);
}
/** 설정 창을 닫으면 미리 듣기 끝 */
export const endPreview = () => previewTrack(null);

export function initSound() {
  initAudioEngine();
  ownerHooks.ember = () => (musicFlags.ember = true);
  // 창을 닫으면 미리 듣기 끝 · 창 소리
  onWinClose(endPreview);
  // 밤이 되면 낮은 부엉이 2음
  onNightFlip((n) => n && S.started && !S.visiting && sfx('night'));
  document.querySelectorAll<HTMLButtonElement>('.spk').forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        toggleMute();
        syncSpeakers();
      }),
  );
  syncSpeakers();
  // 모든 버튼: 짧은 「톡」 (창 열기·닫기는 따로)
  document.addEventListener(
    'click',
    (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b && !b.disabled && b.id !== 'winX' && !b.classList.contains('spk')) sfx('tap');
    },
    true,
  );
}
