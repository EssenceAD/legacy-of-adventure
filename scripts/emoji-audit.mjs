// VISUAL §5 아이콘 한 벌: src 안 UI 글자에 쓴 이모지를 모아 → reports/visual/emoji_icons.md (디자이너에게 넘길 도트 아이콘 목록)
//  그림은 안 바꾼다. 이모지마다 몇 번 · 어디서 · 제안 아이콘 이름 + 크기(24px 단독 아이콘 / 16px 글자 사이 아이콘)
//  주석 줄은 뺀다 (글자 안의 이모지만). 실행: node scripts/emoji-audit.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'src';
const OUT = 'reports/visual/emoji_icons.md';
// 그림 문자(이모지) + 자주 쓰는 기호 몇 개(★☆☾☀♥✓✕ 같은 글꼴 기호는 Galmuri에 있어서 뺀다)
const EMOJI = /(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)/gu;
const FONT_OK = new Set(['©', '®', '™', '↔', '↕', '↩', '↪', '▶', '◀', '☀', '☁', '☾', '☽', '★', '☆', '♥', '♡', '✓', '✔', '✕', '✖', '❤', '‼', '⁉', '↻', '⌨']);

/** 이모지 → [제안 이름, 쓰임] (없으면 코드포인트 이름) */
const NAME = {
  '🎯': ['ic_goal', '오늘의 목표'], '💰': ['ic_gold_bag', '금화 묶음'], '🪨': ['ic_stone', '돌·광석'], '🧿': ['ic_charm', '부적'], '🎣': ['ic_fishing', '낚시'],
  '⚔': ['ic_battle', '전투·사냥 중'], '✨': ['ic_sparkle', '축복·반짝'], '📷': ['ic_camera', '사진'], '💌': ['ic_letter_heart', '단골 제안·편지'], '🔒': ['ic_lock', '잠김'],
  '🔓': ['ic_unlock', '열림'], '🏆': ['ic_trophy', '랭킹·업적'], '⭐': ['ic_star', '별'], '🌟': ['ic_star_big', '큰 별'], '🔥': ['ic_fire', '불·연속'], '💎': ['ic_gem', '보석'],
  '📜': ['ic_scroll', '두루마리·의뢰'], '🍺': ['ic_beer', '주점'], '🍻': ['ic_cheers', '술자리'], '🎁': ['ic_gift', '선물'], '💬': ['ic_chat', '채팅'], '🌙': ['ic_moon', '밤'],
  '🛏': ['ic_bed', '방'], '🏠': ['ic_house', '집'], '🏡': ['ic_house_garden', '집'], '🌱': ['ic_sprout', '씨앗·텃밭'], '🌾': ['ic_wheat', '수확'], '🍀': ['ic_clover', '행운'],
  '💀': ['ic_skull', '위험·패배'], '🐟': ['ic_fish', '물고기'], '🐠': ['ic_fish_rare', '물고기'], '🎲': ['ic_dice', '주사위'], '🔨': ['ic_hammer', '대장간·건설'], '⚒': ['ic_tools', '공사'],
  '🛡': ['ic_shield', '방어'], '🗡': ['ic_dagger', '무기'], '🏹': ['ic_bow', '활'], '🧪': ['ic_potion', '연금술'], '⚗': ['ic_alembic', '연금술'], '📦': ['ic_box', '상자'],
  '🔔': ['ic_bell', '알림'], '📢': ['ic_megaphone', '소문·공지'], '🎉': ['ic_party', '축하'], '🎊': ['ic_confetti', '축하'], '👑': ['ic_crown', '보스·1등'], '❗': ['ic_alert', '알림'],
  '❓': ['ic_question', '도움말'], '⏳': ['ic_hourglass', '기다림'], '⌛': ['ic_hourglass', '기다림'], '⏰': ['ic_clock', '시간'], '📅': ['ic_calendar', '날짜'], '🗓': ['ic_calendar', '날짜'],
  '📖': ['ic_book', '장부·안내서'], '📕': ['ic_book_red', '책'], '📚': ['ic_books', '서재'], '🔁': ['ic_repeat', '반복'], '🔄': ['ic_refresh', '새로고침'], '🎵': ['ic_note', '노래'],
  '🎶': ['ic_notes', '노래'], '🌸': ['ic_blossom', '봄'], '❄': ['ic_snow', '겨울'], '🍂': ['ic_leaf', '가을'], '☔': ['ic_rain', '비'], '🌧': ['ic_rain', '비'], '🌈': ['ic_rainbow', '무지개'],
  '👍': ['ic_like', '좋아요'], '💕': ['ic_hearts', '케미'], '💖': ['ic_heart_shine', '호감'], '💔': ['ic_heart_broken', '실연'], '😊': ['ic_face_smile', '기분'], '😢': ['ic_face_sad', '기분'],
  '🐉': ['ic_dragon', '보스'], '👻': ['ic_ghost', '유령'], '🕯': ['ic_candle', '예배당'], '⛪': ['ic_chapel', '예배당'], '🗺': ['ic_map', '지도·원정'], '🧭': ['ic_compass', '길잡이'],
  '🚪': ['ic_door', '입구'], '🪙': ['ic_coin', '금화'], '💵': ['ic_money', '돈'], '📈': ['ic_up', '오름'], '📉': ['ic_down', '내림'], '🧹': ['ic_broom', '정리'], '🗑': ['ic_trash', '지우기'],
  '✉': ['ic_mail', '우편'], '📮': ['ic_postbox', '우체국'], '📬': ['ic_mailbox', '우편함'], '🐎': ['ic_horse', '마구간'], '🐴': ['ic_horse', '마구간'], '🔮': ['ic_orb', '마법사의 탑'],
  '⚡': ['ic_bolt', '번개·빠름'], '💤': ['ic_sleep', '잠'], '🎆': ['ic_firework', '불꽃놀이'], '🎇': ['ic_sparkler', '불꽃놀이'], '🗿': ['ic_statue', '동상'], '🌳': ['ic_tree', '나무'],
  '💭': ['ic_thought', '속마음·생각'], '🖌': ['ic_brush', '꾸미기'], '🌷': ['ic_tulip', '꽃·장식'], '⚠': ['ic_warning', '주의'], '📏': ['ic_ruler', '땅 넓이'],
  '🌲': ['ic_pine', '숲'], '🏰': ['ic_castle', '성'], '🧙': ['ic_wizard', '마법사'], '🧝': ['ic_elf', '엘프'], '🧚': ['ic_fairy', '요정'], '🐺': ['ic_wolf', '늑대'], '🦴': ['ic_bone', '뼈'],
};
const nameOf = (e) => NAME[e.replace(/️/g, '')]?.[0] ?? 'ic_u' + [...e.replace(/️/g, '')].map((c) => c.codePointAt(0).toString(16)).join('_');
const useOf = (e) => NAME[e.replace(/️/g, '')]?.[1] ?? '';

