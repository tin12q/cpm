import 'package:flutter/material.dart';
import '../model/db_helper.dart';
import '../model/task.dart';
import '../model/emp.dart';
import '../services/assignment_service.dart';

class AutoAssignmentPage extends StatefulWidget {
  const AutoAssignmentPage({Key? key}) : super(key: key);

  @override
  State<AutoAssignmentPage> createState() => _AutoAssignmentPageState();
}

class _AutoAssignmentPageState extends State<AutoAssignmentPage> {
  List<Task> selectedTasks = [];
  List<Employee> selectedUsers = [];
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
    // Check if user has permission
    if (DBHelper.mainUser.role != 'admin' &&
        DBHelper.mainUser.role != 'manager') {
      // Redirect back if not admin or manager
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Access denied. Only admin and manager can use auto-assignment.'),
            backgroundColor: Colors.red,
          ),
        );
      });
      return;
    }
    _loadDefaultConfig();
  }

  Future<void> _loadDefaultConfig() async {
    try {
      var config = await AssignmentService.getDefaultConfig();
      setState(() {
        wDeadline = config['W_deadline'] ?? 0.5;
        wPriority = config['W_priority'] ?? 0.2;
        wSpeed = config['W_speed'] ?? 0.2;
        wSkill = config['W_skill'] ?? 0.1;
        wWorkload = config['W_workload'] ?? 0.05;
      });
    } catch (e) {
      print('Error loading config: $e');
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
      List<String>? userIds = selectedUsers.isNotEmpty
          ? selectedUsers.map((u) => u.id as String).toList()
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
      List<String>? userIds = selectedUsers.isNotEmpty
          ? selectedUsers.map((u) => u.id as String).toList()
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
      await DBHelper.loadTasksPage(page: 1, limit: 25);
      await DBHelper.loadProjectsPage(page: 1, limit: 25);
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
        title: const Text('Auto Task Assignment'),
        backgroundColor: Colors.blue,
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildTaskSelection(),
                  const SizedBox(height: 20),
                  _buildUserSelection(),
                  const SizedBox(height: 20),
                  _buildAdvancedSettings(),
                  const SizedBox(height: 20),
                  _buildActionButtons(),
                  const SizedBox(height: 20),
                  if (previewResult != null) _buildPreviewResult(),
                ],
              ),
            ),
    );
  }

  Widget _buildTaskSelection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Select Tasks',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 200,
              child: ListView.builder(
                itemCount: DBHelper.tasks.length,
                itemBuilder: (context, index) {
                  Task task = DBHelper.tasks[index];
                  bool isSelected = selectedTasks.contains(task);

                  return CheckboxListTile(
                    title: Text(task.title),
                    subtitle: Text(
                        'Priority: ${task.priority} | Due: ${task.endDateString}'),
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
                },
              ),
            ),
            Text('${selectedTasks.length} tasks selected'),
          ],
        ),
      ),
    );
  }

  Widget _buildUserSelection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Select Users (Optional)',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const Text(
              'Leave empty to consider all available users',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 150,
              child: ListView.builder(
                itemCount: DBHelper.employees.length,
                itemBuilder: (context, index) {
                  Employee emp = DBHelper.employees[index];
                  bool isSelected = selectedUsers.contains(emp);

                  return CheckboxListTile(
                    title: Text(emp.name),
                    subtitle: Text('Role: ${emp.role}'),
                    value: isSelected,
                    onChanged: (bool? value) {
                      setState(() {
                        if (value == true) {
                          selectedUsers.add(emp);
                        } else {
                          selectedUsers.remove(emp);
                        }
                      });
                    },
                  );
                },
              ),
            ),
            Text('${selectedUsers.length} users selected'),
          ],
        ),
      ),
    );
  }

  Widget _buildAdvancedSettings() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Advanced Settings',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: Icon(showAdvancedSettings
                      ? Icons.expand_less
                      : Icons.expand_more),
                  onPressed: () {
                    setState(() {
                      showAdvancedSettings = !showAdvancedSettings;
                    });
                  },
                ),
              ],
            ),
            if (showAdvancedSettings) ...[
              const SizedBox(height: 10),
              _buildSlider('Deadline Priority', wDeadline, (value) {
                setState(() => wDeadline = value);
              }),
              _buildSlider('Task Priority', wPriority, (value) {
                setState(() => wPriority = value);
              }),
              _buildSlider('User Speed', wSpeed, (value) {
                setState(() => wSpeed = value);
              }),
              _buildSlider('Skill Matching', wSkill, (value) {
                setState(() => wSkill = value);
              }),
              _buildSlider('Workload Penalty', wWorkload, (value) {
                setState(() => wWorkload = value);
              }),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSlider(String label, double value, Function(double) onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('$label: ${value.toStringAsFixed(2)}'),
        Slider(
          value: value,
          min: 0.0,
          max: 1.0,
          divisions: 20,
          onChanged: onChanged,
        ),
      ],
    );
  }

  Widget _buildActionButtons() {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            icon: const Icon(Icons.preview),
            label: const Text('Preview'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue,
              padding: const EdgeInsets.all(16),
            ),
            onPressed: _previewAssignment,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: ElevatedButton.icon(
            icon: const Icon(Icons.check),
            label: const Text('Apply'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              padding: const EdgeInsets.all(16),
            ),
            onPressed: previewResult != null ? _applyAssignment : null,
          ),
        ),
      ],
    );
  }

  Widget _buildPreviewResult() {
    if (previewResult == null) return const SizedBox();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Assignment Result',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            Text(AssignmentService.formatAssignmentSummary(previewResult!)),
            const Divider(),
            const Text(
              'Assigned Tasks:',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            ...((previewResult!['assignments'] as List<dynamic>?) ?? []).map(
              (assignment) => _buildAssignmentCard(assignment),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAssignmentCard(dynamic assignment) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        title: Text(assignment['task']['title']),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Priority: ${assignment['task']['priority']}'),
            Text(
                'Assigned to: ${assignment['assigned_users'].map((u) => u['name']).join(', ')}'),
          ],
        ),
      ),
    );
  }
}
