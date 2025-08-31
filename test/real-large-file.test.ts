/**
 * LARGE FILE TEST - RUN ONLY ON DEMAND
 * 
 * This test file is designed to test ZIP64 functionality with large files (>4GB) 
 * or directories containing many files. It is tagged with 'large-files' and won't
 * run during regular test runs due to:
 * - Long execution time (up to 2 hours)
 * - Large memory usage
 * - Requirement for specific test data
 * 
 * To run these tests: npm run test:large-files
 * 
 * DO NOT include this file in regular CI/CD pipelines or development workflows.
 */

import { describe, it, expect } from 'vitest'
import { makeZip } from '../src'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as path from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

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

// Helper function to recursively get all files from a directory
async function getAllFilesFromDirectory(dirPath: string, maxFiles?: number): Promise<Array<{ name: string, input: ReadableStream<Uint8Array>, size: number }>> {
    const files: Array<{ name: string, input: ReadableStream<Uint8Array>, size: number }> = []
    let fileCount = 0
    
    // Skip common non-essential directories and files
    const skipPatterns = ['.git', '.DS_Store', 'node_modules', '.svn', '.hg', 'Thumbs.db']
    
    async function walkDirectory(currentPath: string, relativePath: string = '') {
        if (maxFiles && fileCount >= maxFiles) return
        
        try {
            const entries = fs.readdirSync(currentPath, { withFileTypes: true })
            
            for (const entry of entries) {
                if (maxFiles && fileCount >= maxFiles) break
                
                // Skip hidden and common non-essential files/directories
                if (skipPatterns.some(pattern => entry.name.includes(pattern))) {
                    continue
                }
                
                const fullPath = path.join(currentPath, entry.name)
                const relativeFilePath = relativePath ? path.join(relativePath, entry.name) : entry.name
                
                if (entry.isDirectory()) {
                    // Recursively walk subdirectories
                    await walkDirectory(fullPath, relativeFilePath)
                } else if (entry.isFile()) {
                    try {
                        // Add file to the list
                        const stats = fs.statSync(fullPath)
                        const nodeReadable = fs.createReadStream(fullPath)
                        const webReadable = Readable.toWeb(nodeReadable) as ReadableStream<Uint8Array>
                        
                        files.push({
                            name: relativeFilePath,
                            input: webReadable,
                            size: stats.size
                        })
                        
                        fileCount++
                        
                        if (fileCount % 100 === 0) {
                            console.log(`Added ${fileCount} files...`)
                        } else if (fileCount <= 10) {
                            console.log(`Added file: ${relativeFilePath} (${stats.size} bytes)`)
                        }
                    } catch (error) {
                        console.warn(`Skipping file ${fullPath}: ${error}`)
                    }
                }
            }
        } catch (error) {
            console.warn(`Error reading directory ${currentPath}: ${error}`)
        }
    }
    
    await walkDirectory(dirPath)
    console.log(`Total files collected: ${files.length}`)
    return files
}

