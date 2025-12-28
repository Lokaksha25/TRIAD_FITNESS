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
from pinecone import Pinecone
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env.local')
load_dotenv()


def _get_embeddings():
    """Get the embedding model instance."""
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    return GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        google_api_key=api_key
    )


def _get_index():
    """Get the Pinecone index instance."""
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    return pc.Index(os.environ["PINECONE_INDEX_NAME"])


def save_agent_memory(agent_type: str, content: str, metadata: dict = None) -> str:
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
        
        index.upsert(vectors=[{
            "id": log_id,
            "values": vector_values,
            "metadata": full_metadata
        }])
        
        print(f"✅ Saved {agent_type} memory: {log_id}")
        return log_id
        
    except Exception as e:
        print(f"❌ Error saving {agent_type} memory: {e}")
        return None


def get_exercise_memory(query: str = "recent workout session", top_k: int = 3) -> list:
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
            include_metadata=True
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


def get_nutrition_memory(query: str = "recent meal plan", top_k: int = 3) -> list:
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
            include_metadata=True
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


def get_wellness_memory(query: str = "recent wellness biometric analysis", top_k: int = 3) -> list:
    """
    Retrieve wellness/biometric memories for cross-agent context sharing.
    
    Args:
        query: Semantic search query
        top_k: Number of results to return
        
    Returns:
        List of wellness memory dictionaries with metadata
    """
    try:
        index = _get_index()
        embeddings = _get_embeddings()
        
        query_vector = embeddings.embed_query(query)
        
        # Query Pinecone
        results = index.query(
            vector=query_vector,
            top_k=top_k * 2,
            include_metadata=True
        )
        
        # Filter for wellness logs
        wellness_logs = []
        for match in results.get('matches', []):
            meta = match.get('metadata', {})
            # Check for wellness type
            if meta.get('agent_type') == 'wellness' or meta.get('type') == 'wellness':
                wellness_logs.append({
                    "id": match['id'],
                    "score": match['score'],
                    "text": meta.get('text', ''),
                    "executive_summary": meta.get('executive_summary', ''),
                    "readiness_score": meta.get('readiness_score', 0),
                    "sleep_hours": meta.get('sleep_hours', 0),
                    "hrv": meta.get('hrv', 0),
                    "rhr": meta.get('rhr', 0),
                    "date": meta.get('date', '')
                })
                
                if len(wellness_logs) >= top_k:
                    break
        
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
