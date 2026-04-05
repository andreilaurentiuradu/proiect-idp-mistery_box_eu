import os
import json
import random
import redis as redis_lib
import jwt
import psycopg2
import psycopg2.extras
from flask import Flask, request, jsonify
from flask_cors import CORS
from prometheus_flask_exporter import PrometheusMetrics

app = Flask(__name__)
CORS(app)
metrics = PrometheusMetrics(app)

DB_URL = os.environ.get("DATABASE_URL", "postgresql://idp:idp@postgres:5432/idpdb")
JWT_SECRET = os.environ.get("JWT_SECRET", "mysecretkey123")
JWT_ALGORITHM = "HS256"
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")

_redis = None


def get_redis():
    global _redis
    if _redis is None:
        _redis = redis_lib.from_url(REDIS_URL, decode_responses=True)
    return _redis


def get_db():
    return psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def decode_token(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM],
                      options={"verify_iss": False})


def current_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        return decode_token(auth[7:])
    except Exception:
        return None


def require_role(*roles):
    def decorator(f):
        from functools import wraps
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Unauthorized"}), 401
            if user["role"] not in roles:
                return jsonify({"error": "Forbidden"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


def require_auth(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper


# ── Rarity helper ──────────────────────────────────────────────────────────────
def compute_rarity(avg_prob):
    if avg_prob is None:
        return "common"
    p = float(avg_prob)
    if p >= 50:
        return "common"
    elif p >= 20:
        return "rare"
    elif p >= 5:
        return "epic"
    else:
        return "legendary"


# ── Weighted random selection (shared by pull and pull-multi) ─────────────────
def pick_item(available):
    total = sum(r["pull_probability"] for r in available)
    rand = random.uniform(0, total)
    cumulative = 0
    for row in available:
        cumulative += row["pull_probability"]
        if rand <= cumulative:
            return row
    return available[-1]


# ── Items ──────────────────────────────────────────────────────────────────────
@app.get("/api/items")
@require_auth
def list_items():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT i.*, AVG(bti.pull_probability) AS avg_prob
                FROM item i
                LEFT JOIN box_to_item bti ON bti.item_id = i.id
                GROUP BY i.id
                ORDER BY i.name
            """)
            rows = []
            for r in cur.fetchall():
                d = dict(r)
                d["rarity"] = compute_rarity(d.pop("avg_prob", None))
                rows.append(d)
        return jsonify(rows)
    finally:
        conn.close()


@app.post("/api/items")
@require_role("creator", "admin")
def create_item():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    points = int(data.get("points", 0))
    description = data.get("description", "")

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO item (name, points, description) VALUES (%s, %s, %s) RETURNING *",
                (name, points, description),
            )
            d = dict(cur.fetchone())
            d["rarity"] = "common"
            return jsonify(d), 201
    finally:
        conn.close()


@app.get("/api/items/<item_id>")
@require_auth
def get_item(item_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT i.*, AVG(bti.pull_probability) AS avg_prob
                FROM item i
                LEFT JOIN box_to_item bti ON bti.item_id = i.id
                WHERE i.id = %s
                GROUP BY i.id
            """, (item_id,))
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "Not found"}), 404
        d = dict(row)
        d["rarity"] = compute_rarity(d.pop("avg_prob", None))
        return jsonify(d)
    finally:
        conn.close()


# ── Boxes ──────────────────────────────────────────────────────────────────────
@app.get("/api/boxes")
@require_auth
def list_boxes():
    search = request.args.get("search", "").strip()
    min_cost = request.args.get("min_cost", "").strip()
    max_cost = request.args.get("max_cost", "").strip()
    sort = request.args.get("sort", "").strip()

    use_cache = not (search or min_cost or max_cost or sort)

    if use_cache:
        try:
            cached = get_redis().get("boxes:all")
            if cached:
                return jsonify(json.loads(cached))
        except Exception:
            pass

    conditions = []
    params = []
    if search:
        conditions.append("(LOWER(name) LIKE %s OR LOWER(description) LIKE %s)")
        like = f"%{search.lower()}%"
        params += [like, like]
    if min_cost:
        conditions.append("cost >= %s")
        params.append(int(min_cost))
    if max_cost:
        conditions.append("cost <= %s")
        params.append(int(max_cost))

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    order_map = {
        "cheapest": "cost ASC",
        "expensive": "cost DESC",
        "name": "name ASC",
    }
    order_clause = "ORDER BY " + order_map.get(sort, "name ASC")

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM box {where} {order_clause}", params)
            boxes = [dict(r) for r in cur.fetchall()]
        if use_cache:
            try:
                get_redis().setex("boxes:all", 60, json.dumps(boxes))
            except Exception:
                pass
        return jsonify(boxes)
    finally:
        conn.close()


