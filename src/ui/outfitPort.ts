// LUXE §1-3 영웅 의상실 — 초상화 「한 함수」 portSrc(key)
//  대화창 · 인연 창 · 영웅 카드/파티 칸/손님 창(pic) · 이웃 목록 대표 영웅이 모두 이걸로 초상화 주소를 얻는다
//  의상을 입은 사람(legend_x · hero_x · star_x)이면 같은 의상 색(engine/outfitPaint outfitPalette)으로 옷 영역만 바꾼 그림 · 아니면 원래 그림 그대로
//  만든 그림은 의상마다 한 번 (작은 LRU · 초상화 64px라 가볍다)
import { PORTRAIT_IMG, PORTRAITS } from '../engine/assets';
import { Lru } from '../engine/lru';
import { dressPortrait, framePortrait, lookOf, outfitPalette, type PortraitStat } from '../engine/outfitPaint';
import { LUXE_OUTFITS } from '../data/luxe_cfg';
import { OUTFITS } from '../data/outfits';
import { charBaseDef, charOfPort, wornOf } from '../world/outfits';

const CACHE = new Lru<string, string>(48);

/** 초상화 주소: outfit 안 주면 그 사람이 입은 의상 (꺼짐·안 입음이면 원래 그림) · null = 원래 그림 · id = 그 의상 */
export function portSrc(key: string | null | undefined, outfit?: string | null): string {
  if (!key) return '';
  const base = PORTRAITS[key] || '';
  const char = charOfPort(key);
  if (!char || !base) return base;
  const id = outfit === undefined ? wornOf(char) : outfit;
  if (!id || OUTFITS[id]?.char !== char) return base;
  const ck = key + '|' + id;
  const hit = CACHE.get(ck);
  if (hit) return hit;
  const c = dressedPortCanvas(key, id);
  return c ? CACHE.set(ck, c.toDataURL()) : base;
}

/** 의상 입힌 초상화 캔버스 (그림이 아직 안 왔으면 null) — 비교 시트·테스트용으로 stat도 */
export function dressedPortCanvas(key: string, id: string, stat?: PortraitStat): HTMLCanvasElement | null {
  const im = PORTRAIT_IMG[key];
  const char = charOfPort(key);
  const pal = outfitPalette(id);
  const def = char ? charBaseDef(char) : null;
  if (!im || !im.complete || !im.naturalWidth || !pal || !def) return null;
  try {
    if (LUXE_OUTFITS.portrait.frameOnly.includes(char!)) return framePortrait(im, pal);
    return dressPortrait(im, lookOf(def), pal, stat);
  } catch {
    return null;
  }
}
