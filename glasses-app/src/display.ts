import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'

export type EvenBridge = Awaited<ReturnType<typeof waitForEvenAppBridge>>

// Display layout — 576×288px, line height 27px (~10 lines)
// y=0   h=27  : header (1 line)
// y=30  h=162 : step content (6 lines)
// y=200 h=30  : status line
// y=232 h=54  : last-heard text (2 lines)

const CONTAINER = {
  HEADER: { id: 1, name: 'header' },
  STEP:   { id: 2, name: 'step'   },
  STATUS: { id: 3, name: 'status' },
  HEARD:  { id: 4, name: 'heard'  },
} as const

export type DisplayStatus =
  | 'idle'
  | 'listening'
  | 'confirmed'
  | 'repeat'
  | 'flagged'
  | 'complete'

const STATUS_LABELS: Record<DisplayStatus, string> = {
  idle:      '● Ready — speak to confirm',
  listening: '◎ Listening...',
  confirmed: '✓ CONFIRMED',
  repeat:    '↺ REPEAT STEP',
  flagged:   '⚑ FLAGGED — tap to continue',
  complete:  '✓ ALL STEPS COMPLETE',
}

export async function initDisplay(bridge: EvenBridge): Promise<void> {
  const header = new TextContainerProperty({
    xPosition: 0, yPosition: 0,
    width: 576, height: 27,
    borderWidth: 0, paddingLength: 2,
    containerID: CONTAINER.HEADER.id,
    containerName: CONTAINER.HEADER.name,
    content: 'AuditC | COVID-19 PCR',
    isEventCapture: 0,
  })

  const step = new TextContainerProperty({
    xPosition: 0, yPosition: 30,
    width: 576, height: 162,
    borderWidth: 0, paddingLength: 4,
    containerID: CONTAINER.STEP.id,
    containerName: CONTAINER.STEP.name,
    content: 'Connecting...',
    isEventCapture: 1,
  })

  const status = new TextContainerProperty({
    xPosition: 0, yPosition: 200,
    width: 576, height: 30,
    borderWidth: 0, paddingLength: 2,
    containerID: CONTAINER.STATUS.id,
    containerName: CONTAINER.STATUS.name,
    content: 'Initializing...',
    isEventCapture: 0,
  })

  const heard = new TextContainerProperty({
    xPosition: 0, yPosition: 232,
    width: 576, height: 54,
    borderWidth: 0, paddingLength: 2,
    containerID: CONTAINER.HEARD.id,
    containerName: CONTAINER.HEARD.name,
    content: '',
    isEventCapture: 0,
  })

  await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 4,
      textObject: [header, step, status, heard],
    })
  )
}

// Serialized write queue — prevents overlapping BLE writes
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn)
  queue = next.catch(() => {})
  return next
}

export function setStep(
  bridge: EvenBridge,
  stepNum: number,
  total: number,
  name: string,
  instruction: string,
): Promise<unknown> {
  const content = `Step ${stepNum}/${total}\n${name}\n\n${instruction}`
  return enqueue(() =>
    bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: CONTAINER.STEP.id,
      containerName: CONTAINER.STEP.name,
      content,
    }))
  )
}

export function setStatus(bridge: EvenBridge, status: DisplayStatus): Promise<unknown> {
  return enqueue(() =>
    bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: CONTAINER.STATUS.id,
      containerName: CONTAINER.STATUS.name,
      content: STATUS_LABELS[status],
    }))
  )
}

export function setHeard(bridge: EvenBridge, text: string): Promise<unknown> {
  const truncated = text.length > 80 ? text.slice(0, 77) + '...' : text
  return enqueue(() =>
    bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: CONTAINER.HEARD.id,
      containerName: CONTAINER.HEARD.name,
      content: `"${truncated}"`,
    }))
  )
}
