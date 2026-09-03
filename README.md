# Aurora Chat

Aurora Chat is a full-stack MERN real-time messaging and one-to-one calling app. It includes phone OTP authentication, MongoDB models, REST APIs, Socket.IO messaging/presence/signaling, local authenticated media uploads, browser voice notes, WebRTC voice/video calls, groups, statuses, notifications, privacy settings, and a responsive light/dark React UI.

## Stack

- MongoDB with Mongoose
- Express.js and Node.js
- React with Vite
- React Router, Context API, Axios
- Socket.IO for real-time messaging, presence, typing, read receipts, and WebRTC signaling
- WebRTC for peer-to-peer voice and video media

## Setup

```bash
cp .env.example .env
npm run install:all
npm run seed
npm run dev
```

The client runs at `http://localhost:5173` and the API runs at `http://localhost:5001`.

For production, replace all secrets in `.env`, configure a real SMS provider in `server/services/smsService.js`, configure object storage for media, and run behind HTTPS so WebRTC and media permissions work reliably.

## Authentication

The login flow is:

1. Enter country code and phone number.
2. `POST /api/auth/send-otp` creates a hashed OTP record with TTL expiration.
3. In development, the OTP is returned in the response and logged to the server console.
4. `POST /api/auth/verify-otp` validates attempts and expiration, creates the user if needed, returns a JWT, and sets an HTTP-only cookie.
5. The client persists the JWT for API and Socket.IO auth.

Never use the development OTP behavior in production. Set `NODE_ENV=production` and provide real SMS credentials.

## API

Main route groups:

- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/logout`
- `GET /api/users/me`
- `PUT /api/users/me`
- `GET /api/users/:id`
- `GET /api/contacts?q=`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id`
- `GET /api/messages/:conversationId`
- `POST /api/messages`
- `PUT /api/messages/:id`
- `DELETE /api/messages/:id`
- `POST /api/messages/:id/reaction`
- `PUT /api/messages/:conversationId/read`
- `POST /api/groups`
- `PUT /api/groups/:id`
- `POST /api/groups/:id/members`
- `DELETE /api/groups/:id/members/:userId`
- `POST /api/status`
- `GET /api/status`
- `PUT /api/status/:id/view`
- `DELETE /api/status/:id`
- `GET /api/calls`
- `POST /api/calls`
- `GET /api/notifications`
- `PUT /api/notifications/:id/read`
- `POST /api/upload`
- `GET /api/upload/media/:filename`

## Socket.IO Events

Authenticated clients can use:

- `conversation:join`, `conversation:leave`
- `message:send`, `message:new`, `message:delivered`, `message:read`, `message:delete`, `message:edit`, `message:reaction`
- `typing:start`, `typing:stop`
- `user:online`, `user:offline`, `user:lastSeen`
- `call:initiate`, `call:ring`, `call:accept`, `call:reject`, `call:end`
- `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`

The server verifies Socket.IO JWTs and checks conversation membership before a socket can join private or group conversation rooms.

## Development Notes

- Local uploads are stored in `server/uploads/media` and are only served through authenticated API routes.
- Status posts have a MongoDB TTL index via `expiresAt`.
- OTP records have a MongoDB TTL index and store only HMAC hashes.
- Rate limiting, Helmet, CORS, input validation, query sanitization, and centralized error handling are enabled.
- Browser microphone/camera access requires localhost or HTTPS.

## Useful Commands

```bash
npm install
npm run install:all
npm run dev
npm run build
npm start
npm run seed
```
