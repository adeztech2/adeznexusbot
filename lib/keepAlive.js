// Self-ping so free/eco hosts (Render, Heroku) don't put the web process to sleep.
// URL is auto-detected: APP_URL > RENDER_EXTERNAL_URL (Render sets it) > HEROKU_APP_NAME.
const INTERVAL_MS = (parseInt(process.env.KEEP_ALIVE_MINUTES) || 4) * 60_000;

function resolveUrl() {
  const raw =
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.HEROKU_APP_NAME ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` : '');
  return raw.replace(/\/+$/, '');
}

export function startKeepAlive() {
  const base = resolveUrl();
  if (!base) {
    console.log('ℹ️  Keep-alive off (set APP_URL to your public URL to enable)');
    return;
  }
  const target = `${base}/health`;
  console.log(`💓 Keep-alive pinging ${target} every ${INTERVAL_MS / 60_000} min`);

  const ping = async () => {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) console.log(`⚠️  Keep-alive got HTTP ${res.status}`);
    } catch (e) {
      console.log(`⚠️  Keep-alive failed: ${e.message}`);
    }
  };

  setInterval(ping, INTERVAL_MS).unref?.();
}
