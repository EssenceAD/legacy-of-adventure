// 서비스워커: 에셋 캐시. 페이지(HTML)·JSON은 네트워크 먼저(업데이트가 바로 반영), 그림은 캐시 먼저 + 뒤에서 새로 받아 둠.
// 핫픽스 13: 에셋 주소에 ?v=빌드번호가 붙어서 버전마다 캐시 키가 다르다 → 새 코드가 옛 그림·옛 크기표를 받을 수 없다
const CACHE = 'legacy-0.12.2-beta-16f0f7a.mv40iv83';
const CORE = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

// 핫픽스 13: 업데이트 버튼이 기다리는 새 SW에게 바로 자리 잡으라고 할 때
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // 배경음악·마을 소리: 서비스워커 캐시에 넣지 않는다 (곡이 커서 · <audio>의 부분 요청이 깨지지 않게)
  if (/\/audio\/(bgm|amb)\//.test(new URL(req.url).pathname)) return;
  // 핫픽스 10 §14: 새 버전 확인 · 패치노트는 늘 네트워크 그대로 (캐시 먼저면 옛 내용이 보인다)
  if (/\/(version|patchnotes)\.json$/.test(new URL(req.url).pathname)) return;
  if (req.mode === 'navigate') {
    // 페이지: 네트워크 먼저, 오프라인이면 캐시
    // 핫픽스 10 §14: 브라우저 HTTP 캐시(Pages max-age 10분)도 건너뛰고 서버에 확인 → 새로고침하면 진짜 새 index.html
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./'))),
    );
    return;
  }
  // 핫픽스 13: JSON(크기표·창문·문·지붕·몬스터 meta)은 네트워크 먼저, 안 되면 캐시
  if (/\.json$/.test(new URL(req.url).pathname)) {
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || Response.error())),
    );
    return;
  }
  // 에셋: 캐시 먼저, 뒤에서 새로 받아 캐시 갱신
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
