// ============================================================
// 邀請碼系統 — 完整跨分頁多人配對 (BroadcastChannel)
// ============================================================
let currentInviteCode = '';
const MULTI_CHANNEL = 'dung-beetle-multi';
let multiChannel = null;
let isRoomHost = false;
let roomPlayers = [{ id: 'p1', name: '你', emoji: '🐞', ready: true }];

function initMultiplayerChannel() {
  try {
    multiChannel = new BroadcastChannel(MULTI_CHANNEL);
    multiChannel.onmessage = onMultiMessage;
    console.log('[Multi] BroadcastChannel 已就緒');
  } catch(e) {
    console.warn('[Multi] BroadcastChannel 不支援，多人模式不可用');
  }
}

function onMultiMessage(e) {
  const msg = e.data;
  const myTab = getTabId();
  switch (msg.type) {
    case 'room_available':
      showAvailableRoom(msg);
      break;
    case 'join_request':
      if (isRoomHost) handleJoinRequest(msg);
      break;
    case 'join_accepted':
      if (msg.tabId === myTab) handleJoinAccepted(msg);
      break;
    case 'join_rejected':
      if (msg.tabId === myTab) handleJoinRejected(msg);
      break;
    case 'player_list_update':
      if (!isRoomHost) updatePlayerListUI(msg.players);
      break;
    case 'game_start':
      if (!isRoomHost) remoteStartGame(msg);
      break;
  }
}

// ---- Room Host ----

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  currentInviteCode = code;
  document.getElementById('invite-code').textContent = code;

  isRoomHost = true;
  roomPlayers = [{ id: 'p1', name: '你', emoji: '🐞', ready: true }];

  if (multiChannel) {
    multiChannel.postMessage({ type: 'room_available', code, tabId: getTabId() });
  }

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

function handleJoinRequest(msg) {
  if (roomPlayers.length >= 4) {
    if (multiChannel) multiChannel.postMessage({ type: 'join_rejected', reason: 'full', tabId: msg.tabId });
    return;
  }
  if (roomPlayers.find(p => p.name === msg.name)) {
    if (multiChannel) multiChannel.postMessage({ type: 'join_rejected', reason: 'duplicate', tabId: msg.tabId });
    return;
  }

  const playerNum = roomPlayers.length;
  const emojis = ['🐞', '🐛', '🦗', '🦋'];
  const newPlayer = {
    id: 'p' + (playerNum + 1),
    name: msg.name,
    emoji: emojis[playerNum] || '🐞',
    ready: true,
    tabId: msg.tabId
  };
  roomPlayers.push(newPlayer);

  updatePlayerListUI(roomPlayers);
  if (multiChannel) {
    multiChannel.postMessage({ type: 'join_accepted', player: newPlayer, players: roomPlayers, tabId: msg.tabId });
    multiChannel.postMessage({ type: 'player_list_update', players: roomPlayers });
  }

  showToast(`🎉 ${msg.name} 加入了！ (${roomPlayers.length}/4)`);
  console.log(`[Multi] Join accepted: ${msg.name} (${roomPlayers.length}/4)`);
}

// ---- Join Tab ----

function joinGame() {
  const code = document.getElementById('join-code-input').value.toUpperCase().trim();
  const name = document.getElementById('player-name-input').value.trim() || '小糞鬥士';

  if (code.length < 4) {
    showToast('⚠️ 請輸入有效的邀請碼（6位）');
    return;
  }

  isRoomHost = false;
  document.getElementById('join-code-input').disabled = true;
  document.querySelector('#join-screen .btn-main').disabled = true;

  if (multiChannel) {
    multiChannel.postMessage({ type: 'join_request', code, name, tabId: getTabId() });
    showToast('📡 正在連線到房間...');

    joinTimeout = setTimeout(() => {
      document.getElementById('join-code-input').disabled = false;
      document.querySelector('#join-screen .btn-main').disabled = false;
      showToast('⏰ 找不到房間 😅 請確認：①邀請碼輸入正確 ②房主的分頁還開著 ③你在同一個瀏覽器開新分頁');
    }, 5000);
  } else {
    document.getElementById('join-code-input').disabled = false;
    document.querySelector('#join-screen .btn-main').disabled = false;
    showToast('⚠️ 此瀏覽器不支援 BroadcastChannel，請改用 Chrome 或 Edge');
  }
}

let joinTimeout = null;

function handleJoinAccepted(msg) {
  if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }

  roomPlayers = msg.players;
  Game.players = roomPlayers;

  showToast(`🎉 成功加入 ${roomPlayers[0].name} 的房間！ (${roomPlayers.length}/4)`);

  setTimeout(() => {
    showScreen('room');
    currentInviteCode = '已加入 ' + roomPlayers[0].name + ' 的房間';
    document.getElementById('invite-code').textContent = '已加入 ✅';
    const box = document.querySelector('.invite-code-box');
    box.querySelector('p').textContent = '📍 已連線到房間';
    box.querySelectorAll('button').forEach(b => b.remove());
    updatePlayerListUI(roomPlayers);
  }, 1000);
}

function handleJoinRejected(msg) {
  if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
  document.getElementById('join-code-input').disabled = false;
  document.querySelector('#join-screen .btn-main').disabled = false;

  if (msg.reason === 'full') showToast('👥 房間已滿（最多4人）');
  else if (msg.reason === 'duplicate') showToast('⚠️ 此名稱已被使用');
}

function showAvailableRoom(msg) {
  // Auto-discover rooms could be added here
}

function remoteStartGame(msg) {
  Game.players = msg.players;
  showToast(`🎮 ${msg.players[0].name} 開始遊戲了！到主螢幕一起玩吧！`);
  setTimeout(() => showScreen('menu'), 1500);
}

// ---- Shared ----

function getTabId() {
  let id = sessionStorage.getItem('multiTabId');
  if (!id) {
    id = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    sessionStorage.setItem('multiTabId', id);
  }
  return id;
}

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
  if (isRoomHost && multiChannel) {
    multiChannel.postMessage({ type: 'game_start', mode: 'egg', players: roomPlayers });
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

function onShowLottery() {
  Game.updateStats();
}

// ============================================================
// Initialize multiplayer channel
// ============================================================
initMultiplayerChannel();

console.log('🐞 屎殼郎大冒險 loaded!');
console.log('🎮 遊戲模式: 卵排列 | 滾屎球 | 蛹之家 | 成蟲旅行');
console.log('👥 支援跨分頁多人 (同瀏覽器開新分頁加入)');
console.log('🎁 彩蛋抽獎系統已就緒');