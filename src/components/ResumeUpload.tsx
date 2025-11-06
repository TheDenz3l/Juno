import { useCallback, useMemo, useState } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle, List, Plus, X } from 'lucide-react'
import { parseResumeFile } from '@/lib/parsers'
import { useAppStore } from '@/stores/app-store'
import { ResumeEditor } from './ResumeEditor'
import type { Resume } from '@/types'
import { buildResumeContent, generateExperienceId, generateResumeId } from '@/lib/resume-utils'

interface ManualExperienceDraft {
  id: string
  position: string
  company: string
  startDate: string
  endDate: string
  achievements: string
}

const createManualExperienceDraft = (index: number): ManualExperienceDraft => ({
  id: generateExperienceId(index),
  position: '',
  company: '',
  startDate: '',
  endDate: '',
  achievements: '',
})

const initialManualDraft = {
  name: '',
  summary: '',
  skills: '',
  education: '',
  email: '',
  phone: '',
  linkedin: '',
}

export function ResumeUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [isSavingResume, setIsSavingResume] = useState(false)

  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false)
  const [manualDraft, setManualDraft] = useState(initialManualDraft)
  const [manualExperiences, setManualExperiences] = useState<ManualExperienceDraft[]>([
    createManualExperienceDraft(0),
  ])
  const [manualError, setManualError] = useState<string | null>(null)
  const [isSavingManual, setIsSavingManual] = useState(false)

  const addResume = useAppStore((state) => state.addResume)
  const deleteResume = useAppStore((state) => state.deleteResume)
  const updateResume = useAppStore((state) => state.updateResume)
  const setActiveResume = useAppStore((state) => state.setActiveResume)
  const resumes = useAppStore((state) => state.resumes)
  const activeResumeId = useAppStore((state) => state.activeResumeId)

  const activeResume = resumes.find((resume) => resume.id === activeResumeId)
  const sortedResumes = useMemo(
    () =>
      [...resumes].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [resumes]
  )

  const resetManualForm = () => {
    setManualDraft(initialManualDraft)
    setManualExperiences([createManualExperienceDraft(0)])
    setManualError(null)
  }

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null)
      setUploadSuccess(false)
      setIsUploading(true)

      try {
        const validTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]
        const validExtensions = ['.pdf', '.docx']
        const isValidType = validTypes.includes(file.type)
        const isValidExtension = validExtensions.some((ext) =>
          file.name.toLowerCase().endsWith(ext)
        )

        if (!isValidType && !isValidExtension) {
          throw new Error('Please upload a PDF or DOCX file')
        }

        const maxSize = 10 * 1024 * 1024
        if (file.size > maxSize) {
          throw new Error('File size must be less than 10MB')
        }

        const resume = await parseResumeFile(file)
        await addResume(resume)

        setUploadSuccess(true)
        setTimeout(() => setUploadSuccess(false), 2500)
      } catch (error) {
        console.error('Upload error:', error)
        const message = (error as Error).message
        setUploadError(message)
        setManualError(message)
        setManualDraft((draft) => ({
          ...draft,
          name: draft.name || file.name.replace(/\.(pdf|docx)$/i, ''),
        }))
        setIsManualEntryOpen(true)
      } finally {
        setIsUploading(false)
      }
    },
    [addResume]
  )

  const handleDelete = useCallback(
    async (resumeId: string) => {
      if (confirm('Are you sure you want to delete this resume?')) {
        await deleteResume(resumeId)
      }
    },
    [deleteResume]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragging(false)
      const files = Array.from(event.dataTransfer.files)
      if (files.length > 0) {
        handleFile(files[0])
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (files && files.length > 0) {
        handleFile(files[0])
      }
    },
    [handleFile]
  )

  const handleSelectResume = (resume: Resume) => {
    setActiveResume(resume.id)
  }

  const handleSaveResume = async (updated: Resume) => {
    setIsSavingResume(true)
    try {
      await updateResume(updated)
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 2500)
    } catch (error) {
      console.error('Failed to save resume:', error)
      setUploadError((error as Error).message)
    } finally {
      setIsSavingResume(false)
    }
  }

  const handleManualDraftChange = (field: keyof typeof manualDraft, value: string) => {
    setManualDraft((prev) => ({ ...prev, [field]: value }))
  }

  const handleManualExperienceChange = (
    experienceId: string,
    field: keyof ManualExperienceDraft,
    value: string
  ) => {
    setManualExperiences((prev) =>
      prev.map((exp) => (exp.id === experienceId ? { ...exp, [field]: value } : exp))
    )
  }

  const handleAddManualExperience = () => {
    setManualExperiences((prev) => [...prev, createManualExperienceDraft(prev.length)])
  }

  const handleRemoveManualExperience = (experienceId: string) => {
    setManualExperiences((prev) => prev.filter((exp) => exp.id !== experienceId))
  }

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setManualError(null)

    if (!manualDraft.name.trim()) {
      setManualError('Please provide a name for this resume.')
      return
    }

    const skills = manualDraft.skills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)

    const experience = manualExperiences
      .map((exp, index) => ({
        id: exp.id || generateExperienceId(index),
        company: exp.company.trim(),
        position: exp.position.trim(),
        startDate: exp.startDate.trim(),
        endDate: exp.endDate.trim(),
        description: exp.achievements
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      }))
      .filter(
        (exp) =>
          exp.position ||
          exp.company ||
          (exp.description && exp.description.length > 0)
      )

    if (experience.length === 0 && !manualDraft.summary.trim()) {
      setManualError('Enter at least a summary or one experience entry.')
      return
    }

    const educationEntries = manualDraft.education
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((entry, index) => ({
        id: `edu-${index}`,
        institution: entry,
        degree: '',
        field: '',
        startDate: '',
        endDate: '',
      }))

    const now = new Date()
    const resume: Resume = {
      id: generateResumeId('manual'),
      name: manualDraft.name.trim(),
      content: '',
      sections: {
        contact:
          manualDraft.email ||
          manualDraft.phone ||
          manualDraft.linkedin
            ? {
                name: manualDraft.name.trim(),
                email: manualDraft.email.trim() || '',
                phone: manualDraft.phone.trim() || undefined,
                linkedin: manualDraft.linkedin.trim() || undefined,
              }
            : undefined,
        summary: manualDraft.summary.trim() || undefined,
        experience: experience.length > 0 ? experience : undefined,
        skills: skills.length > 0 ? skills : undefined,
        education: educationEntries.length > 0 ? educationEntries : undefined,
      },
      createdAt: now,
      updatedAt: now,
    }

    resume.content = buildResumeContent(resume)

    setIsSavingManual(true)
    try {
      await addResume(resume)
      setIsManualEntryOpen(false)
      resetManualForm()
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 2500)
    } catch (error) {
      console.error('Failed to save manual resume:', error)
      setManualError((error as Error).message)
    } finally {
      setIsSavingManual(false)
    }
  }

  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-semibold">Upload Resume</h2>

      {uploadSuccess && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 p-3">
          <CheckCircle className="h-5 w-5 text-success-600" />
          <p className="text-sm font-medium text-success-800">Resume saved locally.</p>
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
        } ${
          isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:border-primary-400'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileInput}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-3">
          {isUploading ? (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
              <p className="text-gray-600">Parsing resume…</p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400" />
              <div>
                <p className="font-medium text-gray-700">Drag & drop your resume here</p>
                <p className="mt-1 text-sm text-gray-500">or click to browse</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FileText className="h-4 w-4" />
          <span>Supports PDF and DOCX (max 10MB)</span>
        </div>
        <button
          onClick={() => {
            resetManualForm()
            setIsManualEntryOpen(true)
          }}
          className="text-xs font-medium text-primary-700 hover:text-primary-800"
        >
          Enter details manually
        </button>
      </div>

      {uploadError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-error-600" />
          <div>
            <p className="text-sm font-medium text-error-800">Upload failed</p>
            <p className="mt-1 text-sm text-error-600">{uploadError}</p>
          </div>
        </div>
      )}

      {isManualEntryOpen && (
        <div className="mt-6 rounded-lg border border-primary-200 bg-primary-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary-900">Manual Resume Entry</h3>
            <button
              onClick={() => {
                setIsManualEntryOpen(false)
                resetManualForm()
              }}
              className="text-xs text-primary-700 hover:text-primary-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {manualError && (
            <div className="mb-3 rounded-md border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700">
              {manualError}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleManualSubmit}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-800">
                  Resume Name
                </label>
                <input
                  type="text"
                  value={manualDraft.name}
                  onChange={(event) => handleManualDraftChange('name', event.target.value)}
                  className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-800">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={manualDraft.email}
                  onChange={(event) => handleManualDraftChange('email', event.target.value)}
                  className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-800">
                  Phone (optional)
                </label>
                <input
                  type="text"
                  value={manualDraft.phone}
                  onChange={(event) => handleManualDraftChange('phone', event.target.value)}
                  className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-800">
                  LinkedIn (optional)
                </label>
                <input
                  type="text"
                  value={manualDraft.linkedin}
                  onChange={(event) => handleManualDraftChange('linkedin', event.target.value)}
                  className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  placeholder="linkedin.com/in/yourname"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-primary-800">
                Professional Summary
              </label>
              <textarea
                value={manualDraft.summary}
                onChange={(event) => handleManualDraftChange('summary', event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Highlight your top achievements and strengths."
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold text-primary-800">Experience</label>
                <button
                  type="button"
                  onClick={handleAddManualExperience}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary-300 px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
                >
                  <Plus className="h-4 w-4" />
                  Add Role
                </button>
              </div>

              <div className="space-y-3">
                {manualExperiences.map((experience, index) => (
                  <div key={experience.id} className="rounded-lg border border-primary-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary-800">
                        Role {index + 1}
                      </span>
                      {manualExperiences.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveManualExperience(experience.id)}
                          className="text-xs text-error-600 hover:text-error-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-primary-700">
                          Position
                        </label>
                        <input
                          type="text"
                          value={experience.position}
                          onChange={(event) =>
                            handleManualExperienceChange(
                              experience.id,
                              'position',
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-primary-700">
                          Company
                        </label>
                        <input
                          type="text"
                          value={experience.company}
                          onChange={(event) =>
                            handleManualExperienceChange(
                              experience.id,
                              'company',
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                        />
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-primary-700">
                          Start Date
                        </label>
                        <input
                          type="text"
                          value={experience.startDate}
                          onChange={(event) =>
                            handleManualExperienceChange(
                              experience.id,
                              'startDate',
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                          placeholder="e.g., Jan 2022"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-primary-700">
                          End Date
                        </label>
                        <input
                          type="text"
                          value={experience.endDate}
                          onChange={(event) =>
                            handleManualExperienceChange(
                              experience.id,
                              'endDate',
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                          placeholder="e.g., Present"
                        />
                      </div>
                    </div>

                    <div className="mt-2">
                      <label className="mb-1 block text-[11px] font-medium text-primary-700">
                        Achievements (one per line)
                      </label>
                      <textarea
                        value={experience.achievements}
                        onChange={(event) =>
                          handleManualExperienceChange(
                            experience.id,
                            'achievements',
                            event.target.value
                          )
                        }
                        rows={3}
                        className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                        placeholder="Quantify results where possible."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-primary-800">
                Skills (comma-separated)
              </label>
              <input
                type="text"
                value={manualDraft.skills}
                onChange={(event) => handleManualDraftChange('skills', event.target.value)}
                className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Product Strategy, SQL, A/B Testing"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-primary-800">
                Education (one entry per line)
              </label>
              <textarea
                value={manualDraft.education}
                onChange={(event) => handleManualDraftChange('education', event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-primary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Stanford University — MS Computer Science — 2020"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsManualEntryOpen(false)
                  resetManualForm()
                }}
                className="rounded-lg border border-primary-300 px-3 py-2 text-sm text-primary-700 hover:bg-primary-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingManual}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSavingManual ? 'Saving…' : 'Save Resume'}
              </button>
            </div>
          </form>
        </div>
      )}

      {sortedResumes.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <List className="h-4 w-4" />
            Saved Resumes ({sortedResumes.length})
          </div>

          <div className="space-y-2">
            {sortedResumes.map((resume) => {
              const isActive = resume.id === activeResumeId
              return (
                <div
                  key={resume.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                    isActive
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-primary-200'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{resume.name}</p>
                    <p className="text-xs text-gray-500">
                      Updated {new Date(resume.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSelectResume(resume)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {isActive ? 'Active' : 'Use'}
                    </button>
                    <button
                      onClick={() => handleDelete(resume.id)}
                      className="rounded-md border border-error-200 px-3 py-1 text-xs text-error-600 hover:bg-error-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeResume && (
        <ResumeEditor resume={activeResume} onSave={handleSaveResume} isSaving={isSavingResume} />
      )}

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs text-blue-800">
          <span className="font-semibold">Privacy:</span> Your resume is processed locally on your
          device. No data is sent to any server in Free mode.
        </p>
      </div>
    </div>
  )
}
