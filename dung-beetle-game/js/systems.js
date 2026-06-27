// ============================================================
// 邀請碼系統 — 跨瀏覽器多人配對 (PeerJS / WebRTC)
// ============================================================
let currentInviteCode = '';
let isHost = false;
let roomPlayers = [{ id: 'p1', name: '你', emoji: '🐞', ready: true }];
let peer = null;
let peerConns = {};
let joinTimeout = null;

// ---- Room Host ----

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  currentInviteCode = code;
  document.getElementById('invite-code').textContent = code;

  isHost = true;
  roomPlayers = [{ id: 'p1', name: '你', emoji: '🐞', ready: true }];
  updatePlayerListUI(roomPlayers);

  startPeer(code);

  Game.invites.push({ code, time: Date.now(), players: 1 });
  localStorage.setItem('dbInvites', JSON.stringify(Game.invites));

  return code;
}

function copyInviteCode() {
  if (!currentInviteCode) generateInviteCode();
  const code = document.getElementById('invite-code').textContent;
  if (code && code !== '------') {
    navigator.clipboard.writeText(code).then(() => {
      showToast('✅ 已複製邀請碼：' + code);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('✅ 已複製邀請碼：' + code);
    });
  }
}

function startPeer(id) {
  destroyPeer();
  if (typeof Peer === 'undefined') {
    showToast('⚠️ 無法載入 PeerJS，請確認網路連線');
    return;
  }
  showToast('📡 正在建立房間...');
  try {
    peer = new Peer(id, { debug: 0 });
    peer.on('open', () => {
      showToast('✅ 房間已建立！分享邀請碼給朋友');
    });
    peer.on('connection', handleIncomingConn);
    peer.on('disconnected', () => {
      showToast('🔌 連線中斷，嘗試重新連線...');
      peer.reconnect();
    });
    peer.on('error', (err) => {
      console.error('[Peer]', err);
      if (err.type === 'unavailable-id') showToast('⚠️ 此邀請碼已被使用，請重新產生');
    });
  } catch(e) {
    showToast('⚠️ 無法建立連線：' + e.message);
  }
}

function handleIncomingConn(conn) {
  const playerId = 'p' + (Object.keys(peerConns).length + 2);
  peerConns[playerId] = conn;

  conn.on('data', (data) => {
    if (data.type === 'join_request') {
      if (roomPlayers.length >= 4) {
        conn.send({ type: 'join_rejected', reason: 'full' });
        return;
      }
      if (roomPlayers.find(p => p.name === data.name)) {
        conn.send({ type: 'join_rejected', reason: 'duplicate' });
        return;
      }
      const idx = roomPlayers.length;
      const emojis = ['🐞', '🐛', '🦗', '🦋'];
      const newPlayer = {
        id: playerId, name: data.name,
        emoji: emojis[idx] || '🐞', ready: true
      };
      roomPlayers.push(newPlayer);
      conn.playerName = data.name;
      updatePlayerListUI(roomPlayers);
      broadcastToPeers({ type: 'player_list_update', players: roomPlayers });
      conn.send({ type: 'join_accepted', players: roomPlayers });
      showToast(`🎉 ${data.name} 加入了！ (${roomPlayers.length}/4)`);
      console.log(`[Peer] ${data.name} joined (${roomPlayers.length}/4)`);
    }
  });

  conn.on('close', () => {
    delete peerConns[playerId];
    roomPlayers = roomPlayers.filter(p => p.id !== playerId);
    updatePlayerListUI(roomPlayers);
    broadcastToPeers({ type: 'player_list_update', players: roomPlayers });
    showToast(`👋 ${conn.playerName || '某位玩家'} 離開了`);
  });
}

function broadcastToPeers(data) {
  Object.values(peerConns).forEach(c => { if (c.open) c.send(data); });
}

function destroyPeer() {
  Object.values(peerConns).forEach(c => c.close());
  peerConns = {};
  if (peer) { peer.destroy(); peer = null; }
}

// ---- Join Tab ----

