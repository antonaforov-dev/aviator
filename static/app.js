const tg = window.Telegram?.WebApp || null;
if (tg) { try { tg.ready(); tg.expand(); } catch (e) {} }

const $ = (id) => document.getElementById(id);
const sky = $("sky"), plane = $("plane"), carrier = $("carrier"), planeTrail = $("planeTrail"), boostFlames = $("boostFlames"), weatherLayer = $("weatherLayer"), turboIndicator = $("turboIndicator");
const balanceEl = $("balance"), betEl = $("bet"), multiplierEl = $("multiplier"), potentialWinEl = $("potentialWin"), statusEl = $("status"), weatherValueEl = $("weatherValue");
const startBtn = $("startBtn"), boostBtn = $("boostBtn"), turboBtn = $("turboBtn"), weatherBtn = $("weatherBtn"), soundBtn = $("soundBtn"), betPlus = $("betPlus"), betMinus = $("betMinus"), cashoutBtn = $("cashoutBtn"), riskBtn = $("riskBtn");
const promoInput = $("promoInput"), promoBtn = $("promoBtn");
const boostProgressFill = $("boostProgressFill"), boostTimerMain = $("boostTimerMain"), boostCooldownSide = $("boostCooldownSide"), boostCostPill = $("boostCostPill");
const heightValue = $("heightValue"), distanceValue = $("distanceValue"), fieldMultiplierValue = $("fieldMultiplierValue"), multiplierStat = $("multiplierStat");
const planeShop = $("planeShop"), carrierShop = $("carrierShop"), trailShop = $("trailShop"), upgradesShop = $("upgradesShop"), casesShop = $("casesShop");
const achievementsList = $("achievementsList"), historyList = $("historyList"), boostPanelGrid = $("boostPanelGrid"), statsGrid = $("statsGrid"), eventBanner = $("eventBanner"), toastEl = $("toast"), battlePassTrack = $("battlePassTrack"), previewPlane = $("previewPlane"), previewCarrier = $("previewCarrier"), previewTrail = $("previewTrail"), previewTitle = $("previewTitle"), previewText = $("previewText"), prestigeBtn = $("prestigeBtn"), prestigeTitle = $("prestigeTitle"), prestigeText = $("prestigeText"), rivalsList = $("rivalsList"), mindLine = $("mindLine"), caseOverlay = $("caseOverlay"), caseWheel = $("caseWheel"), caseResult = $("caseResult");

const BET_MIN = 100, BET_MAX = 15000, BET_STEP = 100;
const WEATHER_MODES = ["clear", "rain", "fog", "storm", "sunset"];
const RARITY_LABELS = { common: "Обычный", rare: "Редкий", epic: "Эпический", legendary: "Легендарный" };

let currentBet = 100;
let shop = null, achievements = [], ownedItems = [], unlockedAchievements = [], soundEnabled = true, audioCtx = null;
let state = {
  userKey: null, balance: 10000, running: false,
  multiplier: 1, displayedMultiplier: 1, potentialWin: 0,
  planeX: 80, planeY: 150, velocityY: 0, planeAngle: 0,
  distanceMeters: 0, displayedDistance: 0, heightMeters: 0, displayedHeight: 0,
  gameLoop: null, spawnLoop: null, carrierLoop: null, smokeLoop: null, boostTrailLoop: null, eventLoop: null,
  multipliers: [], carrierActive: false, lastGoodPickupAt: 0, gameStartedAt: 0,
  boostActive: false, boostEndAt: 0, boostsUsedThisRound: {}, collectedThisRound: 0,
  weather: "clear", turboMode: false, currentBoost: "boost_lift", shieldEndAt: 0, magnetEndAt: 0,
  selectedPlaneSkin: "plane_classic", selectedCarrierSkin: "carrier_standard", selectedTrailSkin: "trail_smoke",
  upgrades: { upgrade_engine: 0, upgrade_rescue: 0, upgrade_events: 0 },
  stats: {}, activeEvent: null, eventEndAt: 0, rescueUsedThisRound: false, rescuesThisRound: 0, eventsThisRound: 0,
  rivals: [], prestige: { level: 0, tokens: 0, bonus_percent: 0, required_balance: 5000000 }, battlePassXp: 0, battlePassClaims: [], powerups: [], musicTimer: null,
};

