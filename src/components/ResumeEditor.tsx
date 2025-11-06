import { useEffect, useState } from 'react'
import { Plus, Trash2, RotateCcw, Save } from 'lucide-react'
import type { Resume, ExperienceItem } from '@/types'
import { buildResumeContent, generateExperienceId } from '@/lib/resume-utils'

interface ResumeEditorProps {
  resume: Resume
  onSave: (updated: Resume) => Promise<void> | void
  isSaving?: boolean
}

interface ExperienceDraft extends ExperienceItem {
  description: string[]
}

const createExperienceDraft = (index: number): ExperienceDraft => ({
  id: generateExperienceId(index),
  company: '',
  position: '',
  startDate: '',
  endDate: '',
  description: [''],
})

export function ResumeEditor({ resume, onSave, isSaving }: ResumeEditorProps) {
  const [draft, setDraft] = useState<Resume>(resume)
  const [experiences, setExperiences] = useState<ExperienceDraft[]>(
    resume.sections.experience?.map((exp, index) => ({
      ...exp,
      description: exp.description ?? [''],
      id: exp.id || createExperienceDraft(index).id,
    })) ?? []
  )
  const [skillsInput, setSkillsInput] = useState(resume.sections.skills?.join(', ') ?? '')
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setDraft(resume)
    setExperiences(
      resume.sections.experience?.map((exp, index) => ({
        ...exp,
        description: exp.description ?? [''],
        id: exp.id || createExperienceDraft(index).id,
      })) ?? []
    )
    setSkillsInput(resume.sections.skills?.join(', ') ?? '')
    setIsDirty(false)
  }, [resume])

  const markDirty = () => setIsDirty(true)

  const handleSummaryChange = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        summary: value,
      },
    }))
    markDirty()
  }

  const handleEducationChange = (value: string) => {
    const entries = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const education = entries.map((entry, index) => ({
      id: `edu-${index}`,
      institution: entry,
      degree: '',
      field: '',
      startDate: '',
      endDate: '',
    }))

    setDraft((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        education: education.length > 0 ? education : undefined,
      },
    }))
    markDirty()
  }

  const handleSkillsChange = (value: string) => {
    setSkillsInput(value)
    const skills = value
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)

    setDraft((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        skills: skills.length > 0 ? skills : undefined,
      },
    }))
    markDirty()
  }

  const handleExperienceChange = (
    experienceId: string,
    field: keyof ExperienceItem,
    value: string
  ) => {
    setExperiences((prev) =>
      prev.map((exp) => (exp.id === experienceId ? { ...exp, [field]: value } : exp))
    )
    markDirty()
  }

  const handleExperienceDescriptionChange = (experienceId: string, value: string) => {
    const bullets = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    setExperiences((prev) =>
      prev.map((exp) => (exp.id === experienceId ? { ...exp, description: bullets } : exp))
    )
    markDirty()
  }

  const handleAddExperience = () => {
    setExperiences((prev) => [...prev, createExperienceDraft(prev.length)])
    markDirty()
  }

  const handleRemoveExperience = (experienceId: string) => {
    setExperiences((prev) => prev.filter((exp) => exp.id !== experienceId))
    markDirty()
  }

  const handleNameChange = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      name: value,
    }))
    markDirty()
  }

  const handleReset = () => {
    setDraft(resume)
    setExperiences(
      resume.sections.experience?.map((exp, index) => ({
        ...exp,
        description: exp.description ?? [''],
        id: exp.id || createExperienceDraft(index).id,
      })) ?? []
    )
    setSkillsInput(resume.sections.skills?.join(', ') ?? '')
    setIsDirty(false)
  }

  const handleSave = async () => {
    const normalizedExperiences = experiences
      .map<ExperienceItem>((exp, index) => ({
        ...exp,
        id: exp.id || createExperienceDraft(index).id,
        description: exp.description.filter(Boolean),
      }))
      .filter(
        (exp) => exp.position || exp.company || (exp.description && exp.description.length > 0)
      )

    const updated: Resume = {
      ...draft,
      sections: {
        ...draft.sections,
        experience: normalizedExperiences.length > 0 ? normalizedExperiences : undefined,
      },
      content: buildResumeContent({
        ...draft,
        sections: {
          ...draft.sections,
          experience: normalizedExperiences.length > 0 ? normalizedExperiences : undefined,
        },
      }),
      updatedAt: new Date(),
    }

    await onSave(updated)
    setIsDirty(false)
  }

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Edit Resume</h2>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            disabled={!isDirty}
            title="Revert to last saved version"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resume Name</label>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => handleNameChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="e.g., Product Manager Resume"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
          <textarea
            value={draft.sections.summary ?? ''}
            onChange={(event) => handleSummaryChange(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="Write a concise professional summary."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Experience</label>
            <button
              onClick={handleAddExperience}
              className="inline-flex items-center gap-1 rounded-lg border border-primary-200 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
            >
              <Plus className="h-4 w-4" />
              Add Role
            </button>
          </div>

          {experiences.length === 0 && (
            <p className="text-sm text-gray-500">No experience entries yet.</p>
          )}

          <div className="space-y-4">
            {experiences.map((experience, index) => (
              <div key={experience.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Role {index + 1}
                  </h3>
                  <button
                    onClick={() => handleRemoveExperience(experience.id)}
                    className="text-xs text-error-600 hover:text-error-700"
                    title="Remove this role"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Position
                    </label>
                    <input
                      type="text"
                      value={experience.position}
                      onChange={(event) =>
                        handleExperienceChange(experience.id, 'position', event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                      placeholder="e.g., Senior Product Manager"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      value={experience.company}
                      onChange={(event) =>
                        handleExperienceChange(experience.id, 'company', event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                      placeholder="Company name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="text"
                      value={experience.startDate}
                      onChange={(event) =>
                        handleExperienceChange(experience.id, 'startDate', event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                      placeholder="e.g., Jan 2021"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      End Date
                    </label>
                    <input
                      type="text"
                      value={experience.endDate}
                      onChange={(event) =>
                        handleExperienceChange(experience.id, 'endDate', event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                      placeholder="e.g., Present"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Achievements (one per line)
                  </label>
                  <textarea
                    value={experience.description.join('\n')}
                    onChange={(event) =>
                      handleExperienceDescriptionChange(experience.id, event.target.value)
                    }
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    placeholder="Start each bullet with an action verb and quantify the results."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Skills</label>
          <input
            type="text"
            value={skillsInput}
            onChange={(event) => handleSkillsChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="Comma-separated list, e.g., Product Strategy, SQL, A/B Testing"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
          <textarea
            value={
              draft.sections.education
                ?.map((edu) =>
                  [edu.institution, edu.degree, edu.field, edu.endDate].filter(Boolean).join(', ')
                )
                .join('\n') ?? ''
            }
            onChange={(event) => handleEducationChange(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="One entry per line, e.g., Stanford University — MS Computer Science — 2020"
          />
        </div>
      </div>
    </div>
  )
}
