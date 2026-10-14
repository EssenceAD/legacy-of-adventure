// 손님 이름 항상 보기 (형철 판정 T1) — before: 설정 끔 그대로 · after: 설정 기본 탭에서 줄을 눌러 켬 → 창 닫고 마을
//  (shot-checkin.mjs 가 장면 앞에 LABEL = before|after 를 넣어 준다)
const W = (ms) => new Promise((r) => setTimeout(r, ms));
window.__openSettings('base');
await W(400);
const box = document.getElementById('mGuestNames');
if (!box) throw new Error('설정에 「손님 이름 항상 보기」 줄이 없어요');
if (LABEL === 'after' && !box.checked) box.click();
await W(200);
document.querySelector('#winX').click();
await W(1200);
