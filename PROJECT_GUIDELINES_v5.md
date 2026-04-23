# MOUI-IST (모의스트) 앱 프로젝트 지침 v5

## 프로젝트 개요
- **앱 이름**: MOUI-IST (모의스트)
- **슬로건**: 창작을 모의하는 자들
- **웹사이트**: https://mouiist.com (아티스트 그룹 소개 — 다크 테마)
- **앱 배포 URL**: https://moui-ist-service.vercel.app (커뮤니티 앱 — 라이트 테마)
- **SNS**: Instagram @the.moui.ist, YouTube @Moui-ist
- **개발 방식**: 1인 개발 (바이브 코딩)

## 브랜드 컨셉
- "모의(謀議)" = 함께 꾀하다, 도모하다. 창작자들이 머리를 맞대고 새로운 것을 만들어내는 집단.
- 톤앤매너: 예술적이면서 약간 불온한 에너지, 세련되고 미니멀한 디자인
- 기존 자산: 작가 100명 커뮤니티(당근/소모임), 9인 아티스트 그룹 단체전 운영 중

### 🎨 디자인 방향 — 아티스트 그룹 vs 앱

| 구분 | 아티스트 그룹 (mouiist.com) | 앱 (moui-ist-service.vercel.app) |
|------|---------------------------|----------------------------------|
| 성격 | 9인 작가 집단, 단체전 | 작가·지망생·감상자 커뮤니티 |
| 테마 | **다크** (배경 #060606, 텍스트 #F0ECE4) | **라이트** (배경 #FFFFFF, 텍스트 #0A0A0A) |
| 골드 액센트 | #C8A96E | #C8A96E (동일) |
| 메인 타이틀 | MOUI-IST (영문, 대형) | 모의스트 (한글, 커뮤니티 느낌) |
| 컨셉 | 불온하고 무게감 있는 톤 | 깔끔하고 접근하기 쉬운 톤 |

→ 앱 디자인은 웹사이트의 **색상 반전** 버전. 구조와 타이포 스타일은 유지하되 밝은 배경으로.

### 앱 브랜드 컬러 (constants/theme.ts)

**다크/라이트 모드 지원** — `ThemeModeProvider` + `useThemeMode()` 훅으로 전환
- AsyncStorage로 테마 설정 저장/복원
- 모든 화면에서 `const { colors: C } = useThemeMode()` 사용

```
| key        | 다크 모드      | 라이트 모드     |
|------------|---------------|----------------|
| bg         | #191f28       | #f5f6f8        |
| fg         | #f2f4f6       | #191f28        |
| gold       | #C8A96E       | #C8A96E        |
| goldLight  | #E0C992       | #E0C992        |
| goldDim    | #A8905A       | #A8905A        |
| muted      | #8b95a1       | #6b7280        |
| mutedLight | #4e5968       | #9ca3af        |
| border     | #333d4b       | #e5e7eb        |
| card       | #212a35       | #ffffff        |
| danger     | #D94040       | #D94040        |
```

**레거시 Brand 객체** (일부 구버전 코드에서 사용):
```
Brand.gold      = '#C8A96E'    // 메인 액센트 (골드)
Brand.goldLight = '#E0C992'    // 골드 밝은 버전
Brand.goldDim   = '#A8905A'    // 골드 어두운 버전
Brand.black     = '#1A1A1A'    // 텍스트 기본
Brand.white     = '#FAFAF7'    // 배경 (크림)
Brand.gray      = '#8A8580'    // 보조 텍스트
Brand.grayLight = '#C5C0BA'    // 비활성 아이콘
Brand.border    = '#E8E5DF'    // 구분선
```

## 사용자 유형

### 작가 (Creator)
- 모든 분야의 창작자 (미술, 글, 사진, 음악 등)
- 핵심 니즈: 작품을 제대로 보여줄 전용 포트폴리오, 작가 간 네트워킹, 전시/모임 참여
- 진입 동기: "인스타보다 작품에 집중된 공간, 명함/바이오에 걸 수 있는 포트폴리오 링크"
- **인증 상태**: `profiles.verified` (boolean) — 미인증 작가는 "미인증" 배지 표시
- **분야 카테고리** (8종, 멀티 선택 가능):
  - ✍️ 글 (소설가, 시인, 에세이스트, 극작가, 평론가 등)
  - 🎨 그림 (화가, 일러스트레이터, 만화가, 캘리그래퍼 등)
  - 🎬 영상 (영화감독, 영상작가, 애니메이터 등)
  - 🎵 소리 (작곡가, 연주자, 사운드 아티스트, DJ 등)
  - 📷 사진 (사진작가, 포토그래퍼 등)
  - 🗿 입체/공간 (조각가, 도예가, 설치미술가, 건축가 등)
  - 💻 디지털/인터랙티브 (미디어 아티스트, AI 아티스트 등)
  - 🎭 공연 (무용가, 배우, 퍼포먼스 아티스트 등)
  - 세부 분야 입력 시 자동 분류 (예: "소설가" → "작가님은 글작가님이네요!")
  - DB 저장: `profiles.field` 에 쉼표 구분 (예: "글, 그림")

### 지망생 (Aspiring)
- 예비 창작자, 학생

### 일반인 (Audience)
- 예술에 관심 있는 감상자/구매자
- 핵심 니즈: 새로운 작가와 작품 발견, 좋아하는 작가 팔로우, 작품 구매
- 진입 동기: "다양한 창작자와 작품을 한 곳에서 탐색"

## 개발 로드맵

### 1단계 — MVP (포트폴리오 + 작품 발견) ← 현재 진행 중
1. 회원가입/로그인 (작가/일반인 구분) — Supabase Auth
2. 작가 프로필 페이지 (소개, 분야, SNS 링크, 프로필 이미지)
3. 작품 갤러리 (이미지 업로드, 제목, 설명, 태그) — Supabase Storage
4. 작가/작품 탐색 (분야별, 태그별 필터링)
5. 팔로우 기능 (작가 팔로우/언팔로우)
6. MOUI-IST 전시 정보 페이지
7. 작가 프로필 공유 링크 (외부에서 접근 가능)

### 2단계 — 커뮤니티 + 모임
- 커뮤니티 게시판 (글쓰기, 댓글, 좋아요)
- 카테고리 분류 (인사이트, 작업일지, 자유, 질문 등)
- 모임/단체전 모집 기능 (날짜, 장소, 정원, 참가 신청)
- 푸시 알림 — Expo Push Notifications
- DM (1:1 메시지)

### 3단계 — 작품 판매 + 고도화
- 작품 판매 기능 (결제 연동)
- 검색 고도화
- 작가 추천 알고리즘
- 알림 시스템 (새 작품, 팔로우한 작가 활동 등)

## 기술 스택

### 프론트엔드
- **프레임워크**: React Native + Expo (SDK 54)
- **언어**: TypeScript (strict mode)
- **플랫폼 타겟**: Android, iOS, Web (Expo의 React Native for Web 사용)
  - 웹 실행: `npm run web` (localhost:8081)
  - 웹 빌드: `npx expo export --platform web` → `dist/` 폴더에 정적 파일 생성
  - 플랫폼별 분기가 필요한 경우 `Platform.OS`로 처리

### 백엔드 / 데이터베이스
- **BaaS**: Supabase (무료 티어)
- **데이터베이스**: PostgreSQL (Supabase 내장)
- **인증**: Supabase Auth
- **파일 저장소**: Supabase Storage (작품 이미지, 프로필 이미지)
- **실시간**: Supabase Realtime (2단계부터 활용)
- **API**: Supabase 자동 생성 REST API + `supabase-js` 클라이언트

### 배포 / 인프라
- **앱 빌드**: EAS Build (Expo Application Services) 무료 티어
  - **Android 패키지**: `com.mouiist.app`
  - **EAS 프로젝트 ID**: `9430ac1c-24e0-4a4f-ad67-27b2a84b6a97`
  - **APK 빌드 명령어**: `eas build --platform android --profile preview`
  - **무료 티어 제한**: 월 30회 빌드
  - **Android Keystore**: EAS에서 자동 생성 및 관리
  - **iOS 빌드**: Apple Developer Program ($99/년) 가입 후 가능
- **웹 호스팅**: Vercel (GitHub main 브랜치 push 시 자동 배포)
  - 배포 URL: https://moui-ist-service.vercel.app
  - 설정 파일: `vercel.json` (빌드 명령어, 출력 디렉토리 지정)
- **푸시 알림**: Expo Push Notifications (2단계부터)
- **도메인**: mouiist.com (기 보유)

## 🔑 계정 정보 (가입 완료)

| 서비스 | 상태 | 계정/정보 |
|--------|------|----------|
| GitHub | ✅ 사용 중 | 계정: `gocoder-net` |
| Supabase | ✅ 프로젝트 연동 완료 | Organization: moui-ist (Free) / Project: moui-ist |
| Vercel | ✅ 자동 배포 연결 완료 | Hobby 플랜, GitHub 연동 |
| Expo | ✅ 가입 완료, CLI 로그인 완료 | gocoder.net@gmail.com (Google 로그인 → CLI용 비밀번호 별도 설정) |

### Supabase 프로젝트 상세
- **Organization**: moui-ist (Free)
- **Project Name**: moui-ist
- **Project URL**: https://xtcyfuizbdegshaujfof.supabase.co
- **Region**: Asia-Pacific
- **Database Password**: ⚠️ 본인만 보관 (로컬 암호 관리자에 저장 필요)
- **Enable Data API**: ✅ 활성화됨
- **API 키 형식**: Supabase 신규 포맷 사용 중
  - Publishable key: `sb_publishable_...` (클라이언트용, `.env`에 저장됨)
  - Secret key: `sb_secret_...` (서버 전용, **절대 클라이언트에 사용 금지**)
  - ⚠️ Secret key가 한 번 채팅에 노출됨 → **Supabase 대시보드에서 키 재생성(rotate) 필요**

### Vercel 배포 상세
- **프로젝트명**: moui-ist-service
- **배포 URL**: https://moui-ist-service.vercel.app
- **Framework Preset**: Other (Expo는 자동 감지 안 됨)
- **빌드 설정** (`vercel.json`):
  ```json
  {
    "buildCommand": "npx expo export --platform web",
    "outputDirectory": "dist",
    "framework": null
  }
  ```
- **자동 배포**: GitHub `main` 브랜치에 push하면 자동으로 빌드 & 배포

### EAS Build 상세
- **EAS 프로젝트 ID**: `9430ac1c-24e0-4a4f-ad67-27b2a84b6a97`
- **Android 패키지명**: `com.mouiist.app`
- **빌드 프로필** (`eas.json`):
  ```json
  {
    "build": {
      "preview": {
        "android": { "buildType": "apk" },
        "distribution": "internal"
      },
      "production": {}
    }
  }
  ```
- **APK 빌드 명령어**: `eas build --platform android --profile preview`
- **빌드 결과 확인**: `eas build:list` 또는 https://expo.dev 대시보드
- **무료 티어**: 월 30회 빌드
- **iOS**: Apple Developer Program ($99/년) 가입 필요, 이후 `eas build --platform ios`

### GitHub 레포 상세
- **Repository**: `gocoder-net/moui-ist-service` (Private)
- **URL**: https://github.com/gocoder-net/moui-ist-service
- **브랜치**: `main`
- **Git GUI**: Fork 사용 중

### 앞으로 가입할 서비스 (추후)
- **Apple Developer Program** — 연 $99 (iOS 출시 직전)
- **Google Play Console** — 1회 $25 (Android 출시 직전)

## 💻 로컬 개발 환경

### 작업 PC
- **OS**: macOS
- **PC 종류**: 회사 컴퓨터 (⚠️ 개인/회사 Git 설정 분리 주의)

### 개발 도구
| 항목 | 버전 | 상태 |
|------|------|------|
| Node.js | v24.5.0 | ✅ Expo 요구사항 18+ 만족 |
| npm | 11.5.1 | ✅ |
| Git | 2.39.5 (Apple Git-154) | ✅ |

### Git 계정 설정 (중요 — 회사 PC라서)
- **전역(global) 설정**: 개인 이메일로 설정됨
  - `user.name`: `gocoder`
  - `user.email`: `gocoder.net@gmail.com`
- **회사 프로젝트들**: `git config --local`로 회사 이메일 설정 완료
  - 회사 Git: `penta-jinhyun` / `jinhyun@pentasecurity.com`
- **향후 개선**: 디렉토리 기반 `includeIf` 자동 분기 설정 (TODO)

### 프로젝트 경로
```
/Users/n22505001/Desktop/gocoder/moui-ist/moui-ist-service
```
→ 이 경로가 **GitHub 레포의 루트**이자 **Vercel 배포 기준 폴더**

### 에디터
- IntelliJ 사용 중
- 추후 Cursor 전환 고려 가능

## 📁 프로젝트 파일 구조 (주요 파일)

```
moui-ist-service/
├── app/
│   ├── _layout.tsx              # 루트 레이아웃 (Stack, ThemeModeProvider, AuthProvider)
│   ├── modal.tsx                # 모달 화면
│   ├── (tabs)/
│   │   ├── _layout.tsx          # 탭 레이아웃 (홈, 작당모의, 탐색, 내 정보)
│   │   ├── index.tsx            # 홈 화면 (출석 이벤트 + 시작하기)
│   │   ├── moui.tsx             # 작당모의 (협업 모집 게시판)
│   │   ├── explore.tsx          # 탐색 화면
│   │   └── profile.tsx          # 내 정보 (프로필, 포인트, 전시관, 인증 배지)
│   ├── profile/
│   │   ├── detail.tsx           # 프로필 상세/편집 (아바타, SNS, 분야)
│   │   ├── settings.tsx         # 설정 (테마 토글, 로그아웃)
│   │   └── points.tsx           # 포인트 내역 조회
│   ├── artist/[id].tsx          # 작가 페이지 (작품 뷰어)
│   ├── artwork/create.tsx       # 작품 업로드/수정
│   ├── exhibition/
│   │   ├── create.tsx           # 전시관 만들기/수정 (4단계 위저드)
│   │   └── [id].tsx             # 전시관 뷰어 (입구 → 3D 관람)
│   └── (auth)/
│       ├── login.tsx            # 로그인
│       └── signup.tsx           # 회원가입
├── components/
│   ├── ui/
│   │   └── icon-symbol.tsx      # SF Symbol ↔ Material Icon 매핑
│   └── exhibition/              # 전시관 관련 컴포넌트
│       ├── WallFaceEditor.tsx   # 벽면 정면 편집
│       ├── Room3DView.tsx       # 펼친 도면 뷰
│       └── gallery-3d/          # 3D 뷰어 컴포넌트들
├── constants/
│   └── theme.ts                 # 브랜드 컬러 (DarkColors, LightColors)
├── contexts/
│   ├── auth-context.tsx         # 인증 Context (useAuth)
│   └── theme-context.tsx        # 테마 Context (useThemeMode)
├── hooks/                       # 커스텀 훅
├── lib/
│   ├── supabase.ts              # Supabase 클라이언트 초기화
│   └── points.ts                # 포인트 차감 유틸 (spendPoints)
├── types/
│   └── database.ts              # Supabase 자동 생성 타입
├── supabase/
│   └── migrations/              # DB 마이그레이션 SQL 파일
├── assets/                      # 이미지, 아이콘
├── .env                         # 환경 변수 (Git 제외)
├── vercel.json                  # Vercel 배포 설정
├── eas.json                     # EAS Build 설정
├── app.json                     # Expo 앱 설정
├── package.json                 # 의존성
└── tsconfig.json                # TypeScript 설정
```

## 📍 현재 진행 상태 (2026년 4월 23일 기준)

### ✅ 완료된 작업
1. 프로젝트 기획 및 로드맵 정리
2. 필요 서비스 4개 가입 (GitHub, Supabase, Vercel, Expo)
3. Supabase 프로젝트 생성 + DB 스키마 설계 + RLS 정책
4. 로컬 개발 환경 확인 (Node.js, npm, Git)
5. Expo 프로젝트 생성 + GitHub 레포 + Vercel 자동 배포
6. **인증**: 이메일/비밀번호 회원가입/로그인 + 온보딩 (작가/일반인)
7. **홈 화면**: 심플 소셜형 랜딩 + 골드 FloatingShape 애니메이션 + 내 전시관 목록
8. **전시관 에디터**: 4단계 위저드 (정보→전시관→벽면→작품 배치)
   - WallFaceEditor: 드래그 이동, 핀치 리사이즈, 모서리 핸들 리사이즈
   - 작품 메타데이터 (연도, 재료, 에디션, 설명, 다중 각도 이미지)
9. **3D 전시관 뷰어** (Three.js + expo-gl):
   - 실제 미터 기반 3D 방, 벽/바닥/천장, 작품별 스포트라이트
   - 듀얼 조이스틱 (이동 + 시선) + 캔버스 드래그 시선
   - 나침반 벽면 이동, 미니맵, 이동속도/시선속도 조절
   - 입장 도어 오프닝 + 360도 둘러보기 연출
   - 작품 터치 → 상세 오버레이 (스포트라이트 빔 + 플레이트 + 다중 각도)
   - 자동 관람 투어 모드 (속도 조절 가능)
   - TTS 서문 낭독
10. **Android APK 빌드**: EAS Build + 로컬 빌드 모두 성공
11. **Android APK 버그 수정**:
    - 이미지 로딩: `expo-file-system`으로 로컬 다운로드 후 텍스처 로딩 (순차, 재시도, 타임아웃)
    - 조이스틱: `measure()` 대신 `locationX/Y` 기반 원점 계산
    - 작품 탭: `onResponderRelease`의 불안정한 좌표 → 터치 시작 좌표 사용 + onLayout 캔버스 크기 보정
12. **다크/라이트 모드 시스템**:
    - `contexts/theme-context.tsx` — ThemeModeProvider + useThemeMode() 훅
    - `constants/theme.ts` — DarkColors / LightColors 두 벌
    - AsyncStorage로 테마 설정 저장/복원
    - 모든 화면(탭, 프로필, 작가 페이지, 작품 폼, 전시관 폼 등) 테마 적용
13. **설정 페이지** (`app/profile/settings.tsx`):
    - 다크/라이트 모드 Switch 토글
    - 로그아웃 버튼
    - 프로필 탭의 ⚙ 아이콘에서 진입
14. **프로필 상세 페이지** (`app/profile/detail.tsx`):
    - 프로필 이미지 업로드 (뷰 모드 + 편집 모드 모두 가능)
    - `expo-image-manipulator`로 200px 리사이즈 + 30% JPEG 압축 (서버 용량 절약)
    - SNS 링크: 3개 URL 입력 → 자동 플랫폼 감지 (Instagram, X, YouTube, Behance 등)
    - 분야: 8개 카테고리 칩 토글 + 세부 분야 입력 시 자동 분류
    - 활동명, 본명, 소개 편집
15. **포인트(모의) 시스템**:
    - `lib/points.ts` — spendPoints(userId, amount, description) 유틸
    - 작품 업로드 시 10모의 차감
    - 전시관 만들기 시 50모의 차감 (수정 시에는 차감 없음)
    - `point_history` 테이블에 내역 기록
    - `app/profile/points.tsx` — 포인트 내역 조회 화면
16. **출석 이벤트** (홈 화면):
    - 7일 연속 출석 보상 (1~6일차: 50모의, 7일차: 500모의)
    - 연속 출석 추적, 7일 완료 후 리셋
    - `attendance` 테이블 (user_id, checked_date, day_number, reward)
17. **작당모의 탭** (`app/(tabs)/moui.tsx`):
    - 협업 모집 게시판 (제목, 상세 내용, 찾는 분야)
    - 작성자 프로필 표시, 모집 상태 (모집 중/마감), 마감 기능
    - `moui_posts` 테이블
18. **작가 인증 상태**:
    - `profiles.verified` (boolean, 기본값 false)
    - 프로필 탭에서 작가 옆에 "인증/미인증" 배지 표시
19. **작가 페이지 뷰어 수정** (`app/artist/[id].tsx`):
    - 슬라이드 카운터: `onMomentumScrollEnd` → `onScroll`로 웹 호환성 수정
    - 수정/삭제 버튼 크기 축소, 오른쪽 하단 배치
20. **작품 업로드 폼 개선** (`app/artwork/create.tsx`):
    - 제작연도 (필수), 재료/기법 분리 (각각 필수)
    - 크기: 가로/세로 세로 배치 (필수)
    - 에디션 (선택), 설명 300자 이상 (필수, 글자수 카운터)
    - 저장 시 재료 + 기법을 "재료, 기법" 형태로 결합

### 🔄 현재 단계
**MVP 기능 확장 중**
- 전시관 생성→관람 전체 플로우 동작 중 (웹 + Android APK)
- 다크/라이트 모드, 설정 페이지, 프로필 편집, 포인트 시스템, 작당모의 탭, 출석 이벤트 완성
- 로컬 APK 빌드: `export JAVA_HOME=$(/usr/libexec/java_home -v 17) && eas build --platform android --profile preview --local`

### ⏭️ 다음 단계

1. **작가 인증 시스템**
   - 인증 신청 → 관리자 승인 플로우
   - 인증 배지 표시

2. **MVP 나머지 기능**
   - 탐색 화면 고도화 (전체 작가/작품 피드 + 필터)
   - 팔로우 기능
   - 공유 링크 (`/[username]` 라우트)

3. **Supabase Secret Key 재생성**
   - 대시보드 → Settings → API Keys에서 Secret key rotate

4. **Supabase 마이그레이션 실행**
   - `005_add_point_history.sql` — 포인트 내역 테이블
   - `006_add_moui_posts.sql` — 작당모의 게시판 테이블
   - `007_add_attendance.sql` — 출석 체크 테이블
   - `008_add_verified.sql` — 작가 인증 상태 컬럼

## 🗄️ DB 스키마

```
profiles
├── id (auth.users와 1:1)
├── username
├── user_type (creator | aspiring | audience)
├── name (활동명)
├── real_name (본명)
├── bio (소개)
├── field (분야, 쉼표 구분 — "글, 그림")
├── sns_links (jsonb — { instagram: "url", twitter: "url", ... })
├── avatar_url
├── points (int, 기본 0 — 모의 포인트)
├── verified (boolean, 기본 false — 작가 인증 상태)
├── created_at
└── updated_at

artworks
├── id
├── user_id (profiles.id FK)
├── title
├── description (300자 이상)
├── image_url
├── year (int — 제작연도)
├── medium (text — "재료, 기법" 결합)
├── width_cm / height_cm (실제 크기)
├── edition (에디션, 선택)
├── tags (text[])
└── created_at

follows
├── follower_id (profiles.id FK)
├── following_id (profiles.id FK)
└── created_at
※ 복합 PK: (follower_id, following_id)

exhibitions
├── id
├── user_id (profiles.id FK)
├── title, description, foreword
├── room_type (small | medium | large | wide)
├── wall_images (jsonb), poster_image_url, bgm_url
├── is_published (boolean)
└── created_at

exhibition_artworks
├── id
├── exhibition_id (FK)
├── artwork_id (FK)
├── wall (north | south | east | west)
├── position_x, position_y (cm), width_cm, height_cm
└── created_at

point_history
├── id
├── user_id (profiles.id FK)
├── amount (int — 양수: 적립, 음수: 차감)
├── balance (int — 트랜잭션 후 잔액)
├── type (spend | reward | mission | purchase)
├── description
└── created_at

moui_posts (작당모의 게시판)
├── id
├── user_id (profiles.id FK)
├── title, description
├── fields (text — 찾는 분야)
├── status (open | closed)
└── created_at

attendance (출석 체크)
├── id
├── user_id (profiles.id FK)
├── checked_date (date, UNIQUE per user)
├── day_number (1~7)
├── reward (int)
└── created_at
```
- 모든 테이블에 RLS 활성화 및 policy 작성 필수
- 회원가입 시 `auth.users` → `profiles` 자동 생성 trigger 설정
- 마이그레이션 파일: `supabase/migrations/` 디렉토리

## 🛠 트러블슈팅 기록

### [2026-04-17] npm 캐시 권한 에러 (EACCES)
- **증상**: `npx create-expo-app` 실행 중 `EACCES: permission denied` 에러로 `npm install` 실패
- **원인**: 과거 `sudo npm` 사용 흔적으로 `~/.npm` 소유권이 root로 꼬여 있었음
- **해결**:
  ```bash
  sudo chown -R $(whoami) ~/.npm
  npm cache clean --force
  ```
- **교훈**: 앞으로 `npm`에는 절대 `sudo` 사용하지 않기

### [2026-04-17] Expo 프로젝트 폴더 중첩 정리
- **증상**: `moui-ist-service/` 안에 또 `moui-ist/` 하위 폴더가 생성되어 2중 구조가 됨
- **원인**: `create-expo-app moui-ist` 명령어가 하위 폴더를 만들어서 그 안에 프로젝트 파일 생성
- **해결**: 하위 파일을 상위로 이동 후 빈 폴더 삭제
- **교훈**: 이미 원하는 폴더 안에 있다면 `npx create-expo-app .` (점 사용)으로 현재 폴더에 바로 생성

### [2026-04-17] 회사 PC에서 Git 계정 오염 위험 발견
- **증상**: 전역 Git 설정이 개인 이메일로 되어 있고, 회사 프로젝트에 로컬 설정이 비어있음
- **위험**: 회사 프로젝트에 개인 이메일로 커밋이 찍힐 수 있음
- **조치**: 회사 프로젝트 폴더마다 로컬 Git 설정 적용 완료
- **교훈**: 회사 PC에서 개인 프로젝트 할 때는 반드시 폴더별 Git 계정 분리 확인

### [2026-04-20] Supabase API 키 형식 변경
- **변경사항**: Supabase가 기존 `anon`/`service_role` JWT 형식에서 새로운 형식으로 변경
  - Publishable key: `sb_publishable_...` (기존 anon key 대체)
  - Secret key: `sb_secret_...` (기존 service_role key 대체)
- **주의**: 대시보드 Settings → API Keys에서 확인 (기존 레거시 키도 아직 존재할 수 있음)

### [2026-04-20] Vercel + Expo 배포 설정
- **주의사항**: Vercel은 Expo를 자동 감지하지 못함 → Framework Preset을 "Other"로 설정해야 함
- **설정**: `vercel.json`에 빌드 명령어와 출력 디렉토리 명시 필요
- **반응형 이슈**: 로컬(모바일 뷰)과 배포(데스크탑 뷰)에서 레이아웃이 다르게 보일 수 있음
  - `Dimensions.get('window')` 대신 `useWindowDimensions()` 훅 사용하면 화면 크기 변경에 자동 대응

### [2026-04-20] zsh에서 Git 경로 괄호 문제
- **증상**: `git add app/(tabs)/index.tsx` → `no matches found` 에러
- **원인**: zsh에서 괄호 `()`가 glob 패턴으로 해석됨
- **해결**: 따옴표로 감싸기 — `git add "app/(tabs)/index.tsx"`

### [2026-04-20] EAS Build 첫 설정
- **Expo 로그인**: Google로 가입한 계정은 CLI에서 비밀번호 로그인이 필요 → expo.dev에서 비밀번호 별도 설정
- **프로젝트 연결**: `eas build` 최초 실행 시 EAS 프로젝트 자동 생성 (Y 선택)
- **Android 패키지**: `com.mouiist.app` (최초 빌드 시 입력, 이후 `app.json`에 저장됨)
- **Keystore**: EAS가 자동 생성 및 관리 (Y 선택)
- **빌드 시간**: 약 10~15분 소요
- **결과**: APK 다운로드 링크 제공 (Android만, iOS는 Apple Developer Program 필요)

### [2026-04-20] 홈 화면 디자인 반복 학습
- **핵심 교훈**: 이 앱은 **커뮤니티 앱**이지 아티스트 그룹 홈페이지가 아님
  - ✅ 심플 소셜형 (Threads, Instagram 첫 화면 느낌)
  - ✅ 깔끔하되 와우 포인트(엣지) 있는 디자인
- **최종 방향**: 미니멀 랜딩 + 골드 애니메이션 배경으로 프리미엄 느낌

### [2026-04-21] Android APK 3D 뷰어 이슈 모음
- **이미지 안 보임**: `expo-three`의 `loadAsync(remoteUrl)`이 Android APK에서 실패
  - 해결: `expo-file-system`으로 로컬 다운로드 → `Asset.fromURI(localPath)` → `loadAsync(asset)`
  - 추가 개선: 순차 로딩, 15초 타임아웃, 1회 재시도, 로컬 캐싱 (djb2 해시 파일명)
- **작품 터치 안 됨**: `gl.drawingBufferWidth`는 물리 픽셀, `locationX`는 dp → NDC 계산 틀림
  - 해결: `PixelRatio.get()`으로 나눠서 dp 변환 + 터치 오버레이 `onLayout`으로 정확한 dp 크기
  - 추가: `onResponderRelease`의 `locationX/Y`가 Android에서 불안정 → 터치 시작 좌표 사용
- **조이스틱 좌표 오류**: `view.measure()`가 Android에서 부정확한 좌표 반환
  - 해결: `locationX/Y`로 뷰 내 오프셋 계산하여 원점 도출
- **로컬 APK 빌드 시 Java 26 에러**: "Unsupported class file major version 70"
  - 해결: `JAVA_HOME`을 Java 17로 지정 (`/usr/libexec/java_home -v 17`)

### [2026-04-22] WallFaceEditor 리사이즈 핸들 이슈
- **모바일에서 리사이즈 안 됨**: 부모 DraggableArtwork PanResponder가 터치 가로챔
  - 해결: ResizeHandle에 `onPanResponderTerminationRequest: () => false`, 부모에 `resizingRef` 체크
- **핸들 터치 시 컴포넌트 언마운트**: `isPinching=true` → `!isPinching` 조건으로 핸들 사라짐 → release 안 불림 → 영구 잠김
  - 해결: 핸들을 항상 마운트 유지, `hidden` prop으로 `opacity: 0`만 적용
- **드래그 후 이미지 선택창 뜸 (PC웹)**: mouseup 후 부모 Pressable의 onPress 발동
  - 해결: `armSuppressWallPress()` — 제스처 끝 후 100ms간 벽 터치 무시

## 📦 설치된 주요 패키지

| 패키지 | 버전 | 용도 |
|--------|------|------|
| expo | ~54.0.33 | Expo SDK |
| react | 19.1.0 | UI 라이브러리 |
| react-native | 0.81.5 | 모바일 프레임워크 |
| react-native-web | ~0.21.0 | 웹 지원 |
| expo-router | ~6.0.23 | 파일 기반 라우팅 |
| @supabase/supabase-js | 최신 | Supabase 클라이언트 |
| react-native-reanimated | ~4.1.1 | 고성능 애니메이션 (홈 화면 FloatingShape, 입장 도어 연출) |
| expo-linear-gradient | ~15.x | 그라데이션 UI |
| three | ^0.166.1 | 3D 렌더링 (전시관 뷰어) |
| expo-three | ^8.0.0 | Three.js + Expo 통합 (네이티브 텍스처 로딩) |
| expo-gl | ~16.0.10 | OpenGL ES / WebGL 컨텍스트 (네이티브 3D 렌더링) |
| expo-image | ~3.0.11 | 고성능 이미지 컴포넌트 |
| expo-image-picker | ~17.0.10 | 작품/프로필 이미지 선택 |
| expo-image-manipulator | ~14.0.8 | 이미지 리사이즈/압축 (아바타 200px + 30% JPEG) |
| expo-speech | ~14.0.8 | TTS (전시 서문 낭독) |
| @react-native-async-storage/async-storage | 최신 | 테마 설정 저장 (다크/라이트) |
| typescript | ~5.9.2 | 타입 시스템 |

## 코딩 규칙

### 일반
- 모든 코드는 TypeScript로 작성한다.
- 컴포넌트는 함수형 컴포넌트 + React Hooks를 사용한다.
- 파일/폴더 구조는 Expo Router의 file-based routing을 따른다.

### 스타일링
- 브랜드 톤에 맞는 미니멀하고 세련된 디자인을 유지한다.
- React Native의 `StyleSheet`을 기본으로 사용한다.
- 반응형 레이아웃으로 웹과 모바일 양쪽에서 정상 동작하도록 한다.
  - `useWindowDimensions()` 훅으로 화면 크기를 동적으로 감지한다.
  - `isWide = width > 600` 기준으로 데스크탑/모바일 분기한다.
- **다크/라이트 모드 지원** — `useThemeMode()` 훅 사용:
  ```tsx
  const { colors: C, mode, toggleTheme } = useThemeMode();
  // C.bg, C.fg, C.gold, C.card, C.border, C.muted, C.mutedLight, C.danger
  ```
- 색상은 `const C` 하드코딩 대신 반드시 `useThemeMode().colors`를 사용한다.
- 새 화면 추가 시 테마 색상을 동적으로 적용해야 한다.

### Supabase
- Supabase 클라이언트는 하나의 모듈(`lib/supabase.ts`)에서 초기화하고 재사용한다.
- 모든 테이블에 RLS(Row Level Security)를 활성화한다.
- 데이터베이스 타입은 Supabase CLI로 자동 생성하여 사용한다.
- 이미지 업로드는 Supabase Storage의 버킷을 사용한다.
- `secret` 키는 **절대 클라이언트 코드에 포함하지 않는다**. `publishable` 키만 사용.
- 환경 변수는 `.env` 파일에 저장하고 `.gitignore`에 **반드시 추가**한다.
- Expo에서는 `EXPO_PUBLIC_` 접두사 환경 변수만 클라이언트에서 읽힘.
  - `EXPO_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Publishable key (sb_publishable_...)

### 플랫폼 호환성
- 네이티브 전용 기능(카메라 등)은 `Platform.OS`로 분기 처리한다.
- 웹에서 지원하지 않는 네이티브 모듈은 조건부 import를 사용한다.
- UI는 모바일 우선(mobile-first)으로 설계하되, 웹에서도 자연스럽게 보이도록 한다.

### 보안
- API 키, DB 비밀번호는 **절대 채팅/코드/커밋에 노출하지 않는다**.
- 민감 정보는 암호 관리자(1Password, Bitwarden, Mac 키체인 등)에 보관한다.
- npm에는 절대 `sudo`를 사용하지 않는다 (권한 문제 유발).
- 회사 PC 사용 중이므로 **회사 프로젝트마다 Git 계정 로컬 설정을 반드시 확인**한다.

### Git 작업 흐름
- 커밋 메시지는 영어, 짧고 명확하게. 접두사 사용:
  - `feat:` 새 기능
  - `fix:` 버그 수정
  - `chore:` 잡무(의존성, 설정 등)
  - `docs:` 문서
  - `style:` 포맷팅
  - `refactor:` 리팩토링
- 의미 있는 단위로 커밋 (한 번에 한 가지 변경)
- **커밋만 하고, push는 사용자가 직접 한다** (Fork Git GUI 사용)
- Push하면 Vercel이 자동으로 배포한다
- Private 레포이므로 실험적 코드도 편하게 push 가능

### 가상 전시관 기능 (핵심 기능)

**개요**: 작가가 가상 전시 공간을 만들고 작품을 걸면, 관람자가 Three.js 기반 3D 공간에서 1인칭 시점으로 감상하는 온라인 전시 시스템.

**전시관 타입** (실제 미터 단위):
- 소형(6×4m), 중형(10×7m), 대형(15×10m), 와이드(20×8m)

**작가 측 (전시관 에디터)**:
1. 전시 정보 입력 (이름, 설명, 서문, 포스터 이미지)
2. 전시관 크기 선택 (4종 템플릿)
3. 4면 벽/바닥/천장 색상 개별 설정 (펼친 도면 뷰)
4. 벽면 정면 에디터에서 터치한 위치에 작품 배치
   - 드래그로 작품 위치 이동
   - 두 손가락 핀치로 크기 조절 (비율 유지)
   - **모서리 핸들 드래그로 크기 조절** (선택 시 4 코너에 핸들 표시)
   - 크기 +/- 버튼으로 가로/세로 개별 조절 (10~300cm)
   - 바닥에서의 높이 조절
   - 작품 간 거리(cm) 라벨 자동 표시
   - 1m 눈금선 + 눈높이(150cm) 가이드라인
   - 다중 각도 사진 업로드 (위/아래/좌/우, 선택)
5. 작품 메타데이터 입력
   - 작품명 (필수)
   - 제작 연도
   - 재료/기법 (칩 선택: 캔버스에 유채, 디지털 프린트 등 12종)
   - 에디션 (판화용, 예: 1/10, AP)
   - 작품 설명

**관람자 측 (3D 1인칭 뷰어)** — Three.js + expo-gl:
1. 입구: 전시 제목, 포스터, 서문 (TTS 낭독 지원) → "전시관 입장"
2. **입장 연출**: 도어 오프닝 애니메이션 + 360도 둘러보기
3. **3D 공간**: 실제 미터 기반 방, 벽/바닥/천장, 스포트라이트 조명
4. **조작 방식**:
   - 이동 조이스틱 (좌) + 시선 조이스틱 (우)
   - 캔버스 드래그로 시선 회전
   - 나침반(N/E/S/W)으로 벽면 직접 이동
   - 미니맵 탭으로 원하는 위치 이동
   - 이동속도/시선속도 5단계 조절
5. **자동 관람 (투어 모드)**: 작품 사이를 자동으로 걸어다니며 감상
   - 각 작품 앞에서 3초간 정지 후 다음 작품으로 이동
   - 투어 속도 5단계 조절
6. **작품 터치 → 상세 오버레이**:
   - 벽면 배경 + 액자 프레임 + 스포트라이트 빔 효과
   - 작품 플레이트: "작품명, 2024 · 캔버스에 유채 · 60×40cm · AP"
   - 다중 각도 감상 (작가가 올린 각도만 👁 버튼 활성화)

**DB 테이블**:
- `exhibitions` - 전시관 정보 (서문, 방 타입, 4면 벽 색상, 바닥/천장 색상, 포스터)
- `exhibition_artworks` - 작품 배치 (벽면, 위치 cm, 크기 cm)
- `artworks` - 다중 각도 이미지 + 메타데이터 (연도, 재료, 실제 크기, 에디션)

**주요 컴포넌트** (`components/exhibition/`):
- `room-geometry.ts` - 공유 타입/상수/유틸 (Wall, RoomType, PlacedArtwork, MEDIUM_OPTIONS 등)
- `WallFaceEditor.tsx` - 벽면 정면 편집 뷰 (터치 배치 + 드래그 이동 + 핀치/핸들 리사이즈)
- `Room3DView.tsx` - 펼친 도면 형태 전시관 뷰 (벽 선택용)

**3D 뷰어 컴포넌트** (`components/exhibition/gallery-3d/`):
- `GalleryScene.tsx` - 메인 3D 뷰어 (HUD, 미니맵, 조이스틱, 상세 오버레이, 입장 도어 연출)
- `GalleryCanvas.tsx` - 캔버스 래퍼 (웹: DOM canvas, 네이티브: expo-gl GLView)
- `GalleryRoom.ts` - 방 구조 빌드 (벽, 바닥, 천장, 코너 트림)
- `GalleryArtwork.ts` - 작품 메시 빌드 (프레임 + 매트 + 이미지 텍스처)
- `GalleryLighting.ts` - 조명 (앰비언트 + 작품별 스포트라이트)
- `use-gallery-controls.ts` - 카메라 컨트롤 훅 (조이스틱, 터치, 자동 네비, 투어, 충돌)
- `gallery-math.ts` - 수학 유틸 (좌표 변환, clamp, yaw→방향)
- `types.ts` - 3D 뷰어 타입 정의

**라우트**:
- `app/exhibition/create.tsx` - 전시관 만들기 (4단계 위저드)
- `app/exhibition/[id].tsx` - 전시관 뷰어 (입구→3D 관람)

### UI 디자인 변경 이력
- 로그인/회원가입: FloatingShape 배경 애니메이션, PlayfulDiamond, 인풋 포커스 골드 전환
- 온보딩: 가로형 카드 + 라디오 선택 애니메이션
- 홈: 시작하기 (작품 업로드 + 전시관 만들기) + 출석 이벤트 (7일 보상)
- 탐색: 카테고리 그리드 + 검색바 + 트렌딩
- **탭바 (4개)**: 홈 → 작당모의 → 탐색 → 내 정보
  - 아이콘: house.fill / bubble.left.and.bubble.right.fill / paperplane.fill / person.fill
- 내 정보: 프로필 카드 (인증 배지), 모의 포인트, 작품 메뉴, 전시관 목록
- 프로필 상세: 아바타 업로드, 분야 8카테고리 칩, SNS 3개 URL 자동 감지
- 설정: 다크/라이트 토글 + 로그아웃
- 전시관 뷰어: 2D CSS 기반 → Three.js 3D 뷰어로 전환
- WallFaceEditor: 모서리 핸들 드래그 리사이즈 추가

### 포인트(모의) 경제 시스템
- **적립**: 출석 보상 (50/500모의), 향후 미션 등
- **차감**: 작품 업로드 (10모의), 전시관 만들기 (50모의)
- **수정 시에는 포인트 차감 없음**
- **내역**: `point_history` 테이블에 모든 트랜잭션 기록
- **환산**: 1모의 = 100원
- **유틸**: `lib/points.ts`의 `spendPoints(userId, amount, description)` 함수 사용

### Git 커밋 히스토리 (최근)
```
fede226 다크/라이트 테마, 설정 페이지, 프로필 기능, 작당모의 탭, 출석 이벤트, 포인트 시스템
9c59a93 리뉴얼
537fec2 첫화면 변경
429a9e2 전시관 UI 개선: 삭제 기능, 탭바 리디자인, 입구/문/상세 디자인 개선
c6486e1 토스 다크모드 색상 적용, 스플래시 속도 개선, 모바일 작품 탭 수정
4ec5b5f fix: Android APK 작품 탭 상세보기 안 뜨는 문제 수정
f308fb3 feat: 작품 모서리 드래그 리사이즈 + Android APK 3D 뷰어 버그 수정
9e9a547 feat: 자동 관람 기능 추가 — 작품 사이를 걸어다니며 감상하는 투어 모드
d8dd9c4 feat: 홈 화면에 내 전시관 목록 섹션 추가
c590abb feat: 작품 상세보기 스포트라이트 조명 효과 + 입장 360도 둘러보기 연출
```

## 응답 규칙
- 코드 생성 시 항상 위 기술 스택 내에서 작성한다.
- 새로운 패키지 추가 시 Expo 호환 여부를 먼저 확인한다.
- Supabase 관련 코드는 항상 에러 핸들링을 포함한다.
- 현재 개발 단계(1단계 MVP)에 집중하고, 2~3단계 기능을 미리 구현하지 않는다.
- 한국어로 응답한다.
- 초보자 친화적으로 한 단계씩 안내한다 (바이브 코딩 맥락 고려).
- 터미널 명령어 제공 시 **왜 그 명령어를 쓰는지** 간단히 설명한다.
- 에러가 나왔을 때 당황하지 않도록 에러 메시지의 의미부터 설명한다.
- 민감한 보안 이슈(Git 계정 오염, API 키 노출 등) 발견 시 즉시 경고한다.
