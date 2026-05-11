# CPM - College Project Management System

CPM là hệ thống quản lý công việc và dự án cho nhóm sinh viên hoặc các dự án nhỏ. Ứng dụng hỗ trợ quản lý project, task, thành viên, kỹ năng, deadline, file đính kèm, dashboard thống kê, chatbot agent và gợi ý phân công bằng AI kết hợp thuật toán Min-Cost Max-Flow.

Source GitHub: <https://github.com/tin12q/cpm>

## Chức năng chính

- Quản lý đăng nhập, người dùng, team và phân quyền theo role.
- Quản lý project, task, deadline, trạng thái, priority, difficulty và kỹ năng yêu cầu.
- Dashboard thống kê tiến độ, task trễ hạn, workload nhân sự và biểu đồ theo project.
- Project overview cho admin/manager với chart trạng thái, workload và deadline pressure.
- Tạo/sửa task, upload nhiều file đính kèm, preview ảnh/PDF và tải file.
- Chatbot agent có thể hỏi dữ liệu hệ thống, báo cáo project/cá nhân, thống kê nhân sự và hỗ trợ thao tác quản lý.
- Gợi ý phân công task bằng AI scoring và thuật toán MCMF, có preview trước khi apply.
- Dữ liệu demo đa dạng để test: project hoàn thành, project trễ hạn, project sát deadline, task chưa gán, task completed và task đang làm.

## Công nghệ sử dụng

### Mobile app

- Flutter / Dart
- HTTP client
- Provider
- FL Chart
- File Picker
- Image Picker
- Flutter PDFView

### Backend

- Node.js
- Express.js
- MongoDB / Mongoose
- JWT authentication
- Multer
- Google Gemini hoặc OpenAI-compatible LLM API
- Min-Cost Max-Flow cho bài toán phân công task

### Web admin

- React
- Vite
- Material UI
- Tailwind CSS
- Chart.js
- Axios

## Cấu trúc thư mục

```text
cpm/
├── client/                         # Web admin React/Vite
├── qlcv/                           # Mobile app Flutter
├── server/                         # Backend Express + MongoDB
├── exampleDB/assignment_test_100/   # File JSON dữ liệu demo
├── scripts/                        # Script import/reset database local
├── generate-assignment-test-data.js # Sinh lại dữ liệu demo
└── README.md
```

## Yêu cầu môi trường

- Node.js 18 trở lên
- npm
- MongoDB local
- Flutter SDK
- Android Studio hoặc thiết bị Android bật USB debugging
- Git

## Cài đặt backend

Di chuyển vào thư mục server:

```powershell
cd server
npm install
```

Tạo file `server/.env` hoặc chỉnh file đang có:

```env
PORT=1337
MONGODB_URI=mongodb://localhost:27017/cpm
JWT_SECRET=secret

# Chọn một trong hai nhóm LLM bên dưới nếu muốn dùng chatbot AI.
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite

# Hoặc dùng OpenAI-compatible API.
OPENAI_COMPATIBLE_API_KEY=your_api_key
OPENAI_COMPATIBLE_BASE_URL=https://your-llm-provider/v1
OPENAI_COMPATIBLE_CHAT_MODEL=your_chat_model
```

Chạy backend:

```powershell
npm start
```

Backend mặc định chạy tại:

```text
http://localhost:1337
```

Nếu gặp lỗi `EADDRINUSE: address already in use :::1337`, nghĩa là port 1337 đang bị chiếm. Có thể tắt process đang dùng port đó hoặc đổi `PORT` trong `server/.env`.

## Cài đặt database demo

MongoDB local mặc định dùng database `cpm`.

Từ thư mục gốc project, chạy:

```powershell
node .\scripts\reset-local-db-demo.js
```

Lệnh này sẽ xóa database `cpm` local rồi nạp lại dữ liệu demo.

Nếu MongoDB dùng URI khác:

```powershell
node .\scripts\reset-local-db-demo.js --uri "mongodb://localhost:27017/cpm"
```

Dữ liệu JSON nằm tại:

```text
exampleDB/assignment_test_100/
```

Bộ dữ liệu hiện có:

- 33 users
- 33 auth accounts
- 4 teams
- 12 projects
- 100 tasks
- 57 skills
- 1 stage template
- 1 contact

## Tài khoản test

Tất cả tài khoản demo dùng password `123`.

| Vai trò | Username | Password |
|---|---|---|
| Admin | `janesmith` | `123` |
| Manager Web | `maitran` | `123` |
| Manager Backend | `quangnguyen` | `123` |
| Manager Mobile | `trangle` | `123` |
| Manager AI/QA | `minhdang` | `123` |
| Employee Web | `annguyen` | `123` |
| Employee Backend | `namtran` | `123` |
| Employee Mobile | `anhvo` | `123` |
| Employee AI | `nhile` | `123` |

