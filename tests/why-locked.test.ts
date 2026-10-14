// 전역 규칙 「회색 버튼엔 이유」: 막힌 버튼은 눌리지만 실행 X · 이유 토스트 / 토벌 이유 4가지 / 대장간 모자람 글
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer } from '../src/world/adventurers';
import { makeItem } from '../src/world/items';
import { beginRaid, weeklyTarget } from '../src/world/raid';
import { noCrewText, raidLock, raidTileLock, restMinutes } from '../src/world/raidWhy';
import { bossPart, bossWhere, CHARM_WHERE, charmPart, dustPart, DUST_WHERE, enhanceParts, regionWhere, shortOf, transcendParts, worstShort } from '../src/world/shortage';
import { P, resetProgress, S, world, type Actor, type Run } from '../src/world/state';
import { lockAttr, lockNote, lockReason, onLockClick, setLock } from '../src/ui/lockBtn';
import { fmt } from '../src/ui/common';
import { costLine, onWhereClick, partHtml, shortLabel, shortTip, shortWhy } from '../src/ui/costLine';

const mk = (o: Partial<Actor>) => {
  const a = makeAdventurer(5, 5, { status: 'regular', ...o } as never);
  a.id = P.nextAdvId++;
  a.hp = 100;
  Object.assign(a, o);
  world.actors.push(a);
  return a;
};
beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div>';
  world.actors = [];
  P.guide.unlocked = ['all'];
  S.started = true as never;
});

describe('lockBtn: 눌리지만 실행 안 함', () => {
  it('lockAttr: 이유가 있으면 aria-disabled + data-lock (disabled 속성 X) · 없으면 빈 글', () => {
    expect(lockAttr(null)).toBe('');
    expect(lockAttr('')).toBe('');
    const a = lockAttr('오늘 도전 0/4 · "내일"');
    expect(a).toContain('aria-disabled="true"');
    expect(a).toContain('data-lock="오늘 도전 0/4 · &quot;내일&quot;"');
    expect(a).not.toMatch(/(^|\s)disabled/);
    expect(lockNote(null)).toBe('');
    expect(lockNote('이유')).toBe('<p class="lockwhy">이유</p>');
  });
  it('막힌 버튼 클릭: 버튼 onclick 은 안 불리고 이유 토스트 · 풀면 다시 실행', () => {
    document.body.innerHTML = `<div id="toast"></div><button id="b" ${lockAttr('장부 4장에 열려요')}><span id="in">토벌</span></button>`;
    const b = document.getElementById('b') as HTMLButtonElement;
    const run = vi.fn();
    b.onclick = run;
    expect(b.disabled).toBe(false);
    (document.getElementById('in') as HTMLElement).click();
    expect(run).not.toHaveBeenCalled();
    expect(document.getElementById('toast')!.textContent).toBe('장부 4장에 열려요');
    setLock(b, null);
    b.click();
    expect(run).toHaveBeenCalledTimes(1);
    setLock(b, '다시 막힘');
    b.click();
    expect(run).toHaveBeenCalledTimes(1);
    expect(lockReason(b)).toBe('다시 막힘');
  });
  it('onLockClick: 막힌 게 아니면 그대로 둠', () => {
    document.body.innerHTML = '<button id="x">x</button>';
    const say = vi.fn();
    const e = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(e, 'target', { value: document.getElementById('x') });
    expect(onLockClick(e, say)).toBe(false);
    expect(say).not.toHaveBeenCalled();
  });
});

describe('토벌 이유', () => {
  it('장부 잠김 → 「장부 ○장에 열려요」', () => {
    P.guide.unlocked = [];
    P.guide.legacy = false;
    const l = raidLock(weeklyTarget(), 1)!;
    expect(l.key).toBe('chapter');
    expect(l.text).toMatch(/^장부 \d+장에 열려요$/);
  });
  it('오늘 도전 다 씀 → 「오늘 도전 0/4 · 내일 0시에 채워져요」 · 모험 칸 「오늘 도전 끝 · 내일 0시」', () => {
    mk({ name: '기사' } as never);
    while (beginRaid() != null);
    const l = raidLock(weeklyTarget(), 1)!;
    expect(l.key).toBe('tries');
    expect(l.text).toBe(`오늘 도전 0/${CONFIG.raid.triesPerDay} · 내일 0시에 채워져요`);
    expect(raidTileLock()?.short).toBe('오늘 도전 끝 · 내일 0시');
  });
  it('갈 단골 없음 → 원정 중 n명 · 지침 n명 (쉬면 ○분 뒤)', () => {
    const away = mk({ name: '원정이' } as never);
    P.runs = [{ id: 7, start: Date.now(), end: Date.now() + 6e5, members: [away.id], quest: { id: 1, region: 'forest', tier: 0, power: 10, minutes: 10, gold: [1, 1] } } as unknown as Run];
    away.runId = 7;
    const t1 = mk({ name: '지친이' } as never);
    t1.hp = 10;
    const t2 = mk({ name: '덜 지친이' } as never);
    t2.hp = 22;
    const l = raidLock(weeklyTarget(), 0)!;
    expect(l.key).toBe('crew');
    // 가장 덜 지친 사람(22) 기준: 30까지 8 → 게임 2시간 → 2분
    expect(restMinutes(22)).toBe(Math.ceil(((CONFIG.expedition.minHp - 22) / 4) * CONFIG.clock.realSecondsPerGameHour / 60));
    expect(l.text).toBe(`갈 수 있는 단골이 없어요 · 원정 중 1명 · 지침 2명 (쉬면 ${restMinutes(22)}분 뒤)`);
    expect(noCrewText()).toBe(l.text);
  });
  it('단골이 아예 없으면 이유에 「단골이 생기면」', () => {
    expect(raidLock(weeklyTarget(), 0)!.text).toBe('갈 수 있는 단골이 없어요 · 단골이 생기면 같이 가요');
  });
  it('이번 주 보스 처치 → 도전장 안내 (가장 먼저) · 파티 0명이면 「넣어 주세요」 · 갈 수 있으면 null', () => {
    mk({ name: '기사' } as never);
    const t = weeklyTarget();
    expect(raidLock(t, 0)!.key).toBe('pick');
    expect(raidLock(t, 1)).toBeNull();
    P.raid.hpLeft = 0;
    P.raid.killed = true;
    const l = raidLock(t, 1)!;
    expect(l.key).toBe('dead');
    expect(l.text).toMatch(/^이번 주 보스를 잡았어요 (→ 도전장으로 다음 보스|· 월요일에 새 보스가 와요)$/);
  });
});

