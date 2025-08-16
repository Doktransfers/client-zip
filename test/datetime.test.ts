import { describe, expect, it } from 'vitest'
import { formatDOSDateTime } from "../src/datetime"
import { makeBuffer } from "../src/utils"

describe('datetime', () => {
  it('encodes datetime to local 32-bit DOS format', () => {
    const date = new Date("2020-02-15T11:24:18")
    const actual = makeBuffer(4)
    formatDOSDateTime(date, actual)
    const expected = 0x095b4f50
    expect(actual.getUint32(0)).toBe(expected)
  })
})