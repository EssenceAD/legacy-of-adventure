// R32 (형철): 전용 무기 첫 깨어남 「강화 이어받기」(영웅마다 1번 무료) · 전수 규칙 「고유·유물 → 전용」 한 방향 추가 · 플래그 끔 = 아무것도 안 함
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeLegend } from '../src/world/adventurers';
import { setFlag } from '../src/world/flags';
import { exEnhName, exInherit, exInheritPlan, exInheritUsed, exTransferWhy, grantEx } from '../src/world/exWeapons';
import { rwState } from '../src/world/frags';
import { equip, makeItem } from '../src/world/items';
import { transferPlan } from '../src/world/enhTransfer';
import { makeUnique } from '../src/world/uniques';
import { UNIQUES } from '../src/data/story/uniques';
import { P, resetProgress, S, uiHooks, world, type Item } from '../src/world/state';
import { exWear } from '../src/ui/exWeapons';

const origAnnounce = uiHooks.announce;
const legend = (key = 'leon', stars = 5) => {
  const a = makeLegend(key, 5, 5);
  a.id = P.nextAdvId++;
  a.status = 'hero';
  a.stars = stars;
  world.actors.push(a);
  return a;
};
const weapon = (enh: number, grade: Item['grade'] = 'l'): Item => {
  const it = makeItem('forest', grade, 'weapon', false);
  it.enh = enh;
  P.bag.push(it);
  return it;
};
/** 시트 버튼 누르기 (열린 뒤 0.35초 규칙은 시계를 앞으로) */
async function press(id: 'cshOk' | 'cshAlt' | 'cshNo') {
  await Promise.resolve();
  const b = document.getElementById(id) as HTMLButtonElement | null;
  expect(b, id).toBeTruthy();
  const now = performance.now();
  const spy = vi.spyOn(performance, 'now').mockReturnValue(now + 1000);
  b!.click();
  spy.mockRestore();
}

beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div><div id="view"></div>';
  world.actors = [];
  world.home = null;
  S.visiting = null as never;
  S.day = 5;
  setFlag('exWeapons', true);
  uiHooks.announce = () => {};
});
afterEach(() => {
  setFlag('exWeapons', false);
  uiHooks.announce = origAnnounce;
});

describe('강화 이어받기 (규칙)', () => {
  it('첫 깨어남 · 지금 무기가 더 높을 때만 · 단계와 「초월한」 이름이 옮겨지고 원래 무기는 +0', () => {
    const a = legend('leon');
    const old = weapon(16, 'a');
    old.name = '초월한 ' + old.name;
    old.tPity = 0.2;
    equip(a, old);
    const ex = grantEx('leon')!;
    const plan = exInheritPlan(a, ex);
    expect(plan).toMatchObject({ old, enh: 16 });
    expect(exInherit(a, ex)).toBe(true);
    expect(ex.enh).toBe(16);
    expect(ex.name.startsWith('초월한 ')).toBe(true);
    expect(old.enh).toBe(0);
    expect(old.name.startsWith('초월한')).toBe(false);
    expect(old.tPity ?? 0).toBe(0);
    expect(rwState().inh).toEqual(['leon']);
    // 한 번뿐
    expect(exInheritPlan(a, ex)).toBeNull();
    expect(exInherit(a, ex)).toBe(false);
  });
  it('「극의」(+20) · 이름표 규칙', () => {
    expect(exEnhName('극의 검', 20)).toBe('극의 검');
    expect(exEnhName('초월한 검', 20)).toBe('극의 검');
    expect(exEnhName('극의 검', 0)).toBe('검');
    expect(exEnhName('검', 15)).toBe('초월한 검');
  });
  it('안 나오는 때: 이미 깨어남 · 이미 씀 · 지금 무기가 낮음 · 다른 영웅 · 무기 없음', () => {
    const a = legend('leon');
    const ex = grantEx('leon')!;
    expect(exInheritPlan(a, ex)).toBeNull(); // 무기 없음
    const low = weapon(0);
    equip(a, low);
    expect(exInheritPlan(a, ex)).toBeNull(); // +0 → 옮길 게 없음
    low.enh = 9;
    expect(exInheritPlan(legend('grom'), ex)).toBeNull(); // 다른 영웅
    expect(exInheritPlan(a, ex)).not.toBeNull();
    exInheritUsed('leon');
    expect(exInheritPlan(a, ex)).toBeNull(); // 이미 씀
    rwState().inh = [];
    rwState().awoke.push('leon');
    expect(exInheritPlan(a, ex)).toBeNull(); // 이미 깨어남 (예전에 끼운 적 있음)
  });
  it('플래그 끔 = 아무것도 안 함', () => {
    const a = legend('leon');
    const old = weapon(12);
    equip(a, old);
    const ex = grantEx('leon')!;
    setFlag('exWeapons', false);
    expect(exInheritPlan(a, ex)).toBeNull();
    expect(exInherit(a, ex)).toBe(false);
    expect(old.enh).toBe(12);
    expect(ex.enh).toBe(0);
    expect(rwState().inh).toEqual([]);
  });
  it('옛 저장: inh 없으면 [] · 망가진 값 정리', () => {
    (P as { raidWeapon: unknown }).raidWeapon = { frags: 3, boxes: 0, got: {}, awoke: [] };
    expect(rwState().inh).toEqual([]);
    rwState().inh = ['leon', 'leon', 3 as never];
    expect(rwState().inh).toEqual(['leon']);
  });
});

