// main.js
const { app, BrowserWindow, Tray, Menu } = require('electron')
const path = require('path')

let win;
let tray = null;

function createWindow () {
  win = new BrowserWindow({
    // Убираем width/height, так как будет полный экран
    fullscreen: true, // <--- Включаем полный экран
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('index.html')
  win.setMenuBarVisibility(false) // Скрываем верхнее меню

  // --- ЛОГИКА СВОРАЧИВАНИЯ ---
  
  // Перехватываем событие закрытия
  win.on('close', (event) => {
    // Если приложение не находится в процессе "полного выхода"
    if (!app.isQuiting) {
      event.preventDefault(); // Отменяем закрытие
      win.hide(); // Просто прячем окно
    }
    // Если app.isQuiting === true, окно закроется как обычно
  });
}

// Создаем иконку в трее
function createTray() {
  // Убедитесь, что файл icon.png лежит рядом с main.js!
  const iconPath = path.join(__dirname, 'icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Показать будильник', 
      click: () => { win.show(); } 
    },
    { 
      label: 'Выход', 
      click: () => {
        app.isQuiting = true; // Ставим флаг, что теперь можно закрывать насовсем
        app.quit(); // Выходим
      } 
    }
  ]);

  tray.setToolTip('Мой Будильник'); // Текст при наведении
  tray.setContextMenu(contextMenu);

  // При двойном клике на иконку - открываем окно
  tray.on('double-click', () => {
    win.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Отключаем стандартное поведение "закрыть все окна = выход"
// так как у нас приложение должно жить в фоне
/* 
   В Electron по умолчанию app.quit вызывается когда все окна закрыты.
   Так как мы перехватили 'close', это событие нам не мешает,
   но для порядка можно оставить этот код пустым или не писать его вовсе для Windows.
*/