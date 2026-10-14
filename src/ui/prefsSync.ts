// CHECKIN §C2 (settingsTabs): 설정값을 세이브(P.prefs)에도 — 폰·PC가 같은 설정
//  · 저장할 때: 이 기기 설정(localStorage 원문)을 모아 P.prefs = { at, v } (바뀐 게 있으면 at = 지금)
//  · 불러올 때: 세이브의 at이 이 기기 것보다 새로우면 세이브 값을 이 기기에 쓰고 다시 읽는다, 아니면 이 기기 값을 세이브에
//  · 플래그 끔: 아무것도 안 한다 (세이브에 prefs 칸을 만들지 않고, 있던 칸은 그대로 실어 둔다)
//  · 세이브가 건드릴 수 있는 키는 SYNC_PREF_KEYS 뿐 (아는 키 · 문자열만 — save.ts validPrefs)
import { reloadSoundPrefs } from '../audio/engine';
import { reloadSaver } from '../engine/fps';
import { reloadKeys } from '../engine/keys';
import { getPref, saveHooks, setPref, SYNC_PREF_KEYS, validPrefs } from '../save/save';
import { P, type PrefsBlob } from '../world/state';
import { reloadGuestNames } from '../world/guestNames';
import { reloadQuietPref } from '../world/quiet';
import { vis } from '../world/visual';
import { setFontStep } from './screen';

const PRE = 'legacy-of-adventure-';
/** 이 기기에서 마지막으로 모은 설정 (바뀌었는지 비교용) */
const SNAP = 'prefsSnap';

/** 이 기기 설정 원문 (있는 키만) */
export function collectPrefs(): Record<string, string> {
  const v: Record<string, string> = {};
  for (const k of SYNC_PREF_KEYS)
    try {
      const raw = localStorage.getItem(PRE + k);
      if (raw !== null) v[k] = raw;
    } catch {
      /* 저장소 없음 */
    }
  return v;
}
const same = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};
/**
 * 이 기기 설정 + 마지막으로 바뀐 시각: 지난번에 모은 뒤 바뀌었으면 지금 ·
 *  처음 모으는 거면 0 (언제 바꾼 건지 몰라서 가장 오래된 것으로 — 세이브에 든 설정이 있으면 그게 이긴다)
 */
export function localPrefs(now = Date.now()): PrefsBlob {
  const v = collectPrefs();
  const last = validPrefs(getPref<unknown>(SNAP, null));
  if (last && same(last.v, v)) return last;
  const blob = { at: last ? now : 0, v };
  setPref(SNAP, blob);
  return blob;
}

/**
 * 두 설정 중 어느 쪽을 쓸까 (순수 함수 · 테스트용): 세이브 쪽이 더 새로우면 'save', 아니면 'local'
 *  같은 시각이면 이 기기 것 (바꾸지 않는 쪽이 안전)
 */
export const pickPrefs = (local: PrefsBlob, save: PrefsBlob | undefined): 'save' | 'local' => (save && save.at > local.at ? 'save' : 'local');

/** 세이브 설정을 이 기기에 쓰고, 메모리에 들고 있던 값(소리·절약·단축키·글자 크기)을 다시 읽는다 */
function applyToDevice(b: PrefsBlob) {
  for (const k of SYNC_PREF_KEYS)
    try {
      if (k in b.v) localStorage.setItem(PRE + k, b.v[k]);
    } catch {
      /* 무시 */
    }
  setPref(SNAP, { at: b.at, v: collectPrefs() });
  reloadSoundPrefs();
  reloadSaver();
  reloadKeys();
  reloadGuestNames();
  reloadQuietPref();
  setFontStep(getPref<number>('fontStep', 0));
  // 마을 캔버스 배율 상한이 절약 여부로 바뀐다
  dispatchEvent(new Event('resize'));
}

/** 세이브를 불러온 직후 (game.applySave) — 둘 중 최근 것 */
export function mergePrefsOnLoad(): 'save' | 'local' | 'off' {
  if (!vis('settingsTabs')) return 'off';
  const local = localPrefs();
  const save = validPrefs(P.prefs);
  const pick = pickPrefs(local, save);
  if (pick === 'save') applyToDevice(save!);
  else if (Object.keys(local.v).length) P.prefs = local;
  return pick;
}

/** 부팅 때 한 번: 저장할 때마다 이 기기 설정을 세이브에 */
export function initPrefsSync() {
  saveHooks.beforeSnapshot = () => {
    if (!vis('settingsTabs')) return;
    const local = localPrefs();
    if (Object.keys(local.v).length) P.prefs = local;
  };
}
