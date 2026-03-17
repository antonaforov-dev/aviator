const sky = document.getElementById("sky");
const plane = document.getElementById("plane");
const carrier = document.getElementById("carrier");
const planeTrail = document.getElementById("planeTrail");

const balanceEl = document.getElementById("balance");
const betEl = document.getElementById("bet");
const multiplierEl = document.getElementById("multiplier");
const potentialWinEl = document.getElementById("potentialWin");
const statusEl = document.getElementById("status");

const startBtn = document.getElementById("startBtn");
const addCoinsBtn = document.getElementById("addCoinsBtn");
const betPlus = document.getElementById("betPlus");
const betMinus = document.getElementById("betMinus");

const BETS = [50, 100, 200, 300, 500, 1000];
let betIndex = 1;

let state = {
  balance: 10000,
  running: false,
  multiplier: 1.0,
  potentialWin: 0,

  planeX: 80,
  planeY: 150,
  velocityY: 0,
  gravity: 0.055,
  planeAngle: 0,

  gameLoop: null,
  spawnLoop: null,
  carrierLoop: null,
  smokeLoop: null,

  multipliers: [],
  carrierActive: false,

  lastGoodPickupAt: 0,
  gameStartedAt: 0,
};

function updateUI() {
  balanceEl.textContent = Math.floor(state.balance);
  betEl.textContent = BETS[betIndex];
  multiplierEl.textContent = "x" + state.multiplier.toFixed(2);
  potentialWinEl.textContent = Math.floor(state.potentialWin);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function resetPlane() {
  state.planeX = 80;
  state.planeY = 150;
  state.velocityY = 2.7;
  state.planeAngle = -4;
  drawPlane();
}

function drawPlane() {
  plane.style.left = state.planeX + "px";
  plane.style.bottom = state.planeY + "px";
  plane.style.transform = `rotate(${state.planeAngle}deg)`;
}

function clearMultiplierItems() {
  document.querySelectorAll(".mult-item").forEach((el) => el.remove());
  state.multipliers = [];
}

function spawnSmoke() {
  if (!state.running) return;

  const smoke = document.createElement("div");
  smoke.className = "smoke";
  smoke.style.left = (state.planeX + 8) + "px";
  smoke.style.bottom = (state.planeY + 18) + "px";
  planeTrail.appendChild(smoke);

  setTimeout(() => smoke.remove(), 1200);
}

function spawnMultiplier() {
  if (!state.running) return;

  const el = document.createElement("div");
  const good = Math.random() < 0.84;
  const values = good ? [1.2, 1.3, 1.5, 2, 3] : [0.8, 0.7];
  const value = values[Math.floor(Math.random() * values.length)];

  el.className = "mult-item" + (value >= 2 ? " big" : "");
  el.textContent = "x" + value;

  const x = sky.clientWidth - 40 + Math.random() * 140;
  const y = 190 + Math.random() * Math.max(80, sky.clientHeight - 360);

  el.style.left = x + "px";
  el.style.bottom = y + "px";
  sky.appendChild(el);

  state.multipliers.push({
    el,
    x,
    y,
    value,
    taken: false,
  });
}

function maybeSpawnCarrier() {
  if (!state.running) return;
  if (state.carrierActive) return;

  if (Math.random() < 0.45) {
    state.carrierActive = true;
    carrier.style.left = sky.clientWidth + 60 + "px";
  }
}

function startGame() {
  const bet = BETS[betIndex];
  if (state.running) return;

  if (state.balance < bet) {
    setStatus("Недостаточно монет");
    return;
  }

  state.balance -= bet;
  state.running = true;
  state.multiplier = 1.0;
  state.potentialWin = bet;
  state.gameStartedAt = Date.now();
  state.lastGoodPickupAt = Date.now();

  resetPlane();
  clearMultiplierItems();
  carrier.style.left = "110%";
  state.carrierActive = false;

  startBtn.disabled = true;

  setStatus("Самолёт взлетает");
  updateUI();

  clearInterval(state.spawnLoop);
  clearInterval(state.carrierLoop);
  clearInterval(state.smokeLoop);
  cancelAnimationFrame(state.gameLoop);

  spawnMultiplier();
  setTimeout(spawnMultiplier, 500);

  state.spawnLoop = setInterval(spawnMultiplier, 850);
  state.carrierLoop = setInterval(maybeSpawnCarrier, 2600);
  state.smokeLoop = setInterval(spawnSmoke, 110);

  loop();
}

function winGame(reason) {
  state.balance += Math.floor(state.potentialWin);
  endGame(reason);
}

function loseGame(reason) {
  endGame(reason);
}

function endGame(reason) {
  state.running = false;

  clearInterval(state.spawnLoop);
  clearInterval(state.carrierLoop);
  clearInterval(state.smokeLoop);
  cancelAnimationFrame(state.gameLoop);

  startBtn.disabled = false;

  setStatus(reason);
  updateUI();
}

function checkCollision(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function loop() {
  if (!state.running) return;

  const skyWidth = sky.clientWidth;
  const skyHeight = sky.clientHeight;
  const seaLevel = 116;
  const now = Date.now();

  if (state.planeX < 240) {
    state.planeX += 2.4;
  } else if (state.planeX < skyWidth * 0.38) {
    state.planeX += 1.25;
  }

  const msSinceLastPickup = now - state.lastGoodPickupAt;
  const msSinceStart = now - state.gameStartedAt;

  if (msSinceStart < 2200) {
    state.velocityY -= 0.01;
  } else if (msSinceLastPickup < 1800) {
    state.velocityY -= 0.014;
  } else if (msSinceLastPickup < 3200) {
    state.velocityY -= 0.05;
  } else {
    state.velocityY -= 0.105;
  }

  state.planeY += state.velocityY;

  if (state.velocityY > 1.4) state.planeAngle = -8;
  else if (state.velocityY > 0.4) state.planeAngle = -3;
  else if (state.velocityY > -0.8) state.planeAngle = 4;
  else state.planeAngle = 13;

  state.multipliers.forEach((item) => {
    item.x -= 4.3;
    item.el.style.left = item.x + "px";
    item.el.style.bottom = item.y + "px";

    const hit = checkCollision(
      state.planeX + 18,
      state.planeY + 8,
      54,
      32,
      item.x,
      item.y,
      70,
      70
    );

    if (!item.taken && hit) {
      item.taken = true;
      item.el.remove();

      if (item.value >= 1) {
        state.multiplier *= item.value;
        state.velocityY = 2.4 + item.value * 0.42;
        state.planeY += 12;
        state.potentialWin = BETS[betIndex] * state.multiplier;
        state.lastGoodPickupAt = Date.now();
        setStatus("Множитель подобран");
      } else {
        state.velocityY -= 1.15;
        setStatus("Плохой множитель");
      }

      updateUI();
    }
  });

  state.multipliers = state.multipliers.filter((item) => {
    if (item.taken) return false;
    if (item.x < -100) {
      item.el.remove();
      return false;
    }
    return true;
  });

  if (state.carrierActive) {
    let carrierX = parseFloat(carrier.style.left);
    if (isNaN(carrierX)) carrierX = skyWidth + 40;

    carrierX -= 3.5;
    carrier.style.left = carrierX + "px";

    const planeOnCarrier = checkCollision(
      state.planeX + 14,
      state.planeY,
      64,
      34,
      carrierX,
      88,
      320,
      54
    );

    if (planeOnCarrier && state.planeY <= 150 && state.velocityY < 1.2) {
      state.potentialWin = BETS[betIndex] * state.multiplier * 1.5;
      updateUI();
      winGame("Успешная посадка на авианосец");
      return;
    }

    if (carrierX < -360) {
      state.carrierActive = false;
      carrier.style.left = "110%";
    }
  }

  if (state.planeY <= seaLevel - 8) {
    state.planeY = seaLevel - 8;
    drawPlane();
    loseGame("Самолёт упал в воду");
    return;
  }

  if (state.planeY > skyHeight - 110) {
    state.planeY = skyHeight - 110;
    state.velocityY = Math.min(state.velocityY, 0.4);
  }

  state.potentialWin = BETS[betIndex] * state.multiplier;
  updateUI();
  drawPlane();

  state.gameLoop = requestAnimationFrame(loop);
}

betPlus.addEventListener("click", () => {
  if (state.running) return;
  if (betIndex < BETS.length - 1) {
    betIndex++;
    updateUI();
  }
});

betMinus.addEventListener("click", () => {
  if (state.running) return;
  if (betIndex > 0) {
    betIndex--;
    updateUI();
  }
});

addCoinsBtn.addEventListener("click", () => {
  state.balance += 1000;
  updateUI();
  setStatus("+1000 монет добавлено");
});

startBtn.addEventListener("click", startGame);

resetPlane();
updateUI();