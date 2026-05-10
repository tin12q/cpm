/**
 * Enhanced Skill Matching with Hybrid Embeddings
 *
 * Phương pháp: PhoBERT (local) + TF-IDF + Exact Match
 * Fallback: Gemini API nếu PhoBERT service không available
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
	// PhoBERT service URL (local)
	phobertServiceUrl:
		process.env.PHOBERT_SERVICE_URL || "http://localhost:5001",

	// Gemini API (fallback)
	geminiApiKey: process.env.GEMINI_API_KEY,

	// Hybrid weights
	weights: {
		exactMatch: 0.4, // Must-have skills
		phobertScore: 0.35, // Semantic understanding
		tfidfScore: 0.25, // Keyword importance
	},

	// Cache settings
	cacheTimeout: 3600000, // 1 hour

	// Service availability check
	usePhoBERT: true,
	useTFIDF: true,
};

function normalizeSkillEntry(skill) {
	if (typeof skill === "string") return skill.trim();
	if (skill && typeof skill === "object") {
		const name = (skill.name || "").trim();
		const description = (skill.description || "").trim();
		const combined = [name, description].filter(Boolean).join(" - ");
		return combined || name;
	}
	return "";
}

function normalizeSkillList(skills) {
	if (!Array.isArray(skills)) return [];
	return skills
		.map(normalizeSkillEntry)
		.map((s) => s.trim())
		.filter(Boolean);
}

function normalizeSkillNames(skills) {
	if (!Array.isArray(skills)) return [];
	return skills
		.map((skill) => {
			if (typeof skill === "string") return skill.trim();
			if (skill && typeof skill === "object") return (skill.name || "").trim();
			return "";
		})
		.filter(Boolean);
}

// ============================================================================
// TF-IDF IMPLEMENTATION
// ============================================================================

class TFIDFCalculator {
	constructor() {
		this.vocabulary = new Map(); // word -> document frequency
		this.documentCount = 0;
		this.documents = []; // Store all skill sets for IDF calculation
	}

	/**
	 * Build vocabulary from all skills in the system
	 */
	buildVocabulary(allSkillSets) {
		this.documents = allSkillSets;
		this.documentCount = allSkillSets.length;
		this.vocabulary.clear();

		// Count document frequency for each term
		allSkillSets.forEach((skills) => {
			const normalizedSkills = normalizeSkillList(skills);
			const uniqueSkills = new Set(
				normalizedSkills.map((s) => s.toLowerCase().trim())
			);
			uniqueSkills.forEach((skill) => {
				this.vocabulary.set(skill, (this.vocabulary.get(skill) || 0) + 1);
			});
		});
	}

	/**
	 * Calculate TF (Term Frequency) for a skill in a skill set
	 */
	calculateTF(skill, skillSet) {
		const normalizedSkill = skill.toLowerCase().trim();
		const count = skillSet.filter(
			(s) => s.toLowerCase().trim() === normalizedSkill
		).length;
		return count / Math.max(skillSet.length, 1);
	}

	/**
	 * Calculate IDF (Inverse Document Frequency)
	 */
	calculateIDF(skill) {
		const normalizedSkill = skill.toLowerCase().trim();
		const docFreq = this.vocabulary.get(normalizedSkill) || 0;

		if (docFreq === 0) {
			// Skill not in vocabulary - rare skill, high importance
			return Math.log(this.documentCount + 1);
		}

		return Math.log((this.documentCount + 1) / (docFreq + 1));
	}

	/**
	 * Calculate TF-IDF vector for a skill set
	 */
	calculateTFIDFVector(skillSet) {

		const vector = new Map();
		const normalizedSkillSet = normalizeSkillList(skillSet);

		normalizedSkillSet.forEach((skill) => {
			const normalizedSkill = skill.toLowerCase().trim();
			const tf = this.calculateTF(skill, normalizedSkillSet);
			const idf = this.calculateIDF(skill);

			vector.set(normalizedSkill, tf * idf);
		});

		return vector;
	}

	/**
	 * Calculate TF-IDF similarity score (dot product)
	 */
	calculateSimilarity(taskSkills, userSkills) {
		const normalizedTaskSkills = normalizeSkillList(taskSkills);
		const normalizedUserSkills = normalizeSkillList(userSkills);

		if (!normalizedTaskSkills || normalizedTaskSkills.length === 0) return 0;
		if (!normalizedUserSkills || normalizedUserSkills.length === 0) return 0;

		const taskVector = this.calculateTFIDFVector(normalizedTaskSkills);
		const userVector = this.calculateTFIDFVector(normalizedUserSkills);

		// Calculate dot product
		let dotProduct = 0;
		taskVector.forEach((taskValue, skill) => {
			if (userVector.has(skill)) {
				dotProduct += taskValue * userVector.get(skill);
			}
		});

		// Normalize by vector magnitudes
		const taskMagnitude = Math.sqrt(
			Array.from(taskVector.values()).reduce((sum, v) => sum + v * v, 0)
		);
		const userMagnitude = Math.sqrt(
			Array.from(userVector.values()).reduce((sum, v) => sum + v * v, 0)
		);

		if (taskMagnitude === 0 || userMagnitude === 0) return 0;

		return dotProduct / (taskMagnitude * userMagnitude);
	}
}

