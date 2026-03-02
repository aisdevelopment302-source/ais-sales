# AIS Sales Analytics

Unified sales analytics platform for Aadinath Industries rolling mill.

## Structure

- **Frontend**: Next.js 16 + React 19 dashboard (Recharts visualizations)
  - Location: `/` (root of project)
  - Run: `npm run dev` (port 3000)
  - Pages: Customer analytics, sales trends, inventory, purchase orders

- **API Backend**: FastAPI Python server
  - Location: `/api`
  - Run: `cd api && python main.py` (port 8000)
  - Endpoints: `/summary`, `/sales`, `/customers`, `/items`, `/purchases`
  - Database: SQLite (config in `database.py`)

## Getting Started

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd api
pip install -r requirements.txt
python main.py
```

## Configuration

- Frontend connects to backend at `http://localhost:8000` (adjust in `.env.local`)
- Backend CORS configured for `http://localhost:3000`
- Update both for production deployment

## Status
- ✅ Created Feb 28, 2026
- ⏳ Ready for integration testing
