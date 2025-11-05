import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { Resume, Application, JobPosting } from '@/types'

interface JunoDB extends DBSchema {
  resumes: {
    key: string
    value: Resume
    indexes: { 'by-date': Date }
  }
  applications: {
    key: string
    value: Application
    indexes: { 'by-date': Date; 'by-status': Application['status'] }
  }
  jobPostings: {
    key: string
    value: JobPosting
    indexes: { 'by-date': Date; 'by-source': JobPosting['source'] }
  }
}

const DB_NAME = 'juno-db'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<JunoDB> | null = null
let dbPromise: Promise<IDBPDatabase<JunoDB>> | null = null
let dbInitCount = 0

export async function initDB(): Promise<IDBPDatabase<JunoDB>> {
  if (dbInstance) return dbInstance
  if (dbPromise) return dbPromise

  dbInitCount++
  const currentInit = dbInitCount

  dbPromise = openDB<JunoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Resumes store
      if (!db.objectStoreNames.contains('resumes')) {
        const resumeStore = db.createObjectStore('resumes', { keyPath: 'id' })
        resumeStore.createIndex('by-date', 'updatedAt')
      }

      // Applications store
      if (!db.objectStoreNames.contains('applications')) {
        const appStore = db.createObjectStore('applications', { keyPath: 'id' })
        appStore.createIndex('by-date', 'appliedAt')
        appStore.createIndex('by-status', 'status')
      }

      // Job postings store
      if (!db.objectStoreNames.contains('jobPostings')) {
        const jobStore = db.createObjectStore('jobPostings', { keyPath: 'id' })
        jobStore.createIndex('by-date', 'detectedAt')
        jobStore.createIndex('by-source', 'source')
      }
    },
  })

  try {
    dbInstance = await dbPromise
    return dbInstance
  } catch (error) {
    // Reset on error to allow retry
    dbPromise = null
    throw error
  } finally {
    // Only clear dbPromise if no new init started while we were initializing
    if (currentInit === dbInitCount) {
      dbPromise = null
    }
  }
}

// Resume operations
export async function saveResume(resume: Resume): Promise<void> {
  const db = await initDB()
  await db.put('resumes', resume)
}

export async function getResume(id: string): Promise<Resume | undefined> {
  const db = await initDB()
  return db.get('resumes', id)
}

export async function getAllResumes(): Promise<Resume[]> {
  const db = await initDB()
  return db.getAllFromIndex('resumes', 'by-date')
}

export async function deleteResume(id: string): Promise<void> {
  const db = await initDB()
  await db.delete('resumes', id)
}

// Application operations
export async function saveApplication(application: Application): Promise<void> {
  const db = await initDB()
  await db.put('applications', application)
}

export async function getApplication(id: string): Promise<Application | undefined> {
  const db = await initDB()
  return db.get('applications', id)
}

export async function getAllApplications(): Promise<Application[]> {
  const db = await initDB()
  return db.getAllFromIndex('applications', 'by-date')
}

export async function getApplicationsByStatus(
  status: Application['status']
): Promise<Application[]> {
  const db = await initDB()
  return db.getAllFromIndex('applications', 'by-status', status)
}

export async function deleteApplication(id: string): Promise<void> {
  const db = await initDB()
  await db.delete('applications', id)
}

// Job posting operations
export async function saveJobPosting(job: JobPosting): Promise<void> {
  const db = await initDB()
  await db.put('jobPostings', job)
}

export async function getJobPosting(id: string): Promise<JobPosting | undefined> {
  const db = await initDB()
  return db.get('jobPostings', id)
}

export async function getAllJobPostings(): Promise<JobPosting[]> {
  const db = await initDB()
  return db.getAllFromIndex('jobPostings', 'by-date')
}

export async function deleteJobPosting(id: string): Promise<void> {
  const db = await initDB()
  await db.delete('jobPostings', id)
}

// Utility to clear all data
export async function clearAllData(): Promise<void> {
  const db = await initDB()
  await db.clear('resumes')
  await db.clear('applications')
  await db.clear('jobPostings')
}