// Global TF-IDF calculator instance
const tfidfCalculator = new TFIDFCalculator();

// ============================================================================
// PHOBERT EMBEDDING SERVICE (LOCAL)
// ============================================================================

let phobertAvailable = false;

/**
 * Check if PhoBERT service is available
 */
async function checkPhoBERTService() {
	try {
		const response = await fetch(`${CONFIG.phobertServiceUrl}/health`, {
			method: "GET",
			signal: AbortSignal.timeout(2000),
		});
		const data = await response.json();
		phobertAvailable = data.status === "ok" && data.ready;
		return phobertAvailable;
	} catch (error) {
		phobertAvailable = false;
		return false;
	}
}

/**
 * Get PhoBERT embedding from local service
 */
async function getPhoBERTEmbedding(text) {
	if (!text || !text.trim()) {
		throw new Error("Empty text provided");
	}

	try {
		const response = await fetch(`${CONFIG.phobertServiceUrl}/embed`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text }),
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			throw new Error(`PhoBERT service error: ${response.status}`);
		}

		const data = await response.json();
		return data.embedding;
	} catch (error) {
		console.error("PhoBERT embedding error:", error.message);
		throw error;
	}
}

/**
 * Calculate PhoBERT similarity using dot product (vectors are normalized)
 */
async function calculatePhoBERTSimilarity(taskSkills, userSkills) {
	const taskTokens = normalizeSkillList(taskSkills);
	const userTokens = normalizeSkillList(userSkills);

	if (!taskTokens || taskTokens.length === 0) return 0;
	if (!userTokens || userTokens.length === 0) return 0;

	const taskText = taskTokens.join(", ");
	const userText = userTokens.join(", ");

	try {
		const response = await fetch(`${CONFIG.phobertServiceUrl}/similarity`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text1: taskText, text2: userText }),
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			throw new Error(`PhoBERT similarity error: ${response.status}`);
		}

		const data = await response.json();
		return data.similarity; // Dot product of normalized vectors
	} catch (error) {
		console.error("PhoBERT similarity error:", error.message);
		throw error;
	}
}

// ============================================================================
// GEMINI EMBEDDING (FALLBACK)
// ============================================================================

let geminiClient = null;

/**
 * Initialize Gemini client
 */
function initGeminiClient() {
	if (!CONFIG.geminiApiKey) {
		return false;
	}

	if (!geminiClient) {
		geminiClient = new GoogleGenerativeAI(CONFIG.geminiApiKey);
	}
	return true;
}

/**
 * Get Gemini embedding
 */
async function getGeminiEmbedding(text) {
	if (!initGeminiClient()) {
		throw new Error("Gemini API key not configured");
	}

	try {
		const model = geminiClient.getGenerativeModel({ model: "embedding-001" });
		const result = await model.embedContent(text);
		return result.embedding.values;
	} catch (error) {
		console.error("Gemini embedding error:", error.message);
		throw error;
	}
}

