import 'dart:math';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../model/color_picker.dart';
import '../model/db_helper.dart';
import '../model/emp.dart';
import '../model/project.dart';
import '../model/task.dart';
import '../utils/status_helper.dart';

const _allProjects = '__all_projects__';
const _allStatuses = '__all_statuses__';

enum _DashboardRange {
  all,
  next7Days,
  next30Days,
  overdue,
}

class Dashboard extends StatefulWidget {
  const Dashboard({super.key});

  @override
  State<Dashboard> createState() => _DashboardState();
}

class _DashboardState extends State<Dashboard> {
  String _projectFilter = _allProjects;
  String _statusFilter = _allStatuses;
  _DashboardRange _rangeFilter = _DashboardRange.all;

  @override
  Widget build(BuildContext context) {
    final projectFilter = _effectiveProjectFilter();
    final tasks = _filteredTasks(projectFilter);
    final projects = _filteredProjects(projectFilter);
    final stats = _DashboardStats.fromData(
      tasks: tasks,
      projects: projects,
      memberCount: DBHelper.employees.length,
      teamCount: DBHelper.deps.length,
    );
    final memberLoads = _memberLoads(tasks).take(6).toList();
    final dueBuckets = _dueBuckets(tasks);
    final focusTasks = _focusTasks(tasks).take(6).toList();

    return Scaffold(
      backgroundColor: ColorPicker.backgroundLight,
      body: SafeArea(
        child: RefreshIndicator(
          color: ColorPicker.accent,
          onRefresh: _refreshDashboard,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              _DashboardHeader(
                userName: DBHelper.mainUser.name,
                role: DBHelper.mainUser.role,
                updatedAt: DateTime.now(),
              ),
              const SizedBox(height: 12),
              _DashboardFilters(
                projects: DBHelper.projects,
                projectFilter: projectFilter,
                statusFilter: _statusFilter,
                rangeFilter: _rangeFilter,
                onProjectChanged: (value) {
                  if (value == null) return;
                  setState(() => _projectFilter = value);
                },
                onStatusChanged: (value) {
                  setState(() => _statusFilter = value);
                },
                onRangeChanged: (value) {
                  setState(() => _rangeFilter = value);
                },
                onReset: () {
                  setState(() {
                    _projectFilter = _allProjects;
                    _statusFilter = _allStatuses;
                    _rangeFilter = _DashboardRange.all;
                  });
                },
              ),
              const SizedBox(height: 12),
              _MetricGrid(stats: stats),
              const SizedBox(height: 12),
              _TaskStatusChart(stats: stats),
              const SizedBox(height: 12),
              _MemberWorkloadChart(memberLoads: memberLoads),
              const SizedBox(height: 12),
              _DueDateChart(buckets: dueBuckets),
              const SizedBox(height: 12),
              _ProjectProgressPanel(projects: projects, tasks: tasks),
              const SizedBox(height: 12),
              _FocusTasksPanel(tasks: focusTasks),
            ],
          ),
        ),
      ),
    );
  }

  String _effectiveProjectFilter() {
    if (_projectFilter == _allProjects) return _allProjects;
    final exists = DBHelper.projects
        .any((project) => project.id.toString() == _projectFilter);
    return exists ? _projectFilter : _allProjects;
  }

  List<Project> _filteredProjects(String projectFilter) {
    if (projectFilter == _allProjects)
      return List<Project>.from(DBHelper.projects);
    return DBHelper.projects
        .where((project) => project.id.toString() == projectFilter)
        .toList();
  }

  List<Task> _filteredTasks(String projectFilter) {
    final today = _startOfDay(DateTime.now());
    final next7 = today.add(const Duration(days: 7));
    final next30 = today.add(const Duration(days: 30));

    return DBHelper.tasks.where((task) {
      if (projectFilter != _allProjects && task.project != projectFilter) {
        return false;
      }

      final status = _taskHealthStatus(task);
      if (_statusFilter != _allStatuses && status != _statusFilter) {
        return false;
      }

      final dueDate = _startOfDay(task.endDate);
      switch (_rangeFilter) {
        case _DashboardRange.all:
          return true;
        case _DashboardRange.next7Days:
          return !dueDate.isBefore(today) && !dueDate.isAfter(next7);
        case _DashboardRange.next30Days:
          return !dueDate.isBefore(today) && !dueDate.isAfter(next30);
        case _DashboardRange.overdue:
          return _isOverdue(task);
      }
    }).toList();
  }

  Future<void> _refreshDashboard() async {
    await Future.wait([
      DBHelper.loadTasksPage(page: 1, limit: 100),
      DBHelper.loadProjectsPage(page: 1, limit: 100),
      DBHelper.getDep(),
      DBHelper.getEmp(),
    ]);
    DBHelper.initMap();
    DBHelper.updateTaskEMP();
    if (mounted) setState(() {});
  }

  List<_MemberLoad> _memberLoads(List<Task> tasks) {
    final loads = <String, _MemberLoad>{};

    for (final task in tasks) {
      final assignees = task.emp.isEmpty ? const ['Unassigned'] : task.emp;
      final status = _taskHealthStatus(task);

      for (final assignee in assignees) {
        final name =
            assignee == 'Unassigned' ? 'Unassigned' : _employeeName(assignee);
        final load = loads[name] ?? _MemberLoad(name: name);
        load.total += 1;
        if (status == 'completed') {
          load.completed += 1;
        } else if (status == 'late') {
          load.late += 1;
        } else {
          load.inProgress += 1;
        }
        loads[name] = load;
      }
    }

    return loads.values.toList()
      ..sort((a, b) {
        final totalCompare = b.total.compareTo(a.total);
        if (totalCompare != 0) return totalCompare;
        return a.name.compareTo(b.name);
      });
  }

  List<_DueBucket> _dueBuckets(List<Task> tasks) {
    final today = _startOfDay(DateTime.now());
    final buckets = [
      for (var i = 0; i < 7; i++)
        _DueBucket(date: today.add(Duration(days: i))),
    ];

    for (final task in tasks) {
      final due = _startOfDay(task.endDate);
      final index = due.difference(today).inDays;
      if (index < 0 || index >= buckets.length) continue;

      final status = _taskHealthStatus(task);
      if (status == 'completed') {
        buckets[index].completed += 1;
      } else if (status == 'late') {
        buckets[index].late += 1;
      } else {
        buckets[index].inProgress += 1;
      }
    }

    return buckets;
  }

  List<Task> _focusTasks(List<Task> tasks) {
    return List<Task>.from(tasks)
      ..sort((a, b) {
        final aLate = _isOverdue(a) ? 0 : 1;
        final bLate = _isOverdue(b) ? 0 : 1;
        final lateCompare = aLate.compareTo(bLate);
        if (lateCompare != 0) return lateCompare;

        final priorityCompare = b.priority.compareTo(a.priority);
        if (priorityCompare != 0) return priorityCompare;

        return a.endDate.compareTo(b.endDate);
      });
  }
}

