// save: C:/projects/legacy-of-adventure/tests/fixtures/real_woongs.json
// legendFrame (웅스 제보): 롯데캐슬 손님 창 「단골」 탭 — 전설 손님(주황)은 그대로인지 · window.__LF_ON = 이 플래그만 켜기(실험실 없이)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__LF_ON !== undefined) window.__flag('legendFrame', !!window.__LF_ON);
document.querySelector('#bGuest').click();
await T(900);
