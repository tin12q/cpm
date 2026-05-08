class ApiConfig {
  // Change this to your local API or production API
  static const String baseUrl =
      'http://192.168.100.152:1337'; // For local development (phone access)
  // static const String baseUrl = 'http://localhost:1337'; // For emulator
  // static const String baseUrl = 'https://api-cpm.tin12q.org'; // For production

  // API Endpoints
  static const String loginEndpoint = '$baseUrl/api/auth/login';
  static const String registerEndpoint = '$baseUrl/api/auth/register';
  static const String projectsEndpoint = '$baseUrl/api/projects';
  static const String tasksEndpoint = '$baseUrl/api/tasks';
  static const String usersEndpoint = '$baseUrl/api/users';
  static const String teamsEndpoint = '$baseUrl/api/teams';
  static const String assignmentsEndpoint = '$baseUrl/api/assignments';

  // Assignment specific endpoints
  static String assignmentPreview = '$assignmentsEndpoint/preview';
  static String assignmentApply = '$assignmentsEndpoint/apply';
  static String assignmentDefaultConfig = '$assignmentsEndpoint/default-config';
  static String assignmentOverride(String taskId) =>
      '$assignmentsEndpoint/$taskId/override';
  static String reassignProject(String projectId) =>
      '$assignmentsEndpoint/reassign-project/$projectId';
}
