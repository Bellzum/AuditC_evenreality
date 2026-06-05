from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime
from pathlib import Path
import json

app = FastAPI(title="AuditC Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

EXCEPTION_WORDS = [
    "contaminated", "failed", "error", "wrong", "expired",
    "missing", "abnormal", "leak", "spill", "broken", "repeat", "redo",
]

FLAG_TRIGGERS = ["flag issue", "supervisor", "flag this"]

SOP_STEPS = [
    {"id": 1, "name": "Specimen Intake",   "instruction": "Confirm specimen ID and condition"},
    {"id": 2, "name": "Reagent Aliquot",   "instruction": "Confirm reagent lot + volume measured"},
    {"id": 3, "name": "Transfer to Tube",  "instruction": "Confirm tube barcode matches specimen"},
    {"id": 4, "name": "PCR Machine Run",   "instruction": "Confirm run initiated and cycling"},
    {"id": 5, "name": "Result Analysis",   "instruction": "Confirm result recorded and logged"},
]

SESSION_FILE = Path("session.json")


# --- Models ---

class VerifyRequest(BaseModel):
    step_id: int
    spoken_text: str


class LogRequest(BaseModel):
    step_id: int
    spoken_text: str
    outcome: str  # confirmed | repeat | flagged


# --- Session helpers ---

def load_session() -> dict:
    if SESSION_FILE.exists():
        return json.loads(SESSION_FILE.read_text())
    session = {
        "session_id": datetime.now().strftime("%Y%m%d-%H%M%S"),
        "protocol": "COVID-19 PCR",
        "start_time": datetime.now().isoformat(),
        "observations": [],
    }
    SESSION_FILE.write_text(json.dumps(session, indent=2))
    return session


def save_session(session: dict) -> None:
    SESSION_FILE.write_text(json.dumps(session, indent=2))


# --- Endpoints ---

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/verify-step")
def verify_step(req: VerifyRequest):
    text = req.spoken_text.lower()
    is_flag = any(t in text for t in FLAG_TRIGGERS)
    has_exception = any(w in text for w in EXCEPTION_WORDS)

    if is_flag:
        result = "flag"
    elif has_exception:
        result = "fail"
    else:
        result = "pass"

    return {
        "result": result,
        "step_id": req.step_id,
        "spoken_text": req.spoken_text,
        "matched_exception": next((w for w in EXCEPTION_WORDS if w in text), None),
    }


@app.post("/log-observation")
def log_observation(req: LogRequest):
    session = load_session()
    entry = {
        "timestamp": datetime.now().isoformat(),
        "step_id": req.step_id,
        "spoken_text": req.spoken_text,
        "outcome": req.outcome,
    }
    session["observations"].append(entry)
    save_session(session)
    return {"status": "logged", "entry": entry}


@app.post("/generate-report")
def generate_report_pdf():
    try:
        from fpdf import FPDF
    except ImportError:
        raise HTTPException(status_code=500, detail="fpdf2 not installed — run: pip install fpdf2")

    session = load_session()
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Header
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "AuditC PathGuard - Audit Report", ln=True, align="C")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, f"Protocol: {session.get('protocol', 'COVID-19 PCR')}", ln=True, align="C")
    pdf.cell(0, 6, f"Session ID: {session.get('session_id', 'unknown')}", ln=True, align="C")
    pdf.cell(0, 6, f"Session started: {session['start_time']}", ln=True, align="C")
    pdf.cell(0, 6, f"Report generated: {datetime.now().isoformat()}", ln=True, align="C")
    pdf.ln(8)

    # Per-step summary
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Step Summary", ln=True)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)

    for step in SOP_STEPS:
        obs = [o for o in session["observations"] if o["step_id"] == step["id"]]
        confirmed_count = sum(1 for o in obs if o["outcome"] == "confirmed")
        repeat_count    = sum(1 for o in obs if o["outcome"] == "repeat")
        flag_count      = sum(1 for o in obs if o["outcome"] == "flagged")
        overall = "CONFIRMED" if confirmed_count > 0 else "INCOMPLETE"

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, f"Step {step['id']}: {step['name']}  [{overall}]", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, f"  Instruction: {step['instruction']}", ln=True)
        pdf.cell(0, 5, f"  Attempts: {len(obs)}  |  Confirmed: {confirmed_count}  |  Repeats: {repeat_count}  |  Flags: {flag_count}", ln=True)

        for o in obs:
            label = o["outcome"].upper()
            ts = o["timestamp"][11:19]  # HH:MM:SS
            pdf.set_font("Helvetica", "I", 8)
            pdf.cell(0, 5, f'    [{ts}] {label}: "{o["spoken_text"]}"', ln=True)

        pdf.ln(3)

    # Exceptions section
    flagged = [o for o in session["observations"] if o["outcome"] == "flagged"]
    if flagged:
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Flagged Incidents", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(3)
        pdf.set_font("Helvetica", "", 9)
        for o in flagged:
            step_name = next((s["name"] for s in SOP_STEPS if s["id"] == o["step_id"]), "Unknown")
            pdf.cell(0, 6, f'  Step {o["step_id"]} ({step_name}) @ {o["timestamp"][11:19]}: "{o["spoken_text"]}"', ln=True)
        pdf.ln(4)

    # Footer
    pdf.set_y(-20)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, "Generated by AuditC PathGuard v1.0", align="C")

    report_path = Path(f"auditc_report_{session.get('session_id', 'session')}.pdf")
    pdf.output(str(report_path))

    return FileResponse(
        str(report_path),
        media_type="application/pdf",
        filename=report_path.name,
    )


@app.post("/reset-session")
def reset_session():
    if SESSION_FILE.exists():
        SESSION_FILE.unlink()
    return {"status": "session reset"}
