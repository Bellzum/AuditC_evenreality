---
date: 2026-06-05
type: documentation
project: AuditC-PathGuard
status: active
tags: [smart-glasses, even-realities, g2, fastapi, lab-sop, compliance]
---

## TL;DR

AuditC PathGuard — hands-free COVID-19 PCR SOP compliance assistant for Even Realities G2 smart glasses. Voice-guided step verification with AR overlay feedback. Three outcomes per step: CONFIRMED (advance), REPEAT (loop), FLAGGED (supervisor log).

## Architecture

```
Phone browser (Vite app)
  ├── Even Hub SDK → G2 glasses over BLE (display overlays)
  ├── Web Speech API → captures voice on phone mic
  └── fetch() → FastAPI backend on Mac (WiFi)

Mac (FastAPI)
  ├── POST /verify-step     → keyword classification → pass/fail/flag
  ├── POST /log-observation → append to session.json
  ├── POST /generate-report → PDF audit trail
  └── POST /reset-session   → clear session.json
```

## Display Layout (576×288px, 4-bit greyscale)

```
┌─────────────────────────────────────────┐
│ AuditC | COVID-19 PCR          y=0  h=27│
│                                          │
│ Step 1/5                       y=30      │
│ Specimen Intake                          │
│                                          │
│ Confirm specimen ID and condition h=162 │
│                                          │
│ ✓ CONFIRMED                    y=200 h=30│
│ "specimen id confirmed barcode…" y=232   │
└─────────────────────────────────────────┘
```

## Step Verification Logic

| Spoken text contains        | Outcome   | Display            | Next action              |
|-----------------------------|-----------|--------------------|--------------------------|
| No exception words          | CONFIRMED | `✓ CONFIRMED`      | Advance to next step     |
| contaminated / failed / error / wrong / expired / missing / abnormal / leak / spill / broken / repeat / redo | REPEAT | `↺ REPEAT STEP` | Log incident, listen again |
| "flag issue" / "supervisor" / "flag this" | FLAGGED | `⚑ FLAGGED` | Log, pause — tap glasses or button to resume |

## Run Instructions

### Terminal 1 — Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Terminal 2 — Glasses App

```bash
cd glasses-app
npm install
npm run dev
```

Open `http://<mac-ip>:5173` on the paired phone browser.

> **HTTPS note:** Web Speech API requires HTTPS on non-localhost. On the phone, either:
> - Use a tunnel: `npx localtunnel --port 5173`
> - Or configure Vite HTTPS: add `https: true` to `vite.config.ts` server block and trust the cert

### Connect glasses

1. Pair G2 to phone via Even Realities app
2. Open the companion URL on the phone browser
3. Tap "Start Listening" (or single-tap glasses touchpad)
4. Speak each step confirmation aloud
5. Double-tap glasses touchpad to exit

### Download report

After all 5 steps confirm, tap "Download Report" in the companion app.

## Backend Endpoints

| Method | Path               | Body                                              | Returns             |
|--------|--------------------|---------------------------------------------------|---------------------|
| POST   | /verify-step       | `{step_id, spoken_text}`                          | `{result, step_id}` |
| POST   | /log-observation   | `{step_id, spoken_text, outcome}`                 | `{status, entry}`   |
| POST   | /generate-report   | —                                                 | PDF file            |
| POST   | /reset-session     | —                                                 | `{status}`          |
| GET    | /health            | —                                                 | `{status}`          |

## SOP Steps

Defined in `sop_config.json` and mirrored in both `glasses-app/src/sop.ts` and `backend/main.py`.

1. Specimen Intake — Confirm specimen ID and condition
2. Reagent Aliquot — Confirm reagent lot + volume measured
3. Transfer to Tube — Confirm tube barcode matches specimen
4. PCR Machine Run — Confirm run initiated and cycling
5. Result Analysis — Confirm result recorded and logged

## File Structure

```
G2_glasses/
├── glasses-app/
│   ├── src/
│   │   ├── main.ts       # Bridge init, event loop, state machine
│   │   ├── display.ts    # G2 container layout + serialized updates
│   │   ├── sop.ts        # SOP steps + keyword classification
│   │   ├── voice.ts      # Web Speech API wrapper
│   │   └── api.ts        # FastAPI client
│   ├── index.html        # Companion UI (phone browser)
│   ├── app.json          # Even Hub app manifest
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── backend/
│   ├── main.py           # FastAPI app — all 5 endpoints
│   └── requirements.txt
├── sop_config.json       # Canonical SOP step definitions
└── README.md
```

## Sources

- Even Hub SDK templates: https://github.com/even-realities/evenhub-templates
- SDK package: `@evenrealities/even_hub_sdk@^0.0.10`
- Display spec: 576×288px, 4-bit greyscale, 27px line height (LVGL)
