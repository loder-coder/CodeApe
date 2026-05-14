# Code Camouflage Community

VS Code dark theme처럼 보이는 익명 커뮤니티 PWA입니다. Next.js App Router, Tailwind CSS, Supabase PostgreSQL을 사용합니다.

## Requirements

- Node.js 20 이상
- npm 10 이상
- Supabase 프로젝트
- Vercel 계정

## Local Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase SQL Editor에서 `supabase/schema.sql`을 먼저 실행한 뒤 `.env.local`에 값을 채우세요.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SERVER_HASH_SALT=replace-with-long-random-string
FORBIDDEN_WORDS=blocked-token
ADMIN_SECRET_KEY=replace-with-admin-secret
```

현재 PC의 Node가 오래된 경우 Next.js가 실행되지 않을 수 있습니다. 화면만 보고 싶다면 `preview.html`을 브라우저에서 직접 열면 됩니다.

## Boards

Explorer의 `src/boards` 아래 카테고리는 다음과 같습니다.

- `ALL`: 전체 게시글
- `General`
- `Humor`
- `C`
- `Java`
- `Python`

각 폴더를 클릭하면 해당 카테고리 게시글만 조회합니다. `ALL`은 서버에서 board 필터를 생략해 전체 게시글을 가져옵니다.

## Posting Flow

1. Explorer의 `+ New File`을 누릅니다.
2. 파일명을 입력하면 우측 에디터에 새 탭이 열립니다.
3. 에디터의 주석 블록 안에 내용을 작성합니다.
4. 하단 Terminal의 `Commit` 버튼을 누르면 `git add`, `git commit` 로그가 출력되고 Supabase DB에 저장됩니다.

## Forbidden Words

금칙어는 세 가지 방식으로 관리할 수 있습니다.

1. `.env.local`의 `FORBIDDEN_WORDS`
2. 프로젝트 루트의 `forbidden-words.txt`
3. 관리자 페이지의 DB 금칙어 라이브러리

파일로 관리하려면 프로젝트 루트에 `forbidden-words.txt`를 만들고 한 줄에 하나씩 쓰면 됩니다.

```txt
blocked-token
spam-keyword
```

기본 파일명 대신 다른 경로를 쓰고 싶다면 `.env.local`에 `FORBIDDEN_WORDS_FILE`을 지정하세요.

```env
FORBIDDEN_WORDS_FILE=./config/forbidden-words.txt
```

## Admin Page

관리자 페이지는 아래 경로입니다.

```text
/admin/internal-terminal
```

접근 제어는 `ADMIN_SECRET_KEY` 환경변수와 화면에서 입력한 Secret Key를 비교합니다.

관리자 페이지에서 할 수 있는 일:

- 모든 게시글의 `report_count` 확인
- 신고 수와 무관하게 강제 주석 처리
- DB 조회 목록에서 숨김 처리
- 숨김/주석 처리 복구
- 실시간에 가까운 Output 로그 모니터링
- Fingerprint hash 또는 IP hash 차단/해제
- DB 기반 금칙어 추가/활성화/비활성화
- 게시글, 댓글, 신고 수 및 런타임 상태 확인

로그 모니터링은 별도 Supabase Realtime 설정 없이 3.5초 간격 폴링으로 동작합니다.

## Deploy

### 1. Supabase 설정

1. Supabase에서 새 프로젝트를 만듭니다.
2. `SQL Editor`를 열고 `supabase/schema.sql` 전체를 실행합니다.
3. `Project Settings > API`에서 아래 값을 확인합니다.
   - `Project URL`
   - `service_role key`

`service_role key`는 서버에서만 써야 합니다. 브라우저 코드에 직접 노출하면 안 됩니다.

이미 기존 테이블을 만든 상태라면 `schema.sql`의 새 컬럼/테이블 부분도 다시 실행하세요. `if not exists` 위주라 반복 실행해도 안전하게 구성했습니다.

### 2. GitHub에 업로드

```bash
git init
git add .
git commit -m "Initial code camouflage community"
git branch -M main
git remote add origin https://github.com/your-name/your-repo.git
git push -u origin main
```

`node_modules`, `.next`, `.env.local`은 `.gitignore`에 포함되어 있으므로 올리지 않습니다.

### 3. Vercel 배포

1. Vercel에서 `Add New Project`를 누릅니다.
2. GitHub 저장소를 선택합니다.
3. Framework Preset은 `Next.js`로 둡니다.
4. Environment Variables에 아래 값을 추가합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SERVER_HASH_SALT=long-random-production-salt
FORBIDDEN_WORDS=blocked-token
ADMIN_SECRET_KEY=long-random-admin-secret
```

5. `Deploy`를 누릅니다.

### 4. 배포 후 확인

- Explorer에서 `General`, `Humor`, `C`, `Java`, `Python`, `ALL` 필터가 동작하는지 확인합니다.
- `+ New File`로 탭 생성 후 Terminal `Commit` 저장이 되는지 확인합니다.
- 같은 브라우저에서 3분 안에 다시 작성하면 `Build Timeout`이 뜨는지 확인합니다.
- `Debug`를 5회 누적하면 글 본문이 투명도 0.1로 soft-delete 되는지 확인합니다.
- `/admin/internal-terminal`에서 Secret Key 입력 후 게시글/로그/차단/금칙어 관리가 되는지 확인합니다.
- 모바일/데스크톱 브라우저에서 앱 설치 후 standalone PWA로 열리는지 확인합니다.

## PWA

`public/manifest.json`은 `display: "standalone"`으로 설정되어 있습니다. 앱 설치 후 실행하면 브라우저 주소창 없이 독립 실행형 앱처럼 열립니다.
