import { useEffect, useMemo, useState } from 'react'
import { Check, X, Lightbulb, Loader2, Sparkles, RotateCcw } from 'lucide-react'
import { EditSuggestion } from '@/lib/edit-suggestions'

interface Props {
  suggestions: EditSuggestion[]
  onAccept: (suggestion: EditSuggestion) => void
  onReject: (suggestion: EditSuggestion) => void
  onApplySelected?: (suggestions: EditSuggestion[]) => void
  onGenerate?: () => void
  isGenerating?: boolean
  hasGenerated?: boolean
  onUndo?: () => void
  canUndo?: boolean
  applyingSuggestions?: Set<string>
}

interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

export function EditSuggestions({
  suggestions,
  onAccept,
  onReject,
  onApplySelected,
  onGenerate,
  isGenerating = false,
  hasGenerated = false,
  onUndo,
  canUndo = false,
  applyingSuggestions = new Set(),
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedIds(new Set())
    if (expandedId && !suggestions.some(s => s.id === expandedId)) {
      setExpandedId(null)
    }
  }, [suggestions, expandedId])

  const selectedSuggestions = useMemo(
    () => suggestions.filter(s => selectedIds.has(s.id)),
    [suggestions, selectedIds]
  )
  const hasBusySelected = selectedSuggestions.some(s => applyingSuggestions.has(s.id))

  const diffById = useMemo(() => {
    const map = new Map<string, DiffSegment[]>()
    suggestions.forEach(suggestion => {
      map.set(suggestion.id, computeDiffSegments(suggestion.original, suggestion.suggestion))
    })
    return map
  }, [suggestions])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleApplySelected = () => {
    if (hasBusySelected) return
    if (onApplySelected && selectedSuggestions.length > 0) {
      onApplySelected(selectedSuggestions)
    }
  }

  const renderDiff = (id: string, mode: 'original' | 'suggestion') => {
    const segments = diffById.get(id) ?? []
    const filtered = segments.filter(segment =>
      mode === 'original' ? segment.type !== 'added' : segment.type !== 'removed'
    )

    return filtered.map((segment, index) => {
      let className = 'text-gray-800'
      if (segment.type === 'added') {
        className = 'bg-success-100 text-success-700 font-medium px-1 rounded'
      } else if (segment.type === 'removed') {
        className = 'bg-error-100 text-error-700 line-through px-1 rounded'
      }

      return (
        <span key={`${segment.type}-${index}`} className={className}>
          {segment.text}
          {index < filtered.length - 1 ? ' ' : ''}
        </span>
      )
    })
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Rule-Based Suggestions</h2>
          <p className="text-sm text-gray-600">
            Local checks surface weak verbs, passive voice, formatting issues, and missing metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onUndo && canUndo && (
            <button
              onClick={onUndo}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              title="Undo the last applied suggestion"
            >
              <RotateCcw className="w-4 h-4" />
              Undo
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={!onGenerate || isGenerating}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isGenerating ? 'bg-primary-200 text-primary-700 cursor-wait' : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Improve
              </>
            )}
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">
          <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
          Checking resume content for quick wins…
        </div>
      )}

      {!isGenerating && !hasGenerated && (
        <div className="flex items-start gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
          <Lightbulb className="w-10 h-10 text-yellow-500 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-700 font-medium">Run the local rule engine.</p>
            <p className="text-sm text-gray-600">
              We analyze your summary, skills, and experience bullets without sending data to Grok until you apply AI upgrades.
            </p>
          </div>
        </div>
      )}

      {hasGenerated && !isGenerating && suggestions.length === 0 && (
        <div className="flex items-center gap-3 bg-success-50 border border-success-100 rounded-lg p-4">
          <Check className="w-5 h-5 text-success-600" />
          <span className="text-sm text-success-700">
            Nice! No rule-based fixes needed right now.
          </span>
        </div>
      )}

      {hasGenerated && suggestions.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-sm text-gray-600">
              Select individual fixes or batch apply several at once.
            </p>
            {onApplySelected && (
              <button
                onClick={handleApplySelected}
                disabled={selectedSuggestions.length === 0 || hasBusySelected}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedSuggestions.length === 0 || hasBusySelected
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                }`}
              >
                Apply Selected ({selectedSuggestions.length})
              </button>
            )}
          </div>

          <div className="space-y-3">
            {suggestions.map(suggestion => {
              const isExpanded = expandedId === suggestion.id
              const isSelected = selectedIds.has(suggestion.id)
              const isBusy = applyingSuggestions.has(suggestion.id)

              return (
                <div
                  key={suggestion.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(suggestion.id)}
                        disabled={isBusy}
                        className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${getTypeColor(suggestion.type)}`}>
                            {getTypeLabel(suggestion.type)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 capitalize">
                          Target section: {suggestion.section}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      {isExpanded ? 'Hide context' : 'View context'}
                    </button>
                  </div>

                  <div className="mb-2">
                    <p className="text-xs text-gray-600 mb-1">Original text</p>
                    <p className="text-sm bg-gray-50 p-2 rounded">
                      {renderDiff(suggestion.id, 'original')}
                    </p>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-gray-600 mb-1">Suggested update</p>
                    <p className="text-sm bg-green-50 p-2 rounded font-medium">
                      {renderDiff(suggestion.id, 'suggestion')}
                    </p>
                  </div>

                  {isExpanded && (
                    <div className="mb-3 p-3 bg-blue-50 rounded">
                      <p className="text-xs font-semibold text-blue-900 mb-1">Why this helps</p>
                      <p className="text-xs text-blue-800">{suggestion.rationale}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => onAccept(suggestion)}
                      disabled={isBusy}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                        isBusy
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      {isBusy ? 'Applying…' : 'Accept'}
                    </button>
                    <button
                      onClick={() => onReject(suggestion)}
                      disabled={isBusy}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                        isBusy
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function getTypeLabel(type: EditSuggestion['type']) {
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

function getTypeColor(type: EditSuggestion['type']) {
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

function computeDiffSegments(original: string, suggestion: string): DiffSegment[] {
  const source = original.split(/\s+/).filter(Boolean)
  const target = suggestion.split(/\s+/).filter(Boolean)
  const m = source.length
  const n = target.length

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (source[i - 1] === target[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const segments: { type: DiffSegment['type']; words: string[] }[] = []

  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (source[i - 1] === target[j - 1]) {
      pushSegment(segments, 'unchanged', source[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      pushSegment(segments, 'removed', source[i - 1])
      i--
    } else {
      pushSegment(segments, 'added', target[j - 1])
      j--
    }
  }

  while (i > 0) {
    pushSegment(segments, 'removed', source[i - 1])
    i--
  }

  while (j > 0) {
    pushSegment(segments, 'added', target[j - 1])
    j--
  }

  segments.reverse()
  segments.forEach(segment => segment.words.reverse())

  return segments.map(segment => ({
    type: segment.type,
    text: segment.words.join(' '),
  }))
}

function pushSegment(
  segments: { type: DiffSegment['type']; words: string[] }[],
  type: DiffSegment['type'],
  word: string
) {
  const last = segments[segments.length - 1]
  if (last && last.type === type) {
    last.words.push(word)
  } else {
    segments.push({ type, words: [word] })
  }
}
