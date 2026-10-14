// 5단계 2장: 사냥 화면 — 지역 탭 · 스테이지 10칸 → 파티(3명) → 웨이브 전투(토벌 전투 틀 재사용) → 결과
import { battleMusic } from './sound';
import { markAdventured } from '../world/actors';
import { funnel } from '../net/funnel';
import { themeOf } from '../combat/theme';
// 전투력이 모자라면 "전투력이 부족해요 (추천 ○○)" + 올리기 안내 → 파밍 → 강해짐 → 다음 스테이지
import { CONFIG } from '../data/config';
import { notePrep, prepLine } from './power';
import { closeCombat, foldHooks, foldInfo, foldMembers, runHeadless, showCombatResult, startCombat, unfoldCombat, type CombatResult } from '../combat/ui';
import { gradeBonus } from '../combat/field';
import { REGION_BOSS, stageMons } from '../combat/mons';
import { track as trackEv } from '../net/telemetry';
import { hfx } from '../world/harmony';
import { REGIONS, type RegionId } from '../data/items';
import { BOSS_IMG, MOB_IMG, RAID_BG, scaled } from '../engine/assets';
import { P as Paint } from '../engine/pixel';
import { framesFor, type CharFrames } from '../engine/sprites';
import { appearance, powerOf } from '../world/adventurers';
import { companionText, isCompanion, powerTips } from '../world/expeditions';
import { featureChapter, guideHooks } from '../world/guide';
import {
  best, clearStage, failStage, huntCrew, huntRegionOpen, isBoss, MOB_NAME, MOBS, partyPower, recPower, regionBossOf, regionIdx, setAuto, stageOpen, stopAuto, sweepStage, type HuntReward,
} from '../world/hunt';
import { markDirty, P, type Actor } from '../world/state';
import { skipFrame } from '../engine/fps';
import { battleHints, drawChar, LANES, LH, LW, mountBattle, sfx, type BattleView } from './battle';
import { upgradeBtn } from './guests';
import { recommendParty } from '../world/party';
import { bindDeck, deckGlow, deckGridHtml, deckTopHtml, lock4Cell, type DeckCfg } from './heroCard';
import { partyBlock, partyNote, partyPool, rulesV2 } from '../world/partyRules';
import { vis } from '../world/visual';
import { mentorBadge, recButton, roleIcon, roleRow, slotRow, synRow } from './partyUi';
import { huntPartyMax } from '../world/party4';
import { checkParty4 } from '../world/meta';
import { checkSlot5 } from '../world/meta';
import { queueEvent } from '../world/events';
import { $, $$, esc, fmt, itemCell, keepScroll, nameTag, pic } from './common';
import { iconSrc } from './kit';
import { closeWin, openWin, toast } from './windows';
import { BASE_REGIONS } from '../data/items';
import { DEEP_VOICE } from '../data/story/regions';
import { bossLineFor, deepDefeatCut, markBossShown, takeEnterLines, wantDeepVoice } from '../world/regions2';
import { routePreDone, setFlag } from '../world/routes';
import { storyHooks } from '../world/story';
import { playStory } from './story';
import { dropFanfare } from './fanfare';
import { openFishing } from './fishing';
import { openSmith } from './smith';
import { craftMax } from '../world/bulk';
import { enhanceBossCost, enhanceCost, smithObj } from '../world/craft';
import type { Item } from '../world/state';
import { taperLine } from './goldsink';
import { abyssOpen } from '../world/abyss';
import { openAbyss } from './abyss';
import { fieldHarvest, hvState, settleField } from '../world/harvest';
import { hvLootHtml } from './harvest';

/** HARVEST §1-4: 수확제 기간 사냥 판이면 호박 도깨비 · 대왕 차례 (기간 밖이면 빈 것) */
function hvOpts(s: number): { harvest?: { king: boolean; bark: boolean } } {
  const h = fieldHarvest(s);
  return h.on ? { harvest: { king: h.king, bark: !hvState().bark } } : {};
}
import { flag } from '../world/flags';
import { losesAt, noteHuntResult, RESOLVE, resolveOf, resolveText, unclearedStage } from '../world/wayfind';
import { blessed, blessFx } from '../world/goldsink';
import { fLv, potionCount } from '../world/facilities';
import { bestOf } from '../world/town';
import { showObj } from './windows';
import { world } from '../world/state';

const H = CONFIG.hunt;
const stageName = (r: string, s: number) => `${regionIdx(r) + 1}-${s}`;
let curRegion: RegionId = 'forest';
let picked: number[] = [];
/** 이번에 사용자가 파티를 직접 고쳤나 (지도로 돌아가면 풀린다) */
let manualPick = false;

// ───────── 스테이지 지도 ─────────

/** 장부 「자동 사냥 켜 보기」: 깬 가장 높은 숲 스테이지 준비 창 */
guideHooks.autoHuntPrep = () => {
  const s = best('forest');
  if (!s) return false;
  openHuntPrep('forest', s);
  return true;
};

export function openHunt(region?: RegionId) {
  if (!huntRegionOpen(0)) return toast(`사냥터는 장부 ${featureChapter('hunt')}장을 마치면 열려요`);
  manualPick = false;
  if (region) curRegion = region;
  if (!huntRegionOpen(regionIdx(curRegion))) curRegion = 'forest';
  // 전투 2차: 5지역 × 10스테이지 모두 새 전투
  const tabs = REGIONS.map((r, i) => {
    const open = huntRegionOpen(i);
    // REGIONS2: 6~10번 탭은 열린 뒤에만 (흩어진 별 → 해안 탭 등장)
    if (i >= BASE_REGIONS && !open) return '';
    return `<button class="tab ${r.id === curRegion ? 'on' : ''} ${open ? '' : 'locked'}" data-r="${r.id}" style="--rc:${themeOf(r.id).band}">${open ? r.name : `🔒 ${r.name}`}</button>`;
  }).join('');
  const b = best(curRegion);
  const cells = Array.from({ length: H.stages }, (_, i) => {
    const s = i + 1;
    const soon = false;
    const open = !soon && stageOpen(curRegion, s);
    const done = s <= b && !soon;
    const boss = isBoss(s);
    return `<button class="hst ${done ? 'done' : open ? 'next' : 'lock'} ${boss ? 'boss' : ''}" data-s="${s}" ${open ? '' : 'disabled'}><b>${stageName(curRegion, s)}</b><small>${soon ? '곧 열려요' : boss ? '보스' : `추천 ${fmt(recPower(curRegion, s))}`}</small>${done ? '<i>✓</i>' : ''}</button>`;
  }).join('');
  const a = P.hunt.auto;
  const reg = REGIONS[regionIdx(curRegion)];
  openWin(
    '사냥터',
    `<div class="tabs">${tabs}${abyssOpen() ? `<button class="tab abtab" id="hAbyss" style="--rc:${themeOf('deep').band}">끝없는 심연</button>` : ''}${huntRegionOpen(5) ? '<button class="tab fishtab" id="hFish" title="해안 낚시">🎣</button>' : ''}</div>
    <p class="sub">${esc(reg.name)} · 최고 돌파 <b class="g">${b ? stageName(curRegion, b) : '없음'}</b> · 증표 조각 ${P.hunt.shards}/${H.shardsPerToken}</p>
    <div class="hmap" style="--rc:${themeOf(curRegion).band}">${cells}</div>
    <div class="hauto">${a ? `<span><img src="${iconSrc('skill_auto')}" alt=""> 맡겨 둔 사냥 · <b>${esc(REGIONS[regionIdx(a.region)].name)} ${stageName(a.region, a.stage)}</b> · ${fmt(a.n ?? 0)}판 · 💰+${fmt(a.gold ?? 0)}</span><button class="bigbtn ghost sm" id="hStop">멈추기</button>` : `<span class="note">깬 스테이지를 누르고 「맡겨 두기」 → 마을에 있어도 계속 사냥해요 · 꺼 둬도 가장 높은 스테이지 기준으로 방치 보상</span>`}</div>
    ${taperLine()}<p class="note">무리를 쓰러뜨려 처치 목표를 채우면 정예가 나와요 · ${H.stages}스테이지는 지역 보스</p>`,
    'huntw',
  );
  $$('[data-r]').forEach(
    (el) =>
      (el.onclick = () => {
        // HOTFIX14 §3: 잠긴 지역은 무엇을 깨면 열리는지 (예전엔 disabled 라 눌러도 아무 반응이 없었다)
        const i = regionIdx(el.dataset.r as RegionId);
        if (!huntRegionOpen(i)) return toast(i ? `${REGIONS[i - 1].name} ${H.stages}(보스)을 깨면 열려요` : '사냥터는 아직 잠겨 있어요');
        openHunt(el.dataset.r as RegionId);
      }),
  );
  $$('[data-s]').forEach((el) => (el.onclick = () => openHuntPrep(curRegion, +el.dataset.s!)));
  const ha = document.getElementById('hAbyss');
  if (ha) ha.onclick = () => openAbyss();
  const hf = document.getElementById('hFish');
  if (hf) hf.onclick = () => openFishing('sea');
  const st = document.getElementById('hStop');
  if (st)
    st.onclick = () => {
      stopAuto();
      openHunt();
    };
}

