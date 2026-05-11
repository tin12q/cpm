/**
 * Example Usage và Test Cases cho Task Assignment System
 */

// ===== EXAMPLE DATA =====

const exampleTasks = [
	{
		title: "Implement User Authentication",
		description: "Create login and register functionality",
		due_date: Date.now() + 24 * 60 * 60 * 1000, // 1 day from now
		status: "pending",
		project: "project_id_123",
		total_hours: 16,
		priority: 5, // Rất quan trọng
		skills_required: ["Node.js", "JWT", "MongoDB"],
		can_parallelize: true,
		number_of_people_needed: 2,
	},
	{
		title: "Design Admin Dashboard",
		description: "Create wireframes and mockups",
		due_date: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
		status: "pending",
		project: "project_id_123",
		total_hours: 12,
		priority: 3, // Trung bình
		skills_required: ["UI/UX", "Figma"],
		can_parallelize: false,
		number_of_people_needed: 1,
	},
	{
		title: "Write Unit Tests",
		description: "Write tests for all controllers",
		due_date: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days
		status: "pending",
		project: "project_id_123",
		total_hours: 8,
		priority: 4, // Cao
		skills_required: ["Jest", "Node.js"],
		can_parallelize: true,
		number_of_people_needed: 2,
	},
	{
		title: "Deploy to Production",
		description: "Setup CI/CD and deploy",
		due_date: Date.now() + 2 * 60 * 60 * 1000, // 2 hours (URGENT!)
		status: "pending",
		project: "project_id_123",
		total_hours: 4,
		priority: 5, // Rất quan trọng + gần deadline
		skills_required: ["Docker", "AWS", "CI/CD"],
		can_parallelize: false,
		number_of_people_needed: 1,
	},
];

const exampleUsers = [
	{
		name: "Nguyen Van A",
		email: "a@example.com",
		role: "developer",
		skills: ["Node.js", "React", "MongoDB", "JWT"],
		productivity_score: 0.9, // Rất giỏi
		on_time_rate: 95,
		current_task_count: 1, // Đang làm 1 task
	},
	{
		name: "Tran Thi B",
		email: "b@example.com",
		role: "developer",
		skills: ["Node.js", "Jest", "Docker", "AWS"],
		productivity_score: 0.85,
		on_time_rate: 90,
		current_task_count: 0, // Rảnh
	},
	{
		name: "Le Van C",
		email: "c@example.com",
		role: "designer",
		skills: ["UI/UX", "Figma", "Photoshop"],
		productivity_score: 0.8,
		on_time_rate: 88,
		current_task_count: 2, // Bận
	},
	{
		name: "Pham Thi D",
		email: "d@example.com",
		role: "devops",
		skills: ["Docker", "AWS", "CI/CD", "Kubernetes"],
		productivity_score: 0.95, // Expert
		on_time_rate: 98,
		current_task_count: 0, // Rảnh
	},
	{
		name: "Hoang Van E",
		email: "e@example.com",
		role: "developer",
		skills: ["Node.js", "MongoDB", "Jest", "React"],
		productivity_score: 0.75,
		on_time_rate: 85,
		current_task_count: 1,
	},
];

// ===== TEST SCENARIOS =====

/**
 * Scenario 1: Preview Assignment với config mặc định
 */
async function testScenario1() {
	console.log("=== SCENARIO 1: Preview Assignment ===\n");

	const response = await fetch(
		"http://localhost:5000/api/assignments/preview",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				task_ids: ["task1_id", "task2_id", "task3_id", "task4_id"],
			}),
		}
	);

	const result = await response.json();
	console.log(JSON.stringify(result, null, 2));

	// Expected Output:
	// - Task "Deploy to Production" (deadline 2 giờ) → User D (DevOps expert)
	// - Task "Implement Authentication" (priority 5, deadline 1 ngày) → User A + User B
	// - Task "Write Unit Tests" (priority 4, deadline 3 ngày) → User B + User E
	// - Task "Design Dashboard" (priority 3, deadline 7 ngày) → User C
}

/**
 * Scenario 2: Apply Assignment với custom weights
 * Ưu tiên skill matching cao hơn
 */
async function testScenario2() {
	console.log("\n=== SCENARIO 2: Apply với custom weights ===\n");

	const response = await fetch("http://localhost:5000/api/assignments/apply", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			task_ids: ["task1_id", "task2_id"],
			config: {
				W_deadline: 0.3,
				W_priority: 0.2,
				W_speed: 0.2,
				W_skill: 0.3, // Tăng skill weight
				W_workload: 0.0,
			},
		}),
	});

	const result = await response.json();
	console.log(JSON.stringify(result, null, 2));
}

/**
 * Scenario 3: Override Assignment
 * PM muốn thay đổi người làm task
 */
