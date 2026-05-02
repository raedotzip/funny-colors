# Getting Started

## Installation

```bash
npm install funny-colors
# or
pnpm add funny-colors
```

## Basic usage

### 1. Get a graph config

Either export one from the [visual builder](https://funny-colors.dev) or write one by hand:

```json
{
  "version": 1,
  "nodes": [
    { "instanceId": "time-1", "definitionId": "source/time", "position": { "x": 0, "y": 0 } },
    { "instanceId": "noise-1", "definitionId": "transform/noise", "position": { "x": 200, "y": 0 } },
    { "instanceId": "output-1", "definitionId": "output/canvas", "position": { "x": 400, "y": 0 } }
  ],
  "edges": [
    { "fromInstanceId": "time-1", "fromPort": "time", "toInstanceId": "noise-1", "toPort": "time" },
    { "fromInstanceId": "noise-1", "fromPort": "value", "toInstanceId": "output-1", "toPort": "color" }
  ],
  "params": {
    "speed": 1.0
  }
}
```

### 2. Create the background

```ts
import { createBackground } from 'funny-colors'
import myGraph from './my-graph.json'

const canvas = document.getElementById('bg') as HTMLCanvasElement
const bg = createBackground(canvas, myGraph)
```

### 3. Control it at runtime

```ts
// Change a parameter — only affected nodes re-evaluate
bg.setParam('speed', 2.0)

// Clean up when done
bg.destroy()
```

## Tree-shaking

`funny-colors` ships as ESM. Bundlers (Vite, webpack, esbuild) eliminate unused node types automatically. Only the nodes referenced by your graph config's `definitionId` fields need to be in your bundle.

If you use the `createBackground` API, tree-shaking happens automatically. If you import node types directly, import only what you need:

```ts
import { NoiseNode, ColorMapNode } from 'funny-colors'
```

## Self-contained bundle (no npm)

If you can't use npm, use the CLI to produce a standalone JS file:

```bash
npx funny-colors build my-graph.json
# outputs: my-graph.bundle.js
```

Then include it directly:

```html
<canvas id="bg"></canvas>
<script src="my-graph.bundle.js"></script>
```

## Graph config reference

See `docs/usage/graph-config-format.md` for the full `GraphConfig` JSON schema.

## Params reference

Params declared in `GraphConfig.params` are exposed to the host page via `bg.setParam(name, value)`.

A param is consumed in the graph by adding a `ParamNode` with its `paramName` matching the key in `params`. The param value flows through the DAG like any other value.

## Mouse and audio

Mouse position is tracked automatically on the canvas element. No setup needed.

Audio input requires a Web Audio `AnalyserNode`:

```ts
// Coming in Phase 5 — audio input API not yet finalised
```
