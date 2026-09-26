from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, SecretStr, Field
from ..security import COOKIE

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_key: SecretStr = Field(min_length=32, max_length=256)

@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    security = request.app.state.security
    if not security.matches_key(payload.access_key.get_secret_value()):
        raise HTTPException(401, "Invalid access key")
    session = security.new_session()
    response.set_cookie(COOKIE, session, max_age=security.settings.session_seconds,
                        httponly=True, secure=security.settings.secure_cookie, samesite="strict", path="/")
    return {"authenticated": True}

@router.get("/session")
async def session():
    return {"authenticated": True}

@router.post("/logout")
async def logout(request: Request, response: Response):
    request.app.state.security.sessions.pop(request.state.session_key, None)
    response.delete_cookie(COOKIE, path="/", httponly=True, secure=request.app.state.settings.secure_cookie, samesite="strict")
    return {"authenticated": False}
