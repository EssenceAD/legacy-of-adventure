# 「모험의 유산」 배경음악 — 트랙리스트 · Suno 제작 계획

## 원칙: 오래 들어도 안 질리고, 여운이 남게
1. **주제 선율 하나를 끝까지 들고 간다.** 타이틀 곡 「모험의 유산」의 멜로디를 먼저 만든다. 밤·불씨·엔딩 곡은 Suno의 **Cover**(같은 멜로디를 다른 편곡으로)로 만든다. 플레이어가 엔딩에서 그 멜로디를 다시 들을 때 여운이 생긴다.
2. **마을 곡은 조용하고 성기게.** 북은 거의 없고, 클라이맥스 없이 잔잔한 반복으로 만든다. 노래(가사)는 넣지 않는다(인스트루멘털).
3. **곡 사이에 쉼을 둔다.** 마을에서는 한 곡이 끝나면 20~60초 조용하다가 다음 곡이 나온다. 그 사이엔 새소리·모닥불 같은 마을 소리만 들린다. 같은 곡이 계속 반복되는 것보다 훨씬 덜 질린다.
4. **상황마다 2~4곡을 섞어 튼다.** 상황별 트랙리스트에서 직전 곡을 빼고 무작위로 고른다.

## 트랙리스트 (18곡)
| # | 상황 | 곡 이름 | 만드는 법 | 느낌 |
|---|---|---|---|---|
| 01 | 타이틀 | 모험의 유산 | 새로 만들기 (**주제 선율**) | 그립고 따뜻한 모험의 시작 |
| 02 | 마을 낮 | 장작 패는 아침 | 새로 만들기 | 맑은 아침, 하프·플루트 |
| 03 | 마을 낮 | 여관의 오후 | 01 Cover | 주제 선율을 느긋한 류트로 |
| 04 | 마을 낮 | 장날 | 새로 만들기 | 살짝 경쾌, 아코디언·핸드드럼 약하게 |
| 05 | 마을 낮 | 산들바람 언덕 | 새로 만들기 | 넓고 평화로운 들판 |
| 06 | 마을 밤 | 모닥불 곁에서 | 새로 만들기 | 어쿠스틱 기타, 따뜻하고 나른하게 |
| 07 | 마을 밤 | 별빛 오르골 | 01 Cover | 주제 선율을 오르골·첼레스타로 |
| 08 | 마을 밤 | 잠든 여관 | 새로 만들기 | 아주 조용한 피아노·패드 |
| 09 | 사냥 | 숲길을 달려라 | 새로 만들기 | 가볍고 신나는 모험 전투 |
| 10 | 사냥 | 깊은 곳으로 | 새로 만들기 | 조금 어둡고 긴장감 있게(늪·폐광·얼음·심연) |
| 11 | 토벌 | 숲의 왕 | 새로 만들기 | 웅장한 보스전, 현악·타악 |
| 12 | 토벌 | 마지막 일격 | 새로 만들기 | 더 빠르고 절박하게(보스 체력 30% 아래로 전환) |
| 13 | 평가단 | 깃털 모자 행진 | 새로 만들기 | 살짝 장난스러운 행진곡, 피치카토 |
| 14 | 이웃 방문 | 남의 집 마당 | 새로 만들기 | 낯설지만 정다운, 우리 마을과 다른 악기(만돌린) |
| 15 | 인연 이벤트 | 마주 앉은 밤 | 새로 만들기 | 서정적인 피아노·현악, 대화 뒤에 깔림 |
| 16 | 방랑의 불씨 | 다락의 낡은 지도 | 01 Cover | 주제 선율을 쓸쓸한 솔로 바이올린으로 |
| 17 | 모험 엔딩 | 다시 길 위로 | 01 Cover | 주제 선율 풀 오케스트라, 벅차게 |
| 18 | 여관 엔딩 | 여기가 내 자리 | 01 Cover | 주제 선율 따뜻한 피아노·현악, 조용히 끝남 |

