# Deployment Guide - Environment-Agnostic Configuration

This application is now configured to work across different deployment environments without hardcoded URLs.

## Environment Variables

### Frontend (`/app/frontend/.env`)

```env
# Backend URL - automatically detects from current origin if empty
# Only set this if backend is on a different domain/port
REACT_APP_BACKEND_URL=

# WebSocket port for development (can be left as-is)
WDS_SOCKET_PORT=443
```

**How it works:**
- If `REACT_APP_BACKEND_URL` is empty or not set, the frontend will use `window.location.origin`
- This means frontend and backend must be served from the same domain
- For development with separate domains, set the full backend URL

### Backend (`/app/backend/.env`)

```env
# MongoDB connection - update for your environment
MONGO_URL="mongodb://localhost:27017"

# Database name
DB_NAME="your_database_name"

# CORS - use * for development, specific origins for production
CORS_ORIGINS="*"

# JWT Secret - MUST be changed in production
JWT_SECRET="your-secure-secret-here"

# Admin credentials
ADMIN_USERNAME="admin@yourdomain.com"
ADMIN_PASSWORD_HASH="sha256_hash_of_password"
```

## Deployment Checklist

### 1. **Same-Domain Deployment** (Recommended)
When frontend and backend are served from the same domain (e.g., `https://yourdomain.com`):

✅ **Frontend .env:**
```env
REACT_APP_BACKEND_URL=
```
Leave empty - it will auto-detect the origin

✅ **Backend .env:**
- Update `MONGO_URL` to your MongoDB instance
- Set a secure `JWT_SECRET`
- Update `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`
- Set `CORS_ORIGINS` to your domain: `https://yourdomain.com`

### 2. **Different-Domain Deployment**
When frontend is on `https://app.yourdomain.com` and backend on `https://api.yourdomain.com`:

✅ **Frontend .env:**
```env
REACT_APP_BACKEND_URL=https://api.yourdomain.com
```

✅ **Backend .env:**
- Update all MongoDB and auth settings as above
- Set `CORS_ORIGINS=https://app.yourdomain.com`

### 3. **Local Development**
For running locally with different ports:

✅ **Frontend .env:**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

✅ **Backend .env:**
```env
CORS_ORIGINS=http://localhost:3000
```

## How the Dynamic Configuration Works

### Frontend Configuration Flow:

1. **Build-time:** React app reads `REACT_APP_BACKEND_URL` from `.env`
2. **Runtime:** `/public/config.js` provides fallback logic
3. **Priority:**
   - First: Use `REACT_APP_BACKEND_URL` if set
   - Fallback: Use `window.location.origin` (same domain)

### Key Files:

- `/app/frontend/public/config.js` - Runtime configuration
- `/app/frontend/src/config.js` - Centralized API configuration
- All components import from `src/config.js` instead of using `process.env` directly

## API Routes

All API endpoints are prefixed with `/api`:
- Articles: `/api/articles`
- Navigation: `/api/navigation`  
- Upload: `/api/admin/upload`
- Uploaded files: `/api/uploads/{filename}`

## Security Notes

🔐 **Before deploying to production:**

1. Change `JWT_SECRET` to a long, random string
2. Update `ADMIN_PASSWORD_HASH` with your admin password:
   ```bash
   echo -n "your_password" | sha256sum
   ```
3. Set specific `CORS_ORIGINS` (not `*`)
4. Ensure MongoDB is not publicly accessible
5. Use HTTPS for all production deployments

## Testing After Deployment

1. ✅ Check homepage loads
2. ✅ Navigate to an article
3. ✅ Check images display correctly
4. ✅ Try admin login at `/admin/login`
5. ✅ Upload a test image in admin panel
6. ✅ Verify image displays in article

## Troubleshooting

### Images not loading
- Check uploaded files are served via `/api/uploads/` route
- Verify CORS headers in browser network tab
- Ensure backend is accessible from frontend domain

### API calls failing (404)
- Check `REACT_APP_BACKEND_URL` is set correctly
- Verify backend is running and accessible
- Check browser console for actual URLs being called

### Admin login not working
- Verify `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` in backend `.env`
- Check `JWT_SECRET` is set
- Look for authentication errors in backend logs

## Environment Migration

When moving from one environment to another:

1. Update frontend `.env` with new backend URL (or leave empty for same-domain)
2. Update backend `.env` with:
   - New MongoDB connection string
   - New CORS_ORIGINS
   - Keep same JWT_SECRET if migrating data
3. Rebuild frontend if REACT_APP_BACKEND_URL changed
4. Restart both services
5. Test all functionality

---

For more help, check the code documentation in:
- `/app/frontend/src/config.js` - Frontend API configuration
- `/app/backend/server.py` - Backend API routes
