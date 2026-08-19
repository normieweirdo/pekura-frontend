/* =========================================================================
   AUTHENTIC DIGITAL SIGNATURE & ANTI-PHISHING LOCK
   Author: Samir Das
   Official Domain: https://pekura.vercel.app
   Signature ID: SAMIR-DAS-VERIFIED-AUTH-2026
   ========================================================================= */
(function enforceAntiPhishingDomainLock() {
    const allowedDomains = ['pekura.vercel.app', 'pekura-frontend.vercel.app', 'localhost', '127.0.0.1'];
    const hostname = window.location.hostname;

    const isGenuine = allowedDomains.some(d => hostname.includes(d));

    if (!isGenuine) {
        window.addEventListener('DOMContentLoaded', () => {
            document.body.innerHTML = `
                <div style="background:#090714; color:#fff; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-family:'Plus Jakarta Sans', sans-serif; padding:20px;">
                    <div style="background:rgba(239, 68, 68, 0.12); border:1px solid #ef4444; padding:32px; border-radius:24px; max-width:540px; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin-bottom:15px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <h1 style="color:#f8fafc; font-size:1.5rem; margin-bottom:12px;">⚠️ Phishing & Clone Warning</h1>
                        <p style="color:#94a3b8; font-size:0.9rem; line-height:1.6; margin-bottom:24px;">
                            This website is an unauthorized clone or mirror of <strong>Pekura</strong>.<br>
                            Digital Signature Verification failed for author <strong>Samir Das</strong>.
                        </p>
                        <a href="https://pekura.vercel.app" style="display:inline-block; background:linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color:#fff; padding:14px 28px; border-radius:9999px; text-decoration:none; font-weight:700; font-size:0.9rem; box-shadow:0 10px 25px rgba(99, 102, 241, 0.4);">Go to Official Website (pekura.vercel.app)</a>
                    </div>
                </div>
            `;
        });
    }
})();

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
        const playerVars = {
            'playsinline': 1,
            'autoplay': 1,
            'enablejsapi': 1,
            'rel': 0
        };
        if (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) {
            playerVars.origin = window.location.origin;
        }

        player = new YT.Player('ytplayer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: playerVars,
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
            const p = event.target.playVideo();
            if (p && p.catch) {
                p.catch(() => showSyncOverlay());
            }
        } catch(e) {
            showSyncOverlay();
        }
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

    // 2. Direct HTML5 <video> Element
    const html5Video = document.querySelector('#player-container video');
    if (html5Video) {
        try {
            if (Math.abs(html5Video.currentTime - time) > 0.3) {
                html5Video.currentTime = time;
            }
            if (state === 'PLAYING') html5Video.play().catch(() => showSyncOverlay());
            else if (state === 'PAUSED') html5Video.pause();
        } catch(e) {}
    }

    // 3. Generic iFrame Embeds (StreamHG, Proxy.php)
    sendIframeCommand(state === 'PLAYING' ? 'play' : 'pause');
    if (state === 'PLAYING') sendIframeCommand('playVideo');
    else if (state === 'PAUSED') sendIframeCommand('pauseVideo');

    // Update StreamHG / Proxy Sync Controls Bar UI
    const embedPlayBtn = document.getElementById('embed-play-btn');
    const embedPauseBtn = document.getElementById('embed-pause-btn');

    if (state === 'PLAYING') {
        if (embedPlayBtn) embedPlayBtn.classList.add('active');
        if (embedPauseBtn) embedPauseBtn.classList.remove('active');
    } else if (state === 'PAUSED') {
        if (embedPauseBtn) embedPauseBtn.classList.add('active');
        if (embedPlayBtn) embedPlayBtn.classList.remove('active');
    }

    setTimeout(() => {
        isApplyingRemoteSync = false;
    }, 500);
};

// Universal Iframe postMessage Relay (Safely handles cross-origin sub-frames)
function sendIframeCommand(command, arg) {
    const iframe = document.querySelector('#player-container iframe');
    if (!iframe || !iframe.contentWindow) return;

    const messages = [
        { event: 'command', func: command, args: arg !== undefined ? [arg] : [] },
        { event: command },
        { method: command, value: arg },
        { type: command, data: arg },
        { action: command, value: arg },
        command
    ];

    messages.forEach(msg => {
        try {
            iframe.contentWindow.postMessage(typeof msg === 'object' ? JSON.stringify(msg) : msg, '*');
        } catch(e) {}
        try {
            iframe.contentWindow.postMessage(msg, '*');
        } catch(e) {}
    });

    try {
        if (iframe.contentWindow.length > 0) {
            for (let i = 0; i < iframe.contentWindow.length; i++) {
                try {
                    const subWin = iframe.contentWindow[i];
                    messages.forEach(msg => {
                        try { subWin.postMessage(typeof msg === 'object' ? JSON.stringify(msg) : msg, '*'); } catch(e) {}
                        try { subWin.postMessage(msg, '*'); } catch(e) {}
                    });
                } catch(e) {}
            }
        }
    } catch(e) {}
}

