const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "exampleDB", "assignment_test_100");
const JANE_SMITH_PASSWORD_HASH =
  "$2a$10$VnATbpYf1j5GFSzDLoOayO6KpCUZZO.DUyaX7Hzr.KAD45naiyZmK";

const oid = (n) => ({ $oid: `68a100000000000000${String(n).padStart(6, "0")}` });
const long = (value) => ({ $numberLong: String(value) });
const dateMs = (date, hour = 17) => new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+07:00`).getTime();
const addDays = (days, hour = 17) => {
  const base = new Date("2026-05-11T09:00:00+07:00");
  base.setDate(base.getDate() + days);
  base.setHours(hour, 0, 0, 0);
  return base.getTime();
};

const stages = [
  { key: "backlog", name: "Cần làm", color: "amber", order: 0 },
  { key: "in-progress", name: "Đang làm", color: "blue", order: 1 },
  { key: "review", name: "Đang kiểm tra", color: "violet", order: 2 },
  { key: "done", name: "Hoàn thành", color: "green", order: 3 },
];

const skillCatalog = {
  frontend: ["React", "JavaScript", "UI/UX", "Tailwind CSS", "Figma", "Responsive Design"],
  backend: ["Node.js", "Express", "MongoDB", "REST API", "Authentication", "File Upload"],
  mobile: ["Flutter", "Dart", "Mobile UI", "State Management", "API Integration", "PDF Preview"],
  ai: ["Python", "NLP", "Embedding", "TF-IDF", "Min-Cost Max-Flow", "Prompt Engineering"],
  qa: ["Testing", "Regression", "Postman", "Bug Report", "Documentation", "Smoke Test"],
  devops: ["Docker", "CI/CD", "Deployment", "Monitoring", "Linux", "Environment Config"],
  data: ["Data Modeling", "MongoDB", "Data Cleaning", "Analytics", "Reporting", "Dashboard"],
};

const teamDefs = [
  {
    id: 101,
    name: "Nhóm 01 - Web và Dashboard",
    manager: ["Mai Trần", "maitran", "manager", ["React", "UI/UX", "Figma", "Dashboard"]],
    members: [
      ["An Nguyễn", "annguyen", ["React", "JavaScript", "Tailwind CSS", "UI/UX"]],
      ["Bảo Phạm", "baopham", ["React", "Figma", "Accessibility", "Testing"]],
      ["Chi Lê", "chile", ["JavaScript", "Dashboard", "Analytics", "API Integration"]],
      ["Đức Hoàng", "duchoang", ["React", "State Management", "Responsive Design"]],
      ["Hạnh Võ", "hanhvo", ["Figma", "UI/UX", "Documentation", "Testing"]],
      ["Khoa Bùi", "khoabui", ["React", "Calendar UI", "JavaScript", "Bug Fixing"]],
      ["Linh Đỗ", "linhdo", ["Tailwind CSS", "Forms", "API Integration", "Accessibility"]],
    ],
  },
  {
    id: 102,
    name: "Nhóm 02 - Backend API",
    manager: ["Quang Nguyễn", "quangnguyen", "manager", ["Node.js", "MongoDB", "REST API", "Authentication"]],
    members: [
      ["Nam Trần", "namtran", ["Node.js", "Express", "REST API", "MongoDB"]],
      ["Oanh Phạm", "oanhpham", ["Authentication", "JWT", "Node.js", "Security"]],
      ["Phúc Lê", "phucle", ["MongoDB", "Data Modeling", "Aggregation", "Reporting"]],
      ["Thảo Vũ", "thaovu", ["Express", "Validation", "Error Handling", "Postman"]],
      ["Việt Đặng", "vietdang", ["Node.js", "File Upload", "MinIO", "Docker"]],
      ["Yến Hồ", "yenho", ["REST API", "Testing", "Documentation", "Bug Fixing"]],
      ["Sơn Bùi", "sonbui", ["MongoDB", "Performance", "Indexing", "Analytics"]],
    ],
  },
  {
    id: 103,
    name: "Nhóm 03 - Ứng dụng Mobile",
    manager: ["Trang Lê", "trangle", "manager", ["Flutter", "Dart", "Mobile UI", "API Integration"]],
    members: [
      ["Anh Võ", "anhvo", ["Flutter", "Dart", "Mobile UI", "State Management"]],
      ["Bình Ngô", "binhngo", ["Flutter", "API Integration", "Authentication", "Forms"]],
      ["Cường Lý", "cuongly", ["Dart", "Charts", "Calendar UI", "Testing"]],
      ["Diệp Trần", "dieptran", ["Flutter", "Offline Cache", "State Management", "Bug Fixing"]],
      ["Giang Phạm", "giangpham", ["Mobile UI", "Accessibility", "Responsive Design", "Figma"]],
      ["Hải Nguyễn", "hainguyen", ["Flutter", "File Upload", "Image Picker", "API Integration"]],
      ["Lan Phạm", "lanpham", ["Dart", "Regression", "Documentation", "Testing"]],
    ],
  },
  {
    id: 104,
    name: "Nhóm 04 - AI và Kiểm thử",
    manager: ["Minh Đặng", "minhdang", "manager", ["Python", "Embedding", "Min-Cost Max-Flow", "Testing"]],
    members: [
      ["Nhi Lê", "nhile", ["Python", "NLP", "Embedding", "TF-IDF"]],
      ["Phong Trần", "phongtran", ["Min-Cost Max-Flow", "Algorithms", "Data Modeling", "Node.js"]],
      ["Quyên Hồ", "quyenho", ["Testing", "Postman", "Regression", "Bug Report"]],
      ["Tuấn Bùi", "tuanbui", ["Docker", "Deployment", "Monitoring", "Linux"]],
      ["Uyên Võ", "uyenvo", ["Data Cleaning", "Analytics", "Reporting", "MongoDB"]],
      ["Vy Nguyễn", "vynguyen", ["Python", "Gemini API", "Embedding", "Documentation"]],
      ["Long Phạm", "longpham", ["CI/CD", "Docker", "Testing", "Automation"]],
    ],
  },
];

const projectDefs = [
  {
    id: 201,
    title: "Hệ thống quản lý đồ án môn học",
    description: "Web dashboard cho sinh viên lập kế hoạch, chia việc, theo dõi deadline và báo cáo tiến độ.",
    due: "2026-05-05",
    status: "late",
    teamIds: [101, 102],
    domains: ["frontend", "backend", "qa", "data"],
    profile: "late",
    customer: ["Bộ môn Công nghệ phần mềm", "CPM-COURSE"],
    lateWeight: 5,
  },
  {
    id: 202,
    title: "Ứng dụng mobile theo dõi tiến độ nhóm",
    description: "Ứng dụng Flutter cho manager và thành viên xem task, nộp file, báo cáo tiến độ và nhận thông báo deadline.",
    due: "2026-06-20",
    status: "in progress",
    teamIds: [103, 102],
    domains: ["mobile", "backend", "qa"],
    profile: "active",
    customer: ["Nhóm sinh viên dùng thử", "CPM-MOBILE"],
    lateWeight: 3,
  },
  {
    id: 203,
    title: "Module gợi ý phân công thông minh",
    description: "Module AI kết hợp embedding, TF-IDF và Min-Cost Max-Flow để đề xuất người làm phù hợp.",
    due: "2026-06-25",
    status: "in progress",
    teamIds: [104, 102],
    domains: ["ai", "backend", "data"],
    profile: "risk",
    customer: ["Hội đồng chấm đồ án", "CPM-AI"],
    lateWeight: 6,
  },
  {
    id: 204,
    title: "Cổng thông tin làm việc nhóm sinh viên",
    description: "Không gian cộng tác gồm ghi chú, bình luận, lịch họp, file đính kèm và lịch sử bàn giao.",
    due: "2026-07-01",
    status: "in progress",
    teamIds: [101, 103],
    domains: ["frontend", "mobile", "qa"],
    profile: "planning",
    customer: ["Câu lạc bộ học thuật", "CPM-PORTAL"],
    lateWeight: 2,
  },
  {
    id: 205,
    title: "Kiểm thử và triển khai hệ thống quản lý",
    description: "Chuẩn bị dữ liệu mẫu, checklist kiểm thử, hướng dẫn cài đặt và môi trường demo cho hội đồng.",
    due: "2026-05-08",
    status: "completed",
    teamIds: [104, 101, 102],
    domains: ["qa", "devops", "data"],
    profile: "completed",
    customer: ["Nhóm bảo vệ đồ án", "CPM-RELEASE"],
    lateWeight: 0,
  },
  {
    id: 206,
    title: "Báo cáo tự động cho từng dự án",
    description: "Tổng hợp tiến độ theo khoảng thời gian, phát hiện task trễ, thống kê nhân sự và xuất nội dung cho báo cáo.",
    due: "2026-05-18",
    status: "in progress",
    teamIds: [104, 102],
    domains: ["ai", "data", "backend"],
    profile: "deadline",
    customer: ["Ban quản lý lớp học phần", "CPM-REPORT"],
    lateWeight: 4,
  },
  {
    id: 207,
    title: "Quản lý người dùng và phân quyền",
    description: "Cho admin quản lý tài khoản, role, team, kỹ năng và quyền chỉnh sửa task/project.",
    due: "2026-05-30",
    status: "in progress",
    teamIds: [101, 102],
    domains: ["frontend", "backend", "qa"],
    profile: "review",
    customer: ["Admin hệ thống demo", "CPM-ADMIN"],
    lateWeight: 2,
  },
  {
    id: 208,
    title: "Kho học liệu và file đính kèm task",
    description: "Cho phép upload, preview và tải xuống tài liệu, hình ảnh, PDF trong từng task.",
    due: "2026-06-10",
    status: "in progress",
    teamIds: [103, 102],
    domains: ["mobile", "backend", "data"],
    profile: "active",
    customer: ["Nhóm nộp minh chứng", "CPM-FILES"],
    lateWeight: 3,
  },
  {
    id: 209,
    title: "Onboarding thành viên mới vào nhóm đồ án",
    description: "Chuẩn bị tài khoản, phân quyền, tài liệu hướng dẫn và checklist để sinh viên mới tham gia nhóm nhanh hơn.",
    due: "2026-05-01",
    status: "completed",
    teamIds: [101, 104],
    domains: ["qa", "frontend", "data"],
    profile: "completed",
    customer: ["Lớp trưởng nhóm đồ án", "CPM-ONBOARD"],
    lateWeight: 0,
  },
  {
    id: 210,
    title: "Hệ thống nhắc deadline và cảnh báo rủi ro",
    description: "Phát hiện task sát hạn, task trễ, người đang quá tải và gửi gợi ý hành động cho manager.",
    due: "2026-05-16",
    status: "in progress",
    teamIds: [104, 103, 102],
    domains: ["ai", "mobile", "backend"],
    profile: "deadline",
    customer: ["Manager nhóm sinh viên", "CPM-RISK"],
    lateWeight: 5,
  },
  {
    id: 211,
    title: "Không gian demo cho hội đồng nghiệm thu",
    description: "Chuẩn bị dữ liệu trình diễn, kịch bản hỏi chatbot, project mẫu và ảnh minh chứng trước buổi báo cáo.",
    due: "2026-05-12",
    status: "in progress",
    teamIds: [101, 104, 102],
    domains: ["qa", "devops", "frontend", "data"],
    profile: "review",
    customer: ["Hội đồng nghiệm thu", "CPM-DEMO"],
    lateWeight: 3,
  },
  {
    id: 212,
    title: "Nghiên cứu mở rộng tích hợp LLM",
    description: "Thử nghiệm OpenAI-compatible API, Claude/Gemini fallback, prompt routing và cơ chế agent trả lời theo dữ liệu thật.",
    due: "2026-07-20",
    status: "in progress",
    teamIds: [104, 102],
    domains: ["ai", "backend", "devops"],
    profile: "planning",
    customer: ["Nhóm nghiên cứu mở rộng", "CPM-LLM"],
    lateWeight: 1,
  },
];

const taskPools = {
  frontend: [
    ["Thiết kế lại màn hình dashboard quản lý công việc", "Sắp xếp lại số liệu, chart và danh sách task cần chú ý để manager đọc nhanh trong buổi họp nhóm."],
    ["Làm bộ lọc task theo trạng thái và deadline", "Cho phép lọc task trễ hạn, sắp đến hạn, chưa gán người và đang review."],
    ["Chuẩn hóa card task trong project detail", "Card phải có tên task, deadline, người làm, badge trạng thái và mức ưu tiên."],
    ["Tối ưu giao diện thêm project", "Giảm cảm giác form thô, nhóm thông tin theo phần và giữ nút lưu dễ thấy."],
    ["Làm màn hình thống kê nhân sự", "Hiển thị workload, task trễ và tỉ lệ hoàn thành của từng thành viên."],
    ["Sửa trạng thái rỗng cho trang tìm kiếm", "Khi không có kết quả phải có text rõ ràng và gợi ý cách tìm lại."],
    ["Cải thiện bảng kanban cho nhóm sinh viên", "Các cột backlog, đang làm, review và hoàn thành phải dễ kéo thả và dễ đọc."],
    ["Làm biểu đồ tiến độ theo dự án", "Thêm chart hoàn thành, trễ hạn, đang làm và chưa gán người cho overview."],
  ],
  backend: [
    ["Viết API báo cáo tổng quan dự án", "Trả về số task hoàn thành, đang làm, trễ hạn, chưa gán và danh sách task rủi ro."],
    ["Chuẩn hóa cập nhật trạng thái task theo deadline", "Task quá hạn tự chuyển late nếu chưa hoàn thành, task done giữ completed."],
    ["Tối ưu query danh sách project cho mobile", "Populate team, đếm task và giữ response đủ nhẹ cho thiết bị thật."],
    ["Bổ sung API upload nhiều file cho task", "Lưu metadata, base64 và endpoint tải xuống theo file id."],
    ["Kiểm tra phân quyền manager khi sửa task", "Manager chỉ sửa task trong project thuộc team mình quản lý."],
    ["Tạo endpoint preview phân công AI", "Trả về top ứng viên, điểm kỹ năng, tải công việc và lý do đề xuất."],
    ["Viết kiểm tra dữ liệu đầu vào khi tạo task", "Validate title, description, deadline, priority, difficulty và required skills."],
    ["Tối ưu chatbot tool cho báo cáo dự án", "Query đúng project, lọc khoảng thời gian và trả đủ task trễ cho AI diễn giải."],
  ],
  mobile: [
    ["Làm màn hình thêm task có đính kèm file", "Cho phép chọn nhiều file, xem trước tên file, preview ảnh/PDF và gửi lên server."],
    ["Sửa flow tạo task từ mobile", "Sau khi tạo xong phải thấy task mới trong project mà không cần tắt app."],
    ["Làm màn hình project overview", "Hiển thị chart trạng thái, workload theo thành viên và deadline pressure."],
    ["Cải thiện assignment preview trên mobile", "Không hiển thị như debug, thay bằng card có điểm số, lý do và nút chọn người."],
    ["Tối ưu thanh trượt trọng số phân công", "Slider phải mượt, không rebuild cả danh sách task khi kéo."],
    ["Thêm tải file từ task detail", "Nhấn vào attachment phải mở preview hoặc tải file về máy."],
    ["Sửa lỗi range khi cuộn nhanh danh sách task", "Danh sách chọn task không được truy cập index ngoài phạm vi khi data cập nhật."],
    ["Chuẩn hóa nút quay lại ở các trang con", "Trang thêm task, thêm project, overview và quản lý user phải có navigation rõ."],
  ],
  ai: [
    ["Thiết kế pipeline AI phân tích yêu cầu chatbot", "AI phải hiểu câu hỏi, chọn tool, đọc kết quả database và trả lời tự nhiên."],
    ["Tinh chỉnh chi phí MCMF theo workload", "Người đang quá nhiều task bị tăng chi phí, người rảnh và đúng skill được ưu tiên."],
    ["So khớp kỹ năng bằng embedding và TF-IDF", "Kết hợp exact match, embedding similarity và keyword score để chấm ứng viên."],
    ["Giải thích lý do gợi ý assignee", "Mỗi đề xuất cần có điểm kỹ năng, điểm tải, deadline pressure và ghi chú ngắn."],
    ["Tạo fallback khi model AI lỗi", "Nếu LLM không sẵn sàng, hệ thống vẫn dùng heuristic và MCMF nội bộ."],
    ["Chuẩn hóa câu hỏi báo cáo khoảng thời gian", "Hiểu các câu như từ hôm nay đến một tuần, tuần này, tháng sau, 7 ngày tới."],
    ["Xây bộ test prompt cho chatbot agent", "Tạo nhiều câu hỏi tự nhiên về project, task, nhân sự, trễ hạn và phân công."],
    ["Chấm điểm rủi ro task", "Kết hợp deadline, priority, difficulty, trạng thái và người làm để xếp task cần xử lý trước."],
  ],
  qa: [
    ["Viết checklist test tạo task và upload file", "Kiểm tra thêm task, sửa task, attach file, preview PDF và tải xuống."],
    ["Test chatbot với câu hỏi báo cáo dự án", "Hỏi dự án nào trễ nhất, ai trễ, task nào cần xử lý trước và báo cáo 7 ngày tới."],
    ["Kiểm thử phân công tự động", "Chọn nhiều task chưa gán, xem top 3 người đề xuất, xác nhận apply và kiểm tra database."],
    ["Lập bộ regression cho API chính", "Bao phủ auth, project, task, team, user, skill, attachment và assignment."],
    ["Kiểm tra dashboard với dữ liệu trễ hạn", "Đảm bảo chart không rỗng, filter hoạt động và số liệu khớp task list."],
    ["Ghi hướng dẫn cài đặt local", "Nêu user/pass, lệnh seed database, start server, chạy app debug USB."],
    ["Test phân quyền employee", "Employee chỉ xem dữ liệu được giao, không sửa deadline hoặc trạng thái tuỳ tiện."],
    ["Soát lỗi tiếng Việt trong UI", "Các message chatbot, badge, empty state và label form phải đọc tự nhiên."],
  ],
  devops: [
    ["Cập nhật biến môi trường cho LLM compatible", "Hỗ trợ base URL, API key, model name và fallback khi thiếu cấu hình."],
    ["Viết script reset database demo", "Xóa sạch database local và nạp lại bộ dữ liệu test trong một lệnh."],
    ["Chuẩn bị file database bàn giao", "Export users, auths, teams, projects, tasks, skills và stage template."],
    ["Kiểm tra server chạy khi port 1337 bị chiếm", "Hướng dẫn đổi port hoặc tắt process đang dùng port."],
    ["Bổ sung log cho chatbot planner", "Log action, confidence và reason để debug khi AI chọn sai tool."],
    ["Chuẩn hóa README theo yêu cầu nộp bài", "Ghi link GitHub, cài đặt, tài khoản, lệnh chạy và cách import CSDL."],
    ["Kiểm tra build debug APK", "Đảm bảo app build được trước khi demo bằng thiết bị USB."],
    ["Tạo runbook demo cho hội đồng", "Liệt kê thứ tự thao tác: đăng nhập, xem dashboard, tạo task, hỏi chatbot, phân công AI."],
  ],
  data: [
    ["Thiết kế dữ liệu mẫu giống dự án thật", "Task phải có title, description, skill, người làm, deadline và trạng thái đa dạng."],
    ["Tạo dữ liệu task chưa gán cho MCMF", "Giữ một phần task chưa có assignee để test auto assignment."],
    ["Phân tích workload theo thành viên", "Tạo chênh lệch tải công việc để thuật toán tránh giao quá nhiều cho một người."],
    ["Tạo bộ câu hỏi kiểm thử báo cáo", "Bao phủ báo cáo hôm nay, 7 ngày tới, theo project, theo cá nhân và theo nhân sự."],
    ["Chuẩn hóa skill profile người dùng", "Mỗi user có kỹ năng sát với nhóm việc nhưng vẫn có vài kỹ năng phụ để test matching."],
    ["Thêm dữ liệu task hoàn thành đúng hạn", "Cần đủ completed task để chart completion rate không bị toàn 0."],
    ["Tạo task trễ nhiều mức độ", "Có task trễ 1-3 ngày, 7 ngày và hơn 14 ngày để test ranking."],
    ["Đối chiếu dữ liệu JSON với schema MongoDB", "Đảm bảo ObjectId, NumberLong, skills và attachments đúng cấu trúc app đang dùng."],
  ],
};

const users = [];
const auths = [];
const teams = [];
const memberIdsByTeam = new Map();
const userIdByUsername = new Map();
let authNo = 1001;

function makeSkillObjects(skills) {
  return skills.map((name) => ({
    name,
    description: `Đã dùng ${name} trong bài tập lớn, đồ án nhóm hoặc module CPM liên quan.`,
  }));
}

function addAuth(username, role, userId) {
  auths.push({
    _id: oid(authNo++),
    username,
    password: JANE_SMITH_PASSWORD_HASH,
    role,
    user: oid(userId),
  });
}

function addUser({ id, name, username, role, skills, productivity, onTime }) {
  users.push({
    _id: oid(id),
    name,
    dob: long(dateMs(`200${id % 5 + 1}-0${id % 8 + 1}-15`, 0)),
    email: username === "janesmith" ? "janesmith@example.com" : `${username}@student.cpm.edu.vn`,
    role,
    skills: makeSkillObjects(skills),
    productivity_score: productivity,
    on_time_rate: onTime,
    current_task_count: 0,
  });
  userIdByUsername.set(username, id);
  addAuth(username, role, id);
}

addUser({
  id: 1,
  name: "Jane Smith",
  username: "janesmith",
  role: "admin",
  skills: ["Project Management", "Testing", "Data Modeling", "Documentation", "Reporting"],
  productivity: 0.92,
  onTime: 95,
});
auths[0]._id = oid(901);
authNo = 1001;

for (const team of teamDefs) {
  const members = [];
  [team.manager, ...team.members].forEach((person, index) => {
    const [name, username, roleOrSkills, maybeSkills] = person;
    const role = Array.isArray(roleOrSkills) ? "employee" : roleOrSkills;
    const skills = Array.isArray(roleOrSkills) ? roleOrSkills : maybeSkills;
    const id = team.id * 100 + index + 1;
    const productivity = Number(Math.min(role === "manager" ? 0.9 : 0.61 + (index % 6) * 0.055, 0.94).toFixed(2));
    const onTime = role === "manager" ? 91 : 72 + ((index * 5 + team.id) % 23);
    addUser({ id, name, username, role, skills, productivity, onTime });
    members.push(id);
  });
  memberIdsByTeam.set(team.id, members);
  teams.push({
    _id: oid(team.id),
    name: team.name,
    members: members.map(oid),
  });
}

const projects = projectDefs.map((project) => ({
  _id: oid(project.id),
  title: project.title,
  description: project.description,
  due_date: long(dateMs(project.due)),
  status: project.status,
  team: oid(project.teamIds[0]),
  teams: project.teamIds.map(oid),
  stages,
  stage_template_id: oid(6001),
  customer: {
    name: project.customer?.[0] || "Bộ môn Công nghệ phần mềm",
    code: project.customer?.[1] || "CPM-STUDENT",
    description: `Dữ liệu demo cho ${project.title}.`,
  },
  contacts: [oid(7001)],
  primary_contact: oid(7001),
}));

function projectMemberIds(project) {
  return project.teamIds.flatMap((teamId) => memberIdsByTeam.get(teamId) || []);
}

function employeeIds(project) {
  return projectMemberIds(project).filter((id) => {
    const managerIds = project.teamIds.map((teamId) => teamId * 100 + 1);
    return !managerIds.includes(id);
  });
}

function pickAssignees(project, taskIndex, localIndex, status, domain, canParallelize) {
  if (status !== "completed" && project.profile === "planning" && localIndex % 2 === 0) return [];
  if (status !== "completed" && project.profile !== "review" && localIndex % 6 === 0) return [];
  const candidates = employeeIds(project);
  const preferred = candidates.filter((id) => {
    const user = users.find((item) => item._id.$oid === oid(id).$oid);
    const text = (user?.skills || []).map((skill) => skill.name).join(" ");
    return skillCatalog[domain].some((skill) => text.includes(skill));
  });
  const pool = preferred.length ? preferred : candidates;
  const first = pool[(taskIndex * 3 + project.id) % pool.length];
  if (!canParallelize || taskIndex % 5 !== 0) return first ? [oid(first)] : [];
  const second = pool[(taskIndex * 3 + project.id + 2) % pool.length];
  return second && second !== first ? [oid(first), oid(second)] : [oid(first)];
}

function timingFor(project, localIndex, globalIndex) {
  if (project.profile === "completed") {
    return {
      status: "completed",
      due: addDays(-((localIndex % 18) + 4)),
      stage: "done",
    };
  }

  if (project.profile === "planning") {
    if (localIndex % 5 === 0) {
      return { status: "in progress", due: addDays((localIndex % 14) + 21), stage: "backlog" };
    }
    return {
      status: "in progress",
      due: addDays((localIndex % 24) + 18),
      stage: localIndex % 3 === 0 ? "backlog" : "in-progress",
    };
  }

  if (project.profile === "review" && localIndex % 3 !== 0) {
    return {
      status: "in progress",
      due: addDays((localIndex % 5) + 1),
      stage: "review",
    };
  }

  if (project.profile === "deadline" && localIndex % 2 === 1) {
    return {
      status: "in progress",
      due: addDays((localIndex % 4) + 1),
      stage: localIndex % 3 === 0 ? "review" : "in-progress",
    };
  }

  const lateBudget = project.lateWeight;
  if (localIndex < lateBudget) {
    const lateDays = [2, 4, 7, 11, 15, 21][(localIndex + project.id) % 6];
    return { status: "late", due: addDays(-lateDays), stage: localIndex % 2 ? "review" : "in-progress" };
  }
  if ((globalIndex + project.id) % 5 === 0) {
    return { status: "completed", due: addDays(-((globalIndex % 18) + 1)), stage: "done" };
  }
  if ((globalIndex + project.id) % 4 === 0) {
    return { status: "in progress", due: addDays((globalIndex % 6) + 1), stage: "review" };
  }
  if ((globalIndex + project.id) % 7 === 0) {
    return { status: "in progress", due: addDays((globalIndex % 3) + 1), stage: "backlog" };
  }
  return {
    status: "in progress",
    due: addDays((globalIndex % 25) + 8),
    stage: globalIndex % 3 === 0 ? "backlog" : "in-progress",
  };
}

const tasks = [];
const taskTitleUsage = new Map();
const localIndexByProject = new Map();

for (let globalIndex = 0; globalIndex < 100; globalIndex += 1) {
  const project = projectDefs[globalIndex % projectDefs.length];
  const localIndex = localIndexByProject.get(project.id) || 0;
  localIndexByProject.set(project.id, localIndex + 1);

  const domain = project.domains[(globalIndex + localIndex) % project.domains.length];
  const pool = taskPools[domain];
  const [rawTitle, rawDescription] = pool[(globalIndex + project.id + localIndex) % pool.length];
  const titleCount = taskTitleUsage.get(rawTitle) || 0;
  taskTitleUsage.set(rawTitle, titleCount + 1);
  const title = titleCount === 0
    ? rawTitle
    : `${rawTitle} - ${project.title.split(" ").slice(0, 3).join(" ")} ${titleCount + 1}`;
  const timing = timingFor(project, localIndex, globalIndex);
  const canParallelize = globalIndex % 4 !== 1;
  const assignedTo = pickAssignees(project, globalIndex, localIndex, timing.status, domain, canParallelize);
  const required = [
    skillCatalog[domain][globalIndex % skillCatalog[domain].length],
    skillCatalog[domain][(globalIndex + 2) % skillCatalog[domain].length],
    skillCatalog[project.domains[(localIndex + 1) % project.domains.length]][localIndex % skillCatalog[project.domains[(localIndex + 1) % project.domains.length]].length],
  ];
  const context =
    timing.status === "late"
      ? "Đây là task cố ý quá hạn để kiểm tra chatbot, dashboard và báo cáo trễ hạn."
      : timing.status === "completed"
        ? "Đây là task hoàn thành để kiểm tra completion rate và biểu đồ tiến độ."
        : assignedTo.length === 0
          ? "Đây là task chưa gán người để test AI + MCMF đề xuất assignee."
          : "Đây là task đang làm để kiểm tra workload, deadline gần và báo cáo nhân sự.";

  tasks.push({
    _id: oid(3001 + globalIndex),
    title,
    description: `${rawDescription} Thuộc dự án "${project.title}". Cần kỹ năng ${required.join(", ")}. ${context}`,
    due_date: long(timing.due),
    status: timing.status,
    stage: timing.stage,
    project: oid(project.id),
    assigned_to: assignedTo,
    difficulty: 1 + (globalIndex % 4),
    priority: 1 + ((globalIndex * 2 + localIndex) % 5),
    can_parallelize: canParallelize,
    required_skills: required,
    skills_required: required,
    attachments: [],
  });
}

for (const user of users) {
  const activeCount = tasks.filter((task) =>
    task.status !== "completed" &&
    (task.assigned_to || []).some((assignee) => assignee.$oid === user._id.$oid)
  ).length;
  user.current_task_count = activeCount;
}

const skills = Array.from(new Set([
  ...Object.values(skillCatalog).flat(),
  "Project Management",
  "Accessibility",
  "Calendar UI",
  "Bug Fixing",
  "Security",
  "JWT",
  "Validation",
  "Error Handling",
  "MinIO",
  "Performance",
  "Indexing",
  "Offline Cache",
  "Image Picker",
  "Algorithms",
  "Gemini API",
  "Automation",
])).sort().map((name, index) => ({
  _id: oid(5001 + index),
  name,
  description: `Kỹ năng ${name} dùng để test so khớp người phù hợp với task trong đồ án nhóm sinh viên.`,
}));

const stage_templates = [
  {
    _id: oid(6001),
    name: "Quy trình đồ án sinh viên",
    description: "Mẫu giai đoạn mặc định cho bài tập lớn và đồ án môn học.",
    is_default: true,
    stages,
    createdAt: { $date: "2026-05-11T00:00:00.000Z" },
    updatedAt: { $date: "2026-05-11T00:00:00.000Z" },
  },
];

const contacts = [
  {
    _id: oid(7001),
    name: "Cố vấn học tập",
    email: "covan@cpm.edu.vn",
    phone: "0900000001",
    type: "customer",
    customer_name: "Bộ môn Công nghệ phần mềm",
    company_name: "Khoa Công nghệ thông tin",
    position: "Giảng viên hướng dẫn",
    notes: "Liên hệ khi cần xác nhận yêu cầu đồ án hoặc lịch demo.",
    linked_user: null,
    createdAt: { $date: "2026-05-11T00:00:00.000Z" },
    updatedAt: { $date: "2026-05-11T00:00:00.000Z" },
  },
];

const md = `# Dữ liệu demo CPM đa dạng

