// STARUP: 신화 「다섯 별」(starId)도 전설처럼 인연의 증표로 ★ — 같은 비용 · 같은 ★ 효과 · ★5 무기 = 그 별 궤적 색 · 무기 이름 알림 · 버튼 · 저장
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { STAR_IDS, STARS } from '../src/data/fivestars';
import { appearance, makeLegend, powerOf } from '../src/world/adventurers';
import { makeStar } from '../src/world/fivestars';
import { setFlag } from '../src/world/flags';
import { optSum } from '../src/world/items';
import { starUpLegend, starWeaponName, tokenNeed } from '../src/world/legends';
import { P, resetProgress, S, uiHooks, world, type Actor } from '../src/world/state';
import { readSave, snapshot } from '../src/save/save';
import { mythicStarPanel } from '../src/ui/guests';

let said: string[] = [];
const origAnnounce = uiHooks.announce;
const legend = () => {
  const a = makeLegend('aria', 5, 5);
  a.id = P.nextAdvId++;
  a.status = 'hero';
  world.actors.push(a);
  return a;
};
const star = (id = STAR_IDS[0]) => {
  const a = makeStar(id, 5, 5);
  a.id = P.nextAdvId++;
  world.actors.push(a);
  return a;
};
const upTo = (a: Actor, n: number) => {
  P.tokens = 99;
  while ((a.stars ?? 1) < n) expect(starUpLegend(a)).toBeNull();
};

beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div>';
  world.actors = [];
  world.home = null;
  S.day = 5;
  S.visiting = null as never;
  setFlag('fiveStars', true);
  said = [];
  uiHooks.announce = (t: string) => void said.push(t);
});
afterEach(() => {
  setFlag('fiveStars', false);
  uiHooks.announce = origAnnounce;
});

describe('★ 올리기 — 신화도 전설과 같은 비용', () => {
  it('starId 영웅이 증표 [1,1,2,3]으로 ★5까지', () => {
    expect(CONFIG.legends.tokenNeeds).toEqual([1, 1, 2, 3]);
    const a = star();
    expect(a.stars).toBe(1);
    P.tokens = 7;
    for (const need of [1, 1, 2, 3]) {
      const before = P.tokens;
      expect(tokenNeed(a.stars!)).toBe(need);
      expect(starUpLegend(a)).toBeNull();
      expect(P.tokens).toBe(before - need);
    }
    expect(a.stars).toBe(5);
    expect(P.tokens).toBe(0);
    expect(starUpLegend(a)).toBe('이미 ★5예요');
  });
  it('증표 모자라면 안 오름 · 합류 안 한(hero 아님) 신화는 안 됨', () => {
    const a = star();
    P.tokens = 0;
    expect(starUpLegend(a)).toMatch(/모자라요/);
    expect(a.stars).toBe(1);
    a.status = 'visitor';
    P.tokens = 5;
    expect(starUpLegend(a)).toMatch(/영입한/);
  });
  it('전설은 그대로 (같은 비용 · 유산 무기 알림 · 금빛)', () => {
    const a = legend();
    P.tokens = 7;
    upTo(a, 5);
    expect(P.tokens).toBe(99 - 7);
    expect(said).toEqual([`★ ${a.name}의 유산 무기가 깨어났습니다!`]);
    expect(appearance(a).def.weaponColor).toBe('#ffd36b');
  });
});

describe('★ 효과 — 같은 ★의 전설과 같은 배율', () => {
  it('전투력 ★마다 +starPowerPct (전설과 같은 비율)', () => {
    const l = legend();
    const m = star('gonu');
    const l1 = powerOf(l);
    const m1 = powerOf(m);
    for (const n of [2, 3, 4, 5]) {
      upTo(l, n);
      upTo(m, n);
      const want = 1 + CONFIG.legends.starPowerPct * (n - 1);
      expect(powerOf(l) / l1).toBeCloseTo(want, 1);
      expect(powerOf(m) / m1).toBeCloseTo(want, 1);
    }
  });
  it('고유 기술 ★3부터 ×1.5', () => {
    const m = star('gonu');
    const k = STARS.gonu.skill.k;
    const v1 = optSum(m, k);
    expect(v1).toBeGreaterThan(0);
    upTo(m, 2);
    expect(optSum(m, k)).toBe(v1);
    upTo(m, 3);
    expect(optSum(m, k)).toBeCloseTo(v1 + STARS.gonu.skill.v * 0.5, 5);
  });
});

describe('★5 — 그 별의 궤적 색 · 무기 이름 알림', () => {
  const expectTxt: Record<string, string> = {
    woongs: '★ 웅스의 양손 대검이 깨어났습니다!',
    gonu: '★ 고느끼의 쌍단검이 깨어났습니다!',
    ikamolly: '★ 이카몰리의 바람개비 지팡이가 깨어났습니다!',
    walwal: '★ 왈왈콩선생의 발자국 성표가 깨어났습니다!',
    warmnight: '★ 따뜻한밤의 장궁이 깨어났습니다!',
  };
  for (const id of STAR_IDS)
    it(id, () => {
      const a = star(id);
      const c4 = appearance(a).def.weaponColor;
      upTo(a, 4);
      expect(appearance(a).def.weaponColor).toBe(c4);
      expect(said).toEqual([]);
      upTo(a, 5);
      expect(appearance(a).def.weaponColor).toBe(STARS[id].trail);
      expect(said).toEqual([expectTxt[id]]);
    });
  it('궤적 색 상수', () => {
    expect(STAR_IDS.map((id) => STARS[id].trail)).toEqual(['#ffd36b', '#f4a3be', '#8fc6e0', '#ffffff', '#ffa040']);
    expect(starWeaponName('warmnight')).toBe('장궁');
  });
});

describe('영웅 창 ★ 올리기 버튼', () => {
  it('신화 영웅 창에 버튼 (★5면 버튼 대신 완성)', () => {
    const a = star('walwal');
    P.tokens = 1;
    expect(mythicStarPanel(a)).toMatch(/id="lgStar"[^>]*>★2 올리기 \(인연의 증표 1\/1\)/);
    upTo(a, 5);
    const h = mythicStarPanel(a);
    expect(h).not.toContain('lgStar');
    expect(h).toContain('발자국 성표가 깨어났어요');
  });
  it('전설·일반·플래그 꺼짐이면 신화 패널 없음', () => {
    expect(mythicStarPanel(legend())).toBe('');
    const a = star();
    setFlag('fiveStars', false);
    expect(mythicStarPanel(a)).toBe('');
  });
});

describe('저장', () => {
  it('신화 ★ 저장 → 다시 불러오기 · 옛 저장(★ 없음)은 1', () => {
    const a = star('ikamolly');
    const b = star('woongs');
    upTo(a, 4);
    delete b.stars;
    const snap = snapshot();
    snap.buildings = [{ kind: 'inn', tx: 10, ty: 10, lvl: 1, hue: null, flip: false } as never];
    localStorage.setItem(CONFIG.save.key, JSON.stringify(snap));
    const d = readSave()!;
    expect(d.adventurers.find((x) => x.starId === 'ikamolly')!.stars).toBe(4);
    const ob = d.adventurers.find((x) => x.starId === 'woongs')!;
    expect(ob.stars ?? 1).toBe(1);
    expect(tokenNeed(ob.stars ?? 1)).toBe(1);
  });
});
