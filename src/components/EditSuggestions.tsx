import { useState } from 'react'
import { Check, X, Lightbulb } from 'lucide-react'
import { EditSuggestion } from '@/lib/edit-suggestions'

interface Props {
  suggestions: EditSuggestion[]
  onAccept: (suggestion: EditSuggestion) => void
  onReject: (suggestion: EditSuggestion) => void
}

export function EditSuggestions({ suggestions, onAccept, onReject }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (suggestions.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Edit Suggestions</h2>
        <div className="text-center py-8">
          <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            No suggestions available. Your resume looks great!
          </p>
        </div>
      </div>
    )
  }

  const getTypeLabel = (type: EditSuggestion['type']) => {
    switch (type) {
      case 'action_verb':
        return 'Action Verb'
      case 'passive_voice':
        return 'Passive Voice'
      case 'formatting':
        return 'Formatting'
      case 'clarity':
        return 'Clarity'
      case 'quantification':
        return 'Quantification'
    }
  }

  const getTypeColor = (type: EditSuggestion['type']) => {
    switch (type) {
      case 'action_verb':
        return 'bg-blue-100 text-blue-700'
      case 'passive_voice':
        return 'bg-purple-100 text-purple-700'
      case 'formatting':
        return 'bg-green-100 text-green-700'
      case 'clarity':
        return 'bg-yellow-100 text-yellow-700'
      case 'quantification':
        return 'bg-orange-100 text-orange-700'
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">
        Edit Suggestions ({suggestions.length})
      </h2>

      <p className="text-sm text-gray-600 mb-4">
        Review and apply these improvements to strengthen your resume
      </p>

      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${getTypeColor(suggestion.type)}`}>
                  {getTypeLabel(suggestion.type)}
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round(suggestion.confidence * 100)}% confidence
                </span>
              </div>
              <button
                onClick={() => setExpandedId(expandedId === suggestion.id ? null : suggestion.id)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                {expandedId === suggestion.id ? 'Show less' : 'Show more'}
              </button>
            </div>

            {/* Original Text */}
            <div className="mb-2">
              <p className="text-xs text-gray-600 mb-1">Original:</p>
              <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded line-through">
                {suggestion.original}
              </p>
            </div>

            {/* Suggested Text */}
            <div className="mb-3">
              <p className="text-xs text-gray-600 mb-1">Suggested:</p>
              <p className="text-sm text-gray-800 bg-green-50 p-2 rounded font-medium">
                {suggestion.suggestion}
              </p>
            </div>

            {/* Rationale (expanded) */}
            {expandedId === suggestion.id && (
              <div className="mb-3 p-3 bg-blue-50 rounded">
                <p className="text-xs font-semibold text-blue-900 mb-1">Why this helps:</p>
                <p className="text-xs text-blue-800">{suggestion.rationale}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => onAccept(suggestion)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                <Check className="w-4 h-4" />
                Accept
              </button>
              <button
                onClick={() => onReject(suggestion)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          💡 <span className="font-semibold">Tip:</span> Accepting suggestions updates your resume automatically.
          You can always undo changes later.
        </p>
      </div>
    </div>
  )
}
