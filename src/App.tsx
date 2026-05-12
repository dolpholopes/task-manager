/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Task, Priority, Reminder, Card, Workspace, Label, Automation, AutomationTrigger, TeamMember } from './types';
import { TaskCard } from './components/TaskCard';
import { TaskForm } from './components/TaskForm';
import { LabelAutomationManager } from './components/LabelAutomationManager';
import { TeamManager } from './components/TeamManager';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Logo } from './components/Logo';
import { LayoutGrid, ListTodo, CheckSquare, SlidersHorizontal, ArrowUpDown, FolderPlus, Trash2, MoreVertical, LogOut, GripVertical, Briefcase, Plus, ChevronRight, Download, Bell, BellOff, Tag, Zap, Users, PanelLeftClose, PanelLeft, Menu as MenuIcon, X, Pencil, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { requestNotificationPermission, sendNotification } from './lib/notifications';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch, updateDoc } from 'firebase/firestore';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Task Card Wrapper
function SortableTaskCard({ task, ...props }: { task: Task } & any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} {...props} />
    </div>
  );
}

interface DroppableCardProps {
  card: Card;
  tasks: Task[];
  onToggleViewMode: (id: string) => void;
  onDeleteCard: (id: string) => void;
  onUpdateCard: (e: React.FormEvent) => void;
  onWidthChange: (id: string, width: number) => void;
  editingCardId: string | null;
  editingCardTitle: string;
  setEditingCardId: (id: string | null) => void;
  setEditingCardTitle: (title: string) => void;
  cardsLength: number;
  children: React.ReactNode;
}

