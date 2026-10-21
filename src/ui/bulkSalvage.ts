// HOTFIX14 §2: 등급별 일괄 분해 창 + 자동 분해 등급 고르기 (가방 · 대장간 분해 탭 · 설정에서 같이 씀)
//  · 등급 체크(기본 일반만) · 등급마다 「개수 · 얻을 가루」 · 끼운 것·잠금은 늘 빠짐 · 강화·세트는 「포함」 체크 때만
//  · 부위별 최고 장비 1개 남기기(기본 켬) · 전설·유물이 있으면 빨간 버튼 + 경고 · confirm() 대신 두 번 누르기
import { CONFIG } from '../data/config';
import { DUST_NAME, GRADE_INFO, type Grade } from '../data/items';
import { bulkExSkipped, bulkPreview, bulkTargets, salvageBulk } from '../world/craft';
import { markDirty, P } from '../world/state';
import { $, $$, fmt } from './common';
import { openWin, toast } from './windows';
import { confirmSheet } from './confirmSheet';
import { fsay, vis } from '../world/visual';

const GRADES: Grade[] = ['n', 'r', 'e', 'l', 'a'];
let armed = false;

export function openBulkSalvage(back: () => void) {
  const pref = P.salvage;
  const grades = new Set(pref.grades as Grade[]);
  const opts = { upgraded: pref.upgraded, keepBest: pref.keepBest };
  const pv = bulkPreview(GRADES, opts);
  const sel = GRADES.filter((g) => grades.has(g));
  const total = sel.reduce((s, g) => s + pv[g].n, 0);
  const rare = sel.filter((g) => (g === 'l' || g === 'a') && pv[g].n > 0);
  const rows = GRADES.map(
    (g) =>
      `<label class="tog bulkg ${pv[g].n ? '' : 'zero'}"><input type="checkbox" data-g="${g}" ${grades.has(g) ? 'checked' : ''}> <b style="color:${GRADE_INFO[g].color}">${GRADE_INFO[g].name}</b> <span>${pv[g].n}개 · ${DUST_NAME[g]} +${fmt(pv[g].dust)}${pv[g].ash ? ` · ${DUST_NAME.n} +${fmt(pv[g].ash)}` : ''}</span></label>`,
  ).join('');
  openWin(
    '일괄 분해',
    `<p class="sub">끼운 장비와 🔒 잠근 장비는 빠져요${bulkExSkipped() ? ` · 전용 무기 ${bulkExSkipped()}자루는 빠져요` : ''}</p>
    <div class="bulk">${rows}</div>
    <label class="tog"><input type="checkbox" id="bkBest" ${opts.keepBest ? 'checked' : ''}> 부위별 최고 장비 1개 남기기 (무기·갑옷·장신구)</label>
    <label class="tog"><input type="checkbox" id="bkUp" ${opts.upgraded ? 'checked' : ''}> 강화·세트 장비도 포함</label>
    <p class="sub">합계 <b class="g">${total}개</b> · ${totalLine(sel, pv) || '얻을 가루 없음'}</p>
    ${rare.length ? `<p class="sub bad">⚠ ${rare.map((g) => `${GRADE_INFO[g].name} ${pv[g].n}개`).join(' · ')} 포함</p>` : ''}
    <button class="bigbtn ${rare.length ? 'red' : ''}" id="bkGo" ${total ? '' : 'disabled'}>${armed ? '한 번 더 누르면 분해' : `분해하기 (${total}개)`}</button>`,
  );
  const save = () => {
    pref.grades = GRADES.filter((g) => grades.has(g));
    pref.upgraded = ($('#bkUp') as HTMLInputElement).checked;
    pref.keepBest = ($('#bkBest') as HTMLInputElement).checked;
    markDirty();
    armed = false;
    openBulkSalvage(back);
  };
  $$('[data-g]').forEach(
    (b) =>
      ((b as HTMLInputElement).onchange = () => {
        if ((b as HTMLInputElement).checked) grades.add(b.dataset.g as Grade);
        else grades.delete(b.dataset.g as Grade);
        save();
      }),
  );
  ($('#bkUp') as HTMLInputElement).onchange = save;
  ($('#bkBest') as HTMLInputElement).onchange = save;
  $('#bkGo').onclick = async () => {
    // J4 confirmSheet: 두 번 누르기 대신 아래 확인 시트 하나
    if (vis('confirmSheet')) {
      const warn = rare.length ? `\n⚠${rare.map((g) => `${GRADE_INFO[g].name} ${pv[g].n}개`).join(' · ')} 포함` : '';
      if (!(await confirmSheet({ title: `장비 ${total}개를 분해할까요?`, body: (totalLine(sel, pv) || '얻을 가루 없음') + warn, ok: '분해하기', danger: true }))) return;
    } else if (!armed) {
      armed = true;
      return openBulkSalvage(back);
    }
    armed = false;
    const r = salvageBulk(sel, opts);
    const parts = GRADES.filter((g) => r.dust[g]).map((g) => `${DUST_NAME[g].replace(' 가루', '')} +${fmt(r.dust[g]!)}`);
    toast(r.count ? `${r.count}개 ${fsay('분해', '분해해 드렸어요')} · ${parts.join(' · ')}` : '분해할 장비가 없어요');
    back();
  };
}

