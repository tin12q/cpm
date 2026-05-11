import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
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
  late List<TaskAttachment> _attachments;
  final List<PlatformFile> _pendingAttachments = [];
  final Set<String> _removedAttachmentIds = {};
  String? _downloadingAttachmentId;
  bool _isSavingAttachments = false;

  bool get _canEdit =>
      DBHelper.mainUser.role == 'admin' || DBHelper.mainUser.role == 'manager';

  @override
  void initState() {
    super.initState();
    task = widget.task;
    selectedEmployeeIds =
        DBHelper.resolveEmployeeIds(task.emp).toSet().toList();
    _titleController = TextEditingController(text: task.title);
    _descriptionController = TextEditingController(text: task.description);
    _attachments = List<TaskAttachment>.from(task.attachments);
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

  Future<List<TaskAttachment>> updateTask(
      Task task,
      String title,
      String description,
      DateTime endDate,
      String status,
      List<String> employeeIds,
      {int? difficulty,
      int? priority,
      bool? canParallelize,
      List<PlatformFile> newAttachments = const [],
      List<String> removeAttachmentIds = const []}) async {
    task.title = title.trim();
    task.description = description.trim();
    task.endDate = endDate;
    task.status = status;
    task.emp = employeeIds;
    if (difficulty != null) task.difficulty = difficulty;
    if (priority != null) task.priority = priority;
    if (canParallelize != null) task.canParallelize = canParallelize;

    return DBHelper.updateTask(
      task,
      attachments: newAttachments,
      removeAttachmentIds: removeAttachmentIds,
    );
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

    try {
      final updatedAttachments = await updateTask(
        task,
        _titleController.text,
        _descriptionController.text,
        task.endDate,
        _selectedStatus,
        selectedEmployeeIds,
        difficulty: task.difficulty,
        priority: task.priority,
        canParallelize: task.canParallelize,
        newAttachments: _pendingAttachments,
        removeAttachmentIds: _removedAttachmentIds.toList(),
      );

      if (!mounted) return;
      setState(() {
        _attachments = updatedAttachments;
        task.attachments = updatedAttachments;
        _pendingAttachments.clear();
        _removedAttachmentIds.clear();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Task updated successfully'),
          backgroundColor: ColorPicker.buttonSuccess,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: ColorPicker.buttonDanger,
        ),
      );
    }
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

  Future<void> _pickAttachments() async {
    if (_isSavingAttachments) return;

    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      withData: true,
      withReadStream: true,
    );

    if (result == null || result.files.isEmpty) return;

    final filesToUpload = <PlatformFile>[];
    setState(() {
      final existingKeys = _pendingAttachments
          .map((file) => '${file.name}:${file.size}:${file.path ?? ''}')
          .toSet();
      for (final file in result.files) {
        final key = '${file.name}:${file.size}:${file.path ?? ''}';
        if (!existingKeys.contains(key)) {
          _pendingAttachments.add(file);
          filesToUpload.add(file);
          existingKeys.add(key);
        }
      }
    });

    if (filesToUpload.isEmpty) return;

    await _saveAttachmentChanges(newAttachments: filesToUpload);
  }

  Future<void> _removeExistingAttachment(TaskAttachment attachment) async {
    if (attachment.id.isEmpty) return;
    final previousAttachments = List<TaskAttachment>.from(_attachments);
    setState(() {
      _removedAttachmentIds.add(attachment.id);
      _attachments.removeWhere((item) => item.id == attachment.id);
    });

    try {
      await _saveAttachmentChanges(removeAttachmentIds: [attachment.id]);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _attachments = previousAttachments;
        _removedAttachmentIds.remove(attachment.id);
      });
    }
  }

  void _removePendingAttachment(PlatformFile file) {
    setState(() {
      _pendingAttachments.remove(file);
    });
  }

  Future<void> _downloadAttachment(TaskAttachment attachment) async {
    if (attachment.id.isEmpty || _downloadingAttachmentId != null) return;

    setState(() {
      _downloadingAttachmentId = attachment.id;
    });

    try {
      final file = await DBHelper.downloadTaskAttachment(task.id, attachment);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Downloaded to ${file.path}'),
          backgroundColor: ColorPicker.buttonSuccess,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not download attachment'),
          backgroundColor: ColorPicker.buttonDanger,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _downloadingAttachmentId = null;
        });
      }
    }
  }

  Future<void> _previewAttachment(TaskAttachment attachment) async {
    if (attachment.id.isEmpty) return;
    await showDialog<void>(
      context: context,
      builder: (context) => _SavedAttachmentPreviewDialog(
        taskId: task.id,
        attachment: attachment,
        onDownload: () => _downloadAttachment(attachment),
      ),
    );
  }

  Future<void> _previewPendingAttachment(PlatformFile file) async {
    Uint8List? bytes = file.bytes;
    if (bytes == null && file.path != null) {
      bytes = await File(file.path!).readAsBytes();
    }
    if (bytes == null && file.readStream != null) {
      final chunks = <int>[];
      await for (final chunk in file.readStream!) {
        chunks.addAll(chunk);
      }
      bytes = Uint8List.fromList(chunks);
    }

    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => _AttachmentPreviewDialog(
        name: file.name,
        size: file.size,
        mimetype: null,
        bytes: bytes,
      ),
    );
  }

  Future<void> _saveAttachmentChanges({
    List<PlatformFile> newAttachments = const [],
    List<String> removeAttachmentIds = const [],
  }) async {
    if (_isSavingAttachments) return;

    setState(() {
      _isSavingAttachments = true;
    });

    try {
      final updatedAttachments = await updateTask(
        task,
        _titleController.text,
        _descriptionController.text,
        task.endDate,
        _selectedStatus,
        selectedEmployeeIds,
        difficulty: task.difficulty,
        priority: task.priority,
        canParallelize: task.canParallelize,
        newAttachments: newAttachments,
        removeAttachmentIds: removeAttachmentIds,
      );

      if (!mounted) return;
      setState(() {
        _attachments = updatedAttachments;
        task.attachments = updatedAttachments;
        _pendingAttachments.removeWhere(newAttachments.contains);
        for (final id in removeAttachmentIds) {
          _removedAttachmentIds.remove(id);
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Attachments saved'),
          backgroundColor: ColorPicker.buttonSuccess,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _pendingAttachments.removeWhere(newAttachments.contains);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: ColorPicker.buttonDanger,
        ),
      );
      rethrow;
    } finally {
      if (mounted) {
        setState(() {
          _isSavingAttachments = false;
        });
      }
    }
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
                title: 'Attachments',
                icon: Icons.attach_file_outlined,
                children: [
                  _AttachmentList(
                    attachments: _attachments,
                    pendingAttachments: _pendingAttachments,
                    canEdit: _canEdit,
                    isSaving: _isSavingAttachments,
                    downloadingAttachmentId: _downloadingAttachmentId,
                    onPick: _pickAttachments,
                    onRemoveExisting: _removeExistingAttachment,
                    onRemovePending: _removePendingAttachment,
                    onDownload: _downloadAttachment,
                    onPreview: _previewAttachment,
                    onPreviewPending: _previewPendingAttachment,
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

class _AttachmentList extends StatelessWidget {
  final List<TaskAttachment> attachments;
  final List<PlatformFile> pendingAttachments;
  final bool canEdit;
  final bool isSaving;
  final String? downloadingAttachmentId;
  final VoidCallback onPick;
  final ValueChanged<TaskAttachment> onRemoveExisting;
  final ValueChanged<PlatformFile> onRemovePending;
  final ValueChanged<TaskAttachment> onDownload;
  final ValueChanged<TaskAttachment> onPreview;
  final ValueChanged<PlatformFile> onPreviewPending;

  const _AttachmentList({
    required this.attachments,
    required this.pendingAttachments,
    required this.canEdit,
    required this.isSaving,
    required this.downloadingAttachmentId,
    required this.onPick,
    required this.onRemoveExisting,
    required this.onRemovePending,
    required this.onDownload,
    required this.onPreview,
    required this.onPreviewPending,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (canEdit) ...[
          OutlinedButton.icon(
            onPressed: isSaving ? null : onPick,
            icon: isSaving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.upload_file_outlined, size: 18),
            label: Text(isSaving ? 'Saving files' : 'Add files'),
          ),
          const SizedBox(height: 10),
        ],
        if (attachments.isEmpty && pendingAttachments.isEmpty)
          const Text(
            'No files attached',
            style: TextStyle(color: ColorPicker.fontMedium),
          )
        else ...[
          ...attachments.map((attachment) {
            final isDownloading = downloadingAttachmentId == attachment.id;
            return _AttachmentTile(
              name: attachment.originalName,
              size: attachment.size,
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isDownloading)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    IconButton(
                      onPressed: () => onDownload(attachment),
                      icon: const Icon(Icons.download_outlined, size: 18),
                      tooltip: 'Download file',
                    ),
                  if (canEdit)
                    IconButton(
                      onPressed: () => onRemoveExisting(attachment),
                      icon: const Icon(Icons.close_outlined, size: 18),
                      tooltip: 'Remove file',
                    ),
                ],
              ),
              onTap: () => onPreview(attachment),
            );
          }),
          ...pendingAttachments.map((file) {
            return _AttachmentTile(
              name: file.name,
              size: file.size,
              subtitle: 'Saving to task',
              trailing: IconButton(
                onPressed: () => onRemovePending(file),
                icon: const Icon(Icons.close_outlined, size: 18),
                tooltip: 'Remove file',
              ),
              onTap: () => onPreviewPending(file),
            );
          }),
        ],
      ],
    );
  }
}

