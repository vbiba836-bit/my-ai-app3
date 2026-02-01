
export enum DayStatus {
  MINIMUM = 'MINIMUM',
  PARTIAL = 'PARTIAL',
  FAILED_RETURNED = 'FAILED_RETURNED',
  NONE = 'NONE'
}

export type Gender = 'male' | 'female';

export interface Inspiration {
  person: string;
  quote: string;
  bio: string;
  tools: string;
}

export interface ProgressEntry {
  date: string;
  status: DayStatus;
  comment?: string;
  step: string;
}

export interface UserState {
  id: string;
  userName: string;
  gender: Gender;
  mainGoal: string;
  history: ProgressEntry[];
  currentStep: string;
  currentMessage: string;
  isSprint: boolean;
  isChaos: boolean;
  isInitialized: boolean;
  dailyInspiration?: Inspiration;
}

export interface AppGlobalState {
  profiles: UserState[];
  activeProfileId: string | null;
}

export interface AIResponse {
  message: string;
  step: string;
  inspiration: Inspiration;
}
