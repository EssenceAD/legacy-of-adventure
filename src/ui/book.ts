// 도감(손님·아이템·케미·영웅 「방랑자의 서」) · 오늘의 목표 · 장부(오늘/이번 주) · 평판
import { vis } from '../world/visual';
import { CHEM_PAIRS } from '../data/chem';
import { visitText } from '../world/legends';
import { diaryList, diaryOpen } from '../world/diary';
import { mythicProgress } from '../world/mythic';
import { MYTHIC, MYTHIC_GUIDE, MYTHIC_HINT } from '../data/story/mythic';
import { PIONEERS } from '../data/story/easter';
import { PIONEER_IDS } from '../world/easter';
import { bookSteps, claimBook, DROP_KINDS, groupOf, ownedDrops, seasonLock } from '../world/decodrop';
import { tokenNeed } from '../world/legends';
import { heroCtx } from '../world/progress';
import { CLASSES, GUEST_KINDS, RACE_NAME, RACES, RARITIES, RARITY_INFO } from '../data/classes';
import { CONFIG } from '../data/config';
import { GOAL_TEMPLATES } from '../data/goals';
import { HERO_SETS, HEROES } from '../data/heroes';
import { BASE_REGIONS, GRADE_INFO, OPT_INFO, REGIONS, SLOT_NAME, SLOTS, type Grade } from '../data/items';
import { REGION_TITLES } from '../data/story/regions';
import { huntRegionOpen } from '../world/hunt';
import { isStarRegion, regionFirstDone, regionGuideDone, starsHave } from '../world/regions2';
import { itemIcon } from '../world/items';
import { UNIQUES } from '../data/story/uniques';
import { FISH } from '../data/story/fish';
import {
  claimGoal, DEX_REWARDS, monumentUnlocked, dexBonus, dexRatio, ensureGoals, GUEST_DEX_ALL, heroStarBonus, heroTitles, ITEM_DEX_TOTAL, repToNext, stars,
} from '../world/progress';
import { markDirty, P, S, world } from '../world/state';
import { LEGENDS } from '../data/legends';
import { HARMONIES } from '../data/harmony';
import { hintLv, hintText, partsText } from '../world/harmony';
import { PORTRAITS } from '../engine/assets';
import { $$, bindTabs, claimOrder, esc, fmt, keepScroll, pct, tabs } from './common';
import { CHEM_TALKS_PER_DAY, chemUnread, readChemNews, title5, ultName5 } from '../world/chemNews';
import { openWin, thumbOf, toast } from './windows';
import { def } from '../data/catalog';
import { openPlace, type Place } from './nav';
import { SYN_IDS, SYN_INFO } from '../world/synergy';
import { chronPageHtml, contribHtml, fillContrib } from './chronicle';

let dTab = 0;
/** DIRECTION §1-3: 연대기 펼친 쪽 (-1 = 맨 끝 쪽) */
let chPage = -1;
/** 도감 탭 이름들 (여정 지도에서 이름으로 연다) */
export const dexNames = () => ['손님', '아이템', '케미', '영웅', '전설', '어울림', '장식', '신화', ...(P.regions2.scatter ? ['지역'] : []), '고유 장비', '낚시', '파티', '연대기', '함께 만든 사람들'];
/** 이름으로 도감 탭 열기 (없는 탭이면 첫 탭) */
export function openDexTab(name: string, page?: number) {
  if (page != null) chPage = page;
  const i = dexNames().indexOf(name);
  openDex(i < 0 ? 0 : i);
}
/** PARTY §1: 손님 도감 직업 필터 ('' = 전체) */
let gKind = '';

function rewardsRow(book: 'guests' | 'items') {
  const r = dexRatio(book);
  return `<p class="note">100%를 채우면 장식 건물 「유산의 기념비」가 열려요${monumentUnlocked() ? ' · <b class="g">열림! 건설 목록에서 무료</b>' : ''}</p><div class="dexrw">${DEX_REWARDS.filter((x) => x.book === book)
    .map((x) => {
      const got = P.dex.claimed.includes(x.id);
      const ok = r >= x.at;
      return `<button data-rw="${x.id}" ${got || !ok ? 'disabled' : ''} class="${got ? 'got' : ok ? 'ready' : ''}">${x.at * 100}%<small>${got ? '받음' : `${fmt(x.gold)}G`}</small></button>`;
    })
    .join('')}</div>`;
}

