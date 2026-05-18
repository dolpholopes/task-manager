/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Task, Priority, Reminder, Card, Workspace, Label, Automation, AutomationTrigger, TeamMember, WorkspaceMember, Invite, StickyNote } from './types';
import { TaskCard } from './components/TaskCard';
import { TaskForm } from './components/TaskForm';
import { LabelAutomationManager } from './components/LabelAutomationManager';
import { TeamManager } from './components/TeamManager';
import { StickyNoteBoard } from './components/StickyNoteBoard';
import { CalendarView } from './components/CalendarView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Logo } from './components/Logo';
import { format } from 'date-fns';
import { LayoutGrid, ListTodo, CheckSquare, SlidersHorizontal, ArrowUpDown, FolderPlus, Trash2, MoreVertical, LogOut, GripVertical, Briefcase, Plus, ChevronRight, Download, Bell, BellOff, Tag, Zap, Users, PanelLeftClose, PanelLeft, Menu as MenuIcon, X, Pencil, Check, Pin, User as UserIcon, Search, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { requestNotificationPermission, sendNotification } from './lib/notifications';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch, updateDoc, query, where, collectionGroup, getDoc, getDocs } from 'firebase/firestore';
import { Share2, UserPlus, Shield, ShieldCheck, ShieldAlert, Copy, CheckCircle2, Link as LinkIcon } from 'lucide-react';
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
  onWidthChange: (id: string, width: number, workspaceId: string) => void;
  onTogglePin?: (id: string) => void;
  onUpdateAssignee?: (cardId: string, memberId: string | undefined) => void;
  editingCardId: string | null;
  editingCardTitle: string;
  setEditingCardId: (id: string | null) => void;
  setEditingCardTitle: (title: string) => void;
  cardsLength: number;
  canWrite: boolean;
  isAnyModalOpen: boolean;
  teamMembers?: TeamMember[];
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
  onTogglePin,
  onUpdateAssignee,
  editingCardId,
  editingCardTitle,
  setEditingCardId,
  setEditingCardTitle,
  cardsLength, 
  canWrite,
  isAnyModalOpen,
  teamMembers = [],
  children 
}) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'Card', card },
  });

  const [isAssigneeSelectorOpen, setIsAssigneeSelectorOpen] = React.useState(false);
  const cardAssignee = teamMembers.find(m => m.id === card.assigneeId);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    width: card.width ? `${card.width}px` : '320px',
  };

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isAssigneeSelectorOpen) return;
    const handleClickAway = () => setIsAssigneeSelectorOpen(false);
    window.addEventListener('click', handleClickAway);
    return () => window.removeEventListener('click', handleClickAway);
  }, [isAssigneeSelectorOpen]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.round(entry.contentRect.width + 32); // 32 is padding (p-4 = 16px * 2)
        if (Math.abs((card.width || 320) - newWidth) > 5) { // Threshold to prevent tiny updates
          onWidthChange(card.id, newWidth, card.workspaceId);
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [card.id, card.width, card.workspaceId, onWidthChange]);

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
      className="flex-shrink-0 min-w-[280px] max-w-[800px] bg-slate-50/50 rounded-2xl border border-slate-200/60 p-4 flex flex-col h-fit max-h-[calc(100vh-320px)] relative transition-colors hover:border-slate-300/80 group/card self-start"
    >
      {/* Custom Resize Handle */}
      {!isAnyModalOpen && (
        <div 
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.pageX;
            const startWidth = card.width || 320;
            
            const onMouseMove = (moveEvent: MouseEvent) => {
              const newWidth = startWidth + (moveEvent.pageX - startX);
              onWidthChange(card.id, Math.max(280, Math.min(800, newWidth)), card.workspaceId);
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
      )}
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
              if (!canWrite) return;
              setEditingCardId(card.id);
              setEditingCardTitle(card.title);
            }}
            className={cn(
              "text-slate-400 p-1 rounded-md transition-colors",
              canWrite ? "hover:text-primary hover:bg-primary-light cursor-pointer" : "opacity-30 cursor-not-allowed"
            )}
            title="Editar título"
            disabled={!canWrite}
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
          {cardsLength > 1 && canWrite && (
            <button
              onClick={() => onDeleteCard(card.id)}
              className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors"
              title="Excluir card"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {canWrite && onTogglePin && (
            <button
              onClick={() => onTogglePin(card.id)}
              className={cn(
                "p-1 rounded-md transition-colors",
                card.isPinned ? "text-primary bg-primary-light/50" : "text-slate-400 hover:text-primary hover:bg-primary-light"
              )}
              title={card.isPinned ? "Desafixar card" : "Fixar card"}
            >
              <Pin className={cn("w-4 h-4", card.isPinned && "fill-current")} />
            </button>
          )}
        </div>
      </div>

      {/* Card-level Assignee */}
      {canWrite && onUpdateAssignee && teamMembers.length > 0 && (
        <div className="mb-4 flex items-center justify-between bg-slate-100/50 rounded-xl p-2 border border-slate-200/50">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
            <UserIcon className="w-3 h-3" />
            <span>Responsável do Card</span>
          </div>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAssigneeSelectorOpen(!isAssigneeSelectorOpen);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 h-6 rounded-lg text-[10px] font-bold uppercase shadow-sm transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-200 active:scale-95",
                cardAssignee ? "text-white" : "bg-white text-slate-400 border border-slate-200"
              )}
              style={cardAssignee ? { backgroundColor: cardAssignee.color } : {}}
            >
              <span className="truncate max-w-[80px]">{cardAssignee ? cardAssignee.name : "Atribuir Todos"}</span>
              <Plus className="w-3 h-3" />
            </button>

            <AnimatePresence>
              {isAssigneeSelectorOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  className="absolute right-0 top-full mt-2 z-[150] bg-white shadow-2xl rounded-xl border border-slate-200 p-2 min-w-[200px]"
                  onClick={e => e.stopPropagation()}
                >
                  <p className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100 mb-1">Escolha o responsável para todas as tarefas</p>
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                    <button
                      onClick={() => {
                        onUpdateAssignee(card.id, undefined);
                        setIsAssigneeSelectorOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg flex items-center justify-between"
                    >
                      Remover Todos
                      {!card.assigneeId && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                    </button>
                    {teamMembers.map(member => (
                      <button
                        key={member.id}
                        onClick={() => {
                          onUpdateAssignee(card.id, member.id);
                          setIsAssigneeSelectorOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                      >
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px] shadow-sm flex-shrink-0" style={{ backgroundColor: member.color }}>
                          {member.name.charAt(0)}
                        </div>
                        <span className="flex-1 truncate">{member.name}</span>
                        {card.assigneeId === member.id && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeWorkspaceMember, setActiveWorkspaceMember] = useState<WorkspaceMember | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [activeTab, setActiveTab] = useState<'cards' | 'notes' | 'calendar'>('cards');
  const [noteSearch, setNoteSearch] = useState('');
  const [noteColorFilter, setNoteColorFilter] = useState<string | null>(null);
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [isJoinWorkspaceOpen, setIsJoinWorkspaceOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isSharingWorkspace, setIsSharingWorkspace] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState<'editor' | 'viewer' | null>(null);
  const [copiedInviteCode, setCopiedInviteCode] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
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

  const widthTimeouts = React.useRef<{ [key: string]: NodeJS.Timeout }>({});
  const deletingWorkspaces = React.useRef<Set<string>>(new Set());

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

  const handleJoinWorkspace = async (codeToJoin?: string, userOverride?: User | null) => {
    const finalCode = (codeToJoin || joinCode).trim();
    const currentUser = userOverride || user;
    if (!finalCode || !currentUser) return;

    try {
      const inviteDoc = await getDoc(doc(db, 'invites', finalCode));
      if (!inviteDoc.exists()) {
        if (!codeToJoin) alert('Código de convite inválido.');
        return;
      }

      const invite = inviteDoc.data() as Invite;
      const workspaceId = invite.workspaceId;

      // Check if already a member
      const memberDoc = await getDoc(doc(db, `workspaces/${workspaceId}/members`, currentUser.uid));
      if (memberDoc.exists()) {
        setActiveWorkspaceId(workspaceId);
        setIsJoinWorkspaceOpen(false);
        setJoinCode('');
        return;
      }

      const member: WorkspaceMember = {
        userId: currentUser.uid,
        email: currentUser.email || '',
        name: currentUser.displayName || 'Usuário',
        photoURL: currentUser.photoURL || undefined,
        role: invite.role,
        joinedAt: Date.now()
      };

      const batch = writeBatch(db);
      batch.set(doc(db, `workspaces/${workspaceId}/members`, currentUser.uid), member);
      batch.set(doc(db, `users/${currentUser.uid}/memberships`, workspaceId), member);
      await batch.commit();
      
      setActiveWorkspaceId(workspaceId);
      setIsJoinWorkspaceOpen(false);
      setJoinCode('');

      // Clear invite from URL
      const url = new URL(window.location.href);
      if (url.searchParams.has('invite')) {
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (error) {
      console.error("Error joining workspace:", error);
    }
  };

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

      // Check for invitation in URL or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const inviteFromUrl = urlParams.get('invite');
      
      if (inviteFromUrl) {
        localStorage.setItem('pending_invite', inviteFromUrl);
      }

      const pendingInvite = localStorage.getItem('pending_invite');
      if (currentUser && pendingInvite) {
        // We await the join to ensure memberships are updated before the workspace listener decides to create a default one
        handleJoinWorkspace(pendingInvite, currentUser).then(() => {
          localStorage.removeItem('pending_invite');
        }).catch(err => {
          console.error("Failed to join from pending invite:", err);
          localStorage.removeItem('pending_invite');
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      console.log('PWA was installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const canWrite = activeWorkspaceMember?.role === 'owner' || activeWorkspaceMember?.role === 'editor';
  const isOwner = activeWorkspaceMember?.role === 'owner';
  const isAdmin = activeWorkspaceMember?.role === 'owner';
  
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const isAnyModalOpen = !!(
    editingTask || 
    isLabelManagerOpen || 
    isTeamManagerOpen || 
    isAddingWorkspace || 
    isJoinWorkspaceOpen || 
    isSharingWorkspace || 
    confirmDialog.isOpen || 
    isAddingCard
  );

  // Fetch Workspaces where user is a member
  useEffect(() => {
    if (!user || !isAuthReady) return;
    
    let isCurrent = true;

    // We listen to the user's memberships to avoid Collection Group index requirements
    const unsubscribe = onSnapshot(collection(db, `users/${user.uid}/memberships`), async (snapshot) => {
      const workspaceIds = snapshot.docs.map(d => d.id).filter(id => !deletingWorkspaces.current.has(id));
      
      const hasPendingInvite = localStorage.getItem('pending_invite');

      if (workspaceIds.length === 0 && deletingWorkspaces.current.size === 0 && !hasPendingInvite) {
        if (!isCurrent) return;
        // Create initial workspace
        const wsId = crypto.randomUUID();
        const defaultWorkspace: Workspace = {
          id: wsId,
          title: 'Meu Trabalho',
          ownerId: user.uid,
          order: 0,
          createdAt: Date.now()
        };
        const member: WorkspaceMember = {
          userId: user.uid,
          email: user.email || '',
          name: user.displayName || 'Usuário',
          photoURL: user.photoURL || undefined,
          role: 'owner',
          joinedAt: Date.now()
        };

        const batch = writeBatch(db);
        batch.set(doc(db, 'workspaces', wsId), defaultWorkspace);
        batch.set(doc(db, `workspaces/${wsId}/members`, user.uid), member);
        batch.set(doc(db, `users/${user.uid}/memberships`, wsId), member);
        await batch.commit();
        if (isCurrent) setActiveWorkspaceId(wsId);
      } else {
        // Fetch full workspace data for these IDs
        const loadedWorkspaces: Workspace[] = [];
        for (const id of workspaceIds) {
          const wsDoc = await getDoc(doc(db, 'workspaces', id));
          if (!isCurrent) return;
          if (wsDoc.exists()) {
            loadedWorkspaces.push(wsDoc.data() as Workspace);
          }
        }
        if (isCurrent) {
          loadedWorkspaces.sort((a, b) => a.order - b.order);
          setWorkspaces(loadedWorkspaces);
          if (!activeWorkspaceId || !workspaceIds.includes(activeWorkspaceId)) {
            setActiveWorkspaceId(loadedWorkspaces[0].id);
          }
        }
      }
    }, (error) => {
      console.error("Firestore Error (Workspaces): ", error);
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [user, isAuthReady]);

  // Fetch Current Member Data & Workspace Members
  useEffect(() => {
    if (!user || !activeWorkspaceId) {
      setActiveWorkspaceMember(null);
      setWorkspaceMembers([]);
      return;
    }

    // Clear previous before fetching new
    setActiveWorkspaceMember(null);
    setWorkspaceMembers([]);

    const memberUnsubscribe = onSnapshot(doc(db, `workspaces/${activeWorkspaceId}/members`, user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setActiveWorkspaceMember(snapshot.data() as WorkspaceMember);
      }
    });

    const membersUnsubscribe = onSnapshot(collection(db, `workspaces/${activeWorkspaceId}/members`), (snapshot) => {
      const members: WorkspaceMember[] = [];
      snapshot.forEach(doc => members.push(doc.data() as WorkspaceMember));
      setWorkspaceMembers(members);
    });

    return () => {
      memberUnsubscribe();
      membersUnsubscribe();
    };
  }, [user, activeWorkspaceId]);

  // Fetch Cards and Tasks for active workspace
  useEffect(() => {
    if (!user || !isAuthReady || !activeWorkspaceId) return;
    
    const cardsUnsubscribe = onSnapshot(collection(db, `workspaces/${activeWorkspaceId}/cards`), (snapshot) => {
      const loadedCards: Card[] = [];
      snapshot.forEach(doc => {
        loadedCards.push(doc.data() as Card);
      });
      
      if (loadedCards.length === 0) {
        const defaultCards: Card[] = [
          { id: crypto.randomUUID(), title: 'A Fazer', viewMode: 'card', order: 0, workspaceId: activeWorkspaceId },
          { id: crypto.randomUUID(), title: 'Em Progresso', viewMode: 'card', order: 1, workspaceId: activeWorkspaceId },
          { id: crypto.randomUUID(), title: 'Concluído', viewMode: 'card', order: 2, workspaceId: activeWorkspaceId }
        ];
        setCards(defaultCards);
        if (canWrite) {
          defaultCards.forEach(c => {
            setDoc(doc(db, `workspaces/${activeWorkspaceId}/cards`, c.id), c);
          });
        }
      } else {
        loadedCards.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (a.order ?? 0) - (b.order ?? 0);
        });
        setCards(loadedCards);
      }
    }, (error) => {
      console.error("Firestore Error (Cards): ", error);
    });

    const tasksUnsubscribe = onSnapshot(collection(db, `workspaces/${activeWorkspaceId}/tasks`), (snapshot) => {
      const loadedTasks: Task[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      loadedTasks.sort((a, b) => (a.order || 0) - (b.order || 0));
      setTasks(loadedTasks);
    }, (error) => {
      console.error("Firestore Error (Tasks): ", error);
    });

    const labelsUnsubscribe = onSnapshot(collection(db, `workspaces/${activeWorkspaceId}/labels`), (snapshot) => {
      const loadedLabels: Label[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Label[];
      setLabels(loadedLabels);
    }, (error) => {
      console.error("Firestore Error (Labels): ", error);
    });

    const teamUnsubscribe = onSnapshot(collection(db, `workspaces/${activeWorkspaceId}/team_members`), (snapshot) => {
      const loadedMembers: TeamMember[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamMember[];
      setTeamMembers(loadedMembers);
    }, (error) => {
      console.error("Firestore Error (Team): ", error);
    });

    const automationsUnsubscribe = onSnapshot(collection(db, `workspaces/${activeWorkspaceId}/automations`), (snapshot) => {
      const loadedAutomations: Automation[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Automation[];
      setAutomations(loadedAutomations);
    }, (error) => {
      console.error("Firestore Error (Automations): ", error);
    });

    const notesUnsubscribe = onSnapshot(collection(db, `workspaces/${activeWorkspaceId}/notes`), (snapshot) => {
      const loadedNotes: StickyNote[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StickyNote[];
      setNotes(loadedNotes);
    }, (error) => {
      console.error("Firestore Error (Notes): ", error);
    });

    return () => {
      cardsUnsubscribe();
      tasksUnsubscribe();
      labelsUnsubscribe();
      teamUnsubscribe();
      automationsUnsubscribe();
      notesUnsubscribe();
    };
  }, [user, isAuthReady, activeWorkspaceId, canWrite]);

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
          updateDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, task.id), { reminderSent: true })
            .catch(err => console.error("Error updating reminder status:", err));
        }
      });

      // Sticky Note Reminders
      notes.forEach(note => {
        if (!note.reminderDate || !note.reminderTime || note.reminderSent) return;

        const [year, month, day] = note.reminderDate.split('-').map(Number);
        const [hour, minute] = note.reminderTime.split(':').map(Number);
        const reminderTimeObj = new Date(year, month - 1, day, hour, minute, 0);

        if (now >= reminderTimeObj) {
          sendNotification(`Lembrete de Anotação`, note.content.slice(0, 50) + (note.content.length > 50 ? '...' : ''));
          updateDoc(doc(db, `workspaces/${activeWorkspaceId}/notes`, note.id), { reminderSent: true })
            .catch(err => console.error("Error updating note reminder status:", err));
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
    
    const wsId = crypto.randomUUID();
    const newWorkspace: Workspace = {
      id: wsId,
      title: newWorkspaceTitle.trim(),
      ownerId: user.uid,
      order: workspaces.length,
      createdAt: Date.now()
    };
    const member: WorkspaceMember = {
      userId: user.uid,
      email: user.email || '',
      name: user.displayName || 'Usuário',
      photoURL: user.photoURL || undefined,
      role: 'owner',
      joinedAt: Date.now()
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'workspaces', wsId), newWorkspace);
    batch.set(doc(db, `workspaces/${wsId}/members`, user.uid), member);
    batch.set(doc(db, `users/${user.uid}/memberships`, wsId), member);
    await batch.commit();

    setNewWorkspaceTitle('');
    setIsAddingWorkspace(false);
    setActiveWorkspaceId(wsId);
  };

  const joinWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    handleJoinWorkspace();
  };

  const generateInviteCode = async (role: 'editor' | 'viewer') => {
    if (!activeWorkspaceId || !isOwner) return;
    setIsGeneratingInvite(role);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const invite: Invite = {
        workspaceId: activeWorkspaceId,
        code,
        role
      };

      await setDoc(doc(db, 'invites', code), invite);
      await updateDoc(doc(db, 'workspaces', activeWorkspaceId), { 
        inviteCode: code,
        inviteRole: role
      });
    } catch (error) {
      console.error("Error generating invite:", error);
    } finally {
      setIsGeneratingInvite(null);
    }
  };

  const updateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspaceTitle.trim() || !user || !editingWorkspaceId || !isOwner) return;
    await updateDoc(doc(db, 'workspaces', editingWorkspaceId), { 
      title: editingWorkspaceTitle.trim() 
    });
    setEditingWorkspaceId(null);
    setEditingWorkspaceTitle('');
  };

  const updateWorkspaceMemberRole = async (targetUserId: string, newRole: 'editor' | 'viewer') => {
    if (!activeWorkspaceId || !isOwner || targetUserId === user?.uid) return;
    
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, `workspaces/${activeWorkspaceId}/members`, targetUserId), { role: newRole });
      batch.update(doc(db, `users/${targetUserId}/memberships`, activeWorkspaceId), { role: newRole });
      await batch.commit();
    } catch (err) {
      console.error("Error updating member role:", err);
    }
  };

  const deleteWorkspace = async (id: string) => {
    if (!user || workspaces.length <= 1 || !isOwner) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Área de Trabalho',
      message: 'Tem certeza? Todos os cards e tarefas desta área de trabalho serão excluídas permanentemente para todos os membros.',
      variant: 'danger',
      onConfirm: async () => {
        deletingWorkspaces.current.add(id);
        
        // Optimistic update
        const nextWorkspace = workspaces.find(w => w.id !== id);
        setWorkspaces(prev => prev.filter(w => w.id !== id));
        
        if (activeWorkspaceId === id) {
          setActiveWorkspaceId(nextWorkspace?.id || null);
        }

        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'workspaces', id));
          batch.delete(doc(db, `users/${user.uid}/memberships`, id));
          await batch.commit();
        } catch (error) {
          console.error("Error deleting workspace:", error);
          deletingWorkspaces.current.delete(id);
        } finally {
          // Cleanup after some time to allow Firestore propagation
          setTimeout(() => {
            deletingWorkspaces.current.delete(id);
          }, 2000);
        }
      }
    });
  };

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim() || !user || !activeWorkspaceId || !canWrite) return;
    const newCard: Card = { 
      id: crypto.randomUUID(), 
      title: newCardTitle.trim(),
      viewMode: 'card',
      order: cards.length,
      workspaceId: activeWorkspaceId
    };
    await setDoc(doc(db, `workspaces/${activeWorkspaceId}/cards`, newCard.id), newCard);
    setNewCardTitle('');
    setIsAddingCard(false);
  };

  const updateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCardTitle.trim() || !user || !editingCardId || !activeWorkspaceId || !canWrite) return;
    await updateDoc(doc(db, `workspaces/${activeWorkspaceId}/cards`, editingCardId), { 
      title: editingCardTitle.trim() 
    });
    setEditingCardId(null);
    setEditingCardTitle('');
  };

  const deleteCard = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    if (cards.length <= 1) {
      setConfirmDialog({
        isOpen: true,
        title: 'Ação Não Permitida',
        message: 'Você não pode excluir o único card existente.',
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
          batch.set(doc(db, `workspaces/${activeWorkspaceId}/tasks`, t.id), { ...t, cardId: fallbackCardId });
        });
        batch.delete(doc(db, `workspaces/${activeWorkspaceId}/cards`, id));
        await batch.commit();
      }
    });
  };

  const toggleCardViewMode = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const card = cards.find(c => c.id === id);
    if (card) {
      await updateDoc(doc(db, `workspaces/${activeWorkspaceId}/cards`, id), { viewMode: card.viewMode === 'list' ? 'card' : 'list' });
    }
  };

  const addTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'completed' | 'reminderSent' | 'workspaceId' | 'order'>) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    let finalCardId = taskData.cardId;
    
    if (!cards.find(c => c.id === finalCardId)) {
      if (cards.length > 0) {
         finalCardId = cards[0].id;
      } else {
         return;
      }
    }

    const minOrder = tasks.length > 0 ? Math.min(...tasks.map(t => t.order || 0)) : 0;

    const card = cards.find(c => c.id === finalCardId);
    const assigneeId = taskData.assigneeId || card?.assigneeId;

    const newTask: Task = {
      ...taskData,
      assigneeId,
      cardId: finalCardId,
      workspaceId: activeWorkspaceId,
      id: crypto.randomUUID(),
      completed: false,
      reminderSent: false,
      createdAt: Date.now(),
      order: minOrder - 1000,
    };
    
    const cleanTask = Object.fromEntries(Object.entries(newTask).filter(([_, v]) => v !== undefined));
    await setDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, newTask.id), cleanTask);
    runAutomations(newTask, 'task_created');
  };

  const updateTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'completed' | 'reminderSent' | 'workspaceId' | 'order'>) => {
    if (!editingTask || !user || !activeWorkspaceId || !canWrite) return;
    const updatedTask = { ...editingTask, ...taskData, reminderSent: false };
    const cleanTask = Object.fromEntries(Object.entries(updatedTask).filter(([_, v]) => v !== undefined));
    await setDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, updatedTask.id), cleanTask);
    setEditingTask(null);
  };

  const runAutomations = async (task: Task, trigger: AutomationTrigger, details?: { cardId?: string, memberId?: string }) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    
    const matchingAutomations = automations.filter(auto => 
      auto.enabled && 
      auto.trigger === trigger && 
      (trigger !== 'task_moved_to_card' || auto.triggerCardId === details?.cardId) &&
      (trigger !== 'task_assigned' || !auto.triggerMemberId || auto.triggerMemberId === details?.memberId)
    );

    if (matchingAutomations.length === 0) return;

    for (const auto of matchingAutomations) {
      if (auto.action === 'change_label' && auto.actionLabelId) {
        await updateDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, task.id), { labelId: auto.actionLabelId });
      } else if (auto.action === 'assign_member' && auto.actionMemberId) {
        await updateDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, task.id), { assigneeId: auto.actionMemberId });
      }
    }
  };

  const toggleTask = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const task = tasks.find(t => t.id === id);
    if (task) {
      const newCompleted = !task.completed;
      const updateData: any = { completed: newCompleted };
      
      if (newCompleted) {
        const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order || 0)) : 0;
        updateData.order = maxOrder + 1000;
      }
      
      await updateDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, id), updateData);
      if (newCompleted) runAutomations(task, 'task_completed');
    }
  };

  const deleteTask = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    await deleteDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, id));
  };

  const updateCardWidth = (id: string, width: number, workspaceId: string) => {
    if (!user || !workspaceId || !canWrite) return;
    setCards(prev => prev.map(c => c.id === id ? { ...c, width } : c));

    if (widthTimeouts.current[id]) clearTimeout(widthTimeouts.current[id]);

    widthTimeouts.current[id] = setTimeout(async () => {
      try {
        await updateDoc(doc(db, `workspaces/${workspaceId}/cards`, id), { width });
      } catch (error) {
        console.error("Error updating card width:", error);
      }
      delete widthTimeouts.current[id];
    }, 500);
  };

  const addLabel = async (name: string, color: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const newLabel: Label = { id: crypto.randomUUID(), name, color };
    await setDoc(doc(db, `workspaces/${activeWorkspaceId}/labels`, newLabel.id), newLabel);
  };

  const updateLabel = async (id: string, name: string, color: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    await updateDoc(doc(db, `workspaces/${activeWorkspaceId}/labels`, id), { name, color });
  };

  const deleteLabel = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    await deleteDoc(doc(db, `workspaces/${activeWorkspaceId}/labels`, id));
  };

  const addAutomation = async (autoData: Omit<Automation, 'id'>) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const newAuto: Automation = { ...autoData, id: crypto.randomUUID() };
    const cleanAuto = Object.fromEntries(Object.entries(newAuto).filter(([_, v]) => v !== undefined));
    await setDoc(doc(db, `workspaces/${activeWorkspaceId}/automations`, newAuto.id), cleanAuto);
  };

  const deleteAutomation = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    await deleteDoc(doc(db, `workspaces/${activeWorkspaceId}/automations`, id));
  };

  const addTeamMember = async (name: string, color: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const newMember: TeamMember = { id: crypto.randomUUID(), name, color };
    await setDoc(doc(db, `workspaces/${activeWorkspaceId}/team_members`, newMember.id), newMember);
  };

  const deleteTeamMember = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    await deleteDoc(doc(db, `workspaces/${activeWorkspaceId}/team_members`, id));
  };

  const updateTaskAssignee = async (taskId: string, memberId: string | undefined) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedTask = { ...task, assigneeId: memberId || undefined };
      const cleanTask = Object.fromEntries(Object.entries(updatedTask).filter(([_, v]) => v !== undefined));
      await setDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, taskId), cleanTask);
      if (memberId) runAutomations(updatedTask as Task, 'task_assigned', { memberId });
    }
  };

  const updateTaskLabel = async (taskId: string, labelId: string | undefined) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedTask = { ...task, labelId: labelId || undefined };
      const cleanTask = Object.fromEntries(Object.entries(updatedTask).filter(([_, v]) => v !== undefined));
      await setDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, taskId), cleanTask);
    }
  };

  const toggleTaskPin = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const task = tasks.find(t => t.id === id);
    if (task) {
      await updateDoc(doc(db, `workspaces/${activeWorkspaceId}/tasks`, id), { isPinned: !task.isPinned });
    }
  };

  const toggleCardPin = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const card = cards.find(c => c.id === id);
    if (card) {
      await updateDoc(doc(db, `workspaces/${activeWorkspaceId}/cards`, id), { isPinned: !card.isPinned });
    }
  };

  const updateCardAssignee = async (cardId: string, memberId: string | undefined) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    
    try {
      const batch = writeBatch(db);
      // Update card
      batch.update(doc(db, `workspaces/${activeWorkspaceId}/cards`, cardId), { assigneeId: memberId || null });
      
      // Update all tasks in card
      const cardTasks = tasks.filter(t => t.cardId === cardId);
      cardTasks.forEach(t => {
        batch.update(doc(db, `workspaces/${activeWorkspaceId}/tasks`, t.id), { assigneeId: memberId || null });
      });
      
      await batch.commit();
      
      // Run automations for each task if assigned
      if (memberId) {
        cardTasks.forEach(t => {
          runAutomations({ ...t, assigneeId: memberId }, 'task_assigned', { memberId });
        });
      }
    } catch (err) {
      console.error("Error updating card assignee:", err);
    }
  };

  const addNote = async () => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    const newNote: StickyNote = {
      id: crypto.randomUUID(),
      content: '',
      color: 'bg-[#fef3c7]',
      workspaceId: activeWorkspaceId,
      calendarDate: format(new Date(), 'yyyy-MM-dd'),
      createdAt: Date.now(),
      order: 0
    };
    await setDoc(doc(db, `workspaces/${activeWorkspaceId}/notes`, newNote.id), newNote);
  };

  const updateNote = async (id: string, data: Partial<StickyNote>) => {
    const wsId = data.workspaceId || activeWorkspaceId;
    if (!user || !wsId || !canWrite) return;
    const cleanData = { ...data };
    delete cleanData.workspaceId; // Don't try to update workspaceId field itself
    await updateDoc(doc(db, `workspaces/${wsId}/notes`, id), cleanData);
  };

  const deleteNote = async (id: string) => {
    if (!user || !activeWorkspaceId || !canWrite) return;
    await deleteDoc(doc(db, `workspaces/${activeWorkspaceId}/notes`, id));
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
        // Pinned tasks always first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

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
      if (!isOwner) return;
      // Update order in Firestore based on current state (already updated in onDragOver)
      const batch = writeBatch(db);
      cards.forEach((c, index) => {
        batch.update(doc(db, `workspaces/${activeWorkspaceId}/cards`, c.id), { order: index });
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
        batch.update(doc(db, `workspaces/${activeWorkspaceId}/tasks`, t.id), { 
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
              onClick={handleRequestPermission}
              title={
                notificationPermission === 'granted' 
                  ? 'Notificações Ativadas' 
                  : notificationPermission === 'denied' 
                    ? 'Notificações Bloqueadas' 
                    : 'Ativar Notificações'
              }
              className={cn(
                "p-2 rounded-xl transition-all border shadow-sm bg-white",
                notificationPermission === 'granted'
                  ? "border-emerald-100 text-emerald-600 hover:bg-emerald-50"
                  : notificationPermission === 'denied'
                    ? "border-slate-200 text-slate-400 opacity-40 cursor-not-allowed"
                    : "border-slate-200 text-slate-400 hover:text-primary hover:border-primary-light hover:bg-primary-light/10"
              )}
            >
              {notificationPermission === 'granted' ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
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
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setIsJoinWorkspaceOpen(true)}
                        className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-primary transition-colors"
                        title="Entrar com código"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setIsAddingWorkspace(true)}
                        className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-primary transition-colors"
                        title="Criar nova"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {isJoinWorkspaceOpen && !isSidebarCollapsed && (
                  <form onSubmit={joinWorkspace} className="px-2 mb-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="Código..."
                        className="flex-1 text-sm rounded-lg border-slate-200 focus:ring-primary focus:border-primary p-2 h-9"
                        autoFocus
                      />
                      <button type="submit" className="p-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setIsJoinWorkspaceOpen(false)} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                )}

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
                        "group flex flex-col px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer",
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
                      <div className="flex items-center justify-between w-full">
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
                            <div className="flex flex-col truncate">
                              <span className={cn("truncate", isSidebarCollapsed && "lg:hidden")}>{ws.title}</span>
                              {!isSidebarCollapsed && ws.ownerId !== user.uid && (
                                <span className="text-[9px] opacity-70 uppercase tracking-tighter">Compartilhada</span>
                              )}
                            </div>
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
                                {ws.ownerId === user.uid && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingWorkspaceId(ws.id);
                                      setEditingWorkspaceTitle(ws.title);
                                    }}
                                    className={cn(
                                      "p-1 rounded-md transition-all opacity-0 group-hover:opacity-100",
                                      activeWorkspaceId === ws.id ? "hover:bg-primary-dark text-primary-light" : "hover:bg-slate-200 text-slate-400"
                                    )}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {ws.ownerId === user.uid && workspaces.length > 1 && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteWorkspace(ws.id);
                                    }}
                                    className={cn(
                                      "p-1 rounded-md transition-all opacity-0 group-hover:opacity-100",
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

                      {/* Active Workspace Detailed Info in Sidebar */}
                      {!isSidebarCollapsed && activeWorkspaceId === ws.id && (
                        <div className="mt-3 pt-3 border-t border-primary-dark/30 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex flex-wrap gap-1">
                            {activeWorkspaceMember?.role === 'owner' && (
                              <span className="flex items-center gap-1 text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                <ShieldCheck className="w-2.5 h-2.5" /> PROPRIETÁRIO
                              </span>
                            )}
                            {activeWorkspaceMember?.role === 'editor' && (
                              <span className="flex items-center gap-1 text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                <Shield className="w-2.5 h-2.5" /> EDITOR
                              </span>
                            )}
                            {activeWorkspaceMember?.role === 'viewer' && (
                              <span className="flex items-center gap-1 text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                <ShieldAlert className="w-2.5 h-2.5" /> VISUALIZADOR
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex -space-x-1.5">
                              {workspaceMembers.slice(0, 3).map(m => (
                                <div 
                                  key={m.userId} 
                                  className="w-5 h-5 rounded-full border border-primary bg-white/20 flex items-center justify-center overflow-hidden"
                                  title={`${m.name} (${m.role})`}
                                >
                                  {m.photoURL ? (
                                    <img src={m.photoURL} alt={m.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-bold text-white">{m.name.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                              ))}
                              {workspaceMembers.length > 3 && (
                                <div className="w-5 h-5 rounded-full border border-primary bg-primary-dark flex items-center justify-center text-[8px] font-bold text-white">
                                  +{workspaceMembers.length - 3}
                                </div>
                              )}
                            </div>
                            {isOwner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsSharingWorkspace(true);
                                }}
                                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md text-[10px] font-bold transition-colors"
                              >
                                <Share2 className="w-3 h-3" />
                                Acesso
                              </button>
                            )}
                          </div>
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => signOut(auth)}
                        className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                      >
                        <LogOut className="w-3 h-3" />
                        Sair
                      </button>
                      <span className="text-slate-200">|</span>
                      <button
                        onClick={handleRequestPermission}
                        className={cn(
                          "transition-colors",
                          notificationPermission === 'granted' ? "text-emerald-500" : "text-slate-400 hover:text-primary"
                        )}
                        title="Configurar Notificações"
                      >
                        {notificationPermission === 'granted' ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className={cn("flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-all duration-300", isSidebarCollapsed ? "lg:ml-4" : "")}>
            
            {/* Filters and Sort Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 md:p-1.5 rounded-2xl border border-slate-100 shadow-sm mt-2 mb-6 transition-all hover:border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 w-full">
                {/* Workspace Title in Toolbar */}
                <div className="flex items-center gap-3 pr-4 md:border-r border-slate-100 md:h-8">
                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary flex-shrink-0">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-xs font-bold text-slate-800 tracking-tight whitespace-nowrap">
                    {workspaces.find(w => w.id === activeWorkspaceId)?.title || 'Área de Trabalho'}
                  </h2>
                </div>

                {activeTab === 'cards' ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 pr-3 md:border-r border-slate-100">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
                        className="text-[11px] border-none bg-transparent focus:ring-0 text-slate-600 font-bold cursor-pointer p-0"
                      >
                        <option value="all">Prioridades</option>
                        <option value="high">Alta</option>
                        <option value="medium">Média</option>
                        <option value="low">Baixa</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="text-[11px] border-none bg-transparent focus:ring-0 text-slate-600 font-bold cursor-pointer p-0"
                      >
                        <option value="order">Ordem</option>
                        <option value="createdAt">Antigas</option>
                        <option value="dueDate">Vencimento</option>
                        <option value="priority">Prioridade</option>
                      </select>
                    </div>
                  </div>
                ) : activeTab === 'notes' ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
                    <div className="relative group w-full sm:w-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-colors" />
                      <input
                        type="text"
                        placeholder="Pesquisar notas..."
                        value={noteSearch}
                        onChange={(e) => setNoteSearch(e.target.value)}
                        className="pl-9 pr-4 py-1.5 bg-slate-50 border-none rounded-xl text-xs focus:ring-4 focus:ring-primary/10 transition-all w-full sm:w-[220px] shadow-sm font-medium"
                      />
                    </div>
                    
                    <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl overflow-x-auto max-w-full scrollbar-none">
                      <button 
                        onClick={() => setNoteColorFilter(null)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-bold transition-all uppercase flex-shrink-0",
                          !noteColorFilter ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        Todas
                      </button>
                      {[
                        'bg-[#fef3c7]', 'bg-[#dbeafe]', 'bg-[#dcfce7]', 
                        'bg-[#fce7f3]', 'bg-[#f3e8ff]', 'bg-[#ffedd5]'
                      ].map((color) => (
                        <button
                          key={color}
                          onClick={() => setNoteColorFilter(noteColorFilter === color ? null : color)}
                          className={cn(
                            "w-5 h-5 rounded-lg border-2 transition-all hover:scale-110 flex-shrink-0",
                            color,
                            noteColorFilter === color ? "border-slate-800 shadow-md" : "border-transparent"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
                    <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-bold text-primary">Calendário Integrado</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cards & Task Lists Toggle and Actions */}
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 px-1">
                <div className="flex items-center justify-between md:justify-start gap-4">
                  <div className="flex items-center p-1 bg-slate-100 rounded-2xl overflow-hidden shadow-inner">
                    <button
                      onClick={() => setActiveTab('cards')}
                      className={cn(
                        "px-4 py-2 text-[11px] font-bold rounded-xl transition-all",
                        activeTab === 'cards' 
                          ? "bg-white text-slate-800 shadow-sm" 
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Cards
                      <span className="ml-1.5 opacity-40">{cards.length}</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('notes')}
                      className={cn(
                        "px-4 py-2 text-[11px] font-bold rounded-xl transition-all",
                        activeTab === 'notes' 
                          ? "bg-white text-slate-800 shadow-sm" 
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Anotações
                      <span className="ml-1.5 opacity-40">{notes.length}</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('calendar')}
                      className={cn(
                        "px-4 py-2 text-[11px] font-bold rounded-xl transition-all",
                        activeTab === 'calendar' 
                          ? "bg-white text-slate-800 shadow-sm" 
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Calendário
                    </button>
                  </div>

                  {canWrite && activeTab === 'notes' && (
                    <button
                      onClick={addNote}
                      className="md:hidden flex items-center justify-center p-2.5 bg-slate-900 text-white rounded-xl shadow-lg active:scale-95 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                  {canWrite && activeTab === 'cards' && (
                    <>
                      <button
                        onClick={() => setIsLabelManagerOpen(true)}
                        className="text-[11px] font-bold text-primary hover:text-primary-dark flex items-center gap-2 whitespace-nowrap bg-primary-light/40 px-4 py-2.5 rounded-xl transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Automações
                      </button>
                      <button
                        onClick={() => setIsTeamManagerOpen(true)}
                        className="text-[11px] font-bold text-primary hover:text-primary-dark flex items-center gap-2 whitespace-nowrap bg-primary-light/40 px-4 py-2.5 rounded-xl transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Equipe
                      </button>
                      <button
                        onClick={() => setIsAddingCard(true)}
                        className="text-[11px] font-bold text-white bg-primary hover:bg-primary-dark flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl transition-all shadow-md shadow-primary/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Novo Card
                      </button>
                    </>
                  )}
                  {canWrite && activeTab === 'notes' && (
                    <button
                      onClick={addNote}
                      className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-slate-800 active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Nova Anotação
                    </button>
                  )}
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

              {activeTab === 'cards' ? (
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
                          onTogglePin={toggleCardPin}
                          onUpdateAssignee={updateCardAssignee}
                          editingCardId={editingCardId}
                          editingCardTitle={editingCardTitle}
                          setEditingCardId={setEditingCardId}
                          setEditingCardTitle={setEditingCardTitle}
                          cardsLength={cards.length}
                          canWrite={canWrite}
                          isAnyModalOpen={isAnyModalOpen}
                          teamMembers={teamMembers}
                        >
                        <div className={cn(
                          "space-y-3 overflow-y-auto pr-1 flex-1 min-h-[100px] mb-2 px-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent",
                          card.viewMode === 'list' && "space-y-1 mb-2"
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
                                onTogglePin={toggleTaskPin}
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
                          {canWrite && (
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
                          )}
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
            ) : activeTab === 'notes' ? (
              <div className="flex-1 overflow-hidden bg-white/40 rounded-3xl border border-slate-100/50">
                <StickyNoteBoard
                  notes={notes}
                  search={noteSearch}
                  filter={noteColorFilter}
                  onUpdate={updateNote}
                  onDelete={deleteNote}
                  canWrite={canWrite}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <CalendarView 
                  tasks={tasks}
                  notes={notes}
                />
              </div>
            )}
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
              onClick={() => setEditingTask(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            >
              <div 
                className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
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

          {isSharingWorkspace && (
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4"
              onClick={() => setIsSharingWorkspace(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-white"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary-light rounded-2xl text-primary">
                        <Share2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Compartilhar Área</h2>
                        <p className="text-slate-500 text-sm">Convide pessoas para colaborar com você</p>
                      </div>
                    </div>
                    <button onClick={() => setIsSharingWorkspace(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Share Link / Code Section */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-primary" /> Gerar Convite
                      </h3>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => generateInviteCode('editor')}
                            disabled={isGeneratingInvite !== null}
                            className={cn(
                              "flex-1 bg-white border p-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center gap-1 group relative overflow-hidden",
                              workspaces.find(w => w.id === activeWorkspaceId)?.inviteRole === 'editor' 
                                ? "border-primary text-primary bg-primary/5 shadow-inner" 
                                : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
                            )}
                          >
                            {isGeneratingInvite === 'editor' ? (
                              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1" />
                            ) : (
                              <Shield className={cn("w-5 h-5", workspaces.find(w => w.id === activeWorkspaceId)?.inviteRole === 'editor' ? "opacity-100" : "opacity-60 group-hover:opacity-100")} />
                            )}
                            Convidar como Editor
                            <span className="text-[10px] font-normal text-slate-400">Pode editar tarefas e cards</span>
                            {workspaces.find(w => w.id === activeWorkspaceId)?.inviteRole === 'editor' && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="w-3 h-3 text-primary" />
                              </div>
                            )}
                          </button>
                          <button 
                            onClick={() => generateInviteCode('viewer')}
                            disabled={isGeneratingInvite !== null}
                            className={cn(
                              "flex-1 bg-white border p-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center gap-1 group relative overflow-hidden",
                              workspaces.find(w => w.id === activeWorkspaceId)?.inviteRole === 'viewer' 
                                ? "border-primary text-primary bg-primary/5 shadow-inner" 
                                : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
                            )}
                          >
                            {isGeneratingInvite === 'viewer' ? (
                              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1" />
                            ) : (
                              <ShieldAlert className={cn("w-5 h-5", workspaces.find(w => w.id === activeWorkspaceId)?.inviteRole === 'viewer' ? "opacity-100" : "opacity-60 group-hover:opacity-100")} />
                            )}
                            Convidar como Visualizador
                            <span className="text-[10px] font-normal text-slate-400">Pode apenas ver o conteúdo</span>
                            {workspaces.find(w => w.id === activeWorkspaceId)?.inviteRole === 'viewer' && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="w-3 h-3 text-primary" />
                              </div>
                            )}
                          </button>
                        </div>

                        {workspaces.find(w => w.id === activeWorkspaceId)?.inviteCode && (
                          <div className="mt-4 space-y-3">
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Código Ativo</p>
                              <div className="inline-block">
                                <span className="text-3xl font-black text-primary tracking-widest bg-white px-6 py-2 rounded-2xl border-2 border-primary/20 shadow-sm block">
                                  {workspaces.find(w => w.id === activeWorkspaceId)?.inviteCode}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  const code = workspaces.find(w => w.id === activeWorkspaceId)?.inviteCode;
                                  if (code) {
                                    const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${code}`;
                                    navigator.clipboard.writeText(inviteLink);
                                    setCopiedInviteLink(true);
                                    setTimeout(() => setCopiedInviteLink(false), 2000);
                                  }
                                }}
                                className={cn(
                                  "flex-1 p-3 bg-white border rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm font-semibold",
                                  copiedInviteLink ? "text-emerald-500 border-emerald-500 bg-emerald-50" : "text-slate-700 hover:text-primary hover:border-primary border-slate-200"
                                )}
                              >
                                {copiedInviteLink ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Link Copiado
                                  </>
                                ) : (
                                  <>
                                    <LinkIcon className="w-4 h-4" />
                                    Copiar Link de Convite
                                  </>
                                )}
                              </button>

                              <button 
                                onClick={() => {
                                  const code = workspaces.find(w => w.id === activeWorkspaceId)?.inviteCode;
                                  if (code) {
                                    navigator.clipboard.writeText(code);
                                    setCopiedInviteCode(true);
                                    setTimeout(() => setCopiedInviteCode(false), 2000);
                                  }
                                }}
                                className={cn(
                                  "p-3 bg-white border rounded-2xl transition-all shadow-sm flex items-center justify-center min-w-[48px]",
                                  copiedInviteCode ? "text-emerald-500 border-emerald-500" : "text-slate-400 hover:text-primary hover:border-primary border-slate-200"
                                )}
                                title="Copiar Código"
                              >
                                {copiedInviteCode ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Members List */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 mb-4 px-1">Membros da Área ({workspaceMembers.length})</h3>
                      <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {workspaceMembers.map(m => (
                          <div key={m.userId} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm">
                                {m.photoURL ? (
                                  <img src={m.photoURL} alt={m.name} referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="font-bold text-slate-400">{m.name.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                  {m.name}
                                  {m.userId === user.uid && <span className="text-[10px] text-primary font-black uppercase tracking-tighter">(Você)</span>}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">{m.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isOwner && m.userId !== user.uid && m.role !== 'owner' ? (
                                <select
                                  value={m.role}
                                  onChange={(e) => updateWorkspaceMemberRole(m.userId, e.target.value as 'editor' | 'viewer')}
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-widest px-1 py-0.5 rounded border bg-transparent cursor-pointer outline-none transition-colors",
                                    m.role === 'editor' ? "text-slate-600 border-slate-100 hover:border-slate-300 bg-slate-50" :
                                    "text-slate-500 border-slate-200 hover:border-slate-400 bg-slate-50"
                                  )}
                                >
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                              ) : (
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border",
                                  m.role === 'owner' ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
                                  m.role === 'editor' ? "text-slate-600 bg-slate-50 border-slate-100" :
                                  "text-slate-500 bg-slate-50 border-slate-200"
                                )}>
                                  {m.role}
                                </span>
                              )}
                              {isOwner && m.userId !== user.uid && m.role !== 'owner' && (
                                <button 
                                  onClick={async () => {
                                    if (confirm(`Remover ${m.name} desta área?`)) {
                                      try {
                                        const batch = writeBatch(db);
                                        batch.delete(doc(db, `workspaces/${activeWorkspaceId}/members`, m.userId));
                                        batch.delete(doc(db, `users/${m.userId}/memberships`, activeWorkspaceId));
                                        await batch.commit();
                                      } catch (err) {
                                        console.error("Error removing member:", err);
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button 
                      onClick={() => setIsSharingWorkspace(false)}
                      className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-sm font-bold hover:bg-black transition-all shadow-xl shadow-slate-900/10"
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* PWA Installation Banner */}
          {showInstallBanner && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-6 left-6 right-6 z-[150] bg-white rounded-3xl shadow-2xl border border-primary/10 p-5 lg:left-auto lg:right-6 lg:w-96 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-2">
                <button 
                  onClick={() => setShowInstallBanner(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg border-2 border-white flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="text-base font-black text-slate-900 tracking-tight leading-tight">Instalar App Pocket</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium italic">Adicione o Task Manager à sua tela de início.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleInstallClick}
                  className="flex-1 bg-primary text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 active:scale-95"
                >
                  Instalar Agora
                </button>
                <button 
                  onClick={() => setShowInstallBanner(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                >
                  Depois
                </button>
              </div>
            </motion.div>
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

