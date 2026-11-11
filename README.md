# Style Flow

React + Vite + Supabase + Cloudflare Pages. 한국어 의류 인벤토리 & 코디 스튜디오.

## 시작
1. `npm install`
2. Supabase 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 전체 실행
3. `.env.example`을 `.env`로 복사하고 두 환경변수 입력 (비밀 service_role 키 사용 금지)
4. Supabase Authentication → Email 가입 방식/이메일 확인 설정 확인. Site URL 및 Redirect URLs에 실제 Cloudflare Pages 주소 등록.
5. `npm run dev` → 브라우저에서 회원가입 후 이용
6. `npm run build`로 빌드 확인

## Cloudflare Pages
- GitHub 저장소 연결 → Framework: Vite
- Build command: `npm run build`
- Build output: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- SPA 경로는 모두 루트에서 렌더링.

## 구현 내용
- 이메일 인증, 로그인, 로그아웃
- 옷 사진 업로드(10MB 제한), 수정, 삭제, 분류/검색, Supabase private Storage signed URL
- 슬롯 모드(카테고리별 다중 항목 가능), 자유 캔버스(드래그·크기·각도·순서 변경), 코디 저장/수정/복제/삭제/즐겨찾기
- 코디별 아이템 연결, 카테고리 필터, 반응형 모바일 UI
- 학습 탭은 차후 확장을 위한 소개 화면

## 유의 사항
- 캔버스는 사진의 배경을 자동 제거하지 않습니다. 배경 없는 PNG/WebP를 올리면 더 깔끔합니다.
- 캔버스 내보내기는 브라우저 인쇄/스크린샷 대신 추후 구현 예정입니다.
- 옷 삭제 시 연결된 코디에서 해당 아이템이 제거되므로 확인 메시지가 나옵니다.
- Supabase 미설정 상태에서는 설정 안내 화면을 제공합니다.

## 현재 Supabase 연결 설정
- 제공된 프로젝트 URL 및 브라우저용 publishable key가 `.env.production`과 `.env.example`에 설정되어 있습니다.
- 로컬 개발용 `.env`도 포함되어 있지만 `.gitignore`에 의해 Git에는 올라가지 않습니다.
- Cloudflare Pages 환경변수에 동일한 두 값을 등록할 수도 있습니다.
- Supabase SQL (`supabase/schema.sql`)은 별도로 SQL Editor에서 실행해야 합니다. 프로젝트 파일에 값을 넣는 것만으로 테이블이 만들어지지는 않습니다.

## Fashion Finder 상품명 일괄 검색·저장

- FASHION → FINDER → **상품명 일괄 검색 · 등록**을 펼쳐서 사용
- 예: `잔스포츠 노스페이스 휠라 경량패딩` → 세 브랜드의 경량패딩을 각각 검색
- 정확한 상품명 10개를 줄바꿈해서 넣고 각각의 NAVER 쇼핑 상품 후보를 조회한 후 상품을 확인하고 **한꺼번에 저장**
- 기존 Price Tracker 상품 목록(IndexedDB)에 저장하며 중복 URL은 건너뜀. 검색 표시 최저가는 실제 판매가로 저장하지 않음.
- 자동 검색을 사용하려면 [NAVER 개발자센터](https://developers.naver.com/)에서 애플리케이션을 만들고 **검색 API**를 활성화할 것.
- Cloudflare Pages → Settings → Variables and Secrets에서 다음 변수를 **서버 측 런타임 환경변수**로 설정하고 재배포:
  - `NAVER_CLIENT_ID`
  - `NAVER_CLIENT_SECRET` (**Secret으로 설정, VITE_ 접두사 금지**)
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- 로그인한 사용자의 Supabase 인증을 확인한 후 네이버 검색 API를 호출하며 검색 키는 브라우저로 전송하지 않음.
- 네이버 API 키 설정 전에는 검색어별 네이버 쇼핑 직접 검색·URL 직접 입력으로 대신 등록 가능.
- 현재 Price Tracker 저장소는 **이 기기 IndexedDB**이므로 다른 기기 자동 동기화는 되지 않음. JSON 백업을 권장.

