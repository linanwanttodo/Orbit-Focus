// 简单的公式计算引擎
export class FormulaEngine {
    // 计算公式
    static evaluate(formula: string, getCellValue: (ref: string) => string): string {
        try {
            // 移除开头的 =
            const expr = formula.substring(1).trim();

            // 替换单元格引用 (如 A1, B2)
            const withValues = expr.replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
                const value = getCellValue(match);
                return value || '0';
            });

            // 处理百分比 (如 50%)
            const withPercent = withValues.replace(/(\d+(?:\.\d+)?)\s*%/g, (match, num) => {
                return String(parseFloat(num) / 100);
            });

            // 安全计算
            const result = this.safeEval(withPercent);
            return String(result);
        } catch (error) {
            return '#ERROR';
        }
    }

    // 安全的表达式计算
    private static safeEval(expr: string): number {
        // 只允许数字、运算符和括号
        if (!/^[\d+\-*/(). ]+$/.test(expr)) {
            throw new Error('Invalid expression');
        }

        // 使用 Function 构造器安全计算
        const fn = new Function('return ' + expr);
        const result = fn();

        // 四舍五入到 2 位小数
        return Math.round(result * 100) / 100;
    }

    // 获取单元格引用 (如 A1 -> {col: 0, row: 0})
    static parseCellRef(ref: string): { col: number; row: number } | null {
        const match = ref.match(/^([A-Z]+)(\d+)$/);
        if (!match) return null;

        const colStr = match[1];
        const rowStr = match[2];

        // 列字母转数字 (A=0, B=1, ..., Z=25, AA=26, ...)
        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + (colStr.charCodeAt(i) - 65);
        }

        const row = parseInt(rowStr) - 1;

        return { col, row };
    }

    // 数字转列字母 (0=A, 1=B, ..., 25=Z, 26=AA, ...)
    static colToLetter(col: number): string {
        let letter = '';
        while (col >= 0) {
            letter = String.fromCharCode(65 + (col % 26)) + letter;
            col = Math.floor(col / 26) - 1;
        }
        return letter;
    }
}
