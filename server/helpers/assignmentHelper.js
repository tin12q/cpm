/**
 * Assignment Helper - Tính toán cost và skill matching cho task assignment
 */

/**
 * Tính cosine similarity giữa 2 arrays của skills
 * @param {Array<string>} taskSkills - Kỹ năng task yêu cầu
 * @param {Array<string>} userSkills - Kỹ năng user có
 * @returns {number} - Score từ 0 đến 1 (1 = match hoàn toàn)
 */
function calculateSkillMatch(taskSkills, userSkills) {
	if (!taskSkills || taskSkills.length === 0) {
		return 1; // Không yêu cầu skill => ai cũng match
	}

	if (!userSkills || userSkills.length === 0) {
		return 0; // User không có skill nào
	}

	// Tạo vector cho task skills và user skills
	const allSkills = [...new Set([...taskSkills, ...userSkills])];
	const taskVector = allSkills.map((skill) =>
		taskSkills.includes(skill) ? 1 : 0
	);
	const userVector = allSkills.map((skill) =>
		userSkills.includes(skill) ? 1 : 0
	);

	// Tính cosine similarity
	const dotProduct = taskVector.reduce(
		(sum, val, i) => sum + val * userVector[i],
		0
	);
	const taskMagnitude = Math.sqrt(
		taskVector.reduce((sum, val) => sum + val * val, 0)
	);
	const userMagnitude = Math.sqrt(
		userVector.reduce((sum, val) => sum + val * val, 0)
	);

	if (taskMagnitude === 0 || userMagnitude === 0) {
		return 0;
	}

	return dotProduct / (taskMagnitude * userMagnitude);
}

/**
 * Tính số giờ còn lại đến deadline
 * @param {number} deadline - Timestamp của deadline
 * @returns {number} - Số giờ còn lại
 */
function calculateHoursUntilDeadline(deadline) {
	const now = Date.now();
	const hoursUntil = (deadline - now) / (1000 * 60 * 60);
	return Math.max(hoursUntil, 0.1); // Tránh chia cho 0
}

/**
 * Tính cost cho việc assign một user vào một task
 * Công thức:
 * cost = W_deadline*deadline_factor - W_priority*priority_factor
 *        - W_speed*speed_score - W_skill*skill_match + W_workload*workload_penalty
 *
 * @param {Object} task - Task object
 * @param {Object} user - User object
 * @param {Object} config - Configuration weights
 * @returns {number} - Cost score (càng nhỏ càng tốt)
 */
function calculateAssignmentCost(task, user, config = {}) {
	// Weights mặc định (có thể override)
	const W_deadline = config.W_deadline || 0.5;
	const W_priority = config.W_priority || 0.2;
	const W_speed = config.W_speed || 0.2;
	const W_skill = config.W_skill || 0.1;
	const W_workload = config.W_workload || 0.05;

	// Giá trị max cho chuẩn hóa
	const MAX_PRIORITY = config.MAX_PRIORITY || 5;
	const MAX_TASK_COUNT = config.MAX_TASK_COUNT || 10;

	// Tính các yếu tố
	const skill_match = calculateSkillMatch(
		task.skills_required || [],
		user.skills || []
	);
	const speed_score = user.productivity_score || 0.8;
	const priority_factor = task.priority / MAX_PRIORITY;
	const hours_until_deadline = calculateHoursUntilDeadline(task.due_date);
	const deadline_factor = 1 / hours_until_deadline; // Càng gần deadline càng lớn
	const workload_penalty = (user.current_task_count || 0) / MAX_TASK_COUNT;

	// Tính cost (số nhỏ = tốt)
	const cost =
		W_deadline * deadline_factor -
		W_priority * priority_factor -
		W_speed * speed_score -
		W_skill * skill_match +
		W_workload * workload_penalty;

	return cost;
}

/**
 * Tính cost cho tất cả các cặp user-task
 * @param {Array} tasks - Danh sách tasks
 * @param {Array} users - Danh sách users
 * @param {Object} config - Configuration
 * @returns {Object} - Map của {taskId: {userId: cost}}
 */
function calculateAllCosts(tasks, users, config = {}) {
	const costMatrix = {};

	tasks.forEach((task) => {
		costMatrix[task._id.toString()] = {};

		users.forEach((user) => {
			const cost = calculateAssignmentCost(task, user, config);
			costMatrix[task._id.toString()][user._id.toString()] = cost;
		});
	});

	return costMatrix;
}

/**
 * Chuẩn bị dữ liệu cho Min-Cost Max-Flow algorithm
 * @param {Array} tasks - Danh sách tasks
 * @param {Array} users - Danh sách users
 * @param {Object} costMatrix - Ma trận cost
 * @returns {Object} - Graph data structure
 */
function prepareGraphData(tasks, users, costMatrix) {
	const graph = {
		nodes: [],
		edges: [],
	};

	// Node IDs
	const SOURCE = "source";
	const SINK = "sink";

	// Add nodes
	graph.nodes.push({ id: SOURCE, type: "source" });
	users.forEach((user) => {
		graph.nodes.push({ id: user._id.toString(), type: "user", data: user });
	});
	tasks.forEach((task) => {
		graph.nodes.push({ id: task._id.toString(), type: "task", data: task });
	});
	graph.nodes.push({ id: SINK, type: "sink" });

	// Add edges: Source -> Users (capacity = 1, cost = 0)
	users.forEach((user) => {
		graph.edges.push({
			from: SOURCE,
			to: user._id.toString(),
			capacity: 1,
			cost: 0,
		});
	});

	// Add edges: Users -> Tasks (capacity = 1, cost = calculated)
	tasks.forEach((task) => {
		users.forEach((user) => {
			const cost = costMatrix[task._id.toString()][user._id.toString()];
			// Chỉ thêm edge nếu user có skill phù hợp hoặc task không yêu cầu skill
			if (task.skills_required && task.skills_required.length > 0) {
				const skillMatch = calculateSkillMatch(
					task.skills_required,
					user.skills || []
				);
				if (skillMatch > 0) {
					graph.edges.push({
						from: user._id.toString(),
						to: task._id.toString(),
						capacity: 1,
						cost: cost,
					});
				}
			} else {
				// Task không yêu cầu skill => ai cũng có thể làm
				graph.edges.push({
					from: user._id.toString(),
					to: task._id.toString(),
					capacity: 1,
					cost: cost,
				});
			}
		});
	});

	// Add edges: Tasks -> Sink (capacity = number_of_people_needed)
	tasks.forEach((task) => {
		graph.edges.push({
			from: task._id.toString(),
			to: SINK,
			capacity: task.number_of_people_needed || 1,
			cost: 0,
		});
	});

	return graph;
}

module.exports = {
	calculateSkillMatch,
	calculateHoursUntilDeadline,
	calculateAssignmentCost,
	calculateAllCosts,
	prepareGraphData,
};