describe('대장간 모자람', () => {
  it('재료마다 필요/가진 · 모자라면 −n · 버튼 글 = 가장 많이 모자란 것', () => {
    P.dust.n = 0;
    const it = makeItem('forest', 'n', 'weapon', false);
    it.enh = 9; // +10 으로: 가루 + 보스 재료
    const parts = enhanceParts(it);
    expect(parts.map((p) => p.kind)).toEqual(['dust', 'boss']);
    P.dust.n = parts[0].need; // 가루는 충분
    const b = bossPart('boar', 3);
    P.bossMats.boar = 0;
    const ps = enhanceParts(it);
    expect(shortOf(ps[0])).toBe(0);
    expect(shortOf(ps[1])).toBe(ps[1].need);
    expect(shortWhy(ps)).toBe(`${ps[1].name} ${ps[1].need}개 부족`);
    expect(shortTip(ps)).toBe(`${ps[1].name} ${ps[1].need}개 부족 · 얻는 곳: ${bossWhere('boar')}`);
    expect(b.where).toBe(bossWhere('boar'));
    const h = partHtml(ps[1]);
    expect(h).toContain('class="cst bad"');
    expect(h).toContain(`${ps[1].need}/0<b class="sh">−${ps[1].need}</b>`);
    expect(partHtml(ps[0])).toBe(`<span class="cst">${ps[0].name} ${fmt(ps[0].need)}/${fmt(ps[0].need)}</span>`);
  });
  it('얻는 곳: 지역 재료 · 보스 재료(토벌 X 보스는 사냥만) · 가루 · 부적', () => {
    expect(regionWhere('forest')).toBe('숲 동굴 사냥·의뢰');
    expect(bossWhere('boar')).toBe('숲 동굴 10스테이지 사냥 · 토벌 · 부탁');
    expect(bossWhere('devourer')).toBe('심연의 바닥 10스테이지 사냥');
    expect(dustPart('r', 5).where).toBe(DUST_WHERE);
    expect(charmPart(1).where).toBe(CHARM_WHERE);
    expect(DUST_WHERE).toBe('같은 등급 장비 분해');
    expect(CHARM_WHERE).toBe('토벌 참여 · 증표 상점');
  });
  it('그림자 껍질 5/3 −2 → 「그림자 껍질 2개 부족」 · 금화는 「금화 n 부족」 · 비율이 큰 것이 이유', () => {
    P.bossMats.devourer = 3;
    S.gold = 900;
    const shell = bossPart('devourer', 5);
    expect(shell.name).toBe('그림자 껍질');
    expect(partHtml(shell)).toContain('그림자 껍질 5/3<b class="sh">−2</b>');
    expect(shortLabel(shell)).toBe('그림자 껍질 2개 부족');
    const gold = { kind: 'gold' as const, name: '금화', need: 1000, have: 900, where: '' };
    expect(shortLabel(gold)).toBe('금화 100 부족');
    // 껍질 2/5 = 40% > 금화 10% → 껍질
    expect(worstShort([gold, shell])).toBe(shell);
    expect(worstShort([dustPart('n', 0)])).toBeNull();
  });
  it('초월 비용 4가지 · 모자란 재료 누르면 바로 아래 「얻는 곳」 줄', () => {
    const it = makeItem('forest', 'n', 'weapon', false);
    it.enh = 10;
    S.gold = 0;
    const ps = transcendParts(it);
    expect(ps.map((p) => p.kind)).toEqual(['gold', 'mat', 'boss', 'dust']);
    document.body.innerHTML = `<div id="toast"></div>${costLine(ps, '초월 비용: ')}`;
    const bad = document.querySelector<HTMLElement>('.cst.bad[data-where]')!;
    const e = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(e, 'target', { value: bad });
    expect(onWhereClick(e)).toBe(true);
    const ln = document.querySelector<HTMLElement>('.whereln')!;
    expect(ln.hidden).toBe(false);
    expect(ln.textContent).toBe(`얻는 곳: ${bad.dataset.where}`);
  });
});
