import { locales, maxLength, voices } from './voices.js';
import { personalVoiceId, setupVoiceProfile } from './voice-profile.js';
import { setupMedia } from './media.js';

const script = document.querySelector('#script');
const count = document.querySelector('#count');
const language = document.querySelector('#language');
const voice = document.querySelector('#voice');
const speed = document.querySelector('#speed');
const speedValue = document.querySelector('#speed-value');
const mode = document.querySelector('#mode');
const player = document.querySelector('.player');
const preview = document.querySelector('#preview');
const download = document.querySelector('#download');
const clear = document.querySelector('#clear');
const status = document.querySelector('#status');
const audio = document.querySelector('#audio');
const install = document.querySelector('#install');
const installDialog = document.querySelector('#install-dialog');
const interfaceLanguage = document.querySelector('#interface-language');
const interfaceButtons = interfaceLanguage.querySelectorAll('button');
const description = document.querySelector('meta[name="description"]');
const speech = window.speechSynthesis;
const copy = {
  vi: {
    interfaceLanguage: 'Ngôn ngữ giao diện',
    heading: 'Tạo giọng đọc',
    voiceTool: 'Tạo giọng đọc',
    mediaTool: 'Tải MP3 / MP4',
    authorCredit: 'Tác giả',
    intro: 'Chuyển kịch bản tiếng Việt hoặc tiếng Anh thành giọng đọc cho video và bài thuyết trình.',
    script: 'Kịch bản',
    placeholder: 'Dán hoặc nhập kịch bản của ní ở đây…',
    sample: 'Chèn văn bản mẫu',
    clear: 'Xóa nội dung',
    characters: 'ký tự',
    settings: 'Cài đặt giọng đọc',
    speechLanguage: 'Ngôn ngữ giọng đọc',
    vi: 'Tiếng Việt',
    en: 'Tiếng Anh (Mỹ)',
    female: 'Nữ',
    male: 'Nam',
    north: 'Miền Bắc',
    central: 'Miền Trung',
    south: 'Miền Nam',
    voice: 'Giọng đọc',
    speed: 'Tốc độ',
    slow: 'Chậm',
    fast: 'Nhanh',
    player: 'Bản nghe',
    preview: 'Nghe thử',
    stop: 'Dừng',
    download: 'Tải MP3',
    defaultVoice: 'Giọng mặc định của thiết bị',
    noVoice: 'Thiết bị chưa hỗ trợ đọc',
    cloudMode: 'Giọng AI Azure · Có thể tải MP3',
    localMode: 'VieNeu-TTS · Tạo MP3 trên máy, không có quota theo tháng',
    personalVoice: 'Giọng của tôi',
    personalMode: 'Giọng của tôi · Tạo MP3 trên máy',
    invalidProfile: 'Hồ sơ này không đọc được. Ní tạo hồ sơ giọng mới nha.',
    localLoading: 'Đang nạp VieNeu-TTS. Lần đầu có thể mất vài phút để tải mô hình.',
    localFailed: 'VieNeu-TTS chưa khởi động được. Xem thông báo ở cửa sổ chạy máy chủ.',
    deviceMode: 'Giọng thiết bị · Nghe thử',
    unsupportedMode: 'Trình duyệt chưa hỗ trợ giọng thiết bị.',
    localVoice: 'Giọng chạy trên máy',
    deviceVoice: 'Giọng thiết bị',
    generating: 'Đang tạo giọng đọc…',
    networkError: 'Chưa kết nối được máy chủ. Ní thử lại nha.',
    invalidRequest: 'Kiểm tra lại kịch bản, giọng đọc và tốc độ.',
    requestTooLong: 'Nội dung gửi lên quá dài.',
    serviceBusy: 'Dịch vụ đang bận. Ní thử lại sau nha.',
    serviceUnavailable: 'Thêm cấu hình Azure Speech để tạo và tải MP3.',
    serviceError: 'Chưa tạo được giọng. Kiểm tra cấu hình Azure Speech hoặc thử lại nha.',
    localUnavailable: 'VieNeu-TTS chưa sẵn sàng. Kiểm tra máy chủ rồi thử lại nha.',
    localBusy: 'VieNeu-TTS đang tạo một bản đọc khác. Ní thử lại sau nha.',
    localTimeout: 'VieNeu-TTS tạo giọng quá lâu. Khởi động lại máy chủ và thử với đoạn ngắn hơn nha.',
    localError: 'VieNeu-TTS chưa tạo được bản đọc. Ní thử lại hoặc chọn giọng khác nha.',
    audioTooLarge: 'File MP3 quá lớn để tải qua Vercel. Ní chia kịch bản thành đoạn ngắn hơn nha.',
    voiceUnavailable: 'Thiết bị chưa có giọng đọc cho ngôn ngữ này.',
    deviceError: 'Thiết bị chưa phát được giọng đọc. Ní thử lại nha.',
    sampleTooLong: 'Kịch bản không còn đủ chỗ để chèn mẫu.',
    playbackError: 'Chưa phát được bản nghe. Ní bấm Nghe thử lại hoặc tải MP3 nha.',
    install: 'Cài ứng dụng',
    installHeading: 'Cài Voice AI Free',
    android: 'Mở trong Chrome, vào menu ⋮ rồi chọn mục cài đặt ứng dụng.',
    iphone: 'Mở trong Safari, chọn Chia sẻ, Thêm vào màn hình chính rồi bật Mở dưới dạng ứng dụng web nếu có.',
    close: 'Đóng'
  },
  en: {
    interfaceLanguage: 'Interface language',
    heading: 'Create a voice-over',
    voiceTool: 'Create a voice-over',
    mediaTool: 'Download MP3 / MP4',
    authorCredit: 'Project by',
    intro: 'Turn a Vietnamese or English script into a voice-over for videos and presentations.',
    script: 'Script',
    placeholder: 'Paste or type your script here…',
    sample: 'Insert sample text',
    clear: 'Clear text',
    characters: 'characters',
    settings: 'Voice settings',
    speechLanguage: 'Speech language',
    vi: 'Vietnamese',
    en: 'English (US)',
    female: 'Female',
    male: 'Male',
    north: 'Northern Vietnamese',
    central: 'Central Vietnamese',
    south: 'Southern Vietnamese',
    voice: 'Voice',
    speed: 'Speed',
    slow: 'Slower',
    fast: 'Faster',
    player: 'Audio preview',
    preview: 'Preview',
    stop: 'Stop',
    download: 'Download MP3',
    defaultVoice: 'Default device voice',
    noVoice: 'Speech is unavailable on this device',
    cloudMode: 'Azure AI voices · MP3 downloads available',
    localMode: 'VieNeu-TTS · Local MP3 generation with no monthly quota',
    personalVoice: 'My voice',
    personalMode: 'My voice · Local MP3 generation',
    invalidProfile: 'This voice profile could not be read. Create a new profile and try again.',
    localLoading: 'Loading VieNeu-TTS. The first model download may take a few minutes.',
    localFailed: 'VieNeu-TTS could not start. Check the server terminal for details.',
    deviceMode: 'Device voice · Preview only',
    unsupportedMode: 'This browser has no device speech support.',
    localVoice: 'Local voice',
    deviceVoice: 'Device voice',
    generating: 'Generating audio…',
    networkError: 'Could not reach the server. Please try again.',
    invalidRequest: 'Check the script, voice, and speed.',
    requestTooLong: 'The submitted script is too long.',
    serviceBusy: 'The speech service is busy. Try again later.',
    serviceUnavailable: 'Configure Azure Speech to create and download MP3s.',
    serviceError: 'Could not generate audio. Check your Azure Speech settings or try again.',
    localUnavailable: 'VieNeu-TTS is not ready. Check the server and try again.',
    localBusy: 'VieNeu-TTS is generating another recording. Try again shortly.',
    localTimeout: 'VieNeu-TTS took too long. Restart the server and try a shorter script.',
    localError: 'VieNeu-TTS could not generate audio. Try again or select another voice.',
    audioTooLarge: 'The MP3 is too large to download through Vercel. Try a shorter script.',
    voiceUnavailable: 'This device does not have a voice for the selected language.',
    deviceError: 'This device could not play the script. Please try again.',
    sampleTooLong: 'There is not enough room in the script to insert the sample.',
    playbackError: 'Could not play the audio. Try Preview again or download the MP3.',
    install: 'Install app',
    installHeading: 'Install Voice AI Free',
    android: 'Open in Chrome, tap the ⋮ menu, then select the app installation option.',
    iphone: 'Open in Safari, tap Share, then Add to Home Screen and turn on Open as Web App if available.',
    close: 'Close'
  }
};
const samples = {
  vi: 'Xin chào, bạn đang nghe Voice AI Free. Chỉ với vài dòng kịch bản, bạn có thể tạo lời dẫn cho video tiếp theo của mình.',
  en: 'Hi, you’re listening to Voice AI Free. With just a few lines of text, you can create a voice-over for your next video.'
};

