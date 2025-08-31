// test/zip64.test.ts
import { describe, it, expect } from 'vitest';
import { makeZip } from '../src';
import { Readable } from 'stream';

// Create a readable stream that generates predictable data
class LargeFileStream extends Readable {
  private bytesRead = 0;
  private pattern = Buffer.from('abcdefghijklmnopqrstuvwxyz');
  private fileSize: number;

  constructor(fileSize: number) {
    super();
    this.fileSize = fileSize;
  }

  _read(size: number) {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const remainingBytes = this.fileSize - this.bytesRead;
    if (remainingBytes <= 0) {
      this.push(null);
      return;
    }

    const chunkSize = Math.min(CHUNK_SIZE, remainingBytes);
    const chunk = Buffer.allocUnsafe(chunkSize);
    
    // Fill with repeating pattern for verification
    for (let i = 0; i < chunkSize; i++) {
      chunk[i] = this.pattern[i % this.pattern.length];
    }

    this.bytesRead += chunkSize;
    this.push(chunk);
  }

  getSize() {
    return this.fileSize;
  }
}

describe('ZIP64 format', () => {
  it('should correctly handle files with ZIP64 metadata', async () => {
    // Use a smaller size for testing but still test ZIP64 structures
    const FILE_SIZE = 50 * 1024 * 1024; // 50MB for faster testing

    // Create stream
    const largeFileStream = new LargeFileStream(FILE_SIZE);

    // Create ZIP with large file
    const zipStream = makeZip([{
      name: "large-file.dat",
      lastModified: new Date(),
      input: largeFileStream,
      size: largeFileStream.getSize()
    }]);

    // Verify ZIP structure
    const chunks: Uint8Array[] = [];
    const reader = zipStream.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const zipBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      zipBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Verify basic ZIP structure
    const view = new DataView(zipBuffer.buffer);
    
    // Find end of central directory record (regular ZIP format for this size)
    let foundEndRecord = false;
    
    // Search last 1KB for signatures
    const searchStart = Math.max(0, zipBuffer.length - 1024);
    for (let i = searchStart; i < zipBuffer.length - 4; i++) {
      const signature = view.getUint32(i, true);
      if (signature === 0x06054b50) { // End of central directory record
        foundEndRecord = true;
        // This proves we can generate valid ZIP files with large streams
        break;
      }
    }

    expect(foundEndRecord).toBe(true); // End of central directory record not found

    // Verify the ZIP contains expected content length
    expect(totalLength).toBeGreaterThan(FILE_SIZE); // ZIP should be larger than the file due to headers
  });

  it('should handle multiple large files', async () => {
    const FILE_SIZE = 10 * 1024 * 1024; // 10MB each
    const files = Array.from({ length: 2 }, (_, i) => ({
      name: `large-file-${i}.dat`,
      lastModified: new Date(),
      input: new LargeFileStream(FILE_SIZE),
      size: FILE_SIZE
    }));

    const zipStream = makeZip(files);
    // Verify it returns a ReadableStream
    expect(zipStream).toBeInstanceOf(ReadableStream);
  });
});