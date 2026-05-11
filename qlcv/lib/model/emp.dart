class Employee {
  String _name = '';
  String _role = '';
  String _id = '';
  String _ava = '';
  String _email = '';

  // MCMF fields
  List<String> _skills = [];
  double _productivityScore = 0.8;
  double _onTimeRate = 85.0;
  int _currentTaskCount = 0;
  Employee({
    required name,
    required role,
    required id,
    ava = '',
    email = '',
    List<String> skills = const [],
    double productivityScore = 0.8,
    double onTimeRate = 85.0,
    int currentTaskCount = 0,
  }) {
    _name = name;
    _role = role;
    _id = id;
    _ava = ava;
    _email = email;
    _skills = skills;
    _productivityScore = productivityScore;
    _onTimeRate = onTimeRate;
    _currentTaskCount = currentTaskCount;
  }

  String get name => _name;
  String get role => _role;
  String get id => _id;
  String get ava => _ava;
  String get email => _email;
  List<String> get skills => _skills;
  double get productivityScore => _productivityScore;
  double get onTimeRate => _onTimeRate;
  int get currentTaskCount => _currentTaskCount;

  set setName(String name) => _name = name;
  set setRole(String role) => _role = role;
  set setId(String id) => _id = id;
  set setAva(String ava) => _ava = ava;
  set setEmail(String email) => _email = email;
  set setSkills(List<String> skills) => _skills = skills;
  set setProductivityScore(double score) => _productivityScore = score;
  set setOnTimeRate(double rate) => _onTimeRate = rate;
  set setCurrentTaskCount(int count) => _currentTaskCount = count;
}
