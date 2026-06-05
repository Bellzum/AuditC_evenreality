import { waitForEvenAppBridge, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { SOP_STEPS, classifyText } from './sop';
import { initDisplay, setStep, setStatus, setHeard } from './display';
import { verifyStep, logObservation, generateReport } from './api';
import { VoiceInput } from './voice';
// --- Companion UI helpers ---
const appStatus = document.getElementById('app-status');
const glassesPreview = document.getElementById('glasses-preview');
const micBtn = document.getElementById('mic-btn');
const reportBtn = document.getElementById('report-btn');
const logEl = document.getElementById('log');
let previewState = { step: 'Connecting...', status: 'Initializing...', heard: '' };
function updatePreview() {
    glassesPreview.innerHTML =
        `<span class="header">AuditC | COVID-19 PCR</span>\n` +
            `<span class="step">${previewState.step}</span>\n\n` +
            `<span class="status-${getStatusClass()}">${previewState.status}</span>\n` +
            `<span class="heard">${previewState.heard}</span>`;
}
function getStatusClass() {
    if (previewState.status.startsWith('✓ CONFIRMED') || previewState.status.startsWith('✓ ALL'))
        return 'confirmed';
    if (previewState.status.startsWith('↺'))
        return 'repeat';
    if (previewState.status.startsWith('⚑'))
        return 'flagged';
    return 'listening';
}
function log(msg) {
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.prepend(line);
}
// --- State ---
let currentStepIndex = 0;
let processing = false;
let awaitingFlagResume = false;
let bridge;
let voice;
// --- Core step/display sync ---
async function showCurrentStep() {
    const s = SOP_STEPS[currentStepIndex];
    previewState.step = `Step ${s.id}/${SOP_STEPS.length}\n${s.name}\n\n${s.instruction}`;
    updatePreview();
    await setStep(bridge, s.id, SOP_STEPS.length, s.name, s.instruction);
}
async function applyStatus(status) {
    previewState.status = {
        idle: '● Ready — speak to confirm',
        listening: '◎ Listening...',
        confirmed: '✓ CONFIRMED',
        repeat: '↺ REPEAT STEP',
        flagged: '⚑ FLAGGED — tap to continue',
        complete: '✓ ALL STEPS COMPLETE',
    }[status];
    updatePreview();
    await setStatus(bridge, status);
}
// --- Speech handler ---
async function onSpeech(text) {
    if (processing)
        return;
    if (awaitingFlagResume)
        return; // waiting for tap, ignore speech
    processing = true;
    log(`Heard: "${text}"`);
    previewState.heard = `"${text}"`;
    updatePreview();
    await setHeard(bridge, text);
    const outcome = classifyText(text);
    try {
        const step = SOP_STEPS[currentStepIndex];
        if (outcome === 'flagged') {
            await logObservation(step.id, text, 'flagged');
            await applyStatus('flagged');
            awaitingFlagResume = true;
            log(`FLAG raised on step ${step.id} — waiting for tap to resume`);
            processing = false;
            return;
        }
        // Always confirm with backend (handles server-side logic / audit log)
        const res = await verifyStep(step.id, text);
        const backendOutcome = res.result === 'pass' ? 'confirmed' : 'repeat';
        if (backendOutcome === 'confirmed') {
            await logObservation(step.id, text, 'confirmed');
            await applyStatus('confirmed');
            log(`Step ${step.id} CONFIRMED`);
            await sleep(2000);
            currentStepIndex++;
            if (currentStepIndex >= SOP_STEPS.length) {
                previewState.step = `All ${SOP_STEPS.length} steps complete`;
                previewState.status = '✓ ALL STEPS COMPLETE';
                updatePreview();
                await setStatus(bridge, 'complete');
                voice.stop();
                micBtn.disabled = true;
                reportBtn.disabled = false;
                appStatus.textContent = 'Session complete — download your report';
                log('All steps complete');
            }
            else {
                await showCurrentStep();
                await applyStatus('listening');
            }
        }
        else {
            await logObservation(step.id, text, 'repeat');
            await applyStatus('repeat');
            log(`Step ${step.id} REPEAT — exception word detected`);
            await sleep(1500);
            await applyStatus('listening');
        }
    }
    catch (err) {
        log(`Error: ${err}`);
    }
    finally {
        processing = false;
    }
}
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
// --- Report download ---
reportBtn.addEventListener('click', async () => {
    try {
        reportBtn.disabled = true;
        log('Generating report...');
        const blob = await generateReport();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditc-report-${Date.now()}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        log('Report downloaded');
    }
    catch (err) {
        log(`Report error: ${err}`);
        reportBtn.disabled = false;
    }
});
// --- Main ---
async function main() {
    appStatus.textContent = 'Waiting for G2 glasses...';
    log('Connecting to glasses via BLE...');
    bridge = await waitForEvenAppBridge();
    appStatus.textContent = 'Glasses connected';
    log('Bridge ready');
    await initDisplay(bridge);
    await showCurrentStep();
    await applyStatus('idle');
    voice = new VoiceInput(onSpeech);
    if (!voice.isSupported()) {
        appStatus.textContent = 'Warning: Web Speech API unavailable (need HTTPS on phone)';
        log('Speech API not supported — check HTTPS configuration');
    }
    micBtn.addEventListener('click', () => {
        if (micBtn.textContent === 'Start Listening') {
            voice.start();
            micBtn.textContent = 'Stop Listening';
            applyStatus('listening');
            log('Microphone started');
        }
        else {
            voice.stop();
            micBtn.textContent = 'Start Listening';
            applyStatus('idle');
            log('Microphone stopped');
        }
    });
    bridge.onEvenHubEvent((event) => {
        const sysType = event.sysEvent?.eventType ?? 0;
        // Double-tap = exit
        if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
            sysType === OsEventTypeList.SYSTEM_EXIT_EVENT) {
            voice.stop();
            bridge.shutDownPageContainer(1);
            return;
        }
        // Single tap = start/resume listening, or continue after flag
        if (sysType === OsEventTypeList.CLICK_EVENT) {
            if (awaitingFlagResume) {
                awaitingFlagResume = false;
                applyStatus('listening');
                log('Flag acknowledged — resuming step');
                return;
            }
            if (micBtn.textContent === 'Start Listening') {
                voice.start();
                micBtn.textContent = 'Stop Listening';
                applyStatus('listening');
                log('Microphone started via glasses tap');
            }
        }
    });
}
main().catch(err => {
    appStatus.textContent = `Fatal error: ${err}`;
    console.error(err);
});