/**
 * Calculate dot product between two vectors
 */
function dotProduct(vecA, vecB) {
	if (vecA.length !== vecB.length) {
		throw new Error("Vectors must have same dimension");
	}
	return vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
}

/**
 * Normalize vector
 */
function normalizeVector(vec) {
	const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
	return magnitude === 0 ? vec : vec.map((v) => v / magnitude);
}

/**
 * Calculate Gemini similarity
 */
async function calculateGeminiSimilarity(taskSkills, userSkills) {
	const taskTokens = normalizeSkillList(taskSkills);
	const userTokens = normalizeSkillList(userSkills);

	if (!taskTokens || taskTokens.length === 0) return 0;
	if (!userTokens || userTokens.length === 0) return 0;

	const taskText = taskTokens.join(", ");
	const userText = userTokens.join(", ");

	const [taskEmb, userEmb] = await Promise.all([
		getGeminiEmbedding(taskText),
		getGeminiEmbedding(userText),
	]);

	// Normalize and calculate dot product
	const taskNorm = normalizeVector(taskEmb);
	const userNorm = normalizeVector(userEmb);

	return dotProduct(taskNorm, userNorm);
}

// ============================================================================
// EXACT MATCH (COSINE SIMILARITY)
// ============================================================================

/**
 * Calculate exact skill match using cosine similarity
 * This is the baseline method
 */
function calculateExactSkillMatch(taskSkills, userSkills) {
	const taskSkillNames = normalizeSkillNames(taskSkills);
	const userSkillNames = normalizeSkillNames(userSkills);

	if (!taskSkillNames || taskSkillNames.length === 0) return 1;
	if (!userSkillNames || userSkillNames.length === 0) return 0;

	const taskSet = new Set(taskSkillNames.map((s) => s.toLowerCase().trim()));
	const userSet = new Set(userSkillNames.map((s) => s.toLowerCase().trim()));

	// Calculate intersection
	const intersection = new Set([...taskSet].filter((x) => userSet.has(x)));

	// Cosine similarity = |intersection| / sqrt(|A| * |B|)
	return intersection.size / Math.sqrt(taskSet.size * userSet.size);
}

// ============================================================================
// HYBRID SCORING
// ============================================================================

/**
 * Advanced Hybrid Skill Matching
 * Combines: Exact Match + PhoBERT Embedding + TF-IDF
 * Falls back to Gemini if PhoBERT unavailable
 */
async function calculateAdvancedHybridSkillMatch(
	taskSkills,
	userSkills,
	options = {}
) {
	const normalizedTaskSkills = normalizeSkillList(taskSkills);
	const normalizedUserSkills = normalizeSkillList(userSkills);
	const taskTextParts = [
		options.taskTitle,
		...normalizedTaskSkills,
		options.taskDescription,
	]
		.filter(Boolean)
		.map((t) => t.trim());
	const userTextParts = normalizedUserSkills;

	if (!normalizedTaskSkills || normalizedTaskSkills.length === 0) return 1;
	if (!normalizedUserSkills || normalizedUserSkills.length === 0) return 0;

	const weights = { ...(options.weights || CONFIG.weights) };
	const scores = {
		exact: 0,
		embedding: 0,
		tfidf: 0,
	};

	// 1. Exact Match (Always calculate)
	scores.exact = calculateExactSkillMatch(
		normalizedTaskSkills,
		normalizedUserSkills
	);

	// 2. Embedding Score (PhoBERT or Gemini fallback)
	try {
		if (options.disableExternalEmbedding) {
			weights.exactMatch += weights.phobertScore;
			weights.phobertScore = 0;
		} else if (CONFIG.usePhoBERT && phobertAvailable) {
			scores.embedding = await calculatePhoBERTSimilarity(
				taskTextParts,
				userTextParts
			);
		} else if (CONFIG.geminiApiKey) {
			console.log("PhoBERT unavailable, using Gemini fallback");
			scores.embedding = await calculateGeminiSimilarity(
				taskTextParts,
				userTextParts
			);
		} else {
			// No embedding available, increase exact match weight
			weights.exactMatch += weights.phobertScore;
			weights.phobertScore = 0;
		}
	} catch (error) {
		console.error("Embedding calculation failed:", error.message);
		// Fallback: increase exact match weight
		weights.exactMatch += weights.phobertScore;
		weights.phobertScore = 0;
	}

	// 3. TF-IDF Score
	if (CONFIG.useTFIDF && tfidfCalculator.documentCount > 0) {
		scores.tfidf = tfidfCalculator.calculateSimilarity(
			normalizedTaskSkills,
			normalizedUserSkills
		);
	} else {
		// No TF-IDF available, redistribute weight
		weights.exactMatch += weights.tfidfScore;
		weights.tfidfScore = 0;
	}

	// Calculate final weighted score
	const finalScore =
		weights.exactMatch * scores.exact +
		weights.phobertScore * scores.embedding +
		weights.tfidfScore * scores.tfidf;

	// Return score and breakdown for debugging
	return {
		score: finalScore,
		breakdown: {
			exact: scores.exact,
			embedding: scores.embedding,
			tfidf: scores.tfidf,
			weights: weights,
		},
	};
}

