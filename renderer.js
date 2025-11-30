// renderer.js
const { ipcRenderer } = require('electron'); // Если нужно общаться с main

const clockDisplay = document.getElementById('clock');
const alarmInput = document.getElementById('alarmTimeInput');
const addBtn = document.getElementById('addBtn');
const alarmsList = document.getElementById('alarmsList');
const exitBtn = document.getElementById('exitBtn');

// Элементы оверлея
const alarmOverlay = document.getElementById('alarmOverlay');
const stopBtn = document.getElementById('stopBtn');
const alarmTextTime = document.getElementById('alarmTextTime');

// Звук
const audio = new Audio('alert.mp3');
audio.loop = true;

// Хранилище будильников (массив строк "ЧЧ:ММ")
let alarms = [];
// Чтобы не звонил каждую секунду в течение одной минуты, запоминаем, когда звонили
let lastTriggeredTime = ""; 

// --- Загрузка ---
const savedAlarms = JSON.parse(localStorage.getItem('myAlarms') || '[]');
if (Array.isArray(savedAlarms)) {
    alarms = savedAlarms;
    renderAlarms();
}

// --- Функции ---

function updateTime() {
    const now = new Date();
    const currentString = now.toLocaleTimeString('ru-RU');
    clockDisplay.innerText = currentString;
    
    const currentHM = now.toTimeString().slice(0, 5); // "14:30"

    // Проверяем, есть ли такой будильник в списке
    // И проверяем, не звонили ли мы уже в эту минуту (чтобы не зациклило)
    if (alarms.includes(currentHM) && currentHM !== lastTriggeredTime) {
        startAlarm(currentHM);
    }
}

function startAlarm(time) {
    lastTriggeredTime = time; // Запоминаем, что на это время уже сработали
    
    audio.play();
    alarmOverlay.classList.remove('hidden'); // Показываем экран
    alarmTextTime.innerText = time;
    
    // Отправляем уведомление
    new Notification("Будильник", { body: `Время: ${time}` });
}

function stopAlarm() {
    audio.pause();
    audio.currentTime = 0;
    alarmOverlay.classList.add('hidden'); // Скрываем экран
}

function addAlarm() {
    const time = alarmInput.value;
    if (!time) return alert("Выберите время!");
    
    if (alarms.includes(time)) {
        return alert("Такой будильник уже есть!");
    }

    alarms.push(time);
    alarms.sort(); // Сортируем по времени
    saveAndRender();
}

function deleteAlarm(timeToDelete) {
    alarms = alarms.filter(time => time !== timeToDelete);
    saveAndRender();
}

function saveAndRender() {
    localStorage.setItem('myAlarms', JSON.stringify(alarms));
    renderAlarms();
}

function renderAlarms() {
    alarmsList.innerHTML = '';
    
    if (alarms.length === 0) {
        // Если пусто
        const emptyMsg = document.createElement('div');
        emptyMsg.className = "text-gray-500 mt-4";
        emptyMsg.innerText = "Нет будильников";
        alarmsList.appendChild(emptyMsg);
        return;
    }

    alarms.forEach(time => {
        // 1. Создаем элементы через JS, а не через HTML-строку
        const li = document.createElement('li');
        li.className = "bg-item p-3 rounded-lg flex justify-between items-center text-2xl border-l-4 border-neon shadow-md hover:bg-[#363b45] transition-colors";
        
        const span = document.createElement('span');
        span.className = "font-mono text-white";
        span.innerText = time;

        const btn = document.createElement('button');
        btn.className = "text-danger hover:text-red-400 hover:scale-110 transition-transform text-xl px-2 cursor-pointer outline-none";
        btn.innerText = "✕";
        
        // 2. Назначаем обработчик события напрямую (это работает даже при строгой защите)
        btn.onclick = function() {
            deleteAlarm(time);
        };

        // 3. Собираем всё вместе
        li.appendChild(span);
        li.appendChild(btn);
        alarmsList.appendChild(li);
    });
}

// --- Обработчики событий ---

addBtn.addEventListener('click', addAlarm);
stopBtn.addEventListener('click', stopAlarm);

// Кнопка выхода из приложения (так как в full screen нет крестика)
exitBtn.addEventListener('click', () => {
    // Можно просто закрыть окно
    window.close(); 
});

// Запуск часов
setInterval(updateTime, 1000);
updateTime();