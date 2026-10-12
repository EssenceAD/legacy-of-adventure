// GROWTH §3-5 고유 장비 (이름 있는 장비) — 지역마다 3개(무기·갑옷·장신구). 등급은 유물(a) 고정, 고유 옵션 1개 + 일반 옵션 3개.
// 나오는 곳: 그 지역 사냥 보스(x-10) 0.5% · 그 지역 토벌 보스 처치 1% · 고지역 8시간 원정 0.3%
// 처음 얻으면 [알림] 채팅 + 도감 「고유 장비」 칸. 같은 것 두 번째부터는 분해 시 별빛 가루 2배.
// opt: 기존 OptKey 그대로(값은 일반 최대치의 1.5~2배) · special: 새 효과 키(코드에서 구현) — 없으면 null
export interface UniqueDef {
  id: string; region: string; slot: 'weapon' | 'armor' | 'acc'; wkind?: 'sword' | 'axe' | 'staff' | 'dagger' | 'book' | 'bow';
  name: string; lore: string;
  opt: { k: 'atkPct' | 'timeCut' | 'goldPct' | 'hpSave' | 'regionDmg' | 'chemPct' | 'xpPct'; v: number };
  special: { key: string; text: string } | null;
}

export const UNIQUES: UniqueDef[] = [
  // 숲 동굴
  { id: 'u_forest_w', region: 'forest', slot: 'weapon', wkind: 'sword', name: '도토리 깎은 나무검', lore: '거대 너구리가 아끼던 도토리로 깎았다. 휘두르면 고소한 냄새가 난다.', opt: { k: 'regionDmg', v: 30 }, special: { key: 'firstHitStun', text: '사냥 첫 공격이 적을 1초 멈춤' } },
  { id: 'u_forest_a', region: 'forest', slot: 'armor', name: '이끼 망토', lore: '숲에서 길 잃은 아이를 사흘 동안 덮어 준 망토.', opt: { k: 'hpSave', v: 30 }, special: null },
  { id: 'u_forest_c', region: 'forest', slot: 'acc', name: '첫 단골의 단추', lore: '이 여관 첫 손님이 떨어뜨리고 간 단추. 왠지 버릴 수가 없다.', opt: { k: 'chemPct', v: 20 }, special: { key: 'regularMood', text: '이 장비를 낀 단골은 기분이 잘 안 떨어짐' } },
  // 버섯 늪
  { id: 'u_swamp_w', region: 'swamp', slot: 'weapon', wkind: 'staff', name: '왕슬라임 젤리 지팡이', lore: '말랑하다. 정말 말랑하다. 그런데 아프다.', opt: { k: 'atkPct', v: 14 }, special: { key: 'bounce', text: '공격이 근처 적 하나에 튕김(50%)' } },
  { id: 'u_swamp_a', region: 'swamp', slot: 'armor', name: '포자 방어복', lore: '늪지기 할머니가 기워 준 옷. 버섯 냄새는 빠지지 않는다.', opt: { k: 'hpSave', v: 35 }, special: null },
  { id: 'u_swamp_c', region: 'swamp', slot: 'acc', name: '반딧불 병', lore: '밤길을 밝히는 작은 병. 열면 반딧불이 돌아오지 않는다.', opt: { k: 'goldPct', v: 25 }, special: { key: 'nightGold', text: '밤에 끝난 원정 금화 +15%' } },
  // 폐광
  { id: 'u_mine_w', region: 'mine', slot: 'weapon', wkind: 'axe', name: '붉은 무사의 부러진 칼', lore: '반으로 부러졌는데 오히려 더 잘 든다.', opt: { k: 'atkPct', v: 16 }, special: { key: 'crit', text: '치명타 +8%' } },
  { id: 'u_mine_a', region: 'mine', slot: 'armor', name: '광부의 등불 갑옷', lore: '가슴에 등불이 달려 있다. 어두운 곳에서 동료가 길을 잃지 않게.', opt: { k: 'regionDmg', v: 35 }, special: { key: 'partyHp', text: '파티 전원 받는 피해 −5%' } },
  { id: 'u_mine_c', region: 'mine', slot: 'acc', name: '녹슨 행운의 곡괭이 펜던트', lore: '「이번 삽질에서 나온다」 — 모든 광부의 거짓말.', opt: { k: 'goldPct', v: 28 }, special: { key: 'matPlus', text: '지역 재료 +1' } },
  // 얼음 협곡
  { id: 'u_ice_w', region: 'ice', slot: 'weapon', wkind: 'dagger', name: '텐구 깃털 단검', lore: '던지면 바람을 타고 돌아온다. 가끔은 안 돌아온다.', opt: { k: 'atkPct', v: 18 }, special: { key: 'speed', text: '공격 속도 +10%' } },
  { id: 'u_ice_a', region: 'ice', slot: 'armor', name: '설원 수호자의 털옷', lore: '눈보라 속에서 사흘을 버틴 기사가 입었던 옷.', opt: { k: 'hpSave', v: 40 }, special: { key: 'reviveOnce', text: '사냥에서 한 번 쓰러지면 체력 30%로 일어남' } },
  { id: 'u_ice_c', region: 'ice', slot: 'acc', name: '녹지 않는 눈송이', lore: '손에 쥐면 차갑지 않다. 누군가의 마음처럼.', opt: { k: 'xpPct', v: 25 }, special: null },
  // 별의 심연
  { id: 'u_abyss_w', region: 'abyss', slot: 'weapon', wkind: 'book', name: '별지기의 일기장', lore: '마지막 장이 비어 있다. 누군가 이어 쓰기를 기다리는 것처럼.', opt: { k: 'atkPct', v: 20 }, special: { key: 'starBond', text: '전설 인연 게이지 +20%' } },
  { id: 'u_abyss_a', region: 'abyss', slot: 'armor', name: '돌아온 자의 망토', lore: '심연에서 돌아온 유일한 모험가가 입었다는 망토. 이름은 지워져 있다.', opt: { k: 'regionDmg', v: 40 }, special: { key: 'partyHp', text: '파티 전원 받는 피해 −8%' } },
  { id: 'u_abyss_c', region: 'abyss', slot: 'acc', name: '창가 방 열쇠', lore: '어느 여관 맨 위층 창가 방 열쇠. 모모가 보면 이상하게 조용해진다.', opt: { k: 'chemPct', v: 25 }, special: { key: 'allStat', text: '모든 능력치 +5%' } },
];
