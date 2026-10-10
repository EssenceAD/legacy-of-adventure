// 토벌전 화면 (3단계 2~4장): 준비 창(파티·권장 전투력·경고) → 와이프 전환 → 옆에서 보는 도트 전투장 → 결과
// 시안(raid_battle.html)의 전투를 옮겼다. 피해량은 「자동 기대 피해량」에 맞춰 보정한다:
//  · 자동: 기대 피해량 ±10% (끝까지 버텼을 때)  · 직접: 자동의 90% ~ 130%
import { CONFIG } from '../data/config';
import { notePrep, prepLine } from './power';
import type { BossDef } from '../data/bosses';
import { CLASSES } from '../data/classes';
import { heroById } from '../data/heroes';
import { legendByKey } from '../data/legends';
import { BOSS_IMG, RAID_BG } from '../engine/assets';
import { canvas, P as Paint } from '../engine/pixel';
import { framesFor, type CharFrames } from '../engine/sprites';
import { appearance, powerOf } from '../world/adventurers';
import { pairOf } from '../world/chem';
import { powerTips } from '../world/expeditions';
import {
  canSweep, expectOf, raidCrew, rankOf, settle, submitRecord, triesLeft, wanderTarget, weeklyTarget, type RaidExpect, type RaidOutcome, type RaidTarget,
} from '../world/raid';
import { legendHooks, markDirty, P, type Actor } from '../world/state';
import { $, $$, esc, fmt, nameTag, pct, pic } from './common';
import { mine } from '../net/server';
import { battleHints, drawChar, LANES, LH, LW, mountBattle, sfx } from './battle';
import { closeWin, openWin, toast } from './windows';

const R = CONFIG.raid;
/** 보스 기본 x · 돌진 거리 (장면 356×200 기준) */
const BOSS_X = 176;
const CHARGE = 120;

// ───────── 준비 창 ─────────

let picked: number[] = [];

export function bossPic(b: BossDef): string {
  const c = BOSS_IMG[b.id];
  return c ? c.toDataURL() : '';
}

export function openRaidPrep(t: RaidTarget) {
  const crew = raidCrew().sort((a, b) => powerOf(b) - powerOf(a));
  picked = picked.filter((id) => crew.some((a) => a.id === id));
  if (!picked.length) picked = crew.slice(0, R.partySize).map((a) => a.id);
  const members = picked.map((id) => crew.find((a) => a.id === id)!).filter(Boolean);
  const b = t.boss;
  const ex = expectOf(members, b);
  const low = ex.power < b.power * R.warnRatio;
  const tips = low ? powerTips(members) : [];
  const left = triesLeft();
  const hpPct = t.hpLeft / t.max;
  const rows = crew
    .map((a) => {
      const on = picked.includes(a.id);
      const lead = picked[0] === a.id;
      const aff = b.weak.includes(a.kind as never) ? '<b class="good">상성 ↑</b>' : b.resist.includes(a.kind as never) ? '<b class="bad">상성 ↓</b>' : '';
      return `<button class="pm ${on ? 'on' : ''}" data-id="${a.id}"><img src="${pic(a)}" alt=""><span>${lead ? '<b class="g">대장</b> ' : ''}${nameTag(a)} Lv.${a.lvl}<small>${CLASSES[a.kind].name} ${aff}</small></span><em>${fmt(powerOf(a))}</em></button>`;
    })
    .join('');
  openWin(
    `토벌 · ${b.name}`,
    `<div class="boss-head"><img class="bossimg" src="${bossPic(b)}" alt=""><div>
      <p class="sub">${t.kind === 'weekly' ? '이번 주 보스' : `떠돌이 보스 · ${Math.max(0, Math.ceil((P.raid.wander!.until - Date.now()) / 36e5))}시간 남음`}</p>
      <div class="bhp"><i style="width:${hpPct * 100}%"></i></div>
      <p class="note">${fmt(t.hpLeft)} / ${fmt(t.max)} · ${t.kind === 'weekly' ? `이번 주 누적 ${pct(1 - hpPct)} 처치` : '이 보스 체력도 이어서 깎여요'}</p>
      <p class="note">패턴: ${b.patterns.join(' · ')}<br>상성 ↑ ${b.weak.map((k) => CLASSES[k].name).join('·')} / ↓ ${b.resist.map((k) => CLASSES[k].name).join('·')}</p>
    </div></div>
    <div class="pw"><span>권장 전투력</span><em>${fmt(b.power)}</em><span>우리 파티 (케미 ×${ex.chem.toFixed(2)}) ${prepLine('raid', ex.power)}</span><em class="${low ? 'bad' : ex.power >= b.power ? 'good' : ''}">${fmt(ex.power)}</em><span>예상 피해량</span><em>${fmt(ex.target)}</em></div>
    ${low ? `<div class="tips"><b>전투력이 ${fmt(b.power * R.warnRatio - ex.power)} 모자라요 (권장의 ${Math.round(R.warnRatio * 100)}% 미만) · 이렇게 올릴 수 있어요</b>${tips.map((x) => `<div>· ${esc(x.text)}</div>`).join('')}</div>` : ''}
    <p class="sub">파티 ${members.length}/${R.partySize} · 첫 번째가 대장(직접 조작)</p>
    <div class="plist">${rows || '<p class="note">토벌에 갈 단골이 없어요 (체력 30 이상, 원정 중이 아닌 단골·영웅)</p>'}</div>
    <div class="btnrow raidgo">
      <button class="bigbtn" id="rgAuto" ${members.length && left > 0 ? '' : 'disabled'}>자동 전투</button>
      <button class="bigbtn red" id="rgMan" ${members.length && left > 0 ? '' : 'disabled'}>직접 싸우기</button>
      ${canSweep(b) ? `<button class="bigbtn ghost" id="rgSweep" ${members.length && left > 0 ? '' : 'disabled'}>소탕</button>` : ''}
    </div>
    <p class="note">오늘 남은 도전 ${left}/${R.triesPerDay} · 직접 싸우면 피해량 최대 +${Math.round((R.manualMax - 1) * 100)}% · 실패해도 깎은 만큼 보상</p>`,
  );
  $$('.pm').forEach(
    (el) =>
      (el.onclick = () => {
        const id = +el.dataset.id!;
        picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < R.partySize ? [...picked, id] : picked;
        openRaidPrep(t);
      }),
  );
  const go = (manual: boolean) => {
    closeWin();
    startBattle(t, members, manual, ex);
  };
  $('#rgAuto').onclick = () => go(false);
  $('#rgMan').onclick = () => go(true);
  const sw = document.getElementById('rgSweep');
  if (sw)
    sw.onclick = () => {
      const out = settle(t, members, ex.target, 'sweep', ex);
      showResult(t, out, ex, 'sweep', members, false);
    };
}

