import { useState } from 'react'

function App() {
  const [activeTab, setActiveTab] = useState<'optimize' | 'history' | 'settings'>('optimize')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-600">Juno</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-gray-100 rounded">Free</span>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('optimize')}
            className={`py-2 px-3 border-b-2 transition-colors ${
              activeTab === 'optimize'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Optimize
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-3 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-3 border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Settings
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4">
        {activeTab === 'optimize' && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Upload Resume</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-600">
                  Drag & drop your resume here or click to browse
                </p>
                <p className="text-sm text-gray-500 mt-2">Supports PDF and DOCX</p>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-2">ATS Match Score</h2>
              <p className="text-sm text-gray-600">
                Upload a resume and navigate to a job posting to get started
              </p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Application History</h2>
            <p className="text-gray-600">No applications tracked yet</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Settings</h2>
            <p className="text-gray-600">Settings coming soon</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
