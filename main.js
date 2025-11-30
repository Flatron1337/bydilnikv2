const { app, BrowserWindow, Tray, Menu, powerSaveBlocker, shell } = require('electron');
const path = require('path');
const log = require('electron-log');

// --- НАСТРОЙКА ЛОГОВ ---
log.transports.file.level = 'info';
Object.assign(console, log.functions); // Перенаправляем console.log в файл

console.log('------------------------------------------------');
console.log(`[Main] Запуск приложения. Версия: ${app.getVersion()}`);
console.log(`[Main] Платформа: ${process.platform}`);

let win;
let tray = null;
let powerBlockerId = null;

// Блокируем засыпание системы, чтобы будильник не проспал
powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
console.log(`[Main] Блокировка сна активна (ID: ${powerBlockerId})`);

// Защита от повторного запуска (Single Instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      nodeIntegration: true, // Нужно для fs и renderer.js
      contextIsolation: false
    },
    // frame: false, // Раскомментируйте, если хотите полностью свой дизайн окна без рамки
  });

  win.loadFile('index.html');
  win.setMenuBarVisibility(false);

  // Обработка закрытия (сворачивание в трей)
  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
      console.log('[Main] Окно свернуто в трей');
    }
  });
}

function createTray() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  tray = new Tray(path.join(__dirname, iconName));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Открыть', click: () => win.show() },
    { type: 'separator' },
    { label: 'Выход', click: () => {
        app.isQuiting = true;
        app.quit();
      } 
    }
  ]);
  
  tray.setToolTip('Super Alarm');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => win.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Если запущена вторая копия - фокусируемся на первой
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});