// ───────── 전투 ─────────

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  l: number;
  c: string;
}

interface Sim {
  on: boolean;
  auto: boolean;
  t: number;
  /** 단위 피해 합 (화면 숫자 = 단위 × scale) */
  units: number;
  php: number;
  chem: number;
  lane: number;
  combo: number;
  lastHit: number;
  cd1: number;
  cd2: number;
  shield: number;
  stun: number;
  bx: number;
  bstate: 'idle' | 'warn' | 'charge' | 'back' | 'windup' | 'stun';
  bt: number;
  pattern: number;
  warnLane: number;
  charge: number;
  hit: number;
  heroAtk: number;
  ally: number;
  heal: number;
  shake: number;
  /** 막기: 눌렀나, 누르기 시작한 시각(패턴 남은 시간) */
  holding: boolean;
  pressAt: number;
  perfect: number;
  streak: number;
  bestStreak: number;
  parts: Part[];
  dodge: boolean;
  blk: boolean;
  aiT: number;
  died: boolean;
  /** 보스 그림 위쪽 y (피해 숫자·! 위치) */
  btop: number;
}

function newSim(): Sim {
  return {
    on: false, auto: false, t: R.seconds, units: 0, php: 1000, chem: 0, lane: 1, combo: 0, lastHit: 0, cd1: 0, cd2: 0, shield: 0, stun: 0,
    bx: 176, bstate: 'idle', bt: 2.2, pattern: 0, warnLane: -1, charge: 0, hit: 0, heroAtk: 0, ally: 0, heal: 0, shake: 0,
    holding: false, pressAt: -9, perfect: 0, streak: 0, bestStreak: 0, parts: [], dodge: false, blk: false, aiT: 0, died: false, btop: 100,
  };
}

/** 화면과 상관없는 규칙 한 걸음 (자동 기대치 계산에도 쓴다). hooks는 화면 효과 */
interface Hooks {
  num: (x: number, y: number, units: number, cls: string, text?: string) => void;
  warnBlock: (on: boolean) => void;
  chemReady: () => void;
  joint: () => void;
  perfectBlock: () => void;
}
const noHooks: Hooks = { num: () => {}, warnBlock: () => {}, chemReady: () => {}, joint: () => {}, perfectBlock: () => {} };

