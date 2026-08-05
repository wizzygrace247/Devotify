import importlib
import os
import sys
import types
from pathlib import Path

import bcrypt
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def test_authenticate_and_vote_uses_credentials(monkeypatch, tmp_path):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SEPOLIA_RPC_URL", "http://localhost:8545")
    monkeypatch.setenv("DEVOTIFY_VOTING_ADDRESS", "0x0000000000000000000000000000000000000000")
    monkeypatch.setenv("RELAYER_PRIVATE_KEY", "0x" + "11" * 32)
    monkeypatch.setenv("API_KEY", "test-api")

    if "main" in sys.modules:
        del sys.modules["main"]
    if "relayer" in sys.modules:
        del sys.modules["relayer"]

    import main

    monkeypatch.setattr(main, "register_voter_by_id", lambda event_id, voter_id: {"tx_hash": "0xabc"})
    monkeypatch.setattr(main, "vote_by_id", lambda event_id, option_index, voter_id: {"tx_hash": "0xdef"})

    class FakeCallResult:
        def __init__(self, value):
            self.value = value

        def call(self):
            return self.value

    monkeypatch.setattr(main.contract.functions, "isRegistered", lambda *args, **kwargs: FakeCallResult(False))

    conn = main.get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO credential_voters (event_id, identity_key, password_hash, voter_id, used) VALUES (?, ?, ?, ?, 0)",
            (7, "student-1", bcrypt.hashpw(b"correcthorse", bcrypt.gensalt()).decode(), "0x1234"),
        )
        conn.commit()
    finally:
        conn.close()

    client = TestClient(main.app)
    response = client.post(
        "/events/7/authenticate-and-vote",
        json={"identity_key": "student-1", "password": "correcthorse", "option_index": 1},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "voted"
    assert body["option_index"] == 1
