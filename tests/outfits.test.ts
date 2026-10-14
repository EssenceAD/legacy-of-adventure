// LUXE §1-3 영웅 의상실: 표 완성(29명 × 2) · 색 바꾸기는 허락된 색만 · 한 함수(같은 id → 같은 색) · 「친구」 ① + 소급 · ② 사기/가지기/입기 · 끄면 기본 옷
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { HEROES } from '../src/data/heroes';
import { LEGENDS } from '../src/data/legends';
import { STAR_IDS } from '../src/data/fivestars';
import { LUXE_OUTFITS } from '../src/data/luxe_cfg';
import { OUTFIT_CHARS, OUTFIT_IDS, OUTFITS, outfitsOf } from '../src/data/outfits';
import { dressGrid, dressPatch, lookOf, makeRemap, NEAR, outfitPalette, protectedColors, swapPairs } from '../src/engine/outfitPaint';
import { drawChar2, type Dot2, type Pose2 } from '../src/engine/sprites2';
import { readSave } from '../src/save/save';
import { appearance } from '../src/world/adventurers';
import { setFlag } from '../src/world/flags';
import {
  buyOutfit, charBaseDef, charOf, charOfPort, odState, outfitOnTie, outfitPrice, outfitShopRows, outfitSync, owns, wardrobeCells, wearOutfit, wornOf,
} from '../src/world/outfits';
import { freshOutfits, P, resetProgress, S, type Actor } from '../src/world/state';
import type { ClassDef } from '../src/data/classes';

const HEX = /^#[0-9a-f]{6}$/i;
const noWeapon = () => {};
const POSES: Pose2[] = [{}, { back: 1 }, { atk: 1, face: 'shout' }, { sit: 1, eat: 1 }, { cast: 2 }, { lx: -1, rx: 1, armF: 1, armB: -1, trail: 1, wf: 0 }];

function actorOf(char: string): Actor {
  const l = LEGENDS.find((x) => x.key === char);
  const h = HEROES.find((x) => x.id === char);
  const isStar = (STAR_IDS as string[]).includes(char);
  const base = charBaseDef(char)!;
  const kind = l?.kind ?? h?.kind ?? (isStar ? (Object.entries({ woongs: 'dwarf', gonu: 'rogue', ikamolly: 'mage', walwal: 'cleric', warmnight: 'hunter' }).find(([k]) => k === char)![1] as never) : 'knight');
  return {
    id: 100, kind, race: l?.race ?? h?.race ?? 'human', hair: base.hair, face: {}, status: 'hero', stars: 1, lvl: 1, xp: 0,
    equip: { weapon: null, armor: null, acc: null },
    ...(l ? { legendId: char } : h ? { heroId: char } : { starId: char }),
  } as unknown as Actor;
}
const dot2 = (d: ClassDef): Dot2 => d.dot2 as Dot2;
const gridColors = (G: ReturnType<typeof drawChar2>) => G.g.map((r) => r.map((p) => (p ? p.c : null)));

function fresh() {
  resetProgress();
  S.visiting = null as never;
  S.gold = 0;
  setFlag('heroDotV2', true);
  setFlag('fiveStars', true);
  setFlag('outfits', true);
}

