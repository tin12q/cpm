import 'package:flutter/material.dart';
import 'package:qlcv/model/db_helper.dart';
import 'package:qlcv/model/projects_page.dart';
import 'package:qlcv/route/project_tasks.dart';

import '../home_page.dart';
import '../utils/status_helper.dart';
import 'color_picker.dart';
import 'project.dart';

class ProjectCard extends StatelessWidget {
  final Project project;

  const ProjectCard({required this.project});

  Future<void> deleteproject(Project project) async {
    await DBHelper.deleteProject(project);
    DBHelper.projects.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12.0),
        side: BorderSide(color: ColorPicker.cardBorder, width: 1),
      ),
      color: ColorPicker.cardBackground,
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(12.0),
        onTap: () {
          showDialog(
            context: context,
            builder: (BuildContext context) {
              return projectPopupCard(project: project);
            },
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(16.0),
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
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  _StatusBadge(status: project.status),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                project.description.length > 90
                    ? '${project.description.substring(0, 90)}...'
                    : project.description,
                style: const TextStyle(
                  color: ColorPicker.fontMedium,
                  fontSize: 14,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Icon(
                          Icons.calendar_today,
                          size: 14,
                          color: ColorPicker.fontLight,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            project.endDateString,
                            style: const TextStyle(
                              color: ColorPicker.fontMedium,
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _CardActionButton(
                        icon: Icons.info_outline,
                        label: 'Info',
                        color: ColorPicker.buttonPrimary,
                        tooltip: 'Project info',
                        onPressed: () async {
                          if (project.teams.isNotEmpty) {
                            await DBHelper.getDepNameById(project.teams[0]);
                          }
                          DBHelper.currentProjectId = project.id;
                          if (context.mounted) {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    ProjectPage(project: project),
                              ),
                            );
                          }
                        },
                      ),
                      const SizedBox(width: 10),
                      _CardActionButton(
                        icon: Icons.task_alt,
                        label: 'Tasks',
                        color: ColorPicker.buttonSecondary,
                        tooltip: 'Project tasks',
                        onPressed: () async {
                          await DBHelper.taskUpdateWithProjectId(project.id);
                          await DBHelper.getEmpByProjectId(project.id);
                          if (context.mounted) {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => ProjectTasks(),
                              ),
                            );
                          }
                        },
                      ),
                      const SizedBox(width: 10),
                      _CardActionButton(
                        icon: Icons.delete_outline,
                        label: DBHelper.mainUser.role == 'admin' ||
                                DBHelper.mainUser.role == 'manager'
                            ? 'Delete'
                            : 'Locked',
                        color: DBHelper.mainUser.role == 'admin' ||
                                DBHelper.mainUser.role == 'manager'
                            ? ColorPicker.buttonDanger
                            : ColorPicker.fontLight,
                        tooltip: DBHelper.mainUser.role == 'admin' ||
                                DBHelper.mainUser.role == 'manager'
                            ? 'Delete project'
                            : 'No permission',
                        onPressed: () {
                          if (DBHelper.mainUser.role != 'admin' &&
                              DBHelper.mainUser.role != 'manager') {
                            showDialog(
                              context: context,
                              builder: (BuildContext context) {
                                return AlertDialog(
                                  title: const Text('Access Denied'),
                                  content: const Text(
                                      'Employees cannot delete projects. Please contact your manager or admin.'),
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

                          showDialog(
                            context: context,
                            builder: (BuildContext context) {
                              return AlertDialog(
                                title: const Text('Delete Project'),
                                content: const Text(
                                    'Are you sure you want to delete this project? All tasks in this project will also be deleted.'),
                                actions: <Widget>[
                                  TextButton(
                                    child: const Text('Cancel'),
                                    onPressed: () {
                                      Navigator.of(context).pop();
                                    },
                                  ),
                                  TextButton(
                                    style: TextButton.styleFrom(
                                      foregroundColor: ColorPicker.buttonDanger,
                                    ),
                                    child: const Text('Delete'),
                                    onPressed: () {
                                      deleteproject(project);
                                      Navigator.pushAndRemoveUntil(
                                        context,
                                        MaterialPageRoute(
                                            builder: (context) => HomePage()),
                                        (Route<dynamic> route) => false,
                                      );
                                    },
                                  ),
                                ],
                              );
                            },
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class projectBoxList extends StatelessWidget {
  final List<Project> projects;

  const projectBoxList({
    required this.projects,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      itemCount: projects.length,
      itemBuilder: (context, index) {
        if (index >= 0 && index < projects.length) {
          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(width: 10),
              Expanded(
                child: ProjectCard(project: projects[index]),
              ),
              const SizedBox(width: 10)
            ],
          );
        }
        return Row();
      },
      separatorBuilder: (BuildContext context, int index) {
        return const SizedBox(height: 15);
      },
    );
  }
}

class projectPopupCard extends StatelessWidget {
  final Project project;

  const projectPopupCard({required this.project});

  @override
  Widget build(BuildContext context) {
    final List<String> teamNames = [];
    for (final rawTeamId in project.teams) {
      final teamId = rawTeamId.toString();
      final matches = DBHelper.deps.where((team) => team.id == teamId);
      teamNames.add(matches.isNotEmpty ? matches.first.name.toString() : teamId);
    }

    return Dialog(
      elevation: 10,
      backgroundColor: ColorPicker.cardBackground,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16.0),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                project.title,
                style: const TextStyle(
                  color: ColorPicker.fontDark,
                  fontWeight: FontWeight.bold,
                  fontSize: 22.0,
                ),
              ),
              const SizedBox(height: 12.0),
              _StatusBadge(status: project.status),
              const SizedBox(height: 16.0),
              Text(
                project.description,
                style: const TextStyle(
                  color: ColorPicker.fontMedium,
                  fontSize: 15.0,
                ),
              ),
              const SizedBox(height: 16.0),
              const Text(
                'Assigned teams',
                style: TextStyle(
                  color: ColorPicker.fontDark,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: teamNames.isEmpty
                    ? [
                        const _InfoChip(
                          icon: Icons.groups_outlined,
                          label: 'No team',
                          color: ColorPicker.fontLight,
                        )
                      ]
                    : teamNames
                        .map<Widget>((name) => _InfoChip(
                              icon: Icons.groups_outlined,
                              label: name,
                              color: ColorPicker.buttonSecondary,
                            ))
                        .toList(),
              ),
              const SizedBox(height: 16.0),
              Row(
                children: [
                  Icon(Icons.calendar_today,
                      size: 16, color: ColorPicker.fontLight),
                  const SizedBox(width: 8),
                  Text(
                    'End Date: ${project.endDateString}',
                    style: const TextStyle(
                      color: ColorPicker.fontDark,
                      fontSize: 15.0,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CardActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final String tooltip;
  final VoidCallback onPressed;

  const _CardActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onPressed,
        child: SizedBox(
          width: 46,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = StatusHelper.getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(StatusHelper.getStatusIcon(status), size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            StatusHelper.getStatusLabel(status),
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 180),
            child: Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