function hurtBoss(S: Sim, v: number, cls: string, h: Hooks) {
  const u = v * (S.stun > 0 ? 2 : 1);
  S.units += u;
  S.hit = 0.12;
  h.num(S.bx + Math.random() * 30 - 10, S.btop + 10 + Math.random() * 20, u, cls);
  for (let i = 0; i < 5; i++) S.parts.push({ x: S.bx + 5 + Math.random() * 30, y: 130 + Math.random() * 30, vx: (Math.random() - 0.3) * 60, vy: -Math.random() * 60, l: 0.4, c: '#fff3b0' });
}
function hurtParty(S: Sim, v: number, danger: number, h: Hooks) {
  let d = v * danger;
  if (S.shield > 0) d *= 0.4;
  S.php = Math.max(0, S.php - Math.round(d));
  h.num(90, 110, -Math.round(d), 'hurt', '-' + Math.round(d));
  S.shake = 0.25;
  if (S.php <= 0) {
    S.died = true;
    S.on = false;
  }
}
function attack(S: Sim, h: Hooks, now: number) {
  if (!S.on || S.heroAtk > 0) return;
  S.heroAtk = 0.22;
  S.combo = now - S.lastHit < 0.7 ? Math.min(S.combo + 1, 10) : 0;
  S.lastHit = now;
  const crit = Math.random() < 0.15;
  hurtBoss(S, 55 * (1 + S.combo * 0.05) * (crit ? 2 : 1), crit ? 'crit' : '', h);
  S.chem = Math.min(100, S.chem + 3);
}
function skill1(S: Sim, h: Hooks) {
  if (!S.on || S.cd1 > 0) return;
  S.cd1 = 8;
  S.heroAtk = 0.35;
  for (let i = 0; i < 3; i++) hurtBoss(S, 170, 'crit', h);
  for (let k = 0; k < 12; k++) S.parts.push({ x: S.bx + 10, y: 150, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 90, l: 0.6, c: ['#ff9a3c', '#ffd36b', '#e0482e'][k % 3] });
  S.chem = Math.min(100, S.chem + 12);
}
function skill2(S: Sim, h: Hooks) {
  if (!S.on || S.cd2 > 0) return;
  S.cd2 = 12;
  S.shield = 4;
  S.php = Math.min(1000, S.php + 180);
  h.num(70, 100, 0, 'heal', '+180');
}
function joint(S: Sim, h: Hooks) {
  if (!S.on || S.chem < 100) return;
  S.chem = 0;
  h.joint();
  S.shake = 0.5;
  hurtBoss(S, 1400, 'big', h);
  for (let k = 0; k < 30; k++) S.parts.push({ x: S.bx + 10, y: 140, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 120, l: 0.9, c: ['#ff7aa8', '#ffd36b', '#ffffff'][k % 3] });
}

function bossAI(S: Sim, dt: number, danger: number, h: Hooks) {
  if (S.stun > 0) {
    S.stun -= dt;
    S.bstate = 'stun';
    if (S.stun <= 0) {
      S.bstate = 'idle';
      S.bt = 1.5;
    }
    return;
  }
  S.bt -= dt;
  if (S.bstate === 'idle' && S.bt <= 0) {
    S.pattern++;
    if (S.pattern % 3 === 0) {
      S.bstate = 'windup';
      S.bt = 1.0;
      S.perfect = 0;
      S.pressAt = -9;
      h.warnBlock(true);
      h.num(S.bx + 20, S.btop - 6, 0, 'msg', '!');
    } else {
      S.bstate = 'warn';
      S.warnLane = (Math.random() * 3) | 0;
      S.bt = 1.3;
    }
  } else if (S.bstate === 'warn' && S.bt <= 0) {
    S.bstate = 'charge';
    S.bt = 0.6;
    S.charge = 0;
  } else if (S.bstate === 'charge') {
    S.charge = 1 - S.bt / 0.6;
    if (S.bt <= 0) {
      if (S.lane === S.warnLane) hurtParty(S, 220, danger, h);
      else h.num(90, 120, 0, 'msg', '회피!');
      S.bstate = 'back';
      S.bt = 0.5;
      S.warnLane = -1;
    }
  } else if (S.bstate === 'back' && S.bt <= 0) {
    S.bstate = 'idle';
    S.bt = 1.6 + Math.random() * 1.4;
    S.charge = 0;
  } else if (S.bstate === 'windup' && S.bt <= 0) {
    h.warnBlock(false);
    // 꾹 누르기: 번쩍임 동안 눌러서 맞는 순간까지 누르고 있으면 완벽한 막기
    // 번쩍이는 동안 눌러서 맞는 순간까지 누르고 있었다 (번쩍이기 전부터 누르고 있던 건 안 됨)
    const held = S.holding && S.pressAt > -9;
    S.perfect = held ? 1 : S.pressAt > -9 ? 0.5 : S.perfect;
    if (S.perfect === 1) {
      h.num(150, 96, 0, 'msg', '완벽하게 막았다!');
      S.stun = 3;
      S.bstate = 'stun';
      S.chem = Math.min(100, S.chem + 25);
      S.shake = 0.2;
      S.streak++;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      h.perfectBlock();
      return;
    }
    S.streak = 0;
    hurtParty(S, S.perfect ? 130 : 260, danger, h);
    S.bstate = 'idle';
    S.bt = 2;
  }
}

