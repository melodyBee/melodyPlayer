// ── Elements ──────────────────────────────────────────
const audio = document.getElementById('audioPlayer')
const playBtn = document.getElementById('playBtn')
const playIcon = document.getElementById('playIcon')
const prevBtn = document.getElementById('prevBtn')
const nextBtn = document.getElementById('nextBtn')
const progressBar = document.getElementById('progressBar')
const progressFill = document.getElementById('progressFill')
const progressThumb = document.getElementById('progressThumb')
const currentTime = document.getElementById('currentTime')
const totalTime = document.getElementById('totalTime')
const songName = document.getElementById('songName')
const songCounter = document.getElementById('songCounter')
const songDisplay = document.getElementById('songDisplay')
const cardIdle = document.querySelector('.card-idle')
const vinylRing = document.getElementById('vinylRing')
const menuBtn = document.getElementById('menuBtn')
const playlistPanel = document.getElementById('playlistPanel')
const closePlaylist = document.getElementById('closePlaylist')
const loadFolderBtn = document.getElementById('loadFolderBtn')
const fileInput = document.getElementById('fileInput')
const playlistList = document.getElementById('playlistList')
const marqueeEl = document.getElementById('songName')
const hearts = document.querySelectorAll('.heart')

// ── State ─────────────────────────────────────────────
let playlist = [] // array of { name, url, file }
let currentIdx = 0
let isPlaying = false
let isDragging = false
let repeatMode = 0 // 0 = no repeat, 1 = repeat all, 2 = repeat one

// ── File loading (replaces electron folder picker) ────
loadFolderBtn.addEventListener('click', () => fileInput.click())

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    // revoke old object URLs to free memory
    playlist.forEach((s) => URL.revokeObjectURL(s.url))

    playlist = files
        .filter((f) => /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name))
        .map((f) => ({
            name: f.name.replace(/\.[^/.]+$/, ''),
            url: URL.createObjectURL(f),
            file: f,
        }))

    if (!playlist.length) return

    currentIdx = 0
    renderPlaylist()
    loadSong(currentIdx)
    closePlaylistPanel()
})

// ── Playlist rendering ────────────────────────────────
function renderPlaylist() {
    playlistList.innerHTML = ''
    if (!playlist.length) {
        playlistList.innerHTML = '<li class="playlist-empty">load songs to start ♡</li>'
        return
    }
    playlist.forEach((song, i) => {
        const li = document.createElement('li')
        li.className = 'playlist-item' + (i === currentIdx ? ' active' : '')
        li.innerHTML = `<span class="playlist-item-name">${song.name}</span>`
        li.addEventListener('click', () => {
            currentIdx = i
            loadSong(currentIdx)
            playSong()
            closePlaylistPanel()
        })
        playlistList.appendChild(li)
    })
}

function updatePlaylistActive() {
    document.querySelectorAll('.playlist-item').forEach((el, i) => {
        el.classList.toggle('active', i === currentIdx)
    })
}

// ── Song loading ──────────────────────────────────────
async function loadSong(idx) {
    const song = playlist[idx]
    if (!song) return

    audio.src = song.url
    audio.load()

    // Try to read embedded album art using FileReader + music-metadata-browser
    // Falls back to vinyl ring if no art found
    try {
        const { parseBlob, selectCover } =
            await import('https://cdn.jsdelivr.net/npm/music-metadata-browser@2.5.0/+esm')
        const meta = await parseBlob(song.file)
        const cover = selectCover(meta.common.picture)
        if (cover) {
            const blob = new Blob([cover.data], { type: cover.format })
            const url = URL.createObjectURL(blob)
            songDisplay.style.backgroundImage = `url(${url})`
            songDisplay.style.backgroundSize = 'cover'
            songDisplay.style.backgroundPosition = 'center'
            songDisplay.style.borderRadius = '10px'
            vinylRing.style.display = 'none'
        } else {
            songDisplay.style.backgroundImage = ''
            vinylRing.style.display = 'block'
        }
    } catch {
        songDisplay.style.backgroundImage = ''
        vinylRing.style.display = 'block'
    }

    // Update UI
    const name = song.name
    songName.textContent = name
    songCounter.textContent = `${idx + 1} / ${playlist.length}`

    // Show song display card
    cardIdle.style.display = 'none'
    songDisplay.style.display = 'flex'

    // Marquee
    if (name.length > 28) {
        marqueeEl.classList.add('scrolling')
    } else {
        marqueeEl.classList.remove('scrolling')
        marqueeEl.style.animation = 'none'
    }

    // Reset progress
    progressFill.style.width = '0%'
    progressThumb.style.left = '0%'
    currentTime.textContent = '0:00'
    totalTime.textContent = '0:00'

    updatePlaylistActive()
    updateHearts()
}

