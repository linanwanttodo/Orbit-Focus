"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTask = exports.updateTask = exports.createTask = exports.getTasks = void 0;
const task_1 = require("../models/task");
// Get all tasks
const getTasks = (req, res) => {
    try {
        const tasks = task_1.Task.getAll();
        res.status(200).json(tasks);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getTasks = getTasks;
// Create a new task
const createTask = (req, res) => {
    try {
        const { title, description, isCompleted, orderIndex } = req.body;
        const task = task_1.Task.create({
            title,
            description,
            isCompleted: isCompleted || false,
            orderIndex: orderIndex || 0
        });
        res.status(201).json(task);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createTask = createTask;
// Update a task
const updateTask = (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const task = task_1.Task.update(id, updates);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.status(200).json(task);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateTask = updateTask;
// Delete a task
const deleteTask = (req, res) => {
    try {
        const { id } = req.params;
        const success = task_1.Task.delete(id);
        if (!success) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.status(200).json({ message: 'Task deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteTask = deleteTask;