function* files(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(d.name)) yield p;
  }
}
/** 줄 끝 // 주석 떼기 (따옴표 짝이 맞을 때만) */
function stripComment(line) {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '\\') i++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

const hits = new Map();
for (const f of [...files(ROOT), 'index.html']) {
  const rel = f.replace(/\\/g, '/');
  fs.readFileSync(f, 'utf8').split('\n').forEach((raw, i) => {
    const line = stripComment(raw);
    for (const m of line.matchAll(EMOJI)) {
      const e = m[1];
      if (FONT_OK.has(e.replace(/️/g, ''))) continue;
      // 혼자 쓴 문자열('🎯' · icon: '🔁')이면 단독 아이콘(24px) · 글 사이면 16px
      const solo = new RegExp(`['"\`]${e}\\uFE0F?['"\`]`, 'u').test(line) || /icon\s*:/.test(line);
      const h = hits.get(e) ?? { n: 0, solo: 0, where: new Map() };
      h.n++;
      if (solo) h.solo++;
      h.where.set(rel, [...(h.where.get(rel) ?? []), i + 1]);
      hits.set(e, h);
    }
  });
}
const rows = [...hits.entries()].sort((a, b) => b[1].n - a[1].n);
const md = [
  '# 이모지 → 도트 아이콘 목록 (VISUAL §5 아이콘 한 벌)',
  '',
  `\`node scripts/emoji-audit.mjs\` 가 만듦 · ${new Date().toISOString().slice(0, 10)} · 이모지 ${rows.length}종 · ${rows.reduce((s, [, h]) => s + h.n, 0)}곳 (주석 제외, src 기준)`,
  '',
  '크기: **24px** = 혼자 쓰는 아이콘(칸·버튼·제목 앞) · **16px** = 글 사이에 끼는 작은 아이콘. 그림은 금테 도트 아이콘(assets/icons) 규칙 그대로 — 24px 그림 + 16px 판(`_16`).',
  '',
  '| 이모지 | 횟수 | 제안 이름 | 크기 | 쓰임 | 어디서 (파일:줄) |',
  '|---|---:|---|---|---|---|',
  ...rows.map(([e, h]) => {
    const where = [...h.where.entries()].map(([f, ls]) => `${f.replace(/^src\//, '')}:${ls.slice(0, 4).join(',')}${ls.length > 4 ? `…(+${ls.length - 4})` : ''}`);
    return `| ${e} | ${h.n} | \`${nameOf(e)}\` | ${h.solo * 2 >= h.n ? '24 (+16)' : '16'} | ${useOf(e)} | ${where.slice(0, 6).join(' · ')}${where.length > 6 ? ` · 외 ${where.length - 6}파일` : ''} |`;
  }),
  '',
];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md.join('\n'));
console.error(`✓ ${OUT} · 이모지 ${rows.length}종 · ${rows.reduce((s, [, h]) => s + h.n, 0)}곳`);
