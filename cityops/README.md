## CityOps Starterkit

CityOps ist ein leichtgewichtiges Starterprojekt f?r kommunale Einsatzl?sungen mit einem FastAPI-Backend und einer React/Vite-Oberfl?che. Die Anwendung zeigt einen Beispiel-Korridor als GeoJSON, KPI-Karten und eine einfache "Was-w?re-wenn"-Simulation.

### Voraussetzungen
- Node.js >= 18
- Python >= 3.10

### Startanleitung
Backend (Terminal 1):
```
python -m venv .venv
# Aktivieren: source .venv/bin/activate (Linux/macOS) oder .venv\Scripts\activate (Windows)
pip install -r backend/requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (Terminal 2):
```
cd frontend
npm install
npm run dev
```

- API Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173
- Hinweis: Der Vite-Proxy verhindert CORS-Probleme f?r `/api` und `/ws` w?hrend der lokalen Entwicklung.
