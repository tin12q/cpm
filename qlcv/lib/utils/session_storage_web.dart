import 'dart:html' as html;

const _tokenKey = 'qlcv_token';
const _userIdKey = 'qlcv_user_id';

Future<void> saveSession({
  required String token,
  required String userId,
}) async {
  html.window.localStorage[_tokenKey] = token;
  html.window.localStorage[_userIdKey] = userId;
}

Future<String?> readToken() async => html.window.localStorage[_tokenKey];

Future<String?> readUserId() async => html.window.localStorage[_userIdKey];

Future<void> clearSession() async {
  html.window.localStorage.remove(_tokenKey);
  html.window.localStorage.remove(_userIdKey);
}

