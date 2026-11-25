# Voice AI Free

Phiên bản **26.11.001**. PWA tiếng Việt để nghe và xuất giọng đọc từ kịch bản tiếng Việt hoặc tiếng Anh.

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

`vercel.json` phục vụ PWA từ `public/`, bật **Fluid compute** và triển khai hai Node.js Functions cho `/api/config` và `/api/speech`. Nhập thư mục gốc vào Vercel với preset **Other** và Node.js **22.x**. Có thể triển khai Preview bằng `npx vercel` sau khi đăng nhập. Khi kiểm tra xong, đưa lên Production bằng `npx vercel --prod`.

Mặc định bản Vercel nghe thử bằng giọng thiết bị. Để bật giọng VieNeu và xuất MP3 trên bản Vercel:

1. Trên máy chạy VieNeu, cài bộ tạo giọng và đặt `VOICE_BACKEND_TOKEN` trong `.env`. Dùng một khóa ngẫu nhiên riêng, có thể tạo bằng `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Khởi động lại bằng `npm start`. Khi đã đặt khóa, API trên máy này cần xác thực bằng khóa đó.
2. Cấp một địa chỉ HTTPS cho máy chủ qua reverse proxy hoặc tunnel có sẵn. Nếu proxy chạy trên cùng máy, để Node tiếp tục lắng nghe ở loopback `127.0.0.1`.
3. Trong **Project → Settings → Environment Variables** ở Vercel, đặt `VOICE_BACKEND_URL` thành origin HTTPS của máy chủ, ví dụ `https://voice-backend.example.com`. Đặt `VOICE_BACKEND_TOKEN` bằng khóa ở bước 1. Áp dụng cho môi trường Preview hoặc Production cần dùng, rồi deploy lại.
4. Kiểm tra `/api/config` trên URL Vercel thấy `localState: "ready"`. Mở PWA, chọn một giọng VieNeu, nghe thử và tải MP3. Nếu muốn dùng Azure, đặt thông tin Azure trên máy chủ tạo giọng.

Vercel chuyển yêu cầu sang máy chạy VieNeu. Máy đó phải hoạt động khi dùng giọng AI. Bản Vercel nhận MP3 tối đa 4 MB mỗi lần. Nếu cần phát hành rộng, bảo vệ bản Preview hoặc giới hạn tần suất truy cập `/api/speech` tại lớp hosting trước khi bật máy chủ tạo giọng.

## Thành phần và giấy phép

- **VieNeu-TTS** là thành phần cài riêng trên máy tạo giọng. SDK và mô hình Nano dùng Apache 2.0. Theo tài liệu Nano, audio tạo từ các giọng dựng sẵn được phép dùng thương mại. Khi đóng gói lại SDK hoặc mô hình để phân phối, giữ bản giấy phép và các thông báo bản quyền theo điều khoản Apache 2.0. [SDK](https://pypi.org/project/vieneu/3.8.5/) · [Mô hình Nano](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Nano) · [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.html)
- **FFmpeg** là chương trình cài riêng, dùng để mã hóa MP3. Giấy phép tùy bản build. [Giấy phép FFmpeg](https://ffmpeg.org/legal.html)
- **Giọng thiết bị** do trình duyệt cung cấp để nghe thử. **Azure Speech** là dịch vụ tùy chọn theo điều khoản Microsoft. Gói mã nguồn chứa phần tích hợp và các icon từ logo người dùng cung cấp. SDK Python, trọng số mô hình và FFmpeg được cài riêng.
