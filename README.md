<h1 align="center">ADEZ NEXUS</h1>

<p align="center">A fast WhatsApp bot built on Baileys, by ADEZ TECH.</p>

<table align="center" cellpadding="10" border="1">
  <tr>
    <td align="center">
      <b>FORK</b><br><br>
      <a href="https://github.com/adeztech2/baileys/fork">
        <img src="https://img.shields.io/badge/FORK-this%20repo-purple" alt="Fork" width="150">
      </a>
    </td>
    <td align="center">
      <b>DOWNLOAD ZIP</b><br><br>
      <a href="https://github.com/adeztech2/baileys/archive/refs/heads/main.zip">
        <img src="https://img.shields.io/badge/Download-ZIP-blue" alt="Download zip" width="200">
      </a>
    </td>
  </tr>
  <tr>
    <td colspan="2" align="center">
      <b>DEPLOY</b><br><br>
      <a href="https://render.com/deploy?repo=https://github.com/adeztech2/baileys">
        <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render">
      </a>
      &nbsp;
      <a href="https://heroku.com/deploy?template=https://github.com/adeztech2/baileys">
        <img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku">
      </a>
    </td>
  </tr>
</table>

## Features

- **General:** AI chat, OCR, remove background, photo editors, screenshots, PDF maker, encoders and decoders, whois, domain check, view-once saver
- **Groups:** add members, approve or reject join requests, tag all, hidetag, promote, demote, remove, open, close, link, revoke, group profile picture, antilink, warn system, welcome and goodbye messages
- **Media:** YouTube search, audio and video download, TikTok, Instagram, Facebook, Twitter, stickers, convert to image or video
- **Fun:** dice, coin, 8ball, rock-paper-scissors, slots, jokes, facts, truth or dare, ship, rate, text effects, trivia, riddles, hangman, would-you-rather, hug/pat/slap, roast, compliment, aura, fortune
- **Tools:** country facts, crypto prices, Wikipedia, view someone's bio, reminders, calculator, unit and currency converters, weather, translate, dictionary, QR codes, text-to-speech, polls, world time, password generator
- **Dev tools:** download a GitHub repo as zip (`gitclone`), JSON formatter, JWT decoder, regex tester, hashes, UUIDs, timestamps, colour converter, npm, GitHub (`gh`) and IP lookups
- **Image and audio effects:** blur, grey, invert, sepia, flip, mirror, rotate, pixelate, circle, bass, nightcore, slow, fast, tomp3, togif, random cat, dog, fox and memes
- **Owner:** block and unblock, join groups by link, list groups, set bio, sudo users, settings, set profile picture, status upload, exec
- **Auto features:** view and like status, anti-delete, anti-edit, newsletter react, auto-join
- **Keep-alive:** pings its own `/health` route so free hosts don't sleep it

## Setup

1. Get your session ID. It must start with `ADEZ~`.
2. Set these variables on your host, or in `.env` (see `example.env`):

| Variable | Description |
| --- | --- |
| `SESSION_ID` | Your session ID (starts with `ADEZ~`) |
| `OWNER_NUMBER` | Your number, digits only with country code |
| `PREFIX` | Command prefix, 1-3 characters (default `.`). Applied when it changes; `.prefix` can still change it later |
| `DATABASE_URL` | PostgreSQL URL. Heroku fills it in with the Postgres add-on. Without it, settings use local SQLite and are lost on restart |
| `APP_URL` | Optional. Public URL of your app, for keep-alive (automatic on Render; not needed on a Heroku Basic dyno) |
| `KEEP_ALIVE_MINUTES` | Ping interval, default `4` |
| `HEROKU_API_KEY` | Optional. Lets `.update` redeploy on Heroku |
| `DEPLOY_HOOK_URL` | Optional. Lets `.update` redeploy on Render |
| `GITHUB_REPO`, `GITHUB_TOKEN` | Optional. For `.update` when you deployed from a fork |
| `API_KEYS` | Gemini API keys, comma separated (for AI) |
| `PORT` | Set by the host (panels use `SERVER_PORT`, also supported). Default `3237` |

3. Deploy, then send `.menu` or `.help`.

Prefix (default `.`) and mode (`public` or `private`) are bot settings. Change them from WhatsApp with the settings command, not with env variables.

### Render

