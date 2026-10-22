# 🎓 StudyGO
StudyGO is an Arabic-first mobile app built with React Native and Expo that lets university students browse their program's academic catalog and manage their course selections — online or offline.

<div align="center">
<hr/>

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-20232A?style=for-the-badge&logo=expo&logoColor=white)
![nativewind](https://img.shields.io/badge/nativewind-20232A?style=for-the-badge&logo=tailwindcss&logoColor=06B6D4)
![SQLite](https://img.shields.io/badge/SQLite-20232A?style=for-the-badge&logo=sqlite&logoColor=0D7E4E)

<img src="./assets/images/cavor (2).png" />
</div>

## 📱 Download
You can Download the app from the following link: [StudyX](https://expo.dev/accounts/moh-bash/projects/studyx/builds/0dcc0db1-9a5a-4ee4-a798-fdbcd9d14462)

## ✨ Features
- **Onboarding → authentication**: welcome slides, then sign up / log in against the StudyGO backend. Registration includes picking a university program (`GET /programs/registration`).
- **Academic catalog**: semesters, subjects (credit hours, project/exam weights, prerequisites), sections, professors, and schedules for your program.
- **Course selections**: pick your subjects per semester; selections are saved locally and survive restarts.
- **Course details**: subject info plus its sections, in a dedicated screen.
- **Offline mode**: the catalog is cached in SQLite, so the app renders from cache instantly and keeps working when the backend is unreachable (stored session is kept, an offline banner offers reconnect).
- **Arabic-first UI with dark mode**: all user-facing copy is in Arabic; the visual theme is tokenized via NativeWind/Tailwind.

## 🗄️ Data & offline behavior
The app talks directly to the backend at `https://studygo-api.onrender.com` (all routes under `/api/v1`, configured in `.env` / `app.json`).

- After sign-in the catalog is fetched from `GET /api/v1/catalog` and written to the local SQLite database `studygo.db` in a single transaction (full reconciliation — there is no incremental sync endpoint). It is also read on screen load, so cached data shows immediately.
- Local tables: `catalog_meta`, `semesters`, `subjects`, `professors`, `sections`, `schedules`, and `course_selections` (migrations are versioned via `PRAGMA user_version`).
- Course selections are **local-only** today; the enrollment API bindings (`src/lib/api/enrollments.ts`) exist but are not wired to a screen yet.
- Access/refresh tokens live in the OS keystore (`expo-secure-store`) with transparent refresh; the profile snapshot and the whole database are cleared on sign-out or session rejection.

## 🔧 Tech stack
- Expo SDK 57 / React Native 0.86 / React 19.2, TypeScript (strict)
- Expo Router (typed routes, React Compiler enabled)
- NativeWind v5 RC + Tailwind v4 (theme tokens in `src/app/global.css`)
- expo-sqlite (local cache), expo-secure-store (tokens)
- Vitest for unit tests

## 📁 Project structure
```
src/
├─ app/              # Expo Router routes (file-based)
│  ├─ (auth)/        #   login, sign-up
│  ├─ (app)/         #   index (home), courses, account — custom floating tab bar
│  ├─ add-course/    #   semester/subject picker
│  ├─ course/[id]    #   course detail
│  ├─ _layout.tsx    #   providers, route guards, splash/boot gate
│  └─ global.css     #   Tailwind v4 @theme tokens
├─ components/       # shared UI (tab bar, course cards, ui/* primitives)
├─ features/         # onboarding + courses hooks
├─ lib/
│  ├─ api/           # typed fetch client + auth/catalog/programs endpoints
│  ├─ auth/          # AuthContext, session/refresh, validation
│  ├─ db/            # expo-sqlite stores (catalog cache, selections)
│  └─ storage/       # SecureStore tokens, profile cache
└─ constants/        # onboarding slides, color palette
assets/
```

## 🚀 Getting started
1. Clone and install:
   ```bash
   git clone https://github.com/moh-bash/StudyGO-app.git
   cd StudyGO-app
   npm install
   ```
2. The tracked `.env` already sets `EXPO_PUBLIC_API_BASE_URL` (production); edit it to point at a local backend if needed (absent/empty values fall back to `expo.extra.apiBaseUrl` in `app.json`).
3. Start the dev server:
   ```bash
   npm start
   ```
   Useful checks before pushing: `npm test`, `npx tsc --noEmit`, `npm run lint`.

> **Note:** Everything the app uses today runs in **Expo Go** (`expo-sqlite` and `expo-secure-store` are both included in Expo Go per the Expo docs). A development build (`npx expo run:ios` / `run:android`) is only needed if you add a third-party library with custom native code — check the ["Expo Go" tag on React Native Directory](https://reactnative.directory/?expoGo=true) first.

## 🤝 Contributing
To contribute and add features, please follow these steps:
1. Fork the repository
2. Create a new branch
3. Make your changes
4. Commit your changes
5. Push to the branch
6. Create a pull request
