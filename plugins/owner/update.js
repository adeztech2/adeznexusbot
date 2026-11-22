import axios from 'axios';
import { GITHUB_TOKEN } from '../../config.js';
import { getSetting } from '../../lib/database/settings.js';
import { sendBtnOrText, getFooter } from '../../lib/buttonHandler.js';

const DEF = { category: 'owner', owner: true, group: false, private: false };

// Where new versions come from. Override with UPDATE_REPO / UPDATE_BRANCH env vars.
const upstream = () => (process.env.UPDATE_REPO   || 'adeztech2/baileys').trim();
const branch   = () => (process.env.UPDATE_BRANCH || 'main').trim();

const gh = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 15000,
  headers: {
    'User-Agent': 'adez-nexus-bot',
    Accept: 'application/vnd.github+json',
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  },
});

// Commit this deployment is running (set by the hosting platform).
const currentCommit = () =>
  process.env.RENDER_GIT_COMMIT || process.env.HEROKU_SLUG_COMMIT ||
  process.env.SOURCE_VERSION    || process.env.VERCEL_GIT_COMMIT_SHA || '';

// Heroku app name: HEROKU_APP_NAME (dyno metadata) or taken from APP_URL.
function herokuApp() {
  const n = (process.env.HEROKU_APP_NAME || '').trim();
  if (n) return n;
  const m = (process.env.APP_URL || '').match(/^https?:\/\/([a-z0-9-]+)\.herokuapp\.com/i);
  return m ? m[1] : '';
}

const short = (sha) => (sha ? sha.slice(0, 7) : 'unknown');

async function checkUpdate() {
  const { data: latest } = await gh.get(`/repos/${upstream()}/commits/${branch()}`);
  const info = {
    latestSha: latest.sha,
    message:   String(latest.commit?.message || '').split('\n')[0],
    date:      latest.commit?.committer?.date,
    current:   currentCommit(),
    available: null,   // null = cannot tell
    behind:    null,
    recent:    [],
  };
  if (!info.current) return info;

  if (info.current === info.latestSha) {
    info.available = false;
    info.behind = 0;
    return info;
  }
  try {
    const { data: cmp } = await gh.get(`/repos/${upstream()}/compare/${info.current}...${branch()}`);
    info.behind    = cmp.ahead_by;
    info.available = cmp.ahead_by > 0;
    info.recent    = (cmp.commits || []).slice(-5).reverse()
      .map(c => String(c.commit?.message || '').split('\n')[0]);
  } catch {
    info.available = true;   // history not comparable (e.g. a fork with its own commits)
  }
  return info;
}

const checkupdate = {
  ...DEF,
  name:        'checkupdate',
  aliases:     ['checkupdates', 'updates', 'checkupd'],
  description: 'Check if a newer version of the bot is available',
  usage:       'checkupdate',

  async execute(sock, m) {
    const prefix = getSetting('prefix') || '.';
    await m.react('🔎');
    let info;
    try {
      info = await checkUpdate();
    } catch (err) {
      await m.react('❌'); m._failed = true;
      const why = err.response?.status === 403 ? 'GitHub rate limit reached, try again later.' : err.message;
      return m.reply(`❌ Could not check for updates.\n${why}`);
    }

    const lines = [
      `📦 *Running:* ${short(info.current)}`,
      `🆕 *Latest:* ${short(info.latestSha)}${info.date ? ` (${info.date.slice(0, 10)})` : ''}`,
      `📝 *Last change:* ${info.message}`,
    ];

    let title, buttons = [];
    if (info.available === true) {
      title = '🆕 UPDATE AVAILABLE';
      if (info.behind) lines.push(`⬆️ *New commits:* ${info.behind}`);
      if (info.recent.length) lines.push('', ...info.recent.map(c => `▸ ${c}`));
      buttons = [{ id: `${prefix}update`, text: '⬆️ Update now' }];
    } else if (info.available === false) {
      title = '✅ UP TO DATE';
    } else {
      title = '🔎 UPDATE CHECK';
      lines.push('', 'ℹ️ Your host does not tell me which version is running, so I cannot compare. Use *.update* if you want the latest.');
      buttons = [{ id: `${prefix}update`, text: '⬆️ Update now' }];
    }

    await m.react(info.available ? '🆕' : '✅');
    return sendBtnOrText(sock, m.from, {
      title,
      text: lines.join('\n'),
      footer: getFooter(),
      buttons,
    });
  },
};