function getUserKey() {
  const telegramId = tg?.initDataUnsafe?.user?.id;
  if (telegramId) return `tg_${telegramId}`;
  let demoKey = localStorage.getItem("avitor_demo_user_key");
  if (!demoKey) { demoKey = `demo_${Math.random().toString(36).slice(2, 12)}`; localStorage.setItem("avitor_demo_user_key", demoKey); }
  return demoKey;
}
async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok || !data.ok) throw data;
  return data;
}
function ensureAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function beep(freq = 440, duration = 0.08, type = "sine", gainValue = 0.03) {
  if (!soundEnabled) return;
  try {
    ensureAudio();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = gainValue;
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}
const soundPickup = () => { beep(740, 0.09, "triangle", 0.035); setTimeout(() => beep(980, 0.09, "triangle", 0.03), 70); };
const soundLose = () => { beep(220, 0.14, "sawtooth", 0.04); setTimeout(() => beep(160, 0.18, "sawtooth", 0.035), 90); };
const soundWin = () => { beep(660, 0.08, "square", 0.03); setTimeout(() => beep(880, 0.11, "square", 0.03), 70); setTimeout(() => beep(1100, 0.14, "square", 0.028), 140); };
const soundBoost = () => { beep(520, 0.07, "sawtooth", 0.04); setTimeout(() => beep(640, 0.07, "sawtooth", 0.04), 55); setTimeout(() => beep(760, 0.07, "sawtooth", 0.035), 110); };
const soundCase = () => { beep(520, 0.08, "triangle", 0.03); setTimeout(() => beep(760, 0.1, "triangle", 0.03), 70); setTimeout(() => beep(1040, 0.12, "triangle", 0.03), 140); };
const soundRescue = () => { beep(900, 0.08, "square", 0.035); setTimeout(() => beep(1200, 0.12, "square", 0.03), 80); };
const soundEvent = () => { beep(480, 0.06, "sawtooth", 0.03); setTimeout(() => beep(720, 0.08, "sawtooth", 0.03), 60); };

function showToast(text) { toastEl.textContent = text; toastEl.classList.add("show"); clearTimeout(showToast._t); showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2200); }
function setStatus(text) { statusEl.textContent = text; }
function formatMoney(v) { return new Intl.NumberFormat("ru-RU").format(Math.floor(v || 0)); }
function currentPrestigeFactor() { return 1 + ((state.prestige?.bonus_percent || 0) / 100); }
function currentWinAmount() { return currentBet * state.multiplier * currentPrestigeFactor(); }
function setMindLine(text) { if (mindLine) mindLine.textContent = text; }
function psychologyPulse() {
  if (!state.running) { setMindLine(`Престиж даёт +${state.prestige?.bonus_percent || 0}% к выигрышу. Терпение окупается.`); return; }
  const lines = state.multiplier < 1.8 ? ['Холодная голова решает.', 'Самое сложное — не спешить.', 'Пока всё под контролем.'] : state.multiplier < 3.5 ? ['Ещё чуть-чуть и будет жирно…', 'Вот сейчас начинается азарт.', 'Риск уже чувствуется.'] : ['Почти идеальный кэшаут.', 'Не пожадничай слишком сильно.', 'Один клик — и деньги твои.'];
  setMindLine(lines[Math.floor(Math.random() * lines.length)]);
}
function updateRivals() {
  if (!rivalsList) return;
  if (!state.running) {
    state.rivals = [
      {name:'Skyman', status:'ждёт старт', amount:''},
      {name:'TurboFox', status:'точит стратегию', amount:''},
      {name:'IronWing', status:'готов рискнуть', amount:''},
    ];
  } else if (!state.rivals.length) {
    const names = ['Skyman', 'TurboFox', 'IronWing', 'NovaJet', 'Pilot77'];
    state.rivals = names.map((name, i) => ({name, target: 1.4 + Math.random() * 4.8 + i * 0.1, done:false, status:'в полёте', amount:''}));
  }
  for (const rival of state.rivals) {
    if (state.running && !rival.done && state.multiplier >= rival.target) {
      rival.done = true;
      const lose = Math.random() < 0.22;
      rival.status = lose ? 'разбился' : 'забрал';
      rival.amount = lose ? '' : `x${rival.target.toFixed(2)}`;
    }
  }
  rivalsList.innerHTML = state.rivals.map(r => `<div class="rival-row"><span>${r.name}</span><span>${r.status} ${r.amount || ''}</span></div>`).join('');
}
function updatePreview(item = null) {
  const planeId = item?.type === 'plane' ? item.id : state.selectedPlaneSkin;
  const carrierId = item?.type === 'carrier' ? item.id : state.selectedCarrierSkin;
  const trailId = item?.type === 'trail' ? item.id : state.selectedTrailSkin;
  if (previewPlane) previewPlane.className = `preview-plane plane ${skinClassFromId('plane', planeId)}`;
  if (previewCarrier) previewCarrier.className = `preview-carrier carrier ${skinClassFromId('carrier', carrierId)}`;
  if (previewTrail) previewTrail.className = `preview-trail plane-trail ${trailClassFromId(trailId)}`;
  if (previewTitle) previewTitle.textContent = item ? item.name : 'Активная экипировка';
  if (previewText) previewText.textContent = item ? `${RARITY_LABELS[item.rarity || 'common']} · ${formatMoney(item.price || 0)} монет` : 'Большой предпросмотр твоих текущих скинов.';
}
function updateDisplayedValues() {
  state.displayedMultiplier += (state.multiplier - state.displayedMultiplier) * 0.12;
  state.displayedDistance += (state.distanceMeters - state.displayedDistance) * 0.18;
  state.displayedHeight += (state.heightMeters - state.displayedHeight) * 0.18;
}
function pulseMultiplier() { multiplierStat.classList.remove("pulse"); void multiplierStat.offsetWidth; multiplierStat.classList.add("pulse"); }
function updateWeatherVisual() { weatherLayer.className = "weather-layer"; if (state.weather !== "clear") weatherLayer.classList.add(`weather-${state.weather}`); weatherValueEl.textContent = state.weather; }
function cycleWeather() { const idx = WEATHER_MODES.indexOf(state.weather); state.weather = WEATHER_MODES[(idx + 1) % WEATHER_MODES.length]; updateWeatherVisual(); showToast(`Погода: ${state.weather}`); }
function skinClassFromId(prefix, id) { return id.startsWith(prefix + "_") ? `skin-${id.replaceAll("_", "-")}` : id; }
function trailClassFromId(id) { return id.replaceAll("_", "-"); }
function applySelectedSkins() { plane.className = `plane ${skinClassFromId("plane", state.selectedPlaneSkin)}`; carrier.className = `carrier ${skinClassFromId("carrier", state.selectedCarrierSkin)}`; planeTrail.className = `plane-trail ${trailClassFromId(state.selectedTrailSkin)}`; }

function updateBoostPanel() {
  if (!shop) return; boostPanelGrid.innerHTML = "";
  for (const boost of shop.boosts) {
    const div = document.createElement("div"); div.className = "boost-chip";
    div.innerHTML = `<div class="boost-chip-head"><span>${boost.name}</span><span>${formatMoney(boost.price)}</span></div><div class="boost-chip-sub">${(boost.duration/1000).toFixed(1)}s</div>`;
    div.onclick = () => { state.currentBoost = boost.id; boostCostPill.textContent = boost.price; boostBtn.textContent = `${boost.name} (${boost.price})`; showToast(`Выбран буст: ${boost.name}`); };
    boostPanelGrid.appendChild(div);
  }
}

function getUpgradeConf(id) { return shop?.upgrades?.find(u => u.id === id); }
function getUpgradeCost(conf, level) { return conf.base_price + conf.step_price * level; }

