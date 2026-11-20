import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

const DEF = { category: 'tools', owner: false, group: false, private: false };

// ── Screenshot ────────────────────────────────────────────────────────────────

const ssweb = {
  ...DEF,
  name:        'ssweb',
  aliases:     ['screenshot', 'ss', 'fullssweb', 'webss', 'sswebsite'],
  description: 'Take a screenshot of any website',
  usage:       'ssweb <url>',

  async execute(sock, m, args) {
    const url = args.join(' ').trim() || m.quoted?.text?.trim();
    if (!url) return m.reply('❌ Provide a URL.\nExample: `,ssweb https://google.com`');
    await m.react('⏳');
    try {
      const buf = await giftedGetBuffer('/api/tools/ssweb', { url }, 40_000);
      await sock.sendMessage(m.from, {
        image:   buf,
        caption: `📸 *Screenshot*\n🌐 ${url}\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Screenshot failed: ${err.message}`);
    }
  },
};

// ── Remini (Photo Enhancer) ───────────────────────────────────────────────────

const remini = {
  ...DEF,
  name:        'remini',
  aliases:     ['enhance', 'restorephoto', 'photoenhance', 'enhancephoto', 'hd'],
  description: 'Enhance and restore photos with AI (Remini)',
  usage:       'remini  (reply to an image, or pass an image URL)',

  async execute(sock, m, args) {
    const imageUrl = await quotedImageUrl(m) || args.find(a => a.startsWith('http'));
    if (!imageUrl) return m.reply('❌ Reply to an image, or provide an image URL.');
    await m.react('✨');
    try {
      const data = await giftedGetRetry('/api/tools/remini', { url: imageUrl }, 60_000);
      if (!data?.success) throw new Error('Enhancement failed.');
      const out = typeof data.result === 'string' ? data.result : data.result?.url;
      if (!out) throw new Error('No output URL in response.');
      await sock.sendMessage(m.from, {
        image:   { url: out },
        caption: `✨ *Photo Enhanced (Remini)*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Enhance failed: ${err.message}`);
    }
  },
};

// ── Photo Editor v1 ───────────────────────────────────────────────────────────

const photoeditor = {
  ...DEF,
  name:        'photoeditor',
  aliases:     ['photoedit', 'editpic', 'editphoto', 'phototedit', 'aiphoto'],
  description: 'Edit a photo with AI using a text prompt',
  usage:       'photoeditor <prompt>  (reply to image, or: photoeditor <url> <prompt>)',

  async execute(sock, m, args) {
    let imageUrl, prompt;
    if (args[0]?.startsWith('http')) {
      imageUrl = args[0];
      prompt   = args.slice(1).join(' ');
    } else {
      imageUrl = await quotedImageUrl(m);
      prompt   = args.join(' ');
    }
    if (!imageUrl) return m.reply('❌ Reply to an image or provide an image URL.\nExample: `,photoeditor make it a painting`');
    if (!prompt)   return m.reply('❌ Provide a prompt describing the edit.\nExample: `,photoeditor make it a cartoon`');
    await m.react('🎨');
    try {
      const data = await giftedGetRetry('/api/tools/photoeditor', { url: imageUrl, prompt }, 60_000);
      if (!data?.success) throw new Error(data?.message || 'Edit failed.');
      const out = typeof data.result === 'string' ? data.result : data.result?.url;
      if (!out) throw new Error('No output image in response.');
      await sock.sendMessage(m.from, {
        image:   { url: out },
        caption: `🎨 *Photo Edited*\n✏️ ${prompt}\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Photo edit failed: ${err.message}`);
    }
  },
};

// ── Photo Editor v2 (buffer response) ────────────────────────────────────────

const photoeditor2 = {
  ...DEF,
  name:        'photoeditor2',
  aliases:     ['photoedit2', 'editpic2', 'aiphoto2'],
  description: 'Edit a photo with AI v2 (reply to image + prompt)',
  usage:       'photoeditor2 <prompt>  (reply to image, or: photoeditor2 <url> <prompt>)',

  async execute(sock, m, args) {
    let imageUrl, prompt;
    if (args[0]?.startsWith('http')) {
      imageUrl = args[0]; prompt = args.slice(1).join(' ');
    } else {
      imageUrl = await quotedImageUrl(m); prompt = args.join(' ');
    }
    if (!imageUrl) return m.reply('❌ Reply to an image or provide an image URL.');
    if (!prompt)   return m.reply('❌ Provide a prompt describing the edit.');
    await m.react('🎨');
    try {
      const buf = await giftedGetBufferRetry('/api/tools/photoeditorv2', { url: imageUrl, prompt }, 60_000);
      await sock.sendMessage(m.from, {
        image:   buf,
        caption: `🎨 *Photo Edited v2*\n✏️ ${prompt}\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Photo edit v2 failed: ${err.message}`);
    }
  },
};

// ── Photo Editor v3 ───────────────────────────────────────────────────────────

const photoeditor3 = {
  ...DEF,
  name:        'photoeditor3',
  aliases:     ['photoedit3', 'editpic3', 'aiphoto3'],
  description: 'Edit a photo with AI v3 (advanced, reply to image + prompt)',
  usage:       'photoeditor3 <prompt>  (reply to image, or: photoeditor3 <url> <prompt>)',

  async execute(sock, m, args) {
    let imageUrl, prompt;
    if (args[0]?.startsWith('http')) {
      imageUrl = args[0]; prompt = args.slice(1).join(' ');
    } else {
      imageUrl = await quotedImageUrl(m); prompt = args.join(' ');
    }
    if (!imageUrl) return m.reply('❌ Reply to an image or provide an image URL.');
    if (!prompt)   return m.reply('❌ Provide a prompt describing the edit.');
    await m.react('🎨');
    try {
      const data = await giftedGetRetry('/api/tools/photoeditorv3', { url: imageUrl, prompt }, 60_000);
      if (!data?.success) throw new Error(data?.message || 'Edit failed.');
      const out = data.result?.output || data.result?.all_outputs?.[0];
      if (!out) throw new Error('No output image in response.');
      await sock.sendMessage(m.from, {
        image:   { url: out },
        caption: `🎨 *Photo Edited v3*\n✏️ ${prompt}\n🤖 Model: ${data.result?.model || 'auto'}\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Photo edit v3 failed: ${err.message}`);
    }
  },
};

// ── Background Remover ────────────────────────────────────────────────────────

const removebg = {
  ...DEF,
  name:        'removebg',
  aliases:     ['erasebg', 'bgremove', 'nobg', 'rmbg'],
  description: 'Remove background from an image',
  usage:       'removebg  (reply to an image, or provide URL)',

  async execute(sock, m, args) {
    const imageUrl = await quotedImageUrl(m) || args.find(a => a.startsWith('http'));
    if (!imageUrl) return m.reply('❌ Reply to an image or provide an image URL.');
    await m.react('✂️');
    try {
      const data = await giftedGetRetry('/api/tools/removebg', { url: imageUrl }, 60_000);
      if (!data?.success || !data?.result) throw new Error('Background removal failed.');
      const out = data.result.image_url || data.result.preview;
      if (!out) throw new Error('No output image URL.');
      await sock.sendMessage(m.from, {
        image:   { url: out },
        caption: `✂️ *Background Removed*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Background removal failed: ${err.message}`);
    }
  },
};

// ── OCR (Text from Image) ─────────────────────────────────────────────────────

const ocr = {
  ...DEF,
  name:        'ocr',
  aliases:     ['textfromimage', 'readimage', 'imgtotext', 'imagetext'],
  description: 'Extract text from an image (OCR)',
  usage:       'ocr  (reply to an image, or provide URL)',

  async execute(sock, m, args) {
    const imageUrl = await quotedImageUrl(m) || args.find(a => a.startsWith('http'));
    if (!imageUrl) return m.reply('❌ Reply to an image or provide an image URL.');
    await m.react('🔍');
    try {
      const data = await giftedGetRetry('/api/tools/ocr', { url: imageUrl }, 60_000);
      if (!data?.success) throw new Error(data?.message || 'OCR failed.');
      const text = typeof data.result === 'string'
        ? data.result
        : data.result?.text || JSON.stringify(data.result);
      if (!text?.trim()) throw new Error('No text found in image.');
      await m.reply(`📝 *Text Extracted (OCR)*\n\n${text}\n\n${getFooter()}`);
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ OCR failed: ${err.message}`);
    }
  },
};

// ── Vocal Remover ─────────────────────────────────────────────────────────────

const vocalremover = {
  ...DEF,
  name:        'vocalremover',
  aliases:     ['removevocal', 'splitaudio', 'instrumentalonly', 'vocal', 'karaoke'],
  description: 'Split audio into vocals and instrumental tracks',
  usage:       'vocalremover  (reply to an audio, or provide audio URL)',

  async execute(sock, m, args) {
    const audioUrl = await quotedAudioUrl(m) || args.find(a => a.startsWith('http'));
    if (!audioUrl) return m.reply('❌ Reply to an audio message or provide an audio URL.');
    await m.react('🎶');
    try {
      const data = await giftedGetRetry('/api/tools/vocalremover', { url: audioUrl }, 60_000);
      if (!data?.success || !data?.result) throw new Error('Vocal removal failed.');
      const { title, vocals, instrumental } = data.result;

      if (!isEnabled('useButtons')) {
        if (vocals) {
          await sock.sendMessage(m.from, {
            audio: { url: vocals }, mimetype: 'audio/mpeg',
          }, { quoted: m.raw });
        }
        if (instrumental) {
          await sock.sendMessage(m.from, {
            audio: { url: instrumental }, mimetype: 'audio/mpeg',
          }, { quoted: m.raw });
        }
        return m.react('✅');
      }

      const ts      = Date.now();
      const buttons = [];
      if (vocals)       buttons.push({ id: `vr_vocal_${ts}`,  text: '🎤 Vocals' });
      if (instrumental) buttons.push({ id: `vr_instr_${ts}`,  text: '🎸 Instrumental' });
      if (!buttons.length) throw new Error('No audio tracks returned.');

      await sendBtnOrText(sock, m.from, {
        title:   '🎶 Vocal Remover',
        text:    `*Track:* ${title || 'Audio'}\n\n*Select a track to download:*`,
        footer:  getFooter(),
        buttons,
      });

      const handle = async (event) => {
        const md  = event.messages[0];
        if (!md?.message) return;
        const sid = extractButtonId(md.message);
        if (!sid || md.key?.remoteJid !== m.from || !sid.includes(ts.toString())) return;
        try {
          const audioSend = sid.startsWith('vr_vocal_') ? vocals : instrumental;
          await sock.sendMessage(m.from, {
            audio:    { url: audioSend },
            mimetype: 'audio/mpeg',
          }, { quoted: md });
          await m.react('✅');
        } catch (err) {
          await sock.sendMessage(m.from, { text: `❌ ${err.message}` }, { quoted: md });
        }
      };
      sock.ev.on('messages.upsert', handle);
      setTimeout(() => sock.ev.off('messages.upsert', handle), 300_000);

    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Vocal removal failed: ${err.message}`);
    }
  },
};

// ── Create PDF ────────────────────────────────────────────────────────────────

const createpdf = {
  ...DEF,
  name:        'createpdf',
  aliases:     ['topdf', 'makepdf', 'pdf', 'txtpdf'],
  description: 'Create a PDF from text (or quote a text message)',
  usage:       'createpdf <filename> <text>  OR  reply to a message with: createpdf <filename>',

  async execute(sock, m, args) {
    const pdfName = args[0] || 'document';
    const content = args.slice(1).join(' ').trim() || m.quoted?.text?.trim();
    if (!content) return m.reply(
      '❌ Provide content.\n`,createpdf myfile Some text`\nor reply to a text message with `,createpdf myfile`'
    );
    await m.react('⏳');
    try {
      const buf = await giftedGetBuffer('/api/tools/topdf', { query: content }, 60_000);
      const fileName = pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`;
      await sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'application/pdf',
        fileName,
        caption:  `📄 *${fileName}*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ PDF creation failed: ${err.message}`);
    }
  },
};

// ── Domain WHOIS ──────────────────────────────────────────────────────────────

const domaincheck = {
  ...DEF,
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
};

// ── JS Obfuscator v1 (encryptv2) ──────────────────────────────────────────────

const jsenc = {
  ...DEF,
  name:        'jsenc',
  aliases:     ['jsobfuscate', 'jsencrypt', 'jsobf'],
  description: 'Obfuscate / encrypt JavaScript code',
  usage:       'jsenc <code>  OR  reply to a .js file / code message',

  async execute(sock, m, args) {
    const code = args.join(' ').trim() || await quotedDocText(m);
    if (!code) return m.reply('❌ Provide JS code or reply to a JS file.\nExample: `,jsenc console.log("hi")`');
    await m.react('🔐');
    try {
      const data = await giftedGet('/api/tools/encryptv2', { code }, 30_000);
      if (!data?.success || !data?.result) throw new Error('Obfuscation failed.');
      const encrypted = data.result.encrypted_code || String(data.result);
      const buf = Buffer.from(encrypted, 'utf-8');
      await sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'application/javascript',
        fileName: 'obfuscated.js',
        caption:  `🔐 *JS Obfuscated (v1)*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ JS obfuscation failed: ${err.message}`);
    }
  },
};

// ── JS Obfuscator v2 (encryptv3) ──────────────────────────────────────────────

const jsenc2 = {
  ...DEF,
  name:        'jsenc2',
  aliases:     ['jsobfuscate2', 'jsencrypt2', 'jsobf2'],
  description: 'Obfuscate / encrypt JavaScript code (advanced v2)',
  usage:       'jsenc2 <code>  OR  reply to a .js file / code message',

  async execute(sock, m, args) {
    const code = args.join(' ').trim() || await quotedDocText(m);
    if (!code) return m.reply('❌ Provide JS code or reply to a JS file.');
    await m.react('🔐');
    try {
      const data = await giftedGet('/api/tools/encryptv3', { code }, 30_000);
      if (!data?.success || !data?.result) throw new Error('Obfuscation failed.');
      const encrypted = data.result.encrypted_code || String(data.result);
      const buf = Buffer.from(encrypted, 'utf-8');
      await sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'application/javascript',
        fileName: 'obfuscated_v2.js',
        caption:  `🔐 *JS Obfuscated (v2)*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ JS obfuscation v2 failed: ${err.message}`);
    }
  },
};

// ── HTML Obfuscator ───────────────────────────────────────────────────────────

const htmlenc = {
  ...DEF,
  name:        'htmlenc',
  aliases:     ['htmlobfuscate', 'htmlobf', 'htmlencrypt'],
  description: 'Obfuscate / protect HTML code',
  usage:       'htmlenc <html>  OR  reply to an .html file / html text',

  async execute(sock, m, args) {
    const html = args.join(' ').trim() || await quotedDocText(m);
    if (!html) return m.reply('❌ Provide HTML code or reply to an HTML file.\nExample: `,htmlenc <h1>Hello</h1>`');
    await m.react('🔐');
    try {
      const data = await giftedGet('/api/tools/htmlobfuscate', { html }, 30_000);
      if (!data?.success || !data?.result) throw new Error('Obfuscation failed.');
      const obfuscated = data.result.obfuscated || String(data.result);
      const buf = Buffer.from(obfuscated, 'utf-8');
      await sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'text/html',
        fileName: 'obfuscated.html',
        caption:  `🔐 *HTML Obfuscated*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ HTML obfuscation failed: ${err.message}`);
    }
  },
};

// ── Binary encode / decode ────────────────────────────────────────────────────

const ebinary = {
  ...DEF,
  name: 'ebinary', aliases: ['tobinary', 'textbinary', 'binaryencode'],
  description: 'Encode text to binary', usage: 'ebinary <text>',
  async execute(sock, m, args) {
    const text = args.join(' ') || m.quoted?.text;
    if (!text) return m.reply('❌ Provide text to encode.');
    const bin = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    return m.reply(`📟 *Binary Encoded*\n\n${bin}\n\n${getFooter()}`);
  },
};

const debinary = {
  ...DEF,
  name: 'debinary', aliases: ['dbinary', 'binarytext', 'frombinary', 'binarydecode'],
  description: 'Decode binary to text', usage: 'debinary <binary>',
  async execute(sock, m, args) {
    const bin = args.join(' ') || m.quoted?.text;
    if (!bin) return m.reply('❌ Provide binary to decode.');
    try {
      const text = bin.trim().split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join('');
      return m.reply(`📝 *Binary Decoded*\n\n${text}\n\n${getFooter()}`);
    } catch { return m.reply('❌ Invalid binary input.'); }
  },
};

// ── Base64 encode / decode ────────────────────────────────────────────────────

const ebase = {
  ...DEF,
  name: 'ebase', aliases: ['tobase64', 'base64encode', 'ebase64', 'b64encode'],
  description: 'Encode text to Base64', usage: 'ebase <text>',
  async execute(sock, m, args) {
    const text = args.join(' ') || m.quoted?.text;
    if (!text) return m.reply('❌ Provide text to encode.');
    return m.reply(`🔐 *Base64 Encoded*\n\n${Buffer.from(text).toString('base64')}\n\n${getFooter()}`);
  },
};

const dbase = {
  ...DEF,
  name: 'dbase', aliases: ['debase', 'debase64', 'base64decode', 'frombase64', 'b64decode'],
  description: 'Decode Base64 to text', usage: 'dbase <base64>',
  async execute(sock, m, args) {
    const b64 = args.join(' ') || m.quoted?.text;
    if (!b64) return m.reply('❌ Provide Base64 to decode.');
    try {
      return m.reply(`🔓 *Base64 Decoded*\n\n${Buffer.from(b64.trim(), 'base64').toString('utf-8')}\n\n${getFooter()}`);
    } catch { return m.reply('❌ Invalid Base64 input.'); }
  },
};

export default [
  ssweb, remini,
  photoeditor, photoeditor2, photoeditor3,
  removebg, ocr, vocalremover,
  createpdf, domaincheck,
  jsenc, jsenc2, htmlenc,
  ebinary, debinary, ebase, dbase,
];
