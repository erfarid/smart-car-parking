# Smart Parking System

A full-stack smart parking management system with license plate detection (YOLOv8 + EasyOCR), zone-based fee calculation, and real-time session management.

## Architecture

```
smart_parking/
├── backend/                  # FastAPI Python backend
│   ├── app/
│   │   ├── api/              # REST controllers
│   │   │   ├── session_controller.py
│   │   │   ├── zone_controller.py
│   │   │   ├── report_controller.py
│   │   │   ├── vehicle_controller.py
│   │   │   └── upload_controller.py
│   │   ├── services/         # Business logic
│   │   │   ├── session_service.py
│   │   │   ├── zone_service.py
│   │   │   ├── fee_calculation_service.py
│   │   │   ├── reporting_service.py
│   │   │   └── plate_detection_service.py  # YOLOv8 + EasyOCR
│   │   ├── repositories/     # Data access layer
│   │   │   ├── session_repository.py
│   │   │   ├── zone_repository.py
│   │   │   └── vehicle_repository.py
│   │   ├── models/
│   │   │   └── schemas.py    # Pydantic models
│   │   ├── main.py           # FastAPI app entry point
│   │   └── database.py       # SQLite connection
│   └── scripts/              # DB setup & seed scripts
│       ├── db_create.py
│       ├── seed_zones.py
│       ├── generate_vehicles.py
│       └── generate_sessions.py
├── frontend/                 # React + Vite SPA
│   └── src/
│       ├── pages/
│       │   ├── AdminDashboardPage.jsx
│       │   ├── DriverDashboardPage.jsx
│       │   ├── SessionsPage.jsx
│       │   ├── ZoneConfigPage.jsx
│       │   ├── UploadImagePage.jsx
│       │   └── ReportsPage.jsx
│       ├── services/
│       │   └── ApiClient.js  # API service layer
│       └── App.jsx           # Router + sidebar navigation
├── api/                      # Vercel serverless entry point
│   └── index.py
├── setup.sh                  # One-command full setup
└── vercel.json               # Vercel deployment config
```

## Prerequisites

- **Python 3.9+** (3.10+ recommended)
- **Node.js 18+** and npm
- **pip** (Python package manager)

## Quick Start (One Command)

```bash
git clone <your-repo-url>
cd smart_parking
chmod +x setup.sh
./setup.sh
```

This installs all dependencies, creates the database, and seeds it with demo data.

## Manual Setup (Step by Step)

### Step 1: Backend

```bash
cd backend

# Install core Python dependencies
pip install -r requirements.txt

# (Optional) Install ML libraries for license plate detection (Upload Image page)
# This is ~2GB and only needed if you want to use the AI plate detection feature
pip install opencv-python-headless easyocr ultralytics numpy

# Create the database
python scripts/db_create.py

# Seed with demo data
python scripts/seed_zones.py
python scripts/generate_vehicles.py
python scripts/generate_sessions.py

# Start the backend server
uvicorn app.main:app --reload
```

Backend runs at **http://localhost:8000**

> **Note:** All features work without the ML libraries. Only the Upload Image page
> (license plate OCR detection) requires `opencv-python-headless`, `easyocr`,
> `ultralytics`, and `numpy`. If not installed, you will see a "No module named cv2"
> error when trying to detect a plate — everything else still works fine.

### Step 2: Frontend

```bash
cd frontend

# Install Node dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:5173**

## Testing Everything End-to-End

Once both servers are running, open **http://localhost:5173** and test each page:

### 1. Admin Dashboard (`/`)
- Shows total revenue, paid/unpaid/overdue session counts
- Lists active sessions and 15 most recent sessions
- All data loads from the seeded database automatically

### 2. Driver Dashboard (`/driver`)
- Enter a plate number to search (use one from the seeded data)
- To find a valid plate, go to Sessions page first and copy one
- Shows vehicle info, parking history, and fee breakdown

### 3. Sessions (`/sessions`)
- View all 2000 seeded parking sessions
- **Filter by date**: use the date picker to narrow results
- **Start a new session**: click "New Session", pick a plate and zone, click "Start Parking"
- **End a session**: click "End Session" on any active session to see the calculated fee

### 4. Zone Configuration (`/zones`)
- View all 7 Budapest parking zones with their rates
- **Add Zone**: click "Add Zone", fill in the form
- **Edit Zone**: click "Edit" on any zone row
- **Delete Zone**: click "Delete" on any zone row

### 5. Upload Image (`/upload`)
- Upload a photo of a license plate
- The AI (YOLOv8 + EasyOCR) detects the plate number
- If valid, you can immediately start a parking session
- **Requires ML libraries** — you must install them first:
  ```bash
  pip install opencv-python-headless easyocr ultralytics numpy
  ```
- Without these libraries, you'll get a "No module named cv2" error
- The YOLOv8 model (`yolov8n.pt`) downloads automatically on first use (~6MB)
- This feature does **not** work on Vercel (libraries too large for serverless)

### 6. Reports (`/reports`)
- Bar chart: revenue breakdown by zone
- Doughnut chart: paid vs unpaid vs overdue sessions
- Table with percentage share per zone

## API Endpoints

Test these directly in your browser or with curl:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/zones/` | List all zones |
| POST | `/zones/` | Create a zone |
| PUT | `/zones/{zone_id}` | Update a zone |
| DELETE | `/zones/{zone_id}` | Delete a zone |
| GET | `/sessions/` | List sessions (optional `?date_from=&date_to=`) |
| POST | `/sessions/` | Start a parking session |
| PUT | `/sessions/{id}/close` | End session & calculate fees |
| GET | `/vehicles/` | List all vehicles |
| GET | `/vehicles/{plate}` | Get vehicle by plate |
| POST | `/vehicles/` | Register a vehicle |
| DELETE | `/vehicles/{plate}` | Delete a vehicle |
| POST | `/upload/plate-image` | Upload image for plate detection |
| GET | `/reports/revenue-by-zone` | Revenue per zone |
| GET | `/reports/revenue-summary` | Aggregated revenue stats |

