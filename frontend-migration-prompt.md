# Frontend Migration Prompt - Hetzner Backend Cutover

Update the frontend repository so the Next.js app talks to the Hetzner-hosted Charlie AI backend instead of the old AWS EC2 endpoint.

## Required Changes

1. Replace the backend base URL used by the chat widget and any server-side API callers.
2. Update any hard-coded AWS EC2 IP references to the new Hetzner public IP or domain.
3. Update CORS allowlists so the backend accepts the live frontend origin.
4. Verify the frontend calls `POST /v1/chat` on the new host.
5. Verify any social/admin debug calls still target `GET /api/social/status`, `POST /api/social/test/bluesky`, `POST /api/social/test/x`, and `POST /api/social/check-interactions`.

## Environment Variables to Review

- `AI_SERVER_URL` or equivalent backend base URL variable
- Frontend public site URL used in browser-origin checks
- Any proxy-specific env var used for the widget or API route handler

## DNS and Origin Updates

- Point the backend hostname at the Hetzner server.
- Ensure the frontend origin is listed in backend `ALLOWED_ORIGINS`.
- If the frontend and backend use different domains, confirm the browser widget is not relying on credentialed requests.

## Validation

- Load the frontend in the browser and submit a real chat message.
- Confirm the browser network tab shows a 200 response from the Hetzner backend.
- Confirm no CORS errors appear in the console.
