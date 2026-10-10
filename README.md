# 모험의 유산 / LEGACY OF ADVENTURE

쿼터뷰(2:1) 도트 여관 마을 경영 웹게임. Vite + TypeScript, 화면은 Canvas 2D 한 장, UI는 HTML/CSS 오버레이.
폰 세로 화면이 기본이다.

## 실행

```bash
npm install
npm run dev
```

- PC: `http://localhost:5181`
- 휴대폰: 같은 와이파이에서 터미널의 `Network: http://192.168.x.x:5181`

빌드: `npm run build` → `dist/` (상대 경로라 하위 경로에 올려도 열린다).
GitHub Pages: `npm run deploy` — 빌드해서 `gh-pages` 브랜치로 올린다 (Pages 소스 = gh-pages 브랜치).

## 폴더

```
public/assets/       에셋팩의 sprites/ portraits/ fonts/ 그대로 (fonts/LICENSE.txt 함께 배포)
src/
  main.ts            부팅, 루프(규칙 30fps 고정 / 그리기 rAF), 화면 드래그·탭
  game.ts            게임 진행 동작: 새 게임·이어하기·땅·건설·레벨업·지붕 색·이웃 방문·타이틀
  data/config.ts     모든 숫자 (가격·속도·확률·시간·대사)
  data/catalog.ts    건물 목록 (이름·발판·가격·행동·레벨업 그림·열리는 땅 단계)
  data/classes.ts    직업(색·얼굴·무기), 이름, 케미 짝
  data/neighbors.ts  이웃 마을 (지금은 가짜 데이터)
  engine/iso.ts      좌표 변환, 카메라, 깊이 정렬 값
  engine/pixel.ts    도트 붓(P), Grid, 디더, 색 섞기
  engine/sprites.ts  캐릭터 도트 생성 (buildChar)
  engine/assets.ts   PNG 로드, 창문 불빛 마스크, 지붕 색 바꾸기, 밤 색조 캐시
  world/state.ts     공유 상태, 게임 시간 예약(later), 장부
  world/ground.ts    바닥·흙길·울타리·숲
  world/town.ts      배치·점유 격자·A* 길찾기·땅 단계·짓기 검사·레벨업
  world/actors.ts    모험가 상태기계, 케미, 던전 파티
  world/daynight.ts  낮밤 전환, 창문 불빛, 반딧불·구름 그림자
  world/render.ts    한 프레임 그리기 (밤 처리 순서는 파일 맨 위 주석)
  world/fx.ts        입자, 떠오르는 숫자, 말풍선
  ui/                hud, windows(건설·땅·손님·건물·장부·메뉴·제보), dialogue(대화창·오프닝), notice, chat
  save/save.ts       localStorage 저장 (서버에 그대로 올릴 수 있는 모양)
reference/           에셋팩의 시안 (legacy_village.html 은 브라우저로 바로 열린다)
tools/               isonorm.py, winbox.py, PROMPT.txt — 새 건물 그림 정리용 (명세 10장)
```

## 저장

`localStorage['legacy-of-adventure-save']`:
`{version, land, buildings[{kind,tx,ty,lvl,hue}], gold, day, night, adventurers[{kind,name,x,y,lvl,hp,food,mood}], innName, ledger}`.
10초마다 + 건설·레벨업·땅·지붕 색 직후 + 앱을 닫을 때. 구조를 바꾸면 `CONFIG.save.version`을 올리고 `save.ts`의 `migrate`에 단계를 추가한다.
제보 편지는 `legacy-of-adventure-reports`, 배율·좋아요·읽은 공지는 `legacy-of-adventure-<이름>`.

## 개발 중 콘솔 도우미 (npm run dev 일 때만)

- `__run(초)` — 화면이 숨어 rAF가 멈췄을 때도 게임을 60fps로 그만큼 돌린다
- `__S`, `__world`, `__game`, `__view`, `__stats`(프레임 시간)
