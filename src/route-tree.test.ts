import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { configSchema, generator } from '@tanstack/router-generator'
import { describe, expect, it } from 'vitest'

// The vite plugin rewrites routeTree.gen.ts on every dev start and build, so a
// hand edit it would not produce (a second route exported from one file) is
// silently dropped and the page falls through to the not-found home screen.
describe('route tree', () => {
  it('matches what the router plugin generates', async () => {
    // Generated beside the real tree so its relative import paths are identical.
    const generatedRouteTree = path.resolve(`src/routeTree.check-${process.pid}.gen.ts`)
    try {
      await generator(configSchema.parse({ routesDirectory: path.resolve('src/routes'), generatedRouteTree, disableLogging: true }))
      expect(await readFile(path.resolve('src/routeTree.gen.ts'), 'utf8')).toBe(await readFile(generatedRouteTree, 'utf8'))
    } finally {
      await rm(generatedRouteTree, { force: true })
    }
  })
})
