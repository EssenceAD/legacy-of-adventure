// 초상화 작업: 손님 대화창·정보 창 초상화 = 직업×종족 일러스트 (작은 목록 아이콘은 도트 그대로)
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { GUEST_KINDS, RACES } from '../src/data/classes';
import { PORTRAITS } from '../src/engine/assets';
import { pic, portrait } from '../src/ui/common';
import type { Actor } from '../src/world/state';

// 실제 불러오기 대신 등록만 (loadAssets와 같은 키·경로)
for (const k of GUEST_KINDS) for (const r of RACES) PORTRAITS[`g_${k}_${r}`] = `/assets/portraits/g_${k}_${r}.png`;
PORTRAITS.keeper = '/assets/portraits/keeper.png';
const guest = (kind: string, race?: string, extra: Partial<Actor> = {}) => ({ id: 1, kind, race, rarity: 'common', name: 'A', ...extra }) as unknown as Actor;

describe('portrait()', () => {
  it('직업 5 × 종족 4 = 20장 파일이 있고 이름이 맞다', () => {
    for (const k of GUEST_KINDS)
      for (const r of RACES) {
        expect(portrait(guest(k, r))).toBe(`/assets/portraits/g_${k}_${r}.png`);
        expect(fs.existsSync(`public/assets/portraits/g_${k}_${r}.png`)).toBe(true);
      }
  });
  it('종족이 없는 옛 저장 손님 → human', () => expect(portrait(guest('mage'))).toBe('/assets/portraits/g_mage_human.png'));
  it('NPC(노주인 등)는 전용 초상화', () => expect(portrait({ ...guest('keeper', 'human'), role: 'keeper' } as Actor)).toBe('/assets/portraits/keeper.png'));
  it('작은 목록 아이콘(pic)은 일러스트가 아니다 (도트 얼굴)', () => expect(pic(guest('knight', 'elf'))).not.toMatch(/g_knight_elf/));
});
