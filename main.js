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

const { app, BrowserWindow, Menu, Tray, ipcMain, dialog } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// Database setup
let db;

function initDatabase() {
  try {
    const dbPath = path.join(app.getPath('userData'), 'inception-chat.db');
    console.log('Initializing database at:', dbPath);
    db = new Database(dbPath);
    console.log('Database connected successfully');
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER,
        role TEXT NOT NULL, -- 'user' or 'assistant'
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id)
      );
    `);
    console.log('Database tables created successfully');
    
    // Check existing conversations on startup
    const existingConversations = db.prepare('SELECT COUNT(*) as count FROM conversations').get();
    console.log('Existing conversations in database:', existingConversations.count);
    
    const existingMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get();
    console.log('Existing messages in database:', existingMessages.count);
    
    // Reset currentConversationId on startup (don't continue old conversations)
    currentConversationId = null;
    console.log('Reset currentConversationId to null on startup');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    console.log('Database initialization temporarily disabled');
    db = null;
  }
}

// Keep reference to prevent garbage collection
let mainWindow;
let tray;

function createWindow() {
  // Initialize database
  initDatabase();
  
  // Create browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,    // Security best practice
      contextIsolation: true,    // Security best practice
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/256.png') // App icon
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Check for API key after window is ready
  mainWindow.webContents.once('dom-ready', async () => {
    await checkApiKey();
  });

  // Handle window close event - minimize to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show notification on first minimize (macOS)
      if (process.platform === 'darwin' && !mainWindow.trayNotificationShown) {
        // You can add a notification here if desired
        mainWindow.trayNotificationShown = true;
      }
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function checkApiKey() {
  try {
    // Load current settings
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let settings;
    
    try {
      const content = await fs.readFile(settingsPath, 'utf8');
      settings = JSON.parse(content);
    } catch (error) {
      // Use default settings if file doesn't exist
      settings = {
        apiKey: '',
        model: 'mercury-coder-small',
        maxTokens: 30000,
        theme: 'dark'
      };
    }
    
    // Check if API key is empty
    if (!settings.apiKey || settings.apiKey.trim() === '') {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'API Key Required',
        message: 'API Key Required',
        detail: 'You need to provide an API key to use Inception Chat. Please enter your API key below:',
        buttons: ['OK', 'Cancel'],
        defaultId: 0,
        cancelId: 1
      });
      
      if (result.response === 0) {
        // User clicked OK, now get the API key
        const apiKey = await promptForApiKey();
        if (apiKey && apiKey.trim() !== '') {
          settings.apiKey = apiKey.trim();
          // Save the updated settings
          await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
          console.log('API key saved successfully');
        } else {
          console.log('No API key provided');
        }
      }
    }
  } catch (error) {
    console.error('Error checking API key:', error);
  }
}

async function promptForApiKey() {
  return new Promise((resolve) => {
    // Create a simple input dialog using the renderer process
    const dialogWindow = new BrowserWindow({
      width: 400,
      height: 200,
      modal: true,
      parent: mainWindow,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      icon: path.join(__dirname, 'assets/256.png')
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Enter API Key</title>
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            padding: 20px; 
            margin: 0; 
            background: #f5f5f5;
          }
          .container { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: 500; 
          }
          input { 
            width: 100%; 
            padding: 8px; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            font-size: 14px; 
            box-sizing: border-box;
          }
          .buttons { 
            margin-top: 20px; 
            text-align: right; 
          }
          button { 
            padding: 8px 16px; 
            margin-left: 8px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 14px;
          }
          .ok { 
            background: #007AFF; 
            color: white; 
          }
          .cancel { 
            background: #f0f0f0; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <label for="apiKey">Enter your API Key:</label>
          <input type="password" id="apiKey" placeholder="Enter your API key..." autofocus>
          <div class="buttons">
            <button class="cancel" onclick="cancel()">Cancel</button>
            <button class="ok" onclick="submit()">OK</button>
          </div>
        </div>
        <script>
          function submit() {
            const apiKey = document.getElementById('apiKey').value;
            window.electronAPI.sendApiKey(apiKey);
          }
          function cancel() {
            window.electronAPI.sendApiKey('');
          }
          document.getElementById('apiKey').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') cancel();
          });
        </script>
      </body>
      </html>
    `;

    dialogWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
    
    // Handle the API key response
    const handleApiKey = (event, apiKey) => {
      dialogWindow.close();
      resolve(apiKey);
    };
    
    ipcMain.once('api-key-response', handleApiKey);
    
    dialogWindow.on('closed', () => {
      ipcMain.removeListener('api-key-response', handleApiKey);
      resolve('');
    });
    
    dialogWindow.show();
  });
}

function createTray() {
  // Only create tray on macOS for now
  if (process.platform !== 'darwin') {
    console.log('Tray not supported on this platform');
    return;
  }
  
  try {
    // Use 32-nobg.png for macOS tray (no background version)
    const trayIconPath = path.join(__dirname, 'assets', '32-nobg.png');
    
    if (!require('fs').existsSync(trayIconPath)) {
      console.error('Tray icon not found:', trayIconPath);
      return;
    }
    
    console.log('Creating tray with icon at:', trayIconPath);
    
    tray = new Tray(trayIconPath);
    console.log('Tray created successfully');
    
    // Set tooltip
    tray.setToolTip('Inception Chat');
  
  // Create context menu for the tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Inception',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'New Chat',
      accelerator: 'CmdOrCtrl+N',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('menu:new-chat');
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'About',
      click: showAboutDialog
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  // Set context menu
  tray.setContextMenu(contextMenu);
  
  // Handle double-click to show/hide window
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
  
  // Handle single click on macOS to show window
  if (process.platform === 'darwin') {
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        createWindow();
             }
     });
   }
 } catch (error) {
   console.error('Error creating tray:', error);
 }
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running in the tray even when all windows are closed
  if (process.platform !== 'darwin') {
    // Close database connection
    if (db) {
      db.close();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  // Close database connection
  if (db) {
    db.close();
  }
});