describe('의상 표', () => {
  it('영웅 10 · 전설 14 · 다섯 별 5 = 29명 × 2벌 (형철 표 그대로 · 색은 #rrggbb)', () => {
    expect(OUTFIT_CHARS.length).toBe(29);
    expect(OUTFIT_IDS.length).toBe(58);
    const chars = OUTFIT_CHARS.map((c) => c.char).sort();
    expect(chars).toEqual([...HEROES.map((h) => h.id), ...LEGENDS.map((l) => l.key), ...STAR_IDS].sort());
    for (const c of OUTFIT_CHARS) {
      const os = outfitsOf(c.char);
      expect(os.map((o) => o.n)).toEqual([1, 2]);
      for (const o of os) {
        expect(o.name.length).toBeGreaterThan(0);
        for (const k of ['cloth', 'pants', 'accent'] as const) expect(o[k]).toMatch(HEX);
        if (o.extra) expect(o.extra).toMatch(HEX);
      }
      expect(charBaseDef(c.char)).toBeTruthy();
    }
    // 표 몇 줄 직접 확인
    expect(OUTFITS.kael_1).toMatchObject({ name: '가을 산책복', cloth: '#c8742e', pants: '#5a3a2a', accent: '#f0c860' });
    expect(OUTFITS.kael_1.extra).toBeUndefined();
    expect(OUTFITS.twins_2).toMatchObject({ name: '흑백 쌍둥이', extra: '#1e1e24' });
    expect(OUTFITS.warmnight_2).toMatchObject({ name: '은하 사냥꾼', cloth: '#2a3a6a', accent: '#a8f0f8', extra: '#3a5a9a' });
  });
  it('값: 영웅 200만 · 전설 300만~500만 · 다섯 별 500만 (①은 값 없음)', () => {
    for (const c of OUTFIT_CHARS) {
      const p = outfitPrice(c.char + '_2');
      expect(outfitPrice(c.char + '_1')).toBe(0);
      if (c.tier === 'hero') expect(p).toBe(2_000_000);
      if (c.tier === 'star') expect(p).toBe(5_000_000);
      if (c.tier === 'legend') expect(p >= 3_000_000 && p <= 5_000_000).toBe(true);
    }
  });
});

describe('색 바꾸기 (한 함수 dressGrid)', () => {
  beforeEach(fresh);
  afterEach(() => setFlag('outfits', false));

  it('모든 의상: 바뀐 칸은 머리 · 피부 · 수염 · 신발 · 투구 · 무기 · 눈 색이 아니다 · 머리색 칸은 그대로', () => {
    for (const id of OUTFIT_IDS) {
      const char = OUTFITS[id].char;
      const a = actorOf(char);
      const base = appearance(a, null).def;
      const worn = appearance(a, id).def;
      expect(worn.outfit).toBe(id);
      const look = lookOf(base);
      // 옷 색과 똑같은 지킬 색(그롬: 대머리라 머리색 = 옷 색)은 옷 쪽으로 본다
      const src = new Set(swapPairs(look, outfitPalette(id)!).map(([f]) => f.toLowerCase()));
      const prot = new Set(protectedColors(look).map((c) => c.toLowerCase()).filter((c) => !src.has(c)));
      for (const pose of POSES) {
        const A = drawChar2(base, dot2(base), pose, noWeapon);
        const B = dressGrid(worn, (x) => drawChar2(x, dot2(base), pose, noWeapon));
        const ca = gridColors(A);
        let changed = 0;
        for (let y = 0; y < A.h; y++)
          for (let x = 0; x < A.w; x++) {
            const p = A.g[y][x];
            const q = B.g[y][x];
            expect(!!p).toBe(!!q);
            if (!p || !q || p.c === q.c) continue;
            changed++;
            expect(p.tag, `${id} 눈 칸`).not.toBe('eye');
            expect(prot.has(p.c.toLowerCase()), `${id} 지킬 색 ${p.c} (${x},${y})`).toBe(false);
          }
        // 머리카락 색 칸은 하나도 안 바뀐다
        if (!src.has(look.hair.toLowerCase())) for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (ca[y][x] === look.hair) expect(B.g[y][x]!.c).toBe(look.hair);
        if (!pose.back) expect(changed, `${id} 바뀐 칸이 있어야`).toBeGreaterThan(0);
      }
    }
  });

  it('그림에 박힌 색: 원래 옷 색의 밝기 단계만 같은 순서로 옮긴다 · 지킬 색에 더 가까우면 그대로', () => {
    const remap = makeRemap([['#4a7a3a', '#c83a5a']], ['#7a4a2a']);
    expect(remap('#4a7a3a')).toBe('#c83a5a');
    // 어두운 단계 → 어두운 단계 (밝기 순서 유지)
    const dark = remap('#3e5236');
    expect(dark).toBeTruthy();
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(lum(dark!)).toBeLessThan(lum('#c83a5a'));
    expect(remap('#7a4a2a')).toBeNull();
    expect(remap('#ffffff')).toBeNull();
    expect(NEAR).toBeLessThanOrEqual(16);
  });

  it('같은 의상 id → 어느 길로 그려도 같은 색 (마을·전투 appearance · 초상화 charBaseDef)', () => {
    for (const id of OUTFIT_IDS) {
      const char = OUTFITS[id].char;
      const pal = outfitPalette(id)!;
      expect(pal).toEqual(outfitPalette(id));
      const fromActor = lookOf(appearance(actorOf(char), null).def);
      const fromPort = lookOf(charBaseDef(char)!);
      const pa = dressPatch(fromActor, pal);
      const pp = dressPatch(fromPort, pal);
      for (const k of ['cloth', 'pants', 'accent'] as const) expect(pa[k]).toBe(pal[k]), expect(pp[k]).toBe(pal[k]);
      // 바뀌는 쪽 색 목록은 의상 색에서만 나온다
      for (const [, to] of [...swapPairs(fromActor, pal), ...swapPairs(fromPort, pal)]) expect([pal.cloth, pal.pants, pal.accent, pal.extra]).toContain(to);
      // 그림 열쇠에 의상 id (캐시가 섞이지 않게)
      expect(appearance(actorOf(char), id).key.endsWith('|O:' + id)).toBe(true);
      expect(appearance(actorOf(char), null).key.includes('|O:')).toBe(false);
    }
  });
});

