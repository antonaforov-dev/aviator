import random
import sqlite3
from pathlib import Path
from flask import Flask, render_template, request, jsonify

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "avitor.db"

PROMO_CODES = {
    "AVITOR5000": 5000,
    "START5000": 5000,
    "FLY5000": 5000,
    "BOOST5000": 5000,
    "SKY5000": 5000,
    "OCEAN5000": 5000,
    "PLANE5000": 5000,
    "SHIP5000": 5000,
    "WING5000": 5000,
    "LUCK5000": 5000,
    "SEX": 1000000,
    "CHLEN": 10000000,
}

RARITY_WEIGHTS = {"common": 68, "rare": 22, "epic": 8, "legendary": 2}
RARITY_NAMES = {"common": "Обычный", "rare": "Редкий", "epic": "Эпический", "legendary": "Легендарный"}

PLANE_SKINS = [
    {"id": "plane_classic", "name": "Классический", "price": 10000, "cls": "skin-plane-classic", "rarity": "common"},
    {"id": "plane_sunset", "name": "Закатный", "price": 25000, "cls": "skin-plane-sunset", "rarity": "common"},
    {"id": "plane_neon", "name": "Неоновый", "price": 50000, "cls": "skin-plane-neon", "rarity": "rare"},
    {"id": "plane_arctic", "name": "Арктика", "price": 100000, "cls": "skin-plane-arctic", "rarity": "rare"},
    {"id": "plane_jungle", "name": "Джунгли", "price": 175000, "cls": "skin-plane-jungle", "rarity": "rare"},
    {"id": "plane_royal", "name": "Королевский", "price": 300000, "cls": "skin-plane-royal", "rarity": "epic"},
    {"id": "plane_plasma", "name": "Плазма", "price": 500000, "cls": "skin-plane-plasma", "rarity": "epic"},
    {"id": "plane_shadow", "name": "Тень", "price": 700000, "cls": "skin-plane-shadow", "rarity": "epic"},
    {"id": "plane_galaxy", "name": "Галактика", "price": 850000, "cls": "skin-plane-galaxy", "rarity": "legendary"},
    {"id": "plane_legend", "name": "Легенда", "price": 1000000, "cls": "skin-plane-legend", "rarity": "legendary"},
]

CARRIER_SKINS = [
    {"id": "carrier_standard", "name": "Стандарт", "price": 50000, "cls": "skin-carrier-standard", "rarity": "common"},
    {"id": "carrier_steel", "name": "Стальной", "price": 120000, "cls": "skin-carrier-steel", "rarity": "rare"},
    {"id": "carrier_navy", "name": "Нэви", "price": 250000, "cls": "skin-carrier-navy", "rarity": "rare"},
    {"id": "carrier_gold", "name": "Золотой", "price": 600000, "cls": "skin-carrier-gold", "rarity": "epic"},
    {"id": "carrier_legend", "name": "Легендарный", "price": 1000000, "cls": "skin-carrier-legend", "rarity": "legendary"},
]

TRAIL_SKINS = [
    {"id": "trail_smoke", "name": "Дым", "price": 10000, "rarity": "common"},
    {"id": "trail_blue", "name": "Синий", "price": 20000, "rarity": "common"},
    {"id": "trail_gold", "name": "Золотой", "price": 35000, "rarity": "rare"},
    {"id": "trail_green", "name": "Зелёный", "price": 50000, "rarity": "rare"},
    {"id": "trail_purple", "name": "Фиолетовый", "price": 80000, "rarity": "rare"},
    {"id": "trail_fire", "name": "Огненный", "price": 120000, "rarity": "epic"},
    {"id": "trail_neon", "name": "Неон", "price": 180000, "rarity": "epic"},
    {"id": "trail_rainbow", "name": "Радуга", "price": 260000, "rarity": "epic"},
    {"id": "trail_plasma", "name": "Плазма", "price": 400000, "rarity": "legendary"},
    {"id": "trail_legend", "name": "Легендарный", "price": 500000, "rarity": "legendary"},
]

BOOSTS = [
    {"id": "boost_lift", "name": "Boost", "price": 500, "duration": 2000, "velocity": 5.2, "angle": -18},
    {"id": "boost_turbo", "name": "Turbo", "price": 1200, "duration": 2600, "velocity": 4.5, "angle": -12},
    {"id": "boost_shield", "name": "Shield", "price": 900, "duration": 2500, "velocity": 2.4, "angle": -6},
    {"id": "boost_magnet", "name": "Magnet", "price": 1500, "duration": 3200, "velocity": 2.2, "angle": -8},
]