export function openDex(tab = dTab) {
  // REGIONS2: 「지역」 칸은 별이 흩어진 뒤부터
  // GROWTH: 「고유 장비」 · 「낚시」 칸은 맨 뒤 (지역 칸이 없을 때도 이름으로 찾는다)
  //  PARTY §2: 「파티」(켜 본 조합 8칸)는 맨 뒤
  //  DIRECTION: 「연대기」(엔딩마다 한 쪽) · 「함께 만든 사람들」은 그 뒤
  const NAMES = dexNames();
  if (tab >= NAMES.length) tab = 0;
  dTab = tab;
  const tname = NAMES[tab];
  let body = '';
  if (tname === '연대기') {
    const n = P.legacy.chron?.length ?? 0;
    if (chPage < 0 || chPage >= n) chPage = n - 1;
    body = `<p class="sub">여관 연대기 · ${n}쪽</p><p class="note">엔딩을 볼 때마다 한 쪽 — 내가 쌓은 시간</p>${chronPageHtml(chPage)}`;
  } else if (tname === '함께 만든 사람들') body = contribHtml();
  else if (tname === '고유 장비') body = uniqueDexHtml();
  else if (tname === '낚시') body = fishDexHtml();
  else if (tname === '파티') body = partyDexHtml();
  else if (tab === 0) {
    const kinds = GUEST_KINDS.filter((k) => !gKind || k === gKind);
    const filt = `<div class="pty-kf">${['', ...GUEST_KINDS].map((k) => `<button data-gk="${k}" class="${k === gKind ? 'on' : ''}">${k ? CLASSES[k as keyof typeof CLASSES].name : '전체'}</button>`).join('')}</div>`;
    const grid = RACES.map(
      (race) =>
        `<div class="dexrow"><span>${RACE_NAME[race]}</span>${kinds.map((k) =>
          RARITIES.map((rr) => {
            const has = P.dex.guests.includes(`${race}|${k}|${rr}`);
            return `<i class="${has ? 'on' : ''}" style="--c:${RARITY_INFO[rr].color}" title="${has ? `${RACE_NAME[race]} ${CLASSES[k].name} (${RARITY_INFO[rr].name})` : '???'}">${has ? CLASSES[k].name[0] : '?'}</i>`;
          }).join(''),
        ).join('')}</div>`,
    ).join('');
    body = `<p class="sub">손님 도감 ${P.dex.guests.length}/${GUEST_DEX_ALL} · 칸마다 전투력 +${pct(CONFIG.dex.guestCellPct, 1)}</p>
      <p class="note">종족 × 직업(${GUEST_KINDS.map((k) => CLASSES[k].name).join('·')}) × 희귀도(평범·특별·전설) · 보상 비율은 처음 다섯 직업 칸으로</p>${filt}<div class="dexg">${grid}</div>${rewardsRow('guests')}${diaryBlock()}`;
  } else if (tab === 1) {
    const grades: Grade[] = ['n', 'r', 'e', 'l'];
    // REGIONS2: 새 지역 줄은 열린 뒤에만 · 유물 칸은 유물이 있는 지역 (별의 심연 · 심연의 바닥)
    const grid = REGIONS.filter((_, i) => i < BASE_REGIONS || huntRegionOpen(i)).map(
      (r) =>
        `<div class="dexrow"><span style="color:${r.color}">${r.name}</span>${SLOTS.map((s) =>
          [...grades, ...(r.relic ? (['a'] as Grade[]) : [])]
            .map((g) => {
              const has = P.dex.items.includes(`${r.id}|${s}|${g}`);
              return has
                ? `<img src="${itemIcon({ slot: s, grade: g, region: r.id })}" alt="" title="${GRADE_INFO[g].name} ${SLOT_NAME[s]}">`
                : `<i title="???">?</i>`;
            })
            .join(''),
        ).join('')}</div>`,
    ).join('');
    body = `<p class="sub">아이템 도감 ${P.dex.items.length}/${ITEM_DEX_TOTAL} · 칸마다 전투력 +${pct(CONFIG.dex.itemCellPct, 1)}</p><div class="dexg items">${grid}</div>${rewardsRow('items')}`;
  } else if (tab === 2) {
    const rows = CHEM_PAIRS.map((p) => {
      const found = P.dex.chem.includes(p.id);
      const best = Math.max(0, ...Object.values(P.bonds).filter((b) => b.pair === p.id).map((b) => b.lv));
      const name = found || p.open ? p.name : '???';
      const got5 = P.chem5.includes(p.id);
      return `<div class="chemrow ${found ? 'on' : ''}"><b>${name}</b><small>${found ? `${p.hint} · 최고 ${'♥'.repeat(best)}` : p.open ? p.hint : '마을이나 원정에서 우연히 발견돼요'}</small>${found || p.open ? `<small class="r5 ${got5 ? 'got' : ''}">5단계 보상: 합동 오의 「${esc(ultName5(p))}」 · 칭호 「${esc(title5(p))}」${got5 ? ' ✓' : ''}</small>` : ''}</div>`;
    }).join('');
    body = `<p class="sub">케미 ${P.dex.chem.length}/${CHEM_PAIRS.length} 발견 · 같이 원정 가면 친밀도 단계 × ${pct(CONFIG.chem.partyBonusPerLevel)}</p><div class="chems">${rows}</div>`;
  } else if (tab === 4) {
    // 전설 14: ??? → 소문(실루엣·힌트·게이지) → 방문 → 동료
    const cards = LEGENDS.map((d) => {
      const st = P.legends[d.key];
      // STARFALL §3: 못 만난 영웅은 검은 실루엣 · 게이지가 오를수록 0·30·60·90% 네 단계로 밝아진다
      const lit = st && st.st !== 'joined' ? `b${Math.min(3, Math.floor((st.gauge ?? 0) / 30))}` : '';
      const img = `<img class="lgp ${st ? (st.st === 'joined' ? '' : `sil ${lit}`) : 'unk'}" src="${PORTRAITS['legend_' + d.key] ?? ''}" alt="">`;
      if (!st) return `<div class="lcard">${img}<b>???</b><small>${d.hint}</small><small class="cond">소문 조건: ${d.rumorText}${P.owner?.linked.includes(d.key) ? " <b class=\"g\">(옛 인연: 70%)</b>" : ""}</small></div>`;
      if (st.st === 'joined') {
        const a = (world.home?.actors ?? world.actors).find((x) => x.legendId === d.key);
        const need = tokenNeed(a?.stars ?? 1);
        return `<div class="lcard on">${img}<b>${d.title} ${d.name} <span class="g">${'★'.repeat(a?.stars ?? 1)}</span></b><small>${need == null ? '★5 완성!' : `다음 별까지 증표 ${need} (가진 것 ${P.tokens})`}</small><small>${d.charm}</small><small>기술 ${d.skill.name} · 등록 +${Math.round(CONFIG.legends.dexBonus * 100)}%</small></div>`;
      }
      const g = st.gauge;
      return `<div class="lcard rumor">${img}<b>${st.st === 'visit' ? `${d.title} ${d.name} (방문 중!)` : `${d.title} ?`}</b><small>${d.hint}</small><small>인연 활동: ${d.bondText}</small><div class="gauge"><i style="width:${g}%"></i><em>인연 ${g}% · ${st.st === 'visit' ? '방문 중' : visitText(d.key)}</em></div></div>`;
    }).join('');
    body = `<p class="sub">전설 ${Object.values(P.legends).filter((l) => l.st === 'joined').length}/${LEGENDS.length} · 인연의 증표 ${P.tokens}개</p><p class="note">소문이 열리면 인연 활동으로 게이지가 차요. 실제 날짜로 하루 한 번, 게임 속 밤 10시에 방문 판정(게이지÷${CONFIG.legends.judgeDiv}%) · 100%면 확정. 밤하늘의 별똥별을 누르면 +1~10%</p><div class="lcards">${cards}</div>`;
  } else if (tab === 6) {
    // DECO_DROP §3: 장식 도감 — 가진 적 있으면 컬러, 없으면 실루엣 + 열리는 조건 · 10·20·41종 보상
    const own = new Set<string>(ownedDrops());
    const cells = DROP_KINDS.map((k) => {
      const d = def(k);
      const has = own.has(k);
      const cond = seasonLock(k) ? '겨울에 열려요' : d.unlock > S.land ? `땅 ${d.unlock}단계` : `${d.cost.toLocaleString('ko-KR')} G`;
      return `<div class="dcell ${has ? 'on' : ''}"><img src="${thumbOf(k)}" alt=""><b>${has ? esc(d.name) : '???'}</b><small>${has ? groupOf(k) : cond}</small></div>`;
    }).join('');
    const steps = bookSteps().map((b) => `<div class="dstep ${b.got ? 'got' : ''}"><span>${b.n}종 모으기 · 💰${b.gold.toLocaleString('ko-KR')}${b.title ? ` · 칭호 「${esc(b.title)}」` : ''}</span>${b.got ? '<button disabled>받음</button>' : `<button data-db="${b.i}" ${b.done ? '' : 'disabled'}>받기</button>`}</div>`).join('');
    body = `<p class="sub">장식 ${own.size}/${DROP_KINDS.length}종 · 건설 → 장식에서 사요</p><div class="dsteps">${steps}</div><div class="dgrid">${cells}</div>`;
  } else if (tab === 7) {
    // MYTHIC: 신화 9명 — 씨앗 전엔 실루엣 · 씨앗이면 「다음 여관에서」 · 만나면 칭호·스킬·부탁·열쇠 조각
    const seeds = P.legacy.mythicSeeds ?? [];
    const cells = MYTHIC.map((m) => {
      const L = LEGENDS.find((l) => l.key === m.key);
      const st = P.story.mythic?.[m.key];
      if (st?.met) {
        const [n, goal] = mythicProgress(m.key);
        return `<div class="mcell met"><b>${esc(L?.name ?? m.key)} · ${esc(m.title)}</b><small>✦ ${esc(m.skill.name)} — ${esc(m.skill.desc)}</small><small>${st.done ? '✓ ' : ''}부탁: ${esc(m.request.text)} (${Math.min(n, goal)}/${goal})</small>${st.done ? `<small class="g">열쇠 조각 「${esc(m.shard)}」</small>` : ''}</div>`;
      }
      if (seeds.includes(m.key)) return `<div class="mcell seed"><b>${esc(L?.name ?? m.key)}</b><small>기억의 씨앗 · 다음 여관에서 신화로 찾아와요</small></div>`;
      return `<div class="mcell"><b>${esc(L?.name ?? '???')}</b><small>???</small></div>`;
    }).join('');
    body = `${vis('mythicGuide') ? `<p class="mythgd">${esc(MYTHIC_GUIDE)}</p>` : ''}<p class="sub">신화 ${MYTHIC.filter((m) => P.story.mythic?.[m.key]?.met).length}/${MYTHIC.length} · 열쇠 조각 ${(P.legacy.shards ?? []).length}개</p><p class="note">${esc(MYTHIC_HINT)}</p><div class="mythgrid">${cells}</div>`;
  } else if (tab === 5) {
    // 베타 1장: 어울림 24칸 — 발견한 것은 구성·효과, 아직은 ???와 힌트
    const cells = HARMONIES.map((h) => {
      const found = P.harmony.found.includes(h.id);
      const lv = hintLv(h);
      if (found) return `<div class="hcell on"><em>${h.id}</em><b>${h.name}</b><small>${partsText(h)}</small><small class="g">${h.text}</small></div>`;
      if (h.open) return `<div class="hcell open"><em>${h.id}</em><b>${h.name}</b><small>${partsText(h)}</small><small>${h.text}</small></div>`;
      return `<div class="hcell"><em>${h.id}</em><b>???</b><small>${hintText(h)}</small><small class="lv">힌트 ${'●'.repeat(lv)}${'○'.repeat(3 - lv)}</small></div>`;
    }).join('');
    body = `<p class="sub">어울림 ${P.harmony.found.length}/${HARMONIES.length} 발견 · 건물·장식이 서로 ${CONFIG.harmony.range}칸 안에 모이면 생겨요</p><p class="note">숨은 어울림 힌트는 하루에 하나씩 더 또렷해져요 · 한 건물에 최대 ${CONFIG.harmony.perBuilding}개</p><div class="hgrid">${cells}</div>`;
  } else if (tname === '지역') {
    // REGIONS2 §5-7: 지역 칸 — 열린 지역은 이름·재료·세트 · 첫 발자국 · 길잡이 (한 줄씩)
    const cells = REGIONS.slice(BASE_REGIONS).map((r, k) => {
      const i = BASE_REGIONS + k;
      const T = REGION_TITLES[r.id as keyof typeof REGION_TITLES];
      if (!huntRegionOpen(i)) return `<div class="hcell"><em>${i + 1}</em><b>???</b><small>${r.id === 'deep' ? '길잡이 별 넷이 가리키는 곳' : '별 하나가 떨어진 땅'}</small></div>`;
      const f = regionFirstDone(r.id);
      const g = regionGuideDone(r.id);
      return `<div class="hcell on"><em>${i + 1}</em><b style="color:${r.color}">${esc(r.name)}</b><small>${esc(r.mat)} · 세트 「${esc(r.set.name)}」${r.relic ? ` · 유물 「${esc(r.relic)}」` : ''}</small><small class="${f ? 'g' : ''}">${f ? '✓' : '·'} 첫 발자국 — ${esc(T.first)}</small><small class="${g ? 'g' : ''}">${g ? '✓' : '·'} ${isStarRegion(r.id) ? '길잡이 별' : '별을 삼킨 것'} — ${esc(T.guide)}</small></div>`;
    }).join('');
    body = `<p class="sub">지역 · 길잡이 별 ${starsHave()}/4</p><p class="note">별의 심연에서 튕겨 나간 별 넷 — 별이 떨어진 땅마다 보스를 쓰러뜨리면 길잡이 별을 얻어요</p><div class="hgrid">${cells}</div>`;
  } else {
    // HOTFIX14 §6: 의뢰 게시판 조건은 진행 수 + [의뢰 게시판 가기]
    const hc = heroCtx();
    const progOf = (f?: (c: typeof hc) => [number, number]) => (f ? `(${Math.min(f(hc)[0], f(hc)[1])}/${f(hc)[1]})` : '');
    const boardBtn = '<button class="bigbtn sm ghost" data-goboard>의뢰 게시판 가기</button>';
    const cards = HEROES.map((h) => {
      const st = P.dex.heroes[h.id];
      if (!st?.appeared) return `<div class="hcard"><b>???</b><small>힌트: ${h.hint}</small>${h.appearText ? `<small>등장: ${h.appearText} ${progOf(h.appearProg)}</small>${boardBtn}` : ''}</div>`;
      return `<div class="hcard ${st.recruited ? 'on' : ''}"><b>${h.name} <span class="g">${st.recruited ? '★'.repeat(st.stars) : ''}</span></b><small>「${h.title}」</small><small>${st.recruited ? `기술 ${h.skill.name}: ${OPT_INFO[h.skill.k].label(h.skill.v)} · 등록 보너스 +${Math.round(h.bonus * 100)}%` : `부탁: ${h.request.text} ${progOf(h.request.prog)}`}</small>${!st.recruited && h.request.prog ? boardBtn : ''}</div>`;
    }).join('');
    const sets = HERO_SETS.map((s) => {
      const done = s.members.every((m) => P.dex.heroes[m]?.recruited);
      return `<div class="hset ${done ? 'on' : ''}"><b>${s.name}</b> — ${s.members.map((m) => (P.dex.heroes[m]?.appeared ? HEROES.find((h) => h.id === m)!.name : '???')).join(' · ')}<small>${done ? `칭호 「${s.title}」 · +${Math.round(s.bonus * 100)}%` : `모두 모으면 칭호 「${s.title}」`}</small></div>`;
    }).join('');
    const titles = heroTitles();
    // EASTER §3: 영웅 탭 맨 아래 「개척자」 — 카메오로 만나면 밝아진다
    const met = new Set(P.meta.easter?.met ?? []);
    const pioneerBox = `<p class="sub g">개척자</p><div class="pion">${PIONEER_IDS.map((id) => `<div class="pcell ${met.has(id) ? 'on' : ''}"><img src="${PORTRAITS['p_' + id] ?? ''}" alt=""><span><b>${esc(PIONEERS[id].name)}</b><small>「${esc(PIONEERS[id].title)}」</small><small>${esc(PIONEERS[id].intro)}</small></span></div>`).join('')}</div>`;
    body = `<p class="sub">방랑자의 서 · ${Object.values(P.dex.heroes).filter((h) => h.recruited).length}/${HEROES.length} 동료${titles.length ? ` · 칭호 ${titles.join(', ')}` : ''}</p><div class="heroes">${cards}</div>${sets}`;
    body += pioneerBox;
  }
  openWin(
    '도감',
    `${tabs(NAMES, tab, 'dT')}<p class="note">도감 보너스 합 전투력 +${pct(dexBonus() + heroStarBonus(), 1)}</p>${body}`,
  );
  // PARTY §1: 손님 도감 직업 필터
  $$('[data-gk]').forEach((b) => (b.onclick = () => keepScroll(() => {
    gKind = (b as HTMLElement).dataset.gk ?? '';
    openDex(0);
  })));
  bindTabs('dT', openDex);
  // DIRECTION §1-3: 연대기 넘기기 · §2-2 함께 만든 사람들 채우기
  $$('[data-chp]').forEach((b) => (b.onclick = () => {
    chPage = +b.dataset.chp!;
    openDex(tab);
  }));
  if (tname === '함께 만든 사람들') void fillContrib();
  $$('[data-db]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimBook(+b.dataset.db!);
        if (r) toast(`장식 도감 보상 +💰${r.gold.toLocaleString('ko-KR')}${r.title ? ` · 칭호 「${r.title}」` : ''}`);
        openDex(6);
      }),
  );
  $$('[data-rw]').forEach(
    (b) =>
      (b.onclick = () => {
        const rw = DEX_REWARDS.find((x) => x.id === b.dataset.rw)!;
        if (P.dex.claimed.includes(rw.id)) return;
        P.dex.claimed.push(rw.id);
        S.gold += rw.gold;
        if ('rep' in rw) P.rep += rw.rep;
        if ('dust' in rw) P.dust.n += rw.dust;
        markDirty();
        toast(`도감 보상 · 금화 +${fmt(rw.gold)}`);
        openDex(tab);
      }),
  );
}

