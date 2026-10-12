// ECONOMY §3: 뽐내기 장식 건물 창 — 영웅 동상(전설 고르기) · 축제 불꽃(누르면 10초) · 대형 시계탑 종소리
import { sfx } from '../audio/sfx';
import { hourNow } from '../world/clock';
import { FIREWORK_COST, hasLux, launchFireworks, statueChoices, statueName } from '../world/luxury';
import { markDirty, P, S } from '../world/state';
import { esc, fmt } from './common';
import { closeWin, objExtra, toast } from './windows';

let prev: ((o: never) => string) | null = null;
export function initLuxury() {
  prev = objExtra.html as never;
  objExtra.html = (o) => {
    const base = prev!(o as never);
    if (S.visiting) return base;
    if (o.kind === 'hero_statue') {
      const ch = statueChoices();
      return `${base}<p class="sub">지금 동상: <b class="g">${esc(statueName())}</b></p>${ch.length ? `<div class="btnrow">${ch.map((l) => `<button class="bigbtn sm ${P.luxury.statue === l.key ? '' : 'ghost'}" data-statue="${l.key}">${esc(l.name)}</button>`).join('')}</div>` : '<p class="note">합류한 전설 영웅이 있으면 동상으로 세울 수 있어요</p>'}`;
    }
    if (o.kind === 'firework_stand') return `${base}<button class="bigbtn" data-fire="1">🎆 불꽃놀이 (${fmt(FIREWORK_COST)}G · 10초)</button><p class="note">지금까지 ${P.luxury.shows ?? 0}번</p>`;
    return base;
  };
  addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const st = t.closest?.('[data-statue]') as HTMLElement | null;
    if (st) {
      P.luxury.statue = st.dataset.statue!;
      markDirty();
      toast(`${statueName()}의 동상을 세웠어요`);
      closeWin();
      return;
    }
    if (t.closest?.('[data-fire]')) {
      const why = launchFireworks();
      if (why) return toast(why);
      closeWin();
      sfx('rare');
      toast('🎆 불꽃놀이!');
    }
  });
  // 대형 시계탑: 게임 시각 0·6·12·18시에 종
  let lastH = -1;
  setInterval(() => {
    if (!S.started || S.visiting || document.hidden) return;
    const h = hourNow();
    if (h !== lastH && h % 6 === 0 && lastH !== -1 && hasLux('grand_clock')) sfx('mission', { vol: 0.5 });
    lastH = h;
  }, 1000);
}