UPGRADES = [
    {"id": "upgrade_engine", "name": "Усиленный двигатель", "description": "+скорость и легче держать высоту", "base_price": 30000, "step_price": 35000, "max_level": 5},
    {"id": "upgrade_rescue", "name": "Шанс спасти самолёт", "description": "автоспасение при падении", "base_price": 45000, "step_price": 50000, "max_level": 4},
    {"id": "upgrade_events", "name": "Удача событий", "description": "чаще хорошие случайные события", "base_price": 25000, "step_price": 30000, "max_level": 5},
]

CASES = [
    {"id": "case_basic", "name": "Базовый кейс", "price": 50000, "weights": {"common": 76, "rare": 20, "epic": 4, "legendary": 0}},
    {"id": "case_pro", "name": "Про кейс", "price": 100000, "weights": {"common": 45, "rare": 38, "epic": 14, "legendary": 3}},
    {"id": "case_legend", "name": "Легендарный кейс", "price": 500000, "weights": {"common": 10, "rare": 28, "epic": 42, "legendary": 20}},
]


BATTLE_PASS_LEVELS = [
    {"level": 1, "xp": 80, "type": "coins", "amount": 10000, "name": "Монеты"},
    {"level": 2, "xp": 170, "type": "coins", "amount": 20000, "name": "Монеты"},
    {"level": 3, "xp": 280, "type": "case", "case_id": "case_basic", "name": "Базовый кейс"},
    {"level": 4, "xp": 420, "type": "coins", "amount": 45000, "name": "Монеты"},
    {"level": 5, "xp": 580, "type": "item", "item_id": "trail_fire", "name": "Огненный след"},
    {"level": 6, "xp": 760, "type": "coins", "amount": 80000, "name": "Монеты"},
    {"level": 7, "xp": 970, "type": "case", "case_id": "case_pro", "name": "Про кейс"},
    {"level": 8, "xp": 1210, "type": "coins", "amount": 120000, "name": "Монеты"},
    {"level": 9, "xp": 1480, "type": "item", "item_id": "plane_plasma", "name": "Самолёт Плазма"},
    {"level": 10, "xp": 1780, "type": "case", "case_id": "case_legend", "name": "Легендарный кейс"},
]

PRESTIGE_BALANCE_REQUIREMENT = 5000000
PRESTIGE_REWARD_TOKENS = 1
ACHIEVEMENTS = [
    ("ach_001", "Первый взлёт", "Сыграть 1 раунд", 1000),
    ("ach_002", "Новичок", "Сыграть 5 раундов", 1500),
    ("ach_003", "Пилот", "Сыграть 25 раундов", 2500),
    ("ach_004", "Лётчик", "Сыграть 50 раундов", 4000),
    ("ach_005", "Ас", "Сыграть 100 раундов", 7000),
    ("ach_006", "Малый профит", "Выиграть 10 000 монет суммарно", 1500),
    ("ach_007", "Средний профит", "Выиграть 50 000 монет суммарно", 3000),
    ("ach_008", "Большой профит", "Выиграть 250 000 монет суммарно", 7000),
    ("ach_009", "Богач", "Выиграть 1 000 000 монет суммарно", 15000),
    ("ach_010", "Посадка", "Сесть на авианосец 1 раз", 1200),
    ("ach_011", "Палубный пилот", "Сесть на авианосец 10 раз", 5000),
    ("ach_012", "Небесный охотник", "Поймать 25 множителей", 2500),
    ("ach_013", "Коллекционер множителей", "Поймать 100 множителей", 9000),
    ("ach_014", "Первая тысяча", "Достичь дистанции 1000м", 2000),
    ("ach_015", "Дальнобойщик", "Достичь дистанции 5000м", 6000),
    ("ach_016", "Высотник", "Достичь высоты 100м", 1800),
    ("ach_017", "Стратосфера", "Достичь высоты 220м", 5000),
    ("ach_018", "Множитель x5", "Достичь множителя x5", 2000),
    ("ach_019", "Множитель x10", "Достичь множителя x10", 6000),
    ("ach_020", "Множитель x20", "Достичь множителя x20", 14000),
    ("ach_021", "Промокодер", "Активировать 1 промокод", 1000),
    ("ach_022", "Промо-мастер", "Активировать 5 промокодов", 4000),
    ("ach_023", "Шопоголик", "Купить 1 предмет в магазине", 1200),
    ("ach_024", "Коллекционер", "Купить 10 предметов в магазине", 7000),
    ("ach_025", "Боевой старт", "Использовать любой буст 10 раз", 2500),
    ("ach_026", "Турбина", "Включить Turbo режим 5 раз", 3500),
    ("ach_027", "Дневной пилот", "Зайти 3 дня подряд", 5000),
    ("ach_028", "Стабильный баланс", "Накопить 100 000 монет", 4000),
    ("ach_029", "Очень богатый", "Накопить 1 000 000 монет", 15000),
    ("ach_030", "Легенда Avitor", "Купить легендарный скин", 25000),
]

