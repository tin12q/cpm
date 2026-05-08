import 'package:flutter/material.dart';

import '../model/color_picker.dart';
import '../model/db_helper.dart';
import '../model/emp.dart';
import '../model/project.dart';
import '../model/task.dart';
import '../services/assignment_service.dart';
import '../utils/status_helper.dart';

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
      await DBHelper.taskUpdateWithProjectId(widget.project.id);
      await DBHelper.getEmpByProjectId(widget.project.id);

      final config = await AssignmentService.getDefaultConfig();

      setState(() {
        projectTasks = List.from(DBHelper.projectTasks);
        availableEmployees = List.from(DBHelper.empProject);

        if (widget.autoSelectUnassigned) {
          selectedTasks =
              projectTasks.where((Task task) => task.emp.isEmpty).toList();
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
      if (!mounted) return;
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
      final taskIds = selectedTasks.map((Task task) => task.id).toList();
      final userIds = selectedEmployees.isNotEmpty
          ? selectedEmployees.map((Employee user) => user.id).toList()
          : null;

      final config = _assignmentConfig();
      final result = await AssignmentService.previewAssignment(
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
      if (!mounted) return;
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

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Apply assignment'),
          content: const Text(
            'Apply these recommendations to the selected tasks?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Apply'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    setState(() {
      isLoading = true;
    });

    try {
      final taskIds = selectedTasks.map((Task task) => task.id).toList();
      final userIds = selectedEmployees.isNotEmpty
          ? selectedEmployees.map((Employee user) => user.id).toList()
          : null;

      final result = await AssignmentService.applyAssignment(
        taskIds: taskIds,
        userIds: userIds,
        config: _assignmentConfig(),
      );

      setState(() {
        isLoading = false;
        previewResult = result;
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Assignment applied successfully'),
          backgroundColor: ColorPicker.buttonSuccess,
        ),
      );

      await _loadData();
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  Map<String, dynamic> _assignmentConfig() {
    return {
      'W_deadline': wDeadline,
      'W_priority': wPriority,
      'W_speed': wSpeed,
      'W_skill': wSkill,
      'W_workload': wWorkload,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ColorPicker.backgroundLight,
      appBar: AppBar(
        title: const Text('Assignment preview'),
        backgroundColor: ColorPicker.cardBackground,
        foregroundColor: ColorPicker.fontDark,
        elevation: 0,
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _HeaderPanel(
                    projectTitle: widget.project.title,
                    selectedTaskCount: selectedTasks.length,
                    totalTaskCount: projectTasks.length,
                    selectedEmployeeCount: selectedEmployees.length,
                    onPreview:
                        selectedTasks.isEmpty ? null : _previewAssignment,
                    onApply: previewResult == null ? null : _applyAssignment,
                  ),
                  const SizedBox(height: 14),
                  _TaskSelectionSection(
                    tasks: projectTasks,
                    selectedTasks: selectedTasks,
                    onToggleAll: _toggleAllTasks,
                    onChanged: (task, selected) {
                      setState(() {
                        if (selected) {
                          selectedTasks.add(task);
                        } else {
                          selectedTasks.remove(task);
                        }
                        previewResult = null;
                      });
                    },
                  ),
                  const SizedBox(height: 14),
                  _EmployeeFilterSection(
                    employees: availableEmployees,
                    selectedEmployees: selectedEmployees,
                    onChanged: (employee, selected) {
                      setState(() {
                        if (selected) {
                          selectedEmployees.add(employee);
                        } else {
                          selectedEmployees.remove(employee);
                        }
                        previewResult = null;
                      });
                    },
                  ),
                  const SizedBox(height: 14),
                  _AdvancedSettingsSection(
                    initiallyExpanded: showAdvancedSettings,
                    onExpansionChanged: (expanded) {
                      setState(() {
                        showAdvancedSettings = expanded;
                      });
                    },
                    sliders: [
                      _WeightSliderData('Deadline', wDeadline,
                          (value) => setState(() => wDeadline = value)),
                      _WeightSliderData('Priority', wPriority,
                          (value) => setState(() => wPriority = value)),
                      _WeightSliderData('Speed', wSpeed,
                          (value) => setState(() => wSpeed = value)),
                      _WeightSliderData('Skill', wSkill,
                          (value) => setState(() => wSkill = value)),
                      _WeightSliderData('Workload', wWorkload,
                          (value) => setState(() => wWorkload = value)),
                    ],
                  ),
                  if (previewResult != null) ...[
                    const SizedBox(height: 14),
                    _AssignmentPreviewCard(
                      result: previewResult!,
                      localTasks: projectTasks,
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  void _toggleAllTasks() {
    setState(() {
      if (selectedTasks.length == projectTasks.length) {
        selectedTasks.clear();
      } else {
        selectedTasks = List.from(projectTasks);
      }
      previewResult = null;
    });
  }
}

class _HeaderPanel extends StatelessWidget {
  final String projectTitle;
  final int selectedTaskCount;
  final int totalTaskCount;
  final int selectedEmployeeCount;
  final VoidCallback? onPreview;
  final VoidCallback? onApply;

  const _HeaderPanel({
    required this.projectTitle,
    required this.selectedTaskCount,
    required this.totalTaskCount,
    required this.selectedEmployeeCount,
    required this.onPreview,
    required this.onApply,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'AI + MCMF assignment',
            style: TextStyle(
              color: ColorPicker.fontDark,
              fontSize: 24,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            projectTitle,
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
              _InfoChip(
                icon: Icons.task_alt_outlined,
                label: '$selectedTaskCount/$totalTaskCount tasks',
              ),
              _InfoChip(
                icon: Icons.people_alt_outlined,
                label: selectedEmployeeCount == 0
                    ? 'All eligible members'
                    : '$selectedEmployeeCount filtered members',
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onPreview,
                  icon: const Icon(Icons.visibility_outlined, size: 18),
                  label: const Text('Preview'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onApply,
                  icon: const Icon(Icons.check_circle_outline, size: 18),
                  label: const Text('Apply'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TaskSelectionSection extends StatelessWidget {
  final List<Task> tasks;
  final List<Task> selectedTasks;
  final VoidCallback onToggleAll;
  final void Function(Task task, bool selected) onChanged;

  const _TaskSelectionSection({
    required this.tasks,
    required this.selectedTasks,
    required this.onToggleAll,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Tasks to assign',
      icon: Icons.playlist_add_check_outlined,
      trailing: TextButton(
        onPressed: tasks.isEmpty ? null : onToggleAll,
        child: Text(
            selectedTasks.length == tasks.length ? 'Clear all' : 'Select all'),
      ),
      child: Column(
        children: tasks.map((task) {
          final isSelected = selectedTasks.contains(task);
          return _SelectableTaskCard(
            task: task,
            selected: isSelected,
            onChanged: (selected) => onChanged(task, selected),
          );
        }).toList(),
      ),
    );
  }
}

class _SelectableTaskCard extends StatelessWidget {
  final Task task;
  final bool selected;
  final ValueChanged<bool> onChanged;

  const _SelectableTaskCard({
    required this.task,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final status = StatusHelper.normalizeStatus(task.status.toString());
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: selected
            ? ColorPicker.accent.withValues(alpha: 0.06)
            : Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: selected ? ColorPicker.accent : ColorPicker.cardBorder,
        ),
      ),
      child: CheckboxListTile(
        value: selected,
        onChanged: (value) => onChanged(value ?? false),
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        title: Text(
          task.title,
          style: const TextStyle(
            color: ColorPicker.fontDark,
            fontWeight: FontWeight.w700,
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _StatusBadge(status: status),
              _InfoChip(
                icon: Icons.calendar_today_outlined,
                label: task.endDateString,
              ),
              _InfoChip(
                icon: task.emp.isEmpty
                    ? Icons.person_add_alt_1_outlined
                    : Icons.people_alt_outlined,
                label: task.emp.isEmpty
                    ? 'Unassigned'
                    : '${task.emp.length} assigned',
              ),
              _InfoChip(
                icon: Icons.flag_outlined,
                label: 'P${task.priority}',
              ),
              _InfoChip(
                icon: task.canParallelize
                    ? Icons.call_split_outlined
                    : Icons.linear_scale_outlined,
                label: task.canParallelize ? 'Parallel' : 'Single owner',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmployeeFilterSection extends StatelessWidget {
  final List<Employee> employees;
  final List<Employee> selectedEmployees;
  final void Function(Employee employee, bool selected) onChanged;

  const _EmployeeFilterSection({
    required this.employees,
    required this.selectedEmployees,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Member filter',
      icon: Icons.manage_accounts_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Leave empty to let the algorithm consider every eligible project member.',
            style: TextStyle(color: ColorPicker.fontMedium, fontSize: 13),
          ),
          const SizedBox(height: 12),
          if (employees.isEmpty)
            const Text(
              'No members loaded for this project.',
              style: TextStyle(color: ColorPicker.fontMedium),
            )
          else
            ...employees.map((employee) {
              final selected = selectedEmployees.contains(employee);
              return CheckboxListTile(
                value: selected,
                onChanged: (value) => onChanged(employee, value ?? false),
                contentPadding: EdgeInsets.zero,
                title: Text(
                  employee.name,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(employee.role),
              );
            }),
        ],
      ),
    );
  }
}

class _AdvancedSettingsSection extends StatelessWidget {
  final bool initiallyExpanded;
  final ValueChanged<bool> onExpansionChanged;
  final List<_WeightSliderData> sliders;

  const _AdvancedSettingsSection({
    required this.initiallyExpanded,
    required this.onExpansionChanged,
    required this.sliders,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: _panelDecoration(),
      child: ExpansionTile(
        initiallyExpanded: initiallyExpanded,
        onExpansionChanged: onExpansionChanged,
        leading: const Icon(Icons.tune_outlined, color: ColorPicker.accent),
        title: const Text(
          'Assignment weights',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: const Text('Fine tune scoring inputs'),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              children: sliders
                  .map(
                    (slider) => _WeightSlider(
                      key: ValueKey(slider.label),
                      label: slider.label,
                      value: slider.value,
                      onChanged: slider.onChanged,
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _AssignmentPreviewCard extends StatelessWidget {
  final Map<String, dynamic> result;
  final List<Task> localTasks;

  const _AssignmentPreviewCard({
    required this.result,
    required this.localTasks,
  });

  @override
  Widget build(BuildContext context) {
    final assignments = _asList(result['assignments']);
    final summary = _asMap(result['summary']);
    final success = result['success'] == true || assignments.isNotEmpty;
    final applied = result['applied'] == true;
    final method = _methodLabel(result['method']);

    return _Panel(
      title: applied ? 'Applied assignment' : 'Recommended assignment',
      icon: applied ? Icons.check_circle_outline : Icons.auto_awesome_outlined,
      trailing: _ResultBadge(success: success, applied: applied),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoChip(
                icon: Icons.task_alt_outlined,
                label:
                    '${summary['total_tasks_assigned'] ?? assignments.length} tasks',
              ),
              _InfoChip(
                icon: Icons.people_alt_outlined,
                label:
                    '${summary['total_users_involved'] ?? _uniqueUserCount(assignments)} members',
              ),
              _InfoChip(
                icon: Icons.groups_outlined,
                label:
                    '${summary['average_users_per_task'] ?? _averageUsers(assignments)} / task',
              ),
              if (method.isNotEmpty)
                _InfoChip(
                  icon: Icons.account_tree_outlined,
                  label: method,
                ),
            ],
          ),
          const SizedBox(height: 14),
          if (assignments.isEmpty)
            const _EmptyPreview()
          else
            ...assignments.map((rawAssignment) {
              final assignment = _asMap(rawAssignment);
              return _AssignmentTaskCard(
                assignment: assignment,
                localTask: _findLocalTask(assignment, localTasks),
              );
            }),
        ],
      ),
    );
  }
}

class _AssignmentTaskCard extends StatelessWidget {
  final Map<String, dynamic> assignment;
  final Task? localTask;

  const _AssignmentTaskCard({
    required this.assignment,
    required this.localTask,
  });

  @override
  Widget build(BuildContext context) {
    final task = _asMap(assignment['task']);
    final users = _asList(assignment['assigned_users']);
    final title = _text(task['title']) ??
        _text(assignment['task_title']) ??
        localTask?.title ??
        'Untitled task';
    final status = StatusHelper.normalizeStatus(
        localTask?.status.toString() ?? 'in_progress');
    final deadline =
        localTask?.endDateString ?? _formatDueDate(task['due_date']);
    final priority = task['priority'] ?? localTask?.priority;
    final difficulty = task['difficulty'] ?? localTask?.difficulty;
    final canParallelize = task['can_parallelize'] ?? localTask?.canParallelize;
    final assigneeLabel = _assigneeSummary(users);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
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
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _StatusBadge(status: status),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (priority != null)
                _InfoChip(
                    icon: Icons.flag_outlined, label: 'Priority $priority'),
              _InfoChip(
                icon: Icons.calendar_today_outlined,
                label: deadline,
              ),
              _InfoChip(
                icon: users.isEmpty
                    ? Icons.person_add_alt_1_outlined
                    : Icons.people_alt_outlined,
                label: assigneeLabel,
              ),
              if (difficulty != null)
                _InfoChip(
                  icon: Icons.fitness_center_outlined,
                  label: 'Difficulty $difficulty',
                ),
              if (canParallelize != null)
                _InfoChip(
                  icon: canParallelize == true
                      ? Icons.call_split_outlined
                      : Icons.linear_scale_outlined,
                  label:
                      canParallelize == true ? 'Parallel task' : 'Single owner',
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (users.isEmpty)
            const Text(
              'No member recommended for this task.',
              style: TextStyle(color: ColorPicker.fontMedium),
            )
          else ...[
            const Text(
              'Recommended assignees',
              style: TextStyle(
                color: ColorPicker.fontDark,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            ...users.map((user) => _RecommendedUserTile(user: user)),
          ],
        ],
      ),
    );
  }
}

class _RecommendedUserTile extends StatelessWidget {
  final dynamic user;

  const _RecommendedUserTile({required this.user});

  @override
  Widget build(BuildContext context) {
    final userMap = _asMap(user);
    final name = _text(userMap['name']) ?? _text(user) ?? 'Unknown member';
    final email = _text(userMap['email']);
    final adjustedScore = _score(userMap['adjusted_score']);
    final combinedScore = _score(userMap['combined_score']);
    final skillScore = _score(userMap['skill_score']);
    final mcmfScore = _score(userMap['mcmf_score']);
    final productivityScore = _score(userMap['productivity_score']);
    final strongestScore = adjustedScore ??
        combinedScore ??
        skillScore ??
        mcmfScore ??
        productivityScore;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor:
                _scoreColor(strongestScore).withValues(alpha: 0.14),
            child: Icon(
              Icons.person_outline,
              color: _scoreColor(strongestScore),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (email != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    email,
                    style: const TextStyle(
                      color: ColorPicker.fontMedium,
                      fontSize: 12,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: [
                    if (adjustedScore != null)
                      _ScoreBadge(label: 'Fair fit', score: adjustedScore),
                    if (combinedScore != null)
                      _ScoreBadge(label: 'Fit', score: combinedScore),
                    if (skillScore != null)
                      _ScoreBadge(label: 'Skill', score: skillScore),
                    if (mcmfScore != null)
                      _ScoreBadge(label: 'Load', score: mcmfScore),
                    if (productivityScore != null)
                      _ScoreBadge(label: 'Speed', score: productivityScore),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;
  final Widget? trailing;

  const _Panel({
    required this.title,
    required this.icon,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: ColorPicker.accent, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class _WeightSlider extends StatefulWidget {
  final String label;
  final double value;
  final ValueChanged<double> onChanged;

  const _WeightSlider({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  @override
  State<_WeightSlider> createState() => _WeightSliderState();
}

class _WeightSliderState extends State<_WeightSlider> {
  late double _draftValue;

  @override
  void initState() {
    super.initState();
    _draftValue = widget.value;
  }

  @override
  void didUpdateWidget(covariant _WeightSlider oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _draftValue = widget.value;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(widget.label,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            _ScoreBadge(label: 'Weight', score: _draftValue),
          ],
        ),
        Slider(
          value: _draftValue,
          min: 0,
          max: 1,
          divisions: 20,
          label: _draftValue.toStringAsFixed(2),
          onChanged: (value) {
            setState(() {
              _draftValue = value;
            });
          },
          onChangeEnd: widget.onChanged,
        ),
      ],
    );
  }
}

class _WeightSliderData {
  final String label;
  final double value;
  final ValueChanged<double> onChanged;

  const _WeightSliderData(this.label, this.value, this.onChanged);
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = StatusHelper.getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(StatusHelper.getStatusIcon(status), color: color, size: 14),
          const SizedBox(width: 5),
          Text(
            StatusHelper.getStatusLabel(status),
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultBadge extends StatelessWidget {
  final bool success;
  final bool applied;

  const _ResultBadge({
    required this.success,
    required this.applied,
  });

  @override
  Widget build(BuildContext context) {
    final color =
        success ? ColorPicker.buttonSuccess : ColorPicker.buttonDanger;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.32)),
      ),
      child: Text(
        success ? (applied ? 'Applied' : 'Ready') : 'Needs review',
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip({
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: ColorPicker.fontMedium),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: ColorPicker.fontMedium,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScoreBadge extends StatelessWidget {
  final String label;
  final double score;

  const _ScoreBadge({
    required this.label,
    required this.score,
  });

  @override
  Widget build(BuildContext context) {
    final color = _scoreColor(score);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$label ${_scoreText(score)}',
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _EmptyPreview extends StatelessWidget {
  const _EmptyPreview();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: const Row(
        children: [
          Icon(Icons.info_outline, color: ColorPicker.fontMedium),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'No recommendation was returned for this selection.',
              style: TextStyle(color: ColorPicker.fontMedium),
            ),
          ),
        ],
      ),
    );
  }
}

BoxDecoration _panelDecoration() {
  return BoxDecoration(
    color: ColorPicker.cardBackground,
    borderRadius: BorderRadius.circular(8),
    border: Border.all(color: ColorPicker.cardBorder),
  );
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return {};
}

List<dynamic> _asList(dynamic value) {
  if (value is List) return value;
  return const [];
}

String? _text(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

double? _score(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

String _scoreText(double value) {
  final normalized = value > 1 ? value / 100 : value;
  return '${(normalized.clamp(0, 1) * 100).round()}%';
}

Color _scoreColor(double? value) {
  if (value == null) return ColorPicker.fontMedium;
  final normalized = value > 1 ? value / 100 : value;
  if (normalized >= 0.75) return ColorPicker.buttonSuccess;
  if (normalized >= 0.45) return ColorPicker.second;
  return ColorPicker.buttonDanger;
}

String _methodLabel(dynamic method) {
  final raw = _text(method);
  if (raw == null) return '';
  if (raw.contains('hybrid')) return 'Hybrid AI + MCMF';
  if (raw.contains('mcmf')) return 'MCMF';
  return raw.replaceAll('_', ' ');
}

Task? _findLocalTask(Map<String, dynamic> assignment, List<Task> localTasks) {
  final task = _asMap(assignment['task']);
  final id = _text(task['id']) ?? _text(assignment['task_id']);
  final title = _text(task['title']) ?? _text(assignment['task_title']);

  for (final localTask in localTasks) {
    if (id != null && localTask.id.toString() == id) return localTask;
    if (title != null && localTask.title.toString() == title) return localTask;
  }
  return null;
}

int _uniqueUserCount(List<dynamic> assignments) {
  final ids = <String>{};
  for (final rawAssignment in assignments) {
    final assignment = _asMap(rawAssignment);
    for (final rawUser in _asList(assignment['assigned_users'])) {
      final user = _asMap(rawUser);
      ids.add(_text(user['id']) ?? _text(rawUser) ?? '');
    }
  }
  ids.remove('');
  return ids.length;
}

String _averageUsers(List<dynamic> assignments) {
  if (assignments.isEmpty) return '0';
  var total = 0;
  for (final rawAssignment in assignments) {
    final assignment = _asMap(rawAssignment);
    total += _asList(assignment['assigned_users']).length;
  }
  return (total / assignments.length).toStringAsFixed(2);
}

String _formatDueDate(dynamic value) {
  if (value == null) return 'No deadline';

  DateTime? date;
  if (value is num) {
    date = DateTime.fromMillisecondsSinceEpoch(value.toInt());
  } else {
    final text = value.toString();
    final millis = int.tryParse(text);
    if (millis != null) {
      date = DateTime.fromMillisecondsSinceEpoch(millis);
    } else {
      date = DateTime.tryParse(text);
    }
  }

  if (date == null) return value.toString();
  return '${date.day}/${date.month}/${date.year}';
}

String _assigneeSummary(List<dynamic> users) {
  if (users.isEmpty) return 'No assignee';

  final names = users
      .map<String?>((dynamic rawUser) {
        final user = _asMap(rawUser);
        return _text(user['name']) ?? _text(rawUser);
      })
      .whereType<String>()
      .where((String name) => name.trim().isNotEmpty)
      .toList();

  if (names.isEmpty) return '${users.length} assigned';
  if (names.length <= 2) return names.join(', ');
  return '${names.take(2).join(', ')} +${names.length - 2}';
}
