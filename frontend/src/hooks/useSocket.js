import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const useSocket = (user) => {
  const socket = useRef(null);

  useEffect(() => {
    if (user && user.token) {
      // Initialize socket connection
      // Force production URL for deployed version
      const SOCKET_URL = window.location.hostname === 'sociogram-1.onrender.com' 
        ? 'https://sociogram-n73b.onrender.com'
        : import.meta.env.VITE_SOCKET_URL || 'https://social-media-pdbl.onrender.com';
      socket.current = io(SOCKET_URL, {
        auth: {
          token: user.token
        },
        withCredentials: true
      });

      socket.current.on('connect', () => {
        console.log('Connected to server');
      });

      socket.current.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      socket.current.on('connect_error', (error) => {
        console.error('Connection error:', error);
      });

      return () => {
        if (socket.current) {
          socket.current.disconnect();
        }
      };
    }
  }, [user]);

  const joinConversation = (conversationId) => {
    if (socket.current) {
      socket.current.emit('joinConversation', { conversationId });
    }
  };

  const leaveConversation = (conversationId) => {
    if (socket.current) {
      socket.current.emit('leaveConversation', { conversationId });
    }
  };

  const sendMessage = (messageData) => {
    if (socket.current) {
      socket.current.emit('sendMessage', messageData);
    }
  };

  const sendTyping = (conversationId, isTyping) => {
    if (socket.current) {
      socket.current.emit('typing', { conversationId, isTyping });
    }
  };

  const onReceiveMessage = (callback) => {
    if (socket.current) {
      socket.current.on('receiveMessage', callback);
    }
  };

  const onUserTyping = (callback) => {
    if (socket.current) {
      socket.current.on('userTyping', callback);
    }
  };

  const onMessageDeleted = (callback) => {
    if (socket.current) {
      socket.current.on('messageDeleted', callback);
    }
  };

  const onMessageRead = (callback) => {
    if (socket.current) {
      socket.current.on('messageRead', callback);
    }
  };

  const onUserStatusUpdate = (callback) => {
    if (socket.current) {
      socket.current.on('userStatusUpdate', callback);
    }
  };

  const offReceiveMessage = (callback) => {
    if (socket.current) {
      socket.current.off('receiveMessage', callback);
    }
  };

  const offUserTyping = (callback) => {
    if (socket.current) {
      socket.current.off('userTyping', callback);
    }
  };

  const offMessageDeleted = (callback) => {
    if (socket.current) {
      socket.current.off('messageDeleted', callback);
    }
  };

  const offMessageRead = (callback) => {
    if (socket.current) {
      socket.current.off('messageRead', callback);
    }
  };

  const offUserStatusUpdate = (callback) => {
    if (socket.current) {
      socket.current.off('userStatusUpdate', callback);
    }
  };

  return {
    socket: socket.current,
    joinConversation,
    leaveConversation,
    sendMessage,
    sendTyping,
    onReceiveMessage,
    onUserTyping,
    onMessageDeleted,
    onMessageRead,
    onUserStatusUpdate,
    offReceiveMessage,
    offUserTyping,
    offMessageDeleted,
    offMessageRead,
    offUserStatusUpdate
  };
};

export default useSocket;
