const copy = {
  vi: {
    tools: 'Công cụ', heading: 'Tải MP3 / MP4',
    intro: 'Dán liên kết công khai để lưu âm thanh hoặc video. Chỉ tải nội dung ní sở hữu hoặc được phép tải.',
    urlLabel: 'Liên kết video hoặc âm thanh', analyze: 'Kiểm tra link', format: 'Định dạng', quality: 'Chất lượng',
    start: 'Tạo file', cancel: 'Hủy', download: 'Tải file', progress: 'Tiến trình',
    waiting: 'Đang kiểm tra máy chủ tải file…',
    mediaUnavailable: 'Máy chủ tải file chưa sẵn sàng. Trên máy chạy backend, cài yt-dlp và FFmpeg rồi bật công cụ tải file.',
    analyzing: 'Đang kiểm tra liên kết…', starting: 'Đang gửi yêu cầu…', queued: 'Đang chờ xử lý…',
    downloading: 'Đang tải nguồn…', converting: 'Đang chuyển đổi…',
    done: 'File đã sẵn sàng và có thể tải trong 30 phút.', cancelled: 'Đã hủy tác vụ.',
    invalidUrl: 'Nhập một liên kết hợp lệ nha.', unsupportedUrl: 'Trang web này nằm ngoài danh sách nguồn được hỗ trợ.',
    unsupportedMedia: 'Chỉ hỗ trợ một video hoặc bản thu đã phát hành và có định dạng tương thích.',
    invalidDuration: 'Nguồn cần có thời lượng xác định và tối đa 60 phút.',
    invalidQuality: 'Chất lượng này không có ở nguồn. Ní chọn mức khác nha.',
    sourceUnavailable: 'Chưa lấy được nội dung. Thử một liên kết công khai khác mà ní được phép tải.',
    processingFailed: 'Chưa tạo được file. Thử chất lượng thấp hơn hoặc kiểm tra liên kết.',
    toolsUnavailable: 'Máy chủ cần yt-dlp, FFmpeg và FFprobe để xử lý file.',
    mediaTooLarge: 'Tác vụ vượt 300 MiB. Ní thử đoạn ngắn hơn hoặc giảm chất lượng.',
    mediaTimeout: 'Xử lý quá lâu. Ní thử nguồn ngắn hơn nha.',
    mediaBusy: 'Máy chủ đang bận. Ní thử lại sau một chút nha.',
    expiredMedia: 'Tác vụ đã hết hạn. Kiểm tra lại liên kết để tạo tác vụ mới.',
    invalidRequest: 'Yêu cầu chưa hợp lệ. Ní kiểm tra lại liên kết và chất lượng.',
    checkingAgain: 'Mất kết nối tạm thời. Đang kiểm tra lại tiến trình…'
  },
  en: {
    tools: 'Tools', heading: 'Download MP3 / MP4',
    intro: 'Paste a public link to save audio or video. Download content you own or have permission to download.',
    urlLabel: 'Video or audio link', analyze: 'Check link', format: 'Format', quality: 'Quality',
    start: 'Create file', cancel: 'Cancel', download: 'Download file', progress: 'Progress',
    waiting: 'Checking the download server…',
    mediaUnavailable: 'The download server is unavailable. The backend needs yt-dlp, FFmpeg and the download tool enabled.',
    analyzing: 'Checking the link…', starting: 'Submitting the request…', queued: 'Waiting in the queue…',
    downloading: 'Downloading the source…', converting: 'Converting the file…',
    done: 'Your file is ready to download for 30 minutes.', cancelled: 'The job was cancelled.',
    invalidUrl: 'Enter a valid link.', unsupportedUrl: 'This site is outside the list of supported sources.',
    unsupportedMedia: 'Use a single published video or audio track in a compatible format.',
    invalidDuration: 'The source needs a known duration of 60 minutes or less.',
    invalidQuality: 'The source does not have this quality. Select a different option.',
    sourceUnavailable: 'Could not retrieve this source. Try another public link you have permission to download.',
    processingFailed: 'Could not create the file. Try a lower quality or check the link.',
    toolsUnavailable: 'The server needs yt-dlp, FFmpeg and FFprobe.',
    mediaTooLarge: 'The job exceeded 300 MiB. Use a shorter source or lower quality.',
    mediaTimeout: 'The job took too long. Try a shorter source.',
    mediaBusy: 'The server is busy. Try again shortly.',
    expiredMedia: 'This job expired. Check the link again to start a new job.',
    invalidRequest: 'Check the link and quality and try again.',
    checkingAgain: 'Connection interrupted. Checking progress again…'
  }
};

const activeStates = new Set(['queued', 'downloading', 'converting']);

function durationLabel(duration) {
  const seconds = Math.round(duration);
  return [Math.floor(seconds / 60), String(seconds % 60).padStart(2, '0')].join(':');
}

async function requestMedia(action, data) {
  const response = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.code || 'mediaUnavailable');
  return result;
}

