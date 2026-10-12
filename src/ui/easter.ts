// EASTER 화면: 금빛 편지 → 컷신(낭독 · 마을 입구로 카메라 · 장식 「쿵」 · 칭호 배너) · 카메오 손님 대사·선물 · 개척자 장식 연출
import { LETTERS, PIONEERS, type PioneerId } from '../data/story/easter';
import { def, type Kind } from '../data/catalog';
import { sfx } from '../audio/sfx';
import * as game from '../game';
import { myPioneer, online, pioneers } from '../net/server';
import { track as trackEv } from '../net/telemetry';
import { entrance, blocksDoor, canPlace, addObj, rebuildPaths } from '../world/town';
import { addMail } from '../world/meta';
import { cameoDue, cameoNext, cameoPick, duckAura, isPioneer, makeCameo, noteCameo, noteMet } from '../world/easter';
import { arrive } from '../world/actors';
import { floatW } from '../world/fx';
import { markDirty, P, S, world, type Actor } from '../world/state';
import { playStory, storyFx } from './story';
import { talk, isTalking } from './dialogue';
import { isWinOpen, toastHtml, toast } from './windows';
import { decorView } from '../world/decor';

const E = () => (P.meta.easter ??= {});
export const COMMON_TITLE = '베타 개척자';

/** 로그인(또는 게스트)으로 이어진 뒤: 개척자 계정이면 금빛 편지 한 번 */
export async function checkPioneer() {
  if (!online()) return;
  void pioneers();
  const id = await myPioneer();
  if (!isPioneer(id) || E().mail || E().got) return;
  E().mail = id;
  addMail({ from: 'system', title: '💌 모모의 금빛 편지', body: '아주 특별한 편지예요. 열어 보세요!', reward: { pioneer: id } });
  markDirty();
  trackEv('pioneer_mail', { id });
}

/** 편지를 열면: 컷신 (fx 'drop'에서 장식이 「쿵」) → 칭호 배너 — 한 번만 */
let dropping: PioneerId | null = null;
export function openPioneerLetter(id: string) {
  if (!isPioneer(id) || E().got) return;
  E().got = id;
  markDirty();
  dropping = id;
  // 2. 마을 입구로 카메라
  const [ex, ey] = entrance();
  game.focusTile(ex, ey - 2);
  playStory(LETTERS[id], () => {
    if (dropping) dropDeco(dropping);
    titleBanner(id);
  });
}
/** 3. 전용 장식이 입구 근처 빈자리에 「쿵」 */
function dropDeco(id: PioneerId) {
  dropping = null;
  const kind = PIONEERS[id].deco as Kind;
  if (world.objs.some((o) => o.kind === kind)) return;
  const d = def(kind);
  const [ex, ey] = entrance();
  let spot: [number, number] | null = null;
  for (let r = 1; r < 12 && !spot; r++)
    for (let dy = -r; dy <= 0 && !spot; dy++)
      for (let dx = -r; dx <= r && !spot; dx++) {
        const t = { kind, tx: ex + dx, ty: ey - 2 + dy, fw: d.size[0], fh: d.size[1] };
        if (canPlace(t) && !blocksDoor(t)) spot = [t.tx, t.ty];
      }
  if (!spot) {
    // 자리가 없으면 보관함으로 (꾸미기 모드에서 꺼내 놓기)
    (P.decor.store ??= []).push({ kind, lvl: 1, hue: null, flip: false, fromProp: true });
    toast(`${d.name}을(를) 보관함에 넣어 두었어요 · 꾸미기 모드 → 보관함`);
    return;
  }
  const o = addObj(kind, spot[0], spot[1], { fromProp: true, builtAt: Date.now() });
  rebuildPaths();
  game.thud(o);
  game.focusTile(spot[0] + 0.5, spot[1] + 0.5);
  markDirty();
}
/** 4. 칭호 획득 배너 */
function titleBanner(id: PioneerId) {
  const mine = PIONEERS[id].title;
  for (const t of [COMMON_TITLE, mine]) if (!P.titles.includes(t)) P.titles.push(t);
  if (!P.meta.title) P.meta.title = mine;
  markDirty();
  sfx('legend');
  toastHtml(`<span>🏅 칭호 「<b class="g">${COMMON_TITLE}</b>」 · 「<b class="g">${mine}</b>」 획득!</span>`, 6000);
  trackEv('pioneer_open', { id });
}

// ───────── §2 카메오 ─────────

/** 지나가는 손님으로 들른다 (본인 마을이면 자기 빼고) */
let myId: PioneerId | null = null;
function spawnCameo() {
  if (!S.started || S.visiting || isTalking() || isWinOpen() || decorView.on || !cameoDue()) return;
  if (Math.random() > 0.02) return; // 1초마다 2% — 낮 동안 고르게
  const id = cameoPick(myId);
  if (!id) return;
  const [ex, ey] = entrance();
  const a = makeCameo(id, ex, ey);
  arrive(a);
  noteCameo(id);
  trackEv('cameo', { id });
}
/** 누르면 대사 하나씩 · 다 들으면 선물 */
export function tapCameo(a: Actor): boolean {
  if (!isPioneer(a.cameo)) return false;
  const id = a.cameo;
  noteMet(id);
  const r = cameoNext(a);
  talk([[`p_${id}`, r.line, undefined, PIONEERS[id].name]], () => r.gift && giveGift(id, a));
  return true;
}
function giveGift(id: PioneerId, a: Actor) {
  if (id === 'woongs') {
    S.gold += 500;
    floatW(a.x, a.y, 40, '+500G', 'big');
    sfx('coin');
  } else if (id === 'gonu') {
    E().decoCoupon = true;
    toast('장식 10% 할인 쿠폰을 받았어요 (다음 장식 하나)');
  } else if (id === 'warmnight') {
    for (const g of world.actors) if (!g.role && !g.hidden) g.mood = Math.min(100, g.mood + 10);
    toast('손님들 기분 +10');
  } else {
    E().expCoupon = true;
    toast('다음 의뢰 시간 −10% 쿠폰을 받았어요');
  }
  markDirty();
  trackEv('cameo_gift', { id });
}
/** 단골로 받을 수 없다 (제안이 오면) */
export const isCameo = (a: Actor) => isPioneer(a.cameo);

export function initEaster() {
  storyFx.drop = () => dropping && dropDeco(dropping);
  // 「쌍둥이 온천」: 오리상 근처 기분 · 온천 옆이면 가끔 글씨
  let twinT = 0;
  setInterval(() => {
    spawnCameo();
    const r = duckAura(1);
    if (r?.twin && Date.now() - twinT > 90000 && !document.hidden) {
      twinT = Date.now();
      floatW(r.duck.tx + 1, r.duck.ty + 1, 50, '♨ 쌍둥이 온천', 'big');
    }
  }, 1000);
  void myPioneer().then((id) => (myId = isPioneer(id) ? id : null));
}
export const setMyPioneer = (id: string | null) => (myId = isPioneer(id) ? id : null);
