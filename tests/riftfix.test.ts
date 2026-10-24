// R34 하늘 균열 보스 크기 · 자리 — 손그림 배율(artScale · 예비 그림은 그대로) · 그림 위끝이 공용 체력 막대 + 24px 밑 (360 · 412 · 1280 · 모습마다)
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { RIFT_ART } from '../src/data/riftArt';
import { riftArtScale, scaleMeta } from '../src/combat/riftLook';
import { RIFT_GAP, riftDrop, riftTopMin } from '../src/combat/riftBg';
import type { MonSheet } from '../src/combat/mon';

const B = CONFIG.raidWeapon.world.bosses;
const LOOKS = ['sky', 'ember', 'frost'] as const;
const meta = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8')) as MonSheet['meta'];

describe('손그림 배율 (artScale)', () => {
  it('config: sky 0.6 · ember 0.7 · frost 0.75', () => {
    expect([B.sky.artScale, B.ember.artScale, B.frost.artScale]).toEqual([0.6, 0.7, 0.75]);
    for (const k of LOOKS) expect(riftArtScale(k, true)).toBe(B[k].artScale);
  });
  it('예비 그림(기존 보스를 키운 시트)엔 배율을 안 쓴다 · 모르는 모습도 1', () => {
    for (const k of LOOKS) expect(riftArtScale(k, false)).toBe(1);
    expect(riftArtScale('nope', true)).toBe(1);
  });
  // asset_raw/ 는 .gitignore — 원본이 없는 기기(새로 클론한 곳)에선 이 비교만 건너뛴다
  it.skipIf(!fs.existsSync('asset_raw/rift/rift_sky.json'))('세 모습 손그림이 다 있다 (frost 새로)', () => {
    expect([...RIFT_ART.bosses].sort()).toEqual(['ember', 'frost', 'sky']);
    for (const k of LOOKS) {
      expect(fs.existsSync(`public/assets/mon/rift_${k}/sheet.png`)).toBe(true);
      expect(meta(`public/assets/mon/rift_${k}/meta.json`)).toMatchObject(meta(`asset_raw/rift/rift_${k}.json`));
    }
  });
  it('meta 가 같이 줄어든다 (프레임 · 발 기준점 · 눈) — sky 161px 고래 → 97px', () => {
    const m = meta('public/assets/mon/rift_sky/meta.json');
    const s = scaleMeta({ ...m, eyes: [[100, 40]] } as MonSheet['meta'], 0.6);
    expect([s.frameW, s.frameH, s.anchor]).toEqual([97, 72, [48, 71]]);
    expect((s as unknown as { eyes: number[][] }).eyes).toEqual([[60, 24]]);
    expect(s.anims).toBe(m.anims);
    expect(scaleMeta(m, 1)).toBe(m);
    for (const k of LOOKS) {
      const r = meta(`public/assets/mon/rift_${k}/meta.json`);
      const q = scaleMeta(r, B[k].artScale!);
      expect(q.frameW).toBeLessThanOrEqual(Math.round(r.frameW * 0.75));
      expect(q.anchor[1]).toBe(Math.round(r.anchor[1] * B[k].artScale!));
    }
  });
});

describe('그림 위끝 ≥ 공용 체력 막대 + 24px', () => {
  // 화면: 폰은 기기 배율 2 · 전투 줌 기본(K=5) · PC 는 1 · K=2 / 막대(.rftop) 아래끝 ≈ 106 CSS px
  const SCREENS = [
    { w: 360, h: 780, dpr: 2, K: 5 },
    { w: 412, h: 915, dpr: 2, K: 5 },
    { w: 1280, h: 800, dpr: 1, K: 2 },
  ];
  const BAR = 106;
  // 손그림(배율) · 예비 그림(기존 보스 × scale + 오라 3px) 두 경우의 발 기준점 높이
  const AY: [string, number][] = [];
  for (const k of LOOKS) {
    AY.push([`${k} 손그림`, scaleMeta(meta(`public/assets/mon/rift_${k}/meta.json`), B[k].artScale!).anchor[1]]);
    AY.push([`${k} 예비`, Math.round(meta(`public/assets/mon/${B[k].base}/meta.json`).anchor[1] * B[k].scale) + 3]);
  }
  it('막대 아래끝 → 논리 px (24px 여유 포함)', () => {
    expect(RIFT_GAP).toBe(24);
    expect(riftTopMin(106, 5, 2)).toBe(52);
    expect(riftTopMin(106, 2, 1)).toBe(65);
  });
  for (const S of SCREENS)
    it(`${S.w}px: 보스가 파티보다 0~3칸 위에 있어도 위끝이 막대 + 24px 밑 · 파티는 화면 안`, () => {
      const LH = Math.ceil((S.h * S.dpr) / S.K);
      const topMin = riftTopMin(BAR, S.K, S.dpr);
      const hero = Math.round(LH * 0.52);
      for (const [name, ay] of AY)
        for (let up = 0; up <= 48; up += 8) {
          const foot = hero - up;
          const d = riftDrop(foot, ay, topMin, hero, LH);
          expect(d, `${name} up${up}`).toBeGreaterThanOrEqual(0);
          // 위끝 (숨쉬기 1px 포함) — CSS px 로 막대 아래 24px 이상
          const topCss = ((foot + d - ay - 1) * S.K) / S.dpr;
          expect(topCss - BAR, `${name} up${up}`).toBeGreaterThanOrEqual(RIFT_GAP);
          expect(hero + d, `${name} up${up}`).toBeLessThanOrEqual(LH * 0.78);
        }
    });
  it('이미 충분히 아래면 안 내린다 · 내릴 자리가 없으면 화면 밖으로 밀지 않는다', () => {
    expect(riftDrop(200, 70, 52, 200, 366)).toBe(0);
    expect(riftDrop(60, 80, 52, 280, 366)).toBe(Math.floor(366 * 0.78 - 280));
    expect(riftDrop(60, 80, 52, 290, 366)).toBe(0);
  });
});