// ───────── GROWTH §3-4 고유 장비 · §4 낚시 ─────────

function uniqueDexHtml(): string {
  const cells = REGIONS.filter((r) => UNIQUES.some((u) => u.region === r.id))
    .map(
      (r) =>
        `<div class="qhd"><b style="color:${r.color}">${esc(r.name)}</b></div><div class="uqgrid">${UNIQUES.filter((u) => u.region === r.id)
          .map((u) => {
            const n = P.growth.uniques[u.id] ?? 0;
            if (!n) return `<div class="uqcell sil"><img src="${itemIcon({ slot: u.slot, grade: 'a', region: u.region as never, wkind: u.wkind })}" alt=""><b>???</b><small>${SLOT_NAME[u.slot]}</small></div>`;
            return `<div class="uqcell on"><img src="${itemIcon({ slot: u.slot, grade: 'a', region: u.region as never, wkind: u.wkind })}" alt=""><b>${esc(u.name)}</b><small>「${esc(u.lore)}」</small><small class="g">${OPT_INFO[u.opt.k].label(u.opt.v, r.name)}${u.special ? ' · ' + esc(u.special.text) : ''}</small>${n > 1 ? `<small>×${n}</small>` : ''}</div>`;
          })
          .join('')}</div>`,
    )
    .join('');
  const got = UNIQUES.filter((u) => (P.growth.uniques[u.id] ?? 0) > 0).length;
  return `<p class="sub">고유 장비 ${got}/${UNIQUES.length}</p><p class="note">지역 사냥 보스(x-10) 0.5% · 토벌 보스 처치 1% · 고지역 8시간 원정 0.3% · 같은 것 두 번째부터는 분해 가루 2배</p>${cells}`;
}

