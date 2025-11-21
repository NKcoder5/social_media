import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authAPI } from '../utils/api';
import { useAuth } from './AuthContext';
import io from 'socket.io-client';

const FollowContext = createContext();

export const useFollow = () => {
  const context = useContext(FollowContext);
  if (!context) {
    throw new Error('useFollow must be used within a FollowProvider');
  }
  return context;
};

export const FollowProvider = ({ children }) => {
  const { user } = useAuth();
  const [followingUsers, setFollowingUsers] = useState(new Set());
  const [followCounts, setFollowCounts] = useState({});
  const [processingUsers, setProcessingUsers] = useState(new Set());
  const [socket, setSocket] = useState(null);

  // Initialize socket connection for notifications
  useEffect(() => {
    if (user && user.token) {
      // Force production URL for deployed version
      const SOCKET_URL = window.location.hostname === 'sociogram-1.onrender.com' 
        ? 'https://sociogram-n73b.onrender.com'
        : import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'https://social-media-pdbl.onrender.com';
      
      const newSocket = io(SOCKET_URL, {
        auth: { token: user.token },
        withCredentials: true
      });
      setSocket(newSocket);
      return () => newSocket.close();
    }
  }, [user]);

  // Initialize follow state when user changes
  useEffect(() => {
    if (user?.id) {
      loadFollowState(user.id);
    } else {
      // Clear state when user logs out
      setFollowingUsers(new Set());
      setFollowCounts({});
      setProcessingUsers(new Set());
    }
  }, [user?.id]);

  // Initialize follow state for a user
  const initializeUserFollowState = useCallback((userId, isFollowing = false, followerCount = 0, followingCount = 0) => {
    if (isFollowing) {
      setFollowingUsers(prev => new Set([...prev, userId]));
    }
    setFollowCounts(prev => ({
      ...prev,
      [userId]: { followers: followerCount, following: followingCount }
    }));
  }, []);

  // Follow/unfollow a user
  const toggleFollow = useCallback(async (user) => {
    const userId = user.id || user._id;
    const wasFollowing = followingUsers.has(userId);
    
    try {
      // Set processing state
      setProcessingUsers(prev => new Set([...prev, userId]));
      
      // Optimistic UI update
      setFollowingUsers(prev => {
        const newSet = new Set(prev);
        if (wasFollowing) {
          newSet.delete(userId);
        } else {
          newSet.add(userId);
        }
        return newSet;
      });
      
      // Update counts optimistically
      setFollowCounts(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          followers: (prev[userId]?.followers || 0) + (wasFollowing ? -1 : 1)
        },
        // Update current user's following count optimistically
        [user.id]: {
          followers: prev[user.id]?.followers || 0,
          following: (prev[user.id]?.following || 0) + (wasFollowing ? -1 : 1)
        }
      }));
      
      // API call
      const response = await authAPI.followUser(userId);
      
      if (response.data.success) {
        // Update with actual counts from server
        setFollowCounts(prev => ({
          ...prev,
          [userId]: {
            followers: response.data.targetUserFollowerCount,
            following: prev[userId]?.following || 0
          },
          // Update current user's following count
          [user.id]: {
            followers: prev[user.id]?.followers || 0,
            following: (prev[user.id]?.following || 0) + (wasFollowing ? -1 : 1)
          }
        }));
        
        console.log(`✅ ${response.data.action} ${user.username}`);
        
        // Send follow notification if user started following (not unfollowing)
        if (!wasFollowing && socket) {
          socket.emit('followNotification', {
            followedUserId: userId,
            followerName: user.username,
            followerId: user.id
          });
        }
        
        // If mutual follow, log it
        if (response.data.isMutualFollow) {
          console.log(`🤝 Mutual follow established with ${user.username}! You can now message each other.`);
        }
        
        return {
          success: true,
          action: response.data.action,
          isMutualFollow: response.data.isMutualFollow,
          message: response.data.message
        };
      } else {
        // Revert optimistic update on failure
        setFollowingUsers(prev => {
          const newSet = new Set(prev);
          if (wasFollowing) {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          return newSet;
        });
        
        setFollowCounts(prev => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            followers: (prev[userId]?.followers || 0) + (wasFollowing ? 1 : -1)
          }
        }));
        
        console.error('❌ Follow action failed:', response.data.message);
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      
      // Revert optimistic update on error
      setFollowingUsers(prev => {
        const newSet = new Set(prev);
        if (wasFollowing) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
      
      setFollowCounts(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          followers: (prev[userId]?.followers || 0) + (wasFollowing ? 1 : -1)
        }
      }));
      
      return { success: false, message: 'Network error occurred' };
    } finally {
      // Remove processing state
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  }, [followingUsers]);

  // Check if user is being followed
  const isFollowing = useCallback((userId) => {
    return followingUsers.has(userId);
  }, [followingUsers]);

  // Check if user action is processing
  const isProcessing = useCallback((userId) => {
    return processingUsers.has(userId);
  }, [processingUsers]);

  // Get follow counts for a user - make it reactive to followCounts changes
  const getFollowCounts = useCallback((userId) => {
    const counts = followCounts[userId] || { followers: 0, following: 0 };
    console.log(`📊 Getting follow counts for ${userId}:`, counts);
    return counts;
  }, [followCounts]);

  // Load initial follow state from API
  const loadFollowState = useCallback(async (currentUserId) => {
    try {
      const [followingResponse, profileResponse] = await Promise.all([
        authAPI.getFollowing(currentUserId),
        authAPI.getProfile(currentUserId)
      ]);
      
      const following = followingResponse.data.following || [];
      const followingIds = new Set(following.map(user => user.id));
      
      setFollowingUsers(followingIds);
      
      // Initialize current user's follow counts
      const currentUserProfile = profileResponse.data.user;
      setFollowCounts(prev => ({
        ...prev,
        [currentUserId]: {
          followers: currentUserProfile.followers?.length || 0,
          following: currentUserProfile.following?.length || 0
        }
      }));
      
      // Initialize counts for followed users
      following.forEach(user => {
        setFollowCounts(prev => ({
          ...prev,
          [user.id]: { followers: 0, following: 0 } // Will be updated when needed
        }));
      });
      
      console.log(`✅ Loaded follow state: following ${following.length} users`);
    } catch (error) {
      console.error('❌ Error loading follow state:', error);
    }
  }, []);

  const value = {
    followingUsers,
    followCounts,
    processingUsers,
    toggleFollow,
    isFollowing,
    isProcessing,
    getFollowCounts,
    initializeUserFollowState,
    loadFollowState
  };

  return (
    <FollowContext.Provider value={value}>
      {children}
    </FollowContext.Provider>
  );
};
