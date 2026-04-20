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
※ 홈 화면은 `#FFFFFF` 순백 배경 사용 중 (Brand.white와 별도)

## 사용자 유형

### 작가 (Creator)
- 모든 분야의 창작자 (미술, 글, 사진, 음악 등)
- 핵심 니즈: 작품을 제대로 보여줄 전용 포트폴리오, 작가 간 네트워킹, 전시/모임 참여
- 진입 동기: "인스타보다 작품에 집중된 공간, 명함/바이오에 걸 수 있는 포트폴리오 링크"

### 일반인 (Audience)
- 예술에 관심 있는 감상자/구매자/지망생
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
| Expo | ✅ 가입 완료 | gocoder.net@gmail.com (Google 로그인) |

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
│   ├── _layout.tsx              # 루트 레이아웃 (Stack, 테마 Provider)
│   ├── modal.tsx                # 모달 화면
│   └── (tabs)/
│       ├── _layout.tsx          # 탭 레이아웃 (Home, Explore)
│       ├── index.tsx            # 홈 화면 (MOUI-IST 브랜드 랜딩)
│       └── explore.tsx          # 탐색 화면 (미구현)
├── components/                  # 공용 컴포넌트 (Expo 기본 제공)
├── constants/
│   └── theme.ts                 # 브랜드 컬러, 폰트 정의
├── hooks/                       # 커스텀 훅
├── lib/
│   └── supabase.ts              # Supabase 클라이언트 초기화
├── assets/                      # 이미지, 아이콘
├── .env                         # 환경 변수 (Git 제외)
├── vercel.json                  # Vercel 배포 설정
├── app.json                     # Expo 앱 설정
├── package.json                 # 의존성
└── tsconfig.json                # TypeScript 설정
```

## 📍 현재 진행 상태 (2026년 4월 20일 기준)

### ✅ 완료된 작업
1. 프로젝트 기획 및 로드맵 정리
2. 필요 서비스 4개 가입 (GitHub, Supabase, Vercel, Expo)
3. Supabase 프로젝트 생성 (moui-ist)
4. 로컬 개발 환경 확인 (Node.js, npm, Git 설치됨)
5. Expo 프로젝트 생성 완료 (default 템플릿, TypeScript + Expo Router)
6. `npm install` 완료
7. 로컬에서 `npm run web` 정상 동작 확인
8. GitHub 레포 생성 및 push 완료 (`gocoder-net/moui-ist-service`, Private)
9. `.gitignore` 업데이트 (`.idea/`, `.vscode/`, `.env`, `.env.local` 추가)
10. 회사 프로젝트 Git 계정 분리 완료
11. **Vercel 연결 및 자동 배포 설정 완료** (`vercel.json` 생성, GitHub 연동)
12. **Supabase 연동 완료** (`@supabase/supabase-js` 설치, `lib/supabase.ts` 클라이언트 초기화, 연결 테스트 성공)
13. **홈 화면 디자인 완료** (MOUI-IST 브랜드 라이트 테마, 반응형 레이아웃)
    - 메인 타이틀: "모의스트" (한글)
    - 서브: "창작을 모의하는 커뮤니티"
    - CTA: "작가로 시작하기" / "감상자로 둘러보기"
14. **Vercel 배포 확인** (https://moui-ist-service.vercel.app 정상 동작)

### 🔄 현재 단계
**DB 스키마 설계 직전**
- Supabase 연동은 완료, 아직 테이블은 없음
- 홈 화면 디자인은 1차 완료 (추후 디테일 보완 가능)

### ⏭️ 다음 단계 (순서)

1. **DB 스키마 설계**
   - Supabase 대시보드 또는 SQL Editor에서 테이블 생성
   - `profiles`, `artworks`, `follows`, `exhibitions` 테이블 생성
   - 모든 테이블에 RLS 활성화 + policy 작성
   - `auth.users` → `profiles` 자동 생성 trigger 설정

2. **인증 구현**
   - 회원가입/로그인 화면 (이메일+비밀번호)
   - 온보딩 플로우 (작가/일반인 선택)
   - 로그인 상태 관리 (Supabase Auth 세션)

3. **MVP 기능 구현**
   - 작가 프로필 페이지 (조회 → 편집)
   - 작품 업로드 (Storage 연동)
   - 작품 갤러리 (본인 작품 그리드)
   - 탐색 화면 (전체 작가/작품 피드 + 필터)
   - 팔로우 기능
   - 공유 링크 (`/[username]` 라우트)
   - 전시 정보 페이지 (정적 데이터)

4. **Supabase Secret Key 재생성**
   - 대시보드 → Settings → API Keys에서 Secret key rotate
   - 채팅에 노출된 키 무효화

## 🗄️ DB 스키마 (MVP 최소 구성)

```
profiles
├── id (auth.users와 1:1)
├── user_type (creator | audience)
├── name
├── bio
├── field (창작 분야)
├── sns_links (jsonb)
├── avatar_url
└── created_at

artworks
├── id
├── user_id (profiles.id FK)
├── title
├── description
├── image_url
├── tags (text[])
└── created_at

follows
├── follower_id (profiles.id FK)
├── following_id (profiles.id FK)
└── created_at
※ 복합 PK: (follower_id, following_id)

exhibitions
├── id
├── title
├── description
├── date
├── location
├── cover_image_url
└── created_at
```
- 모든 테이블에 RLS 활성화 및 policy 작성 필수
- 회원가입 시 `auth.users` → `profiles` 자동 생성 trigger 설정

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

## 📦 설치된 주요 패키지

| 패키지 | 버전 | 용도 |
|--------|------|------|
| expo | ~54.0.33 | Expo SDK |
| react | 19.1.0 | UI 라이브러리 |
| react-native | 0.81.5 | 모바일 프레임워크 |
| react-native-web | ~0.21.0 | 웹 지원 |
| expo-router | ~6.0.23 | 파일 기반 라우팅 |
| @supabase/supabase-js | 최신 | Supabase 클라이언트 |
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
- **앱은 라이트 테마 기본** (아티스트 그룹 웹사이트와 반전된 디자인).
- 브랜드 컬러는 `constants/theme.ts`의 `Brand` 객체를 사용한다.

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

### Git 커밋 히스토리
```
8ff18c3 fix: improve home screen layout and responsiveness
a0f23ec feat: add MOUI-IST branded home screen and Supabase integration
226882d chore: add Vercel deployment config
f226029 init
f20d927 Initial commit
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