Bộ dữ liệu này dùng để reset MongoDB local và test dashboard, chatbot agent, báo cáo theo project/cá nhân, upload task và AI + MCMF assignment.

## Thành phần

- 33 users: 1 admin, 4 manager, 28 employee.
- 33 auth accounts, tất cả dùng password \`123\` giống tài khoản \`janesmith\`.
- 4 team: Web/Dashboard, Backend API, Mobile, AI/QA.
- 12 project theo đúng ngữ cảnh đồ án nhóm sinh viên.
- Project có profile khác nhau: quá hạn, đúng tiến độ, sát deadline, đang review, mới lập kế hoạch, đã hoàn thành.
- 100 task đa dạng:
  - Có project nhiều task trễ để hỏi \`dự án nào bị trễ hạn nhất\`.
  - Có task trễ 2, 4, 7, 11, 15 và 21 ngày.
  - Có task completed để chart completion rate không bị rỗng.
  - Có task đang làm, review, backlog, deadline gần và deadline xa.
  - Có task chưa gán người để test AI + MCMF đề xuất assignee.
  - Title/description viết như công việc thật, không chỉ đánh số máy móc.

## Reset MongoDB local và nạp dữ liệu

\`\`\`powershell
node .\\scripts\\reset-local-db-demo.js
\`\`\`

Nếu MongoDB không dùng URI mặc định:

\`\`\`powershell
node .\\scripts\\reset-local-db-demo.js --uri "mongodb://localhost:27017/cpm"
\`\`\`

Lệnh trên xóa toàn bộ database \`cpm\` local rồi nạp lại users, auths, skills, teams, projects và tasks.

## Tài khoản test

| Vai trò | Username | Password |
|---|---|---|
| Admin | \`janesmith\` | \`123\` |
| Manager web | \`maitran\` | \`123\` |
| Manager backend | \`quangnguyen\` | \`123\` |
| Manager mobile | \`trangle\` | \`123\` |
| Manager AI/QA | \`minhdang\` | \`123\` |
| Employee web | \`annguyen\` | \`123\` |
| Employee backend | \`namtran\` | \`123\` |
| Employee mobile | \`anhvo\` | \`123\` |
| Employee AI | \`nhile\` | \`123\` |

## Câu nên test với chatbot

1. \`Dự án nào bị trễ hạn nhất?\`
2. \`Task nào bị trễ hạn nặng nhất?\`
3. \`Báo cáo cho tôi dự án Module gợi ý phân công thông minh\`
4. \`Báo cáo tổng quan từ hôm nay đến 1 tuần\`
5. \`Thống kê nhân sự trong project Ứng dụng mobile theo dõi tiến độ nhóm\`
6. \`Báo cáo cá nhân An Nguyễn trong tuần này\`
7. \`Đề xuất 3 người phù hợp cho task chưa gán trong project Module gợi ý phân công thông minh\`
8. \`Dự án nào đang tồn nhiều task nhất?\`

## Câu nên test trên app

1. Đăng nhập \`janesmith / 123\`, mở Dashboard và lọc trạng thái \`Late\`.
2. Mở project overview của \`Hệ thống quản lý đồ án môn học\` để xem chart có dữ liệu trễ hạn.
3. Mở \`Kiểm thử và triển khai hệ thống quản lý\` hoặc \`Onboarding thành viên mới vào nhóm đồ án\` để xem project completed.
4. Mở \`Nghiên cứu mở rộng tích hợp LLM\` để test project mới lập kế hoạch, nhiều task backlog/chưa gán.
5. Mở \`Module gợi ý phân công thông minh\`, vào auto assignment và chọn các task chưa gán.
6. Đăng nhập \`trangle / 123\`, kiểm tra project mobile và danh sách attachment/task.
7. Đăng nhập \`annguyen / 123\`, kiểm tra quyền employee không sửa deadline/status tùy tiện.
`;

const files = {
  "cpm.users.json": users,
  "cpm.auths.json": auths,
  "cpm.teams.json": teams,
  "cpm.projects.json": projects,
  "cpm.tasks.json": tasks,
  "cpm.skills.json": skills,
  "cpm.stage_templates.json": stage_templates,
  "cpm.contacts.json": contacts,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [fileName, docs] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(docs, null, 2), "utf8");
}
fs.writeFileSync(path.join(OUT_DIR, "TEST_ASSIGNMENT_100.md"), md, "utf8");

console.log(`Generated assignment test data in ${OUT_DIR}`);
console.log(`users=${users.length}, auths=${auths.length}, teams=${teams.length}, projects=${projects.length}, tasks=${tasks.length}, skills=${skills.length}`);

module.exports = {
  users,
  auths,
  teams,
  projects,
  tasks,
  skills,
  stage_templates,
  contacts,
};
