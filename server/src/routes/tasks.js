"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tasks_1 = require("../controllers/tasks");
const router = express_1.default.Router();
// Routes
router.get('/', tasks_1.getTasks);
router.post('/', tasks_1.createTask);
router.put('/:id', tasks_1.updateTask);
router.delete('/:id', tasks_1.deleteTask);
exports.default = router;