function renderShopCategory(container, items, selectedId) {
  container.innerHTML = "";
  for (const item of items) {
    const owned = ownedItems.includes(item.id), equipped = selectedId === item.id;
    const div = document.createElement("div"); div.className = "shop-item";
    div.innerHTML = `
      <div class="shop-item-top"><div><div class="shop-item-name">${item.name}</div><div class="shop-item-price">${formatMoney(item.price)}</div></div><span class="rarity-badge rarity-${item.rarity || 'common'}">${RARITY_LABELS[item.rarity || 'common']}</span></div>
      ${owned ? `<div class="owned-badge">${equipped ? "Экипировано" : "Куплено"}</div>` : ""}
      <div class="shop-preview">${item.id}</div>
      <div class="shop-item-actions">${!owned ? `<button class="small-action buy-btn">Купить</button>` : equipped ? `<button class="small-action equipped-btn">Надето</button>` : `<button class="small-action equip-btn">Надеть</button>`}</div>`;
    div.onmouseenter = () => updatePreview(item);
    div.onmouseleave = () => updatePreview();
    const btn = div.querySelector(".small-action");
    btn.onclick = async () => {
      try {
        if (!owned) {
          const data = await postJson("/api/buy-item", { user_key: state.userKey, item_id: item.id });
          state.balance = data.balance; ownedItems = data.owned_items; if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
          showToast(`Куплено: ${item.name}`); beep(620, 0.08, "triangle", 0.03);
        } else if (!equipped) {
          const data = await postJson("/api/equip-item", { user_key: state.userKey, item_id: item.id });
          applyUserPayload(data.user); showToast(`Надето: ${item.name}`); beep(760, 0.07, "triangle", 0.03);
        }
        renderAll();
      } catch (err) { showToast(err.error === "insufficient_balance" ? "Недостаточно монет" : "Ошибка"); }
    };
    container.appendChild(div);
  }
}

function renderUpgrades() {
  upgradesShop.innerHTML = "";
  for (const conf of (shop?.upgrades || [])) {
    const level = state.upgrades[conf.id] || 0, maxed = level >= conf.max_level, cost = getUpgradeCost(conf, level);
    const div = document.createElement("div"); div.className = "shop-item";
    div.innerHTML = `<div class="shop-item-top"><div><div class="shop-item-name">${conf.name}</div><div class="shop-item-price">${maxed ? 'MAX' : formatMoney(cost)}</div></div><span class="owned-badge">LVL ${level}/${conf.max_level}</span></div><div class="shop-preview">${conf.description}</div><div class="shop-item-actions"><button class="small-action ${maxed ? 'equipped-btn' : 'buy-btn'}">${maxed ? 'Макс' : 'Улучшить'}</button></div>`;
    div.querySelector("button").onclick = async () => {
      if (maxed) return;
      try {
        const data = await postJson("/api/buy-upgrade", { user_key: state.userKey, upgrade_id: conf.id });
        applyUserPayload(data.user); if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
        showToast(`${conf.name} улучшен`); renderAll();
      } catch (err) { showToast(err.error === 'max_level' ? 'Уже максимум' : 'Недостаточно монет'); }
    };
    upgradesShop.appendChild(div);
  }
}

function renderCases() {
  casesShop.innerHTML = "";
  for (const c of (shop?.cases || [])) {
    const div = document.createElement("div"); div.className = "shop-item";
    div.innerHTML = `<div class="shop-item-top"><div><div class="shop-item-name">${c.name}</div><div class="shop-item-price">${formatMoney(c.price)}</div></div><span class="rarity-badge rarity-epic">Кейс</span></div><div class="shop-preview">Шанс на редкие скины</div><div class="shop-item-actions"><button class="small-action buy-btn">Открыть</button></div>`;
    div.querySelector("button").onclick = async () => {
      try {
        const data = await postJson("/api/open-case", { user_key: state.userKey, case_id: c.id });
        applyUserPayload(data.user); ownedItems = data.owned_items || ownedItems; if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
        soundCase();
        const rewardText = data.reward_item ? `${data.reward_item.name} · ${RARITY_LABELS[data.reward_item.rarity]}` : `+${formatMoney(data.bonus_coins)} монет`;
        showCaseAnimation(c.name, rewardText);
        if (data.reward_item) showToast(`${c.name}: ${data.reward_item.name} (${RARITY_LABELS[data.reward_item.rarity]})`);
        else showToast(`${c.name}: +${formatMoney(data.bonus_coins)} монет`);
        renderAll();
      } catch (err) { showToast('Недостаточно монет'); }
    };
    casesShop.appendChild(div);
  }
}

function showCaseAnimation(title, rewardText) {
  if (!caseOverlay) return;
  caseOverlay.classList.add('show');
  const pool = ['Обычный', 'Редкий', 'Эпический', 'Легендарный', 'Монеты', 'Секрет'];
  let i = 0;
  caseResult.textContent = title + ' открывается...';
  clearInterval(showCaseAnimation._t);
  showCaseAnimation._t = setInterval(() => { caseWheel.textContent = pool[i % pool.length] + ' · ' + pool[(i+2)%pool.length]; i++; }, 90);
  setTimeout(() => { clearInterval(showCaseAnimation._t); caseWheel.textContent = rewardText; caseResult.textContent = 'Награда получена'; }, 1200);
  clearTimeout(showCaseAnimation._h);
  showCaseAnimation._h = setTimeout(() => caseOverlay.classList.remove('show'), 2400);
}

