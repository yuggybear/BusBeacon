const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

# BusBeacon

BusBeacon is a React and Vite application for bus tracking and driver communication.

## Run locally

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

Push to the `master` branch. The GitHub Actions workflow in `.github/workflows/deploy-pages.yml` installs dependencies, builds `dist`, and publishes it to GitHub Pages.

In the repository settings, set **Pages** to **GitHub Actions**. The site will be available at:

`https://yuggybear.github.io/BusBeacon/`
