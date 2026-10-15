// RIFTART 하늘 균열 전투를 하늘처럼 — 배경 고르기(균열만 하늘 · 나머지 그대로) · 부하 id · 그림 복사 스크립트(여러 번 돌려도 같음 · 목록 모듈) · 그림 없을 때 예비
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { RIFT_ART } from '../src/data/riftArt';
import { makeField } from '../src/combat/field';
import { monDef } from '../src/combat/mons';
import { bgMode, crackPath, RIFT_THEME, riftPropLayout } from '../src/combat/riftBg';
import { riftArtOf, riftLook } from '../src/combat/riftLook';
import { THEMES } from '../src/combat/theme';
import { makeAdventurer } from '../src/world/adventurers';
// @ts-expect-error 스크립트(.mjs)는 타입 없음
import { copyRiftArt, normMeta } from '../scripts/copy-rift-art.mjs';

const W = CONFIG.raidWeapon.world;
const crew = () => [makeAdventurer(5, 5), makeAdventurer(6, 6)];

describe('배경 고르기', () => {
  it('하늘 균열 판만 rift · 사냥 · 토벌 · 심연 보스는 지역 그대로', () => {
    const look = riftLook('ember');
    const rift = makeField('deep', 10, crew(), false, { mode: 'raid', raid: { look, hp: 1000, seconds: 60, power: 100 }, world: true, noFold: true });
    expect(bgMode(rift)).toBe('rift');
    expect(rift.riftKey).toBe('ember');
    const raid = makeField('deep', 10, crew(), false, { mode: 'raid', raid: { look: { ...look, id: 'nb_samurai' }, hp: 1000, seconds: 60, power: 100 } });
    expect(bgMode(raid)).toBe('region');
    expect(raid.riftKey).toBeUndefined();
    for (const r of ['forest', 'sky', 'deep'] as const) for (const st of [1, 10]) expect(bgMode(makeField(r, st, crew(), false))).toBe('region');
  });
  it('균열 바닥은 심연 팔레트가 아니라 연보라 구름 · 밖은 비어서 하늘이 보인다 · 지역 테마 표엔 없음', () => {
    expect(RIFT_THEME.pal).not.toEqual(THEMES.deep.pal);
    expect(RIFT_THEME.light).toBe('rift');
    expect(Object.values(THEMES)).not.toContain(RIFT_THEME);
    expect(RIFT_THEME.outside(-3, 0, 0, 0.5, RIFT_THEME.pal)).toBe(RIFT_THEME.pal.void);
    expect(RIFT_THEME.pal.void).toBe('rgba(0,0,0,0)');
    const fbm = () => 0.5;
    const lum = (hex: string) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0) / 3;
    for (const h of [0.01, 0.2, 0.5, 0.9]) expect(lum(RIFT_THEME.floor(3, 3, h, 0.5, 15, RIFT_THEME.pal, fbm))).toBeGreaterThan(150);
  });
  it('빛나는 금은 화면 위쪽을 가로지른다 (412 · 1280 크기 모두 · 모습마다 같은 모양)', () => {
    for (const [LW, LH] of [[140, 305], [427, 267]])
      for (const key of ['sky', 'ember', 'frost']) {
        const a = crackPath(key, LW, LH);
        expect(crackPath(key, LW, LH)).toEqual(a);
        const xs = a.main.map((p) => p[0]);
        expect(Math.min(...xs)).toBeLessThan(LW * 0.1);
        expect(Math.max(...xs)).toBeGreaterThan(LW * 0.9);
        for (const [, y] of a.main) expect(y).toBeLessThan(LH * 0.35);
      }
  });
});

