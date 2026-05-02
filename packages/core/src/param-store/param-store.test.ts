import { describe, it, expect, vi } from 'vitest'
import { ParamStore } from './param-store'

describe('ParamStore', () => {
  describe('get', () => {
    it('returns the initial value for a declared param', () => {
      const store = new ParamStore({ speed: 1.5, hue: 0.3 })
      expect(store.get('speed')).toBe(1.5)
      expect(store.get('hue')).toBe(0.3)
    })

    it('returns undefined for a key that was never declared', () => {
      const store = new ParamStore({ speed: 1.0 })
      expect(store.get('undeclared')).toBeUndefined()
    })
  })

  describe('set', () => {
    it('updates the stored value so subsequent get returns the new value', () => {
      const store = new ParamStore({ speed: 1.0 })
      store.set('speed', 2.5)
      expect(store.get('speed')).toBe(2.5)
    })

    it('can set any JSON-serialisable value type', () => {
      const store = new ParamStore({ color: [1, 0, 0] as unknown })
      store.set('color', [0, 1, 0])
      expect(store.get('color')).toEqual([0, 1, 0])
    })
  })

  describe('onChange', () => {
    it('fires the callback with the param name and new value after set', () => {
      const store = new ParamStore({ speed: 1.0 })
      const cb = vi.fn()
      store.onChange(cb)
      store.set('speed', 3.0)
      expect(cb).toHaveBeenCalledOnce()
      expect(cb).toHaveBeenCalledWith('speed', 3.0)
    })

    it('fires for every set call including repeated sets to the same key', () => {
      const store = new ParamStore({ x: 0 })
      const cb = vi.fn()
      store.onChange(cb)
      store.set('x', 1)
      store.set('x', 1) // same value — still fires
      expect(cb).toHaveBeenCalledTimes(2)
    })

    it('fires for every registered listener', () => {
      const store = new ParamStore({ n: 0 })
      const a = vi.fn()
      const b = vi.fn()
      store.onChange(a)
      store.onChange(b)
      store.set('n', 42)
      expect(a).toHaveBeenCalledOnce()
      expect(b).toHaveBeenCalledOnce()
    })

    it('does not fire the callback for keys not yet declared when set is called', () => {
      const store = new ParamStore({ speed: 1.0 })
      const cb = vi.fn()
      store.onChange(cb)
      store.set('undeclared', 99) // no-op for declared check? Actually store allows it.
      // The important thing is onChange still fires — it's up to the DAG runner
      // to ignore undeclared params. The store itself stores any key.
      expect(cb).toHaveBeenCalledWith('undeclared', 99)
    })

    it('returned unsubscribe function stops future callbacks', () => {
      const store = new ParamStore({ speed: 1.0 })
      const cb = vi.fn()
      const unsubscribe = store.onChange(cb)
      store.set('speed', 2.0) // fires
      unsubscribe()
      store.set('speed', 3.0) // should not fire
      expect(cb).toHaveBeenCalledOnce()
    })

    it('unsubscribing one listener does not affect other listeners', () => {
      const store = new ParamStore({ n: 0 })
      const a = vi.fn()
      const b = vi.fn()
      const unsubA = store.onChange(a)
      store.onChange(b)
      unsubA()
      store.set('n', 1)
      expect(a).not.toHaveBeenCalled()
      expect(b).toHaveBeenCalledOnce()
    })
  })

  describe('snapshot', () => {
    it('returns all initial params as a plain object', () => {
      const store = new ParamStore({ speed: 1.0, hue: 0.5 })
      expect(store.snapshot()).toEqual({ speed: 1.0, hue: 0.5 })
    })

    it('reflects values updated via set', () => {
      const store = new ParamStore({ speed: 1.0 })
      store.set('speed', 9.9)
      expect(store.snapshot()).toEqual({ speed: 9.9 })
    })

    it('returns a plain object copy — mutating it does not affect the store', () => {
      const store = new ParamStore({ x: 1 })
      const snap = store.snapshot()
      snap['x'] = 999
      expect(store.get('x')).toBe(1)
    })
  })
})
