# Promise-based Entries API

The `client-zip` library now provides a promise-based API to get ZIP entry metadata, complementing the existing callback-based `onEntry` option. This provides more flexibility for handling entry metadata in different async patterns.

## New Functions

### `makeZipWithEntries(files, options)`

Creates a ZIP stream and returns both the stream and a promise that resolves with all entry metadata.

**Returns:** `{ stream: ReadableStream<Uint8Array>, entries: Promise<ZipEntryMetadata[]> }`

```javascript
import { makeZipWithEntries } from 'client-zip'

const files = [
  { name: 'file1.txt', input: 'Hello' },
  { name: 'file2.txt', input: 'World' }
]

const { stream, entries } = makeZipWithEntries(files)

// Consume the stream
const reader = stream.getReader()
while (true) {
  const { done } = await reader.read()
  if (done) break
}

// Get all entry metadata
const zipEntries = await entries
console.log(`Created ZIP with ${zipEntries.length} entries`)
```

### `downloadZipWithEntries(files, options)`

Creates a download Response and returns both the response and a promise that resolves with all entry metadata.

**Returns:** `{ response: Response, entries: Promise<ZipEntryMetadata[]> }`

```javascript
import { downloadZipWithEntries } from 'client-zip'

const files = [
  { name: 'document.pdf', input: pdfBlob },
  { name: 'readme.txt', input: 'Instructions...' }
]

const { response, entries } = downloadZipWithEntries(files)

// Start download
const downloadPromise = response.arrayBuffer()

// Get metadata
const zipEntries = await entries

// Show file manifest
zipEntries.forEach(entry => {
  console.log(`${entry.filename}: ${entry.uncompressedSize} bytes`)
})

const zipData = await downloadPromise
```

## ZipEntryMetadata Interface

Each entry in the resolved promise contains:

```typescript
interface ZipEntryMetadata {
  filename: string          // File name
  offset: bigint            // File header offset in ZIP
  dataOffset: bigint        // File data offset in ZIP
  compressedSize: bigint    // Compressed size (same as uncompressed for STORE)
  uncompressedSize: bigint  // Original file size
  crc32: number            // CRC32 checksum
  compressionMethod: number // 0 = STORE (no compression)
  flags: number            // ZIP flags
  headerSize: number       // Size of the file header
}
```

## Key Features

### 1. **Promise Resolution Timing**

The entries promise resolves when the entire ZIP generation is complete:

```javascript
const { stream, entries } = makeZipWithEntries(files)

// Start consuming stream
const reader = stream.getReader()
const consumePromise = consumeStream(reader)

// Entries promise resolves when all files are processed
const zipEntries = await entries  // Resolves when ZIP is complete
const zipData = await consumePromise
```

### 2. **Compatibility with Callback API**

You can use both the callback and promise approaches simultaneously:

```javascript
const processedCount = { value: 0 }

const { stream, entries } = makeZipWithEntries(files, {
  onEntry: (entry) => {
    processedCount.value++
    console.log(`Processed: ${entry.filename}`)
    updateProgressBar(processedCount.value / files.length)
  }
})

// Real-time progress via callback
// Final processing via promise
const allEntries = await entries
```

### 3. **Error Handling**

If ZIP generation fails, both the stream and entries promise will reject:

```javascript
try {
  const { stream, entries } = makeZipWithEntries(files)
  
  // Consume stream
  await consumeStream(stream)
  
  // Get entries
  const zipEntries = await entries
  
} catch (error) {
  console.error('ZIP generation failed:', error)
}
```

### 4. **AbortSignal Support**

Works seamlessly with abort signals:

```javascript
const controller = new AbortController()

const { stream, entries } = makeZipWithEntries(files, {
  signal: controller.signal
})

// Later...
controller.abort('User cancelled')

// Both will reject with AbortError
await Promise.allSettled([
  consumeStream(stream),
  entries
])
```

## Use Cases

### File Manifest Generation

```javascript
const { response, entries } = downloadZipWithEntries(files)

// Generate manifest while download starts
const manifest = (await entries).map(entry => ({
  name: entry.filename,
  size: Number(entry.uncompressedSize),
  crc: '0x' + entry.crc32.toString(16),
  offset: Number(entry.offset)
}))

console.table(manifest)
```

### Progress Tracking

```javascript
let processedFiles = 0

const { stream, entries } = makeZipWithEntries(files, {
  onEntry: () => {
    processedFiles++
    updateProgress(processedFiles / files.length)
  }
})

// Stream consumption...
const zipEntries = await entries

// Final summary
console.log(`Completed: ${zipEntries.length} files`)
```

### ZIP Analysis

```javascript
const { stream, entries } = makeZipWithEntries(files)

await consumeStream(stream)
const zipEntries = await entries

// Analyze the ZIP structure
const totalSize = zipEntries.reduce((sum, entry) => sum + entry.uncompressedSize, 0n)
const largestFile = zipEntries.reduce((max, entry) => 
  entry.uncompressedSize > max.uncompressedSize ? entry : max
)

console.log(`Total size: ${totalSize} bytes`)
console.log(`Largest file: ${largestFile.filename} (${largestFile.uncompressedSize} bytes)`)
```

### Validation

```javascript
const expectedFiles = ['doc.txt', 'image.jpg', 'data.json']

const { stream, entries } = makeZipWithEntries(files)
await consumeStream(stream)

const zipEntries = await entries
const actualFiles = zipEntries.map(e => e.filename)

const missing = expectedFiles.filter(f => !actualFiles.includes(f))
const extra = actualFiles.filter(f => !expectedFiles.includes(f))

if (missing.length || extra.length) {
  console.warn('File mismatch detected:', { missing, extra })
}
```

## Performance Notes

- **Memory efficient**: Entry metadata is collected during streaming, not stored separately
- **No performance overhead**: When not using entries promise, there's no additional cost
- **Async friendly**: Promise resolves naturally when ZIP generation completes
- **Error propagation**: Stream errors automatically propagate to entries promise

## Migration from Callback API

**Before (callback only):**
```javascript
const entries = []

const stream = makeZip(files, {
  onEntry: (entry) => entries.push(entry)
})

await consumeStream(stream)
// entries array now contains all metadata
```

**After (promise-based):**
```javascript
const { stream, entries } = makeZipWithEntries(files)

await consumeStream(stream)
const zipEntries = await entries
// zipEntries contains all metadata
```

The promise-based API is cleaner and handles errors automatically, while still supporting the callback approach for real-time processing.
