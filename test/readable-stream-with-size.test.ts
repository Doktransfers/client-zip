import { describe, expect, it } from 'vitest'
import { makeZip, makeZipWithEntries, ReadableStreamWithSize } from '../src'

describe('ReadableStreamWithSize', () => {
  it('should ensure all ZIP functions return ReadableStreamWithSize', async () => {
    const files = [
      { name: 'test.txt', input: 'Hello', size: 5 }
    ]

    // Test makeZip
    const zipStream = makeZip(files, { metadata: files })
    expect(zipStream).toBeInstanceOf(ReadableStream)
    expect(zipStream).toHaveProperty('size')
    expect(typeof zipStream.size).toBe('number')

    // Test makeZipWithEntries
    const { stream: entriesStream } = makeZipWithEntries(files, { metadata: files })
    expect(entriesStream).toBeInstanceOf(ReadableStream)
    expect(entriesStream).toHaveProperty('size')
    expect(typeof entriesStream.size).toBe('number')

    // Both should return the same size
    expect(zipStream.size).toBe(entriesStream.size)

    console.log('All functions return ReadableStreamWithSize with size:', zipStream.size)
  })
  it('should return a ReadableStream with size property when metadata is provided', async () => {
    const files = [
      { name: 'test1.txt', input: 'Hello, World!', size: 13 },
      { name: 'test2.txt', input: 'Second file', size: 11 }
    ]

    const stream = makeZip(files, {
      metadata: files
    })

    // Check that it's a ReadableStream
    expect(stream).toBeInstanceOf(ReadableStream)
    
    // Check that it has the size property
    expect(stream).toHaveProperty('size')
    if (stream.size !== undefined) {
      expect(typeof stream.size).toBe('number')
      expect(stream.size).toBeGreaterThan(0)
      console.log('Predicted ZIP size:', stream.size)
    }
  })

  it('should work without size property when prediction is not possible', async () => {
    const files = [
      { name: 'test.txt', input: new Blob(['Hello']) }
    ]

    const stream = makeZip(files)

    // Check that it's a ReadableStream
    expect(stream).toBeInstanceOf(ReadableStream)
    
    // Size might be undefined if prediction failed
    if (stream.size !== undefined) {
      expect(typeof stream.size).toBe('number')
    }
  })

  it('should be consumable as a normal ReadableStream', async () => {
    const files = [
      { name: 'test.txt', input: 'Test content', size: 12 }
    ]

    const stream = makeZip(files, {
      metadata: files
    })

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
    
    // The actual size should be reasonably close to predicted size
    if (stream.size !== undefined) {
      const sizeDifference = Math.abs(totalSize - stream.size)
      console.log('Predicted:', stream.size, 'Actual:', totalSize, 'Difference:', sizeDifference)
      
      // Allow reasonable difference due to ZIP overhead
      expect(sizeDifference).toBeLessThan(totalSize * 0.5) // Allow up to 50% difference for small files
    }
  })

  it('should work with AbortSignal', async () => {
    const controller = new AbortController()
    const files = [
      { name: 'test.txt', input: 'Test', size: 4 }
    ]

    const stream = makeZip(files, {
      signal: controller.signal,
      metadata: files
    })

    if (stream.size !== undefined) {
      expect(stream.size).toBeGreaterThan(0)
    }

    // Should work normally when not aborted
    const reader = stream.getReader()
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    // The stream should complete successfully
    expect(true).toBe(true) // Test passes if we get here
  })

  it('should handle empty file list', async () => {
    const files: any[] = []

    const stream = makeZip(files, {
      metadata: files
    })

    expect(stream).toBeInstanceOf(ReadableStream)
    
    // For empty ZIP, size should be the minimal ZIP structure size
    if (stream.size !== undefined) {
      expect(stream.size).toBeGreaterThan(0)
      console.log('Empty ZIP size:', stream.size)
    }
  })

  it('should preserve type compatibility with ReadableStream', async () => {
    const files = [
      { name: 'test.txt', input: 'Hello', size: 5 }
    ]

    const stream: ReadableStreamWithSize<Uint8Array> = makeZip(files, {
      metadata: files
    })

    // Should be assignable to ReadableStream
    const regularStream: ReadableStream<Uint8Array> = stream
    expect(regularStream).toBeInstanceOf(ReadableStream)

    // Should have the additional size property when cast back
    const streamWithSize = regularStream as ReadableStreamWithSize<Uint8Array>
    if (streamWithSize.size !== undefined) {
      expect(typeof streamWithSize.size).toBe('number')
    }
  })

  it('should handle different file types with size', async () => {
    const stringContent = 'String content'
    const blobContent = 'Blob content'
    const bufferContent = 'Buffer content'

    const files = [
      { name: 'string.txt', input: stringContent, size: stringContent.length },
      { name: 'blob.txt', input: new Blob([blobContent]), size: blobContent.length },
      { name: 'buffer.txt', input: new TextEncoder().encode(bufferContent), size: bufferContent.length }
    ]

    const stream = makeZip(files, {
      metadata: files
    })

    if (stream.size !== undefined) {
      expect(stream.size).toBeGreaterThan(0)
    }
    
    // Consume the stream to verify it works
    const reader = stream.getReader()
    let totalBytes = 0
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.length
    }

    expect(totalBytes).toBeGreaterThan(0)
    console.log('Multi-type ZIP - Predicted:', stream.size, 'Actual:', totalBytes)
  })

  it('should work when no size prediction is possible', async () => {
    const files = [
      { name: 'unknown.txt', input: new Blob(['Unknown size content']) }
    ]

    // No metadata provided, so size prediction should fail gracefully
    const stream = makeZip(files)

    expect(stream).toBeInstanceOf(ReadableStream)
    
    // Should still be consumable
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    expect(chunks.length).toBeGreaterThan(0)
  })
})
