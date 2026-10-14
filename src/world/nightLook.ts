// 밤 바닥 색 한 규칙 (웅스 신고: 새벽 04시 숲·바닥이 1~3초마다 잠깐 어두워짐)
//  바닥·숲의 밤 색 = 밤 색조(multiply) + 울타리 밖 숲 덧칠(calmWorld · multiply · 반투명)
//  예전엔 매 프레임 화면 전체에 multiply + 짝홀(evenodd) 자르기 + 반투명으로 다시 칠했다 → 이제 (바닥 · 밤 단계)마다 한 번 굽고
//  그 바깥 빈 곳 채움 색도 같은 값으로 계산한다. DOM·게임 모듈을 불러오지 않는다 (테스트에서 그대로 쓰게)

/** 숲 덧칠 색 (calmWorld 밤) */
export const VEIL_RGB: [number, number, number] = [0x6a, 0x6c, 0x9a];

export interface NightLook {
  /** 밤 단계 (0~steps) */
  nl: number;
  /** multiply 밤 색조 · 없으면 null (낮) */
  tint: [number, number, number] | null;
  /** 울타리 밖 숲 덧칠 세기 0~1 */
  veil: number;
}

/** 밤 색조 (engine/assets tintColor와 같은 식) */
export function tintRGB(nt: number): [number, number, number] {
  return [Math.round(255 - 200 * nt), Math.round(255 - 175 * nt), Math.round(255 - 90 * nt)];
}

/** 밤 단계 nl에서 바닥·숲에 쓰는 값 — 같은 (nl, calm)이면 늘 같은 값 */
export function nightLook(nl: number, steps: number, calm: boolean): NightLook {
  if (!nl) return { nl: 0, tint: null, veil: 0 };
  const nt = nl / steps;
  return { nl, tint: tintRGB(nt), veil: calm ? Math.min(1, nt * 0.9) : 0 };
}

/** 구운 밤 바닥의 캐시 키 (바닥 키 + 실제로 쓴 색) — 색이 같으면 다시 굽지 않는다 */
export const litKey = (groundKey: string, L: NightLook) => `${groundKey}|${L.tint ? L.tint.join(',') : '-'}|${L.veil.toFixed(3)}`;

/** 한 색에 밤 색을 씌운 결과 (캔버스 multiply와 같은 식: c·m/255 · 반투명 multiply는 c·(1−a+a·v/255)) — 바닥 그림 밖 빈 곳 채움 */
export function litHex(hex: string, L: NightLook, outside = true): string {
  const c = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16));
  const out = c.map((v, i) => {
    let r = v;
    if (L.tint) r = (r * L.tint[i]) / 255;
    if (outside && L.veil) r = r * (1 - L.veil + (L.veil * VEIL_RGB[i]) / 255);
    return Math.max(0, Math.min(255, Math.round(r)));
  });
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}
