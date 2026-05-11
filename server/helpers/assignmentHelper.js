/**
 * Assignment Helper - Tính toán cost và skill matching cho task assignment
 */

/**
 * Skill synonyms để match các kỹ năng tương đương
 * VD: "React" sẽ match với "ReactJS", "Frontend" match với "UI"
 */
const skillSynonyms = {
	// Programming Languages & Frameworks
	react: ["reactjs", "react.js", "react js"],
	vue: ["vuejs", "vue.js", "vue js"],
	angular: ["angularjs", "angular.js"],
	node: ["nodejs", "node.js", "node js"],
	javascript: ["js", "ecmascript", "es6"],
	typescript: ["ts"],
	python: ["py"],

	// Frontend
	frontend: ["front-end", "ui", "client-side", "client side"],
	backend: ["back-end", "server-side", "server side"],
	fullstack: ["full-stack", "full stack"],

	// Database
	mongodb: ["mongo", "mongo db"],
	postgresql: ["postgres", "psql"],
	mysql: ["sql"],
	database: ["db", "data storage"],

	// DevOps & Tools
	docker: ["containerization", "containers"],
	kubernetes: ["k8s"],
	"ci/cd": ["cicd", "continuous integration", "continuous deployment"],
	git: ["version control", "github", "gitlab"],

	// Design
	"ui/ux": ["ui", "ux", "design", "user interface", "user experience"],
	figma: ["design tool"],

	// Mobile
	flutter: ["dart"],
	"react native": ["react-native", "rn"],

	// Testing
	testing: ["test", "qa", "quality assurance"],
};

function normalizeSkillNames(skills) {
	if (!Array.isArray(skills)) return [];
	return skills
		.map((skill) => {
			if (typeof skill === "string") return skill;
			if (skill && typeof skill === "object") {
				return skill.name || "";
			}
			return "";
		})
		.filter(Boolean);
}

/**
 * Mở rộng skills với synonyms
 * @param {Array<string>} skills - Danh sách skills
 * @returns {Array<string>} - Skills đã expand với synonyms
 */
function expandSkillsWithSynonyms(skills) {
	const normalizedSkills = normalizeSkillNames(skills);
	const expanded = new Set(normalizedSkills.map((s) => s.toLowerCase().trim()));

	normalizedSkills.forEach((skill) => {
		const normalized = skill.toLowerCase().trim();
		// Check if this skill has synonyms
		for (const [key, synonyms] of Object.entries(skillSynonyms)) {
			if (normalized === key || synonyms.includes(normalized)) {
				// Add base skill and all synonyms
				expanded.add(key);
				synonyms.forEach((syn) => expanded.add(syn));
			}
		}
	});

	return Array.from(expanded);
}

/**
 * Tính cosine similarity giữa 2 arrays của skills
 * @param {Array<string>} taskSkills - Kỹ năng task yêu cầu
 * @param {Array<string>} userSkills - Kỹ năng user có
 * @returns {number} - Score từ 0 đến 1 (1 = match hoàn toàn)
 */
function calculateSkillMatch(taskSkills, userSkills) {
	const taskSkillNames = normalizeSkillNames(taskSkills);
	const userSkillNames = normalizeSkillNames(userSkills);

	if (!taskSkillNames || taskSkillNames.length === 0) {
		return 1; // Không yêu cầu skill => ai cũng match
	}

	if (!userSkillNames || userSkillNames.length === 0) {
		return 0; // User không có skill nào
	}

	// Expand skills with synonyms để match tốt hơn
	// VD: "React" trong task sẽ match với "ReactJS" trong user skills
	const expandedTaskSkills = expandSkillsWithSynonyms(taskSkillNames);
	const expandedUserSkills = expandSkillsWithSynonyms(userSkillNames);

	// Tạo vector cho task skills và user skills
	const allSkills = [
		...new Set([...expandedTaskSkills, ...expandedUserSkills]),
	];
	const taskVector = allSkills.map((skill) =>
		expandedTaskSkills.includes(skill) ? 1 : 0
	);
	const userVector = allSkills.map((skill) =>
		expandedUserSkills.includes(skill) ? 1 : 0
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
 * cost = W_deadline*deadline_factor + W_priority*priority_factor +
 *        W_difficulty*difficulty_factor + W_workload*workload_penalty -
 *        W_speed*speed_score
 *
 * Cost càng nhỏ càng tốt:
 * - Priority cao (5=Critical) => cost cao => ưu tiên assign trước
 * - Difficulty cao (4=Hard) => cost cao => cần người giỏi
 * - Deadline gần => cost cao => ưu tiên làm trước
 * - Workload cao => cost cao => tránh overload
 * - Speed cao => giảm cost => người làm nhanh được ưu tiên
 *
 * @param {Object} task - Task object
 * @param {Object} user - User object
 * @param {Object} config - Configuration weights
 * @returns {number} - Cost score (càng nhỏ càng tốt cho MCMF)
 */
function calculateAssignmentCost(task, user, config = {}) {
	// Weights mặc định (có thể override)
	const W_deadline = config.W_deadline || 0.3;
	const W_priority = config.W_priority || 0.3;
	const W_difficulty = config.W_difficulty || 0.2;
	const W_speed = config.W_speed || 0.15;
	const W_workload = config.W_workload || 0.05;

	// Giá trị max cho chuẩn hóa
	const MAX_PRIORITY = 5; // Priority: 1-5
	const MAX_DIFFICULTY = 4; // Difficulty: 1-4
	const MAX_TASK_COUNT = config.MAX_TASK_COUNT || 10;

	// Tính các yếu tố (normalized 0-1)
	const priority_factor = (task.priority || 3) / MAX_PRIORITY; // 0-1
	const difficulty_factor = (task.difficulty || 2) / MAX_DIFFICULTY; // 0-1
	const speed_score = user.productivity_score || 0.8; // 0-1
	const hours_until_deadline = calculateHoursUntilDeadline(task.due_date);
	// Normalize deadline: tasks due soon (< 24h) get high factor, far away get low
	const deadline_factor = Math.min(1.0, 168 / hours_until_deadline); // 0-1 (168h = 1 week)
	const workload_penalty = Math.min(
		1.0,
		(user.current_task_count || 0) / MAX_TASK_COUNT
	); // 0-1

	// Tính cost (số nhỏ = tốt)
	// Tasks với priority cao, deadline gần, difficulty cao sẽ có cost cao
	// => được MCMF chọn trước (vì nó minimize total cost)
	// Users với speed cao sẽ giảm cost => được ưu tiên
	const cost =
		W_deadline * deadline_factor +
		W_priority * priority_factor +
		W_difficulty * difficulty_factor +
		W_workload * workload_penalty -
		W_speed * speed_score;

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
	// Mọi user đều có thể được assign vào task, MCMF sẽ chọn user tốt nhất dựa trên cost
	tasks.forEach((task) => {
		users.forEach((user) => {
			const cost = costMatrix[task._id.toString()][user._id.toString()];
			graph.edges.push({
				from: user._id.toString(),
				to: task._id.toString(),
				capacity: 1,
				cost: cost,
			});
		});
	});

	// Add edges: Tasks -> Sink
	// Capacity = 1 nếu can_parallelize = false (chỉ 1 người)
	// Capacity = 3 nếu can_parallelize = true (tối đa 3 người cùng làm)
	tasks.forEach((task) => {
		const capacity = task.can_parallelize ? 3 : 1;
		graph.edges.push({
			from: task._id.toString(),
			to: SINK,
			capacity: capacity,
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
