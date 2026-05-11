import 'package:flutter/material.dart';

import '../model/color_picker.dart';
import '../model/db_helper.dart';
import '../model/emp.dart';

class UserManagementPage extends StatefulWidget {
  const UserManagementPage({Key? key}) : super(key: key);

  @override
  State<UserManagementPage> createState() => _UserManagementPageState();
}

class _UserManagementPageState extends State<UserManagementPage> {
  late Future<List<Employee>> _usersFuture;
  String _searchText = '';

  bool get _canManageUsers {
    final role = DBHelper.mainUser.role.toLowerCase();
    return role == 'admin' || role == 'superadmin';
  }

  @override
  void initState() {
    super.initState();
    _usersFuture = DBHelper.reloadUsers();
  }

  void _reload() {
    setState(() {
      _usersFuture = DBHelper.reloadUsers();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ColorPicker.backgroundLight,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: ColorPicker.backgroundLight,
        foregroundColor: ColorPicker.fontDark,
        title: const Text(
          'User management',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: SafeArea(
        child: !_canManageUsers
            ? const _AccessDenied()
            : FutureBuilder<List<Employee>>(
                future: _usersFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return _ErrorState(
                      message: snapshot.error.toString(),
                      onRetry: _reload,
                    );
                  }

                  final users = _filterUsers(snapshot.data ?? const []);
                  return RefreshIndicator(
                    color: ColorPicker.accent,
                    onRefresh: () async => _reload(),
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        TextField(
                          decoration: InputDecoration(
                            labelText: 'Search users',
                            prefixIcon: const Icon(Icons.search_outlined),
                            filled: true,
                            fillColor: ColorPicker.cardBackground,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(
                                  color: ColorPicker.cardBorder),
                            ),
                          ),
                          onChanged: (value) {
                            setState(() {
                              _searchText = value;
                            });
                          },
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '${users.length} users',
                          style: const TextStyle(
                            color: ColorPicker.fontMedium,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (users.isEmpty)
                          const _EmptyState()
                        else
                          ...users.map(
                            (user) => _UserTile(
                              user: user,
                              onEdit: () => _openEditDialog(user),
                              onDelete: user.id == DBHelper.mainUser.id
                                  ? null
                                  : () => _confirmDelete(user),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }

  List<Employee> _filterUsers(List<Employee> users) {
    final query = _searchText.trim().toLowerCase();
    if (query.isEmpty) return users;
    return users.where((user) {
      return user.name.toLowerCase().contains(query) ||
          user.email.toLowerCase().contains(query) ||
          user.role.toLowerCase().contains(query);
    }).toList();
  }

  Future<void> _openEditDialog(Employee user) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => _EditUserDialog(user: user),
    );
    if (saved == true) {
      _reload();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('User updated'),
          backgroundColor: ColorPicker.buttonSuccess,
        ),
      );
    }
  }

  Future<void> _confirmDelete(Employee user) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete user'),
        content: Text('Delete ${user.name}? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: ColorPicker.buttonDanger,
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await DBHelper.deleteUserById(user.id);
      _reload();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('User deleted'),
          backgroundColor: ColorPicker.buttonSuccess,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: ColorPicker.buttonDanger,
        ),
      );
    }
  }
}

class _UserTile extends StatelessWidget {
  final Employee user;
  final VoidCallback onEdit;
  final VoidCallback? onDelete;

  const _UserTile({
    required this.user,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final skills = user.skills.take(3).join(', ');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ColorPicker.cardBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: ColorPicker.accent.withOpacity(0.12),
            child: Text(
              user.name.isEmpty ? 'U' : user.name[0].toUpperCase(),
              style: const TextStyle(
                color: ColorPicker.accent,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  user.email.isEmpty
                      ? user.role
                      : '${user.email} - ${user.role}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ColorPicker.fontMedium,
                    fontSize: 12,
                  ),
                ),
                if (skills.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    skills,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: ColorPicker.fontLight,
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
          IconButton(
            onPressed: onEdit,
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Edit user',
          ),
          IconButton(
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline),
            tooltip: 'Delete user',
            color: onDelete == null
                ? ColorPicker.fontLight
                : ColorPicker.buttonDanger,
          ),
        ],
      ),
    );
  }
}

class _EditUserDialog extends StatefulWidget {
  final Employee user;

  const _EditUserDialog({required this.user});

  @override
  State<_EditUserDialog> createState() => _EditUserDialogState();
}

class _EditUserDialogState extends State<_EditUserDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _passwordController;
  late final TextEditingController _skillsController;
  late String _role;
  bool _saving = false;

  static const _roles = ['admin', 'manager', 'employee'];

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.user.name);
    _emailController = TextEditingController(text: widget.user.email);
    _passwordController = TextEditingController();
    _skillsController =
        TextEditingController(text: widget.user.skills.join(', '));
    _role = _roles.contains(widget.user.role.toLowerCase())
        ? widget.user.role.toLowerCase()
        : 'employee';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _skillsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Edit user'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              value: _role,
              decoration: const InputDecoration(labelText: 'Role'),
              items: _roles
                  .map(
                    (role) => DropdownMenuItem(
                      value: role,
                      child: Text(role),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() => _role = value);
              },
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _skillsController,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Skills',
                hintText: 'Flutter, Dart, API Integration',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'New password',
                helperText: 'Leave empty to keep current password',
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save'),
        ),
      ],
    );
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await DBHelper.updateUserProfile(
        id: widget.user.id,
        name: _nameController.text,
        email: _emailController.text,
        role: _role,
        password: _passwordController.text,
        skills: _skillsController.text
            .split(',')
            .map((skill) => skill.trim())
            .where((skill) => skill.isNotEmpty)
            .toList(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: ColorPicker.buttonDanger,
        ),
      );
      setState(() => _saving = false);
    }
  }
}

class _AccessDenied extends StatelessWidget {
  const _AccessDenied();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Only admin accounts can manage users.',
          textAlign: TextAlign.center,
          style: TextStyle(color: ColorPicker.fontMedium),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({
    required this.message,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: ColorPicker.fontMedium),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_outlined),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: ColorPicker.cardBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ColorPicker.cardBorder),
      ),
      child: const Text(
        'No users found.',
        textAlign: TextAlign.center,
        style: TextStyle(color: ColorPicker.fontMedium),
      ),
    );
  }
}