// Droppable Card Wrapper
const DroppableCard: React.FC<DroppableCardProps> = ({ 
  card, 
  tasks, 
  onToggleViewMode, 
  onDeleteCard, 
  onUpdateCard,
  onWidthChange, 
  editingCardId,
  editingCardTitle,
  setEditingCardId,
  setEditingCardTitle,
  cardsLength, 
  children 
}) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'Card', card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    width: card.width ? `${card.width}px` : '320px',
  };

  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.round(entry.contentRect.width + 32); // 32 is padding (p-4 = 16px * 2)
        if (Math.abs((card.width || 320) - newWidth) > 5) { // Threshold to prevent tiny updates
          onWidthChange(card.id, newWidth);
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [card.id, card.width, onWidthChange]);

  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    (containerRef as any).current = node;
  };

  const handleExport = (format: 'txt' | 'pdf') => {
    const priorityMap: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };
    
    if (format === 'txt') {
      const content = tasks.map(t => `- ${t.title}${t.completed ? ' (Concluída)' : ''}${t.description ? `\n  Descrição: ${t.description}` : ''}${t.dueDate ? `\n  Vencimento: ${t.dueDate}` : ''}${t.priority ? `\n  Prioridade: ${priorityMap[t.priority] || t.priority}` : ''}`).join('\n\n');
      const blob = new Blob([`Área de Trabalho: ${card.title}\nTotal de Tarefas: ${tasks.length}\n\n${content}`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.title.replace(/\s+/g, '_')}_tarefas.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const tasksHtml = tasks.map(t => `
        <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
          <div style="font-weight: bold; font-size: 1.1em; color: #1e293b;">
            ${t.completed ? '<span style="color: #10b981;">✓</span> ' : ''}${t.title}
          </div>
          ${t.description ? `<div style="color: #64748b; margin-top: 5px; font-size: 0.95em;">${t.description}</div>` : ''}
          <div style="font-size: 0.85em; color: #94a3b8; margin-top: 8px;">
            ${t.dueDate ? `<span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">Vencimento: ${t.dueDate}</span> &nbsp; ` : ''}
            <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">Prioridade: ${priorityMap[t.priority] || 'Média'}</span>
          </div>
        </div>
      `).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>${card.title} - Tarefas</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #334155; line-height: 1.5; }
              h1 { color: #828282; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 10px; font-size: 24px; }
              .meta { margin-bottom: 30px; color: #64748b; font-size: 14px; }
              @media print {
                body { padding: 20px; }
                button { display: none; }
              }
            </style>
          </head>
          <body>
            <h1>${card.title}</h1>
            <p class="meta">Exportado em: ${new Date().toLocaleDateString()} | Total de tarefas: ${tasks.length}</p>
            ${tasksHtml}
            <button onclick="window.print()" style="position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #828282; color: white; border: none; border-radius: 6px; cursor: pointer;">Imprimir / Salvar PDF</button>
            <script>
              setTimeout(() => {
                window.print();
              }, 500);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div 
      ref={setRefs} 
      style={style} 
      className="flex-shrink-0 min-w-[280px] max-w-[800px] bg-slate-50/50 rounded-2xl border border-slate-200/60 p-4 flex flex-col h-full relative transition-colors hover:border-slate-300/80 group/card"
    >
      {/* Custom Resize Handle */}
      <div 
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.pageX;
          const startWidth = card.width || 320;
          
          const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth + (moveEvent.pageX - startX);
            onWidthChange(card.id, Math.max(280, Math.min(800, newWidth)));
          };
          
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
        className="absolute -right-1.5 top-4 bottom-4 w-3 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 rounded-full transition-all group-hover/card:opacity-100 opacity-0 bg-slate-200/50 z-[110]"
      />
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-2" {...(editingCardId === card.id ? {} : { ...attributes, ...listeners })} style={{ cursor: editingCardId === card.id ? 'default' : 'grab' }}>
          <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {editingCardId === card.id ? (
            <form 
              onSubmit={onUpdateCard} 
              className="flex-1 min-w-0" 
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === ' ') e.stopPropagation();
              }}
            >
              <input
                type="text"
                value={editingCardTitle}
                onChange={(e) => setEditingCardTitle(e.target.value)}
                className="w-full bg-white text-slate-800 text-sm font-semibold py-0.5 px-2 rounded border border-primary/30 focus:ring-1 focus:ring-primary h-7"
                autoFocus
                onBlur={() => {
                  if (editingCardTitle === card.title) setEditingCardId(null);
                  else if (editingCardTitle.trim()) onUpdateCard(new Event('submit') as any);
                }}
              />
            </form>
          ) : (
            <h3 
              className="font-semibold text-slate-800 truncate cursor-text hover:text-primary transition-colors" 
              title={card.title}
              onClick={(e) => {
                e.stopPropagation();
                setEditingCardId(card.id);
                setEditingCardTitle(card.title);
              }}
            >
              {card.title}
            </h3>
          )}
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1 group relative">
          <div className="absolute right-0 top-full mt-1 bg-white shadow-xl rounded-lg border border-slate-100 p-1 hidden group-hover:block z-50 min-w-[120px]">
            <button
              onClick={() => handleExport('txt')}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-primary rounded-md flex items-center gap-2"
            >
              <Download className="w-3 h-3" />
              Notepad (.txt)
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-primary rounded-md flex items-center gap-2"
            >
              <Download className="w-3 h-3" />
              PDF (Impressão)
            </button>
          </div>
          <button
            onClick={() => {
              setEditingCardId(card.id);
              setEditingCardTitle(card.title);
            }}
            className="text-slate-400 hover:text-primary p-1 rounded-md hover:bg-primary-light transition-colors"
            title="Editar título"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="text-slate-400 hover:text-primary p-1 rounded-md hover:bg-primary-light transition-colors"
            title="Exportar tarefas"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleViewMode(card.id)}
            className="text-slate-400 hover:text-primary p-1 rounded-md hover:bg-primary-light transition-colors"
            title={card.viewMode === 'list' ? "Mudar para Cards" : "Mudar para Lista"}
          >
            {card.viewMode === 'list' ? <LayoutGrid className="w-4 h-4" /> : <ListTodo className="w-4 h-4" />}
          </button>
          {cardsLength > 1 && (
            <button
              onClick={() => onDeleteCard(card.id)}
              className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors"
              title="Excluir card"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [cards, setCards] = useState<Card[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLabelManagerOpen, setIsLabelManagerOpen] = useState(false);
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [newWorkspaceTitle, setNewWorkspaceTitle] = useState('');
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceTitle, setEditingWorkspaceTitle] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueDate' | 'priority' | 'order'>('order');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState('');
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const [activeDragCard, setActiveDragCard] = useState<Card | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts to prevent accidental drags on clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Workspaces
  useEffect(() => {
    if (!user || !isAuthReady) return;
    const unsubscribe = onSnapshot(collection(db, `users/${user.uid}/workspaces`), (snapshot) => {
      const loadedWorkspaces: Workspace[] = [];
      snapshot.forEach(doc => {
        loadedWorkspaces.push(doc.data() as Workspace);
      });
      
      if (loadedWorkspaces.length === 0) {
        const defaultWorkspace: Workspace = {
          id: 'default-workspace',
          title: 'Meu Trabalho',
          order: 0,
          createdAt: Date.now()
        };
        setDoc(doc(db, `users/${user.uid}/workspaces`, defaultWorkspace.id), defaultWorkspace);
        setWorkspaces([defaultWorkspace]);
        setActiveWorkspaceId(defaultWorkspace.id);
      } else {
        loadedWorkspaces.sort((a, b) => a.order - b.order);
        setWorkspaces(loadedWorkspaces);
        if (!activeWorkspaceId) {
          setActiveWorkspaceId(loadedWorkspaces[0].id);
        }
      }
    }, (error) => {
      console.error("Firestore Error (Workspaces): ", error);
    });
    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Fetch Cards and Tasks for active workspace
  useEffect(() => {
    if (!user || !isAuthReady || !activeWorkspaceId) return;
    
    const cardsUnsubscribe = onSnapshot(collection(db, `users/${user.uid}/cards`), (snapshot) => {
      const loadedCards: Card[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Card;
        if (data.workspaceId === activeWorkspaceId) {
          loadedCards.push(data);
        }
      });
      
      if (loadedCards.length === 0) {
        const defaultCards: Card[] = [
          { id: crypto.randomUUID(), title: 'A Fazer', viewMode: 'card', order: 0, workspaceId: activeWorkspaceId },
          { id: crypto.randomUUID(), title: 'Em Progresso', viewMode: 'card', order: 1, workspaceId: activeWorkspaceId },
          { id: crypto.randomUUID(), title: 'Concluído', viewMode: 'card', order: 2, workspaceId: activeWorkspaceId }
        ];
        setCards(defaultCards);
        defaultCards.forEach(c => {
          setDoc(doc(db, `users/${user.uid}/cards`, c.id), c);
        });
      } else {
        loadedCards.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCards(loadedCards);
      }
    }, (error) => {
      console.error("Firestore Error (Cards): ", error);
    });

    const tasksUnsubscribe = onSnapshot(collection(db, `users/${user.uid}/tasks`), (snapshot) => {
      const loadedTasks: Task[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Task;
        if (data.workspaceId === activeWorkspaceId) {
          loadedTasks.push(data);
        }
      });
      loadedTasks.sort((a, b) => (a.order || 0) - (b.order || 0));
      setTasks(loadedTasks);
    }, (error) => {
      console.error("Firestore Error (Tasks): ", error);
    });

    const labelsUnsubscribe = onSnapshot(collection(db, `users/${user.uid}/labels`), (snapshot) => {
      const loadedLabels: Label[] = [];
      snapshot.forEach(doc => {
        loadedLabels.push(doc.data() as Label);
      });
      setLabels(loadedLabels);
    }, (error) => {
      console.error("Firestore Error (Labels): ", error);
    });

    const teamUnsubscribe = onSnapshot(collection(db, `users/${user.uid}/team_members`), (snapshot) => {
      const loadedMembers: TeamMember[] = [];
      snapshot.forEach(doc => {
        loadedMembers.push(doc.data() as TeamMember);
      });
      setTeamMembers(loadedMembers);
    }, (error) => {
      console.error("Firestore Error (Team): ", error);
    });

    const automationsUnsubscribe = onSnapshot(collection(db, `users/${user.uid}/automations`), (snapshot) => {
      const loadedAutomations: Automation[] = [];
      snapshot.forEach(doc => {
        loadedAutomations.push(doc.data() as Automation);
      });
      setAutomations(loadedAutomations);
    }, (error) => {
      console.error("Firestore Error (Automations): ", error);
    });

    return () => {
      cardsUnsubscribe();
      tasksUnsubscribe();
      labelsUnsubscribe();
      teamUnsubscribe();
      automationsUnsubscribe();
    };
  }, [user, isAuthReady, activeWorkspaceId]);

  // ... (Notification logic remains same)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  useEffect(() => {
    const checkPermission = async () => {
      const granted = await requestNotificationPermission();
      if (typeof Notification !== 'undefined') {
        setNotificationPermission(Notification.permission);
      }
    };
    checkPermission();
  }, []);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    if (typeof Notification !== 'undefined') {
      setNotificationPermission(Notification.permission);
    }
  };

  useEffect(() => {
    if (!user) return;

    const checkReminders = () => {
      const now = new Date();
      tasks.forEach(task => { // Use 'tasks' directly or follow the prevTasks pattern, but for Firestore we need to reach out
        if (task.completed || task.reminder === 'none' || task.reminderSent || !task.dueDate) return;
        
        const [year, month, day] = task.dueDate.split('-').map(Number);
        const [hour, minute] = task.dueTime ? task.dueTime.split(':').map(Number) : [9, 0];
        const deadline = new Date(year, month - 1, day, hour, minute, 0);
        
        let triggerTime = new Date(deadline);
        switch (task.reminder) {
          case '15-minutes': triggerTime.setMinutes(triggerTime.getMinutes() - 15); break;
          case '1-hour': triggerTime.setHours(triggerTime.getHours() - 1); break;
          case '1-day': triggerTime.setDate(triggerTime.getDate() - 1); break;
        }

        if (now >= triggerTime) {
          sendNotification(`Lembrete de Tarefa: ${task.title}`, `Sua tarefa vence em breve! (${task.reminder})`);
          // Persist to Firestore
          updateDoc(doc(db, `users/${user.uid}/tasks`, task.id), { reminderSent: true })
            .catch(err => console.error("Error updating reminder status:", err));
        }
      });
    };
    const interval = setInterval(checkReminders, 60000);
    checkReminders();
    return () => clearInterval(interval);
  }, [user, tasks]);

  // ... (CRUD functions remain same)
  const addWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceTitle.trim() || !user) return;
    const newWorkspace: Workspace = {
      id: crypto.randomUUID(),
      title: newWorkspaceTitle.trim(),
      order: workspaces.length,
      createdAt: Date.now()
    };
    await setDoc(doc(db, `users/${user.uid}/workspaces`, newWorkspace.id), newWorkspace);
    setNewWorkspaceTitle('');
    setIsAddingWorkspace(false);
    setActiveWorkspaceId(newWorkspace.id);
  };

  const updateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspaceTitle.trim() || !user || !editingWorkspaceId) return;
    await updateDoc(doc(db, `users/${user.uid}/workspaces`, editingWorkspaceId), { 
      title: editingWorkspaceTitle.trim() 
    });
    setEditingWorkspaceId(null);
    setEditingWorkspaceTitle('');
  };

  const deleteWorkspace = async (id: string) => {
    if (!user || workspaces.length <= 1) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Área de Trabalho',
      message: 'Tem certeza? Todas as sessões e tarefas desta área de trabalho serão excluídas permanentemente.',
      variant: 'danger',
      onConfirm: async () => {
        const batch = writeBatch(db);
        batch.delete(doc(db, `users/${user.uid}/workspaces`, id));
        await batch.commit();
        if (activeWorkspaceId === id) {
          setActiveWorkspaceId(workspaces.find(w => w.id !== id)?.id || null);
        }
      }
    });
  };

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim() || !user || !activeWorkspaceId) return;
    const newCard: Card = { 
      id: crypto.randomUUID(), 
      title: newCardTitle.trim(),
      viewMode: 'card',
      order: cards.length,
      workspaceId: activeWorkspaceId
    };
    await setDoc(doc(db, `users/${user.uid}/cards`, newCard.id), newCard);
    setNewCardTitle('');
    setIsAddingCard(false);
  };

  const updateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCardTitle.trim() || !user || !editingCardId) return;
    await updateDoc(doc(db, `users/${user.uid}/cards`, editingCardId), { 
      title: editingCardTitle.trim() 
    });
    setEditingCardId(null);
    setEditingCardTitle('');
  };

  const deleteCard = async (id: string) => {
    if (!user) return;
    if (cards.length <= 1) {
      setConfirmDialog({
        isOpen: true,
        title: 'Ação Não Permitida',
        message: 'Você não pode excluir o único card existente. Cada área de trabalho precisa de pelo menos um card.',
        variant: 'info',
        onConfirm: () => {}
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Card',
      message: 'Tem certeza? Todas as tarefas deste card serão movidas para o primeiro card disponível.',
      variant: 'warning',
      onConfirm: async () => {
        const fallbackCardId = cards.find(c => c.id !== id)?.id || 'default';
        const tasksToMove = tasks.filter(t => t.cardId === id);
        const batch = writeBatch(db);
        tasksToMove.forEach(t => {
          batch.set(doc(db, `users/${user.uid}/tasks`, t.id), { ...t, cardId: fallbackCardId });
        });
        batch.delete(doc(db, `users/${user.uid}/cards`, id));
        await batch.commit();
      }
    });
  };

  const toggleCardViewMode = async (id: string) => {
    if (!user) return;
    const card = cards.find(c => c.id === id);
    if (card) {
      await setDoc(doc(db, `users/${user.uid}/cards`, id), { ...card, viewMode: card.viewMode === 'list' ? 'card' : 'list' });
    }
  };

  const addTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'completed' | 'reminderSent' | 'workspaceId' | 'order'>) => {
    if (!user || !activeWorkspaceId) return;
    let finalCardId = taskData.cardId;
    
    // Safety check: Ensure card exists
    if (!cards.find(c => c.id === finalCardId)) {
      if (cards.length > 0) {
         finalCardId = cards[0].id;
      } else {
         // Create default card if absolutely none exist (recovery)
         const newCard: Card = { id: crypto.randomUUID(), title: 'Geral', viewMode: 'card', workspaceId: activeWorkspaceId };
         await setDoc(doc(db, `users/${user.uid}/cards`, newCard.id), newCard);
         finalCardId = newCard.id;
      }
    }

    const newTask: Task = {
      ...taskData,
      cardId: finalCardId,
      workspaceId: activeWorkspaceId,
      id: crypto.randomUUID(),
      completed: false,
      reminderSent: false,
      createdAt: Date.now(),
      order: tasks.length,
    };
    
    // Remove undefined fields for Firestore
    const cleanTask = Object.fromEntries(Object.entries(newTask).filter(([_, v]) => v !== undefined));
    await setDoc(doc(db, `users/${user.uid}/tasks`, newTask.id), cleanTask);
    
    // Trigger automation for task creation
    runAutomations(newTask, 'task_created');
  };

  const updateTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'completed' | 'reminderSent' | 'workspaceId' | 'order'>) => {
    if (!editingTask || !user) return;
    const updatedTask = { ...editingTask, ...taskData, reminderSent: false };
    const cleanTask = Object.fromEntries(Object.entries(updatedTask).filter(([_, v]) => v !== undefined));
    await setDoc(doc(db, `users/${user.uid}/tasks`, updatedTask.id), cleanTask);
    setEditingTask(null);
  };

  // Automation Logic
  const runAutomations = async (task: Task, trigger: AutomationTrigger, details?: { cardId?: string, memberId?: string }) => {
    if (!user) return;
    
    // Find matching automations
    const matchingAutomations = automations.filter(auto => 
      auto.enabled && 
      auto.trigger === trigger && 
      (trigger !== 'task_moved_to_card' || auto.triggerCardId === details?.cardId) &&
      (trigger !== 'task_assigned' || !auto.triggerMemberId || auto.triggerMemberId === details?.memberId)
    );

    if (matchingAutomations.length === 0) return;

    // Apply the first matching automation
    const auto = matchingAutomations[0];
    if (auto.action === 'change_label' && auto.actionLabelId) {
      try {
        await updateDoc(doc(db, `users/${user.uid}/tasks`, task.id), { labelId: auto.actionLabelId });
      } catch (error) {
        console.error("Error applying automation (label):", error);
      }
    } else if (auto.action === 'assign_member' && auto.actionMemberId) {
      try {
        await updateDoc(doc(db, `users/${user.uid}/tasks`, task.id), { assigneeId: auto.actionMemberId });
      } catch (error) {
        console.error("Error applying automation (assign):", error);
      }
    }
  };

  const toggleTask = async (id: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === id);
    if (task) {
      const newCompleted = !task.completed;
      await setDoc(doc(db, `users/${user.uid}/tasks`, id), { ...task, completed: newCompleted });
      
      // Trigger automation only if task is becoming completed
      if (newCompleted) {
        runAutomations(task, 'task_completed');
      }
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/tasks`, id));
  };

  const widthTimeouts = React.useRef<{ [key: string]: NodeJS.Timeout }>({});

  const updateCardWidth = (id: string, width: number) => {
    if (!user) return;
    
    // Update local state for immediate feedback
    setCards(prev => prev.map(c => c.id === id ? { ...c, width } : c));

    // Clear existing timeout for this card
    if (widthTimeouts.current[id]) {
      clearTimeout(widthTimeouts.current[id]);
    }

    // Set new timeout to persist to Firestore
    widthTimeouts.current[id] = setTimeout(async () => {
      try {
        await updateDoc(doc(db, `users/${user.uid}/cards`, id), { width });
      } catch (error) {
        console.error("Error updating card width:", error);
      }
      delete widthTimeouts.current[id];
    }, 500);
  };

  const addLabel = async (name: string, color: string) => {
    if (!user) return;
    const newLabel: Label = { id: crypto.randomUUID(), name, color };
    await setDoc(doc(db, `users/${user.uid}/labels`, newLabel.id), newLabel);
  };

  const updateLabel = async (id: string, name: string, color: string) => {
    if (!user) return;
    await updateDoc(doc(db, `users/${user.uid}/labels`, id), { name, color });
  };

  const deleteLabel = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/labels`, id));
  };

  const addAutomation = async (autoData: Omit<Automation, 'id'>) => {
    if (!user) return;
    const newAuto: Automation = { ...autoData, id: crypto.randomUUID() };
    const cleanAuto = Object.fromEntries(Object.entries(newAuto).filter(([_, v]) => v !== undefined));
    await setDoc(doc(db, `users/${user.uid}/automations`, newAuto.id), cleanAuto);
  };

  const deleteAutomation = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/automations`, id));
  };

  const addTeamMember = async (name: string, color: string) => {
    if (!user) return;
    const newMember: TeamMember = { id: crypto.randomUUID(), name, color };
    await setDoc(doc(db, `users/${user.uid}/team_members`, newMember.id), newMember);
  };

  const deleteTeamMember = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/team_members`, id));
  };

  const updateTaskAssignee = async (taskId: string, memberId: string | undefined) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedTask = { ...task, assigneeId: memberId || undefined };
      const cleanTask = Object.fromEntries(Object.entries(updatedTask).filter(([_, v]) => v !== undefined));
      await setDoc(doc(db, `users/${user.uid}/tasks`, taskId), cleanTask);
      
      if (memberId) {
        runAutomations(updatedTask as Task, 'task_assigned', { memberId });
      }
    }
  };

  const updateTaskLabel = async (taskId: string, labelId: string | undefined) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedTask = { ...task, labelId: labelId || undefined };
      const cleanTask = Object.fromEntries(Object.entries(updatedTask).filter(([_, v]) => v !== undefined));
      await setDoc(doc(db, `users/${user.uid}/tasks`, taskId), cleanTask);
    }
  };

  const getFilteredTasks = (cardId: string) => {
    return tasks
      .filter(task => task.cardId === cardId)
      .filter(task => {
        if (filter === 'pending') return !task.completed;
        if (filter === 'completed') return task.completed;
        return true;
      })
      .filter(task => {
        if (priorityFilter === 'all') return true;
        return task.priority === priorityFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'order') {
          return (a.order || 0) - (b.order || 0);
        }
        if (sortBy === 'dueDate') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          const timeA = new Date(a.dueDate + 'T' + (a.dueTime || '00:00')).getTime();
          const timeB = new Date(b.dueDate + 'T' + (b.dueTime || '00:00')).getTime();
          return timeA - timeB;
        }
        if (sortBy === 'priority') {
          const priorityWeight = { high: 3, medium: 2, low: 1 };
          return priorityWeight[b.priority] - priorityWeight[a.priority];
        }
        return a.createdAt - b.createdAt;
      });
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length,
  };

  // Drag and Drop Handlers
  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Task') {
      setActiveDragTask(event.active.data.current.task);
    } else if (event.active.data.current?.type === 'Card') {
      setActiveDragCard(event.active.data.current.card);
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverCard = over.data.current?.type === 'Card';
    const isActiveCard = active.data.current?.type === 'Card';

    // Card reordering visual feedback
    if (isActiveCard && isOverCard) {
      setCards((cards) => {
        const activeIndex = cards.findIndex((c) => c.id === activeId);
        const overIndex = cards.findIndex((c) => c.id === overId);
        return arrayMove(cards, activeIndex, overIndex);
      });
      return;
    }

    if (!isActiveTask) return;

    // Dropping a Task over another Task
    if (isActiveTask && isOverTask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        if (tasks[activeIndex].cardId !== tasks[overIndex].cardId) {
          // Moving to different card
          const newTasks = [...tasks];
          newTasks[activeIndex] = { ...newTasks[activeIndex], cardId: tasks[overIndex].cardId };
          return arrayMove(newTasks, activeIndex, overIndex);
        }

        return arrayMove(tasks, activeIndex, overIndex); // Reorder in same card
      });
    }

    // Dropping a Task over a Card (empty or not)
    if (isActiveTask && isOverCard) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const newCardId = String(overId);
        
        if (tasks[activeIndex].cardId !== newCardId) {
          const newTasks = [...tasks];
          newTasks[activeIndex] = { ...newTasks[activeIndex], cardId: newCardId };
          return arrayMove(newTasks, activeIndex, activeIndex); // Just update card
        }
        return tasks;
      });
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveDragTask(null);
    setActiveDragCard(null);
    const { active, over } = event;
    if (!user) return;

    const isActiveCard = active.data.current?.type === 'Card';
    
    if (isActiveCard) {
      // Update order in Firestore based on current state (already updated in onDragOver)
      const batch = writeBatch(db);
      cards.forEach((c, index) => {
        batch.update(doc(db, `users/${user.uid}/cards`, c.id), { order: index });
      });
      await batch.commit();
      return;
    }

    if (!over) return;

    const activeId = active.id;

    // Persist all task positions and card assignments
    try {
      const batch = writeBatch(db);
      tasks.forEach((t, index) => {
        batch.update(doc(db, `users/${user.uid}/tasks`, t.id), { 
          order: index,
          cardId: t.cardId 
        });
      });
      await batch.commit();

      // After task movement is persisted, check for automations
      const activeTask = tasks.find(t => t.id === activeId);
      if (activeTask) {
         runAutomations(activeTask, 'task_moved_to_card', { cardId: activeTask.cardId });
      }
    } catch (error) {
      console.error("Error committing drag and drop changes: ", error);
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-primary-light rounded-2xl text-primary">
              <Logo className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Task Manager</h1>
          </div>
          <p className="text-slate-500 mb-8">Faça login para gerenciar suas tarefas e sincronizá-las na nuvem.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuar com Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 font-sans text-slate-900 selection:bg-primary-light selection:text-slate-900 relative">
      {/* Compact Notification Status Icon - Fixed at top right */}
      <div className="fixed top-4 right-4 lg:top-8 lg:right-8 z-[60]">
        <button
          onClick={handleRequestPermission}
          title={
            notificationPermission === 'granted' 
              ? 'Notificações Ativadas' 
              : notificationPermission === 'denied' 
                ? 'Notificações Bloqueadas' 
                : 'Ativar Notificações'
          }
          className={cn(
            "p-2 rounded-full transition-all border shadow-lg bg-white",
            notificationPermission === 'granted'
              ? "border-emerald-100 text-emerald-600 hover:bg-emerald-50"
              : notificationPermission === 'denied'
                ? "border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                : "border-slate-200 text-slate-400 hover:text-primary hover:border-primary-light hover:bg-primary-light/10"
          )}
        >
          {notificationPermission === 'granted' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </button>
      </div>

      <div className="w-full px-4 lg:px-8 h-full flex flex-col py-4 lg:py-8">
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-4 bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-white shadow-sm z-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-light rounded-xl text-primary">
              <Logo className="w-6 h-6" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Task Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className={cn("flex flex-row items-start flex-1 overflow-hidden relative transition-all duration-300", isSidebarCollapsed ? "gap-4" : "gap-6 lg:gap-8")}>
          
          {/* Mobile Sidebar Overlay */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] lg:hidden"
              />
            )}
          </AnimatePresence>

          {/* Sidebar */}
          <aside className={cn(
            "fixed inset-y-0 left-0 z-[101] w-[280px] bg-white lg:bg-transparent lg:relative lg:inset-auto lg:z-40 lg:flex lg:flex-col lg:h-full transition-transform duration-300 ease-in-out p-6 lg:p-0",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
            isSidebarCollapsed ? "lg:w-[52px]" : "lg:w-[240px]"
          )}>
            <div className={cn("space-y-6 mb-8 flex flex-col h-full", isSidebarCollapsed ? "lg:items-center" : "")}>
              {/* Header - Desktop Only */}
              <header className={cn("text-left w-full hidden lg:block", isSidebarCollapsed && "hidden")}>
                <div className={cn("flex items-center justify-between gap-3 mb-2", isSidebarCollapsed && "justify-center")}>
                  <div className={cn("flex items-center gap-3 transition-all duration-300", isSidebarCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden" : "opacity-100")}>
                    <div className="flex-shrink-0 p-2 bg-primary-light rounded-xl text-primary">
                      <Logo className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
                      Task Manager
                    </h1>
                  </div>
                  <button 
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className={cn(
                      "p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-primary transition-colors flex-shrink-0",
                      isSidebarCollapsed ? "w-10 h-10 flex items-center justify-center p-0" : ""
                    )}
                    title={isSidebarCollapsed ? "Expandir Sidebar" : "Recolher Sidebar"}
                  >
                    {isSidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                  </button>
                </div>
                {!isSidebarCollapsed && (
                  <p className="text-slate-500 text-sm lg:text-base">
                    Gerencie seu dia a dia com facilidade e eficiência
                  </p>
                )}
              </header>

              {/* Mobile Only: Close Button & Logo */}
              <div className="flex lg:hidden items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary-light rounded-xl text-primary">
                    <Logo className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-900">Menu</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Workspaces Area */}
              <div className={cn("space-y-3 w-full", isSidebarCollapsed && "hidden lg:block")}>
                <div className={cn("flex items-center justify-between px-2", isSidebarCollapsed && "lg:justify-center")}>
                  <h2 className={cn("text-[10px] font-bold text-slate-400 uppercase tracking-widest", isSidebarCollapsed && "lg:hidden")}>Áreas de Trabalho</h2>
                  {!isSidebarCollapsed && (
                    <button 
                      onClick={() => setIsAddingWorkspace(true)}
                      className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-primary transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isAddingWorkspace && !isSidebarCollapsed && (
                  <form onSubmit={addWorkspace} className="px-2">
                    <input
                      type="text"
                      value={newWorkspaceTitle}
                      onChange={(e) => setNewWorkspaceTitle(e.target.value)}
                      placeholder="Nova área..."
                      className="w-full text-sm rounded-lg border-slate-200 focus:ring-primary focus:border-primary p-2"
                      autoFocus
                      onBlur={() => {
                        if (!newWorkspaceTitle) setIsAddingWorkspace(false);
                      }}
                    />
                  </form>
                )}

                <div className="space-y-1 max-h-[300px] lg:max-h-[30vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  {workspaces.map(ws => (
                    <div 
                      key={ws.id}
                      title={isSidebarCollapsed ? ws.title : undefined}
                      className={cn(
                        "group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer",
                        activeWorkspaceId === ws.id 
                          ? "bg-primary text-white shadow-md shadow-primary/20" 
                          : "text-slate-600 hover:bg-slate-100",
                        isSidebarCollapsed && "lg:justify-center lg:px-0"
                      )}
                      onClick={() => {
                        if (editingWorkspaceId === ws.id) return;
                        setActiveWorkspaceId(ws.id);
                        if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                      }}
                    >
                      <div className={cn("flex items-center gap-2 truncate flex-1", isSidebarCollapsed && "lg:justify-center")}>
                        <Briefcase className={cn("w-4 h-4 flex-shrink-0", activeWorkspaceId === ws.id ? "text-primary-light" : "text-slate-400")} />
                        {editingWorkspaceId === ws.id ? (
                          <form onSubmit={updateWorkspace} className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingWorkspaceTitle}
                              onChange={(e) => setEditingWorkspaceTitle(e.target.value)}
                              className="w-full bg-white text-slate-900 text-xs py-0.5 px-1 rounded border-none focus:ring-1 focus:ring-primary-light h-6"
                              autoFocus
                              onBlur={() => {
                                if (editingWorkspaceTitle === ws.title) setEditingWorkspaceId(null);
                              }}
                            />
                          </form>
                        ) : (
                          <span className={cn("truncate", isSidebarCollapsed && "lg:hidden")}>{ws.title}</span>
                        )}
                      </div>
                      {!isSidebarCollapsed && (
                        <div className="flex items-center gap-1">
                          {editingWorkspaceId === ws.id ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateWorkspace(e as any);
                              }}
                              className={cn(
                                "p-1 rounded-md transition-opacity",
                                activeWorkspaceId === ws.id ? "hover:bg-primary-dark text-primary-light" : "hover:bg-slate-200 text-slate-400"
                              )}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingWorkspaceId(ws.id);
                                  setEditingWorkspaceTitle(ws.title);
                                }}
                                className={cn(
                                  "opacity-0 group-hover:opacity-100 p-1 rounded-md transition-opacity",
                                  activeWorkspaceId === ws.id ? "hover:bg-primary-dark text-primary-light" : "hover:bg-slate-200 text-slate-400"
                                )}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {workspaces.length > 1 && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteWorkspace(ws.id);
                                  }}
                                  className={cn(
                                    "opacity-0 group-hover:opacity-100 p-1 rounded-md transition-opacity",
                                    activeWorkspaceId === ws.id ? "hover:bg-primary-dark text-primary-light" : "hover:bg-slate-200 text-slate-400"
                                  )}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className={cn("flex flex-col gap-2 w-full", isSidebarCollapsed && "lg:items-center lg:px-2")}>
                <button
                  onClick={() => {
                    setFilter('all');
                    if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border transition-all",
                    filter === 'all' 
                      ? "bg-white border-primary/20 shadow-sm ring-1 ring-primary/10" 
                      : "bg-white border-transparent hover:bg-slate-50",
                    isSidebarCollapsed && "lg:w-full lg:p-2 lg:items-center"
                  )}
                  title="Total"
                >
                  <span className="text-xl font-bold text-slate-900">{stats.total}</span>
                  <span className={cn("text-[10px] font-medium uppercase tracking-wider text-slate-500 mt-0.5 whitespace-nowrap", isSidebarCollapsed && "lg:hidden")}>Total</span>
                </button>
                
                <button
                  onClick={() => {
                    setFilter('pending');
                    if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border transition-all",
                    filter === 'pending'
                      ? "bg-white border-orange-200 shadow-sm ring-1 ring-orange-100"
                      : "bg-white border-transparent hover:bg-slate-50",
                    isSidebarCollapsed && "lg:w-full lg:p-2 lg:items-center"
                  )}
                  title="Pendentes"
                >
                  <span className="text-xl font-bold text-orange-600">{stats.pending}</span>
                  <span className={cn("text-[10px] font-medium uppercase tracking-wider text-slate-500 mt-0.5 whitespace-nowrap", isSidebarCollapsed && "lg:hidden")}>Pendentes</span>
                </button>

                <button
                  onClick={() => {
                    setFilter('completed');
                    if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border transition-all",
                    filter === 'completed'
                      ? "bg-white border-emerald-200 shadow-sm ring-1 ring-emerald-100"
                      : "bg-white border-transparent hover:bg-slate-50",
                    isSidebarCollapsed && "lg:w-full lg:p-2 lg:items-center"
                  )}
                  title="Concluídas"
                >
                  <span className="text-xl font-bold text-emerald-600">{stats.completed}</span>
                  <span className={cn("text-[10px] font-medium uppercase tracking-wider text-slate-500 mt-0.5 whitespace-nowrap", isSidebarCollapsed && "lg:hidden")}>Concluídas</span>
                </button>
              </div>

              {/* User Footer (Inside Sidebar Drawer) */}
              <div className={cn("mt-auto pt-6 border-t border-slate-100 w-full", isSidebarCollapsed && "lg:items-center")}>
                <div className={cn("flex items-center gap-3 w-full", isSidebarCollapsed && "lg:flex-col lg:p-0")}>
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || ''} 
                      className="w-9 h-9 rounded-full border border-slate-200 flex-shrink-0"
                      referrerPolicy="no-referrer"
                      title={isSidebarCollapsed ? user.displayName || user.email || '' : undefined}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold flex-shrink-0" title={isSidebarCollapsed ? user.displayName || user.email || '' : undefined}>
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className={cn("flex-1 min-w-0 transition-opacity", isSidebarCollapsed && "lg:hidden")}>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {user.displayName || 'Usuário'}
                    </p>
                    <button
                      onClick={() => signOut(auth)}
                      className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      <LogOut className="w-3 h-3" />
                      Sair
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden space-y-6">
            <div className="flex items-center gap-3 text-slate-900">
                <div className="p-2 bg-primary-light rounded-lg text-primary">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold">
                  {workspaces.find(w => w.id === activeWorkspaceId)?.title || 'Área de Trabalho'}
                </h2>
              </div>


            {/* Filters and Sort Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 overflow-x-auto">
                <SlidersHorizontal className="w-4 h-4 text-slate-400 ml-2" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
                  className="text-sm border-none bg-transparent focus:ring-0 text-slate-600 font-medium cursor-pointer"
                >
                  <option value="all">Todas Prioridades</option>
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
              </div>

              <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
                <ArrowUpDown className="w-4 h-4 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border-none bg-transparent focus:ring-0 text-slate-600 font-medium cursor-pointer"
                >
                  <option value="order">Ordem Personalizada</option>
                  <option value="createdAt">Mais Antigas</option>
                  <option value="dueDate">Data de Vencimento</option>
                  <option value="priority">Prioridade</option>
                </select>
              </div>
            </div>

            {/* Cards & Task Lists */}
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
                <h2 className="text-lg font-semibold text-slate-900">Cards</h2>
                <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <button
                    onClick={() => setIsLabelManagerOpen(true)}
                    className="text-xs sm:text-sm font-medium text-primary hover:text-primary-dark flex items-center gap-1 whitespace-nowrap bg-primary-light/30 px-3 py-1.5 rounded-lg"
                  >
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Automações
                  </button>
                  <button
                    onClick={() => setIsTeamManagerOpen(true)}
                    className="text-xs sm:text-sm font-medium text-primary hover:text-primary-dark flex items-center gap-1 whitespace-nowrap bg-primary-light/30 px-3 py-1.5 rounded-lg"
                  >
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Equipe
                  </button>
                  <button
                    onClick={() => setIsAddingCard(true)}
                    className="text-xs sm:text-sm font-medium text-primary hover:text-primary-dark flex items-center gap-1 whitespace-nowrap bg-primary/10 px-3 py-1.5 rounded-lg"
                  >
                    <FolderPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Novo Card
                  </button>
                </div>
              </div>

              {isAddingCard && (
                <motion.form
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={addCard}
                  className="flex gap-2 mb-6"
                >
                  <input
                    type="text"
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    placeholder="Nome do card..."
                    className="flex-1 rounded-lg border-slate-200 text-sm focus:ring-primary focus:border-primary"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingCard(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                </motion.form>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={cards.map(c => c.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex-1 flex gap-6 overflow-x-auto overflow-y-hidden pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {cards.map(card => {
                      const cardTasks = getFilteredTasks(card.id);
                      
                      return (
                        <DroppableCard 
                          key={card.id} 
                          card={card} 
                          tasks={cardTasks}
                          onToggleViewMode={toggleCardViewMode}
                          onDeleteCard={deleteCard}
                          onUpdateCard={updateCard}
                          onWidthChange={updateCardWidth}
                          editingCardId={editingCardId}
                          editingCardTitle={editingCardTitle}
                          setEditingCardId={setEditingCardId}
                          setEditingCardTitle={setEditingCardTitle}
                          cardsLength={cards.length}
                        >
                        <div className={cn(
                          "space-y-3 overflow-y-auto pr-1 flex-1 min-h-[100px] pb-24",
                          card.viewMode === 'list' && "space-y-1 pb-24"
                        )}>
                          <SortableContext
                            items={cardTasks.map(t => t.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {cardTasks.map(task => (
                              <SortableTaskCard
                                key={task.id}
                                task={task}
                                labels={labels}
                                teamMembers={teamMembers}
                                onToggle={toggleTask}
                                onDelete={deleteTask}
                                onEdit={setEditingTask}
                                onUpdateLabel={updateTaskLabel}
                                onUpdateAssignee={updateTaskAssignee}
                                onAddLabel={addLabel}
                                onAddMember={addTeamMember}
                                isCompact={card.viewMode === 'list'}
                              />
                            ))}
                          </SortableContext>
                            {cardTasks.length === 0 && (
                              <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl h-full flex items-center justify-center">
                                <p className="text-sm text-slate-400">Vazio</p>
                              </div>
                            )}
                          </div>

                          {/* Quick Task Input */}
                          <div className="mt-4 pt-4 border-t border-slate-100 flex-shrink-0">
                            <input
                              type="text"
                              placeholder="+ Adicionar tarefa rápida..."
                              className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 p-1"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                  addTask({
                                    title: e.currentTarget.value.trim(),
                                    description: '',
                                    dueDate: '',
                                    priority: 'medium',
                                    reminder: 'none',
                                    cardId: card.id,
                                  });
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                          </div>
                        </DroppableCard>
                      );
                    })}
                  </div>
                </SortableContext>

                <DragOverlay dropAnimation={dropAnimation}>
                  {activeDragTask ? (
                    <TaskCard
                      task={activeDragTask}
                      labels={labels}
                      teamMembers={teamMembers}
                      onUpdateLabel={updateTaskLabel}
                      onUpdateAssignee={updateTaskAssignee}
                      onAddLabel={addLabel}
                      onAddMember={addTeamMember}
                      onToggle={() => {}}
                      onDelete={() => {}}
                      onEdit={() => {}}
                    />
                  ) : null}
                  {activeDragCard ? (
                    <div 
                      style={{ width: activeDragCard.width ? `${activeDragCard.width}px` : '320px' }} 
                      className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-4 opacity-80 shadow-2xl"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <GripVertical className="w-4 h-4 text-slate-400" />
                        <h3 className="font-semibold text-slate-800">{activeDragCard.title}</h3>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </main>
        </div>

        {/* Edit Modal / Form */}
        <AnimatePresence>
          {editingTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            >
              <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl">
                <TaskForm
                  isEditing
                  initialData={editingTask}
                  onAdd={updateTask}
                  onCancel={() => setEditingTask(null)}
                  cards={cards}
                  labels={labels}
                  teamMembers={teamMembers}
                />
              </div>
            </motion.div>
          )}

          {isLabelManagerOpen && (
            <LabelAutomationManager
              labels={labels}
              automations={automations}
              cards={cards}
              teamMembers={teamMembers}
              onAddLabel={addLabel}
              onUpdateLabel={updateLabel}
              onDeleteLabel={deleteLabel}
              onAddAutomation={addAutomation}
              onDeleteAutomation={deleteAutomation}
              onClose={() => setIsLabelManagerOpen(false)}
            />
          )}

          {isTeamManagerOpen && (
            <TeamManager
              members={teamMembers}
              onAddMember={addTeamMember}
              onDeleteMember={deleteTeamMember}
              onClose={() => setIsTeamManagerOpen(false)}
            />
          )}
        </AnimatePresence>

        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    </div>
  );
}

