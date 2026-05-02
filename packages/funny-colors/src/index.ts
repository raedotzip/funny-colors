// Public re-export package.
// One install point: `import { createBackground } from 'funny-colors'`
// Tree-shaking is handled by the bundler via ESM named exports.

export type * from '@funny-colors/core'
export * from '@funny-colors/nodes'
export * from '@funny-colors/renderer'

export { createBackground } from './runtime.js'
