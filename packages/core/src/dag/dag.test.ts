import { describe, it, expect, vi } from 'vitest'
import { buildEvaluationOrder, DagRunner } from './dag'
import { NodeRegistry } from '../registry'
import { CyclicGraphError } from '../errors'
import type {
  GraphConfig,
  SourceNodeDefinition,
  TransformNodeDefinition,
  OutputNodeDefinition,
  BufferNodeDefinition,
  ExecutionContext,
} from '../types'

// ---------------------------------------------------------------------------
// Shared mock context
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    time: 0,
    mouse: [0.5, 0.5],
    audio: null,
    canvas: { width: 800, height: 600 },
    params: {},
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Node fixtures
// ---------------------------------------------------------------------------

const timeSource: SourceNodeDefinition = {
  id: 'test/time',
  type: 'source',
  label: 'Time',
  inputs: [],
  outputs: [{ name: 'time', type: 'float' }],
  evaluate: vi.fn((_, ctx) => ({ time: ctx.time })),
}

const doubleNode: TransformNodeDefinition = {
  id: 'test/double',
  type: 'transform',
  label: 'Double',
  inputs: [{ name: 'value', type: 'float', default: 0 }],
  outputs: [{ name: 'result', type: 'float' }],
  evaluate: vi.fn(({ value }) => ({ result: (value as number) * 2 })),
}

const addNode: TransformNodeDefinition = {
  id: 'test/add',
  type: 'transform',
  label: 'Add',
  inputs: [
    { name: 'a', type: 'float', default: 2 },
    { name: 'b', type: 'float', default: 3 },
  ],
  outputs: [{ name: 'result', type: 'float' }],
  evaluate: vi.fn(({ a, b }) => ({ result: (a as number) + (b as number) })),
}

const outputNode: OutputNodeDefinition = {
  id: 'test/output',
  type: 'output',
  label: 'Output',
  inputs: [{ name: 'color', type: 'vec3' }],
  outputs: [],
  evaluate: vi.fn(() => ({})),
}

const counterBuffer: BufferNodeDefinition = {
  id: 'test/counter',
  type: 'buffer',
  label: 'Counter',
  inputs: [],
  outputs: [{ name: 'count', type: 'float' }],
  initState: () => ({ count: 0 }),
  evaluate: vi.fn((_, _ctx, state) => {
    const next = (state as { count: number }).count + 1
    return { count: next, __nextFrameState: { count: next } }
  }),
}

function makeRegistry(...extra: ConstructorParameters<typeof NodeRegistry>[0]) {
  return new NodeRegistry([timeSource, doubleNode, addNode, outputNode, counterBuffer, ...extra])
}

// ---------------------------------------------------------------------------
// buildEvaluationOrder
// ---------------------------------------------------------------------------

describe('buildEvaluationOrder', () => {
  it('returns a single node graph as a one-element array', () => {
    const config: GraphConfig = {
      version: 1,
      nodes: [{ instanceId: 'out', definitionId: 'test/output', position: { x: 0, y: 0 } }],
      edges: [],
      params: {},
    }
    expect(buildEvaluationOrder(config)).toEqual(['out'])
  })

  it('places upstream nodes before their dependents in a linear graph', () => {
    const config: GraphConfig = {
      version: 1,
      nodes: [
        { instanceId: 'src', definitionId: 'test/time', position: { x: 0, y: 0 } },
        { instanceId: 'dbl', definitionId: 'test/double', position: { x: 100, y: 0 } },
        { instanceId: 'out', definitionId: 'test/output', position: { x: 200, y: 0 } },
      ],
      edges: [
        { fromInstanceId: 'src', fromPort: 'time', toInstanceId: 'dbl', toPort: 'value' },
        { fromInstanceId: 'dbl', fromPort: 'result', toInstanceId: 'out', toPort: 'color' },
      ],
      params: {},
    }
    const order = buildEvaluationOrder(config)
    expect(order.indexOf('src')).toBeLessThan(order.indexOf('dbl'))
    expect(order.indexOf('dbl')).toBeLessThan(order.indexOf('out'))
  })

  it('includes nodes with no edges', () => {
    const config: GraphConfig = {
      version: 1,
      nodes: [
        { instanceId: 'isolated', definitionId: 'test/double', position: { x: 0, y: 0 } },
        { instanceId: 'out', definitionId: 'test/output', position: { x: 100, y: 0 } },
      ],
      edges: [],
      params: {},
    }
    const order = buildEvaluationOrder(config)
    expect(order).toContain('isolated')
    expect(order).toContain('out')
  })

  it('throws CyclicGraphError when the graph has a directed cycle', () => {
    const config: GraphConfig = {
      version: 1,
      nodes: [
        { instanceId: 'a', definitionId: 'test/double', position: { x: 0, y: 0 } },
        { instanceId: 'b', definitionId: 'test/double', position: { x: 100, y: 0 } },
      ],
      edges: [
        { fromInstanceId: 'a', fromPort: 'result', toInstanceId: 'b', toPort: 'value' },
        { fromInstanceId: 'b', fromPort: 'result', toInstanceId: 'a', toPort: 'value' },
      ],
      params: {},
    }
    expect(() => buildEvaluationOrder(config)).toThrowError(CyclicGraphError)
  })

  it('CyclicGraphError has the correct code', () => {
    const config: GraphConfig = {
      version: 1,
      nodes: [
        { instanceId: 'a', definitionId: 'test/double', position: { x: 0, y: 0 } },
      ],
      edges: [
        { fromInstanceId: 'a', fromPort: 'result', toInstanceId: 'a', toPort: 'value' },
      ],
      params: {},
    }
    let caught: CyclicGraphError | undefined
    try { buildEvaluationOrder(config) } catch (e) { caught = e as CyclicGraphError }
    expect(caught?.code).toBe('CYCLIC_GRAPH')
  })
})

