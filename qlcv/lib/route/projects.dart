import 'dart:async';

import 'package:flutter/material.dart';

import 'package:qlcv/model/color_picker.dart';
import 'package:qlcv/route/project_create.dart';
import 'package:qlcv/route/auto_assignment_page.dart';
import 'package:qlcv/utils/search_helper.dart';
import 'package:qlcv/utils/status_helper.dart';

import '../model/db_helper.dart';
import '../model/project_box.dart';

class Projects extends StatefulWidget {
  const Projects({Key? key}) : super(key: key);
  @override
  State<Projects> createState() => _ProjectsState();
}

class _ProjectsState extends State<Projects> {
  final TextEditingController _searchController = TextEditingController();
  bool _isLoading = false;
  int _currentPage = 1;
  int _totalPages = 1;
  final int _itemsPerPage = 25;
  List<dynamic> _filteredProjects = [];
  String? _selectedStatus;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _loadPage(1);
  }

  Future<void> _loadPage(int page) async {
    if (_isLoading) return;

    setState(() {
      _isLoading = true;
      _currentPage = page;
    });

    final hasLocalQuery =
        _searchController.text.trim().isNotEmpty || _selectedStatus != null;
    await DBHelper.loadProjectsPage(
      page: hasLocalQuery ? 1 : page,
      limit: hasLocalQuery ? 200 : _itemsPerPage,
    );

    if (mounted) {
      setState(() {
        _isLoading = false;
        _applyFilters();
        _totalPages = hasLocalQuery
            ? 1
            : ((DBHelper.totalProjectCount / _itemsPerPage).ceil())
                .clamp(1, 999);
      });
    }
  }

  void _applyFilters() {
    List<dynamic> filtered = List.from(DBHelper.projects);
    final query = _searchController.text.trim();

    if (query.isNotEmpty) {
      filtered = filtered
          .where((project) => SearchHelper.matchesAny(query, [
                project.title,
                project.description,
                project.status,
              ]))
          .toList();
    }

    if (_selectedStatus != null) {
      filtered = filtered
          .where((project) =>
              StatusHelper.normalizeStatus(project.status) == _selectedStatus)
          .toList();
    }

    _filteredProjects = filtered;
  }

  void _scheduleReload() {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) {
        _loadPage(1);
      }
    });
  }

  void _previousPage() {
    if (_currentPage > 1) {
      _loadPage(_currentPage - 1);
    }
  }

  void _nextPage() {
    if (_currentPage < _totalPages && DBHelper.hasMoreProjects) {
      _loadPage(_currentPage + 1);
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
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
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
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Projects',
                            style: TextStyle(
                              color: ColorPicker.fontDark,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'Welcome, ${DBHelper.mainUser.name}',
                            style: const TextStyle(
                              color: ColorPicker.fontMedium,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                      (DBHelper.mainUser.role == 'admin' ||
                              DBHelper.mainUser.role == 'manager')
                          ? Row(
                              children: [
                                SafeArea(
                                  child: InkWell(
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) =>
                                              const AutoAssignmentPage(),
                                        ),
                                      );
                                    },
                                    child: const CircleAvatar(
                                      backgroundColor: Colors.blue,
                                      child: Icon(
                                        Icons.auto_awesome,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                SafeArea(
                                  child: InkWell(
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) =>
                                              ProjectCreateRoute(),
                                        ),
                                      );
                                    },
                                    child: const CircleAvatar(
                                      backgroundColor: ColorPicker.accent,
                                      //size
                                      radius: 20,
                                      child: Icon(
                                        Icons.add,
                                        color: ColorPicker.primary,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : SafeArea(
                              child: InkWell(
                                onTap: () {
                                  showDialog(
                                    context: context,
                                    builder: (BuildContext context) {
                                      return AlertDialog(
                                        title: const Text('Access Denied'),
                                        content: const Text(
                                            'Employees cannot create projects. Please contact your manager or admin.'),
                                        actions: [
                                          TextButton(
                                            onPressed: () =>
                                                Navigator.pop(context),
                                            child: const Text('OK'),
                                          ),
                                        ],
                                      );
                                    },
                                  );
                                },
                                child: const CircleAvatar(
                                  backgroundColor: ColorPicker.accent,
                                  //size
                                  radius: 20,
                                  child: Icon(
                                    Icons.add,
                                    color: ColorPicker.primary,
                                  ),
                                ),
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
                          hintText: 'Search projects...',
                          prefixIcon: const Icon(Icons.search,
                              color: ColorPicker.fontLight),
                          suffixIcon: _searchController.text.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear,
                                      color: ColorPicker.fontLight),
                                  onPressed: () {
                                    setState(() {
                                      _searchController.clear();
                                    });
                                    _loadPage(1);
                                  },
                                )
                              : null,
                          filled: true,
                          fillColor: ColorPicker.backgroundLight,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12.0),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
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
                              onSelected: (selected) {
                                setState(() {
                                  _selectedStatus = null;
                                });
                                _loadPage(1);
                              },
                              selectedColor: ColorPicker.accent,
                              labelStyle: TextStyle(
                                color: _selectedStatus == null
                                    ? Colors.white
                                    : ColorPicker.fontMedium,
                                fontWeight: _selectedStatus == null
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                              ),
                            ),
                            const SizedBox(width: 8),
                            ...StatusHelper.projectStatuses.map((status) {
                              final isSelected = _selectedStatus == status;
                              return Padding(
                                padding: const EdgeInsets.only(right: 8.0),
                                child: FilterChip(
                                  label: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        StatusHelper.getStatusIcon(status),
                                        size: 16,
                                        color: isSelected
                                            ? Colors.white
                                            : StatusHelper.getStatusColor(
                                                status),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(StatusHelper.getStatusLabel(status)),
                                    ],
                                  ),
                                  selected: isSelected,
                                  onSelected: (selected) {
                                    setState(() {
                                      _selectedStatus =
                                          selected ? status : null;
                                    });
                                    _loadPage(1);
                                  },
                                  selectedColor:
                                      StatusHelper.getStatusColor(status),
                                  backgroundColor:
                                      StatusHelper.getStatusColor(status)
                                          .withValues(alpha: 0.1),
                                  labelStyle: TextStyle(
                                    color: isSelected
                                        ? Colors.white
                                        : StatusHelper.getStatusColor(status),
                                    fontWeight: isSelected
                                        ? FontWeight.bold
                                        : FontWeight.normal,
                                  ),
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
                      : _filteredProjects.isEmpty
                          ? const Center(
                              child: Text(
                                'No projects found',
                                style: TextStyle(
                                    fontSize: 16, color: ColorPicker.fontDark),
                              ),
                            )
                          : ListView.separated(
                              itemCount: _filteredProjects.length,
                              separatorBuilder:
                                  (BuildContext context, int index) {
                                return const SizedBox(height: 15);
                              },
                              itemBuilder: (context, index) {
                                if (index >= _filteredProjects.length) {
                                  return const SizedBox.shrink();
                                }
                                return Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: ProjectCard(
                                          project: _filteredProjects[index]),
                                    ),
                                    const SizedBox(width: 10)
                                  ],
                                );
                              },
                            ),
                ),
                if (_totalPages > 1)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        vertical: 12, horizontal: 16),
                    decoration: BoxDecoration(
                      color: ColorPicker.cardBackground,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 4,
                          offset: const Offset(0, -2),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          onPressed: _currentPage > 1 && !_isLoading
                              ? _previousPage
                              : null,
                          icon: const Icon(Icons.chevron_left),
                          style: IconButton.styleFrom(
                            backgroundColor: _currentPage > 1 && !_isLoading
                                ? ColorPicker.accent
                                : ColorPicker.fontLight.withValues(alpha: 0.2),
                            foregroundColor: _currentPage > 1 && !_isLoading
                                ? Colors.white
                                : ColorPicker.fontLight,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: ColorPicker.backgroundLight,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'Page $_currentPage of $_totalPages',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: ColorPicker.fontDark,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: _currentPage < _totalPages &&
                                  !_isLoading &&
                                  DBHelper.hasMoreProjects
                              ? _nextPage
                              : null,
                          icon: const Icon(Icons.chevron_right),
                          style: IconButton.styleFrom(
                            backgroundColor: _currentPage < _totalPages &&
                                    !_isLoading &&
                                    DBHelper.hasMoreProjects
                                ? ColorPicker.accent
                                : ColorPicker.fontLight.withValues(alpha: 0.2),
                            foregroundColor: _currentPage < _totalPages &&
                                    !_isLoading &&
                                    DBHelper.hasMoreProjects
                                ? Colors.white
                                : ColorPicker.fontLight,
                          ),
                        ),
                      ],
                    ),
                  )
              ],
            )));
  }
}
