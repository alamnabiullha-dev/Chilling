# 💬 Aurora Chat

**Aurora Chat** is a modern, full-stack **real-time messaging and calling application** built with the MERN stack. Inspired by modern communication platforms like WhatsApp, it provides secure phone OTP authentication, real-time messaging, group conversations, status sharing, notifications, and voice/video calling.

> 🚀 A full-stack real-time communication platform focused on **modern UI, secure authentication, real-time communication, and scalable backend architecture**.

---

## ✨ Features

### 🔐 Authentication

* Phone number authentication
* OTP-based login
* Secure OTP hashing
* OTP expiration
* Maximum OTP verification attempts
* JWT authentication
* HTTP-only authentication cookies
* Automatic user creation for new users

### 💬 Real-Time Messaging

* One-to-one conversations
* Real-time messages with Socket.IO
* Message delivery status
* Read receipts
* Message editing
* Message deletion
* Message reactions
* Typing indicators
* Online/offline presence
* Last seen information

### 👥 Groups

* Create group conversations
* Add and remove members
* Update group information
* Group messaging
* Real-time group communication

### 📞 Voice & Video Calling

* One-to-one voice calls
* One-to-one video calls
* Incoming call notifications
* Accept/reject calls
* End calls
* WebRTC peer-to-peer communication
* Socket.IO signaling
* Microphone and camera controls

### 📸 Status

* Create status posts
* View statuses
* Status view tracking
* Delete statuses
* Automatic status expiration using MongoDB TTL indexes

### 🔔 Notifications

* Real-time notifications
* Message notifications
* Call notifications
* Notification read/unread state

### 🔒 Privacy & Security

* JWT authentication
* HTTP-only cookies
* Hashed OTP storage
* OTP expiration
* Rate limiting
* Helmet security headers
* CORS protection
* Input validation
* Query sanitization
* Centralized error handling
* Protected API routes

### 🎨 Modern UI

* Responsive design
* Light mode
* Dark mode
* Mobile-friendly interface
* WhatsApp-inspired chat experience
* Real-time UI updates

---

# 🛠️ Tech Stack

### Frontend

* React.js
* Vite
* React Router
* Context API
* Axios
* CSS

### Backend

* Node.js
* Express.js
* Socket.IO
* JWT
* WebRTC

### Database

* MongoDB
* Mongoose

### Authentication

* Phone OTP
* JWT
* HTTP-only cookies

### Real-Time Communication

* Socket.IO
* WebRTC

---

# ⚡ Socket.IO Events

Aurora Chat uses **Socket.IO** to power real-time messaging, presence, typing indicators, notifications, and call signaling.

### Messaging

```text
conversation:join
conversation:leave

message:send
message:new
message:delivered
message:read
message:delete
message:edit
message:reaction
```

### Typing

```text
typing:start
typing:stop
```

### Presence

```text
user:online
user:offline
user:lastSeen
```

### Calling

```text
call:initiate
call:ring
call:accept
call:reject
call:end
```

### WebRTC

```text
webrtc:offer
webrtc:answer
webrtc:ice-candidate
```

---

# 📞 WebRTC Calling

Aurora Chat uses **WebRTC** for peer-to-peer voice and video communication.

```text
Caller
  │
  ├── Call Request
  │
  ▼
Socket.IO Signaling
  │
  ├── WebRTC Offer
  ├── WebRTC Answer
  └── ICE Candidates
  │
  ▼
Receiver
  │
  ▼
Peer-to-Peer Connection
  │
  ├── 🎤 Voice
  └── 📹 Video
```

For production, the application should run over **HTTPS**, because browsers require a secure context for microphone and camera access.

---

# 🔐 Security Notes

This project includes several security measures, but production deployments should still be configured carefully.

Never commit:

```text
.env
API keys
MongoDB passwords
JWT secrets
OTP secrets
SMS credentials
Cloud storage credentials
```

Use environment variables for all sensitive configuration.

---

# 🚧 Future Improvements

Possible future features:

* 🔐 End-to-end encryption
* 👤 Profile customization
* 📍 Live location sharing
* 📎 Advanced document sharing
* 🎙️ Group voice/video calls
* 🔔 Push notifications
* 📱 PWA support
* 🖥️ Desktop application
* 🔎 Advanced message search
* 🗃️ Cloud media storage
* 🌍 Multi-language support

---

# 👨‍💻 Author

**Nabiullha Alam**

Full-Stack Developer focused on building **modern MERN applications, real-time web experiences, and scalable full-stack solutions**.

### 💻 Core Focus

* Full-Stack Web Development
* MERN Stack
* Real-Time Applications
* REST APIs
* WebRTC
* Socket.IO
* MongoDB

---

# ⭐ Support

If you like **Aurora Chat**, consider giving the repository a ⭐ on GitHub.

Built with ❤️ using the **MERN Stack, Socket.IO & WebRTC**.