function playSong() {
    audio.play()
    isPlaying = true
    playIcon.textContent = '⏸'
    vinylRing.classList.add('spinning')
}

function pauseSong() {
    audio.pause()
    isPlaying = false
    playIcon.textContent = '▶'
    vinylRing.classList.remove('spinning')
}

// ── Controls ──────────────────────────────────────────
playBtn.addEventListener('click', () => {
    if (!playlist.length) return
    if (isPlaying) pauseSong()
    else playSong()
})

prevBtn.addEventListener('click', () => {
    if (!playlist.length) return
    currentIdx = (currentIdx - 1 + playlist.length) % playlist.length
    loadSong(currentIdx)
    if (isPlaying) playSong()
})

nextBtn.addEventListener('click', () => {
    if (!playlist.length) return
    currentIdx = (currentIdx + 1) % playlist.length
    loadSong(currentIdx)
    if (isPlaying) playSong()
})

audio.addEventListener('ended', () => {
    if (repeatMode === 2) {
        audio.currentTime = 0
        playSong()
    } else if (repeatMode === 1) {
        currentIdx = (currentIdx + 1) % playlist.length
        loadSong(currentIdx)
        playSong()
    } else {
        if (currentIdx < playlist.length - 1) {
            currentIdx++
            loadSong(currentIdx)
            playSong()
        }
    }
})

// ── Progress bar ──────────────────────────────────────
audio.addEventListener('timeupdate', () => {
    if (isDragging || !audio.duration) return
    const pct = (audio.currentTime / audio.duration) * 100
    progressFill.style.width = pct + '%'
    progressThumb.style.left = pct + '%'
    currentTime.textContent = formatTime(audio.currentTime)
})

audio.addEventListener('loadedmetadata', () => {
    totalTime.textContent = formatTime(audio.duration)
})

progressBar.addEventListener('click', (e) => {
    if (!audio.duration) return
    const rect = progressBar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * audio.duration
})

// Touch support for progress bar (mobile!)
progressBar.addEventListener(
    'touchstart',
    (e) => {
        isDragging = true
        e.preventDefault()
    },
    { passive: false }
)

document.addEventListener(
    'touchmove',
    (e) => {
        if (!isDragging || !audio.duration) return
        const rect = progressBar.getBoundingClientRect()
        const touch = e.touches[0]
        const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
        progressFill.style.width = pct * 100 + '%'
        progressThumb.style.left = pct * 100 + '%'
        currentTime.textContent = formatTime(pct * audio.duration)
    },
    { passive: true }
)

document.addEventListener('touchend', (e) => {
    if (!isDragging) return
    isDragging = false
    const rect = progressBar.getBoundingClientRect()
    const touch = e.changedTouches[0]
    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
    audio.currentTime = pct * audio.duration
})

progressThumb.addEventListener('mousedown', (e) => {
    isDragging = true
    e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
    if (!isDragging || !audio.duration) return
    const rect = progressBar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    progressFill.style.width = pct * 100 + '%'
    progressThumb.style.left = pct * 100 + '%'
    currentTime.textContent = formatTime(pct * audio.duration)
})

document.addEventListener('mouseup', (e) => {
    if (!isDragging) return
    isDragging = false
    const rect = progressBar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * audio.duration
})

function formatTime(s) {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Playlist panel ────────────────────────────────────
menuBtn.addEventListener('click', () => playlistPanel.classList.add('open'))
closePlaylist.addEventListener('click', closePlaylistPanel)
function closePlaylistPanel() {
    playlistPanel.classList.remove('open')
}

// ── Hearts (repeat modes) ─────────────────────────────
hearts.forEach((heart, i) => {
    heart.addEventListener('click', () => {
        repeatMode = i
        updateHearts()
    })
})

function updateHearts() {
    hearts.forEach((heart, i) => {
        heart.classList.toggle('liked', i === repeatMode)
    })
}

// ── Keyboard shortcuts ────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault()
        playBtn.click()
    }
    if (e.code === 'ArrowRight') nextBtn.click()
    if (e.code === 'ArrowLeft') prevBtn.click()
})
// ── PWA service worker ────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
}