/**
 * Simplified hybrid match (returns only score for backwards compatibility)
 */
async function calculateHybridSkillMatch(
	taskSkills,
	userSkills,
	semanticScore = null
) {
	// Backward compatibility: if semanticScore provided, use old method
	if (semanticScore !== null) {
		const exactMatch = calculateExactSkillMatch(taskSkills, userSkills);
		return 0.6 * exactMatch + 0.4 * semanticScore;
	}

	// Use advanced hybrid method
	const result = await calculateAdvancedHybridSkillMatch(
		taskSkills,
		userSkills
	);
	return result.score;
}

// ============================================================================
// INITIALIZATION & UTILITY FUNCTIONS
// ============================================================================

/**
 * Initialize the embedding system
 * Call this when server starts
 */
async function initializeEmbeddingSystem(allUsers = []) {
	console.log("Initializing embedding system...");

	// 1. Check PhoBERT service availability
	const phobertReady = await checkPhoBERTService();
	if (phobertReady) {
		console.log("✓ PhoBERT service available");
	} else {
		console.log("✗ PhoBERT service unavailable, will use fallback");
	}

	// 2. Build TF-IDF vocabulary from all user skills
	if (allUsers && allUsers.length > 0) {
		const allSkillSets = allUsers
			.map((user) => user.skills || [])
			.filter((skills) => skills.length > 0);

		if (allSkillSets.length > 0) {
			tfidfCalculator.buildVocabulary(allSkillSets);
			console.log(
				`✓ TF-IDF vocabulary built: ${tfidfCalculator.vocabulary.size} unique skills from ${allSkillSets.length} users`
			);
		}
	}

	// 3. Check Gemini availability
	if (CONFIG.geminiApiKey) {
		console.log("✓ Gemini API key configured (fallback available)");
	} else {
		console.log("✗ Gemini API key not configured");
	}

	return {
		phobertAvailable,
		tfidfReady: tfidfCalculator.documentCount > 0,
		geminiAvailable: !!CONFIG.geminiApiKey,
	};
}

/**
 * Update TF-IDF vocabulary when new users are added
 */
function updateTFIDFVocabulary(allUsers) {
	const allSkillSets = allUsers
		.map((user) => user.skills || [])
		.filter((skills) => skills.length > 0);

	if (allSkillSets.length > 0) {
		tfidfCalculator.buildVocabulary(allSkillSets);
		console.log(
			`TF-IDF vocabulary updated: ${tfidfCalculator.vocabulary.size} skills`
		);
	}
}

/**
 * Get system status
 */
