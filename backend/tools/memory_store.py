"""
Shared Memory Store for Cross-Agent Communication via Pinecone.

This module provides centralized functions for saving and retrieving
agent memories, enabling bi-directional data sharing between:
- Physical Trainer Agent (exercise logs)
- Nutritionist Agent (meal plans)

All agents use the same Pinecone index with `agent_type` metadata for filtering.
"""

import os
import time
import json
import hashlib
from pinecone import Pinecone
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env.local')
load_dotenv()


def get_namespace_id(user_id: str) -> str:
    """
    Hash the user_id to create a secure, opaque namespace identifier.
    
    This prevents exposing raw Firebase UIDs in Pinecone while still
    maintaining user data isolation.
    
    Args:
        user_id: The raw Firebase UID
        
    Returns:
        A SHA256 hash of the user_id combined with a secret salt
    """
    # Get salt from environment, with a fallback for development
    salt = os.environ.get("USER_ID_SALT", "triad-fitness-default-salt-change-in-production")
    
    # Create hash
    combined = f"{user_id}{salt}"
    return hashlib.sha256(combined.encode()).hexdigest()


# Global caches for performance optimization
_embeddings_instance = None
_embedding_cache = {}
_profile_query_vector = None


def _get_embeddings():
    """Get the embedding model instance (singleton pattern)."""
    global _embeddings_instance
    if _embeddings_instance is None:
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        _embeddings_instance = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=api_key
        )
    return _embeddings_instance


def _get_cached_embedding(text: str):
    """Get embedding with caching for repeated queries."""
    global _embedding_cache
    if text in _embedding_cache:
        return _embedding_cache[text]
    
    embeddings = _get_embeddings()
    vector = embeddings.embed_query(text)
    _embedding_cache[text] = vector
    return vector


def get_profile_query_vector():
    """Get a pre-computed vector for profile queries (avoids embedding API call)."""
    global _profile_query_vector
    if _profile_query_vector is None:
        # Generate once and cache
        _profile_query_vector = _get_cached_embedding("user fitness profile calories cutting bulking maintenance")
    return _profile_query_vector


def _get_index():
    """Get the Pinecone index instance."""
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    return pc.Index(os.environ["PINECONE_INDEX_NAME"])


def save_agent_memory(agent_type: str, content: str, metadata: dict = None, user_id: str = "user_123") -> str:
    """
    Save an agent's output to Pinecone for cross-agent retrieval.
    
    Args:
        agent_type: Either 'trainer' or 'nutritionist'
        content: The text content to embed and store (e.g., summary, plan)
        metadata: Additional metadata specific to the agent
        
    Returns:
        The log ID of the saved record
    """
    try:
        index = _get_index()
        embeddings = _get_embeddings()
        
        # Generate unique ID with agent prefix
        timestamp = int(time.time())
        log_id = f"{agent_type}_{timestamp}"
        
        # Build metadata
        full_metadata = {
            "agent_type": agent_type,
            "text": content[:1000],  # Pinecone metadata limit
            "date": time.strftime('%Y-%m-%d'),
            "timestamp": timestamp
        }
        
        # Merge additional metadata
        if metadata:
            full_metadata.update(metadata)
        
        # Embed and upsert
        vector_values = embeddings.embed_query(content)
        
        # UPSERT WITH NAMESPACE
        index.upsert(
            vectors=[{
                "id": log_id,
                "values": vector_values,
                "metadata": full_metadata
            }],
            namespace=get_namespace_id(user_id)  # Hashed for security
        )
        
        print(f"✅ Saved {agent_type} memory: {log_id} (User: {user_id[:8]}...)")
        return log_id
        
    except Exception as e:
        print(f"❌ Error saving {agent_type} memory: {e}")
        return None


