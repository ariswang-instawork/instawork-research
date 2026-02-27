# Instawork OAuth App

## Overview
A web application that implements OAuth 2.0 Authorization Code Flow with Instawork. Users can authenticate with their Instawork account and view their profile data.

## Architecture
- **Frontend**: React + Vite with Tailwind CSS and shadcn/ui components
- **Backend**: Express.js with session-based token storage
- **Routing**: wouter (frontend), Express (backend)
- **State Management**: TanStack React Query

## OAuth Flow
1. User clicks "Connect with Instawork" button
2. Frontend requests the authorization URL from `GET /api/auth/login`
3. Browser redirects to Instawork's `/oauth2/authorize/` endpoint
4. User consents on Instawork's page
5. Instawork redirects back to `/api/auth/callback?code=...`
6. Backend exchanges the code for an access token via `POST /oauth2/token/`
7. Token is stored in the server-side session
8. Frontend calls `GET /api/users/me` which proxies to Instawork's API
9. User profile data is rendered on the page

## Environment Variables
- `INSTAWORK_CLIENT_ID` (secret) - OAuth client ID
- `INSTAWORK_CLIENT_SECRET` (secret) - OAuth client secret
- `SESSION_SECRET` (secret) - Express session encryption key
- `INSTAWORK_BASE_URL` (env) - Base URL for Instawork API (default: http://localhost:8080)

## Key Files
- `server/routes.ts` - Backend OAuth routes and API proxy
- `client/src/pages/home.tsx` - Main page with login/profile UI
- `client/src/App.tsx` - App router setup

## API Endpoints
- `GET /api/auth/login` - Returns Instawork authorize URL
- `GET /api/auth/callback` - OAuth callback, exchanges code for token
- `GET /api/auth/status` - Returns authentication status
- `GET /api/auth/logout` - Destroys session
- `GET /api/users/me` - Proxies to Instawork's user profile API
