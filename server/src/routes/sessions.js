"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sessions_1 = require("../controllers/sessions");
const router = express_1.default.Router();
// Routes
router.get('/', sessions_1.getSessions);
router.post('/', sessions_1.createSession);
router.put('/:id', sessions_1.updateSession);
router.delete('/:id', sessions_1.deleteSession);
router.get('/stats', sessions_1.getSessionStats);
exports.default = router;
