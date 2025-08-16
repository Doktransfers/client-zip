import { describe, expect, it } from 'vitest'
import { makeZip } from '../src'

describe('AbortSignal Support', () => {
  it('should abort ZIP generation when signal is aborted before starting', async () => {
    const controller = new AbortController()
    controller.abort() // Abort immediately
    
    const files = [
      { name: 'test.txt', input: new Blob(['Hello, World!']) }
    ]

    const stream = makeZip(files, { signal: controller.signal })
    const reader = stream.getReader()

    const promise = reader.read()
    await expect(promise).rejects.toThrow()
    await expect(promise).rejects.toHaveProperty('name', 'AbortError')
  })

  it('should abort ZIP generation during file processing', async () => {
    const controller = new AbortController()
    
    // Create multiple files to ensure we hit the abort check during iteration
    const files = []
    for (let i = 0; i < 10; i++) {
      files.push({ name: `file${i}.txt`, input: new Blob([`Content for file ${i}`]) })
    }

    const stream = makeZip(files, { signal: controller.signal })
    const reader = stream.getReader()

    // Start reading and then abort immediately
    const readPromise = reader.read()
    controller.abort()

    await expect(readPromise).rejects.toThrow()
    await expect(readPromise).rejects.toHaveProperty('name', 'AbortError')
  })

  it('should abort ZIP generation when processing multiple files', async () => {
    const controller = new AbortController()
    
    const files = []
    // Create many files to ensure we hit the abort check
    for (let i = 0; i < 5; i++) {
      files.push({ name: `file${i}.txt`, input: new Blob([`Content ${i}`]) })
    }

    const stream = makeZip(files, { signal: controller.signal })
    const reader = stream.getReader()

    // Read first chunk then abort
    await reader.read() // Read first chunk
    controller.abort()

    // Next read should fail
    await expect(reader.read()).rejects.toThrow()
    await expect(reader.read()).rejects.toHaveProperty('name', 'AbortError')
  })

  it('should complete successfully when signal is not aborted', async () => {
    const controller = new AbortController()
    
    const files = [
      { name: 'test.txt', input: new Blob(['Hello, World!']) }
    ]

    const stream = makeZip(files, { signal: controller.signal })
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    expect(chunks.length).toBeGreaterThan(0)
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    expect(totalSize).toBeGreaterThan(0)
  })

  it('should work without providing a signal', async () => {
    const files = [
      { name: 'test.txt', input: new Blob(['Hello, World!']) }
    ]

    const stream = makeZip(files) // No signal provided
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    expect(chunks.length).toBeGreaterThan(0)
  })

  it('should abort with custom abort reason', async () => {
    const controller = new AbortController()
    controller.abort('Custom abort reason')
    
    const files = [
      { name: 'test.txt', input: new Blob(['Hello, World!']) }
    ]

    const stream = makeZip(files, { signal: controller.signal })
    const reader = stream.getReader()

    const promise = reader.read()
    await expect(promise).rejects.toThrow()
    await expect(promise).rejects.toHaveProperty('name', 'AbortError')
  })
})
