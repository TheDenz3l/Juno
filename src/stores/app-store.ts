import { create } from 'zustand'
import { Resume, Application, JobPosting, User, ATSScore } from '@/types'
import {
  getAllResumes,
  saveResume as saveResumeDB,
  deleteResume as deleteResumeDB,
  getAllApplications,
  saveApplication as saveApplicationDB,
  deleteApplication as deleteApplicationDB,
} from '@/lib/db'

interface AppState {
  // User state
  user: User | null
  isAuthenticated: boolean

  // Resumes
  resumes: Resume[]
  activeResumeId: string | null

  // Current job
  currentJob: JobPosting | null
  atsScore: ATSScore | null

  // Applications
  applications: Application[]

  // UI state
  isLoading: boolean
  error: string | null

  // Actions
  setUser: (user: User | null) => void
  loadResumes: () => Promise<void>
  addResume: (resume: Resume) => Promise<void>
  updateResume: (resume: Resume) => Promise<void>
  setActiveResume: (id: string) => void
  deleteResume: (id: string) => Promise<void>

  setCurrentJob: (job: JobPosting | null) => void
  setATSScore: (score: ATSScore | null) => void

  loadApplications: () => Promise<void>
  addApplication: (application: Application) => Promise<void>
  updateApplication: (id: string, updates: Partial<Application>) => Promise<void>
  deleteApplication: (id: string) => Promise<void>

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  resumes: [],
  activeResumeId: null,
  currentJob: null,
  atsScore: null,
  applications: [],
  isLoading: false,
  error: null,

  // User actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  // Resume actions
  loadResumes: async () => {
    try {
      set({ isLoading: true, error: null })
      const resumes = await getAllResumes()
      set({ resumes, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  addResume: async (resume) => {
    try {
      set({ isLoading: true, error: null })
      await saveResumeDB(resume)
      set(state => ({
        resumes: [...state.resumes, resume],
        activeResumeId: resume.id,
        isLoading: false
      }))
      // Persist activeResumeId to chrome.storage
      chrome.storage.local.set({ activeResumeId: resume.id })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  updateResume: async (resume) => {
    try {
      set({ isLoading: true, error: null })
      await saveResumeDB(resume)
      set(state => ({
        resumes: state.resumes.map(r => r.id === resume.id ? resume : r),
        isLoading: false
      }))
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  setActiveResume: (id) => {
    set({ activeResumeId: id })
    // Persist activeResumeId to chrome.storage
    chrome.storage.local.set({ activeResumeId: id })
  },

  deleteResume: async (id) => {
    try {
      set({ isLoading: true, error: null })
      await deleteResumeDB(id)
      const wasActive = get().activeResumeId === id
      set(state => ({
        resumes: state.resumes.filter(r => r.id !== id),
        activeResumeId: state.activeResumeId === id ? null : state.activeResumeId,
        isLoading: false
      }))
      // Clear from chrome.storage if this was the active resume
      if (wasActive) {
        chrome.storage.local.set({ activeResumeId: null })
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  // Job actions
  setCurrentJob: (job) => set({ currentJob: job }),
  setATSScore: (score) => set({ atsScore: score }),

  // Application actions
  loadApplications: async () => {
    try {
      set({ isLoading: true, error: null })
      const applications = await getAllApplications()
      set({ applications, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  addApplication: async (application) => {
    try {
      set({ isLoading: true, error: null })
      await saveApplicationDB(application)
      set(state => ({
        applications: [...state.applications, application],
        isLoading: false
      }))
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  updateApplication: async (id, updates) => {
    try {
      set({ isLoading: true, error: null })
      const applications = get().applications
      const app = applications.find(a => a.id === id)
      if (app) {
        const updated = { ...app, ...updates }
        await saveApplicationDB(updated)
        set(state => ({
          applications: state.applications.map(a => a.id === id ? updated : a),
          isLoading: false
        }))
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  deleteApplication: async (id) => {
    try {
      set({ isLoading: true, error: null })
      await deleteApplicationDB(id)
      set(state => ({
        applications: state.applications.filter(a => a.id !== id),
        isLoading: false
      }))
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  // UI actions
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))
