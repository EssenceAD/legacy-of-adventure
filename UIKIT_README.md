# 「모험의 유산」 UI 키트 v1 + 5단계 그림 — README
(zip: 모험의유산_UI키트_5단계.zip · 폴더 ui/ icons/ monsters/ props/ + STAGE5_SPEC.md)

## 0. 깨지지 않게 그리는 규칙 (가장 중요)
- 모든 그림은 정수 배율로만. CSS `image-rendering: pixelated;` · 캔버스 `imageSmoothingEnabled = false`
- 기기 픽셀까지 정수가 되게: 배율 k(원본 1px이 화면 기기 픽셀 몇 개인지)를 정수로 정하고 CSS 크기 = 원본 × k / devicePixelRatio
- 9분할(창·버튼·바)은 `border-image: url(x.png) {slice} fill / {slice × 배율}px stretch;` — slice×배율도 정수
- 위치(left/top)도 정수 px. 확대 애니메이션 중엔 흐려져도 끝나면 정수로
- 모든 PNG는 알파 0/255만(반투명 가장자리 없음). 팔레트 23색 안에서만

## 1. ui/ — 1px 단위로 찍은 UI 부품 (ui/ui_meta.json에 크기·slice·용도)
- panel (24×24, slice 8): 모든 창·카드 배경
- titlebar (16×14, slice 6): 창 제목 띠
- btn / btn_pressed / btn_disabled / btn_primary (16×16, slice 6): 버튼 4종. 주요 행동(확정·받기·출발)은 btn_primary(호박색, 글자 #161420)
- tile / tile_pressed / tile_selected / tile_locked (32×32): 아이콘 칸. 24px 아이콘을 (4,4)에. 잠김 = 아이콘 회색·40% + lock.png 오른쪽 아래
- tile_grade_n·r·e·l·a (32×32): 장비 등급 칸(일반 회색·희귀 파랑·영웅 보라·전설 호박·유물 붉은색)
- tab_on / tab_off (16×14, slice 6): 탭
- bar_frame (12×8, slice 3) + bar_fill_hp·xp·mp·bond·grn (1×6, 가로로 늘림): 바
- dialog (24×24, slice 8) + nameplate (16×14, slice 6): 대사창·이름표
- lock · dot_new · close · arrow_r · star · star_empty · coin · heart: 작은 기호
- hand_0 / hand_1 (16×16): 가이드 손가락, 0.4초마다 교대(톡톡). 임무 카드가 가리키는 버튼 위
- 색 기준: 판 #1E2132 · 테두리 #161420 · 글자 아이보리 #F2E6C9 · 강조 호박 #E2AA4E
- ui/_참고_조립예시.png = 부품 조립 예(메뉴 창)

## 2. icons/ — 아이콘 36종 (24px, 작은 버전은 _16)
- 여관: m_owner 주인 · m_guests 손님 · m_heroes 영웅 · m_bond 인연 · m_bag 가방 · m_smith 대장간 · m_garden 텃밭
- 모험: m_quest 임무(장부) · m_hunt 사냥 · m_expedition 원정 · m_raid 토벌 · m_rank 랭킹
- 수집: m_dex 도감 · m_achieve 업적 · m_title 칭호 · m_album 엔딩 앨범
- 교류: m_neighbor 이웃 · m_chat 채팅 · m_mail 우편함 · m_notice 공지
- 상점: m_shop 상점 · m_attendance 출석
- 시스템: m_account 계정 · m_settings 설정 · m_guide 안내서 · m_letter 모모에게 편지
- 재화: cur_gold 금화 · cur_dust_n·r·e·l·a 등급별 가루 · cur_token 인연의 증표 · cur_seed 씨앗
- 스킬: skill_attack · skill_fireslash · skill_pray · skill_block · skill_combo · skill_auto
  → 핫픽스5의 화려한 금테 skill_*.png(48px)는 쓰지 말고 이걸로 교체. 원형 버튼 안에 2배(48px)로

## 3. monsters/ — 사냥 몬스터 10종 (왼쪽을 봄, 투명 배경, 1px 외곽선)
- 숲: mob_slime · mob_wolf · mob_goblin / 버섯 늪: mob_mushimp · mob_frog / 폐광: mob_bat · mob_kobold / 얼음: mob_iceimp · mob_snowwolf / 심연: mob_shadow
- 지역 보스(x-10)는 토벌 보스 그림을 0.6배. 맞으면 1프레임 흰색, 죽으면 깜빡 3번 후 사라짐

## 4. props/ — 마을 등급 장식 8종 (쿼터뷰, 건물과 같은 픽셀 밀도, props/meta.json에 크기·발자국)
- lamppost 가로등(1×1, 밤 불빛) · stonewall 돌담(1×1) · bench 벤치(1×1) · flowerbed 꽃밭(1×1) · banner 깃발(1×1) · stall 노점(2×2) · fountain 분수(2×2, 물줄기는 코드 입자로) · gate 정문(2×2, 마을 입구 길 위)
- 마을 등급별 배치는 STAGE5_SPEC.md 3장

## 5. 순서
1) 0장 규칙 공통 적용 → 2) UI 키트로 전체 리스킨(+ 스킬 아이콘 교체) → 3) STAGE5_SPEC.md 0→5장
