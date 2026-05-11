import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:qlcv/model/db_helper.dart';
import 'package:qlcv/model/color_picker.dart';
import 'package:qlcv/route/auto_assignment_page.dart';
import 'package:qlcv/route/user_management_page.dart';

class Menu extends StatefulWidget {
  const Menu({Key? key}) : super(key: key);

  @override
  State<Menu> createState() => _MenuState();
}

class _MenuState extends State<Menu> {
  @override
  void initState() {
    super.initState();
    // Fetch avatar only when Menu page is opened
    if (kIsWeb) {
      return;
    }
    DBHelper.getAvatar().then((_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final canAutoAssign = DBHelper.mainUser.role == 'admin' ||
        DBHelper.mainUser.role == 'manager';
    final canManageUsers = DBHelper.mainUser.role == 'admin' ||
        DBHelper.mainUser.role == 'superadmin';

    return Scaffold(
      backgroundColor: ColorPicker.backgroundLight,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: ColorPicker.cardBackground,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: ColorPicker.cardBorder),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 34,
                    backgroundColor: ColorPicker.accent.withOpacity(0.14),
                    backgroundImage: !kIsWeb && DBHelper.imageFile != null
                        ? FileImage(DBHelper.imageFile!)
                        : null,
                    child: !kIsWeb && DBHelper.imageFile != null
                        ? null
                        : Text(
                            DBHelper.mainUser.name.isNotEmpty
                                ? DBHelper.mainUser.name[0].toUpperCase()
                                : 'U',
                            style: const TextStyle(
                              color: ColorPicker.accent,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          DBHelper.mainUser.name,
                          style: const TextStyle(
                            color: ColorPicker.fontDark,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: ColorPicker.accent.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            DBHelper.mainUser.role.toString().toUpperCase(),
                            style: const TextStyle(
                              color: ColorPicker.accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Account',
              style: TextStyle(
                color: ColorPicker.fontDark,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            _MenuActionTile(
              icon: Icons.account_circle_outlined,
              title: 'Set Avatar',
              subtitle: kIsWeb
                  ? 'Avatar upload is not supported on web'
                  : 'Choose a profile image',
              onTap: _pickAvatar,
            ),
            if (canAutoAssign)
              _MenuActionTile(
                icon: Icons.auto_awesome,
                title: 'Auto Assign Tasks',
                subtitle: 'Assign project tasks based on workload and skills',
                iconColor: Colors.orange,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const AutoAssignmentPage(),
                    ),
                  );
                },
              ),
            if (canManageUsers)
              _MenuActionTile(
                icon: Icons.manage_accounts_outlined,
                title: 'Manage Users',
                subtitle: 'Edit roles, skills and account information',
                iconColor: ColorPicker.buttonSecondary,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const UserManagementPage(),
                    ),
                  );
                },
              ),
            _MenuActionTile(
              icon: Icons.logout,
              title: 'Logout',
              subtitle: 'End this session',
              iconColor: ColorPicker.buttonDanger,
              onTap: () {
                logout(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _MenuActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    Color iconColor = ColorPicker.accent,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: ColorPicker.cardBackground,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: ColorPicker.cardBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: iconColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: ColorPicker.fontDark,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          color: ColorPicker.fontMedium,
                          fontSize: 12,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  color: ColorPicker.fontLight,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _pickAvatar() async {
    if (kIsWeb) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Avatar upload is not supported on web yet.'),
        ),
      );
      return;
    }

    FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.image,
      allowMultiple: false,
    );

    if (result != null) {
      // Get the path of the selected image file
      DBHelper.imagePath = result.files.single.path;

      // Load the image file and update the avatar
      if (DBHelper.imagePath != null) {
        setState(() {
          DBHelper.imageFile = File(DBHelper
              .imagePath!); // Set the imageFile in DBHelper to the selected image
        });

        // Upload the image file
        await DBHelper.saveImage();

        // Update the avatar
        setState(() {});
      }
    }
  }

  void logout(BuildContext context) async {
    await DBHelper.logOut();
    Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
  }
}