let cloud = false;
let localState = 'disabled';
let localVoices = [];
let personalVoiceAvailable = false;
let configTimer;
let voiceChosen = false;
let pending;
let utterance;
let audioUrl;
let playing = false;
let installPrompt;
let uiLanguage = 'vi';
let statusKey;
const t = key => copy[uiLanguage][key];
const apiError = {
  400: 'invalidRequest',
  413: 'requestTooLong',
  415: 'invalidRequest',
  429: 'serviceBusy',
  503: 'serviceUnavailable'
};
const localErrors = new Set(['invalidRequest', 'localUnavailable', 'localBusy', 'localTimeout', 'localError', 'audioTooLarge', 'requestTooLong', 'invalidProfile']);
const mediaTool = setupMedia(refreshConfig);
const voiceProfile = setupVoiceProfile({
  onChange() {
    if (voice.value === personalVoiceId) invalidateOutput();
    updateVoices();
  },
  onUse() {
    voiceChosen = true;
    invalidateOutput();
    updateVoices(personalVoiceId);
    document.querySelector('#personal-voice-dialog').addEventListener('close', () => script.focus(), { once: true });
  }
});

function usesDeviceVoice() {
  return voice.value.startsWith('device:');
}

script.maxLength = maxLength;
try {
  script.value = (localStorage.getItem('voice-studio-draft') || '').slice(0, maxLength);
  if (localStorage.getItem('voice-studio-interface-language') === 'en') uiLanguage = 'en';
}
catch { /* The editor still works when browser storage is restricted. */ }

