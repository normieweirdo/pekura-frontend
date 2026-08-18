const signalingServerUrl = 'https://pekura-backend.onrender.com';
const socket = (typeof io !== 'undefined') ? io(signalingServerUrl) : { on: () => {}, emit: () => {} };

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') ? urlParams.get('room').trim() : null;

// Preserve host status across browser refreshes using sessionStorage
let isHost = !roomId || (roomId && sessionStorage.getItem('is_host_' + roomId) === 'true');
window.isHost = isHost;

let currentRoomId = roomId ? roomId : Math.floor(100000 + Math.random() * 900000).toString();

if (isHost) {
    sessionStorage.setItem('is_host_' + currentRoomId, 'true');
    // Ensure room ID remains in browser URL bar on refresh
    try {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?room=' + currentRoomId;
        window.history.replaceState({ path: newUrl }, '', newUrl);
    } catch(e) {}
}

const peerOptions = {
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    }
};

const peer = isHost 
    ? new Peer(currentRoomId, peerOptions) 
    : new Peer(peerOptions);

peer.on('error', (err) => {
    console.error("PeerJS Error:", err);
});

let myStream = null;
let currentCalls = [];
let userCount = 1;
let roomLocked = false;
window.hostOnlyVideo = true;

window.onerror = function(msg, url, lineNo, columnNo, error) {
    document.getElementById('room-status').textContent = 'JS Error: ' + msg;
    return false;
};

socket.on('connect', () => {
    document.getElementById('room-status').textContent = "Socket connected. Joining room...";
    const username = document.getElementById('profile-name') ? document.getElementById('profile-name').value.trim() || 'Guest' : 'Guest';
    socket.emit('join_room', { roomId: currentRoomId, isHost: isHost, username: username }, (res) => {
        if (!res.success) {
            alert(res.error);
            window.location.href = window.location.href.split('?')[0];
            return;
        }
        
        const status = document.getElementById('room-status');
        const inviteBtn = document.getElementById('copy-invite-btn');
        const joinBtn = document.getElementById('join-room-btn');
        
        if (isHost) {
            status.textContent = "Hosting Room: " + currentRoomId;
        } else {
            status.textContent = "Connected to Room";
            inviteBtn.style.display = 'none';
            if (joinBtn) {
                joinBtn.style.display = 'none';
                document.getElementById('join-room-input').style.display = 'none';
            }
        }
            
        if (res.currentVideoUrl && window.loadVideo) {
            document.getElementById('video-url').value = res.currentVideoUrl;
            window.loadVideo(res.currentVideoUrl);
        }
        if (res.videoQueue) {
            updateQueueUI(res.videoQueue);
        }
        if (res.chatHistory && res.chatHistory.length > 0) {
            res.chatHistory.forEach(msg => appendStructuredMessage(msg, 'peer'));
        }
        window.hostOnlyVideo = res.hostOnlyVideo;
    });
});

socket.on('user-count', data => updateUserCount(data.count));

if (isHost) {
    document.getElementById('host-controls').style.display = 'block';
    document.getElementById('play-next-btn').style.display = 'block';
    
    document.getElementById('host-panel-btn').addEventListener('click', () => {
        document.getElementById('host-modal').style.display = 'flex';
        // renderHostUserList is obsolete without connections array, skipping
    });
    document.getElementById('close-host-modal').addEventListener('click', () => {
        document.getElementById('host-modal').style.display = 'none';
    });
    document.getElementById('host-only-video-cb').addEventListener('change', (e) => {
        window.hostOnlyVideo = e.target.checked;
        socket.emit('host_settings', { hostOnlyVideo: window.hostOnlyVideo });
    });
}

function updateUserCount(count) {
    userCount = count;
    document.getElementById('user-count').textContent = `Users: ${userCount}`;
}

// Setup Dragging for webcams
function makeDraggable(el) {
    let isDrag = false;
    let startX, startY, initialX, initialY;

    el.addEventListener('mousedown', (e) => {
        if (e.target.tagName.toLowerCase() === 'video') return;
        isDrag = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = el.offsetLeft;
        initialY = el.offsetTop;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDrag) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = (initialX + dx) + 'px';
        el.style.top = (initialY + dy) + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDrag = false;
    });
}

