import { evaluate } from '../../lib/utils/mathEval.js';
import { rawText } from '../../lib/utils/cmdUtils.js';

export default {
  name:        'calc',
  aliases:     ['calculate', 'math'],
  description: 'Calculate a math expression',
  usage:       'calc 2*(3+4)^2  |  calc sqrt(144)+pi',
  category:    'tools',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m) {
    const expr = rawText(m);
    if (!expr) {
      return m.reply('🧮 Give me an expression.\n\nOperators: + - * / % ^ ( )\nFunctions: sqrt abs sin cos tan log ln exp floor ceil round min max pow\nConstants: pi e');
    }
    try {
      const result = evaluate(expr);
      return m.reply(`🧮 ${expr} = *${Number(result.toPrecision(12))}*`);
    } catch (err) {
      return m.reply(`❌ ${err.message}`);
    }
  },
};
