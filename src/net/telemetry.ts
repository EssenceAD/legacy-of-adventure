// 플레이 기록 (밤샘 ④-3): 서버 함수 log_events로 모아 보내기만 한다 (읽지 않는다)
//  · 로그인 없이도 · 개인정보 없이 (기기 번호는 무작위) · 30초마다 + 앱을 내릴 때 · 실패하면 버리고 게임을 막지 않는다
//  · 설정 「플레이 기록 보내기」를 끄면 아무것도 보내지 않는다
// 다른 게임 모듈을 불러오지 않는다 (어디서나 불러도 순환이 생기지 않게)
declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const getPref = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem('legacy-of-adventure-' + k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const setPref = (k: string, v: unknown) => {
  try {
    localStorage.setItem('legacy-of-adventure-' + k, JSON.stringify(v));
  } catch {
    /* 무시 */
  }
};

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
const MAX_BATCH = 50;
const MAX_QUEUE = 200;

interface Ev {
  name: string;
  props: Record<string, unknown>;
}
let queue: Ev[] = [];
let started = 0;
const session = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function device(): string {
  let d = getPref<string>('device', '');
  if (!d) {
    d = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 36);
    setPref('device', d);
  }
  return d;
}
export const telemetryOn = () => getPref<boolean>('telemetry', true);
export function setTelemetry(on: boolean) {
  setPref('telemetry', on);
  if (!on) queue = [];
}

/** 이벤트 하나 (name 40자 · props 2000자 안으로) */
export function track(name: string, props: Record<string, unknown> = {}) {
  if (!telemetryOn() || !URL || !KEY || import.meta.env.MODE === 'test' || import.meta.env.DEV) return;
  let p = props;
  if (JSON.stringify(p).length > 2000) p = { cut: true };
  queue.push({ name: name.slice(0, 40), props: p });
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
}

/** 모아 둔 것을 보낸다 (keepalive: 앱을 내리는 순간에도 끝까지 간다) */
export function flush() {
  if (!queue.length || !URL || !KEY || !telemetryOn()) return;
  while (queue.length) {
    const batch = queue.splice(0, MAX_BATCH);
    try {
      void fetch(`${URL}/rest/v1/rpc/log_events`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ p_device: device(), p_version: APP_VERSION, p_session: session, p_events: batch }),
      }).catch(() => {});
    } catch {
      /* 버린다 */
    }
  }
}

export function initTelemetry(firstRun: boolean) {
  started = Date.now();
  track('session_start', { first: firstRun });
  setInterval(flush, 30000);
  addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    track('session_end', { sec: Math.round((Date.now() - started) / 1000) });
    flush();
  });
  // 잡히지 않은 오류 (앞 120자만)
  addEventListener('error', (e) => track('error', { msg: String(e.message ?? e.error ?? '').slice(0, 120) }));
  addEventListener('unhandledrejection', (e) => track('error', { msg: String((e as PromiseRejectionEvent).reason ?? '').slice(0, 120) }));
}
