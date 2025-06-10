const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
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
    icon: path.join(__dirname, 'assets/app-icon.png') // Updated to match sidebar logo
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Close database connection
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
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

// Optional: Custom menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          // Handle new file
        }
      },
      { type: 'separator' },
      { role: 'quit' }
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
      { role: 'paste' }
    ]
  }
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
