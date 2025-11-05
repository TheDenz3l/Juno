import { useState, useCallback } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle, Trash2 } from 'lucide-react'
import { parseResumeFile } from '@/lib/parsers'
import { useAppStore } from '@/stores/app-store'

export function ResumeUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const addResume = useAppStore(state => state.addResume)
  const deleteResume = useAppStore(state => state.deleteResume)
  const resumes = useAppStore(state => state.resumes)
  const activeResumeId = useAppStore(state => state.activeResumeId)

  const activeResume = resumes.find(r => r.id === activeResumeId)

  const handleFile = useCallback(async (file: File) => {
    setUploadError(null)
    setUploadSuccess(false)
    setIsUploading(true)

    try {
      // Validate file type
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
      const validExtensions = ['.pdf', '.docx']

      const isValidType = validTypes.includes(file.type)
      const isValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

      if (!isValidType && !isValidExtension) {
        throw new Error('Please upload a PDF or DOCX file')
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        throw new Error('File size must be less than 10MB')
      }

      // Parse the resume
      const resume = await parseResumeFile(file)

      // Save to store and IndexedDB
      await addResume(resume)

      console.log('Resume uploaded successfully:', resume.name)

      // Show success message
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError((error as Error).message)
    } finally {
      setIsUploading(false)
    }
  }, [addResume])

  const handleDelete = useCallback(async (resumeId: string) => {
    if (confirm('Are you sure you want to delete this resume?')) {
      await deleteResume(resumeId)
    }
  }, [deleteResume])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Upload Resume</h2>

      {/* Active Resume Display */}
      {activeResume && (
        <div className="mb-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <CheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary-900 truncate">
                  {activeResume.name}
                </p>
                <p className="text-xs text-primary-700 mt-1">
                  Uploaded {new Date(activeResume.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(activeResume.id)}
              className="p-1 text-primary-600 hover:text-error-600 hover:bg-error-50 rounded transition-colors"
              title="Delete resume"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {uploadSuccess && (
        <div className="mb-4 p-3 bg-success-50 border border-success-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0" />
          <p className="text-sm font-medium text-success-800">Resume uploaded successfully!</p>
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}
          ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary-400'}
        `}
      >
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-3">
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              <p className="text-gray-600">Parsing resume...</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400" />
              <div>
                <p className="text-gray-700 font-medium">
                  Drag & drop your resume here
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or click to browse
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <FileText className="w-4 h-4" />
                <span>Supports PDF and DOCX (max 10MB)</span>
              </div>
            </>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="mt-4 p-3 bg-error-50 border border-error-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-error-800">Upload failed</p>
            <p className="text-sm text-error-600 mt-1">{uploadError}</p>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <span className="font-semibold">Privacy:</span> Your resume is processed locally on your device.
          No data is sent to any server in Free mode.
        </p>
      </div>
    </div>
  )
}