@app.get("/api/boxes/<box_id>")
@require_auth
def get_box(box_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM box WHERE id = %s", (box_id,))
            box = cur.fetchone()
            if not box:
                return jsonify({"error": "Not found"}), 404
            box = dict(box)
            cur.execute("""
                SELECT bti.*, i.name AS item_name, i.points, i.description,
                       sub.avg_prob
                FROM box_to_item bti
                JOIN item i ON i.id = bti.item_id
                LEFT JOIN (
                    SELECT item_id, AVG(pull_probability) AS avg_prob
                    FROM box_to_item GROUP BY item_id
                ) sub ON sub.item_id = bti.item_id
                WHERE bti.box_id = %s
                ORDER BY bti.pull_probability DESC
            """, (box_id,))
            items = []
            for r in cur.fetchall():
                d = dict(r)
                d["rarity"] = compute_rarity(d.pop("avg_prob", None))
                items.append(d)
            box["items"] = items
        return jsonify(box)
    finally:
        conn.close()


@app.post("/api/boxes")
@require_role("creator", "admin")
def create_box():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    cost = data.get("cost")
    if not name or cost is None:
        return jsonify({"error": "name and cost required"}), 400
    description = data.get("description", "")

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO box (name, description, cost) VALUES (%s, %s, %s) RETURNING *",
                (name, description, int(cost)),
            )
            # invalidate boxes cache
            try:
                get_redis().delete("boxes:all")
            except Exception:
                pass
            return jsonify(dict(cur.fetchone())), 201
    finally:
        conn.close()


@app.post("/api/boxes/<box_id>/items")
@require_role("creator", "admin")
def add_item_to_box(box_id):
    data = request.get_json(force=True)
    item_id = data.get("item_id")
    pull_probability = int(data.get("pull_probability", 1))
    stock = int(data.get("stock", 0))
    if not item_id:
        return jsonify({"error": "item_id required"}), 400

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute("SELECT id FROM box WHERE id = %s", (box_id,))
            if not cur.fetchone():
                return jsonify({"error": "Box not found"}), 404
            cur.execute("SELECT id FROM item WHERE id = %s", (item_id,))
            if not cur.fetchone():
                return jsonify({"error": "Item not found"}), 404

            cur.execute("""
                INSERT INTO box_to_item (box_id, item_id, pull_probability, stock)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING *
            """, (box_id, item_id, pull_probability, stock))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Item already in box"}), 409
            return jsonify(dict(row)), 201
    finally:
        conn.close()