function addVideoStream(video, stream, name) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('webcam-wrapper', 'small');
    
    wrapper.addEventListener('click', (e) => {
        if (wrapper.style.cursor === 'grabbing' || e.target.classList.contains('webcam-close-btn')) return;
        wrapper.classList.toggle('small');
        wrapper.classList.toggle('large');
    });
    
    // Offset webcams so they don't overlap completely
    const count = document.querySelectorAll('.webcam-wrapper').length;
    wrapper.style.top = (20 + (count * 30)) + 'px';
    wrapper.style.right = (20 + (count * 30)) + 'px';

    const nameTag = document.createElement('div');
    nameTag.classList.add('webcam-name');
    nameTag.textContent = name;

    const closeBtn = document.createElement('button');
    closeBtn.classList.add('webcam-close-btn');
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close video box';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        wrapper.style.display = 'none';
        if (myStream && stream === myStream && videoEnabled) {
            videoEnabled = false;
            myStream.getVideoTracks()[0].enabled = false;
            const btn = document.getElementById('toggle-camera-btn');
            if (btn) {
                btn.querySelector('span').textContent = "Enable Camera";
                btn.classList.remove('active');
            }
        }
    });
    
    if (stream) {
        wrapper.id = 'webcam-' + stream.id;
    }

    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    video.classList.add('webcam-video');
    video.muted = (name === document.getElementById('profile-name').value);

    wrapper.append(video);
    wrapper.append(nameTag);
    wrapper.append(closeBtn);
    document.getElementById('webcams-container').append(wrapper);
    makeDraggable(wrapper);
}

async function requestMedia() {
    if (myStream) return myStream;
    try {
        myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        const myWrapper = myStream ? document.getElementById('webcam-' + myStream.id) : null;
        if (myWrapper) {
            myWrapper.style.display = 'flex';
        } else {
            const myVideo = document.createElement('video');
            addVideoStream(myVideo, myStream, document.getElementById('profile-name').value);
        }

        if (!isHost) {
            const call = peer.call(currentRoomId, myStream);
            handleCall(call, "Host");
        }
        
        // Notify others of our peer ID for webcams
        peer.on('open', (id) => {
            socket.emit('broadcast', { type: 'peer-id', peerId: id, isHost: isHost });
        });
        
        return myStream;
    } catch (err) {
        console.error('Failed to get local stream', err);
        return null;
    }
}

// Socket listener for dynamic webcams
socket.on('broadcast', data => {
    if (data.type === 'peer-id') {
        if (isHost && !data.isHost && myStream) {
            const call = peer.call(data.peerId, myStream);
            handleCall(call, "Guest");
        }
    }
});

// Media Controls Toggle Logic
let videoEnabled = false;
let audioEnabled = false;

document.getElementById('toggle-camera-btn').addEventListener('click', async (e) => {
    if (!myStream) await requestMedia();
    if (myStream) {
        if (isScreenSharing) {
            await stopScreenShare();
        }
        videoEnabled = !videoEnabled;
        myStream.getVideoTracks()[0].enabled = videoEnabled;
        const btn = document.getElementById('toggle-camera-btn');
        btn.querySelector('span').textContent = videoEnabled ? "Disable Camera" : "Enable Camera";
        btn.classList.toggle('active', videoEnabled);
        
        const myWrapper = document.getElementById('webcam-' + myStream.id);
        if (myWrapper) {
            myWrapper.style.display = videoEnabled ? 'flex' : 'none';
        }
    }
});

let isScreenSharing = false;

document.getElementById('screenshare-btn').addEventListener('click', async () => {
    if (isScreenSharing) {
        await stopScreenShare();
    } else {
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = displayStream.getVideoTracks()[0];
            
            // Replace local stream video track
            const oldTrack = myStream.getVideoTracks()[0];
            myStream.removeTrack(oldTrack);
            myStream.addTrack(screenTrack);
            
            // Replace track on all active calls
            currentCalls.forEach(call => {
                const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            });
            
            isScreenSharing = true;
            document.getElementById('screenshare-btn').classList.add('active');
            
            screenTrack.onended = () => {
                stopScreenShare();
            };
        } catch (err) {
            console.error("Screen share failed", err);
        }
    }
});