function showStatus(key) {
  statusKey = key;
  status.textContent = key ? t(key) : '';
}

function renderInterface() {
  document.documentElement.lang = uiLanguage;
  document.title = `Voice AI Free · ${t('heading')}`;
  description.content = t('intro');
  interfaceLanguage.setAttribute('aria-label', t('interfaceLanguage'));
  for (const button of interfaceButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.language === uiLanguage));
  }
  for (const element of document.querySelectorAll('[data-copy]')) {
    element.textContent = t(element.dataset.copy);
  }
  script.placeholder = t('placeholder');
  voiceProfile.setLanguage(uiLanguage);
  mediaTool.setLanguage(uiLanguage);
  showStatus(statusKey);
  updateVoices();
}

function updateControls() {
  const hasText = Boolean(script.value.trim());
  const locale = locales[uiLanguage];
  count.textContent = `${script.value.length.toLocaleString(locale)} / ${maxLength.toLocaleString(locale)} ${t('characters')}`;
  speedValue.value = `${Number(speed.value).toLocaleString(locale)}×`;
  clear.disabled = !script.value;
  preview.disabled = Boolean(pending) || !hasText || !voice.value;
  download.disabled = Boolean(pending) || usesDeviceVoice() || !hasText || !voice.value;
  player.classList.toggle('playing', playing);
  preview.querySelector('span').textContent = t(playing ? 'stop' : 'preview');
}

function stopPlayback() {
  playing = false;
  if (utterance) {
    utterance = undefined;
    speech.cancel();
  }
  audio.pause();
  audio.currentTime = 0;
}

