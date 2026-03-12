import { Router } from 'express';
import * as SheetModel from '../models/sheet';

const router = Router();

// 获取所有表格
router.get('/', (req, res) => {
    try {
        const sheets = SheetModel.getAllSheets();
        res.json(sheets);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新表格
router.post('/', (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const sheet = SheetModel.createSheet(title, description);
        res.status(201).json(sheet);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 更新表格
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;

        const sheet = SheetModel.updateSheet(id, title, description);

        if (!sheet) {
            return res.status(404).json({ error: 'Sheet not found' });
        }

        res.json(sheet);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 删除表格
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const success = SheetModel.deleteSheet(id);

        if (!success) {
            return res.status(404).json({ error: 'Sheet not found' });
        }

        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 获取表格的所有单元格
router.get('/:id/cells', (req, res) => {
    try {
        const { id } = req.params;
        const cells = SheetModel.getSheetCells(id);
        res.json(cells);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 批量更新单元格
router.post('/:id/cells/batch', (req, res) => {
    try {
        const { id } = req.params;
        const { cells } = req.body;

        if (!Array.isArray(cells)) {
            return res.status(400).json({ error: 'Cells must be an array' });
        }

        SheetModel.batchUpdateCells(id, cells);
        res.status(200).json({ message: 'Cells updated successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 获取看板配置
router.get('/:id/kanban', (req, res) => {
    try {
        const { id } = req.params;
        const config = SheetModel.getKanbanConfig(id);

        if (!config) {
            return res.status(404).json({ error: 'Kanban config not found' });
        }

        res.json(config);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 更新看板配置
router.post('/:id/kanban', (req, res) => {
    try {
        const { id } = req.params;
        const { columns, cardFields } = req.body;

        if (!columns || !cardFields) {
            return res.status(400).json({ error: 'Columns and cardFields are required' });
        }

        const config = SheetModel.updateKanbanConfig(
            id,
            JSON.stringify(columns),
            JSON.stringify(cardFields)
        );

        res.json(config);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
