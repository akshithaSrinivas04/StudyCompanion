export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  subjects?: string[];
  goals?: string;
  studyStreak?: number;
  totalXp?: number;
  createdAt: string;
}

export interface StudyNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  summary?: string;
  explanation?: string;
  fileUrl?: string;
  fileType?: string;
  createdAt: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Quiz {
  id: string;
  userId: string;
  noteId: string;
  questions: QuizQuestion[];
  score?: number;
  totalQuestions: number;
  createdAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
