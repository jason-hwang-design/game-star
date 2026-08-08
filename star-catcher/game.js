const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const timeEl = document.querySelector('#time');
const bestEl = document.querySelector('#best');
const message = document.querySelector('#gameMessage');
const messageTitle = document.querySelector('#messageTitle');
const messageText = document.querySelector('#messageText');
const startButton = document.querySelector('#startButton');
const scoreForm = document.querySelector('#scoreForm');
const nameInput = document.querySelector('#nameInput');
const leaderboardList = document.querySelector('#leaderboardList');
const statusDot = document.querySelector('.status-dot');
const musicToggle = document.querySelector('#musicToggle');

const width = canvas.width;
const height = canvas.height;
const keys = { left: false, right: false };
let score = 0;
let timeLeft = 60;
let playing = false;
let lastTime = 0;
let timer = 0;
let spawnTimer = 0;
let stars = [];
let particles = [];
let audioContext;
let musicTimer;
let musicStep = 0;
let musicEnabled = true;
let player = { x: width / 2, y: height - 45, targetX: width / 2 };
const backgroundStars = Array.from({ length: 72 }, () => ({
  x: Math.random() * width,
  y: Math.random() * height,
  size: Math.random() > .86 ? 2 : 1,
  speed: randomBetween(22, 105),
  opacity: randomBetween(.16, .58)
}));

let leaderboard = JSON.parse(localStorage.getItem('star-catcher-leaderboard') || '[]');
let best = leaderboard.length ? leaderboard[0].score : Number(localStorage.getItem('star-catcher-best') || 0);
bestEl.textContent = String(best).padStart(4, '0');

function renderLeaderboard() {
  leaderboardList.innerHTML = '';
  if (!leaderboard.length) {
    leaderboardList.innerHTML = '<li class="empty">아직 기록이 없습니다. 첫 번째 별빛을 남겨보세요.</li>';
    return;
  }
  leaderboard.forEach(entry => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const points = document.createElement('strong');
    name.textContent = entry.name;
    points.textContent = String(entry.score).padStart(4, '0');
    item.append(name, points);
    leaderboardList.append(item);
  });
}

renderLeaderboard();

function randomBetween(min, max) { return Math.random() * (max - min) + min; }

function spawnStar() {
  const danger = Math.random() < .2;
  stars.push({
    x: randomBetween(28, width - 28),
    y: randomBetween(54, height - 170),
    radius: randomBetween(9, 16),
    value: danger ? -15 : (Math.random() > .84 ? 25 : 10),
    danger,
    phase: Math.random() * Math.PI * 2,
    life: 0,
    duration: randomBetween(3.2, 5.5)
  });
}

function drawBackground(delta) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1b2524');
  gradient.addColorStop(.5, '#111718');
  gradient.addColorStop(1, '#17151a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(215, 241, 113, .035)';
  for (let x = 0; x < width; x += 40) ctx.fillRect(x, 0, 1, height);
  for (let y = 0; y < height; y += 40) ctx.fillRect(0, y, width, 1);
  backgroundStars.forEach(star => {
    star.y += star.speed * delta;
    if (star.y > height + 8) star.y = -8;
    ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
    ctx.fillRect(star.x, star.y, star.size, Math.max(star.size, star.speed * .035));
  });
}

