// Example demonstrating AbortSignal support in client-zip

import { makeZip, downloadZip } from '../index.js'

// Example 1: Basic abort signal usage
async function basicAbortExample() {
  console.log('=== Basic Abort Example ===')
  
  const controller = new AbortController()
  
  const files = [
    { name: 'file1.txt', input: 'Hello, World!' },
    { name: 'file2.txt', input: 'This is file 2' },
    { name: 'file3.txt', input: 'This is file 3' }
  ]

  // Create ZIP with abort signal
  const stream = makeZip(files, { signal: controller.signal })
  const reader = stream.getReader()

  try {
    // Start reading
    const { value } = await reader.read()
    console.log('Read first chunk:', value.length, 'bytes')
    
    // Abort the operation
    controller.abort('User cancelled the operation')
    console.log('Aborted the ZIP generation')
    
    // Try to read more - should throw an AbortError
    await reader.read()
  } catch (error) {
    console.log('Caught error:', error.name, '-', error.message)
  }
}

// Example 2: Download with timeout using AbortSignal
async function downloadWithTimeoutExample() {
  console.log('\n=== Download with Timeout Example ===')
  
  const controller = new AbortController()
  
  // Set a timeout of 5 seconds
  const timeoutId = setTimeout(() => {
    controller.abort('Download timed out after 5 seconds')
  }, 5000)

  const files = []
  // Create many files to simulate a longer operation
  for (let i = 0; i < 100; i++) {
    files.push({
      name: `large-file-${i}.txt`,
      input: 'x'.repeat(10000) // 10KB per file
    })
  }

  try {
    const response = downloadZip(files, { signal: controller.signal })
    
    // Simulate starting a download
    const reader = response.body.getReader()
    let totalBytes = 0
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      totalBytes += value.length
      console.log(`Downloaded ${totalBytes} bytes...`)
      
      // Simulate slow download
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    clearTimeout(timeoutId)
    console.log('Download completed successfully!')
    
  } catch (error) {
    clearTimeout(timeoutId)
    console.log('Download failed:', error.name, '-', error.message)
  }
}

// Example 3: User-initiated cancellation
async function userCancellationExample() {
  console.log('\n=== User Cancellation Example ===')
  
  const controller = new AbortController()
  
  const files = [
    { name: 'document.txt', input: 'Important document content' },
    { name: 'image.txt', input: 'Fake image data'.repeat(1000) },
    { name: 'video.txt', input: 'Fake video data'.repeat(5000) }
  ]

  // Simulate user clicking cancel after 1 second
  setTimeout(() => {
    console.log('User clicked cancel button')
    controller.abort('User cancelled the operation')
  }, 1000)

  try {
    const stream = makeZip(files, { signal: controller.signal })
    const reader = stream.getReader()
    
    console.log('Starting ZIP creation...')
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('ZIP creation completed!')
        break
      }
      console.log(`Processing chunk: ${value.length} bytes`)
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
  } catch (error) {
    console.log('Operation was cancelled:', error.message)
  }
}

// Run examples
async function runExamples() {
  await basicAbortExample()
  await downloadWithTimeoutExample()
  await userCancellationExample()
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error)
}

export {
  basicAbortExample,
  downloadWithTimeoutExample,
  userCancellationExample
}