async function stopScreenShare() {
    if (!isScreenSharing) return;
    const oldTrack = myStream.getVideoTracks()[0];
    oldTrack.stop();
    
    // Request webcam again
    const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const camTrack = camStream.getVideoTracks()[0];
    
    myStream.removeTrack(oldTrack);
    myStream.addTrack(camTrack);
    
    currentCalls.forEach(call => {
        const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(camTrack);
    });
    
    camTrack.enabled = videoEnabled;
    isScreenSharing = false;
    document.getElementById('screenshare-btn').classList.remove('active');
}

// Broadcast Video Sync State (used by script.js)
window.broadcastSync = function(state, time) {
    socket.emit('broadcast', { 
        type: 'video-state-sync', 
        state: state, 
        time: time 
    });
};

document.getElementById('toggle-mic-btn').addEventListener('click', async (e) => {
    if (!myStream) await requestMedia();
    if (myStream) {
        audioEnabled = !audioEnabled;
        myStream.getAudioTracks()[0].enabled = audioEnabled;
        const btn = document.getElementById('toggle-mic-btn');
        btn.querySelector('span').textContent = audioEnabled ? "Disable Mic" : "Enable Mic";
        btn.classList.toggle('active', audioEnabled);
    }
});

function handleCall(call, defaultName = "Guest") {
    currentCalls.push(call);
    const video = document.createElement('video');
    
    // Add error listener on the connection
    call.on('error', err => {
        console.error("WebRTC Call Error (" + defaultName + "):", err);
    });

    call.on('stream', userVideoStream => {
        if (!document.getElementById('webcam-' + userVideoStream.id)) {
            addVideoStream(video, userVideoStream, defaultName);
        }
    });
}

// Peer connection handling
peer.on('connection', conn => {
    conn.on('error', err => {
        console.error("WebRTC Data Connection Error:", err);
    });
});

peer.on('call', call => {
    call.answer(myStream); 
    handleCall(call, "Guest");
});

const joinBtn = document.getElementById('join-room-btn');
if (joinBtn) {
    joinBtn.onclick = () => {
        const inputVal = document.getElementById('join-room-input').value.trim();
        if (inputVal) {
            let finalId = inputVal;
            try {
                if (finalId.includes('?room=')) {
                    const urlObj = new URL(finalId.startsWith('http') || finalId.startsWith('file') ? finalId : 'http://dummy' + (finalId.startsWith('/') ? '' : '/') + finalId);
                    finalId = urlObj.searchParams.get('room') || finalId;
                } else if (finalId.startsWith('http') || finalId.startsWith('file')) {
                    finalId = new URL(finalId).searchParams.get('room') || finalId;
                }
            } catch(e) {}
            const url = new URL(window.location.href);
            url.searchParams.set('room', finalId);
            window.location.href = url.toString();
        }
    };
}

// --- CHAT LOGIC ---
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const profileName = document.getElementById('profile-name');

// Audio setup for synthesized sounds
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioContext ? new AudioContext() : null;

function playTone(freq, type, duration, vol) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playMessageSound() {
    playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(800, 'sine', 0.15, 0.1), 100);
}

function playMentionSound() {
    playTone(800, 'triangle', 0.1, 0.2);
    setTimeout(() => playTone(1200, 'triangle', 0.2, 0.2), 100);
}

