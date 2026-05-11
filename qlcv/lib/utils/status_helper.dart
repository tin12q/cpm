import 'package:flutter/material.dart';
import '../model/color_picker.dart';

class StatusHelper {
  static const List<String> taskStatuses = [
    'in_progress',
    'completed',
    'late',
  ];

  static const List<String> projectStatuses = [
    'in_progress',
    'completed',
    'late',
  ];

  static String normalizeStatus(String status) {
    final normalized = status.trim().toLowerCase().replaceAll(' ', '_');
    switch (normalized) {
      case 'done':
      case 'complete':
        return 'completed';
      case 'overdue':
        return 'late';
      case 'pending':
      case 'default_value':
      case 'inprogress':
      case 'in_progress':
        return 'in_progress';
      default:
        return normalized.isEmpty ? 'in_progress' : normalized;
    }
  }

  static Color getStatusColor(String status) {
    switch (normalizeStatus(status)) {
      case 'completed':
        return ColorPicker.statusCompleted;
      case 'late':
        return ColorPicker.statusLate;
      case 'in_progress':
      default:
        return ColorPicker.statusInProgress;
    }
  }

  static String getStatusLabel(String status) {
    switch (normalizeStatus(status)) {
      case 'completed':
        return 'Completed';
      case 'late':
        return 'Late';
      case 'in_progress':
        return 'In Progress';
      default:
        return status;
    }
  }

  static IconData getStatusIcon(String status) {
    switch (normalizeStatus(status)) {
      case 'completed':
        return Icons.check_circle;
      case 'late':
        return Icons.warning;
      case 'in_progress':
      default:
        return Icons.pending;
    }
  }
}
