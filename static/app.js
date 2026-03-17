const tg = window.Telegram?.WebApp || null;
if (tg) {
  try { tg.ready(); tg.expand(); } catch (e) {}
}

const sky = document.getElementById("sky");
const plane = document.getElementById("plane");
const carrier = document.getElementById("carrier");
const planeTrail = document.getElementById("planeTrail");
const boostFlames = document.getElementById("boostFlames");
const weatherLayer = document.getElementById("weatherLayer");
const turboIndicator = document.getElementById("turboIndicator");

const balanceEl = document.getElementById("balance");
const betEl = document.getElementById("bet");
const multiplierEl = document.getElementById("multiplier");
const potentialWinEl = document.getElementById("potentialWin");
const statusEl = document.getElementById("status");
const weatherValueEl = document.getElementById("weatherValue");

const startBtn = document.getElementById("startBtn");
const boostBtn = document.getElementById("boostBtn");
const turboBtn = document.getElementById("turboBtn");
const weatherBtn = document.getElementById("weatherBtn");
const soundBtn = document.getElementById("soundBtn");
const betPlus = document.getElementById("betPlus");
const betMinus = document.getElementById("betMinus");
const promoInput = document.getElementById("promoInput");
const promoBtn = document.getElementById("promoBtn");

const boostProgressFill = document.getElementById("boostProgressFill");
const boostTimerMain = document.getElementById("boostTimerMain");
const boostCooldownSide = document.getElementById("boostCooldownSide");
const boostCostPill = document.getElementById("boostCostPill");

const heightValue = document.getElementById("heightValue");
const distanceValue = document.getElementById("distanceValue");
const fieldMultiplierValue = document.getElementById("fieldMultiplierValue");
const multiplierStat = document.getElementById("multiplierStat");

const planeShop = document.getElementById("planeShop");
const carrierShop = document.getElementById("carrierShop");
const trailShop = document.getElementById("trailShop");
const achievementsList = document.getElementById("achievementsList");
const historyList = document.getElementById("historyList");
const boostPanelGrid = document.getElementById("boostPanelGrid");
const toastEl = document.getElementById("toast");

const BET_MIN = 100;
const BET_MAX = 15000;
const BET_STEP = 100;
const WEATHER_MODES = ["clear", "rain", "fog", "storm", "sunset"];
const BOOST_DURATION = {
  boost_lift: 2000,
  boost_turbo: 2600,
  boost_shield: 2500,
  boost_magnet: 3200,
};

let currentBet = 100;
let shop = null;
let achievements = [];
let ownedItems = [];
let unlockedAchievements = [];
let soundEnabled = true;
let audioCtx = null;

let state = {
  userKey: null,
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
  displayedDistance: 0,
  heightMeters: 0,
  displayedHeight: 0,
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
  boostsUsedThisRound: {},
  collectedThisRound: 0,
  weather: "clear",
  turboMode: false,
  currentBoost: "boost_lift",
  boostPower: 5.2,
  shieldEndAt: 0,
  magnetEndAt: 0,
  selectedPlaneSkin: "plane_classic",
  selectedCarrierSkin: "carrier_standard",
  selectedTrailSkin: "trail_smoke",
};

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2000);
}