function fishDexHtml(): string {
  const F = P.growth.fish;
  const cell = (fd: (typeof FISH)[number]) => {
    const r = F.rec[fd.id];
    const g = { n: '흔함', r: '희귀', e: '영웅', l: '전설' }[fd.grade];
    if (!r?.n) return `<div class="fcell sil"><img src="${import.meta.env.BASE_URL}assets/fish/${fd.id}.png" alt=""><b>???</b><small>${g}${fd.time ? ' · ' + { day: '낮', night: '밤', dawn: '새벽' }[fd.time] : ''}</small></div>`;
    return `<div class="fcell on g${fd.grade}"><img src="${import.meta.env.BASE_URL}assets/fish/${fd.id}.png" alt=""><b>${esc(fd.name)}</b><small>${g} · ${r.n}마리 · 최대 ${r.max}cm</small><small class="lore">${esc(fd.text)}</small></div>`;
  };
  let big: { name: string; size: number } | null = null;
  for (const fd of FISH) {
    const m = F.rec[fd.id]?.max ?? 0;
    if (m > (big?.size ?? 0)) big = { name: fd.name, size: m };
  }
  const n = FISH.filter((x) => (F.rec[x.id]?.n ?? 0) > 0).length;
  return `<p class="sub">낚시 ${n}/${FISH.length}종${big ? ` · 최대어 <b class="g">${esc(big.name)} ${big.size}cm</b>` : ''}</p><p class="note">잉어·연꽃 연못을 누르면 낚시 · 「가라앉은 등대 해안」이 열리면 사냥터 🎣 해안 낚시</p>
  <div class="qhd"><b class="g">마을 연못</b></div><div class="fgrid">${FISH.filter((x) => x.where === 'pond').map(cell).join('')}</div>
  <div class="qhd"><b class="g">등대 해안</b></div><div class="fgrid">${FISH.filter((x) => x.where === 'sea').map(cell).join('')}</div>`;
}

