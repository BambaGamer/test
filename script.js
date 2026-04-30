// --- 1. הגדרות מסד הנתונים והאודיו ---
const dbName = "InstifyDB";
let db;
let songs = [];
const audio = new Audio();
audio.preload = 'auto';
let language = 'hebrew';

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

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result; // השיר הופך לטקסט ארוך
        
        const songTitle = prompt("שם השיר?", file.name.replace(/\.[^/.]+$/, "")) || "שיר חדש";
        
        const newSong = {
            id: Date.now(),
            title: songTitle,
            fileData: base64Data, // שומרים את הטקסט ב-DB
            image: 'https://i.pinimg.com/1200x/a8/98/34/a89834b9eb73330380b26ab3cb612a8e.jpg'
        };

        const tx = db.transaction("songs", "readwrite");
        const store = tx.objectStore("songs");
        store.add(newSong).onsuccess = () => {
            songs.unshift(newSong);
            render();
        };
    };
    reader.readAsDataURL(file); // הפעולה שהופכת את הקובץ לטקסט
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

    // שחרור זיכרון קודם כדי למנוע קריסה
    if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
    }

    // יצירת כתובת זמנית מהקובץ (Blob)
    const songUrl = URL.createObjectURL(song.fileData);
    audio.src = songUrl;
    audio.dataset.currentId = song.id;

    audio.play().then(() => {
        if (player) player.style.display = 'flex';
        if (playerTitle) playerTitle.innerText = song.title;
        if (playerImg) playerImg.src = song.image;

        // עדכון מסך הנעילה
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title,
                artist: 'Instify',
                artwork: [{ src: song.image, sizes: '512x512', type: 'image/jpg' }]
            });
            // עדכון המצב כדי שהאייפון יציג את הנגן
            navigator.mediaSession.playbackState = "playing";
        }
    }).catch(e => console.error(e));
}

if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', async () => {
        try {
            await audio.play();
            navigator.mediaSession.playbackState = "playing";
        } catch (err) {
            // אם האייפון חסם, אנחנו פשוט "מרעננים" את הסטטוס
            console.log("Playback failed, retrying...");
            audio.play();
        }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
        navigator.mediaSession.playbackState = "paused";
    });
}

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
    let textssongs = "";

    if (language === "english") {
        textssongs = "playlist songs";
    }
    else if (language === "hebrew") {
        textssongs = "שירים בפלייליסט"
    }

    if (count) count.innerText = `${songs.length} ${textssongs}`;

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

audio.addEventListener('play', () => {
    const icon = document.querySelector('.play-png-icon');
    if (icon) {
        icon.src = 'pause-icon.png';
        
        icon.classList.remove('animate-pop');
        void icon.offsetWidth;
        icon.classList.add('animate-pop');
    }
});

audio.addEventListener('pause', () => {
    const icon = document.querySelector('.play-png-icon');
    if (icon) {
        icon.src = 'play-icon.png';

        icon.classList.remove('animate-pop');
        void icon.offsetWidth;
        icon.classList.add('animate-pop');
    }
});

document.body.addEventListener('touchstart', function() {}, false);

const handleIconChange = (newSrc) => {
    const icon = document.querySelector('.play-png-icon');
    if (icon) {
        icon.src = newSrc;
        icon.classList.remove('animate-pop'); // מסיר את האנימציה
        void icon.offsetWidth;                // "טריק" שמכריח את הדפדפן לרענן (Reflow)
        icon.classList.add('animate-pop');    // מוסיף אותה מחדש
    }
};

    // טעינת מצב לילה
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        const themeEmoji = document.getElementById('themeEmoji');
        if (themeEmoji) themeEmoji.innerText = '✦';
    }
});

// שינוי מצב לילה/יום
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        const themeEmoji = document.getElementById('themeEmoji');
        if (themeEmoji) themeEmoji.innerText = isLight ? '✦' : '☾';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

// רישום Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registered"));
}