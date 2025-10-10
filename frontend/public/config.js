// Runtime configuration - dynamically determines backend URL
window.APP_CONFIG = {
  getBackendUrl: function() {
    // Check if there's a hardcoded backend URL in environment (for development)
    if (window.REACT_APP_BACKEND_URL) {
      return window.REACT_APP_BACKEND_URL;
    }
    
    // For production/deployment: use same origin as frontend
    // This ensures the app works in any environment without hardcoding
    return window.location.origin;
  }
};