function joinGame() {
  const code = document.getElementById('join-code-input').value.toUpperCase().trim();
  const name = document.getElementById('player-name-input').value.trim() || '小糞鬥士';

  if (code.length < 4) {
    showToast('⚠️ 請輸入有效的邀請碼（6位）');
    return;
  }

  isHost = false;
  document.getElementById('join-code-input').disabled = true;
  document.querySelector('#join-screen .btn-main').disabled = true;

  if (typeof Peer === 'undefined') {
    document.getElementById('join-code-input').disabled = false;
    document.querySelector('#join-screen .btn-main').disabled = false;
    showToast('⚠️ 無法載入 PeerJS，請確認網路連線');
    return;
  }

  showToast('📡 正在連線到房主...');
  try {
    peer = new Peer();
    peer.on('open', () => {
      const conn = peer.connect(code, { reliable: true });
      const connId = 'join_' + Date.now();
      peerConns[connId] = conn;

      conn.on('open', () => {
        conn.send({ type: 'join_request', name });

        joinTimeout = setTimeout(() => {
          document.getElementById('join-code-input').disabled = false;
          document.querySelector('#join-screen .btn-main').disabled = false;
          showToast('⏰ 找不到房間 😅 請確認：①邀請碼輸入正確 ②房主頁面還開著 ③網路正常');
        }, 8000);
      });

      conn.on('data', (data) => {
        if (data.type === 'join_accepted') {
          if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
          roomPlayers = data.players;
          Game.players = roomPlayers;
          showToast(`🎉 成功加入 ${roomPlayers[0].name} 的房間！`);
          showScreen('room');
          document.getElementById('invite-code').textContent = '已加入 ✅';
          const box = document.querySelector('.invite-code-box');
          box.querySelector('p').textContent = '📍 已連線到房間';
          box.querySelectorAll('button').forEach(b => b.remove());
          updatePlayerListUI(roomPlayers);
        }
        if (data.type === 'join_rejected') {
          if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
          document.getElementById('join-code-input').disabled = false;
          document.querySelector('#join-screen .btn-main').disabled = false;
          if (data.reason === 'full') showToast('👥 房間已滿（最多4人）');
          else if (data.reason === 'duplicate') showToast('⚠️ 此名稱已被使用');
        }
        if (data.type === 'player_list_update') {
          roomPlayers = data.players;
          Game.players = roomPlayers;
          updatePlayerListUI(roomPlayers);
        }
        if (data.type === 'game_start') {
          remoteStartGame(data);
        }
      });

      conn.on('close', () => {
        showToast('🔌 與房主的連線已中斷');
      });
    });

    peer.on('error', (err) => {
      console.error('[Peer]', err);
      document.getElementById('join-code-input').disabled = false;
      document.querySelector('#join-screen .btn-main').disabled = false;
      showToast('⚠️ 連線失敗：' + (err.message || '請確認邀請碼'));
    });

  } catch(e) {
    document.getElementById('join-code-input').disabled = false;
    document.querySelector('#join-screen .btn-main').disabled = false;
    showToast('⚠️ 連線錯誤：' + e.message);
  }
}

function remoteStartGame(msg) {
  Game.players = msg.players;
  showToast(`🎮 ${msg.players[0].name} 開始遊戲了！到主螢幕一起玩吧！`);
  setTimeout(() => showScreen('menu'), 1500);
}

// ---- Shared ----

function updatePlayerListUI(players) {
  const list = document.getElementById('player-list');
  if (!list) return;
  const emojis = ['🐞', '🐛', '🦗', '🦋'];
  let html = '';
  for (let i = 0; i < 4; i++) {
    if (i < players.length) {
      html += `<div class="player-slot active"><span>${emojis[i] || '🐞'} ${players[i].name}</span><span class="ready-badge">✅ 已準備</span></div>`;
    } else {
      html += `<div class="player-slot"><span>⬜ 等待玩家${i+1}...</span></div>`;
    }
  }
  list.innerHTML = html;
}

function startMultiplayerGame() {
  if (isHost) {
    broadcastToPeers({ type: 'game_start', mode: 'egg', players: roomPlayers });
  }
  Game.players = roomPlayers;
  showScreen('game');
  Game.resizeCanvas();
  loadMode('egg', roomPlayers);
}

// ============================================================
// 彩蛋積分與抽獎系統
// ============================================================
const LOTTERY_PRIZES = [
  { name: '💎 傳說糞金龜造型', type: 'legendary', weight: 2, icon: '💎' },
  { name: '🌟 稀有翅膀特效', type: 'rare', weight: 8, icon: '🌟' },
  { name: '🌈 彩色屎球外觀', type: 'rare', weight: 10, icon: '🌈' },
  { name: '🎀 可愛蝴蝶結裝飾', type: 'uncommon', weight: 20, icon: '🎀' },
  { name: '🍀 幸運草背景', type: 'common', weight: 30, icon: '🍀' },
  { name: '🎈 氣球道具', type: 'common', weight: 30, icon: '🎈' }
];

let lotterySpinning = false;

