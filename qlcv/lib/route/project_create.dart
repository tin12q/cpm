import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:qlcv/model/color_picker.dart';
import 'package:qlcv/model/dep.dart';
import 'package:qlcv/route/projects.dart';
import 'package:qlcv/utils/logger.dart';

import '../home_page.dart';
import '../main.dart';
import '../model/db_helper.dart';
import 'package:intl/intl.dart';
import 'package:qlcv/model/task.dart';

import '../model/project.dart';

class ProjectCreateRoute extends StatefulWidget {
  @override
  State<ProjectCreateRoute> createState() => _ProjectCreateRouteState();
}

class _ProjectCreateRouteState extends State<ProjectCreateRoute> {
  //text controller
  TextEditingController dateinput = TextEditingController();
  TextEditingController titleinput = TextEditingController();
  TextEditingController descinput = TextEditingController();
  DateTime end = DateTime.now();
  List<String> selectedTeamIds = [];
  String depName = "";
  @override
  void initState() {
    dateinput.text = "";
    depName = ""; //set the initial value of text field
    super.initState();
    isPaused = true;
  }

  @override
  Widget build(BuildContext context) {
    // TODO: page to create a new task
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Project'),
        backgroundColor: ColorPicker.accent,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text(
                    'Title',
                    style: TextStyle(
                      color: ColorPicker.fontDark,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: TextField(
                      controller: titleinput,
                      decoration: const InputDecoration(
                        hintText: 'Enter title',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Teams',
                    style: TextStyle(
                      color: ColorPicker.fontDark,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    key: ValueKey(selectedTeamIds.join(',')),
                    decoration: InputDecoration(
                      hintText: 'Select teams',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10.0),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                    ),
                    items: () {
                      // Create a map to track unique team IDs
                      final Map<String, dynamic> uniqueTeams = {};
                      for (var dep in DBHelper.deps) {
                        if (!selectedTeamIds.contains(dep.id)) {
                          uniqueTeams[dep.id] = dep;
                        }
                      }
                      return uniqueTeams.values
                          .map((dep) => DropdownMenuItem<String>(
                                value: dep.id,
                                child: Text(dep.name),
                              ))
                          .toList();
                    }(),
                    onChanged: (String? value) {
                      if (value != null && !selectedTeamIds.contains(value)) {
                        setState(() {
                          selectedTeamIds.add(value);
                        });
                      }
                    },
                    value: null,
                  ),
                  const SizedBox(height: 12),
                  // Display selected teams as chips
                  if (selectedTeamIds.isNotEmpty)
                    Wrap(
                      spacing: 8.0,
                      runSpacing: 8.0,
                      children: selectedTeamIds.map((teamId) {
                        final team = DBHelper.deps.firstWhere(
                          (d) => d.id == teamId,
                          orElse: () => DBHelper.deps.first,
                        );
                        return Chip(
                          label: Text(team.name),
                          deleteIcon: Icon(Icons.close, size: 18),
                          onDeleted: () {
                            setState(() {
                              selectedTeamIds.remove(teamId);
                            });
                          },
                          backgroundColor: ColorPicker.primary.withOpacity(0.2),
                          deleteIconColor: ColorPicker.primary,
                        );
                      }).toList(),
                    ),
                  if (selectedTeamIds.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(top: 8),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(color: Colors.orange),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.warning, color: Colors.orange, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Please select at least one team',
                              style: TextStyle(
                                color: Colors.orange.shade900,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              TextField(
                controller: dateinput, //editing controller of this TextField
                decoration: InputDecoration(
                  icon: Icon((Platform.isIOS)
                      ? CupertinoIcons.calendar_badge_plus
                      : Icons.calendar_month), //icon of text field
                  labelText: "End Date", //label text of field
                ),
                readOnly:
                    true, //set it true, so that user will not able to edit text
                onTap: () async {
                  DateTime? pickedDate = await showDatePicker(
                      builder: (context, child) => Theme(
                            data: ThemeData.light().copyWith(
                              colorScheme: const ColorScheme.light(
                                primary: ColorPicker.accent,
                              ),
                            ),
                            child: child!,
                          ),
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime(
                          2023), //DateTime.now() - not to allow to choose before today.
                      lastDate: DateTime(2025));

                  if (pickedDate != null) {
                    //print(pickedDate); //pickedDate output format => 2021-03-10 00:00:00.000
                    String formattedDate =
                        DateFormat('yyyy-MM-dd').format(pickedDate);

                    //print(formattedDate);

                    setState(() {
                      dateinput.text = formattedDate;
                      end = pickedDate;
                    });
                  } else {
                    print("Date is not selected");
                  }
                },
              ),
              const SizedBox(height: 20),
              Expanded(
                  child: TextField(
                controller: descinput,
                decoration: const InputDecoration(
                  hintText: 'Enter description',
                ),
                maxLines: null,
              )),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ElevatedButton(
                      onPressed: _back,
                      style: ButtonStyle(
                        backgroundColor: MaterialStateProperty.all<Color>(
                            ColorPicker.accent),
                      ),
                      child: const Text('Cancel')),
                  const SizedBox(width: 20),
                  ElevatedButton(
                      onPressed: _createProject,
                      style: ButtonStyle(
                        backgroundColor: MaterialStateProperty.all<Color>(
                            ColorPicker.accent),
                      ),
                      child: const Text('Create')),
                ],
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  void _back() {
    Navigator.pop(context);
  }

  @override
  void dispose() {
    isPaused = false;
    super.dispose();
  }

  void _createProject() async {
    try {
      if (titleinput.text == "" ||
          selectedTeamIds.isEmpty ||
          dateinput.text == "" ||
          descinput.text == "") {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please fill all the fields',
                style: TextStyle(color: ColorPicker.primary)),
            backgroundColor: ColorPicker.accent,
            duration: Duration(seconds: 2),
          ),
        );
        throw Exception("Please fill all the fields");
      }

      Project project = new Project(
        title: titleinput.text,
        description: descinput.text,
        status: 'Pending',
        endDate: end,
        teams: selectedTeamIds, // Use selected teams array
      );

      await DBHelper.addProject(project);
      DBHelper.projects.add(project);
      Navigator.pop(context);
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => HomePage()),
        (Route<dynamic> route) => false,
      );
    } on Exception catch (e) {
      AppLogger.error(
          'Failed to create project', e, null, 'ProjectCreateRoute');
    }
  }
}
