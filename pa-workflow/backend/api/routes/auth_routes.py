# Authentication Routes
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt
import logging

from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# JWT Configuration
SECRET_KEY = settings.JWT_SECRET_KEY if hasattr(settings, 'JWT_SECRET_KEY') else "dev-secret-key-change-in-production"
ALGORITHM = settings.JWT_ALGORITHM if hasattr(settings, 'JWT_ALGORITHM') else "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Demo users database
DEMO_USERS = {
    "provider@example.com": {
        "id": "user-001",
        "email": "provider@example.com",
        "password": "password",
        "name": "Dr. Sarah Johnson",
        "role": "PROVIDER",
        "organization": "Metro Health Clinic",
    },
    "adjudicator@example.com": {
        "id": "user-002",
        "email": "adjudicator@example.com",
        "password": "password",
        "name": "Michael Chen",
        "role": "ADJUDICATOR",
        "organization": "AegisClaim Review",
    },
    "admin@example.com": {
        "id": "user-003",
        "email": "admin@example.com",
        "password": "password",
        "name": "Admin User",
        "role": "ADMIN",
        "organization": "AegisClaim Admin",
    },
    "director@example.com": {
        "id": "user-004",
        "email": "director@example.com",
        "password": "password",
        "name": "Dr. Emily Roberts",
        "role": "MEDICAL_DIRECTOR",
        "organization": "AegisClaim Medical",
    },
}


# Pydantic Models
class User(BaseModel):
    id: str
    email: str
    name: str
    role: str
    organization: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    organization: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthToken(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class LoginResponse(BaseModel):
    user: UserResponse
    token: AuthToken


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def get_db_connection():
    """Get a connection to the Neon PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            host=settings.POSTGRES_HOST,
            database=settings.POSTGRES_DB,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            port=settings.POSTGRES_PORT,
            sslmode="require",
            channel_binding="require"
        )
        return conn
    except Exception as e:
        logger.error(f"[DB] Connection error: {type(e).__name__}: {e}")
        return None


def authenticate_user(email: str, password: str):
    """
    Authenticate user against the database.
    First tries database, falls back to DEMO_USERS for development.
    """
    logger.info(f"[AUTH] Login attempt for email: {email}")
    
    # Try database authentication first
    try:
        conn = get_db_connection()
        if conn:
            logger.info(f"[AUTH] Database connection successful")
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT id, user_id, email, name, role, organization, is_active, password_hash FROM users WHERE email = %s AND is_active = true",
                (email.lower(),)
            )
            user_row = cur.fetchone()
            cur.close()
            conn.close()
            
            if user_row:
                logger.info(f"[AUTH] User found in database: {user_row['email']}")
                # Verify bcrypt password
                try:
                    password_hash = user_row['password_hash']
                    logger.debug(f"[AUTH] Password hash type: {type(password_hash)}, length: {len(password_hash) if password_hash else 'None'}")
                    logger.debug(f"[AUTH] Password hash starts with: {str(password_hash)[:30] if password_hash else 'None'}")
                    
                    if not password_hash:
                        logger.warning(f"[AUTH] User {email} has null password_hash")
                        return None
                    
                    # bcrypt.checkpw expects bytes for both arguments
                    check_result = bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
                    logger.info(f"[AUTH] Password check result: {check_result}")
                    
                    if check_result:
                        logger.info(f"[AUTH] Authentication successful for {email}")
                        return {
                            "id": str(user_row['id']),
                            "email": user_row['email'],
                            "name": user_row['name'],
                            "role": user_row['role'],
                            "organization": user_row['organization'] or "",
                            "source": "database"
                        }
                    else:
                        logger.warning(f"[AUTH] Password mismatch for {email}")
                        return None
                except Exception as e:
                    logger.error(f"[AUTH] Error during bcrypt verification for {email}: {type(e).__name__}: {e}")
                    return None
            else:
                logger.warning(f"[AUTH] User not found or not active: {email.lower()}")
        else:
            logger.warning(f"[AUTH] Database connection failed")
    except Exception as e:
        logger.error(f"[AUTH] Database error: {type(e).__name__}: {e}")
    
    # Fallback to DEMO_USERS for development
    logger.info(f"[AUTH] Attempting fallback to DEMO_USERS for {email}")
    user = DEMO_USERS.get(email.lower())
    if not user:
        logger.warning(f"[AUTH] User not found in DEMO_USERS: {email.lower()}")
        return None
    if user["password"] != password:
        logger.warning(f"[AUTH] Password mismatch in DEMO_USERS for {email}")
        return None
    
    logger.info(f"[AUTH] Authentication successful via DEMO_USERS for {email}")
    return user


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user_from_token(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("user_id")
    if user_id is None:
        raise credentials_exception

    # Try to get user from database first
    try:
        conn = get_db_connection()
        if conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT id, user_id, email, name, role, organization, is_active FROM users WHERE id = %s AND is_active = true",
                (int(user_id),)
            )
            user_row = cur.fetchone()
            cur.close()
            conn.close()
            
            if user_row:
                return User(
                    id=str(user_row['id']),
                    email=user_row['email'],
                    name=user_row['name'],
                    role=user_row['role'],
                    organization=user_row['organization'] or "",
                )
    except Exception:
        pass

    # Fallback to DEMO_USERS
    user = None
    for u in DEMO_USERS.values():
        if u["id"] == user_id:
            user = u
            break

    if user is None:
        raise credentials_exception

    return User(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        organization=user["organization"],
    )


@router.post("/auth/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """
    Authenticate user and return JWT token.
    Demo credentials (plain password):
    - provider@example.com / password
    - adjudicator@example.com / password
    - admin@example.com / password
    - director@example.com / password
    
    Database provider accounts (from user_policies):
    - anjali.mehta@provider.local / hvfkm0TMsZm46iwX
    - arun.kumar@provider.local / LpziXaxf6wFZ3NhX
    - And 18 other provider accounts created from user_policies
    """
    user = authenticate_user(credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"user_id": user["id"], "email": user["email"], "roles": [user["role"]]},
        expires_delta=access_token_expires,
    )

    return LoginResponse(
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            organization=user["organization"],
        ),
        token=AuthToken(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
    )


@router.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user_from_token)):
    """
    Logout user. In a stateless JWT system, this is handled client-side.
    The token will naturally expire.
    """
    return {"message": "Successfully logged out"}


@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user_from_token)):
    """
    Get current authenticated user information.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        organization=current_user.organization,
    )


@router.post("/auth/refresh", response_model=RefreshResponse)
async def refresh_token(current_user: User = Depends(get_current_user_from_token)):
    """
    Refresh access token.
    """
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"user_id": current_user.id, "email": current_user.email, "roles": [current_user.role]},
        expires_delta=access_token_expires,
    )

    return RefreshResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