## Suno 입력값
- 공통: **Instrumental 켜기.** 길이 2~3분.
- 공통 Exclude styles: `vocals, singing, choir lyrics, EDM, dubstep, distortion, heavy metal, trap`
- 각 곡의 Style:
  - 01 `cozy fantasy RPG main theme, instrumental, warm and nostalgic, bittersweet, celtic harp, wooden flute, acoustic guitar, soft strings, gentle glockenspiel, simple memorable melody, sense of home and adventure, 88 bpm, F major, game soundtrack`
  - 02 `peaceful fantasy village morning, instrumental, celtic harp, tin whistle, light pizzicato strings, birdsong feel, bright and calm, no drums, 96 bpm, game background music`
  - 03 Cover of 01 · `relaxed medieval tavern afternoon, solo lute and acoustic guitar, soft cello, cozy, slow, no drums, game background music`
  - 04 `cheerful fantasy market day, instrumental, accordion, fiddle, light hand percussion, playful but gentle, not loud, 108 bpm, cozy village game music`
  - 05 `wide peaceful meadow, instrumental, soft strings, oboe, harp arpeggios, airy and spacious, slow, calm, game background music`
  - 06 `campfire at night, instrumental, fingerpicked acoustic guitar, soft cello, warm crackling ambience, sleepy and cozy, 72 bpm, no drums, game music`
  - 07 Cover of 01 · `music box lullaby, celesta, glockenspiel, soft pad, starry night, delicate, very slow, game background music`
  - 08 `quiet sleeping inn at midnight, instrumental, soft felt piano, warm ambient pad, sparse notes, tender, very slow, no drums`
  - 09 `light fantasy adventure battle, instrumental, energetic strings, flute melody, taiko and snare, heroic and fun, 140 bpm, D minor, JRPG battle music`
  - 10 `dark fantasy dungeon battle, instrumental, low strings ostinato, brass stabs, tense percussion, mysterious, 132 bpm, E minor, JRPG battle music`
  - 11 `epic fantasy boss battle, instrumental, full orchestra, choir pads without lyrics, powerful taiko drums, brass, dramatic, 150 bpm, E minor, JRPG boss theme`
  - 12 `desperate final phase boss battle, instrumental, fast orchestral strings, pounding drums, rising brass, intense, 168 bpm, C minor, JRPG boss theme`
  - 13 `playful marching band, instrumental, pizzicato strings, bassoon, snare drum light, whimsical inspectors parade, 104 bpm, G major, cozy game music`
  - 14 `friendly neighboring village, instrumental, mandolin, recorder, light guitar, warm and slightly unfamiliar, gentle, 100 bpm, game background music`
  - 15 `heartfelt quiet conversation at night, instrumental, emotional piano, soft violin, warm strings, intimate, slow, game emotional theme`
  - 16 Cover of 01 · `lonely solo violin, distant memories, old map in the attic, melancholic, sparse harp, very slow`
  - 17 Cover of 01 · `triumphant full orchestra finale, soaring strings, horns, hopeful, journey begins again, cinematic, emotional climax`
  - 18 Cover of 01 · `warm gentle piano and strings, ending credits, peaceful, grateful, home, soft quiet ending`


## Suno 설정 (직접 만들 때)
- 「곡」 → **고급**, 모델 **v6**
- 가사 칸에 아래를 넣는다(빈칸보다 구조가 잘 잡힘):
  ```
  [Instrumental]
  [Intro]
  [Main Theme]
  [Variation]
  [Bridge]
  [Main Theme]
  [Outro]
  ```
- 스타일: 아래 곡별 Style 붙여넣기. 스타일 제외: `vocals, singing, lyrics, rap, EDM, dubstep, distortion, heavy metal, trap, lo-fi`
- 추가 옵션
  - 기이함: 마을·밤·이벤트 곡은 **30%**, 전투곡은 **45%**
  - 스타일 영향: **70%**
  - 길이: Auto
  - 개인화: 끔
  - Max 모드: 타이틀(01)과 엔딩(17·18)만 켜 보기
