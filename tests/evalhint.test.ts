// EVAL_HINT_1021 (아자 건의): 평가 재료마다 「어떻게 올려요?」 · 테마 어울림 목록(숨은 건 힌트) · 시즌 편지 요약
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { HARMONIES } from '../src/data/harmony';
import { evalHarmonies, evalHow, evalParts, evalSummary } from '../src/world/evaluation';
import { partsTextAlt } from '../src/world/harmony';
import { P, resetProgress, S } from '../src/world/state';

beforeEach(() => {
  resetProgress();
  S.visiting = null as never;
});

describe('평가 재료 안내', () => {
  it('네 테마 모든 재료에 안내 한 줄', () => {
    for (const t of [0, 1, 2, 3]) for (const p of evalParts(t)) expect(evalHow(p.key, t), `${t}.${p.key}`).not.toBe('');
  });
  it('미식 어울림 = 1·6·7·18 · 공개는 이름과 부품 · 숨은 건 힌트', () => {
    const hs = evalHarmonies(0);
    expect(hs.map((h) => h.id)).toEqual(CONFIG.evaluation.themeHarmony.gourmet);
    expect(hs[0]).toMatchObject({ id: 1, known: true, name: '흥겨운 밤', done: false });
    expect(hs[0].text).toBe(partsTextAlt(HARMONIES.find((h) => h.id === 1)!));
    const hidden = hs.find((h) => h.id === 7)!;
    expect(hidden).toMatchObject({ known: false, name: '숨은 어울림' });
    expect(hidden.text).toContain(HARMONIES.find((h) => h.id === 7)!.hint);
    P.harmony.found.push(7);
    expect(evalHarmonies(0).find((h) => h.id === 7)!.name).toBe('술통 창고');
  });
  it('풍경은 어울림 목록 없음', () => {
    expect(evalHarmonies(3)).toEqual([]);
  });
  it('시즌 편지 요약', () => {
    expect(evalSummary(0)).toBe('이번 시즌 점수 재료: 주점 식사 · 텃밭 수확 · 식사 어울림(흥겨운 밤·장미 정원 + 숨은 2개) · 식사 뒤 기분');
  });
  it('바꿔 놓아도 되는 부품은 「또는」', () => {
    const multi = HARMONIES.find((h) => h.parts.some((p) => Array.isArray(p.k) && p.k.length > 1));
    if (multi) expect(partsTextAlt(multi)).toContain('또는');
  });
});
