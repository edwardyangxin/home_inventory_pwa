# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains the Next.js App Router code. The main UI is in `app/page.tsx` and global styles live in `app/globals.css`.
- `public/` holds static assets (PWA manifest, icons).
- `__tests__/` contains Vitest + Testing Library tests (e.g., `__tests__/page.test.tsx`).
- Root config files: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.mts`.
- `API.md` is the source of truth for backend endpoints and response shapes.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start the local dev server (`next dev --webpack`).
- `npm run build`: production build and type check (`next build --webpack`).
- `npm run lint`: run ESLint rules.
- `npm run test`: run Vitest test suite.

## Coding Style & Naming Conventions
- Language: TypeScript with strict typing; avoid `any` and define interfaces for API data.
- React: prefer functional components and hooks; use `useRef` for Web Speech API callbacks to avoid stale closures.
- Styling: Tailwind CSS utility classes in `className` (mobile-first).
- Icons: use `lucide-react`.
- Naming: `PascalCase` for components/types, `camelCase` for variables/functions.
- State source: avoid introducing new state sources; drive UI from API responses whenever possible.

## Testing Guidelines
- Frameworks: Vitest + Testing Library + JSDOM.
- Location: place tests in `__tests__/` with `*.test.ts` / `*.test.tsx` naming.
- Run tests with `npm run test` before PRs that change UI or API behavior.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits seen in history: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`.
- PRs should include: a clear description, testing notes (commands + results), and screenshots for UI changes.
- Link related issues when applicable.

## Configuration & API Notes
- Node version: `>=22` (see `package.json`).
- `API.md` is a read-only contract for backend shape; use it as the source of truth for data structures.

## Documentation Workflow
- When the UI flow changes, update `user_manual.md`.
- Before changing UI flow code, update `user_manual.md` first and implement the code to match it.