function renderBattlePass() {
  if (!battlePassTrack) return;
  battlePassTrack.innerHTML = '';
  for (const level of (shop?.battle_pass || [])) {
    const unlocked = (state.battlePassXp || 0) >= level.xp;
    const claimed = (state.battlePassClaims || []).includes(level.level);
    const card = document.createElement('div');
    card.className = `pass-card ${unlocked ? 'unlocked' : ''} ${claimed ? 'claimed' : ''}`;
    card.innerHTML = `<div class="pass-level">LVL ${level.level}</div><div class="pass-xp">${level.xp} XP</div><div class="pass-reward">${level.name}</div><button class="small-action ${claimed ? 'equipped-btn' : unlocked ? 'buy-btn' : 'secondary-btn'}">${claimed ? 'Забрано' : unlocked ? 'Забрать' : 'Закрыто'}</button>`;
    card.querySelector('button').onclick = async () => {
      if (!unlocked || claimed) return;
      try {
        const data = await postJson('/api/claim-battle-pass', { user_key: state.userKey, level: level.level });
        applyUserPayload(data.user); ownedItems = data.owned_items || ownedItems; state.battlePassClaims = data.battle_pass_claims || state.battlePassClaims;
        if (data.reward_item) showToast(`Боевой пропуск: ${data.reward_item.name}`); else showToast(`Боевой пропуск: +${formatMoney(data.bonus_coins)} монет`);
        if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
        renderAll();
      } catch (e) { showToast('Награда пока недоступна'); }
    };
    battlePassTrack.appendChild(card);
  }
}

function renderPrestige() {
  if (!prestigeTitle) return;
  prestigeTitle.textContent = `Престиж ${state.prestige?.level || 0} · жетоны ${state.prestige?.tokens || 0}`;
  prestigeText.textContent = `Требуется ${formatMoney(state.prestige?.required_balance || 0)} монет. Бонус к выигрышу: +${state.prestige?.bonus_percent || 0}%.`;
  prestigeBtn.disabled = state.balance < (state.prestige?.required_balance || 0);
}

function renderAchievements() {
  achievementsList.innerHTML = "";
  for (const ach of achievements) {
    const unlocked = unlockedAchievements.includes(ach.id);
    const div = document.createElement("div"); div.className = `ach-item ${unlocked ? 'unlocked' : ''}`;
    div.innerHTML = `<div class="ach-name">${ach.name}</div><div class="ach-desc">${ach.description}</div><div class="ach-reward">+${formatMoney(ach.reward)}</div>`;
    achievementsList.appendChild(div);
  }
}

function renderHistory(history) {
  historyList.innerHTML = "";
  for (const row of history) {
    const div = document.createElement("div"); div.className = "history-item";
    const name = row.result === "lose" ? "ПРОИГРЫШ" : row.result === "carrier" ? "ПОСАДКА НА АВИАНОСЕЦ" : "ПОБЕДА";
    div.innerHTML = `<div class="history-title">${name} — ${formatMoney(row.payout)}</div><div class="history-desc">Ставка: ${formatMoney(row.bet)} · Множитель: x${row.multiplier.toFixed(2)} · Дистанция: ${row.distance.toFixed(1)}м · Высота: ${row.height.toFixed(1)}м · Погода: ${row.weather}${row.turbo_mode ? ' · TURBO' : ''}</div>`;
    historyList.appendChild(div);
  }
}

function renderStats() {
  statsGrid.innerHTML = "";
  const stats = state.stats || {};
  const rows = [
    ["Всего игр", stats.total_rounds], ["Сумма выигрыша", formatMoney(stats.total_won)], ["Посадки на авианосец", stats.total_landings],
    ["Поймано множителей", stats.total_multipliers_collected], ["Лучшая дистанция", `${(stats.best_distance || 0).toFixed(1)}м`], ["Лучшая высота", `${(stats.best_height || 0).toFixed(1)}м`],
    ["Лучший множитель", `x${(stats.best_multiplier || 1).toFixed(2)}`], ["Использовано бустов", stats.total_boosts_used], ["Запусков Turbo", stats.total_turbo_used],
    ["Спасений самолёта", stats.total_rescues], ["Открыто кейсов", stats.total_cases_opened], ["Событий во время полёта", stats.total_events_seen],
    ["Промокодов", stats.promo_count], ["Покупок в магазине", stats.total_shop_buys], ["Серия входов", stats.streak_days], ["Побед", stats.total_wins], ["XP боевого пропуска", state.battlePassXp || 0], ["Престиж", state.prestige?.level || 0],
  ];
  for (const [label, value] of rows) {
    const card = document.createElement("div"); card.className = "stat-mini-card"; card.innerHTML = `<div class="label">${label}</div><div class="value">${value ?? 0}</div>`; statsGrid.appendChild(card);
  }
}

function renderAll(history = null) {
  updateUI(); applySelectedSkins();
  if (shop) {
    renderShopCategory(planeShop, shop.plane_skins, state.selectedPlaneSkin);
    renderShopCategory(carrierShop, shop.carrier_skins, state.selectedCarrierSkin);
    renderShopCategory(trailShop, shop.trail_skins, state.selectedTrailSkin);
    renderUpgrades(); renderCases(); renderBattlePass(); renderPrestige(); updateBoostPanel();
  }
  updatePreview(); updateRivals(); psychologyPulse(); renderAchievements(); renderStats(); if (history) renderHistory(history);
}

function handleNewAchievements(list) { if (!list?.length) return; for (const ach of list) { if (!unlockedAchievements.includes(ach.id)) unlockedAchievements.push(ach.id); showToast(`Достижение: ${ach.name} (+${formatMoney(ach.reward)})`);} renderAchievements(); updateUI(); }
function applyUserPayload(user) { state.balance = user.balance; state.selectedPlaneSkin = user.selected_plane_skin; state.selectedCarrierSkin = user.selected_carrier_skin; state.selectedTrailSkin = user.selected_trail_skin; state.upgrades = user.upgrades || state.upgrades; state.stats = user.stats || state.stats; state.prestige = user.prestige || state.prestige; state.battlePassXp = user.battle_pass_xp || 0; applySelectedSkins(); }

function updateBoostButton() {
  const current = shop?.boosts?.find(b => b.id === state.currentBoost), cost = current?.price ?? 500;
  boostCostPill.textContent = cost;
  if (!state.running) { boostBtn.disabled = true; boostBtn.textContent = `${current?.name ?? "Boost"} (${cost})`; return; }
  if (state.boostsUsedThisRound[state.currentBoost] || state.boostActive || state.balance < cost) { boostBtn.disabled = true; boostBtn.textContent = state.boostActive ? 'Активен' : state.boostsUsedThisRound[state.currentBoost] ? 'Уже использован' : `${current?.name ?? 'Boost'} (${cost})`; return; }
  boostBtn.disabled = false; boostBtn.textContent = `${current?.name ?? "Boost"} (${cost})`;
}

