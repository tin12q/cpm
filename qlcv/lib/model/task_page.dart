import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:qlcv/model/db_helper.dart';
import 'package:qlcv/model/projects_page.dart';

import '../utils/status_helper.dart';
import 'color_picker.dart';
import 'task.dart';

class TaskPage extends StatefulWidget {
  final Task task;

  const TaskPage({
    Key? key,
    required this.task,
  }) : super(key: key);

  @override
  State<TaskPage> createState() => _TaskPageState();
}

class _TaskPageState extends State<TaskPage> {
  late Task task;
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late String _selectedStatus;
  List<String> selectedEmployeeIds = [];

  bool get _canEdit =>
      DBHelper.mainUser.role == 'admin' || DBHelper.mainUser.role == 'manager';

  @override
  void initState() {
    super.initState();
    task = widget.task;
    selectedEmployeeIds = task.emp.toSet().toList();
    _titleController = TextEditingController(text: task.title);
    _descriptionController = TextEditingController(text: task.description);
    _selectedStatus = StatusHelper.normalizeStatus(task.status);
    if (!StatusHelper.taskStatuses.contains(_selectedStatus)) {
      _selectedStatus = 'in_progress';
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> updateTask(Task task, String title, String description,
      DateTime endDate, String status, List<String> employeeIds,
      {int? difficulty, int? priority, bool? canParallelize}) async {
    task.title = title.trim();
    task.description = description.trim();
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

  Future<void> _confirmUpdate() async {
    final shouldUpdate = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Update task'),
        content: const Text('Save the latest changes to this task?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (shouldUpdate != true) return;

    await updateTask(
      task,
      _titleController.text,
      _descriptionController.text,
      task.endDate,
      _selectedStatus,
      selectedEmployeeIds,
      difficulty: task.difficulty,
      priority: task.priority,
      canParallelize: task.canParallelize,
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Task updated successfully'),
        backgroundColor: ColorPicker.buttonSuccess,
      ),
    );
  }

  Future<void> _openProject() async {
    final matches = DBHelper.projects.where((p) => p.id == task.project);
    final project = matches.isNotEmpty ? matches.first : null;
    if (project == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Project not found'),
          backgroundColor: ColorPicker.buttonDanger,
        ),
      );
      return;
    }

    DBHelper.currentProjectId = project.id;
    await DBHelper.getEmpByProjectId(project.id);
    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => ProjectPage(project: project)),
    );
  }

  Future<void> _pickDueDate() async {
    final selectedDate = await showDatePicker(
      context: context,
      initialDate:
          task.endDate.isAfter(DateTime.now()) ? task.endDate : DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(3000),
    );
    if (selectedDate == null) return;
    setState(() {
      task.endDate = selectedDate;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ColorPicker.backgroundLight,
      appBar: AppBar(
        title: const Text('Task detail'),
        backgroundColor: ColorPicker.cardBackground,
        foregroundColor: ColorPicker.fontDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _HeroPanel(
                title: task.title,
                description: task.description,
                status: _selectedStatus,
                dueDate: task.endDate,
                assigneeCount: selectedEmployeeIds.length,
                canParallelize: task.canParallelize,
                canEdit: _canEdit,
                onSave: _confirmUpdate,
                onOpenProject: _openProject,
              ),
              const SizedBox(height: 14),
              if (!_canEdit) const _ReadOnlyNotice(text: 'Read-only access'),
              if (!_canEdit) const SizedBox(height: 14),
              _DetailSection(
                title: 'Overview',
                icon: Icons.subject_outlined,
                children: [
                  _StyledTextField(
                    controller: _titleController,
                    label: 'Task title',
                    icon: Icons.drive_file_rename_outline,
                    readOnly: !_canEdit,
                    textStyle: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: ColorPicker.fontDark,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _StyledTextField(
                    controller: _descriptionController,
                    label: 'Description',
                    icon: Icons.notes_outlined,
                    readOnly: !_canEdit,
                    minLines: 3,
                    maxLines: 5,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _DetailSection(
                title: 'Schedule and status',
                icon: Icons.event_available_outlined,
                children: [
                  _DateTile(
                    label: 'Due date',
                    value: DateFormat('d/M/yyyy').format(task.endDate),
                    enabled: _canEdit,
                    onTap: _pickDueDate,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedStatus,
                    decoration: _fieldDecoration(
                      label: 'Task status',
                      icon: StatusHelper.getStatusIcon(_selectedStatus),
                      locked: !_canEdit,
                    ),
                    items: StatusHelper.taskStatuses
                        .map(
                          (status) => DropdownMenuItem<String>(
                            value: status,
                            child: Text(StatusHelper.getStatusLabel(status)),
                          ),
                        )
                        .toList(),
                    onChanged: _canEdit
                        ? (value) {
                            if (value == null) return;
                            setState(() {
                              _selectedStatus = value;
                              task.status = value;
                            });
                          }
                        : null,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _DetailSection(
                title: 'Assignment settings',
                icon: Icons.tune_outlined,
                children: [
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final stackFields = constraints.maxWidth < 520;
                      final difficultyField = _NumberDropdown(
                        label: 'Difficulty',
                        icon: Icons.fitness_center_outlined,
                        value: task.difficulty,
                        enabled: _canEdit,
                        items: const {
                          1: 'Basic',
                          2: 'Easy',
                          3: 'Medium',
                          4: 'Hard',
                        },
                        onChanged: (value) {
                          setState(() {
                            task.difficulty = value ?? 2;
                          });
                        },
                      );
                      final priorityField = _NumberDropdown(
                        label: 'Priority',
                        icon: Icons.flag_outlined,
                        value: task.priority,
                        enabled: _canEdit,
                        items: const {
                          1: 'Very low',
                          2: 'Low',
                          3: 'Medium',
                          4: 'High',
                          5: 'Critical',
                        },
                        onChanged: (value) {
                          setState(() {
                            task.priority = value ?? 3;
                          });
                        },
                      );

                      if (stackFields) {
                        return Column(
                          children: [
                            difficultyField,
                            const SizedBox(height: 12),
                            priorityField,
                          ],
                        );
                      }

                      return Row(
                        children: [
                          Expanded(child: difficultyField),
                          const SizedBox(width: 12),
                          Expanded(child: priorityField),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  _SwitchTile(
                    value: task.canParallelize,
                    enabled: _canEdit,
                    onChanged: (value) {
                      setState(() {
                        task.canParallelize = value;
                      });
                    },
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _DetailSection(
                title: 'Assigned employees',
                icon: Icons.people_alt_outlined,
                children: [
                  if (_canEdit)
                    _EmployeeSelector(
                      selectedEmployeeIds: selectedEmployeeIds,
                      onAdd: (employeeId) {
                        setState(() {
                          selectedEmployeeIds.add(employeeId);
                        });
                      },
                      onRemove: (employeeId) {
                        setState(() {
                          selectedEmployeeIds.remove(employeeId);
                        });
                      },
                    ),
                  if (!_canEdit)
                    _EmployeeChips(employeeIds: selectedEmployeeIds),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroPanel extends StatelessWidget {
  final String title;
  final String description;
  final String status;
  final DateTime dueDate;
  final int assigneeCount;
  final bool canParallelize;
  final bool canEdit;
  final VoidCallback onSave;
  final VoidCallback onOpenProject;

  const _HeroPanel({
    required this.title,
    required this.description,
    required this.status,
    required this.dueDate,
    required this.assigneeCount,
    required this.canParallelize,
    required this.canEdit,
    required this.onSave,
    required this.onOpenProject,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = StatusHelper.getStatusColor(status);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: ColorPicker.cardBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _StatusPill(status: status, color: statusColor),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            description,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: ColorPicker.fontMedium,
              fontSize: 14,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MetaChip(
                icon: Icons.calendar_today_outlined,
                label: DateFormat('d/M/yyyy').format(dueDate),
              ),
              _MetaChip(
                icon: Icons.people_alt_outlined,
                label: '$assigneeCount assigned',
              ),
              _MetaChip(
                icon: canParallelize
                    ? Icons.call_split_outlined
                    : Icons.linear_scale_outlined,
                label: canParallelize ? 'Parallel' : 'Single owner',
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton.icon(
                onPressed: onOpenProject,
                icon: const Icon(Icons.folder_open_outlined, size: 18),
                label: const Text('Project'),
              ),
              if (canEdit)
                OutlinedButton.icon(
                  onPressed: onSave,
                  icon: const Icon(Icons.save_outlined, size: 18),
                  label: const Text('Save'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DetailSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _DetailSection({
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ColorPicker.cardBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 19, color: ColorPicker.accent),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  color: ColorPicker.fontDark,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

class _StyledTextField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final bool readOnly;
  final int? minLines;
  final int? maxLines;
  final TextStyle? textStyle;

  const _StyledTextField({
    required this.controller,
    required this.label,
    required this.icon,
    required this.readOnly,
    this.minLines,
    this.maxLines,
    this.textStyle,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      readOnly: readOnly,
      minLines: minLines,
      maxLines: maxLines ?? 1,
      style: textStyle ??
          const TextStyle(
            color: ColorPicker.fontDark,
            fontSize: 15,
            height: 1.35,
          ),
      decoration: _fieldDecoration(
        label: label,
        icon: icon,
        locked: readOnly,
      ),
    );
  }
}

class _NumberDropdown extends StatelessWidget {
  final String label;
  final IconData icon;
  final int value;
  final bool enabled;
  final Map<int, String> items;
  final ValueChanged<int?> onChanged;

  const _NumberDropdown({
    required this.label,
    required this.icon,
    required this.value,
    required this.enabled,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<int>(
      initialValue: items.containsKey(value) ? value : items.keys.first,
      isExpanded: true,
      decoration: _fieldDecoration(label: label, icon: icon, locked: !enabled),
      items: items.entries
          .map(
            (entry) => DropdownMenuItem<int>(
              value: entry.key,
              child: Text(entry.value),
            ),
          )
          .toList(),
      onChanged: enabled ? onChanged : null,
    );
  }
}

InputDecoration _fieldDecoration({
  required String label,
  required IconData icon,
  bool locked = false,
}) {
  return InputDecoration(
    labelText: label,
    prefixIcon: Icon(icon, size: 20),
    suffixIcon: locked ? const Icon(Icons.lock_outline, size: 18) : null,
    filled: true,
    fillColor: ColorPicker.backgroundLight,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: ColorPicker.cardBorder),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: ColorPicker.cardBorder),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: ColorPicker.accent, width: 1.5),
    ),
  );
}

class _DateTile extends StatelessWidget {
  final String label;
  final String value;
  final bool enabled;
  final VoidCallback onTap;

  const _DateTile({
    required this.label,
    required this.value,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(8),
      child: InputDecorator(
        decoration: _fieldDecoration(
          label: label,
          icon: Icons.calendar_today_outlined,
          locked: !enabled,
        ),
        child: Text(
          value,
          style: const TextStyle(color: ColorPicker.fontDark, fontSize: 15),
        ),
      ),
    );
  }
}

class _SwitchTile extends StatelessWidget {
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  const _SwitchTile({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.call_split_outlined, color: ColorPicker.fontMedium),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Can parallelize',
              style: TextStyle(
                color: ColorPicker.fontDark,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Switch(
            value: value,
            onChanged: enabled ? onChanged : null,
          ),
        ],
      ),
    );
  }
}

class _EmployeeSelector extends StatelessWidget {
  final List<String> selectedEmployeeIds;
  final ValueChanged<String> onAdd;
  final ValueChanged<String> onRemove;

  const _EmployeeSelector({
    required this.selectedEmployeeIds,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          key: ValueKey(selectedEmployeeIds.join(',')),
          isExpanded: true,
          decoration: _fieldDecoration(
            label: 'Add employee',
            icon: Icons.person_add_alt_1_outlined,
          ),
          items: () {
            final Map<String, dynamic> uniqueEmps = {};
            for (var emp in DBHelper.empProject) {
              if (!selectedEmployeeIds.contains(emp.id)) {
                uniqueEmps[emp.id] = emp;
              }
            }
            return uniqueEmps.values
                .map(
                  (emp) => DropdownMenuItem<String>(
                    value: emp.id,
                    child: Text(
                      '${emp.name} (${emp.role})',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList();
          }(),
          onChanged: (value) {
            if (value == null || selectedEmployeeIds.contains(value)) return;
            onAdd(value);
          },
          initialValue: null,
        ),
        const SizedBox(height: 12),
        _EmployeeChips(
          employeeIds: selectedEmployeeIds,
          onDeleted: onRemove,
        ),
        if (selectedEmployeeIds.isEmpty)
          const _InlineWarning(text: 'Please select at least one employee'),
        if (DBHelper.empProject.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 10),
            child: Text(
              'No employees in this project team',
              style: TextStyle(color: ColorPicker.fontMedium),
            ),
          ),
      ],
    );
  }
}

class _EmployeeChips extends StatelessWidget {
  final List<String> employeeIds;
  final ValueChanged<String>? onDeleted;

  const _EmployeeChips({
    required this.employeeIds,
    this.onDeleted,
  });

  @override
  Widget build(BuildContext context) {
    if (employeeIds.isEmpty) {
      return const Text(
        'No employees assigned',
        style: TextStyle(color: ColorPicker.fontMedium),
      );
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: employeeIds.map((empId) {
        final matches = DBHelper.empProject.where((e) => e.id == empId);
        var emp = matches.isNotEmpty ? matches.first : null;
        if (emp == null && DBHelper.empMap.containsKey(empId)) {
          emp = DBHelper.empMap[empId];
        }
        if (emp == null) return const SizedBox.shrink();
        return Chip(
          avatar: const Icon(Icons.person_outline, size: 17),
          label: Text('${emp.name} (${emp.role})'),
          deleteIcon:
              onDeleted == null ? null : const Icon(Icons.close, size: 18),
          onDeleted: onDeleted == null ? null : () => onDeleted!(empId),
          backgroundColor: ColorPicker.backgroundLight,
          side: const BorderSide(color: ColorPicker.cardBorder),
        );
      }).toList(),
    );
  }
}

class _ReadOnlyNotice extends StatelessWidget {
  final String text;

  const _ReadOnlyNotice({required this.text});

  @override
  Widget build(BuildContext context) {
    return _MetaChip(icon: Icons.lock_outline, label: text);
  }
}

class _InlineWarning extends StatelessWidget {
  final String text;

  const _InlineWarning({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        children: [
          Icon(Icons.warning_amber_outlined, color: Colors.orange.shade700),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: TextStyle(color: Colors.orange.shade900)),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  final Color color;

  const _StatusPill({
    required this.status,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(StatusHelper.getStatusIcon(status), size: 15, color: color),
          const SizedBox(width: 5),
          Text(
            StatusHelper.getStatusLabel(status),
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _MetaChip({
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: ColorPicker.fontMedium),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: ColorPicker.fontMedium,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
