import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Contact, NewContact, CustomGroup, AppLanguage, Tool, NewTool, AppSection, BoardItem, BoardLink } from './types';
import { INITIAL_CONTACTS, INITIAL_TOOLS, TRANSLATIONS } from './constants';
import ContactForm from './components/ContactForm';
import ContactCard from './components/ContactCard';
import Button from './components/Button';

// --- TYPES ---
type GroupMode = 'company' | 'position' | 'dateJoined';
type ViewMode = 'list' | 'grid';
type User = 'Benjamin' | 'Karl';

interface Task {
  id: string;
  title: string;
  assignedToId?: string;
  status: 'todo' | 'in-progress' | 'done';
  dueDate: string;
}

interface Objective {
  id: string;
  title: string;
  progress: number;
  status: 'On Track' | 'At Risk' | 'Behind';
}

// --- MOCK DATA ---
const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Q3 Financial Audit', status: 'in-progress', dueDate: '2024-10-15' },
  { id: '2', title: 'Client Onboarding Protocols', status: 'todo', dueDate: '2024-10-20' },
  { id: '3', title: 'Server Migration', status: 'done', dueDate: '2024-09-30' },
];

const INITIAL_OBJECTIVES: Objective[] = [
  { id: '1', title: 'Increase Annual Revenue by 25%', progress: 65, status: 'On Track' },
  { id: '2', title: 'Expand to European Market', progress: 30, status: 'At Risk' },
  { id: '3', title: 'Reduce Churn Rate to < 2%', progress: 88, status: 'On Track' },
  { id: '4', title: 'Hire 5 Senior Engineers', progress: 10, status: 'Behind' },
];

// Initial Whiteboard Data
const INITIAL_BOARD_ITEMS: BoardItem[] = [
  { id: '1', type: 'objective', content: 'Mission: Alpha Launch', x: 550, y: 50, isCompleted: false },
  { id: '2', type: 'sticky', content: 'Core Task: Develop MVP', x: 600, y: 300, color: 'bg-yellow-200' },
  { id: '3', type: 'idea-strip', content: 'User Auth Flow', x: 250, y: 300 },
  { id: '4', type: 'idea-strip', content: 'Payment Gateway', x: 950, y: 300 },
  { id: '5', type: 'goal', content: 'Public Release', x: 630, y: 600, isCompleted: false },
];

const INITIAL_BOARD_LINKS: BoardLink[] = [
  { id: 'l1', fromId: '1', toId: '2', variant: 'critical' },
  { id: 'l2', fromId: '3', toId: '2', variant: 'neutral' },
  { id: 'l3', fromId: '4', toId: '2', variant: 'neutral' },
  { id: 'l4', fromId: '2', toId: '5', variant: 'positive' }
];

// --- EXTRACTED COMPONENTS ---

interface PlanningViewProps {
  boardItems: BoardItem[];
  setBoardItems: React.Dispatch<React.SetStateAction<BoardItem[]>>;
  boardLinks: BoardLink[];
  setBoardLinks: React.Dispatch<React.SetStateAction<BoardLink[]>>;
  setCurrentSection: React.Dispatch<React.SetStateAction<AppSection>>;
}

