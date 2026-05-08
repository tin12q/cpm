import 'dart:math';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../model/color_picker.dart';
import '../model/db_helper.dart';
import '../model/project.dart';
import '../model/task.dart';
import '../utils/status_helper.dart';

class Dashboard extends StatefulWidget {
  const Dashboard({super.key});

  @override
  State<Dashboard> createState() => _DashboardState();
}

class _DashboardState extends State<Dashboard> {
  @override
  Widget build(BuildContext context) {
    final stats = _DashboardStats.fromData(
      tasks: DBHelper.tasks,
      projects: DBHelper.projects,
      memberCount: DBHelper.employees.length,
      teamCount: DBHelper.deps.length,
    );
    final teamLoads = _teamLoads().take(5).toList();
    final upcomingTasks = _upcomingTasks().take(5).toList();
    final activeProjects = _activeProjects().take(4).toList();

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
              const SizedBox(height: 14),
              _MetricGrid(stats: stats),
              const SizedBox(height: 14),
              _TaskHealthPanel(stats: stats),
              const SizedBox(height: 14),
              _TeamWorkloadPanel(teamLoads: teamLoads),
              const SizedBox(height: 14),
              _UpcomingTasksPanel(tasks: upcomingTasks),
              const SizedBox(height: 14),
              _ActiveProjectsPanel(projects: activeProjects),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _refreshDashboard() async {
    await Future.wait([
      DBHelper.loadTasksPage(page: 1, limit: 25),
      DBHelper.loadProjectsPage(page: 1, limit: 25),
      DBHelper.getDep(),
      DBHelper.getEmp(),
    ]);
    DBHelper.initMap();
    DBHelper.updateTaskEMP();
    if (mounted) setState(() {});
  }

  List<_TeamLoad> _teamLoads() {
    final projectById = {
      for (final project in DBHelper.projects) project.id.toString(): project,
    };
    final loads = <String, _TeamLoad>{};

    for (final dep in DBHelper.deps) {
      loads[dep.id] = _TeamLoad(id: dep.id, name: dep.name);
    }

    for (final task in DBHelper.tasks) {
      final project = projectById[task.project];
      final teamIds = project?.teams.cast<String>() ?? const <String>[];
      final status = StatusHelper.normalizeStatus(task.status);
      for (final teamId in teamIds) {
        final load = loads[teamId] ?? _TeamLoad(id: teamId, name: 'Team');
        load.total += 1;
        if (status == 'completed') {
          load.completed += 1;
        } else if (status == 'late' || _isOverdue(task)) {
          load.late += 1;
        } else {
          load.inProgress += 1;
        }
        loads[teamId] = load;
      }
    }

    return loads.values.where((load) => load.total > 0).toList()
      ..sort((a, b) => b.total.compareTo(a.total));
  }

  List<Task> _upcomingTasks() {
    final now = DateTime.now();
    return DBHelper.tasks
        .where(
            (task) => StatusHelper.normalizeStatus(task.status) != 'completed')
        .toList()
      ..sort((a, b) {
        final aLate = _isOverdue(a) ? 0 : 1;
        final bLate = _isOverdue(b) ? 0 : 1;
        final lateCompare = aLate.compareTo(bLate);
        if (lateCompare != 0) return lateCompare;
        return a.endDate.difference(now).compareTo(b.endDate.difference(now));
      });
  }

  List<Project> _activeProjects() {
    return DBHelper.projects
        .where((project) =>
            StatusHelper.normalizeStatus(project.status.toString()) !=
            'completed')
        .toList()
      ..sort((a, b) => a.endDate.compareTo(b.endDate));
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
    final displayName = userName.trim().isEmpty ? 'there' : userName.trim();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(),
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
              Icons.space_dashboard_outlined,
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
                  '$displayName · ${_roleLabel(role)}',
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
              .map((metric) => SizedBox(
                    width: itemWidth,
                    child: _MetricCard(metric: metric),
                  ))
              .toList(),
        );
      },
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

class _TaskHealthPanel extends StatelessWidget {
  final _DashboardStats stats;

