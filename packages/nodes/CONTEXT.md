# @funny-colors/nodes — Package Context

## Responsibility

The built-in node library. Every node type that ships with funny-colors out of the box lives here.

Each node is a named ESM export conforming to a `NodeDefinition` interface from `@funny-colors/core`. Users (and bundlers) import only what they need — unused nodes are eliminated at build time.

## What it does NOT do

- Does not contain the DAG engine or type system — those live in `@funny-colors/core`
- Does not render anything — nodes produce `PortValues`, not pixels
- Does not contain third-party plugins — those are separate npm packages

## Node categories (planned)

### Source nodes
Read from `ExecutionContext` — inject live data into the graph.
- `MouseNode` — normalised cursor position
- `AudioNode` — frequency band values from Web Audio API
- `TimeNode` — elapsed time, delta time
- `ParamNode` — named runtime param from the host page's `setParam()` calls

### Transform nodes
Pure computation on upstream values.
- `NoiseNode` — fBm / Simplex / Worley noise
- `MathNode` — add, multiply, mix, pow, abs, clamp, etc.
- `ColorMapNode` — maps a float to a color via a gradient
- `RemapNode` — remap a value from one range to another
- `VectorNode` — construct / swizzle vec2/vec3/vec4

### Buffer nodes
Maintain state across frames — enable trails, echoes, feedback.
- `FeedbackNode` — feeds previous frame output back as input

### Sampler nodes
Read from a lookup table or texture.
- `GradientSamplerNode` — sample a color stop gradient

### Logic nodes
Conditional routing.
- `ThresholdNode` — output A if value > threshold, else B
- `SwitchNode` — select between inputs based on a boolean

### Output nodes
- `CanvasOutputNode` — emits shader source consumed by the renderer

## Adding a new node

See `docs/contributing/writing-a-plugin.md`. The short version:
1. Create `src/[category]/my-node.ts` exporting a `NodeDefinition`
2. Add a named re-export in `src/index.ts`
3. Add unit tests in `src/[category]/my-node.test.ts`

## Testing

Pure unit tests via Vitest. Each node's `evaluate` function is a pure fn — just call it and assert outputs.
Target: near 100% coverage.