function updateBoostBar() {
  const current = shop?.boosts?.find(b => b.id === state.currentBoost), duration = current?.duration ?? 2000;
  if (!state.running) { boostProgressFill.style.width = '100%'; boostTimerMain.textContent = `${(duration / 1000).toFixed(1)}s`; boostCooldownSide.textContent = 'ready'; return; }
  if (state.boostActive) { const left = Math.max(0, state.boostEndAt - Date.now()), progress = Math.max(0, Math.min(1, left / duration)); boostProgressFill.style.width = `${progress * 100}%`; boostTimerMain.textContent = `${(left / 1000).toFixed(1)}s`; boostCooldownSide.textContent = 'active'; return; }
  if (state.boostsUsedThisRound[state.currentBoost]) { boostProgressFill.style.width = '0%'; boostTimerMain.textContent = '0.0s'; boostCooldownSide.textContent = 'used'; return; }
  boostProgressFill.style.width = '100%'; boostTimerMain.textContent = `${(duration / 1000).toFixed(1)}s`; boostCooldownSide.textContent = 'ready';
}

function updateUI() {
  balanceEl.textContent = formatMoney(state.balance); betEl.textContent = currentBet; multiplierEl.textContent = 'x' + state.multiplier.toFixed(2); potentialWinEl.textContent = formatMoney(state.potentialWin);
  weatherValueEl.textContent = state.weather; heightValue.textContent = `${state.displayedHeight.toFixed(1).replace('.', ',')}m`; distanceValue.textContent = `${state.displayedDistance.toFixed(1).replace('.', ',')}m`; fieldMultiplierValue.textContent = `x${state.displayedMultiplier.toFixed(1).replace('.', ',')}`;
  updateBoostButton(); updateBoostBar(); turboIndicator.classList.toggle('active', state.turboMode); soundBtn.textContent = `Звук: ${soundEnabled ? 'ON' : 'OFF'}`;
}

function drawPlane() { plane.style.left = `${state.planeX}px`; plane.style.bottom = `${state.planeY}px`; plane.style.transform = `rotate(${state.planeAngle}deg)`; }
function resetPlane() { state.planeX = 80; state.planeY = 150; state.velocityY = 2.7; state.planeAngle = -4; state.distanceMeters = 0; state.displayedDistance = 0; state.heightMeters = 0; state.displayedHeight = 0; state.multiplier = 1; state.displayedMultiplier = 1; state.collectedThisRound = 0; plane.classList.remove('boosting'); drawPlane(); }
function clearMultiplierItems() { document.querySelectorAll('.mult-item').forEach(el => el.remove()); state.multipliers = []; }
function clearBoostFlames() { boostFlames.innerHTML = ''; }
function spawnSmoke() { if (!state.running) return; const smoke = document.createElement('div'); smoke.className = 'smoke'; smoke.style.left = `${state.planeX + 10}px`; smoke.style.bottom = `${state.planeY + 22}px`; planeTrail.appendChild(smoke); setTimeout(() => smoke.remove(), 1200); }
function spawnBoostFlame() { if (!state.running || !state.boostActive) return; const flame = document.createElement('div'); flame.className = 'boost-flame'; flame.style.left = `${state.planeX + 10}px`; flame.style.bottom = `${state.planeY + 28}px`; boostFlames.appendChild(flame); setTimeout(() => flame.remove(), 220); }

function spawnMultiplier() {
  if (!state.running) return;
  const el = document.createElement('div');
  const eventLucky = state.activeEvent === 'golden_path';
  const good = Math.random() < (eventLucky ? 0.98 : state.weather === 'storm' ? 0.76 : 0.86);
  const values = good ? [1.2, 1.3, 1.5, 2, 3, ...(state.turboMode ? [5] : [])] : [0.8, 0.7];
  const value = values[Math.floor(Math.random() * values.length)];
  el.className = 'mult-item' + (value >= 2 ? ' big' : ''); el.textContent = 'x' + value;
  const x = sky.clientWidth - 40 + Math.random() * 140, y = 170 + Math.random() * Math.max(80, sky.clientHeight - 330);
  el.style.left = `${x}px`; el.style.bottom = `${y}px`; sky.appendChild(el); state.multipliers.push({ el, x, y, value, taken: false });
}

function maybeSpawnCarrier() { if (!state.running || state.carrierActive) return; const chance = state.turboMode ? 0.25 : 0.45; if (Math.random() < chance) { state.carrierActive = true; carrier.style.left = `${sky.clientWidth + 60}px`; } }
async function syncBalance(balanceOverride = null) {
  try {
    const targetBalance = Math.floor(balanceOverride ?? state.balance);
    const data = await postJson('/api/save-balance', { user_key: state.userKey, balance: targetBalance });
    state.balance = data.balance;
    if (data.new_achievements?.length) handleNewAchievements(data.new_achievements);
    updateUI();
    return data;
  } catch (e) {
    throw e;
  }
}

function getEngineBonus() { return (state.upgrades.upgrade_engine || 0) * 0.09; }
function getRescueChance() { return 0.08 + (state.upgrades.upgrade_rescue || 0) * 0.07; }
function clearEventBanner() { eventBanner.classList.remove('show'); }
function triggerEvent(name, text, duration, effect) {
  state.activeEvent = name; state.eventEndAt = Date.now() + duration; state.eventsThisRound += 1;
  eventBanner.textContent = text; eventBanner.classList.add('show'); soundEvent(); if (effect) effect(); showToast(`Событие: ${text}`);
  clearTimeout(triggerEvent._t); triggerEvent._t = setTimeout(() => { if (Date.now() >= state.eventEndAt) { state.activeEvent = null; clearEventBanner(); } }, duration + 40);
}

