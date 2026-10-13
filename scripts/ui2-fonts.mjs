// VISUAL §5 uiKitV2: 「글자 크기 3개만」 — style.css 의 px 직접값 font-size 를 찾아 body.ui2 일 때 3개 변수로 덮는 규칙을 만든다
//  변수(--f-*)로 쓴 곳은 style.css 의 body.ui2{--f-ui:var(--fs-body) …} 한 줄이 바꾸므로, 여기선 px·max()·calc() 직접값만.
//  크기 → 변수: ≤12px 작은 글(--fs-small) · 13~17px 본문(--fs-body) · 18~23px 제목(--fs-title) · 24px 이상(로고·큰 숫자 연출)은 그대로
//  연출용 글자(타이틀 로고 · 전투 피해 숫자 · 컷신)는 SHOW 목록으로 빼서 그대로
//  덮는 규칙은 :where(body.ui2) 로 원래 선택자와 같은 우선순위 → 원래 규칙끼리의 순서·우선순위를 그대로 따른다
//  실행: node scripts/ui2-fonts.mjs   (style.css 안 「ui2-fonts:begin ~ end」 사이를 다시 쓴다 · 없으면 끝에 붙인다)
import fs from 'node:fs';

const FILE = 'src/style.css';
const BEGIN = '/* ui2-fonts:begin — scripts/ui2-fonts.mjs 가 만듦 (손으로 고치지 말 것) */';
const END = '/* ui2-fonts:end */';
let css = fs.readFileSync(FILE, 'utf8');
const crlf = css.includes('\r\n');
css = css.replace(/\r\n/g, '\n');
const b = css.indexOf(BEGIN);
const e = css.indexOf(END);
const src = b >= 0 ? css.slice(0, b) + css.slice(e + END.length) : css;

/** 크기 값 → 변수 (null = 그대로 둔다) */
function pick(v) {
  v = v.trim();
  let m = v.match(/^(\d+(?:\.\d+)?)px$/);
  if (m) {
    const px = +m[1];
    if (px === 0) return null;
    return px <= 12 ? 'small' : px <= 17 ? 'body' : px <= 23 ? 'title' : null;
  }
  if (/^max\(\s*\d+px\s*,\s*var\(--f-ui\)\s*\)$/.test(v)) return 'body';
  m = v.match(/^calc\(\s*var\(--f-(ui|small|big)\)\s*\*\s*([\d.]+)\s*\)$/);
  if (m) {
    const k = +m[2];
    // 줄여 쓴 것(×0.8)은 작은 글 · 조금 키운 것(×1.1~1.4)은 제목 · 그보다 크면 연출용 큰 숫자(그대로)
    if (k < 1) return m[1] === 'big' ? 'body' : 'small';
    if (k <= 1.45) return m[1] === 'big' ? null : 'title';
    return null;
  }
  return null;
}

const SHOW = /\.logo|\.dmg\b|\.cbbanner|\.tkills|#rTimer|#storyFx|\.px::/;

/** 선택자 하나 → :where(body.ui2) 를 붙인 선택자 (붙일 수 없으면 null) */
function scope(sel) {
  sel = sel.trim();
  if (!sel || sel.startsWith(':root')) return null;
  // body.ui2 블록(실험실)은 이미 변수로 쓴다
  if (/body\.(ui2|hud2)/.test(sel)) return null;
  // 연출(타이틀 로고 · 전투 피해 숫자 · 컷신 · 판 장식 「+」)은 글자가 아니라 그림처럼 쓰므로 그대로
  if (SHOW.test(sel)) return null;
  const m = sel.match(/^(html(?:\[[^\]]*\]|:not\([^)]*\)|\.[\w-]+)*)(\s+.*)?$/);
  if (m) return m[2] ? `${m[1]} :where(body.ui2)${m[2]}` : null;
  const bm = sel.match(/^body((?:\.[\w-]+|:has\([^)]*\)|:not\([^)]*\))*)(\s+.*)?$/);
  if (bm) return `body:where(.ui2)${bm[1]}${bm[2] ?? ''}`;
  return `:where(body.ui2) ${sel}`;
}

/** 아주 작은 CSS 읽기: 주석 · @media/@supports 안쪽 · @keyframes(건너뜀) · 규칙 */
function walk(text, out, wrap) {
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('/*', i)) {
      i = text.indexOf('*/', i + 2) + 2;
      continue;
    }
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const head = text.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    // 짝 맞는 } 찾기
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth) {
      if (text.startsWith('/*', j)) {
        j = text.indexOf('*/', j + 2) + 2;
        continue;
      }
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith('@media') || head.startsWith('@supports')) walk(body, out, head);
    else if (!head.startsWith('@')) {
      const decl = [...body.matchAll(/(?:^|;)\s*font-size\s*:\s*([^;!]+?)\s*(!important)?\s*(?=;|$)/g)].pop();
      if (decl) {
        const k = pick(decl[1]);
        if (k) {
          const sels = head.split(/,(?![^(]*\))/).map(scope).filter(Boolean);
          if (sels.length) out.push({ wrap, rule: `${sels.join(',')}{font-size:var(--fs-${k})${decl[2] ? '!important' : ''}}`, from: decl[1] });
        }
      }
    }
    i = j;
  }
}

const out = [];
walk(src, out, null);
const lines = [];
let lastWrap = null;
for (const r of out) {
  if (r.wrap !== lastWrap) {
    if (lastWrap) lines.push('}');
    if (r.wrap) lines.push(`${r.wrap}{`);
    lastWrap = r.wrap;
  }
  lines.push(r.rule);
}
if (lastWrap) lines.push('}');
const block = `${BEGIN}\n${lines.join('\n')}\n${END}`;
const next = b >= 0 ? css.slice(0, b) + block + css.slice(e + END.length) : css.replace(/\s*$/, '\n') + block + '\n';
fs.writeFileSync(FILE, crlf ? next.replace(/\n/g, '\r\n') : next);
const by = out.reduce((m, r) => ((m[r.from] = (m[r.from] ?? 0) + 1), m), {});
console.error(`✓ ui2 글자 덮기 ${out.length}곳`, by);
