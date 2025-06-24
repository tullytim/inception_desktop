const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content) => ipcRenderer.invoke('dialog:saveFile', content),
  
  // System info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // Custom events
  onMenuAction: (callback) => ipcRenderer.on('menu:action', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Database functions
  createConversation: (title) => ipcRenderer.invoke('db:create-conversation', title),
  saveMessage: (role, content) => ipcRenderer.invoke('db:save-message', role, content),
  getRecentChats: () => ipcRenderer.invoke('db:get-recent-chats'),
  getConversationMessages: (conversationId) => ipcRenderer.invoke('db:get-conversation-messages', conversationId),
  newChat: () => ipcRenderer.invoke('db:new-chat'),
  debugDatabase: () => ipcRenderer.invoke('db:debug-contents'),
  
  // Settings functions
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  loadSettings: () => ipcRenderer.invoke('settings:load')
});