function autoAI(S: Sim, dt: number, now: number, hasChem: boolean, h: Hooks) {
  S.aiT -= dt;
  if (S.aiT <= 0) {
    S.aiT = 0.26;
    attack(S, h, now);
  }
  if (S.bstate === 'warn' && S.lane === S.warnLane && S.bt < 0.8 && !S.dodge) {
    S.dodge = true;
    if (Math.random() < 0.75) S.lane = (S.warnLane + 1 + ((Math.random() * 2) | 0)) % 3;
  }
  if (S.bstate !== 'warn') S.dodge = false;
  if (S.bstate === 'windup' && S.bt < 0.4 && !S.blk) {
    S.blk = true;
    const r = Math.random();
    if (r < 0.4) {
      S.holding = true;
      S.pressAt = S.bt;
    } else if (r < 0.8) S.pressAt = 1;
  }
  if (S.bstate !== 'windup') {
    S.blk = false;
    if (S.auto) S.holding = false;
  }
  if (S.cd1 <= 0) skill1(S, h);
  if (S.cd2 <= 0 && S.php < 700) skill2(S, h);
  if (hasChem && S.chem >= 100) joint(S, h);
}

/** 한 걸음: 시간·동료 공격·회복·보스·자동 */
function step(S: Sim, dt: number, now: number, danger: number, hasChem: boolean, h: Hooks) {
  S.heroAtk = Math.max(0, S.heroAtk - dt);
  S.hit = Math.max(0, S.hit - dt);
  S.shake = Math.max(0, S.shake - dt);
  if (!S.on) return;
  S.t -= dt;
  if (S.t <= 0) {
    S.t = 0;
    S.on = false;
    return;
  }
  S.cd1 = Math.max(0, S.cd1 - dt);
  S.cd2 = Math.max(0, S.cd2 - dt);
  S.shield = Math.max(0, S.shield - dt);
  bossAI(S, dt, danger, h);
  if (S.auto) autoAI(S, dt, now, hasChem, h);
  S.ally -= dt;
  if (S.ally <= 0) {
    S.ally = 1.1;
    hurtBoss(S, 36 + Math.random() * 16, '', h);
    S.chem = Math.min(100, S.chem + 2);
  }
  S.heal -= dt;
  if (S.heal <= 0) {
    S.heal = 6;
    if (S.php < 1000) S.php = Math.min(1000, S.php + 60);
  }
  if (!hasChem) S.chem = 0;
}

/** 자동 전투 한 판이 평균 몇 단위를 내는지 (보정 기준). 처음 한 번 몇 판 돌려 본다 */
let AUTO_UNITS = 0;
function autoUnits(hasChem: boolean): number {
  if (AUTO_UNITS && hasChem) return AUTO_UNITS;
  let sum = 0;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const S = newSim();
    S.on = true;
    S.auto = true;
    let tt = 0;
    while (S.on) {
      tt += 1 / 30;
      step(S, 1 / 30, tt, 1, hasChem, noHooks);
    }
    sum += S.units;
  }
  const u = sum / n;
  if (hasChem) AUTO_UNITS = u;
  return u;
}
let AUTO_UNITS_NOCHEM = 0;

// ───────── 전투 화면 ─────────

const SKILL1: Record<string, [string, string]> = {
  knight: ['✦', '방패 돌격'], mage: ['✦', '화염구'], dwarf: ['✦', '대지 가르기'], rogue: ['✦', '급소 찌르기'], cleric: ['✦', '성스러운 빛'],
};
const SKILL2: Record<string, [string, string]> = {
  knight: ['✚', '버티기'], dwarf: ['✚', '버티기'], mage: ['✚', '수호 기도'], cleric: ['✚', '수호 기도'], rogue: ['✚', '연막'],
};

let active: { stop: () => void; advance: (sec: number) => void } | null = null;
/** 개발용: 화면이 숨어 rAF가 멈췄을 때 전투를 sec초 진행 */
export const _raidAdvance = (sec: number) => active?.advance(sec);

