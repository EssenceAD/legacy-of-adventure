// DIRECTION §3-3: 운영 요약 한 장 — reports/ops_YYYYMMDD.md
//  오늘 접속 기기 · 신규/이탈 · 오류 · 새 제보(버그/건의/칭찬 · 비슷한 것 묶음) · 금화 흐름 이상 · 채팅 수
//
//  실행:  node tools/ops_report.mjs                (오늘 · 한국 날짜)
//         node tools/ops_report.mjs --date 2026-10-13
//         node tools/ops_report.mjs --dry          (서버 없이 tests/fixtures/ops_sample.json으로)
//  키:    SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY — 환경 변수 또는 이 폴더의 .env.ops / .env (둘 다 git에 안 올라간다)
//         서비스 키는 이 도구(내 컴퓨터)에서만. 게임(클라이언트)에는 절대 넣지 않는다.
//  읽기 전용: PostgREST GET만 쓴다 (쓰기·함수 호출 없음)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ───────── 날짜 (한국 시간 하루) ─────────

const KST = 9 * 3600000;
/** 한국 날짜 'YYYY-MM-DD' */
export const kstDate = (t = Date.now()) => new Date(t + KST).toISOString().slice(0, 10);
/** 그 한국 날짜의 [시작, 끝) (UTC ISO) */
export function dayRange(date, offsetDays = 0) {
  const s = Date.parse(`${date}T00:00:00Z`) - KST + offsetDays * 86400000;
  return [new Date(s).toISOString(), new Date(s + 86400000).toISOString()];
}

// ───────── 환경 ─────────

export function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
/** 필요한 키 중 빠진 것 */
export function missingEnv(env) {
  return ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !env[k]);
}

// ───────── 서버 읽기 (GET만) ─────────

