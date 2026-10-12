// ONBOARDING §0: 첫 5분 퍼널 — 기기마다 단계별로 한 번씩 (props.t = 앱을 켠 뒤 지난 초)
//  boot_ok → title_tap → opening_start → opening_skip/opening_end → inn_named → village_first → first_guest → first_build → first_run → first_hunt → min5 · owner_open → owner_done
import { getPref, setPref } from '../save/save';
import { track } from './telemetry';

const T0 = typeof performance !== 'undefined' ? performance.now() : 0;
export const sinceStart = () => Math.round(((typeof performance !== 'undefined' ? performance.now() : 0) - T0) / 100) / 10;
export type FunnelStep =
  | 'boot_ok' | 'title_tap' | 'owner_open' | 'owner_done' | 'opening_start' | 'opening_skip' | 'opening_end' | 'inn_named'
  | 'village_first' | 'first_guest' | 'first_build' | 'first_run' | 'first_hunt' | 'min5';
export function funnel(step: FunnelStep, extra: Record<string, unknown> = {}) {
  const done = getPref<string[]>('funnel', []);
  if (done.includes(step)) return;
  setPref('funnel', [...done, step]);
  track(step, { t: sinceStart(), ...extra });
}