function maybeTriggerRandomEvent() {
  if (!state.running || state.activeEvent) return;
  const eventLuck = state.upgrades.upgrade_events || 0;
  const chance = 0.22 + eventLuck * 0.04;
  if (Math.random() > chance) return;
  if (Math.random() < 0.08) {
    const superEvents = [
      () => triggerEvent('phoenix', 'Феникс-режим', 3200, () => { state.shieldEndAt = Date.now() + 3200; state.velocityY += 2.4; state.multiplier += 3; pulseMultiplier(); }),
      () => triggerEvent('timewarp', 'Искажение времени', 2600, () => { state.velocityY += 1.4; state.distanceMeters += 260; state.balance += 3500; syncBalance(); }),
      () => triggerEvent('meteor', 'Метеорный дождь', 2400, () => { for (let i=0;i<4;i++) spawnMultiplier(); state.multiplier += 4; pulseMultiplier(); }),
    ];
    superEvents[Math.floor(Math.random()*superEvents.length)]();
    return;
  }
  const goodBias = 0.52 + eventLuck * 0.07;
  const goodEvents = [
    () => triggerEvent('tailwind', 'Попутный ветер', 2400, () => { state.velocityY += 1.5; state.multiplier += 0.8; pulseMultiplier(); }),
    () => triggerEvent('golden_path', 'Золотая трасса', 3500, () => { state.multiplier += 1.25; pulseMultiplier(); spawnMultiplier(); spawnMultiplier(); }),
    () => triggerEvent('bonus', 'Бонусная волна', 1700, () => { state.balance += 1200; syncBalance(); }),
    () => triggerEvent('drone', 'Дрон-спасатель', 2800, () => { state.shieldEndAt = Date.now() + 2800; }),
  ];
  const badEvents = [
    () => triggerEvent('turbulence', 'Турбулентность', 1800, () => { state.velocityY -= 2.3; }),
    () => triggerEvent('crosswind', 'Боковой ветер', 2000, () => { state.planeAngle = 20; state.velocityY -= 1.2; }),
  ];
  const arr = Math.random() < goodBias ? goodEvents : badEvents;
  arr[Math.floor(Math.random() * arr.length)]();
}

async function startGame() {
  if (state.running) return;
  if (state.balance < currentBet) { setStatus('Недостаточно монет'); return; }
  state.balance -= currentBet; await syncBalance();
  state.running = true; state.potentialWin = currentBet; state.gameStartedAt = Date.now(); state.lastGoodPickupAt = Date.now(); state.boostActive = false; state.boostEndAt = 0; state.boostsUsedThisRound = {}; state.shieldEndAt = 0; state.magnetEndAt = 0; state.activeEvent = null; state.rescueUsedThisRound = false; state.rescuesThisRound = 0; state.eventsThisRound = 0; state.rivals = []; updateRivals(); psychologyPulse();
  resetPlane(); clearMultiplierItems(); clearBoostFlames(); clearEventBanner(); carrier.style.left = '110%'; state.carrierActive = false; startBtn.disabled = true; setStatus('Самолёт взлетает'); updateUI();
  clearInterval(state.spawnLoop); clearInterval(state.carrierLoop); clearInterval(state.smokeLoop); clearInterval(state.boostTrailLoop); clearInterval(state.eventLoop); cancelAnimationFrame(state.gameLoop);
  spawnMultiplier(); setTimeout(spawnMultiplier, 500);
  state.spawnLoop = setInterval(spawnMultiplier, state.turboMode ? 650 : 850);
  state.carrierLoop = setInterval(maybeSpawnCarrier, state.turboMode ? 1900 : 2600);
  state.smokeLoop = setInterval(spawnSmoke, 110); state.boostTrailLoop = setInterval(spawnBoostFlame, 45); state.eventLoop = setInterval(maybeTriggerRandomEvent, 2200); loop();
}

async function activateBoost() {
  if (!state.running) { setStatus('Сначала начни полёт'); return; }
  const current = shop.boosts.find(b => b.id === state.currentBoost); if (!current) return;
  if (state.boostsUsedThisRound[state.currentBoost]) { setStatus('Этот буст уже использован в раунде'); return; }
  if (state.balance < current.price) { setStatus('Недостаточно монет для буста'); return; }
  if (state.boostActive) { setStatus('Уже активен другой буст'); return; }
  const previousBalance = state.balance;
  const activeBoostId = state.currentBoost;
  state.balance -= current.price;
  state.boostsUsedThisRound[activeBoostId] = true; state.boostActive = true; state.boostEndAt = Date.now() + current.duration;
  state.velocityY = Math.max(state.velocityY, current.velocity + getEngineBonus()); state.planeY += current.id === 'boost_lift' ? 60 : 38; state.planeAngle = current.angle; plane.classList.add('boosting'); planeTrail.classList.add('boost-trail-active');
  if (state.currentBoost === 'boost_shield') state.shieldEndAt = Date.now() + current.duration;
  if (state.currentBoost === 'boost_magnet') state.magnetEndAt = Date.now() + current.duration;
  soundBoost(); setStatus(`${current.name} активирован`); updateUI();
  syncBalance(state.balance).catch(() => {
    state.balance = previousBalance;
    delete state.boostsUsedThisRound[activeBoostId];
    state.boostActive = false;
    state.boostEndAt = 0;
    state.shieldEndAt = 0;
    state.magnetEndAt = 0;
    plane.classList.remove('boosting');
    planeTrail.classList.remove('boost-trail-active');
    setStatus('Не удалось активировать буст');
    showToast('Ошибка сети: буст отменён');
    updateUI();
  });
}

