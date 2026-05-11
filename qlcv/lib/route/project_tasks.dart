import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qlcv/model/color_picker.dart';
import 'package:qlcv/model/task.dart';
import 'package:qlcv/model/task_box.dart';
import 'package:qlcv/utils/search_helper.dart';
import 'package:qlcv/utils/status_helper.dart';

import '../model/db_helper.dart';
import 'task_create.dart';

class ProjectTasks extends StatefulWidget {
  const ProjectTasks({Key? key}) : super(key: key);

  @override
  State<ProjectTasks> createState() => _ProjectTasksState();
}

class _ProjectTasksState extends State<ProjectTasks> {
  final TextEditingController _searchController = TextEditingController();
  String? _selectedStatus;
  List<Task> _filteredTasks = [];
  bool _isLoading = false;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _applyFilters();
  }

  Future<void> _reloadProjectTasks() async {
    if (DBHelper.currentProjectId.isEmpty || _isLoading) return;
    setState(() {
      _isLoading = true;
    });
    await DBHelper.taskUpdateWithProjectId(DBHelper.currentProjectId);
    if (mounted) {
      setState(() {
        _isLoading = false;
        _applyFilters();
      });
    }
  }

  void _applyFilters() {
    List<Task> filtered = List.from(DBHelper.projectTasks);
    final query = _searchController.text.trim();

    if (query.isNotEmpty) {
      filtered = filtered
          .where((Task task) => SearchHelper.matchesAny(query, [
                task.title,
                task.description,
              ]))
          .toList();
    }

    if (_selectedStatus != null) {
      filtered = filtered
          .where((Task task) =>
              StatusHelper.normalizeStatus(task.status) == _selectedStatus)
          .toList();
    }

    _filteredTasks = filtered;
  }

  void _scheduleReload() {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) {
        _reloadProjectTasks();
      }
    });
  }

  Future<void> _openCreateTask() async {
    if (DBHelper.mainUser.role != 'admin' &&
        DBHelper.mainUser.role != 'manager') {
      showDialog(
        context: context,
        builder: (BuildContext context) {
          return AlertDialog(
            title: const Text('Access Denied'),
            content: const Text(
                'Employees cannot create tasks. Please contact your manager or admin.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          );
        },
      );
      return;
    }

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => TaskCreateRoute(),
      ),
    );
    if (mounted) {
      await _reloadProjectTasks();
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Scaffold(
        backgroundColor: ColorPicker.backgroundLight,
        body: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: ColorPicker.cardBackground,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Tooltip(
                    message: 'Back',
                    child: IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.arrow_back),
                      color: ColorPicker.fontDark,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Project Tasks',
                          style: TextStyle(
                            color: ColorPicker.fontDark,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          DBHelper.mainUser.name,
                          style: const TextStyle(
                            color: ColorPicker.fontMedium,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: _openCreateTask,
                    icon: const Icon(Icons.add_task, size: 18),
                    label: const Text('Add Task'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: ColorPicker.accent,
                      side: const BorderSide(color: ColorPicker.accent),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(16.0),
              color: ColorPicker.cardBackground,
              child: Column(
                children: [
                  TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search tasks...',
                      prefixIcon: const Icon(Icons.search,
                          color: ColorPicker.fontLight),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear,
                                  color: ColorPicker.fontLight),
                              onPressed: () {
                                setState(() {
                                  _searchController.clear();
                                  _applyFilters();
                                });
                                _reloadProjectTasks();
                              },
                            )
                          : null,
                      filled: true,
                      fillColor: ColorPicker.backgroundLight,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12.0),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onChanged: (value) {
                      setState(_applyFilters);
                      _scheduleReload();
                    },
                  ),
                  const SizedBox(height: 12),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        FilterChip(
                          label: const Text('All'),
                          selected: _selectedStatus == null,
                          selectedColor: ColorPicker.accent,
                          labelStyle: TextStyle(
                            color: _selectedStatus == null
                                ? Colors.white
                                : ColorPicker.fontMedium,
                          ),
                          onSelected: (selected) {
                            setState(() {
                              _selectedStatus = null;
                              _applyFilters();
                            });
                            _reloadProjectTasks();
                          },
                        ),
                        const SizedBox(width: 8),
                        ...StatusHelper.taskStatuses.map((status) {
                          final isSelected = _selectedStatus == status;
                          final color = StatusHelper.getStatusColor(status);
                          return Padding(
                            padding: const EdgeInsets.only(right: 8.0),
                            child: FilterChip(
                              label: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    StatusHelper.getStatusIcon(status),
                                    size: 16,
                                    color: isSelected ? Colors.white : color,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(StatusHelper.getStatusLabel(status)),
                                ],
                              ),
                              selected: isSelected,
                              selectedColor: color,
                              backgroundColor: color.withValues(alpha: 0.1),
                              labelStyle: TextStyle(
                                color: isSelected ? Colors.white : color,
                                fontWeight: isSelected
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                              ),
                              onSelected: (selected) {
                                setState(() {
                                  _selectedStatus = selected ? status : null;
                                  _applyFilters();
                                });
                                _reloadProjectTasks();
                              },
                            ),
                          );
                        }).toList(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _filteredTasks.isEmpty
                      ? const Center(
                          child: Text(
                            'No tasks found',
                            style: TextStyle(
                              color: ColorPicker.fontMedium,
                              fontSize: 16,
                            ),
                          ),
                        )
                      : TaskBoxList(tasks: _filteredTasks),
            ),
          ],
        ),
      ),
    );
  }
}
