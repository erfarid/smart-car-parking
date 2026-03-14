from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from pathlib import Path
import json

router = APIRouter(prefix="/auth", tags=["auth"])

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "credentials.json"


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    address: str
    password: str
    role: Literal["user", "admin"]
    admin_code: Optional[str] = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def load_data():
    if not DATA_FILE.exists():
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "admin_codes": [
                        "ADM-4821",
                        "ADM-7359",
                        "ADM-1946",
                        "ADM-8603",
                        "ADM-5274"
                    ],
                    "users": []
                },
                f,
                indent=2
            )

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


@router.post("/register")
def register_user(payload: RegisterRequest):
    data = load_data()

    existing_user = next(
        (u for u in data["users"] if u["email"].lower() == payload.email.lower()),
        None
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists.")

    if payload.role == "admin":
        if not payload.admin_code or payload.admin_code not in data["admin_codes"]:
            raise HTTPException(status_code=400, detail="Invalid admin code.")

    new_user = {
        "full_name": payload.full_name,
        "email": payload.email,
        "phone": payload.phone,
        "address": payload.address,
        "password": payload.password,
        "role": payload.role,
        "admin_code": payload.admin_code if payload.role == "admin" else ""
    }

    data["users"].append(new_user)
    save_data(data)

    return {"message": "Registration successful", "user": new_user}


@router.post("/login")
def login_user(payload: LoginRequest):
    data = load_data()

    user = next(
        (
            u for u in data["users"]
            if u["email"].lower() == payload.email.lower()
            and u["password"] == payload.password
        ),
        None
    )

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "message": "Login successful",
        "user": {
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"]
        }
    }