// ---------------------------------------------------------------------------
// DagRunner — tracer bullet: source → transform → output
// ---------------------------------------------------------------------------

describe('DagRunner', () => {
  const linearConfig: GraphConfig = {
    version: 1,
    nodes: [
      { instanceId: 'src', definitionId: 'test/time', position: { x: 0, y: 0 } },
      { instanceId: 'dbl', definitionId: 'test/double', position: { x: 100, y: 0 } },
      { instanceId: 'out', definitionId: 'test/output', position: { x: 200, y: 0 } },
    ],
    edges: [
      { fromInstanceId: 'src', fromPort: 'time', toInstanceId: 'dbl', toPort: 'value' },
      { fromInstanceId: 'dbl', fromPort: 'result', toInstanceId: 'out', toPort: 'color' },
    ],
    params: {},
  }

  describe('evaluate — value propagation', () => {
    it('source node output is visible via getOutputs', () => {
      const runner = new DagRunner(linearConfig, makeRegistry())
      runner.evaluate(makeCtx({ time: 7 }))
      expect(runner.getOutputs('src')).toEqual({ time: 7 })
    })

    it('transform node receives upstream source output and computes correctly', () => {
      const runner = new DagRunner(linearConfig, makeRegistry())
      runner.evaluate(makeCtx({ time: 5 }))
      expect(runner.getOutputs('dbl')).toEqual({ result: 10 })
    })

    it('uses port default when an input port has no upstream connection', () => {
      const isolatedConfig: GraphConfig = {
        version: 1,
        nodes: [{ instanceId: 'add', definitionId: 'test/add', position: { x: 0, y: 0 } }],
        edges: [],
        params: {},
      }
      const runner = new DagRunner(isolatedConfig, makeRegistry())
      runner.evaluate(makeCtx())
      // defaults: a=2, b=3
      expect(runner.getOutputs('add')).toEqual({ result: 5 })
    })

    it('upstream output overrides the port default', () => {
      // src → add.a, add.b uses default (3)
      const config: GraphConfig = {
        version: 1,
        nodes: [
          { instanceId: 'src', definitionId: 'test/time', position: { x: 0, y: 0 } },
          { instanceId: 'add', definitionId: 'test/add', position: { x: 100, y: 0 } },
        ],
        edges: [
          { fromInstanceId: 'src', fromPort: 'time', toInstanceId: 'add', toPort: 'a' },
        ],
        params: {},
      }
      const runner = new DagRunner(config, makeRegistry())
      runner.evaluate(makeCtx({ time: 10 }))
      expect(runner.getOutputs('add')).toEqual({ result: 13 }) // 10 + 3 (default b)
    })
  })

  describe('evaluate — dirty flagging', () => {
    it('source nodes re-evaluate every frame even when not explicitly dirtied', () => {
      const spyEval = vi.fn((_, ctx: ExecutionContext) => ({ time: ctx.time }))
      const src: SourceNodeDefinition = {
        id: 'test/spy-source',
        type: 'source',
        label: 'Spy',
        inputs: [],
        outputs: [{ name: 'time', type: 'float' }],
        evaluate: spyEval,
      }
      const config: GraphConfig = {
        version: 1,
        nodes: [{ instanceId: 'src', definitionId: 'test/spy-source', position: { x: 0, y: 0 } }],
        edges: [],
        params: {},
      }
      const runner = new DagRunner(config, new NodeRegistry([src]))
      runner.evaluate(makeCtx({ time: 1 }))
      runner.evaluate(makeCtx({ time: 2 }))
      expect(spyEval).toHaveBeenCalledTimes(2)
      expect(runner.getOutputs('src')).toEqual({ time: 2 })
    })

    it('a clean transform node is skipped on the next frame', () => {
      const spyEval = vi.fn(({ value }: Record<string, unknown>) => ({ result: (value as number) * 2 }))
      const spy: TransformNodeDefinition = {
        id: 'test/spy-transform',
        type: 'transform',
        label: 'Spy Transform',
        inputs: [{ name: 'value', type: 'float', default: 0 }],
        outputs: [{ name: 'result', type: 'float' }],
        evaluate: spyEval,
      }
      // Disconnected so it never gets upstream changes
      const config: GraphConfig = {
        version: 1,
        nodes: [{ instanceId: 't', definitionId: 'test/spy-transform', position: { x: 0, y: 0 } }],
        edges: [],
        params: {},
      }
      const runner = new DagRunner(config, new NodeRegistry([spy]))
      runner.evaluate(makeCtx()) // first frame — dirty, runs
      runner.evaluate(makeCtx()) // second frame — clean, skipped
      expect(spyEval).toHaveBeenCalledTimes(1)
    })

    it('markDirty causes a clean node to re-evaluate on next frame', () => {
      const spyEval = vi.fn(({ value }: Record<string, unknown>) => ({ result: (value as number) * 2 }))
      const spy: TransformNodeDefinition = {
        id: 'test/spy-t2',
        type: 'transform',
        label: 'Spy T2',
        inputs: [{ name: 'value', type: 'float', default: 0 }],
        outputs: [{ name: 'result', type: 'float' }],
        evaluate: spyEval,
      }
      const config: GraphConfig = {
        version: 1,
        nodes: [{ instanceId: 't', definitionId: 'test/spy-t2', position: { x: 0, y: 0 } }],
        edges: [],
        params: {},
      }
      const runner = new DagRunner(config, new NodeRegistry([spy]))
      runner.evaluate(makeCtx()) // runs → clean
      runner.markDirty('t')
      runner.evaluate(makeCtx()) // dirty → runs again
      expect(spyEval).toHaveBeenCalledTimes(2)
    })

    it('markDirty propagates to all downstream descendants', () => {
      const spyA = vi.fn(({ value }: Record<string, unknown>) => ({ result: value }))
      const spyB = vi.fn(({ value }: Record<string, unknown>) => ({ result: value }))
      const nodeA: TransformNodeDefinition = {
        id: 'test/a', type: 'transform', label: 'A',
        inputs: [{ name: 'value', type: 'float', default: 1 }],
        outputs: [{ name: 'result', type: 'float' }],
        evaluate: spyA,
      }
      const nodeB: TransformNodeDefinition = {
        id: 'test/b', type: 'transform', label: 'B',
        inputs: [{ name: 'value', type: 'float', default: 0 }],
        outputs: [{ name: 'result', type: 'float' }],
        evaluate: spyB,
      }
      const config: GraphConfig = {
        version: 1,
        nodes: [
          { instanceId: 'a', definitionId: 'test/a', position: { x: 0, y: 0 } },
          { instanceId: 'b', definitionId: 'test/b', position: { x: 100, y: 0 } },
        ],
        edges: [
          { fromInstanceId: 'a', fromPort: 'result', toInstanceId: 'b', toPort: 'value' },
        ],
        params: {},
      }
      const runner = new DagRunner(config, new NodeRegistry([nodeA, nodeB]))
      runner.evaluate(makeCtx()) // both run → clean
      runner.markDirty('a')     // a dirty → b must also be dirtied
      runner.evaluate(makeCtx())
      expect(spyA).toHaveBeenCalledTimes(2)
      expect(spyB).toHaveBeenCalledTimes(2)
    })
  })

  describe('evaluate — buffer nodes', () => {
    it('calls initState once and passes it to evaluate as the third argument', () => {
      const spyEval = vi.fn((_inputs, _ctx, state) => ({
        count: (state as { count: number }).count,
        __nextFrameState: state,
      }))
      const buf: BufferNodeDefinition = {
        id: 'test/buf',
        type: 'buffer',
        label: 'Buf',
        inputs: [],
        outputs: [{ name: 'count', type: 'float' }],
        initState: () => ({ count: 99 }),
        evaluate: spyEval,
      }
      const config: GraphConfig = {
        version: 1,
        nodes: [{ instanceId: 'buf', definitionId: 'test/buf', position: { x: 0, y: 0 } }],
        edges: [],
        params: {},
      }
      const runner = new DagRunner(config, new NodeRegistry([buf]))
      runner.evaluate(makeCtx())
      expect(spyEval).toHaveBeenCalledWith({}, expect.anything(), { count: 99 })
    })

    it('state returned as __nextFrameState is passed to evaluate on the next frame', () => {
      const config: GraphConfig = {
        version: 1,
        nodes: [{ instanceId: 'ctr', definitionId: 'test/counter', position: { x: 0, y: 0 } }],
        edges: [],
        params: {},
      }
      const runner = new DagRunner(config, makeRegistry())
      runner.evaluate(makeCtx()) // count → 1
      runner.evaluate(makeCtx()) // count → 2
      runner.evaluate(makeCtx()) // count → 3
      expect(runner.getOutputs('ctr')).toEqual(expect.objectContaining({ count: 3 }))
    })
  })

  describe('getOutputs', () => {
    it('returns an empty object for a node that has not yet been evaluated', () => {
      const runner = new DagRunner(linearConfig, makeRegistry())
      expect(runner.getOutputs('src')).toEqual({})
    })

    it('returns an empty object when called with an instanceId not in the graph', () => {
      const runner = new DagRunner(linearConfig, makeRegistry())
      runner.evaluate(makeCtx())
      expect(runner.getOutputs('does-not-exist')).toEqual({})
    })
  })

  describe('markDirty', () => {
    it('does not throw when called with an instanceId not in the graph', () => {
      const runner = new DagRunner(linearConfig, makeRegistry())
      expect(() => runner.markDirty('does-not-exist')).not.toThrow()
    })

    it('does not dirty unrelated sibling nodes when called on one branch of a fork', () => {
      // src → branchA
      // src → branchB
      // Marking branchA dirty should leave branchB clean.
      const spyA = vi.fn(({ value }: Record<string, unknown>) => ({ result: value }))
      const spyB = vi.fn(({ value }: Record<string, unknown>) => ({ result: value }))
      const nodeA: TransformNodeDefinition = {
        id: 'test/fork-a', type: 'transform', label: 'ForkA',
        inputs: [{ name: 'value', type: 'float', default: 0 }],
        outputs: [{ name: 'result', type: 'float' }],
        evaluate: spyA,
      }
      const nodeB: TransformNodeDefinition = {
        id: 'test/fork-b', type: 'transform', label: 'ForkB',
        inputs: [{ name: 'value', type: 'float', default: 0 }],
        outputs: [{ name: 'result', type: 'float' }],
        evaluate: spyB,
      }
      const config: GraphConfig = {
        version: 1,
        nodes: [
          { instanceId: 'a', definitionId: 'test/fork-a', position: { x: 0, y: 0 } },
          { instanceId: 'b', definitionId: 'test/fork-b', position: { x: 100, y: 0 } },
        ],
        edges: [],
        params: {},
      }
      const runner = new DagRunner(config, new NodeRegistry([nodeA, nodeB]))
      runner.evaluate(makeCtx()) // both run → clean
      runner.markDirty('a')
      runner.evaluate(makeCtx()) // only a should re-run
      expect(spyA).toHaveBeenCalledTimes(2)
      expect(spyB).toHaveBeenCalledTimes(1)
    })
  })

  describe('evaluate — graph topology', () => {
    it('diamond graph: both converging paths evaluate before the sink node', () => {
      // a → b, a → c, b → d, c → d
      // d must see b's and c's outputs
      const makePassthrough = (id: string): TransformNodeDefinition => ({
        id: `test/${id}`,
        type: 'transform',
        label: id,
        inputs: [{ name: 'value', type: 'float', default: 0 }],
        outputs: [{ name: 'result', type: 'float' }],
        evaluate: ({ value }) => ({ result: (value as number) + 1 }),
      })
      const sinkNode: TransformNodeDefinition = {
        id: 'test/sink',
        type: 'transform',
        label: 'Sink',
        inputs: [
          { name: 'left', type: 'float', default: 0 },
          { name: 'right', type: 'float', default: 0 },
        ],
        outputs: [{ name: 'sum', type: 'float' }],
        evaluate: ({ left, right }) => ({ sum: (left as number) + (right as number) }),
      }
      const src: SourceNodeDefinition = {
        id: 'test/diamond-src',
        type: 'source',
        label: 'Src',
        inputs: [],
        outputs: [{ name: 'value', type: 'float' }],
        evaluate: (_, ctx) => ({ value: ctx.time }),
      }
      const diamond: GraphConfig = {
        version: 1,
        nodes: [
          { instanceId: 'src', definitionId: 'test/diamond-src', position: { x: 0, y: 0 } },
          { instanceId: 'b', definitionId: 'test/b-pass', position: { x: 100, y: -50 } },
          { instanceId: 'c', definitionId: 'test/c-pass', position: { x: 100, y: 50 } },
          { instanceId: 'd', definitionId: 'test/sink', position: { x: 200, y: 0 } },
        ],
        edges: [
          { fromInstanceId: 'src', fromPort: 'value', toInstanceId: 'b', toPort: 'value' },
          { fromInstanceId: 'src', fromPort: 'value', toInstanceId: 'c', toPort: 'value' },
          { fromInstanceId: 'b', fromPort: 'result', toInstanceId: 'd', toPort: 'left' },
          { fromInstanceId: 'c', fromPort: 'result', toInstanceId: 'd', toPort: 'right' },
        ],
        params: {},
      }
      const bPass = makePassthrough('b-pass')
      const cPass = makePassthrough('c-pass')
      const runner = new DagRunner(diamond, new NodeRegistry([src, bPass, cPass, sinkNode]))
      runner.evaluate(makeCtx({ time: 10 }))
      // src → 10, b → 11, c → 11, d.sum = 11 + 11 = 22
      expect(runner.getOutputs('d')).toEqual({ sum: 22 })
    })

    it('two sources fanning into one transform both resolve correctly', () => {
      const srcTime: SourceNodeDefinition = {
        id: 'test/fan-time',
        type: 'source',
        label: 'FanTime',
        inputs: [],
        outputs: [{ name: 'out', type: 'float' }],
        evaluate: (_, ctx) => ({ out: ctx.time }),
      }
      const srcMouse: SourceNodeDefinition = {
        id: 'test/fan-mouse',
        type: 'source',
        label: 'FanMouse',
        inputs: [],
        outputs: [{ name: 'x', type: 'float' }],
        evaluate: (_, ctx) => ({ x: ctx.mouse[0] }),
      }
      const config: GraphConfig = {
        version: 1,
        nodes: [
          { instanceId: 't', definitionId: 'test/fan-time', position: { x: 0, y: 0 } },
          { instanceId: 'm', definitionId: 'test/fan-mouse', position: { x: 0, y: 100 } },
          { instanceId: 'add', definitionId: 'test/add', position: { x: 200, y: 0 } },
        ],
        edges: [
          { fromInstanceId: 't', fromPort: 'out', toInstanceId: 'add', toPort: 'a' },
          { fromInstanceId: 'm', fromPort: 'x', toInstanceId: 'add', toPort: 'b' },
        ],
        params: {},
      }
      const runner = new DagRunner(config, new NodeRegistry([srcTime, srcMouse, addNode]))
      runner.evaluate(makeCtx({ time: 4, mouse: [0.25, 0.5] }))
      expect(runner.getOutputs('add')).toEqual({ result: 4.25 })
    })
  })

  describe('evaluate — buffer nodes (extended)', () => {
    it('when evaluate does not return __nextFrameState the state is unchanged on the next frame', () => {
      const calls: unknown[] = []
      const stationary: BufferNodeDefinition = {
        id: 'test/stationary',
        type: 'buffer',
        label: 'Stationary',
        inputs: [],
        outputs: [{ name: 'val', type: 'float' }],
        initState: () => ({ frozen: 42 }),
        evaluate: (_inputs, _ctx, state) => {
          calls.push(state)
          // Deliberately omit __nextFrameState
          return { val: (state as { frozen: number }).frozen }
        },
      }
      const config: GraphConfig = {
        version: 1,
        nodes: [{ instanceId: 'st', definitionId: 'test/stationary', position: { x: 0, y: 0 } }],
        edges: [],
        params: {},
      }
      const runner = new DagRunner(config, new NodeRegistry([stationary]))
      runner.evaluate(makeCtx())
      runner.evaluate(makeCtx())
      // Both frames should have received the same initial state since it never updated
      expect(calls[0]).toEqual({ frozen: 42 })
      expect(calls[1]).toEqual({ frozen: 42 })
    })
  })
})
