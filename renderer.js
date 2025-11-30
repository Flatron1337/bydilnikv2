const { shell, ipcRenderer, webUtils } = require('electron'); // <--- Добавили webUtils
const log = require('electron-log');
const path = require('path');

// --- ЛОГИРОВАНИЕ ---
function logInfo(msg) {
    console.log(`[Renderer] ${msg}`);
    log.info(`[Renderer] ${msg}`);
}
function logError(msg, err) {
    console.error(`[Renderer] ${msg}`, err);
    log.error(`[Renderer] ${msg}`, err);
}

logInfo('Интерфейс инициализирован');

// --- DOM Элементы ---
const clockDisplay = document.getElementById('clock');
const sleepProgress = document.getElementById('sleepProgress');
const alarmsList = document.getElementById('alarmsList');

const handHour = document.getElementById('handHour');
const handMin = document.getElementById('handMin');
const handSec = document.getElementById('handSec');

const createModal = document.getElementById('createModal');
const openModalBtn = document.getElementById('openModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const saveAlarmBtn = document.getElementById('saveAlarmBtn');
const exitAppBtn = document.getElementById('exitAppBtn');

const alarmOverlay = document.getElementById('alarmOverlay');
const overlayLabel = document.getElementById('overlayLabel');
const alarmTextTime = document.getElementById('alarmTextTime');
const stopBtn = document.getElementById('stopBtn');
const snoozeBtn = document.getElementById('snoozeBtn');

const soundInput = document.getElementById('soundInput');

// --- Состояние ---
let alarms = JSON.parse(localStorage.getItem('alarmsV2') || '[]');
let currentTheme = localStorage.getItem('theme') || 'default';
let customSoundPath = localStorage.getItem('customSoundPath');
let triggeredAlarmId = null; 
let audio = new Audio();
let fadeInterval = null;

// =========================================================
// ГЛОБАЛЬНЫЕ ФУНКЦИИ
// =========================================================

// 1. Тест звука
window.testSound = () => {
    logInfo(`Тест звука. Файл: ${audio.src}`);
    
    // Проверка, существует ли файл (базовая)
    if (!audio.src || audio.src === 'undefined') {
        alert('Ошибка: Аудиофайл не выбран или не найден!');
        return;
    }

    audio.currentTime = 0;
    audio.volume = 1;
    audio.loop = false;
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise
            .then(() => logInfo('Звук играет успешно'))
            .catch(e => {
                logError("Ошибка воспроизведения (Тест)", e);
                alert("Не удалось воспроизвести звук. Проверьте формат файла.");
            });
    }
    
    // Остановить через 5 сек
    setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
    }, 5000);
};

// 2. Смена темы
window.setTheme = (themeName) => {
    document.body.dataset.theme = themeName;
    localStorage.setItem('theme', themeName);
    currentTheme = themeName;
    logInfo(`Тема изменена: ${themeName}`);
};

// 3. Открытие логов
window.openLogs = () => {
    let logPath;
    try {
        logPath = log.transports.file.getFile().path;
    } catch (e) {
        logPath = path.join(process.env.APPDATA, 'bydilnikv2', 'logs');
    }
    
    if (logPath) {
        shell.showItemInFolder(logPath);
    } else {
        alert("Не удалось найти путь к логам");
    }
};

// =========================================================
// ИНИЦИАЛИЗАЦИЯ
// =========================================================

// Настройка пути к звуку
if (customSoundPath) {
    audio.src = customSoundPath;
    logInfo(`Загружен пользовательский звук: ${customSoundPath}`);
} else {
    // ВАЖНО: Используем полный путь, чтобы Electron точно нашел файл
    const defaultSound = path.join(__dirname, 'alert.mp3');
    audio.src = defaultSound;
    logInfo(`Загружен стандартный звук: ${defaultSound}`);
}

setTheme(currentTheme);
renderAlarms();
setInterval(updateClock, 1000);
updateClock();

// =========================================================
// ЛОГИКА
// =========================================================

function updateClock() {
    const now = new Date();
    clockDisplay.innerText = now.toLocaleTimeString('ru-RU');
    
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();
    
    const secDeg = ((seconds / 60) * 360);
    const minDeg = ((minutes / 60) * 360) + ((seconds/60)*6);
    const hourDeg = ((hours / 12) * 360) + ((minutes/60)*30);

    handSec.style.transform = `translateX(-50%) rotate(${secDeg}deg)`;
    handMin.style.transform = `translateX(-50%) rotate(${minDeg}deg)`;
    handHour.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;

    checkAlarms(now);
    updateSleepInfo(now);
}

function checkAlarms(now) {
    if (!alarmOverlay.classList.contains('hidden')) return;

    const currentHM = now.toTimeString().slice(0, 5);
    const currentDay = now.getDay().toString();

    const foundAlarm = alarms.find(alarm => {
        if (!alarm.active) return false;
        if (alarm.time !== currentHM) return false;
        if (alarm.once) return true;
        if (alarm.days.includes(currentDay)) return true;
        return false;
    });

    if (foundAlarm && triggeredAlarmId !== foundAlarm.id) {
        triggerAlarm(foundAlarm);
    } else if (!foundAlarm) {
        triggeredAlarmId = null;
    }
}

function updateSleepInfo(now) {
    const activeCount = alarms.filter(a => a.active).length;
    sleepProgress.innerText = activeCount === 0 ? "Будильники отключены 💤" : `Активных будильников: ${activeCount}`;
}