function startBattle(t: RaidTarget, members: Actor[], manual: boolean, ex: RaidExpect) {
  notePrep('raid', ex.power);
  active?.stop();
  const b = t.boss;
  const leader = members[0];
  const pair = (() => {
    for (const x of members) for (const y of members) if (x !== y && pairOf(x, y)) return [x, y] as [Actor, Actor];
    return null;
  })();
  const hasChem = !!pair;
  const units = hasChem ? autoUnits(true) : (AUTO_UNITS_NOCHEM ||= autoUnits(false));
  const scale = ex.target / Math.max(1, units);
  const s1 = leader.legendId ? legendByKey(leader.legendId)!.skill.name : leader.heroId ? heroById(leader.heroId)!.skill.name : SKILL1[leader.kind]?.[1] ?? '필살기';
  const s2 = SKILL2[leader.kind]?.[1] ?? '버티기';

  // 핫픽스 5: 가로형 고정 장면 + 장면 위에 겹친 HUD + 반원 스킬 버튼(아이콘만, 길게 누르면 설명)
  const view = mountBattle({
    id: 'raid',
    title: `${t.kind === 'weekly' ? '주간' : '떠돌이'} · ${b.name}`,
    members,
    skills: [
      { id: 's1', icon: 'skill_fireslash', name: s1, desc: '강한 3연타 · 케미 게이지 + · 8초마다' },
      { id: 's2', icon: 'skill_pray', name: s2, desc: '4초 동안 피해 60% 감소 + 파티 체력 회복 · 12초마다' },
      { id: 'combo', icon: 'skill_combo', name: hasChem ? '합동기' : '합동기 (짝 없음)', desc: hasChem ? '케미 게이지가 꽉 차면 두 사람이 함께 큰 피해' : '케미 짝이 파티에 있어야 쓸 수 있어요' },
      { id: 'auto', icon: 'skill_auto', name: 'AUTO', desc: '자동 전투 켜기 · 끄기' },
      { id: 'block', icon: 'skill_block', name: '막기', desc: '보스가 번쩍이면 꾹 누르고 있기 — 완벽하게 막으면 보스가 3초 기절' },
    ],
    locked: { combo: !hasChem },
  });
  const { root, cv, ctx, q } = view;
  const fit = view.fit;

  const frames = new Map<Actor, CharFrames>();
  for (const m of members) {
    const { key, def } = appearance(m);
    frames.set(m, framesFor(key, def));
  }
  const boss = BOSS_IMG[b.id];
  const white = (() => {
    if (!boss) return null;
    const c = canvas(boss.width, boss.height);
    const x = c.getContext('2d')!;
    x.drawImage(boss, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    return c;
  })();

  const S = newSim();
  S.auto = !manual;
  // 큰 보스도 화면 오른쪽 안에 들어오게, 위쪽 y는 그림 높이로
  if (boss) {
    // 오른쪽 아래 스킬 버튼에 가리지 않게 보스는 장면 가운데쯤
    S.bx = Math.min(BOSS_X, LW - boss.width - 12);
    S.btop = LANES[1] + 8 - boss.height - (b.float ?? 0);
  }
  let T = 0;
  /** 완벽한 막기: 잠깐 멈춤(히트스톱) */
  let stop = 0;
  const hpNow = () => Math.max(0, t.hpLeft - S.units * scale);
  const hooks: Hooks = {
    num(x, y, u, cls, text) {
      view.num(x, y, text ?? fmt(u * scale), cls);
      // 세로 화면 기록창: 알림 · 맞은 피해만 (때린 숫자는 장면에)
      if (cls === 'msg') view.log(text === '!' ? '보스가 번쩍인다 · 막기 꾹!' : text ?? '', text === '!' ? 'bad' : 'kill');
      else if (cls === 'hurt') view.log(`파티가 맞았다 ${text ?? ''}`, 'bad');
      // 치명타: 노랗게 2배 + 화면 2px 흔들림
      if (cls === 'crit' || cls === 'big') {
        S.shake = Math.max(S.shake, 0.1);
        sfx('crit');
      }
    },
    warnBlock: (on) => view.warnBlock(on),
    chemReady: () => {},
    joint: () => {
      view.cutin(pair ? [pic(pair[0]), pic(pair[1])] : [pic(leader)], '합동기 · 마음을 하나로!');
      view.log('합동기 · 마음을 하나로!', 'wave');
    },
    perfectBlock: () => {
      stop = 0.15;
      sfx('perfect');
      view.num(150, 60, 'PERFECT!', 'perfect');
      legendHooks.bond('blockSuccess');
      if (S.streak >= 5) legendHooks.req('blockStreak5');
    },
  };

  let logState = '';
  let logQ = Math.ceil((hpNow() / t.max) * 4);
  const ui = () => {
    const p = hpNow() / t.max;
    if (S.bstate !== logState) {
      logState = S.bstate;
      if (S.bstate === 'warn') view.log(`${['위', '가운데', '아래'][S.warnLane] ?? ''} 줄로 돌진 예고 · 줄을 옮겨요!`, 'bad');
    }
    const qn = Math.ceil(p * 4);
    if (qn < logQ) {
      logQ = qn;
      view.log(`${b.name} 체력 ${qn * 25}% 아래로!`, 'wave');
    }
    view.setHp(p, `${fmt(hpNow())} / ${fmt(t.max)} · 누적 ${pct(1 - p)} 처치`);
    view.setTimer(S.t);
    view.setParty(members.map(() => S.php / 1000));
    view.setCd('s1', S.cd1 / 8, S.cd1);
    view.setCd('s2', S.cd2 / 12, S.cd2);
    view.setChem(S.chem, hasChem);
    view.setAuto(S.auto);
  };

  // 입력: 장면 탭 = 공격, 위아래 밀기 = 줄 이동
  let pd: { x: number; y: number } | null = null;
  cv.addEventListener('pointerdown', (e) => (pd = { x: e.clientX, y: e.clientY }));
  cv.addEventListener('pointerup', (e) => {
    if (!pd) return;
    const dy = e.clientY - pd.y;
    const dx = e.clientX - pd.x;
    pd = null;
    if (S.auto) return;
    if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) S.lane = Math.max(0, Math.min(2, S.lane + (dy > 0 ? 1 : -1)));
    else attack(S, hooks, T);
  });
  const blockDown = (e?: Event) => {
    e?.preventDefault();
    if (!S.on || S.auto) return;
    S.holding = true;
    sfx('block');
    if (S.bstate === 'windup') S.pressAt = S.bt;
  };
  const blockUp = () => (S.holding = false);
  q('#b_block').addEventListener('pointerdown', blockDown);
  q('#b_block').addEventListener('pointerup', blockUp);
  q('#b_block').addEventListener('pointerleave', blockUp);
  q('#b_s1').onclick = () => !S.auto && (skill1(S, hooks), sfx('skill'));
  q('#b_s2').onclick = () => !S.auto && (skill2(S, hooks), sfx('skill'));
  q('#b_combo').onclick = () => !S.auto && hasChem && joint(S, hooks);
  q('#b_auto').onclick = () => {
    S.auto = !S.auto;
    if (!S.auto) S.holding = false;
    view.setAuto(S.auto);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!S.on || S.auto) return;
    if (e.key === 'ArrowUp') S.lane = Math.max(0, S.lane - 1);
    if (e.key === 'ArrowDown') S.lane = Math.min(2, S.lane + 1);
    if (e.key === ' ' || e.key === 'z') attack(S, hooks, T);
    if (e.key === 'x' && !e.repeat) blockDown();
    if (e.key === '1') skill1(S, hooks);
    if (e.key === '2') skill2(S, hooks);
    if (e.key === '3' && hasChem) joint(S, hooks);
  };
  const onKeyUp = (e: KeyboardEvent) => e.key === 'x' && blockUp();
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);

  // 파티 자리 (장면 1픽셀 기준): 동료 둘은 뒤, 대장은 앞 · 캐릭터는 2배
  const ALLY = [[18, 0], [34, 2]] as const;
  const LEAD_X = 76;
  const draw = (dt: number) => {
    const sh = S.shake > 0 ? (((T * 60) | 0) % 2 ? 2 : -2) : 0;
    ctx.save();
    ctx.translate(sh, 0);
    const bg = RAID_BG[b.region] ?? RAID_BG.forest;
    if (bg) ctx.drawImage(bg, Math.round((LW - bg.width) / 2), 0);
    else {
      ctx.fillStyle = '#1c2340';
      ctx.fillRect(0, 0, LW, LH);
    }
    const p = Paint(ctx);
    if (S.bstate === 'warn' && S.warnLane >= 0 && ((T * 8) | 0) % 2) {
      ctx.globalAlpha = 0.45;
      p.rect(0, LANES[S.warnLane] - 5, LW, 10, '#ff3a3a');
      ctx.globalAlpha = 1;
    }
    // 보스
    let bx = S.bx;
    if (S.bstate === 'charge') bx = S.bx - S.charge * CHARGE;
    if (S.bstate === 'back') bx = S.bx - (S.bt / 0.5) * CHARGE;
    const bob = Math.round(Math.sin(T * 3) * 1.5);
    if (boss) {
      const img = (S.bstate === 'windup' && ((T * 10) | 0) % 2) || S.hit > 0.09 ? white ?? boss : boss;
      const fl = b.float ? b.float + Math.round(Math.sin(T * 2) * 3) : 0;
      const yy = (S.bstate === 'charge' ? LANES[2] + 6 : LANES[1] + 8) - boss.height + bob - fl;
      ctx.drawImage(img, Math.round(bx - 10 + (S.hit > 0 ? 2 : 0)), Math.round(yy));
      // 기절: 별 3개가 머리 위를 돈다
      if (S.bstate === 'stun')
        for (let i = 0; i < 3; i++) {
          const a = T * 4 + i * 2.1;
          const sx = Math.round(bx + boss.width / 2 - 10 + Math.cos(a) * 16);
          const sy = Math.round(yy + 6 + Math.sin(a) * 4);
          p.rect(sx, sy - 2, 1, 5, '#ffd36b');
          p.rect(sx - 2, sy, 5, 1, '#ffd36b');
        }
    }
    // 파티: 동료 둘 + 대장 (2배)
    const pos: [Actor, number, number][] = [];
    if (members[1]) pos.push([members[1], ALLY[0][0], LANES[0]]);
    if (members[2]) pos.push([members[2], ALLY[1][0], LANES[2]]);
    pos.push([leader, LEAD_X, LANES[S.lane]]);
    pos.sort((x, y) => x[2] - y[2]);
    for (const [m, x, y] of pos) {
      const s = frames.get(m)!;
      let fr: HTMLCanvasElement;
      if (m === leader) fr = S.heroAtk > 0 ? s.atk[S.heroAtk > 0.11 ? 0 : 1] : s.idle[((T * 2) | 0) % 2];
      else if (m === members[1]) fr = S.ally > 0.9 ? s.atk[1] : s.idle[((T * 2 + 1) | 0) % 2];
      else fr = S.heal > 5.4 ? s.pray[0] : s.idle[((T * 2) | 0) % 2];
      ctx.globalAlpha = 0.3;
      p.rect(x + 10, y, 28, 3, '#000');
      ctx.globalAlpha = 1;
      drawChar(ctx, fr, x, y);
      if (m === leader && S.shield > 0 && ((T * 6) | 0) % 2) {
        ctx.globalAlpha = 0.5;
        p.ell(x + 24, y - 30, 26, 34, '#9fd0ff');
        ctx.globalAlpha = 1;
      }
    }
    if (S.heroAtk > 0.1) {
      const x = LEAD_X + 50;
      const y = LANES[S.lane] - 40;
      for (let i = 0; i < 16; i++) p.rect(x + i * 2, y - Math.round(Math.sin((i / 16) * Math.PI) * 14), 2, 2, '#ffffff');
    }
    S.parts = S.parts.filter((pp) => {
      pp.l -= dt;
      pp.x += pp.vx * dt;
      pp.y += pp.vy * dt;
      pp.vy += 200 * dt;
      if (pp.l <= 0) return false;
      p.rect(pp.x | 0, pp.y | 0, 2, 2, pp.c);
      return true;
    });
    ctx.restore();
  };

  let raf = 0;
  let last = 0;
  let ended = false;
  /** 컷인이 끝나면 전투 시작 (전투 시간 기준) */
  let startAt = -1;
  const tickBattle = (dt: number) => {
    T += dt;
    if (startAt > 0 && T >= startAt) {
      startAt = -1;
      S.on = true;
      view.num(150, 80, manual ? '전투 시작!' : '자동 전투 시작!', 'msg');
    }
    // 히트스톱: 그리기만 하고 시간은 멈춘다
    if (stop > 0) {
      stop -= dt;
      draw(0);
      return;
    }
    const wasOn = S.on;
    step(S, dt, T, ex.danger, hasChem, hooks);
    if (hpNow() <= 0) S.on = false;
    if (wasOn || !ended) ui();
    draw(dt);
    if (wasOn && !S.on && !ended) finish();
  };
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    tickBattle(dt);
    raf = requestAnimationFrame(frame);
  };
  const stopAll = () => {
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKeyUp);
    view.destroy();
    active = null;
  };
  active = { stop: stopAll, advance: (sec: number) => { for (let i = 0; i < sec * 60; i++) tickBattle(1 / 60); } };

  // 시작: 와이프 → 보스 등장 컷인 → 전투
  fit();
  ui();
  view.cutin([bossPic(b), pic(leader)], `${b.name} 등장!`);
  if (manual) battleHints(view, 'raid', ['화면을 탭하면 공격!', '위아래로 밀면 줄을 옮겨 돌진을 피해요', '보스가 번쩍이면 막기를 꾹!', '스킬을 길게 누르면 설명이 나와요']);
  startAt = 1.3;
  raf = requestAnimationFrame((t0) => {
    last = t0;
    fit();
    raf = requestAnimationFrame(frame);
  });
  void root;

  function finish() {
    ended = true;
    view.warnBlock(false);
    const live = S.units * scale;
    const survived = !S.died;
    const killedNow = hpNow() <= 0;
    let damage: number;
    if (!manual) damage = survived ? Math.max(ex.target * (1 - R.autoSpread), Math.min(ex.target * (1 + R.autoSpread), live)) : live;
    else damage = survived ? Math.max(ex.target * R.manualMin, Math.min(ex.target * R.manualMax, live)) : Math.max(live, ex.target * R.manualMin * (1 - S.t / R.seconds));
    if (killedNow) damage = Math.max(damage, t.hpLeft);
    damage = Math.round(damage);
    if (killedNow) view.cutin([pic(leader), bossPic(b)], `${b.name} 처치!`);
    sfx(killedNow ? 'win' : survived ? 'win' : 'lose');
    const out = settle(t, members, damage, manual ? 'manual' : 'auto', ex);
    view.log(killedNow ? `${b.name} 처치!` : survived ? '시간 종료' : '파티가 쓰러졌어요…', killedNow ? 'wave' : survived ? 'kill' : 'bad');
    view.log(`가한 피해 ${fmt(damage)}`, 'loot');
    setTimeout(() => showResult(t, out, ex, manual ? 'manual' : 'auto', members, true, S.died, S.bestStreak), killedNow ? 1400 : 500);
  }
}