async function finishRound(result) {
  const payload = { user_key: state.userKey, result, bet: currentBet, payout: result === 'lose' ? 0 : Math.floor(state.potentialWin), multiplier: state.multiplier, distance: state.distanceMeters, height: state.heightMeters, collected: state.collectedThisRound, weather: state.weather, turbo_mode: state.turboMode, boosts_used: Object.keys(state.boostsUsedThisRound).length, rescues: state.rescuesThisRound, event_count: state.eventsThisRound, prestige_bonus: state.prestige?.bonus_percent || 0 };
  try {
    const data = await postJson('/api/record-round', payload); applyUserPayload(data.user); unlockedAchievements = data.unlocked_achievements || unlockedAchievements; renderHistory(data.history || []); if (data.new_achievements?.length) handleNewAchievements(data.new_achievements); renderAll();
  } catch (e) {}
}
async function winGame(reason) { state.balance += Math.floor(state.potentialWin); await syncBalance(); soundWin(); await finishRound(reason.includes('авианосец') ? 'carrier' : 'win'); endGame(reason); }
async function loseGame(reason) { soundLose(); await finishRound('lose'); endGame(reason); }
function endGame(reason) { state.running = false; state.boostActive = false; state.activeEvent = null; clearInterval(state.spawnLoop); clearInterval(state.carrierLoop); clearInterval(state.smokeLoop); clearInterval(state.boostTrailLoop); clearInterval(state.eventLoop); cancelAnimationFrame(state.gameLoop); clearBoostFlames(); plane.classList.remove('boosting'); planeTrail.classList.remove('boost-trail-active'); startBtn.disabled = false; clearEventBanner(); setStatus(reason); updateUI(); }
function checkCollision(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }

function tryRescue() {
  if (state.rescueUsedThisRound || (state.upgrades.upgrade_rescue || 0) <= 0) return false;
  if (Math.random() > getRescueChance()) return false;
  state.rescueUsedThisRound = true; state.rescuesThisRound += 1; state.planeY = 160; state.velocityY = 3.6 + (state.upgrades.upgrade_engine || 0) * 0.15; state.shieldEndAt = Date.now() + 1000; soundRescue(); showToast('Самолёт спасён!'); setStatus('Апгрейд спас самолёт'); return true;
}

function loop() {
  if (!state.running) return;
  const skyWidth = sky.clientWidth, skyHeight = sky.clientHeight, seaLevel = 110, now = Date.now();
  const engineBonus = getEngineBonus();
  if (state.planeX < 240) state.planeX += state.turboMode ? 3.4 + engineBonus : 2.4 + engineBonus;
  else if (state.planeX < skyWidth * (state.turboMode ? 0.5 : 0.38)) state.planeX += state.turboMode ? 1.8 + engineBonus : 1.25 + engineBonus;
  const msSinceLastPickup = now - state.lastGoodPickupAt;
  const weatherGravity = state.weather === 'storm' ? 0.02 : state.weather === 'rain' ? 0.01 : 0;
  const weatherDistanceBonus = state.weather === 'sunset' ? 0.08 : 0;

  if (state.boostActive && now < state.boostEndAt) {
    const current = shop.boosts.find(b => b.id === state.currentBoost);
    state.velocityY += current.id === 'boost_turbo' ? 0.10 : current.id === 'boost_lift' ? 0.16 : 0.07;
    if (current.id === 'boost_turbo' && state.planeX < skyWidth * 0.7) state.planeX += 2.2;
    if (current.id === 'boost_lift' && state.planeX < skyWidth * 0.55) state.planeX += 1.2;
    state.planeAngle = current.angle;
  } else {
    if (state.boostActive && now >= state.boostEndAt) { state.boostActive = false; plane.classList.remove('boosting'); planeTrail.classList.remove('boost-trail-active'); setStatus('Буст закончился'); updateUI(); }
    const engineGravityReduce = engineBonus * 0.055;
    if (now < state.shieldEndAt) state.velocityY -= 0.004 + weatherGravity * 0.4 - engineGravityReduce;
    else if (msSinceLastPickup < 1800) state.velocityY -= 0.014 + weatherGravity - engineGravityReduce;
    else if (msSinceLastPickup < 3200) state.velocityY -= 0.05 + weatherGravity - engineGravityReduce;
    else state.velocityY -= 0.105 + weatherGravity - engineGravityReduce;
    if (state.activeEvent === 'tailwind') state.velocityY += 0.028;
    if (state.activeEvent === 'turbulence') state.velocityY -= 0.012;
    if (state.velocityY > 1.4) state.planeAngle = -8; else if (state.velocityY > 0.4) state.planeAngle = -3; else if (state.velocityY > -0.8) state.planeAngle = 4; else state.planeAngle = 13;
  }

  state.planeY += state.velocityY; state.heightMeters = Math.max(0, (state.planeY - (seaLevel - 8)) * 0.55); state.distanceMeters += (state.turboMode ? 1.08 : 0.62) + engineBonus * 0.35 + (state.boostActive ? 0.45 : 0) + weatherDistanceBonus;

  for (const item of state.multipliers) {
    item.x -= state.turboMode ? 5.6 : 4.3; item.el.style.left = `${item.x}px`; item.el.style.bottom = `${item.y}px`;
    if (now < state.magnetEndAt && item.value >= 1) { if (item.x < state.planeX + 200) item.x -= 1.8; if (item.y > state.planeY + 20) item.y -= 1.0; if (item.y < state.planeY - 20) item.y += 1.0; item.el.style.left = `${item.x}px`; item.el.style.bottom = `${item.y}px`; }
    const hit = checkCollision(state.planeX + 22, state.planeY + 10, 54, 34, item.x, item.y, 70, 70);
    if (!item.taken && hit) {
      item.taken = true; item.el.remove();
      if (item.value >= 1) {
  state.multiplier += item.value; state.collectedThisRound += 1; pulseMultiplier(); soundPickup(); state.velocityY = 2.4 + item.value * 0.42 + engineBonus * 0.2; state.planeY += 12; state.potentialWin = currentWinAmount(); state.lastGoodPickupAt = Date.now(); setStatus('Бонус к множителю подобран'); psychologyPulse(); }
      else { state.velocityY -= 1.15; setStatus('Плохой множитель'); }
      updateUI();
    }
  }
  state.multipliers = state.multipliers.filter(item => { if (item.taken) return false; if (item.x < -100) { item.el.remove(); return false; } return true; });

  if (state.carrierActive) {
    let carrierX = parseFloat(carrier.style.left); if (isNaN(carrierX)) carrierX = skyWidth + 40; carrierX -= state.turboMode ? 4.2 : 3.5; carrier.style.left = `${carrierX}px`;
    const planeOnCarrier = checkCollision(state.planeX + 16, state.planeY + 2, 70, 36, carrierX, 76, 420, 62);
    if (planeOnCarrier && state.planeY <= 144 && state.velocityY < 1.2) { state.multiplier += 1.5; pulseMultiplier(); state.potentialWin = currentWinAmount(); updateUI(); winGame('Успешная посадка на авианосец'); return; }
    if (carrierX < -460) { state.carrierActive = false; carrier.style.left = '110%'; }
  }

  if (state.planeY <= seaLevel - 8) {
    if (now < state.shieldEndAt) { state.planeY = seaLevel + 30; state.velocityY = 2.2; state.shieldEndAt = 0; setStatus('Shield спас самолёт'); showToast('Shield спас самолёт'); }
    else if (tryRescue()) { updateUI(); drawPlane(); state.gameLoop = requestAnimationFrame(loop); return; }
    else { state.planeY = seaLevel - 8; state.heightMeters = 0; drawPlane(); updateDisplayedValues(); updateUI(); loseGame('Самолёт упал в воду'); return; }
  }
  if (state.planeY > skyHeight - 120) { state.planeY = skyHeight - 120; state.velocityY = Math.min(state.velocityY, 0.4); }
  if (state.activeEvent && now >= state.eventEndAt) { state.activeEvent = null; clearEventBanner(); }
  updateDisplayedValues(); state.potentialWin = currentWinAmount(); updateRivals(); if (Math.random() < 0.015) psychologyPulse(); updateUI(); drawPlane(); state.gameLoop = requestAnimationFrame(loop);
}