- 곡 제목: `01 Legacy of Adventure`처럼 번호를 붙인다(나중에 찾기 쉽게).
- **Cover 만들기**: 마음에 드는 01을 고른 뒤, 그 곡의 「…」 → 리믹스/편집 → **Cover**. 스타일만 해당 곡 것으로 바꾸고, 가사 칸은 그대로 둔다.

## 고르는 기준
- 처음 10초 안에 분위기가 잡히는가(긴 인트로 X)
- 마을 곡: 중간에 갑자기 커지거나 북이 쾅 나오지 않는가
- 끝이 뚝 끊기지 않는가(조금 끊겨도 Claude가 페이드 처리함)
- 사람 목소리·허밍이 섞이지 않았는가
- 두 개 다 별로면 다시 뽑기(크레딧만 들고 다운로드는 안 씀)

## 팡파르 4곡 (「곡」, 30~40초, 잘라서 씀)
| # | 이름 | Style |
|---|---|---|
| J1 | 승리 | `short triumphant orchestral fanfare, brass and strings, celtic harp flourish, bright, victory, RPG level up jingle, 8 seconds then gentle tail, instrumental` |
| J2 | 아쉬움 | `short sad orchestral sting, soft strings and oboe, descending melody, defeat, gentle not dramatic, RPG game over jingle, instrumental` |
| J3 | 축하 종소리 | `celebration church bells and glockenspiel, festive village fanfare, harp glissando, warm strings, joyful, RPG town upgrade jingle, instrumental` |
| J4 | 신비한 반짝임 | `magical discovery jingle, celesta, harp glissando, shimmering bells, mysterious then warm resolve, RPG secret found sound, instrumental` |

## 효과음 (「사운드」 탭, One-Shot)
| 이름 | 설명 넣을 말 |
|---|---|
| tap | `soft wooden UI click, short, cozy` |
| open / close | `paper book page flip, soft, short` |
| coin | `gold coins clink, bright, short fantasy` |
| build | `wooden hammer knocks and thud, building placed, short` |
| place_bad | `soft muted wooden thunk, error, short` |
| fail | `glass clink then dull fizzle, small failure, short` |
| item | `sparkly item pickup chime, fantasy, short` |
| rare | `magical treasure sparkle with bell shimmer, rare item, short` |
| mission | `two-note bright bell ding dong, quest complete` |
| hit / crit | `sword hit impact, light` / `heavy critical sword slash impact` |
| skill | `magical whoosh rising, spell cast` |
| block / perfect | `metal shield block clang` / `clean bright metallic parry ring` |
| event | `curious playful pop with question sound` |
| heart | `soft warm chime, affection` |
| night | `distant owl hoot, calm night` |
| ambience_day / ambience_night (Loop) | `village birds and gentle wind, morning` / `crickets and crackling campfire, night` |

## 넘기는 법
- 다운로드: **WAV가 있으면 WAV**, 없으면 MP3
- 저장 위치: `C:\projects\legacy-of-adventure\audio_raw\`
- 파일 이름: 번호만 맞으면 된다. 예: `01.wav`, `07.wav`, `J1.wav`, `coin.wav`
- 다 넣고 Claude에게 "넣었어"라고 하면 Claude가 처리한다:
  - 앞뒤 무음 자르기, 페이드
  - 음량 맞추기(-16 LUFS)
  - 팡파르 잘라내기
  - `public/audio/` 배치
- 다운로드는 한 달 27곡. 효과음도 다운로드 수에 들어가는지는 처음 하나 받아 보고 확인하기

## 후처리 (Claude가 직접)
- 생성 2곡 중 좋은 쪽을 고른다. 앞뒤 무음을 자르고 마지막 4초는 페이드아웃.
- 음량을 -16 LUFS로 맞춘다(곡마다 소리 크기가 들쭉날쭉하지 않게).
- `public/audio/bgm/{번호}_{영문이름}.mp3`, 128kbps 스테레오(곡당 약 2~3MB).
