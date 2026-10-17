-- Daily leads + ad spend per project, entered on the Project Target page.
-- TypeORM runs with synchronize: false, so run this once against the
-- database before starting the updated backend.
CREATE TABLE IF NOT EXISTS project_daily_metrics (
  id         VARCHAR(36)    NOT NULL,
  projectId  VARCHAR(255)   NOT NULL,
  date       DATE           NOT NULL,
  leads      INT            NOT NULL DEFAULT 0,
  adSpend    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  createdAt  DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt  DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY UQ_project_daily_metrics_project_date (projectId, date)
);
