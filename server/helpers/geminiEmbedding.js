/**
 * Google Gemini Embedding Integration for Skill Matching
 *
 * Installation: npm install @google/generative-ai
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Get embedding using Gemini API
 * @param {string} text - Text to embed
 * @returns {Promise<Array<number>>} - Embedding vector
 */
async function getGeminiEmbedding(text) {
	try {
		const model = genAI.getGenerativeModel({ model: "embedding-001" });
		const result = await model.embedContent(text);
		return result.embedding.values;
	} catch (error) {
		console.error("Gemini embedding error:", error);
		throw error;
	}
}

/**
 * Calculate semantic skill match using Gemini embeddings
 * @param {Array<string>} taskSkills - Required skills
 * @param {Array<string>} userSkills - User's skills
 * @returns {Promise<number>} - Similarity score 0-1
 */
async function calculateSemanticSkillMatchGemini(taskSkills, userSkills) {
	if (!taskSkills || taskSkills.length === 0) return 1;
	if (!userSkills || userSkills.length === 0) return 0;

	try {
		// Combine skills into text
		const taskText = taskSkills.join(", ");
		const userText = userSkills.join(", ");

		// Get embeddings
		const [taskEmbedding, userEmbedding] = await Promise.all([
			getGeminiEmbedding(taskText),
			getGeminiEmbedding(userText),
		]);

		// Calculate cosine similarity
		return cosineSimilarity(taskEmbedding, userEmbedding);
	} catch (error) {
		console.error("Semantic matching error:", error);
		// Fallback to basic matching if API fails
		return 0.5;
	}
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
	const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
	const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
	const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
	return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Cache for embeddings to reduce API calls
 */
const embeddingCache = new Map();

async function getCachedGeminiEmbedding(text) {
	if (embeddingCache.has(text)) {
		return embeddingCache.get(text);
	}

	const embedding = await getGeminiEmbedding(text);
	embeddingCache.set(text, embedding);

	// Clear cache after 1 hour
	setTimeout(() => embeddingCache.delete(text), 3600000);

	return embedding;
}

module.exports = {
	getGeminiEmbedding,
	calculateSemanticSkillMatchGemini,
	getCachedGeminiEmbedding,
};
