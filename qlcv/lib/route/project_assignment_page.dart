import 'package:flutter/material.dart';
import '../model/db_helper.dart';
import '../model/task.dart';
import '../model/emp.dart';
import '../model/project.dart';
import '../model/color_picker.dart';
import '../services/assignment_service.dart';

class ProjectAssignmentPage extends StatefulWidget {
  final Project project;
  final bool autoSelectUnassigned;

  const ProjectAssignmentPage({
    Key? key,
    required this.project,
    this.autoSelectUnassigned = false,
  }) : super(key: key);

  @override
  State<ProjectAssignmentPage> createState() => _ProjectAssignmentPageState();
}

class _ProjectAssignmentPageState extends State<ProjectAssignmentPage> {
  List<Task> projectTasks = [];
  List<Task> selectedTasks = [];
  List<Employee> availableEmployees = [];
  List<Employee> selectedEmployees = [];
  Map<String, dynamic>? previewResult;
  bool isLoading = false;
  bool showAdvancedSettings = false;

  // Configuration weights
  double wDeadline = 0.5;
  double wPriority = 0.2;
  double wSpeed = 0.2;
  double wSkill = 0.1;
  double wWorkload = 0.05;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      isLoading = true;
    });

    try {
      // Load project tasks
      await DBHelper.taskUpdateWithProjectId(widget.project.id);
      await DBHelper.getEmpByProjectId(widget.project.id);

      // Get default config
      var config = await AssignmentService.getDefaultConfig();

      setState(() {
        projectTasks = List.from(DBHelper.projectTasks);
        availableEmployees = List.from(DBHelper.empProject);

        // Auto-select unassigned tasks if requested
        if (widget.autoSelectUnassigned) {
          selectedTasks = projectTasks
              .where((task) => task.emp.isEmpty || task.emp.length == 0)
              .toList();
        }

        wDeadline = config['W_deadline'] ?? 0.5;
        wPriority = config['W_priority'] ?? 0.2;
        wSpeed = config['W_speed'] ?? 0.2;
        wSkill = config['W_skill'] ?? 0.1;
        wWorkload = config['W_workload'] ?? 0.05;

        isLoading = false;
      });
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading data: $e')),
      );
    }
  }

  Future<void> _previewAssignment() async {
    if (selectedTasks.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one task')),
      );
      return;
    }

    setState(() {
      isLoading = true;
    });

    try {
      List<String> taskIds = selectedTasks.map((t) => t.id as String).toList();
      List<String>? userIds = selectedEmployees.isNotEmpty
          ? selectedEmployees.map((u) => u.id as String).toList()
          : null;

      Map<String, dynamic> config = {
        'W_deadline': wDeadline,
        'W_priority': wPriority,
        'W_speed': wSpeed,
        'W_skill': wSkill,
        'W_workload': wWorkload,
      };

      var result = await AssignmentService.previewAssignment(
        taskIds: taskIds,
        userIds: userIds,
        config: config,
      );

      setState(() {
        previewResult = result;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  Future<void> _applyAssignment() async {
    if (previewResult == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please preview the assignment first')),
      );
      return;
    }

    // Show confirmation dialog
    bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Confirm Assignment'),
          content: const Text(
            'Are you sure you want to apply this assignment? This will update all selected tasks with the new employee assignments.',
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('Cancel'),
              onPressed: () {
                Navigator.of(context).pop(false);
              },
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
              ),
              child: const Text('Apply'),
              onPressed: () {
                Navigator.of(context).pop(true);
              },
            ),
          ],
        );
      },
    );

    if (confirmed != true) {
      return;
    }

    setState(() {
      isLoading = true;
    });

    try {
      List<String> taskIds = selectedTasks.map((t) => t.id as String).toList();
      List<String>? userIds = selectedEmployees.isNotEmpty
          ? selectedEmployees.map((u) => u.id as String).toList()
          : null;

      Map<String, dynamic> config = {
        'W_deadline': wDeadline,
        'W_priority': wPriority,
        'W_speed': wSpeed,
        'W_skill': wSkill,
        'W_workload': wWorkload,
      };

      var result = await AssignmentService.applyAssignment(
        taskIds: taskIds,
        userIds: userIds,
        config: config,
      );

      setState(() {
        isLoading = false;
        previewResult = result;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Assignment applied successfully!'),
          backgroundColor: Colors.green,
        ),
      );

      // Refresh data
      await _loadData();
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Assign Tasks - ${widget.project.title}'),
        backgroundColor: ColorPicker.primary,
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Task Selection Section
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Select Tasks',
                                style: TextStyle(
                                    fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                              TextButton(
                                onPressed: () {
                                  setState(() {
                                    if (selectedTasks.length ==
                                        projectTasks.length) {
                                      selectedTasks.clear();
                                    } else {
                                      selectedTasks = List.from(projectTasks);
                                    }
                                  });
                                },
                                child: Text(
                                    selectedTasks.length == projectTasks.length
                                        ? 'Deselect All'
                                        : 'Select All'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ...projectTasks.map((task) {
                            bool isSelected = selectedTasks.contains(task);
                            bool hasAssignment = task.emp.isNotEmpty;
                            return CheckboxListTile(
                              title: Text(task.title),
                              subtitle: Text(
                                'Status: ${task.status} | Due: ${task.endDateString}${hasAssignment ? ' | Assigned: ${task.emp.length} employees' : ' | Unassigned'}',
                              ),
                              value: isSelected,
                              onChanged: (bool? value) {
                                setState(() {
                                  if (value == true) {
                                    selectedTasks.add(task);
                                  } else {
                                    selectedTasks.remove(task);
                                  }
                                });
                              },
                            );
                          }).toList(),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Employee Selection Section (Optional)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Filter Employees (Optional)',
                            style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Leave empty to consider all employees from project teams',
                            style: TextStyle(color: Colors.grey, fontSize: 12),
                          ),
                          const SizedBox(height: 8),
                          ...availableEmployees.map((emp) {
                            bool isSelected = selectedEmployees.contains(emp);
                            return CheckboxListTile(
                              title: Text(emp.name),
                              subtitle: Text(emp.role),
                              value: isSelected,
                              onChanged: (bool? value) {
                                setState(() {
                                  if (value == true) {
                                    selectedEmployees.add(emp);
                                  } else {
                                    selectedEmployees.remove(emp);
                                  }
                                });
                              },
                            );
                          }).toList(),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Advanced Settings
                  ExpansionTile(
                    title: const Text('Advanced Settings'),
                    initiallyExpanded: showAdvancedSettings,
                    onExpansionChanged: (expanded) {
                      setState(() {
                        showAdvancedSettings = expanded;
                      });
                    },
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          children: [
                            _buildWeightSlider('Deadline Weight', wDeadline,
                                (val) {
                              setState(() => wDeadline = val);
                            }),
                            _buildWeightSlider('Priority Weight', wPriority,
                                (val) {
                              setState(() => wPriority = val);
                            }),
                            _buildWeightSlider('Speed Weight', wSpeed, (val) {
                              setState(() => wSpeed = val);
                            }),
                            _buildWeightSlider('Skill Weight', wSkill, (val) {
                              setState(() => wSkill = val);
                            }),
                            _buildWeightSlider('Workload Weight', wWorkload,
                                (val) {
                              setState(() => wWorkload = val);
                            }),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Preview Result
                  if (previewResult != null)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Assignment Preview',
                              style: TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Status: ${previewResult!['status'] ?? 'Unknown'}',
                              style: const TextStyle(fontSize: 16),
                            ),
                            if (previewResult!['assignments'] != null)
                              ...((previewResult!['assignments'] as List)
                                  .map((assignment) {
                                return Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 4.0),
                                  child: Text(
                                    '• Task: ${assignment['task_title'] ?? 'Unknown'} → ${(assignment['assigned_users'] as List?)?.join(', ') ?? 'None'}',
                                    style: const TextStyle(fontSize: 14),
                                  ),
                                );
                              })),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: ColorPicker.primary,
                            padding: const EdgeInsets.all(16),
                          ),
                          icon: const Icon(Icons.preview),
                          label: const Text('Preview Assignment'),
                          onPressed:
                              selectedTasks.isEmpty ? null : _previewAssignment,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            padding: const EdgeInsets.all(16),
                          ),
                          icon: const Icon(Icons.check),
                          label: const Text('Apply Assignment'),
                          onPressed:
                              previewResult == null ? null : _applyAssignment,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildWeightSlider(
      String label, double value, ValueChanged<double> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label),
            Text(value.toStringAsFixed(2)),
          ],
        ),
        Slider(
          value: value,
          min: 0.0,
          max: 1.0,
          divisions: 20,
          label: value.toStringAsFixed(2),
          onChanged: onChanged,
        ),
      ],
    );
  }
}
