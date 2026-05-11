/**
 * Migration Script
 * Update existing Tasks và Users với các trường mới
 */

const mongoose = require("mongoose");
const Task = require("../models/task.model");
const User = require("../models/user.model");
require("dotenv").config();

/**
 * Migrate existing tasks
 */
async function migrateTasks() {
	console.log("Migrating tasks...");

	try {
		// Update all tasks với default values
		const result = await Task.updateMany(
			{
				// Chỉ update tasks chưa có các trường mới
				$or: [
					{ total_hours: { $exists: false } },
					{ priority: { $exists: false } },
					{ skills_required: { $exists: false } },
					{ can_parallelize: { $exists: false } },
					{ number_of_people_needed: { $exists: false } },
				],
			},
			{
				$set: {
					total_hours: 8,
					priority: 3,
					skills_required: [],
					can_parallelize: true,
					number_of_people_needed: 1,
				},
			}
		);

		console.log(`✓ Updated ${result.modifiedCount} tasks`);
		return result;
	} catch (error) {
		console.error("Error migrating tasks:", error);
		throw error;
	}
}

/**
 * Migrate existing users
 */
async function migrateUsers() {
	console.log("Migrating users...");

	try {
		// Update all users với default values
		const result = await User.updateMany(
			{
				// Chỉ update users chưa có các trường mới
				$or: [
					{ skills: { $exists: false } },
					{ productivity_score: { $exists: false } },
					{ on_time_rate: { $exists: false } },
					{ current_task_count: { $exists: false } },
				],
			},
			{
				$set: {
					skills: [],
					productivity_score: 0.8,
					on_time_rate: 85,
					current_task_count: 0,
				},
			}
		);

		console.log(`✓ Updated ${result.modifiedCount} users`);
		return result;
	} catch (error) {
		console.error("Error migrating users:", error);
		throw error;
	}
}

/**
 * Calculate current task count cho users
 * Dựa vào tasks hiện có trong DB
 */
async function calculateCurrentTaskCount() {
	console.log("Calculating current task count for users...");

	try {
		const users = await User.find();

		for (const user of users) {
			// Đếm số tasks đang assigned cho user và chưa completed
			const taskCount = await Task.countDocuments({
				assigned_to: user._id,
				status: { $ne: "completed" },
			});

			await User.findByIdAndUpdate(user._id, {
				current_task_count: taskCount,
			});

			console.log(`  User ${user.name}: ${taskCount} tasks`);
		}

		console.log(`✓ Calculated task count for ${users.length} users`);
	} catch (error) {
		console.error("Error calculating task count:", error);
		throw error;
	}
}

/**
 * Smart migration: Tự động assign skills dựa vào tasks đã làm
 */
async function inferUserSkillsFromTasks() {
	console.log("Inferring user skills from completed tasks...");

	try {
		const users = await User.find();

		for (const user of users) {
			// Lấy tất cả tasks user đã làm
			const tasks = await Task.find({
				assigned_to: user._id,
			});

			// Collect all skills từ các tasks
			const skills = new Set();
			tasks.forEach((task) => {
				if (task.skills_required && Array.isArray(task.skills_required)) {
					task.skills_required.forEach((skill) => skills.add(skill));
				}
			});

			// Update user skills nếu chưa có
			if (!user.skills || user.skills.length === 0) {
				await User.findByIdAndUpdate(user._id, {
					skills: Array.from(skills),
				});
				console.log(`  User ${user.name}: inferred ${skills.size} skills`);
			}
		}

		console.log("✓ Skill inference completed");
	} catch (error) {
		console.error("Error inferring skills:", error);
		throw error;
	}
}

/**
 * Main migration function
 */
async function runMigration() {
	try {
		console.log("\n=== Starting Migration ===\n");

		// Connect to MongoDB
		const MONGODB_URI =
			process.env.MONGODB_URI || "mongodb://localhost:27017/cpm";
		await mongoose.connect(MONGODB_URI);
		console.log("✓ Connected to MongoDB\n");

		// Run migrations
		await migrateTasks();
		await migrateUsers();
		await calculateCurrentTaskCount();
		await inferUserSkillsFromTasks();

		console.log("\n=== Migration Completed Successfully ===\n");
	} catch (error) {
		console.error("\n=== Migration Failed ===");
		console.error(error);
	} finally {
		await mongoose.disconnect();
		console.log("Disconnected from MongoDB");
	}
}

/**
 * Rollback migration (optional)
 */
async function rollbackMigration() {
	try {
		console.log("\n=== Rolling Back Migration ===\n");

		const MONGODB_URI =
			process.env.MONGODB_URI || "mongodb://localhost:27017/cpm";
		await mongoose.connect(MONGODB_URI);

		// Remove new fields from tasks
		await Task.updateMany(
			{},
			{
				$unset: {
					total_hours: "",
					priority: "",
					skills_required: "",
					can_parallelize: "",
					number_of_people_needed: "",
				},
			}
		);

		// Remove new fields from users
		await User.updateMany(
			{},
			{
				$unset: {
					skills: "",
					productivity_score: "",
					on_time_rate: "",
					current_task_count: "",
				},
			}
		);

		console.log("✓ Rollback completed\n");
	} catch (error) {
		console.error("Rollback failed:", error);
	} finally {
		await mongoose.disconnect();
	}
}

// Export functions
module.exports = {
	runMigration,
	rollbackMigration,
	migrateTasks,
	migrateUsers,
	calculateCurrentTaskCount,
	inferUserSkillsFromTasks,
};

// Run migration if called directly
if (require.main === module) {
	const command = process.argv[2];

	if (command === "rollback") {
		rollbackMigration();
	} else {
		runMigration();
	}
}
