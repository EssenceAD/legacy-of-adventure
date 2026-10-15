// 10/16 이카몰리 「펫이름 작성에 에러」 — 한글 IME 조합 중 Enter e2e
//  크롬 IME 흉내(CDP imeSetComposition · insertText)로 「콩이」·「왈왈이야아아아」를 조합하다 Enter / 버튼
//  ① 펫 카드 「콩이」: 조합 중 Enter → 저장 안 됨(창 그대로) → 확정 후 Enter → 「콩이」 · 한 번만
//  ② 이름 바꾸기 「왈왈이야아아아」: 버튼 → 그대로 · 글자 수 「7/8」
//  ③ 8자 넘게: 칸엔 다 들어가고(잘림 없음) 「9/8」 빨강 · 저장은 8자
//  ④ 이름 칸에서 Z·X·B·M·Enter(조합) → 대화·건설·메뉴 안 열림 · 글자는 칸에
//  ⑤ 폼(채팅) 안 칸에서 조합 중 Enter → 제출 막힘(preventDefault)
//  기기: pc(크롬) · android · ios (모바일 흉내 — 실제 키보드 IME 대신 같은 이벤트 순서)
//  실행: URL=http://localhost:4190/ node scripts/e2e-ime.mjs [pc|android|ios]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const OUT = 'screenshots/ime';
fs.mkdirSync(OUT, { recursive: true });
const SAVE = fs.existsSync('tests/fixtures/real_lotte.json') ? 'tests/fixtures/real_lotte.json' : null;
const DEVS = {
  pc: { viewport: { width: 1280, height: 800 } },
  android: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' },
  ios: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
};
const which = process.argv[2] ? [process.argv[2]] : Object.keys(DEVS);
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const sv = SAVE ? fs.readFileSync(SAVE, 'utf8') : null;

