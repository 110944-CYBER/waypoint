# Waypoint

A prototype that matches students and graduates to internships, scholarships, job shadowing and postgraduate programs, and shows exactly what each one needs. Compass is its AI guide, powered by Claude.

## Run it on your own computer

1. Connect Compass to Claude, in either of these ways:
   - No key: install the `ant` CLI (`brew install anthropics/tap/ant`) and run `ant auth login` once.
   - API key: copy `.env.example` to `.env` and paste your key after `ANTHROPIC_API_KEY=`.
2. Run `npm install`.
3. Run `npm start`, then open http://localhost:3000. The first lines say whether Compass is connected.

Your credentials stay on the server (`server.mjs`); the web page never sees them. Without credentials, Compass uses its built-in answers.

## Put it online from GitHub

GitHub Pages only hosts static files. It can show the site, but it cannot run `server.mjs` or keep a secret, so on GitHub Pages alone Compass uses its built-in answers.

For Compass to answer with Claude online:

1. Push this folder to a GitHub repository. `.env` and `node_modules/` are in `.gitignore`, so your key never leaves your computer.
2. Create a web service from that repository on a host that runs Node, such as Render or Railway. Build command: `npm install`. Start command: `npm start`.
3. Create an API key in the Claude Console (choose "Somewhere else" when it asks where your code runs) and add it in the host's environment settings as `ANTHROPIC_API_KEY`.
4. Set a monthly spend limit in the Claude Console. Each visitor can ask 20 questions a minute, but the site is public.

Compass uses Claude Haiku 5.5 only, with no thinking step and short answers, so each question costs a fraction of a cent.

## Edit the site

The source is in `src/`. After editing, run `npm run build` to rebuild `index.html` (the standalone site) and `site.html` (the claude.ai page). Photos live in `img/`; their authors and licences are in `src/photo-credits.js` and in the app under Photo credits.
