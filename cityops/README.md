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
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend (Terminal 2):
```
cd frontend
npm install
npm run dev -- --host
```

- API Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173
- Hinweis: Der Vite-Proxy verhindert CORS-Probleme f?r `/api` und `/ws` w?hrend der lokalen Entwicklung.
- Codespaces/Remote: Ports 8000 (HTTP) und 5173 (Vite) ver?ffentlichen bzw. weiterleiten.

### Smoke-Tests
- `GET /api/health` ? `{"status":"ok"}`
- Frontend ?ffnen: Segmente erscheinen initial gr?n, KPIs zeigen Baseline-Werte.
- Button "Was-w?re-wenn" bet?tigen: KPIs steigen sichtbar, 1?3 Segmente f?rben sich gelb/rot.
- Browser-Konsole bleibt frei von Fehlern.