class _AttachmentTile extends StatelessWidget {
  final String name;
  final int size;
  final String? subtitle;
  final Widget trailing;
  final VoidCallback? onTap;

  const _AttachmentTile({
    required this.name,
    required this.size,
    required this.trailing,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: ColorPicker.backgroundLight,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: ColorPicker.cardBorder),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.insert_drive_file_outlined,
              color: ColorPicker.fontMedium,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: ColorPicker.fontDark,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle ?? _formatFileSize(size),
                    style: const TextStyle(
                      color: ColorPicker.fontMedium,
                      fontSize: 12,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      _formatFileSize(size),
                      style: const TextStyle(
                        color: ColorPicker.fontLight,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }
}

class _SavedAttachmentPreviewDialog extends StatelessWidget {
  final String taskId;
  final TaskAttachment attachment;
  final VoidCallback onDownload;

  const _SavedAttachmentPreviewDialog({
    required this.taskId,
    required this.attachment,
    required this.onDownload,
  });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Uint8List>(
      future: DBHelper.fetchTaskAttachmentBytes(taskId, attachment),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const AlertDialog(
            content: SizedBox(
              height: 90,
              child: Center(child: CircularProgressIndicator()),
            ),
          );
        }

        if (snapshot.hasError || !snapshot.hasData) {
          return AlertDialog(
            title: const Text('Preview unavailable'),
            content: Text(snapshot.error?.toString() ??
                'Could not load attachment preview.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Close'),
              ),
            ],
          );
        }

