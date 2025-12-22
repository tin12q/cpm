"""
PhoBERT Embedding Service
Local Vietnamese embedding service using PhoBERT model from HuggingFace
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoModel, AutoTokenizer
import torch
import numpy as np
from functools import lru_cache
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global variables for model and tokenizer
model = None
tokenizer = None
device = None

def initialize_model():
    """Initialize PhoBERT model and tokenizer"""
    global model, tokenizer, device
    
    try:
        logger.info("Loading PhoBERT model...")
        
        # Check if CUDA is available
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Using device: {device}")
        
        # Load PhoBERT model and tokenizer
        model_name = "vinai/phobert-base-v2"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModel.from_pretrained(model_name)
        model.to(device)
        model.eval()
        
        logger.info("PhoBERT model loaded successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return False

def mean_pooling(model_output, attention_mask):
    """
    Mean pooling - Take attention mask into account for correct averaging
    """
    token_embeddings = model_output[0]  # First element contains all token embeddings
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)

@lru_cache(maxsize=1000)
def get_embedding_cached(text):
    """Get embedding with caching"""
    return get_embedding(text)

def get_embedding(text):
    """
    Get PhoBERT embedding for text
    Returns normalized embedding vector
    """
    if model is None or tokenizer is None:
        raise RuntimeError("Model not initialized")
    
    try:
        # Tokenize
        encoded_input = tokenizer(
            text,
            padding=True,
            truncation=True,
            max_length=256,
            return_tensors='pt'
        )
        
        # Move to device
        encoded_input = {k: v.to(device) for k, v in encoded_input.items()}
        
        # Get embeddings
        with torch.no_grad():
            model_output = model(**encoded_input)
        
        # Apply mean pooling
        sentence_embeddings = mean_pooling(model_output, encoded_input['attention_mask'])
        
        # Normalize embeddings
        sentence_embeddings = torch.nn.functional.normalize(sentence_embeddings, p=2, dim=1)
        
        # Convert to numpy and then to list
        embedding = sentence_embeddings.cpu().numpy()[0].tolist()
        
        return embedding
        
    except Exception as e:
        logger.error(f"Error getting embedding: {e}")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'model': 'PhoBERT',
        'device': str(device),
        'ready': model is not None
    })

@app.route('/embed', methods=['POST'])
def embed():
    """
    Get embedding for single text
    Request: {"text": "React developer"}
    Response: {"embedding": [...], "dimension": 768}
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text field'}), 400
        
        text = data['text']
        
        if not text or not text.strip():
            return jsonify({'error': 'Empty text'}), 400
        
        embedding = get_embedding(text)
        
        return jsonify({
            'embedding': embedding,
            'dimension': len(embedding)
        })
        
    except Exception as e:
        logger.error(f"Error in /embed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/embed_batch', methods=['POST'])
def embed_batch():
    """
    Get embeddings for multiple texts
    Request: {"texts": ["React", "Vue", "Angular"]}
    Response: {"embeddings": [[...], [...], [...]]}
    """
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({'error': 'Missing texts field'}), 400
        
        texts = data['texts']
        
        if not isinstance(texts, list):
            return jsonify({'error': 'texts must be an array'}), 400
        
        embeddings = [get_embedding(text) for text in texts if text and text.strip()]
        
        return jsonify({
            'embeddings': embeddings,
            'count': len(embeddings)
        })
        
    except Exception as e:
        logger.error(f"Error in /embed_batch: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/similarity', methods=['POST'])
def similarity():
    """
    Calculate similarity between two texts
    Request: {"text1": "React developer", "text2": "Frontend engineer"}
    Response: {"similarity": 0.85, "method": "dot_product"}
    """
    try:
        data = request.get_json()
        
        if not data or 'text1' not in data or 'text2' not in data:
            return jsonify({'error': 'Missing text1 or text2 field'}), 400
        
        text1 = data['text1']
        text2 = data['text2']
        
        # Get embeddings
        emb1 = np.array(get_embedding(text1))
        emb2 = np.array(get_embedding(text2))
        
        # Calculate dot product (embeddings are already normalized)
        dot_product = np.dot(emb1, emb2)
        
        # Calculate cosine similarity for comparison
        cosine_sim = dot_product  # Same as dot product for normalized vectors
        
        return jsonify({
            'similarity': float(dot_product),
            'cosine_similarity': float(cosine_sim),
            'method': 'dot_product'
        })
        
    except Exception as e:
        logger.error(f"Error in /similarity: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/clear_cache', methods=['POST'])
def clear_cache():
    """Clear embedding cache"""
    try:
        get_embedding_cached.cache_clear()
        return jsonify({'status': 'cache cleared'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting PhoBERT Embedding Service...")
    
    if initialize_model():
        logger.info("Server ready on http://localhost:5000")
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        logger.error("Failed to initialize model. Exiting.")
        exit(1)
