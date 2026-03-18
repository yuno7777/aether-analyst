"""
Memory system for Aether Analyst.
Two layers:
1. memory.md — persistent file read/written each session
2. ChromaDB — vector store for semantic recall
"""

import os
import uuid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

MEMORY_FILE_PATH = os.getenv("MEMORY_FILE_PATH", "./memory.md")
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_data")

DEFAULT_MEMORY = """## Identity
User: (not yet known)
Preferences: (not yet known)

## Ongoing Projects
(none yet)

## Datasets
(none yet)

## Past Decisions
(none yet)

## Last Session Summary
(no sessions yet)
"""


# ─── Memory File ───

def read_memory() -> str:
    """Read the memory.md file. Create with defaults if missing."""
    if not os.path.exists(MEMORY_FILE_PATH):
        write_memory(DEFAULT_MEMORY)
    with open(MEMORY_FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()


def write_memory(content: str) -> None:
    """Overwrite memory.md with new content."""
    os.makedirs(os.path.dirname(MEMORY_FILE_PATH) if os.path.dirname(MEMORY_FILE_PATH) else ".", exist_ok=True)
    with open(MEMORY_FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)


def clear_memory() -> None:
    """Reset memory.md to defaults and wipe ChromaDB collection."""
    write_memory(DEFAULT_MEMORY)
    try:
        collection = get_chroma_collection()
        # Delete all documents
        results = collection.get()
        if results["ids"]:
            collection.delete(ids=results["ids"])
    except Exception:
        pass


# ─── ChromaDB Vector Store ───

_chroma_client = None
_collection = None


def get_chroma_collection():
    """Get or create the ChromaDB collection for agent memory."""
    global _chroma_client, _collection
    if _collection is None:
        import chromadb
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = _chroma_client.get_or_create_collection(
            name="agent_memory",
            metadata={"hnsw:space": "cosine"}
        )
    return _collection


def store_memory_vector(text: str, metadata: dict = None) -> str:
    """Store a text chunk in the vector store. Returns the doc ID."""
    collection = get_chroma_collection()
    doc_id = str(uuid.uuid4())
    meta = {
        "timestamp": datetime.utcnow().isoformat(),
        **(metadata or {})
    }
    collection.add(
        documents=[text],
        ids=[doc_id],
        metadatas=[meta]
    )
    return doc_id


def recall_memories(query: str, n_results: int = 3) -> list[dict]:
    """Retrieve the top N most relevant past memories for a query."""
    collection = get_chroma_collection()
    try:
        count = collection.count()
        if count == 0:
            return []
        results = collection.query(
            query_texts=[query],
            n_results=min(n_results, count)
        )
        memories = []
        for i, doc in enumerate(results["documents"][0]):
            memories.append({
                "content": doc,
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": results["distances"][0][i] if results["distances"] else None
            })
        return memories
    except Exception:
        return []
