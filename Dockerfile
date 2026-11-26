# Works on any Docker host: VPS, Railway, Koyeb, Fly.io, Northflank, Back4app, Coolify...
FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# ffmpeg: stickers, audio effects, tomp3/tovideo.  build tools: only used if a prebuilt
# better-sqlite3 / sharp binary is not available for the platform.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates python3 make g++ git \
 && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p lib/session

# The host usually sets PORT; the bot falls back to 3237
EXPOSE 3237
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3237)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
