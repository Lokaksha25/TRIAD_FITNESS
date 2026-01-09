import pytest
from fastapi.testclient import TestClient
from server import app
import os
from unittest.mock import patch, MagicMock

client = TestClient(app)

# Mock environment variables if needed
os.environ["PINECONE_API_KEY"] = "mock_key"
os.environ["PINECONE_INDEX_NAME"] = "mock_index"
os.environ["GOOGLE_API_KEY"] = "mock_key"

@patch('backend.tools.memory_store.initialize_user_namespace')
def test_signup_flow_success(mock_init_namespace):
    """
    Test that the signup endpoint correctly calls the namespace initialization function.
    """
    # Setup mock return value
    mock_init_namespace.return_value = True

    # Test data
    user_id = "test_user_unique_123"
    email = "test@example.com"
    name = "Test User"
    
    payload = {
        "user_id": user_id,
        "email": email,
        "name": name
    }

    # Make request
    response = client.post("/api/auth/signup", json=payload)

    # Print error if failed
    if response.status_code != 200:
        print(f"Signup failed: {response.json()}")

    # Assertions
    assert response.status_code == 200
    assert response.json() == {"status": "success", "message": "User initialized"}
    
    # Verify mock was called with correct args
    mock_init_namespace.assert_called_once_with(user_id, email, name)

@patch('backend.tools.memory_store.initialize_user_namespace')
def test_signup_flow_failure(mock_init_namespace):
    """
    Test that the signup endpoint handles failure in namespace initialization.
    """
    # Setup mock to fail
    mock_init_namespace.return_value = False

    payload = {
        "user_id": "fail_user",
        "email": "fail@example.com",
        "name": "Fail User"
    }

    # Make request
    response = client.post("/api/auth/signup", json=payload)

    # Assertions
    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to initialize user namespace"}

@patch('server.get_user_profile')
@patch('server.generate_trainer_chat_response')
def test_chat_uses_user_id(mock_trainer_resp, mock_get_profile):
    """
    Test that the chat endpoint extracts and uses the user_id.
    Note: We mock the heavy lifting (Pinecone/LLM calls).
    """
    # Mocks
    mock_get_profile.return_value = {"calories": 2000, "phase": "maintenance"}
    mock_trainer_resp.return_value = {"agentType": "Physical Trainer", "content": "Mock advice"}
    
    # Mock other agents to avoid errors if they are called (though server code does try-except)
    with patch('server.generate_nutritionist_chat_response') as mock_nutri, \
         patch('server.generate_wellness_chat_response') as mock_well:
        
        mock_nutri.return_value = {"agentType": "Nutritionist", "content": "Eat well"}
        mock_well.return_value = {"agentType": "Wellness Coach", "content": "Sleep well"}

        user_id = "chat_user_789"
        payload = {
            "message": "Hello",
            "user_id": user_id
        }

        response = client.post("/api/chat", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        
        # Verify get_user_profile was called with the correct user_id
        mock_get_profile.assert_called_with(user_id=user_id)
        
        # Verify agents received the user_id
        mock_trainer_resp.assert_called_with("Hello", mock_get_profile.return_value, user_id=user_id)
