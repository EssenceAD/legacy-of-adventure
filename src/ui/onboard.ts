// ONBOARDING §2·§4·§5: 첫 60초 — 첫 손님 「방 있나요?」 → 누르면 체크인(금화) · 모닥불 · 30초 의뢰는 장부 1장 손가락 가이드
//  장부 1장을 끝내면 버나드가 「당신은 누구였나요?」(출신 고르기) → 첫 손님의 단골 제안 · 내일 선물 약속 · 두 번째 세션에 「홈 화면에 추가」 편지
import { sfx } from '../audio/sfx';
import { CONFIG } from '../data/config';
import { funnel } from '../net/funnel';
import { scr, view } from '../engine/iso';
import * as game from '../game';
import { makeAdventurer } from '../world/adventurers';
import { goTo, proposeTalk } from '../world/actors';
import { floatW, say } from '../world/fx';
import { PRI } from '../world/quiet';
import { currentMission, guideHooks } from '../world/guide';
import { addMail } from '../world/meta';
import { today } from '../world/progress';
import { earn, markDirty, P, S, world, type Actor } from '../world/state';
import { doorOf, entrance, findKind } from '../world/town';
import { isTalking, talk } from './dialogue';
import { uiSrc } from './kit';
import { openCreate, ownerLaterLines } from './owner';
import { isWinOpen, toast } from './windows';
import { keepFirstCam } from '../world/firstCam';
import { fsay } from '../world/visual';

const OB = () => CONFIG.onboard;
let guest: Actor | null = null;
/** 손님을 부르는 중 (두 번 부르지 않게) */
let spawning = false;
let lastAsk = 0;
let hand: HTMLImageElement | null = null;

/** 첫 손님이 걸어 들어와 여관 문 앞에서 「방 있나요?」 */
export function startFirstGuest() {
  if (S.visiting || (P.counters.checkins ?? 0) > 0) return;
  if ((guest && world.actors.includes(guest)) || spawning) return;
  spawning = true;
  setTimeout(() => {
    spawning = false;
    if (!S.started || S.visiting) return;
    const [ex, ey] = entrance();
    const a = makeAdventurer(ex, ey, { status: 'visitor', rarity: 'special', lvl: 3, day: S.day });
    a.firstGuest = true;
    world.actors.push(a);
    guest = a;
    const inn = findKind('inn');
    const [dx, dy] = inn ? doorOf(inn) : [ex, ey - 3];
    goTo(a, dx + 1, dy + 1, () => {
      a.st = 'idle';
      a.t = 1e9;
      say(a, '방 있나요?', 99, '', PRI.guide);
    });
    // 대상이 화면 밖이면 카메라를 옮겨 준다
    // FIRSTLOOK §1 flFirstCam: 새 세이브 가까이(여관 가운데)면 문이 이미 화면 안일 때 그대로
    if (!keepFirstCam(dx + 0.5, dy + 1)) game.focusTile(dx + 0.5, dy + 1);
  }, OB().guestDelayMs);
}

/** main의 탭: 첫 손님이면 체크인 (금화가 튀어나온다) */
export function tapFirstGuest(a: Actor): boolean {
  if (!a.firstGuest) return false;
  a.firstGuest = false;
  a.t = 0;
  earn(OB().checkinGold, 'sleep');
  P.counters.checkins = (P.counters.checkins ?? 0) + 1;
  floatW(a.x, a.y, 40, `체크인! +${OB().checkinGold}G`, 'big');
  sfx('coin');
  say(a, '잘 부탁해요!', 2, '', PRI.guide);
  funnel('first_guest');
  markDirty();
  hideHand();
  return true;
}

// ───────── 손가락 (첫 손님 위) ─────────

function hideHand() {
  if (hand) hand.hidden = true;
}
function syncHand() {
  const show = !!guest && !!guest.firstGuest && world.actors.includes(guest) && guest.st === 'idle' && !isTalking() && !isWinOpen() && !S.visiting;
  if (!show) return hideHand();
  // 「방 있나요?」 말풍선은 체크인할 때까지 다시
  if (!guest!.bub && performance.now() - lastAsk > 4000) {
    lastAsk = performance.now();
    say(guest!, '방 있나요?', 1, '', PRI.guide);
  }
  if (!hand) {
    hand = document.createElement('img');
    hand.id = 'obHand';
    hand.alt = '';
    document.getElementById('view')!.appendChild(hand);
  }
  const cv = document.getElementById('scene') as HTMLCanvasElement;
  const r = cv.getBoundingClientRect();
  const host = document.getElementById('view')!.getBoundingClientRect();
  const [X, Y] = scr(guest!.x, guest!.y);
  hand.hidden = false;
  hand.src = uiSrc(Math.floor(performance.now() / 400) % 2 ? 'hand_1' : 'hand_0');
  hand.style.left = `${Math.round(r.left - host.left + X * view.SC)}px`;
  hand.style.top = `${Math.round(r.top - host.top + (Y - 6) * view.SC)}px`;
}

