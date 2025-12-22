import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../model/db_helper.dart';
import '../utils/logger.dart';

class ChatbotService {
  /// Send a message to the chatbot and get a response
  /// You can integrate with any AI API later (OpenAI, Gemini, Claude, etc.)
  static Future<Map<String, dynamic>> sendMessage(String message) async {
    try {
      // Check user role first
      String userRole = DBHelper.mainUser.role.toLowerCase();

      // Validate user role before processing
      if (!['admin', 'manager', 'employee'].contains(userRole)) {
        return {
          'success': false,
          'error': 'Invalid user role. Please log in again.',
        };
      }

      // TODO: Replace this with your actual AI API endpoint
      // For now, this is a placeholder that returns a mock response

      // Example structure for OpenAI API:
      // var url = Uri.parse('https://api.openai.com/v1/chat/completions');
      // var response = await http.post(
      //   url,
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': 'Bearer YOUR_API_KEY',
      //   },
      //   body: jsonEncode({
      //     'model': 'gpt-3.5-turbo',
      //     'messages': [
      //       {'role': 'system', 'content': _getRoleBasedSystemPrompt(userRole)},
      //       {'role': 'user', 'content': message}
      //     ],
      //   }),
      // );

      // Mock response for now
      await Future.delayed(Duration(seconds: 1)); // Simulate API delay

      return {
        'success': true,
        'response': _getMockResponse(message, userRole),
        'timestamp': DateTime.now().toIso8601String(),
      };
    } catch (e) {
      AppLogger.error('Chatbot request failed', e, null, 'ChatbotService');
      return {
        'success': false,
        'error': 'Failed to get response: $e',
      };
    }
  }

  /// System prompt for AI - Use this when integrating with actual AI API
  static const String SYSTEM_PROMPT =
      '''You are an expert Project Management AI Assistant for a professional task tracking and team management application.

Your primary role is to help users with:

1. TASK MANAGEMENT:
   - Creating, assigning, and tracking tasks
   - Using the Auto-Assignment feature (MCMF algorithm) that assigns tasks based on:
     * Skills matching (cosine similarity between required and user skills)
     * Deadline urgency (tasks with closer deadlines get higher priority)
     * Team member workload balance
     * Productivity scores and on-time rates
   - Task prioritization and status tracking

2. PROJECT MANAGEMENT:
   - Project planning and organization
   - Timeline and deadline management
   - Progress tracking and reporting
   - Resource allocation across projects

3. TEAM MANAGEMENT:
   - Team member skill assessment
   - Workload distribution and balance
   - Performance tracking (productivity scores, on-time rates)
   - Capacity planning

4. ANALYTICS & INSIGHTS:
   - Provide data-driven recommendations
   - Identify bottlenecks and overloaded team members
   - Suggest optimal task assignments
   - Deadline risk assessment

ALWAYS:
- Be concise, professional, and action-oriented
- Focus on project management best practices
- Provide specific, actionable advice
- Use data and metrics when available
- Suggest using the Auto-Assignment feature when appropriate

NEVER:
- Discuss topics unrelated to project/task management
- Provide financial, legal, or HR advice
- Make promises about system capabilities
- Share technical implementation details unless asked

When users ask about Auto-Assignment, explain:
- It uses Min-Cost Max-Flow algorithm for optimal assignments
- Considers 5 factors: deadline (50%), priority (20%), speed (20%), skill match (10%), workload (5%)
- Can assign multiple people to parallelizable tasks
- Provides preview before applying changes

Keep responses under 3-4 sentences unless more detail is explicitly requested.''';

  /// Get role-based system prompt for AI
  static String _getRoleBasedSystemPrompt(String userRole) {
    String basePrompt = SYSTEM_PROMPT;

    switch (userRole) {
      case 'admin':
        return basePrompt +
            '\n\nUSER ROLE: Admin - Full access to all features.\nYou can suggest ANY actions including creating, updating, deleting projects/tasks, and managing team members.';
      case 'manager':
        return basePrompt +
            '\n\nUSER ROLE: Manager - Can CRUD projects and tasks in YOUR TEAM only.\nOnly suggest actions within the user\'s team scope. Remind them they cannot access other teams\' data.';
      case 'employee':
        return basePrompt +
            '\n\nUSER ROLE: Employee - READ-ONLY access to assigned tasks and projects.\nCANNOT create, update, delete, or reassign tasks. Can only VIEW information. Do NOT suggest any modification actions.';
      default:
        return basePrompt;
    }
  }

