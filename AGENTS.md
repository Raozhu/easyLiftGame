# Repository Guidelines

## Project Structure & Module Organization
- Vite + React 19 + TypeScript entry lives in `index.tsx`; the root UI logic is in `App.tsx`.
- Reusable UI and game screens are under `components/` (e.g., `StatusPanel.tsx`, `NightCombat.tsx`).
- Game data/configuration sits in `constants.ts`, `prologueConfig.ts`, and `types.ts`; core logic helpers are in `services/gameEngine.ts`.
- Build outputs go to `dist/` (ignored). There is no dedicated `src/` folder; root-level `.tsx` and `.ts` files act as source modules.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start the Vite dev server with HMR for local iteration.
- `npm run build` — produce an optimized production build in `dist/`.
- `npm run preview` — serve the built assets locally to verify production output.

## Coding Style & Naming Conventions
- Use TypeScript everywhere; prefer explicit types for props and game state structures.
- Component files use `PascalCase` (`ActionPanel.tsx`); functions/variables use `camelCase`.
- Favor functional React components and hooks; keep side effects in `useEffect`.
- Indentation is 2 spaces; keep imports sorted by standard/react, project modules, and local utilities.
- Strings currently mix English and Chinese; preserve existing tone and localization when extending UI text.

## Testing Guidelines
- No test runner is configured yet. When adding tests, prefer Vitest + React Testing Library.
- Place component tests alongside components as `*.test.tsx`; pure logic tests can live near helpers as `*.test.ts`.
- Cover core game flows: action resolution, state mutations in `services/gameEngine.ts`, and modal visibility logic.
- Before opening a PR, ensure `npm run build` passes; add `npm run test` to CI once a test setup is introduced.

## Commit & Pull Request Guidelines
- Commit messages should be concise, imperative, and scoped (e.g., `Add night combat flow`, `Refine gacha odds`). Existing history is short; keep a clear verb-led style.
- For pull requests, include: a short summary of the change, how it was tested (commands run), and any relevant screenshots/GIFs for UI updates.
- Avoid committing generated artifacts (`dist/`, `node_modules/`); `.gitignore` already excludes common build outputs.
