// API Configuration
// This file provides runtime configuration that works across all environments

export const getBackendUrl = () => {
  // First check if there's a build-time environment variable
  const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
  
  if (envBackendUrl && envBackendUrl.trim() !== '') {
    return envBackendUrl;
  }
  
  // Use runtime config from public/config.js if available
  if (window.APP_CONFIG && window.APP_CONFIG.getBackendUrl) {
    return window.APP_CONFIG.getBackendUrl();
  }
  
  // Fallback: use same origin as frontend (works for same-domain deployments)
  return window.location.origin;
};

export const BACKEND_URL = getBackendUrl();
export const API = `${BACKEND_URL}/api`;
