import os
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


def current_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        return jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM],
                          options={"verify_iss": False})
    except Exception:
        return None


def require_auth(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper


# ── Deposit ────────────────────────────────────────────────────────────────────
@app.post("/payments/deposit")
@require_auth
def deposit():
    user = current_user()
    data = request.get_json(force=True)
    amount = data.get("amount")
    if not amount or int(amount) <= 0:
        return jsonify({"error": "amount must be a positive integer"}), 400
    amount = int(amount)

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                'UPDATE "user" SET deposit = deposit + %s WHERE id = %s RETURNING id, deposit',
                (amount, user["user_id"]),
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "User not found"}), 404

            # record the transaction as an order with status='deposit'
            cur.execute(
                'INSERT INTO "order" (user_id, amount, status) VALUES (%s, %s, %s) RETURNING id',
                (user["user_id"], amount, "deposit"),
            )
            order_id = cur.fetchone()["id"]

        return jsonify({"deposit": row["deposit"], "transaction_id": order_id})
    finally:
        conn.close()


# ── Balance ────────────────────────────────────────────────────────────────────
@app.get("/payments/balance")
@require_auth
def balance():
    user = current_user()
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT deposit FROM "user" WHERE id = %s',
                (user["user_id"],),
            )
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404
        return jsonify({"balance": row["deposit"]})
    finally:
        conn.close()


# ── Transaction history ────────────────────────────────────────────────────────
@app.get("/payments/transactions")
@require_auth
def transactions():
    user = current_user()
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT o.id, o.amount, o.status, o.created_at,
                       b.name AS box_name, i.name AS item_name
                FROM "order" o
                LEFT JOIN box b ON b.id = o.box_id
                LEFT JOIN item i ON i.id = o.item_id
                WHERE o.user_id = %s
                ORDER BY o.created_at DESC
                """,
                (user["user_id"],),
            )
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
@app.get("/payments/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5003, debug=False)
