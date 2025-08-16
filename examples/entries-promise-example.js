// Example demonstrating promise-based entries API in client-zip

import { makeZipWithEntries, downloadZipWithEntries } from '../index.js'

// Example 1: Basic usage with makeZipWithEntries
async function basicEntriesExample() {
  console.log('=== Basic Entries Promise Example ===')
  
  const files = [
    { name: 'document.txt', input: 'This is a text document with some content.' },
    { name: 'readme.md', input: '# README\n\nThis is a README file.' },
    { name: 'data.json', input: JSON.stringify({ users: ['Alice', 'Bob'], count: 2 }) }
  ]

  // Create ZIP with entries promise
  const { stream, entries } = makeZipWithEntries(files)
  
  console.log('Creating ZIP and collecting entries...')
  
  // You can consume the stream and get entries simultaneously
  const streamPromise = consumeStream(stream)
  
  // Wait for entries to be collected
  const zipEntries = await entries
  
  console.log(`\nCollected ${zipEntries.length} entries:`)
  zipEntries.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.filename}`)
    console.log(`   Offset: ${entry.offset}`)
    console.log(`   Data Offset: ${entry.dataOffset}`)
    console.log(`   Size: ${entry.uncompressedSize} bytes`)
    console.log(`   CRC32: 0x${entry.crc32.toString(16)}`)
    console.log(`   Compression: ${entry.compressionMethod === 0 ? 'STORE' : 'Unknown'}`)
    console.log('')
  })
  
  const zipData = await streamPromise
  console.log(`ZIP file created: ${zipData.length} total bytes`)
}

// Example 2: Using with downloadZipWithEntries for web downloads
async function downloadWithEntriesExample() {
  console.log('=== Download with Entries Example ===')
  
  const files = [
    { name: 'photo1.txt', input: 'Fake photo data'.repeat(100) },
    { name: 'photo2.txt', input: 'Another photo'.repeat(150) },
    { name: 'metadata.json', input: JSON.stringify({ 
      photos: 2, 
      created: new Date().toISOString(),
      quality: 'high'
    })}
  ]

  const { response, entries } = downloadZipWithEntries(files)
  
  console.log('Starting download...')
  console.log('Response headers:', {
    contentType: response.headers.get('Content-Type'),
    disposition: response.headers.get('Content-Disposition')
  })
  
  // Start consuming the response (simulating download)
  const downloadPromise = response.arrayBuffer()
  
  // Get the entries metadata
  const zipEntries = await entries
  
  console.log('\nFile manifest:')
  let totalSize = 0n
  zipEntries.forEach(entry => {
    totalSize += entry.uncompressedSize
    console.log(`- ${entry.filename}: ${entry.uncompressedSize} bytes`)
  })
  
  console.log(`\nTotal uncompressed size: ${totalSize} bytes`)
  
  const downloadedData = await downloadPromise
  console.log(`Downloaded ZIP size: ${downloadedData.byteLength} bytes`)
}

// Example 3: Progress tracking with entries
async function progressTrackingExample() {
  console.log('=== Progress Tracking with Entries Example ===')
  
  const files = []
  // Create multiple files for progress demonstration
  for (let i = 1; i <= 10; i++) {
    files.push({
      name: `file${i}.txt`,
      input: `Content for file ${i}\n`.repeat(i * 100)
    })
  }

  const { stream, entries } = makeZipWithEntries(files, {
    onEntry: (entry) => {
      console.log(`✓ Processed: ${entry.filename} (${entry.uncompressedSize} bytes)`)
    }
  })
  
  console.log('Processing files with progress tracking...')
  
  // Consume stream while tracking progress
  const reader = stream.getReader()
  let totalChunks = 0
  let totalBytes = 0
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      totalChunks++
      totalBytes += value.length
      
      if (totalChunks % 5 === 0) {
        console.log(`   Downloaded ${totalChunks} chunks, ${totalBytes} bytes...`)
      }
    }
  } finally {
    reader.releaseLock()
  }
  
  // Get final entries summary
  const zipEntries = await entries
  
  console.log('\n=== Final Summary ===')
  console.log(`Total files processed: ${zipEntries.length}`)
  console.log(`Total chunks: ${totalChunks}`)
  console.log(`Total bytes: ${totalBytes}`)
  
  const totalUncompressed = zipEntries.reduce((sum, entry) => sum + entry.uncompressedSize, 0n)
  console.log(`Uncompressed size: ${totalUncompressed}`)
  console.log(`Compression ratio: ${((Number(totalUncompressed) - totalBytes) / Number(totalUncompressed) * 100).toFixed(1)}%`)
}

// Example 4: Error handling with entries promise
async function errorHandlingExample() {
  console.log('=== Error Handling with Entries Example ===')
  
  const files = [
    { name: 'good-file.txt', input: 'This file is fine' },
    { 
      name: 'problem-file.txt', 
      input: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Starting...'))
          // Simulate an error during streaming
          setTimeout(() => {
            controller.error(new Error('Simulated stream error'))
          }, 100)
        }
      })
    }
  ]

  const { stream, entries } = makeZipWithEntries(files)
  
  try {
    console.log('Attempting to create ZIP with problematic file...')
    
    // Try to consume the stream
    const reader = stream.getReader()
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }
    
    // If we get here, no error occurred
    const zipEntries = await entries
    console.log(`Success: ${zipEntries.length} entries processed`)
    
  } catch (error) {
    console.log(`Stream error caught: ${error.message}`)
    
    try {
      await entries
      console.log('Entries promise resolved despite stream error')
    } catch (entriesError) {
      console.log(`Entries promise also rejected: ${entriesError.message}`)
    }
  }
}

// Example 5: Combining callback and promise approaches
async function hybridCallbackPromiseExample() {
  console.log('=== Hybrid Callback + Promise Example ===')
  
  const files = [
    { name: 'alpha.txt', input: 'Alpha content' },
    { name: 'beta.txt', input: 'Beta content' },
    { name: 'gamma.txt', input: 'Gamma content' }
  ]

  const processedFiles = []
  
  const { stream, entries } = makeZipWithEntries(files, {
    onEntry: (entry) => {
      // Real-time callback for immediate processing
      processedFiles.push(entry.filename)
      console.log(`Real-time: Processed ${entry.filename}`)
      
      // Could update UI progress bars here
      const progress = (processedFiles.length / files.length) * 100
      console.log(`Progress: ${progress.toFixed(0)}%`)
    }
  })
  
  // Consume the stream
  await consumeStream(stream)
  
  // Get complete entries for final processing
  const allEntries = await entries
  
  console.log('\n=== Final Analysis ===')
  console.log('Files by size:')
  allEntries
    .sort((a, b) => Number(b.uncompressedSize - a.uncompressedSize))
    .forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.filename}: ${entry.uncompressedSize} bytes`)
    })
}

// Helper function to consume a stream
async function consumeStream(stream) {
  const reader = stream.getReader()
  const chunks = []
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  
  // Combine all chunks into a single Uint8Array
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  
  return result
}

// Run all examples
async function runAllExamples() {
  await basicEntriesExample()
  console.log('\n' + '='.repeat(60) + '\n')
  
  await downloadWithEntriesExample()
  console.log('\n' + '='.repeat(60) + '\n')
  
  await progressTrackingExample()
  console.log('\n' + '='.repeat(60) + '\n')
  
  await errorHandlingExample()
  console.log('\n' + '='.repeat(60) + '\n')
  
  await hybridCallbackPromiseExample()
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error)
}

export {
  basicEntriesExample,
  downloadWithEntriesExample,
  progressTrackingExample,
  errorHandlingExample,
  hybridCallbackPromiseExample
}
