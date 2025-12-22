import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../model/db_helper.dart';

class AssignmentService {
  /// Get default assignment configuration
  static Future<Map<String, dynamic>> getDefaultConfig() async {
    try {
      var url = Uri.parse(ApiConfig.assignmentDefaultConfig);
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer ${DBHelper.token}',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to get default config');
      }
    } catch (e) {
      print('Error getting default config: $e');
      rethrow;
    }
  }

  /// Preview task assignment (doesn't apply to database)
  static Future<Map<String, dynamic>> previewAssignment({
    required List<String> taskIds,
    List<String>? userIds,
    Map<String, dynamic>? config,
  }) async {
    try {
      var url = Uri.parse(ApiConfig.assignmentPreview);

      Map<String, dynamic> body = {
        'task_ids': taskIds,
      };

      if (userIds != null && userIds.isNotEmpty) {
        body['user_ids'] = userIds;
      }

      if (config != null) {
        body['config'] = config;
      }

      var response = await http.post(
        url,
        headers: <String, String>{
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${DBHelper.token}',
        },
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to preview assignment: ${response.body}');
      }
    } catch (e) {
      print('Error previewing assignment: $e');
      rethrow;
    }
  }

  /// Apply task assignment (saves to database)
  static Future<Map<String, dynamic>> applyAssignment({
    required List<String> taskIds,
    List<String>? userIds,
    Map<String, dynamic>? config,
  }) async {
    try {
      var url = Uri.parse(ApiConfig.assignmentApply);

      Map<String, dynamic> body = {
        'task_ids': taskIds,
      };

      if (userIds != null && userIds.isNotEmpty) {
        body['user_ids'] = userIds;
      }

      if (config != null) {
        body['config'] = config;
      }

      var response = await http.post(
        url,
        headers: <String, String>{
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${DBHelper.token}',
        },
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to apply assignment: ${response.body}');
      }
    } catch (e) {
      print('Error applying assignment: $e');
      rethrow;
    }
  }

  /// Override task assignment manually (PM function)
  static Future<Map<String, dynamic>> overrideAssignment({
    required String taskId,
    required List<String> userIds,
  }) async {
    try {
      var url = Uri.parse(ApiConfig.assignmentOverride(taskId));

      Map<String, dynamic> body = {
        'user_ids': userIds,
      };

      var response = await http.put(
        url,
        headers: <String, String>{
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${DBHelper.token}',
        },
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to override assignment: ${response.body}');
      }
    } catch (e) {
      print('Error overriding assignment: $e');
      rethrow;
    }
  }

  /// Reassign all tasks in a project
  static Future<Map<String, dynamic>> reassignProject({
    required String projectId,
    Map<String, dynamic>? config,
  }) async {
    try {
      var url = Uri.parse(ApiConfig.reassignProject(projectId));

      Map<String, dynamic> body = {};

      if (config != null) {
        body['config'] = config;
      }

      var response = await http.post(
        url,
        headers: <String, String>{
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${DBHelper.token}',
        },
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to reassign project: ${response.body}');
      }
    } catch (e) {
      print('Error reassigning project: $e');
      rethrow;
    }
  }

  /// Format assignment result for display
  static String formatAssignmentSummary(Map<String, dynamic> result) {
    String summary = '';

    if (result['success'] == true) {
      summary += 'Assignment Successful!\n\n';
      summary += 'Total Tasks: ${result['summary']['total_tasks_assigned']}\n';
      summary += 'Total Users: ${result['summary']['total_users_involved']}\n';
      summary +=
          'Avg Users/Task: ${result['summary']['average_users_per_task']}\n\n';

      // Tasks by priority
      if (result['summary']['tasks_by_priority'] != null) {
        summary += 'Tasks by Priority:\n';
        result['summary']['tasks_by_priority'].forEach((priority, count) {
          summary += '  Priority $priority: $count tasks\n';
        });
      }
    } else {
      summary = 'Assignment failed: ${result['error'] ?? 'Unknown error'}';
    }

    return summary;
  }
}
