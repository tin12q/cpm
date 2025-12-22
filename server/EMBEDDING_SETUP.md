# Hybrid Embedding System cho Skill Matching

## 📋 Tổng quan

Hệ thống hybrid scoring kết hợp **3 phương pháp**:

1. **PhoBERT Embeddings** (local): Semantic understanding cho tiếng Việt
2. **TF-IDF**: Keyword importance và rare skill detection
3. **Exact Match**: Baseline matching

**Công thức:**

```
Final Score = 40% × Exact Match + 35% × PhoBERT + 25% × TF-IDF
```

**Fallback:** Nếu PhoBERT không available → dùng **Gemini Embeddings API**

---

## 🚀 Setup

### 1. Cài đặt Python Dependencies

```bash
cd server

# Tạo virtual environment (khuyến nghị)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Cài đặt packages
pip install -r requirements.txt
```

**requirements.txt:**

- `transformers==4.36.0` - HuggingFace models
- `torch==2.1.0` - PyTorch
- `flask==3.0.0` - Web server
- `flask-cors==4.0.0` - CORS support
- `numpy==1.24.3` - Numerical operations

**Note:** Download PhoBERT model (~500MB) sẽ tự động khi chạy lần đầu.

### 2. Cài đặt Node.js Dependencies

```bash
npm install @google/generative-ai
# hoặc
bun add @google/generative-ai
```

### 3. Cấu hình Environment Variables

Tạo file `.env` trong thư mục `server`:

```env
# Gemini API Key (fallback, optional nếu dùng PhoBERT)
GEMINI_API_KEY=your_gemini_api_key_here

# PhoBERT Service URL (default: http://localhost:5000)
PHOBERT_SERVICE_URL=http://localhost:5000
```

**Lấy Gemini API Key:**

1. Vào https://makersuite.google.com/app/apikey
2. Tạo API key
3. Copy vào `.env`

### 4. Start PhoBERT Service

**Windows:**

```bash
cd server
start_embedding_service.bat
```

**Linux/Mac:**

```bash
cd server
source venv/bin/activate
python embedding_service.py
```

Service sẽ chạy tại `http://localhost:5000`

**Kiểm tra:**

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
	"status": "ok",
	"model": "PhoBERT",
	"device": "cpu",
	"ready": true
}
```

---

## 📖 Sử dụng

### 1. Khởi tạo hệ thống

```javascript
const {
	initializeEmbeddingSystem,
	calculateAdvancedHybridSkillMatch,
} = require("./helpers/embeddingHelper");

// Khi server start
async function initServer() {
	const users = await User.find(); // Get all users

	const status = await initializeEmbeddingSystem(users);
	console.log("Embedding system ready:", status);
	// Output:
	// {
	//   phobertAvailable: true,
	//   tfidfReady: true,
	//   geminiAvailable: true
	// }
}
```

### 2. Tính skill matching score

```javascript
const taskSkills = ["React", "Node.js", "MongoDB"];
const userSkills = ["ReactJS", "JavaScript", "Express", "MongoDB"];

const result = await calculateAdvancedHybridSkillMatch(taskSkills, userSkills);

console.log(result);
// Output:
// {
//   score: 0.78,  // 78% match
//   breakdown: {
//     exact: 0.71,       // 71% exact match
//     embedding: 0.85,   // 85% semantic similarity
//     tfidf: 0.79,       // 79% TF-IDF score
//     weights: {
//       exactMatch: 0.40,
//       phobertScore: 0.35,
//       tfidfScore: 0.25
//     }
//   }
// }
```

### 3. Tích hợp vào assignmentHelper.js

```javascript
// Trong file assignmentHelper.js
const { calculateAdvancedHybridSkillMatch } = require("./embeddingHelper");

async function calculateAssignmentCost(task, user) {
	// ... existing code ...

	// Old:
	// const skill_match = calculateSkillMatch(
	//   task.skills_required || [],
	//   user.skills || []
	// );

	// New:
	const skillResult = await calculateAdvancedHybridSkillMatch(
		task.skills_required || [],
		user.skills || []
	);
	const skill_match = skillResult.score;

	// ... rest of cost calculation ...
}
```

### 4. Update TF-IDF vocabulary

```javascript
const { updateTFIDFVocabulary } = require("./helpers/embeddingHelper");

// Khi có user mới hoặc user update skills
async function onUserUpdate() {
	const allUsers = await User.find();
	updateTFIDFVocabulary(allUsers);
}
```

---

## 🧪 Testing

### Chạy test file

```bash
cd server/helpers
node testEmbedding.js
```

Test sẽ kiểm tra:

- ✅ System initialization
- ✅ PhoBERT service connection
- ✅ TF-IDF vocabulary building
- ✅ Exact match scoring
- ✅ Hybrid scoring
- ✅ Semantic understanding

**Expected output:**

```
================================================================================
HYBRID EMBEDDING SYSTEM TEST
================================================================================

