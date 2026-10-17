import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(private dataSource: DataSource) {}

  // Accepts either a single projectId or a comma-separated list (used by
  // the dashboard's "all authorized projects" aggregate view). Existing
  // single-project callers (the per-project Reports page) are unaffected.
  private parseProjectIds(projectId: string): string[] {
    return projectId.split(',').map((s) => s.trim()).filter(Boolean);
  }

  // 🔒 Parses the requested IDs, then intersects them with what this user
  // is actually allowed to see: master → everything requested; anyone else
  // → only projects they're assigned to in project_members. Without this,
  // any logged-in user could request another project's numbers directly.
  private async resolveProjectIds(
    projectIdParam: string,
    user: { userId: string; role: string },
  ): Promise<string[]> {
    const requested = this.parseProjectIds(projectIdParam);
    if (requested.length === 0) return [];
    if (user?.role === 'master') return requested;
    if (!user?.userId) return [];

    const rows = await this.dataSource.query(
      `SELECT projectId FROM project_members WHERE userId = ? AND projectId IN (?)`,
      [user.userId, requested],
    );
    return rows.map((r: any) => r.projectId);
  }

  private async sumSales(projectIds: string[], dateFilterSql: string, extraParams: any[]) {
    if (projectIds.length === 0) return 0;
    const sql = `
      SELECT COALESCE(SUM(op.packagePrice * op.quantity), 0) AS total
      FROM order_package op
      INNER JOIN \`order\` o ON o.orderId = op.orderId
      INNER JOIN package pkg ON pkg.packageId = op.packageId
      WHERE pkg.projectId IN (?)
        AND o.status != 'Cancelled'
        ${dateFilterSql}
    `;
    const result = await this.dataSource.query(sql, [projectIds, ...extraParams]);
    return Number(result[0]?.total) || 0;
  }

  private async sumExpenses(projectIds: string[], dateFilterSql: string, extraParams: any[]) {
    if (projectIds.length === 0) return 0;
    const sql = `
      SELECT COALESCE(SUM(opr.unitCost * opr.quantity * op.quantity), 0) AS total
      FROM order_product opr
      INNER JOIN order_package op ON op.orderPackageId = opr.orderPackageId
      INNER JOIN \`order\` o ON o.orderId = op.orderId
      INNER JOIN package pkg ON pkg.packageId = op.packageId
      WHERE pkg.projectId IN (?)
        AND o.status != 'Cancelled'
        ${dateFilterSql}
    `;
    const result = await this.dataSource.query(sql, [projectIds, ...extraParams]);
    return Number(result[0]?.total) || 0;
  }

  /**
   * KPI summary for a project (or comma-separated set of projects) + month.
   * - totalSales: all-time (no date filter)
   * - currentSales / expenses: scoped to the given year+month
   * - estimateSales: currentSales / daysElapsed × daysInMonth (month-end
   *   projection from the daily average so far)
   * - salesTarget: summed from project_targets for that month
   * - adSpend / totalLead: summed from the daily entries in
   *   project_daily_metrics for that month
   * - totalOrders: non-cancelled orders that month containing a template
   *   package of the project(s) — same scope as currentSales
   * - cpr: adSpend / totalLead (Cost Per Result)
   * - conversionRate: totalOrders / totalLead × 100 (%)
   * - returnOnExpenses: currentSales / estimateSales
   * - roas: currentSales / adSpend (Return on Ad Spend)
   */
  async getSummary(projectIdParam: string, year: number, month: number) {
    const projectIds = this.parseProjectIds(projectIdParam);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = ymd(year, month + 1, 1); // first day of next month

    const totalSales = await this.sumSales(projectIds, '', []);
    const currentSales = await this.sumSales(
      projectIds,
      'AND o.orderDate >= ? AND o.orderDate < ?',
      [start, end],
    );
    const expenses = await this.sumExpenses(
      projectIds,
      'AND o.orderDate >= ? AND o.orderDate < ?',
      [start, end],
    );

    let salesTarget = 0;
    let adSpend = 0;
    let totalLead = 0;
    let totalOrders = 0;
    if (projectIds.length > 0) {
      const targetRows = await this.dataSource.query(
        `SELECT COALESCE(SUM(targetOfMonth), 0) AS salesTarget
         FROM project_targets
         WHERE projectId IN (?) AND year = ? AND month = ?`,
        [projectIds, year, month],
      );
      salesTarget = Number(targetRows[0]?.salesTarget) || 0;

      const dailyRows = await this.dataSource.query(
        `SELECT COALESCE(SUM(adSpend), 0) AS adSpend, COALESCE(SUM(leads), 0) AS leads
         FROM project_daily_metrics
         WHERE projectId IN (?) AND date >= ? AND date < ?`,
        [projectIds, start, end],
      );
      adSpend = Number(dailyRows[0]?.adSpend) || 0;
      totalLead = Number(dailyRows[0]?.leads) || 0;

      const orderRows = await this.dataSource.query(
        `SELECT COUNT(DISTINCT o.orderId) AS orders
         FROM order_package op
         INNER JOIN \`order\` o ON o.orderId = op.orderId
         INNER JOIN package pkg ON pkg.packageId = op.packageId
         WHERE pkg.projectId IN (?)
           AND o.status != 'Cancelled'
           AND o.orderDate >= ? AND o.orderDate < ?`,
        [projectIds, start, end],
      );
      totalOrders = Number(orderRows[0]?.orders) || 0;
    }

    // Estimate monthly sales = (sales so far / days elapsed) × days in month.
    // Days elapsed: today's day for the current month, the full month for
    // past months (so the estimate equals actual sales), 0 for future months.
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const now = new Date();
    const selectedKey = year * 12 + month;
    const currentKey = now.getFullYear() * 12 + (now.getMonth() + 1);
    const daysElapsed =
      selectedKey < currentKey ? daysInMonth : selectedKey === currentKey ? now.getDate() : 0;
    const estimateSales = daysElapsed > 0 ? (currentSales / daysElapsed) * daysInMonth : 0;

    const returnOnExpenses = estimateSales > 0 ? currentSales / estimateSales : 0;
    const roas = adSpend > 0 ? currentSales / adSpend : 0;
    const cpr = totalLead > 0 ? adSpend / totalLead : 0;
    const conversionRate = totalLead > 0 ? (totalOrders / totalLead) * 100 : 0;

    return {
      totalSales,
      currentSales,
      estimateSales,
      daysElapsed,
      daysInMonth,
      expenses,
      salesTarget,
      adSpend,
      totalLead,
      totalOrders,
      cpr,
      conversionRate,
      returnOnExpenses,
      roas,
    };
  }

  // Shared base query for the chart endpoints: sales grouped by `bucketSql`
  // within [start, end). Returns a Map of bucket label -> total.
  private async salesByBucket(projectIds: string[], bucketSql: string, start: string, end: string) {
    const sql = `
      SELECT ${bucketSql} AS label, COALESCE(SUM(op.packagePrice * op.quantity), 0) AS total
      FROM order_package op
      INNER JOIN \`order\` o ON o.orderId = op.orderId
      INNER JOIN package pkg ON pkg.packageId = op.packageId
      WHERE pkg.projectId IN (?)
        AND o.status != 'Cancelled'
        AND o.orderDate >= ? AND o.orderDate < ?
      GROUP BY label
    `;
    const rows = await this.dataSource.query(sql, [projectIds, start, end]);
    return new Map<string, number>(rows.map((r: any) => [String(r.label), Number(r.total) || 0]));
  }

  // The chart endpoints are anchored to the dashboard's selected month
  // (default: current month) and return every bucket in range, zero-filled,
  // so a month with no sales renders as an empty chart instead of showing
  // other months' data.

  // One point per day of the selected month.
  async getDailySales(projectIdParam: string, year?: number, month?: number) {
    const projectIds = this.parseProjectIds(projectIdParam);
    if (projectIds.length === 0) return [];
    const { y, m } = resolveMonth(year, month);
    const totals = await this.salesByBucket(
      projectIds, `DATE_FORMAT(o.orderDate, '%Y-%m-%d')`, ymd(y, m, 1), ymd(y, m + 1, 1),
    );

    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const result: { label: string; total: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = ymd(y, m, d);
      result.push({ label: key, total: totals.get(key) ?? 0 });
    }
    return result;
  }

  // One point per week (Monday start) overlapping the selected month;
  // only that month's orders are counted. Label = the week's Monday.
  async getWeeklySales(projectIdParam: string, year?: number, month?: number) {
    const projectIds = this.parseProjectIds(projectIdParam);
    if (projectIds.length === 0) return [];
    const { y, m } = resolveMonth(year, month);
    const totals = await this.salesByBucket(
      projectIds,
      `DATE_FORMAT(DATE_SUB(DATE(o.orderDate), INTERVAL WEEKDAY(o.orderDate) DAY), '%Y-%m-%d')`,
      ymd(y, m, 1),
      ymd(y, m + 1, 1),
    );

    const result: { label: string; total: number }[] = [];
    const cursor = new Date(Date.UTC(y, m - 1, 1));
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7)); // back to Monday
    const monthEnd = new Date(Date.UTC(y, m, 1));
    while (cursor < monthEnd) {
      const key = cursor.toISOString().slice(0, 10);
      result.push({ label: key, total: totals.get(key) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return result;
  }

  // One point per month for the `months` months ending at the selected month.
  async getMonthlySales(projectIdParam: string, months = 12, year?: number, month?: number) {
    const projectIds = this.parseProjectIds(projectIdParam);
    if (projectIds.length === 0) return [];
    const { y, m } = resolveMonth(year, month);
    const totals = await this.salesByBucket(
      projectIds, `DATE_FORMAT(o.orderDate, '%Y-%m')`, ymd(y, m - months + 1, 1), ymd(y, m + 1, 1),
    );

    const result: { label: string; total: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const key = ymd(y, m - i, 1).slice(0, 7);
      result.push({ label: key, total: totals.get(key) ?? 0 });
    }
    return result;
  }
}

function resolveMonth(year?: number, month?: number) {
  if (year && month && month >= 1 && month <= 12) return { y: year, m: month };
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1 };
}

// 'YYYY-MM-DD' built in UTC so the server's timezone can't shift the date.
// Month/day overflow is normalised (e.g. month 13 -> January next year).
function ymd(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}