## Cài đặt mobile app

Di chuyển vào thư mục Flutter:

```powershell
cd qlcv
flutter pub get
```

Kiểm tra file cấu hình API:

```text
qlcv/lib/config/api_config.dart
```

Nếu chạy bằng điện thoại Android thật qua USB, `baseUrl` phải là IPv4 của máy đang chạy backend, ví dụ:

```dart
static const String baseUrl = 'http://192.168.100.152:1337';
```

Lấy IPv4 trên Windows:

```powershell
ipconfig
```

Nếu chạy Android Emulator, có thể dùng:

```dart
static const String baseUrl = 'http://10.0.2.2:1337';
```

Chạy app:

```powershell
flutter run
```

Build APK debug:

```powershell
flutter build apk --debug
```

## Cài đặt web admin

Web admin là phần phụ trợ để quản lý bằng trình duyệt.

```powershell
cd client
npm install
npm run dev
```

API mặc định trỏ về:

```text
http://localhost:1337
```

Nếu cần đổi backend URL, chỉnh `client/.env` hoặc biến môi trường Vite/React tương ứng.

## API chính

Backend gắn prefix `/api`.

| Nhóm API | Đường dẫn |
|---|---|
| Auth | `/api/auth` |
| Users | `/api/users` |
| Teams | `/api/teams` |
| Projects | `/api/projects` |
| Tasks | `/api/tasks` |
| Files | `/api/file` |
| Skills | `/api/skills` |
| Stage templates | `/api/stage-templates` |
| Contacts | `/api/contacts` |
| Assignment AI/MCMF | `/api/assignments` |
| Chatbot | `/api/chatbot/message` |

## Kiểm thử nhanh

1. Start MongoDB local.
2. Reset dữ liệu demo:

```powershell
node .\scripts\reset-local-db-demo.js
```

3. Start backend:

```powershell
cd server
npm start
```

4. Start mobile app:

```powershell
cd qlcv
flutter run
```

5. Đăng nhập bằng `janesmith / 123`.
6. Kiểm tra Dashboard, Project Overview, tạo task, upload file, hỏi chatbot và chạy Auto Assignment.

## Kịch bản chatbot nên test

- `Dự án nào bị trễ hạn nhất?`
- `Task nào bị trễ hạn nặng nhất?`
- `Báo cáo cho tôi dự án Module gợi ý phân công thông minh`
- `Báo cáo tổng quan từ hôm nay đến 1 tuần`
- `Thống kê nhân sự trong project Ứng dụng mobile theo dõi tiến độ nhóm`
- `Báo cáo cá nhân An Nguyễn trong tuần này`
- `Đề xuất 3 người phù hợp cho task chưa gán trong project Module gợi ý phân công thông minh`
- `Dự án nào đang tồn nhiều task nhất?`

## Kịch bản app nên test

- Admin `janesmith`: xem dashboard tổng quan, quản lý user, xem mọi project.
- Manager `trangle`: xem project mobile, tạo/sửa task, upload file, xem project overview.
- Manager `minhdang`: test chatbot, báo cáo project và gợi ý phân công AI/MCMF.
- Employee `annguyen`: kiểm tra luồng xem task cá nhân và giới hạn quyền chỉnh sửa.

## Ghi chú khi debug bằng USB

- Máy tính và điện thoại nên cùng mạng Wi-Fi.
- Backend phải lắng nghe tại IP máy tính, không dùng `localhost` trên điện thoại thật.
- Nếu đổi mạng, IPv4 có thể đổi, cần cập nhật lại `ApiConfig.baseUrl`.
- Nếu app gọi API không được, kiểm tra firewall Windows và port `1337`.

## File cần nộp theo yêu cầu đồ án

- Báo cáo Word: `BC_DACN3_NPT_VPT.docx` hoặc `final.docx`.
- Link GitHub source: <https://github.com/tin12q/cpm>
- File CSDL: `exampleDB/assignment_test_100/*.json`
- File hướng dẫn cài đặt: `README.md`
- Tài khoản test: xem mục "Tài khoản test".

## Ghi chú bảo mật

Không commit API key thật lên GitHub. Các khóa như `GEMINI_API_KEY`, `OPENAI_COMPATIBLE_API_KEY`, `CLAUDE_SONNET_4_6_API_KEY` hoặc `JWT_SECRET` nên để trong file `.env` local và thay bằng placeholder trong tài liệu.
