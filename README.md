# Voice AI Free

Phiên bản **26.11.002**. PWA để tạo giọng đọc tiếng Việt hoặc tiếng Anh và tải MP3 / MP4 từ liên kết công khai. Giao diện hỗ trợ tiếng Việt và tiếng Anh.

Tác giả dự án **hoangtienthanh267**.

## Chạy thử

Cần Node.js 22.9 trở lên trong nhánh 22.x. Chạy `npm start` và mở <http://127.0.0.1:3000>. Có thể dùng `npm run dev` trong lúc sửa mã máy chủ.

App có thể nghe thử bằng giọng sẵn có trên thiết bị. Bản nháp được lưu trên trình duyệt. Giọng nghe thử và khả năng phát khi mất mạng phụ thuộc vào thiết bị.

## Giọng Việt chạy trên máy

Trên máy chạy Voice AI Free, cần Python 3.10 trở lên có pip và FFmpeg có `libmp3lame` trên PATH.

1. Chạy `npm run voice:setup` một lần để cài VieNeu-TTS vào `.venv`.
2. Khởi động lại bằng `npm start`. Lần đầu máy tải mô hình VieNeu-TTS v3 Nano và lưu vào `.voice-cache`. Mô hình tải khoảng 282 MB theo tài liệu VieNeu.
3. Chọn **Tiếng Việt**, rồi chọn giọng có nhãn **Giọng chạy trên máy**. Dùng **Nghe thử** hoặc **Tải MP3**.

VieNeu ưu tiên dùng CPU. Có thể đặt `VIENEU_MODE=v3turbo` trong `.env` để dùng bản ONNX chất lượng cao hơn, đổi lại cần tải thêm mô hình nặng hơn. Kịch bản xử lý trên máy chủ của app. Không cần API key và không có quota theo tháng. Mỗi lượt vẫn nhận tối đa 3.000 ký tự và máy xử lý một lượt tại một thời điểm.

Tài liệu và giấy phép preset: [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) · [VieNeu v3 Nano](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Nano).

### Giọng của tôi

Mở app tại `http://127.0.0.1:3000` với VieNeu v3 Nano, chọn **Tiếng Việt → Giọng của tôi**, rồi thu hoặc tải mẫu giọng của bạn. Mẫu cần ít nhất 3 giây, app lấy tối đa 8 giây đầu. Bấm **Dùng giọng này**, nhập kịch bản và dùng **Nghe thử** hoặc **Tải MP3**.

Lần đầu có thể cần tải thêm bộ mã hóa giọng từ Hugging Face. Mẫu âm thanh được xử lý trong bộ nhớ của máy chạy app. **Lưu hồ sơ** giữ đặc trưng giọng trong trình duyệt để dùng lại. **Xóa hồ sơ** xóa dữ liệu đã lưu trong trình duyệt đó. Tạo giọng cá nhân chỉ bật trên localhost ở bản này. Bản Vercel tiếp tục dùng các giọng dựng sẵn.

## Bật thêm giọng Azure

1. Tạo Speech resource trên Azure.
2. Sao chép `.env.example` thành `.env`.
3. Điền `AZURE_SPEECH_KEY` và `AZURE_SPEECH_REGION` của Speech resource, rồi khởi động lại máy chủ. Khóa được đọc ở máy chủ và `.env` được bỏ qua trong Git.
4. Chọn giọng đọc, nhập kịch bản rồi bấm **Nghe thử** hoặc **Tải MP3**. Khi dùng các nút này ở chế độ Azure, kịch bản được gửi tới Azure Speech.

## Cài lên điện thoại

Phục vụ app qua một địa chỉ HTTPS mà điện thoại truy cập được. Máy chạy VieNeu phải bật và điện thoại phải kết nối được tới máy chủ của app để tạo giọng. Nếu chạy sau reverse proxy, đặt `HOST` và `PORT` phù hợp.

- Android Chrome → Menu ⋮ → Cài đặt ứng dụng.
- iPhone Safari → Chia sẻ → Thêm vào màn hình chính → Mở dưới dạng ứng dụng web nếu có.

Bản này dành cho chạy thử cá nhân. Nếu mở API ra Internet, cấu hình xác thực hoặc giới hạn sử dụng tại lớp hosting để kiểm soát tải máy chủ và quota Azure nếu có.

## Đưa lên Vercel

`vercel.json` phục vụ PWA từ `public/`, bật **Fluid compute** và triển khai các Node.js Functions `/api/config`, `/api/speech` và `/api/media`. Nhập thư mục gốc vào Vercel với preset **Other** và Node.js **22.x**. Có thể triển khai Preview bằng `npx vercel` sau khi đăng nhập. Khi kiểm tra xong, đưa lên Production bằng `npx vercel --prod`.

