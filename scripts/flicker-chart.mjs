// flicker-probe 결과(JSON)로 전/후 밝기 그래프 한 장 — reports/checkin/flicker/chart.html (그림 파일 없이 SVG)
import fs from 'node:fs';
const DIR = 'reports/checkin/flicker';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
// flicker-probe와 같은 셈 (예전 JSON도 다시 센다)
function flickers(v, dir) {
  let n = 0;
  for (let i = 1; i < v.length; i++) {
    const ref = v[i - 1];
    const off = (x) => (dir < 0 ? x < ref * 0.97 : x > ref * 1.03);
    if (!off(v[i]) || (i > 1 && off(v[i - 1]))) continue;
    if (v.slice(i + 1, i + 11).some((x) => !off(x))) n++;
  }
  return n;
}
const runs = files.map((f) => {
  const r = JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8'));
  const v = r.samples.map((s) => s.forest);
  return { f, ...r, dims: flickers(v, -1), ups: flickers(v, 1) };
});
const groups = {};
for (const r of runs) {
  const inj = r.f.includes('_inject');
  (groups[`${r.hhmm}${inj ? ' · 고장 주입' : ''}`] ??= []).push({ ...r, inj });
}
const W = 640, H = 180, P = 30;
const svg = (list) => {
  const all = list.flatMap((r) => r.samples.map((s) => s.forest));
  const lo = Math.min(...all) * 0.97, hi = Math.max(...all) * 1.01;
  const X = (t) => P + (t / 10000) * (W - P - 8);
  const Y = (v) => H - P + 8 - ((v - lo) / (hi - lo || 1)) * (H - P - 8);
  const col = { before: '#d0583a', after: '#2f7fd0' };
  const lines = list
    .map((r) => `<polyline fill="none" stroke="${col[r.label] ?? '#888'}" stroke-width="1.6" points="${r.samples.map((s) => `${X(s.t).toFixed(1)},${Y(s.forest).toFixed(1)}`).join(' ')}"/>`)
    .join('');
  const ticks = [0, 2, 4, 6, 8, 10].map((s) => `<text x="${X(s * 1000)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="currentColor">${s}s</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px"><rect x="${P}" y="8" width="${W - P - 8}" height="${H - P}" fill="none" stroke="#8884"/>${ticks}<text x="4" y="${Y(hi) + 4}" font-size="10" fill="currentColor">${hi.toFixed(0)}</text><text x="4" y="${Y(lo)}" font-size="10" fill="currentColor">${lo.toFixed(0)}</text>${lines}</svg>`;
};
const body = Object.entries(groups)
  .sort()
  .map(([k, list]) => {
    list.sort((a, b) => a.label.localeCompare(b.label));
    const row = list.map((r) => `<b style="color:${r.label === 'before' ? '#d0583a' : '#2f7fd0'}">${r.label}</b> 어두워짐 ${r.dims}번 · 밝아짐 ${r.ups}번/10초 · 숲 밝기 ${Math.min(...r.samples.map((s) => s.forest))}~${Math.max(...r.samples.map((s) => s.forest))}`).join(' &nbsp; ');
    return `<h2>${k}</h2><p>${row}</p>${svg(list)}`;
  })
  .join('');
fs.writeFileSync(
  `${DIR}/chart.html`,
  `<!doctype html><meta charset="utf-8"><title>숲 밝기 전후</title><style>body{font:14px system-ui;margin:16px;background:#fff;color:#222}@media(prefers-color-scheme:dark){body{background:#16161a;color:#ddd}}h2{font-size:15px;margin:22px 0 4px}</style><h1>마을 캔버스 숲 밝기 (100ms마다 · 412×915 dpr 3)</h1><p>빨강 = 고치기 전(v0.25.26) · 파랑 = 고친 뒤. 「고장 주입」 = 2초마다 0.5초 동안 프레임 사이에 캔버스 투명도 0.6을 남겨 둠.</p>${body}`,
);
console.log(`${DIR}/chart.html (${runs.length} runs)`);