function triggerAlarm(alarm) {
    triggeredAlarmId = alarm.id;
    logInfo(`!!! ТРЕВОГА: ${alarm.time}`);

    overlayLabel.innerText = alarm.label || "ПОРА ВСТАВАТЬ!";
    alarmTextTime.innerText = alarm.time;
    alarmOverlay.classList.remove('hidden');

    audio.currentTime = 0;
    audio.volume = 0;
    audio.loop = true;
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => logError('Ошибка старта аудио при тревоге', e));
    }

    if (fadeInterval) clearInterval(fadeInterval);
    fadeInterval = setInterval(() => {
        if (audio.volume < 1.0) {
            audio.volume = Math.min(1.0, audio.volume + 0.05);
        } else {
            clearInterval(fadeInterval);
        }
    }, 1000);
}

function stopAlarm() {
    logInfo('Тревога остановлена');
    audio.pause();
    audio.currentTime = 0;
    clearInterval(fadeInterval);
    alarmOverlay.classList.add('hidden');
    
    const alarm = alarms.find(a => a.id === triggeredAlarmId);
    if (alarm && alarm.once) {
        deleteAlarm(alarm.id);
    }
}

function snooze() {
    logInfo('Snooze');
    stopAlarm();
    
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const snoozeTime = now.toTimeString().slice(0, 5);
    
    alarms.push({
        id: Date.now(),
        time: snoozeTime,
        label: 'Отложено (5 мин)',
        days: [],
        active: true,
        once: true
    });
    saveAlarms();
}

// --- СПИСОК ---
function renderAlarms() {
    alarmsList.innerHTML = '';
    alarms.sort((a,b) => a.time.localeCompare(b.time));

    if (alarms.length === 0) {
        alarmsList.innerHTML = '<div class="text-center opacity-40 mt-10 text-sm">Список пуст</div>';
        return;
    }

    alarms.forEach(alarm => {
        const li = document.createElement('li');
        const opacity = alarm.active ? 'opacity-100' : 'opacity-50 grayscale';
        
        let daysText = "Разовый";
        if (!alarm.once && alarm.days.length > 0) {
            const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
            const sortedDays = alarm.days.map(Number).sort().map(d => dayNames[d]);
            
            if (alarm.days.length === 7) daysText = "Каждый день";
            else if (alarm.days.length === 5 && !alarm.days.includes('0') && !alarm.days.includes('6')) daysText = "Будни";
            else daysText = sortedDays.join(', ');
        }

        li.className = `bg-item p-4 rounded-xl flex justify-between items-center transition-all duration-300 hover:bg-white/5 ${opacity}`;
        li.innerHTML = `
            <div class="flex flex-col">
                <div class="flex items-baseline gap-3">
                    <span class="text-3xl font-bold text-neon font-mono tracking-tighter">${alarm.time}</span>
                    <span class="text-sm font-bold truncate max-w-[120px]">${alarm.label}</span>
                </div>
                <span class="text-xs opacity-60 font-medium uppercase tracking-wider mt-1">${daysText}</span>
            </div>
            <div class="flex gap-3 items-center">
                <button class="toggle-btn w-10 h-6 rounded-full relative transition-colors cursor-pointer ${alarm.active ? 'bg-neon' : 'bg-gray-600'}">
                     <div class="w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${alarm.active ? 'left-5' : 'left-1'}"></div>
                </button>
                <button class="del-btn text-danger bg-danger/10 p-2 rounded-lg hover:bg-danger hover:text-white transition-all ml-2 cursor-pointer">✕</button>
            </div>
        `;
        
        li.querySelector('.toggle-btn').onclick = () => { 
            alarm.active = !alarm.active; 
            saveAlarms(); 
        };
        li.querySelector('.del-btn').onclick = () => deleteAlarm(alarm.id);
        alarmsList.appendChild(li);
    });
}

function saveAlarms() {
    localStorage.setItem('alarmsV2', JSON.stringify(alarms));
    renderAlarms();
}

function deleteAlarm(id) {
    alarms = alarms.filter(a => a.id !== id);
    saveAlarms();
}

// --- МОДАЛКА ---
openModalBtn.onclick = () => {
    createModal.classList.remove('hidden');
    document.getElementById('modalTime').value = '';
    document.getElementById('modalLabel').value = '';
    document.querySelectorAll('.day-check').forEach(cb => cb.checked = false);
};
cancelModalBtn.onclick = () => createModal.classList.add('hidden');

saveAlarmBtn.onclick = () => {
    const time = document.getElementById('modalTime').value;
    const label = document.getElementById('modalLabel').value;
    const days = [];
    document.querySelectorAll('.day-check:checked').forEach(cb => days.push(cb.value));

    if (!time) return alert("Введите время!");

    alarms.push({
        id: Date.now(),
        time,
        label,
        days,
        active: true,
        once: days.length === 0
    });
    
    logInfo(`Создан новый: ${time}`);
    saveAlarms();
    createModal.classList.add('hidden');
};

// --- ИСПРАВЛЕНИЕ ЗАГРУЗКИ ФАЙЛОВ ---
soundInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // ВАЖНО: Используем webUtils для получения правильного пути в новых версиях Electron
        try {
            const filePath = webUtils.getPathForFile(file);
            localStorage.setItem('customSoundPath', filePath);
            audio.src = filePath;
            logInfo(`Изменен звук: ${filePath}`);
            alert("Мелодия сохранена! Нажмите 'Тест', чтобы проверить.");
        } catch (err) {
            logError("Ошибка получения пути файла", err);
            alert("Ошибка при выборе файла. Попробуйте другой.");
        }
    }
});

stopBtn.onclick = stopAlarm;
snoozeBtn.onclick = snooze;
exitAppBtn.onclick = () => window.close();