  /// Mock response generator - Replace with actual AI API integration
  static String _getMockResponse(String message, String userRole) {
    String lowerMessage = message.toLowerCase();

    // Check for unauthorized action requests
    bool isRequestingCreate = lowerMessage.contains('create') ||
        lowerMessage.contains('add') ||
        lowerMessage.contains('new') ||
        lowerMessage.contains('tạo');
    bool isRequestingDelete = lowerMessage.contains('delete') ||
        lowerMessage.contains('remove') ||
        lowerMessage.contains('xóa');
    bool isRequestingAssign =
        lowerMessage.contains('assign') || lowerMessage.contains('phân công');

    // Block unauthorized actions for employees
    if (userRole == 'employee') {
      if (isRequestingCreate) {
        return '🚫 As an employee, you do not have permission to create projects or tasks. Please contact your manager or admin for assistance.\n\nYou have read-only access: View your tasks, View projects, Ask questions about your work.';
      }
      if (isRequestingDelete) {
        return '🚫 As an employee, you cannot delete projects or tasks. Please contact your manager or admin if you need something removed.\n\nYou have read-only access to your assigned tasks.';
      }
      if (isRequestingAssign) {
        return '🚫 As an employee, you cannot assign or reassign tasks. Task assignment is managed by your manager or admin.\n\nYou have read-only access to your assigned tasks.';
      }
    }

    // Vietnamese keyword support
    bool isVietnamese = lowerMessage.contains('nhiệm vụ') ||
        lowerMessage.contains('dự án') ||
        lowerMessage.contains('nhóm');

    if (lowerMessage.contains('task') ||
        lowerMessage.contains('assignment') ||
        lowerMessage.contains('nhiệm vụ') ||
        lowerMessage.contains('phân công')) {
      return isVietnamese
          ? 'Tôi có thể giúp bạn phân công nhiệm vụ! Tính năng Phân công tự động sử dụng thuật toán MCMF để tối ưu hóa việc gán task dựa trên kỹ năng, khối lượng công việc và deadline. Bạn muốn biết thêm chi tiết?'
          : 'I can help you with task assignments! The Auto-Assignment feature uses MCMF algorithm to optimally assign tasks based on:\n• Skills matching (cosine similarity)\n• Deadline urgency (50% weight)\n• Team workload balance\n• Productivity scores\n\nWould you like to know how to use it?';
    } else if (lowerMessage.contains('skill') ||
        lowerMessage.contains('kỹ năng') ||
        lowerMessage.contains('embedding') ||
        lowerMessage.contains('matching')) {
      return isVietnamese
          ? 'Hệ thống khớp kỹ năng có 2 tầng:\n\n1️⃣ Cosine Similarity: So sánh vector kỹ năng\n2️⃣ Synonym Matching: Tự động nhận dạng kỹ năng tương đương\n\nVD: "React" sẽ match với "ReactJS", "React.js"\n"Frontend" match với "UI", "Client-side"\n\n✨ Hỗ trợ: 30+ synonyms phổ biến (React, Vue, Node, Docker, etc.)\n💡 Tips: Viết skills chuẩn sẽ tăng độ chính xác!'
          : 'Skill matching uses 2-layer approach:\n\n1️⃣ Cosine Similarity: Vector-based comparison\n2️⃣ Synonym Matching: Auto-detects equivalent skills\n\nEx: "React" matches "ReactJS", "React.js"\n"Frontend" matches "UI", "Client-side"\n\n✨ Supports: 30+ common synonyms (React, Vue, Node, Docker, etc.)\n💡 Tip: Use standardized skill names for best accuracy!\n\nSkill matching = 10% of assignment score.';
    } else if (lowerMessage.contains('auto') ||
        lowerMessage.contains('mcmf') ||
        lowerMessage.contains('tự động')) {
      return isVietnamese
          ? 'Tính năng Phân công Tự động:\n• Thuật toán: Min-Cost Max-Flow (MCMF)\n• Trọng số: Deadline 50%, Priority 20%, Speed 20%, Skill 10%, Workload 5%\n• Hỗ trợ task song song (nhiều người/task)\n• Xem trước trước khi áp dụng\n\nVào menu Auto Assignment để sử dụng!'
          : 'Auto-Assignment Feature:\n• Algorithm: Min-Cost Max-Flow (MCMF)\n• Weights: Deadline 50%, Priority 20%, Speed 20%, Skill 10%, Workload 5%\n• Supports parallel tasks (multiple people per task)\n• Preview before applying\n\nGo to Auto Assignment tab to use it!';
    } else if (lowerMessage.contains('project') ||
        lowerMessage.contains('dự án')) {
      return isVietnamese
          ? 'Tôi có thể hỗ trợ quản lý dự án: tạo dự án mới, theo dõi tiến độ, phân bổ nguồn lực. Bạn cần làm gì với dự án?'
          : 'I can help you manage projects: create new projects, track progress, allocate resources, monitor deadlines. What would you like to do?';
    } else if (lowerMessage.contains('team') ||
        lowerMessage.contains('member') ||
        lowerMessage.contains('nhóm')) {
      return isVietnamese
          ? 'Tôi có thể cung cấp thông tin về thành viên: khối lượng công việc hiện tại, điểm năng suất, tỷ lệ hoàn thành đúng hạn. Bạn muốn xem thống kê nào?'
          : 'I can provide team insights: current workload, productivity scores, on-time completion rates, skill inventory. What would you like to know?';
    } else if (lowerMessage.contains('deadline') ||
        lowerMessage.contains('hạn')) {
      return isVietnamese
          ? 'Tôi có thể giúp theo dõi deadline: xem task sắp đến hạn, task quá hạn, phân tích rủi ro. Bạn muốn xem gì?'
          : 'I can help track deadlines: view upcoming deadlines, overdue tasks, risk analysis. Deadline urgency is weighted 50% in auto-assignment. What do you need?';
    } else if (lowerMessage.contains('help') || lowerMessage.contains('giúp')) {
      return isVietnamese
          ? 'Tôi là trợ lý quản lý dự án! Tôi có thể giúp:\n\n• Phân công task tự động (MCMF)\n• Quản lý dự án và tiến độ\n• Thông tin team và kỹ năng\n• Theo dõi deadline\n• Phân tích khối lượng công việc\n\nBạn cần biết thêm về mục nào?'
          : 'I\'m your PM assistant! I can help with:\n\n• Auto task assignment (MCMF)\n• Project management\n• Team skills & workload\n• Deadline tracking\n• Performance analytics\n\nWhat interests you?';
    } else if (lowerMessage.contains('hello') ||
        lowerMessage.contains('hi') ||
        lowerMessage.contains('xin chào')) {
      String roleInfo = _getRoleInfo(userRole, isVietnamese);
      return isVietnamese
          ? 'Xin chào! Tôi là trợ lý quản lý dự án của bạn. $roleInfo\n\nTôi có thể giúp gì hôm nay?'
          : 'Hello! I\'m your project management assistant. $roleInfo\n\nHow can I help you today?';
    } else if (lowerMessage.contains('workload') ||
        lowerMessage.contains('khối lượng')) {
      return isVietnamese
          ? 'Tôi có thể phân tích khối lượng công việc của team, xác định ai đang quá tải, đề xuất cân bằng lại. Hệ thống tính workload penalty (5%) để tránh gán quá nhiều task cho 1 người. Bạn muốn xem phân tích?'
          : 'I can analyze team workload, identify overloaded members, suggest rebalancing. The system applies a 5% workload penalty to avoid over-assigning. Would you like a workload analysis?';
    } else {
      return isVietnamese
          ? 'Tôi chuyên hỗ trợ quản lý dự án. Bạn có thể hỏi về: phân công task, quản lý dự án, team, deadline, hoặc sử dụng tính năng Phân công Tự động. Bạn cần giúp gì?'
          : 'I specialize in project management. Ask me about: task assignments, projects, team members, deadlines, or the Auto-Assignment feature. What would you like to know?';
    }
  }

  /// Get chat history (can be expanded to store in local DB)
  static Future<List<Map<String, dynamic>>> getChatHistory() async {
    // TODO: Implement chat history storage in local database
    return [];
  }

  /// Clear chat history
  static Future<void> clearChatHistory() async {
    // TODO: Implement clearing chat history from local database
  }

  /// Get role-specific information for user
  static String _getRoleInfo(String userRole, bool isVietnamese) {
    switch (userRole) {
      case 'admin':
        return isVietnamese
            ? '👤 Vai trò: Quản trị viên - Toàn quyền truy cập.'
            : '👤 Role: Admin - Full access to all features.';
      case 'manager':
        return isVietnamese
            ? '👤 Vai trò: Quản lý - Quản lý dự án và task trong nhóm của bạn.'
            : '👤 Role: Manager - Manage projects and tasks in your team.';
      case 'employee':
        return isVietnamese
            ? '👤 Vai trò: Nhân viên - Chỉ xem task được phân công (read-only).'
            : '👤 Role: Employee - View your assigned tasks (read-only).';
      default:
        return '';
    }
  }
}
