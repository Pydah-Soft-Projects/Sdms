import { API_URL } from './api';

/**
 * Route maintenance endpoints to internal backend API (/api/tickets, /api/complaint-categories)
 * which communicates with maintenance_db.
 */
export const maintenanceApiUrl = (path) =>
  `/${path.replace(/^\/+/, '')}`;

export const maintenanceFileUrl = (path) => {
  if (!path || /^(https?:|data:)/i.test(path)) return path || '';
  const apiOrigin = new URL(API_URL, window.location.origin);
  apiOrigin.pathname = apiOrigin.pathname.replace(/\/api\/?$/, '');
  return new URL(path.replace(/^\/+/, ''), `${apiOrigin.href.replace(/\/?$/, '/')}`).href;
};
