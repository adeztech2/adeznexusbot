import { getMedia } from '../../lib/utils/mediaInput.js';
import { runFfmpeg } from '../../lib/utils/ffmpegUtils.js';

const MP3 = ['-vn', '-acodec', 'libmp3lame', '-q:a', '3'];

const EFFECTS = {
  tomp3: {
    aliases: ['toaudio', 'extractaudio'],
    description: 'Convert a video or voice note to an MP3',
    filter: null,
  },
  bass: {
    aliases: ['bassboost'],
    description: 'Boost the bass of an audio or video',
    filter: 'equalizer=f=54:width_type=o:width=2:g=18',
  },
  nightcore: {
    aliases: [],
    description: 'Speed up and raise the pitch of an audio',
    filter: 'asetrate=44100*1.25,aresample=44100',
  },
  slow: {
    aliases: ['slowmo'],
    description: 'Slow down an audio',
    filter: 'atempo=0.75',
  },
  fast: {
    aliases: ['speedup'],
    description: 'Speed up an audio without changing pitch',
    filter: 'atempo=1.5',
  },
  areverse: {
    aliases: ['reverseaudio'],
    description: 'Play an audio backwards',
    filter: 'areverse',
  },
};

export default Object.entries(EFFECTS).map(([name, fx]) => ({
  name,
  aliases:     fx.aliases,
  description: fx.description,
  usage:       `${name}  (reply to an audio, voice note or video)`,
  category:    'media',
  owner:       false,
  group:       false,
  private:     false,
  timeout:     120_000,

  async execute(sock, m) {
    const media = await getMedia(m, ['audio', 'video']);
    if (!media) return m.reply('❌ Reply to an audio, voice note or video.');

    const args = fx.filter ? [...MP3.slice(0, 1), '-af', fx.filter, ...MP3.slice(1)] : MP3;
    const out  = await runFfmpeg(media.buffer, args, 'mp3');

    return sock.sendMessage(m.from, { audio: out, mimetype: 'audio/mpeg' }, { quoted: m });
  },
}));
