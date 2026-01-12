# 🤖 Coding Agent Guidelines

This document serves as the primary operational guide for AI Agents working on the **Web Speech Inventory PWA** project. Adhere strictly to these protocols to ensure code quality, consistency, and stability.

## 1. Project Overview & Tech Stack

- **Type**: Progressive Web App (PWA) for Home Inventory Management.
- **Framework**: [Next.js 16+](https://nextjs.org/) (App Router).
- **Language**: TypeScript.
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/).
- **Icons**: [Lucide React](https://lucide.dev/).
- **Key Feature**: Web Speech API for voice-based inventory management.
- **PWA Plugin**: `@ducanh2912/next-pwa`.

## 2. Development Workflow

### Initialization
- **Package Manager**: `npm`.
- **Install Dependencies**: `npm install`.

### Running Local Server
- **Command**: `npm run dev`.
- **Note**: The project uses `--webpack` flag in scripts (`next dev --webpack`) to ensure compatibility with certain PWA or build configurations. Do not remove this flag unless necessary.

### File Structure
- `app/`: Application source code (Next.js App Router).
  - `page.tsx`: Main entry point and logic (currently a single-page app).
  - `globals.css`: Global styles and Tailwind directives.
- `public/`: Static assets (manifest, service workers, icons).
- `API.md`: **Source of Truth** for backend endpoints. Always check this before modifying API calls.

## 3. Coding Standards & Best Practices

### TypeScript & React
- **Strict Typing**: Avoid `any` wherever possible. Define interfaces for API responses (e.g., `InventoryItem`, `ProcessVoiceResponse`).
- **Hooks**:
  - Use `useState` for UI state.
  - Use `useRef` for values that persist across renders but don't trigger re-renders, **especially for Web Speech API callbacks** to avoid closure staleness issues (e.g., `recordingModeRef`).
- **Components**: Prefer functional components. Keep the UI modular (though currently concentrated in `page.tsx`, refactoring into smaller components is encouraged for complex features).

### Styling (Tailwind CSS)
- Use utility classes directly in `className`.
- Ensure responsive design (mobile-first approach).
- Use `lucide-react` for all iconography.

### Web Speech API
- **Browser Compatibility**: Check for `window.SpeechRecognition` or `window.webkitSpeechRecognition`.
- **Language Handling**:
  - Support dynamic language switching (`zh-CN` / `en-US`).
  - Always update the `recognition.lang` property when the language state changes.
- **Audio Handling**: Handle microphone permissions and "no-speech" errors gracefully.

## 4. Testing & Verification

*Currently, this project relies on Static Analysis and Build Checks rather than a dedicated test runner.*

### 1. Linting
- **Command**: `npm run lint`.
- **Rule**: Code must pass ESLint standards (configured in `eslint.config.mjs` and `.eslintrc`). Fix all warnings before committing.

### 2. Compilation Check
- **Command**: `npm run build`.
- **Rule**: ALWAYS run a build check after significant refactoring to ensure type safety and build validity. The build output provides TypeScript validation.

### 3. Manual Verification
- **PWA Features**: Check Service Worker registration in the browser DevTools (Application tab).
- **Voice Input**: Test voice input in both "Main" mode and "Modal" (e.g., Habits) mode to ensure context switching works.

## 5. API Integration

- **Base URL**: Defined in `API.md` (e.g., `https://home-inventory-service-....run.app`).
- **Pattern**:
  - Use `fetch` with `await/async`.
  - Handle loading states (`isLoading`, `isProcessing`) visible to the user.
  - Handle errors gracefully (toast notifications or status text updates).
- **Updates**: When the backend API changes, update local interfaces in `page.tsx` to match `API.md` exactly.

## 6. Deployment

- **Platform**: Vercel.
- **Build Command**: `npm run build`.
- **Output**: `.next` folder.
- **Environment**: Ensure no hardcoded secrets are committed. (Currently, API URLs are public, but sensitive keys should use `.env.local`).

## 7. Operational Rules for Agents

1.  **Read First**: Always read `API.md` and `package.json` before starting a task.
2.  **Atomic Changes**: Make small, verifiable changes.
3.  **No Regressions**: When fixing bugs (like the voice input closure issue), ensure the fix doesn't break existing features (like language toggling).
4.  **Documentation**: Update `API.md` if you discover backend behavior that differs from the documentation. Update `AGENTS.md` if workflows change.