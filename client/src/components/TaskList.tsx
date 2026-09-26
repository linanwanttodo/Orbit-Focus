import React, { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Task } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface TaskListProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  isSaving?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, setTasks, isSaving }) => {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const addTask = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newTask: Task = {
      id: `task_${crypto.randomUUID()}`,
      text: trimmed,
      completed: false,
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      orderIndex: 0,
    };
    setTasks((prev) => [...prev, newTask]);
    setInputValue('');
    setError(null);
  }, [setTasks]);

  const toggleTask = useCallback((id: string, checked: boolean) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, completed: checked, status: checked ? 'done' : 'todo' }
          : task
      )
    );
  }, [setTasks]);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, [setTasks]);

  const handleAddClick = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      addTask(inputValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加任务失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-8 bg-transparent lg:bg-transparent rounded-none transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-wide">
          {t('timer.todo.title')}
        </h2>
        {(isSubmitting || isSaving) && (
          <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground animate-spin" />
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {`${t('errors.serverError')}: ${error}`}
        </div>
      )}

      <div className="space-y-1 mb-8 max-h-[400px] overflow-y-auto pr-2 flex-1">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {t('timer.todo.empty')}
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="group flex items-center justify-between py-2 transition-all duration-200"
            >
              <div className="flex items-center gap-3 w-full">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={(checked) => toggleTask(task.id, checked === true)}
                  aria-label={task.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
                />
                <span
                  className={`truncate text-lg lg:text-xl ${
                    task.completed ? 'text-gh-subtle line-through' : 'text-foreground'
                  }`}
                >
                  {task.text}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => deleteTask(task.id)}
                aria-label={`Delete task: ${task.text}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto">
        <div className="flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddClick();
            }}
            placeholder={t('timer.todo.placeholder')}
            disabled={isSubmitting}
          />
          <Button
            type="button"
            onClick={handleAddClick}
            disabled={isSubmitting || !inputValue.trim()}
            aria-label={t('timer.todo.addTask')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};