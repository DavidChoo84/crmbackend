-- LPV (lifetime spending) and AOV (average spending per order) on customer.
-- Generated STORED columns: MySQL computes them from totalSpent/totalOrder
-- and recalculates automatically whenever either changes (order created,
-- cancelled, or customer edited), so they never drift out of sync.
-- Existing rows are filled in when this runs. Requires MySQL 5.7+.
ALTER TABLE customer
  ADD COLUMN lpv DECIMAL(10, 2)
    GENERATED ALWAYS AS (totalSpent) STORED,
  ADD COLUMN aov DECIMAL(10, 2)
    GENERATED ALWAYS AS (IF(totalOrder > 0, ROUND(totalSpent / totalOrder, 2), 0)) STORED;