// ───────── 오늘의 목표 ─────────

export function openGoals() {
  ensureGoals();
  // 핫픽스 11 §9-1: 받을 수 있는 목표가 맨 위 · 받은 건 맨 아래 (data-g는 원래 번호)
  const order = claimOrder(
    P.goals.list.map((g, i) => ({ g, i })),
    ({ g }) => ({ ready: g.progress >= g.target && !g.claimed, got: g.claimed, ratio: g.progress / Math.max(1, g.target) }),
  );
  const ready = order.filter(({ g }) => g.progress >= g.target && !g.claimed).map(({ i }) => i);
  const rows = order
    .map(({ g, i }) => {
      const t = GOAL_TEMPLATES.find((x) => x.id === g.id)!;
      const done = g.progress >= g.target;
      return `<div class="goal ${g.claimed ? 'got' : ''}"><span><b>${t.text(g.target)}</b><small>${g.progress}/${g.target} · 보상 ${fmt(t.reward.gold)}G${t.reward.dust ? ` + 잿빛 가루 ${t.reward.dust}` : ''} · 평판 +${CONFIG.reputation.goal}</small></span>${done || g.claimed ? `<button data-g="${i}" ${g.claimed ? 'disabled' : ''}>${g.claimed ? '받음' : '받기'}</button>` : `<button class="go" data-go="${t.go}">가기 ›</button>`}</div>`;
    })
    .join('');
  const s = stars();
  openWin(
    '오늘의 목표',
    `<p class="sub">평판 <b class="g">${'★'.repeat(s)}${'☆'.repeat(5 - s)}</b> (${fmt(P.rep)}점${repToNext() ? ` · 다음 별까지 ${repToNext()}` : ''})</p>
    <p class="note">평판은 의뢰 성공·단골·도감 보상으로 올라요 · 땅 넓히기에 필요해요</p>
    ${ready.length >= 2 ? `<button class="bigbtn sm claimall" id="gAll">모두 받기 (${ready.length})</button>` : ''}<div class="goals">${rows}</div><p class="note">목표는 매일 새로 바뀌어요</p>`,
  );
  const ga = document.getElementById('gAll');
  if (ga)
    ga.onclick = () => {
      let gold = 0;
      for (const i of ready) gold += claimGoal(i)?.gold ?? 0;
      markDirty();
      toast(`목표 ${ready.length}개 달성 · 금화 +${fmt(gold)}`);
      keepScroll(openGoals);
    };
  $$('[data-go]').forEach((b) => (b.onclick = () => openPlace(b.dataset.go as Place)));
  $$('[data-g]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimGoal(+b.dataset.g!);
        if (!r) return;
        markDirty();
        toast(`목표 달성 · 금화 +${fmt(r.gold)}`);
        keepScroll(openGoals);
      }),
  );
}

