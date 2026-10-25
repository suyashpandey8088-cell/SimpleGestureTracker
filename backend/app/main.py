import asyncio
from contextlib import asynccontextmanager
import os
import time
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from .inference import InferenceService, ModelUnavailable
from .schemas import SequenceRequest


# Same-origin browser communication by default. Add exact production frontend
# origins when deploying the API separately; never allow arbitrary origins.
def allowed_origins():
    return {
        s.strip()
        for s in os.getenv("ISL_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if s.strip()
    }


@asynccontextmanager
async def lifespan(app):
    app.state.inference = InferenceService()
    yield


app = FastAPI(
    title="GestureAI ISL translation research API", version="0.1.0", lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins()),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    # Do not echo submitted landmark coordinates or nonfinite numeric input.
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Invalid isl-landmarks-v1 request; check dimensions, timestamps, finite coordinates and boolean masks"
        },
    )


@app.get("/health")
def health():
    info = app.state.inference.info()
    return {
        "status": "ok" if info["ready"] else "model_unavailable",
        "model_ready": info["ready"],
    }


@app.get("/model-info")
def model_info():
    return app.state.inference.info()


@app.post("/translate/sequence")
async def translate(request: SequenceRequest):
    try:
        return await asyncio.to_thread(app.state.inference.predict, request)
    except ModelUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Inference failed; verify model compatibility"
        ) from e


@app.websocket("/ws/recognize")
async def recognize(ws: WebSocket):
    origin = ws.headers.get("origin")
    if origin not in allowed_origins():
        await ws.close(code=1008, reason="Origin not allowed")
        return
    await ws.accept()
    if not app.state.inference.ready:
        await ws.send_json(
            {"error": "model_unavailable", "message": app.state.inference.reason}
        )
        await ws.close(code=1013)
        return
    session = None
    previous = -1
    last_message = 0.0
    try:
        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await ws.close(code=1000, reason="Idle timeout")
                return
            # Also configure uvicorn --ws-max-size 2000000 to bound pre-parse memory.
            if len(raw) > 2_000_000:
                await ws.close(code=1009, reason="Sequence too large")
                return
            try:
                request = SequenceRequest.model_validate_json(raw)
            except (ValidationError, ValueError):
                await ws.send_json(
                    {
                        "error": "invalid_sequence",
                        "message": "Sequence does not match isl-landmarks-v1",
                    }
                )
                continue
            if session is None:
                session = request.session_id
            if session != request.session_id or request.sequence_id <= previous:
                await ws.send_json(
                    {
                        "error": "sequence_order",
                        "message": "Use one session and increasing sequence IDs per connection",
                    }
                )
                continue
            if time.monotonic() - last_message < 0.4:
                await ws.send_json(
                    {
                        "error": "rate_limit",
                        "message": "At most one sequence every 400 ms",
                    }
                )
                continue
            previous = request.sequence_id
            last_message = time.monotonic()
            try:
                # One in-flight request per socket; global nonblocking model lock
                # bounds concurrent execution. Worker finishes even on disconnect.
                response = await asyncio.wait_for(
                    asyncio.to_thread(app.state.inference.predict, request), timeout=15
                )
                await ws.send_json(response.model_dump())
            except ModelUnavailable as e:
                await ws.send_json(
                    {
                        "error": "model_unavailable",
                        "message": str(e),
                        "sequence_id": request.sequence_id,
                    }
                )
            except asyncio.TimeoutError:
                await ws.send_json(
                    {"error": "inference_timeout", "message": "Inference timed out"}
                )
                await ws.close(code=1013)
                return
            except Exception:
                await ws.send_json(
                    {
                        "error": "inference_failed",
                        "message": "Inference failed; check model compatibility",
                    }
                )
                await ws.close(code=1011)
                return
            if request.is_final:
                await ws.close(code=1000, reason="Utterance ended")
                return
    except WebSocketDisconnect:
        pass
