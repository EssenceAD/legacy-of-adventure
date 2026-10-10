모험의 유산 에셋팩 v1 (쿼터뷰 도트 마을)

sprites/     건물·소품 도트 PNG (배경 제거, 픽셀 크기 통일)
             meta.json   : 각 그림의 크기(w,h)와 발판(fw×fh 타일)
             windows.json: 밤에 켜지는 창문 픽셀 좌표 [y,x] 목록 (건물별)
portraits/   대화창·정보창용 64×64 도트 초상화 (keeper=노주인 버나드, hero=주인공, post=우체부 모모, 나머지는 직업)
fonts/       Galmuri11, Galmuri11-Bold, Galmuri9 (SIL OFL 1.1 — LICENSE.txt 함께 배포할 것)
reference/   legacy_village.html : 그대로 열리는 시안 (동작 기준)
             core.js   : 도트 그리기 도구 + 캐릭터 생성(얼굴·앞/뒷모습 포함)
             isogame.js: 마을 엔진 전체(좌표·깊이정렬·길찾기·행동·낮밤·UI)
             index_template.html : 시안의 HTML/CSS (UI 스타일 기준)
tools/       isonorm.py : Scenario 원본(raw/이름.png) → sprites/ 정리. 실행 예)
               set ASSET_ROOT=작업폴더  (그 안에 raw/ 와 sp/ 폴더)
               python isonorm.py "{\"inn\":[3,3,1.1]}"   ← [발판가로, 발판세로, 폭배율, (그림자민감도)]
             winbox.py  : 창문 상자 좌표로 windows.json 다시 만들기
assets/PROMPT.txt : Scenario 프롬프트 공통 앞부분
