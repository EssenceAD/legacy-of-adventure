// 전설 닉스 부탁 「은밀」: 도적이 낀 파티 의뢰 성공 시 30% · 닉스가 함께면 60% · 부탁 문구에 조건이 보임
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { LEGENDS } from '../src/data/legends';

describe('은밀', () => {
  it('확률: 기본 30% · 닉스 함께 60%', () => {
    expect(CONFIG.legends.stealth).toBe(0.3);
    expect(CONFIG.legends.stealthNyx).toBe(0.6);
  });
  it('부탁 문구에 조건이 드러남', () => {
    const t = (k: string) => LEGENDS.find((l) => l.key === k)!.request.text;
    expect(t('nyx')).toMatch(/도적이 낀 파티/);
    expect(t('luna')).toMatch(/파티에 넣고/);
    expect(t('aria')).toMatch(/방이나 온천/);
    expect(t('scarlet')).toMatch(/정보/);
    expect(t('ryuka')).toMatch(/정보/);
  });
});