// Database IPC handlers
let currentConversationId = null;

ipcMain.handle('db:create-conversation', async (event, title) => {
  if (!db) return null;
  const stmt = db.prepare('INSERT INTO conversations (title) VALUES (?)');
  const result = stmt.run(title || 'New Chat');
  currentConversationId = result.lastInsertRowid;
  return currentConversationId;
});

ipcMain.handle('db:save-message', async (event, role, content) => {
  if (!db) return null;
  console.log('save-message called:', { role, content, currentConversationId });
  
  try {
    // Create a new conversation for each user message
    if (role === 'user') {
      currentConversationId = null; // Reset to create new conversation
    }
    
    if (!currentConversationId) {
      // Create a new conversation if none exists
      const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
      console.log('Creating new conversation with title:', title);
      try {
        const stmt = db.prepare('INSERT INTO conversations (title) VALUES (?)');
        const result = stmt.run(title);
        currentConversationId = result.lastInsertRowid;
        console.log('New conversation created with ID:', currentConversationId);
      } catch (convError) {
        console.error('Error creating conversation:', convError);
        return null;
      }
    } else {
      console.log('Using existing conversation ID:', currentConversationId);
    }
    
    console.log('Saving message to conversation:', currentConversationId);
    try {
      const stmt = db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)');
      const result = stmt.run(currentConversationId, role, content);
      console.log('Message saved with ID:', result.lastInsertRowid);
      
      // Update conversation updated_at
      const updateStmt = db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      updateStmt.run(currentConversationId);
      console.log('Conversation updated_at timestamp updated');
      
      return result.lastInsertRowid;
    } catch (msgError) {
      console.error('Error saving message:', msgError);
      return null;
    }
  } catch (error) {
    console.error('Unexpected error in save-message:', error);
    return null;
  }
});

ipcMain.handle('db:get-recent-chats', async () => {
  if (!db) return [];
  const stmt = db.prepare(`
    SELECT c.id, c.title, c.updated_at,
           (SELECT content FROM messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as first_message
    FROM conversations c
    ORDER BY c.updated_at DESC
    LIMIT 20
  `);
  return stmt.all();
});

ipcMain.handle('db:get-conversation-messages', async (event, conversationId) => {
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC');
  return stmt.all(conversationId);
});

ipcMain.handle('db:new-chat', async () => {
  if (!db) return true;
  currentConversationId = null;
  return true;
});

// Debug function to check database contents
ipcMain.handle('db:debug-contents', async () => {
  if (!db) return { error: 'Database not available' };
  
  try {
    const conversations = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all();
    const messages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 50').all();
    
    console.log('DEBUG - All conversations:', conversations);
    console.log('DEBUG - Recent messages:', messages);
    
    return {
      conversations,
      messages,
      currentConversationId
    };
  } catch (error) {
    console.error('Error getting debug contents:', error);
    return { error: error.message };
  }
});

// Custom menu with About dialog
function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Inception',
    message: 'Inception Chat',
    detail: `Version: ${app.getVersion()}\n\nAn AI-powered chat application built with Electron.\n\nPowered by Inception Labs AI\n\n© 2024 Inception Labs`,
    buttons: ['OK'],
    icon: path.join(__dirname, 'assets/256.png')
  });
}

const template = [
  // macOS app menu
  ...(process.platform === 'darwin' ? [{
    label: app.getName(),
    submenu: [
      {
        label: 'About ' + app.getName(),
        click: showAboutDialog
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }] : []),
  {
    label: 'File',
    submenu: [
      {
        label: 'New Chat',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          mainWindow.webContents.send('menu:new-chat');
        }
      },
      { type: 'separator' },
      ...(process.platform !== 'darwin' ? [{ role: 'quit' }] : [])
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectall' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  },
  // Help menu for non-macOS platforms
  ...(process.platform !== 'darwin' ? [{
    label: 'Help',
    submenu: [
      {
        label: 'About',
        click: showAboutDialog
      }
    ]
  }] : [])
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

const fs = require('fs').promises;

// Handle file dialogs
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!canceled) {
    const content = await fs.readFile(filePaths[0], 'utf8');
    return { name: path.basename(filePaths[0]), content };
  }
});

ipcMain.handle('dialog:saveFile', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Text Files', extensions: ['txt'] }
    ]
  });

  if (!canceled) {
    await fs.writeFile(filePath, content);
    return true;
  }
  return false;
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Handle API key response from dialog
ipcMain.on('api-key-response', (event, apiKey) => {
  // This is handled in the promptForApiKey function
});

// Settings file handlers
ipcMain.handle('settings:save', async (event, settings) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Settings saved to:', settingsPath);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
});

ipcMain.handle('settings:load', async () => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    const content = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(content);
    console.log('Settings loaded from:', settingsPath);
    return settings;
  } catch (error) {
    console.log('No existing settings file found or error reading settings:', error.message);
    // Return default settings if file doesn't exist
    return {
      apiKey: '',
      model: 'mercury-coder-small',
      maxTokens: 30000,
      theme: 'dark'
    };
  }
});
