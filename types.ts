
export type AppLanguage = 'en' | 'fr' | 'de' | 'ru' | 'ar' | 'zh' | 'ja' | 'ko';

export interface CustomGroup {
  id: string;
  name: string;
  color: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  remarks: string;
  avatarUrl: string;
  dateJoined: string;
  createdAt: number;
  facebook?: string;
  instagram?: string;
  website?: string;
  customGroups?: string[]; // Array of CustomGroup IDs
}

export type NewContact = Omit<Contact, 'id' | 'createdAt'> & {
  avatarUrl?: string;
};

export interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  iconUrl: string;
  category: string;
}

export type NewTool = Omit<Tool, 'id'>;

export interface BoardItem {
  id: string;
  type: 'sticky' | 'text' | 'image' | 'objective' | 'idea-strip' | 'goal';
  content: string;
  x: number;
  y: number;
  color?: string;
  parentId?: string; // Kept for backward compatibility migration
  isCompleted?: boolean;
}

export interface BoardLink {
  id: string;
  fromId: string;
  toId: string;
  variant: 'critical' | 'positive' | 'alternative' | 'neutral';
}

// Updated AppSection type to include new modules
export type AppSection = 
  | 'overview' 
  | 'timeline' 
  | 'mindmap' 
  | 'planning' 
  | 'sales' 
  | 'marketing' 
  | 'simulation'
  | 'tasks' 
  | 'team' 
  | 'tools';
