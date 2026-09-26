import React, { useMemo, useState } from 'react';
import { CalendarDays, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { getBoardStats, isOverdue, BOARD_COLUMNS } from '../lib/board';
import { getLocalDateString } from '../lib/timer';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface TaskBoardProps {
  tasks: Task[];
  onTasksChange: React.Dispatch<React.SetStateAction<Task[]>>;
  isSaving?: boolean;
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'bg-gh-inset text-gh-muted',
  progress: 'bg-gh-accent/15 text-gh-accent-emph',
  review: 'bg-gh-warning/15 text-gh-warning',
  done: 'bg-gh-success/15 text-gh-success-emph',
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: 'bg-gh-danger/10 text-gh-danger',
  medium: 'bg-gh-warning/10 text-gh-warning',
  low: 'bg-gh-inset text-gh-muted',
};

function statusLabelKey(status: TaskStatus): string {
  return `board.status.${status}`;
}

function priorityLabelKey(priority: TaskPriority): string {
  return `board.priority.${priority}`;
}

const TaskCard: React.FC<{
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onDragStart: (event: React.DragEvent<HTMLElement>, task: Task) => void;
}> = ({ task, onEdit, onDelete, onDragStart }) => {
  const { t } = useI18n();
  const overdue = isOverdue(task);

  return (
    <article
      draggable
      onDragStart={(event) => onDragStart(event, task)}
      className="group rounded-xl border border-gh-border bg-gh-surface p-3 shadow-card transition-colors hover:border-gh-border-muted"
    >
      <div className="mb-2 flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-gh-subtle" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[task.priority]}`}>
              {t(priorityLabelKey(task.priority))}
            </span>
            <span className="ml-auto font-mono text-[10px] text-gh-subtle">{task.id.slice(-6)}</span>
          </div>
          <h3 className={`text-sm leading-relaxed ${task.status === 'done' ? 'text-gh-subtle line-through' : 'text-gh-fg'}`}>
            {task.text}
          </h3>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gh-muted">{task.description}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1">
        <span
          className={`inline-flex items-center ${overdue ? 'text-gh-danger' : 'text-gh-muted'}`}
          title={task.dueDate || t('board.noDueDate')}
          aria-label={task.dueDate || t('board.noDueDate')}
        >
          <CalendarDays className="h-4 w-4 text-gh-fg" aria-hidden="true" />
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)} aria-label={t('board.edit')}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-gh-danger" onClick={() => onDelete(task)} aria-label={t('board.delete')}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
};

export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks, onTasksChange, isSaving = false }) => {
  const { t } = useI18n();
  const today = getLocalDateString();
  const stats = useMemo(() => getBoardStats(tasks, today), [tasks, today]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('todo');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return BOARD_COLUMNS.reduce<Record<TaskStatus, Task[]>>((result, status) => {
      result[status] = tasks
        .filter((task) => task.status === status)
        .sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
      return result;
    }, { todo: [], progress: [], review: [], done: [] });
  }, [tasks]);

  const openCreate = (status: TaskStatus = 'todo') => {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormStatus(status);
    setFormPriority('medium');
    setFormDueDate('');
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.text);
    setFormDescription(task.description);
    setFormStatus(task.status);
    setFormPriority(task.priority);
    setFormDueDate(task.dueDate || '');
    setFormError(null);
    setDialogOpen(true);
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    onTasksChange((previous) => previous.map((task) =>
      task.id === id
        ? { ...task, status, completed: status === 'done' }
        : task
    ));
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>, status: TaskStatus) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    if (id) updateTaskStatus(id, status);
  };

  const handleSubmit = () => {
    const title = formTitle.trim();
    if (!title) {
      setFormError(t('board.titleRequired'));
      return;
    }

    const nextTask: Task = {
      id: editingTask?.id || `task_${crypto.randomUUID()}`,
      text: title,
      description: formDescription.trim(),
      status: formStatus,
      priority: formPriority,
      dueDate: formDueDate || null,
      completed: formStatus === 'done',
      orderIndex: editingTask?.orderIndex ?? Math.max(-1, ...tasks.map((task) => task.orderIndex)) + 1,
    };

    onTasksChange((previous) => editingTask
      ? previous.map((task) => task.id === editingTask.id ? nextTask : task)
      : [...previous, nextTask]
    );
    setDialogOpen(false);
  };

  const deleteTask = (task: Task) => {
    onTasksChange((previous) => previous.filter((item) => item.id !== task.id));
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-20 lg:px-8 lg:pb-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-gh-fg">{t('board.title')}</h2>
              <p className="mt-1 text-xs text-gh-muted">{t('board.description')}</p>
            </div>
            <Button onClick={() => openCreate()} disabled={isSaving} aria-label={t('board.newTask')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('board.newTask')}</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: t('board.totalTasks'), value: stats.total, tone: '' },
              { label: t('board.activeTasks'), value: stats.active, tone: 'text-gh-accent-emph' },
              { label: t('board.completedTasks'), value: stats.done, tone: 'text-gh-success-emph' },
              { label: t('board.overdueTasks'), value: stats.overdue, tone: 'text-gh-danger' },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-gh-border bg-gh-surface p-4 shadow-card">
                <div className="text-[11px] font-medium uppercase tracking-wider text-gh-muted">{card.label}</div>
                <div className={`mt-2 font-mono text-2xl font-medium tabular-nums ${card.tone || 'text-gh-fg'}`}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[920px] grid-cols-4 gap-3">
              {BOARD_COLUMNS.map((status) => (
                <section
                  key={status}
                  className="flex min-h-[320px] flex-col rounded-2xl border border-gh-border bg-gh-inset/40"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, status)}
                >
                  <header className="flex items-center gap-2 border-b border-gh-border-muted px-3 py-3">
                    <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[status].split(' ')[0]}`} aria-hidden="true" />
                    <h3 className="text-sm font-medium text-gh-fg">{t(statusLabelKey(status))}</h3>
                    <span className="ml-auto rounded-full bg-gh-surface px-2 py-0.5 font-mono text-[11px] text-gh-muted">{grouped[status].length}</span>
                  </header>
                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {grouped[status].length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gh-border p-5 text-center text-xs text-gh-subtle">
                        {t('board.emptyColumn')}
                      </div>
                    ) : (
                      grouped[status].map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onEdit={openEdit}
                          onDelete={deleteTask}
                          onDragStart={(event, item) => event.dataTransfer.setData('text/plain', item.id)}
                        />
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    className="mx-2 mb-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-gh-border px-2 py-2 text-xs text-gh-muted transition-colors hover:border-gh-accent hover:text-gh-accent-emph"
                    onClick={() => openCreate(status)}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('board.addTask')}
                  </button>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? t('board.editTask') : t('board.newTask')}</DialogTitle>
            <DialogDescription>{t('board.formDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gh-muted">
              {t('board.taskTitle')}
              <Input value={formTitle} onChange={(event) => setFormTitle(event.target.value)} maxLength={500} autoFocus />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-gh-muted">
                {t('board.statusLabel')}
                <select value={formStatus} onChange={(event) => setFormStatus(event.target.value as TaskStatus)} className="h-9 rounded-lg border border-gh-border bg-gh-inset px-2 text-sm text-gh-fg">
                  {BOARD_COLUMNS.map((status) => <option key={status} value={status}>{t(statusLabelKey(status))}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-gh-muted">
                {t('board.priorityLabel')}
                <select value={formPriority} onChange={(event) => setFormPriority(event.target.value as TaskPriority)} className="h-9 rounded-lg border border-gh-border bg-gh-inset px-2 text-sm text-gh-fg">
                  {(['high', 'medium', 'low'] as TaskPriority[]).map((priority) => <option key={priority} value={priority}>{t(priorityLabelKey(priority))}</option>)}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gh-muted">
              {t('board.dueDate')}
              <Input
                type="date"
                value={formDueDate}
                onChange={(event) => setFormDueDate(event.target.value)}
                className="border border-gh-border bg-gh-inset text-gh-fg"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gh-muted">
              {t('board.taskDescription')}
              <textarea value={formDescription} onChange={(event) => setFormDescription(event.target.value)} maxLength={2000} rows={3} className="resize-y rounded-lg border border-gh-border bg-gh-inset px-3 py-2 text-sm text-gh-fg outline-none focus:border-gh-accent" />
            </label>
            {formError && <div className="rounded-lg bg-gh-error-bg px-3 py-2 text-xs text-gh-danger">{formError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>{editingTask ? t('common.save') : t('board.createTask')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
