// Load the YouTube IFrame Player API code asynchronously.
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
var isPlayerReady = false;

// This function creates an <iframe> (and YouTube player)
// after the API code downloads.
var pendingVideoId = null;

function onYouTubeIframeAPIReady() {
    isPlayerReady = true;
    if (pendingVideoId) {
        initPlayer(pendingVideoId);
        pendingVideoId = null;
    }
}

let pendingSync = null;

function initPlayer(videoId) {
    if (!videoId) return;
    if (!isPlayerReady) {
        pendingVideoId = videoId;
        const checkReady = setInterval(() => {
            if (window.YT && window.YT.Player) {
                isPlayerReady = true;
                clearInterval(checkReady);
                initPlayer(videoId);
            }
        }, 100);
        return;
    }

    const wrapper = document.getElementById('player-container');
    wrapper.innerHTML = '<div id="ytplayer"></div>';

    try {
        player = new YT.Player('ytplayer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'autoplay': 1,
                'enablejsapi': 1,
                'origin': window.location.origin,
                'rel': 0
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    } catch(e) {
        console.error("Failed to create YT.Player", e);
    }
}

function onPlayerReady(event) {
    if (pendingSync) {
        window.applyVideoSync(pendingSync.state, pendingSync.time);
        pendingSync = null;
    } else {
        try {
            event.target.playVideo();
        } catch(e) {}
    }
}

let remoteActionUntil = 0;
let lastSyncTime = 0;
let lastState = null;
let hostHeartbeatInterval = null;

function startHostHeartbeat() {
    stopHostHeartbeat();
    hostHeartbeatInterval = setInterval(() => {
        if (player && typeof player.getCurrentTime === 'function' && typeof player.getPlayerState === 'function') {
            if (player.getPlayerState() === YT.PlayerState.PLAYING) {
                if (window.broadcastSync) window.broadcastSync('PLAYING', player.getCurrentTime());
            }
        }
    }, 2000);
}

function stopHostHeartbeat() {
    if (hostHeartbeatInterval) {
        clearInterval(hostHeartbeatInterval);
        hostHeartbeatInterval = null;
    }
}

function onPlayerStateChange(event) {
    if (!player || typeof player.getCurrentTime !== 'function') return;

    const now = Date.now();
    if (now < remoteActionUntil) return; // Ignore events triggered by remote sync

    if (event.data === YT.PlayerState.PLAYING) {
        startHostHeartbeat();
        if (lastState === 'PLAYING' && (now - lastSyncTime < 800)) return;
        lastState = 'PLAYING';
        lastSyncTime = now;
        if (window.broadcastSync) window.broadcastSync('PLAYING', player.getCurrentTime());
    } else if (event.data === YT.PlayerState.PAUSED) {
        stopHostHeartbeat();
        if (lastState === 'PAUSED' && (now - lastSyncTime < 800)) return;
        lastState = 'PAUSED';
        lastSyncTime = now;
        if (window.broadcastSync) window.broadcastSync('PAUSED', player.getCurrentTime());
    }
}

window.applyVideoSync = function(state, time) {
    if (!player || typeof player.seekTo !== 'function') {
        pendingSync = { state: state, time: time };
        return;
    }

    remoteActionUntil = Date.now() + 2000;

    try {
        const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
        if (Math.abs(currentTime - time) > 1.5) {
            player.seekTo(time, true);
        }
    } catch(e) {}

    if (state === 'PLAYING') {
        try {
            player.playVideo();
        } catch(e) {
            try {
                player.mute();
                player.playVideo();
            } catch(err) {}
        }
    } else if (state === 'PAUSED') {
        try {
            player.pauseVideo();
        } catch(e) {}
    }
};

// Global click listener to restore audio if muted by autoplay policies
document.addEventListener('click', () => {
    if (player && typeof player.isMuted === 'function' && player.isMuted()) {
        try {
            player.unMute();
        } catch(e) {}
    }
});

// Extract Video ID from URL
function extractVideoID(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
}

// Event Listeners for Video
window.loadVideo = function(url) {
    const videoId = extractVideoID(url);
    const wrapper = document.getElementById('player-container');
    
    if (videoId) {
        if (player && typeof player.destroy === 'function') {
            player.destroy();
        }
        initPlayer(videoId);
    } else {
        if (player && typeof player.destroy === 'function') {
            player.destroy();
            player = null;
        }
        // Generic iframe embed using strict DOM methods for XSS prevention
        wrapper.innerHTML = ''; // safe clear
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.frameBorder = '0';
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('allow', 'autoplay; encrypted-media');
        wrapper.appendChild(iframe);
    }
    const controlsInfo = document.getElementById('controls-info');
    if (controlsInfo) {
        controlsInfo.style.display = 'block';
    }
};

document.getElementById('load-btn').addEventListener('click', () => {
    const url = document.getElementById('video-url').value;
    if (!url) {
        alert("Please enter a URL.");
        return;
    }
    
    // Broadcast the new video to peers
    if (window.broadcastVideoSync) {
        window.broadcastVideoSync(url);
    }
    
    window.loadVideo(url);
});

const syncPlayBtn = document.getElementById('sync-play-btn');
const syncPauseBtn = document.getElementById('sync-pause-btn');
const syncNowBtn = document.getElementById('sync-now-btn');

if (syncPlayBtn) {
    syncPlayBtn.addEventListener('click', () => {
        if (player && typeof player.playVideo === 'function') {
            try { player.playVideo(); } catch(e) {}
        }
        syncPlayBtn.classList.add('active');
        if (syncPauseBtn) syncPauseBtn.classList.remove('active');
        const curTime = (player && typeof player.getCurrentTime === 'function') ? player.getCurrentTime() : 0;
        if (window.broadcastSync) window.broadcastSync('PLAYING', curTime);
    });
}

if (syncPauseBtn) {
    syncPauseBtn.addEventListener('click', () => {
        if (player && typeof player.pauseVideo === 'function') {
            try { player.pauseVideo(); } catch(e) {}
        }
        syncPauseBtn.classList.add('active');
        if (syncPlayBtn) syncPlayBtn.classList.remove('active');
        const curTime = (player && typeof player.getCurrentTime === 'function') ? player.getCurrentTime() : 0;
        if (window.broadcastSync) window.broadcastSync('PAUSED', curTime);
    });
}

if (syncNowBtn) {
    syncNowBtn.addEventListener('click', () => {
        if (window.requestSync) {
            window.requestSync();
        }
    });
}

// Chat logic moved to webrtc.js for network synchronization

// Drag Logic for Video Container
const videoWrapper = document.getElementById('video-wrapper');
const dragHandle = document.getElementById('drag-handle');

let isDragging = false;
let startX, startY;
let initialX, initialY;
let draggedOnce = false;

dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    
    // Convert to fixed position on first drag to preserve layout
    if (!draggedOnce) {
        const rect = videoWrapper.getBoundingClientRect();
        videoWrapper.style.width = rect.width + 'px';
        videoWrapper.style.height = rect.height + 'px';
        videoWrapper.style.left = rect.left + 'px';
        videoWrapper.style.top = rect.top + 'px';
        draggedOnce = true;
    }
    
    videoWrapper.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    initialX = videoWrapper.offsetLeft;
    initialY = videoWrapper.offsetTop;
    
    // Prevent text selection during drag
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    videoWrapper.style.left = (initialX + dx) + 'px';
    videoWrapper.style.top = (initialY + dy) + 'px';
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        videoWrapper.classList.remove('dragging');
    }
});
