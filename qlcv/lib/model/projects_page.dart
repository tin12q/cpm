import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';
import 'package:qlcv/main.dart';
import 'package:qlcv/model/db_helper.dart';
import 'package:qlcv/model/project.dart';
import 'package:qlcv/model/task_page.dart';
import 'package:qlcv/route/home.dart';
import 'package:qlcv/route/project_tasks.dart';
import 'package:qlcv/route/project_assignment_page.dart';
import '../home_page.dart';
import 'color_picker.dart';
import 'project.dart';
import 'db_helper.dart';

class ProjectPage extends StatefulWidget {
  final Project project;

  const ProjectPage({
    Key? key,
    required this.project,
  }) : super(key: key);

  State<ProjectPage> createState() => _ProjectPageState(project: project);
}

class _ProjectPageState extends State<ProjectPage> {
  late Project project;
  List<String> selectedTeamIds = [];

  @override
  void initState() {
    super.initState();
    // Use Set to ensure unique team IDs
    selectedTeamIds = project.teams.toSet().toList();
  }

  Future<void> updateProject(Project project, String title, String description,
      DateTime endDate, String status, List<String> teamIds) async {
    DateFormat outputFormat = DateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");

    project.title = title;
    project.description = description;
    project.endDate = endDate;
    project.status = status;
    if (teamIds.isNotEmpty) {
      project.teams = teamIds;
    }

    await DBHelper.updateProject(project);
    DBHelper.projects.clear();
    // await DBHelper.projectUpdate();
  }

  _ProjectPageState({required this.project});

