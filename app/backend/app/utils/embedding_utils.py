"""
Embedding utility to initialize different embedding providers.
Supports: local (HuggingFace), Voyage AI, Cohere, OpenAI, and HuggingFace Inference API.
"""
import os
import logging
from typing import Union
from langchain_core.embeddings import Embeddings
from backend.app.core.config import settings

# Ensure multiprocessing is disabled for embeddings (Windows compatibility)
os.environ["TOKENIZERS_PARALLELISM"] = "false"

logger = logging.getLogger("dex-core")

def get_embeddings() -> Embeddings:
    """
    Initialize embeddings based on EMBEDDING_PROVIDER setting.
    
    Returns:
        Embeddings instance based on the configured provider
        
    Raises:
        ValueError: If provider is not supported or required API keys are missing
    """
    provider = settings.EMBEDDING_PROVIDER.lower()
    
    if provider == "voyage":
        return _get_voyage_embeddings()
    elif provider == "cohere":
        return _get_cohere_embeddings()
    elif provider == "openai":
        return _get_openai_embeddings()
    elif provider == "hf_inference":
        return _get_hf_inference_embeddings()
    elif provider == "local":
        return _get_local_embeddings()
    else:
        raise ValueError(
            f"Unsupported embedding provider: {provider}. "
            f"Supported providers: 'local', 'hf_inference', 'cohere', 'openai', 'voyage'"
        )


def _get_voyage_embeddings() -> Embeddings:
    """Initialize Voyage AI embeddings (1024 dimensions)."""
    try:
        from langchain_voyageai import VoyageAIEmbeddings
    except ImportError:
        raise ImportError(
            "langchain-voyageai is required for Voyage AI embeddings. "
            "Install it with: pip install langchain-voyageai"
        )
    
    # Check if API key is missing or empty
    voyage_key = settings.VOYAGE_API_KEY.strip() if settings.VOYAGE_API_KEY else ""
    if not voyage_key:
        error_msg = (
            "VOYAGE_API_KEY is required for Voyage AI embeddings but is not set. "
            "Please either:\n"
            "  1. Set VOYAGE_API_KEY in your .env file (get key from https://www.voyageai.com), OR\n"
            "  2. Change EMBEDDING_PROVIDER to 'local' or another provider in your .env file"
        )
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    model_name = settings.EMBEDDING_MODEL_NAME or "voyage-3"
    logger.info(f"Initializing Voyage AI embeddings with model: {model_name}")
    
    return VoyageAIEmbeddings(
        voyage_api_key=voyage_key,
        model=model_name
    )


def _get_cohere_embeddings() -> Embeddings:
    """Initialize Cohere embeddings (1024 dimensions)."""
    try:
        from langchain_cohere import CohereEmbeddings
    except ImportError:
        raise ImportError(
            "langchain-cohere is required for Cohere embeddings. "
            "Install it with: pip install langchain-cohere"
        )
    
    if not settings.COHERE_API_KEY:
        raise ValueError(
            "COHERE_API_KEY is required for Cohere embeddings. "
            "Please set it in your environment variables."
        )
    
    model_name = settings.EMBEDDING_MODEL_NAME or "embed-english-v3.0"
    logger.info(f"Initializing Cohere embeddings with model: {model_name}")
    
    return CohereEmbeddings(
        cohere_api_key=settings.COHERE_API_KEY,
        model=model_name
    )


def _get_openai_embeddings() -> Embeddings:
    """Initialize OpenAI embeddings."""
    try:
        from langchain_openai import OpenAIEmbeddings
    except ImportError:
        raise ImportError(
            "langchain-openai is required for OpenAI embeddings. "
            "Install it with: pip install langchain-openai"
        )
    
    if not settings.OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY is required for OpenAI embeddings. "
            "Please set it in your environment variables."
        )
    
    model_name = settings.EMBEDDING_MODEL_NAME or "text-embedding-3-large"
    logger.info(f"Initializing OpenAI embeddings with model: {model_name}")
    
    return OpenAIEmbeddings(
        openai_api_key=settings.OPENAI_API_KEY,
        model=model_name
    )


def _get_hf_inference_embeddings() -> Embeddings:
    """Initialize HuggingFace Inference API embeddings."""
    try:
        from langchain_huggingface import HuggingFaceEndpoint, HuggingFaceEmbeddings
    except ImportError:
        raise ImportError(
            "langchain-huggingface is required for HuggingFace Inference API embeddings. "
            "Install it with: pip install langchain-huggingface"
        )
    
    if not settings.HUGGINGFACE_API_KEY:
        raise ValueError(
            "HUGGINGFACE_API_KEY is required for HuggingFace Inference API embeddings. "
            "Please set it in your environment variables."
        )
    
    model_name = settings.EMBEDDING_MODEL_NAME or "sentence-transformers/all-mpnet-base-v2"
    logger.info(f"Initializing HuggingFace Inference API embeddings with model: {model_name}")
    
    # Use HuggingFaceEndpoint for inference API
    endpoint_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model_name}"
    return HuggingFaceEndpoint(
        endpoint_url=endpoint_url,
        huggingface_api_key=settings.HUGGINGFACE_API_KEY,
        task="feature-extraction"
    )


def _get_local_embeddings() -> Embeddings:
    """Initialize local HuggingFace embeddings (default)."""
    try:
        from langchain_huggingface import HuggingFaceEmbeddings
    except ImportError:
        raise ImportError(
            "langchain-huggingface is required for local embeddings. "
            "Install it with: pip install langchain-huggingface"
        )
    
    model_name = settings.EMBEDDING_MODEL_NAME or "sentence-transformers/all-mpnet-base-v2"
    logger.info(f"Initializing local HuggingFace embeddings with model: {model_name}")
    
    return HuggingFaceEmbeddings(
        model_name=model_name,
        model_kwargs={
            'device': 'cpu'  # Use CPU for local models
        },
        encode_kwargs={
            'normalize_embeddings': True  # Normalize for better cosine similarity
        }
    )