/** 한 테이블을 조건으로 전부 (1000줄씩 Range) — fetchImpl은 시험용 */
export async function getAll(env, table, query, { fetchImpl = fetch, max = 50000 } = {}) {
  const out = [];
  for (let from = 0; from < max; from += 1000) {
    const r = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?${query}`, {
      method: 'GET',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${table} 읽기 실패 ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** 보고서에 필요한 것 모으기 */
export async function collect(env, date, opts = {}) {
  const [s, e] = dayRange(date);
  const [s7] = dayRange(date, -7);
  const enc = encodeURIComponent;
  const today = `created_at=gte.${enc(s)}&created_at=lt.${enc(e)}`;
  const [events, week, letters, chat, profiles] = await Promise.all([
    getAll(env, 'play_events', `select=device_id,user_id,name,props,app_version,created_at&${today}&name=in.(session_start,first_run,error,gold_gain)&order=id`, opts),
    getAll(env, 'play_events', `select=device_id,created_at&created_at=gte.${enc(s7)}&created_at=lt.${enc(s)}&name=eq.session_start&order=id`, opts),
    getAll(env, 'bug_letters', `select=id,user_id,body,app_version,created_at&${today}&order=id`, opts),
    getAll(env, 'chat_messages', `select=id,channel,user_id&${today}`, opts),
    getAll(env, 'profiles', `select=id,nickname,login_id,created_at`, opts),
  ]);
  return { date, events, week, letters, chat, profiles };
}

// ───────── 정리 ─────────

const KIND = { '버그 제보': '버그', '개선 건의': '건의', 칭찬: '칭찬' };
/** 편지 첫머리 [종류] → 버그 · 건의 · 칭찬 · 기타 */
export function letterKind(body) {
  const m = /^\s*\[([^\]]+)\]/.exec(String(body ?? ''));
  return (m && KIND[m[1].trim()]) || (m && /버그/.test(m[1]) ? '버그' : m && /건의/.test(m[1]) ? '건의' : m && /칭찬/.test(m[1]) ? '칭찬' : '기타');
}
const STOP = new Set(['그리고', '그런데', '근데', '너무', '진짜', '정말', '혹시', '해요', '있어요', '없어요', '했는데', '하는데', '같아요', '이거', '저거', '그거', '게임', '좀', '수', '것', '때', '안', '못', '더', '잘']);
/** 낱말 모음 (조사 대충 떼기) */
export function words(body) {
  const t = String(body ?? '').replace(/^\s*\[[^\]]+\]\s*/, '').toLowerCase();
  const out = new Set();
  for (let w of t.split(/[^0-9a-z가-힣]+/)) {
    w = w.replace(/(은|는|이|가|을|를|에|에서|으로|로|도|만|요|이요|에요|예요|해요|했어요|돼요|되요|와|과|의)$/, '');
    if (w.length >= 2 && !STOP.has(w)) out.add(w);
  }
  return out;
}
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n);
};
/** 낱말 앞 두 글자 (「낚시하다」·「낚시」, 「사라졌어」·「사라져」를 같게 본다) */
export const stems = (w) => new Set([...w].map((x) => [...x].slice(0, 2).join('')));
/** 비슷한 편지 묶기 (낱말 줄기가 이만큼 겹치면 같은 묶음 · 먼저 온 편지가 대표) */
export function clusterSimilar(list, th = 0.3) {
  const groups = [];
  for (const l of list) {
    const w = words(l.body);
    const st = stems(w);
    const g = groups.find((x) => jaccard(x.st, st) >= th || [...st].filter((y) => x.st.has(y)).length >= 3);
    if (g) {
      g.items.push(l);
      for (const y of w) g.w.add(y);
      for (const y of st) g.st.add(y);
    } else groups.push({ w: new Set(w), st, items: [l] });
  }
  return groups.map((g) => ({ keys: [...g.w].slice(0, 5), items: g.items })).sort((a, b) => b.items.length - a.items.length);
}

/** 금화 흐름 이상: 오늘 gold_gain total(사람마다 가장 큰 값) — 가운데값에서 크게 벗어난 사람 */
export function goldOutliers(events, { mult = 8, minTotal = 200000 } = {}) {
  const by = new Map();
  for (const e of events) {
    if (e.name !== 'gold_gain') continue;
    const tot = Number(e.props?.total ?? 0);
    const k = e.user_id ?? e.device_id ?? '?';
    const cur = by.get(k);
    if (!cur || tot > cur.total) by.set(k, { who: k, total: tot, props: e.props ?? {} });
  }
  const list = [...by.values()].sort((a, b) => b.total - a.total);
  const vals = list.map((x) => x.total).sort((a, b) => a - b);
  const med = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  const out = list.filter((x) => x.total >= minTotal && x.total > Math.max(1, med) * mult).map((x) => {
    // 가장 큰 출처 (total 빼고)
    const src = Object.entries(x.props).filter(([k, v]) => k !== 'total' && k !== 'day' && typeof v === 'number').sort((a, b) => b[1] - a[1])[0];
    return { ...x, top: src ? `${src[0]} ${Math.round((src[1] / Math.max(1, x.total)) * 100)}%` : '' };
  });
  return { median: med, users: list.length, outliers: out };
}

export function summarize(d) {
  const ev = d.events ?? [];
  const today = new Set(ev.filter((e) => e.device_id).map((e) => e.device_id));
  const fresh = new Set(ev.filter((e) => e.name === 'first_run' && e.device_id).map((e) => e.device_id));
  const [s] = dayRange(d.date);
  const [s3] = dayRange(d.date, -2);
  const old = new Set((d.week ?? []).filter((e) => e.created_at < s3).map((e) => e.device_id));
  const recent = new Set([...(d.week ?? []).filter((e) => e.created_at >= s3 && e.created_at < s).map((e) => e.device_id), ...today]);
  const churn = [...old].filter((x) => x && !recent.has(x));
  const errs = new Map();
  for (const e of ev.filter((x) => x.name === 'error')) {
    const msg = String(e.props?.msg ?? e.props?.message ?? '?').slice(0, 120);
    const g = errs.get(msg) ?? { msg, n: 0, ver: new Set(), dev: new Set() };
    g.n++;
    if (e.app_version) g.ver.add(e.app_version);
    if (e.device_id) g.dev.add(e.device_id);
    errs.set(msg, g);
  }
  const nick = new Map((d.profiles ?? []).map((p) => [p.id, p.nickname]));
  const newAccounts = (d.profiles ?? []).filter((p) => p.created_at >= s && p.created_at < dayRange(d.date)[1]).length;
  const letters = (d.letters ?? []).map((l) => ({ ...l, kind: letterKind(l.body), who: nick.get(l.user_id) ?? '?' }));
  const byKind = {};
  for (const k of ['버그', '건의', '칭찬', '기타']) {
    const list = letters.filter((l) => l.kind === k);
    if (list.length) byKind[k] = clusterSimilar(list);
  }
  const gold = goldOutliers(ev);
  for (const o of gold.outliers) o.nick = nick.get(o.who) ?? o.who.slice(0, 8);
  return {
    date: d.date,
    devices: today.size,
    newDevices: fresh.size,
    newAccounts,
    churn: churn.length,
    errors: [...errs.values()].sort((a, b) => b.n - a.n).map((g) => ({ msg: g.msg, n: g.n, devices: g.dev.size, ver: [...g.ver].join(', ') })),
    letters: letters.length,
    byKind,
    gold,
    chat: (d.chat ?? []).filter((c) => c.channel === 'world').length,
    notices: (d.chat ?? []).filter((c) => c.channel === 'notice').length,
  };
}

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export function renderMd(r) {
  const L = [];
  L.push(`# 운영 요약 · ${r.date}`, '');
  L.push(`- 오늘 접속 기기 **${r.devices}** · 처음 온 기기 ${r.newDevices} · 새 계정 ${r.newAccounts}`);
  L.push(`- 이탈(3~7일 전엔 왔는데 최근 3일 안 온 기기) ${r.churn}`);
  L.push(`- 오류 ${r.errors.reduce((s, e) => s + e.n, 0)}건 (${r.errors.length}종) · 새 제보 ${r.letters}통 · [세계] 채팅 ${r.chat}줄 · [알림] ${r.notices}줄`, '');
  L.push('## 오류');
  if (!r.errors.length) L.push('- 없음');
  for (const e of r.errors.slice(0, 10)) L.push(`- ${e.n}회 · 기기 ${e.devices} · ${e.ver || '버전 ?'} — \`${oneLine(e.msg).replace(/`/g, "'")}\``);
  L.push('', '## 새 제보');
  if (!r.letters) L.push('- 없음');
  for (const [k, groups] of Object.entries(r.byKind)) {
    L.push(`### ${k} (${groups.reduce((s, g) => s + g.items.length, 0)})`);
    for (const g of groups) {
      if (g.items.length > 1) L.push(`- **비슷한 것 ${g.items.length}통** (${g.keys.join(', ')})`);
      for (const l of g.items) L.push(`${g.items.length > 1 ? '  ' : ''}- #${l.id} ${l.who} · ${l.app_version ?? ''} — ${oneLine(l.body.replace(/^\s*\[[^\]]+\]\s*/, '')).slice(0, 140)}`);
    }
  }
  L.push('', '## 금화 흐름');
  L.push(`- 오늘 금화 기록 ${r.gold.users}명 · 가운데값 ${r.gold.median.toLocaleString('ko-KR')}G`);
  if (!r.gold.outliers.length) L.push('- 이상 없음');
  for (const o of r.gold.outliers) L.push(`- ⚠ ${o.nick}: ${o.total.toLocaleString('ko-KR')}G (가운데값의 ${Math.round(o.total / Math.max(1, r.gold.median))}배)${o.top ? ` · 가장 큰 출처 ${o.top}` : ''}`);
  L.push('', `_만든 시각 ${new Date().toISOString()} · tools/ops_report.mjs (읽기 전용)_`, '');
  return L.join('\n');
}

