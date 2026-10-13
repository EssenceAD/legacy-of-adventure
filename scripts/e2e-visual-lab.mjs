// VISUAL v0.25.0: 설정 「새 화면 미리 보기」 — 켠 기기는 보임 · 끄면 다시 불러오고 지워짐 · 운영자 아니면 끈 뒤 안 보임
//  실행: node scripts/e2e-visual-lab.mjs   (dist-bot :4190)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => { try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; } localStorage.clear(); localStorage.setItem('legacy-of-adventure-save', s); localStorage.setItem('legacy-of-adventure-teaserSeen', 'true'); localStorage.setItem('legacy-of-adventure-lastVersion', '"0.24.6-beta"'); localStorage.setItem('legacy-of-adventure-settleOff', 'true'); localStorage.setItem('legacy-of-adventure-visualLab', 'true'); }, save);
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let fail = 0; const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const boot = async () => { await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 }); await p.waitForTimeout(800); await p.locator('#tCont').click(); await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 }); await p.waitForTimeout(1500); await p.evaluate(async () => { for (let i = 0; i < 20; i++) { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); await new Promise((r) => setTimeout(r, 150)); } }); };
const openSettings = async () => { await p.evaluate(() => window.__openMenu()); await p.waitForTimeout(400); await p.locator('#win button, #win .mi, #win [data-i]', { hasText: '설정' }).first().click(); await p.waitForTimeout(400); };
await p.goto('http://localhost:4190/', { waitUntil: 'domcontentloaded' });
await boot();
const t0 = await p.evaluate(() => performance.getEntriesByType('navigation')[0].duration);
await openSettings();
ok(await p.locator('#mLab').isChecked(), '켠 기기: 설정에 「새 화면 미리 보기」 켜짐으로 보임');
await Promise.all([p.waitForEvent('load', { timeout: 15000 }), p.locator('#mLab').click()]);
await boot();
ok(await p.evaluate(() => localStorage.getItem('legacy-of-adventure-visualLab') === null), '끄면 다시 불러오고 기기 저장에서 지워짐');
await openSettings();
ok((await p.locator('#mLab').count()) === 0, '운영자 아닌 계정 · 끈 뒤: 토글 안 보임');
ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
