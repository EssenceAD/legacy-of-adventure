// 상황 → 곡 목록 (public/audio/bgm/{번호}_{이름}.mp3, 18곡)
export const TRACKS: Record<string, { file: string; name: string }> = {
  '01': { file: '01_legacy_of_adventure', name: '모험의 유산' },
  '02': { file: '02_morning_firewood', name: '장작 패는 아침' },
  '03': { file: '03_inn_afternoon', name: '여관의 오후' },
  '04': { file: '04_market_day', name: '장날' },
  '05': { file: '05_breezy_hill', name: '산들바람 언덕' },
  '06': { file: '06_by_the_campfire', name: '모닥불 곁에서' },
  '07': { file: '07_starlight_music_box', name: '별빛 오르골' },
  '08': { file: '08_sleeping_inn', name: '잠든 여관' },
  '09': { file: '09_run_the_forest_path', name: '숲길을 달려라' },
  '10': { file: '10_into_the_deep', name: '깊은 곳으로' },
  '11': { file: '11_king_of_the_forest', name: '숲의 왕' },
  '12': { file: '12_final_strike', name: '마지막 일격' },
  '13': { file: '13_feathered_hat_march', name: '깃털 모자 행진' },
  '14': { file: '14_neighbors_yard', name: '남의 집 마당' },
  '15': { file: '15_night_face_to_face', name: '마주 앉은 밤' },
  '16': { file: '16_old_map_in_the_attic', name: '다락의 낡은 지도' },
  '17': { file: '17_back_on_the_road', name: '다시 길 위로' },
  '18': { file: '18_this_is_my_place', name: '여기가 내 자리' },
};
export type Scene =
  | 'title' | 'day' | 'night' | 'hunt_forest' | 'hunt_deep' | 'raid' | 'raid2' | 'eval' | 'neighbor' | 'bond' | 'ember' | 'ending_adv' | 'ending_inn' | 'none';
export const PLAYLISTS: Record<Exclude<Scene, 'none'>, string[]> = {
  title: ['01'],
  day: ['02', '03', '04', '05'],
  night: ['06', '07', '08'],
  hunt_forest: ['09'],
  hunt_deep: ['10'],
  raid: ['11'],
  raid2: ['12'],
  eval: ['13'],
  neighbor: ['14'],
  bond: ['15'],
  ember: ['16'],
  ending_adv: ['17'],
  ending_inn: ['18'],
};
/** 마을 곡: 섞어 틀기 + 곡 사이 쉼 (그 밖은 끝나면 바로 처음부터) */
export const VILLAGE = new Set<Scene>(['day', 'night']);
