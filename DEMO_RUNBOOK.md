# VERIQO — HACKATHON DEMO RUNBOOK

**Product:** Veriqo — Autonomous AI Quality Engineering Platform  
**Target Environment:** Windows 11 / Windows PowerShell  
**Target Audience:** Judges, Evaluators, and Engineers  

---

## 1. Quick Setup & Environment Verification

### Prerequisites
- **Python**: 3.10+ (Python 3.11 recommended)
- **Node.js**: v20.x or v22.x LTS with npm
- **PowerShell**: Windows PowerShell 5.1 or PowerShell 7+
- **Playwright Chromium**: Browser binaries installed

---

## 2. One-Time Setup Commands

Open a Windows PowerShell terminal as Administrator or regular user:

```powershell
# Navigate to the repository root
cd c:\VERIQO_VIT_Apex

# 1. Setup Backend Virtual Environment & Dependencies
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium chromium-headless-shell
Copy-Item .env.example .env
cd ..

# 2. Setup Frontend Dependencies
cd frontend
npm install
Copy-Item .env.example .env.local
cd ..
```

---

## 3. Automated Verification Checks (Pre-Flight)

Execute the full verification suite before starting the live demo:

### A. Run Backend Unit & Integration Tests (133 Tests)
```powershell
cd c:\VERIQO_VIT_Apex\backend
.\.venv\Scripts\pytest.exe tests -v
```
*Expected Result: `133 passed in ~110s` (0 failures).*

### B. Run Controlled Benchmark Suite (6 Scenarios)
```powershell
cd c:\VERIQO_VIT_Apex\backend
.\.venv\Scripts\python.exe -m pytest tests/test_benchmark.py -v
```
*Expected Result: All 6 benchmark scenarios (`BM-01` to `BM-06`) pass deterministically.*

### C. Run Frontend Type-Check & Production Build
```powershell
cd c:\VERIQO_VIT_Apex\frontend
npx tsc --noEmit
npm run lint
npm run build
```
*Expected Result: `0 errors`, `0 warnings`, `27 routes compiled successfully`.*

---

## 4. Live Demonstration Walkthrough (Step-by-Step)

### Terminal 1: Start the Local Demo Target Store
The repository includes a dedicated, predictable local web store with healthy and buggy flows:

```powershell
cd c:\VERIQO_VIT_Apex\backend
.\.venv\Scripts\python.exe -m app.demo_fixture --port 8080
```
- **Demo Store URL**: `http://127.0.0.1:8080`
- **Healthy Checkout Flow**: `http://127.0.0.1:8080/order`
- **Buggy Checkout Flow (Planted 500 Defect)**: `http://127.0.0.1:8080/buggy-order`

---

### Terminal 2: Start the FastAPI Backend
```powershell
cd c:\VERIQO_VIT_Apex\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- **Backend API**: `http://127.0.0.1:8000`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **Health Check**: `http://127.0.0.1:8000/health`

---

### Terminal 3: Start the Next.js Frontend
```powershell
cd c:\VERIQO_VIT_Apex\frontend
npm run dev
```
- **Frontend Dashboard**: `http://localhost:3000`

*(Alternatively, use `.\start-dev.ps1 -SeparateWindows` from root to launch everything automatically).*

---

## 5. Live Judge Demonstration Script

### Step 1: Open the Veriqo Command Center
1. Open your browser and navigate to `http://localhost:3000`.
2. Notice the **Neo-Brutalist Stitch UI** featuring high-contrast borders, sharp badges, and real-time backend telemetry status ("CONNECTED - FASTAPI 127.0.0.1:8000").
3. Press `Ctrl + K` or click the search bar:
   - Notice the interactive **ESC** button on the top right.
   - Click it or click the backdrop to test clean dismissal.

---

### Step 2: Register the Demo Target Application
1. Navigate to **Projects** (`http://localhost:3000/projects`) or click **"Connect New App"**.
2. Enter the target details:
   - **App Name**: `Veriqo Demo Store`
   - **Target URL**: `http://127.0.0.1:8080`
   - **Environment**: `Staging`
3. Click **"Save Application"**.
4. The backend registers the target with strict loopback validation.

---

