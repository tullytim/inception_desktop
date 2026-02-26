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
const os = require('os');
const Database = require('better-sqlite3');

// Database setup
let db;

function initDatabase() {
  try {
    const dbPath = path.join(app.getPath('userData'), 'inception-chat.db');
    db = new Database(dbPath);

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

    // Reset currentConversationId on startup (don't continue old conversations)
    currentConversationId = null;
  } catch (error) {
    console.error('Failed to initialize database:', error);
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
    
    tray = new Tray(trayIconPath);
    
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

  try {
    if (role === 'user') {
      currentConversationId = null;
    }

    if (!currentConversationId) {
      const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
      try {
        const stmt = db.prepare('INSERT INTO conversations (title) VALUES (?)');
        const result = stmt.run(title);
        currentConversationId = result.lastInsertRowid;
      } catch (convError) {
        console.error('Error creating conversation:', convError);
        return null;
      }
    }

    try {
      const stmt = db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)');
      const result = stmt.run(currentConversationId, role, content);
      db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(currentConversationId);
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
    detail: `Version: ${app.getVersion()}\n\nAn AI-powered chat application built with Electron.\n\nCreated by Tim Tully\n\n© 2025 Tim Tully`,
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

function getInceptionConfigPath() {
  return path.join(os.homedir(), '.inception', 'config.json');
}

async function ensureInceptionDir() {
  const dir = path.join(os.homedir(), '.inception');
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // already exists
  }
}

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

// Settings file handlers
ipcMain.handle('settings:save', async (event, settings) => {
  try {
    // Save API key to ~/.inception/config.json
    if (settings.apiKey !== undefined) {
      await ensureInceptionDir();
      await fs.writeFile(getInceptionConfigPath(), JSON.stringify({ apiKey: settings.apiKey }, null, 2));
    }

    // Save other settings (without apiKey) to userData/settings.json
    const { apiKey, ...otherSettings } = settings;
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(otherSettings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
});

ipcMain.handle('settings:load', async () => {
  const defaults = { model: 'mercury-2', maxTokens: 16384, theme: 'dark' };

  // Load non-key settings from userData/settings.json
  let otherSettings = { ...defaults };
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    const content = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(content);
    const { apiKey: _legacy, ...rest } = parsed; // strip any legacy apiKey
    otherSettings = { ...defaults, ...rest };
  } catch (e) {
    // use defaults
  }

  // Load API key from ~/.inception; migrate from legacy settings.json if needed
  let apiKey = '';
  try {
    const content = await fs.readFile(getInceptionConfigPath(), 'utf8');
    apiKey = JSON.parse(content).apiKey || '';
  } catch (e) {
    // Check for legacy apiKey in settings.json and migrate it
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json');
      const content = await fs.readFile(settingsPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed.apiKey) {
        apiKey = parsed.apiKey;
        // Migrate to ~/.inception/config.json
        await ensureInceptionDir();
        await fs.writeFile(getInceptionConfigPath(), JSON.stringify({ apiKey }, null, 2));
        // Remove from settings.json
        const { apiKey: _removed, ...rest } = parsed;
        await fs.writeFile(settingsPath, JSON.stringify(rest, null, 2));
      }
    } catch (_) {
      // no legacy key either
    }
  }

  return { ...otherSettings, apiKey };
});
