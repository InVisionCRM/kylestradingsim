import { describe, it, expect } from 'vitest'
import { triggerDir, shouldTrigger } from './orders'

describe('triggerDir', () => {
  it('maps each order kind to the correct cross direction', () => {
    expect(triggerDir({ kind: 'limit', side: 'buy' })).toBe('below')
    expect(triggerDir({ kind: 'limit', side: 'sell' })).toBe('above')
    expect(triggerDir({ kind: 'stop', side: 'buy' })).toBe('above')
    expect(triggerDir({ kind: 'stop', side: 'sell' })).toBe('below')
    expect(triggerDir({ kind: 'tp', side: 'sell' })).toBe('above')
    expect(triggerDir({ kind: 'sl', side: 'sell' })).toBe('below')
  })
})

describe('shouldTrigger', () => {
  it('limit buy fills when price reaches or drops below the level', () => {
    const o = { kind: 'limit' as const, side: 'buy' as const, price: 2 }
    expect(shouldTrigger(o, 2.1)).toBe(false)
    expect(shouldTrigger(o, 2)).toBe(true)
    expect(shouldTrigger(o, 1.9)).toBe(true)
  })
  it('take-profit fills when price reaches or rises above the level', () => {
    const o = { kind: 'tp' as const, side: 'sell' as const, price: 3 }
    expect(shouldTrigger(o, 2.9)).toBe(false)
    expect(shouldTrigger(o, 3.0)).toBe(true)
    expect(shouldTrigger(o, 3.5)).toBe(true)
  })
  it('stop-loss fills when price drops to the level', () => {
    const o = { kind: 'sl' as const, side: 'sell' as const, price: 1.5 }
    expect(shouldTrigger(o, 1.6)).toBe(false)
    expect(shouldTrigger(o, 1.5)).toBe(true)
  })
  it('never triggers on a non-positive price', () => {
    expect(shouldTrigger({ kind: 'limit', side: 'buy', price: 2 }, 0)).toBe(false)
  })
})