function drawPlayer() {
  player.x += (player.targetX - player.x) * .16;
  const x = Math.max(28, Math.min(width - 28, player.x));
  const flame = 17 + Math.sin(performance.now() * .018) * 5;
  ctx.save();
  ctx.translate(x, player.y);
  ctx.shadowColor = '#ff836d';
  ctx.shadowBlur = 24;

  ctx.fillStyle = '#ffb36a';
  ctx.beginPath();
  ctx.moveTo(-5, 11); ctx.lineTo(0, 11 + flame * .65); ctx.lineTo(5, 11); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ff836d';
  ctx.beginPath();
  ctx.moveTo(0, -27); ctx.quadraticCurveTo(10, -14, 12, 9); ctx.lineTo(25, 17); ctx.lineTo(10, 14); ctx.lineTo(0, 18); ctx.lineTo(-10, 14); ctx.lineTo(-25, 17); ctx.lineTo(-12, 9); ctx.quadraticCurveTo(-10, -14, 0, -27); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#ffb3a2';
  ctx.beginPath();
  ctx.moveTo(0, -20); ctx.quadraticCurveTo(8, -10, 7, 2); ctx.lineTo(0, 8); ctx.lineTo(-7, 2); ctx.quadraticCurveTo(-8, -10, 0, -20); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#193036';
  ctx.beginPath();
  ctx.ellipse(0, -5, 5, 8, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#ffb36a';
  ctx.fillRect(-22, 14, 7, 3); ctx.fillRect(15, 14, 7, 3);
  ctx.restore();
}

function drawStar(star) {
  const pulse = Math.sin(star.phase + star.life * 5) * 2;
  const starColor = star.danger ? '#ff5d5d' : (star.value === 25 ? '#d7f171' : '#f4f0e8');
  ctx.save();
  ctx.translate(star.x, star.y);
  ctx.rotate(star.life * .4);
  ctx.shadowColor = starColor;
  ctx.shadowBlur = star.danger || star.value === 25 ? 30 : 15;
  ctx.fillStyle = starColor;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = (i % 2 ? star.radius * .42 : star.radius) + pulse * (i % 2 ? .1 : .2);
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const pointX = Math.cos(angle) * radius;
    const pointY = Math.sin(angle) * radius;
    i ? ctx.lineTo(pointX, pointY) : ctx.moveTo(pointX, pointY);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function getAudioContext() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function playStarSound(star) {
  const context = getAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startFrequency = star.danger ? 190 : 480;
  const endFrequency = star.danger ? 85 : (star.value === 25 ? 820 : 680);
  const now = context.currentTime;
  oscillator.type = star.danger ? 'sawtooth' : 'sine';
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + (star.danger ? .18 : .12));
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(star.danger ? .16 : .12, now + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, now + (star.danger ? .24 : .16));
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + (star.danger ? .24 : .16));
}

function playMusicNote() {
  if (!playing || !musicEnabled) return;
  const context = getAudioContext();
  const notes = [146.83, 174.61, 220, 174.61, 130.81, 164.81, 196, 164.81];
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(notes[musicStep % notes.length], now);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.linearRampToValueAtTime(.09, now + .08);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .62);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + .65);
  musicStep += 1;
}

function startBgm() {
  if (!musicEnabled || musicTimer) return;
  getAudioContext();
  playMusicNote();
  musicTimer = setInterval(playMusicNote, 720);
}

function stopBgm() {
  clearInterval(musicTimer);
  musicTimer = undefined;
}

function burst(x, y, color) {
  for (let i = 0; i < 12; i++) particles.push({ x, y, color, dx: randomBetween(-90, 90), dy: randomBetween(-110, 20), life: 0, duration: .6 });
}

function drawParticles(delta) {
  particles = particles.filter(particle => particle.life < particle.duration);
  particles.forEach(particle => {
    particle.life += delta;
    particle.x += particle.dx * delta;
    particle.y += particle.dy * delta;
    particle.dy += 180 * delta;
    ctx.globalAlpha = 1 - particle.life / particle.duration;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 3, 3);
  });
  ctx.globalAlpha = 1;
}

function collectAt(x, y) {
  if (!playing) return;
  const hitIndex = stars.findIndex(star => Math.hypot(star.x - x, star.y - y) < star.radius + 18);
  if (hitIndex < 0) return;
  const [star] = stars.splice(hitIndex, 1);
  playStarSound(star);
  score = Math.max(0, score + star.value);
  scoreEl.textContent = String(score).padStart(4, '0');
  burst(star.x, star.y, star.danger ? '#ff5d5d' : (star.value === 25 ? '#d7f171' : '#f4f0e8'));
}

