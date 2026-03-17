const sky = document.getElementById("sky");
const plane = document.getElementById("plane");
const carrier = document.getElementById("carrier");
const planeTrail = document.getElementById("planeTrail");
const boostFlames = document.getElementById("boostFlames");

const balanceEl = document.getElementById("balance");
const betEl = document.getElementById("bet");
const multiplierEl = document.getElementById("multiplier");
const potentialWinEl = document.getElementById("potentialWin");
const statusEl = document.getElementById("status");

const startBtn = document.getElementById("startBtn");
const boostBtn = document.getElementById("boostBtn");
const addCoinsBtn = document.getElementById("addCoinsBtn");
const betPlus = document.getElementById("betPlus");
const betMinus = document.getElementById("betMinus");

const boostProgressFill = document.getElementById("boostProgressFill");
const boostTimerMain = document.getElementById("boostTimerMain");
const boostCooldownSide = document.getElementById("boostCooldownSide");
const boostCostPill = document.getElementById("boostCostPill");

const heightValue = document.getElementById("heightValue");
const distanceValue = document.getElementById("distanceValue");
const fieldMultiplierValue = document.getElementById("fieldMultiplierValue");
const multiplierStat = document.getElementById("multiplierStat");

const BETS = [50, 100, 200, 300, 500, 1000];
const BOOST_COST = 500;
const BOOST_DURATION = 2000;
let betIndex = 1;

let state = {
  balance: 10000,
  running: false,
  multiplier: 1.0,
  displayedMultiplier: 1.0,
  potentialWin: 0,

  planeX: 80,
  planeY: 150,
  velocityY: 0,
  planeAngle: 0,

  distanceMeters: 0,
  heightMeters: 0,

  gameLoop: null,
  spawnLoop: null,
  carrierLoop: null,
  smokeLoop: null,
  boostTrailLoop: null,

  multipliers: [],
  carrierActive: false,

  lastGoodPickupAt: 0,
  gameStartedAt: 0,

  boostActive: false,
  boostEndAt: 0,
  boostUsedThisRound: false,
};

function pulseMultiplier() {
  multiplierStat.classList.remove("pulse");
  void multiplierStat.offsetWidth;
  multiplierStat.classList.add("pulse");
}

function updateDisplayedMultiplier() {
  const speed = 0.12;
  state.displayedMultiplier += (state.multiplier - state.displayedMultiplier) * speed;

  if (Math.abs(state.multiplier - state.displayedMultiplier) < 0.002) {
    state.displayedMultiplier = state.multiplier;
  }
}

function formatMeters(value) {
  return `${value.toFixed(1).replace(".", ",")}m`;
}

function formatFieldMultiplier(value) {
  return `x${value.toFixed(1).replace(".", ",")}`;
}

function updateFlightStats() {
  heightValue.textContent = formatMeters(state.heightMeters);
  distanceValue.textContent = formatMeters(state.distanceMeters);
  fieldMultiplierValue.textContent = formatFieldMultiplier(state.displayedMultiplier);
}

function updateBoostBar() {
  if (!state.running) {
    boostProgressFill.style.width = "100%";
    boostTimerMain.textContent = "2.0s";
    boostCooldownSide.textContent = "ready";
    boostCostPill.textContent = BOOST_COST;
    return;
  }

  if (state.boostActive) {
    const left = Math.max(0, state.boostEndAt - Date.now());
    const progress = Math.max(0, Math.min(1, left / BOOST_DURATION));
    boostProgressFill.style.width = `${progress * 100}%`;
    boostTimerMain.textContent = `${(left / 1000).toFixed(1)}s`;
    boostCooldownSide.textContent = "active";
    boostCostPill.textContent = BOOST_COST;
    return;
  }

  if (state.boostUsedThisRound) {
    boostProgressFill.style.width = "0%";
    boostTimerMain.textContent = "0.0s";
    boostCooldownSide.textContent = "used";
    boostCostPill.textContent = BOOST_COST;
    return;
  }

  boostProgressFill.style.width = "100%";
  boostTimerMain.textContent = "2.0s";
  boostCooldownSide.textContent = "ready";
  boostCostPill.textContent = BOOST_COST;
}

