"""Minimal, reproducible local-only demo target fixture for Veriqo.

Provides a predictable local web target with:
- Healthy page and flow (passing assertions)
- Known failing scenario (buggy flow triggering assertion failures and BlindReplay confirmations)
- Predictable DOM selectors and zero external network calls, credentials, or LLMs.
- Strict loopback binding (127.0.0.1 only) to prevent public exposure.

Startup:
    python -m app.demo_fixture [--port 8080]

Shutdown:
    Press Ctrl+C
"""

import argparse
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys
import threading
from typing import Generator, Tuple

HEALTHY_HOME_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Veriqo Demo Target Store</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; padding: 1.5rem; border-radius: 8px; border: 1px solid #334155; max-width: 600px; margin: 0 auto; }
    h1 { color: #38bdf8; margin-top: 0; }
    a.btn { display: inline-block; padding: 0.5rem 1rem; margin-right: 0.5rem; border-radius: 4px; text-decoration: none; font-weight: 500; }
    .btn-primary { background: #0284c7; color: white; }
    .btn-danger { background: #dc2626; color: white; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; background: #166534; color: #86efac; }
  </style>
</head>
<body>
  <div class="card">
    <h1 id="welcome-heading">Veriqo Demo Target Store</h1>
    <p id="welcome-desc">Predictable local fixture for automated browser journey execution and BlindReplay verification.</p>
    <div style="margin: 1.5rem 0;">
      <a id="nav-healthy" class="btn btn-primary" href="/order">Healthy Checkout Flow</a>
      <a id="nav-buggy" class="btn btn-danger" href="/buggy-order">Buggy Checkout Flow</a>
    </div>
    <span id="server-status" class="badge">Online - Local Fixture</span>
  </div>
</body>
</html>
"""

HEALTHY_ORDER_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Order Checkout</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; padding: 1.5rem; border-radius: 8px; max-width: 500px; margin: 0 auto; }
    input { width: 100%; padding: 0.5rem; margin-bottom: 1rem; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: white; box-sizing: border-box; }
    button { padding: 0.5rem 1rem; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer; }
    #order-status { margin-top: 1rem; font-weight: bold; }
    .success { color: #4ade80; }
  </style>
</head>
<body>
  <div class="card">
    <h1 id="page-title">Order Checkout</h1>
    <form id="order-form" onsubmit="event.preventDefault(); submitOrder();">
      <label for="email-input">Customer Email:</label>
      <input id="email-input" type="text" placeholder="customer@example.com" value="tester@veriqo.local" />
      <button id="submit-order-btn" type="submit">Submit Order</button>
    </form>
    <div id="order-status" class="success">Ready for submission</div>
  </div>
  <script>
    function submitOrder() {
      document.getElementById("order-status").innerText = "Order Confirmed: #1001";
      document.getElementById("order-status").className = "success";
    }
  </script>
</body>
</html>
"""

BUGGY_ORDER_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Order Checkout</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; padding: 1.5rem; border-radius: 8px; max-width: 500px; margin: 0 auto; }
    input { width: 100%; padding: 0.5rem; margin-bottom: 1rem; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: white; box-sizing: border-box; }
    button { padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; }
    #order-status { margin-top: 1rem; font-weight: bold; }
    .error { color: #f87171; }
    .error-badge { display: inline-block; padding: 0.25rem 0.5rem; background: #991b1b; color: #fecaca; border-radius: 4px; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1 id="page-title">Buggy Order Checkout</h1>
    <form id="order-form" onsubmit="event.preventDefault(); submitOrder();">
      <label for="email-input">Customer Email:</label>
      <input id="email-input" type="text" placeholder="customer@example.com" value="tester@veriqo.local" />
      <button id="submit-order-btn" type="submit">Submit Order</button>
    </form>
    <div id="order-status" class="error">Ready for submission</div>
    <div id="error-badge" style="display:none;" class="error-badge">Internal Error</div>
  </div>
  <script>
    function submitOrder() {
      // Deliberately violates the expected 'Order Confirmed: #1001' contract
      document.getElementById("order-status").innerText = "Internal Server Error: 500";
      document.getElementById("order-status").className = "error";
      document.getElementById("error-badge").style.display = "inline-block";
      document.getElementById("error-badge").innerText = "Error 500: Database lock acquisition failed";
    }
  </script>
</body>
</html>
"""


class DemoFixtureHandler(BaseHTTPRequestHandler):
    """Local-only HTTP handler serving predictable fixture content."""

    def log_message(self, format: str, *args) -> None:
        """Suppress standard HTTP server access logging in terminal/tests."""
        return

    def do_GET(self) -> None:
        path = self.path.split("?")[0]
        if path == "/":
            self._send_html(HEALTHY_HOME_HTML)
        elif path == "/order":
            self._send_html(HEALTHY_ORDER_HTML)
        elif path == "/buggy-order":
            self._send_html(BUGGY_ORDER_HTML)
        else:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")

    def _send_html(self, content: str) -> None:
        data = content.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def create_demo_server(host: str = "127.0.0.1", port: int = 8080) -> HTTPServer:
    """Creates an HTTPServer bound strictly to the local loopback interface."""
    # Safety guard: refuse non-loopback addresses
    if host not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError(
            f"Security Violation: Demo fixture must bind to loopback address (127.0.0.1), got '{host}'"
        )
    return HTTPServer((host, port), DemoFixtureHandler)


@contextmanager
def run_demo_fixture(host: str = "127.0.0.1", port: int = 0) -> Generator[str, None, None]:
    """Context manager for running the demo fixture on an ephemeral loopback port."""
    server = create_demo_server(host=host, port=port)
    assigned_port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://{host}:{assigned_port}"
    finally:
        server.shutdown()
        server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Veriqo Local Reproducible Demo Fixture")
    parser.add_argument("--host", default="127.0.0.1", help="Loopback host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8080, help="Port to listen on (default: 8080)")
    args = parser.parse_args()

    try:
        server = create_demo_server(host=args.host, port=args.port)
    except Exception as exc:
        print(f"Error starting demo fixture: {exc}", file=sys.stderr)
        sys.exit(1)

    print("==================================================================")
    print(f"  Veriqo Local Demo Fixture running on http://{args.host}:{args.port}")
    print("==================================================================")
    print("  Endpoints:")
    print(f"    - http://{args.host}:{args.port}/             (Healthy Home)")
    print(f"    - http://{args.host}:{args.port}/order        (Passing Order Flow)")
    print(f"    - http://{args.host}:{args.port}/buggy-order  (Failing Assertion Flow)")
    print("  Security: Local loopback only. No credentials or external calls.")
    print("  Press Ctrl+C to shut down cleanly.")
    print("==================================================================")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down demo fixture cleanly...")
    finally:
        server.server_close()
        print("Demo fixture stopped.")


if __name__ == "__main__":
    main()
