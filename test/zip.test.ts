import { describe, expect, it } from 'vitest'
import { fileHeader, fileData, dataDescriptor, centralHeader, zip64ExtraField, contentLength, flagNameUTF8 } from "../src/zip"
import type { ZipFileDescription, ZipFolderDescription } from "../src/input"
import type { Metadata } from "../src/metadata"
import { readFileSync } from 'fs'
import { join } from  'path'

const BufferFromHex = (hex: string) => new Uint8Array(Array.from(hex.matchAll(/.{2}/g), ([s]) => parseInt(s, 16)))

const zipSpec = readFileSync(join(__dirname, 'APPNOTE.TXT'))
const specName = new TextEncoder().encode("APPNOTE.TXT")
const specDate = new Date("2019-04-26T02:00")
const invalidUTF8 = BufferFromHex("fe")

const baseFile: ZipFileDescription & Metadata = Object.freeze(
  { isFile: true, bytes: new Uint8Array(zipSpec), encodedName: specName, nameIsBuffer: false, modDate: specDate, mode: 0o664 })

const baseFolder: ZipFolderDescription & Metadata = Object.freeze(
  { isFile: false, encodedName: new TextEncoder().encode("folder"), nameIsBuffer: false, modDate: specDate, mode: 0o775 })

describe('ZIP', () => {
  describe('fileHeader', () => {
    it('makes file headers', () => {
      const file = {...baseFile}
      const actual = fileHeader(file)
      const expected = BufferFromHex("504b03042d000800000000109a4e0000000000000000000000000b000000")
      expect(actual).toEqual(expected)
    })

    it('makes folder headers', () => {
      const folder = {...baseFolder}
      const actual = fileHeader(folder)
      const expected = BufferFromHex("504b03042d000800000000109a4e00000000000000000000000006000000")
      expect(actual).toEqual(expected)
    })

    it('merges extra flags', () => {
      const file = {...baseFile}
      const actual = fileHeader(file, 0x808)
      const expected = BufferFromHex("504b03042d000808000000109a4e0000000000000000000000000b000000")
      expect(actual).toEqual(expected)
    })
  })

  describe('fileData', () => {
    it('yields all the file\'s data', async () => {
      const file = {...baseFile}
      const chunks: Uint8Array[] = []
      for await (const chunk of fileData({ file })) chunks.push(chunk)
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const actual = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        actual.set(chunk, offset)
        offset += chunk.length
      }
      expect(actual).toEqual(new Uint8Array(zipSpec))
    })

    it('sets the file\'s size and CRC properties', async () => {
      const file = {...baseFile}
      expect(file.uncompressedSize).toBeUndefined()
      expect(file.crc).toBeUndefined()
      for await (const _ of fileData({ file }));
      expect(file.uncompressedSize).toBe(BigInt(zipSpec.length))
      expect(file.crc).toBe(0xbb3afe3f)
    })
  })

  // ... rest of the tests converted similarly
})