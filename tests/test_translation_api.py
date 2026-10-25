import time
import numpy as np
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.features import preprocess, InsufficientTracking
from backend.app.schemas import SequenceRequest, RecognitionResponse
from pydantic import ValidationError


def payload():
    p = np.zeros((5, 75, 3))
    mask = np.zeros((5, 75), bool)
    p[:, 53] = [0.4, 0.3, 0]
    p[:, 54] = [0.6, 0.3, 0]
    mask[:, 53:55] = True
    p[:, 0] = [0.5, 0.5, 0]
    p[:, 21] = [0.7, 0.5, 0]
    mask[:, [0, 21]] = True
    return {
        "session_id": "unit-test",
        "sequence_id": 0,
        "timestamps_ms": [0, 100, 200, 300, 400],
        "landmarks": p.tolist(),
        "validity_mask": mask.tolist(),
    }


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("ISL_MODEL_DIR", raising=False)
    with TestClient(app) as c:
        yield c


def test_untrained_service_never_returns_translation(client):
    assert client.get("/health").json() == {
        "status": "model_unavailable",
        "model_ready": False,
    }
    info = client.get("/model-info").json()
    assert info["ready"] is False and info["rgb_supported"] is False
    assert client.post("/translate/sequence", json=payload()).status_code == 503
    with client.websocket_connect(
        "/ws/recognize", headers={"origin": "http://localhost:5173"}
    ) as ws:
        response = ws.receive_json()
        assert response["error"] == "model_unavailable"
        assert "translation" not in response


def test_origin_rejected(client):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            "/ws/recognize", headers={"origin": "https://untrusted.invalid"}
        ):
            pass


@pytest.mark.parametrize(
    "edit",
    [
        lambda p: p.update(timestamps_ms=[0] * 5),
        lambda p: p["landmarks"][0].pop(),
        lambda p: p.update(validity_mask=[]),
        lambda p: p.update(schema_version="rgb-v1"),
        lambda p: p.update(timestamps_ms=[0, 100, 200, 300, 25000]),
        lambda p: p["landmarks"][0][0].__setitem__(0, 11),
    ],
)
def test_invalid_sequences_are_rejected(edit):
    p = payload()
    edit(p)
    with pytest.raises(ValidationError):
        SequenceRequest.model_validate(p)


def test_features_preserve_motion_and_mask_missing_coordinates():
    p = payload()
    points = np.array(p["landmarks"])
    m = np.array(p["validity_mask"])
    points[:, 0, 0] += np.arange(5) * 0.02
    f, t = preprocess(points, m, p["timestamps_ms"])
    assert f.shape == (5, 525) and np.isfinite(f).all()
    assert f[-1, 0] > f[0, 0]  # global motion retained
    assert np.all(f[:, 3:6] == 0)  # missing point is not a real zero observation
    shifted = points + np.array([2, 3, 0])
    same, _ = preprocess(shifted, m, p["timestamps_ms"])
    np.testing.assert_allclose(same, f, atol=1e-4)


def test_no_hands_or_shoulders_is_not_a_sentence():
    p = payload()
    with pytest.raises(InsufficientTracking):
        preprocess(p["landmarks"], np.zeros((5, 75), bool), p["timestamps_ms"])


def test_websocket_ordering_and_final_boundary(client):
    class ContractStub:
        ready = True

        def predict(self, p):
            return RecognitionResponse(sequence_id=p.sequence_id, status="unknown")

    app.state.inference = ContractStub()
    with client.websocket_connect(
        "/ws/recognize", headers={"origin": "http://localhost:5173"}
    ) as ws:
        p = payload()
        ws.send_json(p)
        assert ws.receive_json()["status"] == "unknown"
        ws.send_json(p)
        assert ws.receive_json()["error"] == "sequence_order"
        p["sequence_id"] = 1
        ws.send_json(p)
        assert ws.receive_json()["error"] == "rate_limit"
        time.sleep(0.41)
        p["is_final"] = True
        ws.send_json(p)
        result = ws.receive_json()
        assert result["translation"] == "" and result["is_final"] is False


def test_http_validation_does_not_echo_landmarks(client):
    p = payload()
    p["validity_mask"][0][0] = "yes"
    response = client.post("/translate/sequence", json=p)
    assert response.status_code == 422 and "landmarks" not in response.json()


def test_hand_and_body_depth_do_not_share_a_false_origin():
    p = payload()
    points = np.array(p["landmarks"])
    m = np.array(p["validity_mask"])
    points[:, 53:55, 2] = 0.4
    points[:, 0, 2] = 0.1
    f, _ = preprocess(points, m, p["timestamps_ms"])
    np.testing.assert_allclose(f[:, 2], 0.5, atol=1e-5)
