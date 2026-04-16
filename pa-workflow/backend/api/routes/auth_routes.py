# Authentication Routes
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel

from core.config import settings

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


def authenticate_user(email: str, password: str):
    user = DEMO_USERS.get(email.lower())
    if not user:
        return None
    if user["password"] != password:
        return None
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

    # Find user by ID
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
    Demo credentials:
    - provider@example.com / password
    - adjudicator@example.com / password
    - admin@example.com / password
    - director@example.com / password
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
