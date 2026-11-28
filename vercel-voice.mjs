const maxRequestBytes = 20_000;
const maxAudioBytes = 4_000_000;

function backendSettings() {
  const token = process.env.VOICE_BACKEND_TOKEN?.trim();
  const url = process.env.VOICE_BACKEND_URL?.trim();
  if (!url && !token) return { state: 'disabled' };
  try {
    const origin = new URL(url);
    if (token && origin.protocol === 'https:' && !origin.username && !origin.password &&
      origin.pathname === '/' && !origin.search && !origin.hash) {
      return { state: 'configured', origin: origin.origin, token };
    }
  } catch { /* Treat missing or invalid origin settings as unavailable. */ }
  return { state: 'failed' };
}

function callBackend(backend, path, signal, body) {
  return fetch(new URL(path, backend.origin), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${backend.token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body,
    signal,
    redirect: 'error'
  });
}

function json(response, status, data, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(JSON.stringify(data));
}

export async function configHandler(request, response) {
  if (request.method !== 'GET') return json(response, 405, {}, { Allow: 'GET' });
  const backend = backendSettings();
  if (backend.state === 'configured') {
    try {
      const upstream = await callBackend(backend, '/api/config', AbortSignal.timeout(5000));
      if (upstream.ok) {
        const capabilities = await upstream.json();
        return json(response, 200, { ...capabilities, personalVoice: false });
      }
      await upstream.body?.cancel();
    } catch { /* Keep the device voices available when the backend is unreachable. */ }
  }
  return json(response, 200, {
    configured: false,
    localState: backend.state === 'disabled' ? 'disabled' : 'failed',
    localVoices: []
  });
}

export async function mediaHandler(request, response) {
  if (request.method !== 'POST') return json(response, 405, {}, { Allow: 'POST' });
  if (request.headers['sec-fetch-site'] === 'cross-site' ||
    (request.headers.origin && request.headers.origin !== `https://${request.headers.host}`)) {
    return json(response, 403, { code: 'mediaUnavailable' });
  }
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    return json(response, 415, { code: 'invalidRequest' });
  }
  if (Number(request.headers['content-length']) > 8192) return json(response, 413, { code: 'invalidRequest' });
  let body;
  try {
    const data = request.body;
    if (!['analyze', 'start', 'status', 'cancel'].includes(data?.action)) throw new Error('Bad request');
    body = JSON.stringify(data);
  } catch { return json(response, 400, { code: 'invalidRequest' }); }
  if (Buffer.byteLength(body) > 8192) return json(response, 413, { code: 'invalidRequest' });
  const backend = backendSettings();
  if (backend.state !== 'configured') return json(response, 503, { code: 'mediaUnavailable' });
  try {
    const upstream = await callBackend(backend, '/api/media', AbortSignal.timeout(65_000), body);
    if (upstream.status === 401 || upstream.status === 403 ||
      (upstream.status === 404 && !upstream.headers.get('content-type')?.includes('json'))) {
      await upstream.body?.cancel();
      return json(response, 503, { code: 'mediaUnavailable' });
    }
    const result = await upstream.json();
    if (result.file) {
      if (!/^\/api\/media\/file\/[a-f0-9-]{36}$/.test(result.file)) throw new Error('Invalid file path');
      result.file = new URL(result.file, backend.origin).href;
    }
    return json(response, upstream.status, result);
  } catch { return json(response, 502, { code: 'mediaUnavailable' }); }
}

export async function speechHandler(request, response) {
  if (request.method !== 'POST') return json(response, 405, {}, { Allow: 'POST' });
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    return json(response, 415, { code: 'invalidRequest' });
  }
  if (Number(request.headers['content-length']) > maxRequestBytes) {
    return json(response, 413, { code: 'requestTooLong' });
  }
  let body;
  try {
    const parsed = request.body;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Bad JSON');
    if (parsed.voice === 'local:personal' || 'profile' in parsed) {
      return json(response, 403, { code: 'localUnavailable' });
    }
    body = JSON.stringify(parsed);
  } catch {
    return json(response, 400, { code: 'invalidRequest' });
  }
  if (Buffer.byteLength(body) > maxRequestBytes) return json(response, 413, { code: 'requestTooLong' });

  const backend = backendSettings();
  if (backend.state !== 'configured') return json(response, 503, { code: 'localUnavailable' });
  const timeout = AbortSignal.timeout(280000);
  const disconnected = new AbortController();
  response.once('close', () => disconnected.abort());
  try {
    const upstream = await callBackend(backend, '/api/speech', AbortSignal.any([timeout, disconnected.signal]), body);
    if (!upstream.ok) {
      if (upstream.status === 401 || upstream.status === 403) {
        await upstream.body?.cancel();
        return json(response, 503, { code: 'localUnavailable' });
      }
      const error = await upstream.json().catch(() => ({ code: 'localError' }));
      return json(response, upstream.status, error);
    }
    if (upstream.headers.get('content-type')?.split(';')[0] !== 'audio/mpeg') {
      await upstream.body?.cancel();
      return json(response, 502, { code: 'localError' });
    }
    if (Number(upstream.headers.get('content-length')) > maxAudioBytes) {
      await upstream.body?.cancel();
      return json(response, 413, { code: 'audioTooLarge' });
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    if (audio.length > maxAudioBytes) return json(response, 413, { code: 'audioTooLarge' });
    response.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Cache-Control': 'no-store'
    });
    response.end(audio);
  } catch {
    if (!response.destroyed) {
      return json(response, timeout.aborted ? 504 : 503, { code: timeout.aborted ? 'localTimeout' : 'localUnavailable' });
    }
  }
}
