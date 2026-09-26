import random
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import User, Company, OtpCode, AuditLog
from app.schemas import LoginRequest, TokenResponse, ForgotPasswordRequest, ResetPasswordRequest
from app.services.auth_service import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
)
from app.services.redis_service import cache
from app.services.mailer import send_otp_email

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Step 2 Branded Login:
    Looks up user strictly scoped to `company_id`.
    Returns generic 'Invalid Login Id or Password' error for security.
    """
    generic_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Login Id or Password",
    )

    # 1. Check active company
    company = db.query(Company).filter(Company.id == req.company_id, Company.is_active == True).first()
    if not company:
        # Also allow matching by short code
        company = db.query(Company).filter(Company.short_code.ilike(req.company_id), Company.is_active == True).first()
    if not company:
        raise generic_error

    # 2. Look up user scoped to this company (login_id or email)
    identifier = req.login_id_or_email.strip().lower()
    user = (
        db.query(User)
        .filter(
            User.company_id == company.id,
            User.is_active == True,
            or_(User.login_id.ilike(identifier), User.email.ilike(identifier)),
        )
        .first()
    )

    if not user or not verify_password(req.password, user.password_hash):
        raise generic_error

    # 3. Create scoped JWT Token
    token_payload = {
        "sub": str(user.id),
        "company_id": user.company_id,
        "role": user.role,
        "type": "tenant",
    }
    access_token = create_access_token(token_payload)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "company_id": user.company_id,
            "company_name": company.name,
            "company_code": company.short_code,
            "name": user.name,
            "login_id": user.login_id,
            "email": user.email,
            "role": user.role,
        },
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    return {
        "id": current_user.id,
        "company_id": current_user.company_id,
        "company_name": company.name if company else None,
        "company_code": company.short_code if company else None,
        "name": current_user.name,
        "login_id": current_user.login_id,
        "email": current_user.email,
        "role": current_user.role,
    }


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Custom SMTP OTP Request:
    - Enforces Redis rate limit (max 3 per 15 min per email)
    - Generates 6-digit numeric code, hashes it, stores in database with 5-minute TTL
    - Sends branded email via SMTP
    - Always returns generic message to prevent account enumeration
    """
    email = req.email.strip().lower()
    generic_msg = "If an account exists with this email, a 6-digit code has been sent. It expires in 5 minutes."

    # 1. Rate limiting via Redis
    rate_limit_key = f"ratelimit:otp:{email}"
    if not cache.check_rate_limit(rate_limit_key, max_attempts=3, window_seconds=900):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Please wait 15 minutes before trying again.",
        )

    # 2. Company lookup
    company = db.query(Company).filter(Company.id == req.company_id, Company.is_active == True).first()
    if not company:
        company = db.query(Company).filter(Company.short_code.ilike(req.company_id), Company.is_active == True).first()

    company_name = company.name if company else "Shelfy IMS"

    # 3. User lookup scoped to company
    user = (
        db.query(User)
        .filter(User.company_id == (company.id if company else req.company_id), User.email.ilike(email))
        .first()
    )

    if not user:
        return {"success": True, "message": generic_msg}

    # 4. Generate 6-digit OTP code & store hashed
    raw_otp = f"{random.randint(100000, 999999)}"
    code_hash = get_password_hash(raw_otp)
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)

    # Invalidate existing active OTPs for this email
    db.query(OtpCode).filter(OtpCode.email == email, OtpCode.used == False).update({"used": True})

    otp_record = OtpCode(
        email=email,
        company_id=company.id if company else None,
        code_hash=code_hash,
        purpose="password_reset",
        expires_at=expires_at,
        attempts=0,
        used=False,
    )
    db.add(otp_record)
    db.commit()

    # 5. Dispatch email via SMTP
    await send_otp_email(to_email=email, otp=raw_otp, company_name=company_name)

    return {"success": True, "message": generic_msg}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Custom SMTP OTP Verification:
    - Verifies 6-digit code with lockout after 5 failed attempts
    - Single-use check: marks used immediately
    - Updates user password hash
    """
    email = req.email.strip().lower()

    # Find active OTP record
    otp_record = (
        db.query(OtpCode)
        .filter(OtpCode.email == email, OtpCode.purpose == "password_reset", OtpCode.used == False)
        .order_by(OtpCode.created_at.desc())
        .first()
    )

    if not otp_record or otp_record.expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    if otp_record.attempts >= 5:
        otp_record.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="Code locked after 5 failed attempts. Please request a new code.")

    if not verify_password(req.otp, otp_record.code_hash):
        otp_record.attempts += 1
        db.commit()
        remaining = 5 - otp_record.attempts
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect code. {remaining} attempt(s) remaining.",
        )

    # Match: Mark code used
    otp_record.used = True

    # Find and update user in that company
    user = (
        db.query(User)
        .filter(User.company_id == (otp_record.company_id or req.company_id), User.email.ilike(email))
        .first()
    )
    if not user:
        raise HTTPException(status_code=400, detail="User account not found.")

    user.password_hash = get_password_hash(req.new_password)
    db.commit()

    return {"success": True, "message": "Password successfully reset. You can now sign in with your new password."}
