// 저장: v1~v6 옛 저장 → 최신 마이그레이션 후 금화·영웅·장부 진행이 그대로인가
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { migrate, readSave } from '../src/save/save';

const load = (v: number) => JSON.parse(fs.readFileSync(`tests/fixtures/v${v}.json`, 'utf8'));
const viaStorage = (d: unknown) => {
  localStorage.setItem(CONFIG.save.key, JSON.stringify(d));
  return readSave();
};

describe('저장 마이그레이션', () => {
  it('지금 저장 버전은 7 (땅 개편)', () => expect(CONFIG.save.version).toBe(7));
  for (const v of [2, 3, 4, 5, 6]) {
    it(`v${v} → 최신: 금화·손님·영웅 그대로`, () => {
      const old = load(v);
      const s = viaStorage(old)!;
      expect(s).not.toBeNull();
      expect(s.version).toBe(CONFIG.save.version);
      expect(s.gold).toBe(old.gold);
      expect(s.adventurers.length).toBe(old.adventurers.length);
      expect(s.adventurers.filter((a) => a.status === 'hero').map((a) => a.heroId)).toEqual(old.adventurers.filter((a: { status: string }) => a.status === 'hero').map((a: { heroId: string }) => a.heroId));
      expect(s.buildings.length).toBe(old.buildings.length);
    });
  }
  it('v5·v6: 장부 진행(받은 임무)이 그대로', () => {
    for (const v of [5, 6]) {
      const old = load(v);
      const s = viaStorage(old)!;
      expect(s.progress.guide.claimed).toEqual(old.progress.guide.claimed);
      expect(s.progress.guide.idx).toBe(old.progress.guide.idx);
    }
  });
  it('v4 이전: 장부는 legacy(잠그지 않음)로 이어진다', () => {
    for (const v of [2, 3, 4]) expect(viaStorage(load(v))!.progress.guide.legacy).toBe(true);
  });
  it('v5 → v6: 어울림 발견 보상 이전 표시', () => {
    expect(migrate(load(5)).progress.harmony.migrate).toBe(true);
  });
  it('v1(1단계) → 최신: 금화·손님(단골로)·밤 시계', () => {
    const s = viaStorage(load(1))!;
    expect(s.gold).toBe(1234);
    expect(s.adventurers.map((a) => a.name)).toEqual(['알린', '미라']);
    expect(s.adventurers.every((a) => a.status === 'regular')).toBe(true);
    expect(s.clock).toBe((CONFIG.clock.nightStartHour - CONFIG.clock.dayStartHour) * 60);
  });
  it('모르는 버전·깨진 저장은 버린다', () => {
    expect(migrate({ version: 99 })).toBeNull();
    expect(migrate(null)).toBeNull();
    expect(viaStorage({ version: 6, buildings: [] })).toBeNull();
  });
});