async function cashoutNow() { if (!state.running) return; await winGame('Кэш-аут в воздухе'); }
async function takeRisk() {
  if (!state.running) { setStatus('Сначала начни полёт'); return; }
  if (state.multiplier < 1.5) { showToast('Риск доступен от x1.5'); return; }
  if (Math.random() < 0.5) { state.multiplier += Math.max(1, state.multiplier * 0.75); state.potentialWin = currentWinAmount(); soundWin(); showToast('Риск зашёл! Выплата выросла'); setStatus('Риск удался'); psychologyPulse(); }
  else { showToast('Риск провален'); await loseGame('Риск не удался'); }
}
async function doPrestige() {
  try { const data = await postJson('/api/prestige', { user_key: state.userKey }); applyUserPayload(data.user); state.battlePassClaims = data.battle_pass_claims || []; showToast('Престиж активирован'); renderAll(); } catch (e) { showToast('Нужно 5 000 000 монет'); }
}
promoBtn.onclick = async () => { const code = promoInput.value.trim().toUpperCase(); if (!code) { setStatus('Введите промокод'); return; } promoBtn.disabled = true; try { const data = await postJson('/api/redeem-promocode', { user_key: state.userKey, code }); state.balance = data.balance; promoInput.value = ''; updateUI(); if (data.new_achievements?.length) handleNewAchievements(data.new_achievements); showToast(`Промокод ${data.code}: +${formatMoney(data.reward)}`); beep(860, 0.1, 'triangle', 0.04); setStatus(`Промокод ${data.code} активирован`); } catch (err) { setStatus(err.error === 'already_used' ? 'Этот промокод уже использован' : 'Неверный промокод'); showToast(err.error === 'already_used' ? 'Промокод уже использован' : 'Неверный промокод'); } finally { promoBtn.disabled = false; } };
promoInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); promoBtn.click(); } };
betPlus.onclick = () => { if (!state.running) { currentBet = Math.min(BET_MAX, currentBet + BET_STEP); updateUI(); } };
betMinus.onclick = () => { if (!state.running) { currentBet = Math.max(BET_MIN, currentBet - BET_STEP); updateUI(); } };
startBtn.onclick = startGame; boostBtn.onclick = activateBoost; if (cashoutBtn) cashoutBtn.onclick = cashoutNow; if (riskBtn) riskBtn.onclick = takeRisk; prestigeBtn.onclick = doPrestige;
turboBtn.onclick = () => { if (state.running) { setStatus('Turbo можно переключать только до старта'); return; } state.turboMode = !state.turboMode; turboBtn.textContent = state.turboMode ? 'Turbo: ON' : 'Turbo'; showToast(state.turboMode ? 'Turbo режим включён' : 'Turbo режим выключен'); updateUI(); };
weatherBtn.onclick = () => cycleWeather(); soundBtn.onclick = () => { soundEnabled = !soundEnabled; if (soundEnabled && !state.musicTimer) state.musicTimer = setInterval(() => { if (!soundEnabled) return; const base = state.running ? (state.multiplier > 3 ? 520 : 420) : 320; beep(base, 0.05, 'sine', 0.01); }, 900); updateUI(); };
document.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => { document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active')); btn.classList.add('active'); $(btn.dataset.tab).classList.add('active'); });
function resetVisuals() { plane.classList.remove('boosting'); planeTrail.className = 'plane-trail'; applySelectedSkins(); updateWeatherVisual(); }

async function boot() {
  state.userKey = getUserKey();
  try {
    const data = await postJson('/api/init', { user_key: state.userKey });
    shop = data.shop; achievements = data.achievements || []; ownedItems = data.owned_items || []; unlockedAchievements = data.unlocked_achievements || []; state.battlePassClaims = data.battle_pass_claims || [];
    applyUserPayload(data.user); renderAll(data.history || []); if (data.new_achievements?.length) handleNewAchievements(data.new_achievements); setStatus('Аккаунт загружен'); updateWeatherVisual(); turboBtn.textContent = 'Turbo';
  } catch (e) { setStatus('Ошибка загрузки аккаунта'); console.error(e); }
}

resetPlane(); resetVisuals(); updateUI(); updatePreview(); updateRivals(); state.musicTimer = setInterval(() => { if (!soundEnabled) return; const base = state.running ? (state.multiplier > 3 ? 520 : 420) : 320; beep(base, 0.05, "sine", 0.01); }, 900); boot();
