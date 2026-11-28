import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { mediaProxy } from './media-network.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const python = fileURLToPath(new URL(process.platform === 'win32' ? './.media-venv/Scripts/python.exe' : './.media-venv/bin/python', import.meta.url));
const ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg';
const ffprobe = process.env.FFPROBE_BIN || 'ffprobe';
const cache = join(root, '.media-cache');
const session = join(cache, randomUUID());
const maxDuration = 60 * 60;
const maxBytes = 300 * 1024 * 1024;
const expiry = 30 * 60_000;
const domains = ['youtube.com', 'youtu.be', 'facebook.com', 'fb.watch', 'instagram.com', 'tiktok.com',
  'soundcloud.com', 'vimeo.com', 'dailymotion.com', 'dai.ly', 'twitter.com', 'x.com'];
const extractors = 'youtube.*,facebook.*,instagram.*,tiktok.*,soundcloud.*,vimeo.*,dailymotion.*,twitter.*';
const protocols = new Set(['http', 'https', 'http_dash_segments', 'm3u8_native']);
const containers = new Map([['.mp4', 'mov'], ['.m4a', 'mov'], ['.mov', 'mov'], ['.webm', 'matroska'],
  ['.mkv', 'matroska'], ['.mp3', 'mp3'], ['.ogg', 'ogg'], ['.opus', 'ogg'], ['.aac', 'aac'],
  ['.ts', 'mpegts'], ['.flv', 'flv']]);
const inputs = new Map();
const jobs = new Map();
const finalStates = new Set(['done', 'error', 'cancelled']);
let analyzing = false;
let running = false;
let cacheReady;
let toolCheck;
let toolCheckExpires = 0;

class MediaError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.status = status;
  }
}

export function mediaInstalled() {
  return process.env.MEDIA_DOWNLOADS_ENABLED !== 'false' && existsSync(python);
}

export function mediaPublicEnabled() {
  return process.env.MEDIA_DOWNLOADS_ENABLED === 'true' && mediaInstalled();
}

export function mediaToolsReady() {
  if (Date.now() >= toolCheckExpires) {
    toolCheckExpires = Date.now() + 60_000;
    toolCheck = Promise.all([
      run(python, ['-m', 'yt_dlp', '--ignore-config', '--no-plugin-dirs', '--version'], { timeout: 3000 }),
      run(ffmpeg, ['-version'], { timeout: 3000 }),
      run(ffprobe, ['-version'], { timeout: 3000 })
    ]).then(() => true, () => false);
  }
  return toolCheck;
}

function validateUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new MediaError('invalidUrl');
  let url;
  try { url = new URL(value); }
  catch { throw new MediaError('invalidUrl'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port ||
    !domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) {
    throw new MediaError('unsupportedUrl');
  }
  url.protocol = 'https:';
  url.hash = '';
  return url.href;
}

function normalizeInfo(info) {
  if (info?._type === 'playlist' || info?.entries || info?.is_live || info?.live_status === 'is_upcoming') {
    throw new MediaError('unsupportedMedia');
  }
  if (!Number.isFinite(info?.duration) || info.duration <= 0 || info.duration > maxDuration) {
    throw new MediaError('invalidDuration');
  }
  const formats = (Array.isArray(info.formats) ? info.formats : [info]).filter(format =>
    format && !format.has_drm && protocols.has(format.protocol) && /^https:\/\//i.test(format.url || '') &&
    typeof format.format_id === 'string' && /^[\w.+-]{1,80}$/.test(format.format_id));
  const videos = formats.filter(format => format.vcodec && format.vcodec !== 'none' && Number.isFinite(format.height));
  const audio = formats.filter(format => format.acodec && format.acodec !== 'none');
  if (!videos.length && !audio.length) throw new MediaError('sourceUnavailable', 422);
  const maxHeight = Math.min(1080, Math.max(0, ...videos.map(format => format.height)));
  const resolutions = [360, 480, 720, 1080].filter(height => height <= maxHeight);
  if (!resolutions.length && maxHeight) resolutions.push(maxHeight);
  return {
    title: String(info.title || 'Media').slice(0, 180), uploader: String(info.uploader || info.channel || '').slice(0, 120),
    duration: info.duration, resolutions, hasAudio: audio.length > 0, videos, audio
  };
}

