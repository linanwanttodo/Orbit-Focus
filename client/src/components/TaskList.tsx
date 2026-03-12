import React, { useState } from 'react';
import { Task } from '../types';

interface TaskListProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, setTasks }) => {
  const [inputValue, setInputValue] = useState('');

  const addTask = (text: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      completed: false,
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        addTask(inputValue);
        setInputValue('');
      }
    }
  };

  console.log('TaskList 组件渲染，任务数量:', tasks.length);

  return (
    <div className="w-full h-full flex flex-col p-8 bg-transparent lg:bg-transparent rounded-none transition-all duration-300">
      <h2 className="text-4xl lg:text-5xl font-bold text-white mb-10 tracking-wide">
        To do list
      </h2>

      <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto no-scrollbar pr-2 flex-1">
        {tasks.length === 0 && (
          <div className="text-slate-600 py-4 text-lg">
             <div className="w-6 h-6 border-2 border-slate-700 rounded mb-2 inline-block mr-4 align-middle"></div>
             <span className="align-middle">Add a task...</span>
          </div>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-center justify-between py-2 transition-all duration-200"
          >
            <div className="flex items-center gap-4 w-full">
              <button
                onClick={() => toggleTask(task.id)}
                className={`flex-shrink-0 w-6 h-6 lg:w-7 lg:h-7 rounded border-2 flex items-center justify-center transition-colors ${
                  task.completed
                    ? 'bg-red-500 border-red-500'
                    : 'border-slate-500 hover:border-red-400'
                }`}
              >
                {task.completed && (
                  <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span
                className={`truncate text-lg lg:text-xl ${
                  task.completed ? 'text-slate-600 line-through' : 'text-slate-200'
                }`}
              >
                {task.text}
              </span>
            </div>
            <button
              onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity ml-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="relative mt-auto">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New task..."
          className="w-full bg-transparent text-slate-200 text-lg border-b-2 border-slate-700 py-2 focus:outline-none focus:border-red-500 placeholder-slate-600 transition-colors pr-10"
        />
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
           <button
            onClick={() => {
              if (inputValue.trim()) {
                addTask(inputValue);
                setInputValue('');
              }
            }}
            className="p-2 text-red-500 hover:text-red-400 transition-colors"
            title="Add task"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};