describe('강화 이어받기 (시트 · exWear)', () => {
  const setup = () => {
    const a = legend('leon');
    const old = weapon(12);
    equip(a, old);
    const ex = grantEx('leon')!;
    return { a, old, ex };
  };
  it('[이어받고 끼우기] → 단계 옮김 + 끼움 · 다음 번엔 이어받기 시트 안 나옴', async () => {
    const { a, old, ex } = setup();
    const p = exWear(a, ex);
    expect(document.getElementById('cshAlt')?.textContent).toBe('그냥 끼우기');
    expect(document.getElementById('cshOk')?.textContent).toBe('이어받고 끼우기');
    expect(document.getElementById('cshNo')?.textContent).toBe('취소');
    await press('cshOk');
    expect(await p).toBe(true);
    expect(a.equip.weapon).toBe(ex.id);
    expect(ex.enh).toBe(12);
    expect(old.enh).toBe(0);
    expect(rwState().inh).toEqual(['leon']);
    // 다시 옛 무기 → 전용 무기: 보통 확인만 (지금 무기가 더 세면) · 이어받기 시트 아님
    equip(a, old);
    old.enh = 15;
    old.stats = { atk: 1e6, mag: 1e6 };
    const p2 = exWear(a, ex);
    expect(document.getElementById('cshAlt')).toBeNull();
    expect(document.querySelector('#csheet .csht')?.textContent).toBe('지금 무기가 더 세요');
    await press('cshNo');
    expect(await p2).toBe(false);
  });
  it('[그냥 끼우기] → 단계 그대로 · 한 번 쓴 것으로', async () => {
    const { a, old, ex } = setup();
    const p = exWear(a, ex);
    await press('cshAlt');
    expect(await p).toBe(true);
    expect(a.equip.weapon).toBe(ex.id);
    expect(ex.enh).toBe(0);
    expect(old.enh).toBe(12);
    expect(rwState().inh).toEqual(['leon']);
  });
  it('[취소] → 아무것도 안 바뀜 (다음에 또 물어봄)', async () => {
    const { a, old, ex } = setup();
    const p = exWear(a, ex);
    await press('cshNo');
    expect(await p).toBe(false);
    expect(a.equip.weapon).toBe(old.id);
    expect(ex.enh).toBe(0);
    expect(old.enh).toBe(12);
    expect(rwState().inh).toEqual([]);
    expect(rwState().awoke).toEqual([]);
    const p2 = exWear(a, ex);
    expect(document.getElementById('cshAlt')).toBeTruthy();
    await press('cshNo');
    await p2;
  });
  it('지금 무기가 없으면(또는 낮으면) 시트 없이 바로 끼움', async () => {
    const a = legend('leon');
    const ex = grantEx('leon')!;
    expect(await exWear(a, ex)).toBe(true);
    expect(a.equip.weapon).toBe(ex.id);
    expect(document.getElementById('csheet')).toBeNull();
  });
});

describe('전수 규칙 표 (R32: 고유·유물 → 전용 한 방향)', () => {
  it('전용→전용 O · 유물→전용 O · 고유→전용 O · 전설→전용 X · 전용→유물/고유/전설 X · 나머지 그대로', () => {
    S.gold = 1e9;
    const exA = grantEx('leon')!;
    const exB = grantEx('grom')!;
    const relic = weapon(8, 'a');
    const uq = makeUnique(UNIQUES.find((u) => u.slot === 'weapon')!);
    uq.enh = 8;
    P.bag.push(uq);
    const leg = weapon(8, 'l');
    const leg2 = weapon(0, 'l');
    exA.enh = 8;
    // 화면 없는 규칙
    expect(exTransferWhy(exA, exB)).toBe('');
    expect(exTransferWhy(relic, exB)).toBe('');
    expect(exTransferWhy(uq, exB)).toBe('');
    expect(exTransferWhy(leg, exB)).toContain('고유·유물');
    expect(exTransferWhy(exA, relic)).toContain('전용 무기에게만');
    expect(exTransferWhy(exA, uq)).toContain('전용 무기에게만');
    expect(exTransferWhy(relic, leg)).toBe('');
    // 전수 계획 (규칙 이유)
    const why = (g: Item, r: Item) => transferPlan(g, r).why;
    expect(why(exA, exB)).not.toMatch(/전용|유물/);
    expect(why(relic, exB)).not.toMatch(/전용|유물/);
    expect(why(uq, exB)).not.toMatch(/전용|유물/);
    expect(why(leg, exB)).toContain('고유·유물');
    expect(why(exA, relic)).toContain('전용 무기에게만');
    expect(why(exA, uq)).toContain('전용 무기에게만');
    expect(why(exA, leg2)).toContain('전용 무기에게만');
    // 다른 규칙은 그대로: 전설 → 유물 X · 같은 부위만
    expect(why(leg, relic)).toContain('유물끼리만');
    const armor = makeItem('forest', 'a', 'armor', false);
    P.bag.push(armor);
    expect(why(relic, armor)).toContain('같은 부위');
    // 옮겨지는 단계: 유물 → 전용은 같은 등급(유물) 규칙 = 그대로
    expect(transferPlan(relic, exB).to).toBe(8);
  });
});