export function setupMedia(onOpen) {
  const voiceTool = document.querySelector('#voice-tool');
  const mediaTool = document.querySelector('#media-tool');
  const voiceView = document.querySelector('#voice-view');
  const mediaView = document.querySelector('#media-view');
  const form = document.querySelector('#media-form');
  const url = document.querySelector('#media-url');
  const analyze = document.querySelector('#media-analyze');
  const details = document.querySelector('#media-details');
  const title = document.querySelector('#media-title');
  const meta = document.querySelector('#media-meta');
  const format = document.querySelector('#media-format');
  const quality = document.querySelector('#media-quality');
  const start = document.querySelector('#media-start');
  const cancel = document.querySelector('#media-cancel');
  const download = document.querySelector('#media-download');
  const progress = document.querySelector('#media-progress');
  const status = document.querySelector('#media-status');
  let available;
  let locale = 'vi';
  let busy = false;
  let source;
  let job;
  let statusKey;
  let timer;
  let pollId = 0;
  let failures = 0;

  function render() {
    const t = copy[locale];
    const active = activeStates.has(job?.status);
    const locked = busy || active;
    details.hidden = !source;
    title.textContent = source?.title || '';
    meta.textContent = source ? [source.uploader, durationLabel(source.duration)].filter(Boolean).join(' · ') : '';
    url.disabled = locked;
    analyze.disabled = available !== true || locked || !url.value.trim();
    format.disabled = locked;
    quality.disabled = locked;
    start.disabled = available !== true || locked;
    cancel.hidden = !active;
    cancel.disabled = busy;
    progress.hidden = !active;
    progress.value = job?.progress || 0;
    const file = job?.file;
    download.hidden = !file;
    if (file) download.href = file;
    else download.removeAttribute('href');
    status.textContent = t[statusKey] || (available === true ? '' : t[available === false ? 'mediaUnavailable' : 'waiting']);
  }

  function showTool(showMedia) {
    voiceView.hidden = showMedia;
    mediaView.hidden = !showMedia;
    voiceTool.setAttribute('aria-pressed', String(!showMedia));
    mediaTool.setAttribute('aria-pressed', String(showMedia));
    if (showMedia && available !== true) onOpen();
  }

  function qualities() {
    const isAudio = format.value === 'mp3';
    const values = isAudio ? [128, 192, 256, 320] : source.resolutions;
    quality.replaceChildren(...values.map(value => new Option(isAudio ? `${value} kbps` : `${value}p`, String(value))));
    quality.value = String(isAudio ? 192 : values.at(-1));
  }

  function updateJob(result) {
    job = result;
    statusKey = result.status === 'error' ? result.error || 'processingFailed' : result.status;
    render();
  }

  function poll() {
    clearTimeout(timer);
    if (!activeStates.has(job?.status)) return;
    const id = ++pollId;
    timer = setTimeout(async () => {
      try {
        const result = await requestMedia('status', { id: job.id });
        if (id !== pollId) return;
        failures = 0;
        updateJob(result);
      } catch (error) {
        if (id !== pollId) return;
        if (error.message === 'expiredMedia' || ++failures >= 4) {
          updateJob({ status: 'error', error: error.message === 'expiredMedia' ? 'expiredMedia' : 'mediaUnavailable' });
        } else {
          statusKey = 'checkingAgain';
          render();
        }
      }
      poll();
    }, failures ? 3500 : 1800);
  }

  voiceTool.addEventListener('click', () => showTool(false));
  mediaTool.addEventListener('click', () => showTool(true));
  url.addEventListener('input', () => {
    source = job = statusKey = undefined;
    render();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (analyze.disabled) return;
    busy = true;
    source = job = undefined;
    statusKey = 'analyzing';
    render();
    try {
      source = await requestMedia('analyze', { url: url.value.trim() });
      const formats = [source.hasAudio ? new Option('MP3', 'mp3') : null,
        source.resolutions.length ? new Option('MP4', 'mp4') : null].filter(Boolean);
      format.replaceChildren(...formats);
      qualities();
      statusKey = undefined;
    } catch (error) {
      source = undefined;
      statusKey = Object.hasOwn(copy[locale], error.message) ? error.message : 'mediaUnavailable';
    } finally {
      busy = false;
      render();
    }
  });
  format.addEventListener('change', qualities);
  start.addEventListener('click', async () => {
    if (!source || start.disabled) return;
    busy = true;
    failures = 0;
    job = undefined;
    statusKey = 'starting';
    render();
    try {
      updateJob(await requestMedia('start', { id: source.id, format: format.value, quality: quality.value }));
      poll();
    } catch (error) {
      statusKey = Object.hasOwn(copy[locale], error.message) ? error.message : 'mediaUnavailable';
    } finally {
      busy = false;
      render();
    }
  });
  cancel.addEventListener('click', async () => {
    if (cancel.disabled) return;
    ++pollId;
    clearTimeout(timer);
    busy = true;
    render();
    try {
      updateJob(await requestMedia('cancel', { id: job.id }));
    } catch (error) {
      statusKey = Object.hasOwn(copy[locale], error.message) ? error.message : 'mediaUnavailable';
    } finally {
      busy = false;
      render();
      poll();
    }
  });

  return {
    setAvailable(value) { available = value; render(); },
    setLanguage(value) {
      locale = value;
      for (const element of mediaView.querySelectorAll('[data-media-copy]')) {
        element.textContent = copy[locale][element.dataset.mediaCopy];
      }
      progress.setAttribute('aria-label', copy[locale].progress);
      voiceTool.parentElement.setAttribute('aria-label', copy[locale].tools);
      render();
    }
  };
}