Mặc định bản Vercel nghe thử bằng giọng thiết bị. Làm theo [hướng dẫn đặt backend trên Windows Server](#đặt-backend-trên-windows-server) để bật giọng VieNeu và tải MP3 / MP4.

Vercel chuyển yêu cầu sang máy chạy VieNeu. Máy đó phải hoạt động khi dùng giọng AI. MP3 tạo từ văn bản qua `/api/speech` tối đa 4 MB mỗi lần. Nếu cần phát hành rộng, bảo vệ bản Preview hoặc giới hạn tần suất truy cập `/api/speech` tại lớp hosting trước khi bật máy chủ tạo giọng.

## Đặt backend trên Windows Server

### 1. Cài công cụ và chuẩn bị mã nguồn

Trên Windows Server, cài Node.js 22.x từ 22.9 trở lên, Python 64-bit có pip (máy dev đã thử với Python 3.13) và bản FFmpeg có cả `ffmpeg.exe`, `ffprobe.exe`, `libmp3lame` và `libx264`. Thêm thư mục chứa các công cụ vào `PATH` của tài khoản sẽ chạy backend. Mở lại PowerShell rồi kiểm tra. [Node.js](https://nodejs.org/en/download) · [Python cho Windows](https://www.python.org/downloads/windows/) · [FFmpeg cho Windows](https://ffmpeg.org/download.html#build-windows)

```powershell
node --version
npm.cmd --version
python -m pip --version
ffmpeg -hide_banner -encoders | Select-String 'libmp3lame|libx264'
ffprobe -version
```

Chép và giải nén gói bản phát hành vào `D:\VoiceAIBackend`, sao cho `package.json` và `server.mjs` nằm ngay trong thư mục này. Giữ lại `.env` nếu thư mục đã có cấu hình. Cài hai môi trường Python ngay trên server để chúng dùng đúng bản Python của máy này.

```powershell
Set-Location 'D:\VoiceAIBackend'
npm.cmd run voice:setup
npm.cmd run media:setup
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
```

### 2. Cấu hình và thử trên server

Tạo khóa bằng `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Mở `.env`, cập nhật các dòng sau và thay `KHOA_VUA_TAO` bằng khóa vừa tạo. Giữ khóa trong `.env` của server và cài đặt Vercel.

```dotenv
HOST=127.0.0.1
PORT=3000
VIENEU_MODE=v3nano
MEDIA_DOWNLOADS_ENABLED=true
VOICE_BACKEND_TOKEN=KHOA_VUA_TAO
```

Chạy `npm.cmd start` và để cửa sổ này mở. Lần đầu VieNeu tải mô hình về máy. Mở PowerShell thứ hai trong `D:\VoiceAIBackend` và kiểm tra API. Lệnh đọc khóa từ `.env` và chỉ in trạng thái.

```powershell
node --env-file=.env -e "fetch('http://127.0.0.1:3000/api/config',{headers:{Authorization:'Bearer '+process.env.VOICE_BACKEND_TOKEN}}).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);const c=await r.json();console.log({localState:c.localState,mediaDownloads:c.mediaDownloads})}).catch(e=>{console.error(e.message);process.exitCode=1})"
```

Khi đã sẵn sàng, kết quả là `localState: 'ready'` và `mediaDownloads: true`. `loading` nghĩa là VieNeu đang khởi tạo. Nếu mục tải file trả `false`, kiểm tra `MEDIA_DOWNLOADS_ENABLED`, FFmpeg, FFprobe và `npm.cmd run media:setup`.

### 3. Tạo địa chỉ HTTPS và nối với Vercel

Nếu tên miền đã quản lý bằng Cloudflare, tạo một **Cloudflare Tunnel** trong **Networking → Tunnels**. Chọn Windows và chạy lệnh cài connector dưới dạng dịch vụ mà dashboard cung cấp ngay trên server. Thêm **Published application** với hostname, ví dụ `voice-backend.example.com`, loại `HTTP` và địa chỉ `127.0.0.1:3000`. Có thể dùng reverse proxy HTTPS sẵn có trên cùng máy thay cho tunnel. Máy chỉ cần xuất bản endpoint HTTPS của app. SQL Server và RDP tiếp tục dùng cấu hình hiện có. [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/)

Trong dự án Voice AI Free trên Vercel, mở **Settings → Environment Variables**, chọn môi trường **Production**, thêm hai biến sau rồi **Redeploy** bản `v26.11.002`. [Biến môi trường Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables)

| Biến | Giá trị |
| --- | --- |
| `VOICE_BACKEND_URL` | Origin HTTPS của backend, ví dụ `https://voice-backend.example.com` |
| `VOICE_BACKEND_TOKEN` | Cùng khóa đang dùng trong `.env` trên server |

Mở [API kiểm tra trên Vercel](https://voice-ai-free.vercel.app/api/config). Khi thấy `localState: "ready"` và `mediaDownloads: true`, thử tạo một đoạn giọng Việt và tải một file từ tab **Tải MP3 / MP4**. Có thể thử từ điện thoại dùng 4G/5G để xác nhận truy cập được từ ngoài mạng.

### 4. Tự chạy khi Windows Server khởi động

Trong **Task Scheduler → Create Task**, dùng tài khoản Windows có quyền chạy công cụ và đọc, ghi trong `D:\VoiceAIBackend`. Chọn **Run whether user is logged on or not**. Thêm trigger **At startup** và action **Start a program**. Lấy đường dẫn thật của Node bằng `(Get-Command node).Source` rồi điền các giá trị sau. [Microsoft Task Scheduler](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtaskaction)

| Trường | Giá trị mẫu |
| --- | --- |
| Program/script | `C:\Program Files\nodejs\node.exe` |
| Add arguments | `--env-file=.env server.mjs` |
| Start in | `D:\VoiceAIBackend` |

Trong **Settings**, bỏ giới hạn **Stop the task if it runs longer than** để tiến trình có thể chạy liên tục. Dừng phiên `npm.cmd start` thử bằng `Ctrl+C`, chạy task một lần và kiểm tra lại `/api/config`. Khi backend và tunnel chạy nền trên Windows Server, máy cá nhân có thể tắt. Backend xử lý trên Windows Server và chưa cần cơ sở dữ liệu SQL.

## Tải MP3 / MP4 từ liên kết

Mở tab **Tải MP3 / MP4**, dán một liên kết công khai rồi bấm **Kiểm tra link**. Chọn MP3 (128–320 kbps) hoặc MP4 (tối đa 1080p tùy nguồn), bấm **Tạo file** và tải khi tiến trình hoàn tất. Công cụ xử lý từng video hoặc bản thu có thời lượng tối đa 60 phút. File hoàn tất giữ 30 phút. Giới hạn tổng dung lượng làm việc của một tác vụ là khoảng 300 MiB.

Trên máy chạy backend, cài Python có pip, FFmpeg có `libmp3lame` và `libx264`, cùng FFprobe trên PATH. Chạy `npm run media:setup` để cài yt-dlp vào `.media-venv`, rồi khởi động lại app. Khi có `.env`, đặt `MEDIA_DOWNLOADS_ENABLED=true` để bật tính năng. Trên localhost, app có thể dùng công cụ sau khi cài, nếu biến này không được đặt thành `false`.

Bản Vercel dùng cùng `VOICE_BACKEND_URL` và `VOICE_BACKEND_TOKEN` như phần tạo giọng. Máy chủ cần đặt `MEDIA_DOWNLOADS_ENABLED=true` và nhận được yêu cầu HTTPS. Vercel gửi lệnh và trạng thái qua API, còn link tải hết hạn sẽ tải file trực tiếp từ máy chủ để tránh giới hạn phản hồi của Vercel.

Nguồn nhận liên kết gồm YouTube, Facebook, Instagram, TikTok, SoundCloud, Vimeo, Dailymotion và X. Khả năng tải phụ thuộc nguồn, định dạng và chính sách truy cập của nền tảng. Chỉ tải nội dung bạn sở hữu hoặc được phép tải. Một tác vụ tải và chuyển đổi chạy tại một thời điểm để giảm tải máy chủ.

## Thành phần và giấy phép

- **VieNeu-TTS** là thành phần cài riêng trên máy tạo giọng. SDK và mô hình Nano dùng Apache 2.0. Theo tài liệu Nano, audio tạo từ các giọng dựng sẵn được phép dùng thương mại. Khi đóng gói lại SDK hoặc mô hình để phân phối, giữ bản giấy phép và các thông báo bản quyền theo điều khoản Apache 2.0. [SDK](https://pypi.org/project/vieneu/3.8.5/) · [Mô hình Nano](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Nano) · [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.html)
- **FFmpeg** là chương trình cài riêng, dùng để mã hóa MP3. Giấy phép tùy bản build. [Giấy phép FFmpeg](https://ffmpeg.org/legal.html)
- **yt-dlp** là công cụ cài riêng trong môi trường Python của trình tải MP3 / MP4. [Mã nguồn yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **Giọng thiết bị** do trình duyệt cung cấp để nghe thử. **Azure Speech** là dịch vụ tùy chọn theo điều khoản Microsoft. Gói mã nguồn chứa phần tích hợp và các icon từ logo người dùng cung cấp. SDK Python, trọng số mô hình và FFmpeg được cài riêng.
