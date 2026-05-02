import { describe, it, expect } from 'vitest'
import { CyclicGraphError, UnknownNodeError } from './errors'

describe('CyclicGraphError', () => {
  it('has the correct name for stack traces', () => {
    const err = new CyclicGraphError()
    expect(err.name).toBe('CyclicGraphError')
  })

  it('has a stable machine-readable code', () => {
    const err = new CyclicGraphError()
    expect(err.code).toBe('CYCLIC_GRAPH')
  })

  it('is an instance of Error', () => {
    expect(new CyclicGraphError()).toBeInstanceOf(Error)
  })

  it('has a non-empty human-readable message', () => {
    const err = new CyclicGraphError()
    expect(err.message.length).toBeGreaterThan(0)
  })
})

describe('UnknownNodeError', () => {
  it('has the correct name for stack traces', () => {
    const err = new UnknownNodeError('my/node')
    expect(err.name).toBe('UnknownNodeError')
  })

  it('has a stable machine-readable code', () => {
    const err = new UnknownNodeError('my/node')
    expect(err.code).toBe('UNKNOWN_NODE')
  })

  it('carries the offending definitionId', () => {
    const err = new UnknownNodeError('source/missing')
    expect(err.definitionId).toBe('source/missing')
  })

  it('includes the definitionId in the message', () => {
    const err = new UnknownNodeError('source/missing')
    expect(err.message).toContain('source/missing')
  })

  it('is an instance of Error', () => {
    expect(new UnknownNodeError('x')).toBeInstanceOf(Error)
  })
})