  @override
  Widget build(BuildContext context) {
    // Create TextEditingController for each field
    final titleController = TextEditingController(text: project.title);
    final descriptionController =
        TextEditingController(text: project.description);
    final statusController = TextEditingController(text: project.status);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Project Details'),
        backgroundColor: ColorPicker.accent,
        leading: IconButton(
          icon: const Icon(CupertinoIcons.back),
          onPressed: () {
            Navigator.pop(context);
          },
        ),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Only admin and manager can update projects
                  (DBHelper.mainUser.role == 'admin' ||
                          DBHelper.mainUser.role == 'manager')
                      ? ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: ColorPicker.primary,
                            foregroundColor: ColorPicker.accent,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10.0),
                            ),
                          ),
                          child: Text('Update Project'),
                          onPressed: () {
                            showDialog(
                              context: context,
                              builder: (BuildContext context) {
                                return AlertDialog(
                                  title: const Text('Warning'),
                                  content: const Text(
                                      'Are you sure you want to update this project?'),
                                  actions: <Widget>[
                                    TextButton(
                                      child: const Text('No'),
                                      onPressed: () {
                                        Navigator.of(context)
                                            .pop(); // Closes the dialog
                                      },
                                    ),
                                    TextButton(
                                      child: const Text('Confirm'),
                                      onPressed: () async {
                                        await updateProject(
                                            project,
                                            titleController.text,
                                            descriptionController.text,
                                            project.endDate,
                                            statusController.text,
                                            selectedTeamIds);
                                        if (context.mounted) {
                                          Navigator.of(context)
                                              .pop(); // Close dialog
                                          ScaffoldMessenger.of(context)
                                              .showSnackBar(
                                            const SnackBar(
                                              content: Text(
                                                  'Project updated successfully'),
                                              backgroundColor: Colors.green,
                                              duration: Duration(seconds: 2),
                                            ),
                                          );
                                        }
                                      },
                                    ),
                                  ],
                                );
                              },
                            );
                          },
                        )
                      : Container(
                          child: Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Text(
                              '🔒 Read-only access',
                              style:
                                  TextStyle(color: Colors.grey, fontSize: 12),
                            ),
                          ),
                        ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ColorPicker.primary,
                      foregroundColor: ColorPicker.accent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10.0),
                      ),
                    ),
                    child: Text('Tasks Details'),
                    onPressed: () async {
                      await DBHelper.taskUpdateWithProjectId(project.id);
                      await DBHelper.getEmpByProjectId(
                          DBHelper.currentProjectId);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ProjectTasks(),
                        ),
                      );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12.0),
              // Auto-assignment buttons for admin/manager only
              if (DBHelper.mainUser.role == 'admin' ||
                  DBHelper.mainUser.role == 'manager')
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.orange,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10.0),
                          ),
                        ),
                        icon: Icon(Icons.auto_awesome, size: 18),
                        label: Text('Auto-Assign Unassigned',
                            style: TextStyle(fontSize: 12)),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ProjectAssignmentPage(
                                project: project,
                                autoSelectUnassigned: true,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.deepOrange,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10.0),
                          ),
                        ),
                        icon: Icon(Icons.playlist_add_check, size: 18),
                        label: Text('Auto-Assign Selected',
                            style: TextStyle(fontSize: 12)),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ProjectAssignmentPage(
                                project: project,
                                autoSelectUnassigned: false,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 16.0),
              TextField(
                controller: titleController,
                readOnly: DBHelper.mainUser.role == 'employee',
                style: const TextStyle(
                  fontSize: 24.0,
                  fontWeight: FontWeight.bold,
                ),
                decoration: InputDecoration(
                  suffixIcon: DBHelper.mainUser.role == 'employee'
                      ? Icon(Icons.lock, size: 16, color: Colors.grey)
                      : null,
                ),
              ),
              const SizedBox(height: 8.0),
              TextField(
                controller: descriptionController,
                readOnly: DBHelper.mainUser.role == 'employee',
                style: const TextStyle(fontSize: 16.0),
                decoration: InputDecoration(
                  suffixIcon: DBHelper.mainUser.role == 'employee'
                      ? Icon(Icons.lock, size: 16, color: Colors.grey)
                      : null,
                ),
              ),
              const SizedBox(height: 16.0),
              TextField(
                readOnly: true,
                controller: TextEditingController(
                    text: DateFormat('d/M/yyyy').format(project.endDate)),
                onTap: () async {
                  final selectedDate = await showDatePicker(
                    context: context,
                    initialDate: project.endDate.isAfter(DateTime.now())
                        ? DateTime.now()
                        : project.endDate,
                    firstDate: DateTime.now(),
                    lastDate: DateTime(3000), // set this to a future date
                  );
                  if (selectedDate != null) {
                    setState(() {
                      project.endDate = selectedDate;
                    });
                  }
                },
                style: const TextStyle(fontSize: 16.0),
              ),
              const SizedBox(height: 16.0),
              TextField(
                controller: statusController,
                readOnly: DBHelper.mainUser.role == 'employee',
                style: const TextStyle(fontSize: 16.0),
                decoration: InputDecoration(
                  suffixIcon: DBHelper.mainUser.role == 'employee'
                      ? Icon(Icons.lock, size: 16, color: Colors.grey)
                      : null,
                ),
              ),
              const SizedBox(height: 16.0),
              const Text(
                'Assigned Teams',
                style: TextStyle(fontSize: 18.0, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8.0),
              (DBHelper.mainUser.role == 'admin' ||
                      DBHelper.mainUser.role == 'manager')
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Dropdown for team selection
                        DropdownButtonFormField<String>(
                          key: ValueKey(selectedTeamIds.join(',')),
                          decoration: InputDecoration(
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10.0),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                            hintText: 'Select teams',
                          ),
                          items: () {
                            // Create a map to track unique team IDs
                            final Map<String, dynamic> uniqueTeams = {};
                            for (var dep in DBHelper.deps) {
                              if (!selectedTeamIds.contains(dep.id)) {
                                uniqueTeams[dep.id] = dep;
                              }
                            }
                            return uniqueTeams.values
                                .map((dep) => DropdownMenuItem<String>(
                                      value: dep.id,
                                      child: Text(dep.name),
                                    ))
                                .toList();
                          }(),
                          onChanged: (value) {
                            if (value != null &&
                                !selectedTeamIds.contains(value)) {
                              setState(() {
                                selectedTeamIds.add(value);
                              });
                            }
                          },
                          value: null,
                        ),
                        const SizedBox(height: 12.0),
                        // Display selected teams as chips
                        if (selectedTeamIds.isNotEmpty)
                          Wrap(
                            spacing: 8.0,
                            runSpacing: 8.0,
                            children: selectedTeamIds.map((teamId) {
                              // Find team safely without throwing error
                              final team = DBHelper.deps
                                  .where((d) => d.id == teamId)
                                  .firstOrNull;
                              if (team == null) {
                                // Skip this chip if team not found
                                return const SizedBox.shrink();
                              }
                              return Chip(
                                label: Text(team.name),
                                deleteIcon: Icon(Icons.close, size: 18),
                                onDeleted: () {
                                  setState(() {
                                    selectedTeamIds.remove(teamId);
                                  });
                                },
                                backgroundColor:
                                    ColorPicker.primary.withOpacity(0.2),
                                deleteIconColor: ColorPicker.primary,
                              );
                            }).toList(),
                          ),
                        if (selectedTeamIds.isEmpty)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade50,
                              borderRadius: BorderRadius.circular(8.0),
                              border: Border.all(color: Colors.orange),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.warning,
                                    color: Colors.orange, size: 20),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Please select at least one team',
                                    style: TextStyle(
                                      color: Colors.orange.shade900,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    )
                  : Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey),
                        borderRadius: BorderRadius.circular(10.0),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Project Teams',
                                style: TextStyle(
                                    fontSize: 16.0,
                                    fontWeight: FontWeight.bold),
                              ),
                              Icon(Icons.lock, size: 16, color: Colors.grey),
                            ],
                          ),
                          const SizedBox(height: 12.0),
                          Wrap(
                            spacing: 8.0,
                            runSpacing: 8.0,
                            children: project.teams.map((teamId) {
                              final team = DBHelper.deps.firstWhere(
                                (d) => d.id == teamId,
                                orElse: () => DBHelper.deps.first,
                              );
                              return Chip(
                                label: Text(team.name),
                                backgroundColor: Colors.grey.shade200,
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}
