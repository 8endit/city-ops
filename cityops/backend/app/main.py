from __future__ import annotations

from functools import cached_property
from pathlib import Path
from typing import Literal, Optional

import orjson
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel, ConfigDict, Field


APP_ROOT = Path(__file__).resolve().parent
DATA_PATH = APP_ROOT.parent.parent / "data" / "corridor.geojson"


class EventPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["accident", "closure", "construction", "ems", "clear"]
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    severity: Optional[int] = Field(default=None, ge=1, le=5)


class StateStore:
    def __init__(self) -> None:
        self.event_active: bool = False
        self.severity: int = 1
        self.focus_node_id: Optional[str] = None

    def update(self, payload: EventPayload) -> None:
        self.event_active = payload.type != "clear"
        if payload.severity is not None:
            self.severity = max(1, min(5, payload.severity))
        elif not self.event_active:
            self.severity = 1
        self.focus_node_id = payload.node_id

    @cached_property
    def baseline_eta(self) -> int:
        return 340

    def kpi_metrics(self) -> dict[str, float | int]:
        eta_ems = self.baseline_eta
        if not self.event_active:
            return {
                "eta_ems": eta_ems,
                "travel_time_delta": 0,
                "queue_len_estimate": 120,
            }

        severity = self.severity
        delta_factor = 0.2 + 0.05 * (severity - 1)
        travel_time_delta = int(eta_ems * delta_factor)
        return {
            "eta_ems": eta_ems + travel_time_delta,
            "travel_time_delta": travel_time_delta,
            "queue_len_estimate": 300,
        }


STATE = StateStore()

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
    return STATE.kpi_metrics()


@app.post("/api/event")
def toggle_event(payload: EventPayload) -> dict[str, object]:
    STATE.update(payload)
    return {
        "ok": True,
        "state": {
            "event_active": STATE.event_active,
            "severity": STATE.severity,
            "focus_node_id": STATE.focus_node_id,
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

    if not STATE.event_active:
        for feature in features:
            properties = feature.setdefault("properties", {})
            properties["congestion"] = 0.2
        return payload

    severity = STATE.severity
    focus_id = STATE.focus_node_id

    focus_index = 0
    if focus_id:
        for idx, feature in enumerate(features):
            if feature.get("properties", {}).get("id") == focus_id:
                focus_index = idx
                break

    hotspot_count = 1 + severity // 2

    hotspot_indices = {
        min(len(features) - 1, max(0, focus_index + offset))
        for offset in range(hotspot_count)
    }

    for idx, feature in enumerate(features):
        properties = feature.setdefault("properties", {})
        if idx in hotspot_indices:
            properties["congestion"] = 0.8
        else:
            properties["congestion"] = 0.2

    return payload


@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        await websocket.send_json({"hello": "cityops"})
    finally:
        await websocket.close()
