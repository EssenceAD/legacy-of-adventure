// L2 UI 끄기 구경 모드 (전: 그냥 마을 · 후: UI가 숨고 마을만 + 오른쪽 위 [📷])
const W = (ms) => new Promise((r) => setTimeout(r, ms));
document.querySelector('#bEye')?.click();
await W(600);
