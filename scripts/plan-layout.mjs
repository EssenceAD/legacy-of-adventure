// TOWN T1 도우미: 이웃 마을 배치를 글자 지도로 찍고 겹침·땅 밖을 검사한다 (설계용 · 실제 검사는 게임의 placeLayout)
//  실행: node scripts/plan-layout.mjs <layout.json>  — [{name, land, layout:[[kind,x,y,lvl?],…]}]
import fs from 'node:fs';
const SIZE = {
  inn: (l) => (l >= 5 ? [5, 5] : l >= 2 ? [4, 4] : [3, 3]), tavern: (l) => (l >= 2 ? [4, 4] : [3, 3]), cottage: [2, 2], smith: [3, 3], bath: [3, 3], training: [3, 3], garden: [3, 3],
  stable: [3, 3], chapel: [3, 3], library: [3, 3], alchemy: [3, 3], postoffice: [2, 2], tower: [2, 2], guild: [4, 4], stall: [2, 2], fountain: [2, 2], gate: [2, 2], monument: [2, 2], dungeon: [3, 3],
};
const CH = { inn: 'I', tavern: 'T', cottage: 'c', smith: 'S', bath: 'B', training: 'R', garden: 'G', stable: 'H', chapel: 'C', library: 'L', alchemy: 'A', postoffice: 'P', tower: 'W', guild: 'U', stall: 's', fountain: 'F', gate: '=', dungeon: 'D', well: 'o', board: 'b', tree: 't', pine: 'p', fire: '*', bench: 'n', flowerbed: 'f', barrels: 'r', target: 'x', arbor: 'a', lamppost: 'l', statue: 'q', banner: 'g', monument: 'M', trophy_boar: 'y' };
const FROM = [14, 11, 8, 4, 0];
const N = 22;
for (const v of JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))) {
  const a = FROM[v.land - 1];
  const g = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (x >= a && y >= a ? '.' : ' ')));
  const errs = [];
  for (const [k, x, y, l = 1] of v.layout) {
    const s = typeof SIZE[k] === 'function' ? SIZE[k](l) : SIZE[k] ?? [1, 1];
    for (let j = 0; j < s[1]; j++)
      for (let i = 0; i < s[0]; i++) {
        const X = x + i;
        const Y = y + j;
        if (X >= N || Y >= N) {
          if (k !== 'dungeon') errs.push(`${k}(${x},${y}) 맵 밖`);
          continue;
        }
        if (k !== 'dungeon' && (X < a || Y < a)) errs.push(`${k}(${x},${y}) 땅 밖`);
        if (g[Y][X] !== '.' && g[Y][X] !== ' ') errs.push(`${k}(${x},${y}) 겹침 ${g[Y][X]}@${X},${Y}`);
        g[Y][X] = CH[k] ?? '?';
      }
  }
  // 문 앞 칸 (건물만): 땅 안 · 비어 있어야
  const DECO = new Set(['well','board','tree','pine','fire','bench','flowerbed','barrels','target','arbor','lamppost','statue','stall','fountain','banner','gate','monument','trophy_boar']);
  for (const [k, x, y, l = 1] of v.layout) {
    if (DECO.has(k) || k === 'dungeon') continue;
    const s2 = typeof SIZE[k] === 'function' ? SIZE[k](l) : SIZE[k] ?? [1, 1];
    const dx = x + Math.floor(s2[0] / 2), dy = y + s2[1];
    if (dx >= N || dy >= N || dx < a || dy < a) errs.push(`${k}(${x},${y}) 문이 땅 밖`);
    else if (g[dy][dx] !== '.') errs.push(`${k}(${x},${y}) 문 앞이 막힘 ${g[dy][dx]}@${dx},${dy}`);
    else g[dy][dx] = '_';
  }
  console.log(`== ${v.name} (땅 ${v.land}) · ${v.layout.length}개`);
  console.log('   ' + Array.from({ length: N }, (_, i) => (i % 10)).join(''));
  g.forEach((r, y) => console.log(String(y).padStart(2) + ' ' + r.join('')));
  console.log(errs.length ? '✗ ' + [...new Set(errs)].join(' · ') : '✓ 겹침·땅 밖 없음');
}
