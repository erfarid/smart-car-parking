# Smart Parking Sys

A full-stack smart parking management system for Budapest with AI-based license plate detection (YOLOv8 + EasyOCR), district-based dynamic fee calculation, role-based access (User / Worker / Admin), digital payments, worker patrol with fine issuance, live congestion map, and admin reporting dashboards.

## Architecture

```
farid-md-farid/
├── backend/                              # FastAPI Python backend
│   ├── app/
│   │   ├── api/                          # REST controllers
│   │   │   ├── auth/                     # Auth endpoints
│   │   │   │   ├── accounts.py           # register, login, users summary
│   │   │   │   ├── staff.py              # admin/worker messaging, worker fines
│   │   │   │   ├── common.py             # shared auth helpers
│   │   │   │   └── router.py             # auth router aggregator
│   │   │   ├── payments/                 # Payment endpoints
│   │   │   │   ├── transactions.py       # pay / pay-all / checkout-active
│   │   │   │   ├── notices.py            # payment notices and warnings
│   │   │   │   ├── monitoring.py         # admin records, congestion data
│   │   │   │   ├── common.py             # shared payment helpers
│   │   │   │   └── router.py             # payments router aggregator
│   │   │   ├── auth_controller.py        # mounts auth routes
│   │   │   ├── payment_controller.py     # mounts payment routes
│   │   │   ├── session_controller.py     # session lifecycle endpoints
│   │   │   ├── zone_controller.py        # district / zone CRUD
│   │   │   ├── vehicle_controller.py     # vehicle endpoints
│   │   │   ├── upload_controller.py      # plate-image upload + OCR
│   │   │   └── report_controller.py      # revenue + summary reports
│   │   ├── services/                     # Business logic
│   │   │   ├── session_service.py        # session lifecycle + fee logic
│   │   │   ├── zone_service.py           # zone validation + CRUD
│   │   │   ├── fee_calculation_service.py # peak / overstay / repeat penalty
│   │   │   ├── reporting_service.py      # revenue and status reports
│   │   │   └── plate_detection_service.py # YOLOv8 + EasyOCR pipeline
│   │   ├── repositories/                 # Data access layer
│   │   │   ├── session_repository.py
│   │   │   ├── zone_repository.py
│   │   │   └── vehicle_repository.py
│   │   ├── models/
│   │   │   └── schemas.py                # Pydantic request/response models
│   │   ├── main.py                       # FastAPI app entry point
│   │   └── database.py                   # SQLite connection + table creation
│   ├── tests/                            # Pytest test suite
│   ├── scripts/                          # DB setup and seed scripts
│   │   ├── db_create.py
│   │   ├── seed_zones.py
│   │   ├── generate_vehicles.py
│   │   └── generate_sessions.py
│   ├── license_plate.pt                  # Fine-tuned YOLOv8 weights for plate detection
│   └── requirements-ci.txt               # Python dependencies
├── frontend/                             # React + Vite SPA
│   └── src/
│       ├── context/
│       │   └── AuthContext.jsx           # Login state + role handling
│       ├── pages/
│       │   ├── LandingPage.jsx           # Public homepage
│       │   ├── LoginPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── AdminDashboardPage.jsx    # Admin live overview
│       │   ├── DriverDashboardPage.jsx   # Driver dashboard with live map
│       │   ├── UserDashboardPage.jsx     # User home view
│       │   ├── WorkerDashboardPage.jsx   # Worker patrol page
│       │   ├── SessionsPage.jsx          # Start/close/list sessions
│       │   ├── PaymentPage.jsx           # Pay parking fees
│       │   ├── UserPaymentPage.jsx       # User-side payment view
│       │   ├── UploadImagePage.jsx       # Plate-image upload + OCR
│       │   ├── ZoneConfigPage.jsx        # District / zone management (admin)
│       │   ├── ReportsPage.jsx           # Revenue charts and reports
│       │   ├── UsersPage.jsx             # Users management (admin)
│       │   ├── WorkersPage.jsx           # Workers management (admin)
│       │   ├── MessagesPage.jsx          # System notices + staff messages
│       │   ├── ProfilePage.jsx
│       │   └── UserProfilePage.jsx
│       ├── services/
│       │   └── ApiClient.js              # Frontend API service layer
│       ├── utils/
│       │   └── budapestDistricts.js      # District helpers (D01-D23)
│       ├── App.jsx                       # Router + role-based navigation
│       └── main.jsx
├── api/                                  # Vercel serverless entry point
│   └── index.py
├── parking.db                            # SQLite database (created on first run)
├── setup.sh                              # One-command full setup
├── requirements.txt                      # Top-level dependency reference
└── vercel.json                           # Vercel deployment config
```

