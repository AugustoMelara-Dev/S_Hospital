"""Auth endpoints (no permission required).

POST /api/auth/login            {login, password} -> Me (sets cookie shs_session)
POST /api/auth/logout           -> 204
GET  /api/auth/me               -> Me | 401
POST /api/auth/change-password  {current_password, new_password} -> Me
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.config import get_settings
from app.core.deps import DB, SESSION_COOKIE, CurrentUser, get_current_session
from app.models.users import UserSession
from app.schemas.auth import ChangePasswordIn, LoginIn, MeOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="strict",
        secure=get_settings().cookie_secure,
        path="/",
    )


@router.post("/login", response_model=MeOut)
def login(data: LoginIn, request: Request, response: Response, db: DB) -> MeOut:
    user, token = auth_service.login(db, data.login, data.password, request)
    _set_session_cookie(response, token)
    return auth_service.me_payload(user)


@router.post("/logout", status_code=204)
def logout(request: Request, db: DB) -> Response:
    auth_service.logout(db, request.cookies.get(SESSION_COOKIE), request)
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="strict", httponly=True)
    return response


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser) -> MeOut:
    return auth_service.me_payload(user)


@router.post("/change-password", response_model=MeOut)
def change_password(
    data: ChangePasswordIn,
    request: Request,
    db: DB,
    sess: UserSession = Depends(get_current_session),
) -> MeOut:
    user = auth_service.change_password(
        db, sess.user, sess, data.current_password, data.new_password, request
    )
    return auth_service.me_payload(user)
