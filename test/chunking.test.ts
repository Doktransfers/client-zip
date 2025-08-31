import { describe, it, expect } from 'vitest'
import { fileData } from '../src/zip'
import type { ZipFileDescription } from '../src/input'
import type { Metadata } from '../src/metadata'
import { crc32 } from '../src/crc32'

function makeBlobWithBytes(length: number): { blob: Blob, bytes: Uint8Array } {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = i & 0xff
  const blob = new Blob([bytes])
  return { blob, bytes }
}

function makeFile(length: number): ZipFileDescription & Metadata {
  const { blob } = makeBlobWithBytes(length)
  return {
    isFile: true,
    modDate: new Date(),
    bytes: blob.stream(),
    mode: 0o664,
    blob,
    encodedName: new TextEncoder().encode('test.bin'),
    nameIsBuffer: false
  }
}

describe('Blob chunking with firstPartSize/lastPartSize', () => {
  it('splits into first-sized chunks and one last chunk', async () => {
    const total = 21 // 8 + 8 + 5
    const file = makeFile(total)

    const chunks: Uint8Array[] = []
    for await (const chunk of fileData({ file, firstPartSize: 8, lastPartSize: 5 })) {
      chunks.push(chunk)
    }

    // Expect 3 chunks: 8, 8, 5
    expect(chunks.map(c => c.length)).toEqual([8, 8, 5])

    // Verify size and CRC on the file match the concatenated data
    const all = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) { all.set(c, offset); offset += c.length }
    expect(file.uncompressedSize).toBe(BigInt(total))
    expect(file.crc).toBe(crc32(all, 0))
  })

  it('throws if explicit lastPartSize mismatches the remaining size', async () => {
    const total = 21 // remaining after two 8s is 5
    const file = makeFile(total)

    const run = async () => {
      for await (const _ of fileData({ file, firstPartSize: 8, lastPartSize: 6 })) {
        // consume
      }
    }
    await expect(run()).rejects.toThrowError(/Invalid lastPartSize/)
  })
})