## Prerequisites

- **Python 3.9+** (3.13 recommended)
- **Node.js 18+** and npm
- **pip** (Python package manager)
- **Git**

## Quick Start (One Command)

```bash
git clone https://szofttech.inf.elte.hu/gnn/thesis/farid-md-farid.git
cd farid-md-farid
chmod +x setup.sh
./setup.sh
```

This installs all backend dependencies, creates the database, and seeds it with demo data (23 Budapest districts, 500 vehicles, 2000 sessions).

## Manual Setup (Step by Step)

### Step 1: Backend

```bash
# From project root, create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install Python dependencies
cd backend
pip install -r requirements-ci.txt

# Install ML libraries for license plate detection (required for Upload Image page)
pip install opencv-python-headless easyocr ultralytics numpy

# Create the database and seed demo data
python scripts/db_create.py
python scripts/seed_zones.py
python scripts/generate_vehicles.py
python scripts/generate_sessions.py

# Start the backend server
uvicorn app.main:app --reload
```

Backend runs at **http://localhost:8000**

> **Note on ML libraries:** The Upload Image page (license-plate detection) requires `opencv-python-headless`, `easyocr`, `ultralytics`, and `numpy` (~2 GB total). If not installed, you will get a "No module named cv2" error when trying to detect a plate. All other features work without these libraries.

### Step 2: Frontend

Open a **new terminal**:

```bash
cd frontend

# Install Node dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:5173**

## Demo Accounts and Roles

The application supports three roles. After registration, the visible interface adapts to the role.

| Role              | Capabilities                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **User (Driver)** | Manages own vehicles, opens parking sessions, pays fees, reviews notices                                               |
| **Worker**        | Patrols zones, scans plates, verifies sessions, issues fines for unauthorized parking                                  |
| **Admin**         | Manages districts, monitors all activity, supervises users and workers, reviews revenue reports, can close any session |

Admin and Worker registration requires a **special authorization code** entered during sign-up.

## Features and Pages

### Public Pages

- **Landing Page (`/`)** — Project introduction, features, and "How it works" walkthrough
- **Login / Register** — Account creation with role selection (User, Admin, Worker)

### User (Driver) Pages

- **My Dashboard (`/user`)** — Personal overview, vehicle list, recent sessions
- **Sessions (`/sessions`)** — Start a new parking session, view active sessions, close sessions
- **Upload Image (`/upload`)** — Upload a vehicle photo; YOLOv8 + EasyOCR detect the plate
- **Payment (`/user/payment`)** — Pay outstanding parking fees with card form
- **Messages (`/messages`)** — Active-session warnings, payment reminders, worker fines, admin messages
- **Profile (`/user/profile`)** — Personal stats, payment history, fine history

### Worker Pages

- **Worker Dashboard (`/worker`)** — Patrol page, plate-checking workflow, fine issuance
- **Messages** — Sent messages history (follow-ups to drivers)

### Admin Pages

- **Admin Dashboard (`/`)** — Live revenue, paid/unpaid/overdue counts, district congestion grid, real-time vehicle payment status
- **Users (`/users`)** — All users with stats, drill-down into per-user sessions and payments
- **Workers (`/workers`)** — Worker list with messages-sent and fines-issued counters
- **Sessions** — All sessions across the system, with filtering and force-close capability
- **Zone Config (`/zones`)** — Add, edit, delete Budapest district configurations (rate, peak hours, multipliers)
- **Reports (`/reports`)** — Bar chart (revenue by district), doughnut chart (paid/unpaid/overdue), per-zone share table
- **Messages** — Direct messaging to users, plus system notices

### Live Map and Congestion

- The Driver Dashboard includes a Leaflet-based live map of Budapest
- Each district is shown as a marker, color-coded by active session count (low / medium / high)

## Fee Calculation Logic

```
base_fee = base_hourly_rate * (billable_minutes / 60)