def get_exercise_memory(query: str = "recent workout session", top_k: int = 3, user_id: str = "user_123") -> list:
    """
    Retrieve exercise/trainer memories for the Nutritionist to reference.
    
    Args:
        query: Semantic search query
        top_k: Number of results to return
        
    Returns:
        List of exercise memory dictionaries with metadata
    """
    try:
        index = _get_index()
        embeddings = _get_embeddings()
        
        query_vector = embeddings.embed_query(query)
        
        # Query with filter for trainer logs
        # Support both old format (log_*) and new format (trainer_*)
        results = index.query(
            vector=query_vector,
            top_k=top_k * 2,  # Fetch more to filter
            include_metadata=True,
            namespace=get_namespace_id(user_id)  # Hashed for security
        )
        
        # Filter for trainer/exercise logs
        exercise_logs = []
        for match in results.get('matches', []):
            meta = match.get('metadata', {})
            # Check for trainer type OR old log format with exercise field
            if meta.get('agent_type') == 'trainer' or meta.get('exercise'):
                exercise_logs.append({
                    "id": match['id'],
                    "score": match['score'],
                    "text": meta.get('text', ''),
                    "exercise": meta.get('exercise', 'Unknown'),
                    "reps": meta.get('reps', 0),
                    "rating": meta.get('rating', 0),
                    "issues": meta.get('issues', []),
                    "date": meta.get('date', '')
                })
                
                if len(exercise_logs) >= top_k:
                    break
        
        return exercise_logs
        
    except Exception as e:
        print(f"❌ Error fetching exercise memory: {e}")
        return []


def get_nutrition_memory(query: str = "recent meal plan", top_k: int = 3, user_id: str = "user_123") -> list:
    """
    Retrieve nutrition/meal plan memories for the Trainer to reference.
    
    Args:
        query: Semantic search query
        top_k: Number of results to return
        
    Returns:
        List of nutrition memory dictionaries with metadata
    """
    try:
        index = _get_index()
        embeddings = _get_embeddings()
        
        query_vector = embeddings.embed_query(query)
        
        # Query with filter for nutritionist logs
        results = index.query(
            vector=query_vector,
            top_k=top_k * 2,
            include_metadata=True,
            namespace=get_namespace_id(user_id)  # Hashed for security
        )
        
        # Filter for nutritionist type
        nutrition_logs = []
        for match in results.get('matches', []):
            meta = match.get('metadata', {})
            # Check for nutritionist type OR old nutrition format
            if meta.get('agent_type') == 'nutritionist' or meta.get('type') == 'nutrition':
                nutrition_logs.append({
                    "id": match['id'],
                    "score": match['score'],
                    "text": meta.get('text', ''),
                    "goal": meta.get('goal', ''),
                    "diet_type": meta.get('diet_type', ''),
                    "date": meta.get('date', '')
                })
                
                if len(nutrition_logs) >= top_k:
                    break
        
        return nutrition_logs
        
    except Exception as e:
        print(f"❌ Error fetching nutrition memory: {e}")
        return []


def format_exercise_context(exercise_memories: list) -> str:
    """
    Format exercise memories into a human-readable context string
    for the Nutritionist agent.
    """
    if not exercise_memories:
        return "No recent exercise data found. User may be starting fresh."
    
    context_parts = ["**Recent Workout History:**\n"]
    
    for i, mem in enumerate(exercise_memories, 1):
        issues_str = ", ".join(mem.get('issues', [])) if mem.get('issues') else "None"
        context_parts.append(
            f"**Session {i}** ({mem.get('date', 'Unknown date')}):\n"
            f"- Exercise: {mem.get('exercise', 'Unknown')}\n"
            f"- Reps completed: {mem.get('reps', 0)}\n"
            f"- Form rating: {mem.get('rating', 0)}/10\n"
            f"- Issues detected: {issues_str}\n"
            f"- Summary: {mem.get('text', 'No summary')[:200]}...\n"
        )
    
    return "\n".join(context_parts)


def format_nutrition_context(nutrition_memories: list) -> str:
    """
    Format nutrition memories into a human-readable context string
    for the Trainer agent.
    """
    if not nutrition_memories:
        return "No recent nutrition data found."
    
    context_parts = ["**Recent Nutrition Plans:**\n"]
    
    for i, mem in enumerate(nutrition_memories, 1):
        context_parts.append(
            f"**Plan {i}** ({mem.get('date', 'Unknown date')}):\n"
            f"- Goal: {mem.get('goal', 'Unknown')}\n"
            f"- Diet Type: {mem.get('diet_type', 'Unknown')}\n"
            f"- Details: {mem.get('text', 'No details')[:300]}...\n"
        )
    
    return "\n".join(context_parts)


