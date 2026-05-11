import 'package:flutter/foundation.dart';

/// Simple logging utility for the application
/// Only logs in debug mode, silent in production
class AppLogger {
  static const String _prefix = '[QLCV]';

  /// Log debug information
  static void debug(String message, [String? tag]) {
    if (kDebugMode) {
      final String tagPrefix = tag != null ? '[$tag]' : '';
      debugPrint('$_prefix$tagPrefix DEBUG: $message');
    }
  }

  /// Log informational messages
  static void info(String message, [String? tag]) {
    if (kDebugMode) {
      final String tagPrefix = tag != null ? '[$tag]' : '';
      debugPrint('$_prefix$tagPrefix INFO: $message');
    }
  }

  /// Log warning messages
  static void warning(String message, [String? tag]) {
    if (kDebugMode) {
      final String tagPrefix = tag != null ? '[$tag]' : '';
      debugPrint('$_prefix$tagPrefix WARNING: $message');
    }
  }

  /// Log error messages with optional error object and stack trace
  static void error(String message,
      [Object? error, StackTrace? stackTrace, String? tag]) {
    if (kDebugMode) {
      final String tagPrefix = tag != null ? '[$tag]' : '';
      debugPrint('$_prefix$tagPrefix ERROR: $message');
      if (error != null) {
        debugPrint('$_prefix$tagPrefix Error object: $error');
      }
      if (stackTrace != null) {
        debugPrint('$_prefix$tagPrefix Stack trace:\n$stackTrace');
      }
    }
  }
}
