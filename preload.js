/**
 * MIT License
 * 
 * Copyright (c) 2025 Tim Tully
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
  onMenuCommand: (eventName, callback) => {
    const allowedChannels = ['menu:action', 'menu:new-chat'];
    if (allowedChannels.includes(eventName)) {
      ipcRenderer.on(eventName, callback);
    }
  },
  
  // Remove listeners (restricted to known channels)
  removeAllListeners: (channel) => {
    const allowedChannels = ['menu:action', 'menu:new-chat'];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // Database functions
  createConversation: (title) => ipcRenderer.invoke('db:create-conversation', title),
  saveMessage: (role, content) => ipcRenderer.invoke('db:save-message', role, content),
  getRecentChats: () => ipcRenderer.invoke('db:get-recent-chats'),
  getConversationMessages: (conversationId) => ipcRenderer.invoke('db:get-conversation-messages', conversationId),
  newChat: () => ipcRenderer.invoke('db:new-chat'),

  // Settings functions
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  
  // API key dialog
  sendApiKey: (apiKey) => ipcRenderer.send('api-key-response', apiKey)
});
