const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scale = 20;
const rows = canvas.height / scale;
const columns = canvas.width / scale;

const FIELD_COLOR = "#76ABAE";
const APPLE_COLOR = "#FF5722";
const ELEMENT_WIDTH = scale * 0.7; // snake line thickness and apple size, kept equal
const GAME_OVER_TITLE_COLOR = "#F5F5F5";
const GAME_OVER_SCORE_COLOR = "#B8431D";
const GAME_OVER_TEXT_COLOR = "#303841";

// --- Snake color: cycles through hue "tiers" as it eats. Within a tier it
// darkens toward that tier's floor color; after enough apples it jumps to
// the next tier's (brighter) start color and darkens again from there. ---
const SNAKE_TIERS = [
  { start: "#6E8090", floor: "#28344A" }, // blue-grey -> dark navy
  { start: "#7C6F99", floor: "#423A5C" }, // soft purple -> dark plum
  { start: "#9C8478", floor: "#5A4750" }, // warm mauve -> dark taupe-plum
];
const APPLES_PER_TIER = 8;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  const d = max - min;
  if (d === 0) { h = 0; s = 0; }
  else {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = 60 * (((g - b) / d) % 6); break;
      case g: h = 60 * ((b - r) / d + 2); break;
      case b: h = 60 * ((r - g) / d + 4); break;
    }
  }
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getSnakeColor(score) {
  if (score <= 0) {
    const s0 = hexToHsl(SNAKE_TIERS[0].start);
    return hslToHex(s0.h, s0.s, s0.l);
  }
  const tierIndex = Math.min(
    Math.floor((score - 1) / APPLES_PER_TIER),
    SNAKE_TIERS.length - 1
  );
  const rawWithin = score - 1 - tierIndex * APPLES_PER_TIER;
  const withinTier = Math.min(rawWithin, APPLES_PER_TIER - 1);
  const t = withinTier / (APPLES_PER_TIER - 1);

  const startHsl = hexToHsl(SNAKE_TIERS[tierIndex].start);
  const floorHsl = hexToHsl(SNAKE_TIERS[tierIndex].floor);
  const h = lerp(startHsl.h, floorHsl.h, t);
  const s = lerp(startHsl.s, floorHsl.s, t);
  const l = lerp(startHsl.l, floorHsl.l, t);
  return hslToHex(h, s, l);
}

let snakeColor = getSnakeColor(0);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playEatSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(440, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.15);
}

function playGameOverSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.5);
}

class Snake {
  constructor() {
    this.x = scale * 2;
    this.y = 0;
    this.xSpeed = scale;
    this.ySpeed = 0;
    this.total = 2;
    this.tail = [
      { x: 0, y: 0 },
      { x: scale, y: 0 },
    ];
  }

  // Draws the whole body (tail + head) as one continuous stroked line
  // instead of separate filled blocks.
  draw() {
    const half = scale / 2;
    ctx.lineWidth = ELEMENT_WIDTH;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    ctx.strokeStyle = snakeColor;

    if (this.tail.length === 0) {
      // Zero-length path draws nothing with butt caps, so fall back to a single square.
      ctx.fillStyle = snakeColor;
      ctx.fillRect(
        this.x + (scale - ELEMENT_WIDTH) / 2,
        this.y + (scale - ELEMENT_WIDTH) / 2,
        ELEMENT_WIDTH,
        ELEMENT_WIDTH
      );
      return;
    }

    ctx.beginPath();
    {
      ctx.moveTo(this.tail[0].x + half, this.tail[0].y + half);
      for (let i = 1; i < this.tail.length; i++) {
        ctx.lineTo(this.tail[i].x + half, this.tail[i].y + half);
      }
      ctx.lineTo(this.x + half, this.y + half);
    }
    ctx.stroke();
  }

  update() {
    for (let i = 0; i < this.tail.length - 1; i++) {
      this.tail[i] = this.tail[i + 1];
    }
    if (this.total > 0) {
      this.tail[this.total - 1] = { x: this.x, y: this.y };
    }
    this.x += this.xSpeed;
    this.y += this.ySpeed;
  }

  hitWall() {
    return (
      this.x < 0 ||
      this.x >= canvas.width ||
      this.y < 0 ||
      this.y >= canvas.height
    );
  }