// ───────── 파티 고르기 ─────────

/** 사냥 갈 단골이 없을 때: 모두 원정 중이면 가장 빨리 돌아오는 시간 */
function awayNote(): string {
  const runs = P.runs.filter((r) => !r.result);
  if (!runs.length) return '단골이 없어요 · 손님이 단골이 되면 데려갈 수 있어요';
  const soon = Math.max(0, Math.min(...runs.map((r) => r.end)) - Date.now());
  return `단골이 모두 원정 중이에요 · ${Math.ceil(soon / 1000)}초 뒤 돌아와요`;
}

/** 핫픽스 12 §2: 마지막 「추천 편성」 이유 */
let huntWhy = { k: '', text: '' };
function openHuntPrep(r: RegionId, s: number) {
  // PARTY §3: 4번째 자리 (훈련장 Lv5 + 장부) — 열리는 순간이면 모모 편지
  checkParty4();
  const max = huntPartyMax();
  const crew = huntCrew().sort((a, b) => powerOf(b) - powerOf(a));
  picked = picked.filter((id) => crew.some((a) => a.id === id));
  // 직접 고친 파티가 아니면, 빈자리는 돌아온 단골 중 가장 센 순서로 채운다
  // PARTY §3: 4번째 자리가 막 열렸으면 그 칸은 비워 둔다 (반짝 · 직접 채워 보게)
  const fill = max > 3 && !P.meta.party4Seen ? 3 : max;
  if (!manualPick) for (const a of crew) if (picked.length < fill && !picked.includes(a.id) && !isCompanion(a)) picked.push(a.id);
  const ms = picked.map((id) => crew.find((a) => a.id === id)!).filter(Boolean);
  const rec = recPower(r, s);
  const pw = ms.length ? partyPower(ms) : 0;
  const low = pw < rec;
  const tips = low && ms.length ? powerTips(ms) : [];
  const cleared = s <= best(r);
  // 전투 2차: 이 스테이지에 나오는 닌자 몬스터 · 처치 목표 → 정예(x-10은 지역 보스)
  const mobs = stageMons(r, s).map((m) => m.name);
  const goal = isBoss(s) ? `${CONFIG.combat.bossKillGoal}마리 → 보스 ${REGION_BOSS[r].name}` : `${Math.round(CONFIG.combat.killGoal[0] + ((CONFIG.combat.killGoal[1] - CONFIG.combat.killGoal[0]) * (s - 1)) / 8)}마리 → 정예`;
  // J6 partyRulesV2: 원정 중인 사람도 흐리게 + 「원정 중 n분」 · 지친 사람은 「체력 n · 지쳤어요」 (사냥은 지쳐도 갈 수 있음)
  const v2 = rulesV2();
  const away = v2 ? partyPool().filter((a) => partyBlock(a, 'hunt')).sort((a, b) => powerOf(b) - powerOf(a)) : [];
  const rows =
    crew
      .map((a) => {
        const on = picked.includes(a.id);
        return `<button class="pm ${on ? 'on' : ''}" data-id="${a.id}"><img src="${pic(a)}" alt=""><span>${picked[0] === a.id ? '<b class="g">대장</b> ' : ''}${roleIcon(a)}${nameTag(a)} Lv.${a.lvl}${mentorBadge(a, ms)}<small>${isCompanion(a) ? `${companionText(a)} · ` : ''}${(v2 && partyNote(a, 'hunt')) || `체력 ${Math.round(a.hp)}`}</small></span><em>${fmt(powerOf(a))}</em></button>`;
      })
      .join('') +
    away.map((a) => `<button class="pm" data-id="${a.id}" disabled><img src="${pic(a)}" alt=""><span>${roleIcon(a)}${nameTag(a)} Lv.${a.lvl}<small>${esc(partyBlock(a, 'hunt')!)}</small></span><em>${fmt(powerOf(a))}</em></button>`).join('');
  // 핫픽스 10 (11-1): 버튼마다 한 줄 설명 · 깬 스테이지면 「맡겨 두기」가 맨 위 큰 버튼, 아니면 직접 사냥이 맨 위
  const dis = ms.length ? '' : 'disabled';
  const opt = (id: string, cls: string, label: string, desc: string) => `<div class="hopt"><button class="bigbtn ${cls}" id="${id}" ${dis}>${label}</button><small>${desc}</small></div>`;
  const man = opt('hMan', cleared ? 'ghost' : 'red', '직접 사냥', '내가 조작 · 평가 보너스 S +30% · A +15%');
  const watch = opt('hAuto1', 'ghost', '전투 보기 (AUTO)', '화면을 보면서 자동으로 싸워요 · 기본 보상');
  const keep = opt('hRepeat', 'keep', '맡겨 두기 · 마을에서 계속 사냥', `화면 안 봐도 돼요 · 마을에 있어도 ${H.autoSeconds}초마다 한 판`);
  const sweepB = opt('hSweep', 'ghost', '소탕', '전투 없이 바로 · 보상 70% (첫 돌파 보상 없음)');
  const hopts = cleared ? [keep, man, watch, sweepB] : [man, watch];
  if (vis('heroCards')) {
    // CHECKIN §J6 카드 덱: 맨 위 [추천 편성][맨 위 행동(맡겨 두기 / 직접 사냥)] · 나머지 행동은 격자 아래
    const top = cleared ? `<button class="bigbtn keep" id="hRepeat" ${dis}>맡겨 두기</button>` : `<button class="bigbtn red" id="hMan" ${dis}>직접 사냥</button>`;
    const cfg: DeckCfg = {
      where: 'hunt',
      pool: v2 ? partyPool() : crew,
      sel: ms,
      max,
      block: (a) => (v2 ? partyBlock(a, 'hunt') : crew.includes(a) ? null : '원정 중'),
      note: (a) => (v2 ? partyNote(a, 'hunt') : null),
      extra: (a) => mentorBadge(a, ms),
      lead: true,
      lockCell: lock4Cell(ms, max),
      power: pw,
      rec,
      info: `${prepLine('hunt', pw)}`,
      synWhere: 'hunt',
      recId: crew.length ? 'hRec' : undefined,
      recWhy: huntWhy.k === `${r}-${s}` ? huntWhy.text : '',
      go: top,
      empty: awayNote(),
    };
    openWin(
      `사냥 ${stageName(r, s)}${isBoss(s) ? ' · 보스' : ''}`,
      `${deckTopHtml(cfg)}      ${resolveOf(r, s) ? `<p class="cen resolve">🔥 ${esc(resolveText(resolveOf(r, s)))} <small>(이기면 사라져요)</small></p>` : ''}
      ${deckGridHtml(cfg)}<p class="sub">${esc(REGIONS[regionIdx(r)].name)} · 처치 ${esc(goal)} · ${esc(mobs.join(' · '))}</p>
      ${low ? `<div class="tips"><b>전투력이 부족해요 (추천 ${fmt(rec)}) · 이렇게 올릴 수 있어요</b>${tips.map((x) => `<div>· ${esc(x.text)}</div>`).join('')}</div>` : ''}
      <div class="hopts">${hopts.slice(1).join('')}</div>
      <button class="bigbtn ghost sm" id="hBack">지도로</button>`,
    );
    bindDeck(
      cfg,
      (id) => {
        picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < max ? [...picked, id] : picked;
        manualPick = true;
        keepScroll(() => openHuntPrep(r, s));
      },
      () => openHuntPrep(r, s),
    );
  } else
  openWin(
    `사냥 ${stageName(r, s)}${isBoss(s) ? ' · 보스' : ''}`,
    `<p class="sub">${esc(REGIONS[regionIdx(r)].name)} · 처치 ${esc(goal)} · ${esc(mobs.join(' · '))}</p>
    <div class="pw"><span>추천 전투력</span><em>${fmt(rec)}</em><span>우리 파티 ${prepLine('hunt', pw)}</span><em class="${low ? 'bad' : 'good'}">${fmt(pw)}</em></div>
    ${resolveOf(r, s) ? `<p class="cen resolve">🔥 ${esc(resolveText(resolveOf(r, s)))} <small>(이기면 사라져요)</small></p>` : ''}
    ${low ? `<div class="tips"><b>전투력이 부족해요 (추천 ${fmt(rec)}) · 이렇게 올릴 수 있어요</b>${tips.map((x) => `<div>· ${esc(x.text)}</div>`).join('')}</div>` : ''}
    <p class="sub">파티 ${ms.length}/${max} · 첫 번째가 대장${max > 3 ? ' · 4번째는 AI' : ''}</p>${slotRow(ms, max)}
    ${crew.length ? recButton('hRec', huntWhy.k === `${r}-${s}` ? huntWhy.text : '') : ''}${roleRow(ms)}${synRow(ms, crew, max, 'hunt')}
    <div class="plist">${rows || `<p class="note">${awayNote()}</p>`}</div>
    <div class="hopts">${hopts.join('')}</div>
    <button class="bigbtn ghost sm" id="hBack">지도로</button>`,
  );
  $$('.pm').forEach(
    (el) =>
      (el.onclick = () => {
        const id = +el.dataset.id!;
        picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < max ? [...picked, id] : picked;
        manualPick = true;
        keepScroll(() => openHuntPrep(r, s));
      }),
  );
  const hr = document.getElementById('hRec');
  if (hr)
    hr.onclick = () => {
      const best = recommendParty(crew.filter((a) => a.hp >= 1), { power: rec, region: r, min: 1, max });
      if (!best) return;
      // 대장은 가장 센 사람
      picked = best.members.sort((a, b) => powerOf(b) - powerOf(a)).map((m) => m.id);
      manualPick = true;
      if (vis('heroCards')) deckGlow(picked);
      huntWhy = { k: `${r}-${s}`, text: best.reasons.join(' · ') || `전투력 ${fmt(best.power)} / 추천 ${fmt(rec)}` };
      trackEv('party_recommend', { where: 'hunt', action: 'use', n: picked.length });
      keepScroll(() => openHuntPrep(r, s));
    };
  $('#hBack').onclick = () => openHunt(r);
  $('#hMan').onclick = () => go(true);
  $('#hAuto1').onclick = () => go(false);
  const rp = document.getElementById('hRepeat');
  if (rp)
    rp.onclick = () => {
      const err = setAuto(r, s, ms);
      if (err) return toast(err);
      toast(`맡겨 두기 시작 · ${stageName(r, s)} (${H.autoSeconds}초마다 한 판)`);
      openHunt(r);
    };
  const sw = document.getElementById('hSweep');
  if (sw) sw.onclick = () => sweep(r, s, ms);
  function go(manual: boolean) {
    closeWin();
    beginCombat(r, s, ms, !manual);
  }
}

