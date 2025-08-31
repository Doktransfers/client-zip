import { describe, it, expect } from 'vitest'
import { makeZip } from '../src'

function makeGeneratedReadable(totalBytes: number) {
    const chunkSize = 1024 * 1024; // 1 MiB
    let remaining = totalBytes;
    
    return new ReadableStream<Uint8Array>({
        pull(controller) {
            if (remaining <= 0) { 
                controller.close(); 
                return; 
            }
            
            const size = Math.min(chunkSize, remaining);
            const chunk = new Uint8Array(size);
            
            // Fill with predictable pattern
            for (let i = 0; i < size; i++) {
                chunk[i] = i & 0xff;
            }
            
            controller.enqueue(chunk);
            remaining -= size;
        }
    });
}

describe('Generated ReadableStream', () => {
  it('should work with makeZip', async () => {
    const totalSize = 5 * 1024 * 1024; // 5MB for faster testing
    
    const files = [{
        name: 'generated-file.dat',
        input: makeGeneratedReadable(totalSize),
        size: totalSize
    }];
    
    const zipStream = makeZip(files);
    
    // Verify it's a ReadableStream
    expect(zipStream).toBeInstanceOf(ReadableStream);
    
    // Consume the stream
    const reader = zipStream.getReader();
    let totalZipSize = 0;
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalZipSize += value.length;
    }
    
    // ZIP should be larger than original due to headers/metadata
    expect(totalZipSize).toBeGreaterThan(totalSize);
    console.log(`Generated ZIP size: ${totalZipSize} bytes`);
    console.log(`Original file size: ${totalSize} bytes`);
  });
  
  it('should handle the original function with corrections', async () => {
    // Your original function with corrections
    function makeGeneratedReadableFixed(totalBytes: number) {
        const chunkSize = 1024 * 1024; // 1 MiB
        let remaining = totalBytes;
        
        return new ReadableStream<Uint8Array>({
            pull(controller) {
                if (remaining <= 0) { 
                    controller.close(); 
                    return; 
                }
                
                const size = Math.min(chunkSize, remaining);
                const chunk = new Uint8Array(size); // Fixed: Use Uint8Array instead of Uint16Array
                
                // Fill with predictable pattern
                for (let i = 0; i < size; i++) {
                    chunk[i] = i & 0xff;
                }
                
                controller.enqueue(chunk);
                remaining -= size;
            }
        });
    }
    
    const totalSize = 2 * 1024 * 1024; // 2MB
    
    const files = [{
        name: 'fixed-generated-file.dat',
        input: makeGeneratedReadableFixed(totalSize),
        size: totalSize
    }];
    
    const zipStream = makeZip(files);
    
    // Should work without errors
    const reader = zipStream.getReader();
    let chunks = 0;
    
    while (true) {
        const { done } = await reader.read();
        if (done) break;
        chunks++;
    }
    
    expect(chunks).toBeGreaterThan(0);
  });
});
