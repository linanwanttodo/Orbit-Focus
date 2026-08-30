import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './database';
import taskRoutes from './routes/tasks';
import sessionRoutes from './routes/sessions';

// Load environment variables
dotenv.config();

// Initialize database
initializeDatabase();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/sessions', sessionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Orbit Focus API is running' });
});

// Serve static files
app.use(express.static(resolve(dirname(fileURLToPath(import.meta.url)), '../../dist')));

// Start server
const PORT = process.env.PORT || 3000;

// ESM-compatible check: determine if this file is the entry point
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && resolve(__filename) === resolve(process.argv[1]);

if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;