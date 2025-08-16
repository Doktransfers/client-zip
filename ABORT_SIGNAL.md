# AbortSignal Support

The `client-zip` library now supports `AbortSignal` to cancel ZIP generation operations. This is useful for implementing cancellation in user interfaces, timeouts, and other scenarios where you need to stop the ZIP creation process.

## Basic Usage

```javascript
import { makeZip, downloadZip } from 'client-zip'

// Create an AbortController
const controller = new AbortController()

// Pass the signal to the ZIP functions
const stream = makeZip(files, { signal: controller.signal })
// or
const response = downloadZip(files, { signal: controller.signal })

// Abort the operation
controller.abort('User cancelled')
```

## Use Cases

### 1. User Cancellation

```javascript
const controller = new AbortController()
const cancelButton = document.getElementById('cancel')

cancelButton.addEventListener('click', () => {
  controller.abort('User cancelled the download')
})

try {
  const response = downloadZip(files, { signal: controller.signal })
  // Handle the download...
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Download was cancelled')
  }
}
```

### 2. Timeout Implementation

```javascript
const controller = new AbortController()

// Set a 30-second timeout
const timeoutId = setTimeout(() => {
  controller.abort('Download timed out')
}, 30000)

try {
  const stream = makeZip(files, { signal: controller.signal })
  // Process the stream...
  clearTimeout(timeoutId)
} catch (error) {
  clearTimeout(timeoutId)
  if (error.name === 'AbortError') {
    console.log('Operation was aborted')
  }
}
```

### 3. Component Unmounting (React)

```javascript
function ZipDownloadComponent() {
  useEffect(() => {
    const controller = new AbortController()
    
    const generateZip = async () => {
      try {
        const stream = makeZip(files, { signal: controller.signal })
        // Handle the stream...
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('ZIP generation failed:', error)
        }
      }
    }
    
    generateZip()
    
    // Cleanup: abort when component unmounts
    return () => controller.abort('Component unmounted')
  }, [])
}
```

## How It Works

The abort signal is checked at several key points during ZIP generation:

1. **Before processing each file** - Allows quick cancellation when iterating through many files
2. **During file data reading** - Stops processing large files when streaming content
3. **In the readable stream** - Prevents further chunk generation

When an abort signal is triggered:

- The operation immediately throws an `AbortError` (a `DOMException` with `name: 'AbortError'`)
- Any in-progress file reading is stopped
- The ZIP stream is closed

## Error Handling

```javascript
try {
  const stream = makeZip(files, { signal: controller.signal })
  // Process stream...
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Operation was aborted:', error.message)
  } else {
    console.error('Unexpected error:', error)
  }
}
```

## Backwards Compatibility

The abort signal is completely optional. Existing code will continue to work without any changes:

```javascript
// This still works exactly as before
const stream = makeZip(files)
const response = downloadZip(files)
```

## Performance Considerations

- Abort signal checking has minimal performance impact
- The check happens at natural async boundaries
- No polling or continuous monitoring is performed
- Memory is cleaned up immediately when aborted
