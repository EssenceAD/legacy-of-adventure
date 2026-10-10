// 테스트 공통: 캔버스가 없는 환경(jsdom)에서 모듈이 불러와지게 최소한만 흉내
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : k === 'measureText' ? () => ({ width: 0 }) : () => {}) });
HTMLCanvasElement.prototype.getContext = (() => ctx2d) as never;
HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
