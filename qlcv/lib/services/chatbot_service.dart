import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../model/db_helper.dart';
import '../utils/logger.dart';

class ChatbotService {
  /// Send a message to the chatbot and get a response.
  ///
  /// The current app still returns local mock responses, but the system prompt
  /// below is ready to be passed to a real AI provider later.
  static Future<Map<String, dynamic>> sendMessage(String message) async {
    try {
      final userRole = DBHelper.mainUser.role.toLowerCase();

      if (!['admin', 'manager', 'employee'].contains(userRole)) {
        return {
          'success': false,
          'error': 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
        };
      }

      final response = await http.post(
        Uri.parse(ApiConfig.chatbotEndpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${DBHelper.token}',
        },
        body: jsonEncode({
          'message': message,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          data is Map<String, dynamic>) {
        return {
          'success': data['success'] == true,
          'response': data['response']?.toString() ??
              _getMockResponse(message, userRole),
          'timestamp':
              data['timestamp']?.toString() ?? DateTime.now().toIso8601String(),
        };
      }

      if (data is Map<String, dynamic>) {
        return {
          'success': false,
          'error': data['error']?.toString() ?? 'AI service request failed',
        };
      }

      return {
        'success': false,
        'error': 'AI service request failed with status ${response.statusCode}',
      };
    } catch (e) {
      AppLogger.error('Chatbot request failed', e, null, 'ChatbotService');
      return {
        'success': false,
        'error': 'Không thể lấy phản hồi từ chatbot: $e',
      };
    }
  }

  /// System prompt for a real AI provider.
  ///
  /// Use [getAgentSystemPrompt] instead of this raw prompt when sending to an
  /// AI model so the user role and API catalog are included.
  static const String systemPrompt = '''
You are CPM Agent, an AI assistant inside a project/task management app for small projects and student teams.

Your job:
- Understand the user's role, current task/project context, and intent.
- Explain what the app can do and guide users to the right feature.
- When tool/API execution is available, map user intent to the correct CPM API endpoint.
- For assignment questions, explain the hybrid AI + MCMF assignment flow clearly.
- Keep answers concise, practical, and tied to CPM workflows.

Important behavior:
- Do not claim that an API call was executed unless the host app actually executed it.
- Do not invent routes. Use the API catalog in this prompt.
- Respect role permissions. Employees should receive read-only guidance.
- Prefer Vietnamese when the user writes Vietnamese.
- If an action is risky, ask for confirmation before suggesting apply/delete/update.
''';

  static const String apiCapabilityContext = '''
CPM API catalog
Base path: /api
Authentication: protected endpoints require Authorization: Bearer <token>.

Auth:
- POST /api/auth/login: log in and receive token/user id.
- POST /api/auth/register: create a new account.

Projects:
- GET /api/projects: paginated project list.
- GET /api/projects/getAll: all projects.
- GET /api/projects/search: search projects.
- GET /api/projects/:id: project detail.
- POST /api/projects: create project.
- PUT /api/projects/:id: update project.
- DELETE /api/projects/:id: delete project.

Tasks:
- GET /api/tasks: paginated task list.
- GET /api/tasks/getAll: all tasks.
- GET /api/tasks/:id: task detail.
- GET /api/tasks/project/:id: tasks in a project.
- GET /api/tasks/user: tasks for a user.
- GET /api/tasks/name and /api/tasks/nameMobile: search tasks.
- GET /api/tasks/dashboard/overview: dashboard overview.
- POST /api/tasks: create task.
- PUT /api/tasks/:id: update task.
- DELETE /api/tasks/:id: delete task.
- POST /api/tasks/done/:id: mark/check task done.
- GET /api/tasks/:id/notes: list task notes.
- POST /api/tasks/:id/notes: add task note.

Assignment:
- GET /api/assignments/default-config: read default scoring weights.
- POST /api/assignments/preview: preview assignment without writing DB.
- POST /api/assignments/apply: apply assignment to tasks.
- PUT /api/assignments/:taskId/override: manually override assignees.
- POST /api/assignments/reassign-project/:projectId: reassign active tasks in one project.

Users, skills, teams:
- GET /api/users and /api/users/getAll: list users.
- GET /api/users/:id: user detail.
- GET /api/users/:id/skills: user skills.
- POST /api/users/:id/skills: add user skill.
- PUT /api/users/:id/skills/:skillId: update user skill.
- DELETE /api/users/:id/skills/:skillId: delete user skill.
- GET /api/skills: list global skills.
- POST /api/skills: create skill.
- PUT /api/skills/:id: update skill.
- DELETE /api/skills/:id: delete skill.
- GET /api/teams: list teams.
- GET /api/teams/:id: team detail.
- GET /api/teams/users/:id: users in team.
- GET /api/teams/name/:name: find team by name.
- POST /api/teams: create team.

Stage templates and contacts:
- GET /api/stage-templates: list stage templates.
- GET /api/stage-templates/:id: stage template detail.
- POST /api/stage-templates: create stage template.
- PUT /api/stage-templates/:id: update stage template.
- DELETE /api/stage-templates/:id: delete stage template.
- GET/POST/PUT/DELETE /api/contacts: contact management.

Assignment model:
- Preview first, apply second.
- Hybrid assignment uses graph/MCMF for availability + embedding/skill matching for fit.
- It considers deadline, priority, speed/productivity, skill match, persisted workload, and batch workload fairness.
- A parallelizable task can have multiple assignees, controlled by maxParallelAssignees.
''';

  static String getAgentSystemPrompt(String userRole) {
    return '''
$systemPrompt

$apiCapabilityContext

${_rolePolicy(userRole)}
''';
  }

  static String _rolePolicy(String userRole) {
    switch (userRole.toLowerCase()) {
      case 'admin':
        return '''
Current role: admin.
Allowed guidance: full access. You may suggest create, update, delete, assignment preview/apply, team/user/skill management, and admin-level troubleshooting.
''';
      case 'manager':
        return '''
Current role: manager.
Allowed guidance: project/task/team operations within the manager's scope. Prefer preview before apply. Be careful with delete/reassign suggestions.
''';
      case 'employee':
        return '''
Current role: employee.
Allowed guidance: read-only. Help the user understand assigned tasks, deadlines, notes, project status, and what to ask a manager/admin to change.
Do not suggest direct create/update/delete/reassign actions for employees.
''';
      default:
        return 'Current role: unknown. Give safe read-only guidance.';
    }
  }

  static String _getMockResponse(String message, String userRole) {
    final lowerMessage = message.toLowerCase();
    final isVietnamese = _looksVietnamese(lowerMessage);

    if (_isUnauthorizedWriteAction(lowerMessage, userRole)) {
      return isVietnamese
          ? 'Tài khoản employee chỉ nên xem thông tin task/project được giao. Nếu cần tạo, sửa, xóa hoặc phân công lại, hãy nhờ manager hoặc admin thao tác.'
          : 'Employees have read-only access. Please ask a manager or admin to create, update, delete, or reassign work.';
    }

    if (_containsAny(lowerMessage, [
      'api',
      'endpoint',
      'route',
      'path',
      'agent',
      'skill',
      'làm được gì',
      'lam duoc gi',
      'có thể làm gì',
      'co the lam gi',
      'đường dẫn',
      'duong dan',
    ])) {
      return _capabilityAnswer(userRole, isVietnamese);
    }

    if (_containsAny(lowerMessage, [
      'assign',
      'assignment',
      'mcmf',
      'auto',
      'phân công',
      'phan cong',
      'tự động',
      'tu dong',
    ])) {
      return isVietnamese
          ? 'Agent có thể hướng dẫn luồng phân công: chọn task, gọi preview trước, kiểm tra người được gợi ý, rồi mới apply. Backend dùng hybrid MCMF + skill matching, có thêm cân bằng tải trong cùng batch để tránh dồn quá nhiều task cho một người.'
          : 'I can guide the assignment flow: select tasks, preview recommendations, review assignees, then apply. The backend uses hybrid MCMF + skill matching with batch workload fairness.';
    }

    if (_containsAny(lowerMessage, ['task', 'nhiệm vụ', 'nhiem vu'])) {
      return isVietnamese
          ? 'Với task, agent biết các API xem danh sách, xem chi tiết, tìm theo tên, lọc theo project/user, tạo/sửa/xóa, đánh dấu hoàn thành và ghi chú. Quyền thao tác phụ thuộc role hiện tại của bạn.'
          : 'For tasks, I know list/detail/search/project/user/create/update/delete/done/notes APIs. Allowed actions depend on your current role.';
    }

    if (_containsAny(lowerMessage, ['project', 'dự án', 'du an'])) {
      return isVietnamese
          ? 'Với project, agent có thể hướng dẫn xem danh sách, xem chi tiết, tìm kiếm, tạo, sửa, xóa và kiểm tra task thuộc project. Khi cần phân công lại toàn project, dùng endpoint reassign-project.'
          : 'For projects, I can guide listing, details, search, create, update, delete, and project task checks. For reassignment, use the reassign-project endpoint.';
    }

    if (_containsAny(lowerMessage, [
      'skill',
      'kỹ năng',
      'ky nang',
      'team',
      'member',
      'thành viên',
      'thanh vien',
      'nhóm',
      'nhom',
    ])) {
      return isVietnamese
          ? 'Agent biết các API team/user/skill: xem thành viên, xem skill của user, thêm/sửa/xóa skill, và dùng skill đó làm đầu vào cho phân công tự động.'
          : 'I know team/user/skill APIs: list members, inspect user skills, add/update/delete skills, and use skills as assignment inputs.';
    }

    if (_containsAny(lowerMessage, ['help', 'giúp', 'giup'])) {
      return _capabilityAnswer(userRole, isVietnamese);
    }

    return isVietnamese
        ? 'Mình là CPM Agent. Mình có thể giải thích API, quyền theo role, luồng task/project/team, và cách dùng phân công tự động AI + MCMF. Bạn muốn mình xem phần nào trước?'
        : 'I am CPM Agent. I can explain APIs, role permissions, task/project/team workflows, and AI + MCMF auto-assignment. Which part should we inspect first?';
  }

  static bool _isUnauthorizedWriteAction(String text, String userRole) {
    if (userRole != 'employee') return false;
    return _containsAny(text, [
      'create',
      'add',
      'new',
      'delete',
      'remove',
      'update',
      'reassign',
      'apply assignment',
      'override',
      'tạo',
      'tao',
      'xóa',
      'xoa',
      'sửa',
      'sua',
      'phân công lại',
      'phan cong lai',
      'áp dụng',
      'ap dung',
      'ghi đè',
      'ghi de',
    ]);
  }

  static String _capabilityAnswer(String userRole, bool isVietnamese) {
    final roleText = _rolePolicy(userRole)
        .split('\n')
        .where((line) => line.trim().isNotEmpty)
        .join(' ');

    if (isVietnamese) {
      return '''
Mình là CPM Agent. Mình biết các nhóm API chính: auth, projects, tasks, assignments, users, skills, teams, stage templates và contacts.

Mình có thể:
- Chỉ đường đúng endpoint cho task/project/team/skill.
- Giải thích quyền theo role hiện tại.
- Hướng dẫn preview/apply phân công AI + MCMF.
- Gợi ý cách kiểm tra deadline, workload, assignee và trạng thái.

$roleText
''';
    }

    return '''
I am CPM Agent. I know the main API groups: auth, projects, tasks, assignments, users, skills, teams, stage templates, and contacts.

I can:
- Map user intent to the right endpoint.
- Explain current role permissions.
- Guide AI + MCMF assignment preview/apply.
- Help inspect deadlines, workload, assignees, and statuses.

$roleText
''';
  }

  static bool _looksVietnamese(String text) {
    return _containsAny(text, [
      'à',
      'á',
      'ạ',
      'ả',
      'ã',
      'â',
      'ă',
      'è',
      'é',
      'ê',
      'ì',
      'í',
      'ò',
      'ó',
      'ô',
      'ơ',
      'ù',
      'ú',
      'ư',
      'ỳ',
      'ý',
      'đ',
      'nhiệm',
      'dự án',
      'phân công',
      'giúp',
      'giup',
      'nhóm',
      'nhom',
      'lam duoc gi',
      'co the lam gi',
      'duong dan',
      'nhiem vu',
      'du an',
      'phan cong',
      'tu dong',
      'ky nang',
      'thanh vien',
    ]);
  }

  static bool _containsAny(String text, List<String> keywords) {
    return keywords.any(text.contains);
  }

  static Future<List<Map<String, dynamic>>> getChatHistory() async {
    return [];
  }

  static Future<void> clearChatHistory() async {}
}
