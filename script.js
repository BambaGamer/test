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

    // לא צריך FileReader יותר! IndexedDB יודע לשמור קבצים (Blobs) כמו שהם.
    const songTitle = prompt("שם השיר?", file.name.replace(/\.[^/.]+$/, "")) || "שיר חדש";
    
    const newSong = {
        id: Date.now(),
        title: songTitle,
        fileData: file, // כאן אנחנו שומרים את הקובץ עצמו (Blob)
        image: 'https://i.pinimg.com/1200x/a8/98/34/a89834b9eb73330380b26ab3cb612a8e.jpg'
    };

    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    
    store.add(newSong).onsuccess = () => {
        songs.unshift(newSong);
        render();
        alert("השיר נוסף בהצלחה!");
    };
    
    store.onerror = (e) => console.error("שגיאה בשמירת השיר:", e.target.error);
});

function checkTitleScroll() {
    const title = document.getElementById('playerTitle');
    if (!title) return;

    // מנקים קודם את האנימציה
    title.classList.remove('marquee-active');

    // אם אורך הטקסט גדול מ-20 תווים
    if (title.innerText.length > 20) {
        title.classList.add('marquee-active');
    }
}

// --- 4. פונקציית הניגון (התיקון לאייפון) ---
function play(song) {
    const player = document.getElementById('player');
    const playerTitle = document.getElementById('playerTitle');
    const playerImg = document.getElementById('playerImg');

    if (audio.dataset.currentId === song.id.toString()) {
        audio.paused ? audio.play() : audio.pause();
        return;
    }

    audio.pause(); 
    if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src); 
    }
    
    const songUrl = URL.createObjectURL(song.fileData);
    audio.src = songUrl;
    audio.dataset.currentId = song.id;

    // --- התיקון כאן: מעדכנים את השם *לפני* ה-play ---
    if (playerTitle) {
        playerTitle.innerText = song.title;
        checkTitleScroll(); 
    }
    if (playerImg) playerImg.src = song.image;
    
    updateMediaSession(song); // עדכון שלט מסך הנעילה מיד

    audio.play().then(() => {
        if (player) player.style.display = 'flex';
        // מוודאים שהמצב הוא playing כדי שהשם לא ייעלם
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "playing";
        }
    }).catch(e => console.error("Play Error:", e));
}

function updateMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: 'Instify',
            album: 'My Playlist',
            artwork: [{ src: song.image, sizes: '512x512', type: 'image/jpg' }]
        });

        // מוודאים שהאייפון יודע שאנחנו מנגנים כבר עכשיו
        navigator.mediaSession.playbackState = "playing";

        navigator.mediaSession.setActionHandler('play', () => {
            audio.play();
            navigator.mediaSession.playbackState = "playing";
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
            audio.pause();
            navigator.mediaSession.playbackState = "paused";
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => playNextSong());
        navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousSong());
    }
}

const queueBtn = document.getElementById('queueBtn');
const queuePanel = document.getElementById('queuePanel');

queueBtn?.addEventListener('click', () => {
    queuePanel.style.display = queuePanel.style.display === 'none' ? 'block' : 'none';
    renderQueue();
});

function renderQueue() {
    const list = document.getElementById('queueList');
    if (!list) return;

    list.innerHTML = '';

    const currentId = audio.dataset.currentId;

    songs.forEach(song => {
        const div = document.createElement('div');

        div.className = 'queue-item';
        if (song.id.toString() === currentId) {
            div.classList.add('active');
        }

        div.innerText = song.title;

        div.onclick = () => {
            play(song);
            queuePanel.classList.remove('open');
        };

        list.appendChild(div);
    });
}

audio.addEventListener('ended', () => {
    playNextSong();
});

function playPreviousSong() {
    const currentId = audio.dataset.currentId;
    const currentIndex = songs.findIndex(s => s.id.toString() === currentId);

    if (currentIndex > 0) {
        const prevSong = songs[currentIndex - 1];
        renderQueue();
        play(prevSong);
    }
}

function playNextSong() {
    const currentId = audio.dataset.currentId;
    // מוצאים את האינדקס של השיר הנוכחי
    const currentIndex = songs.findIndex(s => s.id.toString() === currentId);

    // אם יש שיר הבא בתור (במערך songs)
    if (currentIndex !== -1 && currentIndex < songs.length - 1) {
        const nextSong = songs[currentIndex + 1];
        renderQueue();
        play(nextSong);
    } else {
        console.log("סוף הפלייליסט");
        // אופציונלי: לחזור להתחלה
        play(songs[0]);
    }
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
            <button class="btn-delete" onclick="deleteSong(event, ${song.id})">✘</button>
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

    window.addEventListener('load', () => {
    const splash = document.getElementById('splash');

    setTimeout(() => {
        splash.style.opacity = '0';
        splash.style.transform = 'scale(1.05)';

        setTimeout(() => {
            splash.remove();
        }, 2000);

    }, 2000); // כמה זמן המסך יישאר (1.2 שניות)
});

    const mainPlayBtn = document.getElementById('playBtn');
    if (mainPlayBtn) {
        mainPlayBtn.onclick = (e) => {
            e.stopPropagation();
            if (!audio.src) return;
            audio.paused ? audio.play() : audio.pause();
        };
    }

        const queueBtn = document.getElementById('queueBtn');
    const queuePanel = document.getElementById('queuePanel');

    if (!queueBtn || !queuePanel) return;

queueBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    queuePanel.classList.toggle('open');
    renderQueue();
});

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

const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

// פונקציית עזר לעיצוב הזמן (משניות לפורמט 0:00)
function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

// 1. עדכון הפס בזמן שהשיר רץ
audio.addEventListener('timeupdate', () => {
    if (!isNaN(audio.duration)) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.value = percent;
        currentTimeEl.innerText = formatTime(audio.currentTime);
    }
});

// 2. עדכון זמן השיר הכולל כשהוא נטען
audio.addEventListener('loadedmetadata', () => {
    durationEl.innerText = formatTime(audio.duration);
});

// 3. אפשרות לדלג בשיר ע"י הזזת הפס
progress.addEventListener('input', () => {
    const time = (progress.value / 100) * audio.duration;
    audio.currentTime = time;
});