// Cross-origin iframe postMessage Listener
window.addEventListener('message', (event) => {
    if (isApplyingRemoteSync) return;
    try {
        let data = event.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch(e) {}
        }
        if (!data) return;

        if (data.event === 'play' || data.event === 'playing' || data.type === 'play' || data === 'playing') {
            if (window.broadcastSync) window.broadcastSync('PLAYING', data.currentTime || 0);
        } else if (data.event === 'pause' || data.type === 'pause' || data === 'paused') {
            if (window.broadcastSync) window.broadcastSync('PAUSED', data.currentTime || 0);
        }
    } catch(e) {}
});

// High-precision Seek Forward & Backward Detector (polls every 250ms with Tab Visibility Protection)
let lastCheckedTime = 0;
let lastCheckTimestamp = Date.now();
let isTabHidden = false;

document.addEventListener('visibilitychange', () => {
    isTabHidden = document.hidden;
    if (!isTabHidden) {
        lastCheckTimestamp = Date.now();
        if (player && typeof player.getCurrentTime === 'function') {
            lastCheckedTime = player.getCurrentTime();
        }
    }
});

setInterval(() => {
    if (document.hidden || isTabHidden) {
        lastCheckTimestamp = Date.now();
        if (player && typeof player.getCurrentTime === 'function') {
            lastCheckedTime = player.getCurrentTime();
        }
        return;
    }
    if (!player || typeof player.getCurrentTime !== 'function' || typeof player.getPlayerState !== 'function') return;
    if (isApplyingRemoteSync) return;

    const now = Date.now();
    const curTime = player.getCurrentTime();
    const state = player.getPlayerState();
    const elapsedRealTime = (now - lastCheckTimestamp) / 1000;

    // Protection against tab-switching & background throttling drift (> 1.5s gap)
    if (elapsedRealTime > 1.5) {
        lastCheckedTime = curTime;
        lastCheckTimestamp = now;
        return;
    }

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

// Universal Multi-Platform URL Parser (YouTube, Vimeo, Dailymotion, Google Drive, MP4, HLS, Movie Embeds)
function parsePlatformURL(url) {
    if (!url) return { type: 'unknown', url: '' };

    // 1. YouTube
    const ytMatch = url.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/);
    if (ytMatch && ytMatch[7].length === 11) {
        return { type: 'youtube', id: ytMatch[7] };
    }

    // 2. Vimeo
    const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
        return { type: 'embed', embedUrl: 'https://player.vimeo.com/video/' + vimeoMatch[1] + '?api=1' };
    }

    // 3. Dailymotion
    const dmMatch = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
    if (dmMatch && dmMatch[1]) {
        return { type: 'embed', embedUrl: 'https://www.dailymotion.com/embed/video/' + dmMatch[1] };
    }

    // 4. StreamHG & Proxy.php Un-wrapper
    if (url.includes('proxy.php') && url.includes('c=')) {
        const match = url.match(/[?&]c=([a-zA-Z0-9]+)/);
        if (match && match[1]) {
            return { type: 'embed', embedUrl: 'https://streamhg.com/e/' + match[1] };
        }
    }

    // 5. Direct Video Files (.mp4, .webm, .m3u8, Google Drive / Dropbox video)
    const isDirectVideo = (/\.(mp4|webm|ogv|m3u8)(\?.*)?$/i).test(url) || url.includes('drive.google.com') || url.includes('dropbox.com');
    if (isDirectVideo) {
        let videoSrc = url;
        if (url.includes('drive.google.com/file/d/')) {
            const driveId = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (driveId && driveId[1]) videoSrc = 'https://drive.google.com/uc?export=download&id=' + driveId[1];
        }
        return { type: 'direct', videoUrl: videoSrc };
    }

    // 6. Generic Movie Embeds (Streamtape, Streamwish, Filemoon, Vidhide, Mixdrop, Voe, Vidsrc, etc.)
    return { type: 'embed', embedUrl: url };
}

