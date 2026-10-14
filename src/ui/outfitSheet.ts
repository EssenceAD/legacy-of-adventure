// LUXE §1-3 의상 비교 시트용 개발 훅 (main.ts가 개발/봇 빌드에서만 window.__outfits로 건다 · scripts/shot-outfits.mjs)
//  캐릭터마다 기본 옷 · ① · ②: 마을 도트 4장(앞 대기 · 걷기 · 뒤 · 공격) · 초상화 · 영웅 카드
import { framesFor } from '../engine/sprites';
import { canvas } from '../engine/pixel';
import { appearance } from '../world/adventurers';
import { charInfo, OUTFIT_CHARS, outfitsOf } from '../data/outfits';
import { HEROES } from '../data/heroes';
import { LEGENDS } from '../data/legends';
import { isStarId, STARS } from '../data/fivestars';
import { odState, portOfChar, wearOutfit } from '../world/outfits';
import { world, type Actor } from '../world/state';
import { heroCardHtml } from './heroCard';
import { dressedPortCanvas, portSrc } from './outfitPort';
import { actorOfChar, openWardrobe } from './wardrobe';
import type { PortraitStat } from '../engine/outfitPaint';

/** 그 캐릭터 손님 (마을에 있으면 그 사람 · 없으면 아무 동료를 복제해 바꿔 끼움) */
function stand(char: string): Actor | null {
  const real = actorOfChar(char);
  if (real) return real;
  const list = world.home?.actors ?? world.actors;
  const src = list.find((x) => x.id && !x.role && x.status === 'hero') ?? list.find((x) => x.id && !x.role);
  if (!src) return null;
  const a = { ...src, equip: { ...src.equip } } as Actor;
  delete a.legendId;
  delete a.heroId;
  delete a.starId;
  const l = LEGENDS.find((x) => x.key === char);
  const h = HEROES.find((x) => x.id === char);
  if (l) Object.assign(a, { legendId: char, kind: l.kind, race: l.race, hair: l.hair, name: l.name });
  else if (h) Object.assign(a, { heroId: char, kind: h.kind, race: h.race, hair: h.hair, name: h.name });
  else if (isStarId(char)) Object.assign(a, { starId: char, kind: STARS[char].kind, race: STARS[char].race, hair: STARS[char].hair, name: STARS[char].name });
  a.id = -1;
  a.status = 'hero';
  a.runId = null;
  return a;
}

const scaled = (f: HTMLCanvasElement, k: number) => {
  const c = canvas(f.width * k, f.height * k);
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(f, 0, 0, c.width, c.height);
  return c.toDataURL();
};

export const outfitSheet = {
  chars: () => OUTFIT_CHARS.map((c) => c.char),
  /** 캐릭터 한 줄: 기본 + 2벌 */
  row(char: string, k = 3) {
    const a = stand(char);
    if (!a) return null;
    const port = portOfChar(char);
    const st = odState();
    const keep = { owned: [...st.owned], worn: { ...st.worn } };
    const looks = [null, ...outfitsOf(char).map((o) => o.id)].map((id) => {
      const { key, def } = appearance(a, id);
      const f = framesFor(key, def);
      // 카드는 입은 옷으로 그린다 (잠깐 입혔다 되돌림)
      if (id && !st.owned.includes(id)) st.owned.push(id);
      wearOutfit(char, id);
      const card = heroCardHtml(a, { size: 'md' });
      const stat: PortraitStat = { changed: 0, perPair: [] };
      if (id) dressedPortCanvas(port, id, stat);
      return {
        id,
        name: id ? outfitsOf(char).find((o) => o.id === id)!.name : '기본 옷',
        dots: [f.idle[0], f.walk[1], f.idleB[0], f.atk[1]].map((c) => scaled(c, k)),
        port: portSrc(port, id),
        card,
        portChanged: Math.round(stat.changed * 1000) / 10,
        portPairs: stat.perPair,
      };
    });
    st.owned = keep.owned;
    st.worn = keep.worn;
    return { char, name: charInfo(char)?.name ?? char, tier: charInfo(char)?.tier, looks };
  },
  /** 시트·화면 찍기용: 그 사람에게 의상 다 주고 입히기 */
  give(char: string, wear: string | null) {
    const st = odState();
    for (const o of outfitsOf(char)) if (!st.owned.includes(o.id)) st.owned.push(o.id);
    wearOutfit(char, wear);
  },
  open(char: string) {
    const a = actorOfChar(char);
    if (a) openWardrobe(a);
  },
};