// Avatar setup
let myAvatarSeed = Math.random().toString(36).substring(2, 10);
let myAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${myAvatarSeed}`;
if (document.getElementById('my-avatar')) {
    document.getElementById('my-avatar').src = myAvatar;
}

const avatarModal = document.getElementById('avatar-modal');
const avatarGrid = document.getElementById('avatar-grid');

document.getElementById('my-avatar').addEventListener('click', () => {
    if(avatarModal) {
        avatarModal.style.display = 'flex';
        generateAvatarGrid();
    }
});

document.getElementById('close-avatar-modal')?.addEventListener('click', () => {
    if(avatarModal) avatarModal.style.display = 'none';
});

document.getElementById('shuffle-avatars-btn')?.addEventListener('click', () => {
    generateAvatarGrid();
});

function generateAvatarGrid() {
    if (!avatarGrid) return;
    avatarGrid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const seed = Math.random().toString(36).substring(2, 10);
        const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.borderRadius = '50%';
        img.style.cursor = 'pointer';
        img.style.background = 'transparent';
        img.style.border = '2px solid transparent';
        img.onmouseover = () => img.style.border = '2px solid #8b5cf6';
        img.onmouseout = () => img.style.border = '2px solid transparent';
        img.onclick = () => {
            myAvatar = url;
            document.getElementById('my-avatar').src = url;
            avatarModal.style.display = 'none';
        };
        avatarGrid.appendChild(img);
    }
}

function createReactionMenu(msgId) {
    const menu = document.createElement('div');
    menu.classList.add('reaction-menu');
    const emojis = [
        { name: 'thumbsup', svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>' },
        { name: 'heart', svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>' },
        { name: 'smile', svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>' },
        { name: 'star', svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' }
    ];
    emojis.forEach(emoji => {
        const btn = document.createElement('span');
        btn.classList.add('reaction-btn');
        btn.innerHTML = emoji.svg;
        btn.onclick = () => sendReaction(msgId, emoji.name);
        menu.appendChild(btn);
    });
    return menu;
}

function appendStructuredMessage(data, type = 'peer') {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    msgDiv.id = `msg-${data.id}`;

    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.gap = '8px';
    headerDiv.style.marginBottom = '5px';

    if (data.avatar) {
        const avatarImg = document.createElement('img');
        avatarImg.src = data.avatar;
        avatarImg.style.width = '24px';
        avatarImg.style.height = '24px';
        avatarImg.style.borderRadius = '50%';
        avatarImg.style.background = 'transparent';
        headerDiv.appendChild(avatarImg);
    }

    const nameSpan = document.createElement('strong');
    nameSpan.textContent = data.sender;
    
    headerDiv.appendChild(nameSpan);
    msgDiv.appendChild(headerDiv);

    if (data.msgType === 'gif') {
        const img = document.createElement('img');
        img.src = data.text;
        img.classList.add('chat-gif');
        msgDiv.appendChild(img);
    } else {
        const textNode = document.createTextNode(data.text);
        msgDiv.appendChild(textNode);
    }

    // Reaction Bar
    const reactionBar = document.createElement('div');
    reactionBar.classList.add('reaction-bar');
    reactionBar.id = `reactions-${data.id}`;
    msgDiv.appendChild(reactionBar);

    // Reaction Menu (only on hover)
    msgDiv.appendChild(createReactionMenu(data.id));

    const myName = profileName.value.trim() || 'Guest';
    if (data.msgType === 'text' && data.text.includes(`@${myName}`)) {
        msgDiv.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
        msgDiv.style.border = '1px solid #f59e0b';
        if (type === 'peer') playMentionSound();
    } else if (type === 'peer') {
        playMessageSound();
    }

    if (data.msgType === 'text') {
        const lowerText = data.text.toLowerCase();
        if (lowerText.includes('🎉')) triggerConfetti();
        if (lowerText.includes('🐧') || lowerText.includes('penguin')) triggerPenguinLove();
    }

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendSystemMessage(text) {
    const sysDiv = document.createElement('div');
    sysDiv.classList.add('message', 'system');
    sysDiv.textContent = text;
    chatMessages.appendChild(sysDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

const reactionSvgs = {
    'thumbsup': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>',
    'heart': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
    'smile': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>',
    'star': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
};

function appendReaction(msgId, emojiName) {
    const bar = document.getElementById(`reactions-${msgId}`);
    if (bar && reactionSvgs[emojiName]) {
        const span = document.createElement('span');
        span.innerHTML = reactionSvgs[emojiName];
        bar.appendChild(span);
    }
}

function triggerConfetti() {
    for (let i = 0; i < 50; i++) {
        const conf = document.createElement('div');
        conf.classList.add('confetti');
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        conf.style.animationDuration = (Math.random() * 2 + 2) + 's';
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 4000);
    }
}

function triggerPenguinLove() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.background = 'rgba(139, 92, 246, 0.4)';
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.transition = 'opacity 1s ease';

    const text = document.createElement('div');
    text.textContent = "I love you, my cute little penguin 🐧";
    text.style.color = '#fff';
    text.style.fontSize = '3.5rem';
    text.style.fontWeight = 'bold';
    text.style.textAlign = 'center';
    text.style.textShadow = '0 4px 30px rgba(0,0,0,0.8)';
    text.style.transform = 'scale(0.5)';
    text.style.transition = 'transform 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    overlay.appendChild(text);
    document.body.appendChild(overlay);

    // Trigger scale animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            text.style.transform = 'scale(1)';
        });
    });

    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 1000);
    }, 1000);
}

function sendStructuredMessage(text, msgType = 'text') {
    const payload = {
        id: Date.now().toString(),
        type: 'structured-chat',
        msgType: msgType,
        text: text,
        sender: profileName.value.trim() || 'Guest',
        avatar: myAvatar
    };
    appendStructuredMessage(payload, 'self');
    socket.emit('broadcast', payload);
    chatInput.value = '';
}

function sendReaction(msgId, emoji) {
    appendReaction(msgId, emoji);
    socket.emit('broadcast', {
        type: 'reaction',
        msgId: msgId,
        emoji: emoji
    });
}

document.getElementById('send-chat-btn').addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text) {
        if (text.match(/\.(gif)$/i) || text.includes('giphy.com') || text.includes('tenor.com')) {
            sendStructuredMessage(text, 'gif');
        } else {
            sendStructuredMessage(text, 'text');
        }
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('send-chat-btn').click();
});

let sendTypingTimeout;
chatInput.addEventListener('input', () => {
    clearTimeout(sendTypingTimeout);
    socket.emit('broadcast', { type: 'typing', sender: profileName.value.trim() || 'Guest' });
    sendTypingTimeout = setTimeout(() => {}, 1000); // Prevent spamming
});

// GIF Picker
const gifBtn = document.getElementById('gif-menu-btn');
const gifPicker = document.getElementById('gif-picker');
const gifSearchInput = document.getElementById('gif-search-input');
const gifList = document.getElementById('gif-list');
const GIPHY_API_KEY = 'IMcQ14Fjup7Vs1Jjb3JYLVwSUYSuFCrw';

gifBtn.addEventListener('click', () => {
    gifPicker.style.display = gifPicker.style.display === 'none' ? 'block' : 'none';
    if (gifPicker.style.display === 'block') {
        gifSearchInput.focus();
    }
});

function bindGifClicks() {
    document.querySelectorAll('.gif-option').forEach(img => {
        img.onclick = (e) => {
            sendStructuredMessage(e.target.src, 'gif');
            gifPicker.style.display = 'none';
        };
    });
}
bindGifClicks();

let gifTimeout;
gifSearchInput.addEventListener('input', (e) => {
    clearTimeout(gifTimeout);
    const query = e.target.value.trim();
    if (!query) return;

    gifTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=8`);
            const json = await res.json();
            
            gifList.innerHTML = ''; // Clear current
            if (json.data && json.data.length > 0) {
                json.data.forEach(gif => {
                    const imgUrl = gif.images.fixed_height.url;
                    const img = document.createElement('img');
                    img.src = imgUrl;
                    img.classList.add('gif-option');
                    img.style.width = '47%';
                    img.style.cursor = 'pointer';
                    img.style.borderRadius = '6px';
                    gifList.appendChild(img);
                });
                bindGifClicks();
            } else {
                gifList.innerHTML = '<p style="font-size:0.8rem;color:#666;">No results found.</p>';
            }
        } catch (err) {
            console.error("Giphy fetch failed", err);
        }
    }, 500); // 500ms debounce
});