const update = {
  ...DEF,
  name:        'update',
  aliases:     ['upgrade', 'updatebot'],
  description: 'Update the bot to the latest version (use "update force" to skip the check)',
  usage:       'update [force]',

  async execute(sock, m, args) {
    const force = args[0]?.toLowerCase() === 'force';

    if (!force) {
      try {
        const info = await checkUpdate();
        if (info.available === false) {
          return m.reply(`✅ Already on the latest version (${short(info.current)}).\n\nUse *update force* to redeploy anyway.`);
        }
      } catch {}   // if the check fails, carry on with the update
    }

    await m.react('⏳');
    await m.reply('⬆️ *Updating...*');

    const steps = [];
    let didSomething = false;

    // 1) If this bot runs from a fork, pull the newest code into the fork first.
    const deployedRepo = (process.env.GITHUB_REPO || '').trim();   // e.g. yourname/baileys
    if (GITHUB_TOKEN && deployedRepo && deployedRepo.toLowerCase() !== upstream().toLowerCase()) {
      try {
        const { data } = await gh.post(`/repos/${deployedRepo}/merge-upstream`, { branch: branch() });
        steps.push(`✅ Your repo synced (${data.message || 'ok'})`);
        didSomething = true;
      } catch (err) {
        steps.push(`❌ Repo sync failed: ${err.response?.data?.message || err.message}`);
      }
    }

    // 2) Ask the host to rebuild and redeploy.
    let deployStarted = false;

    //    Render (or any host with a deploy hook URL)
    const hook = (process.env.DEPLOY_HOOK_URL || process.env.RENDER_DEPLOY_HOOK || '').trim();
    if (hook) {
      try {
        await axios.get(hook, { timeout: 15000 });
        steps.push('✅ Redeploy started — the bot will restart in a minute or two.');
        deployStarted = didSomething = true;
      } catch (err) {
        steps.push(`❌ Redeploy request failed: ${err.message}`);
      }
    }

    //    Heroku: build the newest code of the repo through the Platform API
    const herokuKey = (process.env.HEROKU_API_KEY || '').trim();
    const hApp = herokuApp();
    if (!deployStarted && herokuKey && hApp) {
      const repo = deployedRepo || upstream();
      try {
        let version;
        try { version = (await gh.get(`/repos/${repo}/commits/${branch()}`)).data.sha; } catch {}
        await axios.post(
          `https://api.heroku.com/apps/${hApp}/builds`,
          { source_blob: { url: `https://github.com/${repo}/tarball/${branch()}`, ...(version ? { version } : {}) } },
          {
            timeout: 20000,
            headers: {
              Accept: 'application/vnd.heroku+json; version=3',
              Authorization: `Bearer ${herokuKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        steps.push('✅ Heroku build started — the bot will restart in a few minutes.');
        deployStarted = didSomething = true;
      } catch (err) {
        const why = err.response?.data?.message || err.message;
        steps.push(`❌ Heroku build failed: ${why}`);
      }
    }

    if (!deployStarted) {
      steps.push(
        didSomething
          ? 'ℹ️ If auto-deploy is on in your host, it will redeploy by itself shortly.'
          : '⚠️ I cannot redeploy from here yet.\n• Render: add *DEPLOY_HOOK_URL* (Settings → Deploy Hook).\n• Heroku: add *HEROKU_API_KEY* (and *HEROKU_APP_NAME* if you use a custom domain).\n• Fork? Also add *GITHUB_REPO* (yourname/baileys) and *GITHUB_TOKEN*.'
      );
    }

    await m.react(didSomething ? '✅' : '⚠️');
    return m.reply(steps.join('\n'));
  },
};

export default [checkupdate, update];
