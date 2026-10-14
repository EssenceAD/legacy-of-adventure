// 버그 고침(플래그 없음): 게임 시작 전 연출 마을(티저 · 타이틀 배경 — teaserView)은 저장하지 않는다
//  티저 중 원정 기록 보내기(sync) 등이 writeSave를 부르면 진짜 저장이 가짜 마을로 덮일 수 있었다
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { writeSave } from '../src/save/save';
import { teaserView } from '../src/world/grade';
import { S } from '../src/world/state';

beforeEach(() => localStorage.clear());
afterEach(() => (teaserView.g = -1));

describe('연출 마을(티저·타이틀 배경)은 저장하지 않는다', () => {
  it('시작 전 + teaserView 켜짐 → writeSave 무시 · 끄면 그대로', () => {
    const keep = { started: S.started, inn: S.innName };
    try {
      S.started = false;
      S.innName = '솔바람 여관';
      teaserView.g = 4;
      writeSave();
      expect(localStorage.getItem(CONFIG.save.key)).toBeNull();
      teaserView.g = -1;
      writeSave();
      expect(localStorage.getItem(CONFIG.save.key)).not.toBeNull();
    } finally {
      S.started = keep.started;
      S.innName = keep.inn;
    }
  });
});
