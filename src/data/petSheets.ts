// 만든 파일 — node scripts/copy-pet-sheets.mjs 가 asset_raw/pets/sheets.json에서 만든다 (손으로 고치지 않기)
//  펫 걷기 시트 public/assets/pets/pet_<id>_sheet.png: 한 줄 [앞 서기, 앞 걷기1, 앞 걷기2, 뒤 서기, 뒤 걷기1, 뒤 걷기2] · 칸 cw×ch · 발은 칸 아래 가운데
export interface PetSheet {
  cw: number;
  ch: number;
  frames: number;
  /** 뒷모습(3~5칸)이 있나 — 없으면 위로 갈 때도 앞모습 */
  back: boolean;
}
export const PET_SHEETS: Record<string, PetSheet> = {
  griffin: { cw: 23, ch: 25, frames: 6, back: true },
  mole: { cw: 22, ch: 26, frames: 6, back: true },
  otter: { cw: 23, ch: 23, frames: 6, back: true },
  puppy: { cw: 19, ch: 18, frames: 6, back: true },
  raccoon: { cw: 19, ch: 19, frames: 6, back: true },
  salamander: { cw: 22, ch: 20, frames: 6, back: true },
  slime: { cw: 18, ch: 19, frames: 6, back: true },
  starcat: { cw: 18, ch: 19, frames: 6, back: true },
  starfox: { cw: 19, ch: 19, frames: 6, back: true },
  tengu: { cw: 20, ch: 24, frames: 6, back: true },
};
