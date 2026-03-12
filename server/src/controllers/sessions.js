"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionStats = exports.deleteSession = exports.updateSession = exports.createSession = exports.getSessions = void 0;
const session_1 = require("../models/session");
// Get all sessions
const getSessions = (req, res) => {
    try {
        const sessions = session_1.Session.getAll();
        res.status(200).json(sessions);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getSessions = getSessions;
// Create a new session
const createSession = (req, res) => {
    try {
        const { type, duration, startTime, endTime, isCompleted } = req.body;
        const session = session_1.Session.create({
            type,
            duration,
            startTime,
            endTime,
            isCompleted: isCompleted || false
        });
        res.status(201).json(session);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createSession = createSession;
// Update a session
const updateSession = (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const session = session_1.Session.update(id, updates);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        res.status(200).json(session);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateSession = updateSession;
// Delete a session
const deleteSession = (req, res) => {
    try {
        const { id } = req.params;
        const success = session_1.Session.delete(id);
        if (!success) {
            return res.status(404).json({ message: 'Session not found' });
        }
        res.status(200).json({ message: 'Session deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteSession = deleteSession;
// Get session statistics
const getSessionStats = (req, res) => {
    try {
        const stats = session_1.Session.getStats();
        res.status(200).json(stats);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getSessionStats = getSessionStats;
