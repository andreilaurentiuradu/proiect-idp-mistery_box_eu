import os
import random
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


# ── Items ──────────────────────────────────────────────────────────────────────
@app.get("/api/items")
@require_auth
def list_items():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM item ORDER BY name")
            return jsonify([dict(r) for r in cur.fetchall()])
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
            return jsonify(dict(cur.fetchone())), 201
    finally:
        conn.close()


@app.get("/api/items/<item_id>")
@require_auth
def get_item(item_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM item WHERE id = %s", (item_id,))
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "Not found"}), 404
        return jsonify(dict(row))
    finally:
        conn.close()


# ── Boxes ──────────────────────────────────────────────────────────────────────
@app.get("/api/boxes")
@require_auth
def list_boxes():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM box ORDER BY name")
            boxes = [dict(r) for r in cur.fetchall()]
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
            cur.execute(
                """
                SELECT bti.*, i.name AS item_name, i.points, i.description
                FROM box_to_item bti
                JOIN item i ON i.id = bti.item_id
                WHERE bti.box_id = %s
                ORDER BY bti.pull_probability DESC
                """,
                (box_id,),
            )
            box["items"] = [dict(r) for r in cur.fetchall()]
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
            return jsonify(dict(cur.fetchone())), 201
    finally:
        conn.close()


@app.post("/api/boxes/<box_id>/items")
@require_role("creator", "admin")
def add_item_to_box(box_id):
    """Add an item to a box with a probability and initial stock."""
    data = request.get_json(force=True)
    item_id = data.get("item_id")
    pull_probability = int(data.get("pull_probability", 1))
    stock = int(data.get("stock", 0))
    if not item_id:
        return jsonify({"error": "item_id required"}), 400

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            # verify box and item exist
            cur.execute("SELECT id FROM box WHERE id = %s", (box_id,))
            if not cur.fetchone():
                return jsonify({"error": "Box not found"}), 404
            cur.execute("SELECT id FROM item WHERE id = %s", (item_id,))
            if not cur.fetchone():
                return jsonify({"error": "Item not found"}), 404

            cur.execute(
                """
                INSERT INTO box_to_item (box_id, item_id, pull_probability, stock)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING *
                """,
                (box_id, item_id, pull_probability, stock),
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Item already in box"}), 409
            return jsonify(dict(row)), 201
    finally:
        conn.close()


@app.patch("/api/boxes/<box_id>/items/<item_id>/stock")
@require_role("creator", "admin")
def update_stock(box_id, item_id):
    """Add stock to a box-item entry."""
    data = request.get_json(force=True)
    amount = int(data.get("amount", 0))
    if amount <= 0:
        return jsonify({"error": "amount must be positive"}), 400

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE box_to_item SET stock = stock + %s
                WHERE box_id = %s AND item_id = %s
                RETURNING *
                """,
                (amount, box_id, item_id),
            )
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "box-item association not found"}), 404
        return jsonify(dict(row))
    finally:
        conn.close()


# ── Pull (buy from box) ────────────────────────────────────────────────────────
@app.post("/api/boxes/<box_id>/pull")
@require_auth
def pull_box(box_id):
    user = current_user()
    user_id = user["user_id"]

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            # lock user row
            cur.execute(
                'SELECT deposit FROM "user" WHERE id = %s FOR UPDATE',
                (user_id,),
            )
            u = cur.fetchone()
            if not u:
                return jsonify({"error": "User not found"}), 404

            cur.execute("SELECT cost FROM box WHERE id = %s", (box_id,))
            box = cur.fetchone()
            if not box:
                return jsonify({"error": "Box not found"}), 404

            if u["deposit"] < box["cost"]:
                return jsonify({"error": "Insufficient funds"}), 402

            # fetch available items
            cur.execute(
                """
                SELECT bti.id AS bti_id, bti.item_id, bti.pull_probability, bti.stock,
                       i.name AS item_name, i.points, i.description
                FROM box_to_item bti
                JOIN item i ON i.id = bti.item_id
                WHERE bti.box_id = %s AND bti.stock > 0
                """,
                (box_id,),
            )
            available = cur.fetchall()
            if not available:
                return jsonify({"error": "Box is empty"}), 409

            # weighted random selection
            total = sum(r["pull_probability"] for r in available)
            rand = random.uniform(0, total)
            cumulative = 0
            chosen = None
            for row in available:
                cumulative += row["pull_probability"]
                if rand <= cumulative:
                    chosen = row
                    break
            if not chosen:
                chosen = available[-1]

            # deduct cost from user deposit
            cur.execute(
                'UPDATE "user" SET deposit = deposit - %s WHERE id = %s',
                (box["cost"], user_id),
            )

            # decrement stock
            cur.execute(
                "UPDATE box_to_item SET stock = stock - 1 WHERE id = %s",
                (chosen["bti_id"],),
            )

            # add item to user inventory (upsert)
            cur.execute(
                """
                INSERT INTO user_items (user_id, item_id, box_id, count)
                VALUES (%s, %s, %s, 1)
                ON CONFLICT DO NOTHING
                RETURNING id
                """,
                (user_id, chosen["item_id"], box_id),
            )
            if not cur.fetchone():
                cur.execute(
                    """
                    UPDATE user_items SET count = count + 1
                    WHERE user_id = %s AND item_id = %s AND box_id = %s
                    """,
                    (user_id, chosen["item_id"], box_id),
                )

            # add score to user
            cur.execute(
                'UPDATE "user" SET score = score + %s WHERE id = %s',
                (chosen["points"], user_id),
            )

            # create order
            cur.execute(
                'INSERT INTO "order" (user_id, box_id, item_id, amount, status) VALUES (%s, %s, %s, %s, %s) RETURNING id',
                (user_id, box_id, chosen["item_id"], box["cost"], "completed"),
            )
            order_id = cur.fetchone()["id"]

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


# ── Inventory ──────────────────────────────────────────────────────────────────
@app.get("/api/inventory")
@require_auth
def inventory():
    user = current_user()
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ui.id, ui.count, ui.box_id,
                       i.id AS item_id, i.name, i.points, i.description,
                       b.name AS box_name
                FROM user_items ui
                JOIN item i ON i.id = ui.item_id
                LEFT JOIN box b ON b.id = ui.box_id
                WHERE ui.user_id = %s
                ORDER BY i.name
                """,
                (user["user_id"],),
            )
            return jsonify([dict(r) for r in cur.fetchall()])
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
            cur.execute(
                """
                SELECT o.*, b.name AS box_name, i.name AS item_name
                FROM "order" o
                LEFT JOIN box b ON b.id = o.box_id
                LEFT JOIN item i ON i.id = o.item_id
                WHERE o.user_id = %s
                ORDER BY o.id DESC
                """,
                (user["user_id"],),
            )
            return jsonify([dict(r) for r in cur.fetchall()])
    finally:
        conn.close()


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=False)
