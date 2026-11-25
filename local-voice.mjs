import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const workspace = new URL('./', import.meta.url);
const python = fileURLToPath(new URL(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python', workspace));
const script = fileURLToPath(new URL('local_voice.py', workspace));
const cache = fileURLToPath(new URL('.voice-cache/huggingface', workspace));
const voices = new Map();
let worker;
let pending;
let state = 'disabled';
let personalVoice = false;

export function localVoiceConfig() {
  return { localState: state, localVoices: [...voices.values()], personalVoice: state === 'ready' && personalVoice };
}

export function startLocalVoice() {
  if (!existsSync(python)) return;
  state = 'loading';
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', HF_HOME: process.env.HF_HOME || cache };
  delete env.AZURE_SPEECH_KEY;
  delete env.AZURE_SPEECH_REGION;
  try {
    worker = spawn(python, ['-u', script], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'inherit'] });
  } catch (error) {
    state = 'failed';
    console.error(`VieNeu could not start: ${error.code || error.message}`);
    return;
  }
  const output = createInterface({ input: worker.stdout });
  output.on('line', line => {
    let message;
    try { message = JSON.parse(line); }
    catch { return; }
    if (Array.isArray(message?.ready)) {
      for (const voice of message.ready) {
        const id = `local:${voice.id}`;
        voices.set(id, { ...voice, id });
      }
      state = voices.size ? 'ready' : 'failed';
      personalVoice = message.personalVoice === true;
    } else if (pending && message) {
      if (typeof message.audio === 'string') pending.finish({ audio: Buffer.from(message.audio, 'base64') });
      else if (typeof message.profile === 'string') pending.finish({ profile: message.profile });
      else if (message.error) {
        const invalid = ['invalidSample', 'invalidProfile'].includes(message.error);
        pending.finish({ status: invalid ? 400 : 502, code: invalid ? message.error : 'localError' });
      }
    }
  });
  function stopped() {
    state = 'failed';
    voices.clear();
    pending?.finish({ status: 503, code: 'localUnavailable' });
  }
  worker.on('error', error => {
    console.error(`VieNeu could not start: ${error.code || error.message}`);
    stopped();
  });
  worker.on('exit', stopped);
  worker.stdin.on('error', stopped);
  process.once('exit', () => worker.kill());
}

export function synthesizeLocalVoice({ text, voice, speed, profile }) {
  if (voice === 'local:personal') {
    if (!personalVoice || state !== 'ready') return { status: 503, code: 'localUnavailable' };
    return runWorker({ text, speed, profile });
  }
  if (!voices.has(voice) && state === 'ready') return { status: 400, code: 'invalidRequest' };
  return runWorker({ text, speed, voice: voice.slice('local:'.length) });
}

export function createVoiceProfile(sample) {
  if (!personalVoice || state !== 'ready') return { status: 503, code: 'localUnavailable' };
  return runWorker({ sample: sample.toString('base64') });
}

function runWorker(message) {
  if (state !== 'ready') return { status: 503, code: 'localUnavailable' };
  if (pending) return { status: 429, code: 'localBusy' };
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pending.finish({ status: 504, code: 'localTimeout' });
      state = 'failed';
      voices.clear();
      worker.kill();
    }, 300000);
    pending = {
      finish(result) {
        clearTimeout(timer);
        pending = undefined;
        resolve(result);
      }
    };
    worker.stdin.write(JSON.stringify(message) + '\n');
  });
}
