# Pydah Universal Portal Switcher - Integration Guide (CDN)

The **Pydah Universal Portal Switcher** is a floating widget packaged as a lightweight, zero-dependency CDN script. It allows authenticated users in any Pydah portal (Fee Management, HRMS, SDMS, Transport, Hostel, Academics, EMS, Admissions) to seamlessly switch between their permitted portals with one click.

---

## 🌟 Key Capabilities

- **1-Line Embed**: Import via a single `<script>` tag.
- **Pure Web Component (Shadow DOM)**: 100% style-isolated. It will never conflict with Bootstrap, Tailwind, Material UI, or custom CSS in the host application.
- **Cross-Portal Permission Continuity**: When redirected from CRM or between portals, the widget automatically carries and persists the user's complete list of authorized portals in `localStorage`.
- **Live Permission Discovery**: If a user logs into a portal directly, the widget automatically contacts the CRM Auth Gateway to verify and discover their allowed portals across all campus databases.
- **Draggable Floating Button**: Users can drag the floating button anywhere on the screen so it never covers buttons or table rows. The position is remembered automatically.
- **Real-Time Search**: Instant filtering across all permitted portals.

---

## 🚀 1. Quick Start (HTML / Index.html)

Add this script tag right before the closing `</body>` tag of your application's `index.html`:

```html
<!-- Pydah Universal Portal Switcher CDN -->
<script 
  src="https://crm.pydah.edu.in/portal-switcher.js" 
  data-current-portal="fee-management" 
  async>
</script>
```

> 💡 **Important:** Replace `data-current-portal="fee-management"` with that specific app's ID (see [Portal IDs Reference](#-portal-ids-reference)).

### For Local Development Testing:
If you are developing or running portals locally on `localhost`:
```html
<script 
  src="http://localhost:5173/portal-switcher.js" 
  data-current-portal="fee-management"
  data-api-base-url="http://localhost:8000">
</script>
```

---

## ⚛️ 2. React / Next.js / Vite / Vue Integration

### Option A: In `index.html` (Recommended)
Simply place the `<script>` tag in your frontend's `index.html`. The widget will automatically:
1. Detect any active auth token (`accessToken`, `token`, `jwt`) and `user` object in `localStorage`.
2. Detect cross-portal authorized portals passed from the CRM launcher.
3. Automatically render the floating switcher button.

### Option B: Programmatic Initialization via JavaScript (App.jsx / AuthProvider)
If your application loads the user session asynchronously or uses custom state management:

```javascript
import { useEffect } from 'react';

function App() {
  const { user, token } = useAuth(); // Your local auth state

  useEffect(() => {
    if (window.PydahSwitcher && user) {
      window.PydahSwitcher.init({
        currentPortal: 'fee-management', // Your portal ID
        token: token || localStorage.getItem('token') || localStorage.getItem('accessToken'),
        user: user || JSON.parse(localStorage.getItem('user') || '{}'),
        position: 'bottom-right'
      });
    }
  }, [user, token]);

  return <YourComponents />;
}
```

---

## 📋 Configuration Attributes Reference

You can configure the widget using `data-*` attributes on the `<script>` tag or via `window.PydahSwitcher.init({})`:

| Attribute | Script Tag Attribute | Type | Default | Description |
|---|---|---|---|---|
| `currentPortal` | `data-current-portal` | `string` | `null` | **Required.** The portal ID of the current app (e.g. `'fee-management'`). |
| `apiBaseUrl` | `data-api-base-url` | `string` | `https://pydah-crm-backend.pydah.edu.in` (prod) / `http://localhost:8000` (dev) | Base URL of the CRM Auth Gateway. |
| `landingUrl` | `data-landing-url` | `string` | `https://crm.pydah.edu.in` | URL for the "Central Hub" link. |
| `position` | `data-position` | `string` | `'bottom-right'` | Initial corner (`'bottom-right'`, `'bottom-left'`). |
| `token` | N/A (JS only) | `string` | Auto-detected | The host portal's JWT auth token. |
| `user` | N/A (JS only) | `object` | Auto-detected | The host portal's authenticated user object. |

---

## 🏷️ Portal IDs Reference

Use these exact portal IDs for `data-current-portal`:

| Portal ID | Portal Name | Category | Production URL |
|---|---|---|---|
| `academic-portal` | Academic Portal | Academics & Faculty | `https://acad.pydah.edu.in` |
| `admissions-crm` | Admission Portal | Enrollment Management | `https://admissions.pydah.edu.in` |
| `examination-portal`| Examination Management (EMS) | Exams & Assessment | `https://ems.pydah.edu.in` |
| `fee-management` | Fee Management | Financial Operations | `https://fees.pydah.edu.in` |
| `hostel-automation` | Hostel Automation (HMS) | Facility Management | `https://hms.pydahsoft.in` |
| `hrms` | HRMS & Payroll | Staff Operations | `https://hrms.pydah.edu.in` |
| `student-portal` | Student Portal (SDMS) | Learning & Academics | `https://sdms.pydah.edu.in` |
| `transport-management` | Transport Management | Logistics Hub | `https://transport.pydah.edu.in` |

---

## 🔒 Session Replacement in Target Portals (Incoming SSO)

When a user switches into your portal via the switcher or CRM, an encrypted SSO token arrives in the URL query (`?token=...`).

To ensure that old cached sessions don't override the incoming login, include this snippet early in your application lifecycle (e.g. in `App.jsx` or `AuthProvider.jsx`):

```javascript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const ssoToken = urlParams.get('token');

  if (ssoToken) {
    // Clear old session so the incoming SSO login takes over cleanly
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
  }
}, []);
```
