class Project {
  String _id = '';
  String _title = '';
  String _description = '';
  String _status = '';
  List<String> _teams = []; // Changed from single dep to teams list
  DateTime _endDate = DateTime.now();

  Project({
    String? id,
    required String title,
    required String description,
    required String status,
    List<String>? teams,
    String? dep, // Keep for backward compatibility
    required DateTime endDate,
  }) {
    if (id != null) _id = id;
    _title = title;
    _description = description;
    _status = status;
    // Handle both new teams array and legacy dep field
    if (teams != null && teams.isNotEmpty) {
      _teams = teams;
    } else if (dep != null && dep.isNotEmpty) {
      _teams = [dep];
    }
    _endDate = endDate;
  }

  get id => _id;
  get title => _title;
  get description => _description;
  get status => _status;
  get teams => _teams;
  get dep => _teams.isNotEmpty ? _teams[0] : ''; // For backward compatibility
  get endDate => _endDate;

  get endDateString =>
      '${_endDate.day.toString()}/${_endDate.month.toString()}/${_endDate.year.toString()}';

  set id(id) => _id = id;
  set title(title) => _title = title;
  set description(description) => _description = description;
  set status(status) => _status = status;
  set teams(teams) =>
      _teams = teams is List<String> ? teams : [teams.toString()];
  set dep(dep) => _teams = [dep]; // For backward compatibility
  set endDate(edate) => _endDate = edate;

  @override
  String toString() {
    return 'Project{id: $_id, title: $_title, description: $_description, status: $_status, teams: $_teams, endDate: $_endDate}';
  }
}