### Step 3: Run Bounded Autonomous Exploration (New Feature)
1. In the target app card or via the REST API, trigger autonomous exploration:
   ```powershell
   curl -X POST "http://127.0.0.1:8000/api/v1/target-apps/1/explore?max_pages=5&save_journey=true"
   ```
2. The browser automatically navigates the local demo store, crawls same-origin links, identifies interactive inputs, filters destructive actions, and persists a newly synthesized regression journey.

---

### Step 4: Execute a Test Run on Buggy Checkout
1. Navigate to **Test Runs** (`http://localhost:3000/test-runs`).
2. Trigger the pre-configured **Buggy Checkout Flow** or initiate via API:
   - Target URL: `http://127.0.0.1:8080/buggy-order`
   - Action: Click `#submit-order-btn`
   - Assertion: Expect text `"Order Confirmed: #1001"`
3. The Playwright browser executes, encounters `"Internal Server Error: 500"`, captures a failure screenshot to `backend/evidence/`, and generates a **HIGH Severity Defect**.

---

### Step 5: Inspect Show Me Mode & Fix Prompt
1. Navigate to **Bug Reports** (`http://localhost:3000/bug-reports`).
2. Click on the newly generated defect.
3. Observe **Show Me Mode**:
   - Detailed failure diagnostic.
   - Exact screenshot proof captured at the moment of assertion failure.
   - Expected vs. Actual comparison.
4. Click **"Export Fix Prompt"**:
   - View the generated clean Markdown bug report formatted specifically for IDE AI coding assistants.

---

### Step 6: Trigger BlindReplay (The Core Innovation)
1. On the defect details card, click **"Trigger BlindReplay"**.
2. Watch the execution log:
   - A completely fresh, isolated browser context is spawned.
   - No cookies, session state, or script selectors are inherited.
   - Semantic text and role heuristics independently discover the form.
   - The failure reproduces truthfully.
3. Replay outcome is recorded as **`CONFIRMED`**.
4. The defect status automatically transitions to **`VERIFIED`**.

---

### Step 7: Issue & Verify a QA Certificate
1. Navigate to **Certificates** (`http://localhost:3000/certificates`).
2. Click **"Issue QA Certificate"** for the verified test run.
3. Observe the calculated score (e.g., `85.0/100`), weighted defect penalties, and the canonical **SHA-256 integrity hash**.
4. Test Tamper Detection:
   - Click **"Verify Certificate"**: Confirms `VERIFIED` status.
   - Mutate a payload parameter (simulated via `BM-06`): Immediately triggers **`TAMPER_DETECTED`**.

---

### Step 8: Sync & Ingest OpenAPI / HAR Specs (New Feature)
1. Navigate to **Integrations** (`http://localhost:3000/integrations`).
2. Click **"Sync & Ingest Specs"** in the top action bar.
3. Switch between the **OpenAPI 3.x** and **HAR Traffic** tabs.
4. Paste an OpenAPI specification or HAR JSON trace.
5. Click **"Validate & Ingest Spec"**.
6. The backend validates paths, converts them into safe candidate browser journeys, and automatically redacts sensitive auth headers and cookies.

---

### Step 9: View Real-Time Analytics
1. Navigate to **Analytics** (`http://localhost:3000/analytics`).
2. Inspect the live metrics computed directly from persistent database records:
   - Total test runs and pass/fail distribution.
   - Defect severity breakdown (Critical, High, Medium, Low).
   - BlindReplay verification ratio.
   - Execution duration historical trends.

---

## 6. Troubleshooting & Recovery Commands

| Problem | Cause | Recovery Command |
| :--- | :--- | :--- |
| **Port 8000 or 3000 In Use** | Orphaned process running in background | Run in PowerShell:<br>`Get-Process python, node -ErrorAction SilentlyContinue \| Stop-Process -Force` |
| **Playwright Browser Not Found** | Binaries not downloaded in `.venv` | Run in `backend/`: <br>`.\.venv\Scripts\playwright install chromium chromium-headless-shell` |
| **Reset Demo Database** | Clean slate for fresh demonstration | Make POST request to `/api/v1/reset-demo` or delete `backend/veriqo.db` and restart Uvicorn. |
| **Frontend Cannot Connect** | Backend is offline or env URL mismatch | Check `frontend/.env.local` contains `BACKEND_INTERNAL_URL=http://127.0.0.1:8000`. |
