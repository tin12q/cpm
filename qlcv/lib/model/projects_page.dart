import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:qlcv/model/db_helper.dart';
import 'package:qlcv/model/project.dart';
import 'package:qlcv/route/project_assignment_page.dart';
import 'package:qlcv/route/project_tasks.dart';

import '../utils/status_helper.dart';
import 'color_picker.dart';

class ProjectPage extends StatefulWidget {
  final Project project;

  const ProjectPage({
    Key? key,
    required this.project,
  }) : super(key: key);

  @override
  State<ProjectPage> createState() => _ProjectPageState();
}

class _ProjectPageState extends State<ProjectPage> {
  late Project project;
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late String _selectedStatus;
  List<String> selectedTeamIds = [];

  bool get _canEdit =>
      DBHelper.mainUser.role == 'admin' || DBHelper.mainUser.role == 'manager';

  @override
  void initState() {
    super.initState();
    project = widget.project;
    selectedTeamIds = project.teams.toSet().toList();
    _titleController = TextEditingController(text: project.title);
    _descriptionController = TextEditingController(text: project.description);
    _selectedStatus = StatusHelper.normalizeStatus(project.status);
    if (!StatusHelper.projectStatuses.contains(_selectedStatus)) {
      _selectedStatus = 'in_progress';
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> updateProject(Project project, String title, String description,
      DateTime endDate, String status, List<String> teamIds) async {
    project.title = title.trim();
    project.description = description.trim();
    project.endDate = endDate;
    project.status = status;
    if (teamIds.isNotEmpty) {
      project.teams = teamIds;
    }

    await DBHelper.updateProject(project);
    DBHelper.projects.clear();
  }

  Future<void> _confirmUpdate() async {
    final shouldUpdate = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Update project'),
        content: const Text('Save the latest changes to this project?'),
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

    await updateProject(
      project,
      _titleController.text,
      _descriptionController.text,
      project.endDate,
      _selectedStatus,
      selectedTeamIds,
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Project updated successfully'),
        backgroundColor: ColorPicker.buttonSuccess,
      ),
    );
  }

  Future<void> _openTasks() async {
    DBHelper.currentProjectId = project.id;
    await DBHelper.taskUpdateWithProjectId(project.id);
    await DBHelper.getEmpByProjectId(project.id);
    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const ProjectTasks()),
    );
  }

  Future<void> _pickDueDate() async {
    final selectedDate = await showDatePicker(
      context: context,
      initialDate: project.endDate.isAfter(DateTime.now())
          ? project.endDate
          : DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(3000),
    );
    if (selectedDate == null) return;
    setState(() {
      project.endDate = selectedDate;
    });
  }

  void _openAssignment({required bool autoSelectUnassigned}) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ProjectAssignmentPage(
          project: project,
          autoSelectUnassigned: autoSelectUnassigned,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ColorPicker.backgroundLight,
      appBar: AppBar(
        title: const Text('Project detail'),
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
                title: project.title,
                description: project.description,
                status: _selectedStatus,
                dueDate: project.endDate,
                teamCount: selectedTeamIds.length,
                canEdit: _canEdit,
                onSave: _confirmUpdate,
                onOpenTasks: _openTasks,
              ),
              const SizedBox(height: 14),
              if (_canEdit)
                _ActionStrip(
                  onAssignAll: () =>
                      _openAssignment(autoSelectUnassigned: true),
                  onAssignSelected: () =>
                      _openAssignment(autoSelectUnassigned: false),
                )
              else
                const _ReadOnlyNotice(text: 'Read-only access'),
              const SizedBox(height: 14),
              _DetailSection(
                title: 'Overview',
                icon: Icons.subject_outlined,
                children: [
                  _StyledTextField(
                    controller: _titleController,
                    label: 'Project title',
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
                    value: DateFormat('d/M/yyyy').format(project.endDate),
                    enabled: _canEdit,
                    onTap: _pickDueDate,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedStatus,
                    decoration: _fieldDecoration(
                      label: 'Project status',
                      icon: StatusHelper.getStatusIcon(_selectedStatus),
                    ),
                    items: StatusHelper.projectStatuses
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
                              project.status = value;
                            });
                          }
                        : null,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _DetailSection(
                title: 'Assigned teams',
                icon: Icons.groups_2_outlined,
                children: [
                  if (_canEdit)
                    _TeamSelector(
                      selectedTeamIds: selectedTeamIds,
                      onAdd: (teamId) {
                        setState(() {
                          selectedTeamIds.add(teamId);
                        });
                      },
                      onRemove: (teamId) {
                        setState(() {
                          selectedTeamIds.remove(teamId);
                        });
                      },
                    ),
                  if (!_canEdit) _TeamChips(teamIds: project.teams),
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
  final int teamCount;
  final bool canEdit;
  final VoidCallback onSave;
  final VoidCallback onOpenTasks;

  const _HeroPanel({
    required this.title,
    required this.description,
    required this.status,
    required this.dueDate,
    required this.teamCount,
    required this.canEdit,
    required this.onSave,
    required this.onOpenTasks,
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
                icon: Icons.groups_2_outlined,
                label: '$teamCount teams',
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton.icon(
                onPressed: onOpenTasks,
                icon: const Icon(Icons.task_alt_outlined, size: 18),
                label: const Text('Tasks'),
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

class _ActionStrip extends StatelessWidget {
  final VoidCallback onAssignAll;
  final VoidCallback onAssignSelected;

  const _ActionStrip({
    required this.onAssignAll,
    required this.onAssignSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        OutlinedButton.icon(
          onPressed: onAssignAll,
          icon: const Icon(Icons.auto_awesome, size: 18),
          label: const Text('Auto-assign unassigned'),
        ),
        OutlinedButton.icon(
          onPressed: onAssignSelected,
          icon: const Icon(Icons.playlist_add_check, size: 18),
          label: const Text('Auto-assign selected'),
        ),
      ],
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

class _TeamSelector extends StatelessWidget {
  final List<String> selectedTeamIds;
  final ValueChanged<String> onAdd;
  final ValueChanged<String> onRemove;

  const _TeamSelector({
    required this.selectedTeamIds,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          key: ValueKey(selectedTeamIds.join(',')),
          decoration: _fieldDecoration(
            label: 'Add team',
            icon: Icons.group_add_outlined,
          ),
          items: () {
            final Map<String, dynamic> uniqueTeams = {};
            for (var dep in DBHelper.deps) {
              if (!selectedTeamIds.contains(dep.id)) {
                uniqueTeams[dep.id] = dep;
              }
            }
            return uniqueTeams.values
                .map(
                  (dep) => DropdownMenuItem<String>(
                    value: dep.id,
                    child: Text(dep.name),
                  ),
                )
                .toList();
          }(),
          onChanged: (value) {
            if (value == null || selectedTeamIds.contains(value)) return;
            onAdd(value);
          },
          initialValue: null,
        ),
        const SizedBox(height: 12),
        _TeamChips(
          teamIds: selectedTeamIds,
          onDeleted: onRemove,
        ),
        if (selectedTeamIds.isEmpty)
          const _InlineWarning(text: 'Please select at least one team'),
      ],
    );
  }
}

class _TeamChips extends StatelessWidget {
  final List<String> teamIds;
  final ValueChanged<String>? onDeleted;

  const _TeamChips({
    required this.teamIds,
    this.onDeleted,
  });

  @override
  Widget build(BuildContext context) {
    if (teamIds.isEmpty) {
      return const Text(
        'No teams assigned',
        style: TextStyle(color: ColorPicker.fontMedium),
      );
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: teamIds.map((teamId) {
        final matches = DBHelper.deps.where((d) => d.id == teamId);
        if (matches.isEmpty) return const SizedBox.shrink();
        final team = matches.first;
        return Chip(
          avatar: const Icon(Icons.groups_2_outlined, size: 17),
          label: Text(team.name),
          deleteIcon:
              onDeleted == null ? null : const Icon(Icons.close, size: 18),
          onDeleted: onDeleted == null ? null : () => onDeleted!(teamId),
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
