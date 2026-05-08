import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:qlcv/model/color_picker.dart';
import 'package:qlcv/model/dep.dart';
import 'package:qlcv/utils/logger.dart';

import '../home_page.dart';
import '../main.dart';
import '../model/db_helper.dart';
import 'package:intl/intl.dart';
import 'package:qlcv/model/task.dart';
import 'package:qlcv/utils/status_helper.dart';

import '../model/emp.dart';
import 'home.dart';

class TaskCreateRoute extends StatefulWidget {
  @override
  State<TaskCreateRoute> createState() => _TaskCreateRouteState();
}

class _TaskCreateRouteState extends State<TaskCreateRoute> {
  //text controller
  TextEditingController dateinput = TextEditingController();
  TextEditingController titleinput = TextEditingController();
  TextEditingController descinput = TextEditingController();
  List<String> selectedEmployeeIds = [];
  List<String> employees = [];
  DateTime end = DateTime.now();
  String empName = "";
  String selectedStatus = 'in_progress';
  @override
  void initState() {
    dateinput.text = "";
    for (var emp in DBHelper.empProject) {
      for (var employee in DBHelper.employees) {
        if (emp == employee.id) {
          employees.add(employee.name);
        }
      }
    }
    empName = ""; //set the initial value of text field
    super.initState();
    isPaused = true;
  }

  @override
  Widget build(BuildContext context) {
    // TODO: page to create a new task
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Task'),
        backgroundColor: ColorPicker.accent,
      ),
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: EdgeInsets.fromLTRB(
                  16,
                  16,
                  16,
                  16 + MediaQuery.of(context).viewInsets.bottom,
                ),
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
                        labelText: 'Task title',
                        hintText: 'Enter title',
                        border: OutlineInputBorder(),
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
                    'Employees',
                    style: TextStyle(
                      color: ColorPicker.fontDark,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    key: ValueKey(selectedEmployeeIds.join(',')),
                    isExpanded: true,
                    decoration: InputDecoration(
                      hintText: 'Select employees',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10.0),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                    ),
                    items: () {
                      // Create a map to track unique employee IDs
                      final Map<String, dynamic> uniqueEmps = {};
                      for (var emp in DBHelper.employees) {
                        if (!selectedEmployeeIds.contains(emp.id)) {
                          uniqueEmps[emp.id] = emp;
                        }
                      }
                      return uniqueEmps.values
                          .map((employee) => DropdownMenuItem<String>(
                                value: employee.id,
                                child: Text(
                                  '${employee.name} (${employee.role})',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ))
                          .toList();
                    }(),
                    onChanged: (String? value) {
                      if (value != null &&
                          !selectedEmployeeIds.contains(value)) {
                        setState(() {
                          selectedEmployeeIds.add(value);
                        });
                      }
                    },
                    value: null,
                  ),
                  const SizedBox(height: 12),
                  // Display selected employees as chips
                  if (selectedEmployeeIds.isNotEmpty)
                    Wrap(
                      spacing: 8.0,
                      runSpacing: 8.0,
                      children: selectedEmployeeIds.map((empId) {
                        final emp = DBHelper.employees.firstWhere(
                          (e) => e.id == empId,
                          orElse: () => DBHelper.employees.first,
                        );
                        return Chip(
                          label: Text('${emp.name} (${emp.role})'),
                          deleteIcon: Icon(Icons.close, size: 18),
                          onDeleted: () {
                            setState(() {
                              selectedEmployeeIds.remove(empId);
                            });
                          },
                          backgroundColor: ColorPicker.primary.withOpacity(0.2),
                          deleteIconColor: ColorPicker.primary,
                        );
                      }).toList(),
                    ),
                  if (selectedEmployeeIds.isEmpty)
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
                              'Please select at least one employee',
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
                  icon: Icon((!kIsWeb &&
                          defaultTargetPlatform == TargetPlatform.iOS)
                      ? CupertinoIcons.calendar_badge_plus
                      : Icons.calendar_month), //icon of text field
                  labelText: "End Date", //label text of field
                  border: const OutlineInputBorder(),
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
                      firstDate: DateTime.now(),
                      lastDate: DateTime(2100));

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
                    AppLogger.debug("Date is not selected", 'TaskCreateRoute');
                  }
                },
              ),
              const SizedBox(height: 20),
              DropdownButtonFormField<String>(
                value: selectedStatus,
                decoration: InputDecoration(
                  labelText: 'Task status',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10.0),
                  ),
                ),
                items: StatusHelper.taskStatuses
                    .map((status) => DropdownMenuItem<String>(
                          value: status,
                          child: Text(StatusHelper.getStatusLabel(status)),
                        ))
                    .toList(),
                onChanged: (value) {
                  if (value != null) {
                    setState(() {
                      selectedStatus = value;
                    });
                  }
                },
              ),
              const SizedBox(height: 20),
              TextField(
                controller: descinput,
                decoration: const InputDecoration(
                  labelText: 'Task description',
                  hintText: 'Enter description',
                  border: OutlineInputBorder(),
                ),
                minLines: 4,
                maxLines: 6,
              ),
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
                      onPressed: _createTask,
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

  void _createTask() async {
    try {
      if (titleinput.text == "" ||
          selectedEmployeeIds.isEmpty ||
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
      Task task = new Task(
          title: titleinput.text,
          description: descinput.text,
          status: selectedStatus,
          project: DBHelper.currentProjectId,
          endDate: end,
          emp: selectedEmployeeIds);
      //
      await DBHelper.addTask(task);
      DBHelper.tasks.add(task);
      DBHelper.projectTasks.add(task);
      Navigator.pop(context);
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => HomePage()),
        (Route<dynamic> route) => false,
      );
    } on Exception catch (e) {
      AppLogger.error('Failed to create task', e, null, 'TaskCreateRoute');
    }
  }
}