  const _TaskHealthPanel({required this.stats});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Task health',
      icon: Icons.monitor_heart_outlined,
      trailing: _InfoChip(
        icon: Icons.groups_2_outlined,
        label: '${stats.memberCount} members',
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ProgressBar(
            completed: stats.completedTasks,
            inProgress: stats.inProgressTasks,
            late: stats.lateTasks,
          ),
          const SizedBox(height: 14),
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

class _TeamWorkloadPanel extends StatelessWidget {
  final List<_TeamLoad> teamLoads;

  const _TeamWorkloadPanel({required this.teamLoads});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Team workload',
      icon: Icons.bar_chart_outlined,
      child: teamLoads.isEmpty
          ? const _EmptyState(message: 'No team workload yet.')
          : SizedBox(
              height: 230,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: max(4, teamLoads.map((load) => load.total).reduce(max))
                      .toDouble(),
                  minY: 0,
                  barTouchData: const BarTouchData(enabled: true),
                  borderData: FlBorderData(show: false),
                  gridData: FlGridData(
                    drawVerticalLine: false,
                    getDrawingHorizontalLine: (value) => FlLine(
                      color: ColorPicker.cardBorder.withValues(alpha: 0.8),
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
                        reservedSize: 46,
                        getTitlesWidget: (value, meta) {
                          final index = value.toInt();
                          if (index < 0 || index >= teamLoads.length) {
                            return const SizedBox.shrink();
                          }
                          return Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: SizedBox(
                              width: 58,
                              child: Text(
                                teamLoads[index].name,
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
                    for (var i = 0; i < teamLoads.length; i++)
                      _barGroup(i, teamLoads[i]),
                  ],
                ),
              ),
            ),
    );
  }

  BarChartGroupData _barGroup(int index, _TeamLoad load) {
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
}

class _UpcomingTasksPanel extends StatelessWidget {
  final List<Task> tasks;

  const _UpcomingTasksPanel({required this.tasks});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Upcoming tasks',
      icon: Icons.event_available_outlined,
      child: tasks.isEmpty
          ? const _EmptyState(message: 'No active tasks found.')
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

class _ActiveProjectsPanel extends StatelessWidget {
  final List<Project> projects;

  const _ActiveProjectsPanel({required this.projects});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Active projects',
      icon: Icons.folder_open_outlined,
      child: projects.isEmpty
          ? const _EmptyState(message: 'No active projects found.')
          : Column(
              children: [
                for (var i = 0; i < projects.length; i++) ...[
                  _ProjectRow(project: projects[i]),
                  if (i != projects.length - 1) const SizedBox(height: 10),
                ],
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
    final overdue = _isOverdue(task);
    final status = overdue ? 'late' : task.status;
    final color = StatusHelper.getStatusColor(status);
    final assignees = task.emp.isEmpty ? 'Unassigned' : task.emp.join(', ');
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
                  '${_dueLabel(task.endDate)} · $assignees',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontMedium,
                    fontSize: 12,
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

class _ProjectRow extends StatelessWidget {
  final Project project;

  const _ProjectRow({required this.project});

  @override
  Widget build(BuildContext context) {
    final status = StatusHelper.normalizeStatus(project.status.toString());
    final color = StatusHelper.getStatusColor(status);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        children: [
          Icon(Icons.cases_outlined, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  project.title.toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _dueLabel(project.endDate),
                  style: const TextStyle(
                    color: ColorPicker.fontMedium,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _SmallStatusBadge(status: status),
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

class _ProgressBar extends StatelessWidget {
  final int completed;
  final int inProgress;
  final int late;

  const _ProgressBar({
    required this.completed,
    required this.inProgress,
    required this.late,
  });

  @override
  Widget build(BuildContext context) {
    final total = completed + inProgress + late;
    if (total == 0) {
      return Container(
        height: 12,
        decoration: BoxDecoration(
          color: ColorPicker.cardBorder,
          borderRadius: BorderRadius.circular(999),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: Row(
        children: [
          if (completed > 0)
            Expanded(
              flex: completed,
              child: Container(height: 12, color: ColorPicker.statusCompleted),
            ),
          if (inProgress > 0)
            Expanded(
              flex: inProgress,
              child: Container(height: 12, color: ColorPicker.statusInProgress),
            ),
          if (late > 0)
            Expanded(
              flex: late,
              child: Container(height: 12, color: ColorPicker.statusLate),
            ),
        ],
      ),
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
      final status = StatusHelper.normalizeStatus(task.status);
      if (status == 'completed') {
        completed += 1;
      } else if (status == 'late' || _isOverdue(task)) {
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

class _TeamLoad {
  final String id;
  final String name;
  int total = 0;
  int completed = 0;
  int inProgress = 0;
  int late = 0;

  _TeamLoad({
    required this.id,
    required this.name,
  });
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

bool _isOverdue(Task task) {
  return StatusHelper.normalizeStatus(task.status) != 'completed' &&
      task.endDate.isBefore(DateTime.now());
}

String _dueLabel(DateTime date) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final target = DateTime(date.year, date.month, date.day);
  final days = target.difference(today).inDays;

  if (days < 0) return '${days.abs()}d late';
  if (days == 0) return 'Due today';
  if (days == 1) return 'Due tomorrow';
  if (days <= 7) return 'Due in ${days}d';
  return DateFormat('dd/MM/yyyy').format(date);
}

String _roleLabel(String role) {
  switch (role.trim().toLowerCase()) {
    case 'admin':
      return 'Admin';
    case 'pm':
    case 'project_manager':
      return 'Project Manager';
    case 'employee':
    case 'member':
      return 'Member';
    default:
      return role.trim().isEmpty ? 'User' : role;
  }
}
