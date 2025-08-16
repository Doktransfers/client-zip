import { describe, expect, it } from 'vitest'
import { makeZip, ZipEntryMetadata } from '../src'
 
describe('ZIP Entry Metadata', () => {
  it('should expose correct ZIP entry metadata including offsets and CRC32', async () => {
    // Create test files with known content
    const file1Content = 'Hello, World!'
    const file2Content = 'Testing ZIP metadata!'
    
    const files = [
      { name: 'test1.txt', input: new Blob([file1Content]) },
      { name: 'test2.txt', input: new Blob([file2Content]) }
    ]

    // Create ZIP with metadata callback
    const zipEntries: ZipEntryMetadata[] = []
    const stream = makeZip(files, {
      onEntry: (entry) => {
        console.log('ZIP Entry:', entry)
        zipEntries.push(entry)
      }
    })

    // Read the entire stream to trigger all metadata events
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      console.log('Chunk size:', value.length)
    }

    // Calculate total ZIP size
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    console.log('Total ZIP size:', totalSize)

    // Verify we got metadata for both files
    expect(zipEntries).toHaveLength(2)

    // Verify first file metadata
    const entry1 = zipEntries[0]
    expect(entry1.filename).toBe('test1.txt')
    expect(entry1.offset).toBeGreaterThanOrEqual(0)
    expect(entry1.dataOffset).toBeGreaterThan(entry1.offset) // dataOffset should be after header
    expect(entry1.compressedSize).toBe(BigInt(file1Content.length))
    expect(entry1.uncompressedSize).toBe(BigInt(file1Content.length))
    expect(entry1.crc32).toBeDefined()

    // Log actual offsets for debugging
    console.log('Entry 1:', {
      name: entry1.filename,
      offset: entry1.offset,
      dataOffset: entry1.dataOffset,
      compressedSize: entry1.compressedSize,
      uncompressedSize: entry1.uncompressedSize,
      crc32: entry1.crc32.toString(16)
    })

    // Verify second file metadata
    const entry2 = zipEntries[1]
    expect(entry2.filename).toBe('test2.txt')
    expect(entry2.offset).toBeGreaterThan(entry1.offset + entry1.compressedSize)
    expect(entry2.dataOffset).toBeGreaterThan(entry2.offset)
    expect(entry2.compressedSize).toBe(BigInt(file2Content.length))
    expect(entry2.uncompressedSize).toBe(BigInt(file2Content.length))
    expect(entry2.crc32).toBeDefined()

    // Log actual offsets for debugging
    console.log('Entry 2:', {
      name: entry2.filename,
      offset: entry2.offset,
      dataOffset: entry2.dataOffset,
      compressedSize: entry2.compressedSize,
      uncompressedSize: entry2.uncompressedSize,
      crc32: entry2.crc32.toString(16)
    })

    // Verify offsets are in correct order
    expect(entry2.offset).toBeGreaterThan(entry1.offset + entry1.compressedSize)
    expect(entry2.dataOffset).toBeGreaterThan(entry1.dataOffset + entry1.compressedSize)
  })

  it('should calculate correct CRC32 values', async () => {
    const content = 'Hello, World!'
    const files = [
      { name: 'test.txt', input: new Blob([content]) }
    ]

    const zipEntries: ZipEntryMetadata[] = []
    const stream = makeZip(files, {
      onEntry: (entry) => {
        zipEntries.push(entry)
      }
    })

    // Read the entire stream
    const reader = stream.getReader()
    while (!(await reader.read()).done) {}

    // Known CRC32 for 'Hello, World!'
    const expectedCRC32 = 0xec4ac3d0

    expect(zipEntries[0].crc32).toBe(expectedCRC32)
  })

  it('should handle empty files correctly', async () => {
    const files = [
      { name: 'empty.txt', input: new Blob([]) }
    ]

    const zipEntries: ZipEntryMetadata[] = []
    const stream = makeZip(files, {
      onEntry: (entry) => {
        zipEntries.push(entry)
      }
    })

    // Read the entire stream
    const reader = stream.getReader()
    while (!(await reader.read()).done) {}

    const entry = zipEntries[0]
    expect(entry.filename).toBe('empty.txt')
    expect(entry.compressedSize).toBe(0n)
    expect(entry.uncompressedSize).toBe(0n)
    expect(entry.crc32).toBe(0) // CRC32 of empty content
  })
})