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


def default_ingest_embedding_batch_size() -> int:
    """Provider-tuned default; override with INGEST_EMBEDDING_BATCH_SIZE."""
    provider = settings.EMBEDDING_PROVIDER.lower()
    defaults = {
        # voyage-4-large: max 1000 texts/request, 120K tokens/request — ~320 safe for ~400-token chunks
        "voyage": 320,
        "cohere": 96,
        "openai": 128,
        "hf_inference": 32,
        "local": 48,
    }
    return max(8, int(os.getenv("INGEST_EMBEDDING_BATCH_SIZE", str(defaults.get(provider, 64)))))


def default_voyage_model() -> str:
    """Best default for code+docs RAG with standard /v1/embeddings batching."""
    return "voyage-4-large"


def _api_embedding_batch_size() -> int:
    return default_ingest_embedding_batch_size()


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
    
    model_name = (settings.EMBEDDING_MODEL_NAME or "").strip()
    if not model_name or model_name == "intfloat/e5-base-v2":
        model_name = default_voyage_model()
    elif model_name in {
        "voyage-3",
        "voyage-3-lite",
        "voyage-large-2",
        "voyage-code-2",
        "voyage-code-3",
    }:
        logger.info("Upgrading legacy Voyage model %s -> voyage-4-large", model_name)
        model_name = default_voyage_model()
    logger.info(f"Initializing Voyage AI embeddings with model: {model_name}")
    
    batch_size = _api_embedding_batch_size()
    output_dim = getattr(settings, "EMBEDDING_DIMENSION", None)
    kwargs = {
        "voyage_api_key": voyage_key,
        "model": model_name,
        "batch_size": batch_size,
    }
    # voyage-4-* supports 256/512/1024/2048; only pass when explicitly configured
    if output_dim and output_dim in (256, 512, 1024, 2048):
        kwargs["output_dimension"] = output_dim
    logger.info(f"Voyage AI embedding batch_size={batch_size}, output_dimension={kwargs.get('output_dimension', 'model default')}")
    return VoyageAIEmbeddings(**kwargs)


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
    
    batch_size = _api_embedding_batch_size()
    logger.info(f"Cohere embedding batch_size={batch_size}")
    return CohereEmbeddings(
        cohere_api_key=settings.COHERE_API_KEY,
        model=model_name,
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
    
    model_name = settings.EMBEDDING_MODEL_NAME or "intfloat/e5-base-v2"
    batch_size = default_ingest_embedding_batch_size()
    device = os.getenv("EMBEDDING_DEVICE", "").strip().lower()
    if not device:
        try:
            import torch

            device = "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            device = "cpu"
    logger.info(
        f"Initializing local HuggingFace embeddings: model={model_name}, device={device}, batch_size={batch_size}"
    )

    base = HuggingFaceEmbeddings(
        model_name=model_name,
        model_kwargs={"device": device},
        encode_kwargs={
            "normalize_embeddings": True,
            "batch_size": batch_size,
        },
    )
    if "e5" in model_name.lower():
        return _E5EmbeddingsWrapper(base)
    return base


class _E5EmbeddingsWrapper(Embeddings):
    """Prefix queries/passages for E5-family models."""

    def __init__(self, inner: Embeddings):
        self._inner = inner

    def embed_documents(self, texts):
        return self._inner.embed_documents([f"passage: {t}" for t in texts])

    def embed_query(self, text):
        return self._inner.embed_query(f"query: {text}")
