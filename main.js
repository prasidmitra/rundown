const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

// Display name only (menu bar, About/Hide/Quit items). setName() also
// shifts Electron's default userData path to match the new name, which
// would silently orphan existing data - so pin userData explicitly.
app.setName('Rundown');
app.setPath('userData', path.join(app.getPath('appData'), 'Rundown'));

// Keep the live data file in the standard per-user app-data folder, outside
// the app bundle, so it survives rebuilds/reinstalls and stays writable even
// if the bundle itself is packaged read-only (asar).
const userDataDir = app.getPath('userData');
fs.mkdirSync(userDataDir, { recursive: true });

const userDataFile = path.join(userDataDir, 'data.json');
// The userData folder used to be named 'tracker' (this app's old internal
// name). Migrate any data left there on first run under the new 'Rundown'
// folder, so renaming didn't orphan existing users' data.
const legacyDataFile = path.join(app.getPath('appData'), 'tracker', 'data.json');
const seedFile = path.join(__dirname, 'data.json');
if (!fs.existsSync(userDataFile)) {
  if (fs.existsSync(legacyDataFile)) {
    fs.copyFileSync(legacyDataFile, userDataFile);
  } else if (fs.existsSync(seedFile)) {
    fs.copyFileSync(seedFile, userDataFile);
  }
}
process.env.RUNDOWN_DATA_DIR = userDataDir;

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

const logoPath = path.join(__dirname, 'logo_icon_source.png');
// Windows' taskbar expects a proper multi-resolution .ico (pre-baked
// 16/32/48px bitmaps); feeding it the same huge single-resolution PNG used
// for macOS's dock (which scales a high-res PNG fine) makes Windows
// downsample it awkwardly, rendering smaller/blurrier than icons that ship
// a real .ico. macOS/Linux keep the PNG.
const windowIconPath = process.platform === 'win32' ? path.join(__dirname, 'icon.ico') : logoPath;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Rundown',
    icon: windowIconPath,
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
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(logoPath); // packaged builds use icon.icns instead; this covers `npm start`
  } else {
    // On macOS the app menu lives in the system-wide menu bar (outside the
    // window) and provides standard Cmd+C/V/Q accelerators, so it stays.
    // Windows/Linux have no such OS-level menu bar - Electron's default
    // menu would otherwise render as an unwanted File/Edit/View/Window
    // strip inside the window itself. Rundown has no menu items of its
    // own, so just remove it there.
    Menu.setApplicationMenu(null);
  }

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
