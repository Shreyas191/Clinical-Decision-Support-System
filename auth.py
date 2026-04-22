"""
Auth module: Google OAuth2 + email/password, admin approval gate, SQLite user store.

User lifecycle: pending -> approved (by admin) | rejected
ADMIN_EMAIL in .env is auto-approved as admin on first sign-in.

Endpoints:
  POST /auth/signup              -> create account (pending), return JWT
  POST /auth/login               -> verify password, return JWT
  GET  /auth/google              -> redirect to Google consent screen
  GET  /auth/google/callback     -> exchange code, upsert user, redirect to frontend
  GET  /auth/refresh             -> re-read user from DB, return fresh JWT (for pending -> approved transition)
  GET  /auth/me                  -> current user from JWT

  GET    /admin/users            -> list all users (admin only)
  PATCH  /admin/users/{id}/approve
  PATCH  /admin/users/{id}/reject
  DELETE /admin/users/{id}
"""

import os
import sqlite3
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

import bcrypt
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").lower().strip()

_GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo"
_ALGO = "HS256"


# ── Password helpers ──────────────────────────────────────────────────────────
def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── Database ──────────────────────────────────────────────────────────────────
_DATA_DIR = os.getenv("DATA_DIR", os.path.dirname(__file__))
_DB_PATH  = os.path.join(_DATA_DIR, "users.db")


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                email         TEXT UNIQUE NOT NULL,
                name          TEXT NOT NULL,
                password_hash TEXT,
                picture       TEXT DEFAULT '',
                provider      TEXT NOT NULL DEFAULT 'local',
                created_at    TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'pending',
                is_admin      INTEGER NOT NULL DEFAULT 0
            )
        """)
        # Migrate existing tables that predate the approval columns
        for col, defn in [
            ("status",   "TEXT NOT NULL DEFAULT 'pending'"),
            ("is_admin", "INTEGER NOT NULL DEFAULT 0"),
        ]:
            try:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {defn}")
            except sqlite3.OperationalError:
                pass  # column already exists


_init_db()


# ── Helpers ───────────────────────────────────────────────────────────────────
def _is_admin_email(email: str) -> bool:
    return bool(ADMIN_EMAIL) and email.lower().strip() == ADMIN_EMAIL


def _initial_status(email: str) -> tuple[str, int]:
    """Return (status, is_admin) for a new user."""
    if _is_admin_email(email):
        return "approved", 1
    return "pending", 0


def _mint_jwt(row: dict | sqlite3.Row) -> str:
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
    return jwt.encode(
        {
            "sub":      row["id"],
            "email":    row["email"],
            "name":     row["name"],
            "picture":  row["picture"] or "",
            "status":   row["status"],
            "is_admin": bool(row["is_admin"]),
        },
        JWT_SECRET,
        algorithm=_ALGO,
    )


def _upsert_google_user(email: str, name: str, picture: str) -> sqlite3.Row:
    with _db() as conn:
        existing = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            # Update profile info; preserve approval status
            conn.execute(
                "UPDATE users SET name = ?, picture = ? WHERE email = ?",
                (name, picture, email),
            )
            return conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        status, is_admin = _initial_status(email)
        new_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, email, name, picture, provider, created_at, status, is_admin) "
            "VALUES (?, ?, ?, ?, 'google', ?, ?, ?)",
            (new_id, email, name, picture, datetime.now(timezone.utc).isoformat(), status, is_admin),
        )
        return conn.execute("SELECT * FROM users WHERE id = ?", (new_id,)).fetchone()


def _callback_url() -> str:
    return f"{BACKEND_URL}/auth/google/callback"


# ── FastAPI dependencies ──────────────────────────────────────────────────────
def get_current_user(request: Request) -> dict:
    """Validates JWT. Raises 401 if invalid, 403 if account not approved."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = header.removeprefix("Bearer ")
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[_ALGO])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Account pending admin approval")
    return payload


def get_current_admin(request: Request) -> dict:
    user = get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Request / response models ─────────────────────────────────────────────────
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


