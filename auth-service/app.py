import os
import datetime
import bcrypt
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
JWT_ISS = "mystery-box-app"


def get_db():
    return psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def make_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "iss": JWT_ISS,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


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
    """Decorator – returns 401/403 if caller doesn't have one of the given roles."""
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


# ── Register ─────────────────────────────────────────────────────────────────
@app.post("/auth/register")
def register():
    data = request.get_json(force=True)
    mail = (data.get("mail") or "").strip()
    password = (data.get("password") or "").strip()
    if not mail or not password:
        return jsonify({"error": "mail and password required"}), 400

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute('SELECT id FROM "user" WHERE mail = %s', (mail,))
            if cur.fetchone():
                return jsonify({"error": "Email already registered"}), 409
            hashed = hash_password(password)
            cur.execute(
                'INSERT INTO "user" (mail, password) VALUES (%s, %s) RETURNING id, mail, role, deposit, score',
                (mail, hashed),
            )
            user = dict(cur.fetchone())
        token = make_token(user["id"], user["role"])
        return jsonify({"token": token, "user": user}), 201
    finally:
        conn.close()


# ── Login ─────────────────────────────────────────────────────────────────────
@app.post("/auth/login")
def login():
    data = request.get_json(force=True)
    mail = (data.get("mail") or "").strip()
    password = (data.get("password") or "").strip()
    if not mail or not password:
        return jsonify({"error": "mail and password required"}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id, mail, password, role, deposit, score FROM "user" WHERE mail = %s',
                (mail,),
            )
            row = cur.fetchone()
        if not row or not check_password(password, row["password"]):
            return jsonify({"error": "Invalid credentials"}), 401
        user = {k: row[k] for k in ("id", "mail", "role", "deposit", "score")}
        token = make_token(user["id"], user["role"])
        return jsonify({"token": token, "user": user})
    finally:
        conn.close()


# ── Me ────────────────────────────────────────────────────────────────────────
@app.get("/auth/me")
def me():
    user_claims = current_user()
    if not user_claims:
        return jsonify({"error": "Unauthorized"}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id, mail, role, deposit, score FROM "user" WHERE id = %s',
                (user_claims["user_id"],),
            )
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404
        return jsonify(dict(row))
    finally:
        conn.close()


# ── List users (admin) ────────────────────────────────────────────────────────
@app.get("/auth/users")
@require_role("admin")
def list_users():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT id, mail, role, deposit, score FROM "user" ORDER BY mail')
            rows = [dict(r) for r in cur.fetchall()]
        return jsonify(rows)
    finally:
        conn.close()


# ── Change role (admin) ───────────────────────────────────────────────────────
@app.put("/auth/users/<user_id>/role")
@require_role("admin")
def change_role(user_id):
    data = request.get_json(force=True)
    role = (data.get("role") or "").strip()
    if role not in ("user", "creator", "admin"):
        return jsonify({"error": "role must be user, creator or admin"}), 400

    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                'UPDATE "user" SET role = %s::user_role WHERE id = %s RETURNING id, mail, role',
                (role, user_id),
            )
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404
        return jsonify(dict(row))
    finally:
        conn.close()


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/auth/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
