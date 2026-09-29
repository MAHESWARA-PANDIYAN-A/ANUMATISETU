import json
import logging
import math
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Base paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REGULATORY_DOCS_PATH = os.path.join(os.path.dirname(BASE_DIR), "data", "regulatory_docs", "knowledge_base.json")
APPROVALS_DB_PATH = os.path.join(os.path.dirname(BASE_DIR), "data", "approvals", "approvals_db.json")

# Singleton memory index
_INDEXED_SOURCES: List[Dict[str, Any]] = []


def load_and_index_sources() -> List[Dict[str, Any]]:
    """
    Ingests and normalizes regulatory documents and approval knowledge base items
    with structured metadata for grounded retrieval.
    """
    global _INDEXED_SOURCES
    if _INDEXED_SOURCES:
        return _INDEXED_SOURCES

    sources = []

    # 1. Ingest Regulatory Guidelines Documents
    if os.path.exists(REGULATORY_DOCS_PATH):
        try:
            with open(REGULATORY_DOCS_PATH, "r", encoding="utf-8") as f:
                docs = json.load(f)
                for d in docs:
                    sources.append({
                        "id": d.get("id"),
                        "title": d.get("title"),
                        "department": d.get("department"),
                        "source": d.get("source"),
                        "publication_date": d.get("publication_date", "2024-01-01"),
                        "last_verified_date": d.get("last_verified_date", "2026-08-20"),
                        "category": d.get("category", "General Regulatory Guidance"),
                        "content": d.get("content", ""),
                        "summary": d.get("summary", ""),
                        "type": "REGULATORY_GUIDELINE"
                    })
            logger.info(f"Loaded {len(docs)} documents from {REGULATORY_DOCS_PATH}")
        except Exception as e:
            logger.error(f"Error loading regulatory docs: {e}")

    # 2. Ingest Approval Knowledge Base Items
    if os.path.exists(APPROVALS_DB_PATH):
        try:
            with open(APPROVALS_DB_PATH, "r", encoding="utf-8") as f:
                approvals = json.load(f)
                for a in approvals:
                    req_docs_str = "\nRequired Documents:\n- " + "\n- ".join(a.get("required_documents", [])) if a.get("required_documents") else ""
                    content_str = (
                        f"Approval Name: {a.get('approval_name')}\n"
                        f"Department: {a.get('department')}\n"
                        f"Description: {a.get('description')}\n"
                        f"Applicable Industries: {', '.join(a.get('applicable_industries', []))}\n"
                        f"Project Stages: {', '.join(a.get('project_stages', []))}\n"
                        f"{req_docs_str}\n"
                        f"Legal Source: {a.get('source')}"
                    )
                    sources.append({
                        "id": f"approval-{a.get('id')}",
                        "title": f"Statutory Clearance: {a.get('approval_name')}",
                        "department": a.get("department"),
                        "source": a.get("source"),
                        "publication_date": "2024-01-01",
                        "last_verified_date": a.get("last_verified_date", "2026-08-15"),
                        "category": "Statutory Approvals & Clearances",
                        "content": content_str,
                        "summary": a.get("description", ""),
                        "required_documents": a.get("required_documents", []),
                        "type": "STATUTORY_APPROVAL"
                    })
            logger.info(f"Loaded {len(approvals)} items from {APPROVALS_DB_PATH}")
        except Exception as e:
            logger.error(f"Error loading approvals DB: {e}")

    _INDEXED_SOURCES = sources
    return _INDEXED_SOURCES


def _tokenize(text: str) -> List[str]:
    """Tokenizes and normalizes text into lower-case keywords."""
    clean = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    tokens = clean.split()
    # Remove common English stop words
    stop_words = {
        "the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "for", "to", "of", "and", "or",
        "with", "by", "from", "it", "this", "that", "these", "those", "what", "which", "who", "whom",
        "how", "can", "could", "should", "would", "do", "does", "did", "have", "has", "had", "be", "been",
        "under", "about", "into", "over", "after"
    }
    return [t for t in tokens if len(t) > 2 and t not in stop_words]


def retrieve_relevant_sources(
    query: str,
    top_k: int = 3,
    department_filter: Optional[str] = None,
    min_score_threshold: float = 1.2
) -> List[Tuple[Dict[str, Any], float]]:
    """
    Retrieves top relevant regulatory documents grounded in the verified knowledge base.
    Returns: List of (source_document, relevance_score)
    """
    sources = load_and_index_sources()
    query_tokens = _tokenize(query)

    if not query_tokens:
        return []

    scored_results = []

    for src in sources:
        if department_filter and department_filter.lower() not in src["department"].lower():
            continue

        score = 0.0
        doc_tokens = _tokenize(src["content"] + " " + src["title"] + " " + src["source"] + " " + src["department"])
        doc_token_set = set(doc_tokens)

        # Keyword matching with title & exact phrase boosting
        query_text_lower = query.lower()
        title_lower = src["title"].lower()
        dept_lower = src["department"].lower()

        # Boost title matches
        if any(tok in title_lower for tok in query_tokens):
            score += 2.5

        # Boost department matches
        if any(tok in dept_lower for tok in query_tokens):
            score += 1.5

        # Content keyword overlap
        for q_tok in query_tokens:
            if q_tok in doc_token_set:
                count = doc_tokens.count(q_tok)
                tf = 1 + math.log(count) if count > 0 else 0
                score += tf * 1.0

        # Substring / multi-word phrase matching
        for i in range(len(query_tokens) - 1):
            bi_gram = f"{query_tokens[i]} {query_tokens[i+1]}"
            if bi_gram in src["content"].lower():
                score += 3.0

        if score >= min_score_threshold:
            scored_results.append((src, round(score, 2)))

    # Sort descending by relevance score
    scored_results.sort(key=lambda x: x[1], reverse=True)
    return scored_results[:top_k]


def get_all_sources_metadata() -> List[Dict[str, Any]]:
    """Returns catalog of all registered verified sources and statutory policies."""
    sources = load_and_index_sources()
    return [
        {
            "id": s["id"],
            "title": s["title"],
            "department": s["department"],
            "source": s["source"],
            "publication_date": s["publication_date"],
            "last_verified_date": s["last_verified_date"],
            "category": s["category"],
            "summary": s["summary"],
            "type": s["type"]
        }
        for s in sources
    ]