function cleanTitle(title) {
  return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100).toWellFormed().trim().replace(/[. ]+$/, '') || 'media';
}

function publicJob(job) {
  return {
    id: job.id, status: job.status, progress: job.progress, error: job.error,
    file: job.status === 'done' ? `/api/media/file/${job.id}` : undefined
  };
}

function run(command, args, { signal, timeout = 55_000, onLine, maxOutput = 1_000_000, env } = {}) {
  return new Promise((resolveRun, reject) => {
    signal?.throwIfAborted();
    const child = spawn(command, args, { windowsHide: true, shell: false, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', pending = '', reason;
    const stop = code => { reason ||= new MediaError(code); child.kill(); };
    const abort = () => stop('cancelled');
    const timer = setTimeout(() => stop('mediaTimeout'), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (output.length + chunk.length > maxOutput) return stop('mediaTooLarge');
      output += chunk;
      if (!onLine) return;
      const lines = (pending + chunk).split(/[\r\n]+/);
      pending = lines.pop();
      for (const line of lines) onLine(line);
    });
    child.stderr.resume();
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    child.once('error', error => {
      cleanup();
      reject(new MediaError(error.code === 'ENOENT' ? 'toolsUnavailable' : 'processingFailed', 503));
    });
    child.once('close', code => {
      cleanup();
      if (reason || code !== 0) reject(reason || new MediaError('processingFailed', 422));
      else resolveRun(output);
    });
  });
}

async function downloader(args, options, workingDir = session) {
  const proxy = await mediaProxy();
  const env = { ...process.env, NO_PROXY: '', no_proxy: '', PYTHONIOENCODING: 'utf-8' };
  delete env.VOICE_BACKEND_TOKEN;
  delete env.AZURE_SPEECH_KEY;
  delete env.AZURE_SPEECH_REGION;
  return run(python, ['-m', 'yt_dlp', '--ignore-config', '--no-plugin-dirs', '--no-playlist', '--no-warnings',
    '--use-extractors', extractors, '--proxy', proxy, '--socket-timeout', '20', '--retries', '1',
    '--downloader', 'native', '--fixup', 'never', '--no-remote-components',
    '--js-runtimes', `node:${process.execPath}`, '--ffmpeg-location', join(workingDir, 'ffmpeg-disabled'),
    ...args], { ...options, env });
}

async function initializeCache() {
  await mkdir(session, { recursive: true });
  const entries = await readdir(cache, { withFileTypes: true });
  await Promise.all(entries.filter(entry => entry.isDirectory() && /^[\da-f-]{36}$/.test(entry.name)).map(async entry => {
    const dir = join(cache, entry.name);
    if (dir === session) return;
    const info = await stat(dir).catch(() => null);
    if (info && Date.now() - info.mtimeMs > 86_400_000) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }));
}

async function workingBytes(dir) {
  const files = await readdir(dir);
  const sizes = await Promise.all(files.map(async name => (await stat(join(dir, name))).size));
  return sizes.reduce((sum, size) => sum + size, 0);
}

async function localFile(job, format, part, from, to) {
  const selection = `best*[format_id="${format.format_id}"][protocol~="^(https?|http_dash_segments|m3u8_native)$"][url^="https://"]`;
  const output = await downloader(['--no-simulate', '--newline', '--progress', '--progress-template', 'download:PROGRESS:%(progress._percent_str)s',
    '--max-filesize', String(maxBytes), '-f', selection, '-o', join(job.dir, `${part}.%(ext)s`),
    '--print', 'after_move:FILE:%(filepath)s', '--', job.url], {
    signal: job.controller.signal, timeout: 10 * 60_000,
    onLine(line) {
      const match = line.match(/^PROGRESS:\s*([\d.]+)%/);
      if (match) job.progress = Math.max(job.progress, Math.min(to, from + Number(match[1]) / 100 * (to - from)));
    }
  }, job.dir);
  const file = output.split(/\r?\n/).findLast(line => line.startsWith('FILE:'))?.slice(5).trim();
  const path = file && resolve(file);
  if (!path?.startsWith(job.dir + sep) || !(await stat(path).catch(() => null))?.isFile()) {
    throw new MediaError('sourceUnavailable', 422);
  }
  const container = containers.get(extname(path).toLowerCase());
  if (!container) throw new MediaError('unsupportedMedia', 422);
  return { path, container };
}

async function execute(job) {
  job.status = 'downloading';
  const { signal } = job.controller;
  let monitor;
  let tooLarge = false;
  try {
    cacheReady ??= initializeCache().catch(error => { cacheReady = undefined; throw error; });
    await cacheReady;
    await mkdir(job.dir);
    monitor = setInterval(async () => {
      try {
        if (await workingBytes(job.dir) > maxBytes) {
          tooLarge = true;
          job.controller.abort();
        }
      } catch { /* Files can be renamed while the downloader writes them. */ }
    }, 1000);
    const { video, audio } = job.sources;
    const first = await localFile(job, video || audio, 'primary', 0, video && audio ? 48 : 70);
    const second = video && audio ? await localFile(job, audio, 'sound', 48, 70) : undefined;
    if (await workingBytes(job.dir) >= maxBytes) throw new MediaError('mediaTooLarge');
    const probe = await run(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-f', first.container,
      '-show_entries', 'format=duration', '-of', 'json', first.path], { signal });
    const duration = Number(JSON.parse(probe).format?.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > maxDuration + 1) throw new MediaError('invalidDuration');
    job.status = 'converting';
    job.progress = 70;
    job.output = join(job.dir, `output.${job.format}`);
    const codec = job.format === 'mp3'
      ? ['-vn', '-c:a', 'libmp3lame', '-b:a', `${job.quality}k`]
      : ['-map', '0:v:0', '-map', second ? '1:a:0' : '0:a:0?', '-vf', `scale=-2:trunc(min(ih\\,${job.quality})/2)*2`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
        '-b:a', '192k', '-movflags', '+faststart'];
    const input = file => ['-protocol_whitelist', 'file,pipe', '-f', file.container, '-threads', '1', '-i', file.path];
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-filter_threads', '1', ...input(first),
      ...(second ? input(second) : []), ...codec, ...(second ? ['-shortest'] : []),
      '-threads', '1', '-fs', String(maxBytes), '-progress', 'pipe:1', job.output], {
      signal, timeout: 15 * 60_000,
      onLine(line) {
        const match = /^out_time_us=(\d+)$/.exec(line);
        if (match) job.progress = Math.min(99, 70 + Number(match[1]) / 1e6 / duration * 29);
      }
    });
    signal.throwIfAborted();
    const size = (await stat(job.output)).size;
    if (!size) throw new MediaError('processingFailed');
    if (size >= maxBytes || await workingBytes(job.dir) > maxBytes) throw new MediaError('mediaTooLarge');
    await Promise.all([first, second].filter(Boolean).map(file => rm(file.path, { force: true })));
    job.status = 'done';
    job.progress = 100;
  } catch (error) {
    job.status = signal.aborted && !tooLarge ? 'cancelled' : 'error';
    job.error = tooLarge ? 'mediaTooLarge' : error instanceof MediaError ? error.message : 'processingFailed';
    await rm(job.dir, { recursive: true, force: true }).catch(() => {});
  } finally {
    clearInterval(monitor);
    job.expires = Date.now() + expiry;
  }
}

