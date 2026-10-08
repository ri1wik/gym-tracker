import { describe, expect, it } from 'vitest'
import { backoffMs, classifyStatus, describeError } from './classify'

describe('classifyStatus', () => {
  it('2xx is ok', () => {
    expect(classifyStatus(200)).toBe('ok')
    expect(classifyStatus(201)).toBe('ok')
  })
  it('401 and 403 refresh once and retry', () => {
    expect(classifyStatus(401)).toBe('refresh')
    expect(classifyStatus(403)).toBe('refresh')
  })
  it('408, 425, 429, 5xx and no response back off', () => {
    for (const s of [408, 425, 429, 500, 502, 503, 504]) expect(classifyStatus(s), String(s)).toBe('backoff')
    expect(classifyStatus(null)).toBe('backoff')
    expect(classifyStatus(0)).toBe('backoff')
  })
  it('only 400, 409 and 422 go dead', () => {
    expect(classifyStatus(400)).toBe('dead')
    expect(classifyStatus(409)).toBe('dead')
    expect(classifyStatus(422)).toBe('dead')
    expect(classifyStatus(404)).not.toBe('dead')
    expect(classifyStatus(405)).not.toBe('dead')
    expect(classifyStatus(413)).not.toBe('dead')
  })
})

describe('backoffMs', () => {
  it('doubles from two seconds and caps at five minutes', () => {
    expect(backoffMs(1)).toBe(2000)
    expect(backoffMs(2)).toBe(4000)
    expect(backoffMs(3)).toBe(8000)
    expect(backoffMs(50)).toBe(300_000)
  })
})

describe('describeError', () => {
  it('names the status and trims the message', () => {
    expect(describeError(422, 'bad row')).toBe('HTTP 422: bad row')
    expect(describeError(null, null)).toBe('No connection')
    expect(describeError(null, 'Timed out')).toBe('No connection: Timed out')
  })
})