def get_wellness_memory(query: str = "recent wellness biometric analysis", top_k: int = 3, user_id: str = "user_123") -> list:
    """
    Retrieve wellness/biometric memories for cross-agent context sharing.
    
    Args:
        query: Semantic search query
        top_k: Number of results to return
        
    Returns:
        List of wellness memory dictionaries with metadata, sorted by most recent first
    """
    try:
        index = _get_index()
        embeddings = _get_embeddings()
        
        namespace = get_namespace_id(user_id)
        print(f"🔍 Querying wellness data for user: {user_id}")
        print(f"   Namespace (hashed): {namespace[:16]}...")
        
        query_vector = embeddings.embed_query(query)
        
        # Query Pinecone - fetch more to ensure we get all wellness logs
        results = index.query(
            vector=query_vector,
            top_k=20,  # Fetch more to find all wellness entries
            include_metadata=True,
            namespace=namespace
        )
        
        total_matches = len(results.get('matches', []))
        print(f"   Total matches from Pinecone: {total_matches}")
        
        # Filter for wellness logs
        wellness_logs = []
        for match in results.get('matches', []):
            meta = match.get('metadata', {})
            agent_type = meta.get('agent_type', 'none')
            data_type = meta.get('type', 'none')
            
            # Check for wellness type
            if agent_type == 'wellness' or data_type == 'wellness':
                # Extract timestamp from ID (format: wellness_{timestamp})
                try:
                    timestamp = int(match['id'].split('_')[1])
                except:
                    timestamp = 0
                    
                wellness_logs.append({
                    "id": match['id'],
                    "score": match['score'],
                    "timestamp": timestamp,
                    "text": meta.get('text', ''),
                    "executive_summary": meta.get('executive_summary', ''),
                    "readiness_score": meta.get('readiness_score', 0),
                    "sleep_hours": meta.get('sleep_hours', 0),
                    "hrv": meta.get('hrv', 0),
                    "rhr": meta.get('rhr', 0),
                    "date": meta.get('date', '')
                })
        
        # Sort by timestamp (most recent first)
        wellness_logs.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
        
        # Return only top_k results
        wellness_logs = wellness_logs[:top_k]
        
        if wellness_logs:
            print(f"   Most recent wellness log: {wellness_logs[0]['id']}")
            print(f"   Sleep={wellness_logs[0]['sleep_hours']}h, HRV={wellness_logs[0]['hrv']}, RHR={wellness_logs[0]['rhr']}")
        
        print(f"   Wellness logs found after filtering: {len(wellness_logs)}")
        return wellness_logs
        
    except Exception as e:
        print(f"❌ Error fetching wellness memory: {e}")
        return []


def format_wellness_context(wellness_memories: list) -> str:
    """
    Format wellness memories into a human-readable context string
    for cross-agent communication.
    """
    if not wellness_memories:
        return "No recent wellness/biometric data found."
    
    context_parts = ["**Recent Wellness Analysis:**\n"]
    
    for i, mem in enumerate(wellness_memories, 1):
        context_parts.append(
            f"**Analysis {i}** ({mem.get('date', 'Unknown date')}):\n"
            f"- Readiness Score: {mem.get('readiness_score', 'N/A')}/100\n"
            f"- Sleep: {mem.get('sleep_hours', 'N/A')} hours\n"
            f"- HRV: {mem.get('hrv', 'N/A')} ms\n"
            f"- RHR: {mem.get('rhr', 'N/A')} bpm\n"
            f"- Summary: {mem.get('executive_summary', mem.get('text', 'No summary'))[:200]}...\n"
        )
    
    return "\n".join(context_parts)


