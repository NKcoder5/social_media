import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (user && user.token) {
      console.log('🔌 Initializing unified socket connection...');
      
      // Force production URL for deployed version
      const SOCKET_URL = window.location.hostname === 'sociogram-1.onrender.com' 
        ? 'https://sociogram-n73b.onrender.com'
        : import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'https://social-media-pdbl.onrender.com';
      
      console.log('🌐 Socket connecting to:', SOCKET_URL);
      
      const newSocket = io(SOCKET_URL, {
        auth: {
          token: user.token
        },
        withCredentials: true,
        transports: ['websocket', 'polling'],
        forceNew: true
      });

      newSocket.on('connect', () => {
        console.log('✅ Unified socket connected to server');
        setIsConnected(true);
        
        // Join user's personal room
        newSocket.emit('joinUserRoom', { userId: user.id });
      });

      newSocket.on('disconnect', () => {
        console.log('❌ Unified socket disconnected');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('🔥 Socket connection error:', error);
        setIsConnected(false);
      });

      newSocket.on('error', (error) => {
        console.error('🔥 Socket error:', error);
      });

      setSocket(newSocket);

      return () => {
        console.log('🔌 Cleaning up unified socket connection...');
        newSocket.disconnect();
        setSocket(null);
        setIsConnected(false);
      };
    }
  }, [user]);

  const value = {
    socket,
    isConnected,
    // Helper methods
    joinConversation: (conversationId) => {
      if (socket) {
        socket.emit('joinConversation', { conversationId });
        console.log(`📞 Joined conversation: ${conversationId}`);
      }
    },
    leaveConversation: (conversationId) => {
      if (socket) {
        socket.emit('leaveConversation', { conversationId });
        console.log(`📞 Left conversation: ${conversationId}`);
      }
    },
    sendMessage: (messageData) => {
      if (socket) {
        socket.emit('sendMessage', messageData);
        console.log('📤 Message sent via socket:', messageData);
      }
    },
    sendTyping: (conversationId, isTyping) => {
      if (socket) {
        socket.emit('typing', { conversationId, isTyping });
      }
    }
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
