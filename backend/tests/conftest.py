"""Pytest fixtures and configuration."""

from http.server import BaseHTTPRequestHandler, HTTPServer
import threading
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app

# In-memory SQLite engine for testing with StaticPool
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create all tables before running tests and drop them after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provides a transactional database session for tests."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


class MockWebHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler serving controlled test pages."""

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        if self.path == "/about":
            content = "<html><body><h1>About Veriqo Target</h1><p>About page loaded.</p></body></html>"
        else:
            content = """
            <!DOCTYPE html>
            <html>
            <head><title>Veriqo Test Target</title></head>
            <body>
              <h1 id="heading">Welcome to Veriqo Test App</h1>
              <p id="status-text">Ready for testing</p>
              <input id="username-input" type="text" placeholder="Enter username" />
              <button id="submit-btn" onclick="document.getElementById('status-text').innerText = 'Submitted successfully'; document.getElementById('result').style.display = 'block';">Submit</button>
              <div id="result" style="display:none;">Action completed!</div>
              <a id="nav-link" href="/about">About</a>
            </body>
            </html>
            """
        self.wfile.write(content.encode("utf-8"))

    def log_message(self, format, *args):
        # Silence access logs in test output
        pass


@pytest.fixture(scope="session")
def local_test_server() -> Generator[str, None, None]:
    """Spins up a lightweight in-process HTTP server for browser tests."""
    server = HTTPServer(("127.0.0.1", 0), MockWebHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    base_url = f"http://127.0.0.1:{port}"
    yield base_url

    server.shutdown()
    server.server_close()
