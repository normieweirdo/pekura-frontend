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
let userInteracted = false;
let isApplyingRemoteSync = false;
let lastBroadcastState = null;
let lastBroadcastTime = 0;

const syncOverlay = document.getElementById('sync-overlay');

function showSyncOverlay() {
    if (!userInteracted && syncOverlay) {
        syncOverlay.style.display = 'flex';
    }
}

function hideSyncOverlay() {
    userInteracted = true;
    if (syncOverlay) {
        syncOverlay.style.display = 'none';
    }
}

if (syncOverlay) {
    syncOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        hideSyncOverlay();
        if (player && typeof player.playVideo === 'function') {
            try {
                player.unMute();
                player.playVideo();
            } catch(err) {}
        }
        if (window.requestSync) window.requestSync();
    });
}

document.addEventListener('click', () => {
    if (!userInteracted) {
        hideSyncOverlay();
    }
});

function onPlayerStateChange(event) {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    if (isApplyingRemoteSync) return; // Ignore events triggered by remote sync

    const currentTime = player.getCurrentTime();

    if (event.data === YT.PlayerState.PLAYING) {
        if (lastBroadcastState === 'PLAYING' && Math.abs(currentTime - lastBroadcastTime) < 0.8) return;
        lastBroadcastState = 'PLAYING';
        lastBroadcastTime = currentTime;
        if (window.broadcastSync) window.broadcastSync('PLAYING', currentTime);
    } else if (event.data === YT.PlayerState.PAUSED) {
        if (lastBroadcastState === 'PAUSED' && Math.abs(currentTime - lastBroadcastTime) < 0.8) return;
        lastBroadcastState = 'PAUSED';
        lastBroadcastTime = currentTime;
        if (window.broadcastSync) window.broadcastSync('PAUSED', currentTime);
    }
}

window.applyVideoSync = function(state, time) {
    if (!player || typeof player.seekTo !== 'function') {
        pendingSync = { state: state, time: time };
        return;
    }

    isApplyingRemoteSync = true;

    try {
        const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
        if (Math.abs(currentTime - time) > 0.3) {
            player.seekTo(time, true);
        }
    } catch(e) {}

    if (state === 'PLAYING') {
        try {
            player.playVideo();
        } catch(e) {
            showSyncOverlay();
        }
    } else if (state === 'PAUSED') {
        try {
            player.pauseVideo();
        } catch(e) {}
    }

    setTimeout(() => {
        isApplyingRemoteSync = false;
    }, 500);
};

// High-precision Seek Forward & Backward Detector (polls every 250ms)
let lastCheckedTime = 0;
let lastCheckTimestamp = Date.now();

setInterval(() => {
    if (!player || typeof player.getCurrentTime !== 'function' || typeof player.getPlayerState !== 'function') return;
    if (isApplyingRemoteSync) return;

    const now = Date.now();
    const curTime = player.getCurrentTime();
    const state = player.getPlayerState();
    const elapsedRealTime = (now - lastCheckTimestamp) / 1000;

    // Expected current time if playing at 1x speed
    const expectedTime = (state === YT.PlayerState.PLAYING) ? (lastCheckedTime + elapsedRealTime) : lastCheckedTime;
    const drift = Math.abs(curTime - expectedTime);

    // If time jumped forward or backward by more than 0.8s
    if (drift > 0.8 && lastCheckedTime > 0) {
        lastBroadcastTime = curTime;
        const stateStr = (state === YT.PlayerState.PLAYING) ? 'PLAYING' : 'PAUSED';
        if (window.broadcastSync) {
            window.broadcastSync(stateStr, curTime);
        }
    }

    lastCheckedTime = curTime;
    lastCheckTimestamp = now;
}, 250);

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
        wrapper.innerHTML = '';
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
};

const loadBtn = document.getElementById('load-btn');
if (loadBtn) {
    loadBtn.addEventListener('click', () => {
        const url = document.getElementById('video-url').value;
        if (!url) {
            alert("Please enter a URL.");
            return;
        }
        if (window.broadcastVideoSync) {
            window.broadcastVideoSync(url);
        }
        window.loadVideo(url);
    });
}

