import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:qlcv/main.dart';
import 'package:qlcv/model/db_helper.dart';
import 'package:qlcv/model/projects_page.dart';
import 'package:qlcv/route/project_tasks.dart';
import '../home_page.dart';
import '../route/home.dart';
import '../utils/status_helper.dart';
import 'color_picker.dart';
import 'task.dart';
import 'db_helper.dart';

class TaskPage extends StatefulWidget {
  final Task task;

  const TaskPage({
    Key? key,
    required this.task,
  }) : super(key: key);

  State<TaskPage> createState() => _TaskPageState(task: task);
}

class _TaskPageState extends State<TaskPage> {
  late Task task;
  List<String> selectedEmployeeIds = [];

  @override
  void initState() {
    super.initState();
    // Use Set to ensure unique employee IDs
    selectedEmployeeIds = task.emp.toSet().toList();
  }

  Future<void> updateTask(Task task, String title, String description,
      DateTime endDate, String status, List<String> employeeIds,
      {int? difficulty, int? priority, bool? canParallelize}) async {
    DateFormat outputFormat = DateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");

    task.title = title;
    task.description = description;
    task.endDate = endDate;
    task.status = status;
    task.emp = employeeIds;
    if (difficulty != null) task.difficulty = difficulty;
    if (priority != null) task.priority = priority;
    if (canParallelize != null) task.canParallelize = canParallelize;

    await DBHelper.updateTask(task);
    DBHelper.tasks.clear();
    DBHelper.projectTasks.clear();
    await DBHelper.taskUpdate();
  }

  _TaskPageState({required this.task});