// ───────── 결과 ─────────

async function showResult(t: RaidTarget, out: RaidOutcome, ex: RaidExpect, mode: 'auto' | 'manual' | 'sweep', members: Actor[], inBattle: boolean, died = false, streak = 0) {
  const b = t.boss;
  const rec = mode === 'sweep' ? null : await submitRecord(t, out.damage, mode, ex);
  const title = out.killed ? `${b.name} 처치!` : mode === 'sweep' ? '소탕 완료' : died ? '파티가 쓰러졌다…' : '시간 종료';
  const left = triesLeft();
  const html = `<h2>${esc(title)}</h2><div class="big">${fmt(out.damage)}</div>
    <div class="stars">${mode === 'sweep' ? '소탕' : `등급 ${out.rank}`}</div>
    <p class="cen">${t.kind === 'weekly' ? `이번 주 누적 처치 <b class="g">${pct(1 - P.raid.hpLeft / t.max)}</b>${out.killed ? '' : ' · 남은 체력은 내일 이어서!'}` : `떠돌이 보스 남은 체력 ${fmt(Math.max(0, (P.raid.wander?.hpLeft ?? 0)))}`}</p>
    <div class="loot"><span>금화 +${fmt(out.gold)}</span><span>${esc(b.mat)} ×${out.mats}</span><span>경험치 +${fmt(out.xp)}</span>${out.token ? '<span class="g">인연의 증표 +1 (주간 참여)</span>' : ''}${out.firstKill ? `<span class="g">트로피 · ${esc(b.trophy)}</span><span class="g">칭호 「${esc(b.title)}」</span>` : ''}</div>
    ${out.personalBest ? '<p class="cen good">개인 최고 기록!</p>' : ''}${streak >= 2 ? `<p class="cen">연속 막기 ${streak}회</p>` : ''}
    <div class="rank">${t.kind === 'wander' ? '떠돌이 보스는 주간 랭킹에 안 들어가요' : '주간 토벌 랭킹 · ' + (rec ? (rec.ok ? (rec.online ? `이번 주 최고 ${fmt(P.raid.best)} · <b class="g" id="rMyRank">순위 확인 중…</b>${rec.reason ? ` <small>${esc(rec.reason)}</small>` : ''}` : `이번 주 최고 ${fmt(P.raid.best)} 기록 저장 <small>(로그인하면 랭킹에 올라가요)</small>`) : `<b class="bad">기록 거부: ${esc(rec.reason ?? '')}</b>`) : '소탕은 랭킹에 안 들어가요')}</div>
    <div class="go"><button class="a" id="rAgain" ${left > 0 ? '' : 'disabled'}>다시 하기 (${left}/${R.triesPerDay})</button><button class="b" id="rHome">마을로</button></div>`;
  markDirty();
  if (inBattle) {
    const box = document.getElementById('rResBody')!;
    box.innerHTML = html;
    document.getElementById('rResult')!.hidden = false;
  } else openWin('토벌 결과', `<div class="res">${html}</div>`);
  if (out.firstKill) toast(`트로피 「${b.trophy}」 획득! 건설 목록에서 무료로 놓을 수 있어요`);
  if (rec?.online && rec.ok)
    void mine('raidWeek', P.raid.week).then(({ row, total }) => {
      const el = document.getElementById('rMyRank');
      if (el) el.textContent = row ? `${row.rank}위 / ${total}명` : '순위 없음';
    });
  document.getElementById('rHome')!.onclick = () => {
    active?.stop();
    closeWin();
  };
  document.getElementById('rAgain')!.onclick = () => {
    active?.stop();
    const alive = members.filter((m) => m.hp >= CONFIG.expedition.minHp);
    if (!alive.length) return toast('파티가 너무 지쳤어요 · 쉬고 와요');
    const next = t.kind === 'weekly' ? weeklyTarget() : wanderTarget();
    if (!next) return toast('떠돌이 보스가 떠났어요');
    openRaidPrep(next);
  };
}

/** 시험·개발용: 자동 기대 단위 */
export const _autoUnits = () => autoUnits(true);
export { rankOf };