@app.patch("/api/boxes/<box_id>/items/<item_id>/stock")
@require_role("creator", "admin")
def update_stock(box_id, item_id):
    data = request.get_json(force=True)
    amount = int(data.get("amount", 0))
    if amount <= 0:
        return jsonify({"error": "amount must be positive"}), 400

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                UPDATE box_to_item SET stock = stock + %s
                WHERE box_id = %s AND item_id = %s
                RETURNING *
            """, (amount, box_id, item_id))
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "box-item association not found"}), 404
        return jsonify(dict(row))
    finally:
        conn.close()


# ── Pull (single) ──────────────────────────────────────────────────────────────
@app.post("/api/boxes/<box_id>/pull")
@require_auth
def pull_box(box_id):
    user = current_user()
    user_id = user["user_id"]

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute('SELECT deposit FROM "user" WHERE id = %s FOR UPDATE', (user_id,))
            u = cur.fetchone()
            if not u:
                return jsonify({"error": "User not found"}), 404

            cur.execute("SELECT cost FROM box WHERE id = %s", (box_id,))
            box = cur.fetchone()
            if not box:
                return jsonify({"error": "Box not found"}), 404

            if u["deposit"] < box["cost"]:
                return jsonify({"error": "Insufficient funds"}), 402

            cur.execute("""
                SELECT bti.id AS bti_id, bti.item_id, bti.pull_probability, bti.stock,
                       i.name AS item_name, i.points, i.description
                FROM box_to_item bti
                JOIN item i ON i.id = bti.item_id
                WHERE bti.box_id = %s AND bti.stock > 0
                FOR UPDATE OF bti
            """, (box_id,))
            available = cur.fetchall()
            if not available:
                return jsonify({"error": "Box is empty"}), 409

            chosen = pick_item(available)

            cur.execute('UPDATE "user" SET deposit = deposit - %s WHERE id = %s', (box["cost"], user_id))
            cur.execute("UPDATE box_to_item SET stock = stock - 1 WHERE id = %s", (chosen["bti_id"],))

            cur.execute("""
                INSERT INTO user_items (user_id, item_id, box_id, count)
                VALUES (%s, %s, %s, 1)
                ON CONFLICT DO NOTHING RETURNING id
            """, (user_id, chosen["item_id"], box_id))
            if not cur.fetchone():
                cur.execute("""
                    UPDATE user_items SET count = count + 1
                    WHERE user_id = %s AND item_id = %s AND box_id = %s
                """, (user_id, chosen["item_id"], box_id))

            cur.execute('UPDATE "user" SET score = score + %s WHERE id = %s', (chosen["points"], user_id))

            cur.execute("""
                INSERT INTO "order" (user_id, box_id, item_id, amount, status)
                VALUES (%s, %s, %s, %s, %s) RETURNING id
            """, (user_id, box_id, chosen["item_id"], box["cost"], "completed"))
            order_id = cur.fetchone()["id"]

            # invalidate leaderboard cache
            try:
                get_redis().delete("leaderboard:top20")
            except Exception:
                pass

        return jsonify({
            "order_id": order_id,
            "item": {
                "id": chosen["item_id"],
                "name": chosen["item_name"],
                "points": chosen["points"],
                "description": chosen["description"],
            },
            "cost": box["cost"],
        })
    finally:
        conn.close()


# ── Pull multi ─────────────────────────────────────────────────────────────────
@app.post("/api/boxes/<box_id>/pull-multi")
@require_auth
def pull_box_multi(box_id):
    user = current_user()
    user_id = user["user_id"]

    data = request.get_json(force=True) or {}
    count = data.get("count")
    try:
        count = int(count)
    except (TypeError, ValueError):
        return jsonify({"error": "count must be an integer"}), 400
    if count < 1 or count > 10:
        return jsonify({"error": "count must be between 1 and 10"}), 400

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute('SELECT deposit FROM "user" WHERE id = %s FOR UPDATE', (user_id,))
            u = cur.fetchone()
            if not u:
                return jsonify({"error": "User not found"}), 404

            cur.execute("SELECT id, cost FROM box WHERE id = %s", (box_id,))
            box = cur.fetchone()
            if not box:
                return jsonify({"error": "Box not found"}), 404

            total_cost = box["cost"] * count
            if u["deposit"] < total_cost:
                return jsonify({"error": "Insufficient deposit"}), 400

            # deduct total cost upfront
            cur.execute('UPDATE "user" SET deposit = deposit - %s WHERE id = %s', (total_cost, user_id))

            won_items = []
            for _ in range(count):
                cur.execute("""
                    SELECT bti.id AS bti_id, bti.item_id, bti.pull_probability, bti.stock,
                           i.name AS item_name, i.points, i.description
                    FROM box_to_item bti
                    JOIN item i ON i.id = bti.item_id
                    WHERE bti.box_id = %s AND bti.stock > 0
                    FOR UPDATE OF bti
                """, (box_id,))
                available = cur.fetchall()
                if not available:
                    conn.rollback()
                    return jsonify({"error": f"Not enough stock for {count} opens"}), 409

                chosen = pick_item(available)

                cur.execute("UPDATE box_to_item SET stock = stock - 1 WHERE id = %s", (chosen["bti_id"],))

                cur.execute("""
                    INSERT INTO user_items (user_id, item_id, box_id, count)
                    VALUES (%s, %s, %s, 1)
                    ON CONFLICT DO NOTHING RETURNING id
                """, (user_id, chosen["item_id"], box_id))
                if not cur.fetchone():
                    cur.execute("""
                        UPDATE user_items SET count = count + 1
                        WHERE user_id = %s AND item_id = %s AND box_id = %s
                    """, (user_id, chosen["item_id"], box_id))

                cur.execute('UPDATE "user" SET score = score + %s WHERE id = %s', (chosen["points"], user_id))

                cur.execute("""
                    INSERT INTO "order" (user_id, box_id, item_id, amount, status)
                    VALUES (%s, %s, %s, %s, %s)
                """, (user_id, box_id, chosen["item_id"], box["cost"], "completed"))

                won_items.append({
                    "id": chosen["item_id"],
                    "name": chosen["item_name"],
                    "points": chosen["points"],
                    "description": chosen["description"],
                })

            try:
                get_redis().delete("leaderboard:top20")
            except Exception:
                pass

        return jsonify({"status": "success", "items": won_items, "total_cost": total_cost})
    finally:
        conn.close()


# ── Inventory ──────────────────────────────────────────────────────────────────
@app.get("/api/inventory")
@require_auth
def inventory():
    user = current_user()
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ui.id, ui.count, ui.box_id,
                       i.id AS item_id, i.name, i.points, i.description,
                       b.name AS box_name,
                       sub.avg_prob
                FROM user_items ui
                JOIN item i ON i.id = ui.item_id
                LEFT JOIN box b ON b.id = ui.box_id
                LEFT JOIN (
                    SELECT item_id, AVG(pull_probability) AS avg_prob
                    FROM box_to_item GROUP BY item_id
                ) sub ON sub.item_id = i.id
                WHERE ui.user_id = %s
                ORDER BY i.name
            """, (user["user_id"],))
            rows = []
            for r in cur.fetchall():
                d = dict(r)
                d["rarity"] = compute_rarity(d.pop("avg_prob", None))
                rows.append(d)
        return jsonify(rows)
    finally:
        conn.close()


