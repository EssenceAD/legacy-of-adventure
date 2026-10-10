// 옛 저장 예시 만들기: 실제 v6 저장(베타)에서 버전별로 그때 없던 칸을 뺀다 · v1은 1단계 모양 그대로
//  node tests/fixtures/make.mjs
import fs from 'node:fs';
const dir = 'tests/fixtures/';
const v6 = JSON.parse(fs.readFileSync(dir + 'v6.json', 'utf8'));
// 영웅 한 명 (영웅이 이어지는지 보려고)
v6.adventurers[0].status = 'hero';
v6.adventurers[0].heroId = v6.adventurers[0].heroId ?? 'kael';
fs.writeFileSync(dir + 'v6.json', JSON.stringify(v6));
const clone = () => JSON.parse(JSON.stringify(v6));
const v5 = clone();
v5.version = 5;
delete v5.progress.harmony;
delete v5.progress.evaluation;
fs.writeFileSync(dir + 'v5.json', JSON.stringify(v5));
const v4 = clone();
v4.version = 4;
for (const k of ['harmony', 'evaluation', 'guide', 'hunt', 'meta']) delete v4.progress[k];
fs.writeFileSync(dir + 'v4.json', JSON.stringify(v4));
const v3 = clone();
v3.version = 3;
for (const k of ['harmony', 'evaluation', 'guide', 'hunt', 'meta', 'owner', 'legacy']) delete v3.progress[k];
fs.writeFileSync(dir + 'v3.json', JSON.stringify(v3));
const v2 = clone();
v2.version = 2;
for (const k of ['harmony', 'evaluation', 'guide', 'hunt', 'meta', 'owner', 'legacy', 'raid', 'legends']) delete v2.progress[k];
fs.writeFileSync(dir + 'v2.json', JSON.stringify(v2));
const v1 = {
  version: 1, savedAt: Date.now() - 3600e3, land: 2, gold: 1234, day: 5, night: true, innName: '옛 여관',
  buildings: v6.buildings.filter((b) => ['inn', 'tavern', 'fire'].includes(b.kind)).map(({ kind, tx, ty, lvl }) => ({ kind, tx, ty, lvl, hue: null })),
  adventurers: [{ kind: 'knight', name: '알린', lvl: 4, x: 7, y: 7, hp: 80, food: 60, mood: 70 }, { kind: 'mage', name: '미라', lvl: 3, x: 8, y: 7, hp: 70, food: 50, mood: 60 }],
  ledger: { sleep: 100, drink: 50, forge: 0, bath: 0, dungeon: 0, stall: 0 },
};
fs.writeFileSync(dir + 'v1.json', JSON.stringify(v1));
console.log('ok');
