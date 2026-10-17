# AGENTS.md

Expo/React Native app (StudyGO). Package manager is **npm** — `package-lock.json` is present, there is no `bun.lock`. Use `npx` / `npm run`.

Current stack (see `package.json`): Expo SDK **57**, React Native **0.86**, React **19.2**, Expo Router with `typedRoutes` and `reactCompiler` enabled (`app.json` experiments), NativeWind **v5 RC** + Tailwind **v4**, TypeScript strict (`tsconfig.json`), Vitest for unit tests.

## Expo moves fast — do not trust training data

Expo ships breaking changes every SDK release. Before writing any Expo / EAS / React Native API code:

1. Confirm the `expo` major version in `package.json` (currently 57).
2. Fetch `https://docs.expo.dev/versions/v<major>.0.0/` for that major.
3. For anything else, start at `https://docs.expo.dev/llms.txt` (index + LLM-misconception corrections) and follow links. Never answer from memory.

## Commands

```bash
npm start                 # expo start (dev server)
npm test                  # vitest run (unit tests, Node env)
npm run lint              # expo lint  (caches by default — see note)
npx tsc --noEmit          # typecheck
npx expo-doctor           # diagnose dependency/config issues
npx expo install <pkg>    # ALWAYS use for deps — resolves SDK-compatible versions
npx expo install --fix    # fix incompatible versions
```

Run `npm test`, `npx tsc --noEmit`, and `npm run lint` before declaring a task done.

`expo lint` **caches results by default**. After adding files, changing module resolution, or installing packages, stale `import/no-unresolved` errors can appear. Re-run with `npx expo lint --no-cache` to get the truth.

## Testing

- Vitest is installed; the script is `npm test` (`vitest run`). Config: `vitest.config.mts` (Node environment, `src/**/*.test.ts`).
- `expo-constants` is aliased to `test/stubs/expo-constants.ts` because the real package pulls in React Native's Flow source, which Node cannot parse. Keep that alias.
- Tests set `process.env.EXPO_PUBLIC_API_BASE_URL` themselves (e.g. `http://test.local`); they do not read `.env`.
- Pure logic (API client, session service, payload validators, JWT `exp` reader) is unit-tested. UI is not — there is no renderer/testing-library configured.

## Backend & API layer (`src/lib/api/`)

The app talks directly to the backend (no BFF). Origin: `https://studygo-api.onrender.com`, all routes under `/api/v1` (see `src/lib/config.ts`).

- Base URL resolution: `EXPO_PUBLIC_API_BASE_URL` (from `.env` in dev) → `expo.extra.apiBaseUrl` in `app.json` (standalone builds where `.env` is absent). Timeout via `EXPO_PUBLIC_API_TIMEOUT_MS` (default 15s).
- `client.ts` — typed `fetch` wrapper: JSON headers, bearer auth, per-request timeout, error normalization, and transparent token refresh. **Proactive** refresh when the stored JWT is expired/expiring within 60s (`jwt.ts` reads the `exp` claim), plus **reactive** refresh on an eligible `401` (one refresh + one replay, never a loop).
- `errors.ts` — `ApiError` / `NetworkError` / `ConfigError` / `ResponseParseError`. Callers use these types to distinguish an *offline* failure from an *explicit rejection*.
- `auth.ts` — `/auth/{register,login,refresh,logout,me}`. Logout sets `retryOnUnauthorized: false` so sign-out never triggers a refresh.
- `programs.ts` — `GET /programs/registration` (public, bare array) used by sign-up.
- `catalog.ts` — `GET /catalog` (authenticated) returns the program-scoped academic catalog used to populate the Courses screen; cached locally via `src/lib/db/`.
- `types.ts` — DTOs; `enrollments.ts` are typed bindings not yet wired to a screen.
- Responses are validated at runtime before reaching the UI.

## Auth & session (`src/lib/auth/`)

- **Single auth stack.** `AuthContext.tsx` (`useAuth`) is the only provider; it is backed by `session.ts` (token lifecycle, refresh, restore) and `response.ts` / `validation.ts` / `errors.ts`. The old mock `src/features/auth/session-provider.tsx` has been removed — do not reintroduce a second stack.
- State machine: `initializing` → `authenticated` | `offline` | `unauthenticated`. `offline` means the backend could not be reached but stored tokens were retained (the UI may continue with cached data); `unauthenticated` means no session, or the backend explicitly rejected it.
- Refresh is **single-flight** and rotates tokens; the presented refresh token is revoked, so it is never replayed. An `epoch` counter discards a refresh that resolves after logout.
- `onSessionInvalidated` lets a rejected *background* refresh flip the UI back to signed-out (see the subscription in `AuthContext.tsx`).
- Onboarding is **separate** from auth: `src/features/onboarding/onboarding-provider.tsx` (`useOnboarding`) stores a device flag in AsyncStorage under `studygo.onboarded`.

