#!/bin/bash
set -e

echo "============================================"
echo "  Smart Parking System - Full Setup"
echo "============================================"
echo ""

# ── 1. Backend setup ──
echo "[1/5] Installing backend Python dependencies..."
cd backend
pip install -r requirements.txt
echo ""

# ── 2. Create database ──
echo "[2/5] Creating database tables..."
python scripts/db_create.py
echo ""

# ── 3. Seed data ──
echo "[3/5] Seeding zones..."
python scripts/seed_zones.py
echo ""

echo "[4/5] Generating test vehicles (500)..."
python scripts/generate_vehicles.py
echo ""

echo "[5/5] Generating test sessions (2000)..."
python scripts/generate_sessions.py
echo ""

cd ..

# ── 4. Frontend setup ──
echo "[6/6] Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "To run the project:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend"
echo "    uvicorn app.main:app --reload"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "Then open http://localhost:5173 in your browser."
echo ""
