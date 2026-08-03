# PinTime (핀타임)

조율·확정·캘린더 등록까지 원터치로 이어 주는 AI 일정 에이전트입니다.

톡방에 흩어진 일정 대화를 이해하고, 되는 시간을 이어 붙이고, 확정한 순간 캘린더에 남깁니다.  
When2Meet식 빈 표를 방마다 다시 채우는 반복이 아니라, **한 번 입력한 일정이 다음 조율까지 이어지는** 흐름을 목표로 합니다.

Vite · React 19 · TypeScript · Tailwind 4 · 로컬 `localStorage`  
라이브: https://pintime.vercel.app · 피치: https://pintime.vercel.app/pitch.html

---

본 저장소는 일정 조율 문제를 풀기 위한 **동작하는 프론트 프로토타입**입니다.  
백엔드·외부 LLM·실캘린더 API는 없습니다. 대화 이해와 후보 추천은 `src/lib/agentParse.ts`의 **규칙 파이프라인**이, 조율 방·캘린더는 브라우저 `localStorage`가 담당합니다.

설계 원칙은 하나입니다.  
**끊기는 곳(방마다 재공유·재조율·재등록)을 잇고, 확정 한 번이면 캘린더까지 끝낸다.**

---

## 먼저 보실 것

**사업 소개서 (표지 + 4장)** — 실행 없이 전체 스토리  
[`public/pitch.html`](./public/pitch.html) · https://pintime.vercel.app/pitch.html

```bash
npm install
npm run dev          # → http://localhost:5173
npm run build && npm run preview
npx serve public     # 피치만: /pitch.html
```

| 장 | 내용 |
|---|---|
| 표지 | 흩어진 톡 · 폰 · AI 일정 에이전트 카피 |
| 1/4 | 기존 조율 툴의 한계 — 방마다 끊기는 흐름 |
| 2/4 | AI 파이프라인 — 입력→연결→충돌 제거→추천 |
| 3/4 | 프로토타입 — 방 생성 · 마스킹 · JSON 공유 |
| 4/4 | 확정 한 번이면 캘린더까지 |

캡처: [`public/pitch-export/`](./public/pitch-export/)

---

## 문제 · 제안

| | |
|---|---|
| 문제 | 일정 앱·When2Meet를 써도 톡방마다 다시 표를 채우고, 다른 방에서 시간이 잡히면 또 조율하고, 확정 뒤에도 캘린더에 직접 넣는다 |
| 제안 | 대화 이해 → (캘린더 기반) 가능 시간 연결 → 충돌 구간 제외 → 추천·확정 → **같은 저장소에 캘린더 등록** |
| 데모 범위 | 에이전트 · 캘린더 · 공유 방 · 링크 참여 · 피치. 서버 동기화·실 LLM은 범위 밖 |

---

## 구현 정도 (정직하게)

### 되어 있는 것

| 영역 | 상태 | 설명 |
|------|------|------|
| AI 에이전트 UI | ✅ 동작 | 지시 → 대화 붙여넣기 → 분석 → 1순위+대안 → 확정 시 캘린더 등록 |
| 대화 이해 | ✅ 규칙 기반 | 참여자·음식·기간·요일 제외/선호·퇴근 후·지역 회피 패턴 파싱 |
| 후보 추천 | ✅ 휴리스틱 점수 | 평일 × 저녁 슬롯 점수화, top 후보·대안 제시 (데모용 장소 풀) |
| 캘린더 | ✅ 동작 | 주간(시간) / 월간(종일), 추가·수정·색·반복·장소·메모 |
| 조율 방 | ✅ 로컬 | 날짜/요일 모드, 시간대, 호스트 자동 가능시간(바쁨→가능 반전) |
| 링크 참여 | ✅ 동작 | `/join/:id?d=…` 압축 데이터, 이름+비번(데모), 표 칠하기, 겹침 보기, 확정 |
| JSON / PinTime 페이로드 | ✅ 동작 | 일정·가능 슬롯을 JSON으로 내보내/붙여넣어 방 간 이어 붙이기 |
| 피치 덱 | ✅ 정적 | `pitch.html` + export PNG |
| 배포 | ✅ Vercel | SPA + `public/` 정적 파일 |

### 데모·제한으로 두신 것

| 영역 | 상태 | 설명 |
|------|------|------|
| LLM | ❌ 없음 | OpenAI 등 호출 없음. `runAgentPipeline`이 전부 로컬 정규식·점수 |
| 서버 DB | ❌ 없음 | 방·캘린더는 `localStorage`. 다른 기기/브라우저는 URL `d` 파라미터·JSON으로만 공유 |
| 실캘린더 연동 | ❌ 없음 | Google / Apple Calendar push·sync 없음 |
| 장소·예약 | 🔶 스텁 | 건대·성수·왕십리 등 **하드코딩 데모 장소** + example.com 예약 링크 |
| 인증 | 🔶 데모 | 참여 시 이름+비밀번호는 로컬 식별용. 계정·OAuth 없음 |
| 실시간 동기화 | ❌ 없음 | 같은 방이라도 탭/기기 간 라이브 업데이트 없음 (`pintime:room` 커스텀 이벤트는 같은 창 한정) |
| 테스트 스위트 | ❌ 거의 없음 | vitest/e2e 스위트는 이 README 기준으로 강제하지 않음 |