# ── Auth routes ───────────────────────────────────────────────────────────────
@router.post("/signup", response_model=AuthResponse)
def signup(req: SignupRequest):
    if len(req.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    with _db() as conn:
        if conn.execute("SELECT id FROM users WHERE email = ?", (req.email,)).fetchone():
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        status, is_admin = _initial_status(req.email)
        new_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, email, name, password_hash, provider, created_at, status, is_admin) "
            "VALUES (?, ?, ?, ?, 'local', ?, ?, ?)",
            (new_id, req.email, req.name.strip(), _hash_password(req.password),
             datetime.now(timezone.utc).isoformat(), status, is_admin),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (new_id,)).fetchone()

    token = _mint_jwt(row)
    return AuthResponse(
        token=token,
        user={"id": row["id"], "email": row["email"], "name": row["name"],
              "picture": row["picture"], "status": row["status"], "is_admin": bool(row["is_admin"])},
    )


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    with _db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (req.email,)).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if row["provider"] == "google" and not row["password_hash"]:
        raise HTTPException(status_code=409, detail="This account uses Google sign-in. Use 'Continue with Google'.")
    if not _verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if row["status"] == "rejected":
        raise HTTPException(status_code=403, detail="Account access has been denied. Contact your administrator.")

    token = _mint_jwt(row)
    return AuthResponse(
        token=token,
        user={"id": row["id"], "email": row["email"], "name": row["name"],
              "picture": row["picture"], "status": row["status"], "is_admin": bool(row["is_admin"])},
    )


@router.get("/refresh", response_model=AuthResponse)
def refresh(request: Request):
    """Re-read user from DB and return a fresh token — used to pick up approval status changes."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = header.removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[_ALGO])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    with _db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (payload["sub"],)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if row["status"] == "rejected":
        raise HTTPException(status_code=403, detail="Account access has been denied.")

    new_token = _mint_jwt(row)
    return AuthResponse(
        token=new_token,
        user={"id": row["id"], "email": row["email"], "name": row["name"],
              "picture": row["picture"], "status": row["status"], "is_admin": bool(row["is_admin"])},
    )


@router.get("/google")
def login_google():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
    params = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": _callback_url(),
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
    })
    return RedirectResponse(f"{_GOOGLE_AUTH}?{params}")


@router.get("/google/callback")
async def google_callback(code: str):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not JWT_SECRET:
        raise HTTPException(status_code=500, detail="Auth not fully configured")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(_GOOGLE_TOKEN, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": _callback_url(),
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code with Google")

        access_token = token_resp.json().get("access_token")
        userinfo_resp = await client.get(
            _GOOGLE_USERINFO,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info from Google")
        g = userinfo_resp.json()

    row = _upsert_google_user(email=g["email"], name=g.get("name", ""), picture=g.get("picture", ""))
    token = _mint_jwt(row)
    return RedirectResponse(f"{FRONTEND_URL}?token={token}")


@router.get("/me")
def me(request: Request):
    return get_current_user(request)


# ── Admin routes ──────────────────────────────────────────────────────────────
@admin_router.get("/users")
def list_users(_admin: dict = Depends(get_current_admin)):
    with _db() as conn:
        rows = conn.execute(
            "SELECT id, email, name, picture, provider, created_at, status, is_admin "
            "FROM users ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


@admin_router.patch("/users/{user_id}/approve")
def approve_user(user_id: str, _admin: dict = Depends(get_current_admin)):
    with _db() as conn:
        row = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        conn.execute("UPDATE users SET status = 'approved' WHERE id = ?", (user_id,))
    return {"ok": True}


@admin_router.patch("/users/{user_id}/reject")
def reject_user(user_id: str, _admin: dict = Depends(get_current_admin)):
    with _db() as conn:
        row = conn.execute("SELECT id, is_admin FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if row["is_admin"]:
            raise HTTPException(status_code=400, detail="Cannot reject an admin account")
        conn.execute("UPDATE users SET status = 'rejected' WHERE id = ?", (user_id,))
    return {"ok": True}


@admin_router.delete("/users/{user_id}")
def delete_user(user_id: str, _admin: dict = Depends(get_current_admin)):
    with _db() as conn:
        row = conn.execute("SELECT id, is_admin FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if row["is_admin"]:
            raise HTTPException(status_code=400, detail="Cannot delete an admin account")
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return {"ok": True}