function invalidateOutput() {
  if (pending) {
    pending.abort();
    pending = undefined;
  }
  stopPlayback();
  if (audioUrl) {
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(audioUrl);
    audioUrl = undefined;
  }
  showStatus();
}

function updateVoices(selected = voice.value) {
  script.lang = locales[language.value];
  const supportsPersonalVoice = language.value === 'vi' && personalVoiceAvailable;
  voiceProfile.setAvailable(supportsPersonalVoice);
  const cloudVoices = cloud
    ? voices.filter(item => item.language === language.value).map(item => ({
        id: item.id,
        label: `${item.name} · ${t(item.gender)} · Azure`
      }))
    : [];
  const catalog = [
    ...(language.value === 'vi' ? localVoices.map(item => ({
      id: item.id,
      label: [item.name, t(item.gender), t(item.region), t('localVoice')].filter(Boolean).join(' · ')
    })) : []),
    ...(supportsPersonalVoice && voiceProfile.profile ? [{ id: personalVoiceId, label: t('personalVoice') }] : []),
    ...cloudVoices,
    ...(speech?.getVoices() || [])
      .filter(item => item.lang.toLowerCase().split(/[-_]/)[0] === language.value)
      .map(item => ({ id: `device:${item.voiceURI}`, label: `${item.name} · ${t('deviceVoice')}` }))
  ];
  const fallback = speech
    ? new Option(t('defaultVoice'), 'device:')
    : new Option(t('noVoice'), '');
  voice.replaceChildren(...(catalog.length
    ? catalog.map(item => new Option(item.label, item.id))
    : [fallback]));
  if (catalog.some(item => item.id === selected)) voice.value = selected;
  updateMode();
  updateControls();
}

function updateMode() {
  if (voice.value === personalVoiceId) {
    mode.textContent = t('personalMode');
  } else if (voice.value.startsWith('local:')) {
    mode.textContent = t('localMode');
  } else if (voice.value && !usesDeviceVoice()) {
    mode.textContent = t('cloudMode');
  } else if (language.value === 'vi' && localState === 'loading') {
    mode.textContent = t('localLoading');
  } else if (language.value === 'vi' && localState === 'failed') {
    mode.textContent = t('localFailed');
  } else {
    mode.textContent = t(speech ? 'deviceMode' : 'unsupportedMode');
  }
}

async function refreshConfig() {
  clearTimeout(configTimer);
  try {
    const result = await fetch('/api/config', { cache: 'no-store' });
    if (!result.ok) return;
    const config = await result.json();
    mediaTool.setAvailable(config.mediaDownloads === true);
    const nextCloud = Boolean(config.configured);
    const nextLocalState = config.localState || 'disabled';
    const nextPersonalVoice = config.personalVoice === true;
    if (cloud === nextCloud && localState === nextLocalState && personalVoiceAvailable === nextPersonalVoice) return;
    const selected = voice.value;
    cloud = nextCloud;
    localState = nextLocalState;
    personalVoiceAvailable = nextPersonalVoice;
    localVoices = config.localVoices || [];
    updateVoices(voiceChosen || playing || pending || audioUrl ? selected : '');
    if (voice.value !== selected) {
      invalidateOutput();
      updateControls();
    }
  } catch {
    mediaTool.setAvailable(false);
    /* Keep the currently selected device voice available offline. */
  }
  finally {
    if (localState === 'loading') configTimer = setTimeout(refreshConfig, 2500);
  }
}

async function getAudio() {
  if (audioUrl) return audioUrl;
  const request = new AbortController();
  pending = request;
  showStatus('generating');
  updateControls();
  try {
    const result = await fetch('/api/speech', {
      method: 'POST',
      signal: request.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: script.value, voice: voice.value, speed: Number(speed.value),
        profile: voice.value === personalVoiceId ? voiceProfile.profile : undefined
      })
    });
    if (request.signal.aborted) return;
    if (!result.ok) {
      if (voice.value.startsWith('local:')) {
        const problem = await result.json().catch(() => ({}));
        if (!request.signal.aborted) showStatus(localErrors.has(problem.code) ? problem.code : 'localError');
      } else {
        showStatus(apiError[result.status] ?? 'serviceError');
      }
      return;
    }
    const blob = await result.blob();
    if (request.signal.aborted) return;
    audioUrl = URL.createObjectURL(blob);
    audio.src = audioUrl;
    showStatus();
    return audioUrl;
  } catch {
    if (!request.signal.aborted) {
      showStatus('networkError');
    }
  } finally {
    if (pending === request) {
      pending = undefined;
      updateControls();
    }
  }
}