// Socket broadcast handler for everything else
socket.on('broadcast', data => {
    try {
        if (data.type === 'structured-chat') {
            appendStructuredMessage(data, 'peer');
        } else if (data.type === 'reaction') {
            appendReaction(data.msgId, data.emoji);
        } else if (data.type === 'confetti') {
            triggerConfetti();
        } else if (data.type === 'video-sync') {
            document.getElementById('video-url').value = data.url;
            if (window.loadVideo) {
                window.loadVideo(data.url);
            }
        } else if (data.type === 'video-state-sync') {
            if (window.applyVideoSync) {
                window.applyVideoSync(data.state, data.time);
            }
        } else if (data.type === 'name-change') {
            const nameTags = document.querySelectorAll('.webcam-name');
            if (nameTags.length > 1) {
                nameTags[1].textContent = data.newName;
            }
        } else if (data.type === 'typing') {
            const indicator = document.getElementById('typing-indicator');
            indicator.textContent = `${data.sender} is typing...`;
            indicator.style.display = 'block';
            if (window.typingIndicatorTimeout) clearTimeout(window.typingIndicatorTimeout);
            window.typingIndicatorTimeout = setTimeout(() => { indicator.style.display = 'none'; }, 2000);
        } else if (data.type === 'host-settings') {
            window.hostOnlyVideo = data.hostOnlyVideo;
        } else if (data.type === 'kicked') {
            alert(data.reason);
            window.location.href = window.location.href.split('?')[0];
        } else if (data.type === 'queue-sync') {
            updateQueueUI(data.queue);
        } else if (data.type === 'user-joined') {
            appendSystemMessage(`👋 ${data.name} joined the room!`);
        } else if (data.type === 'user-left') {
            appendSystemMessage(`👋 ${data.name} left the room.`);
        }
    } catch (error) {
        console.error("Failed to process peer data safely", error);
    }
});

