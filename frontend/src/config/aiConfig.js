/**
 * AI Central Engine & Backend Service Configuration Helper
 * Follows Nemo AI Integration Guide
 */

export const getAiApiBaseUrl = () => {
  // Check if we are running in local development (localhost / 127.0.0.1)
  const isLocalHost = (
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '0.0.0.0')) ||
    import.meta.env.DEV
  );

  // In local development, strictly enforce localhost:8000 (prevents stale cached window variables)
  if (isLocalHost) {
    const envUrl = import.meta.env.VITE_NEMO_AI_API_URL || import.meta.env.VITE_PYDAH_AI_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.includes('localhost')) {
      return envUrl.trim().replace(/\/$/, '');
    }
    return 'http://localhost:8000';
  }

  // In production mode, check window globals or production environment variables
  if (typeof window !== 'undefined') {
    const winUrl = window.NEMO_AI_API_URL || window.PYDAH_AI_API_URL;
    if (winUrl && typeof winUrl === 'string' && winUrl.trim() !== '') {
      return winUrl.trim().replace(/\/$/, '');
    }
  }

  if (import.meta.env.VITE_NEMO_AI_API_URL) {
    return import.meta.env.VITE_NEMO_AI_API_URL.trim().replace(/\/$/, '');
  }

  if (import.meta.env.VITE_PYDAH_AI_API_URL) {
    return import.meta.env.VITE_PYDAH_AI_API_URL.trim().replace(/\/$/, '');
  }

  // Fallback to production hosted URL
  return 'https://nemo-ai.pydah.edu.in';
};

export const getServiceBaseUrl = () => {
  const isLocalHost = (
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '0.0.0.0')) ||
    import.meta.env.DEV
  );

  // In local development, strictly enforce localhost:5002
  if (isLocalHost) {
    const envServiceUrl = import.meta.env.VITE_NEMO_AI_SERVICE_URL || import.meta.env.VITE_SERVICE_URL;
    if (envServiceUrl && typeof envServiceUrl === 'string' && envServiceUrl.includes('localhost')) {
      return envServiceUrl.trim().replace(/\/$/, '');
    }
    return 'http://localhost:5002';
  }

  if (typeof window !== 'undefined') {
    const winServiceUrl = (
      window.NEMO_AI_SERVICE_URL ||
      window.PYDAH_AI_SERVICE_URL ||
      window.PORTAL_BACKEND_URL ||
      window.APPLICATION_SERVICE_URL
    );
    if (winServiceUrl && typeof winServiceUrl === 'string' && winServiceUrl.trim() !== '') {
      return winServiceUrl.trim().replace(/\/$/, '');
    }
  }

  if (import.meta.env.VITE_NEMO_AI_SERVICE_URL) {
    return import.meta.env.VITE_NEMO_AI_SERVICE_URL.trim().replace(/\/$/, '');
  }

  if (import.meta.env.VITE_SERVICE_URL) {
    return import.meta.env.VITE_SERVICE_URL.trim().replace(/\/$/, '');
  }

  // If VITE_API_URL is an absolute HTTP URL (e.g. http://localhost:5002/api)
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  }

  // In production if host is not localhost, use window.location.origin (e.g. https://student.pydah.edu.in)
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    return window.location.origin;
  }

  // Local development backend default
  return 'http://localhost:5002';
};

export const getCdnScriptUrl = () => {
  if (typeof window !== 'undefined') {
    const winScript = window.NEMO_AI_CDN_SCRIPT || window.PYDAH_AI_CDN_SCRIPT;
    if (winScript && typeof winScript === 'string' && winScript.trim() !== '') {
      return winScript.trim();
    }
  }

  if (import.meta.env.VITE_NEMO_AI_CDN_SCRIPT) {
    return import.meta.env.VITE_NEMO_AI_CDN_SCRIPT.trim();
  }

  // Default hosted CDN script from integration doc
  return 'https://nemo-chat.pydah.edu.in/index.umd.js';
};

export const getCdnStyleUrl = () => {
  if (typeof window !== 'undefined') {
    const winStyle = window.NEMO_AI_CDN_STYLE || window.PYDAH_AI_CDN_STYLE;
    if (winStyle && typeof winStyle === 'string' && winStyle.trim() !== '') {
      return winStyle.trim();
    }
  }

  if (import.meta.env.VITE_NEMO_AI_CDN_STYLE) {
    return import.meta.env.VITE_NEMO_AI_CDN_STYLE.trim();
  }

  // Default hosted CDN stylesheet from integration doc
  return 'https://nemo-chat.pydah.edu.in/style.css';
};
