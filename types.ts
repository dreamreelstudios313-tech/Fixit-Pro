
export type Language = 'en' | 'es' | 'fr' | 'de' | 'zh';

export interface User {
  id: string;
  email: string;
  name: string;
  isSubscribed: boolean;
  freeUsesRemaining: number;
}

export interface DiagnosticResult {
  problem: string;
  diagnosis: string;
  steps: string[];
  toolsNeeded: string[];
  sources: { title: string; uri: string }[];
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  date: string;
  category: string;
}