describe('부하 (하늘 몬스터)', () => {
  it('보스 모습마다 하늘 부하 · 그림 폴더가 있다', () => {
    const ids = Object.values(W.bosses).map((b) => b.minion);
    expect(new Set(ids)).toEqual(new Set(['na_butterfly', 'na_owl', 'na_lantern']));
    for (const id of ids) {
      expect(fs.existsSync(`public/assets/mon/${id}/sheet.png`), id).toBe(true);
      expect(fs.existsSync(`public/assets/mon/${id}/meta.json`), id).toBe(true);
      expect(monDef(id).id).toBe(id);
      expect(monDef(id).region).toBe('sky');
    }
    for (const k of Object.keys(W.bosses)) expect(riftLook(k).minion).toBe(W.bosses[k].minion);
  });
});

// 최소 PNG (서명 + IHDR 너비·높이) — 복사·너비 읽기만 하면 된다
const png = (w: number, h: number, tag = 0) => {
  const b = Buffer.alloc(33 + tag);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};

describe('그림 복사 (scripts/copy-rift-art.mjs)', () => {
  it('아무 그림도 없으면 빈 목록 · 오류 없음', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'riftart-'));
    const list = path.join(tmp, 'riftArt.ts');
    const r = copyRiftArt(path.join(tmp, 'nothing'), path.join(tmp, 'pub'), list);
    expect(r.bosses).toEqual([]);
    expect(r.props).toEqual([]);
    expect(fs.readFileSync(list, 'utf8')).toContain('{"bosses":[],"props":[]}');
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  it('보스 시트(두 모양) + 소품 복사 · 틀린 meta 는 건너뜀 · 두 번 돌려도 같음 · 목록 모듈', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'riftart-'));
    const raw = path.join(tmp, 'raw');
    const pub = path.join(tmp, 'pub');
    const list = path.join(tmp, 'riftArt.ts');
    fs.mkdirSync(path.join(raw, 'props'), { recursive: true });
    fs.mkdirSync(path.join(raw, 'rift_frost'), { recursive: true });
    // sky: 평평한 파일 · anims 없음 (4프레임) → 채워짐
    fs.writeFileSync(path.join(raw, 'rift_sky.png'), png(4 * 80, 2 * 96));
    fs.writeFileSync(path.join(raw, 'rift_sky.meta.json'), JSON.stringify({ frameW: 80, frameH: 96, anchor: [40, 94] }));
    // frost: 폴더 · nb_deep 과 같은 meta
    const deepMeta = JSON.parse(fs.readFileSync('public/assets/mon/nb_deep/meta.json', 'utf8'));
    fs.writeFileSync(path.join(raw, 'rift_frost/sheet.png'), png(62, 164));
    fs.writeFileSync(path.join(raw, 'rift_frost/meta.json'), JSON.stringify(deepMeta));
    // ember: meta 틀림
    fs.writeFileSync(path.join(raw, 'rift_ember.png'), png(10, 10));
    fs.writeFileSync(path.join(raw, 'rift_ember.meta.json'), '{"frameW":0}');
    for (const k of ['sky_island', 'crack', 'cloud_pillar', 'cloud']) fs.writeFileSync(path.join(raw, 'props', `${k}.png`), png(48, 64, k.length));
    fs.writeFileSync(path.join(raw, 'props', 'notes.txt'), 'x');

    const r = copyRiftArt(raw, pub, list);
    expect(r.bosses).toEqual(['sky', 'frost']);
    expect(r.props).toEqual(['cloud', 'cloud_pillar', 'crack', 'sky_island']);
    expect(r.skipped.join()).toContain('rift_ember');
    const skyMeta = JSON.parse(fs.readFileSync(path.join(pub, 'mon/rift_sky/meta.json'), 'utf8'));
    expect(skyMeta.anims.idle).toEqual({ row: 0, frames: 4, fps: 6, loop: true });
    expect(skyMeta.anims.attack.row).toBe(1);
    for (const a of ['idle', 'move', 'attack', 'charge', 'hurt', 'die']) expect(skyMeta.anims[a], a).toBeDefined();
    expect(skyMeta.code).toBe(false);
    const frostMeta = JSON.parse(fs.readFileSync(path.join(pub, 'mon/rift_frost/meta.json'), 'utf8'));
    expect(frostMeta.anims).toEqual(deepMeta.anims);
    expect(frostMeta.anchor).toEqual(deepMeta.anchor);
    expect(fs.readFileSync(path.join(pub, 'mon/rift_frost/sheet.png')).equals(png(62, 164))).toBe(true);
    expect(fs.existsSync(path.join(pub, 'mon/rift_ember'))).toBe(false);
    expect(fs.existsSync(path.join(pub, 'rift/props/sky_island.png'))).toBe(true);
    const ts = fs.readFileSync(list, 'utf8');
    expect(ts).toContain('export const RIFT_ART');
    expect(ts).toContain('"bosses":["sky","frost"]');
    expect(ts).toContain('"props":["cloud","cloud_pillar","crack","sky_island"]');

    // 두 번째: 같은 결과 · 파일을 다시 쓰지 않음
    const files = [list, path.join(pub, 'mon/rift_sky/sheet.png'), path.join(pub, 'mon/rift_sky/meta.json'), path.join(pub, 'rift/props/cloud.png')];
    const before = files.map((f) => fs.statSync(f).mtimeMs);
    const r2 = copyRiftArt(raw, pub, list);
    expect(r2).toEqual(r);
    expect(files.map((f) => fs.statSync(f).mtimeMs)).toEqual(before);
    expect(fs.readFileSync(list, 'utf8')).toBe(ts);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  it('normMeta: 한 장짜리는 코드 숨쉬기 · frameW 없으면 null', () => {
    expect(normMeta({ frameW: 50, frameH: 60, anchor: [25, 58] }, 50).code).toBe(true);
    expect(normMeta({ frameH: 60, anchor: [25, 58] }, 50)).toBeNull();
    expect(normMeta(null, 0)).toBeNull();
  });
  it('저장소의 목록 모듈 = public 에 실제로 있는 그림', () => {
    for (const k of RIFT_ART.bosses) {
      expect(fs.existsSync(`public/assets/mon/rift_${k}/sheet.png`), k).toBe(true);
      expect(fs.existsSync(`public/assets/mon/rift_${k}/meta.json`), k).toBe(true);
    }
    for (const k of RIFT_ART.props) expect(fs.existsSync(`public/assets/rift/props/${k}.png`), k).toBe(true);
  });
});

