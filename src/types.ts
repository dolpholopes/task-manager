export type Priority = 'high' | 'medium' | 'low';
export type Reminder = 'none' | '15-minutes' | '1-hour' | '1-day';

export interface Workspace {
  id: string;
  title: string;
  order: number;
  createdAt: number;
}

export interface Card {
  id: string;
  title: string;
  viewMode?: 'card' | 'list';
  order?: number;
  workspaceId: string;
  width?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string; // ISO string YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: Priority;
  reminder: Reminder;
  reminderSent: boolean;
  completed: boolean;
  createdAt: number;
  cardId: string;
  workspaceId: string;
  order: number;
  labelId?: string;
  assigneeId?: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface TeamMember {
  id: string;
  name: string;
  color: string;
}

export type AutomationTrigger = 'task_completed' | 'task_moved_to_card' | 'task_created' | 'task_assigned';
export type AutomationAction = 'change_label' | 'assign_member';

export interface Automation {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  triggerCardId?: string; // Only if trigger is task_moved_to_card
  triggerMemberId?: string; // Only if trigger is task_assigned
  action: AutomationAction;
  actionLabelId?: string;
  actionMemberId?: string;
  enabled: boolean;
}
