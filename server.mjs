import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { locales, maxLength, voices } from './public/voices.js';
import { createVoiceProfile, localVoiceConfig, startLocalVoice, synthesizeLocalVoice } from './local-voice.mjs';

const key = process.env.AZURE_SPEECH_KEY?.trim();
const region = process.env.AZURE_SPEECH_REGION?.trim();
const configured = Boolean(key && region && /^[a-z0-9]+$/.test(region));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT ?? '3000');
const backendToken = process.env.VOICE_BACKEND_TOKEN?.trim();
const backendAuthorization = backendToken ? Buffer.from(`Bearer ${backendToken}`) : undefined;
const profileEnabled = !backendAuthorization && ['localhost', '127.0.0.1', '::1'].includes(host);
const maxSpeechBytes = 20_000;
const sampleBytesPerSecond = 24_000 * 2;
// Nano profiles contain 192 speaker values and 50 × 256 style values as float32.
const profileFormat = /^nano1:[A-Za-z0-9+/]{69291}=$/;
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/voice-profile.js', ['voice-profile.js', 'text/javascript; charset=utf-8']],
  ['/voices.js', ['voices.js', 'text/javascript; charset=utf-8']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
  ['/icon-192.png', ['icon-192.png', 'image/png']],
  ['/icon-512.png', ['icon-512.png', 'image/png']],
  ['/apple-touch-icon.png', ['apple-touch-icon.png', 'image/png']]
]);

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function authorized(request) {
  if (!backendAuthorization) return true;
  const supplied = Buffer.from(request.headers.authorization || '');
  return supplied.length === backendAuthorization.length && timingSafeEqual(supplied, backendAuthorization);
}

function profileOnThisOrigin(request) {
  return profileEnabled && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(request.headers.host || '');
}

function profilePostAllowed(request) {
  return profileOnThisOrigin(request) && request.headers.origin === `http://${request.headers.host}`;
}

async function readBody(request, limit) {
  let total = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    total += chunk.length;
    if (total > limit) {
      request.resume();
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function enrollProfile(request, response) {
  if (!profilePostAllowed(request)) return json(response, 403, { code: 'localUnavailable' });
  if (request.headers['content-type'] !== 'application/octet-stream') {
    return json(response, 415, { code: 'invalidSample' });
  }
  let sample;
  try { sample = await readBody(request, 8 * sampleBytesPerSecond); }
  catch {
    if (!response.destroyed) json(response, 400, { code: 'invalidSample' });
    return;
  }
  if (!sample) return json(response, 413, { code: 'invalidSample' });
  if (sample.length < 3 * sampleBytesPerSecond || sample.length % 2) return json(response, 400, { code: 'invalidSample' });
  const result = await createVoiceProfile(sample);
  if (response.destroyed) return;
  if (result.profile) return json(response, 200, { profile: result.profile });
  return json(response, result.status, { code: result.code });
}

const xmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
function escapeXml(text) {
  return text.toWellFormed().replace(/[&<>"']/g, char => xmlEntities[char])
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '');
}

function sendAudio(response, audio) {
  response.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'no-store' });
  response.end(audio);
}

async function synthesize(request, response) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    return json(response, 415, { error: 'Yêu cầu phải có định dạng JSON.' });
  }

  const allowsProfile = profilePostAllowed(request);
  let body;
  let payload;
  try {
    body = await readBody(request, allowsProfile ? 100_000 : maxSpeechBytes);
    if (!body) return json(response, 413, { code: 'requestTooLong' });
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    if (!response.destroyed) json(response, 400, { error: 'Nội dung yêu cầu không hợp lệ.' });
    return;
  }

  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  const rate = payload?.speed;
  const personal = payload?.voice === 'local:personal';
  if (personal && !allowsProfile) return json(response, 403, { code: 'localUnavailable' });
  if (!personal && body.length > maxSpeechBytes) return json(response, 413, { code: 'requestTooLong' });
  if (personal && (typeof payload.profile !== 'string' || !profileFormat.test(payload.profile))) {
    return json(response, 400, { code: 'invalidProfile' });
  }
  if (!text || text.length > maxLength || !Number.isFinite(rate) || rate < 0.75 || rate > 1.25) {
    return json(response, 400, { error: 'Kiểm tra lại kịch bản, giọng đọc và tốc độ.' });
  }

  if (typeof payload.voice === 'string' && payload.voice.startsWith('local:')) {
    const result = await synthesizeLocalVoice({
      text: text.toWellFormed(), voice: payload.voice, speed: rate, profile: personal ? payload.profile : undefined
    });
    if (response.destroyed) return;
    if (result.audio) return sendAudio(response, result.audio);
    return json(response, result.status, { code: result.code });
  }

  if (!configured) return json(response, 503, { error: 'Thêm cấu hình Azure Speech để tạo và tải MP3.' });
  const voice = voices.find(item => item.id === payload.voice);
  if (!voice) return json(response, 400, { error: 'Kiểm tra lại giọng đọc.' });

  const percent = Math.round((rate - 1) * 100);
  const speed = (percent >= 0 ? '+' : '') + percent + '%';
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locales[voice.language]}"><voice name="${voice.id}"><prosody rate="${speed}">${escapeXml(text)}</prosody></voice></speak>`;
  const signal = AbortSignal.timeout(30000);
  const disconnected = new AbortController();
  response.once('close', () => disconnected.abort());
  try {
    const result = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      signal: AbortSignal.any([signal, disconnected.signal]),
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'VoiceStudio'
      },
      body: ssml
    });
    if (!result.ok) {
      await result.body?.cancel();
      const message = result.status === 429 ? 'Dịch vụ đang bận. Ní thử lại sau nha.' : 'Azure Speech chưa tạo được giọng. Kiểm tra lại cấu hình dịch vụ.';
      return json(response, result.status === 429 ? 429 : 502, { error: message });
    }
    const audio = Buffer.from(await result.arrayBuffer());
    sendAudio(response, audio);
  } catch {
    if (!response.destroyed) json(response, 502, { error: 'Chưa kết nối được dịch vụ tạo giọng. Ní thử lại nha.' });
  }
}

const server = createServer(async (request, response) => {
  const path = request.url?.split('?')[0];
  if ((path === '/api/config' || path === '/api/speech') && !authorized(request)) {
    return json(response, 401, { error: 'Thiếu khóa truy cập máy chủ tạo giọng.' });
  }
  if (request.method === 'GET' && path === '/api/config') {
    const local = localVoiceConfig();
    return json(response, 200, { configured, ...local, personalVoice: local.personalVoice && profileOnThisOrigin(request) });
  }
  if (request.method === 'POST' && path === '/api/voice-profile') return enrollProfile(request, response);
  if (request.method === 'POST' && path === '/api/speech') return synthesize(request, response);

  const asset = assets.get(path);
  if (!asset || !['GET', 'HEAD'].includes(request.method)) return json(response, 404, { error: 'Không tìm thấy nội dung.' });
  const [file, contentType] = asset;
  try {
    const body = await readFile(new URL(`./public/${file}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': body.length, 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    return json(response, 500, { error: 'Không đọc được nội dung.' });
  }
});

server.listen(port, host, () => {
  console.log(`Voice Studio: http://${host}:${server.address().port}`);
  startLocalVoice();
});