describe('그림이 없을 때 (예비)', () => {
  it('보스: 목록에 없으면 손그림 안 씀 (지금 보스를 키운 그림) · 있으면 씀', () => {
    expect(riftArtOf('sky', [])).toBe(false);
    expect(riftArtOf('ember', ['sky', 'ember'])).toBe(true);
    for (const k of ['sky', 'ember', 'frost']) expect(riftArtOf(k)).toBe(RIFT_ART.bosses.includes(k));
    expect(riftLook('nope').id).toBe('rift_sky');
  });
  it('소품: 없으면 아무것도 안 놓음 · 있으면 3~5개 · 모습마다 같은 배치 · 화면 안 (412 · 1280)', () => {
    expect(riftPropLayout('sky', [], 140, 305, () => [48, 64])).toEqual([]);
    const props = ['sky_island', 'crack', 'cloud_pillar', 'cloud', 'cloud2'];
    for (const [LW, LH] of [[140, 305], [427, 267]])
      for (const key of ['sky', 'ember', 'frost']) {
        const a = riftPropLayout(key, props, LW, LH, () => [96, 128]);
        expect(riftPropLayout(key, props, LW, LH, () => [96, 128])).toEqual(a);
        expect(a.length).toBeGreaterThanOrEqual(3);
        expect(a.length).toBeLessThanOrEqual(5);
        for (const p of a) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(LW);
          expect(p.y).toBeLessThanOrEqual(LH);
          expect(96 * p.s).toBeLessThanOrEqual(LW * 0.42 + 1);
          expect(128 * p.s).toBeLessThanOrEqual(LH * 0.3 + 1);
        }
      }
    // 그림 둘뿐이면 둘
    expect(riftPropLayout('sky', ['a', 'b'], 140, 305, () => [20, 20]).length).toBe(2);
  });
});
