// 상황 → 곡 목록 (public/audio/bgm/{번호}_{이름}.mp3, 27곡 · 19~27은 MUSIC_PLAN 「2차 추가」)
import type { RegionId } from '../data/items';

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
  '19': { file: '19_endless_abyss', name: '끝없는 심연' },
  '20': { file: '20_wind_over_fields', name: '바람 부는 들판' },
  '21': { file: '21_salt_and_sand', name: '소금과 모래' },
  '22': { file: '22_ember_and_cloud', name: '잿불과 구름' },
  '23': { file: '23_giants_footsteps', name: '거인의 발소리' },
  '24': { file: '24_all_together', name: '다 같이, 하나의 적' },
  '25': { file: '25_five_stars', name: '다섯 별의 원정대' },
  '26': { file: '26_rainy_window', name: '비 오는 여관 창가' },
  '27': { file: '27_lantern_lane', name: '등불 골목' },
};
export type Scene =
  | 'title' | 'day' | 'night'
  | 'hunt_forest' | 'hunt_deep' | 'hunt_coast' | 'hunt_fire'
  | 'raid' | 'raid2' | 'abyss_rush' | 'world_raid' | 'five'
  | 'eval' | 'neighbor' | 'bond' | 'ember' | 'ending_adv' | 'ending_inn' | 'none';
export const PLAYLISTS: Record<Exclude<Scene, 'none'>, string[]> = {
  title: ['01'],
  day: ['02', '03', '04', '05', '26'],
  night: ['06', '07', '08', '27'],
  // 사냥: 지역 묶음마다 2곡 번갈아 (huntScene)
  hunt_forest: ['09', '20'],
  hunt_deep: ['10'],
  hunt_coast: ['21', '10'],
  hunt_fire: ['22', '10'],
  raid: ['11', '23'],
  raid2: ['12'],
  /** RAIDWEAPON §1 심연 보스 연전 · §3 월드 레이드 (그 화면이 battleMusic.special로 켠다) */
  abyss_rush: ['19'],
  world_raid: ['24'],
  /** FIVESTARS 합류 컷 · 「다섯 별」 세트 첫 전투(4명 컷) */
  five: ['25'],
  eval: ['13'],
  neighbor: ['14'],
  bond: ['15'],
  ember: ['16'],
  ending_adv: ['17'],
  ending_inn: ['18'],
};
/** 마을 곡: 섞어 틀기 + 곡 사이 쉼 (그 밖은 끝나면 바로 · 곡이 여럿이면 번갈아, 하나면 처음부터) */
export const VILLAGE = new Set<Scene>(['day', 'night']);

/** 사냥 지역 → 곡 묶음: 숲·늪 / 해안·모래시계 유적 / 화산·구름 정원·심연의 바닥 / 그 밖(폐광·얼음·별의 심연) */
const HUNT_GROUP: Record<RegionId, Scene> = {
  forest: 'hunt_forest',
  swamp: 'hunt_forest',
  mine: 'hunt_deep',
  ice: 'hunt_deep',
  abyss: 'hunt_deep',
  coast: 'hunt_coast',
  dune: 'hunt_coast',
  ember: 'hunt_fire',
  sky: 'hunt_fire',
  deep: 'hunt_fire',
};
export const huntScene = (region: string): Scene => HUNT_GROUP[region as RegionId] ?? 'hunt_deep';

/** 전투 화면 곡: 특별한 전투(다섯 별 · 보스 연전 · 월드 레이드)가 먼저 · 토벌은 체력 30% 아래로 「마지막 일격」 */
export type BattleSpecial = null | 'five' | 'abyss_rush' | 'world_raid';
export function battleScene(kind: 'hunt' | 'raid', b: { huntRegion: string; raidLow: boolean; special: BattleSpecial }): Scene {
  if (b.special) return b.special;
  if (kind === 'raid') return b.raidLow ? 'raid2' : 'raid';
  return huntScene(b.huntRegion);
}