  changeDirection(direction) {
    switch (direction) {
      case "Up":
        if (this.ySpeed !== scale) { this.xSpeed = 0; this.ySpeed = -scale; }
        break;
      case "Down":
        if (this.ySpeed !== -scale) { this.xSpeed = 0; this.ySpeed = scale; }
        break;
      case "Left":
        if (this.xSpeed !== scale) { this.xSpeed = -scale; this.ySpeed = 0; }
        break;
      case "Right":
        if (this.xSpeed !== -scale) { this.xSpeed = scale; this.ySpeed = 0; }
        break;
    }
  }

  eat(fruit) {
    if (this.x === fruit.x && this.y === fruit.y) {
      this.total++;
      return true;
    }
    return false;
  }

  checkCollision() {
    for (let i = 0; i < this.tail.length; i++) {
      if (this.x === this.tail[i].x && this.y === this.tail[i].y) {
        return true;
      }
    }
    return false;
  }
}

class Fruit {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  pickLocation() {
    this.x = Math.floor(Math.random() * columns) * scale;
    this.y = Math.floor(Math.random() * rows) * scale;
  }

  draw() {
    ctx.fillStyle = APPLE_COLOR;
    ctx.fillRect(
      this.x + (scale - ELEMENT_WIDTH) / 2,
      this.y + (scale - ELEMENT_WIDTH) / 2,
      ELEMENT_WIDTH,
      ELEMENT_WIDTH
    );
  }
}

let snake = new Snake();
let fruit = new Fruit();
fruit.pickLocation();
let gameOver = false;
let score = 0;

const BASE_INTERVAL = 200;
const MIN_INTERVAL = 50;
const SPEED_INCREMENT = 8;
let gameInterval = BASE_INTERVAL;
let loopTimeout = null;

const scoreDisplay = document.getElementById("scoreDisplay");

function updateScoreDisplay() {
  scoreDisplay.textContent = `${score}`;
}

function drawGameOver() {
  ctx.fillStyle = "rgba(118, 171, 174, 0.85)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = GAME_OVER_TITLE_COLOR;
  ctx.font = "44px 'Courier New', monospace";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillStyle = GAME_OVER_SCORE_COLOR;
  ctx.font = "22px 'Courier New', monospace";
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 26);
  ctx.fillStyle = GAME_OVER_TEXT_COLOR;
  ctx.font = "15px 'Courier New', monospace";
  ctx.fillText("Press Space or tap Restart", canvas.width / 2, canvas.height / 2 + 60);
}

const restartBtn = document.getElementById("restartBtn");

function restartGame() {
  clearTimeout(loopTimeout);
  snake = new Snake();
  fruit = new Fruit();
  fruit.pickLocation();
  gameOver = false;
  score = 0;
  gameInterval = BASE_INTERVAL;
  snakeColor = getSnakeColor(0);
  updateScoreDisplay();
  restartBtn.style.display = "none";
  gameLoop();
}

function gameLoop() {
  if (!gameOver) {
    ctx.fillStyle = FIELD_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    fruit.draw();
    snake.update();

    if (snake.hitWall()) {
      gameOver = true;
      playGameOverSound();
      drawGameOver();
      restartBtn.style.display = "inline-block";
      loopTimeout = setTimeout(gameLoop, gameInterval);
      return;
    }

    snake.draw();

    if (snake.eat(fruit)) {
      playEatSound();
      fruit.pickLocation();
      score++;
      gameInterval = Math.max(MIN_INTERVAL, gameInterval - SPEED_INCREMENT);
      snakeColor = getSnakeColor(score);
      updateScoreDisplay();
    }

    if (snake.checkCollision()) {
      gameOver = true;
      playGameOverSound();
      drawGameOver();
      restartBtn.style.display = "inline-block";
    }
  }
  loopTimeout = setTimeout(gameLoop, gameInterval);
}

function drawInitialFrame() {
  ctx.fillStyle = FIELD_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  fruit.draw();
  snake.draw();
  updateScoreDisplay();
}

drawInitialFrame();

const playBtn = document.getElementById("playBtn");
playBtn.addEventListener("click", () => {
  playBtn.style.display = "none";
  playBtn.blur();
  gameLoop();
});

restartBtn.addEventListener("click", () => {
  restartBtn.blur();
  if (gameOver) restartGame();
});

window.addEventListener("keydown", (e) => {
  const isGameKey =
    e.key === " " || e.key.startsWith("Arrow");
  if (isGameKey) e.preventDefault();

  if (e.key === " " && gameOver) {
    restartGame();
    return;
  }
  const direction = e.key.replace("Arrow", "");
  snake.changeDirection(direction);
});
