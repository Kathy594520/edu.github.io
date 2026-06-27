const Game = {
  state: 'loading',
  points: parseInt(localStorage.getItem('dbPoints')) || 0,
  eggs: parseInt(localStorage.getItem('dbEggs')) || 0,
  players: [{ id: 'p1', name: '你', emoji: '🐞', ready: true }],
  currentMode: null,
  gameRunning: false,
  canvas: null,
  ctx: null,
  invites: JSON.parse(localStorage.getItem('dbInvites')) || [],
  inventory: JSON.parse(localStorage.getItem('dbInventory')) || [],

  init() {
    const skipLoading = () => {
      document.getElementById('loading-screen').classList.add('hidden');
      document.getElementById('main-menu').classList.remove('hidden');
      this.state = 'menu';
      this.updateStats();
    };
    const loadEl = document.getElementById('loading-screen');
    loadEl.addEventListener('click', skipLoading);
    setTimeout(skipLoading, 600);

    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
  },

  updateStats() {
    document.getElementById('total-points').textContent = this.points;
    document.getElementById('total-eggs').textContent = this.eggs;
    document.getElementById('lottery-points').textContent = this.points;
    document.getElementById('lottery-eggs').textContent = this.eggs;
  },

  addPoints(amount) {
    this.points += amount;
    localStorage.setItem('dbPoints', this.points);
    this.updateStats();
  },

  addEggs(amount) {
    this.eggs += amount;
    localStorage.setItem('dbEggs', this.eggs);
    this.updateStats();
  },

  addToInventory(item) {
    this.inventory.push(item);
    localStorage.setItem('dbInventory', JSON.stringify(this.inventory));
  },

  resizeCanvas() {
    const container = document.getElementById('game-canvas-container');
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
  }
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id + '-screen');
  if (target) {
    target.classList.remove('hidden');
    if (id === 'game') {
      Game.resizeCanvas();
    }
  }
}

function exitGame() {
  Game.gameRunning = false;
  showScreen('menu');
}

function startMultiplayerGame() {
  showScreen('game');
  Game.resizeCanvas();
  // Start with mode select - default to egg mode
  loadMode('egg');
}

function loadMode(mode, players) {
  Game.currentMode = mode;
  Game.players = players || Game.players;
  Game.gameRunning = true;

  const modeNames = { egg: '🥚 卵排列遊戲', larva: '🐛 合作滾屎球', pupa: '🫘 蛹之家設計', adult: '🐞 成蟲旅行' };
  document.getElementById('hud-mode-name').textContent = modeNames[mode] || '未知模式';
  document.getElementById('hud-players').textContent = '👤 ' + Game.players.map(p => p.name).join(', ');

  Game.resizeCanvas();
  Game.canvas.style.display = 'block';

  switch(mode) {
    case 'egg': EggPuzzle.init(Game.canvas, Game.ctx, Game.players); break;
    case 'larva': BallRolling.init(Game.canvas, Game.ctx, Game.players); break;
    case 'pupa': PupaHome.init(Game.canvas, Game.ctx, Game.players); break;
    case 'adult': AdultTravel.init(Game.canvas, Game.ctx, Game.players); break;
  }
}

document.addEventListener('DOMContentLoaded', () => Game.init());
window.addEventListener('resize', () => {
  if (Game.state === 'playing') Game.resizeCanvas();
});

// Stage button click handlers
document.querySelectorAll('.stage-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    showScreen('game');
    Game.resizeCanvas();
    loadMode(mode);
  });
});