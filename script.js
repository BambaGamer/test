// --- 1. הגדרות מסד הנתונים והאודיו ---
const dbName = "InstifyDB";
let db;
let songs = [];
const audio = new Audio();
audio.preload = 'auto';

const request = indexedDB.open(dbName, 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("songs")) {
        db.createObjectStore("songs", { keyPath: "id" });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    loadSongsFromDB();
};

request.onerror = (e) => console.error("Database error:", e.target.error);

// --- 2. טעינת השירים מה-DB ---
function loadSongsFromDB() {
    const tx = db.transaction("songs", "readonly");
    const store = tx.objectStore("songs");
    const getRequest = store.getAll();

    getRequest.onsuccess = () => {
        songs = getRequest.result || [];
        render();
    };
}

// --- 3. העלאת קובץ ---
document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    const songTitle = prompt("איך לקרוא לשיר?", file.name.replace(/\.[^/.]+$/, "")) || "שיר חדש";
    
    const newSong = {
        id: Date.now(),
        title: songTitle,
        fileData: file,
        image: 'https://i.pinimg.com/1200x/a8/98/34/a89834b9eb73330380b26ab3cb612a8e.jpg'
    };

    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    const addRequest = store.add(newSong);

    addRequest.onsuccess = () => {
        songs.unshift(newSong);
        render();
        if (loader) loader.style.display = 'none';
        event.target.value = '';
    };
});

// --- 4. פונקציית הניגון (התיקון לאייפון) ---
function play(song) {
    const player = document.getElementById('player');
    const playerTitle = document.getElementById('playerTitle');
    const playerImg = document.getElementById('playerImg');

    if (audio.dataset.currentId === song.id.toString()) {
        audio.paused ? audio.play() : audio.pause();
        return;
    }

    // יצירת קישור לקובץ
    const songUrl = URL.createObjectURL(song.fileData);
    audio.src = songUrl;
    audio.dataset.currentId = song.id;
    audio.load(); // הכרחי לריענון ה-Buffer באייפון

    audio.play().then(() => {
        if (player) player.style.display = 'flex';
        if (playerTitle) playerTitle.innerText = song.title;
        if (playerImg) playerImg.src = song.image;

        // עדכון Media Session (מסך נעילה)
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title,
                artist: 'Instify',
                album: 'My Playlist',
                artwork: [{ src: song.image, sizes: '512x512', type: 'image/jpg' }]
            });
        }
    }).catch(e => console.error("Playback error:", e));
}

// --- 5. שליטה ממסך הנעילה (MediaSession Handlers) ---
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', async () => {
        const currentTime = audio.currentTime;
        try {
            await audio.play();
        } catch (err) {
            // אם נרדם - טוענים מחדש לאותה נקודה
            audio.load();
            audio.currentTime = currentTime;
            audio.play();
        }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
    });
}

// מאזינים לאירועי אודיו לעדכון ה-UI והמערכת
audio.addEventListener('play', () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
    updateBtn();
});

audio.addEventListener('pause', () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
    updateBtn();
});

// --- 6. עדכון כפתור Play/Pause (UI) ---
function updateBtn() {
    const mainPlayBtnImg = document.querySelector('#playBtn .play-png-icon');
    if (mainPlayBtnImg) {
        mainPlayBtnImg.src = audio.paused ? 'play-icon.png' : 'pause-icon.png';
    }
}

// --- 7. רינדור רשימת השירים ---
function render() {
    const list = document.getElementById('playlist');
    const count = document.getElementById('count');
    if (!list) return;

    list.innerHTML = '';
    if (count) count.innerText = `${songs.length} שירים בפלייליסט`;

    songs.forEach((song) => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <img src="${song.image}" class="thumb">
            <div class="info">
                <p>${song.title}</p>
            </div>
            <button class="btn-delete" onclick="deleteSong(event, ${song.id})">ㄨ</button>
        `;
        card.onclick = () => play(song);
        list.appendChild(card);
    });
}

// --- 8. מחיקה ---
function deleteSong(e, id) {
    e.stopPropagation();
    if (!confirm("למחוק את השיר?")) return;

    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    store.delete(id);

    songs = songs.filter(s => s.id !== id);
    if (audio.dataset.currentId === id.toString()) {
        audio.pause();
        document.getElementById('player').style.display = 'none';
    }
    render();
}

// --- 9. הגדרות נוספות ו-Theme ---
document.addEventListener('DOMContentLoaded', () => {
    const mainPlayBtn = document.getElementById('playBtn');
    if (mainPlayBtn) {
        mainPlayBtn.onclick = (e) => {
            e.stopPropagation();
            if (!audio.src) return;
            audio.paused ? audio.play() : audio.pause();
        };
    }

    // טעינת מצב לילה
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        const themeEmoji = document.getElementById('themeEmoji');
        if (themeEmoji) themeEmoji.innerText = '☀️';
    }
});

// שינוי מצב לילה/יום
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        const themeEmoji = document.getElementById('themeEmoji');
        if (themeEmoji) themeEmoji.innerText = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

// רישום Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registered"));
}