        return _AttachmentPreviewDialog(
          name: attachment.originalName,
          size: attachment.size,
          mimetype: attachment.mimetype,
          bytes: snapshot.data,
          onDownload: onDownload,
        );
      },
    );
  }
}

class _AttachmentPreviewDialog extends StatelessWidget {
  final String name;
  final int size;
  final String? mimetype;
  final Uint8List? bytes;
  final VoidCallback? onDownload;

  const _AttachmentPreviewDialog({
    required this.name,
    required this.size,
    required this.bytes,
    this.mimetype,
    this.onDownload,
  });

  @override
  Widget build(BuildContext context) {
    final preview = _buildPreview();

    return Dialog(
      insetPadding: const EdgeInsets.all(18),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560, maxHeight: 720),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 8, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.insert_drive_file_outlined,
                      color: ColorPicker.fontMedium),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: ColorPicker.fontDark,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          _formatFileSize(size),
                          style: const TextStyle(
                            color: ColorPicker.fontMedium,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_outlined),
                  ),
                ],
              ),
            ),
            Flexible(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: preview,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Close'),
                  ),
                  if (onDownload != null) ...[
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      onPressed: onDownload,
                      icon: const Icon(Icons.download_outlined, size: 18),
                      label: const Text('Download'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreview() {
    if (bytes == null) {
      return const _PreviewFallback(
        message: 'This file cannot be previewed before saving.',
      );
    }

    if (_isImageFile(name, mimetype)) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: InteractiveViewer(
          minScale: 0.6,
          maxScale: 4,
          child: Image.memory(
            bytes!,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const _PreviewFallback(
              message: 'Image preview failed.',
            ),
          ),
        ),
      );
    }

    if (_isTextFile(name, mimetype)) {
      final text = _decodeText(bytes!);
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: ColorPicker.backgroundLight,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: ColorPicker.cardBorder),
        ),
        child: SingleChildScrollView(
          child: SelectableText(
            text,
            style: const TextStyle(
              color: ColorPicker.fontDark,
              fontSize: 13,
              height: 1.35,
            ),
          ),
        ),
      );
    }

    if (_isPdfFile(name, mimetype)) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Container(
          height: 520,
          decoration: BoxDecoration(
            color: ColorPicker.backgroundLight,
            border: Border.all(color: ColorPicker.cardBorder),
          ),
          child: _PdfPreview(bytes: bytes!, name: name),
        ),
      );
    }

    return const _PreviewFallback(
      message: 'Preview is not available for this file type.',
    );
  }
}

