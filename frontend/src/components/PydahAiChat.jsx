import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { getAiApiBaseUrl } from '../config/aiConfig';

/**
 * Helper to scope raw CSS text strictly under a selector prefix (e.g. #pydah-ai-chat-root)
 * to completely eliminate CSS reset leakage into host application tables, headers, and layouts.
 */
function scopeCss(rawCss, scopePrefix) {
  return rawCss.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g, (match, selector, suffix) => {
    const trimmed = selector.trim();
    if (
      !trimmed ||
      trimmed.startsWith('@') ||
      trimmed.startsWith(':host') ||
      trimmed.startsWith('from') ||
      trimmed.startsWith('to') ||
      /^\d+%$/.test(trimmed)
    ) {
      return match;
    }

    const scopedParts = trimmed
      .split(',')
      .map(part => {
        const p = part.trim();
        if (!p || p.startsWith('@') || p.startsWith('from') || p.startsWith('to')) return p;
        if (p === 'html' || p === 'body') return scopePrefix;
        if (p.startsWith(scopePrefix)) return p;
        return `${scopePrefix} ${p}`;
      })
      .join(', ');

    return `${scopedParts}${suffix}`;
  });
}

/**
 * PydahAiChat Component
 * Self-contained UMD loader for Pydah AI Chat UI.
 * Zero UI Pollution:
 * - Scopes all styles strictly to #pydah-ai-chat-root so NO host alignment or sidebars are disturbed.
 * - Prevents global Tailwind Preflight leakage.
 */
export default function PydahAiChat({
  mode = 'widget',
  assistantId: propsAssistantId,
  authToken: propsAuthToken,
  title = 'Pydah Admin Assistant',
  welcomeMessage = 'Hi! How can I help you today?',
  position = 'bottom-right',
  apiBaseUrl: propsApiBaseUrl,
  ...restProps
}) {
  const location = useLocation();
  const { token: storeToken, userType, user } = useAuthStore();
  const [isLoaded, setIsLoaded] = useState(false);

  const isAiAssistantPage = location?.pathname?.endsWith('/ai-assistant');

  // Resolve active bearer token, assistant persona, and AI engine URL
  const activeToken = propsAuthToken || storeToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
  
  const currentRole = String(user?.role || userType || '').toLowerCase();
  const isSuperAdmin = ['super_admin', 'superadmin'].includes(currentRole);

  const activeAssistantId = propsAssistantId || (isSuperAdmin ? 'admin-assistant' : 'portal-assistant');
  const activeApiBaseUrl = propsApiBaseUrl || getAiApiBaseUrl();

  // Strict Guard: ONLY allow for super_admin accounts on the admin side
  const isAuthorized = isSuperAdmin;

  useEffect(() => {
    if (!activeToken || !isAuthorized) return;

    if (typeof window !== 'undefined') {
      // Expose React & ReactDOM globally BEFORE UMD bundle executes
      window.React = React;
      window.ReactDOM = ReactDOM;

      // Disable auto-mounting to prevent un-scoped body widgets
      window.PYDAH_AI_DISABLE_AUTO_MOUNT = true;

      window.PYDAH_AI_API_URL = activeApiBaseUrl;
      window.PYDAH_AI_ASSISTANT_ID = activeAssistantId;
      window.PYDAH_AI_TITLE = title;
      window.PYDAH_AI_WELCOME_MESSAGE = welcomeMessage;
      window.PYDAH_AI_AUTH_TOKEN = activeToken;

      // Clean up any old un-scoped styles or guards that altered host layout alignment
      const oldStyleLink = document.getElementById('pydah-ai-style');
      if (oldStyleLink) oldStyleLink.remove();
      const oldGuard = document.getElementById('pydah-ai-layout-guard');
      if (oldGuard) oldGuard.remove();

      // Inject Scoped Stylesheet: Prefixes every rule with #pydah-ai-chat-root
      if (!document.getElementById('pydah-ai-scoped-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'pydah-ai-scoped-style';
        document.head.appendChild(styleEl);

        fetch('https://nemo-chat.pydah.edu.in/style.css')
          .then(res => res.text())
          .then(rawCss => {
            const scoped = scopeCss(rawCss, '#pydah-ai-chat-root');
            styleEl.innerHTML = scoped;
          })
          .catch(err => {
            console.warn('[Pydah AI] Scoped stylesheet load notice:', err.message);
          });
      }

      // Inject Script
      if (!document.getElementById('pydah-ai-script')) {
        const script = document.createElement('script');
        script.id = 'pydah-ai-script';
        script.src = 'https://nemo-chat.pydah.edu.in/index.umd.js';
        script.async = true;
        script.onload = () => setIsLoaded(true);
        document.body.appendChild(script);
      } else if (window.PydahAIChatUI) {
        setIsLoaded(true);
      }
    }

    return () => {
      if (mode === 'widget') {
        const lingering = document.querySelectorAll('.pydah-ai-widget-container, .pydah-ai-floating-btn');
        lingering.forEach(el => el.remove());
      }
    };
  }, [activeApiBaseUrl, activeAssistantId, activeToken, title, welcomeMessage, mode, isAuthorized]);

  // Strictly only show if an authenticated token is present and user is a super_admin
  if (!activeToken || !isAuthorized) {
    return null;
  }

  // Hide floating widget button on dedicated AI Assistant page
  if (mode === 'widget' && isAiAssistantPage) {
    return null;
  }

  if (!isLoaded || typeof window === 'undefined' || !window.PydahAIChatUI) {
    return null;
  }

  const UIModule = window.PydahAIChatUI;
  const Component = mode === 'embedded'
    ? (UIModule.PydahAIChatPage || UIModule.default || UIModule)
    : (UIModule.PydahAIChatWidget || UIModule.default || UIModule);

  if (!Component) {
    return null;
  }

  return (
    <div id="pydah-ai-chat-root" className="pydah-ai-root pointer-events-auto">
      <Component
        mode={mode}
        assistantId={activeAssistantId}
        authToken={activeToken}
        apiBaseUrl={activeApiBaseUrl}
        title={title}
        welcomeMessage={welcomeMessage}
        position={position}
        {...restProps}
      />
    </div>
  );
}
