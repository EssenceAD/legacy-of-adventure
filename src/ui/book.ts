// 도감(손님·아이템·케미·영웅 「방랑자의 서」) · 오늘의 목표 · 장부(오늘/이번 주) · 평판
import { CHEM_PAIRS } from '../data/chem';
import { CLASSES, GUEST_KINDS, RACE_NAME, RACES, RARITIES, RARITY_INFO } from '../data/classes';
import { CONFIG } from '../data/config';
import { GOAL_TEMPLATES } from '../data/goals';
import { HERO_SETS, HEROES } from '../data/heroes';
import { GRADE_INFO, OPT_INFO, REGIONS, SLOT_NAME, SLOTS, type Grade } from '../data/items';
import { itemIcon } from '../world/items';
import {
  claimGoal, DEX_REWARDS, monumentUnlocked, dexBonus, dexRatio, ensureGoals, GUEST_DEX_TOTAL, heroStarBonus, heroTitles, ITEM_DEX_TOTAL, repToNext, stars,
} from '../world/progress';
import { markDirty, P, S, world } from '../world/state';
import { LEGENDS } from '../data/legends';
import { HARMONIES } from '../data/harmony';
import { hintLv, hintText, partsText } from '../world/harmony';
import { PORTRAITS } from '../engine/assets';
import { $$, bindTabs, claimOrder, esc, fmt, keepScroll, pct, tabs } from './common';
import { CHEM_TALKS_PER_DAY, chemUnread, readChemNews, title5, ultName5 } from '../world/chemNews';
import { openWin, toast } from './windows';
import { openPlace, type Place } from './nav';

let dTab = 0;

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
  dTab = tab;
  let body = '';
  if (tab === 0) {
    const grid = RACES.map(
      (race) =>
        `<div class="dexrow"><span>${RACE_NAME[race]}</span>${GUEST_KINDS.map((k) =>
          RARITIES.map((rr) => {
            const has = P.dex.guests.includes(`${race}|${k}|${rr}`);
            return `<i class="${has ? 'on' : ''}" style="--c:${RARITY_INFO[rr].color}" title="${has ? `${RACE_NAME[race]} ${CLASSES[k].name} (${RARITY_INFO[rr].name})` : '???'}">${has ? CLASSES[k].name[0] : '?'}</i>`;
          }).join(''),
        ).join('')}</div>`,
    ).join('');
    body = `<p class="sub">손님 도감 ${P.dex.guests.length}/${GUEST_DEX_TOTAL} · 칸마다 전투력 +${pct(CONFIG.dex.guestCellPct, 1)}</p>
      <p class="note">종족 × 직업(${GUEST_KINDS.map((k) => CLASSES[k].name).join('·')}) × 희귀도(평범·특별·전설)</p><div class="dexg">${grid}</div>${rewardsRow('guests')}`;
  } else if (tab === 1) {
    const grades: Grade[] = ['n', 'r', 'e', 'l'];
    const grid = REGIONS.map(
      (r) =>
        `<div class="dexrow"><span style="color:${r.color}">${r.name}</span>${SLOTS.map((s) =>
          [...grades, ...(r.id === 'abyss' ? (['a'] as Grade[]) : [])]
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
      const img = `<img class="lgp ${st ? (st.st === 'joined' ? '' : 'sil') : 'unk'}" src="${PORTRAITS['legend_' + d.key] ?? ''}" alt="">`;
      if (!st) return `<div class="lcard">${img}<b>???</b><small>소문 조건: ${d.rumorText}${P.owner?.linked.includes(d.key) ? " <b class=\"g\">(옛 인연: 70%)</b>" : ""}</small></div>`;
      if (st.st === 'joined') {
        const a = (world.home?.actors ?? world.actors).find((x) => x.legendId === d.key);
        return `<div class="lcard on">${img}<b>${d.title} ${d.name} <span class="g">${'★'.repeat(a?.stars ?? 1)}</span></b><small>${d.charm}</small><small>기술 ${d.skill.name} · 등록 +${Math.round(CONFIG.legends.dexBonus * 100)}%</small></div>`;
      }
      const g = st.gauge;
      return `<div class="lcard rumor">${img}<b>${st.st === 'visit' ? `${d.title} ${d.name} (방문 중!)` : `${d.title} ?`}</b><small>${d.hint}</small><small>인연 활동: ${d.bondText}</small><div class="gauge"><i style="width:${g}%"></i><em>인연 ${g}% · 오늘 밤 방문 ${g >= 100 ? '확정' : `${(g / CONFIG.legends.judgeDiv).toFixed(1)}%`}</em></div></div>`;
    }).join('');
    body = `<p class="sub">전설 ${Object.values(P.legends).filter((l) => l.st === 'joined').length}/${LEGENDS.length} · 인연의 증표 ${P.tokens}개</p><p class="note">소문이 열리면 인연 활동으로 게이지가 차요. 실제 날짜로 하루 한 번, 게임 속 밤 10시에 방문 판정(게이지÷${CONFIG.legends.judgeDiv}%) · 100%면 확정. 밤하늘의 별똥별을 누르면 +1~10%</p><div class="lcards">${cards}</div>`;
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
  } else {
    const cards = HEROES.map((h) => {
      const st = P.dex.heroes[h.id];
      if (!st?.appeared) return `<div class="hcard"><b>???</b><small>힌트: ${h.hint}</small></div>`;
      return `<div class="hcard ${st.recruited ? 'on' : ''}"><b>${h.name} <span class="g">${st.recruited ? '★'.repeat(st.stars) : ''}</span></b><small>「${h.title}」</small><small>${st.recruited ? `기술 ${h.skill.name}: ${OPT_INFO[h.skill.k].label(h.skill.v)} · 등록 보너스 +${Math.round(h.bonus * 100)}%` : `부탁: ${h.request.text}`}</small></div>`;
    }).join('');
    const sets = HERO_SETS.map((s) => {
      const done = s.members.every((m) => P.dex.heroes[m]?.recruited);
      return `<div class="hset ${done ? 'on' : ''}"><b>${s.name}</b> — ${s.members.map((m) => (P.dex.heroes[m]?.appeared ? HEROES.find((h) => h.id === m)!.name : '???')).join(' · ')}<small>${done ? `칭호 「${s.title}」 · +${Math.round(s.bonus * 100)}%` : `모두 모으면 칭호 「${s.title}」`}</small></div>`;
    }).join('');
    const titles = heroTitles();
    body = `<p class="sub">방랑자의 서 · ${Object.values(P.dex.heroes).filter((h) => h.recruited).length}/${HEROES.length} 동료${titles.length ? ` · 칭호 ${titles.join(', ')}` : ''}</p><div class="heroes">${cards}</div>${sets}`;
  }
  openWin(
    '도감',
    `${tabs(['손님', '아이템', '케미', '영웅', '전설', '어울림'], tab, 'dT')}<p class="note">도감 보너스 합 전투력 +${pct(dexBonus() + heroStarBonus(), 1)}</p>${body}`,
  );
  bindTabs('dT', openDex);
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
    <p class="note">평판은 원정 성공·단골·도감 보상으로 올라요 · 땅 넓히기에 필요해요</p>
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
