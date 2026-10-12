// HOTFIX24: 전설 방문 대기 — 동시에 최대 2명 · 인연 100%는 자리가 있으면 그날 밤 바로(100%가 된 순서) · 도감 문구 상태별 · 「내일 밤」 편지
import { beforeEach, describe, expect, it } from 'vitest';
import { LEGENDS } from '../src/data/legends';
import { fullQueue, judgeNight, visitText, visitingN } from '../src/world/legends';
import { today } from '../src/world/progress';
import { P, S, resetProgress, world } from '../src/world/state';

const FOUR = ['luna', 'grom', 'nyx', 'leon'];
beforeEach(() => {
  resetProgress();
  world.actors.length = 0;
  S.started = true as never;
  S.visiting = false as never;
  document.body.innerHTML = '<div id="toast"></div>';
  for (const d of LEGENDS) P.legends[d.key] = { st: 'rumor', gauge: 30 };
  FOUR.forEach((k, i) => Object.assign(P.legends[k], { gauge: 100, full: 1000 + i }));
});
/** 실제 날짜가 하루 지난 것처럼 */
const nextDay = () => (P.legendDay = 'yesterday');
const leave = (k: string) => (P.legends[k].st = 'joined');

describe('전설 방문 대기', () => {
  it('100% 4명: 첫날 밤 2명 → 둘이 머무는 동안 아무도 안 옴 → 자리가 나면 다음 순서로', () => {
    for (const d of LEGENDS) if (!FOUR.includes(d.key)) P.legends[d.key].gauge = 0;
    expect(fullQueue()).toEqual(FOUR);
    expect(FOUR.map(visitText)).toEqual(['오늘 밤 방문 확정', '오늘 밤 방문 확정', '대기 1번째', '대기 2번째']);
    nextDay();
    judgeNight();
    expect(visitingN()).toBe(2);
    expect(['luna', 'grom'].every((k) => P.legends[k].st === 'visit')).toBe(true);
    expect(world.actors.filter((a) => a.legendId).length).toBe(2);
    // 같은 날 다시 판정해도 그대로
    judgeNight();
    expect(visitingN()).toBe(2);
    expect(['nyx', 'leon'].map(visitText)).toEqual(['대기 1번째', '대기 2번째']);
    // 다음 날: 자리 없음 → 그대로
    nextDay();
    judgeNight();
    expect(visitingN()).toBe(2);
    // 한 명이 동료가 되어 자리가 남 → 오늘 판정이 끝났으면 「다음 방문: 내일 밤」
    leave('luna');
    expect(visitText('nyx')).toBe('다음 방문: 내일 밤');
    expect(visitText('leon')).toBe('대기 1번째');
    nextDay();
    expect(visitText('nyx')).toBe('오늘 밤 방문 확정');
    judgeNight();
    expect(P.legends.nyx.st).toBe('visit');
    expect(visitingN()).toBe(2);
    leave('grom');
    leave('nyx');
    nextDay();
    judgeNight();
    expect(P.legends.leon.st).toBe('visit');
  });
  it('「내일 밤 들르겠대요」: 머무는 전설이 24시간 안에 떠날 때만 · 전설마다 한 번', () => {
    nextDay();
    judgeNight();
    const mails = () => P.meta.mail.filter((m) => /내일 밤 들르겠대요/.test(m.body));
    expect(mails().length).toBe(0); // 막 왔으니 3일 머묾
    P.legends.luna.until = Date.now() + 3600e3;
    nextDay();
    judgeNight();
    expect(mails().length).toBe(1);
    expect(mails()[0].body).toMatch(/그림자 닉스/);
    nextDay();
    judgeNight();
    expect(mails().length).toBe(1);
  });
  it('옛 저장(100%가 된 시각 없음)도 도감 순서로 대기', () => {
    for (const k of FOUR) delete P.legends[k].full;
    expect(fullQueue()).toEqual(LEGENDS.map((d) => d.key).filter((k) => FOUR.includes(k)));
    expect(today()).toBeTruthy();
  });
});