const PlanningView: React.FC<PlanningViewProps> = ({ 
  boardItems, 
  setBoardItems, 
  boardLinks, 
  setBoardLinks, 
  setCurrentSection 
}) => {
    const [viewMode, setViewMode] = useState<'board' | 'sheet'>('board');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [pendingLinkStart, setPendingLinkStart] = useState<string | null>(null);
    const [activeLinkVariant, setActiveLinkVariant] = useState<BoardLink['variant']>('critical');
    const [activeLinkMenuId, setActiveLinkMenuId] = useState<string | null>(null);
    const [boardBackground, setBoardBackground] = useState<'stone' | 'blue'>('stone');
    const containerRef = useRef<HTMLDivElement>(null);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    // Zoom & Pan State
    const [transform, setTransform] = useState({ x: 0, y: 0, s: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

    const [focusModeId, setFocusModeId] = useState<string | null>(null);
    const [focusType, setFocusType] = useState<'node' | 'link' | null>(null);

    const [isTaskWizardOpen, setIsTaskWizardOpen] = useState(false);
    const [wizardTaskName, setWizardTaskName] = useState('');
    const [wizardGoalId, setWizardGoalId] = useState<string>('');
    const [wizardNewGoalName, setWizardNewGoalName] = useState('');
    const [wizardSourceId, setWizardSourceId] = useState<string | null>(null);

    // --- POSITIONING HELPERS ---
    const getItemDimensions = (type: BoardItem['type']) => {
        // Approximate visual dimensions including padding
        switch (type) {
            case 'objective': return { w: 300, h: 200 }; 
            case 'idea-strip': return { w: 280, h: 80 };
            case 'image': return { w: 280, h: 220 };
            case 'goal': return { w: 180, h: 180 };
            case 'sticky': 
            default: return { w: 180, h: 180 };
        }
    };

    const checkOverlap = (x: number, y: number, width: number, height: number, excludeId?: string) => {
        const buffer = 40; // Increased buffer for adequate space
        return boardItems.some(item => {
            if (item.id === excludeId) return false;
            const d = getItemDimensions(item.type);
            return (
                x < item.x + d.w + buffer &&
                x + width + buffer > item.x &&
                y < item.y + d.h + buffer &&
                y + height + buffer > item.y
            );
        });
    };

    const findBestPosition = (refX: number, refY: number, width: number, height: number, mode: 'spiral' | 'grid-below' = 'spiral') => {
        if (mode === 'grid-below') {
             // Try to place below refY, distributed horizontally around refX
             const rowHeight = 250;
             const offsets = [0, 220, -220, 440, -440, 660, -660, 880, -880];
             
             // Try 3 rows deep
             for (let row = 1; row <= 5; row++) {
                 const targetY = refY + (row * rowHeight);
                 for (const ox of offsets) {
                     const targetX = refX + ox;
                     if (!checkOverlap(targetX, targetY, width, height)) {
                         return { x: targetX, y: targetY };
                     }
                 }
             }
             // Fallback to spiral if grid is super full
        }

        // Spiral Strategy
        let angle = 0;
        let radius = 0;
        let x = refX;
        let y = refY;
        let attempts = 0;
        
        while (checkOverlap(x, y, width, height) && attempts < 200) {
             radius += 15;
             angle += 0.8;
             x = refX + Math.cos(angle) * radius;
             y = refY + Math.sin(angle) * radius;
             attempts++;
        }
        
        return { x, y };
    };

    const getViewportCenter = () => {
        if (!containerRef.current) return { x: 400, y: 300 };
        const rect = containerRef.current.getBoundingClientRect();
        const cx = (rect.width / 2 - transform.x) / transform.s;
        const cy = (rect.height / 2 - transform.y) / transform.s;
        return { x: cx, y: cy };
    };

    const getBoardCoordinates = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (clientX - rect.left - transform.x) / transform.s,
            y: (clientY - rect.top - transform.y) / transform.s
        };
    };

    const handleAddItem = (type: BoardItem['type'], parentId?: string) => {
      const center = getViewportCenter();
      const dims = getItemDimensions(type);
      const pos = findBestPosition(center.x - dims.w/2, center.y - dims.h/2, dims.w, dims.h, 'spiral');

      const newItem: BoardItem = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        content: type === 'image' ? 'https://picsum.photos/300/200' : (
          type === 'sticky' ? 'Note' : 
          (type === 'objective' ? 'New Objective' : 
          (type === 'idea-strip' ? 'New Idea Strip' : 
          (type === 'goal' ? 'New Goal' : 'Card')))
        ),
        x: pos.x,
        y: pos.y,
        color: type === 'sticky' ? 'bg-yellow-200' : undefined,
        isCompleted: false,
        isLocked: false
      };
      setBoardItems(prev => [...prev, newItem]);
      setSelectedId(newItem.id);
      
      if (type === 'objective') {
        enterFocusMode(newItem.id, 'node', newItem.x, newItem.y);
      }
    };

    const openTaskWizard = (sourceId?: string) => {
        setWizardSourceId(sourceId || null);
        const goals = boardItems.filter(i => i.type === 'goal');
        if (goals.length > 0) {
            setWizardGoalId(goals[0].id);
        } else {
            setWizardGoalId('');
        }
        setIsTaskWizardOpen(true);
    };

    const createConnectedIdea = (e: React.MouseEvent, sourceId: string) => {
        e.stopPropagation();
        const sourceItem = boardItems.find(i => i.id === sourceId);
        if (!sourceItem) return;

        const dims = getItemDimensions('idea-strip');
        // Find position to the right or below
        const pos = findBestPosition(sourceItem.x, sourceItem.y, dims.w, dims.h, 'grid-below');

        const newItem: BoardItem = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'idea-strip',
            content: 'New Idea',
            x: pos.x,
            y: pos.y,
            isCompleted: false,
            isLocked: false
        };

        const newLink: BoardLink = {
             id: Math.random().toString(36).substr(2, 9),
             fromId: sourceItem.id,
             toId: newItem.id,
             variant: 'neutral'
        };

        setBoardItems(prev => [...prev, newItem]);
        setBoardLinks(prev => [...prev, newLink]);
        setActiveLinkMenuId(null);
        setSelectedId(newItem.id);
    };

    const handleCreateLinkedTask = (e: React.FormEvent) => {
        e.preventDefault();
        
        let sourceItem = wizardSourceId ? boardItems.find(i => i.id === wizardSourceId) : null;
        if (!sourceItem) {
             sourceItem = boardItems.find(i => i.type === 'objective') || null;
        }

        const center = getViewportCenter();
        const refX = sourceItem ? sourceItem.x : center.x;
        const refY = sourceItem ? sourceItem.y : center.y;
        
        // Find position for new Task
        const taskDims = getItemDimensions('sticky');
        const taskPos = findBestPosition(refX, refY, taskDims.w, taskDims.h, sourceItem ? 'grid-below' : 'spiral');

        const newTask: BoardItem = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'sticky',
            content: wizardTaskName || 'New Task',
            x: taskPos.x, 
            y: taskPos.y,
            color: 'bg-yellow-200',
            isCompleted: false,
            isLocked: false
        };

        const newItems = [newTask];
        const newLinks: BoardLink[] = [];

        if (sourceItem) {
            newLinks.push({
                id: Math.random().toString(36).substr(2, 9),
                fromId: sourceItem.id,
                toId: newTask.id,
                variant: 'critical'
            });
        }

        let targetGoalId = wizardGoalId;

        if (wizardGoalId === 'new_goal' || (!wizardGoalId && wizardNewGoalName)) {
             // Position Goal near the new task
             const goalDims = getItemDimensions('goal');
             const goalPos = findBestPosition(taskPos.x, taskPos.y, goalDims.w, goalDims.h, 'grid-below');

             const newGoal: BoardItem = {
                 id: Math.random().toString(36).substr(2, 9),
                 type: 'goal',
                 content: wizardNewGoalName || 'New Goal',
                 x: goalPos.x,
                 y: goalPos.y,
                 isCompleted: false,
                 isLocked: false
             };
             newItems.push(newGoal);
             targetGoalId = newGoal.id;
        }

        if (targetGoalId && targetGoalId !== 'new_goal') {
             newLinks.push({
                 id: Math.random().toString(36).substr(2, 9),
                 fromId: newTask.id,
                 toId: targetGoalId,
                 variant: 'positive'
             });
        }

        setBoardItems(prev => [...prev, ...newItems]);
        setBoardLinks(prev => [...prev, ...newLinks]);
        
        setIsTaskWizardOpen(false);
        setWizardTaskName('');
        setWizardGoalId('');
        setWizardNewGoalName('');
        setWizardSourceId(null);
    };

    const handleUpdateItem = (id: string, updates: Partial<BoardItem>) => {
      setBoardItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const handleDeleteItem = (id: string) => {
        setDeletingIds(prev => { const n = new Set(prev); n.add(id); return n; });
        
        if (selectedId === id) setSelectedId(null);
        if (focusModeId === id) {
             setFocusModeId(null);
             setFocusType(null);
        }

        setTimeout(() => {
            setBoardItems(prev => prev.filter(item => item.id !== id));
            setBoardLinks(prev => prev.filter(l => l.fromId !== id && l.toId !== id));
            setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        }, 300);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (focusModeId) return;
        const zoomSensitivity = 0.001;
        const newScale = Math.min(Math.max(0.1, transform.s - e.deltaY * zoomSensitivity), 5);
        setTransform(prev => ({ ...prev, s: newScale }));
    };

    const handleStartLink = (e: React.MouseEvent, id: string, variant: BoardLink['variant']) => {
        e.stopPropagation();
        const coords = getBoardCoordinates(e.clientX, e.clientY);
        setCursorPos(coords);
        setPendingLinkStart(id);
        setActiveLinkVariant(variant);
        setActiveLinkMenuId(null);
    };

    const createConnectedTask = (e: React.MouseEvent, sourceId: string, variant: BoardLink['variant']) => {
        e.stopPropagation();
        const sourceItem = boardItems.find(i => i.id === sourceId);
        if (!sourceItem) return;

        const dims = getItemDimensions('sticky');
        const pos = findBestPosition(sourceItem.x, sourceItem.y, dims.w, dims.h, 'grid-below');
        
        const newTask: BoardItem = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'sticky',
            content: 'New Task',
            x: pos.x,
            y: pos.y,
            color: 'bg-yellow-200',
            isCompleted: false,
            isLocked: false
        };

        const newLink: BoardLink = {
             id: Math.random().toString(36).substr(2, 9),
             fromId: sourceItem.id,
             toId: newTask.id,
             variant: variant
        };

        setBoardItems(prev => [...prev, newTask]);
        setBoardLinks(prev => [...prev, newLink]);
        setActiveLinkMenuId(null);
        setSelectedId(newTask.id);
    };

    const handleMouseDown = (e: React.MouseEvent, id?: string) => {
      e.stopPropagation();
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      
      if (!id) {
        if (e.button === 0) { 
           if (pendingLinkStart) {
             setPendingLinkStart(null);
             return;
           }
           setIsPanning(true);
           setSelectedId(null);
           setActiveLinkMenuId(null);
           if (!focusModeId) {
             if (focusModeId) exitFocusMode(); 
           }
        }
        return;
      }

      if (pendingLinkStart) {
           if (pendingLinkStart !== id) {
               const newLink: BoardLink = {
                 id: Math.random().toString(36).substr(2, 9),
                 fromId: pendingLinkStart,
                 toId: id,
                 variant: activeLinkVariant
               };
               setBoardLinks(prev => [...prev, newLink]);
           }
           setPendingLinkStart(null);
           return;
      }

      const item = boardItems.find(i => i.id === id);
      if (!item) return;
      
      setSelectedId(id);
      setActiveLinkMenuId(null);
      if (!item.isLocked) {
          setDraggingId(id);
      }
    };

    const handleContainerMouseMove = (e: React.MouseEvent) => {
      if (pendingLinkStart) {
         setCursorPos(getBoardCoordinates(e.clientX, e.clientY));
      }

      const clientX = e.clientX;
      const clientY = e.clientY;

      if (isPanning && !focusModeId) {
          const dx = clientX - lastMousePos.current.x;
          const dy = clientY - lastMousePos.current.y;
          setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          lastMousePos.current = { x: clientX, y: clientY };
          return;
      }

      if (draggingId) {
        const dx = clientX - lastMousePos.current.x;
        const dy = clientY - lastMousePos.current.y;
        const scale = transform.s;
        
        setBoardItems(prev => prev.map(item => {
          if (item.id === draggingId) {
            return {
              ...item,
              x: item.x + dx / scale,
              y: item.y + dy / scale
            };
          }
          return item;
        }));
        lastMousePos.current = { x: clientX, y: clientY };
      }
    };

    const handleContainerMouseUp = () => {
      setDraggingId(null);
      setIsPanning(false);
    };

    const handleDoubleClickNode = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const item = boardItems.find(i => i.id === id);
        if (item) {
            enterFocusMode(id, 'node', item.x, item.y + 100);
        }
    };

    const handleDoubleClickLink = (e: React.MouseEvent, linkId: string) => {
        e.stopPropagation();
        const link = boardLinks.find(l => l.id === linkId);
        if (link) {
           const from = boardItems.find(i => i.id === link.fromId);
           const to = boardItems.find(i => i.id === link.toId);
           if (from && to) {
               const midX = (from.x + to.x) / 2 + 100;
               const midY = (from.y + to.y) / 2 + 100;
               enterFocusMode(linkId, 'link', midX, midY);
           }
        }
    };

    const enterFocusMode = (id: string, type: 'node' | 'link', targetX: number, targetY: number) => {
        if (!containerRef.current) return;
        setFocusModeId(id);
        setFocusType(type);
        setSelectedId(id);

        const rect = containerRef.current.getBoundingClientRect();
        const targetScale = 1.5;
        const newX = (rect.width / 2) - (targetX * targetScale);
        const newY = (rect.height / 2) - (targetY * targetScale);

        setTransform({ x: newX, y: newY, s: targetScale });
    };

    const exitFocusMode = () => {
        setFocusModeId(null);
        setFocusType(null);
    };

    const toggleCompletion = (id: string) => {
       const item = boardItems.find(i => i.id === id);
       if (item) handleUpdateItem(id, { isCompleted: !item.isCompleted });
    };

    const toggleLock = (id: string) => {
        const item = boardItems.find(i => i.id === id);
        if (item) handleUpdateItem(id, { isLocked: !item.isLocked });
    };

    const toggleLinkMenu = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setActiveLinkMenuId(prev => prev === id ? null : id);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleUpdateItem(id, { backgroundImageUrl: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const getItemCenter = (item: BoardItem) => {
        let w = 160, h = 160;
        if (item.type === 'image') { w = 256; h = 200; }
        else if (item.type === 'text') { w = 180; h = 60; }
        else if (item.type === 'objective') { w = 256; h = 140; } 
        else if (item.type === 'idea-strip') { w = 256; h = 64; }
        else if (item.type === 'goal') { w = 160; h = 160; }
        return { x: item.x + w/2, y: item.y + h/2 };
    };

    const connections = useMemo(() => {
      // Group links to handle parallel connections better
      const linkGroups: Record<string, BoardLink[]> = {};
      boardLinks.forEach(link => {
          const ids = [link.fromId, link.toId].sort().join('-');
          if (!linkGroups[ids]) linkGroups[ids] = [];
          linkGroups[ids].push(link);
      });

      const renderedLinks = boardLinks.map(link => {
        const from = boardItems.find(i => i.id === link.fromId);
        const to = boardItems.find(i => i.id === link.toId);
        
        if (!from || !to) return null;

        const p1 = getItemCenter(from);
        const p2 = getItemCenter(to);

        const colorMap = {
           critical: '#ef4444', 
           positive: '#22c55e', 
           alternative: '#3b82f6', 
           neutral: '#9ca3af' 
        };

        const pairId = [link.fromId, link.toId].sort().join('-');
        const siblings = linkGroups[pairId] || [link];
        const index = siblings.findIndex(l => l.id === link.id);
        const count = siblings.length;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate curve control point
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Calculate normal vector for separation
        let nx = -dy / (dist || 1);
        let ny = dx / (dist || 1);
        
        // Offset for multiple lines
        const spread = 30;
        const centeredIndex = index - (count - 1) / 2;
        const offset = centeredIndex * spread;
        
        // Perpendicular control point
        const controlX = midX + nx * offset;
        const controlY = midY + ny * offset;
        
        const isFocused = focusModeId === link.id;
        const isDimmed = focusModeId && focusModeId !== link.id;

        return (
          <g key={link.id} 
             className={`${isDimmed ? 'opacity-20 blur-[1px]' : 'opacity-90'} transition-all duration-500`}
             onClick={(e) => { e.stopPropagation(); setSelectedId(link.id); }}
             onDoubleClick={(e) => handleDoubleClickLink(e, link.id)}
          >
             <path 
                d={`M ${p1.x} ${p1.y} Q ${controlX} ${controlY} ${p2.x} ${p2.y}`}
                stroke="transparent"
                strokeWidth="20"
                fill="none"
                style={{ cursor: 'pointer' }}
             />
             <path 
              d={`M ${p1.x} ${p1.y} Q ${controlX} ${controlY} ${p2.x} ${p2.y}`}
              stroke={colorMap[link.variant]}
              strokeWidth={isFocused ? "6" : "2"}
              fill="none"
              className="drop-shadow-sm transition-all duration-300"
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }} 
            />
            <circle cx={p1.x} cy={p1.y} r={isFocused ? 6 : 3} fill={colorMap[link.variant]} className="shadow-sm transition-all" />
            <circle cx={p2.x} cy={p2.y} r={isFocused ? 6 : 3} fill={colorMap[link.variant]} className="shadow-sm transition-all" />
            
            {(selectedId === link.id || isFocused) && (
               <foreignObject x={midX - 60 + (nx * offset)} y={midY - 20 + (ny * offset)} width="120" height="40">
                  <div className="flex justify-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
                     {(['critical', 'positive', 'alternative', 'neutral'] as const).map(v => (
                        <button 
                           key={v}
                           onClick={(e) => { 
                               e.stopPropagation(); 
                               setBoardLinks(prev => prev.map(l => l.id === link.id ? { ...l, variant: v } : l));
                           }}
                           className={`w-6 h-6 rounded-full ${colorMap[v]} hover:scale-110 transition-transform border-2 ${link.variant === v ? 'border-white dark:border-slate-900' : 'border-transparent'}`}
                        />
                     ))}
                  </div>
               </foreignObject>
            )}
          </g>
        );
      });

      return renderedLinks;
    }, [boardItems, boardLinks, transform, focusModeId, selectedId]);

    const pendingConnection = useMemo(() => {
        if (!pendingLinkStart) return null;
        const startItem = boardItems.find(i => i.id === pendingLinkStart);
        if (!startItem) return null;
        
        const p1 = getItemCenter(startItem);
        const p2 = cursorPos;
        
        const colorMap = {
           critical: '#ef4444', 
           positive: '#22c55e', 
           alternative: '#3b82f6', 
           neutral: '#9ca3af' 
        };

        return (
             <g className="pointer-events-none">
                 <line 
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={colorMap[activeLinkVariant]}
                    strokeWidth="3"
                    strokeDasharray="5,5"
                    strokeLinecap="round"
                    className="animate-pulse opacity-80"
                 />
                 <circle cx={p2.x} cy={p2.y} r={5} fill={colorMap[activeLinkVariant]} stroke="white" strokeWidth="2" />
             </g>
        );
    }, [pendingLinkStart, cursorPos, activeLinkVariant, boardItems]);

    const PlanningSheet = () => {
      // 1. Group Goals
      const goals = boardItems.filter(i => i.type === 'goal');
      const objectives = boardItems.filter(i => i.type === 'objective');
      const tasks = boardItems.filter(i => i.type === 'sticky');
      const ideas = boardItems.filter(i => i.type === 'idea-strip');
      
      const getDeps = (id: string, type: 'incoming' | 'outgoing') => {
        const links = boardLinks.filter(l => type === 'incoming' ? l.toId === id : l.fromId === id);
        return links.map(l => {
          const targetId = type === 'incoming' ? l.fromId : l.toId;
          return boardItems.find(i => i.id === targetId);
        }).filter(Boolean) as BoardItem[];
      };

      return (
        <div className="max-w-4xl mx-auto min-h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
          <div className="p-12 space-y-12">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-8 text-center">
              <div className="flex justify-between items-center mb-4">
                 <button onClick={() => setViewMode('board')} className="flex items-center gap-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Board
                 </button>
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">Strategic Plan</h1>
              <p className="text-slate-500 dark:text-slate-400 font-serif italic">Generated from WingMentor HQ Board • {new Date().toLocaleDateString()}</p>
            </div>

            {/* Strategic Goals Section */}
            <section>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Strategic Goals
              </h2>
              <div className="grid gap-6">
                {goals.length === 0 ? <p className="text-slate-400 italic">No goals defined yet.</p> : goals.map(goal => {
                  const contributors = getDeps(goal.id, 'incoming');
                  return (
                    <div key={goal.id} className="p-6 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{goal.content}</h3>
                        {goal.isCompleted && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">Achieved</span>}
                      </div>
                      
                      {contributors.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Key Dependencies</p>
                          <ul className="space-y-2">
                            {contributors.map(c => (
                              <li key={c.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                <span className={`w-1.5 h-1.5 rounded-full ${c.type === 'objective' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                                {c.content}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Objectives Section */}
            <section>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Mission Objectives
              </h2>
              <div className="space-y-4">
                {objectives.length === 0 ? <p className="text-slate-400 italic">No objectives set.</p> : objectives.map(obj => (
                  <div key={obj.id} className="flex items-start gap-4 p-4 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="w-12 h-12 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center font-black text-slate-300">
                      {obj.id.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-slate-900 dark:text-white">{obj.content}</h4>
                      <div className="mt-2 flex gap-2">
                         {getDeps(obj.id, 'incoming').length > 0 && (
                           <span className="text-xs text-slate-500">Requires {getDeps(obj.id, 'incoming').length} inputs</span>
                         )}
                         {getDeps(obj.id, 'outgoing').length > 0 && (
                           <span className="text-xs text-slate-500">Contributes to {getDeps(obj.id, 'outgoing').length} outcomes</span>
                         )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

             {/* Action Items Section */}
             <section>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Action Items & Tasks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.length === 0 ? <p className="text-slate-400 italic">No tasks created.</p> : tasks.map(task => {
                  const targets = getDeps(task.id, 'outgoing');
                  return (
                    <div key={task.id} className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg">
                      <p className="font-serif text-lg leading-snug text-slate-800 dark:text-slate-200">{task.content}</p>
                      {targets.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-yellow-200/50 flex flex-wrap gap-2">
                          {targets.map(t => (
                            <span key={t.id} className="text-[10px] font-bold uppercase px-2 py-1 bg-white/50 dark:bg-black/20 rounded text-slate-600 dark:text-slate-400">
                               For: {t.content.substring(0, 15)}...
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Ideas Section */}
            {ideas.length > 0 && (
              <section>
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  Concept Repository
                </h2>
                <div className="flex flex-wrap gap-3">
                  {ideas.map(idea => (
                    <div key={idea.id} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {idea.content}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      );
    };

    if (viewMode === 'sheet') {
       return (
         <div className="relative h-full flex flex-col bg-slate-100 dark:bg-black">
            {/* Sheet Toolbar - Hidden if inside sheet view component logic */}
            <PlanningSheet />
         </div>
       );
    }

    return (
      <div className={`flex flex-col h-full relative overflow-hidden font-serif planning-board transition-colors duration-500 ${boardBackground === 'stone' ? 'bg-[#1c1917]' : 'bg-[#0f172a]'}`}>
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>

        {/* Toolbar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 p-2 rounded-xl bg-stone-800 border-2 border-stone-600 shadow-2xl no-print">
          <div className="flex gap-2 pr-4 border-r border-stone-600">
             <button onClick={() => openTaskWizard()} className="flex flex-col items-center group bg-blue-900/50 rounded hover:bg-blue-800 border border-blue-700 transition-colors" title="Add Linked Task">
                <div className="w-10 h-10 flex items-center justify-center text-blue-300">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
             </button>
             <button onClick={() => setCurrentSection('document')} className="flex flex-col items-center group bg-emerald-900/30 rounded hover:bg-emerald-800 border border-emerald-700 transition-colors" title="Strategy Document">
                <div className="w-10 h-10 flex items-center justify-center text-emerald-300">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
             </button>
             <button onClick={() => handleAddItem('objective')} className="flex flex-col items-center group" title="Add Objective">
                 <div className="w-10 h-8 bg-[#1e293b] border border-stone-500 rounded flex flex-col relative overflow-hidden shadow-sm group-hover:scale-110 transition-transform">
                    <div className="h-2 bg-stone-600 w-5 rounded-tr-sm ml-0"></div>
                    <div className="flex-1 bg-[#0f172a] border-t border-stone-600 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-900 border border-red-500"></div>
                    </div>
                </div>
             </button>
             <button onClick={() => handleAddItem('sticky')} className="flex flex-col items-center group" title="Add Note">
                <div className="w-10 h-10 bg-yellow-200 border border-yellow-400 shadow-sm flex items-center justify-center"></div>
             </button>
             <button onClick={() => handleAddItem('idea-strip')} className="flex flex-col items-center group" title="Add Idea">
                <div className="w-10 h-10 bg-stone-100 border border-stone-300 rounded shadow-sm flex items-center justify-center">
                   <div className="w-6 h-2 bg-stone-300 rounded-sm"></div>
                </div>
             </button>
             <button onClick={() => handleAddItem('goal')} className="flex flex-col items-center group" title="Add Goal">
                <div className="w-10 h-10 bg-white border-2 border-black shadow-sm flex items-center justify-center">
                   <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M4 15a1 1 0 001 1h1v4a1 1 0 002 0v-4h1l.22.44c.6 1.2 1.96 1.81 3.28 1.54l5.3-1.06a1 1 0 00.8-1V5.07a1 1 0 00-1.2-.98l-5.3 1.06c-1.32.27-2.68-.34-3.28-1.54L9 3.16V3a1 1 0 00-2 0v1H6a1 1 0 00-1 1v10z"/></svg>
                </div>
             </button>
          </div>
          <div className="flex gap-2 pl-4 border-l border-stone-600">
             <button onClick={() => setViewMode('sheet')} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-white" title="View Plan Sheet">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             </button>
             <div className="w-px bg-stone-600"></div>
             <button onClick={() => setTransform(prev => ({ ...prev, s: Math.min(prev.s + 0.2, 5) }))} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-white" title="Zoom In">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
             </button>
             <button onClick={() => setTransform(prev => ({ ...prev, s: Math.max(prev.s - 0.2, 0.1) }))} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-white" title="Zoom Out">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
             </button>
             <button onClick={() => setTransform({ x: 0, y: 0, s: 1 })} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-white" title="Reset View">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             </button>
             <button onClick={() => { setBoardItems([]); setBoardLinks([]); }} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-red-400 transition-colors" title="Clear Board">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </button>
          </div>
        </div>

        {/* Task Wizard Modal */}
        {isTaskWizardOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                    <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6 border-b border-stone-800 pb-4">Add Linked Task</h3>
                    <form onSubmit={handleCreateLinkedTask} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Task Description</label>
                            <input autoFocus required value={wizardTaskName} onChange={(e) => setWizardTaskName(e.target.value)} className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium" placeholder="e.g., Secure Funding Round A" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Connect to Goal</label>
                            <select value={wizardGoalId} onChange={(e) => setWizardGoalId(e.target.value)} className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500">
                                <option value="" disabled>Select Target Goal...</option>
                                <option value="new_goal">+ Create New Goal</option>
                                {boardItems.filter(i => i.type === 'goal').map(goal => (
                                    <option key={goal.id} value={goal.id}>{goal.content}</option>
                                ))}
                            </select>
                        </div>
                        {wizardGoalId === 'new_goal' && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="block text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">New Goal Name</label>
                                <input required value={wizardNewGoalName} onChange={(e) => setWizardNewGoalName(e.target.value)} className="w-full bg-stone-800 border border-emerald-500/50 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500" placeholder="e.g., IPO Launch" />
                            </div>
                        )}
                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={() => setIsTaskWizardOpen(false)} className="flex-1 py-3 bg-transparent border border-stone-700 text-stone-400 font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-stone-800 transition-colors">Cancel</button>
                            <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all">Create Node</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        
        {/* Exit Focus Mode Button */}
        {focusModeId && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-4">
                <button 
                    onClick={exitFocusMode}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest rounded-full shadow-2xl transition-all hover:scale-105"
                >
                    Exit Focus Mode
                </button>
            </div>
        )}

        {/* Canvas */}
        <div 
          ref={containerRef}
          className={`flex-1 relative overflow-hidden ${pendingLinkStart ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
          onMouseDown={(e) => handleMouseDown(e)}
          onMouseMove={handleContainerMouseMove}
          onMouseUp={handleContainerMouseUp}
          onMouseLeave={handleContainerMouseUp}
          onWheel={handleWheel}
        >
          {/* Transform Layer */}
          <div 
            style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.s})`,
                transformOrigin: '0 0',
                transition: isPanning ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                width: '100%',
                height: '100%'
            }}
            className="w-full h-full"
          >
              <svg className="absolute top-0 left-0 overflow-visible" style={{ width: '10000px', height: '10000px', pointerEvents: 'visibleStroke' }}>{connections}</svg>

              {boardItems.map((item, index) => {
                 const rotation = (parseInt(item.id.substr(0, 4), 36) % 6) - 3;
                 const isSelected = selectedId === item.id;
                 const isFocused = focusModeId === item.id;
                 const isBlurred = focusModeId && focusModeId !== item.id;
                 const isMenuOpen = activeLinkMenuId === item.id;
                 const isDeleting = deletingIds.has(item.id);
                 
                 return (
                <div
                  key={item.id}
                  className={`absolute group touch-none select-none transition-all duration-300 z-10 
                    ${isDeleting ? 'opacity-0 scale-75 pointer-events-none' : ''}
                    ${isSelected || isFocused ? 'z-50 scale-105' : ''} 
                    ${isBlurred ? 'blur-[2px] opacity-40 grayscale' : ''}`}
                  style={{ left: item.x, top: item.y, transform: `rotate(${isFocused ? 0 : rotation}deg)` }}
                  onMouseDown={(e) => handleMouseDown(e, item.id)}
                  onDoubleClick={(e) => handleDoubleClickNode(e, item.id)}
                >
                  <div className={`relative ${isSelected || isFocused ? 'ring-4 ring-blue-500/50 shadow-2xl' : ''}`}>
                    
                    {/* Locked Indicator */}
                    {item.isLocked && (
                        <div className="absolute -top-3 -right-3 z-50 bg-stone-900 border border-stone-600 text-stone-400 p-1 rounded-full shadow-md">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                    )}

                    {/* Linker - Visible on Hover/Active for all nodes */}
                    <div className={`absolute -right-3 top-1/2 -translate-y-1/2 z-50 transition-all hover:translate-x-1 ${isMenuOpen ? 'opacity-100 z-[60]' : 'opacity-0 group-hover:opacity-100'}`}>
                        <div className="relative group/linker flex items-center" onMouseDown={(e) => e.stopPropagation()}>
                            {/* The + Button */}
                            <div 
                                onClick={(e) => toggleLinkMenu(e, item.id)}
                                className={`w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer shadow-sm transition-colors ${isMenuOpen ? 'bg-blue-600 border-blue-500 text-white' : 'bg-stone-200 dark:bg-stone-700 border-stone-400 text-stone-600 dark:text-stone-300 hover:bg-blue-100'}`}
                            >
                                {isMenuOpen ? (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                )}
                            </div>
                            
                            {/* The Color Options (Shown when menu is open) */}
                            {isMenuOpen && (
                                <div className="absolute left-full ml-2 z-[100] animate-in slide-in-from-left-2 fade-in">
                                     <div className="bg-white dark:bg-stone-800 p-2 rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 flex flex-col gap-2 min-w-[140px]">
                                         
                                         {/* Row 1: Draw Link */}
                                         <div className="flex items-center justify-between gap-3">
                                            <span className="text-[9px] font-black uppercase text-stone-400 tracking-wider">Link</span>
                                            <div className="flex gap-1">
                                                <button onClick={(e) => handleStartLink(e, item.id, 'critical')} className="w-5 h-5 rounded-full bg-red-500 border border-white hover:scale-110 transition-transform" title="Critical Link"></button>
                                                <button onClick={(e) => handleStartLink(e, item.id, 'alternative')} className="w-5 h-5 rounded-full bg-blue-500 border border-white hover:scale-110 transition-transform" title="Alternative Link"></button>
                                                <button onClick={(e) => handleStartLink(e, item.id, 'positive')} className="w-5 h-5 rounded-full bg-green-500 border border-white hover:scale-110 transition-transform" title="Positive Link"></button>
                                                <button onClick={(e) => handleStartLink(e, item.id, 'neutral')} className="w-5 h-5 rounded-full bg-gray-400 border border-white hover:scale-110 transition-transform" title="Neutral Link"></button>
                                            </div>
                                         </div>

                                         {/* Row 2: Create Task (Only for Objectives) */}
                                         {item.type === 'objective' && (
                                             <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-100 dark:border-stone-700">
                                                <span className="text-[9px] font-black uppercase text-stone-400 tracking-wider">Task</span>
                                                <div className="flex gap-1">
                                                    <button onClick={(e) => createConnectedTask(e, item.id, 'critical')} className="w-5 h-5 rounded-full bg-red-500 border border-white hover:scale-110 transition-transform flex items-center justify-center text-white text-[10px] font-bold" title="New Critical Task">+</button>
                                                    <button onClick={(e) => createConnectedTask(e, item.id, 'alternative')} className="w-5 h-5 rounded-full bg-blue-500 border border-white hover:scale-110 transition-transform flex items-center justify-center text-white text-[10px] font-bold" title="New Alternative Task">+</button>
                                                    <button onClick={(e) => createConnectedTask(e, item.id, 'positive')} className="w-5 h-5 rounded-full bg-green-500 border border-white hover:scale-110 transition-transform flex items-center justify-center text-white text-[10px] font-bold" title="New Positive Task">+</button>
                                                </div>
                                             </div>
                                         )}

                                         {/* Row 3: Create Idea (For Objectives & Stickies) */}
                                         {(item.type === 'objective' || item.type === 'sticky') && (
                                             <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-100 dark:border-stone-700">
                                                <span className="text-[9px] font-black uppercase text-stone-400 tracking-wider">Idea</span>
                                                <div className="flex gap-1">
                                                    <button onClick={(e) => createConnectedIdea(e, item.id)} className="w-5 h-5 rounded-full bg-purple-100 border border-purple-300 hover:scale-110 transition-transform flex items-center justify-center text-purple-600 text-[10px] font-bold" title="New Idea Strip">+</button>
                                                </div>
                                             </div>
                                         )}
                                     </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {isSelected && !focusModeId && (
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1 bg-stone-800 p-1.5 rounded shadow-xl border border-stone-600 z-50 no-print">
                         {item.type !== 'image' && (
                           <button onClick={(e) => { e.stopPropagation(); toggleCompletion(item.id); }} className={`p-1 rounded ${item.isCompleted ? 'bg-green-900 text-green-400' : 'hover:bg-stone-700 text-stone-300'}`} title="Mark Completed">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           </button>
                         )}
                         <div className="w-px bg-stone-600 mx-1"></div>
                         
                         {/* Lock Button */}
                         <button onClick={(e) => { e.stopPropagation(); toggleLock(item.id); }} className={`p-1 rounded ${item.isLocked ? 'bg-blue-900 text-blue-400' : 'hover:bg-stone-700 text-stone-300'}`} title={item.isLocked ? "Unlock Position" : "Lock Position"}>
                            {item.isLocked ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                            )}
                         </button>

                         <div className="w-px bg-stone-600 mx-1"></div>
                         <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="p-1 hover:bg-red-900/50 rounded text-red-400" title="Delete Node">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                      </div>
                    )}

                    {item.type === 'objective' && (
                       <div className="w-64 bg-[#1e293b] border-2 border-stone-500 rounded-lg shadow-2xl flex flex-col overflow-hidden relative">
                          <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50"
                              title="Remove Objective"
                          >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                          <div className="h-6 bg-stone-600 w-24 rounded-tr-lg mb-[-1px] z-10 flex items-center px-2">
                             <span className="text-[8px] font-black text-white uppercase tracking-wider">Top Secret</span>
                          </div>
                          <div className="bg-[#0f172a] p-4 flex-1 border-t border-stone-600 relative group/objective">
                             {item.isCompleted && (
                                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                   <div className="border-4 border-green-500 text-green-500 font-black text-2xl px-4 py-2 uppercase transform -rotate-12 opacity-80" style={{ mixBlendMode: 'plus-lighter' }}>COMPLETED</div>
                                </div>
                             )}
                             <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-red-900/50 border border-red-500 flex items-center justify-center text-red-500">
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <span className="text-xs font-bold text-slate-300 uppercase">Mission Objective</span>
                             </div>
                             <textarea value={item.content} onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })} className="w-full bg-transparent resize-none outline-none font-mono text-sm leading-snug text-white placeholder-slate-600 h-16" placeholder="Define objective..." onMouseDown={(e) => e.stopPropagation()} />
                             <button onClick={(e) => { e.stopPropagation(); openTaskWizard(item.id); }} className="absolute bottom-2 right-2 w-8 h-8 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover/objective:opacity-100 transition-all transform hover:scale-110 z-30">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                             </button>
                          </div>
                       </div>
                    )}

                    {item.type === 'idea-strip' && (
                       <div className="w-64 h-16 bg-[#fdfbf7] shadow-md border border-stone-300 flex items-center px-4 relative overflow-hidden">
                          <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                              className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50 scale-75 hover:scale-90"
                              title="Remove Idea"
                          >
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                          {item.backgroundImageUrl && (
                             <img src={item.backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" />
                          )}
                          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-10 bg-white/40 border-l border-r border-white/20 shadow-sm rotate-3 backdrop-blur-[1px] z-10"></div>
                          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-10 bg-white/40 border-l border-r border-white/20 shadow-sm -rotate-2 backdrop-blur-[1px] z-10"></div>
                          <input value={item.content} onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })} className="w-full bg-transparent outline-none text-sm font-serif font-bold text-stone-800 text-center placeholder-stone-400 relative z-20" placeholder="New Idea..." onMouseDown={(e) => e.stopPropagation()} />
                          
                          {/* Image Upload Trigger */}
                          {isSelected && (
                              <label className="absolute bottom-1 right-1 w-5 h-5 bg-stone-200 hover:bg-stone-300 rounded cursor-pointer flex items-center justify-center z-30">
                                  <svg className="w-3 h-3 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, item.id)} />
                              </label>
                          )}
                       </div>
                    )}

                    {item.type === 'goal' && (
                       <div className="w-40 h-40 bg-white border-4 border-black flex flex-col items-center relative shadow-2xl overflow-hidden group-hover:scale-105 transition-transform">
                          <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                              className="absolute top-1 right-1 w-5 h-5 bg-black hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-50"
                              title="Remove Goal"
                          >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                          <div className="absolute inset-x-0 top-0 h-6 w-full" style={{ backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHZpZXdCb3g9IjAgMCA4IDgiPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6bTQgNGg0djRINHoiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMSIvPjwvc3ZnPg==")` }}></div>
                          {item.isCompleted && (
                             <div className="absolute inset-0 bg-yellow-400/20 z-10 flex items-center justify-center backdrop-blur-[1px]">
                                <div className="bg-black text-white px-3 py-1 font-black uppercase text-xl transform -rotate-12 border-4 border-white shadow-xl">WIN</div>
                             </div>
                          )}
                          <div className="flex-1 flex flex-col items-center justify-center pt-6 px-2 w-full">
                             <span className="text-2xl font-black italic uppercase tracking-tighter leading-none mb-2">FINISH</span>
                             <textarea value={item.content} onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })} className="w-full bg-transparent resize-none outline-none font-sans font-bold text-xs text-center text-stone-600 placeholder-stone-400 h-12" placeholder="Goal Name" onMouseDown={(e) => e.stopPropagation()} />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-2 bg-black"></div>
                       </div>
                    )}

                    {item.type === 'sticky' && (
                      <div className={`w-40 h-40 p-4 shadow-xl ${item.color || 'bg-yellow-200'} text-slate-900 transform transition-transform hover:scale-105 relative`}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500/20 hover:bg-red-500 text-red-600 hover:text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-30"
                            title="Remove Task"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 shadow-sm border border-red-700 z-20"></div>
                        <textarea value={item.content} onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })} className="w-full h-full bg-transparent resize-none outline-none font-serif text-lg leading-snug placeholder-slate-500/50" placeholder="Clue details..." onMouseDown={(e) => e.stopPropagation()} />
                      </div>
                    )}

                  </div>
                </div>
              )})}

              {/* Pending Connection (Rendered last to be on top) */}
              <svg className="absolute top-0 left-0 z-[60] overflow-visible pointer-events-none" style={{ width: '100%', height: '100%' }}>
                  {pendingConnection}
              </svg>
          </div>
        </div>
      </div>
    );
};

