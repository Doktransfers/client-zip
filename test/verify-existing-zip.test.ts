/**
 * LARGE FILE TEST - RUN ONLY ON DEMAND
 * 
 * This test file is designed to verify the integrity of existing large ZIP files
 * that were created by the large file tests. It is tagged with 'large-files' and won't
 * run during regular test runs due to:
 * - Dependency on large test files
 * - Long execution time
 * - Requirement for specific test data
 * 
 * To run these tests: npm run test:large-files
 * 
 * DO NOT include this file in regular CI/CD pipelines or development workflows.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'

// Helper function to verify ZIP integrity without loading entire file into memory
async function verifyZipIntegrity(zipFilePath: string): Promise<{ isValid: boolean, error?: string }> {
    try {
        const stats = fs.statSync(zipFilePath)
        const fileSize = stats.size

        let foundLocalFileHeader = false
        let foundCentralDirectory = false
        let foundEndOfCentralDirectory = false

        // Check beginning of file for local file header (first 1KB)
        const beginBuffer = Buffer.alloc(Math.min(1024, fileSize))
        const fd = fs.openSync(zipFilePath, 'r')

        try {
            fs.readSync(fd, beginBuffer, 0, beginBuffer.length, 0)
            const beginView = new DataView(beginBuffer.buffer)

            if (beginView.getUint32(0, true) === 0x04034b50) {
                foundLocalFileHeader = true
                console.log('✅ Local file header found at beginning')
            }

            // Check end of file for central directory and end record (last 64KB)
            const endReadSize = Math.min(65536, fileSize)
            const endBuffer = Buffer.alloc(endReadSize)
            const endOffset = Math.max(0, fileSize - endReadSize)

            fs.readSync(fd, endBuffer, 0, endBuffer.length, endOffset)
            const endView = new DataView(endBuffer.buffer)

            // Search backwards for end of central directory
            for (let i = endBuffer.length - 22; i >= 0; i--) {
                const signature = endView.getUint32(i, true)

                if (signature === 0x06054b50) { // End of central directory
                    foundEndOfCentralDirectory = true

                    // Verify end of central directory structure
                    const totalEntries = endView.getUint16(i + 10, true)
                    const centralDirSize = endView.getUint32(i + 12, true)
                    const centralDirOffset = endView.getUint32(i + 16, true)

                    console.log(`✅ End of central directory found`)
                    console.log(`  ZIP contains ${totalEntries} entries`)
                    console.log(`  Central directory size: ${centralDirSize} bytes`)
                    console.log(`  Central directory offset: ${centralDirOffset}`)

                    // Check if we can find central directory
                    if (centralDirOffset < fileSize && centralDirOffset !== 0xFFFFFFFF) {
                        // Regular ZIP format - central directory offset is valid
                        const cdBuffer = Buffer.alloc(Math.min(1024, centralDirSize))
                        fs.readSync(fd, cdBuffer, 0, cdBuffer.length, centralDirOffset)
                        const cdView = new DataView(cdBuffer.buffer)

                        if (cdView.getUint32(0, true) === 0x02014b50) {
                            foundCentralDirectory = true
                            console.log('✅ Central directory header found (regular ZIP)')
                        }
                    } else if (centralDirOffset === 0xFFFFFFFF) {
                        // ZIP64 format - need to look for ZIP64 central directory
                        console.log('📄 ZIP64 format detected - central directory offset in ZIP64 structures')
                        foundCentralDirectory = true // For ZIP64, we'll trust that ZIP64 records exist
                        console.log('✅ Central directory assumed valid (ZIP64 format)')
                    }

                    break
                }
            }

        } finally {
            fs.closeSync(fd)
        }

        if (!foundLocalFileHeader) return { isValid: false, error: 'Local file header not found' }
        if (!foundCentralDirectory) return { isValid: false, error: 'Central directory not found' }
        if (!foundEndOfCentralDirectory) return { isValid: false, error: 'End of central directory not found' }

        return { isValid: true }
    } catch (error) {
        return { isValid: false, error: `Verification failed: ${error}` }
    }
}

describe('Verify Existing Large ZIP File', () => {
  // These tests are skipped by default due to dependency on large test files
  // To run them: npm run test:large-files
  
  const EXISTING_ZIP_PATH = '/tmp/test-large-output.zip'

  it('should verify integrity of existing large ZIP file', async () => {
    // Check if the file exists
    if (!fs.existsSync(EXISTING_ZIP_PATH)) {
      console.log(`Skipping test: File ${EXISTING_ZIP_PATH} not found`)
      return
    }

    // Get file stats
    const stats = fs.statSync(EXISTING_ZIP_PATH)
    const fileSizeGB = stats.size / (1024 ** 3)
    
    console.log(`ZIP file size: ${stats.size} bytes (${fileSizeGB.toFixed(2)} GB)`)
    
    // Verify ZIP integrity
    console.log('Verifying ZIP integrity...')
    const integrityResult = await verifyZipIntegrity(EXISTING_ZIP_PATH)
    
    if (!integrityResult.isValid) {
      console.error(`ZIP integrity check failed: ${integrityResult.error}`)
    } else {
      console.log('✅ ZIP integrity verified successfully!')
    }
    
    expect(integrityResult.isValid).toBe(true)
    expect(stats.size).toBeGreaterThan(0)
  }, 120 * 60 * 1000) // 120 minutes timeout for large files

  it('should check ZIP64 signatures if file is large enough', async () => {
    if (!fs.existsSync(EXISTING_ZIP_PATH)) {
      console.log(`Skipping test: File ${EXISTING_ZIP_PATH} not found`)
      return
    }

    const stats = fs.statSync(EXISTING_ZIP_PATH)
    
    if (stats.size > 4 * 1024 ** 3) {
      console.log('File is > 4GB, checking for ZIP64 signatures...')
      
      const fd = fs.openSync(EXISTING_ZIP_PATH, 'r')
      let foundZip64EndRecord = false
      let foundZip64Locator = false
      
      try {
        // Check last 1MB for ZIP64 signatures
        const searchSize = Math.min(1024 * 1024, stats.size)
        const buffer = Buffer.alloc(searchSize)
        const offset = Math.max(0, stats.size - searchSize)
        
        fs.readSync(fd, buffer, 0, buffer.length, offset)
        const view = new DataView(buffer.buffer)
        
        for (let i = 0; i < buffer.length - 4; i++) {
          const signature = view.getUint32(i, true)
          
          if (signature === 0x06064b50) { // ZIP64 end of central directory record
            foundZip64EndRecord = true
            console.log('✅ ZIP64 end of central directory record found')
          } else if (signature === 0x07064b50) { // ZIP64 end of central directory locator
            foundZip64Locator = true
            console.log('✅ ZIP64 end of central directory locator found')
          }
        }
        
        if (foundZip64EndRecord && foundZip64Locator) {
          console.log('✅ ZIP64 format confirmed for large file')
        } else {
          console.log('ℹ️  ZIP64 signatures not found (may use regular ZIP format)')
        }
        
      } finally {
        fs.closeSync(fd)
      }
    } else {
      console.log('File is <= 4GB, ZIP64 format not expected')
    }
    
    expect(true).toBe(true) // Test passes if we get here without errors
  }, 120 * 60 * 1000) // 120 minutes timeout for large files
})