// ───────── 장부 1장을 끝내면: 「당신은 누구였나요?」 → 첫 단골 제안 ─────────

let ownerScene = false;
function playOwnerScene() {
  ownerScene = false;
  talk(ownerLaterLines(), () => {
    funnel('owner_open');
    openCreate('later', () => {
      funnel('owner_done');
      // 다 하면 첫 손님이 단골이 되고 싶다고
      const g = guest && world.actors.includes(guest) && guest.status === 'visitor' ? guest : world.actors.find((x) => !x.role && x.id && x.status === 'visitor' && !x.leaving);
      if (g) setTimeout(() => proposeTalk(g), 1200);
      promiseTomorrow();
    });
  });
}

// ───────── §4 내일 선물 · §5 홈 화면에 추가 ─────────

/** 첫 세션 5분 또는 장부 1장: 「내일 또 오시면 선물 드릴게요! 🎁」 (한 번) */
export function promiseTomorrow() {
  const m = P.meta;
  if (m.d2Promise) return;
  m.d2Promise = today();
  markDirty();
  setTimeout(() => talk([['post', '내일 또 오시면 선물 드릴게요! 🎁']]), 2500);
}
/** 다음 날 첫 접속: 「이틀째 선물」 (금화 + 희귀 장비 + 장식) */
export function giveTomorrowGift() {
  const m = P.meta;
  if (!m.d2Promise || m.d2Given || m.d2Promise === today()) return;
  m.d2Given = true;
  addMail({ from: 'system', title: '모모의 이틀째 선물 🎁', body: '정말 와 주셨네요! 약속한 선물이에요. 내일도, 일주일째에도 출석 선물이 기다려요.', reward: { gold: OB().day2Gold, gear: 'r', deco: 'thanks_basket' } });
  markDirty();
  setTimeout(() => toast(fsay('우편함에 이틀째 선물이 왔어요 🎁', '이틀째 선물, 우편함에 넣어 뒀어요 🎁')), 2500);
}
/** 두 번째 세션부터 한 번: 홈 화면에 추가하는 법 (앱처럼 켜기) */
export function homeScreenLetter() {
  const m = P.meta;
  if (m.a2hs) return;
  const standalone = matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
  m.a2hs = true;
  markDirty();
  if (standalone) return;
  addMail({
    from: 'system',
    title: '모모의 편지 · 앱처럼 켜는 법',
    body: '아이폰: 사파리 아래 공유 버튼(□↑) → 「홈 화면에 추가」.\n갤럭시: 크롬 오른쪽 위 ⋮ → 「홈 화면에 추가」(또는 「앱 설치」).\n홈 화면 아이콘으로 켜면 주소창 없이 더 넓게 보여요!',
    reward: {},
  });
}

export function initOnboard() {
  game.onboardHooks.start = startFirstGuest;
  game.onboardHooks.resume = () => {
    giveTomorrowGift();
    homeScreenLetter();
  };
  const prev = guideHooks.chapterDone;
  guideHooks.chapterDone = (no) => {
    prev(no);
    if (no === 1 && P.owner?.pending) ownerScene = true;
  };
  setInterval(() => {
    if (document.hidden) return;
    syncHand();
    if (!S.started || S.visiting) return;
    // 체크인이 지금 임무인데 첫 손님이 없으면 (껐다 켰을 때) 다시
    if (currentMission()?.id === 'c1_checkin' && (!guest || !world.actors.includes(guest))) startFirstGuest();
    if (ownerScene && !isTalking() && !isWinOpen()) playOwnerScene();
    // 옛 저장인데 아직 기본 주인이면 (장부 1장을 이미 끝낸 채로 껐다 켬)
    if (P.owner?.pending && P.guide.claimed.includes('c1_scout') && P.guide.claimed.includes('c1_checkin') && !ownerScene && !isTalking() && !isWinOpen() && !document.querySelector('#win.on')) ownerScene = true;
  }, 250);
}
