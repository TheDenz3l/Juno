import { ATSScore } from '@/types'
import { TrendingUp, AlertCircle, CheckCircle2, Highlighter } from 'lucide-react'

interface Props {
  score: ATSScore | null
  isCalculating?: boolean
  calculationStatus?: string
  onToggleHighlighting?: () => void
  isHighlightingEnabled?: boolean
}

export function ATSScoreDisplay({ score, isCalculating, calculationStatus, onToggleHighlighting, isHighlightingEnabled }: Props) {
  if (isCalculating) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">ATS Match Score</h2>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          {calculationStatus && (
            <p className="text-sm text-gray-600 animate-pulse">{calculationStatus}</p>
          )}
        </div>
      </div>
    )
  }

  if (!score) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">ATS Match Score</h2>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            Upload a resume and navigate to a job posting to get your match score
          </p>
        </div>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-600'
    if (score >= 60) return 'text-warning-600'
    return 'text-error-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-success-100'
    if (score >= 60) return 'bg-warning-100'
    return 'bg-error-100'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent Match'
    if (score >= 60) return 'Good Match'
    if (score >= 40) return 'Fair Match'
    return 'Needs Improvement'
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">ATS Match Score</h2>
        {onToggleHighlighting && (
          <button
            onClick={onToggleHighlighting}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isHighlightingEnabled
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={isHighlightingEnabled ? 'Hide keyword highlights' : 'Show keyword highlights on page'}
          >
            <Highlighter className="w-4 h-4" />
            {isHighlightingEnabled ? 'Hide' : 'Show'} Highlights
          </button>
        )}
      </div>

      {/* Score Circle */}
      <div className="flex items-center justify-center mb-6">
        <div className={`relative w-32 h-32 rounded-full ${getScoreBgColor(score.score)} flex items-center justify-center`}>
          <div className="text-center">
            <div className={`text-4xl font-bold ${getScoreColor(score.score)}`}>
              {score.score}
            </div>
            <div className="text-xs text-gray-600 mt-1">out of 100</div>
          </div>
        </div>
      </div>

      {/* Score Label */}
      <div className="text-center mb-6">
        <p className={`text-lg font-semibold ${getScoreColor(score.score)}`}>
          {getScoreLabel(score.score)}
        </p>
      </div>

      {/* Matched Keywords */}
      {score.matchedKeywords.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-success-600" />
            <h3 className="text-sm font-semibold text-gray-700">
              Matched Keywords ({score.matchedKeywords.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {score.matchedKeywords.slice(0, 10).map((keyword, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-success-100 text-success-700 rounded text-xs"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing Keywords */}
      {score.missingKeywords.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-warning-600" />
            <h3 className="text-sm font-semibold text-gray-700">
              Missing Keywords ({score.missingKeywords.length})
            </h3>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Add these keywords to improve your match score:
          </p>
          <div className="flex flex-wrap gap-2">
            {score.missingKeywords.map((keyword, index) => (
              <button
                key={index}
                className="px-2 py-1 bg-warning-100 text-warning-700 rounded text-xs hover:bg-warning-200 transition-colors"
                title="Click to add to resume"
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Analysis */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detailed Analysis</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Hard Skills</span>
            <span className="text-sm font-medium">
              {score.analysis.hardSkills.matched.length} / {score.analysis.hardSkills.matched.length + score.analysis.hardSkills.missing.length}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Soft Skills</span>
            <span className="text-sm font-medium">
              {score.analysis.softSkills.matched.length} / {score.analysis.softSkills.matched.length + score.analysis.softSkills.missing.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
