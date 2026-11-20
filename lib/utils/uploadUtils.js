import axios from 'axios';
import FormData from 'form-data';

/**
 * Generic HTTP GET with retry.
 * @param {string} url
 * @param {object} axiosOpts  - passed straight to axios.get (timeout, responseType, etc.)
 * @param {number} retries    - total attempts (default 3)
 * @param {number} delay      - ms between attempts (default 3000)
 */
export async function retryGet(url, axiosOpts = {}, retries = 3, delay = 3_000) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, axiosOpts);
    } catch (err) {
      last = err;
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw last;
}

/** Upload a Buffer to catbox.moe. Returns public URL string or throws. */
export async function uploadToCatbox(buffer, filename = 'file.bin', mime = 'application/octet-stream') {
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('userhash', '');  // anonymous upload
  fd.append('fileToUpload', buffer, { filename, contentType: mime });
  let res;
  try {
    res = await axios.post('https://catbox.moe/user/api.php', fd, {
      headers: fd.getHeaders(), timeout: 60_000,
      maxContentLength: Infinity, maxBodyLength: Infinity,
    });
  } catch (err) {
    const status = err?.response?.status;
    if (status === 412 || status === 413 || status === 400) {
      throw new Error(`Catbox rejected upload (HTTP ${status}) — try gofile or tmpfiles`);
    }
    throw err;
  }
  if (typeof res.data === 'string' && res.data.startsWith('http')) return res.data.trim();
  if (typeof res.data === 'string' && res.data.toLowerCase().includes('error')) {
    throw new Error('Catbox error: ' + res.data.trim());
  }
  throw new Error('Catbox did not return a URL: ' + String(res.data).slice(0, 100));
}

/** Upload a Buffer to file.io (expires after 1 download). Returns public URL string or throws. */
export async function uploadToFileIO(buffer, ext = 'bin') {
  const fd = new FormData();
  fd.append('file', buffer, `file.${ext}`);
  const res = await axios.post('https://file.io', fd, { headers: fd.getHeaders(), timeout: 30_000 });
  if (res.data?.success && res.data?.link) return res.data.link;
  throw new Error('File.io upload failed');
}

/** Upload a Buffer to tmpfiles.org (expires after 1 hour). Returns public URL string or throws. */
export async function uploadToTmpFiles(buffer, filename = 'file.bin', mime = 'application/octet-stream') {
  const fd = new FormData();
  fd.append('file', buffer, { filename, contentType: mime });
  const res = await axios.post('https://tmpfiles.org/api/v1/upload', fd, {
    headers: fd.getHeaders(), timeout: 30_000,
  });
  if (res.data?.status === 'success') {
    return res.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  }
  throw new Error('TmpFiles upload failed');
}

/** Upload a Buffer to GoFile.io (free permanent hosting). Returns public URL or throws. */
export async function uploadToGoFile(buffer, filename = 'file.bin', mime = 'application/octet-stream') {
  const serverRes = await axios.get('https://api.gofile.io/servers', { timeout: 10_000 });
  const server    = serverRes.data?.data?.servers?.[0]?.name;
  if (!server) throw new Error('GoFile: could not get upload server');

  const fd = new FormData();
  fd.append('file', buffer, { filename, contentType: mime });
  const res = await axios.post(`https://${server}.gofile.io/contents/uploadfile`, fd, {
    headers: fd.getHeaders(), timeout: 60_000,
  });

  const downloadPage = res.data?.data?.downloadPage;
  const parentFolder = res.data?.data?.parentFolder;
  if (!downloadPage && !parentFolder) throw new Error('GoFile: upload failed, no link returned');
  return downloadPage || `https://gofile.io/d/${parentFolder}`;
}

/**
 * Upload a Buffer to a public host. Tries catbox → tmpfiles.
 * @param {Buffer} buf
 * @param {string} filename - e.g. 'image.jpg'
 * @param {string} mime     - e.g. 'image/jpeg'
 * @returns {Promise<string>} Public URL
 */
export async function toPublicUrl(buf, filename = 'file.jpg', mime = 'image/jpeg') {
  const errors = [];
  for (const fn of [
    () => uploadToCatbox(buf, filename, mime),
    () => uploadToGoFile(buf, filename, mime),
    () => uploadToTmpFiles(buf, filename, mime),
  ]) {
    try { return await fn(); } catch (e) { errors.push(e.message); }
  }
  throw new Error('All upload services failed: ' + errors.join(' | '));
}