// ───────── 장부 ─────────

let lTab = 0;
export function openLedger(tab = lTab) {
  lTab = tab;
  const L = S.ledger;
  let body: string;
  if (tab === 0) {
    const rows: [string, number, string][] = [
      ['숙박', L.sleep, '#e8a23a'],
      ['주점', L.drink, '#e8a23a'],
      ['대장간', L.forge, '#e8a23a'],
      ['온천', L.bath, '#e8a23a'],
      ['노점', L.stall ?? 0, '#e8a23a'],
      ['원정', L.dungeon, '#9a7aff'],
    ];
    const max = Math.max(1, ...rows.map((r) => r[1]));
    const total = rows.reduce((s, r) => s + r[1], 0);
    body = `<p class="sub">${S.day}일차 · 오늘의 수입</p>${rows
      .map(([n, v, c]) => `<div class="bar"><span>${n}</span><i><b style="width:${Math.round((v / max) * 100)}%;background:${c}"></b></i><em>${fmt(v)}</em></div>`)
      .join('')}<p class="ledger-total">합계 ${fmt(total)} G</p><p class="note">아침 6시가 되면 새 장부가 시작돼요</p>`;
  } else if (tab === 2) {
    // 핫픽스 12 §6: 대화창 대신 모아 둔 케미 소식
    const list = P.chemNews.list;
    const unread = P.chemNews.unread;
    body = `<p class="sub">마을에서 만나 오른 친밀도와 하루 ${CHEM_TALKS_PER_DAY}번을 넘긴 케미 이야기가 여기 모여요 · 설정에서 「케미 알림」을 바꿀 수 있어요</p>${
      list.length ? `<div class="chemnews">${list.map((n, i) => `<div class="${i < unread ? 'new' : ''}">${esc(n.text)}<small>${ago(n.t)}</small></div>`).join('')}</div>` : '<p class="note">아직 소식이 없어요</p>'
    }`;
    readChemNews();
  } else {
    const days = P.week.slice(-7);
    const max = Math.max(1, ...days.map((d) => d.gold));
    const total = days.reduce((s, d) => s + d.gold, 0);
    body = days.length
      ? `<p class="sub">지난 ${days.length}일</p>${days
          .map((d) => `<div class="bar"><span>${d.day}일차</span><i><b style="width:${Math.round((d.gold / max) * 100)}%;background:#e8a23a"></b></i><em>${fmt(d.gold)}</em></div>`)
          .join('')}<p class="ledger-total">이번 주 합계 ${fmt(total)} G · 하루 평균 ${fmt(total / days.length)} G</p>`
      : '<p class="note">하루가 지나면 이번 주 장부가 쌓여요</p>';
  }
  openWin('장부', `${tabs(['오늘', '이번 주', `케미 소식${tab !== 2 && chemUnread() ? ' <i class="tdot"></i>' : ''}`], tab, 'lT')}${body}`);
  bindTabs('lT', openLedger);
}