function pointerPosition(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) * width / bounds.width, y: (event.clientY - bounds.top) * height / bounds.height };
}

function startGame() {
  score = 0; timeLeft = 60; timer = 0; spawnTimer = 0; stars = []; particles = [];
  scoreEl.textContent = '0000'; timeEl.textContent = '60';
  playing = true; statusDot.classList.add('live'); message.classList.add('hidden');
  scoreForm.classList.remove('visible');
  startButton.style.display = 'none';
  startBgm();
  for (let i = 0; i < 5; i++) spawnStar();
}

function endGame() {
  playing = false; statusDot.classList.remove('live');
  stopBgm();
  messageTitle.textContent = `${score}점을 모았습니다`;
  messageText.textContent = '이름을 입력하면 오늘의 기록에 저장됩니다.';
  scoreForm.classList.add('visible');
  startButton.style.display = 'none';
  message.classList.remove('hidden');
  nameInput.focus();
}

function saveScore() {
  const name = nameInput.value.trim() || '익명';
  leaderboard = [...leaderboard, { name, score }]
    .sort((first, second) => second.score - first.score)
    .slice(0, 10);
  localStorage.setItem('star-catcher-leaderboard', JSON.stringify(leaderboard));
  best = leaderboard[0].score;
  localStorage.setItem('star-catcher-best', best);
  bestEl.textContent = String(best).padStart(4, '0');
  renderLeaderboard();
  scoreForm.classList.remove('visible');
  messageText.textContent = '기록이 저장되었습니다. 다시 도전해보세요.';
  startButton.innerHTML = '다시 시작 <span>↗</span>';
  startButton.style.display = '';
  startButton.focus();
}

function update(delta) {
  if (!playing) return;
  timer += delta; spawnTimer += delta;
  timeLeft = Math.max(0, 60 - Math.floor(timer));
  timeEl.textContent = String(timeLeft).padStart(2, '0');
  if (timeLeft === 0) { endGame(); return; }
  if (spawnTimer > .9) { spawnTimer = 0; spawnStar(); }
  if (keys.left) player.targetX -= 420 * delta;
  if (keys.right) player.targetX += 420 * delta;
  player.targetX = Math.max(28, Math.min(width - 28, player.targetX));
  stars.forEach(star => { star.life += delta; });
  stars = stars.filter(star => star.life < star.duration);
}

function draw(delta) {
  drawBackground(delta);
  stars.forEach(drawStar);
  drawParticles(delta);
  drawPlayer();
  requestAnimationFrame(frame);
}

function frame(now) {
  const delta = Math.min((now - lastTime) / 1000 || 0, .05);
  lastTime = now;
  update(delta); draw(delta);
}

canvas.addEventListener('pointermove', event => { player.targetX = pointerPosition(event).x; });
canvas.addEventListener('pointerdown', event => { const point = pointerPosition(event); player.targetX = point.x; collectAt(point.x, point.y); });
startButton.addEventListener('click', startGame);
scoreForm.addEventListener('submit', event => { event.preventDefault(); saveScore(); });
musicToggle.addEventListener('click', () => {
  musicEnabled = !musicEnabled;
  musicToggle.textContent = musicEnabled ? '♫ BGM ON' : '♫ BGM OFF';
  musicToggle.classList.toggle('muted', !musicEnabled);
  musicToggle.setAttribute('aria-pressed', String(musicEnabled));
  if (musicEnabled) startBgm();
  else stopBgm();
});
window.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') keys.left = true;
  if (event.key === 'ArrowRight') keys.right = true;
  if (event.key === ' ' && !playing) startGame();
});
window.addEventListener('keyup', event => {
  if (event.key === 'ArrowLeft') keys.left = false;
  if (event.key === 'ArrowRight') keys.right = false;
});

requestAnimationFrame(frame);
