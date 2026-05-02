import { describe, it, expect } from 'vitest'
import { NodeRegistry } from './registry'
import { UnknownNodeError } from '../errors'
import type { TransformNodeDefinition, OutputNodeDefinition } from '../types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const addNode: TransformNodeDefinition = {
  id: 'test/add',
  type: 'transform',
  label: 'Add',
  inputs: [
    { name: 'a', type: 'float', default: 0 },
    { name: 'b', type: 'float', default: 0 },
  ],
  outputs: [{ name: 'result', type: 'float' }],
  evaluate({ a, b }) {
    return { result: (a as number) + (b as number) }
  },
}

const outputNode: OutputNodeDefinition = {
  id: 'test/output',
  type: 'output',
  label: 'Output',
  inputs: [{ name: 'color', type: 'vec3' }],
  outputs: [],
  evaluate() {
    return {}
  },
}

// ---------------------------------------------------------------------------
// NodeRegistry
// ---------------------------------------------------------------------------

describe('NodeRegistry', () => {
  describe('get', () => {
    it('returns a definition that was passed at construction', () => {
      const registry = new NodeRegistry([addNode])
      expect(registry.get('test/add')).toBe(addNode)
    })

    it('returns a definition registered after construction', () => {
      const registry = new NodeRegistry([])
      registry.register(addNode)
      expect(registry.get('test/add')).toBe(addNode)
    })

    it('throws UnknownNodeError for an id that was never registered', () => {
      const registry = new NodeRegistry([addNode])
      expect(() => registry.get('does/not-exist')).toThrowError(UnknownNodeError)
    })

    it('UnknownNodeError carries the missing definitionId', () => {
      const registry = new NodeRegistry([])
      let caught: UnknownNodeError | undefined
      try {
        registry.get('missing/node')
      } catch (e) {
        caught = e as UnknownNodeError
      }
      expect(caught?.definitionId).toBe('missing/node')
      expect(caught?.code).toBe('UNKNOWN_NODE')
    })
  })

  describe('has', () => {
    it('returns true for a registered id', () => {
      const registry = new NodeRegistry([addNode])
      expect(registry.has('test/add')).toBe(true)
    })

    it('returns false for an unregistered id', () => {
      const registry = new NodeRegistry([addNode])
      expect(registry.has('not/there')).toBe(false)
    })
  })

  describe('register', () => {
    it('makes a definition retrievable via get', () => {
      const registry = new NodeRegistry([])
      registry.register(outputNode)
      expect(registry.get('test/output')).toBe(outputNode)
    })

    it('allows registering multiple definitions independently', () => {
      const registry = new NodeRegistry([])
      registry.register(addNode)
      registry.register(outputNode)
      expect(registry.get('test/add')).toBe(addNode)
      expect(registry.get('test/output')).toBe(outputNode)
    })

    it('last registration wins when the same id is registered twice', () => {
      const updated: TransformNodeDefinition = { ...addNode, label: 'Add v2' }
      const registry = new NodeRegistry([addNode])
      registry.register(updated)
      expect(registry.get('test/add').label).toBe('Add v2')
    })
  })
})
