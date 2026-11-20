import { exec } from 'child_process';

export default {
  name:        'exec',
  aliases:     ['$'],
  description: 'Execute a shell command on the server',
  usage:       'exec <command>',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    if (!args.length) return m.reply('❌ Provide a command to execute!');

    let cmd = args.join(' ');

    // Hard block: remote execution & reverse shell — applies to ALL users
    const _rce =
      /\b(curl|wget)\b[^|\n]*\|[^|\n]*\b(node|python3?|bash|sh|perl|ruby|php)\b/i.test(cmd) ||
      /\|\s*(node|python3?|bash|sh|perl|ruby|php)\s*-/i.test(cmd) ||
      /\/dev\/tcp\//i.test(cmd) ||
      /\b(nc|ncat|netcat)\b[^\n]*-(e|c)\b/i.test(cmd) ||
      /bash\s+-i\s*>&/i.test(cmd) ||
      /base64\s*(-d|--decode)[^\n]*(\|\s*bash|\|\s*sh|\|\s*node)/i.test(cmd);
    if (_rce) return m.reply('\u26d4 Blocked: remote execution and reverse shell commands are not permitted.');


    // Auto-exclude .env from any archive/copy command (safety net for all users)
    cmd = cmd
      .replace(/\bzip(\s+[^|;&\n]*)/g, (m, rest) =>
        rest.includes('--exclude') ? m : `zip${rest} --exclude='.env' --exclude='*.env'`)
      .replace(/\btar(\s+[^|;&\n]*)/g, (m, rest) =>
        rest.includes('--exclude') ? m : `tar${rest} --exclude='.env' --exclude='*.env'`);

    exec(cmd, (err, stdout, stderr) => {
      if (err) return m.reply(`❌ Error:\n\`\`\`${err.message}\`\`\``);
      if (stderr) return m.reply(`⚠️ Stderr:\n\`\`\`${stderr}\`\`\``);
      m.reply(`\`\`\`${stdout || '(no output)'}\`\`\``);
    });
  },
};