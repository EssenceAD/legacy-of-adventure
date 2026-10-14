// DIRECTION e2e: 여정 화면 · 연대기 탭 · 함께 만든 사람들 · 소문 보내기(서버 없으면 숨김/잠김) · 다음 업데이트 카드 · 제보함(운영자 아니면 없음) · 회차의 바람 분위기 · 간판 금테
//  실행: URL=http://localhost:5199/ node scripts/e2e-direction.mjs [phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
// FIRSTLOOK §5 flSideRail: 접힌 「⋯」 안의 버튼이면 먼저 펼친다 (끄면 아무것도 안 함)
const railExpand = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); const r = document.getElementById('bRail'); if (e && r && getComputedStyle(e).display === 'none' && !document.body.classList.contains('railopen')) r.click(); }, sel);
const name = process.argv[2] ?? 'phone';
const FX = 'tests/fixtures/real_lotte.json';
const save = fs.existsSync(FX) ? JSON.parse(fs.readFileSync(FX, 'utf8')) : JSON.parse(fs.readFileSync('tests/fixtures/beta_town.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/direction';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
}, JSON.stringify(save));
// 다음 업데이트 카드: next.json을 바꿔 가며 (처음엔 내용 있음)
let nextBody = JSON.stringify({ date: '2099-10-15', title: '새 사냥 지역 5곳', items: ['구름 위 지역 다섯 곳', '새 보스 다섯'], image: 'assets/icons/m_hunt.png' });
await ctx.route(/next\.json/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: nextBody }));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text()) && errs.push('console: ' + m.text().slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 500);
  }
};
const winTitle = () => p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT').textContent : ''));
await p.goto(process.env.URL ?? 'http://localhost:5199/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();

// 1) 메뉴: 여정 있음 · 제보함 없음(운영자 아님) · 소문 보내기 없음(서버 없음)
await p.evaluate(() => window.__openMenu());
await W(400);
const tiles = await p.$$eval('.mtile span', (els) => els.map((e) => e.textContent));
ok(tiles.includes('여정'), '메뉴에 「여정」');
ok(!tiles.includes('제보함'), '운영자가 아니면 「제보함」 없음');
ok(!tiles.includes('소문 보내기'), '서버 함수가 없으면 「소문 보내기」 타일 숨김');
await p.screenshot({ path: `${dir}/${name}_menu.png` });

// 2) 여정 화면 (2회차 · 축제의 해로)
await p.evaluate(() => { window.__P.legacy.gen = 2; window.__P.story.wind = 'festival'; });
await p.locator('.mtile', { hasText: '여정' }).click();
await W(500);
ok((await winTitle()) === '여정', '여정 창이 열림');
const cells = await p.$$eval('.jcell', (els) => els.map((e) => e.querySelector('b').textContent + ' ' + e.querySelector('em').textContent));
ok(cells.length === 7, '칸 7개: ' + cells.join(' / '));
ok(/엔딩 \d+\/6/.test(cells.join(' ')) && /지역 \d+\/10/.test(cells.join(' ')) && /신화 영웅 \d+\/9/.test(cells.join(' ')) && /물고기 \d+\/20/.test(cells.join(' ')) && /고유 장비 \d+\/15/.test(cells.join(' ')), '분모 10 · 6 · 9 · 15 · 20');
ok(await p.locator('.jwind').isVisible(), '이번 회차의 바람 표시: ' + (await p.locator('.jwind b').textContent()));
ok((await p.locator('.jfoot').textContent()).includes('이 이야기는 끝이 있어요. 대신 회차마다 조금씩 달라요.'), '원칙 문구');
await p.screenshot({ path: `${dir}/${name}_journey.png` });
// 칸 누르면 도감으로
await p.locator('.jcell[data-jg="fish"]').click();
await W(400);
ok((await winTitle()) === '도감' && (await p.locator('#dT .tab.on').textContent()) === '낚시', '물고기 칸 → 도감 「낚시」');
await p.evaluate(() => window.__openJourney());
await W(300);
await p.locator('.jcell[data-jg="endings"]').click();
await W(400);
ok(/앨범/.test(await winTitle()), '엔딩 칸 → 엔딩 앨범: ' + (await winTitle()));

// 3) 연대기 탭 (옛 저장의 엔딩 → 채운 쪽)
await p.evaluate(() => window.__openJourney());
await W(300);
await p.locator('#jChron').click();
await W(500);
ok((await p.locator('#dT .tab.on').textContent()) === '연대기', '여관 연대기 탭');
const pages = await p.evaluate(() => window.__P.legacy.chron.length);
ok(pages >= (save.progress.legacy.album?.length ? 1 : 0), `연대기 ${pages}쪽 (옛 저장 앨범 ${save.progress.legacy.album?.length ?? 0})`);
if (pages) ok(await p.locator('.chpage').isVisible(), '책 한 쪽이 보임: ' + (await p.locator('.chend').textContent()));
// 쪽을 하나 더 만들어 넘겨 보기
await p.evaluate(() => { window.__P.legacy.chron.push({ at: Date.now(), gen: 2, inn: window.__S.innName, ending: 'story_retire', regs: window.__world.actors.filter((a) => a.status === 'regular').slice(0, 3).map((a) => ({ name: a.name, kind: a.kind, race: a.race })), wind: 'festival' }); window.__openDex(window.__openDex.length ? 0 : 0); });
await p.evaluate(() => window.__openJourney());
await W(200);
await p.locator('#jChron').click();
await W(400);
ok(/\/ \d+쪽/.test(await p.locator('.chnav span').textContent()), '쪽 번호: ' + (await p.locator('.chnav span').textContent()));
ok((await p.locator('.chwind').textContent()).includes('축제의 해'), '쪽에 그 회차의 바람');
await p.screenshot({ path: `${dir}/${name}_chronicle.png` });
const prevBtn = p.locator('[data-chp]').first();
if (await prevBtn.isEnabled()) {
  await prevBtn.click();
  await W(300);
  ok(/^1 \//.test(await p.locator('.chnav span').textContent()), '◀ 앞 쪽으로 넘김');
}

// 4) 함께 만든 사람들 (개척자 넷 금테 · 서버 없으면 안내)
await p.locator('#dT .tab', { hasText: '함께 만든 사람들' }).click();
await W(500);
ok((await p.locator('.ctb.gold').count()) === 4, '개척자 넷 금테');
await p.screenshot({ path: `${dir}/${name}_contrib.png` });

// 5) 소문 보내기: 서버 없으면 잠김
await p.evaluate(() => window.__openRumorSend());
await W(300);
ok(await p.locator('#rsV').isDisabled(), '서버 없음: 입력 잠김');
ok(await p.locator('#rsF button').isDisabled(), '서버 없음: 보내기 잠김');
ok(await p.locator('.rsoff').isVisible(), '준비 중 안내');
await p.screenshot({ path: `${dir}/${name}_rumor_off.png` });

// 6) 다음 업데이트 카드 (새 소식 맨 위)
await settle();
await p.evaluate(() => window.__openNotices());
await W(800);
ok(await p.locator('.nextcard').isVisible(), '다음 업데이트 카드: ' + (await p.locator('.nextcard .nxh').textContent()));
ok((await p.locator('.nextcard .nxh').textContent()).includes('새 사냥 지역 5곳 외'), '「… 외」');
ok((await p.locator('.nximg').count()) === 1, '예고 그림 한 장');
await p.screenshot({ path: `${dir}/${name}_next.png` });
// 패치노트 탭 (서버 크레딧 없이도)
await p.screenshot({ path: `${dir}/${name}_notice_tabs.png` });
await p.locator('.tab', { hasText: '패치노트' }).click();
await W(800);
ok((await p.locator('.pn').count()) > 3, '패치노트 목록');
ok((await p.locator('.pn-credit').count()) === 0, '서버 없으면 크레딧 줄 없음');
await settle();
nextBody = JSON.stringify({ date: '', title: '', items: [] });
await p.evaluate(() => window.__openNotices());
await W(800);
ok((await p.locator('.nextcard').count()) === 0, '빈 next.json → 카드 숨김');
await settle();
nextBody = '';
await ctx.unroute(/next\.json/);
await ctx.route(/next\.json/, (r) => r.fulfill({ status: 404, body: 'nope' }));
await p.evaluate(() => window.__openNotices());
await W(800);
ok((await p.locator('.nextcard').count()) === 0, 'next.json 없음 → 카드 숨김');
await settle();

// 7) 바람 분위기 · 간판 금테 (마을 화면)
await p.evaluate(() => { window.__P.legacy.journeyEnd = true; window.__P.story.wind = 'festival'; });
await W(1200);
await p.screenshot({ path: `${dir}/${name}_wind_festival.png` });
await p.evaluate(() => { window.__P.story.wind = 'harvest'; });
await W(800);
await p.screenshot({ path: `${dir}/${name}_wind_harvest.png` });
await p.evaluate(() => { window.__P.story.wind = 'stars'; });
await railExpand(p, '#bDN');
await p.locator('#bDN').click();
await W(600);
await settle();
await W(2000);
await p.screenshot({ path: `${dir}/${name}_wind_stars.png` });
await p.evaluate(() => window.__openMenu());
await W(300);
await p.locator('.mtile', { hasText: '칭호' }).click();
await W(300);
ok((await p.locator('#winB').textContent()).includes('이야기의 끝을 본 주인'), '칭호 「이야기의 끝을 본 주인」');
await settle();

ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