const App: React.FC = () => {
  // --- STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>('Benjamin');
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  // Use v2 key to refresh tools for new version
  const [tools, setTools] = useState<Tool[]>(() => {
    try {
        const saved = localStorage.getItem('nexus_tools_v2');
        return saved ? JSON.parse(saved) : INITIAL_TOOLS;
    } catch (e) {
        return INITIAL_TOOLS;
    }
  });
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
        const saved = localStorage.getItem('nexus_tasks');
        return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch (e) {
        return INITIAL_TASKS;
    }
  });

  const [objectives, setObjectives] = useState<Objective[]>(INITIAL_OBJECTIVES);

  // Board State
  const [boardTitle, setBoardTitle] = useState(() => localStorage.getItem('nexus_board_title') || 'Case File: #8841');
  
  const [boardItems, setBoardItems] = useState<BoardItem[]>(() => {
    try {
        const saved = localStorage.getItem('nexus_board_items');
        return saved ? JSON.parse(saved) : INITIAL_BOARD_ITEMS;
    } catch (e) {
        return INITIAL_BOARD_ITEMS;
    }
  });
  
  const [boardLinks, setBoardLinks] = useState<BoardLink[]>(() => {
    try {
        const saved = localStorage.getItem('nexus_board_links');
        return saved ? JSON.parse(saved) : INITIAL_BOARD_LINKS;
    } catch (e) {
        return INITIAL_BOARD_LINKS;
    }
  });

  const [documentContent, setDocumentContent] = useState(() => localStorage.getItem('nexus_document_content') || '');

  const [currentSection, setCurrentSection] = useState<AppSection>('overview');
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  
  // Tool Dashboard State
  const [activeTool, setActiveTool] = useState<Tool | null>(null);

  const [language, setLanguage] = useState<AppLanguage>(() => {
    return (localStorage.getItem('nexus_language') as AppLanguage) || 'en';
  });

  const t = (key: string) => TRANSLATIONS[language][key] || key;

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('nexus_theme');
    return saved === 'dark';
  });

  // Contact Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // --- LOGIN COMPONENT ---
  const LoginScreen = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      const user = username.trim().toLowerCase();
      const pass = password.trim();
      
      if (user === 'benjamin' && (pass === 'RPC 1884' || pass === 'RPC1884')) {
        setCurrentUser('Benjamin');
        setIsAuthenticated(true);
      } else if (user === 'karl' && (pass === 'RPC 1993' || pass === 'RPC1993')) {
        setCurrentUser('Karl');
        setIsAuthenticated(true);
      } else {
        setError('Invalid Security Clearance');
      }
    };

    return (
      <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className={`w-full max-w-md p-8 rounded-[2rem] shadow-2xl ${isDarkMode ? 'bg-slate-900 shadow-none border border-slate-800' : 'bg-white shadow-slate-200/50 border border-white'}`}>
          <div className="flex flex-col items-center mb-8">
            <div className="w-full flex justify-center mb-6">
              <img 
                src="https://lh3.googleusercontent.com/d/1KgVuIuCv8mKxTcJ4rClCUCdaQ3fxm0x6" 
                alt="WingMentor HQ" 
                className="h-24 w-auto object-contain" 
              />
            </div>
            <h1 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>WingMentor HQ</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Personnel Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Identity</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl outline-none border transition-all font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                placeholder="Username (Benjamin / Karl)"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Access Key</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl outline-none border transition-all font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                placeholder="Password"
              />
            </div>
            {error && (
              <p className="text-center text-xs font-bold text-red-500 animate-pulse">{error}</p>
            )}
            <Button className="w-full py-4 rounded-xl shadow-lg mt-4 font-bold tracking-wide uppercase text-xs" variant="primary">Authenticate</Button>
          </form>
        </div>
      </div>
    );
  };

  // --- EFFECT HOOKS ---
  useEffect(() => {
    const saved = localStorage.getItem('nexus_contacts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setContacts(parsed);
      } catch (e) {
        setContacts(INITIAL_CONTACTS);
      }
    } else {
      setContacts(INITIAL_CONTACTS);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nexus_board_items', JSON.stringify(boardItems));
    localStorage.setItem('nexus_board_links', JSON.stringify(boardLinks));
    localStorage.setItem('nexus_board_title', boardTitle);
  }, [boardItems, boardLinks, boardTitle]);

  useEffect(() => {
    localStorage.setItem('nexus_document_content', documentContent);
  }, [documentContent]);

  useEffect(() => {
    localStorage.setItem('nexus_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // --- HELPERS ---
  const handleSaveContact = (data: NewContact | Contact) => {
    if ('id' in data) {
      setContacts(prev => prev.map(c => c.id === data.id ? data as Contact : c));
    } else {
      const newContact: Contact = {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: Date.now()
      };
      setContacts(prev => [...prev, newContact]);
    }
    setIsContactModalOpen(false);
    setEditingContact(null);
  };

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  // --- SUB-COMPONENTS ---
  
  const BrowserOverlay = () => {
    if (!activeTool) return null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-slate-900 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveTool(null)} 
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
              <img src={activeTool.iconUrl || `https://www.google.com/s2/favicons?domain=${activeTool.url}&sz=64`} className="w-6 h-6 rounded-lg" alt="" />
              <h3 className="font-bold text-white">{activeTool.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <a 
               href={activeTool.url} 
               target="_blank" 
               rel="noopener noreferrer" 
               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
             >
               {t('openExternal')}
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
             </a>
          </div>
        </div>
        <div className="flex-1 relative bg-white">
          <iframe 
            src={activeTool.url} 
            className="w-full h-full border-none"
            title={activeTool.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    );
  };

  const DocumentView = () => {
    const [isWorking, setIsWorking] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const insertTag = (tag: string) => {
        if (!textareaRef.current) return;
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        
        // Check if we are at the start of a line or document
        const isStartOfLine = start === 0 || text[start - 1] === '\n';
        const prefix = isStartOfLine ? '' : '\n';
        const insertion = `${prefix}[${tag}] `;
        
        const newText = text.substring(0, start) + insertion + text.substring(end);
        
        setDocumentContent(newText);
        
        // Restore focus and move cursor
        setTimeout(() => {
            textarea.focus();
            const newPos = start + insertion.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    const handlePullFromBoard = async () => {
      setIsWorking(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const boardState = JSON.stringify({ items: boardItems, links: boardLinks });
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Generate a professional, structured strategic document based on the following visual board data. 
          Structure it cleanly with markdown (headers, bullet points, sections).
          Include: Executive Summary, Strategic Goals, Objectives, Action Items, and Concepts.
          
          Board Data: ${boardState}`
        });

        if (response.text) {
            setDocumentContent(response.text);
        }
      } catch (error) {
        console.error("Pull failed", error);
        alert("Failed to generate document from board.");
      } finally {
        setIsWorking(false);
      }
    };

    const handlePushToBoard = async () => {
      setIsWorking(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `You are a strategic project planner. Analyze the following document text and convert it into a structured set of board items for a visual planning tool.
          
          Look for explicit tags to determine item types:
          - [TASK] -> type: "sticky"
          - [OBJECTIVE] -> type: "objective"
          - [IDEA] -> type: "idea-strip"
          - [GOAL] -> type: "goal"
          - [FINISHED] -> mark item as completed if possible
          
          If no tag is present, infer the type from context.

          Return a JSON object with a list of "items".
          The schema for each item should be:
          {
            "type": "goal" | "objective" | "sticky" | "idea-strip", 
            "content": "string",
            "isCompleted": boolean
          }
          
          Document Text:
          ${documentContent}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      content: { type: Type.STRING },
                      isCompleted: { type: Type.BOOLEAN }
                    }
                  }
                }
              }
            }
          }
        });

        const data = JSON.parse(response.text || '{}');
        
        if (data.items && Array.isArray(data.items)) {
           // Layout Algorithm
           const newItems: BoardItem[] = [];
           let goalCount = 0;
           let objCount = 0;
           let taskCount = 0;
           let ideaCount = 0;
           
           // Assuming a standard starting viewport center (can be approximate)
           const startX = 200; 
           const startY = 100;

           data.items.forEach((item: any) => {
              const id = Math.random().toString(36).substr(2, 9);
              let x = 0, y = 0;
              
              if (item.type === 'goal') {
                 x = startX + (goalCount * 250);
                 y = startY;
                 goalCount++;
              } else if (item.type === 'objective') {
                 x = startX + (objCount * 280);
                 y = startY + 300;
                 objCount++;
              } else if (item.type === 'sticky') {
                 x = startX + (taskCount * 180);
                 y = startY + 600;
                 taskCount++;
              } else {
                 x = startX + (ideaCount * 300);
                 y = startY + 900;
                 ideaCount++;
              }

              newItems.push({
                id,
                type: item.type,
                content: item.content,
                x,
                y,
                color: item.type === 'sticky' ? 'bg-yellow-200' : undefined,
                isCompleted: item.isCompleted || false,
                isLocked: false
              });
           });
           
           setBoardItems(newItems);
           setBoardLinks([]); // Reset links as AI layout doesn't infer them yet
           alert("Board updated successfully from document!");
           setCurrentSection('planning'); // Redirect user to see changes
        }
      } catch (error) {
        console.error("Push failed", error);
        alert("Failed to update board from document.");
      } finally {
        setIsWorking(false);
      }
    };

    return (
        <div className="h-full flex flex-col bg-slate-100 dark:bg-[#0B1120] relative overflow-hidden">
            {/* Header Toolbar */}
            <div className="flex-none px-8 py-5 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] z-20 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Strategy Document</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">CONFIDENTIAL // STRATEGIC PLANNING</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handlePullFromBoard} 
                        disabled={isWorking}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-bold text-slate-600 dark:text-slate-300 text-[10px] uppercase tracking-widest transition-all"
                    >
                         {isWorking ? 'Syncing...' : 'Pull from Board'}
                    </button>
                    <button 
                        onClick={handlePushToBoard}
                        disabled={isWorking}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                    >
                         {isWorking ? 'Syncing...' : 'Push to Board'}
                    </button>
                </div>
            </div>
            
            {/* Scrollable Document Area */}
            <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-200/50 dark:bg-[#020617]">
                <div className="relative w-full max-w-[850px] min-h-[1100px] mb-20 bg-white shadow-2xl shadow-slate-900/10 flex flex-col">
                    
                    {/* Loading Overlay */}
                    {isWorking && (
                        <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center backdrop-blur-sm">
                            <div className="flex flex-col items-center animate-pulse">
                                <div className="h-2 w-24 bg-blue-500 rounded mb-2"></div>
                                <div className="h-2 w-32 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    )}
                    
                    {/* The Editor */}
                    <textarea 
                        ref={textareaRef}
                        value={documentContent}
                        onChange={(e) => setDocumentContent(e.target.value)}
                        onContextMenu={handleContextMenu}
                        className="flex-1 w-full h-full p-[60px] bg-transparent text-slate-900 font-serif text-[15px] leading-loose outline-none resize-none placeholder-slate-300 selection:bg-blue-100 selection:text-blue-900"
                        placeholder={`# Project Strategy

Right-click to insert tags...
[TASK] Define MVP
[OBJECTIVE] Secure First Client`}
                        spellCheck={false}
                    />

                    {/* Footer of the page */}
                    <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none opacity-20">
                         <span className="text-[10px] font-serif italic text-slate-900">- WingMentor Confidential -</span>
                    </div>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div 
                    className="fixed z-50 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-700 mb-1">
                        Insert Tag
                    </div>
                    <button onClick={() => insertTag('TASK')} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                        Task
                    </button>
                    <button onClick={() => insertTag('OBJECTIVE')} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Objective
                    </button>
                    <button onClick={() => insertTag('IDEA')} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        Idea Strip
                    </button>
                    <button onClick={() => insertTag('GOAL')} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-black dark:bg-white"></span>
                        Goal
                    </button>
                     <button onClick={() => insertTag('FINISHED')} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 mt-1 pt-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Finished
                    </button>
                </div>
            )}
        </div>
    );
  };

  const CompanyOverview = () => {
    // Defines all apps with their icon view (idle) and widget view (hover)
    const apps = [
      {
        id: 'timeline',
        name: 'Timeline',
        color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        widget: (
          <div className="space-y-4">
             <div className="flex items-center justify-between mb-4">
               <h4 className="font-bold text-slate-900 dark:text-white">Next Milestone</h4>
               <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded">Jan 2024</span>
             </div>
             <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                   <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm"></div>
                   <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 my-1"></div>
                </div>
                <div>
                   <p className="text-xs font-bold text-slate-900 dark:text-white">Launch & Go-to-Market</p>
                   <p className="text-[10px] text-slate-500">Formalize Products & Socials</p>
                </div>
             </div>
             <div className="mt-auto pt-2 text-xs font-bold text-emerald-500">View Roadmap &rarr;</div>
          </div>
        )
      },
      {
        id: 'planning',
        name: 'Planning',
        color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        widget: (
          <div className="space-y-3">
             <h4 className="font-bold text-slate-900 dark:text-white">Investigation Board</h4>
             <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500">Nodes</span>
                <span className="text-xs font-black text-violet-600">{boardItems.length}</span>
             </div>
             <div className="mt-auto pt-2 text-xs font-bold text-violet-500">Enter War Room &rarr;</div>
          </div>
        )
      },
      // NEW TIME MANAGEMENT APP
      {
        id: 'timeout',
        name: 'Timeout',
        description: 'Time Management',
        color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        isTool: true,
        toolUrl: 'https://timeoutapps.vercel.app/',
        toolIcon: 'https://timeoutapps.vercel.app/favicon.ico',
        widget: (
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-white">Focus Timer</h4>
                <span className="animate-pulse w-2 h-2 rounded-full bg-orange-500"></span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">25:00</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase rotate-90 origin-left translate-y-2">MIN</span>
             </div>
             <div className="mt-auto pt-2 text-xs font-bold text-orange-500">Launch App &rarr;</div>
          </div>
        )
      },
      {
        id: 'sales',
        name: 'Products', 
        description: 'Sales & Product Management',
        color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', // Shopping Bag
        isTool: false,
        widget: (
          <div>
             <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900 dark:text-white">Product Catalog</h4>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
             </div>
             <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mb-2">2 Active</div>
             <p className="text-[10px] text-slate-500">WM App & WM-1000</p>
             <div className="mt-auto pt-3 text-xs font-bold text-blue-500">View Directory &rarr;</div>
          </div>
        )
      }
    ];

    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="mb-10">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Platform Overview</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">Access all applications. Hover for a quick preview.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {apps.map((app: any) => (
            <div 
              key={app.id}
              onClick={() => {
                  if (app.isTool) {
                      setActiveTool({
                          id: app.id,
                          name: app.name,
                          description: app.description || 'Productivity Tool',
                          url: app.toolUrl,
                          iconUrl: app.toolIcon,
                          category: 'Productivity'
                      });
                  } else {
                      setCurrentSection(app.id as AppSection);
                  }
              }}
              className="group relative h-48 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 transition-all duration-300 group-hover:opacity-0 group-hover:scale-90">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${app.color}`}>
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={app.icon} />
                  </svg>
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{app.name}</h3>
              </div>

              <div className="absolute inset-0 p-6 opacity-0 scale-105 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 bg-white dark:bg-slate-900">
                {app.widget}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SimulationView = () => (
    <div className="p-8 h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      <div className="relative group">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
          <div className="w-40 h-40 rounded-full bg-white dark:bg-slate-900 border-8 border-blue-500 flex flex-col items-center justify-center shadow-2xl relative z-20">
            <span className="text-sm font-black uppercase tracking-tighter text-slate-900 dark:text-white">WingMentor</span>
            <span className="text-[9px] font-bold text-slate-400">HQ Core</span>
          </div>
      </div>
    </div>
  );

  const TimelineView = () => (
    <div className="p-8 pb-96">
      <div className="flex items-center justify-between mb-8">
        <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>WingMentor Journey</h2>
        <span className="px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest">Roadmap</span>
      </div>
      
      <div className="space-y-8 pl-4 border-l-2 border-slate-200 dark:border-slate-800 relative">
        {[
          { 
            date: 'July', 
            year: '2025',
            title: 'Inception', 
            desc: 'Initial concept of the idea.', 
            status: 'completed' 
          },
          { 
            date: 'August', 
            year: '2025',
            title: 'Validation & Utility', 
            desc: 'Understanding of the pilot industry situational awareness, knowing the problems and lived through them.', 
            status: 'completed' 
          },
          { 
            date: 'October', 
            year: '2023',
            title: 'Brand Identity', 
            desc: 'Development of visual identity, logos, and official formation of the WingMentor brand.', 
            status: 'completed' 
          },
          { 
            date: 'November', 
            year: '2023',
            title: 'AI Integration & Architecture', 
            desc: 'Began mastering Google Studio AI and architecting the WingMentor app ecosystem.', 
            status: 'completed' 
          },
          { 
            date: 'December', 
            year: '2023',
            title: 'Platform Development', 
            desc: 'Achieved full development of the mobile and desktop application MVP.', 
            status: 'completed' 
          },
          { 
            date: 'January', 
            year: '2024',
            title: 'Launch & Go-to-Market', 
            desc: 'Formalizing product sales points, establishing social media presence, and content marketing.', 
            status: 'active' 
          }
        ].map((item, i) => (
          <div key={i} className="relative pl-8 group">
             {/* Timeline Dot */}
             <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 transition-all duration-300 z-10 bg-slate-50 dark:bg-slate-950 ${
               item.status === 'active' 
                 ? 'border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.2)] scale-110' 
                 : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400'
             }`}>
               {item.status === 'completed' && (
                 <div className="w-full h-full bg-slate-300 dark:bg-slate-600 rounded-full scale-50"></div>
               )}
               {item.status === 'active' && (
                 <div className="w-full h-full bg-blue-500 rounded-full scale-50 animate-pulse"></div>
               )}
             </div>
             
             {/* Content Card */}
             <div className={`p-5 rounded-2xl border transition-all duration-300 ${
               item.status === 'active'
                 ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/30 shadow-lg shadow-blue-500/5'
                 : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'
             }`}>
               <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-2">
                 <span className={`text-sm font-black uppercase tracking-widest ${item.status === 'active' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                   {item.date} {item.year}
                 </span>
                 <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
               </div>
               <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} transition-opacity duration-300 ${item.status === 'active' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 h-0 group-hover:h-auto overflow-hidden group-hover:mt-2'}`}>
                 {item.desc}
               </p>
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  const MindmapView = () => (
     <div className="p-8 h-full flex flex-col">
       <div className="flex-1 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center relative overflow-hidden">
          <div className="text-slate-400">Mindmap Placeholder</div>
       </div>
     </div>
  );

  const SalesView = () => {
    const productApps = [
      {
        id: 'wingmentor-app',
        name: 'WingMentor App',
        description: 'Sales & Product Management',
        url: 'https://wingmentorapp.vercel.app/',
        iconUrl: 'https://wingmentorapp.vercel.app/favicon.ico', 
        iconSvg: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'
      },
      {
        id: 'wm-1000',
        name: 'WM-1000',
        description: 'Advanced Product Suite',
        url: 'https://wm-1000.vercel.app/',
        iconUrl: 'https://wm-1000.vercel.app/favicon.ico',
        iconSvg: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2' // Chip/Processor icon for hardware product
      }
    ];

    return (
      <div className="p-8">
         <h2 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-8 tracking-tight`}>Sales & Products</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productApps.map(app => (
               <div 
                 key={app.id}
                 onClick={() => setActiveTool({
                    id: app.id,
                    name: app.name,
                    description: app.description,
                    url: app.url,
                    iconUrl: app.iconUrl,
                    category: 'Productivity'
                 })}
                 className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
               >
                  <div className="flex items-center justify-between mb-4">
                     <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        {app.iconSvg ? (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={app.iconSvg} /></svg>
                        ) : (
                            <img src={app.iconUrl} className="w-6 h-6" alt="" />
                        )}
                     </div>
                     <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        Launch
                     </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{app.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{app.description}</p>
               </div>
            ))}
         </div>
      </div>
    );
  };

  const MarketingView = () => (
    <div className="p-8">
        <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Marketing Analytics</h2>
    </div>
  );

  const ObjectivesView = () => (
    <div className="p-8">
       <div className="grid gap-4">
          {objectives.map(obj => (
             <div key={obj.id} className={`p-6 rounded-2xl border flex items-center gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${
                  obj.status === 'On Track' ? 'bg-emerald-100 text-emerald-600' : 
                  obj.status === 'At Risk' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                }`}>
                   {obj.progress}%
                </div>
                <div className="flex-1">
                   <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{obj.title}</h3>
                </div>
             </div>
          ))}
       </div>
    </div>
  );

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className={`flex h-screen w-full transition-colors duration-500 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <BrowserOverlay />
      
      {/* Sidebar Navigation */}
      <aside className={`w-20 lg:w-64 flex flex-col border-r transition-all duration-300 z-40 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100 dark:border-slate-800">
          <img 
             src="https://lh3.googleusercontent.com/d/1KgVuIuCv8mKxTcJ4rClCUCdaQ3fxm0x6" 
             alt="Logo" 
             className="h-10 w-auto object-contain cursor-pointer hover:scale-105 transition-transform"
             onClick={() => setCurrentSection('overview')}
          />
          <span className={`hidden lg:block ml-3 font-black text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>WINGMENTOR</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
          {[
            { id: 'overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', label: t('overview') },
            { id: 'timeline', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: t('timeline') },
            { id: 'mindmap', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2', label: t('mindmap') },
            { id: 'planning', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', label: t('planning') },
            { id: 'document', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: t('document') },
            { id: 'sales', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', label: t('sales') },
            { id: 'marketing', icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z', label: t('marketing') },
            { id: 'simulation', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', label: t('simulation') },
            { id: 'tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', label: t('tasks') || 'Tasks' },
            { id: 'team', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', label: t('masterDirectory') },
            { id: 'tools', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', label: t('tools') }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'mindmap') {
                    setActiveTool({
                        id: 'mindmap-tool',
                        name: 'MindMap Files',
                        description: 'Visual thinking and creative brainstorming workspace.',
                        url: 'https://mindmapfiles.vercel.app/',
                        iconUrl: 'https://mindmapfiles.vercel.app/favicon.ico',
                        category: 'Productivity'
                    });
                } else {
                    setCurrentSection(item.id as AppSection);
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                currentSection === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <svg className={`w-5 h-5 ${currentSection === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
              </svg>
              <span className={`text-sm font-bold tracking-wide ${currentSection === item.id ? 'text-white' : 'group-hover:text-slate-900 dark:group-hover:text-white'}`}>{item.label}</span>
            </button>
          ))}
        </nav>
        
        {/* User Profile */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold">
              {currentUser ? currentUser[0] : 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
               <div className="font-bold text-sm text-slate-900 dark:text-white truncate">{currentUser}</div>
               <div className="text-[10px] uppercase font-bold text-slate-400">Level 4 Access</div>
            </div>
            <button onClick={() => setIsAuthenticated(false)} className="text-slate-400 hover:text-red-500">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
         {/* Top Bar */}
         <div className="h-20 px-8 flex items-center justify-between sticky top-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur z-20">
             <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{t(currentSection)}</h1>
             <div className="flex items-center gap-4">
                 <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500">
                     {isDarkMode ? (
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                     ) : (
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                     )}
                 </button>
                 {/* Language Selector */}
                 <select 
                   value={language} 
                   onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                   className="bg-transparent font-bold text-sm text-slate-500 outline-none"
                 >
                    <option value="en">EN</option>
                    <option value="fr">FR</option>
                    <option value="de">DE</option>
                    <option value="ru">RU</option>
                    <option value="ar">AR</option>
                    <option value="zh">ZH</option>
                    <option value="ja">JA</option>
                    <option value="ko">KO</option>
                 </select>
             </div>
         </div>

         {/* View Content */}
         <div className="h-[calc(100vh-80px)]">
             {currentSection === 'overview' && <CompanyOverview />}
             {currentSection === 'timeline' && <TimelineView />}
             {currentSection === 'mindmap' && <MindmapView />}
             {currentSection === 'planning' && <PlanningView 
                boardItems={boardItems} 
                setBoardItems={setBoardItems} 
                boardLinks={boardLinks} 
                setBoardLinks={setBoardLinks}
                setCurrentSection={setCurrentSection}
             />}
             {currentSection === 'document' && <DocumentView />}
             {currentSection === 'sales' && <SalesView />}
             {currentSection === 'marketing' && <MarketingView />}
             {currentSection === 'simulation' && <SimulationView />}
             
             {currentSection === 'tasks' && (
                <div className="p-8">
                   <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Tasks</h2>
                   <div className="space-y-4">
                      {tasks.map(task => (
                        <div key={task.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className={`w-3 h-3 rounded-full ${task.status === 'done' ? 'bg-green-500' : task.status === 'in-progress' ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                              <span className={`font-bold ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>{task.title}</span>
                           </div>
                           <span className="text-xs font-bold text-slate-500">{task.dueDate}</span>
                        </div>
                      ))}
                   </div>
                </div>
             )}
             
             {currentSection === 'team' && (
                 <div className="p-8">
                     <div className="mb-6 flex justify-between items-center">
                         <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('masterDirectory')}</h2>
                         <Button onClick={() => { setEditingContact(null); setIsContactModalOpen(true); }} variant="primary">{t('addRecord')}</Button>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                         {contacts.map(contact => (
                             <div key={contact.id} className="h-64">
                                <ContactCard 
                                    contact={contact} 
                                    onEdit={(c) => { setEditingContact(c); setIsContactModalOpen(true); }} 
                                    onDelete={handleDeleteContact} 
                                    t={t} 
                                />
                             </div>
                         ))}
                     </div>
                     
                     {/* Modal */}
                     {isContactModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                           <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 border border-slate-200 dark:border-slate-800">
                              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                                {editingContact ? t('modify') : t('createProfile')}
                              </h3>
                              <ContactForm 
                                initialData={editingContact || undefined} 
                                onSubmit={handleSaveContact} 
                                onCancel={() => setIsContactModalOpen(false)}
                                t={t}
                              />
                           </div>
                        </div>
                     )}
                 </div>
             )}

             {currentSection === 'tools' && (
                 <div className="p-8">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {tools.map(tool => (
                              <div key={tool.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center hover:shadow-lg transition-all">
                                  <img src={tool.iconUrl} alt="" className="w-16 h-16 rounded-xl mb-4 object-cover" />
                                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{tool.name}</h3>
                                  <p className="text-sm text-slate-500 mb-4">{tool.description}</p>
                                  <Button onClick={() => setActiveTool(tool)} variant="secondary" size="sm">{t('launchTool')}</Button>
                              </div>
                          ))}
                      </div>
                 </div>
             )}
         </div>
      </main>
    </div>
  );
};

export default App;