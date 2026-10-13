// v0.24.2 innDecoObj: 여관·주점 레벨 장식(화분 ×2 · 석등 ×2 · 술통 ×1)이 진짜 장식으로 · 한 번만 · 막히면 보관함 · 팔기 없음
import { beforeEach, describe, expect, it } from 'vitest';
import { def } from '../src/data/catalog';
import { addObj, buildableKinds, canPlace, findKind, rebuildPaths, sizeFor, startTown } from '../src/world/town';
import { grantLevelDeco, LVL_GRANTS, lvlDecoHooks } from '../src/world/levelDeco';
import { refundStored, storeList, putAway } from '../src/world/store';
import { setFlag } from '../src/world/flags';
import { P, S, world, type Building } from '../src/world/state';

const setLvl = (o: Building, lvl: number) => {
  const [w, h] = sizeFor(o.kind, lvl);
  Object.assign(o, { tx: o.tx - (w - o.fw), ty: o.ty - (h - o.fh), fw: w, fh: h, lvl });
};
const msgs: string[] = [];
beforeEach(() => {
  S.visiting = false as never;
  S.land = 5;
  startTown();
  world.actors = [];
  P.decor = { autoPath: true, paint: {}, store: [], recent: [], hintSeen: false, round: {}, noPath: {}, seen: [], owned: [], bookGot: [] };
  P.meta.lvlDeco = {};
  msgs.length = 0;
  lvlDecoHooks.stored = (m) => msgs.push(m);
  setFlag('innDecoObj', true);
  setLvl(findKind('inn')!, 9);
  // 주점 Lv.5 하나 (빈 자리)
  let done = false;
  for (let y = 0; y < 40 && !done; y++)
    for (let x = 0; x < 40 && !done; x++) {
      const [w, h] = sizeFor('tavern', 5);
      if (canPlace({ kind: 'tavern', tx: x, ty: y, fw: w, fh: h }) && x + w < findKind('inn')!.tx - 2 && y > 12) {
        addObj('tavern', x, y, { lvl: 5 });
        done = true;
      }
    }
  rebuildPaths();
});
const kinds = () => world.objs.filter((o) => def(o.kind).levelDeco).map((o) => o.kind).sort();

describe('level deco objects', () => {
  it('옛 저장: 지금 레벨만큼 한 번 (화분 2 · 석등 2 · 술통 1) · 두 번째는 안 줌', () => {
    const r = grantLevelDeco(true);
    expect(r.placed + r.stored).toBe(5);
    const all = [...kinds(), ...storeList().map((s) => s.kind)].sort();
    expect(all).toEqual(['lvl_barrels', 'lvl_pot', 'lvl_pot', 'lvl_stone_lantern', 'lvl_stone_lantern']);
    expect(Object.keys(P.meta.lvlDeco).sort()).toEqual(['inn6', 'inn9', 'tavern5']);
    expect(grantLevelDeco(true)).toEqual({ placed: 0, stored: 0 });
    // 장식 칸은 건물·서로 겹치지 않는다
    const seen = new Set<string>();
    for (const o of world.objs) for (let j = 0; j < o.fh; j++) for (let i = 0; i < o.fw; i++) {
      const k = `${o.tx + i},${o.ty + j}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
  it('제자리에 유저 장식이 있으면 보관함 + 토스트', () => {
    const inn = findKind('inn')!;
    const pot = LVL_GRANTS[0].spots(inn)[0];
    addObj('bench', pot[0], pot[1]);
    rebuildPaths();
    grantLevelDeco(true);
    expect(storeList().some((s) => s.kind === 'lvl_pot')).toBe(true);
    expect(msgs.some((m) => m.includes('여관 앞이 꽉 차서 화분을 보관함에 넣어 뒀어요'))).toBe(true);
    expect(world.objs.find((o) => o.tx === pot[0] && o.ty === pot[1])?.kind).toBe('bench');
  });
  it('레벨업(onLoad=false): 제자리가 막혀도 문 근처 빈 칸에', () => {
    const inn = findKind('inn')!;
    for (const sp of LVL_GRANTS[1].spots(inn)) addObj('bench', sp[0], sp[1]);
    P.meta.lvlDeco = { inn6: 1, tavern5: 1 };
    rebuildPaths();
    const r = grantLevelDeco(false);
    expect(r.placed).toBe(2);
    expect(kinds()).toEqual(['lvl_stone_lantern', 'lvl_stone_lantern']);
  });
  it('플래그 끄면 아무것도 안 줌', () => {
    setFlag('innDecoObj', false);
    expect(grantLevelDeco(true)).toEqual({ placed: 0, stored: 0 });
    setFlag('innDecoObj', true);
  });
  it('건설 목록에 없음 · 넣어 두기 되고 · 팔아도 0', () => {
    grantLevelDeco(true);
    expect(buildableKinds()).not.toContain('lvl_pot');
    const o = world.objs.find((x) => def(x.kind).levelDeco)!;
    expect(putAway([o])).toBe(1);
    const s = storeList().find((x) => x.kind === o.kind)!;
    const g = S.gold;
    expect(refundStored(s)).toBe(0);
    expect(S.gold).toBe(g);
  });
});