Click **Deploy to Render**, or use **New → Blueprint** with your fork. Fill in `SESSION_ID`, `OWNER_NUMBER` and `DATABASE_URL`.

### Heroku

**One click:** press **Deploy to Heroku**, then fill in:

| Field | Value |
| --- | --- |
| App name | Pick a name, for example `my-nexus-bot` |
| `SESSION_ID` | Your session ID (`ADEZ~...`) |
| `OWNER_NUMBER` | Your number with country code, digits only |
| `PREFIX` | Command prefix, `.` by default |

The Postgres add-on is added for you and fills in `DATABASE_URL` by itself.
When the build finishes, open the app's **Resources** tab and make sure the **web** dyno is ON, then send `.menu` to the bot.

**From the command line:**

```bash
heroku create my-nexus-bot
heroku addons:create heroku-postgresql:essential-0
heroku config:set SESSION_ID=ADEZ~... OWNER_NUMBER=254... PREFIX=.
git push heroku main
heroku ps:scale web=1
```

**Notes**

- Heroku has no permanent disk. The bot gets its login from `SESSION_ID` each time it starts, and keeps settings in Postgres. Heroku restarts the dyno about once a day, so a "Bad MAC" line in the logs after a restart is normal.
- Eco dynos sleep when idle. The keep-alive ping cannot wake a sleeping dyno, so use a **Basic** dyno or bigger for a bot that must always answer.
- `.restart` works on Heroku (the dyno starts again by itself).
- `.update` and `.checkupdate` on Heroku:
  1. Run `heroku labs:enable runtime-dyno-metadata -a my-nexus-bot` so the bot knows which version it runs.
  2. Add `HEROKU_API_KEY` (from `heroku authorizations:create`). Add `HEROKU_APP_NAME` only if you use a custom domain.
  3. Deployed from a fork? Add `GITHUB_REPO` (`yourname/baileys`) and `GITHUB_TOKEN` so `.update` can pull the newest code into your fork. The repo must be public.

### Docker, VPS, Railway, Koyeb, Fly.io

A `Dockerfile` is included (Node 20 plus ffmpeg), so any Docker host works.

**VPS with Docker**

```bash
git clone https://github.com/adeztech2/baileys && cd baileys
cp example.env .env     # fill in SESSION_ID, OWNER_NUMBER, DATABASE_URL
docker compose up -d --build
docker compose logs -f
```

**VPS without Docker (PM2)**

```bash
# Node 20+ and ffmpeg installed:  sudo apt install -y ffmpeg
npm install
cp example.env .env     # fill it in
npm i -g pm2
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

**Railway:** New Project, Deploy from GitHub repo. It reads `railway.json`. Add `SESSION_ID`, `OWNER_NUMBER`, `DATABASE_URL` under Variables.

**Koyeb:** Create Web Service, GitHub repo, builder **Dockerfile**. Add the same variables. Set the health check path to `/health`.

**Fly.io:** follow the steps at the top of `fly.toml`.

For all of these, set `DATABASE_URL`. Without it, settings are kept in local SQLite files that may be lost when the container is rebuilt.

### Panels (Pterodactyl and similar)

1. Choose a **Node.js 20** (or newer) egg and upload the project files.
2. Set the startup file to `index.js` (or the command to `npm start`).
3. Create a file named `.env` in the main folder with your variables (copy `example.env`). The bot reads it by itself.
4. Start the server. The panel's port is picked up from `SERVER_PORT` automatically.
5. Stickers and audio effects need ffmpeg. If your panel image has none, those commands will not work, the rest of the bot is fine.

### Termux (Android)

```bash
pkg update && pkg install -y nodejs-lts git ffmpeg python make clang
git clone https://github.com/adeztech2/baileys && cd baileys
cp example.env .env && nano .env
npm install
termux-wake-lock
bash start.sh
```

### Vercel and Netlify

These cannot run the bot. They only run short serverless functions, but a WhatsApp bot must stay connected all the time. Use Render, Heroku, Railway, Koyeb, Fly.io, a panel or a VPS instead. Vercel is fine for the pair website (session ID generator), which is a separate project.

### Local

```bash
cp example.env .env   # fill it in
npm install
npm start
```

> Keep your SESSION_ID private. Anyone with it can control your WhatsApp account.

<p align="center">POWERED BY ADEZ TECH</p>
