import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// findBy*/waitFor default to 1s, which a loaded CI box or a parallel run can exceed.
// A longer ceiling only changes how long a failing test waits, not what passes.
configure({ asyncUtilTimeout: 4000 })

// jsdom has no IntersectionObserver; motion's in-view animations and the landing page's
// scroll story need one. This stand-in never fires, so content stays in its visible state.
class StillIntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: number[] = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
vi.stubGlobal('IntersectionObserver', StillIntersectionObserver)

afterEach(() => {
  cleanup()
})