### Example API Calls

```bash
# Health check
curl http://localhost:8000/health

# List all zones
curl http://localhost:8000/zones/

# List all sessions
curl http://localhost:8000/sessions/

# Revenue summary
curl http://localhost:8000/reports/revenue-summary

# Start a session (use a plate from the seeded vehicles)
curl -X POST http://localhost:8000/sessions/ \
  -H "Content-Type: application/json" \
  -d '{"plate_number": "ABC-1234", "zone_id": "Z_001"}'

# Close a session
curl -X PUT http://localhost:8000/sessions/<session_id>/close \
  -H "Content-Type: application/json" \
  -d '{}'

# Upload plate image for detection
curl -X POST http://localhost:8000/upload/plate-image \
  -F "file=@plate_photo.jpg"
```

## How the AI Plate Detection Works

1. User uploads a photo via the Upload Image page
2. The image bytes are sent to `POST /upload/plate-image`
3. `PlateDetectionService` processes the image:
   - **YOLOv8** (nano model) can detect license plate regions
   - **EasyOCR** reads text from the image
   - Results are validated against regex pattern `^[A-Z0-9-]{5,12}$`
4. Returns: `{ "plate_text": "ABC-1234", "confidence": 0.95, "valid": true }`
5. If valid, the frontend offers a quick action to start a parking session

The `yolov8n.pt` model file is **not** in the repo (excluded by `.gitignore`). It downloads automatically from Ultralytics the first time you use the upload feature.

## Fee Calculation Logic

```
base_fee = base_hourly_rate * (duration_minutes / 60)

overstay_penalty = 0
if duration > max_duration_minutes:
    overstay_penalty = base_fee * (overstay_multiplier - 1)

repeat_penalty = base_fee * 0.2 * repeat_count

final_fee = base_fee + overstay_penalty + repeat_penalty
```

- **Peak pricing**: zones have peak hours (08:00-18:00) with multipliers (1.2x-1.6x)
- **Overstay penalty**: if parked beyond max duration (default 240 min), extra charge applies
- **Repeat penalty**: 20% of base fee per previous session (frequent parkers pay more)

## Database Schema

Three tables in SQLite (`backend/parking.db`):

- **zones**: 7 Budapest district zones with hourly rates and pricing rules
- **vehicles**: 500 registered vehicles with Hungarian names and plate numbers
- **parking_sessions**: 2000 historical sessions with calculated fees

## Seeded Demo Data

| Table | Records | Details |
|-------|---------|---------|
| zones | 7 | Z_001 to Z_007, rates 1300-2200 HUF/hr |
| vehicles | 500 | Random plates (ABC-1234), Hungarian names, types: car/van/truck/electric/hybrid |
| parking_sessions | 2000 | 30-480 min duration, paid/unpaid status, full fee breakdown |

## Deployment (Vercel)

The project is configured for Vercel deployment:

- **Frontend**: built from `frontend/` and served as static files
- **Backend**: runs as a Python serverless function via `api/index.py`
- **Database**: auto-created in `/tmp` with seed data on cold start

Note: The AI plate detection (YOLOv8 + EasyOCR) does **not** work on Vercel because the ML libraries are too large for serverless functions. All other features work.

## Tech Stack

**Backend**: FastAPI, SQLite3, Pydantic, YOLOv8, EasyOCR, OpenCV
**Frontend**: React 18, Vite, React Router, Chart.js
**Deployment**: Vercel (static + serverless)