function spinLottery() {
  if (lotterySpinning) return;

  if (Game.eggs < 1 || Game.points < 100) {
    showToast('😅 需要 1 顆彩蛋 + 100 積分才能抽獎！');
    return;
  }

  lotterySpinning = true;
  Game.addEggs(-1);
  Game.addPoints(-100);

  const eggRow = document.getElementById('egg-row');
  const resultDiv = document.getElementById('lottery-result');
  resultDiv.classList.add('hidden');
  eggRow.classList.add('spinning');

  playSuccessSound();

  const totalWeight = LOTTERY_PRIZES.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected = LOTTERY_PRIZES[0];
  for (const prize of LOTTERY_PRIZES) {
    roll -= prize.weight;
    if (roll <= 0) { selected = prize; break; }
  }

  const eggItems = eggRow.querySelectorAll('.egg-item');
  let spins = 0;
  const spinInterval = setInterval(() => {
    for (let i = 0; i < eggItems.length; i++) {
      eggItems[i].textContent = ['🥚', '🌟', '💎', '🎀', '🌈', '🍀'][Math.floor(Math.random() * 6)];
    }
    spins++;
    if (spins > 15) {
      clearInterval(spinInterval);
      eggRow.classList.remove('spinning');

      for (let i = 0; i < eggItems.length; i++) {
        eggItems[i].textContent = i === 1 ? selected.icon : '🥚';
      }

      resultDiv.textContent = '🎉 ' + selected.name + ' 🎉';
      resultDiv.className = 'lottery-result ' + selected.type;
      resultDiv.classList.remove('hidden');

      Game.addToInventory(selected);
      spawnConfetti();
      lotterySpinning = false;

      if (selected.type === 'legendary') {
        showToast('💎💎💎 傳說級獎品！太幸運了！');
        Game.addEggs(3);
        spawnConfetti();
        setTimeout(spawnConfetti, 500);
        setTimeout(spawnConfetti, 1000);
      }
    }
  }, 100);
}

// ============================================================
// Toast 通知系統
// ============================================================
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '15px 30px',
    borderRadius: '50px',
    fontSize: '18px',
    fontWeight: '700',
    zIndex: '2000',
    animation: 'popIn 0.3s ease',
    fontFamily: "'Noto Sans TC', sans-serif",
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ============================================================
// 教育內容
// ============================================================
const DUNG_BEETLE_FACTS = [
  { stage: 'egg', fact: '🥚 糞金龜媽媽會把卵產在糞球裡，寶寶出生就有食物吃！' },
  { stage: 'egg', fact: '🥚 一隻糞金龜一次可以產下 20-30 顆卵！' },
  { stage: 'larva', fact: '🐛 糞金龜幼蟲以糞便為食，是自然界的小清道夫！' },
  { stage: 'larva', fact: '🐛 幼蟲時期會把糞球滾得圓圓的，方便搬運！' },
  { stage: 'pupa', fact: '🫘 蛹期是糞金龜最脆弱的時期，需要安全溫暖的家。' },
  { stage: 'pupa', fact: '🫘 在蛹裡，幼蟲的身體會完全重組，變成成蟲！' },
  { stage: 'adult', fact: '🐞 成蟲糞金龜有強壯的翅膀，可以飛很遠的距離！' },
  { stage: 'adult', fact: '🐞 糞金龜是地球上最強壯的昆蟲之一，能推動自身體重 1000 倍的糞球！' }
];

function showRandomFact(stage) {
  const facts = DUNG_BEETLE_FACTS.filter(f => f.stage === stage);
  if (facts.length > 0) {
    const fact = facts[Math.floor(Math.random() * facts.length)];
    showToast(fact.fact);
  }
}

// ============================================================
// Screen transition hooks
// ============================================================
function onShowRoom() {
  if (!currentInviteCode && !document.querySelector('.invite-code-box p').textContent.includes('已連線')) {
    generateInviteCode();
  }
  updatePlayerListUI(roomPlayers);
}

function leaveRoom() {
  destroyPeer();
  isHost = false;
  currentInviteCode = '';
  roomPlayers = [{ id: 'p1', name: '你', emoji: '🐞', ready: true }];
  showScreen('menu');
}

function onShowLottery() {
  Game.updateStats();
}

window.addEventListener('beforeunload', () => destroyPeer());

console.log('🐞 屎殼郎大冒險 loaded!');
console.log('🎮 遊戲模式: 卵排列 | 滾屎球 | 蛹之家 | 成蟲旅行');
console.log('👥 支援跨裝置多人 (PeerJS WebRTC)');
console.log('🎁 彩蛋抽獎系統已就緒');