class _DashboardHeader extends StatelessWidget {
  final String userName;
  final String role;
  final DateTime updatedAt;

  const _DashboardHeader({
    required this.userName,
    required this.role,
    required this.updatedAt,
  });

  @override
  Widget build(BuildContext context) {
    final displayName = userName.trim().isEmpty ? 'User' : userName.trim();
    return _PanelShell(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: ColorPicker.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.insert_chart_outlined,
              color: ColorPicker.accent,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Dashboard',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: ColorPicker.fontDark,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$displayName - ${_roleLabel(role)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontMedium,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                _InfoChip(
                  icon: Icons.sync_outlined,
                  label: 'Updated ${DateFormat('HH:mm').format(updatedAt)}',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardFilters extends StatelessWidget {
  final List<Project> projects;
  final String projectFilter;
  final String statusFilter;
  final _DashboardRange rangeFilter;
  final ValueChanged<String?> onProjectChanged;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<_DashboardRange> onRangeChanged;
  final VoidCallback onReset;

  const _DashboardFilters({
    required this.projects,
    required this.projectFilter,
    required this.statusFilter,
    required this.rangeFilter,
    required this.onProjectChanged,
    required this.onStatusChanged,
    required this.onRangeChanged,
    required this.onReset,
  });

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Filters',
      icon: Icons.tune_outlined,
      trailing: TextButton.icon(
        onPressed: onReset,
        icon: const Icon(Icons.restart_alt_outlined, size: 16),
        label: const Text('Reset'),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DropdownButtonFormField<String>(
            value: projectFilter,
            isExpanded: true,
            decoration: _filterDecoration(
              label: 'Project',
              icon: Icons.cases_outlined,
            ),
            items: [
              const DropdownMenuItem(
                value: _allProjects,
                child: Text('All projects'),
              ),
              ...projects.map(
                (project) => DropdownMenuItem(
                  value: project.id.toString(),
                  child: Text(
                    project.title.toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
            onChanged: onProjectChanged,
          ),
          const SizedBox(height: 12),
          _FilterChipRow(
            title: 'Status',
            children: [
              _DashboardFilterChip(
                label: 'All',
                selected: statusFilter == _allStatuses,
                onSelected: () => onStatusChanged(_allStatuses),
              ),
              _DashboardFilterChip(
                label: 'In progress',
                selected: statusFilter == 'in_progress',
                color: ColorPicker.statusInProgress,
                onSelected: () => onStatusChanged('in_progress'),
              ),
              _DashboardFilterChip(
                label: 'Completed',
                selected: statusFilter == 'completed',
                color: ColorPicker.statusCompleted,
                onSelected: () => onStatusChanged('completed'),
              ),
              _DashboardFilterChip(
                label: 'Late',
                selected: statusFilter == 'late',
                color: ColorPicker.statusLate,
                onSelected: () => onStatusChanged('late'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _FilterChipRow(
            title: 'Due date',
            children: [
              _DashboardFilterChip(
                label: 'All',
                selected: rangeFilter == _DashboardRange.all,
                onSelected: () => onRangeChanged(_DashboardRange.all),
              ),
              _DashboardFilterChip(
                label: 'Next 7d',
                selected: rangeFilter == _DashboardRange.next7Days,
                onSelected: () => onRangeChanged(_DashboardRange.next7Days),
              ),
              _DashboardFilterChip(
                label: 'Next 30d',
                selected: rangeFilter == _DashboardRange.next30Days,
                onSelected: () => onRangeChanged(_DashboardRange.next30Days),
              ),
              _DashboardFilterChip(
                label: 'Overdue',
                selected: rangeFilter == _DashboardRange.overdue,
                color: ColorPicker.statusLate,
                onSelected: () => onRangeChanged(_DashboardRange.overdue),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  final _DashboardStats stats;

  const _MetricGrid({required this.stats});

  @override
  Widget build(BuildContext context) {
    final metrics = [
      _MetricData(
        label: 'Tasks',
        value: stats.totalTasks.toString(),
        icon: Icons.task_alt_outlined,
        color: ColorPicker.accent,
      ),
      _MetricData(
        label: 'Projects',
        value: stats.totalProjects.toString(),
        icon: Icons.cases_outlined,
        color: ColorPicker.second,
      ),
      _MetricData(
        label: 'Late',
        value: stats.lateTasks.toString(),
        icon: Icons.warning_amber_outlined,
        color: ColorPicker.statusLate,
      ),
      _MetricData(
        label: 'Done',
        value: '${stats.completionRate}%',
        icon: Icons.check_circle_outline,
        color: ColorPicker.statusCompleted,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 620 ? 4 : 2;
        final itemWidth =
            (constraints.maxWidth - ((columns - 1) * 10)) / columns;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: metrics
              .map(
                (metric) => SizedBox(
                  width: itemWidth,
                  child: _MetricCard(metric: metric),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _TaskStatusChart extends StatelessWidget {
  final _DashboardStats stats;

  const _TaskStatusChart({required this.stats});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Task status',
      icon: Icons.donut_large_outlined,
      trailing: _InfoChip(
        icon: Icons.groups_2_outlined,
        label: '${stats.memberCount} members',
      ),
      child: stats.totalTasks == 0
          ? const _EmptyState(message: 'No tasks match this filter.')
          : Column(
              children: [
                SizedBox(
                  height: 220,
                  child: PieChart(
                    PieChartData(
                      centerSpaceRadius: 52,
                      sectionsSpace: 3,
                      pieTouchData: PieTouchData(enabled: true),
                      sections: [
                        if (stats.completedTasks > 0)
                          _pieSection(
                            value: stats.completedTasks,
                            total: stats.totalTasks,
                            color: ColorPicker.statusCompleted,
                            label: 'Done',
                          ),
                        if (stats.inProgressTasks > 0)
                          _pieSection(
                            value: stats.inProgressTasks,
                            total: stats.totalTasks,
                            color: ColorPicker.statusInProgress,
                            label: 'Doing',
                          ),
                        if (stats.lateTasks > 0)
                          _pieSection(
                            value: stats.lateTasks,
                            total: stats.totalTasks,
                            color: ColorPicker.statusLate,
                            label: 'Late',
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _StatusPill(
                      label: 'Completed',
                      value: stats.completedTasks,
                      color: ColorPicker.statusCompleted,
                    ),
                    _StatusPill(
                      label: 'In progress',
                      value: stats.inProgressTasks,
                      color: ColorPicker.statusInProgress,
                    ),
                    _StatusPill(
                      label: 'Late',
                      value: stats.lateTasks,
                      color: ColorPicker.statusLate,
                    ),
                    _StatusPill(
                      label: 'Teams',
                      value: stats.teamCount,
                      color: ColorPicker.buttonSecondary,
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}

class _MemberWorkloadChart extends StatelessWidget {
  final List<_MemberLoad> memberLoads;

  const _MemberWorkloadChart({required this.memberLoads});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Workload by member',
      icon: Icons.bar_chart_outlined,
      child: memberLoads.isEmpty
          ? const _EmptyState(message: 'No member workload in this filter.')
          : SizedBox(
              height: 250,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: max(
                    4,
                    memberLoads.map((load) => load.total).reduce(max),
                  ).toDouble(),
                  minY: 0,
                  barTouchData: BarTouchData(
                    enabled: true,
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipColor: (_) => ColorPicker.primaryDark,
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        final load = memberLoads[group.x.toInt()];
                        return BarTooltipItem(
                          '${load.name}\n${load.total} tasks',
                          const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        );
                      },
                    ),
                  ),
                  borderData: FlBorderData(show: false),
                  gridData: FlGridData(
                    drawVerticalLine: false,
                    getDrawingHorizontalLine: (value) => FlLine(
                      color: ColorPicker.cardBorder.withValues(alpha: 0.9),
                      strokeWidth: 1,
                    ),
                  ),
                  titlesData: FlTitlesData(
                    topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 30,
                        interval: 1,
                        getTitlesWidget: (value, meta) {
                          if (value % 1 != 0) return const SizedBox.shrink();
                          return Text(
                            value.toInt().toString(),
                            style: const TextStyle(
                              color: ColorPicker.fontLight,
                              fontSize: 11,
                            ),
                          );
                        },
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 54,
                        getTitlesWidget: (value, meta) {
                          final index = value.toInt();
                          if (index < 0 || index >= memberLoads.length) {
                            return const SizedBox.shrink();
                          }
                          return Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: SizedBox(
                              width: 64,
                              child: Text(
                                memberLoads[index].name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: ColorPicker.fontMedium,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  barGroups: [
                    for (var i = 0; i < memberLoads.length; i++)
                      _memberBarGroup(i, memberLoads[i]),
                  ],
                ),
              ),
            ),
    );
  }
}

class _DueDateChart extends StatelessWidget {
  final List<_DueBucket> buckets;

  const _DueDateChart({required this.buckets});

  @override
  Widget build(BuildContext context) {
    final maxValue = buckets.isEmpty
        ? 4
        : max(4, buckets.map((bucket) => bucket.total).reduce(max));

    return _Panel(
      title: 'Upcoming deadline',
      icon: Icons.event_available_outlined,
      child: SizedBox(
        height: 230,
        child: BarChart(
          BarChartData(
            alignment: BarChartAlignment.spaceAround,
            maxY: maxValue.toDouble(),
            minY: 0,
            barTouchData: BarTouchData(
              enabled: true,
              touchTooltipData: BarTouchTooltipData(
                getTooltipColor: (_) => ColorPicker.primaryDark,
                getTooltipItem: (group, groupIndex, rod, rodIndex) {
                  final bucket = buckets[group.x.toInt()];
                  return BarTooltipItem(
                    '${DateFormat('dd/MM').format(bucket.date)}\n${bucket.total} tasks',
                    const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  );
                },
              ),
            ),
            borderData: FlBorderData(show: false),
            gridData: FlGridData(
              drawVerticalLine: false,
              getDrawingHorizontalLine: (value) => FlLine(
                color: ColorPicker.cardBorder.withValues(alpha: 0.9),
                strokeWidth: 1,
              ),
            ),
            titlesData: FlTitlesData(
              topTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              rightTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 30,
                  interval: 1,
                  getTitlesWidget: (value, meta) {
                    if (value % 1 != 0) return const SizedBox.shrink();
                    return Text(
                      value.toInt().toString(),
                      style: const TextStyle(
                        color: ColorPicker.fontLight,
                        fontSize: 11,
                      ),
                    );
                  },
                ),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 38,
                  getTitlesWidget: (value, meta) {
                    final index = value.toInt();
                    if (index < 0 || index >= buckets.length) {
                      return const SizedBox.shrink();
                    }
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        DateFormat('E').format(buckets[index].date),
                        style: const TextStyle(
                          color: ColorPicker.fontMedium,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            barGroups: [
              for (var i = 0; i < buckets.length; i++)
                _dueBarGroup(i, buckets[i]),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProjectProgressPanel extends StatelessWidget {
  final List<Project> projects;
  final List<Task> tasks;

  const _ProjectProgressPanel({
    required this.projects,
    required this.tasks,
  });

  @override
  Widget build(BuildContext context) {
    final rows = _projectRows().take(5).toList();
    return _Panel(
      title: 'Project progress',
      icon: Icons.folder_open_outlined,
      child: rows.isEmpty
          ? const _EmptyState(message: 'No projects match this filter.')
          : Column(
              children: [
                for (var i = 0; i < rows.length; i++) ...[
                  _ProjectProgressRow(row: rows[i]),
                  if (i != rows.length - 1) const SizedBox(height: 10),
                ],
              ],
            ),
    );
  }

  List<_ProjectProgress> _projectRows() {
    final tasksByProject = <String, List<Task>>{};
    for (final task in tasks) {
      tasksByProject.putIfAbsent(task.project, () => <Task>[]).add(task);
    }

    final rows = projects.map((project) {
      final projectTasks =
          tasksByProject[project.id.toString()] ?? const <Task>[];
      final completed = projectTasks
          .where((task) => _taskHealthStatus(task) == 'completed')
          .length;
      final late = projectTasks
          .where((task) => _taskHealthStatus(task) == 'late')
          .length;
      return _ProjectProgress(
        project: project,
        totalTasks: projectTasks.length,
        completedTasks: completed,
        lateTasks: late,
      );
    }).toList();

    return rows
      ..sort((a, b) {
        final lateCompare = b.lateTasks.compareTo(a.lateTasks);
        if (lateCompare != 0) return lateCompare;
        return b.totalTasks.compareTo(a.totalTasks);
      });
  }
}

class _FocusTasksPanel extends StatelessWidget {
  final List<Task> tasks;

  const _FocusTasksPanel({required this.tasks});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Tasks to watch',
      icon: Icons.priority_high_outlined,
      child: tasks.isEmpty
          ? const _EmptyState(message: 'No tasks match this filter.')
          : Column(
              children: [
                for (var i = 0; i < tasks.length; i++) ...[
                  _TaskRow(task: tasks[i]),
                  if (i != tasks.length - 1) const SizedBox(height: 10),
                ],
              ],
            ),
    );
  }
}

class _ProjectProgressRow extends StatelessWidget {
  final _ProjectProgress row;

  const _ProjectProgressRow({required this.row});

  @override
  Widget build(BuildContext context) {
    final status = StatusHelper.normalizeStatus(row.project.status.toString());
    final color = row.lateTasks > 0
        ? ColorPicker.statusLate
        : StatusHelper.getStatusColor(status);
    final percent = row.totalTasks == 0
        ? 0
        : ((row.completedTasks / row.totalTasks) * 100).round();

    return Container(
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
              Icon(Icons.cases_outlined, color: color, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  row.project.title.toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _SmallStatusBadge(status: row.lateTasks > 0 ? 'late' : status),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 8,
              value:
                  row.totalTasks == 0 ? 0 : row.completedTasks / row.totalTasks,
              backgroundColor: ColorPicker.cardBorder,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$percent% completed - ${row.completedTasks}/${row.totalTasks} tasks - ${_dueLabel(row.project.endDate)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: ColorPicker.fontMedium,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskRow extends StatelessWidget {
  final Task task;

  const _TaskRow({required this.task});

  @override
  Widget build(BuildContext context) {
    final status = _taskHealthStatus(task);
    final color = StatusHelper.getStatusColor(status);
    final assignees = task.emp.isEmpty
        ? 'Unassigned'
        : task.emp.map(_employeeName).join(', ');
    final projectName = _projectName(task.project);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(StatusHelper.getStatusIcon(status), color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$projectName - ${_dueLabel(task.endDate)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontMedium,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  assignees,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontLight,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _PriorityBadge(priority: task.priority),
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
    return _PanelShell(
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
                    fontWeight: FontWeight.w900,
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

class _PanelShell extends StatelessWidget {
  final Widget child;

  const _PanelShell({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(),
      child: child,
    );
  }
}

class _MetricCard extends StatelessWidget {
  final _MetricData metric;

  const _MetricCard({required this.metric});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 112),
      padding: const EdgeInsets.all(14),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: metric.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(metric.icon, color: metric.color, size: 19),
              ),
              const Spacer(),
              Icon(Icons.trending_up, color: metric.color, size: 16),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            metric.value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: ColorPicker.fontDark,
              fontSize: 25,
              fontWeight: FontWeight.w900,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            metric.label,
            style: const TextStyle(
              color: ColorPicker.fontMedium,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChipRow extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _FilterChipRow({
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: ColorPicker.fontMedium,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: children,
        ),
      ],
    );
  }
}

class _DashboardFilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback onSelected;

  const _DashboardFilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = color ?? ColorPicker.accent;
    return FilterChip(
      selected: selected,
      onSelected: (_) => onSelected(),
      label: Text(label),
      checkmarkColor: Colors.white,
      selectedColor: activeColor,
      backgroundColor: ColorPicker.backgroundLight,
      side: BorderSide(
        color: selected ? activeColor : ColorPicker.cardBorder,
      ),
      labelStyle: TextStyle(
        color: selected ? Colors.white : ColorPicker.fontMedium,
        fontWeight: FontWeight.w800,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _StatusPill({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.24)),
      ),
      child: Text(
        '$label $value',
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
          Icon(icon, size: 14, color: ColorPicker.fontMedium),
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

class _SmallStatusBadge extends StatelessWidget {
  final String status;

  const _SmallStatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = StatusHelper.getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        StatusHelper.getStatusLabel(status),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _PriorityBadge extends StatelessWidget {
  final int priority;

  const _PriorityBadge({required this.priority});

  @override
  Widget build(BuildContext context) {
    final color = priority >= 4
        ? ColorPicker.statusLate
        : priority >= 3
            ? ColorPicker.second
            : ColorPicker.buttonSecondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        'P$priority',
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String message;

  const _EmptyState({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: ColorPicker.fontMedium),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: ColorPicker.fontMedium),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardStats {
  final int totalTasks;
  final int totalProjects;
  final int memberCount;
  final int teamCount;
  final int completedTasks;
  final int inProgressTasks;
  final int lateTasks;

  const _DashboardStats({
    required this.totalTasks,
    required this.totalProjects,
    required this.memberCount,
    required this.teamCount,
    required this.completedTasks,
    required this.inProgressTasks,
    required this.lateTasks,
  });

  int get completionRate {
    if (totalTasks == 0) return 0;
    return ((completedTasks / totalTasks) * 100).round();
  }

  factory _DashboardStats.fromData({
    required List<Task> tasks,
    required List<Project> projects,
    required int memberCount,
    required int teamCount,
  }) {
    var completed = 0;
    var late = 0;
    var inProgress = 0;

    for (final task in tasks) {
      final status = _taskHealthStatus(task);
      if (status == 'completed') {
        completed += 1;
      } else if (status == 'late') {
        late += 1;
      } else {
        inProgress += 1;
      }
    }

    return _DashboardStats(
      totalTasks: tasks.length,
      totalProjects: projects.length,
      memberCount: memberCount,
      teamCount: teamCount,
      completedTasks: completed,
      inProgressTasks: inProgress,
      lateTasks: late,
    );
  }
}

class _MetricData {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _MetricData({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
}

class _MemberLoad {
  final String name;
  int total = 0;
  int completed = 0;
  int inProgress = 0;
  int late = 0;

  _MemberLoad({required this.name});
}

class _DueBucket {
  final DateTime date;
  int completed = 0;
  int inProgress = 0;
  int late = 0;

  _DueBucket({required this.date});

  int get total => completed + inProgress + late;
}

class _ProjectProgress {
  final Project project;
  final int totalTasks;
  final int completedTasks;
  final int lateTasks;

  const _ProjectProgress({
    required this.project,
    required this.totalTasks,
    required this.completedTasks,
    required this.lateTasks,
  });
}

PieChartSectionData _pieSection({
  required int value,
  required int total,
  required Color color,
  required String label,
}) {
  final percent = total == 0 ? 0 : ((value / total) * 100).round();
  return PieChartSectionData(
    value: value.toDouble(),
    color: color,
    radius: 68,
    title: '$label\n$percent%',
    titleStyle: const TextStyle(
      color: Colors.white,
      fontSize: 12,
      fontWeight: FontWeight.w900,
      height: 1.2,
    ),
  );
}

BarChartGroupData _memberBarGroup(int index, _MemberLoad load) {
  var start = 0.0;
  final stacks = <BarChartRodStackItem>[];

  void addStack(int value, Color color) {
    if (value <= 0) return;
    stacks.add(BarChartRodStackItem(start, start + value, color));
    start += value;
  }

  addStack(load.completed, ColorPicker.statusCompleted);
  addStack(load.inProgress, ColorPicker.statusInProgress);
  addStack(load.late, ColorPicker.statusLate);

  return BarChartGroupData(
    x: index,
    barRods: [
      BarChartRodData(
        toY: load.total.toDouble(),
        width: 22,
        borderRadius: BorderRadius.circular(6),
        rodStackItems: stacks,
        color: ColorPicker.cardBorder,
      ),
    ],
  );
}

BarChartGroupData _dueBarGroup(int index, _DueBucket bucket) {
  var start = 0.0;
  final stacks = <BarChartRodStackItem>[];

  void addStack(int value, Color color) {
    if (value <= 0) return;
    stacks.add(BarChartRodStackItem(start, start + value, color));
    start += value;
  }

  addStack(bucket.completed, ColorPicker.statusCompleted);
  addStack(bucket.inProgress, ColorPicker.statusInProgress);
  addStack(bucket.late, ColorPicker.statusLate);

  return BarChartGroupData(
    x: index,
    barRods: [
      BarChartRodData(
        toY: bucket.total.toDouble(),
        width: 18,
        borderRadius: BorderRadius.circular(6),
        rodStackItems: stacks,
        color: ColorPicker.cardBorder,
      ),
    ],
  );
}

InputDecoration _filterDecoration({
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

BoxDecoration _panelDecoration() {
  return BoxDecoration(
    color: ColorPicker.cardBackground,
    borderRadius: BorderRadius.circular(8),
    border: Border.all(color: ColorPicker.cardBorder),
    boxShadow: [
      BoxShadow(
        color: const Color(0xff0f172a).withValues(alpha: 0.04),
        blurRadius: 14,
        offset: const Offset(0, 8),
      ),
    ],
  );
}

DateTime _startOfDay(DateTime date) {
  return DateTime(date.year, date.month, date.day);
}

bool _isOverdue(Task task) {
  return StatusHelper.normalizeStatus(task.status) != 'completed' &&
      _startOfDay(task.endDate).isBefore(_startOfDay(DateTime.now()));
}

String _taskHealthStatus(Task task) {
  final status = StatusHelper.normalizeStatus(task.status);
  if (status != 'completed' && _isOverdue(task)) return 'late';
  return status;
}

String _dueLabel(DateTime date) {
  final today = _startOfDay(DateTime.now());
  final target = _startOfDay(date);
  final days = target.difference(today).inDays;

  if (days < 0) return '${days.abs()}d late';
  if (days == 0) return 'Due today';
  if (days == 1) return 'Due tomorrow';
  if (days <= 7) return 'Due in ${days}d';
  return DateFormat('dd/MM/yyyy').format(date);
}

String _employeeName(String value) {
  final direct = DBHelper.empMap[value];
  if (direct is Employee) return direct.name;

  for (final employee in DBHelper.employees) {
    if (employee.id == value || employee.name == value) return employee.name;
  }

  return value.trim().isEmpty ? 'Unassigned' : value;
}

String _projectName(String projectId) {
  for (final project in DBHelper.projects) {
    if (project.id.toString() == projectId) return project.title.toString();
  }
  return 'Unknown project';
}

String _roleLabel(String role) {
  switch (role.trim().toLowerCase()) {
    case 'admin':
      return 'Admin';
    case 'pm':
    case 'manager':
    case 'project_manager':
      return 'Project Manager';
    case 'employee':
    case 'member':
      return 'Member';
    default:
      return role.trim().isEmpty ? 'User' : role;
  }
}
