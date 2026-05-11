import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:qlcv/model/color_picker.dart';
import 'package:qlcv/model/project.dart';
import 'package:qlcv/utils/logger.dart';
import 'package:qlcv/utils/status_helper.dart';

import '../main.dart';
import '../model/db_helper.dart';

class ProjectCreateRoute extends StatefulWidget {
  const ProjectCreateRoute({Key? key}) : super(key: key);

  @override
  State<ProjectCreateRoute> createState() => _ProjectCreateRouteState();
}

class _ProjectCreateRouteState extends State<ProjectCreateRoute> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  DateTime? _dueDate;
  final List<String> _selectedTeamIds = [];
  String _selectedStatus = 'in_progress';
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    isPaused = true;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    isPaused = false;
    super.dispose();
  }

  Future<void> _pickDueDate() async {
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(2100),
      builder: (context, child) => Theme(
        data: ThemeData.light().copyWith(
          colorScheme: const ColorScheme.light(primary: ColorPicker.accent),
        ),
        child: child!,
      ),
    );

    if (pickedDate == null) return;
    setState(() {
      _dueDate = pickedDate;
    });
  }

  Future<void> _createProject() async {
    final title = _titleController.text.trim();
    final description = _descriptionController.text.trim();

    if (title.isEmpty ||
        description.isEmpty ||
        _dueDate == null ||
        _selectedTeamIds.isEmpty) {
      _showMessage('Please complete title, description, due date and team.');
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final project = Project(
        title: title,
        description: description,
        status: _selectedStatus,
        endDate: _dueDate!,
        teams: _selectedTeamIds,
      );

      await DBHelper.addProject(project);
      if (!mounted) return;
      Navigator.pop(context, true);
    } on Exception catch (error) {
      AppLogger.error(
        'Failed to create project',
        error,
        null,
        'ProjectCreateRoute',
      );
      if (mounted) {
        _showMessage('Could not create project. Please try again.');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: ColorPicker.buttonDanger,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dueDateText = _dueDate == null
        ? 'Pick due date'
        : DateFormat('d/M/yyyy').format(_dueDate!);

    return Scaffold(
      backgroundColor: ColorPicker.backgroundLight,
      appBar: AppBar(
        title: const Text('Create project'),
        backgroundColor: ColorPicker.cardBackground,
        foregroundColor: ColorPicker.fontDark,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(
            16,
            8,
            16,
            24 + MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _HeaderPanel(
                title: 'New project',
                subtitle: 'Set up project scope, timeline, and team ownership.',
                icon: Icons.create_new_folder_outlined,
              ),
              const SizedBox(height: 14),
              _FormSection(
                title: 'Overview',
                icon: Icons.subject_outlined,
                children: [
                  _StyledTextField(
                    controller: _titleController,
                    label: 'Project title',
                    icon: Icons.drive_file_rename_outline,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  _StyledTextField(
                    controller: _descriptionController,
                    label: 'Description',
                    icon: Icons.notes_outlined,
                    minLines: 4,
                    maxLines: 6,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _FormSection(
                title: 'Schedule and status',
                icon: Icons.event_available_outlined,
                children: [
                  _DateTile(
                    label: 'Due date',
                    value: dueDateText,
                    selected: _dueDate != null,
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
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        _selectedStatus = value;
                      });
                    },
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _FormSection(
                title: 'Teams',
                icon: Icons.groups_2_outlined,
                children: [
                  _TeamSelector(
                    selectedTeamIds: _selectedTeamIds,
                    onAdd: (teamId) {
                      setState(() {
                        _selectedTeamIds.add(teamId);
                      });
                    },
                    onRemove: (teamId) {
                      setState(() {
                        _selectedTeamIds.remove(teamId);
                      });
                    },
                  ),
                ],
              ),
              const SizedBox(height: 18),
              _ActionBar(
                isSubmitting: _isSubmitting,
                onCancel: () => Navigator.pop(context, false),
                onSubmit: _createProject,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeaderPanel extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;

  const _HeaderPanel({
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: ColorPicker.cardBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: ColorPicker.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: ColorPicker.accent),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: ColorPicker.fontMedium,
                    fontSize: 14,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FormSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _FormSection({
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
  final int? minLines;
  final int? maxLines;
  final TextInputAction? textInputAction;

  const _StyledTextField({
    required this.controller,
    required this.label,
    required this.icon,
    this.minLines,
    this.maxLines,
    this.textInputAction,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      minLines: minLines,
      maxLines: maxLines ?? 1,
      textInputAction: textInputAction,
      style: const TextStyle(color: ColorPicker.fontDark, fontSize: 15),
      decoration: _fieldDecoration(label: label, icon: icon),
    );
  }
}

InputDecoration _fieldDecoration({
  required String label,
  required IconData icon,
}) {
  return InputDecoration(
    labelText: label,
    prefixIcon: Icon(icon, size: 20),
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
  final bool selected;
  final VoidCallback onTap;

  const _DateTile({
    required this.label,
    required this.value,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: InputDecorator(
        decoration: _fieldDecoration(
          label: label,
          icon: Icons.calendar_today_outlined,
        ),
        child: Text(
          value,
          style: TextStyle(
            color: selected ? ColorPicker.fontDark : ColorPicker.fontLight,
            fontSize: 15,
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          ),
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
          isExpanded: true,
          decoration: _fieldDecoration(
            label: 'Add team',
            icon: Icons.group_add_outlined,
          ),
          items: DBHelper.deps
              .where((team) => !selectedTeamIds.contains(team.id))
              .map(
                (team) => DropdownMenuItem<String>(
                  value: team.id,
                  child: Text(
                    team.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (value) {
            if (value == null || selectedTeamIds.contains(value)) return;
            onAdd(value);
          },
          initialValue: null,
        ),
        const SizedBox(height: 12),
        if (selectedTeamIds.isEmpty)
          const _InlineWarning(text: 'Please select at least one team')
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: selectedTeamIds.map((teamId) {
              final matches = DBHelper.deps.where((team) => team.id == teamId);
              if (matches.isEmpty) return const SizedBox.shrink();
              final team = matches.first;
              return Chip(
                avatar: const Icon(Icons.groups_2_outlined, size: 17),
                label: Text(team.name),
                deleteIcon: const Icon(Icons.close, size: 18),
                onDeleted: () => onRemove(teamId),
                backgroundColor: ColorPicker.backgroundLight,
                side: const BorderSide(color: ColorPicker.cardBorder),
              );
            }).toList(),
          ),
        if (DBHelper.deps.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 10),
            child: Text(
              'No teams available.',
              style: TextStyle(color: ColorPicker.fontMedium),
            ),
          ),
      ],
    );
  }
}

class _ActionBar extends StatelessWidget {
  final bool isSubmitting;
  final VoidCallback onCancel;
  final VoidCallback onSubmit;

  const _ActionBar({
    required this.isSubmitting,
    required this.onCancel,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: isSubmitting ? null : onCancel,
            icon: const Icon(Icons.close_outlined, size: 18),
            label: const Text('Cancel'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: FilledButton.icon(
            onPressed: isSubmitting ? null : onSubmit,
            icon: isSubmitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.create_new_folder_outlined, size: 18),
            label: Text(isSubmitting ? 'Creating' : 'Create project'),
          ),
        ),
      ],
    );
  }
}

class _InlineWarning extends StatelessWidget {
  final String text;

  const _InlineWarning({required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(Icons.warning_amber_outlined, color: Colors.orange.shade700),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: TextStyle(color: Colors.orange.shade900)),
        ),
      ],
    );
  }
}
