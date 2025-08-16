import { describe, expect, it } from 'vitest'
import { makeZipWithEntries, downloadZipWithEntries, ZipEntryMetadata } from '../src'

describe('Promise-based Entries API', () => {
  describe('makeZipWithEntries', () => {
    it('should return stream and entries promise', async () => {
      const files = [
        { name: 'file1.txt', input: new Blob(['Hello']) },
        { name: 'file2.txt', input: new Blob(['World']) }
      ]

      const result = makeZipWithEntries(files)
      
      expect(result).toHaveProperty('stream')
      expect(result).toHaveProperty('entries')
      expect(result.stream).toBeInstanceOf(ReadableStream)
      expect(result.entries).toBeInstanceOf(Promise)
    })

    it('should resolve entries promise with metadata for all files', async () => {
      const files = [
        { name: 'test1.txt', input: new Blob(['Hello, World!']) },
        { name: 'test2.txt', input: new Blob(['Second file content']) }
      ]

      const { stream, entries } = makeZipWithEntries(files)
      
      // Consume the stream to trigger entry processing
      const reader = stream.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      const zipEntries = await entries
      
      expect(zipEntries).toHaveLength(2)
      expect(zipEntries[0].filename).toBe('test1.txt')
      expect(zipEntries[0].compressedSize).toBe(13n)
      expect(zipEntries[0].uncompressedSize).toBe(13n)
      expect(zipEntries[0].offset).toBe(0n)
      expect(zipEntries[0].crc32).toBeDefined()
      
      expect(zipEntries[1].filename).toBe('test2.txt')
      expect(zipEntries[1].compressedSize).toBe(19n)
      expect(zipEntries[1].uncompressedSize).toBe(19n)
      expect(zipEntries[1].offset).toBeGreaterThan(0n)
      expect(zipEntries[1].crc32).toBeDefined()
    })

    it('should work with callback and promise simultaneously', async () => {
      const files = [
        { name: 'test.txt', input: new Blob(['Test content']) }
      ]

      const callbackEntries: ZipEntryMetadata[] = []
      
      const { stream, entries } = makeZipWithEntries(files, {
        onEntry: (entry) => {
          callbackEntries.push(entry)
        }
      })
      
      // Consume the stream
      const reader = stream.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      const promiseEntries = await entries
      
      // Both should have the same data
      expect(callbackEntries).toHaveLength(1)
      expect(promiseEntries).toHaveLength(1)
      expect(callbackEntries[0]).toEqual(promiseEntries[0])
    })

    it('should reject entries promise on error', async () => {
      // Create a file with a stream that will error
      const errorStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'))
        }
      })
      
      const files = [
        { name: 'test.txt', input: errorStream }
      ]

      const { stream, entries } = makeZipWithEntries(files)
      
      // Try to consume the stream
      const reader = stream.getReader()
      let streamError: Error | null = null
      try {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      } catch (error) {
        streamError = error as Error
      }

      // Entries promise should also reject
      await expect(entries).rejects.toThrow()
      expect(streamError).toBeTruthy()
    })

    it('should handle empty file list', async () => {
      const files: any[] = []

      const { stream, entries } = makeZipWithEntries(files)
      
      // Consume the stream
      const reader = stream.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      const zipEntries = await entries
      expect(zipEntries).toHaveLength(0)
    })

    it('should work with abort signal option', async () => {
      const controller = new AbortController()
      const files = [
        { name: 'test.txt', input: new Blob(['Test content']) }
      ]

      const { stream, entries } = makeZipWithEntries(files, { 
        signal: controller.signal 
      })
      
      // Should work normally when not aborted
      const reader = stream.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
      
      const zipEntries = await entries
      expect(zipEntries).toHaveLength(1)
      expect(zipEntries[0].filename).toBe('test.txt')
    })
  })

  describe('downloadZipWithEntries', () => {
    it('should return response and entries promise', async () => {
      const files = [
        { name: 'file1.txt', input: new Blob(['Hello']) },
        { name: 'file2.txt', input: new Blob(['World']) }
      ]

      const result = downloadZipWithEntries(files)
      
      expect(result).toHaveProperty('response')
      expect(result).toHaveProperty('entries')
      expect(result.response).toBeInstanceOf(Response)
      expect(result.entries).toBeInstanceOf(Promise)
      expect(result.response.headers.get('Content-Type')).toBe('application/zip')
    })

    it('should resolve entries promise when response is consumed', async () => {
      const files = [
        { name: 'document.txt', input: new Blob(['Document content']) },
        { name: 'readme.txt', input: new Blob(['README content']) }
      ]

      const { response, entries } = downloadZipWithEntries(files)
      
      // Consume the response body
      const reader = response.body!.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      const zipEntries = await entries
      
      expect(zipEntries).toHaveLength(2)
      expect(zipEntries[0].filename).toBe('document.txt')
      expect(zipEntries[1].filename).toBe('readme.txt')
    })

    it('should work with custom options', async () => {
      const files = [
        { name: 'test.txt', input: new Blob(['Test']) }
      ]

      const { response, entries } = downloadZipWithEntries(files, {
        buffersAreUTF8: true
      })
      
      expect(response.headers.get('Content-Type')).toBe('application/zip')
      expect(response.headers.get('Content-Disposition')).toBe('attachment')
      
      // Consume the response
      await response.arrayBuffer()
      
      const zipEntries = await entries
      expect(zipEntries).toHaveLength(1)
      expect(zipEntries[0].filename).toBe('test.txt')
    })
  })

  describe('Entry Promise Edge Cases', () => {
    it('should handle large number of files', async () => {
      const files = []
      for (let i = 0; i < 100; i++) {
        files.push({
          name: `file${i}.txt`,
          input: new Blob([`Content for file ${i}`])
        })
      }

      const { stream, entries } = makeZipWithEntries(files)
      
      // Consume the stream
      const reader = stream.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      const zipEntries = await entries
      expect(zipEntries).toHaveLength(100)
      
      // Check that entries are in order
      for (let i = 0; i < 100; i++) {
        expect(zipEntries[i].filename).toBe(`file${i}.txt`)
      }
    })

    it('should handle mixed file types', async () => {
      const files = [
        { name: 'text.txt', input: 'String content' },
        { name: 'blob.txt', input: new Blob(['Blob content']) },
        { name: 'buffer.txt', input: new TextEncoder().encode('Buffer content') },
        { name: 'folder/', input: undefined } // folder
      ]

      const { stream, entries } = makeZipWithEntries(files)
      
      // Consume the stream
      const reader = stream.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      const zipEntries = await entries
      expect(zipEntries).toHaveLength(4)
      
      expect(zipEntries[0].filename).toBe('text.txt')
      expect(zipEntries[1].filename).toBe('blob.txt')
      expect(zipEntries[2].filename).toBe('buffer.txt')
      expect(zipEntries[3].filename).toBe('folder/')
    })

    it('should resolve entries promise even if not consumed immediately', async () => {
      const files = [
        { name: 'test.txt', input: new Blob(['Test']) }
      ]

      const { stream, entries } = makeZipWithEntries(files)
      
      // Don't consume stream immediately, but entries promise should still work
      // when we eventually consume it
      setTimeout(async () => {
        const reader = stream.getReader()
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }, 100)

      const zipEntries = await entries
      expect(zipEntries).toHaveLength(1)
      expect(zipEntries[0].filename).toBe('test.txt')
    })
  })
})
