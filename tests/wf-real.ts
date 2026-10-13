// WAYFIND 시험용: 실세이브를 진행·건물·손님까지 불러온다 (game.ts loadGame의 요점만)
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { blankActor } from '../src/world/adventurers';
import { sanitizeGrowth } from '../src/world/growth';
import { sanitizeRegions2 } from '../src/world/regions2';
import { P, resetProgress, S, world, type Building } from '../src/world/state';
import { readSave } from '../src/save/save';

export function loadReal(f: string) {
  localStorage.setItem(CONFIG.save.key, fs.readFileSync(f, 'utf8'));
  const d = readSave()!;
  resetProgress(d.progress);
  sanitizeRegions2();
  sanitizeGrowth();
  S.gold = d.gold;
  S.day = d.day;
  S.started = true;
  S.visiting = null as never;
  world.home = null;
  world.objs = d.buildings.map((b) => ({ ...b, inside: [] }) as unknown as Building);
  world.actors = d.adventurers.map((a) => Object.assign(blankActor(a.kind, a.name, a.x, a.y), a));
  for (const it of P.bag) it.owner = null;
  for (const a of world.actors)
    for (const s of ['weapon', 'armor', 'acc'] as const) {
      const it = P.bag.find((x) => x.id === a.equip[s]);
      if (it) it.owner = a.id;
    }
  return d;
}

