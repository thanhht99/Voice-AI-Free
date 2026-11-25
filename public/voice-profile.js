const sampleRate = 24000;
const storageKey = 'voice-studio-personal-voice';
export const personalVoiceId = 'local:personal';

const text = {
  vi: {
    title: 'Giọng của tôi',
    instructions: 'Thu hoặc tải lên 3–8 giây giọng của ní. Với tệp dài hơn, app lấy 8 giây đầu.',
    sample: '“Xin chào, đây là giọng của mình. Hôm nay mình đang thử đọc một đoạn văn bằng Voice AI Free.”',
    privacy: 'Mẫu được xử lý trên máy này. Khi bấm lưu, chỉ hồ sơ giọng được giữ trong trình duyệt.',
    record: 'Thu âm', stop: 'Dừng thu', upload: 'Tải mẫu lên', close: 'Đóng',
    use: 'Dùng giọng này', save: 'Lưu hồ sơ', delete: 'Xóa hồ sơ', discard: 'Bỏ hồ sơ mới',
    permission: 'Đang chờ quyền dùng mic…',
    recording: 'Đang thu. Thu ít nhất 3 giây. App tự dừng sau 8 giây.',
    processing: 'Đang tạo hồ sơ giọng. Lần đầu có thể lâu hơn để tải mô hình.',
    ready: 'Đã tạo hồ sơ. Bấm Dùng giọng này rồi nghe thử với kịch bản của ní.',
    saved: 'Đã lưu hồ sơ giọng trong trình duyệt.',
    deleted: 'Đã xóa hồ sơ giọng.',
    discarded: 'Đã bỏ hồ sơ mới và quay về hồ sơ đã lưu.',
    invalidSample: 'Mẫu cần ít nhất 3 giây và có lời nói rõ. Ní thử thu lại hoặc chọn tệp khác.',
    fileLarge: 'Tệp quá lớn. Chọn một đoạn thu ngắn hơn (tối đa 12 MB).',
    audioError: 'Không đọc được tệp âm thanh. Ní thử tệp WAV, MP3 hoặc M4A khác.',
    recordError: 'Chưa thu được bằng mic. Kiểm tra quyền mic hoặc tải tệp âm thanh lên.',
    localBusy: 'Máy đang tạo bản đọc khác. Ní chờ một chút rồi thử lại.',
    unavailable: 'Chưa tạo được hồ sơ giọng. Kiểm tra máy chủ VieNeu và thử lại.',
    storageError: 'Trình duyệt chưa cập nhật được hồ sơ đã lưu.'
  },
  en: {
    title: 'My voice',
    instructions: 'Record or upload 3–8 seconds of your own voice. For longer files, the app uses the first 8 seconds.',
    sample: '“Xin chào, đây là giọng của mình. Hôm nay mình đang thử đọc một đoạn văn bằng Voice AI Free.”',
    privacy: 'The sample is processed on this computer. Saving keeps only the voice profile in this browser.',
    record: 'Record', stop: 'Stop recording', upload: 'Upload sample', close: 'Close',
    use: 'Use this voice', save: 'Save profile', delete: 'Delete profile', discard: 'Discard new profile',
    permission: 'Waiting for microphone permission…',
    recording: 'Recording. Speak for at least 3 seconds. Recording stops after 8 seconds.',
    processing: 'Creating the voice profile. The first run may take longer to download the model.',
    ready: 'Profile ready. Choose Use this voice, then preview it with your script.',
    saved: 'Voice profile saved in this browser.',
    deleted: 'Voice profile deleted.',
    discarded: 'The new profile was discarded. Your saved profile is active again.',
    invalidSample: 'Use a clear voice sample of at least 3 seconds. Try recording again or use another file.',
    fileLarge: 'The file is too large. Choose a shorter recording (up to 12 MB).',
    audioError: 'Could not read the audio file. Try a different WAV, MP3, or M4A file.',
    recordError: 'Could not record. Check microphone permissions or upload an audio file.',
    localBusy: 'Another recording is being generated. Try again shortly.',
    unavailable: 'Could not create the voice profile. Check the VieNeu server and try again.',
    storageError: 'The browser could not update the saved profile.'
  }
};

async function toPcm(blob) {
  const context = new OfflineAudioContext(1, 1, sampleRate);
  const audio = await context.decodeAudioData(await blob.arrayBuffer());
  const length = Math.min(audio.length, sampleRate * 8);
  if (length < sampleRate * 3) return null;
  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
  const pcm = new DataView(new ArrayBuffer(length * 2));
  for (let index = 0; index < length; index++) {
    const value = channels.reduce((sum, channel) => sum + channel[index], 0) / channels.length;
    pcm.setInt16(index * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true);
  }
  return pcm.buffer;
}

