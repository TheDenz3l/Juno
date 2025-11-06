import { useEffect, useState } from 'react'
import { FileText, History, Settings, User, CheckCircle } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { ResumeUpload } from '@/components/ResumeUpload'
import { ATSScoreDisplay } from '@/components/ATSScoreDisplay'
import { EditSuggestions } from '@/components/EditSuggestions'
import { generateEditSuggestions, type EditSuggestion } from '@/lib/edit-suggestions'
import { calculateATSScore } from '@/lib/ats-matcher'
import { getCurrentUser, getProfile, getAuthToken } from '@/lib/supabase'
import { applyEditSuggestion, applyMultipleEditSuggestions } from '@/lib/resume-updater'
import { buildResumeContent } from '@/lib/resume-utils'
import { saveJobPosting, getAllJobPostings, getJobPosting } from '@/lib/db'
import type { Application, JobPosting, Resume } from '@/types'

function App() {
  const [activeTab, setActiveTab] = useState<'optimize' | 'history' | 'settings'>('optimize')
  const [optimizeSubTab, setOptimizeSubTab] = useState<'ats' | 'edit'>('ats')
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([])
  const [isTracked, setIsTracked] = useState(false)
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])

  // Loading states
  const [isTracking, setIsTracking] = useState(false)
  const [isCalculatingATS, setIsCalculatingATS] = useState(false)
  const [atsCalculationStatus, setATSCalculationStatus] = useState<string>('')
  const [applyingSuggestions, setApplyingSuggestions] = useState<Set<string>>(new Set())
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)
  const [hasGeneratedSuggestions, setHasGeneratedSuggestions] = useState(false)
  const [resumeHistory, setResumeHistory] = useState<Resume[]>([])

  // Keyword highlighting state
  const [isHighlightingEnabled, setIsHighlightingEnabled] = useState(false)

  const {
    user,
    setUser,
    resumes,
    activeResumeId,
    currentJob,
    setCurrentJob,
    atsScore,
    setATSScore,
    applications,
    loadResumes,
    loadApplications,
    updateResume,
    addApplication,
    error,
    setError,
  } = useAppStore()

  const activeResume = activeResumeId
    ? resumes.find(resume => resume.id === activeResumeId) || null
    : null

  // Load data on mount
  useEffect(() => {
    async function initialize() {
      try {
        await Promise.all([
          loadResumes(),
          loadApplications(),
          initializeAuth(),
          loadJobPostings()
        ])

        // Load current job and activeResumeId from chrome.storage after initialization
        chrome.storage.local.get(['currentJob', 'activeResumeId'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to load from storage:', chrome.runtime.lastError)
            return
          }
          if (result.currentJob) {
            setCurrentJob(result.currentJob)
          }
          if (result.activeResumeId) {
            // Verify resume still exists in IndexedDB before setting as active
            const resumeExists = useAppStore.getState().resumes.find(r => r.id === result.activeResumeId)
            if (resumeExists) {
              useAppStore.getState().setActiveResume(result.activeResumeId)
            }
          }
        })
      } catch (error) {
        console.error('Initialization failed:', error)
        setError((error as Error).message)
      }
    }

    initialize()
  }, [])

  async function loadJobPostings() {
    try {
      const jobs = await getAllJobPostings()
      setJobPostings(jobs)
    } catch (error) {
      console.error('Failed to load job postings:', error)
    }
  }

  const cloneResume = (resume: Resume): Resume => ({
    ...resume,
    sections: {
      ...resume.sections,
      contact: resume.sections.contact ? { ...resume.sections.contact } : undefined,
      experience: resume.sections.experience?.map(exp => ({
        ...exp,
        description: Array.isArray(exp.description) ? [...exp.description] : [],
      })),
      education: resume.sections.education?.map(edu => ({ ...edu })),
      skills: resume.sections.skills ? [...resume.sections.skills] : undefined,
    },
    createdAt: new Date(resume.createdAt),
    updatedAt: new Date(resume.updatedAt),
  })

  const pushResumeSnapshot = (resume: Resume) => {
    setResumeHistory(prev => {
      const next = [...prev.slice(-4), cloneResume(resume)]
      return next
    })
  }

  const normalizeNumberToken = (token: string) => token.replace(/[,\s]/g, '').toLowerCase()

  const validateSuggestionSafety = (suggestion: EditSuggestion): string | null => {
    const numberPattern = /\b\d+(?:[.,]\d+)?%?\b/g
    const originalNumbers = (suggestion.original.match(numberPattern) ?? []).map(normalizeNumberToken)
    const suggestionNumbers = (suggestion.suggestion.match(numberPattern) ?? []).map(normalizeNumberToken)

    const missingNumbers = originalNumbers.filter(num =>
      !suggestionNumbers.some(candidate => candidate === num)
    )
    if (missingNumbers.length > 0) {
      return `Suggestion would remove numeric detail (${missingNumbers.join(', ')}). Edit manually to keep metrics intact.`
    }

    const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
    const originalEmails = suggestion.original.match(emailPattern) ?? []
    const suggestionEmails = suggestion.suggestion.match(emailPattern) ?? []
    if (originalEmails.length > suggestionEmails.length) {
      return 'Suggestion would remove an email address. This change is blocked for safety.'
    }

    const phonePattern = /\b(?:\+?\d[\d\s().-]{6,}\d)\b/g
    const normalizePhone = (value: string) => value.replace(/\D/g, '')
    const originalPhones = (suggestion.original.match(phonePattern) ?? []).map(normalizePhone)
    const suggestionPhones = (suggestion.suggestion.match(phonePattern) ?? []).map(normalizePhone)
    const missingPhones = originalPhones.filter(phone =>
      phone.length >= 7 && !suggestionPhones.some(candidate => candidate === phone)
    )
    if (missingPhones.length > 0) {
      return 'Suggestion would remove a phone number. This change is blocked for safety.'
    }

    return null
  }

  // Auto-select resume if none active but resumes exist
  useEffect(() => {
    if (!activeResumeId && resumes.length > 0) {
      // Auto-select the most recently updated resume
      const mostRecent = [...resumes].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0]
      if (mostRecent) {
        console.log('Auto-selecting most recent resume:', mostRecent.name)
        useAppStore.getState().setActiveResume(mostRecent.id)
      }
    }
  }, [resumes, activeResumeId])

  // Listen for job data updates from background script
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local') {
        if (changes.currentJob) {
          const newJob = changes.currentJob.newValue
          if (newJob) {
            console.log('Job data updated in storage:', newJob)
            setCurrentJob(newJob)
          }
        }

        // Handle activeResumeId changes
        if (changes.activeResumeId) {
          const newActiveId = changes.activeResumeId.newValue
          if (newActiveId) {
            console.log('Active resume ID updated in storage:', newActiveId)
            useAppStore.getState().setActiveResume(newActiveId)
          }
        }
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  async function initializeAuth() {
    try {
      const authUser = await getCurrentUser()
      if (authUser) {
        const profile = await getProfile(authUser.id)
        setUser({
          id: profile.id,
          email: profile.email,
          plan: profile.plan,
          usage: {
            matchesThisMonth: 0,
            aiSuggestionsThisMonth: 0,
            resumeCount: resumes.length,
            aiCallsThisMonth: 0,
          },
          quotas: getQuotas(profile.plan),
        })
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error)
    }
  }

  function getQuotas(plan: string) {
    switch (plan) {
      case 'pro':
        return {
          maxMatches: 100,
          maxAISuggestions: 50,
          maxResumes: 5,
          maxAICalls: 50,
        }
      case 'premium':
        return {
          maxMatches: 300,
          maxAISuggestions: 200,
          maxResumes: 50,
          maxAICalls: 200,
        }
      default:
        return {
          maxMatches: 20,
          maxAISuggestions: 5,
          maxResumes: 1,
          maxAICalls: 0,
        }
    }
  }

  // Calculate ATS score when resume or job changes
  useEffect(() => {
    let cancelled = false

    async function calculate() {
      const activeResume = resumes.find(r => r.id === activeResumeId)
      if (activeResume && currentJob && !cancelled) {
        setIsCalculatingATS(true)
        setATSCalculationStatus('Analyzing job description...')
        try {
          // Get auth token for Grok API
          const authToken = await getAuthToken()

          // Calculate ATS score (now using Grok-powered extraction)
          const score = await calculateATSScore(activeResume, currentJob, authToken || undefined)

          if (!cancelled) {
            setATSScore(score)
            setATSCalculationStatus('')
          }
        } catch (error) {
          console.error('Failed to calculate ATS score:', error)
          if (!cancelled) {
            setATSCalculationStatus('Error: Using fallback keyword detection')
            // Clear error status after 5 seconds
            setTimeout(() => setATSCalculationStatus(''), 5000)
          }
        } finally {
          if (!cancelled) {
            setIsCalculatingATS(false)
          }
        }
      }
    }

    calculate()

    return () => {
      cancelled = true
    }
  }, [activeResumeId, currentJob, resumes])

  // Reset edit suggestions when switching resume or job context
  useEffect(() => {
    setHasGeneratedSuggestions(false)
    setEditSuggestions([])
  }, [activeResumeId, currentJob])

  // Check if current job is already tracked
  useEffect(() => {
    async function checkDuplicate() {
      if (currentJob) {
        // Check by job ID first
        const trackedById = applications.some(app => app.jobId === currentJob.id)
        if (trackedById) {
          setIsTracked(true)
          return
        }

        // Check by URL across all job postings
        const allJobs = await getAllJobPostings()
        const trackedByUrl = applications.some(app => {
          const job = allJobs.find(j => j.id === app.jobId)
          return job && job.url === currentJob.url
        })
        setIsTracked(trackedByUrl)
      } else {
        setIsTracked(false)
      }
    }

    checkDuplicate()
  }, [currentJob, applications])

  const handleTrackApplication = async () => {
    // Prevent concurrent calls
    if (isTracking) return
    setIsTracking(true)

    if (!currentJob || !activeResumeId) {
      setError('Cannot track application: missing job or resume')
      setIsTracking(false)
      return
    }

    try {
      // Save the job posting to the database first
      await saveJobPosting(currentJob)

      // Verify job was saved (transaction-like consistency)
      const savedJob = await getJobPosting(currentJob.id)
      if (!savedJob) {
        throw new Error('Failed to save job posting')
      }

      // Create application object
      const application: Application = {
        id: `app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        jobId: currentJob.id,
        resumeId: activeResumeId,
        status: 'applied',
        atsScore: atsScore?.score,
        appliedAt: new Date(),
      }

      // Save application
      await addApplication(application)

      // Reload job postings to include the new one
      await loadJobPostings()

      // Update tracked state
      setIsTracked(true)

      console.log('Application tracked successfully:', application)
    } catch (error) {
      console.error('Failed to track application:', error)
      setError((error as Error).message)
    } finally {
      setIsTracking(false)
    }
  }

  const handleInsertKeyword = async (keyword: string) => {
    const activeResume = resumes.find(r => r.id === activeResumeId)
    if (!activeResume) {
      setError('Select a resume to add keywords.')
      return
    }

    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) return

    const existingSkills = activeResume.sections.skills || []
    const alreadyPresent = existingSkills.some(skill => skill.toLowerCase() === trimmedKeyword.toLowerCase())
    if (alreadyPresent) {
      setATSCalculationStatus(`"${trimmedKeyword}" is already listed in Skills.`)
      setTimeout(() => setATSCalculationStatus(''), 2500)
      return
    }

    const snapshot = cloneResume(activeResume)
    const updatedResume: Resume = {
      ...activeResume,
      sections: {
        ...activeResume.sections,
        skills: [...existingSkills, trimmedKeyword],
      },
    }

    updatedResume.content = buildResumeContent(updatedResume)
    updatedResume.updatedAt = new Date()

    try {
      await updateResume(updatedResume)
      pushResumeSnapshot(snapshot)
      setATSCalculationStatus(`Added "${trimmedKeyword}" to Skills.`)
      setTimeout(() => setATSCalculationStatus(''), 2500)
    } catch (error) {
      console.error('Failed to insert keyword:', error)
      setError((error as Error).message)
    }
  }

  const handleGenerateSuggestions = () => {
    const activeResume = resumes.find(r => r.id === activeResumeId)
    if (!activeResume) {
      setError('Upload or select a resume before generating suggestions.')
      return
    }

    setIsGeneratingSuggestions(true)

    try {
      const suggestions: EditSuggestion[] = []

      if (typeof activeResume.sections.summary === 'string' && activeResume.sections.summary.trim()) {
        suggestions.push(...generateEditSuggestions(activeResume.sections.summary, 'summary'))
      }

      if (Array.isArray(activeResume.sections.experience) && activeResume.sections.experience.length > 0) {
        const expText = activeResume.sections.experience
          .map(exp =>
            Array.isArray(exp.description)
              ? exp.description.join('\n')
              : ''
          )
          .filter(Boolean)
          .join('\n')

        if (expText.trim()) {
          suggestions.push(...generateEditSuggestions(expText, 'experience'))
        }
      }

      const deduped: EditSuggestion[] = []
      const seen = new Set<string>()
      suggestions.forEach(suggestion => {
        const key = `${suggestion.section}-${suggestion.original}-${suggestion.suggestion}`
        if (!seen.has(key)) {
          seen.add(key)
          deduped.push(suggestion)
        }
      })

      setEditSuggestions(deduped)
      setHasGeneratedSuggestions(true)
    } catch (error) {
      console.error('Failed to generate suggestions:', error)
      setError((error as Error).message)
    } finally {
      setIsGeneratingSuggestions(false)
    }
  }

  const handleApplySelectedSuggestions = async (selected: EditSuggestion[]) => {
    if (selected.length === 0) return

    const activeResume = resumes.find(r => r.id === activeResumeId)
    if (!activeResume) {
      setError('No active resume found')
      return
    }

    const unsafe = selected
      .map(s => ({ suggestion: s, reason: validateSuggestionSafety(s) }))
      .find(result => result.reason !== null)

    if (unsafe?.reason) {
      setError(unsafe.reason)
      return
    }

    const snapshot = cloneResume(activeResume)

    setApplyingSuggestions(prev => {
      const next = new Set(prev)
      selected.forEach(s => next.add(s.id))
      return next
    })

    try {
      let updatedResume = applyMultipleEditSuggestions(activeResume, selected)
      updatedResume = {
        ...updatedResume,
        content: buildResumeContent(updatedResume),
        updatedAt: new Date(),
      }

      await updateResume(updatedResume)
      pushResumeSnapshot(snapshot)

      setEditSuggestions(prev =>
        prev.filter(suggestion => !selected.some(sel => sel.id === suggestion.id))
      )
    } catch (error) {
      console.error('Failed to apply suggestions:', error)
      setError((error as Error).message)
    } finally {
      setApplyingSuggestions(prev => {
        const next = new Set(prev)
        selected.forEach(s => next.delete(s.id))
        return next
      })
    }
  }

  const handleUndoLastChange = async () => {
    const lastSnapshot = resumeHistory[resumeHistory.length - 1]
    if (!lastSnapshot) return

    const undoResume: Resume = {
      ...cloneResume(lastSnapshot),
      updatedAt: new Date(),
    }

    try {
      await updateResume(undoResume)
      setResumeHistory(prev => prev.slice(0, -1))
      setATSCalculationStatus('Reverted last applied suggestion.')
      setTimeout(() => setATSCalculationStatus(''), 2500)
    } catch (error) {
      console.error('Failed to undo change:', error)
      setError((error as Error).message)
    }
  }

  const handleAcceptSuggestion = async (suggestion: EditSuggestion) => {
    // Prevent concurrent calls for same suggestion
    if (applyingSuggestions.has(suggestion.id)) return

    const safetyIssue = validateSuggestionSafety(suggestion)
    if (safetyIssue) {
      setError(safetyIssue)
      return
    }

    setApplyingSuggestions(prev => new Set(prev).add(suggestion.id))

    console.log('Accepting suggestion:', suggestion.id)

    // Find the active resume
    const activeResume = resumes.find(r => r.id === activeResumeId)
    if (!activeResume) {
      console.error('No active resume found')
      setError('No active resume found')
      setApplyingSuggestions(prev => {
        const next = new Set(prev)
        next.delete(suggestion.id)
        return next
      })
      return
    }

    try {
      const snapshot = cloneResume(activeResume)
      // Apply the suggestion to the resume
      const appliedResume = applyEditSuggestion(activeResume, suggestion)
      const updatedResume = {
        ...appliedResume,
        content: buildResumeContent(appliedResume),
        updatedAt: new Date(),
      }

      // Save the updated resume
      await updateResume(updatedResume)
      pushResumeSnapshot(snapshot)

      // Remove the suggestion from the list
      setEditSuggestions(prev => prev.filter(s => s.id !== suggestion.id))

      // ATS score will be recalculated by the useEffect

      console.log('Suggestion applied successfully')
    } catch (error) {
      console.error('Failed to apply suggestion:', error)
      setError((error as Error).message)
    } finally {
      setApplyingSuggestions(prev => {
        const next = new Set(prev)
        next.delete(suggestion.id)
        return next
      })
    }
  }

  const handleRejectSuggestion = (suggestion: EditSuggestion) => {
    console.log('Rejecting suggestion:', suggestion.id)
    setEditSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
  }

  const handleToggleHighlighting = async () => {
    const newEnabled = !isHighlightingEnabled

    try {
      // Send message to background script to toggle highlighting
      const response = await chrome.runtime.sendMessage({
        type: 'TOGGLE_KEYWORD_HIGHLIGHTING',
        data: {
          enabled: newEnabled,
          matchedKeywords: atsScore?.matchedKeywords || [],
          missedKeywords: atsScore?.missingKeywords || []
        }
      })

      if (response?.success) {
        setIsHighlightingEnabled(newEnabled)
        console.log('Highlighting toggled:', newEnabled)
      } else {
        console.error('Failed to toggle highlighting:', response?.error)
        setError(response?.error || 'Failed to toggle highlighting')
      }
    } catch (error) {
      console.error('Error toggling highlighting:', error)
      setError((error as Error).message)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary-600" />
            <h1 className="text-xl font-bold text-primary-600">Juno</h1>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded font-medium">
                  {user.plan.toUpperCase()}
                </span>
                <button className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {user.email}
                </button>
              </>
            ) : (
              <span className="text-xs px-2 py-1 bg-gray-100 rounded">Free</span>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 sticky top-12 z-10">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('optimize')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'optimize'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Optimize
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <History className="w-4 h-4" />
            History ({applications.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Error Display */}
        {error && (
          <div className="max-w-4xl mx-auto mb-4">
            <div className="bg-error-50 border border-error-200 rounded-lg p-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-error-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-error-800">Error</h3>
                  <p className="text-sm text-error-700 mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-error-400 hover:text-error-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'optimize' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-lg p-1 flex gap-1">
              <button
                onClick={() => setOptimizeSubTab('ats')}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  optimizeSubTab === 'ats'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ATS Insights
              </button>
              <button
                onClick={() => setOptimizeSubTab('edit')}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  optimizeSubTab === 'edit'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Edit Resume
              </button>
            </div>

            {optimizeSubTab === 'edit' && <ResumeUpload />}

            {optimizeSubTab === 'ats' && (
              <>
                {activeResume ? (
                  <div className="card flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Active Resume</p>
                      <p className="text-base font-semibold text-gray-900">{activeResume.name}</p>
                      {activeResume.sections.summary && (
                        <p className="text-sm text-gray-600 mt-1 max-w-xl">
                          {activeResume.sections.summary}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setOptimizeSubTab('edit')}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      Update resume →
                    </button>
                  </div>
                ) : (
                  <div className="card text-center">
                    <p className="text-gray-700 font-medium">No resume selected</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Add or choose a resume in the Edit Resume tab to unlock ATS scoring.
                    </p>
                    <button
                      onClick={() => setOptimizeSubTab('edit')}
                      className="mt-3 inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                    >
                      Go to Edit Resume
                    </button>
                  </div>
                )}

                <ATSScoreDisplay
                  score={atsScore}
                  isCalculating={isCalculatingATS}
                  calculationStatus={atsCalculationStatus}
                  onToggleHighlighting={handleToggleHighlighting}
                  isHighlightingEnabled={isHighlightingEnabled}
                  onInsertKeyword={handleInsertKeyword}
                />

                {currentJob && activeResumeId && (
                  <div className="card">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{currentJob.title}</h3>
                        {currentJob.company && (
                          <p className="text-sm text-gray-600">{currentJob.company}</p>
                        )}
                      </div>
                      <button
                        onClick={handleTrackApplication}
                        disabled={isTracked || isTracking}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                          isTracked || isTracking
                            ? 'bg-success-100 text-success-700 cursor-not-allowed'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {isTracked ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Tracked
                          </>
                        ) : isTracking ? (
                          'Tracking...'
                        ) : (
                          'Track Application'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <EditSuggestions
                  suggestions={editSuggestions}
                  onAccept={handleAcceptSuggestion}
                  onReject={handleRejectSuggestion}
                  onApplySelected={handleApplySelectedSuggestions}
                  onGenerate={handleGenerateSuggestions}
                  isGenerating={isGeneratingSuggestions}
                  hasGenerated={hasGeneratedSuggestions}
                  onUndo={resumeHistory.length > 0 ? handleUndoLastChange : undefined}
                  canUndo={resumeHistory.length > 0}
                  applyingSuggestions={applyingSuggestions}
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="card max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold mb-4">Application History</h2>
            {applications.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No applications tracked yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Applications will appear here when you use Juno on job postings
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map(app => {
                  const job = jobPostings.find(j => j.id === app.jobId)
                  return (
                    <div key={app.id} className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {job?.title || 'Unknown Position'}
                          </h3>
                          {job?.company && (
                            <p className="text-sm text-gray-600 mt-1">{job.company}</p>
                          )}
                          {app.atsScore && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-sm text-gray-600">ATS Score:</span>
                              <span className={`text-sm font-medium ${
                                app.atsScore >= 80 ? 'text-success-600' :
                                app.atsScore >= 60 ? 'text-warning-600' :
                                'text-error-600'
                              }`}>
                                {app.atsScore}/100
                              </span>
                            </div>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded capitalize ${
                          app.status === 'offer' ? 'bg-success-100 text-success-700' :
                          app.status === 'interviewing' ? 'bg-blue-100 text-blue-700' :
                          app.status === 'rejected' ? 'bg-error-100 text-error-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                          Applied {new Date(app.appliedAt).toLocaleDateString()}
                        </p>
                        {job?.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                          >
                            View Posting →
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="card max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Account</h3>
                {user ? (
                  <div className="text-sm text-gray-600">
                    <p>Email: {user.email}</p>
                    <p>Plan: {user.plan}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Not signed in (Local mode)</p>
                )}
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Privacy</h3>
                <p className="text-sm text-gray-600">
                  {user?.plan === 'free' || !user
                    ? 'All data is stored locally on your device. Nothing is sent to the cloud.'
                    : 'Your data is encrypted and synced across devices via Supabase.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