# Grace period: first 10 minutes are free
# Minimum fee: 50 HUF if any chargeable time

# Peak hours: time-of-day multiplier (1.2x typical, capped at 1.3x)
if entry hour falls within peak window:
    base_fee *= peak_multiplier

# Overstay penalty: if duration > max_duration_minutes
if duration > max_duration_minutes:
    overstay_penalty = base_fee * (overstay_multiplier - 1)

# Repeat penalty: 20% extra per previous session for the same plate
repeat_penalty = base_fee * 0.2 * repeat_count

final_fee = max(MINIMUM_FEE, base_fee + overstay_penalty + repeat_penalty)
```

- **Grace period**: first 10 minutes free
- **Minimum fee**: 50 HUF
- **Peak hours**: typically 08:00–18:00 with a 1.2x multiplier (configurable per zone)
- **Overstay**: parking past `max_duration_minutes` (default 1440 min / 24 h) triggers extra charge
- **Repeat penalty**: 20% of base fee per previous session for the same plate

## Database Schema

SQLite database (`parking.db`) with the following tables:

| Table              | Purpose                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `users`            | User accounts with role (user / worker / admin) and SHA-256 hashed passwords |
| `zones`            | 23 Budapest districts (D01–D23) with hourly rate, peak hours, multipliers    |
| `vehicles`         | Registered vehicles linked to user accounts                                  |
| `parking_sessions` | Active and historical parking sessions with fee breakdown                    |
| `payments`         | Card payment transactions linked to sessions                                 |
| `worker_fines`     | Fines issued by workers for vehicles without active sessions                 |
| `user_messages`    | Direct messages from admins / workers to users                               |

## Seeded Demo Data

| Table              | Records | Details                                                             |
| ------------------ | ------- | ------------------------------------------------------------------- |
| `zones`            | 23      | Budapest districts D01–D23 with rates 500–700 HUF/hr                |
| `vehicles`         | 500     | Hungarian names, plate types: car / van / truck / electric / hybrid |
| `parking_sessions` | 2000    | Mix of paid / unpaid / overdue / active status                      |

A default **admin account** is also seeded automatically (see `database.py`) to allow immediate access without manual registration.

## API Endpoints

### Authentication

| Method | Endpoint                 | Description                            |
| ------ | ------------------------ | -------------------------------------- |
| POST   | `/auth/register`         | Create user / worker / admin account   |
| POST   | `/auth/login`            | Authenticate and return user role + ID |
| GET    | `/auth/users`            | List all users (admin)                 |
| GET    | `/auth/users-summary`    | Per-user statistics (admin)            |
| GET    | `/auth/users/{user_id}`  | Detailed user view                     |
| POST   | `/auth/messages/send`    | Admin / worker sends message to user   |
| GET    | `/auth/messages/sent`    | Messages sent by current staff member  |
| POST   | `/auth/worker/scan-fine` | Worker issues a fine after plate scan  |
| GET    | `/auth/worker/fines`     | List worker-issued fines               |

### Sessions, Vehicles, Zones

| Method | Endpoint                    | Description                                            |
| ------ | --------------------------- | ------------------------------------------------------ |
| GET    | `/sessions/`                | List sessions (filters: date range, role, plate, user) |
| POST   | `/sessions/`                | Start a parking session                                |
| PUT    | `/sessions/{id}/close`      | Close session and finalize fee                         |
| GET    | `/sessions/{id}/quote`      | Live fee quote for an active session                   |
| GET    | `/zones/`                   | List all 23 districts                                  |
| POST   | `/zones/`                   | Create new zone (admin)                                |
| PUT    | `/zones/{zone_id}`          | Update zone configuration (admin)                      |
| DELETE | `/zones/{zone_id}`          | Delete a zone (admin)                                  |
| GET    | `/vehicles/`                | List vehicles (role-filtered)                          |
| GET    | `/vehicles/{plate}/details` | Vehicle detail with session history                    |
| POST   | `/vehicles/`                | Register a new vehicle                                 |
| DELETE | `/vehicles/{plate}`         | Remove a vehicle                                       |

### Plate Upload, Payments, Reports

| Method | Endpoint                    | Description                         |
| ------ | --------------------------- | ----------------------------------- |
| POST   | `/upload/plate-image`       | YOLOv8 + EasyOCR plate detection    |
| POST   | `/payments/pay`             | Pay specific session(s)             |
| POST   | `/payments/checkout-active` | Close active session and pay        |
| POST   | `/payments/pay-all`         | Pay all unpaid sessions for a plate |
| GET    | `/payments/notices`         | Payment warnings and notices        |
| GET    | `/payments/admin-records`   | All payment records (admin)         |
| GET    | `/payments/congestion`      | Live zone congestion data           |
| GET    | `/reports/revenue-by-zone`  | Revenue grouped by district         |
| GET    | `/reports/revenue-summary`  | Total revenue + status counters     |
| GET    | `/health`                   | Backend health check                |

### Example API Calls

```bash
# Health check
curl http://localhost:8000/health

# Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ali","email":"ali@example.com","password":"secret123","role":"user"}'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ali@example.com","password":"secret123"}'

# Start a session
curl -X POST http://localhost:8000/sessions/ \
  -H "Content-Type: application/json" \
  -d '{"plate_number":"ABC-1234","zone_id":"D01","user_id":"<user-id>","user_role":"user"}'

# Upload plate image
curl -X POST http://localhost:8000/upload/plate-image \
  -F "file=@plate_photo.jpg"

# Revenue summary
curl http://localhost:8000/reports/revenue-summary
```

## How the AI Plate Detection Works

The plate detection pipeline runs in two stages:

1. **Stage 1 — YOLOv8 plate localization**
   - A license-plate-fine-tuned YOLOv8 model (`license_plate.pt`) finds the plate region in the uploaded image and returns bounding boxes
   - Detections below a 0.25 confidence threshold are filtered out
2. **Stage 2 — EasyOCR text recognition**
   - The plate region is cropped (with small padding) and passed to EasyOCR
   - Recognized text is validated against the regex `^[A-Z0-9-]{5,12}$`
   - Among multiple OCR candidates, the highest-confidence valid plate is returned
3. **Graceful fallback**
   - If YOLOv8 returns no detections, the service falls back to running EasyOCR on the whole image so a result is still produced when the detector misses
4. **Response shape**: `{ "plate_text": "ABC-1234", "confidence": 0.95, "valid": true }`

The `license_plate.pt` weights file lives in `backend/`. The OCR + detection feature does **not** work on Vercel because the ML libraries are too large for serverless functions; everything else works.

## Testing

### Backend Tests (Pytest)

The backend includes ~17 test files covering services, repositories, API endpoints, schemas, plate detection, fee calculation, and database initialization.

```bash
cd backend
pytest -v

# Run a specific test file
pytest tests/test_plate_detection_service.py -v

# Run with coverage
pytest --cov=app
```

### Frontend Tests (Vitest)

```bash
cd frontend
npm test
```

Covers `ApiClient`, `AuthContext`, login, register, landing, and Budapest district utilities.

## Development Tools

- **Backend**: FastAPI, Pydantic, SQLite, OpenCV, EasyOCR, Ultralytics YOLOv8, NumPy, Pytest
- **Frontend**: React 18, Vite, React Router, Chart.js, react-chartjs-2, Leaflet, react-leaflet, Vitest, Testing Library
- **Tools**: Git, GitHub, Visual Studio Code, Postman

## Deployment (Vercel)

The project is configured for Vercel deployment via `vercel.json`:

- **Frontend** is built from `frontend/` and served as static files
- **Backend** runs as a Python serverless function via `api/index.py`
- **Database** is auto-created in `/tmp` with seed data on cold start

The AI plate-detection feature is disabled on Vercel because the ML libraries exceed serverless size limits.

## Project Status

This system is implemented as a Bachelor's thesis project (Eötvös Loránd University, Faculty of Informatics, Department of Artificial Intelligence) — _Smart Parking License Plate Recognition & Dynamic Pricing System_.

**Author**: Md Farid · **Supervisor**: Guettala Walid · Budapest, 2026.