## Storage

- `src/lib/storage/token-storage.ts` — `expo-secure-store` only (OS keystore). Never write tokens to AsyncStorage/SQLite/logs; there is no insecure fallback (it throws `TokenStorageError`).
- `src/lib/storage/profile-cache.ts` — non-sensitive user snapshot in AsyncStorage (`studygo.profile`), used to render the app offline; cleared on logout/rejection.
- `src/lib/db/` — local `expo-sqlite` database `studygo.db` caching the full program catalog (`catalog_meta`, `semesters`, `subjects`, `professors`, `sections`, `schedules`) and the locally saved course selections (`course_selections`). The DB is cleared on logout or session invalidation.

## Routing (Expo Router)

- Routes live in `src/app/**`. Root `src/app/_layout.tsx` provides `AuthProvider` → `OnboardingProvider` and gates screens with `Stack.Protected`.
- **Boot gate**: while the onboarding flag and session restore are resolving, root renders `<AppLoader />` (no navigator) and the native splash stays up; the splash is hidden only once boot completes. This is what prevents the onboarding/welcome screen from flashing before the real route is known.
- Guards: `!hasOnboarded` → `onboarding`; `hasOnboarded && !canUseApp` → `(auth)`; `hasOnboarded && canUseApp` → `(app)` (where `canUseApp = authenticated || offline`).
- Groups: `(auth)` = login / sign-up; `(app)` = `index` / `courses` / `account`, rendered with the custom `src/components/floating-tab-bar.tsx` (not the default tab bar) and a shared `OfflineBanner`. The course detail screen is at `course/[id]` as a sibling of `(app)`.
- `.expo/types/router.d.ts` is generated (gitignored) and often stale — never edit it.

## Styling (NativeWind v5 RC + Tailwind v4)

- Wired in `metro.config.js` (`withNativewind`) and `postcss.config.mjs`.
- There is **no `tailwind.config.js`**. Theme tokens live in `src/app/global.css` under `@theme` (e.g. `--color-brand-*`, `brand-600 = #208aef`). That file is imported once in `src/app/_layout.tsx`.
- Use `className` on RN components. Use `cn()` from `src/lib/cn.ts`. For imperative colors (icon `color` props), use `palette` from `src/constants/theme.ts`.
- Prefer the custom `src/components/ui/*` primitives (`text-field`, `select-field`, `button`, `app-loader`) over third-party form/UI libraries.

## Language

- **Arabic is the primary language of the application.** All user-facing text — screen titles, labels, placeholders, buttons, links, empty states, and messages — is written in Arabic. Author new UI copy in Arabic rather than English.
- This includes the auth screens (`(auth)/login`, `(auth)/sign-up`), the onboarding slides, the Courses (`المقررات`) screen, the course detail screen, and error/validation messages under `src/lib/auth/`. Brand/product names (e.g. `StudyGo`) and email-address placeholders stay in Latin script.
- Keep code identifiers, type/field names, and code comments in English.

## Conventions

- Path aliases: `@/*` → `./src/*`, `@/assets/*` → `./assets/*` (`tsconfig.json`).
- `.env` sets `EXPO_PUBLIC_API_BASE_URL`; `expo start` / `expo lint` auto-load it. Only `EXPO_PUBLIC_*` (non-secret) values belong there.
- User-facing copy is Arabic (see "Language" above), including the `(auth)` screens and the messages under `src/lib/auth/`. Keep brand/product names as-is.
- React Compiler is on: `react-hooks/set-state-in-effect` fails the build. Fetch in an effect without writing state synchronously (write only after `await`, guard with an `active` flag).

## Native builds (CNG + EAS)

- `ios/` and `android/` do not exist and are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only bundles its own native modules. After adding a library with native code (e.g. `expo-secure-store`, `expo-sqlite`), use a dev build: `npx expo run:ios|android`, or `eas build --profile development`.
- Prefer Expo modules over third-party libraries; check available skills before adding deps. Docs: `https://docs.expo.dev/versions/latest/index.md`.
- EAS for cloud build/submit/OTA: run as `npx eas-cli@latest <command>`. Docs: `https://docs.expo.dev/eas/index.md`.

## README is stale

`README.md` describes an old flat layout (`app/`, `constants/`, `database/`) and AsyncStorage/SQLite/offline-sync features that are not in this tree. Trust the code and this file over the README.