// Chat logic moved to webrtc.js for network synchronization

// Draggable & 4-Corner Resizable Engine for Video Container
const videoWrapper = document.getElementById('video-wrapper');
const dragHandle = document.getElementById('drag-handle');
const dragShield = document.getElementById('drag-shield');
const resizeHandles = document.querySelectorAll('.resize-handle');

let isDragging = false;
let isResizing = false;
let resizeCorner = '';

let startMouseX = 0, startMouseY = 0;
let startLeft = 0, startTop = 0;
let startWidth = 0, startHeight = 0;
let positionFixedSet = false;

function ensureFixedPositioning() {
    if (!positionFixedSet && videoWrapper) {
        const rect = videoWrapper.getBoundingClientRect();
        videoWrapper.style.position = 'fixed';
        videoWrapper.style.left = rect.left + 'px';
        videoWrapper.style.top = rect.top + 'px';
        videoWrapper.style.width = rect.width + 'px';
        videoWrapper.style.height = rect.height + 'px';
        videoWrapper.style.maxWidth = 'none';
        videoWrapper.style.margin = '0';
        positionFixedSet = true;
    }
}

// DRAG HANDLING
if (dragHandle) {
    dragHandle.addEventListener('mousedown', (e) => {
        if (videoWrapper.classList.contains('full-viewport')) return;
        e.preventDefault();
        ensureFixedPositioning();

        isDragging = true;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        startLeft = videoWrapper.offsetLeft;
        startTop = videoWrapper.offsetTop;

        if (dragShield) dragShield.style.display = 'block';
        videoWrapper.classList.add('dragging');
    });
}

// 4-CORNER RESIZE HANDLING
resizeHandles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
        if (videoWrapper.classList.contains('full-viewport')) return;
        e.preventDefault();
        e.stopPropagation();
        ensureFixedPositioning();

        isResizing = true;
        resizeCorner = handle.getAttribute('data-corner');
        startMouseX = e.clientX;
        startMouseY = e.clientY;

        const rect = videoWrapper.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        startWidth = rect.width;
        startHeight = rect.height;

        if (dragShield) dragShield.style.display = 'block';
    });
});

// GLOBAL MOUSE MOVE & UP LISTENERS
document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;
        videoWrapper.style.left = (startLeft + dx) + 'px';
        videoWrapper.style.top = (startTop + dy) + 'px';
    } else if (isResizing) {
        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        const minW = 280;
        const minH = 160;

        if (resizeCorner === 'br') { // Bottom-Right
            newWidth = Math.max(minW, startWidth + dx);
            newHeight = Math.max(minH, startHeight + dy);
        } else if (resizeCorner === 'bl') { // Bottom-Left
            newWidth = Math.max(minW, startWidth - dx);
            newHeight = Math.max(minH, startHeight + dy);
            if (newWidth > minW) newLeft = startLeft + dx;
        } else if (resizeCorner === 'tr') { // Top-Right
            newWidth = Math.max(minW, startWidth + dx);
            newHeight = Math.max(minH, startHeight - dy);
            if (newHeight > minH) newTop = startTop + dy;
        } else if (resizeCorner === 'tl') { // Top-Left
            newWidth = Math.max(minW, startWidth - dx);
            newHeight = Math.max(minH, startHeight - dy);
            if (newWidth > minW) newLeft = startLeft + dx;
            if (newHeight > minH) newTop = startTop + dy;
        }

        videoWrapper.style.width = newWidth + 'px';
        videoWrapper.style.height = newHeight + 'px';
        videoWrapper.style.left = newLeft + 'px';
        videoWrapper.style.top = newTop + 'px';
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging || isResizing) {
        isDragging = false;
        isResizing = false;
        if (dragShield) dragShield.style.display = 'none';
        videoWrapper.classList.remove('dragging');
    }
});
