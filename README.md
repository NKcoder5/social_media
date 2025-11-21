# Sociogram

A modern social media platform with real-time messaging, AI integration, and comprehensive social features, featuring an always-available AI assistant chat bubble.

## Description

Sociogram is a full-stack social media application that combines traditional social networking features with advanced messaging capabilities and an AI-powered assistant. The platform offers a seamless user experience with an always-accessible AI chat bubble that provides instant help and enhances user engagement.

## Tech Stack

### Backend
- **Node.js** + **Express.js** - Server framework
- **PostgreSQL** + **Prisma ORM** - Database and ORM
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **Multer** + **Sharp** - File upload and processing
- **bcryptjs** - Password hashing

### Frontend
- **React 19** - UI framework
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client
- **Socket.io Client** - Real-time features
- **Vite** - Build tool

### AI Integration
- **NVIDIA API** - AI chat assistant and smart features
- **Always-Available Chat Bubble** - Persistent AI assistant accessible from any screen
- **Context-Aware Assistance** - AI understands the current page and user context
- **Interactive Help** - Get guidance on using platform features in real-time

## Core Features

### Authentication & Access
- Email/password registration and login with JWT-based sessions.
- Protected routes on the frontend using `ProtectedRoute` / `PublicRoute`.
- Persistent auth using local storage and automatic profile refresh.

### Layout & Navigation
- Left sidebar navigation for Feed, Messages, Create, Reels, Activity, Profile, Settings.
- Responsive layout with sticky feed header and right-hand sidebar widgets.
- Global floating AI assistant chat bubble pinned to the **bottom-right** on most pages.

### Feed & Posts
- Personalized home feed (`For You`, `Following`, `Trending` tabs).
- Rich posts with captions and images.
- Inline actions: like, comment, share, bookmark.
- Real-time like/comment counts with notification fan-out to post owners.
- Inline comment composer with "view all comments" expansion.
- Post reactions (emoji bar) powered by `PostReactions`.

### Stories
- Instagram-style stories row at the top of the feed.
- Create story modal with text or media stories.
- Story viewer with auto-advance, progress bars, and tap navigation.
- Viewed/unviewed state and server-side "mark as viewed" tracking.

### Reels
- Full-screen vertical short-video experience.
- Keyboard and touch navigation (Arrow keys / swipe up & down).
- Play/pause, mute/unmute, progress bar, and overlay controls.
- Inline like, comment, share, and follow actions.

### Profiles & Settings
- Public profile pages with post grid, bio, follower/following counts.
- Own profile has quick actions to edit profile picture and open **Settings**.
- Settings page with tabs for Profile, Notifications, Privacy, Security, Account.
- Basic toggles for push/email/message notifications and privacy options.
- Account tab with sign-out and "danger zone" delete-account UI.

### Follow System & Discovery
- Suggested users panel on the feed sidebar and dedicated **Discover** page.
- Follow/unfollow with mutual-connection detection (followers vs following).
- Discovery page with:
  - Global search across users and posts.
  - Suggested users grid with follow + "start chat" actions.
  - Explore posts grid and "Trending Posts" section.
  - Trending hashtags with category and usage counts.

### Notifications
- In-feed notification bell with unread indicator.
- Dedicated notifications view with tabs for:
  - All, Unread, Likes, Comments, Follows.
- Notifications generated from real post likes/comments and follow events.
- Per-notification read state and "Mark all read" control.

### Activity Dashboard & Analytics
- Activity dashboard with three tabs: **Analytics**, **Discover**, **Trending**.
- Real stats driven by your actual posts and followers:
  - Total posts, followers, following, likes, views, engagement rate.
- Recent activity feed built from real notifications and interactions.
- Top-performing posts section with thumbnail, likes, comments, reach, engagement.
- Discovery panel inside Activity with suggested users and trending topics.

### Messaging
- Central messages page for all conversations.
- Real-time 1-to-1 and group chat using Socket.io.
- Conversation list with unread counts and last message previews.
- Group chats with people you follow.
- Send text messages and share media (images, videos, files).
- Emoji reactions, replies, edit/delete (your own messages), star/save, forward, and report.
- Read receipts (sent, delivered, read) and basic online/offline indicators.
- Message search with support for filters and search history.

### AI Experiences
- Floating AI assistant chat bubble (bottom-right):
  - Always available on most pages.
  - Context-aware help about main screens (Feed, Messages, Stories, Reels, Profile, Activity, Explore, Create).
  - Quick question chips and typing indicator.
  - Copy-to-clipboard and text-to-speech for responses.
  - Minimize and **Close** buttons so you can hide it when you don’t need it.
  - Automatically hidden on dedicated messaging pages to avoid overlap.
- In-messages AI helper:
  - Chat with AI from inside the messaging hub.
  - Improve or rewrite message drafts.
  - Translate drafts to other languages.
  - Get smart reply suggestions and conversation starters.

### Stories, Reels & Trending Content
- 24-hour stories with viewed/unviewed styling and progress bars.
- Short-video reels with keyboard/touch navigation and control hints overlay.
- Static but realistic "Trending today" widget with example hashtags.

## User Flow

1. **Sign Up / Login** – Create an account or sign back in.
2. **Complete Profile** – Update profile picture and bio from the Profile or Settings page.
3. **Discover People** – Use Discover/Explore and suggestions to find users.
4. **Follow Users** – Build your network so their posts appear in your feed.
5. **Create Stories & Posts** – Share photos, reels, and text updates.
6. **Engage with Content** – Like, comment, react, and share posts and reels.
7. **Chat** – Use Messages for 1-to-1 or group chat and media sharing.
8. **Use AI Helpers** – Ask the floating assistant or open the in-messages AI helper for writing/translation help.
9. **Track Activity** – View analytics, notifications, and trending content from the Activity and Notifications views.
10. **Tune Settings** – Adjust notification, privacy, and account settings as needed.

## Installation

### Prerequisites
- Node.js (v16+)
- PostgreSQL
- npm/yarn

### Setup
```bash
# Clone repository
git clone <repo-url>
cd sociogram

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Configure environment
# Backend: Create .env with DATABASE_URL, JWT_SECRET, etc.
# Frontend: Create .env with VITE_API_URL, VITE_SOCKET_URL

# Setup database
cd backend
npx prisma generate
npx prisma db push

# Start development servers
npm run dev  # Backend (port 8000)
cd ../frontend
npm run dev  # Frontend (port 5001)
```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/sociogram"
JWT_SECRET="your-jwt-secret"
NVIDIA_API_KEY="your-nvidia-api-key"
PORT=8000
```

### Frontend (.env)
```env
VITE_API_URL=https://social-media-pdbl.onrender.com/api/v1
VITE_SOCKET_URL=https://social-media-pdbl.onrender.com
```

