import { TextContainerProperty, CreateStartUpPageContainer, TextContainerUpgrade, } from '@evenrealities/even_hub_sdk';
// Display layout — 576×288px, line height 27px (~10 lines)
// y=0   h=27  : header (1 line)
// y=30  h=162 : step content (6 lines)
// y=200 h=30  : status line
// y=232 h=54  : last-heard text (2 lines)
const CONTAINER = {
    HEADER: { id: 1, name: 'header' },
    STEP: { id: 2, name: 'step' },
    STATUS: { id: 3, name: 'status' },
    HEARD: { id: 4, name: 'heard' },
};
const STATUS_LABELS = {
    idle: '● Ready — speak to confirm',
    listening: '◎ Listening...',
    confirmed: '✓ CONFIRMED',
    repeat: '↺ REPEAT STEP',
    flagged: '⚑ FLAGGED — tap to continue',
    complete: '✓ ALL STEPS COMPLETE',
};
export async function initDisplay(bridge) {
    const header = new TextContainerProperty({
        xPosition: 0, yPosition: 0,
        width: 576, height: 27,
        borderWidth: 0, paddingLength: 2,
        containerID: CONTAINER.HEADER.id,
        containerName: CONTAINER.HEADER.name,
        content: 'AuditC | COVID-19 PCR',
        isEventCapture: 0,
    });
    const step = new TextContainerProperty({
        xPosition: 0, yPosition: 30,
        width: 576, height: 162,
        borderWidth: 0, paddingLength: 4,
        containerID: CONTAINER.STEP.id,
        containerName: CONTAINER.STEP.name,
        content: 'Connecting...',
        isEventCapture: 1,
    });
    const status = new TextContainerProperty({
        xPosition: 0, yPosition: 200,
        width: 576, height: 30,
        borderWidth: 0, paddingLength: 2,
        containerID: CONTAINER.STATUS.id,
        containerName: CONTAINER.STATUS.name,
        content: 'Initializing...',
        isEventCapture: 0,
    });
    const heard = new TextContainerProperty({
        xPosition: 0, yPosition: 232,
        width: 576, height: 54,
        borderWidth: 0, paddingLength: 2,
        containerID: CONTAINER.HEARD.id,
        containerName: CONTAINER.HEARD.name,
        content: '',
        isEventCapture: 0,
    });
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
        containerTotalNum: 4,
        textObject: [header, step, status, heard],
    }));
}
// Serialized write queue — prevents overlapping BLE writes
let queue = Promise.resolve();
function enqueue(fn) {
    const next = queue.then(fn);
    queue = next.catch(() => { });
    return next;
}
export function setStep(bridge, stepNum, total, name, instruction) {
    const content = `Step ${stepNum}/${total}\n${name}\n\n${instruction}`;
    return enqueue(() => bridge.textContainerUpgrade(new TextContainerUpgrade({
        containerID: CONTAINER.STEP.id,
        containerName: CONTAINER.STEP.name,
        content,
    })));
}
export function setStatus(bridge, status) {
    return enqueue(() => bridge.textContainerUpgrade(new TextContainerUpgrade({
        containerID: CONTAINER.STATUS.id,
        containerName: CONTAINER.STATUS.name,
        content: STATUS_LABELS[status],
    })));
}
export function setHeard(bridge, text) {
    const truncated = text.length > 80 ? text.slice(0, 77) + '...' : text;
    return enqueue(() => bridge.textContainerUpgrade(new TextContainerUpgrade({
        containerID: CONTAINER.HEARD.id,
        containerName: CONTAINER.HEARD.name,
        content: `"${truncated}"`,
    })));
}