describe('얻기 · 사기 · 입기', () => {
  beforeEach(fresh);
  afterEach(() => setFlag('outfits', false));

  it('인연 「친구」(3단계) → ① · 2단계는 아직 · 오를 때 안내', () => {
    P.legends.elysia = { st: 'joined' } as never;
    P.ties.elysia = { pts: 30, stage: 2 } as never;
    expect(outfitSync()).toEqual([]);
    P.ties.elysia.stage = LUXE_OUTFITS.friendStage;
    outfitOnTie('elysia', 3);
    expect(owns('elysia_1')).toBe(true);
    expect(owns('elysia_2')).toBe(false);
    expect(odState().got).toContain('elysia_1');
  });

  it('소급: 이미 친구·신뢰·인연인 사람 전부 ① (한 번만) · 다섯 별은 합류 + 밤 대화', () => {
    P.dex.heroes.kael = { recruited: true } as never;
    P.ties.kael = { pts: 90, stage: 5 } as never;
    P.ties.brok = { pts: 50, stage: 3 } as never;
    P.ties.lira = { pts: 10, stage: 1 } as never;
    P.five.joined = ['woongs', 'gonu'];
    P.five.heart = ['woongs'];
    expect(outfitSync().sort()).toEqual(['brok_1', 'kael_1', 'woongs_1']);
    expect(outfitSync()).toEqual([]);
    expect(odState().owned.filter((x) => x === 'kael_1').length).toBe(1);
  });

  it('② 사기: 영입한 사람만 · 금화 · 한 번만 · 명품관 줄', () => {
    P.dex.heroes.kael = { recruited: true } as never;
    expect(buyOutfit('elysia_2').ok).toBe(false); // 영입 전
    expect(buyOutfit('kael_1').ok).toBe(false); // ①은 못 삼
    S.gold = 1_999_999;
    expect(buyOutfit('kael_2')).toMatchObject({ ok: false, msg: '금화가 모자라요' });
    const rows = outfitShopRows();
    expect(rows.map((r) => r.id)).toEqual(['kael_2']);
    expect(rows[0]).toMatchObject({ who: '카엘', name: '눈꽃 기사복', price: 2_000_000, owned: false, can: false, port: 'hero_kael' });
    S.gold = 2_500_000;
    expect(buyOutfit('kael_2').ok).toBe(true);
    expect(S.gold).toBe(500_000);
    expect(owns('kael_2')).toBe(true);
    expect(buyOutfit('kael_2').ok).toBe(false);
    expect(outfitShopRows()[0]).toMatchObject({ owned: true, can: false });
  });

  it('입기 (무료 · 가진 것만) → 마을·전투 그림 열쇠 · 초상화 키 · 옷장 칸', () => {
    P.dex.heroes.kael = { recruited: true } as never;
    expect(wearOutfit('kael', 'kael_2')).toBe(false);
    odState().owned.push('kael_2');
    S.gold = 7;
    expect(wearOutfit('kael', 'kael_2')).toBe(true);
    expect(S.gold).toBe(7);
    expect(wornOf('kael')).toBe('kael_2');
    expect(appearance(actorOf('kael')).def.outfit).toBe('kael_2');
    expect(charOf(actorOf('kael'))).toBe('kael');
    expect(charOfPort('hero_kael')).toBe('kael');
    expect(charOfPort('legend_momo2')).toBe('momo2');
    expect(charOfPort('star_woongs')).toBe('woongs');
    expect(charOfPort('g_knight_human')).toBeNull();
    const cells = wardrobeCells('kael');
    expect(cells.map((c) => [c.name, c.owned, c.worn])).toEqual([['기본 옷', true, false], ['가을 산책복', false, false], ['눈꽃 기사복', true, true]]);
    expect(cells[1].how).toContain('친구');
    expect(wearOutfit('kael', null)).toBe(true);
    expect(wornOf('kael')).toBeNull();
  });

  it('플래그 끔 → 모두 기본 옷 (가진 것·입은 것은 그대로) · 명품관 줄 없음 · 사기 안 됨', () => {
    P.dex.heroes.kael = { recruited: true } as never;
    odState().owned.push('kael_2');
    wearOutfit('kael', 'kael_2');
    const on = appearance(actorOf('kael'));
    setFlag('outfits', false);
    const off = appearance(actorOf('kael'));
    expect(off.def.outfit).toBeUndefined();
    expect(off.key).toBe(on.key.replace('|O:kael_2', ''));
    expect(wornOf('kael')).toBeNull();
    expect(outfitShopRows()).toEqual([]);
    S.gold = 1e9;
    expect(buyOutfit('kael_2').ok).toBe(false);
    expect(P.outfits.worn.kael).toBe('kael_2');
    expect(P.outfits.owned).toContain('kael_2');
  });

  it('이상한 저장 값은 바로잡는다 (모르는 id · 안 가진 걸 입음 · 남의 옷)', () => {
    P.outfits = { owned: ['kael_2', 'nope', 'kael_2', 'elysia_1'], worn: { kael: 'kael_1', elysia: 'kael_2', vael: 'x' }, got: 3 } as never;
    const st = odState();
    expect(st.owned).toEqual(['kael_2', 'elysia_1']);
    expect(st.worn).toEqual({});
    expect(st.got).toEqual([]);
  });
});

describe('실제 저장 불러오기', () => {
  afterEach(() => setFlag('outfits', false));
  it('real_*.json · v6: outfits 기본값 · 켜도 꺼도 가방·금화 그대로 · 소급은 친구 이상만', () => {
    const files = fs.existsSync('tests/fixtures') ? fs.readdirSync('tests/fixtures').filter((f) => /^(real_.*|v6)\.json$/.test(f)) : [];
    for (const f of files) {
      const raw = fs.readFileSync(`tests/fixtures/${f}`, 'utf8');
      localStorage.setItem(CONFIG.save.key, raw);
      const d = readSave();
      if (!d) continue;
      expect(d.progress.outfits).toEqual(freshOutfits());
      for (const on of [false, true]) {
        setFlag('outfits', on);
        resetProgress(structuredClone(d.progress));
        S.gold = d.gold;
        const got = outfitSync();
        for (const id of got) expect((P.ties[OUTFITS[id].char]?.stage ?? 0) >= 3 || P.five.heart.includes(OUTFITS[id].char)).toBe(true);
        expect(P.bag.length).toBe(d.progress.bag.length);
        expect(S.gold).toBe(d.gold);
      }
    }
  });
});