function pump() {
  if (running) return;
  const job = [...jobs.values()].find(item => item.status === 'queued');
  if (!job) return;
  running = true;
  void execute(job).finally(() => {
    running = false;
    pump();
  });
}

function chooseSources(info, format, quality) {
  const audioOnly = info.audio.findLast(item => !item.vcodec || item.vcodec === 'none');
  if (format === 'mp3' && ['128', '192', '256', '320'].includes(quality) && info.hasAudio) {
    return { audio: audioOnly || info.audio.at(-1) };
  }
  if (format === 'mp4' && info.resolutions.includes(Number(quality))) {
    const height = Number(quality);
    const video = info.videos.findLast(item => item.height <= height) ||
      info.videos.reduce((smallest, item) => item.height < smallest.height ? item : smallest);
    return { video, audio: video.acodec && video.acodec !== 'none' ? undefined : audioOnly || info.audio.at(-1) };
  }
  throw new MediaError('invalidQuality');
}

export async function mediaAction(data) {
  try {
    if (data?.action === 'analyze') {
      if (analyzing || inputs.size >= 40) throw new MediaError('mediaBusy', 429);
      const url = validateUrl(data.url);
      analyzing = true;
      try {
        const raw = await downloader(['--skip-download', '--ignore-no-formats-error', '--dump-single-json', '--', url], { maxOutput: 8_000_000 });
        const { videos, audio, ...info } = normalizeInfo(JSON.parse(raw));
        const id = randomUUID();
        inputs.set(id, { ...info, videos, audio, url, expires: Date.now() + expiry });
        return { status: 200, data: { id, ...info } };
      } catch (error) {
        if (error instanceof MediaError && error.message !== 'processingFailed') throw error;
        throw new MediaError('sourceUnavailable', 422);
      } finally { analyzing = false; }
    }
    if (data?.action === 'start') {
      const info = inputs.get(data.id);
      if (!info || info.expires < Date.now()) throw new MediaError('expiredMedia', 404);
      const count = [...jobs.values()].filter(job => !finalStates.has(job.status)).length;
      if (jobs.size >= 12 || count >= 3) throw new MediaError('mediaBusy', 429);
      const sources = chooseSources(info, data.format, String(data.quality));
      const id = randomUUID();
      const job = { id, sources, url: info.url, format: data.format, quality: String(data.quality), title: info.title,
        status: 'queued', progress: 0, dir: join(session, id), controller: new AbortController(), readers: 0 };
      jobs.set(id, job);
      pump();
      return { status: 202, data: publicJob(job) };
    }
    if (['status', 'cancel'].includes(data?.action)) {
      const job = jobs.get(data.id);
      if (!job || job.expires < Date.now()) throw new MediaError('expiredMedia', 404);
      if (data.action === 'cancel' && !finalStates.has(job.status)) {
        job.controller.abort();
        if (job.status === 'queued') {
          job.status = 'cancelled';
          job.expires = Date.now() + expiry;
        }
      }
      return { status: 200, data: publicJob(job) };
    }
    throw new MediaError('invalidRequest');
  } catch (error) {
    return { status: error instanceof MediaError ? error.status : 500,
      data: { code: error instanceof MediaError ? error.message : 'processingFailed' } };
  }
}

export async function downloadMedia(id, response) {
  const job = jobs.get(id);
  if (!job || job.status !== 'done' || job.expires < Date.now()) return false;
  job.readers++;
  try {
    const { size } = await stat(job.output);
    const name = `${cleanTitle(job.title)}.${job.format}`;
    const encoded = encodeURIComponent(name).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16));
    response.writeHead(200, { 'Content-Type': job.format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
      'Content-Length': size, 'Content-Disposition': `attachment; filename="download.${job.format}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    await pipeline(createReadStream(job.output), response);
  } catch {
    if (!response.headersSent) return false;
    response.destroy();
  } finally { job.readers--; }
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, info] of inputs) if (info.expires < now) inputs.delete(id);
  for (const [id, job] of jobs) {
    if (job.expires < now && !job.readers) {
      jobs.delete(id);
      void rm(job.dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}, 60_000).unref();
