import { describe, expect, it } from 'vitest'
import { crc32, CRC_TABLE } from "../src/crc32"
import { readFileSync } from 'fs'
import { join } from 'path'

// Read the test data files
const table = readFileSync(join(__dirname, 'table.array'))
const zipSpec = readFileSync(join(__dirname, 'APPNOTE.TXT'))

describe('CRC32', () => {
  it('precomputes CRCs for each byte using the polynomial 0xEDB88320', () => {
    const actual = new Uint8Array(CRC_TABLE.buffer)
    const expected = new Uint8Array(table.slice(0, 0x400))
    expect(actual).toEqual(expected)
  })

  it('calculates CRC32 for an empty file', () => {
    expect(crc32(new Uint8Array(0), 0)).toBe(0)
  })

  it('calculates CRC32 for short files', () => {
    expect(crc32(new TextEncoder().encode("Hello world!"), 0)).toBe(0x1b851995)
    expect(crc32(new TextEncoder().encode("WebAssmebly is fun. Also 10x faster than JavaScript for this."), 0)).toBe(0x8a89a52a)
    expect(crc32(new Uint8Array(table), 0)).toBe(0x1a76768f)
  })

  it('calculates CRC32 for files larger than 64kB', () => {
    expect(crc32(new Uint8Array(zipSpec), 0)).toBe(0xbb3afe3f)
  })
})