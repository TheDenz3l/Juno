import { useEffect, useState } from 'react'
import { FileText, History, Settings, User } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { ResumeUpload } from '@/components/ResumeUpload'
import { ATSScoreDisplay } from '@/components/ATSScoreDisplay'
import { EditSuggestions } from '@/components/EditSuggestions'
import { generateEditSuggestions, applySuggestion, type EditSuggestion } from '@/lib/edit-suggestions'
import { calculateATSScore } from '@/lib/ats-matcher'
import { getCurrentUser, getProfile } from '@/lib/supabase'

function App() {
  const [activeTab, setActiveTab] = useState<'optimize' | 'history' | 'settings'>('optimize')
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([])

  const {
    user,
    setUser,
    resumes,
    activeResumeId,
    currentJob,
    atsScore,
    setATSScore,
    applications,
    loadResumes,
    loadApplications,
  } = useAppStore()

  // Load data on mount
  useEffect(() => {
    loadResumes()
    loadApplications()
    initializeAuth()
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
    const activeResume = resumes.find(r => r.id === activeResumeId)
    if (activeResume && currentJob) {
      const score = calculateATSScore(activeResume, currentJob)
      setATSScore(score)

      // Generate edit suggestions
      if (activeResume.sections.experience) {
        const expText = activeResume.sections.experience
          .map(exp => exp.description.join(' '))
          .join('\n')
        const suggestions = generateEditSuggestions(expText, 'experience')
        setEditSuggestions(suggestions)
      }
    }
  }, [activeResumeId, currentJob, resumes])

  const handleAcceptSuggestion = (suggestion: EditSuggestion) => {
    // Apply the suggestion to the resume
    console.log('Accepting suggestion:', suggestion.id)
    // TODO: Implement actual resume update logic
    setEditSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
  }

  const handleRejectSuggestion = (suggestion: EditSuggestion) => {
    console.log('Rejecting suggestion:', suggestion.id)
    setEditSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
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
        {activeTab === 'optimize' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <ResumeUpload />
            <ATSScoreDisplay score={atsScore} />
            {editSuggestions.length > 0 && (
              <EditSuggestions
                suggestions={editSuggestions}
                onAccept={handleAcceptSuggestion}
                onReject={handleRejectSuggestion}
              />
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
                {applications.map(app => (
                  <div key={app.id} className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{app.jobId}</h3>
                        {app.atsScore && (
                          <span className="text-sm text-gray-600">Score: {app.atsScore}/100</span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        app.status === 'offer' ? 'bg-success-100 text-success-700' :
                        app.status === 'interviewing' ? 'bg-blue-100 text-blue-700' :
                        app.status === 'rejected' ? 'bg-error-100 text-error-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Applied {new Date(app.appliedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
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