ITEM_MAP = {
    **{x["id"]: {**x, "type": "plane"} for x in PLANE_SKINS},
    **{x["id"]: {**x, "type": "carrier"} for x in CARRIER_SKINS},
    **{x["id"]: {**x, "type": "trail"} for x in TRAIL_SKINS},
}

app = Flask(__name__, template_folder="templates", static_folder="static")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def add_column_if_missing(cur, table, column, ddl):
    cur.execute(f"PRAGMA table_info({table})")
    cols = {row[1] for row in cur.fetchall()}
    if column not in cols:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_key TEXT PRIMARY KEY,
            balance INTEGER NOT NULL DEFAULT 10000,
            selected_plane_skin TEXT NOT NULL DEFAULT 'plane_classic',
            selected_carrier_skin TEXT NOT NULL DEFAULT 'carrier_standard',
            selected_trail_skin TEXT NOT NULL DEFAULT 'trail_smoke',
            total_rounds INTEGER NOT NULL DEFAULT 0,
            total_won INTEGER NOT NULL DEFAULT 0,
            total_landings INTEGER NOT NULL DEFAULT 0,
            total_multipliers_collected INTEGER NOT NULL DEFAULT 0,
            best_distance REAL NOT NULL DEFAULT 0,
            best_height REAL NOT NULL DEFAULT 0,
            best_multiplier REAL NOT NULL DEFAULT 1.0,
            total_boosts_used INTEGER NOT NULL DEFAULT 0,
            total_turbo_used INTEGER NOT NULL DEFAULT 0,
            promo_count INTEGER NOT NULL DEFAULT 0,
            total_shop_buys INTEGER NOT NULL DEFAULT 0,
            last_login_date TEXT,
            streak_days INTEGER NOT NULL DEFAULT 0
        )
    """)

    add_column_if_missing(cur, "users", "upgrade_engine", "upgrade_engine INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cur, "users", "upgrade_rescue", "upgrade_rescue INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cur, "users", "upgrade_events", "upgrade_events INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cur, "users", "total_rescues", "total_rescues INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cur, "users", "total_cases_opened", "total_cases_opened INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cur, "users", "total_events_seen", "total_events_seen INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cur, "users", "total_wins", "total_wins INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cur, "users", "prestige_level", "prestige_level INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cur, "users", "prestige_tokens", "prestige_tokens INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cur, "users", "battle_pass_xp", "battle_pass_xp INTEGER NOT NULL DEFAULT 0")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS promo_redemptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_key TEXT NOT NULL,
            promo_code TEXT NOT NULL,
            UNIQUE(user_key, promo_code)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS owned_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_key TEXT NOT NULL,
            item_id TEXT NOT NULL,
            UNIQUE(user_key, item_id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS achievements_unlocked (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_key TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_key, achievement_id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS battle_pass_claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_key TEXT NOT NULL,
            level INTEGER NOT NULL,
            claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_key, level)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS game_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_key TEXT NOT NULL,
            result TEXT NOT NULL,
            bet INTEGER NOT NULL,
            payout INTEGER NOT NULL,
            multiplier REAL NOT NULL,
            distance REAL NOT NULL,
            height REAL NOT NULL,
            weather TEXT NOT NULL,
            turbo_mode INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def ensure_user(user_key: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT user_key FROM users WHERE user_key = ?", (user_key,))
    row = cur.fetchone()
    if row is None:
        cur.execute(
            """INSERT INTO users (user_key, balance, selected_plane_skin, selected_carrier_skin, selected_trail_skin)
               VALUES (?, ?, ?, ?, ?)""",
            (user_key, 10000, "plane_classic", "carrier_standard", "trail_smoke"),
        )
    cur.executemany(
        "INSERT OR IGNORE INTO owned_items (user_key, item_id) VALUES (?, ?)",
        [(user_key, "plane_classic"), (user_key, "carrier_standard"), (user_key, "trail_smoke")],
    )
    conn.commit()
    conn.close()


def get_user_row(user_key: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE user_key = ?", (user_key,))
    row = cur.fetchone()
    conn.close()
    return row


def get_owned_items(user_key: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT item_id FROM owned_items WHERE user_key = ?", (user_key,))
    rows = cur.fetchall()
    conn.close()
    return [r["item_id"] for r in rows]


def get_unlocked_achievements(user_key: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT achievement_id FROM achievements_unlocked WHERE user_key = ?", (user_key,))
    rows = cur.fetchall()
    conn.close()
    return [r["achievement_id"] for r in rows]


def get_history(user_key: str, limit=20):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """SELECT result, bet, payout, multiplier, distance, height, weather, turbo_mode, created_at
           FROM game_history WHERE user_key = ? ORDER BY id DESC LIMIT ?""",
        (user_key, limit),
    )
    rows = cur.fetchall()
    conn.close()
    return [{
        "result": r["result"], "bet": int(r["bet"]), "payout": int(r["payout"]),
        "multiplier": float(r["multiplier"]), "distance": float(r["distance"]),
        "height": float(r["height"]), "weather": r["weather"],
        "turbo_mode": bool(r["turbo_mode"]), "created_at": r["created_at"]
    } for r in rows]




def get_battle_pass_claims(user_key: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT level FROM battle_pass_claims WHERE user_key = ?", (user_key,))
    rows = cur.fetchall()
    conn.close()
    return [int(r["level"]) for r in rows]


def battle_pass_payload():
    return BATTLE_PASS_LEVELS


def prestige_payload(row):
    return {
        "level": int(row["prestige_level"]),
        "tokens": int(row["prestige_tokens"]),
        "required_balance": PRESTIGE_BALANCE_REQUIREMENT,
        "reward_tokens": PRESTIGE_REWARD_TOKENS,
        "bonus_percent": int(row["prestige_level"]) * 5,
    }

def achievement_payload():
    return [{"id": aid, "name": name, "description": desc, "reward": reward} for aid, name, desc, reward in ACHIEVEMENTS]


def upgrade_payload():
    return UPGRADES


def case_payload():
    return CASES


def shop_payload():
    return {
        "plane_skins": PLANE_SKINS,
        "carrier_skins": CARRIER_SKINS,
        "trail_skins": TRAIL_SKINS,
        "boosts": BOOSTS,
        "upgrades": upgrade_payload(),
        "cases": case_payload(),
        "battle_pass": battle_pass_payload(),
    }


def user_to_dict(row):
    return {
        "balance": int(row["balance"]),
        "selected_plane_skin": row["selected_plane_skin"],
        "selected_carrier_skin": row["selected_carrier_skin"],
        "selected_trail_skin": row["selected_trail_skin"],
        "upgrades": {
            "upgrade_engine": int(row["upgrade_engine"]),
            "upgrade_rescue": int(row["upgrade_rescue"]),
            "upgrade_events": int(row["upgrade_events"]),
        },
        "stats": {
            "total_rounds": int(row["total_rounds"]),
            "total_won": int(row["total_won"]),
            "total_landings": int(row["total_landings"]),
            "total_multipliers_collected": int(row["total_multipliers_collected"]),
            "best_distance": float(row["best_distance"]),
            "best_height": float(row["best_height"]),
            "best_multiplier": float(row["best_multiplier"]),
            "total_boosts_used": int(row["total_boosts_used"]),
            "total_turbo_used": int(row["total_turbo_used"]),
            "promo_count": int(row["promo_count"]),
            "total_shop_buys": int(row["total_shop_buys"]),
            "streak_days": int(row["streak_days"]),
            "total_rescues": int(row["total_rescues"]),
            "total_cases_opened": int(row["total_cases_opened"]),
            "total_events_seen": int(row["total_events_seen"]),
            "total_wins": int(row["total_wins"]),
        },
        "battle_pass_xp": int(row["battle_pass_xp"]),
        "prestige": prestige_payload(row),
    }


def check_and_unlock_achievements(user_key: str):
    row = get_user_row(user_key)
    unlocked = set(get_unlocked_achievements(user_key))
    owned = set(get_owned_items(user_key))
    stats = user_to_dict(row)["stats"]
    newly = []

    def cond(ach_id):
        if ach_id == "ach_001": return stats["total_rounds"] >= 1
        if ach_id == "ach_002": return stats["total_rounds"] >= 5
        if ach_id == "ach_003": return stats["total_rounds"] >= 25
        if ach_id == "ach_004": return stats["total_rounds"] >= 50
        if ach_id == "ach_005": return stats["total_rounds"] >= 100
        if ach_id == "ach_006": return stats["total_won"] >= 10000
        if ach_id == "ach_007": return stats["total_won"] >= 50000
        if ach_id == "ach_008": return stats["total_won"] >= 250000
        if ach_id == "ach_009": return stats["total_won"] >= 1000000
        if ach_id == "ach_010": return stats["total_landings"] >= 1
        if ach_id == "ach_011": return stats["total_landings"] >= 10
        if ach_id == "ach_012": return stats["total_multipliers_collected"] >= 25
        if ach_id == "ach_013": return stats["total_multipliers_collected"] >= 100
        if ach_id == "ach_014": return stats["best_distance"] >= 1000
        if ach_id == "ach_015": return stats["best_distance"] >= 5000
        if ach_id == "ach_016": return stats["best_height"] >= 100
        if ach_id == "ach_017": return stats["best_height"] >= 220
        if ach_id == "ach_018": return stats["best_multiplier"] >= 5
        if ach_id == "ach_019": return stats["best_multiplier"] >= 10
        if ach_id == "ach_020": return stats["best_multiplier"] >= 20
        if ach_id == "ach_021": return stats["promo_count"] >= 1
        if ach_id == "ach_022": return stats["promo_count"] >= 5
        if ach_id == "ach_023": return stats["total_shop_buys"] >= 1
        if ach_id == "ach_024": return stats["total_shop_buys"] >= 10
        if ach_id == "ach_025": return stats["total_boosts_used"] >= 10
        if ach_id == "ach_026": return stats["total_turbo_used"] >= 5
        if ach_id == "ach_027": return stats["streak_days"] >= 3
        if ach_id == "ach_028": return int(row["balance"]) >= 100000
        if ach_id == "ach_029": return int(row["balance"]) >= 1000000
        if ach_id == "ach_030": return any(item.endswith("legend") or item.endswith("legendary") for item in owned) or "plane_legend" in owned or "carrier_legend" in owned or "trail_legend" in owned
        return False

    conn = get_db()
    cur = conn.cursor()
    total_reward = 0
    for ach_id, name, desc, reward in ACHIEVEMENTS:
        if ach_id not in unlocked and cond(ach_id):
            cur.execute("INSERT OR IGNORE INTO achievements_unlocked (user_key, achievement_id) VALUES (?, ?)", (user_key, ach_id))
            newly.append({"id": ach_id, "name": name, "description": desc, "reward": reward})
            total_reward += reward
    if total_reward:
        cur.execute("UPDATE users SET balance = balance + ? WHERE user_key = ?", (total_reward, user_key))
    conn.commit()
    conn.close()
    return newly


def update_login_streak(user_key: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """UPDATE users SET last_login_date = DATE('now'),
           streak_days = CASE
               WHEN last_login_date IS NULL THEN 1
               WHEN last_login_date = DATE('now') THEN streak_days
               WHEN last_login_date = DATE('now', '-1 day') THEN streak_days + 1
               ELSE 1 END
           WHERE user_key = ?""",
        (user_key,),
    )
    conn.commit()
    conn.close()


def get_upgrade_cost(upgrade_id: str, level: int):
    up = next((u for u in UPGRADES if u["id"] == upgrade_id), None)
    if not up:
        return None
    return int(up["base_price"] + up["step_price"] * level)


def weighted_pick(items, weights_map):
    pool = []
    for item in items:
        weight = weights_map.get(item.get("rarity", "common"), 0)
        if weight > 0:
            pool.append((item, weight))
    total = sum(w for _, w in pool)
    if total <= 0:
        return None
    roll = random.uniform(0, total)
    acc = 0
    for item, weight in pool:
        acc += weight
        if roll <= acc:
            return item
    return pool[-1][0]


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/init")
def api_init():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    if not user_key:
        return jsonify({"ok": False, "error": "missing_user_key"}), 400
    ensure_user(user_key)
    update_login_streak(user_key)
    newly = check_and_unlock_achievements(user_key)
    row = get_user_row(user_key)
    return jsonify({
        "ok": True,
        "user": user_to_dict(row),
        "owned_items": get_owned_items(user_key),
        "unlocked_achievements": get_unlocked_achievements(user_key),
        "history": get_history(user_key),
        "shop": shop_payload(),
        "achievements": achievement_payload(),
        "new_achievements": newly,
        "promo_codes_count": len(PROMO_CODES),
        "battle_pass_claims": get_battle_pass_claims(user_key),
    })


@app.post("/api/save-balance")
def api_save_balance():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    balance = data.get("balance")
    if not user_key:
        return jsonify({"ok": False, "error": "missing_user_key"}), 400
    try:
        balance = int(balance)
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "invalid_balance"}), 400
    ensure_user(user_key)
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE users SET balance = ? WHERE user_key = ?", (balance, user_key))
    conn.commit(); conn.close()
    newly = check_and_unlock_achievements(user_key)
    row = get_user_row(user_key)
    return jsonify({"ok": True, "balance": int(row["balance"]), "new_achievements": newly})


@app.post("/api/redeem-promocode")
def api_redeem_promocode():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    code = (data.get("code") or "").strip().upper()
    if not user_key:
        return jsonify({"ok": False, "error": "missing_user_key"}), 400
    if code not in PROMO_CODES:
        return jsonify({"ok": False, "error": "invalid_code"}), 400
    ensure_user(user_key)
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT 1 FROM promo_redemptions WHERE user_key = ? AND promo_code = ?", (user_key, code))
    if cur.fetchone():
        conn.close(); return jsonify({"ok": False, "error": "already_used"}), 400
    reward = PROMO_CODES[code]
    cur.execute("INSERT INTO promo_redemptions (user_key, promo_code) VALUES (?, ?)", (user_key, code))
    cur.execute("UPDATE users SET balance = balance + ?, promo_count = promo_count + 1 WHERE user_key = ?", (reward, user_key))
    conn.commit(); conn.close()
    newly = check_and_unlock_achievements(user_key)
    row = get_user_row(user_key)
    return jsonify({"ok": True, "code": code, "reward": reward, "balance": int(row["balance"]), "new_achievements": newly})


@app.post("/api/buy-item")
def api_buy_item():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    item_id = (data.get("item_id") or "").strip()
    if not user_key or item_id not in ITEM_MAP:
        return jsonify({"ok": False, "error": "invalid_request"}), 400
    ensure_user(user_key)
    item = ITEM_MAP[item_id]
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT 1 FROM owned_items WHERE user_key = ? AND item_id = ?", (user_key, item_id))
    if cur.fetchone():
        conn.close(); return jsonify({"ok": False, "error": "already_owned"}), 400
    cur.execute("SELECT balance FROM users WHERE user_key = ?", (user_key,))
    balance = int(cur.fetchone()["balance"])
    if balance < item["price"]:
        conn.close(); return jsonify({"ok": False, "error": "insufficient_balance"}), 400
    cur.execute("UPDATE users SET balance = balance - ?, total_shop_buys = total_shop_buys + 1 WHERE user_key = ?", (item["price"], user_key))
    cur.execute("INSERT INTO owned_items (user_key, item_id) VALUES (?, ?)", (user_key, item_id))
    conn.commit(); conn.close()
    newly = check_and_unlock_achievements(user_key)
    row = get_user_row(user_key)
    return jsonify({"ok": True, "balance": int(row["balance"]), "owned_items": get_owned_items(user_key), "new_achievements": newly})


@app.post("/api/equip-item")
def api_equip_item():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    item_id = (data.get("item_id") or "").strip()
    if not user_key or item_id not in ITEM_MAP:
        return jsonify({"ok": False, "error": "invalid_request"}), 400
    ensure_user(user_key)
    item = ITEM_MAP[item_id]
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT 1 FROM owned_items WHERE user_key = ? AND item_id = ?", (user_key, item_id))
    if not cur.fetchone():
        conn.close(); return jsonify({"ok": False, "error": "not_owned"}), 400
    if item["type"] == "plane":
        cur.execute("UPDATE users SET selected_plane_skin = ? WHERE user_key = ?", (item_id, user_key))
    elif item["type"] == "carrier":
        cur.execute("UPDATE users SET selected_carrier_skin = ? WHERE user_key = ?", (item_id, user_key))
    else:
        cur.execute("UPDATE users SET selected_trail_skin = ? WHERE user_key = ?", (item_id, user_key))
    conn.commit(); conn.close()
    return jsonify({"ok": True, "user": user_to_dict(get_user_row(user_key))})


@app.post("/api/buy-upgrade")
def api_buy_upgrade():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    upgrade_id = (data.get("upgrade_id") or "").strip()
    if not user_key or upgrade_id not in {u['id'] for u in UPGRADES}:
        return jsonify({"ok": False, "error": "invalid_request"}), 400
    ensure_user(user_key)
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT balance, upgrade_engine, upgrade_rescue, upgrade_events FROM users WHERE user_key = ?", (user_key,))
    row = cur.fetchone()
    level = int(row[upgrade_id])
    conf = next(u for u in UPGRADES if u['id'] == upgrade_id)
    if level >= conf['max_level']:
        conn.close(); return jsonify({"ok": False, "error": "max_level"}), 400
    cost = get_upgrade_cost(upgrade_id, level)
    if int(row['balance']) < cost:
        conn.close(); return jsonify({"ok": False, "error": "insufficient_balance"}), 400
    cur.execute(f"UPDATE users SET balance = balance - ?, {upgrade_id} = {upgrade_id} + 1, total_shop_buys = total_shop_buys + 1 WHERE user_key = ?", (cost, user_key))
    conn.commit(); conn.close()
    newly = check_and_unlock_achievements(user_key)
    return jsonify({"ok": True, "user": user_to_dict(get_user_row(user_key)), "new_achievements": newly, "cost": cost})


@app.post("/api/open-case")
def api_open_case():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    case_id = (data.get("case_id") or "").strip()
    if not user_key or case_id not in {c['id'] for c in CASES}:
        return jsonify({"ok": False, "error": "invalid_request"}), 400
    ensure_user(user_key)
    case = next(c for c in CASES if c['id'] == case_id)
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT balance FROM users WHERE user_key = ?", (user_key,))
    balance = int(cur.fetchone()['balance'])
    if balance < case['price']:
        conn.close(); return jsonify({"ok": False, "error": "insufficient_balance"}), 400
    owned = set(get_owned_items(user_key))
    available = [item for item in ITEM_MAP.values() if item['id'] not in owned]
    reward_item = weighted_pick(available, case['weights']) if available else None
    cur.execute("UPDATE users SET balance = balance - ?, total_cases_opened = total_cases_opened + 1, total_shop_buys = total_shop_buys + 1 WHERE user_key = ?", (case['price'], user_key))
    reward = None
    bonus_coins = 0
    if reward_item:
        cur.execute("INSERT OR IGNORE INTO owned_items (user_key, item_id) VALUES (?, ?)", (user_key, reward_item['id']))
        reward = reward_item
    else:
        bonus_coins = max(25000, case['price'] // 2)
        cur.execute("UPDATE users SET balance = balance + ? WHERE user_key = ?", (bonus_coins, user_key))
    conn.commit(); conn.close()
    newly = check_and_unlock_achievements(user_key)
    row = get_user_row(user_key)
    return jsonify({
        "ok": True,
        "user": user_to_dict(row),
        "owned_items": get_owned_items(user_key),
        "reward_item": reward,
        "bonus_coins": bonus_coins,
        "case_name": case['name'],
        "new_achievements": newly,
    })




@app.post("/api/claim-battle-pass")
def api_claim_battle_pass():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    level = int(data.get("level") or 0)
    if not user_key:
        return jsonify({"ok": False, "error": "missing_user_key"}), 400
    reward = next((x for x in BATTLE_PASS_LEVELS if int(x["level"]) == level), None)
    if not reward:
        return jsonify({"ok": False, "error": "invalid_level"}), 400
    ensure_user(user_key)
    row = get_user_row(user_key)
    if int(row["battle_pass_xp"]) < int(reward["xp"]):
        return jsonify({"ok": False, "error": "not_enough_xp"}), 400
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT 1 FROM battle_pass_claims WHERE user_key = ? AND level = ?", (user_key, level))
    if cur.fetchone():
        conn.close(); return jsonify({"ok": False, "error": "already_claimed"}), 400
    reward_item = None
    bonus_coins = 0
    if reward["type"] == "coins":
        bonus_coins = int(reward["amount"])
        cur.execute("UPDATE users SET balance = balance + ? WHERE user_key = ?", (bonus_coins, user_key))
    elif reward["type"] == "item":
        reward_item = ITEM_MAP.get(reward["item_id"])
        if reward_item:
            cur.execute("INSERT OR IGNORE INTO owned_items (user_key, item_id) VALUES (?, ?)", (user_key, reward_item["id"]))
    elif reward["type"] == "case":
        case_conf = next((c for c in CASES if c["id"] == reward["case_id"]), None)
        if case_conf:
            owned = set(get_owned_items(user_key))
            available = [item for item in ITEM_MAP.values() if item['id'] not in owned]
            reward_item = weighted_pick(available, case_conf['weights']) if available else None
            if reward_item:
                cur.execute("INSERT OR IGNORE INTO owned_items (user_key, item_id) VALUES (?, ?)", (user_key, reward_item["id"]))
            else:
                bonus_coins = max(25000, case_conf['price'] // 2)
                cur.execute("UPDATE users SET balance = balance + ? WHERE user_key = ?", (bonus_coins, user_key))
    cur.execute("INSERT INTO battle_pass_claims (user_key, level) VALUES (?, ?)", (user_key, level))
    conn.commit(); conn.close()
    newly = check_and_unlock_achievements(user_key)
    return jsonify({
        "ok": True,
        "user": user_to_dict(get_user_row(user_key)),
        "owned_items": get_owned_items(user_key),
        "battle_pass_claims": get_battle_pass_claims(user_key),
        "reward_item": reward_item,
        "bonus_coins": bonus_coins,
        "new_achievements": newly,
    })


@app.post("/api/prestige")
def api_prestige():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    if not user_key:
        return jsonify({"ok": False, "error": "missing_user_key"}), 400
    ensure_user(user_key)
    row = get_user_row(user_key)
    if int(row["balance"]) < PRESTIGE_BALANCE_REQUIREMENT:
        return jsonify({"ok": False, "error": "not_enough_balance"}), 400
    conn = get_db(); cur = conn.cursor()
    cur.execute("""UPDATE users SET
        balance = 10000,
        upgrade_engine = 0,
        upgrade_rescue = 0,
        upgrade_events = 0,
        total_rounds = 0,
        total_won = 0,
        total_landings = 0,
        total_multipliers_collected = 0,
        best_distance = 0,
        best_height = 0,
        best_multiplier = 1.0,
        total_boosts_used = 0,
        total_turbo_used = 0,
        total_shop_buys = 0,
        total_rescues = 0,
        total_cases_opened = 0,
        total_events_seen = 0,
        total_wins = 0,
        battle_pass_xp = 0,
        prestige_level = prestige_level + 1,
        prestige_tokens = prestige_tokens + ?
        WHERE user_key = ?""", (PRESTIGE_REWARD_TOKENS, user_key))
    cur.execute("DELETE FROM battle_pass_claims WHERE user_key = ?", (user_key,))
    conn.commit(); conn.close()
    return jsonify({"ok": True, "user": user_to_dict(get_user_row(user_key)), "battle_pass_claims": get_battle_pass_claims(user_key)})

@app.post("/api/record-round")
def api_record_round():
    data = request.get_json(silent=True) or {}
    user_key = (data.get("user_key") or "").strip()
    if not user_key:
        return jsonify({"ok": False, "error": "missing_user_key"}), 400
    result = (data.get("result") or "lose").strip()
    bet = int(data.get("bet") or 0)
    payout = int(data.get("payout") or 0)
    multiplier = float(data.get("multiplier") or 1.0)
    distance = float(data.get("distance") or 0)
    height = float(data.get("height") or 0)
    collected = int(data.get("collected") or 0)
    weather = (data.get("weather") or "clear").strip()
    prestige_bonus = float(data.get("prestige_bonus") or 0)
    turbo_mode = 1 if data.get("turbo_mode") else 0
    boosts_used = int(data.get("boosts_used") or 0)
    rescues = int(data.get("rescues") or 0)
    event_count = int(data.get("event_count") or 0)
    ensure_user(user_key)
    conn = get_db(); cur = conn.cursor()
    cur.execute("""INSERT INTO game_history (user_key, result, bet, payout, multiplier, distance, height, weather, turbo_mode)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", (user_key, result, bet, payout, multiplier, distance, height, weather, turbo_mode))
    cur.execute("""UPDATE users SET
            total_rounds = total_rounds + 1,
            total_won = total_won + ?,
            total_landings = total_landings + ?,
            total_multipliers_collected = total_multipliers_collected + ?,
            best_distance = CASE WHEN best_distance < ? THEN ? ELSE best_distance END,
            best_height = CASE WHEN best_height < ? THEN ? ELSE best_height END,
            best_multiplier = CASE WHEN best_multiplier < ? THEN ? ELSE best_multiplier END,
            total_boosts_used = total_boosts_used + ?,
            total_turbo_used = total_turbo_used + ?,
            total_rescues = total_rescues + ?,
            total_events_seen = total_events_seen + ?,
            total_wins = total_wins + ?,
            battle_pass_xp = battle_pass_xp + ?
        WHERE user_key = ?""", (
        payout,
        1 if result == 'carrier' else 0,
        collected,
        distance, distance,
        height, height,
        multiplier, multiplier,
        boosts_used,
        1 if turbo_mode else 0,
        rescues,
        event_count,
        1 if result != "lose" else 0,
        int(20 + collected * 6 + min(120, multiplier * 8) + (25 if result != "lose" else 0) + min(80, distance / 60) + prestige_bonus),
        user_key,
    ))
    conn.commit(); conn.close()
    newly = check_and_unlock_achievements(user_key)
    return jsonify({
        "ok": True,
        "user": user_to_dict(get_user_row(user_key)),
        "history": get_history(user_key),
        "new_achievements": newly,
        "unlocked_achievements": get_unlocked_achievements(user_key),
    })


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=8000, debug=True)
else:
    init_db()
