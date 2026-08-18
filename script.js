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

// Electric Liquid Light Ribbon Canvas Background (Mimics exact video reference)
(function initElectricWaves() {
    function setupCanvas() {
        let canvas = document.getElementById('electric-waves-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'electric-waves-canvas';
            canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: -2; background: #040308;';
            document.body.prepend(canvas);
        }

        const ctx = canvas.getContext('2d');
        let width, height, tick = 0;

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }

        const curves = [
            { color: 'rgba(59, 130, 246, 0.45)', width: 120, speed: 0.008, freq: 0.0015, amp: 180, offset: 0 },
            { color: 'rgba(139, 92, 246, 0.4)', width: 90, speed: 0.012, freq: 0.002, amp: 140, offset: 2 },
            { color: 'rgba(236, 72, 153, 0.35)', width: 70, speed: 0.006, freq: 0.0012, amp: 200, offset: 4 },
            { color: 'rgba(99, 102, 241, 0.3)', width: 150, speed: 0.01, freq: 0.001, amp: 220, offset: 1 }
        ];

        function animate() {
            ctx.fillStyle = 'rgba(4, 3, 8, 0.25)';
            ctx.fillRect(0, 0, width, height);

            ctx.globalCompositeOperation = 'lighter';

            tick++;

            curves.forEach(c => {
                ctx.beginPath();
                ctx.lineWidth = c.width;
                
                const grad = ctx.createLinearGradient(0, 0, width, height);
                grad.addColorStop(0, 'rgba(14, 165, 233, 0.1)');
                grad.addColorStop(0.5, c.color);
                grad.addColorStop(1, 'rgba(217, 70, 239, 0.1)');
                ctx.strokeStyle = grad;

                const centerY = height * 0.35;

                ctx.moveTo(-100, centerY);
                for (let x = -100; x <= width + 100; x += 20) {
                    const y = centerY + 
                        Math.sin(x * c.freq + tick * c.speed + c.offset) * c.amp +
                        Math.cos(x * 0.0008 + tick * 0.005) * 60;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            });

            ctx.globalCompositeOperation = 'source-over';
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
