const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// Keep the live data file in the standard per-user app-data folder, outside
// the app bundle, so it survives rebuilds/reinstalls and stays writable even
// if the bundle itself is packaged read-only (asar).
const userDataDir = app.getPath('userData');
fs.mkdirSync(userDataDir, { recursive: true });

const userDataFile = path.join(userDataDir, 'data.json');
const seedFile = path.join(__dirname, 'data.json');
if (!fs.existsSync(userDataFile) && fs.existsSync(seedFile)) {
  fs.copyFileSync(seedFile, userDataFile);
}
process.env.TRACKER_DATA_DIR = userDataDir;

const server = require('./server.js');

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    dialog.showErrorBox(
      'Rundown',
      'Port 8787 is already in use by another instance of Rundown (or its dev server). ' +
      'Quit that instance first, then reopen Rundown.'
    );
  } else {
    dialog.showErrorBox('Rundown', 'Failed to start: ' + err.message);
  }
  app.quit();
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Rundown',
    webPreferences: {
      contextIsolation: true
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL('http://127.0.0.1:8787');
}

app.whenReady().then(() => {
  if (server.listening) {
    createWindow();
  } else {
    server.once('listening', createWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
