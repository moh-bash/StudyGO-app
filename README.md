# 🎓 StudyGO
StudyGO is a mobile application built with React Native and Expo, designed to manage and calculate university grades 💯

<div align="center">
<hr/>

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-20232A?style=for-the-badge&logo=expo&logoColor=white)
![nativewind](https://img.shields.io/badge/nativewind-20232A?style=for-the-badge&logo=tailwindcss&logoColor=06B6D4)
![SQLite](https://img.shields.io/badge/SQLite-20232A?style=for-the-badge&logo=sqlite&logoColor=0D7E4E)

<img src="./assets/images/cavor (2).png" />
</div>

## 🚀 Features
- "Grade Tracking": Easily input and save your university grades for different samesters
- "GPA Calculation": Automatically calculate your GPA based on the grades you input
- "User-Friendly Interface": Intuitive and easy-to-use interface for seamless navigation

## 📱 Download
You can Download the app from the following link: [StudyX](https://expo.dev/accounts/moh-bash/projects/studyx/builds/0dcc0db1-9a5a-4ee4-a798-fdbcd9d14462)

## 📁 Directory Structure
```
StudyX/
├─ app/
│  ├─ (tabs)/
│  │  ├─ _layout.jsx
│  │  ├─ home.jsx
│  │  ├─ settings.jsx
│  │  └─ subject.jsx
│  ├─ components/
│  │  └─ ListItem.jsx
│  ├─ onboarding/
│  │  ├─ components/
│  │  │  ├─ NextButton.jsx
│  │  │  ├─ OnboardingCard.jsx
│  │  │  └─ Pagination.jsx
│  │  ├─ _layout.jsx
│  │  └─ index.jsx
│  ├─ utils/
│  ├─ _layout.jsx
│  ├─ add-subject.jsx
│  └─ index.jsx
├─ constants/
│  └─ data.js
├─ database/
│  ├─ repositories/
│  │  └─ grades.repository.js
│  ├─ index.js
│  └─ schema.js
|─ assets/
|  ├─ images/
|  └─ fonts/
├─ .gitignore
├─ app.json
├─ babel.config.js
├─ eas.json
├─ eslint.config.js
├─ global.css
├─ metro.config.js
├─ nativewind-env.d.ts
├─ package.json
├─ README.md
├─ tailwind.config.js
└─ tsconfig.json
```

## 🔧 Tech stack
- React Native
- Expo
- NativeWind
- SQLite
- AsyncStorage
- Expo Router

## 🗄️ Database Schema
The following diagram illustrates the database architecture and the relationships between the tables used in the application:

![Database ER Diagram](./assets//images/DatabaseSchema%20.png)

The bundled academic data files are not used at runtime. Academic subjects,
semesters, professors, sections, prerequisites, and schedules are supplied by
the authenticated backend and cached in SQLite.

## 🔄 Offline synchronization
After authentication, the app periodically retrieves the authenticated user's
catalog from `GET /api/v1/catalog` and applies it to SQLite in one transaction.
Synchronization also runs when the app returns to the foreground. The SQLite
schema records a per-account checkpoint, remote identifiers, and a durable
outbox for local enrollment operations, so local writes survive restarts.
Catalog snapshots currently use full reconciliation because the backend does
not expose a change cursor or deletion feed. Enrollment operations that do not
identify a server section are retained as explicit conflicts rather than being
reported as synchronized.

## ⏬ Installation
To run the app locally, follow these steps:
1. Clone the repository: 
   
   ```bash
   git clone https://github.com/moh-bash/StudyGO-app.git
   ```
2. Navigate to the project directory:
   
   ```bash
   cd StudyGO-app
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm start
   ```

## 🤝 Contributing
If you would like to contribute and add features to the app, please follow these steps:
1. Fork the repository
2. Create a new branch
3. Make your changes
4. Commit your changes
5. Push to the branch
6. Create a pull request