async function getEmbeddingSystemStatus() {
	const phobertStatus = await checkPhoBERTService();

	return {
		phobert: {
			available: phobertStatus,
			url: CONFIG.phobertServiceUrl,
		},
		tfidf: {
			ready: tfidfCalculator.documentCount > 0,
			vocabulary_size: tfidfCalculator.vocabulary.size,
			document_count: tfidfCalculator.documentCount,
		},
		gemini: {
			configured: !!CONFIG.geminiApiKey,
			available: !!CONFIG.geminiApiKey,
		},
		weights: CONFIG.weights,
	};
}

/**
 * Configure weights for hybrid scoring
 */
function setHybridWeights(exactMatch, phobertScore, tfidfScore) {
	const total = exactMatch + phobertScore + tfidfScore;

	CONFIG.weights = {
		exactMatch: exactMatch / total,
		phobertScore: phobertScore / total,
		tfidfScore: tfidfScore / total,
	};

	console.log("Hybrid weights updated:", CONFIG.weights);
}

/**
 * Cache embeddings để tránh gọi API nhiều lần
 */
const embeddingCache = new Map();

async function getCachedEmbedding(text, embeddingFunction) {
	if (embeddingCache.has(text)) {
		return embeddingCache.get(text);
	}

	const embedding = await embeddingFunction(text);
	embeddingCache.set(text, embedding);

	// Clear cache after 1 hour
	setTimeout(() => embeddingCache.delete(text), CONFIG.cacheTimeout);

	return embedding;
}

// ============================================================================
// SYNONYM MAPPING (LEGACY SUPPORT)
// ============================================================================
const skillSynonyms = {
	// Programming
	react: ["reactjs", "react.js"],
	vue: ["vuejs", "vue.js"],
	angular: ["angularjs"],
	node: ["nodejs", "node.js"],
	javascript: ["js", "ecmascript"],
	typescript: ["ts"],

	// Frontend
	frontend: ["front-end", "ui", "client-side"],
	backend: ["back-end", "server-side"],

	// Database
	mongodb: ["mongo"],
	postgresql: ["postgres", "psql"],
	mysql: ["sql"],

	// DevOps
	docker: ["containerization"],
	kubernetes: ["k8s"],
	"ci/cd": ["cicd", "continuous integration"],

	// Design
	"ui/ux": ["ui", "ux", "design"],
	figma: ["design tool"],
};

function expandSkillsWithSynonyms(skills) {
	const skillNames = normalizeSkillNames(skills);
	const expanded = new Set(skillNames.map((s) => s.toLowerCase()));

	skillNames.forEach((skill) => {
		const normalized = skill.toLowerCase();
		// Check if this skill has synonyms
		for (const [key, synonyms] of Object.entries(skillSynonyms)) {
			if (normalized === key || synonyms.includes(normalized)) {
				// Add all synonyms
				expanded.add(key);
				synonyms.forEach((syn) => expanded.add(syn));
			}
		}
	});

	return Array.from(expanded);
}

function calculateSkillMatchWithSynonyms(taskSkills, userSkills) {
	const expandedTaskSkills = expandSkillsWithSynonyms(taskSkills);
	const expandedUserSkills = expandSkillsWithSynonyms(userSkills);

	// Now use cosine similarity with expanded skills
	return calculateExactSkillMatch(expandedTaskSkills, expandedUserSkills);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
	// Main scoring functions
	calculateHybridSkillMatch,
	calculateAdvancedHybridSkillMatch,
	calculateExactSkillMatch,

	// Individual scoring methods
	calculatePhoBERTSimilarity,
	calculateGeminiSimilarity,

	// TF-IDF
	TFIDFCalculator,
	tfidfCalculator,

	// Initialization
	initializeEmbeddingSystem,
	updateTFIDFVocabulary,
	getEmbeddingSystemStatus,
	setHybridWeights,

	// Utilities
	getCachedEmbedding,
	checkPhoBERTService,

	// Legacy support
	expandSkillsWithSynonyms,
	calculateSkillMatchWithSynonyms,
	skillSynonyms,

	// Configuration
	CONFIG,
};