export function setupVoiceProfile({ onChange, onUse }) {
  const open = document.querySelector('#personal-voice-open');
  const dialog = document.querySelector('#personal-voice-dialog');
  const record = document.querySelector('#profile-record');
  const upload = document.querySelector('#profile-upload');
  const file = document.querySelector('#profile-file');
  const options = document.querySelector('#profile-options');
  const use = document.querySelector('#profile-use');
  const save = document.querySelector('#profile-save');
  const remove = document.querySelector('#profile-delete');
  const status = document.querySelector('#profile-status');
  const canRecord = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  let profile;
  let saved;
  let operation;
  let recorder;
  let locale = 'vi';
  let statusKey;

  try {
    const data = localStorage.getItem(storageKey);
    if (data?.startsWith('nano1:')) profile = saved = data;
  } catch { /* The temporary profile can still be used. */ }

  function render() {
    const copy = text[locale];
    for (const node of dialog.querySelectorAll('[data-profile-copy]')) node.textContent = copy[node.dataset.profileCopy];
    open.textContent = copy.title;
    record.textContent = copy[recorder?.state === 'recording' ? 'stop' : 'record'];
    record.disabled = !canRecord || (Boolean(operation) && recorder?.state !== 'recording');
    upload.disabled = Boolean(operation);
    options.hidden = !profile;
    use.disabled = Boolean(operation);
    save.disabled = Boolean(operation) || saved === profile;
    remove.disabled = Boolean(operation);
    remove.textContent = copy[saved && profile !== saved ? 'discard' : 'delete'];
    status.textContent = statusKey ? copy[statusKey] : '';
  }

  function show(key) {
    statusKey = key;
    render();
  }

  async function enroll(blob, signal) {
    show('processing');
    let pcm;
    try { pcm = await toPcm(blob); }
    catch {
      if (!signal.aborted) show('audioError');
      return;
    }
    if (signal.aborted) return;
    if (!pcm) return show('invalidSample');
    try {
      const result = await fetch('/api/voice-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: pcm, signal
      });
      const data = await result.json();
      if (signal.aborted) return;
      if (result.ok && typeof data.profile === 'string') {
        profile = data.profile;
        onChange();
        show('ready');
      } else {
        show(['invalidSample', 'localBusy'].includes(data.code) ? data.code : 'unavailable');
      }
    } catch {
      if (!signal.aborted) show('unavailable');
    }
  }

  function processSample(work) {
    const task = new AbortController();
    operation = task;
    return work(task.signal).finally(() => {
      if (operation === task) operation = undefined;
      render();
    });
  }

  open.addEventListener('click', () => {
    show(profile ? (profile === saved ? 'saved' : 'ready') : undefined);
    dialog.showModal();
  });
  upload.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const sample = file.files[0];
    file.value = '';
    if (!sample || operation) return;
    if (sample.size > 12_000_000) return show('fileLarge');
    await processSample(signal => enroll(sample, signal));
  });
  record.addEventListener('click', async () => {
    if (recorder?.state === 'recording') return recorder.stop();
    if (operation) return;
    await processSample(async signal => {
      let stream;
      let timer;
      let current;
      try {
        show('permission');
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (signal.aborted) return;
        recorder = current = new MediaRecorder(stream);
        const chunks = [];
        const stop = () => { if (current.state === 'recording') current.stop(); };
        const done = new Promise((resolve, reject) => {
          current.addEventListener('dataavailable', event => chunks.push(event.data));
          current.addEventListener('error', reject, { once: true });
          current.addEventListener('stop', () => resolve(new Blob(chunks, { type: current.mimeType })), { once: true });
        });
        signal.addEventListener('abort', stop, { once: true });
        current.start();
        timer = setTimeout(stop, 8000);
        show('recording');
        const clip = await done;
        stream.getTracks().forEach(track => track.stop());
        if (!signal.aborted) await enroll(clip, signal);
      } catch {
        if (!signal.aborted) show('recordError');
      } finally {
        clearTimeout(timer);
        stream?.getTracks().forEach(track => track.stop());
        if (recorder === current) recorder = undefined;
      }
    });
  });
  dialog.addEventListener('close', () => {
    operation?.abort();
    operation = undefined;
    recorder = undefined;
    render();
  });
  use.addEventListener('click', () => {
    onUse();
    dialog.close();
  });
  save.addEventListener('click', () => {
    try {
      localStorage.setItem(storageKey, profile);
      saved = profile;
      show('saved');
    } catch { show('storageError'); }
  });
  remove.addEventListener('click', () => {
    if (saved && profile !== saved) {
      profile = saved;
      onChange();
      show('discarded');
      return;
    }
    try { localStorage.removeItem(storageKey); }
    catch { return show('storageError'); }
    profile = saved = undefined;
    onChange();
    show('deleted');
    upload.focus();
  });

  return {
    get profile() { return profile; },
    setAvailable(available) { open.hidden = !available; },
    setLanguage(language) { locale = language; render(); }
  };
}