async function testScenario3() {
	console.log("\n=== SCENARIO 3: Override Assignment ===\n");

	const response = await fetch(
		"http://localhost:5000/api/assignments/task1_id/override",
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				user_ids: ["user_c_id", "user_e_id"],
			}),
		}
	);

	const result = await response.json();
	console.log(JSON.stringify(result, null, 2));
}

/**
 * Scenario 4: Reassign toàn bộ project
 * Khi thay đổi priority hoặc deadline
 */
async function testScenario4() {
	console.log("\n=== SCENARIO 4: Reassign Project ===\n");

	const response = await fetch(
		"http://localhost:5000/api/assignments/reassign-project/project_id_123",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				config: {
					W_deadline: 0.6, // Tăng ưu tiên deadline
					W_priority: 0.25,
				},
			}),
		}
	);

	const result = await response.json();
	console.log(JSON.stringify(result, null, 2));
}

// ===== MANUAL TESTING GUIDE =====

/**
 * STEP 1: Seed Database với example data
 */
const seedDatabase = async () => {
	console.log("=== Seeding Database ===\n");

	// 1. Create users
	for (const user of exampleUsers) {
		const response = await fetch("http://localhost:5000/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(user),
		});
		const result = await response.json();
		console.log(`Created user: ${user.name} - ID: ${result._id}`);
	}

	// 2. Create tasks
	for (const task of exampleTasks) {
		const response = await fetch("http://localhost:5000/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(task),
		});
		const result = await response.json();
		console.log(`Created task: ${task.title} - ID: ${result._id}`);
	}
};

// ===== CURL EXAMPLES =====

const curlExamples = `
# 1. Get default config
curl -X GET http://localhost:5000/api/assignments/default-config

# 2. Preview assignment
curl -X POST http://localhost:5000/api/assignments/preview \\
  -H "Content-Type: application/json" \\
  -d '{
    "task_ids": ["673a1234567890abcdef", "673a9876543210fedcba"],
    "user_ids": ["673b1111111111111111", "673b2222222222222222"]
  }'

# 3. Apply assignment
curl -X POST http://localhost:5000/api/assignments/apply \\
  -H "Content-Type: application/json" \\
  -d '{
    "task_ids": ["673a1234567890abcdef"],
    "config": {
      "W_deadline": 0.6,
      "W_priority": 0.3
    }
  }'

# 4. Override assignment
curl -X PUT http://localhost:5000/api/assignments/673a1234567890abcdef/override \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_ids": ["673b3333333333333333"]
  }'

# 5. Reassign project
curl -X POST http://localhost:5000/api/assignments/reassign-project/673a9999999999999999 \\
  -H "Content-Type: application/json" \\
  -d '{
    "config": {
      "W_deadline": 0.7
    }
  }'
`;

// ===== EXPECTED RESULTS ANALYSIS =====

const expectedResults = `
EXPECTED ASSIGNMENT LOGIC:

Task: "Deploy to Production"
- Deadline: 2 hours (URGENT!)
- Priority: 5
- Skills: Docker, AWS, CI/CD
- Best Match: User D (Pham Thi D)
  * Skills: Perfect match (Docker, AWS, CI/CD, Kubernetes)
  * Productivity: 0.95 (highest)
  * Current tasks: 0 (available)
  * On-time rate: 98%
  
Task: "Implement User Authentication"
- Deadline: 1 day
- Priority: 5
- Skills: Node.js, JWT, MongoDB
- Needs: 2 people
- Best Matches: User A + User B
  * User A: Skills match (Node.js, JWT, MongoDB), productivity 0.9
  * User B: Skills match (Node.js), productivity 0.85, available
  
Task: "Write Unit Tests"
- Deadline: 3 days
- Priority: 4
- Skills: Jest, Node.js
- Needs: 2 people
- Best Matches: User B + User E
  * Both have Node.js and Jest skills
  
Task: "Design Admin Dashboard"
- Deadline: 7 days
- Priority: 3
- Skills: UI/UX, Figma
- Needs: 1 person
- Best Match: User C (Le Van C)
  * Perfect skill match (UI/UX, Figma, Photoshop)
  * Only designer in the team
`;

// ===== EXPORT FOR TESTING =====

module.exports = {
	exampleTasks,
	exampleUsers,
	testScenario1,
	testScenario2,
	testScenario3,
	testScenario4,
	seedDatabase,
	curlExamples,
	expectedResults,
};

// Run example
if (require.main === module) {
	console.log("=== Task Assignment System - Test Examples ===\n");
	console.log("Example Data:");
	console.log("- Tasks:", exampleTasks.length);
	console.log("- Users:", exampleUsers.length);
	console.log("\nCURL Examples:");
	console.log(curlExamples);
	console.log("\nExpected Results:");
	console.log(expectedResults);
}