function updateUI() {
  balanceEl.textContent = Math.floor(state.balance);
  betEl.textContent = BETS[betIndex];
  multiplierEl.textContent = "x" + state.multiplier.toFixed(2);
  potentialWinEl.textContent = Math.floor(state.potentialWin);
  updateFlightStats();

  if (!state.running) {
    boostBtn.disabled = true;
    boostBtn.textContent = `Boost (${BOOST_COST})`;
    updateBoostBar();
    return;
  }

  if (state.boostUsedThisRound) {
    boostBtn.disabled = true;
    boostBtn.textContent = "Boost использован";
    updateBoostBar();
    return;
  }

  if (state.balance < BOOST_COST) {
    boostBtn.disabled = true;
    boostBtn.textContent = `Boost (${BOOST_COST})`;
    updateBoostBar();
    return;
  }

  if (state.boostActive) {
    boostBtn.disabled = true;
    boostBtn.textContent = "Boost активен";
    updateBoostBar();
    return;
  }

  boostBtn.disabled = false;
  boostBtn.textContent = `Boost (${BOOST_COST})`;
  updateBoostBar();
}

function setStatus(text) {
  statusEl.textContent = text;
}

function resetPlane() {
  state.planeX = 80;
  state.planeY = 150;
  state.velocityY = 2.7;
  state.planeAngle = -4;
  state.distanceMeters = 0;
  state.heightMeters = 0;
  state.multiplier = 1.0;
  state.displayedMultiplier = 1.0;
  plane.classList.remove("boosting");
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

function clearBoostFlames() {
  boostFlames.innerHTML = "";
}

function spawnSmoke() {
  if (!state.running) return;

  const smoke = document.createElement("div");
  smoke.className = "smoke";
  smoke.style.left = (state.planeX + 10) + "px";
  smoke.style.bottom = (state.planeY + 22) + "px";
  planeTrail.appendChild(smoke);

  setTimeout(() => smoke.remove(), 1200);
}

function spawnBoostFlame() {
  if (!state.running || !state.boostActive) return;

  const flame = document.createElement("div");
  flame.className = "boost-flame";
  flame.style.left = (state.planeX + 10) + "px";
  flame.style.bottom = (state.planeY + 28) + "px";
  boostFlames.appendChild(flame);

  setTimeout(() => flame.remove(), 220);
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
  state.displayedMultiplier = 1.0;
  state.potentialWin = bet;
  state.gameStartedAt = Date.now();
  state.lastGoodPickupAt = Date.now();
  state.boostActive = false;
  state.boostEndAt = 0;
  state.boostUsedThisRound = false;

  resetPlane();
  clearMultiplierItems();
  clearBoostFlames();

  carrier.style.left = "110%";
  state.carrierActive = false;

  startBtn.disabled = true;

  setStatus("Самолёт взлетает");
  updateUI();

  clearInterval(state.spawnLoop);
  clearInterval(state.carrierLoop);
  clearInterval(state.smokeLoop);
  clearInterval(state.boostTrailLoop);
  cancelAnimationFrame(state.gameLoop);

  spawnMultiplier();
  setTimeout(spawnMultiplier, 500);

  state.spawnLoop = setInterval(spawnMultiplier, 850);
  state.carrierLoop = setInterval(maybeSpawnCarrier, 2600);
  state.smokeLoop = setInterval(spawnSmoke, 110);
  state.boostTrailLoop = setInterval(spawnBoostFlame, 45);

  loop();
}

function activateBoost() {
  if (!state.running) {
    setStatus("Сначала начни полёт");
    return;
  }

  if (state.boostUsedThisRound) {
    setStatus("Boost уже использован в этом раунде");
    return;
  }

  if (state.boostActive) {
    setStatus("Boost уже активен");
    return;
  }

  if (state.balance < BOOST_COST) {
    setStatus("Недостаточно монет для Boost");
    return;
  }

  state.balance -= BOOST_COST;
  state.boostActive = true;
  state.boostUsedThisRound = true;
  state.boostEndAt = Date.now() + BOOST_DURATION;

  state.velocityY = Math.max(state.velocityY, 5.2);
  state.planeY += 28;
  state.planeAngle = -18;
  plane.classList.add("boosting");

  updateUI();
  setStatus("Boost активирован");
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
  state.boostActive = false;

  clearInterval(state.spawnLoop);
  clearInterval(state.carrierLoop);
  clearInterval(state.smokeLoop);
  clearInterval(state.boostTrailLoop);
  cancelAnimationFrame(state.gameLoop);

  clearBoostFlames();
  plane.classList.remove("boosting");
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
  const seaLevel = 110;
  const now = Date.now();

  if (state.planeX < 240) {
    state.planeX += 2.4;
  } else if (state.planeX < skyWidth * 0.38) {
    state.planeX += 1.25;
  }

  const msSinceLastPickup = now - state.lastGoodPickupAt;
  const msSinceStart = now - state.gameStartedAt;

  if (state.boostActive && now < state.boostEndAt) {
    state.velocityY += 0.16;

    if (state.planeX < skyWidth * 0.55) {
      state.planeX += 1.55;
    }

    state.planeAngle = -18;
  } else {
    if (state.boostActive && now >= state.boostEndAt) {
      state.boostActive = false;
      plane.classList.remove("boosting");
      setStatus("Boost закончился");
      updateUI();
    }

    if (msSinceStart < 2200) {
      state.velocityY -= 0.01;
    } else if (msSinceLastPickup < 1800) {
      state.velocityY -= 0.014;
    } else if (msSinceLastPickup < 3200) {
      state.velocityY -= 0.05;
    } else {
      state.velocityY -= 0.105;
    }

    if (state.velocityY > 1.4) state.planeAngle = -8;
    else if (state.velocityY > 0.4) state.planeAngle = -3;
    else if (state.velocityY > -0.8) state.planeAngle = 4;
    else state.planeAngle = 13;
  }

  state.planeY += state.velocityY;

  state.heightMeters = Math.max(0, (state.planeY - (seaLevel - 8)) * 0.55);
  state.distanceMeters += 0.62 + (state.boostActive ? 0.45 : 0);

  state.multipliers.forEach((item) => {
    item.x -= 4.3;
    item.el.style.left = item.x + "px";
    item.el.style.bottom = item.y + "px";

    const hit = checkCollision(
      state.planeX + 22,
      state.planeY + 10,
      54,
      34,
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
        pulseMultiplier();
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
      state.planeX + 16,
      state.planeY + 2,
      70,
      36,
      carrierX,
      76,
      420,
      62
    );

    if (planeOnCarrier && state.planeY <= 144 && state.velocityY < 1.2) {
      state.multiplier *= 1.5;
      pulseMultiplier();
      state.potentialWin = BETS[betIndex] * state.multiplier;
      updateUI();
      winGame("Успешная посадка на авианосец");
      return;
    }

    if (carrierX < -460) {
      state.carrierActive = false;
      carrier.style.left = "110%";
    }
  }

  if (state.planeY <= seaLevel - 8) {
    state.planeY = seaLevel - 8;
    state.heightMeters = 0;
    drawPlane();
    updateDisplayedMultiplier();
    updateUI();
    loseGame("Самолёт упал в воду");
    return;
  }

  if (state.planeY > skyHeight - 120) {
    state.planeY = skyHeight - 120;
    state.velocityY = Math.min(state.velocityY, 0.4);
  }

  updateDisplayedMultiplier();
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
boostBtn.addEventListener("click", activateBoost);

resetPlane();
updateUI();