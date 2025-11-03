## CityOps Starterkit

CityOps ist ein leichtgewichtiges Starterprojekt fuer kommunale Einsatzloesungen mit einem FastAPI-Backend und einer React/Vite-Oberflaeche. Die Anwendung zeigt einen Beispiel-Korridor als GeoJSON, KPI-Karten und eine einfache "Was-waere-wenn"-Simulation.

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
- Hinweis: Der Vite-Proxy verhindert CORS-Probleme fuer `/api` und `/ws` waehrend der lokalen Entwicklung.
- Codespaces/Remote: Ports 8000 (HTTP) und 5173 (Vite) veroeffentlichen bzw. weiterleiten.

### Smoke-Tests
- `GET /api/health` -> `{"status":"ok"}`
- Frontend oeffnen: Segmente erscheinen initial gruen, KPIs zeigen Baseline-Werte.
- Button "Was-waere-wenn" betaetigen: KPIs steigen sichtbar, 1-3 Segmente faerben sich gelb/rot.
- Browser-Konsole bleibt frei von Fehlern.

### Fallback
- Sollte die KPI-API temporaer nicht erreichbar sein, zeigt das Frontend automatisch Baseline-Werte (ETA 340 s, Delta 0 s, Stauwelle 120 m), bis erneut Daten eintreffen.