document.getElementById('profile-name').addEventListener('input', (e) => {
    const newName = e.target.value;
    const nameTags = document.querySelectorAll('.webcam-name');
    if (nameTags.length > 0) {
        nameTags[0].textContent = newName;
    }
    socket.emit('broadcast', { type: 'name-change', newName });
});

window.broadcastVideoSync = function(url) {
    socket.emit('broadcast', { type: 'video-sync', url });
};

// Video Queue Logic
let videoQueue = [];

function updateQueueUI(queue) {
    videoQueue = queue;
    const list = document.getElementById('queue-list');
    list.innerHTML = '';
    if (videoQueue.length === 0) {
        list.innerHTML = '<li class="empty-queue">Queue is empty</li>';
    } else {
        videoQueue.forEach((url, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${url}`;
            list.appendChild(li);
        });
    }
}

document.getElementById('queue-btn').addEventListener('click', () => {
    const url = document.getElementById('video-url').value;
    if (url) {
        videoQueue.push(url);
        updateQueueUI(videoQueue);
        document.getElementById('video-url').value = '';
        socket.emit('broadcast', { type: 'queue-sync', queue: videoQueue });
    }
});

document.getElementById('play-next-btn').addEventListener('click', () => {
    if (videoQueue.length > 0) {
        const nextUrl = videoQueue.shift();
        updateQueueUI(videoQueue);
        socket.emit('broadcast', { type: 'queue-sync', queue: videoQueue });
        
        document.getElementById('video-url').value = nextUrl;
        document.getElementById('load-btn').click(); // trigger the load logic
    }
});

// Robust Copy Logic
function fallbackCopy(text) {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // Move off-screen to avoid visibility issues that block copy
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            alert("Room ID copied: " + text + "\n\nShare this ID with your friends!");
        } else {
            prompt("Your browser blocked the copy action. Please manually copy the Room ID:", text);
        }
    } catch (err) {
        console.error("Fallback copy failed", err);
        prompt("Your browser blocked the copy action. Please manually copy the Room ID:", text);
    }
}

const copyInviteBtn = document.getElementById('copy-invite-btn');
if (copyInviteBtn) {
    copyInviteBtn.addEventListener('click', () => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(currentRoomId)
                .then(() => alert("Room ID copied: " + currentRoomId + "\n\nShare this ID with your friends!"))
                .catch(() => fallbackCopy(currentRoomId));
        } else {
            fallbackCopy(currentRoomId);
        }
    });
}

