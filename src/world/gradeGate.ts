// 10/16 왈왈콩 gateFix: 4등급(도시) 마을 정문 아치를 진짜 정문(gate) 오브젝트로
//  예전: 아치는 울타리 밖에 덧그린 등급 장식이라 진짜 정문이 아니었다 → 정문을 또 지어야 했고, 어울림 「모험가의 문」·「대문 앞 환영」에 안 셌다
//  지금: 4등급이 되면(옛 저장은 처음 불러올 때 한 번) 입구 위에 진짜 정문을 놓는다 (팔기 없음 · 옮기기·넣어 두기 됨)
//  · 이미 지은 정문이 있으면 그대로 두고 아치만 감춘다 (정문은 하나 · 중복 없음)
//  · 입구 앞이 막혀 있으면 보관함에 + 토스트 · 기록 P.meta.gradeGate 로 두 번 안 준다
import { flag } from './flags';
import { townGrade } from './guide';
import { propKey } from './grade';
import { addObj, blocksDoor, canPlace, entrance, landBounds, pinEntrance, rebuildPaths } from './town';
import { markDirty, P, S, world } from './state';
import { lvlDecoHooks } from './levelDeco';

/** 등급 장식 아치의 이름표 (마을 안으로 옮긴 장식 목록에 넣으면 아치가 사라진다) */
export const G4_GATE_KEY = propKey({ id: 'g4_gate', k: 'gate', x: 0, y: 0, fw: 1, fh: 1 });

/** → 'placed' · 'stored' · 'had'(이미 정문 있음) · null(할 일 없음) */
export function grantGradeGate(): 'placed' | 'stored' | 'had' | null {
  if (!flag('gateFix') || S.visiting || townGrade() < 4) return null;
  const meta = P.meta as typeof P.meta & { gradeGate?: string };
  if (meta.gradeGate) return null;
  const hide = () => {
    if (!P.harmony.moved.includes(G4_GATE_KEY)) P.harmony.moved.push(G4_GATE_KEY);
  };
  // 입구 고정 먼저 (정문이 들어서면서 입구가 바뀌지 않게)
  pinEntrance();
  const had = world.objs.some((o) => o.kind === 'gate') || (P.decor?.store ?? []).some((s) => s.kind === 'gate');
  if (had) {
    meta.gradeGate = 'had';
    hide();
    markDirty();
    return 'had';
  }
  const [ex, ey] = entrance();
  const [, b] = landBounds();
  let at: [number, number] | null = null;
  // 2×2 정문: 아랫줄이 울타리 앞줄 · 입구 칸이 왼쪽 → 오른쪽 순
  for (const dx of [0, 1]) {
    const t = { kind: 'gate' as const, tx: ex - dx, ty: b - 2, fw: 2, fh: 2 };
    if (ey === b - 1 && canPlace(t) && !blocksDoor(t)) {
      at = [t.tx, t.ty];
      break;
    }
  }
  hide();
  if (at) {
    addObj('gate', at[0], at[1], { fromProp: true, builtAt: Date.now() });
    rebuildPaths();
    meta.gradeGate = 'placed';
  } else {
    (P.decor.store ??= []).push({ kind: 'gate', lvl: 1, hue: null, flip: false, fromProp: true });
    meta.gradeGate = 'stored';
    lvlDecoHooks.stored('마을 입구 앞이 막혀서 「정문」을 보관함에 넣어 뒀어요 · 꾸미기 → 보관함에서 꺼내 울타리 앞에 놓아요');
  }
  markDirty();
  return meta.gradeGate as 'placed' | 'stored';
}
