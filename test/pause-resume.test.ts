import { describe, it, expect } from 'vitest'
import { makeZipIterator } from '../src'

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

function findEOCD(buffer: Uint8Array): number {
  // Search last 64 KiB for EOCD signature 0x06054b50
  const maxBack = Math.min(65536, buffer.length)
  for (let i = buffer.length - 22; i >= buffer.length - maxBack; i--) {
    if (i < 0) break
    if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b && buffer[i + 2] === 0x05 && buffer[i + 3] === 0x06) return i
  }
  return -1
}

function dv(buf: Uint8Array) { return new DataView(buf.buffer, buf.byteOffset, buf.byteLength) }

describe('pause and resume zip generation', () => {
  it('produces identical output to single-pass zip', async () => {
    // Prepare inputs
    const enc = new TextEncoder()
    const files = [
      { input: enc.encode('file-1-hello'), name: 'a.txt' },
      { input: enc.encode('file-2-world'), name: 'b.txt' },
      { input: enc.encode('file-3-zip'), name: 'c.txt' },
      { input: enc.encode('file-4-pause'), name: 'd.txt' },
      { input: enc.encode('file-5-resume'), name: 'e.txt' }
    ]

    // Single-pass reference
    const refChunks: Uint8Array[] = []
    {
      const { iterator } = makeZipIterator(files, { buffersAreUTF8: true })
      for (;;) {
        const { value } = await iterator.next()
        if (!value) break
        refChunks.push(value)
      }
    }
    const refZip = concatChunks(refChunks)

    // Phase 1: consume until central record has N entries
    const pauseAfter = 3
    const centralSnapshots: Uint8Array[][] = []
    const phase1Chunks: Uint8Array[] = []
    let bytesPhase1 = 0
    {
      const { iterator } = makeZipIterator(files, {
        buffersAreUTF8: true,
        onCentralRecordUpdate: (cr) => centralSnapshots.push(cr)
      })

      let prevUpdates = 0
      for (;;) {
        const { value } = await iterator.next()
        if (!value) break
        const updates = centralSnapshots.length
        // If we just reached or passed pauseAfter with this pull, do not include this chunk in phase1
        if (prevUpdates < pauseAfter && updates >= pauseAfter) {
          // stop right before next file header is included in phase 1
          break
        }
        phase1Chunks.push(value)
        bytesPhase1 += value.byteLength
        prevUpdates = updates
      }
    }

    // Resume state
    const savedCentral = centralSnapshots[pauseAfter - 1]
    expect(savedCentral.length).toBeGreaterThan(0)

    // Remaining files
    const remaining = files.slice(pauseAfter)

    // Phase 2: resume with saved central record and starting offset
    const phase2Chunks: Uint8Array[] = []
    {
      const { iterator } = makeZipIterator(remaining, {
        buffersAreUTF8: true,
        resume: {
          centralRecord: savedCentral,
          previousFileCount: pauseAfter,
          startingOffset: bytesPhase1,
          archiveNeedsZip64: false
        }
      })
      for (;;) {
        const { value } = await iterator.next()
        if (!value) break
        phase2Chunks.push(value)
      }
    }

    const finalZip = concatChunks([...phase1Chunks, ...phase2Chunks])

    // Verify EOCD and number of entries
    const eocd = findEOCD(finalZip)
    expect(eocd).toBeGreaterThanOrEqual(0)
    const view = dv(finalZip)
    const totalEntries = view.getUint16(eocd + 10, true)
    const cdSize = view.getUint32(eocd + 12, true)
    const cdOffset = view.getUint32(eocd + 16, true)
    expect(totalEntries).toBe(files.length)
    expect(cdSize).toBeGreaterThan(0)
    expect(cdOffset).toBeGreaterThan(0)
    expect(cdOffset).toBeLessThan(finalZip.length)

    // Compare to reference single-pass archive
    expect(finalZip.byteLength).toBe(refZip.byteLength)
    // Deep compare
    let equal = finalZip.byteLength === refZip.byteLength
    if (equal) {
      for (let i = 0; i < finalZip.byteLength; i++) {
        if (finalZip[i] !== refZip[i]) { equal = false; break }
      }
    }
    expect(equal).toBe(true)
  })
})