// ───────── 실행 ─────────

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
async function main() {
  const date = arg('--date') ?? kstDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('--date는 YYYY-MM-DD 꼴로');
    process.exitCode = 2;
    return;
  }
  const dry = process.argv.includes('--dry');
  let data;
  if (dry) {
    const fx = arg('--fixture') ?? 'tests/fixtures/ops_sample.json';
    const raw = JSON.parse(readFileSync(fx, 'utf8'));
    data = { ...raw, date: arg('--date') ?? raw.date };
    console.error(`(--dry) ${fx}의 가짜 데이터로 만들어요 — 서버에 연결하지 않아요`);
  } else {
    const env = { ...readEnv('.env'), ...readEnv('.env.ops'), ...process.env };
    const miss = missingEnv(env);
    if (miss.length) {
      console.error(`필요한 값이 없어요: ${miss.join(', ')}`);
      console.error('  .env.ops 파일(이 폴더 · git에 안 올라감)에 이렇게 적어 주세요:');
      console.error('    SUPABASE_URL=https://<프로젝트>.supabase.co');
      console.error('    SUPABASE_SERVICE_ROLE_KEY=<대시보드 → Project Settings → API → service_role>');
      console.error('  서버 없이 모양만 보려면: node tools/ops_report.mjs --dry');
      process.exitCode = 2;
      return;
    }
    data = await collect(env, date);
  }
  const md = renderMd(summarize(data));
  mkdirSync('reports', { recursive: true });
  const out = `reports/ops_${data.date.replace(/-/g, '')}${dry ? '_dry' : ''}.md`;
  writeFileSync(out, md);
  console.log(out);
}
if (process.argv[1] && /ops_report\.mjs$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(String(e?.message ?? e));
    process.exitCode = 1;
  });
}