/** 핫픽스 12 §6: 「3분 전」 */
function ago(t: number): string {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
}

/** STORY v2: 손님 일기 (서재 Lv3+) — 펼친 장만 */
function diaryBlock(): string {
  const ds = diaryList();
  if (!diaryOpen() && !ds.length) return '<p class="note">서재 Lv3부터 단골들의 「손님 일기」를 모을 수 있어요</p>';
  return `<h4>손님 일기 ${ds.length}권</h4>${ds.length ? ds.map((d) => `<details class="diary" data-dk="${esc(d.key)}"><summary>${esc(d.title)} <small>${d.pages.length}/${d.total}장</small></summary>${d.pages.map((p, i) => `<p><b>${i + 1}.</b> ${esc(p.replace(/\{inn\}/g, S.innName || '여관'))}</p>`).join('')}</details>`).join('') : '<p class="note">단골끼리 케미가 오르면 일기가 한 장씩 나와요</p>'}`;
}

/** PARTY §2: 도감 「파티」 — 켜 본 조합 8칸 (조건은 늘 보이고, 켜 본 칸은 효과까지) */
function partyDexHtml(): string {
  const seen = P.dex.syn ?? [];
  const cells = SYN_IDS.map((id) => {
    const i = SYN_INFO[id];
    const on = seen.includes(id);
    return `<div class="pty-dex${on ? ' on' : ''}" data-syn="${id}"><i>${on ? i.icon : '?'}</i><b>${on ? esc(i.name) : '???'}</b><small>${esc(i.cond)}</small>${on ? `<small class="g">${esc(i.eff)}</small>` : ''}</div>`;
  }).join('');
  return `<p class="sub">파티 조합 ${seen.filter((x) => (SYN_IDS as string[]).includes(x)).length}/${SYN_IDS.length} · 사냥·토벌·원정에 그 조합으로 가면 기록돼요</p><p class="note">여러 개가 함께 켜지고(합산), 케미 짝 보너스와도 따로 더해져요</p><div class="pty-dexg">${cells}</div>`;
}
