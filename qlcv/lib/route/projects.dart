import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';

import 'package:qlcv/model/task_box.dart';
import 'package:qlcv/model/color_picker.dart';
import 'package:qlcv/route/project_create.dart';
import 'package:qlcv/route/auto_assignment_page.dart';

import '../model/db_helper.dart';
import '../model/project_box.dart';
import 'task_create.dart';

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

    await DBHelper.loadProjectsPage(page: page, limit: _itemsPerPage);

    if (mounted) {
      setState(() {
        _isLoading = false;
        _filteredProjects = List.from(DBHelper.projects);
        _totalPages =
            ((DBHelper.totalProjectCount / _itemsPerPage).ceil()).clamp(1, 999);
      });
    }
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
  Widget build(BuildContext context) {
    return SafeArea(
        child: Scaffold(
            body: Column(
      children: [
        Container(
          height: 60,
          child: Row(
            //right to left
            mainAxisAlignment: MainAxisAlignment.end,

            children: [
              Text(
                DBHelper.mainUser.name,
                style: const TextStyle(
                  color: ColorPicker.fontDark,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 60),
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
                                  builder: (context) => ProjectCreateRoute(),
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
                                    onPressed: () => Navigator.pop(context),
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
              const SizedBox(width: 30),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(8.0),
          child: Container(
            width: 300, // Adjust the width as needed
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                labelText: 'Search',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(
                      25.0), // Adjust the border radius as needed
                ),
              ),
              onChanged: (value) {
                setState(() {
                  if (value.isEmpty) {
                    _filteredProjects = List.from(DBHelper.projects);
                  } else {
                    _filteredProjects = DBHelper.projects
                        .where((project) => project.title
                            .toLowerCase()
                            .contains(value.toLowerCase()))
                        .toList();
                  }
                });
              },
            ),
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
                      separatorBuilder: (BuildContext context, int index) {
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
        Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ElevatedButton(
                onPressed:
                    _currentPage > 1 && !_isLoading ? _previousPage : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ColorPicker.accent,
                  foregroundColor: ColorPicker.primary,
                ),
                child: const Row(
                  children: [
                    Icon(Icons.arrow_back_ios, size: 16),
                    SizedBox(width: 4),
                    Text('Previous'),
                  ],
                ),
              ),
              Text(
                'Page $_currentPage of $_totalPages',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: ColorPicker.fontDark,
                ),
              ),
              ElevatedButton(
                onPressed: _currentPage < _totalPages &&
                        !_isLoading &&
                        DBHelper.hasMoreProjects
                    ? _nextPage
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ColorPicker.accent,
                  foregroundColor: ColorPicker.primary,
                ),
                child: const Row(
                  children: [
                    Text('Next'),
                    SizedBox(width: 4),
                    Icon(Icons.arrow_forward_ios, size: 16),
                  ],
                ),
              ),
            ],
          ),
        )
      ],
    )));
  }
}
