import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:qlcv/model/color_picker.dart';
import 'package:qlcv/model/task.dart';
import 'package:qlcv/utils/logger.dart';
import 'package:qlcv/utils/status_helper.dart';

import '../main.dart';
import '../model/db_helper.dart';
import '../services/assignment_service.dart';

class TaskCreateRoute extends StatefulWidget {
  const TaskCreateRoute({Key? key}) : super(key: key);

  @override
  State<TaskCreateRoute> createState() => _TaskCreateRouteState();
}

class _TaskCreateRouteState extends State<TaskCreateRoute> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  DateTime? _dueDate;
  final List<String> _selectedEmployeeIds = [];
  String _selectedStatus = 'in_progress';
  int _difficulty = 2;
  int _priority = 3;
  bool _canParallelize = true;
  bool _isSubmitting = false;
  bool _isSuggesting = false;
  bool _autoSuggestReady = false;
  List<_AssigneeSuggestion> _suggestions = [];
  Timer? _suggestionDebounce;
  int _suggestionRequestId = 0;

  @override
  void initState() {
    super.initState();
    isPaused = true;
    _titleController.addListener(_scheduleAutoSuggest);
    _descriptionController.addListener(_scheduleAutoSuggest);
  }

  @override
  void dispose() {
    _suggestionDebounce?.cancel();
    _titleController.removeListener(_scheduleAutoSuggest);
    _descriptionController.removeListener(_scheduleAutoSuggest);
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
    _scheduleAutoSuggest();
  }

  void _scheduleAutoSuggest() {
    _suggestionDebounce?.cancel();
    _suggestionRequestId++;

    final hasMinimumInput = _titleController.text.trim().isNotEmpty &&
        _descriptionController.text.trim().isNotEmpty;

    if (!hasMinimumInput) {
      if (_suggestions.isNotEmpty || _isSuggesting || _autoSuggestReady) {
        setState(() {
          _suggestions = [];
          _isSuggesting = false;
          _autoSuggestReady = false;
        });
      }
      return;
    }

    if (!_autoSuggestReady) {
      setState(() {
        _autoSuggestReady = true;
      });
    }

    _suggestionDebounce = Timer(const Duration(milliseconds: 650), () {
      if (!mounted) return;
      _suggestAssignees(showValidationMessage: false);
    });
  }

  Future<void> _createTask() async {
    final title = _titleController.text.trim();
    final description = _descriptionController.text.trim();

    if (title.isEmpty ||
        description.isEmpty ||
        _dueDate == null ||
        _selectedEmployeeIds.isEmpty) {
      _showMessage(
          'Please complete title, description, due date and assignee.');
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final task = Task(
        title: title,
        description: description,
        status: _selectedStatus,
        project: DBHelper.currentProjectId,
        endDate: _dueDate!,
        emp: _selectedEmployeeIds,
        difficulty: _difficulty,
        priority: _priority,
        canParallelize: _canParallelize,
      );

      await DBHelper.addTask(task);
      if (!mounted) return;
      Navigator.pop(context, true);
    } on Exception catch (error) {
      AppLogger.error('Failed to create task', error, null, 'TaskCreateRoute');
      if (mounted) {
        _showMessage('Could not create task. Please try again.');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _suggestAssignees({bool showValidationMessage = true}) async {
    final title = _titleController.text.trim();
    final description = _descriptionController.text.trim();

    if (title.isEmpty || description.isEmpty) {
      if (showValidationMessage) {
        _showMessage('Please complete title and description first.');
      }
      return;
    }

    if (DBHelper.empProject.isEmpty) {
      if (showValidationMessage) {
        _showMessage('No project members available for assignment.');
      }
      return;
    }

    final requestId = ++_suggestionRequestId;
    setState(() {
      _isSuggesting = true;
    });

    try {
      final result = await AssignmentService.previewDraftAssignment(
        draftTask: {
          'title': title,
          'description': description,
          'project': DBHelper.currentProjectId,
          'due_date': (_dueDate ?? DateTime.now().add(const Duration(days: 1)))
              .millisecondsSinceEpoch,
          'priority': _priority,
          'difficulty': _difficulty,
          'can_parallelize': _canParallelize,
        },
        userIds: DBHelper.empProject.map((employee) => employee.id).toList(),
        config: {
          'maxParallelAssignees': _canParallelize ? 2 : 1,
        },
      );

      final assignments = _asList(result['assignments']);
      final firstAssignment =
          assignments.isNotEmpty ? _asMap(assignments.first) : {};
      final users = _asList(firstAssignment['assigned_users'])
          .map((user) => _AssigneeSuggestion.fromMap(_asMap(user)))
          .where((suggestion) => suggestion.id.isNotEmpty)
          .toList();

      if (!mounted || requestId != _suggestionRequestId) return;
      setState(() {
        _suggestions = users;
      });

      if (users.isEmpty && showValidationMessage) {
        _showMessage('No assignee suggestion found for this draft task.');
      }
    } on Exception catch (error) {
      AppLogger.error(
          'Failed to suggest assignees', error, null, 'TaskCreateRoute');
      if (mounted && showValidationMessage) {
        _showMessage('Could not suggest assignees. Please try again.');
      }
    } finally {
      if (mounted && requestId == _suggestionRequestId) {
        setState(() {
          _isSuggesting = false;
        });
      }
    }
  }

  void _useSuggestion(_AssigneeSuggestion suggestion) {
    if (_selectedEmployeeIds.contains(suggestion.id)) return;
    setState(() {
      if (!_canParallelize) {
        _selectedEmployeeIds.clear();
      }
      _selectedEmployeeIds.add(suggestion.id);
    });
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
        title: const Text('Create task'),
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
                title: 'New task',
                subtitle:
                    'Add a clear task, assign owners, and set the schedule.',
                icon: Icons.add_task_outlined,
              ),
              const SizedBox(height: 14),
              _FormSection(
                title: 'Overview',
                icon: Icons.subject_outlined,
                children: [
                  _StyledTextField(
                    controller: _titleController,
                    label: 'Task title',
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
                      label: 'Task status',
                      icon: StatusHelper.getStatusIcon(_selectedStatus),
                    ),
                    items: StatusHelper.taskStatuses
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
                title: 'Assignees',
                icon: Icons.people_alt_outlined,
                children: [
                  _SuggestionPanel(
                    isLoading: _isSuggesting,
                    autoSuggestReady: _autoSuggestReady,
                    suggestions: _suggestions,
                    selectedEmployeeIds: _selectedEmployeeIds,
                    onSuggest: () =>
                        _suggestAssignees(showValidationMessage: true),
                    onUseSuggestion: _useSuggestion,
                  ),
                  const SizedBox(height: 14),
                  _EmployeeSelector(
                    selectedEmployeeIds: _selectedEmployeeIds,
                    onAdd: (employeeId) {
                      setState(() {
                        _selectedEmployeeIds.add(employeeId);
                      });
                    },
                    onRemove: (employeeId) {
                      setState(() {
                        _selectedEmployeeIds.remove(employeeId);
                      });
                    },
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _FormSection(
                title: 'Assignment settings',
                icon: Icons.tune_outlined,
                children: [
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final stackFields = constraints.maxWidth < 520;
                      final difficulty = _NumberDropdown(
                        label: 'Difficulty',
                        icon: Icons.fitness_center_outlined,
                        value: _difficulty,
                        items: const {
                          1: 'Basic',
                          2: 'Easy',
                          3: 'Medium',
                          4: 'Hard',
                        },
                        onChanged: (value) {
                          setState(() {
                            _difficulty = value ?? 2;
                          });
                          _scheduleAutoSuggest();
                        },
                      );
                      final priority = _NumberDropdown(
                        label: 'Priority',
                        icon: Icons.flag_outlined,
                        value: _priority,
                        items: const {
                          1: 'Very low',
                          2: 'Low',
                          3: 'Medium',
                          4: 'High',
                          5: 'Critical',
                        },
                        onChanged: (value) {
                          setState(() {
                            _priority = value ?? 3;
                          });
                          _scheduleAutoSuggest();
                        },
                      );

                      if (stackFields) {
                        return Column(
                          children: [
                            difficulty,
                            const SizedBox(height: 12),
                            priority,
                          ],
                        );
                      }

                      return Row(
                        children: [
                          Expanded(child: difficulty),
                          const SizedBox(width: 12),
                          Expanded(child: priority),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  _SwitchTile(
                    value: _canParallelize,
                    onChanged: (value) {
                      setState(() {
                        _canParallelize = value;
                      });
                      _scheduleAutoSuggest();
                    },
                  ),
                ],
              ),
              const SizedBox(height: 18),
              _ActionBar(
                isSubmitting: _isSubmitting,
                onCancel: () => Navigator.pop(context, false),
                onSubmit: _createTask,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AssigneeSuggestion {
  final String id;
  final String name;
  final String email;
  final double? adjustedScore;
  final double? skillScore;
  final double? loadScore;
  final double? speedScore;

  const _AssigneeSuggestion({
    required this.id,
    required this.name,
    required this.email,
    required this.adjustedScore,
    required this.skillScore,
    required this.loadScore,
    required this.speedScore,
  });

  factory _AssigneeSuggestion.fromMap(Map<String, dynamic> map) {
    return _AssigneeSuggestion(
      id: _text(map['id']) ?? '',
      name: _text(map['name']) ?? _text(map['email']) ?? 'Unknown member',
      email: _text(map['email']) ?? '',
      adjustedScore: _score(map['adjusted_score']),
      skillScore: _score(map['skill_score']),
      loadScore: _score(map['mcmf_score']),
      speedScore: _score(map['productivity_score']),
    );
  }
}

class _SuggestionPanel extends StatelessWidget {
  final bool isLoading;
  final bool autoSuggestReady;
  final List<_AssigneeSuggestion> suggestions;
  final List<String> selectedEmployeeIds;
  final VoidCallback onSuggest;
  final ValueChanged<_AssigneeSuggestion> onUseSuggestion;

  const _SuggestionPanel({
    required this.isLoading,
    required this.autoSuggestReady,
    required this.suggestions,
    required this.selectedEmployeeIds,
    required this.onSuggest,
    required this.onUseSuggestion,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: ColorPicker.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.auto_awesome_outlined,
                  size: 19,
                  color: ColorPicker.accent,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'AI assignee suggestion',
                      style: TextStyle(
                        color: ColorPicker.fontDark,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      autoSuggestReady
                          ? 'Auto-updates from title, description, deadline and scoring.'
                          : 'Enter title and description to get automatic suggestions.',
                      style: const TextStyle(
                        color: ColorPicker.fontMedium,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: isLoading ? null : onSuggest,
                icon: isLoading
                    ? const SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.psychology_alt_outlined, size: 17),
                label: Text(isLoading ? 'Checking' : 'Refresh'),
              ),
            ],
          ),
          if (isLoading && suggestions.isEmpty) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(minHeight: 3),
          ],
          if (suggestions.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...suggestions.map((suggestion) {
              final selected = selectedEmployeeIds.contains(suggestion.id);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _SuggestionTile(
                  suggestion: suggestion,
                  selected: selected,
                  onTap: () => onUseSuggestion(suggestion),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _SuggestionTile extends StatelessWidget {
  final _AssigneeSuggestion suggestion;
  final bool selected;
  final VoidCallback onTap;

  const _SuggestionTile({
    required this.suggestion,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: selected
            ? ColorPicker.accent.withValues(alpha: 0.08)
            : ColorPicker.cardBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: selected ? ColorPicker.accent : ColorPicker.cardBorder,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: ColorPicker.accent.withValues(alpha: 0.14),
            child: Text(
              suggestion.name.isEmpty ? '?' : suggestion.name[0].toUpperCase(),
              style: const TextStyle(
                color: ColorPicker.accent,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  suggestion.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (suggestion.email.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    suggestion.email,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: ColorPicker.fontMedium,
                      fontSize: 12,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _ScoreChip(label: 'Fit', score: suggestion.adjustedScore),
                    _ScoreChip(label: 'Skill', score: suggestion.skillScore),
                    _ScoreChip(label: 'Load', score: suggestion.loadScore),
                    _ScoreChip(label: 'Speed', score: suggestion.speedScore),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton.icon(
            onPressed: selected ? null : onTap,
            icon: Icon(selected ? Icons.check_outlined : Icons.add_outlined,
                size: 17),
            label: Text(selected ? 'Selected' : 'Use'),
          ),
        ],
      ),
    );
  }
}

class _ScoreChip extends StatelessWidget {
  final String label;
  final double? score;

  const _ScoreChip({
    required this.label,
    required this.score,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _scoreColor(score).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$label ${_scoreText(score)}',
        style: TextStyle(
          color: _scoreColor(score),
          fontSize: 11,
          fontWeight: FontWeight.w700,
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
    final availableEmployees = DBHelper.empProject;

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
          items: availableEmployees
              .where((employee) => !selectedEmployeeIds.contains(employee.id))
              .map(
                (employee) => DropdownMenuItem<String>(
                  value: employee.id,
                  child: Text(
                    '${employee.name} (${employee.role})',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (value) {
            if (value == null || selectedEmployeeIds.contains(value)) return;
            onAdd(value);
          },
          initialValue: null,
        ),
        const SizedBox(height: 12),
        if (selectedEmployeeIds.isEmpty)
          const _InlineWarning(text: 'Please select at least one employee')
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: selectedEmployeeIds.map((employeeId) {
              final matches =
                  availableEmployees.where((e) => e.id == employeeId);
              final employee = matches.isNotEmpty
                  ? matches.first
                  : DBHelper.empMap[employeeId];
              if (employee == null) return const SizedBox.shrink();
              return Chip(
                avatar: const Icon(Icons.person_outline, size: 17),
                label: Text('${employee.name} (${employee.role})'),
                deleteIcon: const Icon(Icons.close, size: 18),
                onDeleted: () => onRemove(employeeId),
                backgroundColor: ColorPicker.backgroundLight,
                side: const BorderSide(color: ColorPicker.cardBorder),
              );
            }).toList(),
          ),
        if (availableEmployees.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 10),
            child: Text(
              'No employees found for this project team.',
              style: TextStyle(color: ColorPicker.fontMedium),
            ),
          ),
      ],
    );
  }
}

class _NumberDropdown extends StatelessWidget {
  final String label;
  final IconData icon;
  final int value;
  final Map<int, String> items;
  final ValueChanged<int?> onChanged;

  const _NumberDropdown({
    required this.label,
    required this.icon,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<int>(
      initialValue: items.containsKey(value) ? value : items.keys.first,
      isExpanded: true,
      decoration: _fieldDecoration(label: label, icon: icon),
      items: items.entries
          .map(
            (entry) => DropdownMenuItem<int>(
              value: entry.key,
              child: Text(entry.value),
            ),
          )
          .toList(),
      onChanged: onChanged,
    );
  }
}

class _SwitchTile extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SwitchTile({
    required this.value,
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
          Switch(value: value, onChanged: onChanged),
        ],
      ),
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
                : const Icon(Icons.add_task_outlined, size: 18),
            label: Text(isSubmitting ? 'Creating' : 'Create task'),
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

List<dynamic> _asList(dynamic value) {
  if (value is List) return value;
  return const [];
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return const {};
}

String? _text(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

double? _score(dynamic value) {
  if (value is num) return value.toDouble().clamp(0, 1).toDouble();
  return double.tryParse(value?.toString() ?? '')?.clamp(0, 1).toDouble();
}

String _scoreText(double? value) {
  if (value == null) return '-';
  return '${(value * 100).round()}%';
}

Color _scoreColor(double? value) {
  final score = value ?? 0;
  if (score >= 0.75) return Colors.green.shade700;
  if (score >= 0.45) return Colors.orange.shade800;
  return ColorPicker.fontMedium;
}