**한 줄 요약:** “제품 전체”가 아니라 **조율 루프를 끊기지 않게 보여 주는 종단 데모**입니다.  
에이전트 품질의 상한은 규칙 커버리지이고, 멀티유저 진실의 상한은 링크에 실어 나르는 방 스냅샷입니다.

---

## 화면 흐름 (실행 경로)

`npm run dev` → http://localhost:5173

### 1막 — 에이전트 (`/`)

1. 한 줄 지시: `다음 주에 민수, 영희랑 고기 먹게 잡아줘.`  
2. 톡 붙여넣기 또는 예시 대화(`DEMO_CHAT`) 로드  
3. `runAgentPipeline(request, chat)` → 의도·사람별 제약·1순위 후보·대안  
4. **이 시간으로 확정** → `addSchedule` → `/calendar` 주간으로 이동  

스텝: `request` → `chat` → `result` (`AgentPage`).

### 2막 — 캘린더 (`/calendar`)

- 주간: 09–22시 그리드, 드래그로 구간 생성, 마스크 슬롯(바쁨) 지원  
- 월간: 종일·여행(`AllDayEvent`, endDate inclusive)  
- 부가: 색, 반복(`recurrence.ts`), 장소·링크·메모·전날 알림 플래그  
- 저장 키: `pintime:calendar:v2`

에이전트·조율에서 확정한 일정이 **같은 CalendarContext**에 쌓이므로, 다음 방 생성 때 바쁨으로 반영됩니다.

### 3막 — 조율 방 만들기 (`/share`)

1. 후보: **개별 날짜**(최대 21) 또는 **요일**  
2. 시작·종료 시 (기본 범위 `defaultRoomRange`)  
3. 방 생성 → 호스트를 참가자로 넣고,  
   `busyToAvailableSlotsForRoom(schedules, allDay, room)` 로  
   **내 캘린더 바쁨을 뒤집어 가능 슬롯**으로 채움 (자동 마스킹의 실체)  
4. 초대 링크 복사 / 내 방 목록 / JSON 연동 UI  

### 4막 — 링크로 참여 (`/join/:roomId`)

1. URL의 `d`(압축 방 데이터) 또는 로컬 `pintime:room:{id}` 로 방 복원  
2. 이름+비밀번호로 참가(데모 식별). 세션은 `pintime:session:{roomId}`  
3. 30분 단위 표에 가능 시간 칠하기 (`AvailabilityEditor`)  
4. 참가자 겹침 히트맵 (`OverlayGrid`)  
5. 구간 선택 후 확정 → `confirmRoomSlot` → (앱 연동 시) 내 캘린더에도 일정 추가  
6. PinTime JSON 붙여넣기로 다른 방·기기에서 가져온 가능 시간 합치기  

### 5막 — 피치 (`/pitch.html`)

정적 HTML 덱. 앱과 별개로 심사·발표용 스토리보드.

---

## 에이전트 파이프라인 (구현 상세)

파일: [`src/lib/agentParse.ts`](./src/lib/agentParse.ts)  
진입점: `runAgentPipeline(request, chat) → AgentProposal`

```
request ──► parseIntent
              │  참여자(이랑/랑/와), 음식(고기·술·카페·밥), 기간(다음주/이번주)
chat    ──► splitSpeakerLines ("이름: 내용")
              │
              ├─► parsePersonLine × N
              │     요일 제외/선호, 저녁·퇴근(19시~), 지역 회피(강남·홍대·잠실)
              │
              └─► extractConstraints → people[] + shared
                        │
                        ▼
                 proposeAppointment
                   · 기간 내 평일 순회
                   · 시작 후보 18:30 / 19:00 / 19:30 / 20:00
                   · score: 제외 −100, 선호 +35, 19:30 가산, 요일 바이어스…
                   · pickVenue (회피 지역 제외, 고기→건대 우선)
                   · primary + alternatives(최대 3)
```

| 출력 필드 | 쓰임 |
|-----------|------|
| `intent` | 화면 요약·캘린더 제목 재료 |
| `people[].bullets` | 제약 설명 UI |
| `primary` / `alternatives` | 확정 후보 (date, start/end, venue, reason, score) |

확정 시 캘린더에 들어가는 것: 제목·시간·장소 문자열·예약 URL·제약 메모·`remind: true`.  
**실예약·실결제·실지도 검색은 하지 않습니다.**

---

## 데이터 · 저장

| 키 | 내용 |
|----|------|
| `pintime:calendar:v2` | `{ schedules, allDay }` |
| `pintime:room:{id}` | `ShareRoom` JSON |
| `pintime:myRooms` | 최근 방 참조 (최대 30) |
| `pintime:myName` / `pintime:userId` | 표시 이름 · 로컬 유저 id |
| `pintime:session:{roomId}` | 참여 세션 |

