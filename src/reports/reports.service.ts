import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(private dataSource: DataSource) {}

  private async sumSales(projectId: string, dateFilterSql: string, extraParams: any[]) {
    const sql = `
      SELECT COALESCE(SUM(op.packagePrice * op.quantity), 0) AS total
      FROM order_package op
      INNER JOIN \`order\` o ON o.orderId = op.orderId
      INNER JOIN package pkg ON pkg.packageId = op.packageId
      WHERE pkg.projectId = ?
        AND o.status != 'Cancelled'
        ${dateFilterSql}
    `;
    const result = await this.dataSource.query(sql, [projectId, ...extraParams]);
    return Number(result[0]?.total) || 0;
  }

  private async sumExpenses(projectId: string, dateFilterSql: string, extraParams: any[]) {
    const sql = `
      SELECT COALESCE(SUM(opr.unitCost * opr.quantity * op.quantity), 0) AS total
      FROM order_product opr
      INNER JOIN order_package op ON op.orderPackageId = opr.orderPackageId
      INNER JOIN \`order\` o ON o.orderId = op.orderId
      INNER JOIN package pkg ON pkg.packageId = op.packageId
      WHERE pkg.projectId = ?
        AND o.status != 'Cancelled'
        ${dateFilterSql}
    `;
    const result = await this.dataSource.query(sql, [projectId, ...extraParams]);
    return Number(result[0]?.total) || 0;
  }

  /**
   * KPI summary for a specific project + month.
   * - totalSales: all-time (no date filter)
   * - currentSales / expenses: scoped to the given year+month
   * - salesTarget / adSpend: pulled from project_targets for that month
   * - returnOnExpenses: salesTarget / expenses, per the requested formula
   */
  async getSummary(projectId: string, year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateObj = new Date(year, month, 1); // first day of next month
    const end = endDateObj.toISOString().slice(0, 10);

    const totalSales = await this.sumSales(projectId, '', []);
    const currentSales = await this.sumSales(
      projectId,
      'AND o.orderDate >= ? AND o.orderDate < ?',
      [start, end],
    );
    const expenses = await this.sumExpenses(
      projectId,
      'AND o.orderDate >= ? AND o.orderDate < ?',
      [start, end],
    );

    const targetRows = await this.dataSource.query(
      `SELECT targetOfMonth, adSpend FROM project_targets WHERE projectId = ? AND year = ? AND month = ?`,
      [projectId, year, month],
    );
    const salesTarget = Number(targetRows[0]?.targetOfMonth) || 0;
    const adSpend = Number(targetRows[0]?.adSpend) || 0;
    const returnOnExpenses = expenses > 0 ? salesTarget / expenses : 0;

    return { totalSales, currentSales, expenses, salesTarget, adSpend, returnOnExpenses };
  }

  async getDailySales(projectId: string, days = 30) {
    const sql = `
      SELECT DATE(o.orderDate) AS label, COALESCE(SUM(op.packagePrice * op.quantity), 0) AS total
      FROM order_package op
      INNER JOIN \`order\` o ON o.orderId = op.orderId
      INNER JOIN package pkg ON pkg.packageId = op.packageId
      WHERE pkg.projectId = ?
        AND o.status != 'Cancelled'
        AND o.orderDate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(o.orderDate)
      ORDER BY DATE(o.orderDate) ASC
    `;
    const rows = await this.dataSource.query(sql, [projectId, days]);
    return rows.map((r: any) => ({ label: r.label, total: Number(r.total) || 0 }));
  }

  async getWeeklySales(projectId: string, weeks = 12) {
    const sql = `
      SELECT YEARWEEK(o.orderDate, 3) AS yw, MIN(DATE(o.orderDate)) AS label,
             COALESCE(SUM(op.packagePrice * op.quantity), 0) AS total
      FROM order_package op
      INNER JOIN \`order\` o ON o.orderId = op.orderId
      INNER JOIN package pkg ON pkg.packageId = op.packageId
      WHERE pkg.projectId = ?
        AND o.status != 'Cancelled'
        AND o.orderDate >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
      GROUP BY yw
      ORDER BY yw ASC
    `;
    const rows = await this.dataSource.query(sql, [projectId, weeks]);
    return rows.map((r: any) => ({ label: r.label, total: Number(r.total) || 0 }));
  }

  async getMonthlySales(projectId: string, months = 12) {
    const sql = `
      SELECT DATE_FORMAT(o.orderDate, '%Y-%m') AS label,
             COALESCE(SUM(op.packagePrice * op.quantity), 0) AS total
      FROM order_package op
      INNER JOIN \`order\` o ON o.orderId = op.orderId
      INNER JOIN package pkg ON pkg.packageId = op.packageId
      WHERE pkg.projectId = ?
        AND o.status != 'Cancelled'
        AND o.orderDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY label
      ORDER BY label ASC
    `;
    const rows = await this.dataSource.query(sql, [projectId, months]);
    return rows.map((r: any) => ({ label: r.label, total: Number(r.total) || 0 }));
  }
}