function getUserKey() {
  const telegramId = tg?.initDataUnsafe?.user?.id;
  if (telegramId) return `tg_${telegramId}`;
  let demoKey = localStorage.getItem("avitor_demo_user_key");
  if (!demoKey) {
    demoKey = `demo_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem("avitor_demo_user_key", demoKey);
  }
  return demoKey;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw data;
  return data;
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function beep(freq = 440, duration = 0.08, type = "sine", gainValue = 0.03) {
  if (!soundEnabled) return;
  try {
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function soundPickup() { beep(740, 0.09, "triangle", 0.035); setTimeout(() => beep(980, 0.09, "triangle", 0.03), 70); }
function soundLose() { beep(220, 0.14, "sawtooth", 0.04); setTimeout(() => beep(160, 0.18, "sawtooth", 0.035), 90); }
function soundWin() { beep(660, 0.08, "square", 0.03); setTimeout(() => beep(880, 0.11, "square", 0.03), 70); setTimeout(() => beep(1100, 0.14, "square", 0.028), 140); }
function soundBoost() { beep(520, 0.07, "sawtooth", 0.04); setTimeout(() => beep(640, 0.07, "sawtooth", 0.04), 55); setTimeout(() => beep(760, 0.07, "sawtooth", 0.035), 110); }

function pulseMultiplier() {
  multiplierStat.classList.remove("pulse");
  void multiplierStat.offsetWidth;
  multiplierStat.classList.add("pulse");
}

function updateDisplayedValues() {
  state.displayedMultiplier += (state.multiplier - state.displayedMultiplier) * 0.12;
  state.displayedDistance += (state.distanceMeters - state.displayedDistance) * 0.18;
  state.displayedHeight += (state.heightMeters - state.displayedHeight) * 0.18;

  if (Math.abs(state.multiplier - state.displayedMultiplier) < 0.002) state.displayedMultiplier = state.multiplier;
  if (Math.abs(state.distanceMeters - state.displayedDistance) < 0.04) state.displayedDistance = state.distanceMeters;
  if (Math.abs(state.heightMeters - state.displayedHeight) < 0.04) state.displayedHeight = state.heightMeters;
}

function formatMeters(v) { return `${v.toFixed(1).replace(".", ",")}m`; }
function formatMult(v) { return `x${v.toFixed(1).replace(".", ",")}`; }
function formatMoney(v) { return new Intl.NumberFormat("ru-RU").format(Math.floor(v)); }

function setStatus(text) { statusEl.textContent = text; }

function updateWeatherVisual() {
  weatherLayer.className = "weather-layer";
  if (state.weather !== "clear") weatherLayer.classList.add(`weather-${state.weather}`);
  weatherValueEl.textContent = state.weather;
}

function cycleWeather() {
  const idx = WEATHER_MODES.indexOf(state.weather);
  state.weather = WEATHER_MODES[(idx + 1) % WEATHER_MODES.length];
  updateWeatherVisual();
  showToast(`Погода: ${state.weather}`);
}

function skinClassFromId(prefix, id) {
  return id.startsWith(prefix + "_") ? `skin-${id.replaceAll("_", "-")}` : id;
}

function trailClassFromId(id) {
  return id.replaceAll("_", "-");
}

function applySelectedSkins() {
  plane.className = `plane ${skinClassFromId("plane", state.selectedPlaneSkin)}`.trim();
  carrier.className = `carrier ${skinClassFromId("carrier", state.selectedCarrierSkin)}`.trim();
  planeTrail.className = `plane-trail ${trailClassFromId(state.selectedTrailSkin)}`.trim();
}

function updateBoostPanel() {
  if (!shop) return;
  boostPanelGrid.innerHTML = "";
  for (const boost of shop.boosts) {
    const div = document.createElement("div");
    div.className = "boost-chip";
    div.innerHTML = `
      <div class="boost-chip-head">
        <span>${boost.name}</span>
        <span>${formatMoney(boost.price)}</span>
      </div>
      <div class="boost-chip-sub">${(boost.duration / 1000).toFixed(1)}s</div>
    `;
    div.addEventListener("click", () => {
      state.currentBoost = boost.id;
      state.boostPower = boost.velocity;
      boostCostPill.textContent = boost.price;
      boostBtn.textContent = `${boost.name} (${boost.price})`;
      showToast(`Выбран буст: ${boost.name}`);
    });
    boostPanelGrid.appendChild(div);
  }
}

function renderShopCategory(container, items, selectedId) {
  container.innerHTML = "";
  for (const item of items) {
    const owned = ownedItems.includes(item.id);
    const equipped = selectedId === item.id;
    const div = document.createElement("div");
    div.className = "shop-item";
    div.innerHTML = `
      <div class="shop-item-top">
        <div>
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-price">${formatMoney(item.price)}</div>
        </div>
      </div>
      ${owned ? `<div class="owned-badge">${equipped ? "Экипировано" : "Куплено"}</div>` : ""}
      <div class="shop-preview">${item.id}</div>
      <div class="shop-item-actions">
        ${!owned ? `<button class="small-action buy-btn">Купить</button>` :
          equipped ? `<button class="small-action equipped-btn">Надето</button>` :
          `<button class="small-action equip-btn">Надеть</button>`
        }
      </div>
    `;
    const btn = div.querySelector(".small-action");
    btn.addEventListener("click", async () => {
      try {
        if (!owned) {
          const data = await postJson("/api/buy-item", { user_key: state.userKey, item_id: item.id });
          state.balance = data.balance;
          ownedItems = data.owned_items;
          if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
          showToast(`Куплено: ${item.name}`);
          beep(620, 0.08, "triangle", 0.03);
        } else if (!equipped) {
          const data = await postJson("/api/equip-item", { user_key: state.userKey, item_id: item.id });
          applyUserPayload(data.user);
          showToast(`Надето: ${item.name}`);
          beep(760, 0.07, "triangle", 0.03);
        }
        renderAll();
      } catch (err) {
        showToast(err.error === "insufficient_balance" ? "Недостаточно монет" : "Ошибка");
      }
    });
    container.appendChild(div);
  }
}

function renderAchievements() {
  achievementsList.innerHTML = "";
  for (const ach of achievements) {
    const unlocked = unlockedAchievements.includes(ach.id);
    const div = document.createElement("div");
    div.className = `ach-item ${unlocked ? "unlocked" : ""}`;
    div.innerHTML = `
      <div class="ach-title">${ach.name} <span class="ach-state">${unlocked ? "Открыто" : "Закрыто"}</span></div>
      <div class="ach-desc">${ach.description}</div>
      <div class="ach-reward">Награда: ${formatMoney(ach.reward)}</div>
    `;
    achievementsList.appendChild(div);
  }
}

function renderHistory(history) {
  historyList.innerHTML = "";
  if (!history.length) {
    historyList.innerHTML = `<div class="history-item"><div class="history-title">История пуста</div></div>`;
    return;
  }
  for (const row of history) {
    const div = document.createElement("div");
    div.className = `history-item ${row.result === "lose" ? "lose" : "win"}`;
    div.innerHTML = `
      <div class="history-title">${row.result === "lose" ? "ПРОИГРЫШ" : row.result === "carrier" ? "ПОСАДКА НА АВИАНОСЕЦ" : "ПОБЕДА"} — ${formatMoney(row.payout)}</div>
      <div class="history-desc">
        Ставка: ${formatMoney(row.bet)} · Множитель: x${row.multiplier.toFixed(2)} ·
        Дистанция: ${row.distance.toFixed(1)}м · Высота: ${row.height.toFixed(1)}м ·
        Погода: ${row.weather}${row.turbo_mode ? " · TURBO" : ""}
      </div>
    `;
    historyList.appendChild(div);
  }
}

function renderAll(history = null) {
  updateUI();
  applySelectedSkins();
  if (shop) {
    renderShopCategory(planeShop, shop.plane_skins, state.selectedPlaneSkin);
    renderShopCategory(carrierShop, shop.carrier_skins, state.selectedCarrierSkin);
    renderShopCategory(trailShop, shop.trail_skins, state.selectedTrailSkin);
    updateBoostPanel();
  }
  renderAchievements();
  if (history) renderHistory(history);
}

function handleNewAchievements(list) {
  if (!list || !list.length) return;
  for (const ach of list) {
    if (!unlockedAchievements.includes(ach.id)) unlockedAchievements.push(ach.id);
    showToast(`Достижение: ${ach.name} (+${formatMoney(ach.reward)})`);
  }
  renderAchievements();
  updateUI();
}

function applyUserPayload(user) {
  state.balance = user.balance;
  state.selectedPlaneSkin = user.selected_plane_skin;
  state.selectedCarrierSkin = user.selected_carrier_skin;
  state.selectedTrailSkin = user.selected_trail_skin;
  if (user.stats?.best_multiplier) {
    // сохраняем актуальное состояние достижений через данные сервера
  }
  applySelectedSkins();
}

function updateBoostButton() {
  const current = shop?.boosts?.find(b => b.id === state.currentBoost);
  const cost = current?.price ?? 500;
  boostCostPill.textContent = cost;

  if (!state.running) {
    boostBtn.disabled = true;
    boostBtn.textContent = `${current?.name ?? "Boost"} (${cost})`;
    return;
  }

  const alreadyUsed = !!state.boostsUsedThisRound[state.currentBoost];
  if (alreadyUsed) {
    boostBtn.disabled = true;
    boostBtn.textContent = "Уже использован";
    return;
  }

  if (state.balance < cost) {
    boostBtn.disabled = true;
    boostBtn.textContent = `${current?.name ?? "Boost"} (${cost})`;
    return;
  }

  if (state.boostActive) {
    boostBtn.disabled = true;
    boostBtn.textContent = "Активен";
    return;
  }

  boostBtn.disabled = false;
  boostBtn.textContent = `${current?.name ?? "Boost"} (${cost})`;
}

function updateBoostBar() {
  const current = shop?.boosts?.find(b => b.id === state.currentBoost);
  const duration = current?.duration ?? 2000;

  if (!state.running) {
    boostProgressFill.style.width = "100%";
    boostTimerMain.textContent = `${(duration / 1000).toFixed(1)}s`;
    boostCooldownSide.textContent = "ready";
    return;
  }

  if (state.boostActive) {
    const left = Math.max(0, state.boostEndAt - Date.now());
    const progress = Math.max(0, Math.min(1, left / duration));
    boostProgressFill.style.width = `${progress * 100}%`;
    boostTimerMain.textContent = `${(left / 1000).toFixed(1)}s`;
    boostCooldownSide.textContent = "active";
    return;
  }

  if (state.boostsUsedThisRound[state.currentBoost]) {
    boostProgressFill.style.width = "0%";
    boostTimerMain.textContent = "0.0s";
    boostCooldownSide.textContent = "used";
    return;
  }

  boostProgressFill.style.width = "100%";
  boostTimerMain.textContent = `${(duration / 1000).toFixed(1)}s`;
  boostCooldownSide.textContent = "ready";
}

function updateUI() {
  balanceEl.textContent = formatMoney(state.balance);
  betEl.textContent = currentBet;
  multiplierEl.textContent = "x" + state.multiplier.toFixed(2);
  potentialWinEl.textContent = formatMoney(state.potentialWin);
  weatherValueEl.textContent = state.weather;
  heightValue.textContent = `${state.displayedHeight.toFixed(1).replace(".", ",")}m`;
  distanceValue.textContent = `${state.displayedDistance.toFixed(1).replace(".", ",")}m`;
  fieldMultiplierValue.textContent = `x${state.displayedMultiplier.toFixed(1).replace(".", ",")}`;
  updateBoostButton();
  updateBoostBar();
  turboIndicator.classList.toggle("active", state.turboMode);
  soundBtn.textContent = `Звук: ${soundEnabled ? "ON" : "OFF"}`;
}

function drawPlane() {
  plane.style.left = `${state.planeX}px`;
  plane.style.bottom = `${state.planeY}px`;
  plane.style.transform = `rotate(${state.planeAngle}deg)`;
}

function resetPlane() {
  state.planeX = 80;
  state.planeY = 150;
  state.velocityY = 2.7;
  state.planeAngle = -4;
  state.distanceMeters = 0;
  state.displayedDistance = 0;
  state.heightMeters = 0;
  state.displayedHeight = 0;
  state.multiplier = 1.0;
  state.displayedMultiplier = 1.0;
  state.collectedThisRound = 0;
  plane.classList.remove("boosting");
  drawPlane();
}

function clearMultiplierItems() {
  document.querySelectorAll(".mult-item").forEach((el) => el.remove());
  state.multipliers = [];
}

function clearBoostFlames() { boostFlames.innerHTML = ""; }

function spawnSmoke() {
  if (!state.running) return;
  const smoke = document.createElement("div");
  smoke.className = "smoke";
  smoke.style.left = `${state.planeX + 10}px`;
  smoke.style.bottom = `${state.planeY + 22}px`;
  planeTrail.appendChild(smoke);
  setTimeout(() => smoke.remove(), 1200);
}

function spawnBoostFlame() {
  if (!state.running || !state.boostActive) return;
  const flame = document.createElement("div");
  flame.className = "boost-flame";
  flame.style.left = `${state.planeX + 10}px`;
  flame.style.bottom = `${state.planeY + 28}px`;
  boostFlames.appendChild(flame);
  setTimeout(() => flame.remove(), 220);
}

function spawnMultiplier() {
  if (!state.running) return;
  const el = document.createElement("div");
  const good = Math.random() < (state.weather === "storm" ? 0.76 : 0.86);
  const values = good ? [1.2, 1.3, 1.5, 2, 3, ...(state.turboMode ? [5] : [])] : [0.8, 0.7];
  const value = values[Math.floor(Math.random() * values.length)];
  el.className = "mult-item" + (value >= 2 ? " big" : "");
  el.textContent = "x" + value;
  const x = sky.clientWidth - 40 + Math.random() * 140;
  const y = 170 + Math.random() * Math.max(80, sky.clientHeight - 330);
  el.style.left = `${x}px`;
  el.style.bottom = `${y}px`;
  sky.appendChild(el);
  state.multipliers.push({ el, x, y, value, taken: false });
}

function maybeSpawnCarrier() {
  if (!state.running || state.carrierActive) return;
  const chance = state.turboMode ? 0.25 : 0.45;
  if (Math.random() < chance) {
    state.carrierActive = true;
    carrier.style.left = `${sky.clientWidth + 60}px`;
  }
}

async function syncBalance() {
  try {
    const data = await postJson("/api/save-balance", { user_key: state.userKey, balance: Math.floor(state.balance) });
    state.balance = data.balance;
    if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
  } catch (e) {}
}

async function startGame() {
  const bet = currentBet;
  if (state.running) return;
  if (state.balance < bet) {
    setStatus("Недостаточно монет");
    return;
  }

  state.balance -= bet;
  await syncBalance();

  state.running = true;
  state.multiplier = 1.0;
  state.displayedMultiplier = 1.0;
  state.potentialWin = bet;
  state.gameStartedAt = Date.now();
  state.lastGoodPickupAt = Date.now();
  state.boostActive = false;
  state.boostEndAt = 0;
  state.boostsUsedThisRound = {};
  state.shieldEndAt = 0;
  state.magnetEndAt = 0;

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
  state.spawnLoop = setInterval(spawnMultiplier, state.turboMode ? 650 : 850);
  state.carrierLoop = setInterval(maybeSpawnCarrier, state.turboMode ? 1900 : 2600);
  state.smokeLoop = setInterval(spawnSmoke, 110);
  state.boostTrailLoop = setInterval(spawnBoostFlame, 45);
  loop();
}

async function activateBoost() {
  if (!state.running) {
    setStatus("Сначала начни полёт");
    return;
  }
  const current = shop.boosts.find(b => b.id === state.currentBoost);
  if (!current) return;
  if (state.boostsUsedThisRound[state.currentBoost]) {
    setStatus("Этот буст уже использован в раунде");
    return;
  }
  if (state.balance < current.price) {
    setStatus("Недостаточно монет для буста");
    return;
  }
  if (state.boostActive) {
    setStatus("Уже активен другой буст");
    return;
  }

  state.balance -= current.price;
  await syncBalance();
  state.boostsUsedThisRound[state.currentBoost] = true;
  state.boostActive = true;
  state.boostEndAt = Date.now() + current.duration;
  state.velocityY = Math.max(state.velocityY, current.velocity);
  state.planeY += current.id === "boost_lift" ? 60 : 38;
  state.velocityY = Math.max(state.velocityY, current.velocity + (current.id === "boost_lift" ? 1.2 : 0.6));
  state.planeAngle = current.angle;
  plane.classList.add("boosting");
  planeTrail.classList.add("boost-trail-active");

  if (state.currentBoost === "boost_shield") state.shieldEndAt = Date.now() + current.duration;
  if (state.currentBoost === "boost_magnet") state.magnetEndAt = Date.now() + current.duration;

  soundBoost();
  setStatus(`${current.name} активирован`);
  updateUI();
}

async function finishRound(result) {
  const payload = {
    user_key: state.userKey,
    result,
    bet: currentBet,
    payout: result === "lose" ? 0 : Math.floor(state.potentialWin),
    multiplier: state.multiplier,
    distance: state.distanceMeters,
    height: state.heightMeters,
    collected: state.collectedThisRound,
    weather: state.weather,
    turbo_mode: state.turboMode,
    boosts_used: Object.keys(state.boostsUsedThisRound).length,
  };
  try {
    const data = await postJson("/api/record-round", payload);
    applyUserPayload(data.user);
    unlockedAchievements = data.unlocked_achievements || unlockedAchievements;
    renderHistory(data.history || []);
    if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
    renderAll();
  } catch (e) {}
}

async function winGame(reason) {
  state.balance += Math.floor(state.potentialWin);
  await syncBalance();
  soundWin();
  await finishRound(reason.includes("авианосец") ? "carrier" : "win");
  endGame(reason);
}

async function loseGame(reason) {
  soundLose();
  await finishRound("lose");
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
  planeTrail.classList.remove("boost-trail-active");
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

  if (state.planeX < 240) state.planeX += state.turboMode ? 3.4 : 2.4;
  else if (state.planeX < skyWidth * (state.turboMode ? 0.5 : 0.38)) state.planeX += state.turboMode ? 1.8 : 1.25;

  const msSinceLastPickup = now - state.lastGoodPickupAt;
  const weatherGravity = state.weather === "storm" ? 0.02 : state.weather === "rain" ? 0.01 : 0;
  const weatherDistanceBonus = state.weather === "sunset" ? 0.08 : 0;

  if (state.boostActive && now < state.boostEndAt) {
    const current = shop.boosts.find(b => b.id === state.currentBoost);
    state.velocityY += current.id === "boost_turbo" ? 0.10 : current.id === "boost_lift" ? 0.16 : 0.07;
    if (current.id === "boost_turbo" && state.planeX < skyWidth * 0.7) state.planeX += 2.2;
    if (current.id === "boost_lift" && state.planeX < skyWidth * 0.55) state.planeX += 1.2;
    state.planeAngle = current.angle;
  } else {
    if (state.boostActive && now >= state.boostEndAt) {
      state.boostActive = false;
      plane.classList.remove("boosting");
      planeTrail.classList.remove("boost-trail-active");
      setStatus("Буст закончился");
      updateUI();
    }

    if (now < state.shieldEndAt) {
      state.velocityY -= 0.004 + weatherGravity * 0.4;
    } else if (msSinceLastPickup < 1800) {
      state.velocityY -= 0.014 + weatherGravity;
    } else if (msSinceLastPickup < 3200) {
      state.velocityY -= 0.05 + weatherGravity;
    } else {
      state.velocityY -= 0.105 + weatherGravity;
    }

    if (state.velocityY > 1.4) state.planeAngle = -8;
    else if (state.velocityY > 0.4) state.planeAngle = -3;
    else if (state.velocityY > -0.8) state.planeAngle = 4;
    else state.planeAngle = 13;
  }

  state.planeY += state.velocityY;
  state.heightMeters = Math.max(0, (state.planeY - (seaLevel - 8)) * 0.55);
  state.distanceMeters += (state.turboMode ? 1.08 : 0.62) + (state.boostActive ? 0.45 : 0) + weatherDistanceBonus;

  for (const item of state.multipliers) {
    item.x -= state.turboMode ? 5.6 : 4.3;
    item.el.style.left = `${item.x}px`;
    item.el.style.bottom = `${item.y}px`;

    let targetX = state.planeX + 22;
    let targetY = state.planeY + 10;
    if (now < state.magnetEndAt && item.value >= 1) {
      if (item.x < state.planeX + 200) item.x -= 1.8;
      if (item.y > state.planeY + 20) item.y -= 1.0;
      if (item.y < state.planeY - 20) item.y += 1.0;
      item.el.style.left = `${item.x}px`;
      item.el.style.bottom = `${item.y}px`;
    }

    const hit = checkCollision(targetX, targetY, 54, 34, item.x, item.y, 70, 70);

    if (!item.taken && hit) {
      item.taken = true;
      item.el.remove();

      if (item.value >= 1) {
        state.multiplier *= item.value;
        state.collectedThisRound += 1;
        pulseMultiplier();
        soundPickup();
        state.velocityY = 2.4 + item.value * 0.42;
        state.planeY += 12;
        state.potentialWin = currentBet * state.multiplier;
        state.lastGoodPickupAt = Date.now();
        setStatus("Множитель подобран");
      } else {
        state.velocityY -= 1.15;
        setStatus("Плохой множитель");
      }
      updateUI();
    }
  }

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

    carrierX -= state.turboMode ? 4.2 : 3.5;
    carrier.style.left = `${carrierX}px`;

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
      state.potentialWin = currentBet * state.multiplier;
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
    if (now < state.shieldEndAt) {
      state.planeY = seaLevel + 30;
      state.velocityY = 2.2;
      state.shieldEndAt = 0;
      setStatus("Shield спас самолёт");
      showToast("Shield спас самолёт");
    } else {
      state.planeY = seaLevel - 8;
      state.heightMeters = 0;
      drawPlane();
      updateDisplayedValues();
      updateUI();
      loseGame("Самолёт упал в воду");
      return;
    }
  }

  if (state.planeY > skyHeight - 120) {
    state.planeY = skyHeight - 120;
    state.velocityY = Math.min(state.velocityY, 0.4);
  }

  updateDisplayedValues();
  state.potentialWin = currentBet * state.multiplier;
  updateUI();
  drawPlane();
  state.gameLoop = requestAnimationFrame(loop);
}

promoBtn.addEventListener("click", async () => {
  const code = promoInput.value.trim().toUpperCase();
  if (!code) {
    setStatus("Введите промокод");
    return;
  }
  promoBtn.disabled = true;
  try {
    const data = await postJson("/api/redeem-promocode", { user_key: state.userKey, code });
    state.balance = data.balance;
    promoInput.value = "";
    updateUI();
    if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
    showToast(`Промокод ${data.code}: +${formatMoney(data.reward)}`);
    beep(860, 0.1, "triangle", 0.04);
    setStatus(`Промокод ${data.code} активирован`);
  } catch (err) {
    setStatus(err.error === "already_used" ? "Этот промокод уже использован" : "Неверный промокод");
    showToast(err.error === "already_used" ? "Промокод уже использован" : "Неверный промокод");
  } finally {
    promoBtn.disabled = false;
  }
});

promoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    promoBtn.click();
  }
});

betPlus.addEventListener("click", () => {
  if (state.running) return;
  currentBet = Math.min(BET_MAX, currentBet + BET_STEP);
  updateUI();
});
betMinus.addEventListener("click", () => {
  if (state.running) return;
  currentBet = Math.max(BET_MIN, currentBet - BET_STEP);
  updateUI();
});

startBtn.addEventListener("click", startGame);
boostBtn.addEventListener("click", activateBoost);

turboBtn.addEventListener("click", () => {
  if (state.running) {
    setStatus("Turbo можно переключать только до старта");
    return;
  }
  state.turboMode = !state.turboMode;
  turboBtn.textContent = state.turboMode ? "Turbo: ON" : "Turbo";
  showToast(state.turboMode ? "Turbo режим включён" : "Turbo режим выключен");
  updateUI();
});

weatherBtn.addEventListener("click", () => cycleWeather());

soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  updateUI();
});

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

function resetVisuals() {
  plane.classList.remove("boosting");
  planeTrail.className = "plane-trail";
  applySelectedSkins();
  updateWeatherVisual();
}

async function boot() {
  state.userKey = getUserKey();
  try {
    const data = await postJson("/api/init", { user_key: state.userKey });
    applyUserPayload(data.user);
    ownedItems = data.owned_items || [];
    unlockedAchievements = data.unlocked_achievements || [];
    achievements = data.achievements || [];
    shop = data.shop;
    renderAll(data.history || []);
    if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
    setStatus("Аккаунт загружен");
    updateWeatherVisual();
    turboBtn.textContent = "Turbo";
  } catch (e) {
    setStatus("Ошибка загрузки аккаунта");
    console.error(e);
  }
}

resetPlane();
resetVisuals();
updateUI();
boot();