class _PdfPreview extends StatefulWidget {
  final Uint8List bytes;
  final String name;

  const _PdfPreview({
    required this.bytes,
    required this.name,
  });

  @override
  State<_PdfPreview> createState() => _PdfPreviewState();
}

class _PdfPreviewState extends State<_PdfPreview> {
  late final Future<File> _pdfFileFuture;

  @override
  void initState() {
    super.initState();
    _pdfFileFuture = _writePdfPreviewFile(widget.bytes, widget.name);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<File>(
      future: _pdfFileFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError || !snapshot.hasData) {
          return const _PreviewFallback(message: 'PDF preview failed.');
        }

        return PDFView(
          filePath: snapshot.data!.path,
          enableSwipe: true,
          swipeHorizontal: false,
          autoSpacing: true,
          pageFling: true,
          onError: (_) {},
          onPageError: (_, __) {},
        );
      },
    );
  }
}

class _PreviewFallback extends StatelessWidget {
  final String message;

  const _PreviewFallback({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.preview_outlined,
            size: 36,
            color: ColorPicker.fontMedium,
          ),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: ColorPicker.fontMedium),
          ),
        ],
      ),
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

String _formatFileSize(int bytes) {
  if (bytes < 1024) return '$bytes B';
  final kb = bytes / 1024;
  if (kb < 1024) return '${kb.toStringAsFixed(kb >= 100 ? 0 : 1)} KB';
  final mb = kb / 1024;
  return '${mb.toStringAsFixed(mb >= 100 ? 0 : 1)} MB';
}

bool _isImageFile(String name, String? mimetype) {
  final lowerName = name.toLowerCase();
  final lowerType = mimetype?.toLowerCase() ?? '';
  return lowerType.startsWith('image/') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.gif') ||
      lowerName.endsWith('.webp') ||
      lowerName.endsWith('.bmp');
}

bool _isTextFile(String name, String? mimetype) {
  final lowerName = name.toLowerCase();
  final lowerType = mimetype?.toLowerCase() ?? '';
  return lowerType.startsWith('text/') ||
      lowerType.contains('json') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.log') ||
      lowerName.endsWith('.yaml') ||
      lowerName.endsWith('.yml');
}

bool _isPdfFile(String name, String? mimetype) {
  final lowerName = name.toLowerCase();
  final lowerType = mimetype?.toLowerCase() ?? '';
  return lowerType == 'application/pdf' || lowerName.endsWith('.pdf');
}

Future<File> _writePdfPreviewFile(Uint8List bytes, String name) async {
  final directory = await getTemporaryDirectory();
  final safeName = name.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
  final pdfName =
      safeName.toLowerCase().endsWith('.pdf') ? safeName : '$safeName.pdf';
  final file = File(
      '${directory.path}/attachment_preview_${DateTime.now().microsecondsSinceEpoch}_$pdfName');
  return file.writeAsBytes(bytes, flush: true);
}

String _decodeText(Uint8List bytes) {
  try {
    return const Utf8Decoder(allowMalformed: true).convert(bytes);
  } catch (_) {
    return String.fromCharCodes(bytes);
  }
}
