import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;
const connectedUsers = new Map();

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Build a matching allowlist for sockets
        const allowed = [
          process.env.FRONTEND_URL || "https://social-media-1-lzs4.onrender.com",
          "https://social-media-pdbl.onrender.com",
          "https://sociogram-1.onrender.com",
          "https://sociogram-n73b.onrender.com",
          "http://localhost:5001",
          "http://localhost:5000",
          "http://127.0.0.1:5000",
          "http://localhost:5176",
          "http://localhost:5175",
          "http://127.0.0.1:5175",
          "http://localhost:8000",
          "http://127.0.0.1:8000",
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          `https://${process.env.REPLIT_DEV_DOMAIN}`,
          `http://${process.env.REPLIT_DEV_DOMAIN}`
        ];

        // Allow non-browser clients without origin
        if (!origin) return callback(null, true);

        if (allowed.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ["GET", "POST"],
      credentials: true,
      allowEIO3: true
    }
  });

  // Socket authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.userId}`);

    // Join user to their personal room with user_ prefix
    socket.join(`user_${socket.userId}`);
    
    // Store user socket mapping
    connectedUsers.set(socket.userId, socket.id);

    // Handle joining conversation rooms
    socket.on('joinConversation', ({ conversationId }) => {
      socket.join(conversationId);
      console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    });

    // Handle leaving conversation rooms
    socket.on('leaveConversation', ({ conversationId }) => {
      socket.leave(conversationId);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    // Handle sending messages
    socket.on('sendMessage', async (messageData) => {
      console.log('Socket received message:', messageData);
      
      // Emit to conversation participants
      if (messageData.conversationId) {
        socket.to(messageData.conversationId).emit('receiveMessage', messageData);
        // Also emit to all connected clients for this conversation
        io.to(messageData.conversationId).emit('receiveMessage', messageData);
      }
      
      // Create notification for message recipient
      if (messageData.receiverId && messageData.senderId !== messageData.receiverId) {
        try {
          // Import prisma and notification controller dynamically
          const { PrismaClient } = await import('@prisma/client');
          const prisma = new PrismaClient();
          
          // Create notification in database
          const notification = await prisma.notification.create({
            data: {
              type: 'message',
              message: `${messageData.senderName || 'Someone'} sent you a message`,
              senderId: messageData.senderId,
              receiverId: messageData.receiverId,
              isRead: false,
              metadata: {
                messageId: messageData.id,
                conversationId: messageData.conversationId,
                messageText: messageData.message?.substring(0, 50) + (messageData.message?.length > 50 ? '...' : ''),
                messageType: messageData.type || 'text'
              }
            },
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  profilePicture: true
                }
              }
            }
          });
          
          // Emit notification to receiver
          socket.to(`user_${messageData.receiverId}`).emit('newNotification', notification);
          
          await prisma.$disconnect();
        } catch (error) {
          console.error('Error creating message notification:', error);
        }
      }
    });

    // Handle typing indicators
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit('userTyping', {
        userId: socket.userId,
        isTyping
      });
    });

    // Handle user status updates
    socket.on('updateStatus', ({ status }) => {
      socket.broadcast.emit('userStatusUpdate', {
        userId: socket.userId,
        status
      });
    });

    // Handle message deletion
    socket.on('deleteMessage', ({ messageId, conversationId }) => {
      socket.to(conversationId).emit('messageDeleted', { messageId });
    });

    // Handle message reactions
    socket.on('messageReaction', async ({ messageId, emoji, action, conversationId }) => {
      console.log('📝 Message reaction:', { messageId, emoji, action, userId: socket.userId });
      
      try {
        // Import prisma dynamically to avoid circular imports
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        
        if (action === 'add') {
          // Add reaction to database
          await prisma.messageReaction.upsert({
            where: {
              messageId_userId_emoji: {
                messageId,
                userId: socket.userId,
                emoji
              }
            },
            update: {},
            create: {
              messageId,
              userId: socket.userId,
              emoji
            }
          });
        } else if (action === 'remove') {
          // Remove reaction from database
          await prisma.messageReaction.deleteMany({
            where: {
              messageId,
              userId: socket.userId,
              emoji
            }
          });
        }
        
        await prisma.$disconnect();
      } catch (error) {
        console.error('Error handling reaction in database:', error);
      }
      
      // Emit to all users in the conversation
      io.to(conversationId).emit('messageReaction', {
        messageId,
        emoji,
        action,
        userId: socket.userId
      });
    });

    // Group-specific socket events
    socket.on('groupCreated', ({ group, participantIds }) => {
      console.log('👥 Group created:', group.id);
      // Notify all participants about the new group
      participantIds.forEach(participantId => {
        socket.to(`user_${participantId}`).emit('newGroup', group);
      });
    });

    socket.on('groupUpdated', ({ group, participantIds }) => {
      console.log('👥 Group updated:', group.id);
      // Notify all participants about group updates
      participantIds.forEach(participantId => {
        socket.to(`user_${participantId}`).emit('groupUpdate', group);
      });
    });

    socket.on('memberAdded', ({ group, newMemberId, participantIds }) => {
      console.log('👥 Member added to group:', group.id);
      // Notify all participants including the new member
      [...participantIds, newMemberId].forEach(participantId => {
        socket.to(`user_${participantId}`).emit('groupMemberAdded', { group, newMemberId });
      });
    });

    socket.on('memberRemoved', ({ group, removedMemberId, participantIds }) => {
      console.log('👥 Member removed from group:', group.id);
      // Notify all remaining participants
      participantIds.forEach(participantId => {
        socket.to(`user_${participantId}`).emit('groupMemberRemoved', { group, removedMemberId });
      });
      // Notify the removed member
      socket.to(`user_${removedMemberId}`).emit('removedFromGroup', { group });
    });

    socket.on('groupDeleted', ({ groupId, participantIds }) => {
      console.log('👥 Group deleted:', groupId);
      // Notify all participants about group deletion
      participantIds.forEach(participantId => {
        socket.to(`user_${participantId}`).emit('groupDeleted', { groupId });
      });
    });

    socket.on('adminRoleChanged', ({ group, userId, action, participantIds }) => {
      console.log('👥 Admin role changed:', { groupId: group.id, userId, action });
      // Notify all participants about role changes
      participantIds.forEach(participantId => {
        socket.to(`user_${participantId}`).emit('groupAdminChanged', { group, userId, action });
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      
      // Remove user from connected users
      connectedUsers.delete(socket.userId);
      
      // Broadcast user offline status
      socket.broadcast.emit('userStatusUpdate', {
        userId: socket.userId,
        status: 'offline'
      });
    });
  });

  return io;
};

export const getSocketInstance = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export const getReceiverSocketId = (userId) => {
  return connectedUsers.get(userId);
};

export default { initializeSocket, getSocketInstance, getReceiverSocketId };
