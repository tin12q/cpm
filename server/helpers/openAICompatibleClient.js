function trimTrailingSlash(value = "") {
	return String(value || "").replace(/\/+$/, "");
}

function getOpenAICompatibleConfig() {
	const apiKey =
		process.env.OPENAI_COMPATIBLE_API_KEY ||
		process.env.OPENAI_API_KEY ||
		process.env.CLAUDE_SONNET_4_6_API_KEY ||
		process.env.claude_sonnet_4_6_api_key ||
		process.env.LLM_API_KEY ||
		process.env.llm_api_key ||
		"";
	const usesClaudeAlias = Boolean(
		process.env.CLAUDE_SONNET_4_6_API_KEY || process.env.claude_sonnet_4_6_api_key
	);

	return {
		baseUrl: trimTrailingSlash(
			process.env.OPENAI_COMPATIBLE_BASE_URL ||
				process.env.OPENAI_BASE_URL ||
				process.env.LLM_BASE_URL ||
				process.env.llm_base_url ||
				"https://api.openai.com/v1"
		),
		apiKey,
		chatModel:
			process.env.OPENAI_COMPATIBLE_CHAT_MODEL ||
			process.env.OPENAI_MODEL ||
			process.env.LLM_MODEL ||
			process.env.llm_model ||
			process.env.CLAUDE_SONNET_4_6_MODEL ||
			process.env.claude_sonnet_4_6_model ||
			(usesClaudeAlias ? "claude-sonnet-4-6" : "gpt-4.1-mini"),
		embeddingModel:
			process.env.OPENAI_COMPATIBLE_EMBEDDING_MODEL ||
			process.env.OPENAI_EMBEDDING_MODEL ||
			process.env.LLM_EMBEDDING_MODEL ||
			process.env.llm_embedding_model ||
			"text-embedding-3-small",
	};
}

function isOpenAICompatibleConfigured() {
	return Boolean(getOpenAICompatibleConfig().apiKey);
}

async function postOpenAICompatible(path, body) {
	const config = getOpenAICompatibleConfig();
	if (!config.apiKey) {
		throw new Error("OpenAI-compatible API key is not configured");
	}

	const response = await fetch(`${config.baseUrl}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify(body),
	});

	const text = await response.text();
	let data = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch (_) {
		data = { raw: text };
	}

	if (!response.ok) {
		const message = data?.error?.message || data?.message || text || response.statusText;
		throw new Error(`OpenAI-compatible request failed (${response.status}): ${message}`);
	}

	return data;
}

async function chatCompletion({
	messages,
	model,
	temperature = 0.25,
	maxOutputTokens = 900,
	responseFormat,
}) {
	const config = getOpenAICompatibleConfig();
	const body = {
		model: model || config.chatModel,
		messages,
		temperature,
		max_tokens: maxOutputTokens,
	};

	if (responseFormat) {
		body.response_format = responseFormat;
	}

	const data = await postOpenAICompatible("/chat/completions", body);
	return data?.choices?.[0]?.message?.content || "";
}

async function generateContent(prompt, options = {}) {
	return chatCompletion({
		messages: [{ role: "user", content: prompt }],
		...options,
	});
}

async function embedText(text, model) {
	const config = getOpenAICompatibleConfig();
	const data = await postOpenAICompatible("/embeddings", {
		model: model || config.embeddingModel,
		input: text,
	});
	return data?.data?.[0]?.embedding || null;
}

module.exports = {
	getOpenAICompatibleConfig,
	isOpenAICompatibleConfigured,
	chatCompletion,
	generateContent,
	embedText,
};