**공유 코덱** [`shareCodec.ts`](./src/lib/shareCodec.ts): 필드명을 한 글자로 줄이고, 연속 날짜는 시작+일수, 가능 슬롯은 인덱스 배열로 압축 → URL `d` 쿼리에 실음.  
레거시 `@14` 시 단위 슬롯은 `@14:00`/`@14:30`으로 확장 (`slots.ts`).

**슬롯 키:** `YYYY-MM-DD@HH:MM` (날짜 모드) 또는 `월@14:00` (요일 모드). 스텝 30분.

**바쁨 → 가능:** `busyToAvailableSlotsForRoom`이 일정·종일 일정을 방의 그리드에 투영한 뒤, 비는 칸만 available로 남깁니다.  
이게 피치에서 말하는 “내 일정 자동 반영(마스킹)”의 코드 경로입니다.

---

## 경로

| 경로 | 페이지 | 역할 |
|------|--------|------|
| `/` | `AgentPage` | AI 일정 에이전트 |
| `/calendar` | `CalendarPage` | 주간 / 월간 캘린더 |
| `/share` | `SharePage` | 방 생성 · 링크 · 내 방 |
| `/join/:roomId` | `JoinPage` | 참여 · 가능 시간 · 확정 · JSON |
| `/pitch.html` | 정적 | 사업 소개서 |

---

## 구조

```
src/
  main.tsx · App.tsx          라우트 · 셸(사이드바/하단 탭)
  pages/
    AgentPage.tsx             에이전트 3스텝 UI
    CalendarPage.tsx          주간·월간
    SharePage.tsx             방 생성·초대
    JoinPage.tsx              참여·겹침·확정
  components/                 Weekly/Monthly · AvailabilityEditor · OverlayGrid
                              CandidateDatePicker · EventForm · AuthModal …
  context/CalendarContext.tsx 일정 상태 + localStorage 동기화
  lib/
    agentParse.ts             의도·제약·점수·추천 (규칙)
    room.ts                   createRoom · upsertParticipant · confirmRoomSlot
    slots.ts                  슬롯 키 · 컬럼 · busy↔available · 확정 구간
    shareCodec.ts             URL/JSON 압축·복원
    storage.ts                load/save calendar·room · clearAllPinTimeData
    recurrence.ts             반복 일정 전개
    session.ts                방별 참여 세션
  types.ts                    Schedule · ShareRoom · Participant · PinTimePayload …
public/
  pitch.html · pitch-export/ · pitch-shots/
```

이벤트 로그나 서버 append-only 스토어는 없습니다.  
상태의 진실은 **localStorage + (공유 시) URL/JSON 스냅샷**입니다.

---

## 만들지 않은 것 · 다음에 열 자리

- 로그인·권한·팀 워크스페이스  
- 실 LLM 연동 — 다만 `AgentProposal` / `runAgentPipeline` 경계를 유지한 채 교체 가능  
- Google·Apple 캘린더 read/write  
- 서버 권위 방 + 실시간 구독 (지금은 링크 스냅샷)  
- 푸시·메일 알림 (UI의 `remind`는 로컬 플래그)  
- 실제 예약·지도 API  

무응답 자동 확정 같은 우회 경로도 없습니다. 확정은 사용자가 버튼을 눌러야 합니다.

---

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | Vite 개발 서버 (기본 5173) |
| `npm run build` | `tsc -b` + 프로덕션 빌드 → `dist/` |
| `npm run preview` | 빌드 미리보기 |
| `npm run lint` | oxlint |

## Netlify 배포 (프로토타입)

설정은 [`netlify.toml`](./netlify.toml)에 있습니다.

| | |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |
| SPA | `/*` → `/index.html` (존재하는 `pitch.html` 등은 그대로 서빙) |

### Git 연동 (권장)

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. GitHub 저장소 `dlwldn4824/pintime` 연결
3. Build settings는 `netlify.toml`이 자동 인식
4. Deploy → `https://<site-name>.netlify.app`

앱: `/` · 피치: `/pitch.html`

### CLI로 바로 올리기

```bash
npm run build
npx netlify-cli login          # 최초 1회
npx netlify-cli sites:create --name pintime-demo   # 사이트 이름 선택
npx netlify-cli deploy --prod --dir=dist
```

Vercel(기존)과 병행해도 됩니다. Netlify는 정적 `dist/`만 올리면 됩니다.

---

## 피치 이미지

| 파일 | 장 |
|------|-----|
| ![표지](./public/pitch-export/00-cover.png) | 표지 |
| ![1](./public/pitch-export/02-needs.png) | 1/4 한계 |
| ![2](./public/pitch-export/03-concept.png) | 2/4 에이전트 |
| ![3](./public/pitch-export/04-prototype.png) | 3/4 프로토타입 |
| ![4](./public/pitch-export/05-impact.png) | 4/4 결과 |
