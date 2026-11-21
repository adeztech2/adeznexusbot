import { createEvalContext } from '../../lib/evalHelpers.js';
import util from 'util';

export default {
  name:        'eval',
  aliases:     ['ev', '>'],
  description: 'Execute JavaScript code (owner only)',
  usage:       'eval <code>',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    if (!args.length) return m.reply('❌ Provide code to execute!');

    const code = args.join(' ');

    try {
      await m.react('⏳');

      const context    = await createEvalContext(sock, m);
      const keys       = Object.keys(context);
      const values     = keys.map(k => context[k]);

      const result = await (async (...vals) => {
        const [
          sockVar, mVar, getMetadata, refreshMetadata, participants, admins, members,
          isAdmin, isBotAdmin, count, subject, desc, groupInfo, cache,
          utilVar, consoleVar, requireVar
        ] = vals;

        const sock    = sockVar;
        const m       = mVar;
        const util    = utilVar;
        const console = consoleVar;
        const require = requireVar;

        return eval(`(async () => { return ${code} })()`);
      })(...values);

      let output;
      if (typeof result === 'undefined')    output = 'undefined';
      else if (typeof result === 'object')  output = util.inspect(result, { depth: 2, colors: false });
      else                                  output = String(result);

      await m.reply(`\`\`\`${output}\`\`\``);
      await m.react('✅');
    } catch (err) {
      await m.react('❌'); m._failed = true;
      await m.reply(`❌ *Error:*\n\`\`\`${err.message}\`\`\``);
    }
  },
};
