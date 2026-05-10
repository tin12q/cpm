import 'dart:io';
import 'package:path_provider/path_provider.dart';

import 'package:flutter/services.dart';
import 'package:qlcv/utils/logger.dart';
import 'package:qlcv/config/api_config.dart';
import 'package:qlcv/model/dep.dart';
import 'package:qlcv/model/task.dart';
import 'package:qlcv/model/project.dart';
import 'package:qlcv/utils/status_helper.dart';
import 'emp.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:qlcv/utils/session_storage.dart' as session_storage;

class DBHelper {
  static var client = http.Client();
  static List<Task> tasks = [];
  static String token = '';
  static Employee mainUser = Employee(name: '', role: '', id: '');
  static List<Project> projects = [];
  static List<Task> projectTasks = [];
  static List<Employee> employees = [];
  static List<Dep> deps = [];
  static var empMap = {};
  static var depMap = {};
  static String currentDepName = '';
  static String currentDepId = '';
  static String currentProjectId = '';
  static List<Employee> empProject = [];

  static List<Project> resProjects = [];
  static List<Task> resTasks = [];

  // mainUser file image
  static File? imageFile;
  static String? imagePath;
  static Future<void> getProject(
      {int page = 1, int limit = 10, bool clearFirst = false}) async {
    try {
      if (clearFirst) {
        projects.clear();
        resProjects.clear();
      }
      var url = Uri.parse(
          '${ApiConfig.baseUrl}/api/projects/?page=$page&limit=$limit');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        if (data.isEmpty) {
          hasMoreProjects = false;
          return;
        }
        for (var project in data) {
          projects.add(Project(
            id: project['_id'],
            title: project['title'] ?? 'default_value',
            description: project['description'] ?? 'default_value',
            status: StatusHelper.normalizeStatus(
                project['status']?.toString() ?? 'in_progress'),
            endDate: DateTime.fromMillisecondsSinceEpoch(
                int.parse(project['due_date'].toString())),
            dep: project['team'] ?? 'default_value',
          ));
          resProjects.add(Project(
            id: project['_id'],
            title: project['title'] ?? 'default_value',
            description: project['description'] ?? 'default_value',
            status: StatusHelper.normalizeStatus(
                project['status']?.toString() ?? 'in_progress'),
            endDate: DateTime.fromMillisecondsSinceEpoch(
                int.parse(project['due_date'].toString())),
            dep: project['team'] ?? 'default_value',
          ));
        }
      } else {
        throw Exception('Failed to get projects.');
      }
    } catch (e) {
      AppLogger.error(
          'Failed to get projects in getProject', e, null, 'DBHelper');
    }
  }

  static Future<void> getEmp() async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/users/getAll');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        for (var emp in data) {
          employees.add(
              Employee(name: emp['name'], role: emp['role'], id: emp['_id']));
        }
      } else {
        throw Exception('Failed to get employees.');
      }
    } catch (e) {
      AppLogger.error('Failed to get employees in getEmp', e, null, 'DBHelper');
    }
  }

  static Future<void> getDep() async {
    deps.clear();
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/teams/');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        // Use Set to track unique IDs
        final seenIds = deps.map((d) => d.id).toSet();
        for (var dep in data) {
          final depId = dep['_id'];
          // Only add if not already in deps
          if (!seenIds.contains(depId)) {
            List<String> members = List<String>.from(dep['members']);
            deps.add(Dep(id: depId, name: dep['name'], emp: members));
            seenIds.add(depId);
          }
        }
      } else {
        throw Exception('Failed to get departments.');
      }
    } catch (e) {
      AppLogger.error('Failed to get departments', e, null, 'DBHelper');
    }
  }

  static Future<void> updateDep() async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/teams/');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        for (var dep in data) {
          depMap[dep['name']] = dep['members'];
        }
      } else {
        throw Exception('Failed to update departments.');
      }
    } catch (e) {
      AppLogger.error('Failed to update departments', e, null, 'DBHelper');
    }
  }

  static Future<void> getDepNameById(String id) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/teams/$id');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        currentDepName = data['name'];
      } else {
        throw Exception('Failed to get team name.');
      }
    } catch (e) {
      AppLogger.error('Failed to get team name', e, null, 'DBHelper');
      throw Exception('Failed to get team name.');
    }
  }

  static Future<void> getDepIdByName(String name) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/teams/name/$name');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        currentDepId = data['_id'];
      } else {
        throw Exception('Failed to get team id.');
      }
    } catch (e) {
      AppLogger.error('Failed to get team id', e, null, 'DBHelper');
    }
  }

  static Future<void> getEmpByProjectId(String projectId) async {
    empProject.clear();
    try {
      // First get the project to find all teams
      var url = Uri.parse('${ApiConfig.baseUrl}/api/projects/$projectId');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        var projectData = jsonDecode(response.body);

        // Get teams array from project (handle both 'teams' and legacy 'team' field)
        List<String> teamIds = [];
        if (projectData['teams'] != null) {
          teamIds =
              (projectData['teams'] as List).map((t) => t.toString()).toList();
        } else if (projectData['team'] != null) {
          teamIds = [projectData['team'].toString()];
        }

        // Use Set to track unique employee IDs
        Set<String> uniqueEmpIds = {};

        // Get employees from each team
        for (var teamId in teamIds) {
          url = Uri.parse('${ApiConfig.baseUrl}/api/teams/$teamId');
          response = await http.get(
            url,
            headers: <String, String>{
              'Authorization': 'Bearer $token',
            },
          );

          if (response.statusCode == 200) {
            var teamData = jsonDecode(response.body);
            if (teamData['members'] != null) {
              for (var empId in teamData['members']) {
                String empIdStr = empId.toString();
                // Only fetch if we haven't seen this employee yet
                if (!uniqueEmpIds.contains(empIdStr)) {
                  uniqueEmpIds.add(empIdStr);

                  url = Uri.parse('${ApiConfig.baseUrl}/api/users/$empIdStr');
                  response = await http.get(
                    url,
                    headers: <String, String>{
                      'Authorization': 'Bearer $token',
                    },
                  );

                  if (response.statusCode == 200) {
                    var empData = jsonDecode(response.body);
                    empProject.add(Employee(
                        name: empData['name'],
                        role: empData['role'],
                        id: empData['_id']));
                  }
                }
              }
            }
          }
        }
      } else {
        throw Exception('Failed to get project.');
      }
    } catch (e) {
      AppLogger.error(
          'Failed to get employees by project', e, null, 'DBHelper');
    }
  }

  static Future<void> getEmpProject(String projectId) async {
    empProject.clear();
  }

  static Future<void> getMainUser({required String id}) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/users/$id');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        mainUser =
            Employee(name: data['name'], role: data['role'], id: data['_id']);
      } else {
        throw Exception('Failed to get main user.');
      }
    } catch (e) {
      AppLogger.error('Failed to get main user', e, null, 'DBHelper');
    }
  }

  static Future<void> deleteTask(Task task) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/tasks/${task.id}');
      var response = await http.delete(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        tasks.clear();
        AppLogger.info('Task deleted successfully', 'DBHelper');
      } else {
        throw Exception('Failed to delete task.');
      }
    } catch (e) {
      AppLogger.error('Failed to delete task', e, null, 'DBHelper');
    }
  }

  static Future<void> addProject(Project project) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/projects');
      var dateToMiliseconds = project.endDate.millisecondsSinceEpoch;
      var response = await http.post(url, headers: <String, String>{
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer $token',
      }, body: <String, String>{
        'title': project.title,
        'description': project.description,
        'status': 'in_progress',
        'teams':
            project.teams.isNotEmpty ? project.teams.join(',') : currentDepId,
        'due_date': dateToMiliseconds.toString(),
      });
      if (response.statusCode == 201) {
        AppLogger.info('Project added successfully', 'DBHelper');
      } else {
        throw Exception('Failed to add project.');
      }
    } catch (e) {
      AppLogger.error('Failed to add project', e, null, 'DBHelper');
    }
  }

  static Future<void> deleteProject(Project project) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/projects/${project.id}');
      var response = await http.delete(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        projects.clear();
        AppLogger.info('Project deleted successfully', 'DBHelper');
      } else {
        throw Exception('Failed to delete project.');
      }
    } catch (e) {
      AppLogger.error('Failed to delete project', e, null, 'DBHelper');
    }
  }

  static Future<void> updateProject(Project project) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/projects/${project.id}');
      var dateToMiliseconds = project.endDate.millisecondsSinceEpoch;
      var response = await http.put(
        url,
        headers: <String, String>{
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Bearer $token',
        },
        body: <String, String>{
          'title': project.title,
          'description': project.description,
          'status': StatusHelper.normalizeStatus(project.status),
          'due_date': dateToMiliseconds.toString(),
          'teams': project.teams.join(','),
        },
      );
      if (response.statusCode == 200) {
        projects.clear();
        AppLogger.info('Project updated successfully', 'DBHelper');
      } else {
        throw Exception('Failed to update project.');
      }
    } catch (e) {
      AppLogger.error('Failed to update project', e, null, 'DBHelper');
    }
  }

  static Future<void> taskUpdate(
      {int page = 1, int limit = 20, bool clearFirst = false}) async {
    if (clearFirst) {
      tasks.clear();
      projectTasks.clear();
      resTasks.clear();
    }
    try {
      var url =
          Uri.parse('${ApiConfig.baseUrl}/api/tasks/?page=$page&limit=$limit');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        if (data.isEmpty) {
          hasMoreTasks = false;
          return;
        }
        for (var task in data) {
          List<String> members = (task['assigned_to'] as List<dynamic>)
              .map((item) => item.toString())
              .toList();
          if (mainUser.role == 'admin') {
            tasks.add(Task(
                id: task['_id'],
                title: task['title'],
                description: task['description'],
                status: StatusHelper.normalizeStatus(
                    task['status']?.toString() ?? 'in_progress'),
                project: task['project'],
                endDate: DateTime.fromMillisecondsSinceEpoch(
                    int.parse(task['due_date'].toString())),
                emp: members,
                difficulty: task['difficulty'] ?? 2,
                priority: task['priority'] ?? 3,
                canParallelize: task['can_parallelize'] ?? true));
            resTasks.add(Task(
                id: task['_id'],
                title: task['title'],
                description: task['description'],
                status: StatusHelper.normalizeStatus(
                    task['status']?.toString() ?? 'in_progress'),
                project: task['project'],
                endDate: DateTime.fromMillisecondsSinceEpoch(
                    int.parse(task['due_date'].toString())),
                emp: members,
                difficulty: task['difficulty'] ?? 2,
                priority: task['priority'] ?? 3,
                canParallelize: task['can_parallelize'] ?? true));
          } else {
            if (members.contains(mainUser.id)) {
              tasks.add(Task(
                  id: task['_id'],
                  title: task['title'],
                  description: task['description'],
                  status: StatusHelper.normalizeStatus(
                      task['status']?.toString() ?? 'in_progress'),
                  project: task['project'],
                  endDate: DateTime.fromMillisecondsSinceEpoch(
                      int.parse(task['due_date'].toString())),
                  emp: members,
                  difficulty: task['difficulty'] ?? 2,
                  priority: task['priority'] ?? 3,
                  canParallelize: task['can_parallelize'] ?? true));
              resTasks.add(Task(
                  id: task['_id'],
                  title: task['title'],
                  description: task['description'],
                  status: StatusHelper.normalizeStatus(
                      task['status']?.toString() ?? 'in_progress'),
                  project: task['project'],
                  endDate: DateTime.fromMillisecondsSinceEpoch(
                      int.parse(task['due_date'].toString())),
                  emp: members,
                  difficulty: task['difficulty'] ?? 2,
                  priority: task['priority'] ?? 3,
                  canParallelize: task['can_parallelize'] ?? true));
            }
          }
        }
      } else {
        throw Exception('Failed to update tasks.');
      }
    } catch (e) {
      AppLogger.error('Failed to update tasks', e, null, 'DBHelper');
    }
  }

  static Future<void> projectUpdate() async {
    projects.clear();
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/projects/all');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        for (var project in data) {
          // Handle both new teams array and legacy team field
          List<String> projectTeams = [];
          if (project['teams'] != null) {
            projectTeams =
                (project['teams'] as List).map((t) => t.toString()).toList();
          } else if (project['team'] != null) {
            projectTeams = [project['team'].toString()];
          }

          projects.add(Project(
            id: project['_id'],
            title: project['title'] ?? 'default_value',
            description: project['description'] ?? 'default_value',
            status: StatusHelper.normalizeStatus(
                project['status']?.toString() ?? 'in_progress'),
            endDate: DateTime.parse(project['due_date'].toString()),
            teams: projectTeams,
          ));
        }
      } else {
        throw Exception('Failed to get projects.');
      }
    } catch (e) {
      AppLogger.error(
          'Failed to get projects in projectUpdate', e, null, 'DBHelper');
    }
  }

  static Future<void> taskUpdateWithProjectId(
    String projectId, {
    int limit = 200,
  }) async {
    projectTasks.clear();
    try {
      final url = Uri.parse('${ApiConfig.baseUrl}/api/tasks/project/$projectId')
          .replace(queryParameters: {
        'page': '1',
        'limit': limit.toString(),
      });
      final response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        for (final task in data) {
          final members = (task['assigned_to'] as List<dynamic>? ?? [])
              .map((item) {
                if (item is Map<String, dynamic>) {
                  return item['_id']?.toString() ??
                      item['id']?.toString() ??
                      '';
                }
                return item.toString();
              })
              .where((id) => id.isNotEmpty)
              .toList();

          final parsedTask = Task(
            id: task['_id'],
            title: task['title'] ?? '',
            description: task['description'] ?? '',
            status: StatusHelper.normalizeStatus(
                task['status']?.toString() ?? 'in_progress'),
            project: task['project']?.toString() ?? projectId,
            endDate: DateTime.fromMillisecondsSinceEpoch(
                int.parse(task['due_date'].toString())),
            emp: members,
            difficulty: task['difficulty'] ?? 2,
            priority: task['priority'] ?? 3,
            canParallelize: task['can_parallelize'] ?? true,
          );

          projectTasks.add(parsedTask);

          final existingIndex =
              tasks.indexWhere((item) => item.id == parsedTask.id);
          if (existingIndex >= 0) {
            tasks[existingIndex] = parsedTask;
          } else if (mainUser.role == 'admin' ||
              parsedTask.emp.contains(mainUser.id)) {
            tasks.add(parsedTask);
          }
        }
        updateTaskEMP();
      } else {
        throw Exception('Failed to load project tasks.');
      }
    } catch (e) {
      AppLogger.error(
          'Failed to load tasks for project $projectId', e, null, 'DBHelper');
    }
  }

  static Future<void> searchProjectByName(String name) async {
    projects.clear();
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/projects/search')
          .replace(queryParameters: {
        'search': name,
        'page': '1',
        'limit': '50',
      });
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        for (var project in data) {
          // Handle both new teams array and legacy team field
          List<String> projectTeams = [];
          if (project['teams'] != null) {
            projectTeams =
                (project['teams'] as List).map((t) => t.toString()).toList();
          } else if (project['team'] != null) {
            projectTeams = [project['team'].toString()];
          }

          projects.add(Project(
            id: project['_id'],
            title: project['title'] ?? 'default_value',
            description: project['description'] ?? 'default_value',
            status: StatusHelper.normalizeStatus(
                project['status']?.toString() ?? 'in_progress'),
            endDate: DateTime.fromMillisecondsSinceEpoch(
                int.parse(project['due_date'].toString())),
            teams: projectTeams,
          ));
        }
      } else {
        throw Exception('Failed to search projects.');
      }
    } catch (e) {
      AppLogger.error('Failed to search projects', e, null, 'DBHelper');
    }
  }

  static Future<void> logIn(
      {required String email, required String password}) async {
    try {
      var url = Uri.parse(ApiConfig.loginEndpoint);
      var response = await http.post(
        url,
        headers: <String, String>{
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: <String, String>{
          'username': email,
          'password': password,
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        final authHeader = response.headers['authorization'];
        final userId = data['id']?.toString();

        if (authHeader == null || !authHeader.startsWith('Bearer ')) {
          throw Exception('Login response did not include a token.');
        }
        if (userId == null || userId.isEmpty) {
          throw Exception('Login response did not include a user id.');
        }

        token = authHeader.split(" ")[1];
        await session_storage.saveSession(token: token, userId: userId);
        await getMainUser(id: userId);

        if (mainUser.id.isEmpty) {
          throw Exception('Failed to load logged in user.');
        }
      } else {
        String message = 'Failed to login.';
        try {
          final data = jsonDecode(response.body);
          message = data['error']?.toString() ?? message;
        } catch (_) {}
        throw Exception(message);
      }
    } catch (e) {
      AppLogger.error('Failed to login', e, null, 'DBHelper');
      rethrow;
    }
  }

  static Future<void> register({
    required String name,
    required String email,
    required String password,
    required String role,
  }) async {
    try {
      var url = Uri.parse(ApiConfig.registerEndpoint);
      var response = await http.post(
        url,
        headers: <String, String>{
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: <String, String>{
          'name': name,
          'email': email,
          'username': email,
          'password': password,
          'role': role,
        },
      );

      if (response.statusCode != 201) {
        String message = 'Failed to register.';
        try {
          final data = jsonDecode(response.body);
          message = data['error']?.toString() ?? message;
        } catch (_) {}
        throw Exception(message);
      }
    } catch (e) {
      AppLogger.error('Failed to register', e, null, 'DBHelper');
      rethrow;
    }
  }

  static Future<void> updateAvater(File file) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/file/upload');
      var request = http.MultipartRequest('POST', url);
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(await http.MultipartFile.fromPath('file', file.path));
      var response = await request.send();
      if (response.statusCode == 200) {
        AppLogger.info('Avatar uploaded successfully', 'DBHelper');
      } else {
        throw Exception('Failed to upload avatar.');
      }
    } catch (e) {
      AppLogger.error('Failed to upload avatar', e, null, 'DBHelper');
    }
  }

  static Future<void> addUser() async {
    try {
      final String res = await rootBundle.loadString('assets/users.json');
      final data = json.decode(res);

      if (data is List) {
        for (var item in data) {
          AppLogger.debug('Processing user: ${item['name']}', 'DBHelper');
          var url = Uri.parse('${ApiConfig.baseUrl}/api/users/');
          var response = await http.post(url, headers: <String, String>{
            'Authorization': 'Bearer $token',
          }, body: <String, String>{
            'name': item['name'],
            'email': item['email'],
            'team': item['team'],
            'role': item['role'],
          });

          if (response.statusCode == 201) {
            AppLogger.info('User added successfully', 'DBHelper');
          } else {
            AppLogger.warning(
                'Failed to add user. Status code: ${response.statusCode}, Body: ${response.body}',
                'DBHelper');
          }
        }
      } else {
        AppLogger.warning('JSON data is not a list', 'DBHelper');
      }
    } catch (e) {
      AppLogger.error('Failed to add user', e, null, 'DBHelper');
    }
  }

  // static updateUid() {
  //   final FirebaseAuth auth = FirebaseAuth.instance;
  //   final User? user = auth.currentUser;
  //   final uid = user!.uid;
  //   CollectionReference fbTask = FirebaseFirestore.instance.collection('Emp');
  //   //add uid to firebase where email is equal to email
  //   fbTask
  //       .where('Email', isEqualTo: user.email)
  //       .get()
  //       .then((value) => value.docs[0].reference.update({'Id': uid}));
  // }

  static Future<void> getAvatar() async {
    imageFile = null;
    try {
      var url = Uri.parse(
          '${ApiConfig.baseUrl}/api/file/download/${mainUser.id}'); // Adjust the filename accordingly
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token', // Include your token if necessary
        },
      );
      if (response.statusCode == 200) {
        // Save the file locally
        final tempDir = await getTemporaryDirectory();
        final filePath = '${tempDir.path}/avatar.jpg';
        File file = File(filePath);
        await file.writeAsBytes(response.bodyBytes);
        imageFile = file;
      } else {
        throw Exception('Failed to get avatar.');
      }
    } catch (e) {
      AppLogger.error('Failed to get avatar', e, null, 'DBHelper');
    }
  }

  static Future<void> saveImage() async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/file/upload');
      var request = http.MultipartRequest('POST', url);
      request.headers['Authorization'] = 'Bearer $token';
      request.fields['filename'] = mainUser.id;

      var pic = await http.MultipartFile.fromPath("file", imageFile!.path);
      request.files.add(pic);
      var response = await request.send();
      if (response.statusCode == 200) {
        AppLogger.info('Image uploaded successfully', 'DBHelper');
      } else {
        throw Exception('Failed to upload image.');
      }
    } catch (e) {
      AppLogger.error('Failed to upload image', e, null, 'DBHelper');
    }
  }

  static Future<void> addTask(Task task) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/tasks/');
      AppLogger.debug('Adding task: ${task.title}', 'DBHelper');
      String empId = task.emp[0];
      var dateToMiliseconds = task.endDate.millisecondsSinceEpoch;
      var response = await http.post(
        url,
        headers: <String, String>{
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Bearer $token',
        },
        body: <String, String>{
          'title': task.title,
          'description': task.description,
          'status': StatusHelper.normalizeStatus(task.status),
          'assigned_to': [empId].join(','),
          'project': currentProjectId,
          'due_date': dateToMiliseconds.toString(),
        },
      );
      AppLogger.debug(
          'Response status code: ${response.statusCode}', 'DBHelper');
      if (response.statusCode == 201) {
        projectTasks.clear();
        AppLogger.info('Task added successfully', 'DBHelper');
      } else {
        throw Exception('Failed to add task.');
      }
    } catch (e) {
      AppLogger.error('Failed to add task', e, null, 'DBHelper');
    }
  }

  static Future<void> createUser(
      {required String name,
      required String email,
      required String role,
      required String dep}) async {
    //create firebase auth user with email and password
    try {} on Exception catch (e) {
      AppLogger.error('Failed to create user', e, null, 'DBHelper');
    }
  }

  //update Uid of all Employees in firebase to match their Uid in firebase auth
  static updateUID() async {}

  static Future<void> updateTask(Task task) async {
    try {
      var url = Uri.parse('${ApiConfig.baseUrl}/api/tasks/${task.id}');
      var response = await http.put(
        url,
        headers: <String, String>{
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Bearer $token',
        },
        body: <String, String>{
          'title': task.title,
          'description': task.description,
          'status': StatusHelper.normalizeStatus(task.status),
          'due_date': task.endDate.millisecondsSinceEpoch.toString(),
          'assigned_to': task.emp.join(','),
          'difficulty': task.difficulty.toString(),
          'priority': task.priority.toString(),
          'can_parallelize': task.canParallelize.toString(),
        },
      );

      if (response.statusCode == 200) {
        tasks.clear();
        projectTasks.clear();
        AppLogger.info('Task updated successfully', 'DBHelper');
      } else {
        throw Exception('Failed to update task.');
      }
    } catch (e) {
      AppLogger.error('Failed to update task', e, null, 'DBHelper');
    }
  }

  //update emp list of task from uid to name
  static updateTaskEMP() {
    for (Task task in tasks) {
      for (var i = 0; i < task.emp.length; i++) {
        if (empMap[task.emp[i]] != null) {
          task.emp[i] = empMap[task.emp[i]].name;
        } else {
          // print('No employee found for id ${task.emp[i]}');
        }
      }
    }
  }

  static updateDepEMP() {
    for (Dep dep in deps) {
      for (var i = 0; i < dep.emp.length; i++) {
        dep.emp[i] = empMap[dep.emp[i]].name;
      }
    }
  }

  static void initMap() {
    empMap = {for (var e in employees) e.id: e};
    depMap = {for (var d in deps) d.name: d.emp};
  }

  static Future<bool> restoreSession() async {
    if (token.isNotEmpty && mainUser.id.isNotEmpty) {
      return true;
    }

    final savedToken = await session_storage.readToken();
    final savedUserId = await session_storage.readUserId();
    if (savedToken == null ||
        savedToken.isEmpty ||
        savedUserId == null ||
        savedUserId.isEmpty) {
      return false;
    }

    token = savedToken;
    await getMainUser(id: savedUserId);
    if (mainUser.id.isEmpty) {
      token = '';
      await session_storage.clearSession();
      return false;
    }

    return true;
  }

  static Future<void> logOut() async {
    token = '';
    mainUser = Employee(name: '', role: '', id: '');
    await session_storage.clearSession();
    reset();
  }

  static int currentProjectPage = 1;
  static int currentTaskPage = 1;
  static bool hasMoreProjects = true;
  static bool hasMoreTasks = true;
  static int totalProjectCount = 0;
  static int totalTaskCount = 0;

  static void resetAndFetchData() async {
    DBHelper.reset();
    currentProjectPage = 1;
    currentTaskPage = 1;
    hasMoreProjects = true;
    hasMoreTasks = true;

    await DBHelper.getEmp();
    await DBHelper.getDep();
    await DBHelper.taskUpdate(
        page: 1, limit: 20, clearFirst: true); // Load first 20 tasks
    await DBHelper.getProject(
        page: 1, limit: 10, clearFirst: true); // Load first 10 projects
    // Avatar is fetched only when Menu page is opened
    DBHelper.initMap();
    DBHelper.updateTaskEMP();
    DBHelper.projectTasks.clear();
  }

  // Load specific page of projects (replaces infinite scroll)
  static Future<void> loadProjectsPage(
      {required int page, required int limit}) async {
    projects.clear();
    resProjects.clear();
    currentProjectPage = page;

    try {
      var url = Uri.parse(
          '${ApiConfig.baseUrl}/api/projects/?page=$page&limit=$limit');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        if (data.isEmpty) {
          hasMoreProjects = false;
          totalProjectCount = (page - 1) * limit;
          return;
        }
        for (var project in data) {
          // Handle both new teams array and legacy team field
          List<String> projectTeams = [];
          if (project['teams'] != null) {
            projectTeams =
                (project['teams'] as List).map((t) => t.toString()).toList();
          } else if (project['team'] != null) {
            projectTeams = [project['team'].toString()];
          }

          projects.add(Project(
            id: project['_id'],
            title: project['title'] ?? 'default_value',
            description: project['description'] ?? 'default_value',
            status: StatusHelper.normalizeStatus(
                project['status']?.toString() ?? 'in_progress'),
            endDate: DateTime.fromMillisecondsSinceEpoch(
                int.parse(project['due_date'].toString())),
            teams: projectTeams,
          ));
          resProjects.add(Project(
            id: project['_id'],
            title: project['title'] ?? 'default_value',
            description: project['description'] ?? 'default_value',
            status: StatusHelper.normalizeStatus(
                project['status']?.toString() ?? 'in_progress'),
            endDate: DateTime.fromMillisecondsSinceEpoch(
                int.parse(project['due_date'].toString())),
            teams: projectTeams,
          ));
        }
        hasMoreProjects = data.length >= limit;
        if (!hasMoreProjects) {
          totalProjectCount = (page - 1) * limit + data.length as int;
        } else {
          totalProjectCount = page * limit + 1; // At least one more page
        }
      }
    } catch (e) {
      AppLogger.error('Failed to load projects page', e, null, 'DBHelper');
    }
  }

  // Load more projects for infinite scroll (deprecated - kept for compatibility)
  static Future<void> loadMoreProjects() async {
    if (!hasMoreProjects) return;

    currentProjectPage++;
    try {
      var url = Uri.parse(
          '${ApiConfig.baseUrl}/api/projects/?page=$currentProjectPage&limit=10');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        if (data.isEmpty) {
          hasMoreProjects = false;
          return;
        }
        for (var project in data) {
          // Handle both new teams array and legacy team field
          List<String> projectTeams = [];
          if (project['teams'] != null) {
            projectTeams =
                (project['teams'] as List).map((t) => t.toString()).toList();
          } else if (project['team'] != null) {
            projectTeams = [project['team'].toString()];
          }

          projects.add(Project(
            id: project['_id'],
            title: project['title'] ?? 'default_value',
            description: project['description'] ?? 'default_value',
            status: StatusHelper.normalizeStatus(
                project['status']?.toString() ?? 'in_progress'),
            endDate: DateTime.fromMillisecondsSinceEpoch(
                int.parse(project['due_date'].toString())),
            teams: projectTeams,
          ));
        }
      }
    } catch (e) {
      AppLogger.error('Failed to load more projects', e, null, 'DBHelper');
    }
  }

  // Load specific page of tasks (replaces infinite scroll)
  static Future<void> loadTasksPage(
      {required int page, required int limit}) async {
    tasks.clear();
    resTasks.clear();
    currentTaskPage = page;

    try {
      var url =
          Uri.parse('${ApiConfig.baseUrl}/api/tasks/?page=$page&limit=$limit');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        if (data.isEmpty) {
          hasMoreTasks = false;
          totalTaskCount = (page - 1) * limit;
          return;
        }
        for (var task in data) {
          List<String> members = (task['assigned_to'] as List<dynamic>)
              .map((item) => item.toString())
              .toList();
          if (mainUser.role == 'admin' || members.contains(mainUser.id)) {
            tasks.add(Task(
                id: task['_id'],
                title: task['title'],
                description: task['description'],
                status: StatusHelper.normalizeStatus(
                    task['status']?.toString() ?? 'in_progress'),
                project: task['project'],
                endDate: DateTime.fromMillisecondsSinceEpoch(
                    int.parse(task['due_date'].toString())),
                emp: members,
                difficulty: task['difficulty'] ?? 2,
                priority: task['priority'] ?? 3,
                canParallelize: task['can_parallelize'] ?? true));
            resTasks.add(Task(
                id: task['_id'],
                title: task['title'],
                description: task['description'],
                status: StatusHelper.normalizeStatus(
                    task['status']?.toString() ?? 'in_progress'),
                project: task['project'],
                endDate: DateTime.fromMillisecondsSinceEpoch(
                    int.parse(task['due_date'].toString())),
                emp: members,
                difficulty: task['difficulty'] ?? 2,
                priority: task['priority'] ?? 3,
                canParallelize: task['can_parallelize'] ?? true));
          }
        }
        updateTaskEMP();
        hasMoreTasks = data.length >= limit;
        if (!hasMoreTasks) {
          totalTaskCount = (page - 1) * limit + data.length as int;
        } else {
          totalTaskCount = page * limit + 1; // At least one more page
        }
      }
    } catch (e) {
      AppLogger.error('Failed to load tasks page', e, null, 'DBHelper');
    }
  }

  // Load more tasks for infinite scroll (deprecated - kept for compatibility)
  static Future<void> loadMoreTasks() async {
    if (!hasMoreTasks) return;

    currentTaskPage++;
    try {
      var url = Uri.parse(
          '${ApiConfig.baseUrl}/api/tasks/?page=$currentTaskPage&limit=20');
      var response = await http.get(
        url,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        if (data.isEmpty) {
          hasMoreTasks = false;
          return;
        }
        for (var task in data) {
          List<String> members = (task['assigned_to'] as List<dynamic>)
              .map((item) => item.toString())
              .toList();
          if (mainUser.role == 'admin' || members.contains(mainUser.id)) {
            tasks.add(Task(
                id: task['_id'],
                title: task['title'],
                description: task['description'],
                status: StatusHelper.normalizeStatus(
                    task['status']?.toString() ?? 'in_progress'),
                project: task['project'],
                endDate: DateTime.fromMillisecondsSinceEpoch(
                    int.parse(task['due_date'].toString())),
                emp: members,
                difficulty: task['difficulty'] ?? 2,
                priority: task['priority'] ?? 3,
                canParallelize: task['can_parallelize'] ?? true));
          }
        }
        updateTaskEMP();
      }
    } catch (e) {
      AppLogger.error('Failed to load more tasks', e, null, 'DBHelper');
    }
  }

  static reset() {
    employees.clear();
    deps.clear();
    empMap.clear();
    depMap.clear();
    tasks.clear();
    projects.clear();
    projectTasks.clear();
  }
}
