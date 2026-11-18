# Waypoint

A prototype that matches students and graduates to internships, scholarships, job shadowing and postgraduate programs, and shows exactly what each one needs. Compass is its AI guide, powered by Claude.

## Run it on your own computer

1. Connect Compass to Claude, in either of these ways:
   - No key: install the `ant` CLI (`brew install anthropics/tap/ant`) and run `ant auth login` once.
   - API key: copy `.env.example` to `.env` and paste your key after `ANTHROPIC_API_KEY=`.
2. Run `npm install`.
3. Run `npm start`, then open http://localhost:3000. The first lines say whether Compass is connected.

Your credentials stay on the server (`server.mjs`); the web page never sees them. Without credentials, Compass uses its built-in answers.

## Put it online with Render

The live site runs on Render, which serves the page and keeps your Claude API key secret on the server.

1. Open https://render.com/deploy?repo=https://github.com/110944-CYBER/waypoint and sign up or log in (signing in with GitHub is easiest).
2. Render reads `render.yaml` and shows one web service called `waypoint`. Paste your Claude API key into `ANTHROPIC_API_KEY` and click Apply.
3. After a few minutes the site is live at an address like https://waypoint.onrender.com.

Notes:
- The free plan sleeps after 15 minutes without visitors, so the first visit after a break takes 30 to 60 seconds. Open the site a minute before you present.
- Compass uses Claude Haiku 5.5 only, with no thinking step and short answers, so each question costs a fraction of a cent. There is no question limit. To add one later, set `COMPASS_DAILY_LIMIT` (whole site per day) or `COMPASS_PER_MINUTE` (per visitor) in Render's environment settings.
- Set a monthly spend limit in the Claude Console as well.
- Every push to GitHub redeploys the site.

## Edit the site

The source is in `src/`. After editing, run `npm run build` to rebuild `index.html` (the standalone site) and `site.html` (the claude.ai page). Photos live in `img/`; their authors and licences are in `src/photo-credits.js` and in the app under Photo credits.
