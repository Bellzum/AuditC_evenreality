const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';
export async function verifyStep(stepId, spokenText) {
    const res = await fetch(`${BASE_URL}/verify-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: stepId, spoken_text: spokenText }),
    });
    if (!res.ok)
        throw new Error(`Backend error: ${res.status}`);
    return res.json();
}
export async function logObservation(stepId, spokenText, outcome) {
    await fetch(`${BASE_URL}/log-observation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: stepId, spoken_text: spokenText, outcome }),
    });
}
export async function generateReport() {
    const res = await fetch(`${BASE_URL}/generate-report`, { method: 'POST' });
    if (!res.ok)
        throw new Error(`Report generation failed: ${res.status}`);
    return res.blob();
}