def get_training_plan_memory(user_id: str = "user_123", top_k: int = 1) -> dict:
    """
    Retrieve the most recent training plan for a user from Pinecone.
    
    Args:
        user_id: User identifier
        top_k: Number of results to return (default 1 for latest plan)
        
    Returns:
        Dictionary with plan data and metadata, or None if not found
    """
    try:
        index = _get_index()
        embeddings = _get_embeddings()
        
        # Query for training plans
        query_vector = embeddings.embed_query(f"weekly training plan workout program for {user_id}")
        
        # Query Pinecone
        results = index.query(
            vector=query_vector,
            top_k=top_k * 3,  # Fetch more to filter
            include_metadata=True,
            namespace=get_namespace_id(user_id)  # Hashed for security
        )
        
        # Filter for training_plan type
        for match in results.get('matches', []):
            meta = match.get('metadata', {})
            # Check for training_plan type
            if meta.get('type') == 'training_plan' and meta.get('user_id') == user_id:
                return {
                    "id": match['id'],
                    "score": match['score'],
                    "plan_data": meta.get('plan_data', ''),
                    "created_timestamp": meta.get('created_timestamp', 0),
                    "created_date": meta.get('created_date', ''),
                    "exercises": meta.get('exercises', []),
                    "injury_detected": meta.get('injury_detected', False),
                    "plan_version": meta.get('plan_version', 'v1'),
                    "user_id": meta.get('user_id', '')
                }
        
        return None
        
    except Exception as e:
        print(f"❌ Error fetching training plan: {e}")
        return None


def save_training_plan(user_id: str, plan_data: str, exercises: list, injury_detected: bool = False) -> str:
    """
    Save a training plan to Pinecone with specialized metadata.
    
    Args:
        user_id: User identifier
        plan_data: The full plan content (JSON string or formatted text)
        exercises: List of exercise names in the plan
        injury_detected: Whether an injury was detected during plan generation
        
    Returns:
        The log ID of the saved plan
    """
    try:
        index = _get_index()
        embeddings = _get_embeddings()
        
        # Generate unique ID
        timestamp = int(time.time())
        log_id = f"training_plan_{timestamp}"
        
        # Build metadata
        metadata = {
            "type": "training_plan",
            "agent_type": "trainer",
            "created_timestamp": timestamp,
            "created_date": time.strftime('%Y-%m-%d'),
            "exercises": exercises[:20],  # Limit to avoid metadata size issues
            "user_id": user_id,
            "injury_detected": injury_detected,
            "plan_version": "v1",
            "text": plan_data[:1000],  # Pinecone metadata limit
            "plan_data": plan_data[:1000]
        }
        
        # Embed and upsert
        vector_values = embeddings.embed_query(plan_data)
        
        index.upsert(
            vectors=[{
                "id": log_id,
                "values": vector_values,
                "metadata": metadata
            }],
            namespace=get_namespace_id(user_id)  # Hashed for security
        )
        
        return log_id
        
    except Exception as e:
        print(f"❌ Error saving training plan: {e}")
        return None

def initialize_user_namespace(user_id: str, email: str, name: str) -> bool:
    """
    Initialize a Pinecone namespace for a new user.
    Creates a 'user_profile' metadata entry to ensure the namespace exists.
    """
    try:
        index = _get_index()
        embeddings = _get_embeddings()
        
        # Create a default user profile text
        profile_text = f"User Profile for {name} ({email}). Fitness journey start."
        
        # Generate ID
        log_id = f"user_profile_{int(time.time())}"
        
        # Metadata
        metadata = {
            "type": "user_profile",
            "agent_type": "system",
            "created_at": time.time(),
            "email": email,
            "name": name,
            "text": profile_text,
            "calories": 2000, # Default
            "phase": "maintenance" # Default
        }
        
        # Embed and upsert
        vector_values = embeddings.embed_query(profile_text)
        
        index.upsert(
            vectors=[{
                "id": log_id,
                "values": vector_values,
                "metadata": metadata
            }],
            namespace=get_namespace_id(user_id)  # Hashed for security
        )
        
        print(f"✅ User namespace initialized for {user_id}")
        return True
        
    except Exception as e:
        print(f"❌ Error initializing user namespace: {e}")
        return False
