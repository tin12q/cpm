//import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:flutter/material.dart';

import 'db_helper.dart';

class Task {
  String _id = '';
  String _title = '';
  String _description = '';
  String _status = '';
  String _project = '';
  DateTime _endDate = DateTime.now();
  List<String> _emp = [];

  // MCMF fields
  int _difficulty = 2; // 1=Basic, 2=Easy, 3=Medium, 4=Hard
  int _priority = 3; // 1=Very Low, 2=Low, 3=Medium, 4=High, 5=Critical
  bool _canParallelize = true;

  get id => _id;
  get title => _title;
  get description => _description;
  get status => _status;
  get endDate => _endDate;
  get project => _project;
  get endDateString =>
      '${_endDate.day.toString()}/${_endDate.month.toString()}/${_endDate.year.toString()}';
  get emp => _emp;

  // MCMF getters
  int get difficulty => _difficulty;
  int get priority => _priority;
  bool get canParallelize => _canParallelize;
  List<Widget> get empWidget {
    List<Widget> empWidget = [];
    for (var empId in _emp) {
      var emp = DBHelper.empMap[empId]; // Get the employee object from empMap
      if (emp != null) {
        empWidget.add(Text(emp.name)); // Use the employee name
      }
    }
    return empWidget;
  }

  set id(id) => _id = id;
  set title(title) => _title = title;
  set description(description) => _description = description;
  set status(status) => _status = status;
  set endDate(edate) => _endDate = edate;
  set emp(emp) => _emp = emp;
  set project(project) => _project = project;

  // MCMF setters
  set difficulty(int d) => _difficulty = d;
  set priority(int p) => _priority = p;
  set canParallelize(bool can) => _canParallelize = can;
  Task({
    String? id,
    required String title,
    required String description,
    required String status,
    required String project,
    required DateTime endDate,
    required List<String> emp,
    int difficulty = 2,
    int priority = 3,
    bool canParallelize = true,
  }) {
    if (id != null) _id = id;
    _title = title;
    _description = description;
    _project = project;
    _status = status;
    _endDate = endDate;
    _emp = emp;
    _difficulty = difficulty;
    _priority = priority;
    _canParallelize = canParallelize;
  }

  @override
  String toString() {
    return 'task{_title: $_title, _description: $_description, _status: $_status, _startDate: _endDate: $_endDate}, _emp: $_emp}';
  }
}
