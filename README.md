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
- **Groups:** tag all, hidetag, promote, demote, remove, open, close, link, revoke, group profile picture, antilink, warn system, welcome and goodbye messages
- **Media:** YouTube search, audio and video download, TikTok, Instagram, Facebook, Twitter, stickers, convert to image or video
- **Fun:** dice, coin, 8ball, rock-paper-scissors, slots, jokes, facts, truth or dare, ship, rate, text effects, trivia, riddles, hangman, would-you-rather, hug/pat/slap, roast, compliment, aura, fortune
- **Tools:** calculator, unit and currency converters, weather, translate, dictionary, QR codes, text-to-speech, polls, world time, password generator
- **Dev tools:** JSON formatter, JWT decoder, regex tester, hashes, UUIDs, timestamps, colour converter, npm, GitHub (`gh`) and IP lookups
- **Image and audio effects:** blur, grey, invert, sepia, flip, mirror, rotate, pixelate, circle, bass, nightcore, slow, fast, tomp3, togif, random cat, dog, fox and memes
- **Owner:** sudo users, settings, set profile picture, status upload, exec
- **Auto features:** view and like status, anti-delete, anti-edit, newsletter react, auto-join
- **Keep-alive:** pings its own `/health` route so free hosts don't sleep it

## Setup

1. Get your session ID. It must start with `ADEZ~`.
2. Set these variables on your host, or in `.env` (see `example.env`):

| Variable | Description |
| --- | --- |
| `SESSION_ID` | Your session ID (starts with `ADEZ~`) |
| `OWNER_NUMBER` | Your number, digits only with country code |
| `DATABASE_URL` | PostgreSQL URL. Heroku fills it in with the Postgres add-on. Without it, settings use local SQLite and are lost on restart |
| `APP_URL` | Public URL of your app, for keep-alive. Required on Heroku, automatic on Render |
| `KEEP_ALIVE_MINUTES` | Ping interval, default `4` |
| `API_KEYS` | Gemini API keys, comma separated (for AI) |
| `PORT` | Set by the host, default `3237` |

3. Deploy, then send `.menu` or `.help`.

Prefix (default `.`) and mode (`public` or `private`) are bot settings. Change them from WhatsApp with the settings command, not with env variables.

### Render

Click **Deploy to Render**, or use **New → Blueprint** with your fork. Fill in `SESSION_ID`, `OWNER_NUMBER` and `DATABASE_URL`.

### Heroku

Click **Deploy to Heroku**, set `APP_URL` to `https://<your-app>.herokuapp.com`. Or:

```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:essential-0
heroku config:set SESSION_ID=ADEZ~... OWNER_NUMBER=254... APP_URL=https://your-app-name.herokuapp.com
git push heroku main
```

### Local

```bash
cp example.env .env   # fill it in
npm install
npm start
```

> Keep your SESSION_ID private. Anyone with it can control your WhatsApp account.

<p align="center">POWERED BY ADEZ TECH</p>
