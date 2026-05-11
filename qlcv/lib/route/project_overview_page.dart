import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../model/color_picker.dart';
import '../model/db_helper.dart';
import '../model/emp.dart';
import '../model/project.dart';
import '../model/task.dart';
import '../utils/status_helper.dart';

class ProjectOverviewPage extends StatefulWidget {
  final Project project;

  const ProjectOverviewPage({
    Key? key,
    required this.project,
  }) : super(key: key);

  @override
  State<ProjectOverviewPage> createState() => _ProjectOverviewPageState();
}

class _ProjectOverviewPageState extends State<ProjectOverviewPage> {
  bool _loading = true;
  List<Task> _tasks = [];
  List<Employee> _members = [];

  bool get _canView {
    final role = DBHelper.mainUser.role.toLowerCase();
    return role == 'admin' || role == 'manager';
  }

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  Future<void> _loadOverview() async {
    if (!_canView) {
      setState(() => _loading = false);
      return;
    }

    setState(() => _loading = true);
    DBHelper.currentProjectId = widget.project.id;
    await DBHelper.taskUpdateWithProjectId(widget.project.id, limit: 300);
    await DBHelper.getEmpByProjectId(widget.project.id);
    if (!mounted) return;
    setState(() {
      _tasks = List<Task>.from(DBHelper.projectTasks);
      _members = List<Employee>.from(DBHelper.empProject);
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_canView) {
      return Scaffold(
        appBar: AppBar(title: const Text('Project overview')),
        body: const Center(
          child: Text('Only admin and manager can view this overview.'),
        ),
      );
    }

    final stats = _ProjectOverviewStats.from(widget.project, _tasks, _members);
    return Scaffold(
      backgroundColor: ColorPicker.backgroundLight,
      appBar: AppBar(
        title: const Text('Project overview'),
        backgroundColor: ColorPicker.cardBackground,
        foregroundColor: ColorPicker.fontDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _loadOverview,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _loadOverview,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  children: [
                    _ProjectHeader(project: widget.project, stats: stats),
                    const SizedBox(height: 14),
                    _MetricGrid(stats: stats),
                    const SizedBox(height: 14),
                    _ChartPanel(
                      title: 'Task status',
                      icon: Icons.donut_large_outlined,
                      child: _StatusPieChart(stats: stats),
                    ),
                    const SizedBox(height: 14),
                    _ChartPanel(
                      title: 'Workload by member',
                      icon: Icons.groups_2_outlined,
                      child: _WorkloadBarChart(stats: stats),
                    ),
                    const SizedBox(height: 14),
                    _ChartPanel(
                      title: 'Deadline pressure',
                      icon: Icons.event_note_outlined,
                      child: _DeadlinePanel(stats: stats),
                    ),
                    const SizedBox(height: 14),
                    _FocusList(stats: stats),
                  ],
                ),
              ),
      ),
    );
  }
}

class _ProjectHeader extends StatelessWidget {
  final Project project;
  final _ProjectOverviewStats stats;

  const _ProjectHeader({
    required this.project,
    required this.stats,
  });

  @override
  Widget build(BuildContext context) {
    final status = StatusHelper.normalizeStatus(project.status);
    final statusColor = StatusHelper.getStatusColor(status);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  project.title,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _StatusBadge(status: status, color: statusColor),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            project.description,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: ColorPicker.fontMedium,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoChip(
                icon: Icons.calendar_today_outlined,
                label: DateFormat('d/M/yyyy').format(project.endDate),
              ),
              _InfoChip(
                icon: Icons.task_alt_outlined,
                label: '${stats.totalTasks} tasks',
              ),
              _InfoChip(
                icon: Icons.percent,
                label: '${stats.completionRate}% completed',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  final _ProjectOverviewStats stats;

  const _MetricGrid({required this.stats});

  @override
  Widget build(BuildContext context) {
    final metrics = [
      _MetricItem(
        label: 'Completed',
        value: stats.completed.toString(),
        icon: Icons.check_circle_outline,
        color: ColorPicker.statusCompleted,
      ),
      _MetricItem(
        label: 'In progress',
        value: stats.inProgress.toString(),
        icon: Icons.pending_actions_outlined,
        color: ColorPicker.statusInProgress,
      ),
      _MetricItem(
        label: 'Late tasks',
        value: stats.late.toString(),
        icon: Icons.warning_amber_outlined,
        color: ColorPicker.statusLate,
      ),
      _MetricItem(
        label: 'Unassigned',
        value: stats.unassigned.toString(),
        icon: Icons.person_off_outlined,
        color: ColorPicker.buttonSecondary,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final itemWidth = (constraints.maxWidth - 10) / 2;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final metric in metrics)
              SizedBox(
                width: itemWidth,
                child: _MetricTile(metric: metric),
              ),
          ],
        );
      },
    );
  }
}