function playDeviceVoice() {
  const current = new SpeechSynthesisUtterance(script.value.trim());
  const selected = speech.getVoices().find(item => `device:${item.voiceURI}` === voice.value);
  current.lang = selected?.lang || locales[language.value];
  if (selected) current.voice = selected;
  current.rate = Number(speed.value);
  current.onend = () => {
    if (utterance !== current) return;
    utterance = undefined;
    playing = false;
    updateControls();
  };
  current.onerror = event => {
    if (utterance !== current) return;
    current.onend();
    showStatus(['language-unavailable', 'voice-unavailable'].includes(event.error) ? 'voiceUnavailable' : 'deviceError');
  };
  utterance = current;
  playing = true;
  updateControls();
  speech.speak(current);
}

function scriptChanged() {
  invalidateOutput();
  try { localStorage.setItem('voice-studio-draft', script.value); }
  catch { /* Storage can be unavailable without affecting playback. */ }
  updateControls();
}

script.addEventListener('input', scriptChanged);
document.querySelector('#sample').addEventListener('click', () => {
  const prefix = script.selectionStart > 0 && !/\s/.test(script.value[script.selectionStart - 1]) ? '\n' : '';
  const sample = prefix + samples[language.value];
  if (script.value.length - (script.selectionEnd - script.selectionStart) + sample.length > maxLength) {
    showStatus('sampleTooLong');
    return;
  }
  script.setRangeText(sample, script.selectionStart, script.selectionEnd, 'end');
  scriptChanged();
  script.focus();
});
clear.addEventListener('click', () => {
  script.value = '';
  scriptChanged();
  script.focus();
});
language.addEventListener('change', () => {
  voiceChosen = false;
  invalidateOutput();
  updateVoices();
});
voice.addEventListener('input', () => { voiceChosen = true; });
for (const control of [voice, speed]) {
  control.addEventListener('input', () => {
    invalidateOutput();
    updateMode();
    updateControls();
  });
}
speech?.addEventListener('voiceschanged', () => {
  const selected = voice.value;
  updateVoices();
  if (voice.value !== selected) {
    invalidateOutput();
    updateControls();
  }
});

preview.addEventListener('click', async () => {
  if (playing) {
    stopPlayback();
    updateControls();
    return;
  }
  showStatus();
  if (usesDeviceVoice()) return playDeviceVoice();
  const url = await getAudio();
  if (!url || audioUrl !== url) return;
  playing = true;
  updateControls();
  try {
    await audio.play();
  } catch {
    if (audioUrl !== url || !playing) return;
    playing = false;
    showStatus('playbackError');
    updateControls();
  }
});
audio.addEventListener('ended', () => {
  playing = false;
  updateControls();
});
download.addEventListener('click', async () => {
  const url = await getAudio();
  if (!url || audioUrl !== url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = `voice-studio-${language.value}.mp3`;
  document.body.append(link);
  link.click();
  link.remove();
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener('appinstalled', () => { install.hidden = true; });
install.hidden = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
install.addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = undefined;
    try { await prompt.prompt(); return; }
    catch { /* Show platform instructions if the prompt fails. */ }
  }
  installDialog.showModal();
});

for (const button of interfaceButtons) {
  button.addEventListener('click', () => {
    if (uiLanguage === button.dataset.language) return;
    uiLanguage = button.dataset.language;
    try { localStorage.setItem('voice-studio-interface-language', uiLanguage); }
    catch { /* The new language still applies for this visit. */ }
    renderInterface();
  });
}

renderInterface();
refreshConfig();
window.addEventListener('online', refreshConfig);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