// ───────── 웨이브 전투 ─────────

interface Mob {
  key: string;
  img: HTMLCanvasElement;
  white: HTMLCanvasElement;
  x: number;
  lane: number;
  hp: number;
  max: number;
  boss: boolean;
  /** 서는 자리 (앞줄) */
  stop: number;
  hit: number;
  dead: number;
}

const whiteOf = (src: HTMLCanvasElement) => {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const x = c.getContext('2d')!;
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  return c;
};

/** 옛 웨이브 전투 화면 — 전투 개편 1차부터 쓰지 않는다 (2차에 지운다) */
export function startHunt(r: RegionId, s: number, members: Actor[], manual: boolean) {
  battleMusic.huntRegion = r;
  notePrep('hunt', partyPower(members));
  const leader = members[0];
  const rec = recPower(r, s);
  const power = partyPower(members);
  // 깃발 아래: 사냥 피해 +5%
  const dps = power * H.dpsK * (1 + hfx('dmg'));
  const total = rec * H.dpsK * H.stageHpSec;
  const danger = Math.pow(rec / Math.max(1, power), H.dangerExp);
  const boss = isBoss(s);
  const view: BattleView = mountBattle({
    id: 'hunt',
    title: `사냥 ${stageName(r, s)} · 웨이브 1/${H.waves}`,
    members,
    skills: [
      { id: 's1', icon: 'skill_fireslash', name: '화염 베기', desc: '앞 몬스터에 큰 피해 + 주변에 불똥 · 8초마다' },
      { id: 's2', icon: 'skill_pray', name: '수호 기도', desc: '4초 동안 받는 피해 60% 감소 + 회복 · 12초마다' },
      { id: 'combo', icon: 'skill_combo', name: '합동기', desc: '케미 게이지가 차면 모든 몬스터에 큰 피해' },
      { id: 'auto', icon: 'skill_auto', name: 'AUTO', desc: '자동 전투 켜기 · 끄기' },
      { id: 'block', icon: 'skill_block', name: '막기', desc: '1.5초 동안 몬스터 공격을 막아요 · 6초마다' },
    ],
  });
  const { cv, ctx, q } = view;
  const frames = new Map<Actor, CharFrames>();
  for (const m of members) {
    const { key, def } = appearance(m);
    frames.set(m, framesFor(key, def));
  }
  const bossImg = BOSS_IMG[regionBossOf(r).id] ? scaled(BOSS_IMG[regionBossOf(r).id], 0.6) : null;
  const W = { t: H.seconds, php: 1000, wave: 0, mobs: [] as Mob[], left: total, auto: !manual, on: false, cd1: 0, cd2: 0, cdb: 0, shield: 0, guard: 0, chem: 0, atk: 0, ally: 0, heal: 6, shake: 0, lane: 1, done: false, win: false };
  let T = 0;
  let kills = 0;
  const mobLabel = (m: Mob) => (m.boss ? `${regionBossOf(r).name}(새끼)` : MOB_NAME[m.key] ?? '몬스터');

  const spawnWave = () => {
    W.wave++;
    view.setTitle(`사냥 ${stageName(r, s)} · 웨이브 ${W.wave}/${H.waves}`);
    const waveHp = total / H.waves;
    const isBossWave = boss && W.wave === H.waves;
    const n = isBossWave ? 2 : H.pack[0] + Math.floor(Math.random() * (H.pack[1] - H.pack[0] + 1));
    const keys = MOBS[r];
    for (let i = 0; i < n; i++) {
      const bossMob = isBossWave && i === 0 && !!bossImg;
      const k = keys[Math.floor(Math.random() * keys.length)];
      const img = bossMob ? bossImg! : MOB_IMG[k];
      const hp = bossMob ? waveHp * 0.8 : isBossWave ? waveHp * 0.2 : waveHp / n;
      W.mobs.push({ key: bossMob ? 'boss' : k, img, white: whiteOf(img), x: LW - 30 + i * 30, lane: bossMob ? 1 : i % 3, hp, max: hp, boss: bossMob, stop: (bossMob ? 168 : 132) + (i % 3) * 22, hit: 0, dead: 0 });
    }
    if (isBossWave) view.cutin([pic(leader), ''], `${regionBossOf(r).name}(새끼) 등장!`);
    // 세로 화면 기록창
    const names = [...new Set(W.mobs.filter((m) => m.hp > 0).map((m) => mobLabel(m)))].join(' · ');
    view.log(`웨이브 ${W.wave}/${H.waves} · ${names} ${n}마리`, 'wave');
  };
  const alive = () => W.mobs.filter((m) => m.hp > 0);
  /** 앞줄에 닿은 몬스터만 칠 수 있다 (걸어오는 동안엔 못 친다 → 맞고 때리는 교환이 생긴다) */
  const near = () => alive().filter((m) => m.x <= m.stop + 6);
  const front = () => near().sort((a, b) => a.x - b.x)[0];
  const hurt = (m: Mob, v: number, cls = '') => {
    if (!m || m.hp <= 0) return;
    m.hp -= v;
    W.left = Math.max(0, W.left - Math.min(v, m.hp + v));
    m.hit = 0.08;
    view.num(m.x + m.img.width / 2, LANES[m.lane] - m.img.height - 4, fmt(v * 10), cls);
    if (m.hp <= 0) {
      m.dead = 0.6;
      kills++;
      view.log(`${mobLabel(m)} 처치 · ${kills}마리째`, 'kill');
    }
    W.chem = Math.min(100, W.chem + (cls ? 3 : 1));
  };
  const attack = () => {
    if (!W.on || W.atk > 0) return;
    const f = front();
    if (!f) return;
    W.atk = 0.22;
    const crit = Math.random() < 0.15;
    hurt(f, (dps * 0.5) / 4 * (crit ? 2 : 1), crit ? 'crit' : '');
    sfx(crit ? 'crit' : 'hit');
    if (crit) W.shake = 0.1;
  };
  const skill1 = () => {
    if (!W.on || W.cd1 > 0) return;
    W.cd1 = 8;
    W.atk = 0.35;
    const f = front();
    if (f) hurt(f, dps * 3, 'crit');
    for (const m of near()) if (m !== f) hurt(m, dps * 0.8, '');
    sfx('skill');
  };
  const skill2 = () => {
    if (!W.on || W.cd2 > 0) return;
    W.cd2 = 12;
    W.shield = 4;
    W.php = Math.min(1000, W.php + 150);
    view.num(70, 100, '+150', 'heal');
  };
  const block = () => {
    if (!W.on || W.cdb > 0) return;
    W.cdb = 6;
    W.guard = 1.5;
    view.num(110, 96, '막기!', 'msg');
    sfx('block');
  };
  const combo = () => {
    if (!W.on || W.chem < 100) return;
    W.chem = 0;
    view.cutin([pic(leader), members[1] ? pic(members[1]) : ''], '합동기!');
    for (const m of alive()) hurt(m, dps * 2, 'big');
    W.shake = 0.4;
  };

  // 입력
  cv.addEventListener('pointerup', () => !W.auto && attack());
  q('#b_s1').onclick = () => !W.auto && skill1();
  q('#b_s2').onclick = () => !W.auto && skill2();
  q('#b_block').onclick = () => !W.auto && block();
  q('#b_combo').onclick = () => !W.auto && combo();
  q('#b_auto').onclick = () => {
    W.auto = !W.auto;
    view.setAuto(W.auto);
  };

  const step = (dt: number) => {
    W.atk = Math.max(0, W.atk - dt);
    W.shake = Math.max(0, W.shake - dt);
    for (const m of W.mobs) {
      m.hit = Math.max(0, m.hit - dt);
      if (m.dead > 0) m.dead -= dt;
    }
    W.mobs = W.mobs.filter((m) => m.hp > 0 || m.dead > 0);
    if (!W.on) return;
    W.t -= dt;
    W.cd1 = Math.max(0, W.cd1 - dt);
    W.cd2 = Math.max(0, W.cd2 - dt);
    W.cdb = Math.max(0, W.cdb - dt);
    W.shield = Math.max(0, W.shield - dt);
    W.guard = Math.max(0, W.guard - dt);
    // 몬스터: 걸어와 앞줄에 서면 공격
    let touching = 0;
    for (const m of alive()) {
      if (m.x > m.stop) m.x = Math.max(m.stop, m.x - (m.boss ? 22 : 34) * dt);
      else touching += m.boss ? H.bossMult : 1;
    }
    if (touching && W.guard <= 0) {
      const d = H.mobDps * danger * touching * dt * (W.shield > 0 ? 0.4 : 1);
      W.php = Math.max(0, W.php - d);
      W.shake = Math.max(W.shake, 0.05);
    }
    // 동료 둘은 늘 공격, 대장은 자동일 때만 (직접이면 탭)
    W.ally -= dt;
    if (W.ally <= 0) {
      W.ally = 0.5;
      const ns = near();
      const t = ns[Math.floor(Math.random() * ns.length)];
      if (t) hurt(t, dps * 0.5 * 0.5, '');
    }
    W.heal -= dt;
    if (W.heal <= 0) {
      W.heal = 6;
      W.php = Math.min(1000, W.php + 50);
    }
    if (W.auto) {
      if (front()) attack();
      if (W.cd1 <= 0 && front()) skill1();
      if (W.cd2 <= 0 && W.php < 650) skill2();
      if (W.cdb <= 0 && touching >= 2) block();
      if (W.chem >= 100 && alive().length >= 2) combo();
    }
    if (!alive().length && W.mobs.every((m) => m.dead <= 0)) {
      if (W.wave >= H.waves) return end(true);
      spawnWave();
    }
    if (W.php <= 0) return end(false);
    if (W.t <= 0) return end(false);
  };

  const ALLY = [[18, 0], [34, 2]] as const;
  const LEAD_X = 76;
  const draw = () => {
    const sh = W.shake > 0 ? (((T * 60) | 0) % 2 ? 2 : -2) : 0;
    ctx.save();
    ctx.translate(sh, 0);
    const bg = RAID_BG[r] ?? RAID_BG.forest;
    if (bg) ctx.drawImage(bg, Math.round((LW - bg.width) / 2), 0);
    const p = Paint(ctx);
    // 몬스터 (줄 순서대로) — 맞으면 1프레임 흰색, 죽으면 깜빡 3번 후 사라짐
    const ms = [...W.mobs].sort((a, b) => a.lane - b.lane);
    for (const m of ms) {
      if (m.hp <= 0 && Math.floor(m.dead * 10) % 2) continue;
      const y = LANES[m.lane] + 4 - m.img.height + (m.hp > 0 ? Math.round(Math.sin(T * 6 + m.stop) * 1) : 0);
      ctx.drawImage(m.hit > 0 ? m.white : m.img, Math.round(m.x), Math.round(y));
      if (m.hp > 0) {
        const w = m.boss ? 40 : 22;
        const bx = Math.round(m.x + m.img.width / 2 - w / 2);
        p.rect(bx - 1, Math.round(y) - 6, w + 2, 4, '#161420');
        p.rect(bx, Math.round(y) - 5, Math.max(1, Math.round((m.hp / m.max) * w)), 2, m.boss ? '#ff9a3c' : '#e0544a');
      }
    }
    // 파티 (2배)
    const pos: [Actor, number, number][] = [];
    if (members[1]) pos.push([members[1], ALLY[0][0], LANES[0]]);
    if (members[2]) pos.push([members[2], ALLY[1][0], LANES[2]]);
    pos.push([leader, LEAD_X, LANES[W.lane]]);
    pos.sort((a, b) => a[2] - b[2]);
    for (const [m, x, y] of pos) {
      const f = frames.get(m)!;
      const fr = m === leader ? (W.atk > 0 ? f.atk[W.atk > 0.11 ? 0 : 1] : f.idle[((T * 2) | 0) % 2]) : W.ally > 0.4 ? f.atk[1] : f.idle[((T * 2 + 1) | 0) % 2];
      ctx.globalAlpha = 0.3;
      p.rect(x + 10, y, 28, 3, '#000');
      ctx.globalAlpha = 1;
      drawChar(ctx, fr, x, y);
      if (m === leader && (W.shield > 0 || W.guard > 0) && ((T * 6) | 0) % 2) {
        ctx.globalAlpha = 0.5;
        p.ell(x + 24, y - 30, 26, 34, W.guard > 0 ? '#ffe94a' : '#9fd0ff');
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  };

  const ui = () => {
    view.setHp(W.left / total, `몬스터 ${alive().length}마리 · 웨이브 ${Math.max(1, W.wave)}/${H.waves}`);
    view.setTimer(W.t);
    view.setParty(members.map(() => W.php / 1000));
    view.setCd('s1', W.cd1 / 8, W.cd1);
    view.setCd('s2', W.cd2 / 12, W.cd2);
    view.setChem(W.chem, true);
    view.setAuto(W.auto);
    view.warnBlock(alive().filter((m) => m.x <= m.stop).length >= 2 && W.cdb <= 0);
  };

  let raf = 0;
  let last = 0;
  let startAt = 1.2;
  const tick = (dt: number) => {
    T += dt;
    if (startAt > 0 && T >= startAt) {
      startAt = -1;
      W.on = true;
      spawnWave();
      view.num(150, 80, manual ? '사냥 시작!' : '자동 전투 시작!', 'msg');
    }
    step(dt);
    if (!W.done) ui();
    draw();
  };
  const frame = (now: number) => {
    // 핫픽스 11: 최대 60fps (배터리 절약 30)
    if (skipFrame(last, now)) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    tick(dt);
    raf = requestAnimationFrame(frame);
  };
  activeHunt = { advance: (sec) => { for (let i = 0; i < sec * 60; i++) tick(1 / 60); }, stop: () => { cancelAnimationFrame(raf); view.destroy(); activeHunt = null; } };
  view.fit();
  ui();
  view.cutin([pic(leader), ''], `사냥 ${stageName(r, s)}`);
  if (manual) battleHints(view, 'hunt', ['화면을 탭하면 앞 몬스터를 공격!', '몬스터가 많이 붙으면 막기!', '깬 스테이지는 자동 사냥으로 반복해요']);
  raf = requestAnimationFrame((t0) => {
    last = t0;
    view.fit();
    raf = requestAnimationFrame(frame);
  });

  function end(win: boolean) {
    if (W.done) return;
    W.done = true;
    W.on = false;
    W.win = win;
    if (import.meta.env.DEV) Object.assign(window, { __lastHunt: { win, t: Math.round(W.t), php: Math.round(W.php), power, rec, total: Math.round(total), dps: Math.round(dps) } });
    sfx(win ? 'win' : 'lose');
    const out = win ? clearStage(r, s, members) : failStage(r, s, members);
    for (const m of members) m.hp = Math.max(1, m.hp - (win ? 5 : 15));
    markAdventured(members);
    markDirty();
    if (win) {
      view.log(`전리품 · 금화 +${fmt(out.gold)} · ${REGIONS[regionIdx(r)].mat} ×${out.mats}`, 'loot');
      for (const it of out.items) view.log(`전리품 · ${it.name}`, 'loot');
    } else view.log(W.php <= 0 ? '파티가 쓰러졌어요…' : '시간이 다 됐어요…', 'bad');
    setTimeout(() => showHuntResult(view, r, s, members, win, out), 600);
  }
}

let activeHunt: { advance: (sec: number) => void; stop: () => void } | null = null;
/** 개발용: 화면이 숨어 rAF가 멈췄을 때 사냥을 sec초 진행 */
export const _huntAdvance = (sec: number) => activeHunt?.advance(sec);

function showHuntResult(view: BattleView, r: RegionId, s: number, members: Actor[], win: boolean, out: HuntReward) {
  const next = s < H.stages ? s + 1 : 0;
  const items = out.items.map((it) => itemCell(it)).join('');
  const html = `<h2>${win ? `사냥 ${stageName(r, s)} 돌파!` : '사냥 실패…'}</h2>
    ${win && out.first ? '<p class="cen good">첫 돌파!</p>' : ''}
    <div class="loot"><span>금화 +${fmt(out.gold)}</span><span>경험치 +${fmt(out.xp)}</span><span>${esc(REGIONS[regionIdx(r)].mat)} ×${out.mats}</span>${out.firstDust ? `<span class="g">잿빛 가루 +${out.firstDust}</span>` : ''}${out.shards ? `<span class="g">증표 조각 +${out.shards}</span>` : ''}${out.token ? '<span class="g">인연의 증표 +1!</span>' : ''}${out.bossMats ? `<span class="g">${esc(regionBossOf(r).mat)} ×${out.bossMats}</span>` : ''}</div>
    ${items ? `<div class="loot">${items}</div>` : ''}
    ${out.levelUps.length ? `<p class="cen good">레벨업! ${out.levelUps.map(esc).join(', ')}</p>` : ''}
    ${win ? '' : `<p class="cen">전투력이 부족해요 (추천 ${fmt(recPower(r, s))}) · 장비·레벨을 올리고 다시!</p>`}
    <div class="go">${win && next && stageOpen(r, next) ? `<button class="a" id="hNext">다음 ${stageName(r, next)}</button>` : `<button class="a" id="hAgain">다시 하기</button>`}<button class="b" id="hHome">마을로</button></div>
    ${win ? `<div class="go"><button class="b" id="hRep">이 스테이지 자동 사냥</button><button class="b" id="hMap">사냥터 지도</button></div>` : ''}`;
  view.q('#rResBody').innerHTML = html;
  view.q('#rResult').hidden = false;
  const done = () => activeHunt?.stop();
  document.getElementById('hHome')!.onclick = done;
  const nx = document.getElementById('hNext');
  if (nx)
    nx.onclick = () => {
      done();
      openHuntPrep(r, next);
    };
  const ag = document.getElementById('hAgain');
  if (ag)
    ag.onclick = () => {
      done();
      openHuntPrep(r, s);
    };
  const rp = document.getElementById('hRep');
  if (rp)
    rp.onclick = () => {
      const err = setAuto(r, s, members);
      if (err) return toast(err);
      done();
      toast(`맡겨 두기 시작 · ${stageName(r, s)}`);
    };
  const mp = document.getElementById('hMap');
  if (mp)
    mp.onclick = () => {
      done();
      openHunt(r);
    };
}

void LH;

// ───────── 전투 개편 1차: 쿼터뷰 필드 액션 · 소탕 ─────────

/** GROWTH §3-6: 「대장간에서 쓸 수 있는 것: 강화 3 · 제작 1」 (누르면 대장간) */
export const enhCount = () => P.bag.filter((it) => it.owner != null && it.enh < CONFIG.smith.maxEnhance && P.dust[it.grade] >= enhanceCost(it) && (!enhanceBossCost(it) || (P.bossMats[enhanceBossCost(it)!.boss.id] ?? 0) >= enhanceBossCost(it)!.n)).length;
export function smithLine(): string {
  if (!smithObj()) return '';
  const enh = enhCount();
  const cr = REGIONS.filter((x, i) => (i < BASE_REGIONS || huntRegionOpen(i)) && craftMax(x.id) > 0).length;
  if (!enh && !cr) return '';
  return `<button class="b smithln" id="cSmith">⚒️ 대장간에서 쓸 수 있는 것: 강화 ${enh} · 제작 ${cr}</button>`;
}
let lastLoot: Item[] = [];
function lootHtml(r: RegionId, out: HuntReward): string {
  lastLoot = out.items;
  const items = out.items.map((it) => itemCell(it)).join('');
  return `<div class="loot"><span>금화 +${fmt(out.gold)}</span><span>경험치 +${fmt(out.xp)}</span><span>${esc(REGIONS[regionIdx(r)].mat)} ×${out.mats}</span>${out.firstDust ? `<span class="g">잿빛 가루 +${out.firstDust}</span>` : ''}${out.shards ? `<span class="g">증표 조각 +${out.shards}</span>` : ''}${out.token ? '<span class="g">인연의 증표 +1!</span>' : ''}${out.bossMats ? `<span class="g">${esc(regionBossOf(r).mat)} ×${out.bossMats}</span>` : ''}</div>${items ? `<div class="loot">${items}</div>` : ''}${upgradeBtn(out.items)}${out.levelUps.length ? `<p class="cen good">레벨업! ${out.levelUps.map(esc).join(', ')}</p>` : ''}${smithLine()}`;
}

function beginCombat(r: RegionId, s: number, ms: Actor[], auto: boolean) {
  // REGIONS2 §5-2: 새 지역 첫 입장 — 사냥 시작 전 한 번
  const enter = takeEnterLines(r);
  if (enter) return playStory(enter, () => beginCombat(r, s, ms, auto));
  notePrep('hunt', partyPower(ms));
  trackEv('hunt_start', { stage: `${r}-${s}`, mode: auto ? 'auto' : 'manual' });
  P.hunt.folded = null;
  funnel('first_hunt', { r, s });
  // REGIONS2: 지역 6~9 보스 첫 처치 한 줄 · 지역 10 보스 체력 50% 「목소리」
  const bossLine = isBoss(s) ? bossLineFor(r) : null;
  const voice = r === 'deep' && isBoss(s) && wantDeepVoice();
  void startCombat(r, s, ms, auto, (res) => {
    if (bossLine && res.win) markBossShown(r);
    const html = settleHunt(r, s, ms, res);
    showCombatResult(html, (card) => bindResult(card, r, s, ms, closeCombat));
    dropFanfare(lastLoot);
  }, { ...(bossLine ? { bossLine } : {}), ...(voice ? { talkHalf: (done: () => void) => playStory(DEEP_VOICE, done) } : {}), ...hvOpts(s) });
}

/** 지역 10 보스 처치 뒤 컷 (마을로 돌아가면 대사 차례에) */
export function deepDefeat(finalRaid = false): boolean {
  const heroReady = P.story.route === 'hero' && routePreDone('hero') && !P.story.flags?.final;
  const cut = deepDefeatCut(heroReady || finalRaid);
  if (cut?.hero) {
    setFlag('final');
    trackEv('route_event', { route: 'hero', ev: 'final', via: finalRaid ? 'goal' : 'hunt' });
  }
  if (cut && !finalRaid) storyHooks.say(cut.lines);
  return !!cut?.hero;
}

/** 한 판 끝: 보상 · 기록 → 결과 카드 HTML (전투 화면 · 접은 판 · 다시 켰을 때 정산 공통) */
function settleHunt(r: RegionId, s: number, ms: Actor[], res: CombatResult, folded = !!P.hunt.folded): string {
  queueEvent(() => void checkSlot5(), 'slot5');
  P.hunt.folded = null;
  // WAYFIND §2: 이 판에 걸려 있던 결의 (기록) → 결과로 쌓거나 초기화
  const resolve = resolveOf(r, s);
  const wasNew = unclearedStage(r, s);
  trackEv('hunt_end', { stage: `${r}-${s}`, mode: res.autoUsed ? 'auto' : 'manual', result: res.win ? 'win' : 'lose', sec: res.time, grade: res.grade, resolve });
  const resAfter = noteHuntResult(r, s, res.win);
  const bonus = gradeBonus(res.win, res.autoUsed, res.grade);
  // 장비는 전투 중에 떨어진 것을 이미 주웠다 (원정과 같은 등급표) → 결과에서 또 뽑지 않는다
  // GOLDSINK §4: 접어 둔 판은 자동 사냥과 같은 하루 판 수로 센다
  const out = res.win ? clearStage(r, s, ms, 1 + bonus, false, folded) : failStage(r, s, ms);
  out.items.push(...res.items);
  // HARVEST §1-4: 잡은 호박 도깨비 · 대왕 → 수확 리본 (이긴 판·진 판 모두)
  const hv = res.pumpkins != null ? settleField(r, res.pumpkins, !!res.kingDown) : null;
  if (res.barked) hvState().bark = true;
  for (const m of ms) m.hp = Math.max(1, m.hp - (res.win ? 5 : 15));
  markAdventured(ms);
  markDirty();
  const next = s + 1;
  const canNext = res.win && next <= H.stages && stageOpen(r, next);
  // 핫픽스 10 (11-4): 처음 깼을 때 한 번 — 모모가 「맡겨 두기」를 알려 준다 (계정당 1번)
  // HOTFIX14 §3: 지역 보스(x-10)를 처음 깨면 다음 지역이 열린다 → 결과 화면에 크게
  const ri = regionIdx(r);
  const newRegion = res.win && !!out.first && s === H.stages && ri + 1 < REGIONS.length && huntRegionOpen(ri + 1) ? REGIONS[ri + 1] : null;
  // REGIONS2 §5-5: 별을 삼킨 것 처치 → 용사 루트(최종 토벌 앞까지 마침)면 HERO 컷 + 최종 토벌 완료 · 아니면 PLAIN (회차마다 한 번)
  if (res.win && r === 'deep' && s === H.stages) deepDefeat();
  if (newRegion) trackEv('region_open', { region: newRegion.id });
  // 사냥 창이 뒤에 열려 있었으면 끝난 뒤 다시 그린다 (탭·스테이지 칸이 🔒 그대로 남지 않게)
  queueEvent(() => {
    if (/^사냥터/.test(document.getElementById('winT')?.textContent ?? '') && document.getElementById('win')?.classList.contains('on')) openHunt(r);
  }, 'huntRedraw');
  const hint = res.win && !!out.first && !P.hunt.autoHint;
  if (hint) P.hunt.autoHint = true;
  // WAYFIND §2: 패배 카드에 대장간이 있으면 위 「대장간에서 쓸 수 있는 것」 줄은 뺀다 (같은 말 두 번)
  const stuck = res.win ? '' : stuckHtml(r, s, ms, wasNew, resAfter);
  let loot = lootHtml(r, out) + (hv ? hvLootHtml(hv) : '');
  if (stuck.includes('data-stk="smith"')) loot = loot.replace(smithLine(), '');
  const gradeLine = res.win
    ? `<div class="cgrade g${res.grade}"><b>${res.grade}</b><span>${res.autoUsed ? 'AUTO 사용 · 평가 보너스 없음' : bonus ? `평가 보너스 +${Math.round(bonus * 100)}%` : '평가 보너스 없음'}</span></div>`
    : '';
  return `<h2>${res.win ? `사냥 ${stageName(r, s)} 돌파!` : '사냥 실패…'}</h2>${gradeLine}
      <p class="cen">${res.time}초 · 맞은 횟수 ${res.hits} · 처치 ${res.kills} · 최대 ${res.maxStreak} KILLS</p>
      ${res.win && out.first ? '<p class="cen good">첫 돌파!</p>' : ''}${newRegion ? `<div class="newreg"><span>새 지역이 열렸어요! ✨</span><b>${esc(newRegion.name)}</b><button class="a" id="cGoReg" data-reg="${newRegion.id}">바로 가기</button></div>` : ''}${loot}
      ${stuck}
      <p class="note">평가 = 덜 맞고 · 빨리 끝내고 · KILLS를 길게 이을수록 높아요</p>
      ${hint ? `<p class="cen momohint"><b>모모</b> 「깬 곳은 저한테 맡기셔도 돼요! 마을에 있어도 계속 사냥해요~」</p><div class="go"><button class="a flash" id="cKeep">이 스테이지 자동 사냥</button></div>` : ''}
      <div class="go">${canNext ? `<button class="a" id="cNext" data-next="${next}">다음 ${stageName(r, next)}</button>` : `<button class="a" id="cAgain">다시 하기</button>`}<button class="b" id="cHome">마을로</button></div>
      <div class="go"><button class="b" id="cMap">사냥터 지도</button>${canNext ? '<button class="b" id="cAgain">다시 하기</button>' : ''}</div>`;
}

function bindResult(card: HTMLElement, r: RegionId, s: number, ms: Actor[], close: () => void) {
  const on = (id: string, f: () => void) => card.querySelectorAll<HTMLElement>('#' + id).forEach((b) => (b.onclick = f));
  on('cHome', () => close());
  on('cGoReg', () => {
    const to = card.querySelector<HTMLElement>('#cGoReg')?.dataset.reg as RegionId;
    close();
    openHunt(to);
  });
  on('cKeep', () => {
    const err = setAuto(r, s, ms);
    if (err) return toast(err);
    close();
    toast(`맡겨 두기 시작 · ${stageName(r, s)} (${H.autoSeconds}초마다 한 판)`);
  });
  on('cMap', () => {
    close();
    openHunt(r);
  });
  on('cSmith', () => {
    close();
    goSmith();
  });
  on('cAgain', () => {
    close();
    openHuntPrep(r, s);
  });
  card.querySelectorAll<HTMLElement>('[data-stk]').forEach(
    (b) =>
      (b.onclick = () => {
        const k = b.dataset.stk!;
        trackEv('stuck_card', { stage: `${r}-${s}`, pick: k });
        close();
        stuckGo(k, r, s);
      }),
  );
  on('cNext', () => {
    close();
    openHuntPrep(r, s + 1);
  });
}

// ───────── WAYFIND §2: 「막혔을 때」 카드 (그 사람 상태로 계산한 할 수 있는 것 3개) ─────────

const homeObjs = () => world.home?.objs ?? world.objs;
const objOf = (k: string) => bestOf(k as never, homeObjs(), true);
/** 추천 파티 (지금보다 세면) */
function betterParty(r: RegionId, s: number, ms: Actor[]) {
  const best = recommendParty(huntCrew().filter((a) => a.hp >= 1), { power: recPower(r, s), region: r, min: 1, max: huntPartyMax() });
  if (!best) return null;
  const gain = best.power - partyPower(ms);
  return gain > 0 ? { best, gain: Math.round(gain) } : null;
}
export function stuckPicks(r: RegionId, s: number, ms: Actor[]): { k: string; text: string }[] {
  const out: { k: string; text: string }[] = [];
  const bp = betterParty(r, s, ms);
  if (bp) out.push({ k: 'party', text: `추천 파티로 바꾸기 (+${fmt(bp.gain)})` });
  const enh = smithObj() ? enhCount() : 0;
  if (enh) out.push({ k: 'smith', text: `대장간에서 강화할 수 있는 장비 ${enh}개` });
  const rec = recPower(r, s);
  const pw = partyPower(ms);
  if (pw < rec * 0.8) out.push({ k: 'farm', text: `이 판 추천 전투력 ${fmt(rec)} · 지금 ${fmt(pw)} → 다른 지역에서 장비 모으기` });
  if (flag('goldsinkBless') && fLv('chapel') && !blessed()) out.push({ k: 'bless', text: `예배당 축복 (경험치 +${Math.round(blessFxPreview('xp') * 100)}% · 드랍 +${Math.round(blessFxPreview('drop') * 100)}%)` });
  else if (potionCount() > 0 && objOf('alchemy')) out.push({ k: 'potion', text: `가진 물약 ${potionCount()}개 마시고 가기` });
  else if (flag('goldsinkConvert') && objOf('alchemy')) out.push({ k: 'alch', text: '연금술로 재료 사기' });
  return out.slice(0, 3);
}
/** 축복 효과 미리 보기 (안 받았을 때도 숫자를 보여 준다) */
function blessFxPreview(k: 'xp' | 'drop'): number {
  const B = CONFIG.goldsink.bless;
  return blessed() ? blessFx(k) : B[k] + B.perLv * Math.max(0, fLv('chapel') - 1);
}
function stuckHtml(r: RegionId, s: number, ms: Actor[], wasNew: boolean, res: number): string {
  if (!wasNew) return '';
  const lost = losesAt(r, s);
  const rl = res ? `<p class="cen resolve">🔥 ${esc(resolveText(res))}${res < RESOLVE.max ? ' · 또 지면 +1' : ' (최대)'}</p>` : lost > 0 && lost < RESOLVE.after && flag('huntResolve') ? `<p class="note cen">이 판에서 ${RESOLVE.after - lost}번 더 지면 「결의」가 생겨요 (조금씩 강해져요)</p>` : '';
  const bern = res >= 3 ? '<p class="cen momohint"><b>버나드</b> 「몇 번 넘어져도 괜찮네. 넘어질 때마다 발이 기억하는 법이지.」</p>' : '';
  if (!flag('stuckCard')) return rl + bern;
  const picks = stuckPicks(r, s, ms);
  const card = picks.length ? `<div class="stuck"><b>막혔을 때 해 볼 것</b>${picks.map((p) => `<button class="b" data-stk="${p.k}">${esc(p.text)} ›</button>`).join('')}</div>` : '';
  return rl + bern + card;
}
function stuckGo(k: string, r: RegionId, s: number) {
  if (k === 'party') {
    manualPick = false;
    picked = [];
    const bp = recommendParty(huntCrew().filter((a) => a.hp >= 1), { power: recPower(r, s), region: r, min: 1, max: huntPartyMax() });
    if (bp) {
      picked = bp.members.sort((a, b) => powerOf(b) - powerOf(a)).map((m) => m.id);
      manualPick = true;
    }
    return openHuntPrep(r, s);
  }
  if (k === 'smith') return goSmith();
  if (k === 'farm') return openHunt(regionIdx(r) > 0 ? REGIONS[regionIdx(r) - 1].id : r);
  const o = objOf(k === 'bless' ? 'chapel' : 'alchemy');
  if (o) showObj(o);
}

/** 대장간 창 열기 (없으면 안내) */
function goSmith() {
  const o = smithObj();
  if (!o) return toast('대장간이 필요해요');
  openSmith(o);
}

// ───────── 핫픽스 10 §13: 접기 ─────────
foldHooks.fold = () => {
  const fi = foldInfo();
  const fl = foldMembers();
  if (fi) P.hunt.folded = { region: fi.region, stage: fi.stage, members: fl, at: Date.now() };
  markDirty();
  trackEv('hunt_fold', { stage: fi ? `${fi.region}-${fi.stage}` : '' });
  toast('전투를 접었어요 · 마을에서 마저 싸워요 (평가 보너스 없음)');
};
foldHooks.done = (win) => {
  const fi = foldInfo();
  if (!fi) return;
  const nm = `${REGIONS[regionIdx(fi.region)].name} ${stageName(fi.region, fi.stage)}`;
  toast(win ? `${nm} 돌파! · 아래 줄을 눌러 결과 보기` : `${nm} 실패… 전투력을 올려 봐요`);
};
/** 마을 줄을 눌렀을 때: 전투(또는 결과) 다시 펼치기 */
export function unfoldHunt() {
  if (!foldInfo()?.done) P.hunt.folded = null;
  unfoldCombat();
}

/** 접어 둔 채 앱을 껐다 켰을 때: 그 판을 AUTO로 끝까지 돌려 결과를 바로 보여 준다 */
export function settleFolded(): boolean {
  const fo = P.hunt.folded;
  if (!fo) return false;
  P.hunt.folded = null;
  const r = fo.region as RegionId;
  const ms = fo.members.map((id) => huntCrew().find((a) => a.id === id)).filter(Boolean) as Actor[];
  if (!ms.length || !REGIONS.some((x) => x.id === r)) return false;
  const res = runHeadless(r, fo.stage, ms, hvOpts(fo.stage));
  const html = settleHunt(r, fo.stage, ms, res, true);
  openWin('사냥 결과 (접어 둔 판)', `<div class="res huntres">${html}</div>`);
  bindResult($('#winB'), r, fo.stage, ms, closeWin);
  dropFanfare(lastLoot);
  return true;
}

function sweep(r: RegionId, s: number, ms: Actor[]) {
  const out = sweepStage(r, s, ms);
  if (!out) return toast('한 번 깬 스테이지만 소탕할 수 있어요');
  trackEv('hunt_end', { stage: `${r}-${s}`, mode: 'sweep', result: 'win', sec: 0, grade: '' });
  sfx('coin');
  openWin(
    `소탕 · ${stageName(r, s)}`,
    `<p class="sub">전투 없이 바로 결과 · 기본 보상의 ${Math.round(CONFIG.combat.sweep * 100)}%</p>${lootHtml(r, out)}<div class="btnrow"><button class="bigbtn" id="swAgain">한 번 더 소탕</button><button class="bigbtn ghost" id="swBack">준비로</button></div>`,
  );
  dropFanfare(out.items);
  const sm = document.getElementById('cSmith');
  if (sm) sm.onclick = goSmith;
  document.getElementById('swAgain')!.onclick = () => sweep(r, s, ms);
  document.getElementById('swBack')!.onclick = () => openHuntPrep(r, s);
}