1. Initializing system...
--------------------------------------------------------------------------------
✓ PhoBERT service available
✓ TF-IDF vocabulary built: 32 unique skills from 8 users
✓ Gemini API key configured (fallback available)

2. System status:
--------------------------------------------------------------------------------
{
  "phobert": { "available": true, "url": "http://localhost:5000" },
  "tfidf": { "ready": true, "vocabulary_size": 32, "document_count": 8 },
  "gemini": { "configured": true, "available": true },
  "weights": { "exactMatch": 0.4, "phobertScore": 0.35, "tfidfScore": 0.25 }
}

...
```

---

## ⚙️ Configuration

### Thay đổi weights

```javascript
const { setHybridWeights } = require("./helpers/embeddingHelper");

// Custom weights: exact=50%, phobert=30%, tfidf=20%
setHybridWeights(0.5, 0.3, 0.2);
```

### Tắt PhoBERT hoặc TF-IDF

```javascript
const { CONFIG } = require("./helpers/embeddingHelper");

// Chỉ dùng PhoBERT + Exact Match (không dùng TF-IDF)
CONFIG.useTFIDF = false;

// Chỉ dùng TF-IDF + Exact Match (không dùng PhoBERT)
CONFIG.usePhoBERT = false;
```

### Check system status

```javascript
const { getEmbeddingSystemStatus } = require("./helpers/embeddingHelper");

const status = await getEmbeddingSystemStatus();
console.log(status);
```

---

## 🔧 Troubleshooting

### PhoBERT service không start

**Problem:** Python hoặc dependencies chưa cài

**Solution:**

```bash
python --version  # Check Python >= 3.8
pip install -r requirements.txt
```

**Problem:** RAM không đủ (cần ~2GB)

**Solution:** Close các app khác hoặc dùng Gemini fallback

### Embedding chậm

**Problem:** CPU mode (~200ms/request)

**Solution 1 - Use GPU:**

```bash
# Install CUDA + PyTorch GPU version
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

**Solution 2 - Use caching:**

```javascript
// Embeddings được cache tự động trong 1 giờ
```

**Solution 3 - Batch processing:**

```javascript
// Process nhiều users cùng lúc
const results = await Promise.all(
	users.map((user) =>
		calculateAdvancedHybridSkillMatch(taskSkills, user.skills)
	)
);
```

### Gemini API error

**Problem:** API key invalid hoặc quota exceeded

**Solution:**

1. Check API key tại https://makersuite.google.com/app/apikey
2. Verify `.env` file có `GEMINI_API_KEY`
3. Check quota limit (free tier: 60 requests/minute)

---

## 📊 Performance

### Latency (single request)

| Method               | CPU        | GPU       |
| -------------------- | ---------- | --------- |
| Exact Match          | <1ms       | <1ms      |
| TF-IDF               | ~5ms       | ~5ms      |
| PhoBERT              | ~200ms     | ~20ms     |
| Gemini API           | ~300-500ms | N/A       |
| **Hybrid (PhoBERT)** | **~200ms** | **~20ms** |

### Throughput

- **Concurrent:** ~100 requests/sec (with caching)
- **Cold start:** ~2-5 requests/sec

### Memory Usage

- PhoBERT service: ~2GB RAM
- Node.js cache: ~50MB per 1000 cached embeddings

---

## 🎯 Best Practices

1. **Initialize once:** Call `initializeEmbeddingSystem()` at server startup
2. **Update vocabulary:** Call `updateTFIDFVocabulary()` when users change
3. **Use caching:** Embeddings auto-cache for 1 hour
4. **Monitor service:** Check PhoBERT health periodically
5. **Fallback ready:** Always configure Gemini API key

---

## 📚 API Reference

### Main Functions

#### `initializeEmbeddingSystem(allUsers)`

Initialize system with all users' skills.

**Returns:** `Promise<{phobertAvailable, tfidfReady, geminiAvailable}>`

#### `calculateAdvancedHybridSkillMatch(taskSkills, userSkills, options)`

Calculate hybrid matching score.

**Returns:** `Promise<{score, breakdown}>`

#### `getEmbeddingSystemStatus()`

Get current system status.

**Returns:** `Promise<{phobert, tfidf, gemini, weights}>`

#### `setHybridWeights(exact, phobert, tfidf)`

Configure scoring weights.

---

## 🐛 Known Issues

1. **PhoBERT first load slow (~30s):** Model download từ HuggingFace
2. **Windows Defender may block:** Add Python to exclusions
3. **Port 5000 conflict:** Change port in `embedding_service.py` và `CONFIG`

---

## 📝 License

MIT
