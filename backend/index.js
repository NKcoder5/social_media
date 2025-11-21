import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import connectDB from "./utils/db.js";
import userRoute from "./routes/user.route.js";
import postRoute from "./routes/post.route.js";
import messageRoute from "./routes/message.route.js";
import seedRoute from "./routes/seed.route.js";
import notificationRoute from "./routes/notification.route.js";
import groupRoute from "./routes/group.route.js";
import exploreRoute from "./routes/explore.route.js";
import storyRoute from "./routes/story.route.js";
import { initializeSocket } from "./config/socket.js";
import { startStoryCleanupScheduler } from "./utils/storyCleanup.js";
import { initializeFirebaseAdmin } from "./config/firebase-admin.js";
import path from "path";

// Load environment variables from both project root and backend directory
dotenv.config({});
try {
    const rootDotenvLoaded = dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    const backendDotenvLoaded = dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
    const aiKeyPresent = Boolean(process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[env] root .env loaded: ${!rootDotenvLoaded.error}, backend .env loaded: ${!backendDotenvLoaded.error}, AI key present: ${aiKeyPresent}`);
    }
} catch {}

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

const PORT = process.env.PORT || 8000;

//middlewares
app.use(express.json());
app.use(cookieParser());
    // Build an allowlist and use a dynamic origin function so the server
    // echoes the allowed origin back in the Access-Control-Allow-Origin header.
    const ALLOWED_ORIGINS = [
        // Prefer explicit FRONTEND_URL from environment when available
        process.env.FRONTEND_URL || 'https://social-media-1-lzs4.onrender.com',
        // Backend (self) and known frontend deployments
        'https://social-media-pdbl.onrender.com',
        'https://sociogram-1.onrender.com',
        'https://sociogram-n73b.onrender.com',
        // Local development URLs
        'http://localhost:5001',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://localhost:5176',
        'http://localhost:5175',
        'http://127.0.0.1:5175',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        // Replit dynamic domain (if used)
        `https://${process.env.REPLIT_DEV_DOMAIN}`,
        `http://${process.env.REPLIT_DEV_DOMAIN}`
    ];

    const corsOptions = {
        origin: (origin, callback) => {
            // Allow non-browser requests like Postman (no origin)
            if (!origin) return callback(null, true);

            if (ALLOWED_ORIGINS.includes(origin)) {
                return callback(null, true);
            }

            // If origin is not allowed, return an explicit error (browser will block)
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
    };
app.use(cors(corsOptions));

// Handle preflight requests
// app.options('*', cors(corsOptions));

//yha pr apni api ayengi
app.use("/api/v1/user", userRoute);
app.use("/api/v1/auth", userRoute); // Also expose auth endpoints under /auth
app.use("/api/v1/post", postRoute);
app.use("/api/v1/message", messageRoute);
app.use("/api/v1/group", groupRoute);
app.use("/api/v1/admin", seedRoute);
app.use("/api/v1/notifications", notificationRoute);
app.use("/api/v1/explore", exploreRoute);
app.use("/api/v1/story", storyRoute);

// Add upload route back
import uploadRoute from "./routes/upload.route.js";
app.use("/api/v1/upload", uploadRoute);

// Add reaction routes
// import reactionRoute from "./routes/reaction.route.js";
// app.use("/api/v1/reaction", reactionRoute);

// Serve static files for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const __dirname = path.resolve();

// API-only mode for backend service
app.get("/", (req,res)=>{
    res.json({ 
        message: "Sociogram API Server", 
        status: "running",
        environment: process.env.NODE_ENV || "development",
        version: "3.0.0",
        endpoints: {
            users: "/api/v1/user",
            posts: "/api/v1/post", 
            messages: "/api/v1/message",
            groups: "/api/v1/group",
            notifications: "/api/v1/notifications",
            upload: "/api/v1/upload",
            explore: "/api/v1/explore",
            stories: "/api/v1/story"
        }
    });
});

// Health check endpoint
app.get("/health", (req,res)=>{
    res.json({ 
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

server.listen(PORT, async () => {
    connectDB();
    
    // Initialize Firebase Admin
    try {
        await initializeFirebaseAdmin();
        console.log('🔥 Firebase Admin initialized');
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error);
    }
    
    console.log(`Server listening at port ${PORT}`);
    console.log(`Socket.io server ready for connections`);
    
    // Start story cleanup scheduler
    startStoryCleanupScheduler();
});