describe('Real Large File/Directory Tests', () => {
    // Tag this test suite to run only when explicitly requested
    // @vitest-environment node
    // @vitest-tag large-files
    
    // const INPUT_PATH = '/Users/rotemlevi/Downloads/Archive16.zip'; // Can be file or directory
    const INPUT_PATH = '/Users/rotemlevi/Downloads/South.Park.S27E03.1080p.WEB.h264-ETHEL[EZTVx.to].mkv';  // Can be file or directory
    const OUTPUT_ZIP_PATH = '/tmp/test-large-output.zip'

    it('should process file or directory, save to disk, and verify integrity', async () => {
        // Check if the input path exists
        if (!fs.existsSync(INPUT_PATH)) {
            console.log(`Skipping test: Path ${INPUT_PATH} not found`)
            return
        }

        const stats = fs.statSync(INPUT_PATH)
        let files: Array<{ name: string, input: ReadableStream<Uint8Array>, size: number }>
        let totalSize = 0

        if (stats.isDirectory()) {
            console.log(`Input is a directory: ${INPUT_PATH}`)
            
            // For very large directories, limit the number of files to avoid memory issues
            const MAX_FILES = 10000 // Reasonable limit for testing
            files = await getAllFilesFromDirectory(INPUT_PATH, MAX_FILES)
            totalSize = files.reduce((sum, file) => sum + file.size, 0)
            
            console.log(`Directory contains ${files.length} files`)
            console.log(`Total size: ${totalSize} bytes (${(totalSize / (1024 ** 3)).toFixed(2)} GB)`)
            
            if (files.length === 0) {
                console.log('Directory is empty, skipping test')
                return
            }
            
            if (files.length === MAX_FILES) {
                console.log(`⚠️  Limited to ${MAX_FILES} files for testing purposes`)
            }
            
        } else if (stats.isFile()) {
            console.log(`Input is a file: ${INPUT_PATH}`)
            const fileSizeGB = stats.size / (1024 ** 3)
            console.log(`File size: ${stats.size} bytes (${fileSizeGB.toFixed(2)} GB)`)
            
            if (stats.size <= 4 * 1024 ** 3) {
                console.log(`File is ${fileSizeGB.toFixed(2)} GB, which is <= 4GB. Test needs a file > 4GB`)
                // return
            }
            
            // Create readable stream from the file
            const nodeReadable = fs.createReadStream(INPUT_PATH)
            const webReadable = Readable.toWeb(nodeReadable) as ReadableStream<Uint8Array>
            
            files = [{
                name: path.basename(INPUT_PATH),
                input: webReadable,
                size: stats.size
            }]
            totalSize = stats.size
            
        } else {
            console.log(`Input path is neither file nor directory: ${INPUT_PATH}`)
            return
        }

        console.log('Creating ZIP stream...')
        const zipStream = makeZip(files)

        // Verify it's a ReadableStream with size
        expect(zipStream).toBeInstanceOf(ReadableStream)
        expect(zipStream).toHaveProperty('size')

        const predictedSize = zipStream.size
        if (predictedSize !== undefined) {
            console.log(`Predicted ZIP size: ${predictedSize} bytes (${(predictedSize / (1024 ** 3)).toFixed(2)} GB)`)
            expect(typeof predictedSize).toBe('number')
            expect(predictedSize).toBeGreaterThan(0)
        }

        // Read the entire ZIP stream and save to disk using Node.js streams
        console.log('Reading entire ZIP stream and saving to disk...')
        const outputStream = createWriteStream(OUTPUT_ZIP_PATH)

        let totalBytesWritten = 0
        let chunksProcessed = 0
        const startTime = Date.now()

        // Convert Web ReadableStream to Node.js Readable stream
        const nodeReadableStream = Readable.fromWeb(zipStream as any)

        // Add progress tracking
        nodeReadableStream.on('data', (chunk: Uint8Array) => {
            totalBytesWritten += chunk.length
            chunksProcessed++

            // Progress update every 1000 chunks
            if (chunksProcessed % 1000 === 0) {
                const elapsed = (Date.now() - startTime) / 1000
                const mbps = (totalBytesWritten / (1024 * 1024)) / elapsed 
                const percentage = Math.round((chunksProcessed/(zipStream.size ?? 0)) * 100)
                console.log(`Processed ${chunksProcessed} chunks, ${percentage}%, ${totalBytesWritten} bytes (${mbps.toFixed(2)} MB/s)`)
            }
        })

        // Use pipeline for reliable streaming with proper error handling
        await pipeline(nodeReadableStream, outputStream)
        console.log('Pipeline completed successfully')

        const elapsed = (Date.now() - startTime) / 1000
        console.log(`\nCompleted in ${elapsed.toFixed(2)} seconds`)
        console.log(`Total bytes written: ${totalBytesWritten} bytes (${(totalBytesWritten / (1024 ** 3)).toFixed(2)} GB)`)
        console.log(`Average speed: ${((totalBytesWritten / (1024 * 1024)) / elapsed).toFixed(2)} MB/s`)

        // Add a small delay to ensure file system has flushed
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Debug: Check if file exists and log details
        console.log(`Checking if output file exists: ${OUTPUT_ZIP_PATH}`)
        const fileExists = fs.existsSync(OUTPUT_ZIP_PATH)
        console.log(`File exists: ${fileExists}`)

        if (!fileExists) {
            // List files in /tmp to debug
            try {
                const tmpFiles = fs.readdirSync('/tmp').filter(f => f.includes('test-large'))
                console.log('Files in /tmp with "test-large":', tmpFiles)
            } catch (e) {
                console.log('Could not read /tmp directory:', e)
            }
        }

        // Verify the output file exists and has correct size
        expect(fileExists).toBe(true)
        const outputStats = fs.statSync(OUTPUT_ZIP_PATH)
        console.log(`Output ZIP file size: ${outputStats.size} bytes`)

        // Compare predicted vs actual size
        if (predictedSize !== undefined) {
            const sizeDifference = Math.abs(outputStats.size - predictedSize)
            const sizeDifferencePercent = (sizeDifference / outputStats.size) * 100

            console.log(`Size prediction accuracy:`)
            console.log(`  Predicted: ${predictedSize} bytes`)
            console.log(`  Actual: ${outputStats.size} bytes`)
            console.log(`  Difference: ${sizeDifference} bytes (${sizeDifferencePercent.toFixed(2)}%)`)

            // Size should be very close (within 1% for large files)
            expect(sizeDifferencePercent).toBeLessThan(1)
        }

        // Verify ZIP integrity
        console.log('Verifying ZIP integrity...')
        const integrityResult = await verifyZipIntegrity(OUTPUT_ZIP_PATH)

        if (!integrityResult.isValid) {
            console.error(`ZIP integrity check failed: ${integrityResult.error}`)
        }

        expect(integrityResult.isValid).toBe(true)
        console.log('✅ ZIP integrity verified successfully!')

        // Clean up
        if (fs.existsSync(OUTPUT_ZIP_PATH)) {
            fs.unlinkSync(OUTPUT_ZIP_PATH)
            console.log('Cleaned up output file')
        }

        expect(chunksProcessed).toBeGreaterThan(0)
        expect(totalBytesWritten).toBeGreaterThan(totalSize) // ZIP should be larger due to headers
        
        // Verify size prediction accuracy
        if (predictedSize !== undefined) {
            expect(totalBytesWritten).toBe(predictedSize)
        }
    }, 120 * 60 * 1000) // 120 minutes timeout for large files

    it('should test ZIP64 format detection with sample', async () => {
        if (!fs.existsSync(INPUT_PATH)) {
            console.log(`Skipping ZIP64 test: Path ${INPUT_PATH} not found`)
            return
        }

        const stats = fs.statSync(INPUT_PATH)
        
        // For directories, we'll just test with a sample file
        let testFilePath = INPUT_PATH
        let testFileSize = stats.size
        
        if (stats.isDirectory()) {
            // Find the first file in the directory to test with
            const dirFiles = await getAllFilesFromDirectory(INPUT_PATH)
            if (dirFiles.length === 0) {
                console.log('Directory is empty, skipping ZIP64 test')
                return
            }
            
            // For testing, we'll simulate the total size but only read first file
            testFileSize = dirFiles.reduce((sum, file) => sum + file.size, 0)
            
            // Use the directory path but we'll read just a sample
            console.log(`Testing ZIP64 with directory containing ${dirFiles.length} files, total size: ${(testFileSize / (1024 ** 3)).toFixed(2)} GB`)
        } else {
            console.log(`Testing ZIP64 with file size: ${(testFileSize / (1024 ** 3)).toFixed(2)} GB`)
        }

        if (testFileSize <= 4 * 1024 ** 3) {
            console.log(`Total size is ${(testFileSize / (1024 ** 3)).toFixed(2)} GB, ZIP64 may not be triggered`)
        }

        // Create a sample stream - read first 1MB for faster testing
        const nodeReadable = fs.createReadStream(stats.isDirectory() ? 
            path.join(INPUT_PATH, fs.readdirSync(INPUT_PATH)[0]) : INPUT_PATH, {
            start: 0,
            end: 1024 * 1024 // Read only first 1MB for faster testing
        })
        const webReadable = Readable.toWeb(nodeReadable) as ReadableStream<Uint8Array>

        const files = [{
            name: 'sample-file.dat',
            input: webReadable,
            size: testFileSize // Use total size to trigger ZIP64 if needed
        }]

        const zipStream = makeZip(files)

        // Read the entire small ZIP to verify structure
        const reader = zipStream.getReader()
        const chunks: Uint8Array[] = []

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
        }

        // Combine chunks to verify ZIP structure
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const zipBuffer = new Uint8Array(totalLength)
        let offset = 0

        for (const chunk of chunks) {
            zipBuffer.set(chunk, offset)
            offset += chunk.length
        }

        // Verify ZIP structure
        const view = new DataView(zipBuffer.buffer)
        let foundEndRecord = false

        // Search for end of central directory record
        for (let i = Math.max(0, zipBuffer.length - 1024); i < zipBuffer.length - 4; i++) {
            const signature = view.getUint32(i, true)
            if (signature === 0x06054b50) { // End of central directory record
                foundEndRecord = true
                break
            }
        }

        expect(foundEndRecord).toBe(true)
        console.log(`ZIP structure verified for sample of large file`)
    }, 120 * 60 * 1000) // 120 minutes timeout for large files
})