class _MetricTile extends StatelessWidget {
  final _MetricItem metric;

  const _MetricTile({required this.metric});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 114),
      padding: const EdgeInsets.all(12),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(metric.icon, color: metric.color, size: 22),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              metric.value,
              maxLines: 1,
              style: const TextStyle(
                color: ColorPicker.fontDark,
                fontSize: 24,
                height: 1.05,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            metric.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: ColorPicker.fontMedium,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ChartPanel extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;

  const _ChartPanel({
    required this.title,
    required this.icon,
    required this.child,
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
              Text(
                title,
                style: const TextStyle(
                  color: ColorPicker.fontDark,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _StatusPieChart extends StatelessWidget {
  final _ProjectOverviewStats stats;

  const _StatusPieChart({required this.stats});

  @override
  Widget build(BuildContext context) {
    if (stats.totalTasks == 0) {
      return const _EmptyPanel(message: 'No tasks in this project yet.');
    }

    final sections = [
      _pieSection(
        value: stats.completed,
        color: ColorPicker.statusCompleted,
        title: '${stats.completed}',
      ),
      _pieSection(
        value: stats.inProgress,
        color: ColorPicker.statusInProgress,
        title: '${stats.inProgress}',
      ),
      _pieSection(
        value: stats.late,
        color: ColorPicker.statusLate,
        title: '${stats.late}',
      ),
    ].where((section) => section.value > 0).toList();

    return Column(
      children: [
        SizedBox(
          height: 210,
          child: PieChart(
            PieChartData(
              sectionsSpace: 3,
              centerSpaceRadius: 44,
              sections: sections,
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Wrap(
          spacing: 12,
          runSpacing: 8,
          children: [
            _LegendDot(label: 'Completed', color: ColorPicker.statusCompleted),
            _LegendDot(
                label: 'In progress', color: ColorPicker.statusInProgress),
            _LegendDot(label: 'Late', color: ColorPicker.statusLate),
          ],
        ),
      ],
    );
  }

  PieChartSectionData _pieSection({
    required int value,
    required Color color,
    required String title,
  }) {
    return PieChartSectionData(
      value: value.toDouble(),
      color: color,
      title: title,
      radius: 68,
      titleStyle: const TextStyle(
        color: Colors.white,
        fontSize: 14,
        fontWeight: FontWeight.w800,
      ),
    );
  }
}

class _WorkloadBarChart extends StatelessWidget {
  final _ProjectOverviewStats stats;

  const _WorkloadBarChart({required this.stats});

  @override
  Widget build(BuildContext context) {
    final rows = stats.workloadRows.take(6).toList();
    if (rows.isEmpty) {
      return const _EmptyPanel(message: 'No assigned members to chart yet.');
    }

    final maxY = rows
        .map((row) => row.total)
        .fold<int>(1, (max, value) => value > max ? value : max)
        .toDouble();
    return SizedBox(
      height: 240,
      child: BarChart(
        BarChartData(
          maxY: maxY + 1,
          minY: 0,
          gridData: const FlGridData(show: true, drawVerticalLine: false),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 28,
                getTitlesWidget: (value, meta) => Text(
                  value.toInt().toString(),
                  style: const TextStyle(
                    color: ColorPicker.fontLight,
                    fontSize: 11,
                  ),
                ),
              ),
            ),
            rightTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 42,
                getTitlesWidget: (value, meta) {
                  final index = value.toInt();
                  if (index < 0 || index >= rows.length) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _shortName(rows[index].name),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: ColorPicker.fontMedium,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          barGroups: [
            for (var i = 0; i < rows.length; i++)
              BarChartGroupData(
                x: i,
                barRods: [
                  BarChartRodData(
                    toY: rows[i].total.toDouble(),
                    width: 18,
                    borderRadius: BorderRadius.circular(5),
                    color: rows[i].late > 0
                        ? ColorPicker.statusLate
                        : ColorPicker.accent,
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  String _shortName(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length <= 1) return name.length > 8 ? name.substring(0, 8) : name;
    return '${parts.first[0]}${parts.last.length > 7 ? parts.last.substring(0, 7) : parts.last}';
  }
}

class _DeadlinePanel extends StatelessWidget {
  final _ProjectOverviewStats stats;

  const _DeadlinePanel({required this.stats});

  @override
  Widget build(BuildContext context) {
    final rows = [
      _DeadlineRow(
        label: 'Due today',
        value: stats.dueToday,
        color: ColorPicker.second,
      ),
      _DeadlineRow(
        label: 'Due this week',
        value: stats.dueThisWeek,
        color: ColorPicker.accent,
      ),
      _DeadlineRow(
        label: 'Past due',
        value: stats.late,
        color: ColorPicker.statusLate,
      ),
    ];

    return Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          rows[i],
          if (i != rows.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _DeadlineRow extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _DeadlineRow({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
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
            width: 10,
            height: 36,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: ColorPicker.fontDark,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Text(
            value.toString(),
            style: const TextStyle(
              color: ColorPicker.fontDark,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _FocusList extends StatelessWidget {
  final _ProjectOverviewStats stats;

  const _FocusList({required this.stats});

  @override
  Widget build(BuildContext context) {
    final tasks = stats.focusTasks.take(5).toList();
    return _ChartPanel(
      title: 'Tasks to watch',
      icon: Icons.priority_high_outlined,
      child: tasks.isEmpty
          ? const _EmptyPanel(message: 'No focus tasks right now.')
          : Column(
              children: [
                for (var i = 0; i < tasks.length; i++) ...[
                  _FocusTaskRow(task: tasks[i]),
                  if (i != tasks.length - 1) const SizedBox(height: 10),
                ],
              ],
            ),
    );
  }
}

class _FocusTaskRow extends StatelessWidget {
  final Task task;

  const _FocusTaskRow({required this.task});

  @override
  Widget build(BuildContext context) {
    final status = StatusHelper.normalizeStatus(task.status);
    final color = StatusHelper.getStatusColor(status);
    final assigneeLabel = task.emp.isEmpty
        ? 'Unassigned'
        : task.emp
            .map((id) => DBHelper.empMap[id]?.name ?? _memberName(id))
            .join(', ');
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(StatusHelper.getStatusIcon(status), color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${DateFormat('d/M/yyyy').format(task.endDate)} - $assigneeLabel',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontMedium,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _memberName(String id) {
    final matches = DBHelper.empProject.where((emp) => emp.id == id);
    return matches.isEmpty ? id : matches.first.name;
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  final Color color;

  const _StatusBadge({
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
      child: Text(
        StatusHelper.getStatusLabel(status),
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
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final String label;
  final Color color;

  const _LegendDot({
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            color: ColorPicker.fontMedium,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _EmptyPanel extends StatelessWidget {
  final String message;

  const _EmptyPanel({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ColorPicker.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Text(
        message,
        style: const TextStyle(color: ColorPicker.fontMedium),
      ),
    );
  }
}

class _ProjectOverviewStats {
  final Project project;
  final List<Task> tasks;
  final List<Employee> members;
  final int totalTasks;
  final int completed;
  final int inProgress;
  final int late;
  final int unassigned;
  final int dueToday;
  final int dueThisWeek;
  final List<_WorkloadRow> workloadRows;
  final List<Task> focusTasks;

  const _ProjectOverviewStats({
    required this.project,
    required this.tasks,
    required this.members,
    required this.totalTasks,
    required this.completed,
    required this.inProgress,
    required this.late,
    required this.unassigned,
    required this.dueToday,
    required this.dueThisWeek,
    required this.workloadRows,
    required this.focusTasks,
  });

  int get completionRate =>
      totalTasks == 0 ? 0 : ((completed / totalTasks) * 100).round();

  factory _ProjectOverviewStats.from(
    Project project,
    List<Task> tasks,
    List<Employee> members,
  ) {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final todayEnd = todayStart.add(const Duration(days: 1));
    final weekEnd = todayStart.add(const Duration(days: 7));

    var completed = 0;
    var inProgress = 0;
    var late = 0;
    var unassigned = 0;
    var dueToday = 0;
    var dueThisWeek = 0;

    final workload = <String, _WorkloadRow>{};
    for (final member in members) {
      workload[member.id] = _WorkloadRow(
        id: member.id,
        name: member.name.isEmpty ? member.email : member.name,
        total: 0,
        completed: 0,
        late: 0,
      );
    }

    for (final task in tasks) {
      final status = StatusHelper.normalizeStatus(task.status);
      if (status == 'completed') {
        completed += 1;
      } else if (status == 'late') {
        late += 1;
      } else {
        inProgress += 1;
      }

      if (task.emp.isEmpty) unassigned += 1;
      if (task.endDate.isAfter(todayStart) && task.endDate.isBefore(todayEnd)) {
        dueToday += 1;
      }
      if (task.endDate.isAfter(todayStart) && task.endDate.isBefore(weekEnd)) {
        dueThisWeek += 1;
      }

      for (final empId in task.emp) {
        final current = workload[empId] ??
            _WorkloadRow(
              id: empId,
              name: _resolveMemberName(empId, members),
              total: 0,
              completed: 0,
              late: 0,
            );
        workload[empId] = current.copyWith(
          total: current.total + 1,
          completed: current.completed + (status == 'completed' ? 1 : 0),
          late: current.late + (status == 'late' ? 1 : 0),
        );
      }
    }

    final focusTasks = List<Task>.from(tasks)
      ..sort((a, b) {
        final aStatus = StatusHelper.normalizeStatus(a.status);
        final bStatus = StatusHelper.normalizeStatus(b.status);
        final aWeight = aStatus == 'late' || a.emp.isEmpty ? 0 : 1;
        final bWeight = bStatus == 'late' || b.emp.isEmpty ? 0 : 1;
        final weightCompare = aWeight.compareTo(bWeight);
        if (weightCompare != 0) return weightCompare;
        return a.endDate.compareTo(b.endDate);
      });

    final workloadRows = workload.values.where((row) => row.total > 0).toList()
      ..sort((a, b) => b.total.compareTo(a.total));

    return _ProjectOverviewStats(
      project: project,
      tasks: tasks,
      members: members,
      totalTasks: tasks.length,
      completed: completed,
      inProgress: inProgress,
      late: late,
      unassigned: unassigned,
      dueToday: dueToday,
      dueThisWeek: dueThisWeek,
      workloadRows: workloadRows,
      focusTasks: focusTasks,
    );
  }

  static String _resolveMemberName(String empId, List<Employee> members) {
    final matches = members.where((member) => member.id == empId);
    if (matches.isEmpty) return empId;
    final member = matches.first;
    return member.name.isEmpty ? member.email : member.name;
  }
}

class _MetricItem {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _MetricItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
}

class _WorkloadRow {
  final String id;
  final String name;
  final int total;
  final int completed;
  final int late;

  const _WorkloadRow({
    required this.id,
    required this.name,
    required this.total,
    required this.completed,
    required this.late,
  });

  _WorkloadRow copyWith({
    int? total,
    int? completed,
    int? late,
  }) {
    return _WorkloadRow(
      id: id,
      name: name,
      total: total ?? this.total,
      completed: completed ?? this.completed,
      late: late ?? this.late,
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