# ── Sell item ──────────────────────────────────────────────────────────────────
@app.post("/api/inventory/<item_id>/sell")
@require_auth
def sell_item(item_id):
    user = current_user()
    user_id = user["user_id"]
    data = request.get_json(force=True) or {}
    box_id = data.get("box_id")

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            if box_id:
                cur.execute("""
                    SELECT ui.id, ui.count, i.points, i.name
                    FROM user_items ui
                    JOIN item i ON i.id = ui.item_id
                    WHERE ui.user_id = %s AND ui.item_id = %s AND ui.box_id = %s
                    FOR UPDATE OF ui
                """, (user_id, item_id, box_id))
            else:
                cur.execute("""
                    SELECT ui.id, ui.count, i.points, i.name
                    FROM user_items ui
                    JOIN item i ON i.id = ui.item_id
                    WHERE ui.user_id = %s AND ui.item_id = %s
                    ORDER BY ui.id LIMIT 1
                    FOR UPDATE OF ui
                """, (user_id, item_id))
            row = cur.fetchone()
            if not row or row["count"] == 0:
                return jsonify({"error": "Item not in inventory"}), 404

            sell_price = max(1, row["points"] // 2)

            if row["count"] == 1:
                cur.execute("DELETE FROM user_items WHERE id = %s", (row["id"],))
            else:
                cur.execute("UPDATE user_items SET count = count - 1 WHERE id = %s", (row["id"],))

            cur.execute(
                'UPDATE "user" SET deposit = deposit + %s WHERE id = %s RETURNING deposit',
                (sell_price, user_id),
            )
            new_deposit = cur.fetchone()["deposit"]

        return jsonify({"status": "sold", "sell_price": sell_price, "new_deposit": new_deposit})
    finally:
        conn.close()


# ── History ────────────────────────────────────────────────────────────────────
@app.get("/api/history")
@require_auth
def history():
    user = current_user()
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT o.id, o.created_at, o.amount,
                       b.name AS box_name,
                       i.id AS item_id, i.name AS item_name, i.points,
                       sub.avg_prob
                FROM "order" o
                LEFT JOIN box b ON b.id = o.box_id
                LEFT JOIN item i ON i.id = o.item_id
                LEFT JOIN (
                    SELECT item_id, AVG(pull_probability) AS avg_prob
                    FROM box_to_item GROUP BY item_id
                ) sub ON sub.item_id = o.item_id
                WHERE o.user_id = %s AND o.status = 'completed'
                ORDER BY o.created_at DESC
                LIMIT 50
            """, (user["user_id"],))
            rows = []
            for r in cur.fetchall():
                d = dict(r)
                d["rarity"] = compute_rarity(d.pop("avg_prob", None))
                if d["created_at"]:
                    d["created_at"] = d["created_at"].isoformat()
                rows.append(d)
        return jsonify(rows)
    finally:
        conn.close()


# ── Leaderboard ────────────────────────────────────────────────────────────────
@app.get("/api/leaderboard")
@require_auth
def leaderboard():
    cache_key = "leaderboard:top20"
    try:
        cached = get_redis().get(cache_key)
        if cached:
            return jsonify(json.loads(cached))
    except Exception:
        pass

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT mail, score, deposit
                FROM "user"
                ORDER BY score DESC
                LIMIT 20
            """)
            rows = []
            for i, r in enumerate(cur.fetchall(), start=1):
                display = r["mail"].split("@")[0]
                rows.append({
                    "rank": i,
                    "display_name": display,
                    "score": r["score"],
                    "deposit": r["deposit"],
                })
        try:
            get_redis().setex(cache_key, 60, json.dumps(rows))
        except Exception:
            pass
        return jsonify(rows)
    finally:
        conn.close()


# ── Orders ─────────────────────────────────────────────────────────────────────
@app.get("/api/orders")
@require_auth
def orders():
    user = current_user()
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT o.*, b.name AS box_name, i.name AS item_name
                FROM "order" o
                LEFT JOIN box b ON b.id = o.box_id
                LEFT JOIN item i ON i.id = o.item_id
                WHERE o.user_id = %s
                ORDER BY o.id DESC
            """, (user["user_id"],))
            rows = []
            for r in cur.fetchall():
                d = dict(r)
                if d.get("created_at"):
                    d["created_at"] = d["created_at"].isoformat()
                rows.append(d)
        return jsonify(rows)
    finally:
        conn.close()


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=False)
