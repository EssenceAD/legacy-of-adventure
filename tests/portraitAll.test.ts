// 초상화 전부 (K9 같은 사람 = 같은 얼굴): 얼굴을 보여 주는 곳(전투 파티 칸 · 합동기 컷인 · 파티 칸 · 파티 고르기 · 손님 목록 · 대장간 줄)은
// 평범한 손님도 직업×종족 일러스트 초상화(g_직업_종족) — 마을 도트를 잘라 낸 얼굴(pic)이 나오면 안 된다
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GUEST_KINDS, RACES } from '../src/data/classes';
import { PORTRAITS } from '../src/engine/assets';
import { pic, portrait } from '../src/ui/common';
import { slotRow } from '../src/ui/partyUi';
import type { Actor } from '../src/world/state';

for (const k of GUEST_KINDS) for (const r of RACES) PORTRAITS[`g_${k}_${r}`] = `/assets/portraits/g_${k}_${r}.png`;
const guest = (id: number, kind: string, race: string) => ({ id, kind, race, rarity: 'common', name: 'G' + id, lvl: 1, hp: 100 }) as unknown as Actor;

describe('초상화 전부: 얼굴 칸은 portrait', () => {
  it('직업 6 × 종족 4 평범한 손님 → g_직업_종족 (사냥꾼·사제·기사 포함)', () => {
    for (const k of GUEST_KINDS) for (const r of RACES) expect(portrait(guest(1, k, r))).toBe(`/assets/portraits/g_${k}_${r}.png`);
  });
  it('파티 칸(사냥 창 · 엘라 자리)은 초상화 그림을 쓴다', () => {
    const sel = [guest(1, 'hunter', 'elf'), guest(2, 'cleric', 'human'), guest(3, 'knight', 'dwarf')];
    const html = slotRow(sel, 3);
    for (const a of sel) expect(html).toContain(`src="${portrait(a)}"`);
    expect(html).not.toContain('data:image');
  });
  it('src 안에서 pic( 는 portrait 대체(common.ts)와 도트 판정(heroCard.ts)에만 남는다', () => {
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.ts$/.test(f.name) && /\bpic\(/.test(fs.readFileSync(p, 'utf8'))) hits.push(p.replace(/\\/g, '/'));
      }
    };
    walk('src');
    expect(hits.sort()).toEqual(['src/ui/common.ts', 'src/ui/heroCard.ts']);
  });
  it('전투 파티 칸 · 합동기 컷인 문자열은 portrait(a.actor!)', () => {
    const s = fs.readFileSync('src/combat/ui.ts', 'utf8');
    expect(s.match(/src="\$\{portrait\(\w+\.actor!\)\}"/g)?.length).toBe(2);
  });
  it('도트 얼굴(pic)과 초상화는 다른 그림이다', () => expect(pic(guest(9, 'knight', 'elf'))).not.toBe(portrait(guest(9, 'knight', 'elf'))));
});