for (const dev of which) {
  console.log(`[${dev}]`);
  const ctx = await b.newContext(DEVS[dev]);
  await ctx.addInitScript((s) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    if (s) localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  }, sv);
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const W = (ms) => p.waitForTimeout(ms);
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#tCont', { state: 'visible', timeout: 60000 });
  await W(600);
  await p.locator('#tCont').click();
  await W(3500);
  const clearAll = () => p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 150 : 250);
    }
  });
  await clearAll();
  const winT = () => p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT')?.textContent : null));
  const nameOf = (id) => p.evaluate((id) => window.__pets.state().got[id]?.name ?? null, id);
  /** 조합만 (확정 안 함) */
  const compose = async (t) => cdp.send('Input.imeSetComposition', { text: t, selectionStart: t.length, selectionEnd: t.length });
  /** 조합 중 Enter (브라우저가 조합 중에 보내는 keydown과 같은 꼴) → 막혔나(defaultPrevented) */
  const imeEnter = () => p.evaluate(() => {
    const el = document.activeElement;
    const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, which: 229, isComposing: true, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  });

  // ① 펫 카드 「콩이」
  const id = 'raccoon';
  await p.evaluate((id) => {
    const st = window.__pets.state();
    if (!st.got[id]) window.__pets.grant(id, 'hunt');
    if (!st.card.includes(id)) st.card.push(id);
    window.__pets.card(id);
  }, id);
  await W(500);
  ok(/새 친구/.test((await winT()) ?? ''), '펫 카드 열림');
  ok(await p.evaluate(() => !document.getElementById('pcName')?.hasAttribute('maxlength')), '이름 칸에 maxlength 없음');
  await p.locator('#pcName').click();
  await p.locator('#pcName').fill('');
  await compose('콩');
  await compose('콩이');
  await imeEnter();
  await W(300);
  ok(/새 친구/.test((await winT()) ?? ''), '조합 중 Enter → 저장 안 됨 (창 그대로)');
  await cdp.send('Input.insertText', { text: '콩이' });
  await W(150);
  ok((await p.inputValue('#pcName')) === '콩이', '확정 뒤 칸 = 「콩이」');
  ok((await p.textContent('#pcLen'))?.trim() === '2/8', '글자 수 2/8');
  await p.screenshot({ path: `${OUT}/${dev}_card.png` });
  await p.keyboard.press('Enter');
  await W(300);
  ok((await winT()) === null, 'Enter → 창 닫힘');
  ok((await nameOf(id)) === '콩이', `저장된 이름 = 「콩이」 (${await nameOf(id)})`);
  // 확정 Enter가 한 번 더 와도 기본 이름으로 안 돌아감
  await p.keyboard.press('Enter');
  await W(300);
  ok((await nameOf(id)) === '콩이', 'Enter 한 번 더 → 그대로 「콩이」');
  await clearAll();

  // ② 이름 바꾸기 「왈왈이야아아아」 → 버튼
  const openRename = async () => {
    await p.evaluate((id) => window.__pets.menu(id, 300, 400), id);
    await W(300);
    await p.evaluate(() => document.getElementById('ptName')?.click());
    await W(400);
  };
  await openRename();
  ok(/이름 바꾸기/.test((await winT()) ?? ''), '이름 바꾸기 창');
  await p.locator('#pcName').click();
  await p.locator('#pcName').fill('');
  for (const part of ['왈', '왈왈', '왈왈이', '왈왈이야', '왈왈이야아', '왈왈이야아아', '왈왈이야아아아']) await compose(part);
  await imeEnter();
  await W(200);
  ok(/이름 바꾸기/.test((await winT()) ?? ''), '조합 중 Enter → 그대로');
  await cdp.send('Input.insertText', { text: '왈왈이야아아아' });
  await W(150);
  ok((await p.textContent('#pcLen'))?.trim() === '7/8', '글자 수 7/8');
  await p.screenshot({ path: `${OUT}/${dev}_rename.png` });
  await p.locator('#pcGo').click();
  await W(300);
  ok((await nameOf(id)) === '왈왈이야아아아', `버튼 → 「왈왈이야아아아」 (${await nameOf(id)})`);
  await clearAll();

  // ③ 8자 넘게
  await openRename();
  await p.locator('#pcName').click();
  await p.locator('#pcName').fill('');
  await compose('왈왈이야아아아아아');
  await cdp.send('Input.insertText', { text: '왈왈이야아아아아아' });
  await W(150);
  ok((await p.inputValue('#pcName')) === '왈왈이야아아아아아', '칸엔 9자 그대로 (조합 중 잘림 없음)');
  ok((await p.textContent('#pcLen'))?.trim() === '9/8' && (await p.getAttribute('#pcLen', 'class'))?.includes('over'), '「9/8」 빨강');
  await p.keyboard.press('Enter');
  await W(300);
  ok((await nameOf(id)) === '왈왈이야아아아아', `저장은 8자 (${await nameOf(id)})`);
  await clearAll();

  // ④ 이름 칸에서 전역 단축키가 안 먹나
  await openRename();
  await p.locator('#pcName').click();
  await p.locator('#pcName').fill('');
  for (const k of ['z', 'x', 'b', 'm', 'c']) await p.keyboard.press(k);
  await W(300);
  const t4 = await winT();
  ok(/이름 바꾸기/.test(t4 ?? ''), `Z·X·B·M·C → 다른 창 안 열림 (${t4})`);
  ok((await p.inputValue('#pcName')) === 'zxbmc', '글자는 칸에 그대로');
  await clearAll();

  // ⑤ 폼 안 칸(채팅)에서 조합 중 Enter → 제출 막힘
  const formOk = await p.evaluate(() => {
    const f = document.createElement('form');
    f.innerHTML = '<input id="imeT">';
    let submitted = 0;
    f.onsubmit = (e) => { e.preventDefault(); submitted++; };
    document.body.appendChild(f);
    const el = f.querySelector('input');
    el.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    const ev2 = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true });
    el.dispatchEvent(ev2);
    f.remove();
    return { ime: ev.defaultPrevented, plain: ev2.defaultPrevented };
  });
  ok(formOk.ime && !formOk.plain, `폼: 조합 Enter만 막음 (${JSON.stringify(formOk)})`);
  ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
  await ctx.close();
}
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
