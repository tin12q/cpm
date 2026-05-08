import 'package:flutter/material.dart';
import 'package:qlcv/model/db_helper.dart';
import 'package:qlcv/model/task_page.dart';
import 'package:qlcv/model/projects_page.dart';
import '../home_page.dart';
import '../utils/status_helper.dart';
import 'color_picker.dart';
import 'task.dart';

class TaskCard extends StatelessWidget {
  final Task task;

  const TaskCard({required this.task});
  Future<void> deleteTask(Task task) async {
    await DBHelper.deleteTask(task);
    DBHelper.tasks.clear();
    await DBHelper.taskUpdate();
  }

  @override
  Widget build(BuildContext context) {
    // Get project name
    final matches = DBHelper.projects.where((p) => p.id == task.project);
    final project = matches.isNotEmpty ? matches.first : null;
    final projectName = project?.title ?? 'Unknown Project';
    final assigneeLabel = _assigneeLabel(task);

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12.0),
        side: BorderSide(color: ColorPicker.cardBorder, width: 1),
      ),
      color: ColorPicker.cardBackground,
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(12.0),
        onTap: () {
          showDialog(
              context: context,
              builder: (BuildContext context) {
                return TaskPopupCard(task: task);
              });
        },
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Title and Status Badge
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          task.title,
                          style: const TextStyle(
                            color: ColorPicker.fontDark,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        // Project name chip
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: ColorPicker.accent.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.folder_outlined,
                                  size: 14, color: ColorPicker.accent),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  projectName,
                                  style: TextStyle(
                                    color: ColorPicker.accent,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Status badge
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: StatusHelper.getStatusColor(task.status)
                          .withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: StatusHelper.getStatusColor(task.status)
                            .withOpacity(0.3),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          StatusHelper.getStatusIcon(task.status),
                          size: 14,
                          color: StatusHelper.getStatusColor(task.status),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          StatusHelper.getStatusLabel(task.status),
                          style: TextStyle(
                            color: StatusHelper.getStatusColor(task.status),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Description
              Text(
                (task.description.length > 80)
                    ? '${task.description.substring(0, 80)}...'
                    : task.description,
                style: const TextStyle(
                  color: ColorPicker.fontMedium,
                  fontSize: 14,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _InfoChip(
                    icon: Icons.calendar_today_outlined,
                    label: task.endDateString,
                    color: ColorPicker.fontMedium,
                  ),
                  _InfoChip(
                    icon: task.emp.isEmpty
                        ? Icons.person_add_alt_1_outlined
                        : Icons.people_alt_outlined,
                    label: assigneeLabel,
                    color: task.emp.isEmpty
                        ? ColorPicker.fontMedium
                        : ColorPicker.buttonSuccess,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _CardActionButton(
                        icon: Icons.info_outline,
                        label: 'Info',
                        color: ColorPicker.buttonPrimary,
                        tooltip: 'Task Info',
                        onPressed: () {
                          Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (context) => TaskPage(
                                        task: task,
                                      )));
                        },
                      ),
                      const SizedBox(width: 10),
                      _CardActionButton(
                        icon: Icons.folder_open,
                        label: 'Project',
                        color: ColorPicker.buttonSecondary,
                        tooltip: 'View Project',
                        onPressed: () async {
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
                      const SizedBox(width: 10),
                      (DBHelper.mainUser.role == 'admin' ||
                              DBHelper.mainUser.role == 'manager')
                          ? _CardActionButton(
                              icon: Icons.delete_outline,
                              label: 'Delete',
                              color: ColorPicker.buttonDanger,
                              tooltip: 'Delete Task',
                              onPressed: () {
                                showDialog(
                                  context: context,
                                  builder: (BuildContext context) {
                                    return AlertDialog(
                                      title: const Text('Delete Task'),
                                      content: const Text(
                                          'Are you sure you want to delete this task?'),
                                      actions: <Widget>[
                                        TextButton(
                                          child: const Text('Cancel'),
                                          onPressed: () {
                                            Navigator.of(context).pop();
                                          },
                                        ),
                                        TextButton(
                                          style: TextButton.styleFrom(
                                            foregroundColor:
                                                ColorPicker.buttonDanger,
                                          ),
                                          child: const Text('Delete'),
                                          onPressed: () {
                                            deleteTask(task);
                                            Navigator.pushAndRemoveUntil(
                                              context,
                                              MaterialPageRoute(
                                                  builder: (context) =>
                                                      HomePage()),
                                              (Route<dynamic> route) => false,
                                            );
                                          },
                                        ),
                                      ],
                                    );
                                  },
                                );
                              },
                            )
                          : _CardActionButton(
                              icon: Icons.lock_outline,
                              label: 'Locked',
                              color: ColorPicker.fontLight,
                              tooltip: 'No Permission',
                              onPressed: () {
                                showDialog(
                                  context: context,
                                  builder: (BuildContext context) {
                                    return AlertDialog(
                                      title: const Text('Access Denied'),
                                      content: const Text(
                                          'Employees cannot delete tasks. Please contact your manager or admin.'),
                                      actions: [
                                        TextButton(
                                          onPressed: () =>
                                              Navigator.pop(context),
                                          child: const Text('OK'),
                                        ),
                                      ],
                                    );
                                  },
                                );
                              },
                            ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TaskBoxList extends StatelessWidget {
  final List<Task> tasks;

  const TaskBoxList({
    required this.tasks,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      itemCount: tasks.length,
      itemBuilder: (context, index) {
        if (index >= 0 && index < tasks.length) {
          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(width: 10),
              Expanded(
                child: TaskCard(task: tasks[index]),
              ),
              const SizedBox(width: 10)
            ],
          );
        } else {
          print(
              'Index $index is out of range for list of length ${tasks.length}');
          return Row(); // Return an empty Row or some other widget
        }
      },
      separatorBuilder: (BuildContext context, int index) {
        return const SizedBox(height: 15);
      },
    );
  }
}

class _CardActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final String tooltip;
  final VoidCallback onPressed;

  const _CardActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onPressed,
        child: SizedBox(
          width: 46,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TaskPopupCard extends StatelessWidget {
  final Task task;

  const TaskPopupCard({required this.task});

  @override
  Widget build(BuildContext context) {
    final matches = DBHelper.projects.where((p) => p.id == task.project);
    final projectName =
        matches.isNotEmpty ? matches.first.title : 'Unknown Project';
    final List<String> employeeNames = [];
    for (final rawEmpId in task.emp) {
      final empId = rawEmpId.toString();
      if (DBHelper.empMap.containsKey(empId)) {
        employeeNames.add(DBHelper.empMap[empId].name.toString());
        continue;
      }
      final matches = DBHelper.employees.where((emp) => emp.id == empId);
      employeeNames
          .add(matches.isNotEmpty ? matches.first.name.toString() : empId);
    }

    return Dialog(
      elevation: 10,
      backgroundColor: ColorPicker.cardBackground,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16.0),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                task.title,
                style: const TextStyle(
                  color: ColorPicker.fontDark,
                  fontWeight: FontWeight.bold,
                  fontSize: 22.0,
                ),
              ),
              const SizedBox(height: 12.0),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _InfoChip(
                    icon: StatusHelper.getStatusIcon(task.status),
                    label: StatusHelper.getStatusLabel(task.status),
                    color: StatusHelper.getStatusColor(task.status),
                  ),
                  _InfoChip(
                    icon: Icons.folder_outlined,
                    label: projectName,
                    color: ColorPicker.accent,
                  ),
                ],
              ),
              const SizedBox(height: 16.0),
              Text(
                task.description,
                style: const TextStyle(
                  color: ColorPicker.fontMedium,
                  fontSize: 15.0,
                ),
              ),
              const SizedBox(height: 16.0),
              const Text(
                'Assigned employees',
                style: TextStyle(
                  color: ColorPicker.fontDark,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: employeeNames.isEmpty
                    ? [
                        const _InfoChip(
                          icon: Icons.person_off_outlined,
                          label: 'No employee',
                          color: ColorPicker.fontLight,
                        )
                      ]
                    : employeeNames
                        .map<Widget>((name) => _InfoChip(
                              icon: Icons.person_outline,
                              label: name,
                              color: ColorPicker.buttonSecondary,
                            ))
                        .toList(),
              ),
              const SizedBox(height: 16.0),
              Row(
                children: [
                  Icon(Icons.calendar_today,
                      size: 16, color: ColorPicker.fontLight),
                  const SizedBox(width: 8),
                  Text(
                    'End Date: ${task.endDateString}',
                    style: const TextStyle(
                      color: ColorPicker.fontDark,
                      fontSize: 15.0,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 180),
            child: Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

String _assigneeLabel(Task task) {
  if (task.emp.isEmpty) return 'Unassigned';

  final names = task.emp
      .map<String?>((String empId) => DBHelper.empMap[empId]?.name?.toString())
      .whereType<String>()
      .where((String name) => name.trim().isNotEmpty)
      .toList();

  if (names.isEmpty) {
    return '${task.emp.length} assigned';
  }

  if (names.length <= 2) {
    return names.join(', ');
  }

  return '${names.take(2).join(', ')} +${names.length - 2}';
}
