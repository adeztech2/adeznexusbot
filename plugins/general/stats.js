import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

// Memory of the container the bot runs in (cgroup v2, then v1), not the whole host.
function containerMemory() {
  const read = (p) => { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; } };
  const hostTotal = os.totalmem();
  let used  = Number(read('/sys/fs/cgroup/memory.current') ?? read('/sys/fs/cgroup/memory/memory.usage_in_bytes'));
  let limit = read('/sys/fs/cgroup/memory.max') ?? read('/sys/fs/cgroup/memory/memory.limit_in_bytes');
  limit = (limit && limit !== 'max') ? Number(limit) : NaN;
  if (!Number.isFinite(used) || used <= 0) used = hostTotal - os.freemem();
  if (!Number.isFinite(limit) || limit <= 0 || limit > hostTotal) limit = hostTotal;
  return { used, limit };
}

export default {
  name: 'stats',
  aliases: ['info'],
  description: 'Show bot and server statistics',
  usage: 'stats',
  category: 'general',
  owner: false,
  group: false,
  private: false,

  async execute(sock, m, args) {
    const start = Date.now();
    const sent = await m.reply('Fetching stats...');

    
    const formatUptime = (ms) => {
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    };

   
    const botUptimeMs = process.uptime() * 1000;
    const botUptimeStr = formatUptime(botUptimeMs);

    
    const serverUptimeMs = os.uptime() * 1000;
    const serverUptimeStr = formatUptime(serverUptimeMs);

   
    const { used: usedMem, limit: totalMem } = containerMemory();
    const botRss = process.memoryUsage().rss;
    const ramUsageStr = `${(usedMem / 1024 / 1024).toFixed(0)} MB / ${(totalMem / 1024 / 1024).toFixed(0)} MB (bot: ${(botRss / 1024 / 1024).toFixed(0)} MB)`;

   
    let diskUsageStr = 'Unknown';
    try {
      const df = execSync('df -h /').toString();
      const lines = df.split('\n')[1].split(/\s+/);
      diskUsageStr = `${lines[2]} used / ${lines[1]} total (${lines[4]} used)`;
    } catch (err) {
      diskUsageStr = 'Disk info not available';
    }

   
    const nodeVersion = process.version;

    
    const statsMessage = 
`📊 *Bot & Server Stats*

🤖 Bot Uptime: ${botUptimeStr}
🖥️ Server Uptime: ${serverUptimeStr}
💾 RAM Usage: ${ramUsageStr}
🗄️ Disk Usage: ${diskUsageStr}
⚙️ Node.js: ${nodeVersion}`;

    await sock.sendMessage(m.from, {
      text: statsMessage,
      edit: sent.key
    });
  }
};