/** 자동 분해 고르기 (가방이 차면): 끔 / 일반 / 희귀 이하 — 영웅 이상은 고를 수 없음 */
export const autoSalvageHtml = (id: string) => {
  const cur = P.salvage.auto || (P.autoSalvage ? 'n' : '');
  return `<label class="tog">가방이 차면 자동 분해 <select id="${id}">${[['', '끔'], ['n', '일반'], ['r', '희귀 이하']].map(([v, t]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
};
export function bindAutoSalvage(id: string) {
  const s = document.getElementById(id) as HTMLSelectElement | null;
  if (!s) return;
  s.onchange = () => {
    P.salvage.auto = s.value as '' | 'n' | 'r';
    P.autoSalvage = s.value !== '';
    markDirty();
  };
}

/** HOTFIX21: 합계 — 등급 가루 + 희귀 이상에서 같이 나오는 잿빛 가루를 합쳐서 */
function totalLine(sel: Grade[], pv: ReturnType<typeof bulkPreview>): string {
  const sum: Partial<Record<Grade, number>> = {};
  for (const g of sel) {
    if (!pv[g].n) continue;
    sum[g] = (sum[g] ?? 0) + pv[g].dust;
    if (pv[g].ash) sum.n = (sum.n ?? 0) + pv[g].ash;
  }
  return GRADES.filter((g) => sum[g]).map((g) => `${DUST_NAME[g]} +${fmt(sum[g]!)}`).join(' · ');
}

// ───────── v0.25.4 CHECKIN §C5 가방 「일반·희귀 한 번에」 (플래그 bulkTidy · 실험실) ─────────
//  가방에서 두 번: [일반·희귀 한 번에 분해 (n개)] → 확인 창 [분해하기]
//  끼운 것 · 🔒 잠금 · 강화·세트는 늘 빠짐 · 「부위별 최고 1개 남기기」는 일괄 분해 창에서 고른 그대로 · 자동 분해 설정은 건드리지 않음
//  (팔기는 아직 없는 기능이라 분해만)
const TIDY: Grade[] = ['n', 'r'];
const tidyOpts = () => ({ upgraded: false, keepBest: P.salvage.keepBest });
export const tidyCount = () => bulkTargets(TIDY, tidyOpts()).length;
/** 가방 창 버튼 (0개면 회색) */
export const tidyBtnHtml = () => {
  const n = tidyCount();
  return `<button class="bigbtn sm" id="bagTidy" ${n ? '' : 'disabled'}>일반·희귀 한 번에 분해 (${n}개)</button>`;
};
export function openTidyConfirm(back: () => void) {
  const pv = bulkPreview(TIDY, tidyOpts());
  const n = TIDY.reduce((s, g) => s + pv[g].n, 0);
  if (!n) return toast('한 번에 분해할 일반·희귀 장비가 없어요');
  openWin(
    '한 번에 분해',
    `<div class="bulk">${TIDY.filter((g) => pv[g].n)
      .map((g) => `<div class="tog bulkg"><b style="color:${GRADE_INFO[g].color}">${GRADE_INFO[g].name}</b> <span>${pv[g].n}개 · ${DUST_NAME[g]} +${fmt(pv[g].dust)}${pv[g].ash ? ` · ${DUST_NAME.n} +${fmt(pv[g].ash)}` : ''}</span></div>`)
      .join('')}</div>
    <p class="note">끼운 장비 · 🔒 잠근 장비 · 강화·세트 장비 · 전용 무기는 빠져요${P.salvage.keepBest ? ' · 부위별 최고 장비 1개는 남겨요' : ''}</p>
    <div class="btnrow"><button class="bigbtn ghost" id="tdBack">돌아가기</button><button class="bigbtn red" id="tdGo">분해하기 (${n}개)</button></div>`,
  );
  $('#tdBack').onclick = back;
  $('#tdGo').onclick = () => {
    const r = salvageBulk(TIDY, tidyOpts());
    const parts = GRADES.filter((g) => r.dust[g]).map((g) => `${DUST_NAME[g].replace(' 가루', '')} +${fmt(r.dust[g]!)}`);
    toast(r.count ? `${r.count}개 ${fsay('분해', '분해해 드렸어요')} · ${parts.join(' · ')}` : '분해할 장비가 없어요');
    back();
  };
}

/** EX_SALVAGE_1021: 전용 무기 한 개 분해 — 「분해」를 직접 입력해야 진행 (조각 perBox개는 돌려받음) */
export function exSalvageOk(name: string): boolean {
  const v = prompt(`⚠ 「${name}」은 전용 무기예요!\n분해하면 무기는 사라지고 무기 조각 ${CONFIG.raidWeapon.frag.perBox}개만 돌려받아요.\n정말 분해하려면 「분해」를 입력해 주세요.`);
  return (v ?? '').trim() === '분해';
}
