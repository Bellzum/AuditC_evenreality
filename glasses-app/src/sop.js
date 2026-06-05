export const SOP_STEPS = [
    { id: 1, name: 'Specimen Intake', instruction: 'Confirm specimen ID and condition' },
    { id: 2, name: 'Reagent Aliquot', instruction: 'Confirm reagent lot + volume measured' },
    { id: 3, name: 'Transfer to Tube', instruction: 'Confirm tube barcode matches specimen' },
    { id: 4, name: 'PCR Machine Run', instruction: 'Confirm run initiated and cycling' },
    { id: 5, name: 'Result Analysis', instruction: 'Confirm result recorded and logged' },
];
export const EXCEPTION_WORDS = [
    'contaminated', 'failed', 'error', 'wrong', 'expired',
    'missing', 'abnormal', 'leak', 'spill', 'broken', 'repeat', 'redo',
];
export const FLAG_TRIGGERS = ['flag issue', 'supervisor', 'flag this'];
export function classifyText(text) {
    const lower = text.toLowerCase();
    if (FLAG_TRIGGERS.some(t => lower.includes(t)))
        return 'flagged';
    if (EXCEPTION_WORDS.some(w => lower.includes(w)))
        return 'repeat';
    return 'confirmed';
}
