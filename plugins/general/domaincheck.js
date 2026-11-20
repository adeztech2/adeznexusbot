import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'domaincheck',
  aliases:     ['domainstatus', 'domain', 'whoisd', 'domaininfo'],
  description: 'Check WHOIS info for a domain',
  usage:       'domaincheck <domain>',

  async execute(sock, m, args) {
    const raw = (args[0] || m.quoted?.text?.trim() || '').replace(/https?:\/\//i, '').split('/')[0];
    if (!raw) return m.reply('❌ Provide a domain.\nExample: `,domaincheck google.com`');
    await m.react('🔎');
    try {
      const data = await giftedGet('/api/tools/whois', { domain: raw }, 30_000);
      if (!data?.success || !data?.result) throw new Error('No WHOIS data.');
      const r  = data.result;
      const ns = Array.isArray(r.nameServers) ? r.nameServers.join(', ') : (r.nameServers || 'N/A');
      const st = Array.isArray(r.states)      ? r.states.join(', ')      : (r.states      || 'N/A');
      await m.reply(
        `🌐 *WHOIS: ${r.domainName || raw}*\n\n` +
        `*Registrar:* ${r.registrar || 'N/A'}\n` +
        `*Owner:* ${r.owner || 'N/A'}\n` +
        `*Created:* ${r.creationDate || 'N/A'}\n` +
        `*Expires:* ${r.expirationDate || 'N/A'}\n` +
        `*Updated:* ${r.updatedDate || 'N/A'}\n` +
        `*DNSSEC:* ${r.dnssec || 'N/A'}\n` +
        `*Status:* ${st}\n` +
        `*Name Servers:* ${ns}\n\n${getFooter()}`
      );
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ WHOIS failed: ${err.message}`);
    }
  },
}
