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
FORBIDDEN_WORDS=금칙어,blocked-token
```

현재 PC의 Node가 오래된 경우 Next.js가 실행되지 않을 수 있습니다. 화면만 보고 싶다면 `preview.html`을 브라우저에서 직접 열면 됩니다.

## Deploy

### 1. Supabase 설정

1. Supabase에서 새 프로젝트를 만듭니다.
2. `SQL Editor`를 열고 `supabase/schema.sql` 전체를 실행합니다.
3. `Project Settings > API`에서 아래 값을 확인합니다.
   - `Project URL`
   - `service_role key`

`service_role key`는 서버에서만 써야 합니다. 브라우저 코드에 직접 노출하면 안 됩니다.

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
FORBIDDEN_WORDS=금칙어,blocked-token
```

5. `Deploy`를 누릅니다.

### 4. 배포 후 확인

- 게시글 작성 시 `Commit accepted`가 표시되는지 확인합니다.
- 같은 브라우저에서 3분 안에 다시 작성하면 `Build Timeout`이 뜨는지 확인합니다.
- `Debug`를 5회 누적하면 글 본문이 투명도 0.1로 soft-delete 되는지 확인합니다.
- 모바일/데스크톱 브라우저에서 `앱 설치`를 눌러 standalone PWA로 열리는지 확인합니다.

## PWA

`public/manifest.json`은 `display: "standalone"`으로 설정되어 있습니다. 앱 설치 후 실행하면 브라우저 주소창 없이 독립 실행형 앱처럼 열립니다.
