// Load the YouTube IFrame Player API code asynchronously.
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
var isPlayerReady = false;

// This function creates an <iframe> (and YouTube player)
// after the API code downloads.
function onYouTubeIframeAPIReady() {
    isPlayerReady = true;
}

function initPlayer(videoId) {
    if (!isPlayerReady) return;

    const wrapper = document.getElementById('player-container');
    wrapper.innerHTML = '<div id="ytplayer"></div>';

    player = new YT.Player('ytplayer', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'playsinline': 1,
            'autoplay': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    event.target.playVideo();
}

let remoteActionUntil = 0;
let lastSyncTime = 0;

function onPlayerStateChange(event) {
    if (!window.isHost && window.hostOnlyVideo) return; // Guests can't control if restricted
    
    const now = Date.now();
    if (now < remoteActionUntil) return; // Ignore events triggered by remote sync
    
    if (now - lastSyncTime < 500) return; // debounce
    lastSyncTime = now;

    if (event.data == YT.PlayerState.PLAYING) {
        if (window.broadcastSync) window.broadcastSync('PLAYING', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.PAUSED || event.data == YT.PlayerState.BUFFERING) {
        if (window.broadcastSync) window.broadcastSync('PAUSED', player.getCurrentTime());
    }
}

window.applyVideoSync = function(state, time) {
    if (!player || !player.seekTo) return;
    if (window.isHost && window.hostOnlyVideo) return; // Host ignores guests if restricted

    remoteActionUntil = Date.now() + 1000; // Ignore local events for 1 second
    
    // If the time difference is greater than 1.5 seconds, scrub to sync
    if (Math.abs(player.getCurrentTime() - time) > 1.5) {
        player.seekTo(time, true);
    }
    
    if (state === 'PLAYING') {
        player.playVideo();
    } else if (state === 'PAUSED') {
        player.pauseVideo();
    }
};

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
    if (!window.isHost && window.hostOnlyVideo) {
        alert("The Host has disabled video loading for guests.");
        return;
    }

    const url = document.getElementById('video-url').value;
    if (!url) {
        alert("Please enter a URL.");
        return;
    }
    
    // Broadcast the new video to peers if allowed
    if (window.broadcastVideoSync) {
        window.broadcastVideoSync(url);
    }
    
    window.loadVideo(url);
});

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

// Crisp Field of Blinking Dots Background Component
(function initBlinkingDots() {
    function setupCanvas() {
        let canvas = document.getElementById('blinking-dots-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'blinking-dots-canvas';
            canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: -1;';
            document.body.prepend(canvas);
        }

        const ctx = canvas.getContext('2d');
        let width, height;
        let dots = [];
        const spacing = 28; // Grid spacing in pixels
        const dotRadius = 1.5;

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            createGrid();
        }

        function createGrid() {
            dots = [];
            const cols = Math.ceil(width / spacing);
            const rows = Math.ceil(height / spacing);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    dots.push({
                        x: c * spacing + spacing / 2,
                        y: r * spacing + spacing / 2,
                        baseAlpha: Math.random() * 0.08 + 0.04,
                        currentAlpha: Math.random() * 0.1,
                        targetAlpha: Math.random() * 0.08,
                        speed: 0.005 + Math.random() * 0.015,
                        color: Math.random() > 0.3 ? '139, 92, 246' : '244, 63, 94' // Purple & Rose accent dots
                    });
                }
            }
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < dots.length; i++) {
                const d = dots[i];
                
                if (Math.abs(d.currentAlpha - d.targetAlpha) < 0.01) {
                    if (Math.random() < 0.02) { // 2% chance per frame to start blinking
                        d.targetAlpha = 0.4 + Math.random() * 0.45;
                        d.speed = 0.01 + Math.random() * 0.025;
                    } else {
                        d.targetAlpha = d.baseAlpha;
                    }
                }

                d.currentAlpha += (d.targetAlpha - d.currentAlpha) * d.speed;

                ctx.beginPath();
                ctx.arc(d.x, d.y, dotRadius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${d.color}, ${d.currentAlpha})`;
                ctx.fill();

                if (d.currentAlpha > 0.35) {
                    ctx.beginPath();
                    ctx.arc(d.x, d.y, dotRadius * 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${d.color}, ${d.currentAlpha * 0.25})`;
                    ctx.fill();
                }
            }

            requestAnimationFrame(animate);
        }

        window.addEventListener('resize', resize);
        resize();
        animate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupCanvas);
    } else {
        setupCanvas();
    }
})();
