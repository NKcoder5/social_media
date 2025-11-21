import axios from 'axios';

// Force production URL for deployed version
const API_BASE_URL = window.location.hostname === 'sociogram-1.onrender.com' 
  ? 'https://sociogram-n73b.onrender.com/api/v1'
  : import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? 'https://social-media-pdbl.onrender.com/api/v1' : 'https://social-media-pdbl.onrender.com/api/v1');

console.log('🌐 API Base URL:', API_BASE_URL);
console.log('🏠 Current hostname:', window.location.hostname);
console.log('🔧 Environment:', import.meta.env.MODE);

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      console.log('🔄 Authentication failed - clearing token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if not already on auth pages
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register') && !currentPath.includes('/')) {
        console.log('🔄 Redirecting to login page');
        window.location.href = '/login';
      }
    }
    
    // Handle user not found for own profile (indicates invalid token)
    if (error.response?.status === 404 && error.config?.url?.includes('/user/profile') && !error.config?.url?.includes('/user/profile/')) {
      console.log('🔄 Own profile not found - token may be invalid');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register') && !currentPath.includes('/')) {
        console.log('🔄 Redirecting to login page');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export const authAPI = {
  // Generic GET method for authenticated requests
  get: (endpoint) => api.get(endpoint),
  post: (endpoint, data) => api.post(endpoint, data),
  
  // User authentication
  register: (userData) => api.post('/user/register', userData),
  login: (userData) => api.post('/user/login', userData),
  logout: () => api.get('/user/logout'),
  getProfile: (userId) => userId ? api.get(`/user/profile/${userId}`) : api.get('/user/profile'),
  editProfile: (formData) => api.post('/user/profile/edit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadProfilePicture: (formData) => api.post('/user/profile/picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getSuggestedUsers: () => api.get('/user/suggested'),
  followUser: (userId) => api.post(`/user/followorunfollow/${userId}`),
  followUnfollow: (userId) => api.post(`/user/followorunfollow/${userId}`),
  getUserByUsername: (username) => api.get(`/user/profile/username/${username}`),
  getFollowers: (userId) => api.get(`/user/${userId}/followers`),
  getFollowing: (userId) => api.get(`/user/${userId}/following`),
  getMutualConnections: () => api.get('/user/mutual-connections'),
};

// Post API calls
export const postAPI = {
  addPost: (formData) => {
    console.log('🚀 Making POST request to:', API_BASE_URL + '/post/addpost');
    console.log('📦 FormData entries:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value);
    }
    
    return api.post('/post/addpost', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getAllPosts: () => api.get('/post/all'),
  getUserPosts: (userId) => userId ? api.get(`/post/userpost/${userId}`) : api.get('/post/userpost/all'),
  getUserPostsByUsername: (username) => api.get(`/post/userpost/username/${username}`),
  likePost: (postId) => api.get(`/post/${postId}/like`),
  dislikePost: (postId) => api.get(`/post/${postId}/dislike`),
  addComment: (postId, text) => api.post(`/post/${postId}/comment`, { text }),
  getCommentsOfPost: (postId) => api.get(`/post/${postId}/comment/all`),
  deletePost: (postId) => api.delete(`/post/delete/${postId}`),
  bookmarkPost: (postId) => api.get(`/post/${postId}/bookmark`),
};

// Message API calls
export const messageAPI = {
  // Core messaging
  sendMessage: (receiverId, message, file = null) => 
    api.post(`/message/send/${receiverId}`, { message, file }),
  getAllMessages: (userId) => api.get(`/message/all/${userId}`),
  getMessages: (userId) => api.get(`/message/all/${userId}`),
  getConversations: () => api.get('/message/conversations'),
  getByConversation: (conversationId) => api.get(`/message/conversation/${conversationId}`),
  getConversationMessages: (conversationId) => api.get(`/message/conversation/${conversationId}`),
  sendToConversation: (conversationId, message, file = null) =>
    api.post(`/message/conversation/${conversationId}/send`, { message, file }),
  createGroupChat: (data) => api.post('/message/group', data),
  deleteMessage: (messageId) => api.delete(`/message/delete/${messageId}`),
  
  // File handling
  uploadFile: (formData) => 
    api.post('/message/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  // Real-time features
  sendTyping: (receiverId, conversationId, isTyping) =>
    api.post('/message/typing', { receiverId, conversationId, isTyping }),
  
  // AI-powered features
  aiChatAssistant: (data) => api.post('/message/ai/chat', data),
  ensureAIConversation: () => api.get('/message/ai/conversation'),
  getSmartReplies: (data) => api.post('/message/ai/smart-replies', data),
  improveMessage: (data) => api.post('/message/ai/improve', data),
  translateMessage: (data) => api.post('/message/ai/translate', data),
  getConversationStarter: (targetUserId) => api.get(`/message/ai/starter/${targetUserId}`),
  moderateMessage: (data) => api.post('/message/ai/moderate', data),
  
  // Search and filtering
  searchMessages: (params) => api.get('/message/search', { params }),
  
  // Group management
  addGroupMember: (groupId, userId) => api.post(`/message/group/${groupId}/add`, { userId }),
  removeGroupMember: (groupId, userId) => api.post(`/message/group/${groupId}/remove`, { userId }),
  changeGroupRole: (groupId, userId, role) => api.post(`/message/group/${groupId}/role`, { userId, role }),
  leaveGroup: (groupId) => api.post(`/message/group/${groupId}/leave`),
  deleteGroup: (groupId) => api.delete(`/message/group/${groupId}`),
  
  // Message actions
  forwardMessage: (messageId, conversationIds, message) => 
    api.post('/message/forward', { messageId, conversationIds, message }),
  starMessage: (messageId) => api.post(`/message/${messageId}/star`),
  reportMessage: (messageId, reason, details) => 
    api.post(`/message/${messageId}/report`, { reason, details }),
  editMessage: (messageId, content) => api.put(`/message/${messageId}`, { content }),
  
  // Read receipts
  markAsRead: (messageId) => api.post(`/message/${messageId}/read`),
  getMessageStatus: (messageId) => api.get(`/message/${messageId}/status`)
};

// Upload API calls
export const uploadAPI = {
  uploadFile: (formData) => api.post('/upload/file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

// Notification API calls
export const notificationAPI = {
  getNotifications: (page = 1, limit = 20) => api.get(`/notifications?page=${page}&limit=${limit}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  deleteNotification: (notificationId) => api.delete(`/notifications/${notificationId}`)
};

// Group API calls
export const groupAPI = {
  createGroup: (groupData) => api.post('/group/create', groupData),
  getUserGroups: () => api.get('/group/my-groups'),
  addMember: (groupId, userId) => api.post(`/group/${groupId}/add-member`, { userId }),
  removeMember: (groupId, userId) => api.post(`/group/${groupId}/remove-member`, { userId }),
  updateGroup: (groupId, updateData) => api.put(`/group/${groupId}/update`, updateData),
  deleteGroup: (groupId) => api.delete(`/group/${groupId}/delete`),
  makeAdmin: (groupId, userId) => api.post(`/group/${groupId}/make-admin`, { userId }),
  removeAdmin: (groupId, userId) => api.post(`/group/${groupId}/remove-admin`, { userId })
};

// Explore API calls
export const exploreAPI = {
  getPosts: (page = 1, limit = 20) => api.get(`/explore/posts?page=${page}&limit=${limit}`),
  getReels: (page = 1, limit = 10) => api.get(`/explore/reels?page=${page}&limit=${limit}`),
  getTrendingHashtags: (limit = 10) => api.get(`/explore/hashtags?limit=${limit}`),
  searchPosts: (query, page = 1, limit = 20) => api.get(`/explore/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`),
  getUsers: (limit = 10) => api.get(`/explore/users?limit=${limit}`)
};

// Story API calls
export const storyAPI = {
  createStory: (formData) => api.post('/story/create', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAllStories: () => api.get('/story/all'),
  getUserStories: (userId) => api.get(`/story/user/${userId}`),
  markAsViewed: (storyId) => api.post(`/story/${storyId}/view`),
  deleteStory: (storyId) => api.delete(`/story/${storyId}`)
};

export default api;
