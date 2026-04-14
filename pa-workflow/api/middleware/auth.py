from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, ValidationError
from typing import List, Optional

from ..core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") # Placeholder tokenUrl

class TokenData(BaseModel):
    """Schema for data stored in the JWT token."""
    user_id: str
    roles: List[str] = []

class User(BaseModel):
    """Schema for the user object attached to the request."""
    id: str
    roles: List[str]

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Decode JWT token to get current user.
    Raises HTTPException 401 for invalid tokens.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        token_data = TokenData(**payload)
        if token_data.user_id is None:
            raise credentials_exception
    except (JWTError, ValidationError):
        raise credentials_exception
    
    return User(id=token_data.user_id, roles=token_data.roles)

def require_role(required_roles: List[str]):
    """
    Dependency factory to check for user roles.
    Raises HTTPException 403 if user lacks required role.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if not any(role in current_user.roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The user does not have the required permissions.",
            )
        return current_user
    return role_checker
