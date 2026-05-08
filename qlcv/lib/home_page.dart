import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_nav_bar/google_nav_bar.dart';
import 'model/db_helper.dart';

//import 'model/task.dart';

import 'route/dashboard.dart';
import 'route/home.dart';
import 'route/calendar.dart';
import 'route/menu.dart';
import 'route/projects.dart';
import 'route/chatbot_page.dart';
import 'package:qlcv/model/color_picker.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _dataLoaded = false;
  int _selectedIndex = 1;

  final List<Widget> _widgetOptions = <Widget>[
    Dashboard(),
    const Home(),
    const Projects(),
    const Calendar(),
    const ChatbotPage(),
    const Menu(),
  ];

  Future<void> loadData() async {
    if (!_dataLoaded) {
      final sessionRestored = await DBHelper.restoreSession();
      if (!sessionRestored) {
        if (!mounted) return;
        Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
        return;
      }

      DBHelper.reset();
      // Load only essential data - teams first
      await DBHelper.getDep();
      // Load paginated data in parallel for faster loading
      await Future.wait([
        DBHelper.loadTasksPage(page: 1, limit: 25),
        DBHelper.loadProjectsPage(page: 1, limit: 25),
        DBHelper.getEmp(),
      ]);
      // await DBHelper.getAvatar(); // Disabled - MinIO server offline
      DBHelper.initMap();
      DBHelper.updateTaskEMP();
      DBHelper.projectTasks.clear();
      if (!mounted) return;
      setState(() {
        _dataLoaded = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_dataLoaded) {
      loadData();
      return const Center(
        child: CircularProgressIndicator(
          color: ColorPicker.accent,
          backgroundColor: ColorPicker.background,
        ),
      );
    }
    return Scaffold(
      body: _widgetOptions.elementAt(_selectedIndex),
      bottomNavigationBar: Container(
        color: ColorPicker.primary,
        child: SafeArea(
          child: GNav(
            gap: 5,
            activeColor: ColorPicker.primary,
            color: ColorPicker.dark,
            rippleColor: ColorPicker.primary,
            hoverColor: ColorPicker.accent,
            iconSize: 19,
            padding: const EdgeInsets.symmetric(
                horizontal: 15,
                vertical: 20), // Adjust the horizontal padding here
            duration: const Duration(milliseconds: 300),
            tabBackgroundColor: ColorPicker.accent,
            backgroundColor: ColorPicker.primary,
            tabs: _tabs,
            selectedIndex: 1,
            onTabChange: (index) async {
              await DBHelper.taskUpdate();
              setState(() {
                _selectedIndex = index;
              });
            },
          ),
        ),
      ),
    );
  }

  final _tabs = (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS)
      ? const [
          GButton(
            icon: CupertinoIcons.square_grid_2x2,
            iconSize: 25,
          ),
          // GButton for Project

          GButton(
            icon: CupertinoIcons.home,
            iconSize: 25,
            text: 'Home',
          ),
          GButton(
            icon: CupertinoIcons.calendar_today,
            iconSize: 25,
            text: 'Calendar',
          ),
          GButton(
            icon: CupertinoIcons.bars,
            iconSize: 25,
          ),
        ]
      : const [
          GButton(
            icon: Icons.dashboard_outlined,
          ),
          GButton(
            icon: Icons.home_outlined,
            text: 'Home',
          ),
          GButton(icon: Icons.cases_outlined, text: 'Project'),
          GButton(
            icon: Icons.calendar_month_outlined,
            text: 'Calendar',
          ),
          GButton(
            icon: Icons.smart_toy_outlined,
            text: 'AI Chat',
          ),
          GButton(
            icon: Icons.menu_outlined,
            text: 'Menu',
          )
        ];
}
