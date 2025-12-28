import threading

# Global thread-safe event for stopping sessions
_stop_event = threading.Event()

def set_stop_signal():
    """Signals that the current session should stop."""
    _stop_event.set()

def clear_stop_signal():
    """Clears the stop signal to allow a new session to start."""
    _stop_event.clear()

def should_stop():
    """Checks if the stop signal has been set."""
    return _stop_event.is_set()
