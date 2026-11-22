import { getGroupSettings, updateGroupSettings } from '../database/groupSettings.js';
import { DEFAULT_WELCOME, DEFAULT_GOODBYE } from './groupUtils.js';

const DEFAULTS = { welcome: DEFAULT_WELCOME, goodbye: DEFAULT_GOODBYE };

/** Builds the `welcome` / `goodbye` command (they share the same sub-commands). */
export function createGreetingCommand(kind) {
  return {
    name:        kind,
    aliases:     kind === 'goodbye' ? ['bye'] : [],
    description: `Turn the ${kind} message on or off, or customise it`,
    usage:       `${kind} on | off | set <text> | reset`,
    category:    'group',
    owner:       false,
    group:       true,
    private:     false,
    admin:       true,
    botAdmin:    false,

    async execute(sock, m, args) {
      const sub = (args[0] || '').toLowerCase();

      // Take the text after "<command> set" from the raw body so line breaks survive.
      const rest = m.body.trim().replace(/^\S+\s*/, '');

      if (sub === 'on' || sub === 'off') {
        await updateGroupSettings(m.from, s => { s[kind].enabled = sub === 'on'; });
        return m.reply(`✅ ${kind[0].toUpperCase() + kind.slice(1)} message turned *${sub}*.`);
      }

      if (sub === 'set') {
        const text = rest.replace(/^set\s*/i, '').trim();
        if (!text) {
          return m.reply(
            `❌ Provide the text.\n\nExample:\n${kind} set Hello @user, welcome to {group}!\n\n` +
            `Placeholders: @user  {group}  {count}  {desc}`
          );
        }
        await updateGroupSettings(m.from, s => { s[kind].text = text; });
        return m.reply(`✅ ${kind[0].toUpperCase() + kind.slice(1)} message updated.`);
      }

      if (sub === 'reset') {
        await updateGroupSettings(m.from, s => { s[kind].text = ''; });
        return m.reply(`✅ ${kind[0].toUpperCase() + kind.slice(1)} message reset to default.`);
      }

      const s = await getGroupSettings(m.from);
      return m.reply(
        `*${kind.toUpperCase()}*\n\n` +
        `Status: ${s[kind].enabled ? 'ON ✅' : 'OFF ❌'}\n` +
        `Message:\n${s[kind].text || DEFAULTS[kind] + '  _(default)_'}\n\n` +
        `Usage: ${kind} on | off | set <text> | reset\n` +
        `Placeholders: @user  {group}  {count}  {desc}`
      );
    },
  };
}