// Event Listeners for Video
window.loadVideo = function(rawUrl) {
    const platform = parsePlatformURL(rawUrl);
    const wrapper = document.getElementById('player-container');
    const embedSyncBar = document.getElementById('embed-sync-bar');
    
    if (embedSyncBar) embedSyncBar.style.display = 'flex';

    if (platform.type === 'youtube') {
        if (player && typeof player.destroy === 'function') {
            player.destroy();
        }
        initPlayer(platform.id);
    } else {
        if (player && typeof player.destroy === 'function') {
            player.destroy();
            player = null;
        }
        wrapper.innerHTML = '';

        if (platform.type === 'direct') {
            const video = document.createElement('video');
            video.src = platform.videoUrl;
            video.controls = true;
            video.autoplay = true;
            video.style.width = '100%';
            video.style.height = '100%';

            video.addEventListener('play', () => {
                if (!isApplyingRemoteSync && window.broadcastSync) window.broadcastSync('PLAYING', video.currentTime);
            });
            video.addEventListener('pause', () => {
                if (!isApplyingRemoteSync && window.broadcastSync) window.broadcastSync('PAUSED', video.currentTime);
            });
            video.addEventListener('seeked', () => {
                if (!isApplyingRemoteSync && window.broadcastSync) {
                    const state = video.paused ? 'PAUSED' : 'PLAYING';
                    window.broadcastSync(state, video.currentTime);
                }
            });
            wrapper.appendChild(video);
        } else {
            // Vimeo, Dailymotion, StreamHG, Proxy, Streamtape, Vidhide, Filemoon, Voe, etc.
            const iframe = document.createElement('iframe');
            iframe.src = platform.embedUrl;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.frameBorder = '0';
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox');
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('allow', 'autoplay; encrypted-media');
            wrapper.appendChild(iframe);
        }
    }
};

// StreamHG / YouTube / Universal Embed Sync Bar Button Handlers
const embedPlayBtn = document.getElementById('embed-play-btn');
const embedPauseBtn = document.getElementById('embed-pause-btn');
const embedSeekBackBtn = document.getElementById('embed-seek-back-btn');
const embedSeekFwdBtn = document.getElementById('embed-seek-fwd-btn');

if (embedPlayBtn) {
    embedPlayBtn.addEventListener('click', () => {
        if (window.hostOnlyVideo && !window.isHost) {
            alert("Host-Only Video mode is active. Only the Host can control the video.");
            return;
        }
        embedPlayBtn.classList.add('active');
        if (embedPauseBtn) embedPauseBtn.classList.remove('active');

        let curTime = 0;
        if (player && typeof player.playVideo === 'function') {
            player.playVideo();
            curTime = player.getCurrentTime ? player.getCurrentTime() : 0;
        }
        const video = document.querySelector('#player-container video');
        if (video) {
            video.play().catch(() => {});
            curTime = video.currentTime;
        }
        sendIframeCommand('play');
        sendIframeCommand('playVideo');

        if (window.broadcastSync) window.broadcastSync('PLAYING', curTime);
    });
}

if (embedPauseBtn) {
    embedPauseBtn.addEventListener('click', () => {
        if (window.hostOnlyVideo && !window.isHost) {
            alert("Host-Only Video mode is active. Only the Host can control the video.");
            return;
        }
        embedPauseBtn.classList.add('active');
        if (embedPlayBtn) embedPlayBtn.classList.remove('active');

        let curTime = 0;
        if (player && typeof player.pauseVideo === 'function') {
            player.pauseVideo();
            curTime = player.getCurrentTime ? player.getCurrentTime() : 0;
        }
        const video = document.querySelector('#player-container video');
        if (video) {
            video.pause();
            curTime = video.currentTime;
        }
        sendIframeCommand('pause');
        sendIframeCommand('pauseVideo');

        if (window.broadcastSync) window.broadcastSync('PAUSED', curTime);
    });
}

if (embedSeekBackBtn) {
    embedSeekBackBtn.addEventListener('click', () => {
        if (window.hostOnlyVideo && !window.isHost) {
            alert("Host-Only Video mode is active. Only the Host can control the video.");
            return;
        }
        let curTime = 0;
        if (player && typeof player.seekTo === 'function') {
            curTime = Math.max(0, (player.getCurrentTime ? player.getCurrentTime() : 0) - 10);
            player.seekTo(curTime, true);
        }
        const video = document.querySelector('#player-container video');
        if (video) {
            curTime = Math.max(0, video.currentTime - 10);
            video.currentTime = curTime;
        }
        sendIframeCommand('seekBy', -10);

        const isPlaying = (player && typeof player.getPlayerState === 'function') ? (player.getPlayerState() === 1) : false;
        const stateStr = isPlaying ? 'PLAYING' : 'PAUSED';
        if (window.broadcastSync) window.broadcastSync(stateStr, curTime);
    });
}

if (embedSeekFwdBtn) {
    embedSeekFwdBtn.addEventListener('click', () => {
        if (window.hostOnlyVideo && !window.isHost) {
            alert("Host-Only Video mode is active. Only the Host can control the video.");
            return;
        }
        let curTime = 0;
        if (player && typeof player.seekTo === 'function') {
            curTime = (player.getCurrentTime ? player.getCurrentTime() : 0) + 10;
            player.seekTo(curTime, true);
        }
        const video = document.querySelector('#player-container video');
        if (video) {
            curTime = video.currentTime + 10;
            video.currentTime = curTime;
        }
        sendIframeCommand('seekBy', 10);

        const isPlaying = (player && typeof player.getPlayerState === 'function') ? (player.getPlayerState() === 1) : false;
        const stateStr = isPlaying ? 'PLAYING' : 'PAUSED';
        if (window.broadcastSync) window.broadcastSync(stateStr, curTime);
    });
}

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
