import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { 
  SparklesIcon, 
  MagnifyingGlassIcon,
  UserGroupIcon,
  ChatBubbleLeftIcon,
  UserPlusIcon,
  Cog6ToothIcon,
  XMarkIcon,
  MicrophoneIcon,
  StopIcon,
  FaceSmileIcon
} from '@heroicons/react/24/outline';

// Import all our components
import AIAssistant from './AIAssistant';
import VoiceMessages, { VoiceMessageDisplay } from './VoiceMessages';
import VideoCall from './VideoCall';
import MediaSharing, { MediaDisplay } from './MediaSharing';
import GroupChat from './GroupChat';
import GroupSettings from './GroupSettings';
import MessageReactions, { QuickReactionBar } from './MessageReactions';
import MessageSearch from './MessageSearch';
import FileViewer from './FileViewer';
import ReadReceipts, { OnlineStatus, TypingIndicator } from './ReadReceipts';
import MessageActions, { ReplyPreview, MessageEdit } from './MessageActions';

import { messageAPI, authAPI, groupAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { useSocket } from '../../context/SocketContext';

// Force production URL for deployed version
const SOCKET_URL = window.location.hostname === 'sociogram-1.onrender.com' 
  ? 'https://sociogram-n73b.onrender.com'
  : import.meta.env.VITE_SOCKET_URL || 'https://social-media-pdbl.onrender.com';

// Image component with fallback for failed loads
const ImageWithFallback = ({ src, alt, fileName, onClick }) => {
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    console.error('🖼️ Image failed to load:', src);
    setHasError(true);
  };

  const handleLoad = () => {
    setHasError(false);
  };

  if (hasError) {
    return (
      <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg max-w-xs">
        <div className="flex-shrink-0">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">Image failed to load</p>
          <p className="text-xs text-red-600 mt-1">{fileName || 'Unknown image'}</p>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt}
      className="max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
      onClick={onClick}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
};

const UltimateMessagingHub = () => {
  const { user } = useAuth();
  const { followingUsers } = useFollow();
  const { socket, isConnected, joinConversation, leaveConversation, sendMessage, sendTyping } = useSocket();
  
  // Core state
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [followedUsers, setFollowedUsers] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [aiMessages, setAiMessages] = useState([]); // Separate state for AI messages
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('conversations');
  
  // Feature states
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageModal, setImageModal] = useState({ show: false, src: '', alt: '' });
  const [fileViewerData, setFileViewerData] = useState(null);
  
  // Message features
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [messageReactions, setMessageReactions] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  // Enhanced file handling
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showFileOptions, setShowFileOptions] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Voice & Video
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState(null);
  
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileOptionsRef = useRef(null);

  // Load initial data
  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  // Set up socket event listeners
  useEffect(() => {
    if (socket && user) {
      console.log('🔌 Setting up messaging socket listeners');

      const handleReceiveMessage = (message) => {
        console.log('📨 Received message:', message);
        handleNewMessage(message);
      };

      const handleUserTyping = ({ userId, isTyping }) => {
        handleTyping({ senderId: userId, isTyping });
      };

      const handleMessageReaction = (reactionData) => {
        handleMessageReactionFromSocket(reactionData);
      };

      const handleUserStatusUpdate = ({ userId, status }) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          if (status === 'online') {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          return newSet;
        });
      };

      const handleMessageDeleted = ({ messageId }) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      };

      // Add event listeners
      socket.on('receiveMessage', handleReceiveMessage);
      socket.on('userTyping', handleUserTyping);
      socket.on('messageReaction', handleMessageReaction);
      socket.on('userStatusUpdate', handleUserStatusUpdate);
      socket.on('messageDeleted', handleMessageDeleted);

      return () => {
        // Clean up event listeners
        socket.off('receiveMessage', handleReceiveMessage);
        socket.off('userTyping', handleUserTyping);
        socket.off('messageReaction', handleMessageReaction);
        socket.off('userStatusUpdate', handleUserStatusUpdate);
        socket.off('messageDeleted', handleMessageDeleted);
      };
    }
  }, [socket, user]);

  // ESC key handler for modals and voice recording
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        // Close image modal
        if (imageModal.show) {
          setImageModal({ show: false, src: '', alt: '' });
          return;
        }
        // Cancel voice recording
        if (isRecording) {
          cancelRecording();
          return;
        }
        // Close AI assistant
        if (showAIAssistant) {
          setShowAIAssistant(false);
          return;
        }
        // Close search
        if (showSearch) {
          setShowSearch(false);
          return;
        }
        // Close file viewer
        if (showFileViewer) {
          setShowFileViewer(false);
          setFileViewerData(null);
          return;
        }
        // Cancel reply
        if (replyingTo) {
          setReplyingTo(null);
          return;
        }
        // Cancel editing
        if (editingMessage) {
          setEditingMessage(null);
          return;
        }
        // Close file options
        if (showFileOptions) {
          setShowFileOptions(false);
          return;
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [
    imageModal.show, 
    isRecording, 
    showAIAssistant, 
    showSearch, 
    showFileViewer, 
    showFileOptions,
    Boolean(replyingTo), 
    Boolean(editingMessage)
  ]);

  // Auto-join conversation when selected
  useEffect(() => {
    if (selectedConversation?.id) {
      joinConversation(selectedConversation.id);
    }
  }, [selectedConversation?.id, joinConversation]);

  // Handle clicking outside file options
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fileOptionsRef.current && !fileOptionsRef.current.contains(event.target)) {
        setShowFileOptions(false);
      }
    };

    if (showFileOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFileOptions]);


  const loadInitialData = async () => {
    try {
      console.log('🔄 Loading initial conversations and data...');
      const [conversationsRes, followedRes] = await Promise.all([
        messageAPI.getConversations(),
        authAPI.getFollowing(user.id)
      ]);
      
      console.log('📊 Conversations API response:', conversationsRes.data);
      console.log('📊 Following API response:', followedRes.data);
      
      // Deduplicate conversations by ID
      const uniqueConversations = (conversationsRes.data.conversations || []).filter((conv, index, self) => 
        index === self.findIndex(c => c.id === conv.id)
      );
      
      console.log('💬 Unique conversations loaded:', uniqueConversations.length);
      console.log('💬 Conversation details:', uniqueConversations.map(c => ({
        id: c.id,
        isGroup: c.isGroup,
        participants: c.participants?.length || 0,
        lastMessage: c.lastMessage?.content || 'No messages'
      })));
      
      setConversations(uniqueConversations);
      setFollowedUsers(followedRes.data.following || []);
      
      // Load groups from conversations
      const groupConversations = uniqueConversations.filter(conv => conv.isGroup);
      setGroups(groupConversations);
      
      console.log('✅ Initial data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = (message) => {
    console.log('📨 Processing new message:', message);
    
    // Skip AI messages (they're handled separately)
    if (selectedConversation?.isAI) {
      console.log('🤖 Skipping socket message for AI conversation');
      return;
    }
    
    // Add message if it's for current conversation (and not AI)
    if (message.conversationId === selectedConversation?.id && !selectedConversation?.isAI) {
      setMessages(prev => {
        // Check for duplicates by ID or temporary ID
        const isDuplicate = prev.find(m => 
          m.id === message.id || 
          (m.tempId && m.tempId === message.tempId) ||
          (m.message === message.message && m.senderId === message.senderId && 
           Math.abs(new Date(m.createdAt) - new Date(message.createdAt)) < 5000)
        );
        
        if (isDuplicate) {
          console.log('Duplicate message ignored');
          return prev;
        }
        
        console.log('Adding new message to UI');
        return [...prev, message];
      });
      
      // Update conversation list with latest message
      setConversations(prev => prev.map(conv => 
        conv.id === message.conversationId 
          ? { ...conv, lastMessage: message, updatedAt: message.createdAt }
          : conv
      ));
      
      setTimeout(scrollToBottom, 100);
    } else {
      // Update conversation list for other conversations
      setConversations(prev => prev.map(conv => 
        conv.id === message.conversationId 
          ? { ...conv, lastMessage: message, updatedAt: message.createdAt, unreadCount: (conv.unreadCount || 0) + 1 }
          : conv
      ));
    }
  };

  const handleMessageReactionFromSocket = ({ messageId, emoji, userId, action }) => {
    console.log('🎭 Handling reaction:', { messageId, emoji, userId, action });
    
    setMessageReactions(prev => {
      const currentReactions = prev[messageId] || {};
      const currentEmojiUsers = currentReactions[emoji] || [];
      
      let updatedEmojiUsers;
      if (action === 'add') {
        // Add user if not already present
        updatedEmojiUsers = currentEmojiUsers.includes(userId) 
          ? currentEmojiUsers 
          : [...currentEmojiUsers, userId];
      } else if (action === 'remove') {
        // Remove user
        updatedEmojiUsers = currentEmojiUsers.filter(id => id !== userId);
      } else {
        // Legacy support - toggle behavior
        updatedEmojiUsers = currentEmojiUsers.includes(userId)
          ? currentEmojiUsers.filter(id => id !== userId)
          : [...currentEmojiUsers, userId];
      }
      
      const newReactions = {
        ...prev,
        [messageId]: {
          ...currentReactions,
          [emoji]: updatedEmojiUsers
        }
      };
      
      console.log('🎭 Updated reactions:', newReactions);
      return newReactions;
    });
  };

  const handleTyping = ({ senderId, isTyping }) => {
    if (senderId === user.id) return;
    
    setTypingUsers(prev => {
      if (isTyping) {
        return prev.includes(senderId) ? prev : [...prev, senderId];
      } else {
        return prev.filter(id => id !== senderId);
      }
    });
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleTypingIndicator = (value) => {
    if (!selectedConversation) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (value.trim()) {
      // User is typing
      sendTyping(selectedConversation.id, true);

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(selectedConversation.id, false);
      }, 2000);
    } else {
      // User stopped typing
      sendTyping(selectedConversation.id, false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, 60000);

      // Store references
      window.currentMediaRecorder = mediaRecorder;
      window.currentMediaStream = stream;
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (window.currentMediaRecorder && window.currentMediaRecorder.state === 'recording') {
      window.currentMediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    try {
      // Stop the media recorder if it's recording
      if (window.currentMediaRecorder && window.currentMediaRecorder.state === 'recording') {
        window.currentMediaRecorder.stop();
      }
      
      // Stop all audio tracks
      if (window.currentMediaStream) {
        window.currentMediaStream.getTracks().forEach(track => {
          track.stop();
          console.log('Audio track stopped');
        });
        window.currentMediaStream = null;
      }
      
      // Clean up recorder reference
      window.currentMediaRecorder = null;
      
      // Reset states
      setIsRecording(false);
      setAudioBlob(null);
      
      console.log('Voice recording cancelled and cleaned up');
    } catch (error) {
      console.error('Error cancelling recording:', error);
      // Force reset states even if cleanup fails
      setIsRecording(false);
      setAudioBlob(null);
    }
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob || !selectedConversation) return;

    const tempId = Date.now().toString();
    
    // Create optimistic voice message
    const optimisticMessage = {
      id: tempId,
      content: 'Voice message',
      senderId: user.id,
      conversationId: selectedConversation.id,
      createdAt: new Date().toISOString(),
      sender: {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture
      },
      messageType: 'voice',
      fileUrl: URL.createObjectURL(audioBlob),
      isOptimistic: true,
      isUploading: true
    };

    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();

    try {
      // Upload voice message
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice-message.wav');
      const uploadResponse = await messageAPI.uploadFile(formData);

      if (uploadResponse.data.success) {
        // Send voice message
        const messageResponse = await messageAPI.sendToConversation(
          selectedConversation.id, 
          'Voice message', 
          uploadResponse.data.file
        );

        if (messageResponse.data.success) {
          // Replace optimistic message with real one
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? { 
              ...messageResponse.data.data, 
              isOptimistic: false,
              isUploading: false
            } : msg
          ));

          // Emit via socket
          sendMessage({
            ...messageResponse.data.data,
            conversationId: selectedConversation.id,
            senderId: user.id,
            senderName: user.username,
            receiverId: selectedConversation.isGroup ? null : selectedConversation.participants?.find(p => p.id !== user.id)?.id
          });
        }
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }

    setAudioBlob(null);
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId) => {
    if (!conversationId) {
      console.log('❌ No conversationId provided to loadMessages');
      return;
    }
    
    try {
      console.log('📥 Loading messages for conversation:', conversationId);
      const response = await messageAPI.getConversationMessages(conversationId);
      console.log('📥 Raw API response:', response.data);
      
      if (response.data && response.data.success) {
        const loadedMessages = response.data.messages || [];
        console.log('📥 Loaded messages count:', loadedMessages.length);
        console.log('📥 First few messages:', loadedMessages.slice(0, 3));
        setMessages(loadedMessages);
        
        // Scroll to bottom after loading
        setTimeout(() => scrollToBottom(), 100);
      } else {
        console.error('❌ Failed to load messages:', response.data?.message || 'Unknown error');
        setMessages([]);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      setMessages([]);
    }
  };

  const handleConversationSelect = (conversation) => {
    console.log('🔄 Selecting conversation:', conversation);
    
    // Leave previous conversation (only for real conversations)
    if (selectedConversation?.id && !selectedConversation.isAI) {
      leaveConversation(selectedConversation.id);
    }
    
    setSelectedConversation(conversation);
    
    // Clear both message states when switching conversations
    setMessages([]);
    setAiMessages([]);
    
    if (conversation.isAI) {
      // For AI conversations, don't load from backend or join socket rooms
      console.log('🤖 Selected AI conversation');
      
      // Add welcome message for AI
      const welcomeMessage = {
        id: 'ai-welcome-' + Date.now(),
        content: `Hello! 👋 I'm your AI assistant ready to help! What can I do for you today? 😊`,
        senderId: 'ai',
        conversationId: conversation.id,
        createdAt: new Date().toISOString(),
        sender: {
          id: 'ai',
          username: 'AI Assistant',
          profilePicture: null
        },
        messageType: 'text'
      };
      
      setTimeout(() => {
        setAiMessages([welcomeMessage]);
        scrollToBottom();
      }, 100);
    } else {
      // For regular conversations, load messages and join socket room
      console.log('💬 Selected regular conversation, loading messages...');
      loadMessages(conversation.id);
      joinConversation(conversation.id);
    }
    
    // Close search modal
    setShowSearch(false);
  };

  const startConversationWithUser = async (targetUser) => {
    try {
      // Check if conversation already exists
      const existingConversation = conversations.find(conv => 
        conv.participants?.some(p => p.user.id === targetUser.id)
      );

      if (existingConversation) {
        // Select existing conversation
        handleConversationSelect(existingConversation);
        setActiveTab('conversations');
      } else {
        // Send initial message to create conversation
        const response = await messageAPI.sendMessage(targetUser.id, `Hi ${targetUser.username}! 👋`);
        
        if (response.data.success) {
          // Reload conversations to get the new one
          await loadInitialData();
          
          // Find and select the new conversation
          setTimeout(() => {
            const newConversation = conversations.find(conv => 
              conv.participants?.some(p => p.user.id === targetUser.id)
            );
            if (newConversation) {
              handleConversationSelect(newConversation);
            }
          }, 500);
          
          setActiveTab('conversations');
        }
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation. Please try again.');
    }
  };

  const handleFileUpload = async (files) => {
    if (!selectedConversation || !files.length) return;

    for (const file of files) {
      const tempId = Date.now().toString() + Math.random();
      
      // Create optimistic file message
      const optimisticMessage = {
        id: tempId,
        content: file.name,
        senderId: user.id,
        conversationId: selectedConversation.id,
        createdAt: new Date().toISOString(),
        sender: {
          id: user.id,
          username: user.username,
          profilePicture: user.profilePicture
        },
        messageType: 'file',
        fileUrl: URL.createObjectURL(file),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        isOptimistic: true,
        isUploading: true
      };

      setMessages(prev => [...prev, optimisticMessage]);
      scrollToBottom();

      try {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);
        const uploadResponse = await messageAPI.uploadFile(formData);

        if (uploadResponse.data.success) {
          // Send file message
          const messageResponse = await messageAPI.sendToConversation(
            selectedConversation.id, 
            file.name, 
            uploadResponse.data.file
          );

          if (messageResponse.data.success) {
            // Replace optimistic message with real one
            setMessages(prev => prev.map(msg => 
              msg.id === tempId ? { 
                ...messageResponse.data.data, 
                isOptimistic: false,
                isUploading: false
              } : msg
            ));

            // Emit via socket
            sendMessage({
              ...messageResponse.data.data,
              conversationId: selectedConversation.id,
              senderId: user.id,
              senderName: user.username,
              receiverId: selectedConversation.isGroup ? null : selectedConversation.participants?.find(p => p.id !== user.id)?.id
            });
          }
        }
      } catch (error) {
        console.error('File upload error:', error);
        // Remove failed message
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
      }
    }
  };

  // Enhanced file handling functions
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    // File size validation (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      alert("File size should be less than 50MB");
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }

    setShowFileOptions(false);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) {
      return (
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    } else if (fileType.startsWith('video/')) {
      return (
        <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    } else if (fileType.startsWith('audio/')) {
      return (
        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    } else if (fileType === 'application/pdf') {
      return (
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedConversation || (!newMessage.trim() && !selectedFile)) return;

    const messageContent = newMessage.trim();
    const tempId = Date.now().toString();
    
    try {
      setIsUploading(true);
      let fileData = null;

      // Handle file upload if file is selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        console.log('📤 Uploading file:', selectedFile.name);
        const uploadResponse = await messageAPI.uploadFile(formData);
        console.log('📥 Upload response:', uploadResponse.data);
        
        if (uploadResponse.data.success) {
          fileData = uploadResponse.data.file;
          console.log('✅ File data:', fileData);
        }
      }

      // Create optimistic message
      const optimisticMessage = {
        id: tempId,
        content: messageContent || (selectedFile ? selectedFile.name : ''),
        senderId: user.id,
        conversationId: selectedConversation.id,
        createdAt: new Date().toISOString(),
        sender: {
          id: user.id,
          username: user.username,
          profilePicture: user.profilePicture
        },
        messageType: fileData ? 'file' : 'text',
        ...(fileData && {
          fileUrl: fileData.url,
          fileName: fileData.name,
          fileType: fileData.type,
          fileSize: fileData.size
        }),
        isOptimistic: true
      };

      // Add optimistic message to appropriate state
      if (selectedConversation.isAI) {
        setAiMessages(prev => [...prev, optimisticMessage]);
        console.log('🤖 Added optimistic AI message');
      } else {
        setMessages(prev => [...prev, optimisticMessage]);
        console.log('💬 Added optimistic user message');
      }
      
      setNewMessage('');
      setSelectedFile(null);
      setFilePreview(null);
      scrollToBottom();

      // Handle AI conversation
      if (selectedConversation.isAI) {
        console.log('🤖 Processing AI conversation');
        console.log('🤖 Selected conversation:', selectedConversation);
        console.log('🤖 Message content:', messageContent);
        
        try {
          console.log('🤖 Sending AI message:', messageContent);
          
          const systemPrompt = `You are an AI assistant integrated into Sociogram's messaging system. 

Your role:
- Help users with conversations and messaging
- Provide thoughtful, helpful responses
- Be friendly and engaging
- Answer questions about Sociogram features
- Assist with writing and communication

IMPORTANT NAVIGATION:
- The CREATE button is in the LEFT SIDEBAR, not at the top
- Main navigation is in the left sidebar: Feed, Messages, Create, Reels, Activity, Profile

Keep responses conversational and helpful!`;

          const aiResponse = await messageAPI.aiChatAssistant({
            message: messageContent,
            conversationId: 'floating-assistant', // Use the same ID as floating assistant
            systemPrompt: systemPrompt
          });

          console.log('🤖 AI Response received:', aiResponse.data);
          console.log('🤖 AI Response success:', aiResponse.data?.success);
          console.log('🤖 AI Response content:', aiResponse.data?.response);

          if (aiResponse.data && aiResponse.data.success && aiResponse.data.response) {
            const aiMessage = {
              id: Date.now() + 1,
              content: aiResponse.data.response,
              senderId: 'ai',
              conversationId: selectedConversation.id,
              createdAt: new Date().toISOString(),
              sender: {
                id: 'ai',
                username: 'AI Assistant',
                profilePicture: null
              },
              messageType: 'text'
            };
            setAiMessages(prev => [...prev.filter(msg => msg.id !== tempId), optimisticMessage, aiMessage]);
            console.log('🤖 AI message added to state');
          } else {
            console.error('🚨 AI response invalid:', aiResponse.data);
            // Add fallback message
            const fallbackMessage = {
              id: Date.now() + 1,
              content: "I'm here to help! Could you tell me more about what you need? 😊",
              senderId: 'ai',
              conversationId: selectedConversation.id,
              createdAt: new Date().toISOString(),
              sender: { id: 'ai', username: 'AI Assistant' },
              messageType: 'text'
            };
            setAiMessages(prev => [...prev.filter(msg => msg.id !== tempId), optimisticMessage, fallbackMessage]);
          }
        } catch (error) {
          console.error('🚨 AI Chat error:', error);
          console.error('🚨 Error details:', error.response?.data || error.message);
          
          let errorContent = 'Sorry, I encountered an error. Please try again.';
          
          // Provide more specific error messages
          if (error.response?.status === 401) {
            errorContent = 'Authentication error. Please try logging in again.';
          } else if (error.response?.status === 500) {
            errorContent = 'Server error. The AI service might be temporarily unavailable.';
          } else if (error.code === 'NETWORK_ERROR') {
            errorContent = 'Network error. Please check your connection and try again.';
          }
          
          const errorMessage = {
            id: Date.now() + 1,
            content: errorContent + ' 😅',
            senderId: 'ai',
            conversationId: selectedConversation.id,
            createdAt: new Date().toISOString(),
            sender: {
              id: 'ai',
              username: 'AI Assistant',
              profilePicture: null
            },
            messageType: 'text'
          };
          setAiMessages(prev => [...prev.filter(msg => msg.id !== tempId), optimisticMessage, errorMessage]);
        }
        return;
      }

      // Send to backend for regular conversations
      console.log('💬 Sending regular message to backend:', {
        conversationId: selectedConversation.id,
        messageContent,
        hasFile: !!fileData
      });
      
      const response = await messageAPI.sendToConversation(
        selectedConversation.id, 
        messageContent || undefined, 
        fileData
      );
      
      console.log('💬 Backend response:', response.data);
      
      // Emit via socket for real-time delivery
      if (response.data.success) {
        console.log('💬 Emitting message via socket');
        const receiverId = selectedConversation.isGroup 
          ? null 
          : selectedConversation.participants?.find(p => 
              (p.user?.id !== user.id) || (p.userId !== user.id)
            )?.user?.id || selectedConversation.participants?.find(p => 
              (p.user?.id !== user.id) || (p.userId !== user.id)
            )?.userId;
            
        console.log('💬 Socket message details:', {
          conversationId: selectedConversation.id,
          senderId: user.id,
          senderName: user.username,
          receiverId,
          participants: selectedConversation.participants
        });
        
        sendMessage({
          ...response.data.data,
          conversationId: selectedConversation.id,
          senderId: user.id,
          senderName: user.username,
          receiverId
        });
        console.log('💬 Socket message emitted successfully');
      }
      
      if (response.data.success) {
        // Replace optimistic message with real one
        console.log('💬 Replacing optimistic message with real one:', {
          tempId,
          realMessage: response.data.data
        });
        
        setMessages(prev => {
          console.log('💬 Before replacement - messages count:', prev.length);
          console.log('💬 Looking for tempId:', tempId);
          console.log('💬 Real message data:', response.data.data);
          
          const updated = prev.map(msg => {
            if (msg.id === tempId) {
              console.log('💬 Found and replacing optimistic message');
              return { ...response.data.data, isOptimistic: false };
            }
            return msg;
          });
          
          console.log('💬 After replacement - messages count:', updated.length);
          return updated;
        });
      } else {
        console.error('💬 Backend response not successful:', response.data);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove failed message and restore input
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageContent);
    } finally {
      // Always reset uploading state
      setIsUploading(false);
    }
  };

  const handleMessageAction = {
    reply: (message) => setReplyingTo(message),
    forward: async (message, conversationIds, forwardMessage) => {
      // Implementation for forwarding
      console.log('Forwarding message:', message, 'to:', conversationIds);
    },
    edit: (message) => setEditingMessage(message),
    delete: async (messageId) => {
      if (window.confirm('Delete this message?')) {
        await messageAPI.deleteMessage(messageId);
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    },
    star: async (messageId) => {
      // Implementation for starring
      console.log('Starring message:', messageId);
    },
    report: async (messageId, reason, details) => {
      // Implementation for reporting
      console.log('Reporting message:', messageId, reason, details);
    }
  };

  // Group management functions
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await groupAPI.deleteGroup(groupId);
      if (response.data.success) {
        console.log('✅ Group deleted successfully');
        // Remove from conversations list
        setConversations(prev => prev.filter(conv => conv._id !== groupId));
        setGroups(prev => prev.filter(group => group._id !== groupId));
        
        // Clear selected conversation if it was the deleted group
        if (selectedConversation?._id === groupId) {
          setSelectedConversation(null);
          setMessages([]);
        }
        
        alert('Group deleted successfully');
      }
    } catch (error) {
      console.error('❌ Error deleting group:', error);
      alert('Failed to delete group. Please try again.');
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to leave this group?')) {
      return;
    }

    try {
      const response = await groupAPI.removeMember(groupId, user.id);
      if (response.data.success) {
        console.log('✅ Left group successfully');
        // Remove from conversations list
        setConversations(prev => prev.filter(conv => conv._id !== groupId));
        setGroups(prev => prev.filter(group => group._id !== groupId));
        
        // Clear selected conversation if it was the left group
        if (selectedConversation?._id === groupId) {
          setSelectedConversation(null);
          setMessages([]);
        }
        
        alert('Left group successfully');
      }
    } catch (error) {
      console.error('❌ Error leaving group:', error);
      alert('Failed to leave group. Please try again.');
    }
  };

  const openFileViewer = (file, files = [], index = 0) => {
    setFileViewerData({ file, files, index });
    setShowFileViewer(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Ultimate Chat
            </h2>
            <div className="flex items-center space-x-2">
              {/* Search Button */}
              <button
                onClick={() => {
                  console.log('🔍 Search button clicked');
                  setShowSearch(true);
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Search Messages"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </button>
              
              {/* Create Group Button */}
              <button
                onClick={() => {
                  console.log('👥 Create Group button clicked');
                  setShowGroupManager(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-200 text-sm font-medium flex-1"
                title="Create Group"
              >
                <UserGroupIcon className="w-5 h-5" />
                <span>Create New Group</span>
              </button>
            </div>
          </div>
          
          {/* Tab Navigation - Improved Layout */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                activeTab === 'conversations'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <ChatBubbleLeftIcon className="w-4 h-4" />
              <span>Chats</span>
            </button>
            <button
              onClick={() => setActiveTab('ai-chat')}
              className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                activeTab === 'ai-chat'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <SparklesIcon className="w-4 h-4" />
              <span>AI Chat</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                activeTab === 'groups'
                  ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <UserGroupIcon className="w-4 h-4" />
              <span>Groups</span>
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                activeTab === 'following'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <UserPlusIcon className="w-4 h-4" />
              <span>Following</span>
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'conversations' ? (
            conversations.length > 0 ? conversations.filter(conv => !conv.isGroup).map((conversation) => {
              const otherUser = conversation.participants?.find(p => p.user.id !== user.id)?.user;
              return (
                <div
                  key={conversation.id}
                  onClick={() => {
                    handleConversationSelect(conversation);
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                    selectedConversation?.id === conversation.id ? 'bg-purple-50' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {otherUser?.username?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <OnlineStatus 
                        userId={otherUser?.id} 
                        isOnline={onlineUsers.has(otherUser?.id)}
                        size="sm"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-900">{otherUser?.username}</p>
                      <p className="text-xs text-gray-500">
                        {onlineUsers.has(otherUser?.id) ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="p-8 text-center text-gray-500">
                <ChatBubbleLeftIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs">Start messaging someone to begin</p>
              </div>
            )
          ) : activeTab === 'ai-chat' ? (
            <div className="p-4 h-full">
              {/* AI Assistant Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 mb-4 border border-emerald-100">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <SparklesIcon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">AI Assistant</h3>
                  <p className="text-gray-600 text-sm mb-4">Powered by NVIDIA • Always ready to help</p>
                  <button
                    onClick={() => {
                      const aiConversation = {
                        id: 'ai-assistant',
                        isAI: true,
                        user: {
                          id: 'ai',
                          username: 'AI Assistant',
                          profilePicture: null
                        }
                      };
                      setSelectedConversation(aiConversation);
                      
                      // Clear messages and add welcome message
                      setMessages([]);
                      setAiMessages([]);
                      
                      // Add welcome message
                      const welcomeMessage = {
                        id: 'ai-welcome-' + Date.now(),
                        content: `Hello! 👋 I'm your AI assistant here to help with anything you need! 

I can help you with:
• Navigating Sociogram features 🧭
• Writing messages and posts ✍️
• Answering questions 🤔
• General conversation 💬

What would you like to know? 😊`,
                        senderId: 'ai',
                        conversationId: 'ai-assistant',
                        createdAt: new Date().toISOString(),
                        sender: {
                          id: 'ai',
                          username: 'AI Assistant',
                          profilePicture: null
                        },
                        messageType: 'text'
                      };
                      
                      setTimeout(() => {
                        setAiMessages([welcomeMessage]);
                        scrollToBottom();
                      }, 100);
                    }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    🚀 Start AI Chat
                  </button>
                </div>
              </div>
              
              {/* Quick Actions Grid */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <span className="mr-2">⚡</span>
                  Quick Actions
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => {
                      const aiConversation = {
                        id: 'ai-assistant',
                        isAI: true,
                        user: { id: 'ai', username: 'AI Assistant' }
                      };
                      setSelectedConversation(aiConversation);
                      
                      // Add welcome message and set the input
                      const welcomeMessage = {
                        id: 'ai-welcome-email',
                        content: `Hello! 👋 I'd be happy to help you write a professional email! 

What kind of email are you looking to write? For example:
• Business inquiry
• Job application
• Follow-up email
• Meeting request
• Thank you note

Just let me know the details and I'll help you craft the perfect message! ✍️`,
                        senderId: 'ai',
                        conversationId: 'ai-assistant',
                        createdAt: new Date().toISOString(),
                        sender: { id: 'ai', username: 'AI Assistant' },
                        messageType: 'text'
                      };
                      setAiMessages([welcomeMessage]);
                      setNewMessage("Help me write a professional email");
                    }}
                    className="flex items-center p-3 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 text-sm shadow-sm hover:shadow-md"
                  >
                    <span className="text-lg mr-3">📧</span>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Write Email</p>
                      <p className="text-xs text-gray-500">Professional email assistance</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedConversation({
                        id: 'ai-assistant',
                        isAI: true,
                        user: { id: 'ai', username: 'AI Assistant' }
                      });
                      setNewMessage("Give me conversation starters");
                    }}
                    className="flex items-center p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 text-sm shadow-sm hover:shadow-md"
                  >
                    <span className="text-lg mr-3">💬</span>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Conversation Ideas</p>
                      <p className="text-xs text-gray-500">Break the ice with friends</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedConversation({
                        id: 'ai-assistant',
                        isAI: true,
                        user: { id: 'ai', username: 'AI Assistant' }
                      });
                      setNewMessage("Help me be more creative");
                    }}
                    className="flex items-center p-3 bg-white border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all duration-200 text-sm shadow-sm hover:shadow-md"
                  >
                    <span className="text-lg mr-3">🎨</span>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Creative Writing</p>
                      <p className="text-xs text-gray-500">Boost your creativity</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedConversation({
                        id: 'ai-assistant',
                        isAI: true,
                        user: { id: 'ai', username: 'AI Assistant' }
                      });
                      setNewMessage("Explain something complex simply");
                    }}
                    className="flex items-center p-3 bg-white border border-yellow-200 rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-all duration-200 text-sm shadow-sm hover:shadow-md"
                  >
                    <span className="text-lg mr-3">🧠</span>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Explain Concepts</p>
                      <p className="text-xs text-gray-500">Simplify complex topics</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'groups' ? (
            groups.length > 0 ? groups.map((group) => (
              <div
                key={group.id}
                onClick={() => handleConversationSelect(group)}
                className={`p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                  selectedConversation?.id === group.id ? 'bg-purple-50' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-purple-400 rounded-full flex items-center justify-center">
                      <UserGroupIcon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">{group.name || 'Group Chat'}</p>
                    <p className="text-xs text-gray-500">
                      {group.participants?.length || 0} members
                    </p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-gray-500">
                <UserGroupIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No groups yet</p>
                <p className="text-xs">Create a group to get started</p>
              </div>
            )
          ) : (
            followedUsers.map((followedUser) => (
              <div key={followedUser.id} className="p-4 hover:bg-gray-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-400 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {followedUser.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{followedUser.username}</p>
                      <p className="text-xs text-gray-500">@{followedUser.username}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => startConversationWithUser(followedUser)}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-3 py-1.5 rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 transition-all duration-200 text-sm"
                  >
                    Message
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-3">
                {selectedConversation.isAI ? (
                  // AI Chat Header
                  <>
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                      <SparklesIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">AI Assistant</p>
                      <div className="text-xs text-green-500 flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Always available</span>
                      </div>
                    </div>
                  </>
                ) : selectedConversation.isGroup ? (
                  // Group Chat Header
                  <>
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-400 rounded-full flex items-center justify-center">
                      <UserGroupIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedConversation.name || 'Group Chat'}</p>
                      <div className="text-xs text-gray-500 flex items-center space-x-1">
                        <span>{selectedConversation.participants?.length || 0} members</span>
                        {selectedConversation.description && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-32">{selectedConversation.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  // Direct Message Header
                  (() => {
                    const otherUser = selectedConversation.participants?.find(p => p.user.id !== user.id)?.user;
                    return (
                      <>
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {otherUser?.username?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{otherUser?.username}</p>
                          <div className="text-xs text-gray-500 flex items-center space-x-1">
                            <OnlineStatus 
                              userId={otherUser?.id} 
                              isOnline={onlineUsers.has(otherUser?.id)}
                              showText={true}
                              size="xs"
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Group Management Buttons */}
                {selectedConversation.isGroup && (
                  <>
                    {/* Group Settings */}
                    <button
                      type="button"
                      onClick={() => setShowGroupSettings(true)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      title="Group Settings"
                    >
                      <Cog6ToothIcon className="w-5 h-5" />
                    </button>
                    
                    {/* Leave/Delete Group */}
                    {selectedConversation.groupOwner?.id === user.id ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(selectedConversation._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Delete Group"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLeaveGroup(selectedConversation._id)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-full transition-colors"
                        title="Leave Group"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}

                {/* AI Assistant Button */}
                <button
                  type="button"
                  onClick={() => {
                    console.log('🤖 AI Assistant button clicked!');
                    setShowAIAssistant(true);
                  }}
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-full transition-colors border border-purple-200 hover:border-purple-300"
                  title="AI Assistant"
                >
                  <SparklesIcon className="w-5 h-5" />
                </button>
                
                <VideoCall
                  socket={socket}
                  user={user}
                  selectedConversation={selectedConversation}
                  isInCall={inCall}
                  setIsInCall={setInCall}
                  callType={callType}
                  setCallType={setCallType}
                />
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-0">
              {(() => {
                // Use appropriate message state based on conversation type
                const currentMessages = selectedConversation?.isAI ? aiMessages : messages;
                
                return currentMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <ChatBubbleLeftIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No messages yet</p>
                      <p className="text-sm">Send a message to start the conversation</p>
                    </div>
                  </div>
                ) : (
                  currentMessages.map((message) => {
                  const isOwnMessage = String(message.senderId) === String(user.id);
                  const isAIMessage = message.senderId === 'ai';
                  console.log('Message alignment debug:', { 
                    messageId: message.id, 
                    messageSenderId: message.senderId, 
                    userId: user.id, 
                    isOwnMessage,
                    senderUsername: message.sender?.username 
                  });
                  
                  return (
                <div key={message.id} className={`group flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
                  <div className="relative max-w-xs lg:max-w-md">
                    {/* Sender name for received messages */}
                    {!isOwnMessage && (
                      <div className="text-xs text-gray-500 mb-1 px-1">
                        {message.sender?.username || 'Unknown'}
                      </div>
                    )}
                    {/* Reply Preview */}
                    {message.replyTo && (
                      <div className="mb-2 text-xs text-gray-500 border-l-2 border-gray-300 pl-2">
                        Replying to: {message.replyTo.content?.substring(0, 50)}...
                      </div>
                    )}
                    
                    {editingMessage?.id === message.id ? (
                      <MessageEdit
                        message={message}
                        onSave={(id, content) => {
                          // Handle message edit
                          setEditingMessage(null);
                        }}
                        onCancel={() => setEditingMessage(null)}
                      />
                    ) : (
                      <div className={`px-4 py-2 rounded-2xl ${
                        isOwnMessage
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                          : isAIMessage
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}>
                        {/* Voice Message */}
                        {message.messageType === 'audio' && (
                          <VoiceMessageDisplay 
                            message={message} 
                            isOwn={isOwnMessage} 
                          />
                        )}
                        
                        {/* File Display */}
                        {(message.fileUrl || message.file) && (
                          <div className="mt-2 relative">
                            {(message.fileType?.startsWith('image/') || message.file?.type?.startsWith('image/') || message.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                              <ImageWithFallback 
                                src={message.fileUrl || message.file?.url || message.file}
                                alt={message.fileName || message.file?.name}
                                fileName={message.fileName || message.file?.name}
                                onClick={() => setImageModal({
                                  show: true,
                                  src: message.fileUrl || message.file?.url || message.file,
                                  alt: message.fileName || message.file?.name || 'Image'
                                })}
                              />
                            ) : (message.fileType?.startsWith('video/') || message.file?.type?.startsWith('video/') || message.fileName?.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                              <video 
                                src={message.fileUrl || message.file?.url || message.file} 
                                controls 
                                className="max-w-xs rounded-lg"
                              />
                            ) : (
                              <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg max-w-xs">
                                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {message.fileName || message.file?.name || 'File'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {message.fileSize ? `${(message.fileSize / 1024 / 1024).toFixed(2)} MB` : message.file?.size ? `${(message.file.size / 1024 / 1024).toFixed(2)} MB` : ''}
                                  </p>
                                </div>
                                <button
                                  onClick={() => window.open(message.fileUrl || message.file?.url || message.file, '_blank')}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            {message.isUploading && (
                              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Text Content */}
                        {message.content && message.messageType !== 'audio' && !message.fileUrl && !message.file && (
                          <p className="text-sm leading-relaxed break-words">{message.content}</p>
                        )}
                        
                        {/* Message Footer */}
                        <div className="flex items-center justify-between mt-2">
                          <div className={`text-xs font-medium ${
                            message.senderId === user.id 
                              ? 'text-white text-opacity-80' 
                              : isAIMessage
                              ? 'text-white text-opacity-80'
                              : 'text-gray-600'
                          }`}>
                            {new Date(message.createdAt).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                          <ReadReceipts
                            messageId={message.id}
                            status={message.status}
                            timestamp={null}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Message Reactions */}
                    <MessageReactions
                      messageId={message.id}
                      reactions={messageReactions[message.id] || {}}
                      onAddReaction={async (messageId, emoji) => {
                        try {
                          console.log('➕ Adding reaction:', { messageId, emoji, userId: user.id });
                          
                          // Optimistic update
                          setMessageReactions(prev => ({
                            ...prev,
                            [messageId]: {
                              ...prev[messageId],
                              [emoji]: [...(prev[messageId]?.[emoji] || []), user.id]
                            }
                          }));

                          // Emit via socket
                          if (socket) {
                            console.log('📡 Emitting reaction via socket');
                            socket.emit('messageReaction', {
                              messageId,
                              emoji,
                              action: 'add',
                              conversationId: selectedConversation.id
                            });
                          }
                        } catch (error) {
                          console.error('Error adding reaction:', error);
                        }
                      }}
                      onRemoveReaction={async (messageId, emoji) => {
                        try {
                          console.log('➖ Removing reaction:', { messageId, emoji, userId: user.id });
                          
                          // Optimistic update
                          setMessageReactions(prev => ({
                            ...prev,
                            [messageId]: {
                              ...prev[messageId],
                              [emoji]: (prev[messageId]?.[emoji] || []).filter(id => id !== user.id)
                            }
                          }));

                          // Emit via socket
                          if (socket) {
                            console.log('📡 Emitting remove reaction via socket');
                            socket.emit('messageReaction', {
                              messageId,
                              emoji,
                              action: 'remove',
                              conversationId: selectedConversation.id
                            });
                          }
                        } catch (error) {
                          console.error('Error removing reaction:', error);
                        }
                      }}
                      currentUserId={user.id}
                    />
                    
                    {/* Message Actions */}
                    <MessageActions
                      message={message}
                      currentUserId={user.id}
                      conversations={conversations}
                      onReply={handleMessageAction.reply}
                      onForward={handleMessageAction.forward}
                      onEdit={handleMessageAction.edit}
                      onDelete={handleMessageAction.delete}
                      onStar={handleMessageAction.star}
                      onReport={handleMessageAction.report}
                      isOwn={isOwnMessage}
                    />
                  </div>
                </div>
                  );
                })
              );
              })()}
              
              {/* Typing Indicator */}
              <TypingIndicator 
                users={typingUsers.map(id => ({ username: `User ${id}` }))} 
                isVisible={typingUsers.length > 0} 
              />
              
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview */}
            <ReplyPreview 
              replyingTo={replyingTo} 
              onCancel={() => setReplyingTo(null)} 
            />

            {/* Voice Message Preview */}
            {audioBlob && (
              <div className="bg-purple-50 border-t border-purple-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                      <MicrophoneIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-900">Voice message recorded</p>
                      <p className="text-xs text-purple-600">Click send to share</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={cancelRecording}
                      className="px-3 py-1 text-sm text-purple-600 hover:bg-purple-100 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendVoiceMessage}
                      className="px-4 py-2 bg-purple-500 text-white text-sm rounded-md hover:bg-purple-600 transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* File Preview */}
            {selectedFile && (
              <div className="bg-gray-50 border-t border-gray-200 p-4">
                <div className="bg-white rounded-lg p-3 relative border border-gray-200">
                  <button 
                    onClick={removeSelectedFile}
                    className="absolute top-2 right-2 bg-gray-200 rounded-full p-1 hover:bg-gray-300 transition-colors"
                    title="Remove file"
                  >
                    <XMarkIcon className="w-4 h-4 text-gray-600" />
                  </button>
                  
                  {filePreview ? (
                    <div className="flex justify-center mb-2">
                      <img src={filePreview} alt="Preview" className="max-h-32 rounded border" />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3 mb-2">
                      {getFileIcon(selectedFile.type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</div>
                        <div className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</div>
                      </div>
                    </div>
                  )}
                  
                  {isUploading && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
              <form onSubmit={handleSendMessage} className="space-y-3">
                <div className="flex items-end space-x-3">
                  {/* File Upload Options */}
                  <div className="relative" ref={fileOptionsRef}>
                    <button
                      type="button"
                      onClick={() => setShowFileOptions(!showFileOptions)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      title="Attach File"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                    
                    {showFileOptions && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white shadow-lg rounded-lg border p-2 w-48 z-10">
                        <input
                          type="file"
                          onChange={handleFileChange}
                          className="hidden"
                          id="fileInput"
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xlsx,.ppt,.pptx"
                        />
                        <label 
                          htmlFor="fileInput"
                          className="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer"
                        >
                          <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm">Images & Files</span>
                        </label>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTypingIndicator(e.target.value);
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
                      className="w-full px-4 py-2 bg-gray-50 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white border border-transparent focus:border-purple-200"
                      disabled={isUploading}
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-2 rounded-full transition-colors ${
                      isRecording 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title={isRecording ? "Stop Recording" : "Voice Message"}
                    disabled={isUploading}
                  >
                    {isRecording ? (
                      <StopIcon className="w-5 h-5" />
                    ) : (
                      <MicrophoneIcon className="w-5 h-5" />
                    )}
                  </button>
                  
                  
                  <button
                    type="submit"
                    disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                    className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full hover:from-purple-600 hover:to-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <SparklesIcon className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Ultimate Messaging Experience</h3>
              <p className="text-gray-600 mb-4">AI-powered chat with voice, video, files, and more!</p>
              <div className="flex flex-wrap justify-center gap-2 text-sm">
                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">🤖 AI Assistant</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">🎤 Voice Messages</span>
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">📹 Video Calls</span>
                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">📎 File Sharing</span>
                <span className="bg-red-100 text-red-700 px-2 py-1 rounded">👥 Group Chats</span>
                <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded">🔍 Smart Search</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {console.log('🔍 showAIAssistant state:', showAIAssistant)}
      {showAIAssistant && (
        <AIAssistant
          isOpen={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
          onMessageImprove={(message) => {
            setNewMessage(message);
            setShowAIAssistant(false);
          }}
          onMessageGenerate={(message) => {
            setNewMessage(message);
            setShowAIAssistant(false);
          }}
          selectedConversation={selectedConversation}
          currentMessage={newMessage}
          setCurrentMessage={setNewMessage}
        />
      )}

      {showSearch && (
        <MessageSearch
          conversations={conversations}
          onConversationSelect={handleConversationSelect}
          onMessageSelect={(message) => {
            console.log('Selected message:', message);
            setShowSearch(false);
          }}
          isOpen={showSearch}
          onClose={() => {
            console.log('🔍 Closing search modal');
            setShowSearch(false);
          }}
        />
      )}

      {showGroupManager && (
        <GroupChat
          socket={socket}
          user={user}
          onGroupCreate={(group) => {
            console.log('✅ Group created:', group);
            setGroups(prev => [...prev, group]);
            setConversations(prev => [...prev, group]);
            setActiveTab('groups');
            setShowGroupManager(false);
          }}
          onGroupSelect={setSelectedConversation}
          groups={groups}
          selectedGroup={selectedConversation}
          isOpen={showGroupManager}
          onClose={() => {
            console.log('👥 Closing group manager');
            setShowGroupManager(false);
          }}
        />
      )}

      {showGroupSettings && selectedConversation?.isGroup && (
        <GroupSettings
          group={selectedConversation}
          user={user}
          isOpen={showGroupSettings}
          onClose={() => setShowGroupSettings(false)}
          onGroupUpdate={(updatedGroup) => {
            setSelectedConversation(updatedGroup);
            setConversations(prev => prev.map(conv => 
              conv.id === updatedGroup.id ? updatedGroup : conv
            ));
          }}
          onGroupDelete={handleDeleteGroup}
          onMemberUpdate={(updatedGroup) => {
            setSelectedConversation(updatedGroup);
            setConversations(prev => prev.map(conv => 
              conv.id === updatedGroup.id ? updatedGroup : conv
            ));
          }}
        />
      )}

      {showFileViewer && fileViewerData && (
        <FileViewer
          file={fileViewerData.file}
          files={fileViewerData.files}
          onClose={() => {
            setShowFileViewer(false);
            setFileViewerData(null);
          }}
        />
      )}

      {/* Image Modal */}
      {imageModal.show && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" 
          onClick={() => setImageModal({ show: false, src: '', alt: '' })}
        >
          <div className="relative max-w-5xl max-h-full p-4">
            <button
              onClick={() => setImageModal({ show: false, src: '', alt: '' })}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            <img
              src={imageModal.src}
              alt={imageModal.alt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={() => setImageModal({ show: false, src: '', alt: '' })}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 rounded-b-lg">
              <p className="text-sm text-center">{imageModal.alt}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UltimateMessagingHub;
