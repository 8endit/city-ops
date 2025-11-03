from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any, Dict, Literal, Optional

import orjson
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel, ConfigDict, Field


APP_ROOT = Path(__file__).resolve().parent
DATA_PATH = APP_ROOT.parent.parent / "data" / "corridor.geojson"

BASE_ETA = 340
TYPE_FACTOR: Dict[str, float] = {
    "accident": 0.8,
    "closure": 1.0,
    "construction": 0.6,
    "ems": 0.4,
    "clear": 0.0,
}


class EventPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["accident", "closure", "construction", "ems", "clear"]
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    severity: Optional[int] = Field(default=None, ge=1, le=5)


STATE: Dict[str, Optional[object]] = {
    "event_active": False,
    "severity": 2,
    "event_type": "clear",
    "focus_node_id": None,
}


def clamp_severity(value: Optional[Any]) -> int:
    if value is None:
        return 1
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        numeric = 1
    return max(1, min(5, numeric))


def _build_kpi() -> Dict[str, int]:
    severity = clamp_severity(STATE.get("severity", 1))
    event_active = bool(STATE.get("event_active", False))
    event_type = STATE.get("event_type", "accident") or "accident"

    if not event_active:
        delta = 0
    else:
        factor = TYPE_FACTOR.get(str(event_type), TYPE_FACTOR["accident"])
        baseline_multiplier = 0.2 + 0.05 * (severity - 1)
        delta = int(BASE_ETA * baseline_multiplier * factor)

    return {
        "eta_ems": BASE_ETA + delta,
        "travel_time_delta": delta,
        "queue_len_estimate": 120 if delta == 0 else 300,
    }


app = FastAPI(default_response_class=ORJSONResponse)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/kpi")
def get_kpi() -> dict[str, float | int]:
    return _build_kpi()


@app.post("/api/event")
def toggle_event(payload: EventPayload) -> dict[str, object]:
    requested_severity = payload.severity if payload.severity is not None else STATE.get("severity")
    severity = clamp_severity(requested_severity)
    STATE["event_active"] = payload.type != "clear"
    STATE["severity"] = severity if STATE["event_active"] else 1
    STATE["event_type"] = payload.type if payload.type != "clear" else "clear"
    STATE["focus_node_id"] = payload.node_id
    return {
        "ok": True,
        "state": {
            "event_active": STATE["event_active"],
            "severity": STATE["severity"],
            "event_type": STATE["event_type"],
            "focus_node_id": STATE.get("focus_node_id"),
        },
    }


def _load_corridor() -> dict:
    with DATA_PATH.open("rb") as fh:
        return orjson.loads(fh.read())


@app.get("/api/map/segments")
def get_segments() -> dict:
    payload = _load_corridor()
    features = payload.get("features", [])

    if not features:
        return payload

    if not STATE.get("event_active", False):
        for feature in features:
            properties = feature.setdefault("properties", {})
            properties["congestion"] = 0.2
        return payload

    severity = clamp_severity(STATE.get("severity"))
    hotspot_target = max(1, min(3, 1 + severity // 2))
    hotspot_cap = min(hotspot_target, len(features))
    base_hot = 0.7 if STATE.get("event_type") == "construction" else 0.8
    congestion_value = min(1.0, base_hot + 0.05 * max(0, severity - 1))

    for idx, feature in enumerate(features):
        properties = feature.setdefault("properties", {})
        if idx < hotspot_cap:
            properties["congestion"] = congestion_value
        else:
            properties["congestion"] = 0.2

    return payload


@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json({"kpi": _build_kpi(), "ts": int(time.time())})
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
