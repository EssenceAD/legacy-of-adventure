// 대사 (핫픽스 9 3·4번): 화자 ↔ 이름표·초상화가 한 묶음인지 · 본인 대사(say)에 3인칭 서술이 없는지
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { BONDS } from '../src/data/bonds';
import { CHEM_PAIRS as CHEMS } from '../src/data/chem';
import { world, type Actor } from '../src/world/state';
import { resolveSpeaker, speakerOf } from '../src/ui/dialogue';

const JOSA = ['가', '이', '는', '은', '의'];
/** 문장이 「이름 + 조사」로 시작하면 3인칭 서술 */
const thirdPerson = (name: string, s: string) => JOSA.some((j) => s.trim().startsWith(name + j + ' ') || s.trim().startsWith(name + j + '"'));

describe('대사: 화자와 초상화', () => {
  const mk = (id: number, kind: string, name: string, gender: 'm' | 'f') => ({ id, kind, name, gender, race: 'human', x: 0, y: 0, lvl: 1 }) as unknown as Actor;
  const clara = mk(41, 'cleric', '클라라', 'f');
  const roy = mk(42, 'knight', '로이', 'm');
  world.actors = [clara, roy];

  it('직업 키 + 이름표로 와도 그 이름의 실제 손님으로 (직업·성별이 실제와 같게)', () => {
    // 예전 데이터: 이름표는 클라라인데 화자 키가 knight → 기사 남자 얼굴이 뜨던 버그
    const r = resolveSpeaker('knight', '클라라');
    expect(r.actor).toBe(clara);
    expect(r.actor!.kind).toBe('cleric');
    expect(r.name).toBe('클라라');
  });
  it("'@id' 화자는 그 손님의 이름·얼굴", () => {
    const r = resolveSpeaker(speakerOf(roy), undefined);
    expect(r.actor).toBe(roy);
    expect(r.name).toBe('로이');
  });
  it('소스에 「직업 키 + 이름표」로 화자를 고르는 대사가 없다 (이름과 그림을 따로 고르지 않는다)', () => {
    const files = (fs.readdirSync('src', { recursive: true }) as string[]).filter((f) => f.endsWith('.ts'));
    const bad: string[] = [];
    for (const f of files) {
      const s = fs.readFileSync('src/' + f, 'utf8');
      for (const m of s.matchAll(/\[\s*[a-zA-Z]+\.kind\s*,[^\]\n]*,\s*undefined\s*,\s*[a-zA-Z]+\.name\s*\]/g)) bad.push(`${f}: ${m[0].slice(0, 60)}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('대사: 본인 대사(say)엔 3인칭 서술이 없다', () => {
  it('인연(BONDS) 대사: 자기 이름 + 조사로 시작하는 줄이 없다', () => {
    const bad: string[] = [];
    for (const d of BONDS) {
      const lines = [...d.moods, d.good, d.meh, d.lover, d.comrade, ...d.ev.flat()].filter((s) => !s.startsWith('>'));
      for (const s of lines) if (thirdPerson(d.name, s)) bad.push(`${d.id}: ${s}`);
    }
    expect(bad).toEqual([]);
  });
  it('케미 대화: 두 사람의 대사가 「○○가 …했다」 서술이 아니다', () => {
    const bad: string[] = [];
    for (const c of CHEMS) for (const [a, b] of c.talks) for (const s of [a, b]) if (/[가이]\s.*했다\.?$/.test(s) && /^\S+[가이]\s/.test(s)) bad.push(`${c.name}: ${s}`);
    expect(bad).toEqual([]);
  });
  it('소스: narr가 아닌 화자에게 「${이름}${조사}…」 서술을 붙이지 않는다', () => {
    const files = (fs.readdirSync('src', { recursive: true }) as string[]).filter((f) => f.endsWith('.ts'));
    const bad: string[] = [];
    for (const f of files) {
      const s = fs.readFileSync('src/' + f, 'utf8');
      for (const m of s.matchAll(/\[\s*(?!'narr')[^,\]\n'`]+,\s*(?:win \? )?`\$\{[a-zA-Z]+\.name\}\$\{josa\(/g)) bad.push(`${f}: ${m[0].slice(0, 70)}`);
    }
    expect(bad).toEqual([]);
  });
  it('원정 보고서의 직업 사건 문장(「{a}가 …했다」)은 narr로만 쓴다', () => {
    const s = fs.readFileSync('src/world/expeditions.ts', 'utf8');
    expect(s).toMatch(/\['narr', fill\(pick\(CLASS_EVENT/);
    expect(s).not.toMatch(/\[c\.heroId \? 'hero_' \+ c\.heroId : c\.kind, fill\(pick\(CLASS_EVENT/);
  });
});