  @override
  Widget build(BuildContext context) {
    // Create TextEditingController for each field

    final titleController = TextEditingController(text: task.title);
    final descriptionController = TextEditingController(text: task.description);
    String selectedStatus = StatusHelper.normalizeStatus(task.status);
    if (!StatusHelper.taskStatuses.contains(selectedStatus)) {
      selectedStatus = 'in_progress';
    }

    return Scaffold(
      backgroundColor: ColorPicker.backgroundLight,
      appBar: AppBar(
        title: const Text('Task Details'),
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
              Wrap(
                spacing: 12,
                runSpacing: 8,
                alignment: WrapAlignment.spaceBetween,
                children: [
                  // Only admin and manager can update tasks
                  (DBHelper.mainUser.role == 'admin' ||
                          DBHelper.mainUser.role == 'manager')
                      ? ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: ColorPicker.accent,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10.0),
                            ),
                          ),
                          icon: const Icon(Icons.save_outlined, size: 18),
                          label: const Text('Update Task'),
                          onPressed: () {
                            String content =
                                'Are you sure you want to update this task?';

                            showDialog(
                              context: context,
                              builder: (BuildContext context) {
                                return AlertDialog(
                                  title: const Text('Confirm Update'),
                                  content: Text(content),
                                  actions: <Widget>[
                                    TextButton(
                                      child: const Text('No'),
                                      onPressed: () {
                                        Navigator.of(context).pop();
                                      },
                                    ),
                                    TextButton(
                                      child: const Text('Confirm'),
                                      onPressed: () async {
                                        await updateTask(
                                            task,
                                            titleController.text,
                                            descriptionController.text,
                                            task.endDate,
                                            selectedStatus,
                                            selectedEmployeeIds,
                                            difficulty: task.difficulty,
                                            priority: task.priority,
                                            canParallelize:
                                                task.canParallelize);
                                        if (context.mounted) {
                                          Navigator.of(context)
                                              .pop(); // Close dialog
                                          ScaffoldMessenger.of(context)
                                              .showSnackBar(
                                            const SnackBar(
                                              content: Text(
                                                  'Task updated successfully'),
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
                      : SizedBox.shrink(),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ColorPicker.cardBackground,
                      foregroundColor: ColorPicker.accent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10.0),
                      ),
                    ),
                    icon: const Icon(Icons.folder_open, size: 18),
                    label: const Text('View Project'),
                    onPressed: () async {
                      // Find the project for this task
                      final matches = DBHelper.projects
                          .where((p) => p.id == task.project);
                      final project =
                          matches.isNotEmpty ? matches.first : null;
                      if (project != null) {
                        DBHelper.currentProjectId = project.id;
                        await DBHelper.getEmpByProjectId(project.id);
                        if (context.mounted) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) =>
                                  ProjectPage(project: project),
                            ),
                          );
                        }
                      } else {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Project not found'),
                              backgroundColor: Colors.red,
                            ),
                          );
                        }
                      }
                    },
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
                  labelText: 'Task title',
                  border: const OutlineInputBorder(),
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
                  labelText: 'Task description',
                  border: const OutlineInputBorder(),
                  suffixIcon: DBHelper.mainUser.role == 'employee'
                      ? Icon(Icons.lock, size: 16, color: Colors.grey)
                      : null,
                ),
              ),
              const SizedBox(height: 16.0),
              // TextField(
              //   readOnly: true,
              //   controller: TextEditingController(text: DateFormat('d/M/yyyy').format(task.startDate)),
              //   onTap: () async {
              //     final selectedDate = await showDatePicker(
              //       context: context,
              //       initialDate: task.startDate,
              //       firstDate: DateTime(2000),
              //       lastDate: DateTime.now(),
              //     );
              //     if (selectedDate != null) {
              //       setState(() {
              //         task.startDate = selectedDate;
              //       });
              //     }
              //   },
              //   style: const TextStyle(fontSize: 16.0),
              // ),
              const SizedBox(height: 16.0),
              TextField(
                readOnly: true,
                controller: TextEditingController(
                    text: DateFormat('d/M/yyyy').format(task.endDate)),
                onTap: () async {
                  final selectedDate = await showDatePicker(
                    context: context,
                    initialDate: task.endDate.isAfter(DateTime.now())
                        ? task.endDate
                        : DateTime.now(),
                    firstDate: DateTime.now(),
                    lastDate: DateTime(3000), // set this to a future date
                  );
                  if (selectedDate != null) {
                    setState(() {
                      task.endDate = selectedDate;
                    });
                  }
                },
                style: const TextStyle(fontSize: 16.0),
                decoration: const InputDecoration(
                  labelText: 'End date',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16.0),
              DropdownButtonFormField<String>(
                value: selectedStatus,
                decoration: InputDecoration(
                  labelText: 'Task status',
                  border: const OutlineInputBorder(),
                  suffixIcon: DBHelper.mainUser.role == 'employee'
                      ? Icon(Icons.lock, size: 16, color: Colors.grey)
                      : null,
                ),
                items: StatusHelper.taskStatuses
                    .map((status) => DropdownMenuItem<String>(
                          value: status,
                          child: Text(StatusHelper.getStatusLabel(status)),
                        ))
                    .toList(),
                onChanged: (DBHelper.mainUser.role == 'admin' ||
                        DBHelper.mainUser.role == 'manager')
                    ? (value) {
                        if (value != null) {
                          setState(() {
                            selectedStatus = value;
                            task.status = value;
                          });
                        }
                      }
                    : null,
              ),
              const SizedBox(height: 16.0),
              // MCMF Fields Section
              const Text(
                'Task Assignment Parameters',
                style: TextStyle(fontSize: 18.0, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12.0),
              LayoutBuilder(
                builder: (context, constraints) {
                  final stackFields = constraints.maxWidth < 520;
                  final difficultyField = DropdownButtonFormField<int>(
                    value: task.difficulty,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Difficulty',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(value: 1, child: Text('Basic')),
                      DropdownMenuItem(value: 2, child: Text('Easy')),
                      DropdownMenuItem(value: 3, child: Text('Medium')),
                      DropdownMenuItem(value: 4, child: Text('Hard')),
                    ],
                    onChanged: (DBHelper.mainUser.role == 'admin' ||
                            DBHelper.mainUser.role == 'manager')
                        ? (value) {
                            setState(() {
                              task.difficulty = value ?? 2;
                            });
                          }
                        : null,
                  );
                  final priorityField = DropdownButtonFormField<int>(
                    value: task.priority,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Priority',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(value: 1, child: Text('Very Low')),
                      DropdownMenuItem(value: 2, child: Text('Low')),
                      DropdownMenuItem(value: 3, child: Text('Medium')),
                      DropdownMenuItem(value: 4, child: Text('High')),
                      DropdownMenuItem(value: 5, child: Text('Critical')),
                    ],
                    onChanged: (DBHelper.mainUser.role == 'admin' ||
                            DBHelper.mainUser.role == 'manager')
                        ? (value) {
                            setState(() {
                              task.priority = value ?? 3;
                            });
                          }
                        : null,
                  );

                  if (stackFields) {
                    return Column(
                      children: [
                        difficultyField,
                        const SizedBox(height: 12.0),
                        priorityField,
                      ],
                    );
                  }

                  return Row(
                    children: [
                      Expanded(child: difficultyField),
                      const SizedBox(width: 12.0),
                      Expanded(child: priorityField),
                    ],
                  );
                },
              ),
              const SizedBox(height: 12.0),
              Container(
                padding: EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Can Parallelize',
                        style: TextStyle(fontSize: 16.0),
                      ),
                    ),
                    Switch(
                      value: task.canParallelize,
                      onChanged: (DBHelper.mainUser.role == 'admin' ||
                              DBHelper.mainUser.role == 'manager')
                          ? (value) {
                              setState(() {
                                task.canParallelize = value;
                              });
                            }
                          : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16.0),
              const Text(
                'Assigned Employees',
                style: TextStyle(fontSize: 18.0, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8.0),
              (DBHelper.mainUser.role == 'admin' ||
                      DBHelper.mainUser.role == 'manager')
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Dropdown for employee selection
                        DropdownButtonFormField<String>(
                          key: ValueKey(selectedEmployeeIds.join(',')),
                          isExpanded: true,
                          decoration: InputDecoration(
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10.0),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                            hintText: 'Select employees',
                          ),
                          items: () {
                            // Create a map to track unique employee IDs
                            final Map<String, dynamic> uniqueEmps = {};
                            for (var emp in DBHelper.empProject) {
                              if (!selectedEmployeeIds.contains(emp.id)) {
                                uniqueEmps[emp.id] = emp;
                              }
                            }
                            return uniqueEmps.values
                                .map((emp) => DropdownMenuItem<String>(
                                      value: emp.id,
                                      child: Text(
                                        '${emp.name} (${emp.role})',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ))
                                .toList();
                          }(),
                          onChanged: (value) {
                            if (value != null &&
                                !selectedEmployeeIds.contains(value)) {
                              setState(() {
                                selectedEmployeeIds.add(value);
                              });
                            }
                          },
                          value: null,
                        ),
                        const SizedBox(height: 12.0),
                        // Display selected employees as chips
                        if (selectedEmployeeIds.isNotEmpty)
                          Wrap(
                            spacing: 8.0,
                            runSpacing: 8.0,
                            children: selectedEmployeeIds.map((empId) {
                              // Find employee, fallback to empMap if not in empProject
                              final matches = DBHelper.empProject
                                  .where((e) => e.id == empId);
                              var emp =
                                  matches.isNotEmpty ? matches.first : null;
                              if (emp == null &&
                                  DBHelper.empMap.containsKey(empId)) {
                                emp = DBHelper.empMap[empId];
                              }
                              if (emp == null) {
                                // Skip this chip if employee not found
                                return const SizedBox.shrink();
                              }
                              return Chip(
                                label: Text('${emp.name} (${emp.role})'),
                                deleteIcon: Icon(Icons.close, size: 18),
                                onDeleted: () {
                                  setState(() {
                                    selectedEmployeeIds.remove(empId);
                                  });
                                },
                                backgroundColor:
                                    ColorPicker.primary.withOpacity(0.2),
                                deleteIconColor: ColorPicker.primary,
                              );
                            }).toList(),
                          ),
                        if (selectedEmployeeIds.isEmpty)
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
                                    'Please select at least one employee',
                                    style: TextStyle(
                                      color: Colors.orange.shade900,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (DBHelper.empProject.isEmpty)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(8.0),
                              border: Border.all(color: Colors.grey),
                            ),
                            child: const Text(
                              'No employees in this project team',
                              style: TextStyle(color: Colors.grey),
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
                                'Task Employees',
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
                            children: task.empWidget.map((widget) {
                              return Chip(
                                label: widget,
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
