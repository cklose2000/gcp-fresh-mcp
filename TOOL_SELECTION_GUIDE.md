# BigQuery Tool Selection Guide

## Overview

This guide helps you choose the right BigQuery tool for your task. The `gcp-sql` tool is the preferred universal interface for most BigQuery operations.

## Tool Hierarchy

### 🌟 Primary Tool: `gcp-sql`
The universal SQL interface that should be your first choice for BigQuery operations.

### 📦 Legacy Tools
These tools are maintained for backward compatibility but `gcp-sql` is preferred:
- `bq-list-datasets` → Use `gcp-sql` with `operation: "list-datasets"`
- `bq-query` → Use `gcp-sql` with `query` parameter
- `bq-list-tables` → Use `gcp-sql` with `operation: "list-tables"`
- `bq-create-dataset` → Still required for dataset creation (not available in `gcp-sql`)

## Quick Reference

| Task | Tool | Parameters |
|------|------|------------|
| List all datasets | `gcp-sql` | `{ "operation": "list-datasets" }` |
| List tables in dataset | `gcp-sql` | `{ "operation": "list-tables", "dataset": "my_dataset" }` |
| Get table schema | `gcp-sql` | `{ "operation": "describe-table", "dataset": "my_dataset", "table": "my_table" }` |
| Run custom SQL | `gcp-sql` | `{ "query": "SELECT * FROM dataset.table" }` |
| Get dataset info | `gcp-sql` | `{ "operation": "dataset-info", "dataset": "my_dataset" }` |
| List views | `gcp-sql` | `{ "operation": "list-views", "dataset": "my_dataset" }` |
| View job history | `gcp-sql` | `{ "operation": "job-history", "hours": 24, "limit": 100 }` |
| Get current project | `gcp-sql` | `{ "operation": "current-project" }` |
| Create new dataset | `bq-create-dataset` | `{ "datasetId": "new_dataset", "location": "US" }` |

## Detailed Usage Examples

### 1. Information Discovery
```json
// List all datasets
{
  "tool": "gcp-sql",
  "parameters": {
    "operation": "list-datasets"
  }
}

// Explore a specific dataset
{
  "tool": "gcp-sql",
  "parameters": {
    "operation": "list-tables",
    "dataset": "analytics"
  }
}
```

### 2. Schema Exploration
```json
// Get detailed table information
{
  "tool": "gcp-sql",
  "parameters": {
    "operation": "describe-table",
    "dataset": "production",
    "table": "users"
  }
}

// Find tables with specific columns (custom query)
{
  "tool": "gcp-sql",
  "parameters": {
    "query": "SELECT table_name FROM `project.dataset.INFORMATION_SCHEMA.COLUMNS` WHERE column_name = 'user_id'"
  }
}
```

### 3. Data Analysis
```json
// Simple aggregation
{
  "tool": "gcp-sql",
  "parameters": {
    "query": "SELECT COUNT(*) as total, DATE(created_at) as day FROM `project.dataset.events` GROUP BY day ORDER BY day DESC LIMIT 7"
  }
}

// Complex analysis with formatting
{
  "tool": "gcp-sql",
  "parameters": {
    "query": "SELECT * FROM `project.dataset.table` WHERE condition = true",
    "format": "table",
    "maxRows": 50
  }
}
```

### 4. Administrative Tasks
```json
// Check recent query performance
{
  "tool": "gcp-sql",
  "parameters": {
    "operation": "job-history",
    "hours": 6,
    "limit": 20
  }
}

// Create a new dataset (requires legacy tool)
{
  "tool": "bq-create-dataset",
  "parameters": {
    "datasetId": "new_analytics",
    "location": "EU"
  }
}
```

## Performance Tips

1. **Use Predefined Operations**: Operations like `list-datasets` use optimized INFORMATION_SCHEMA queries
2. **Specify Limits**: Use `maxRows` parameter to control result size
3. **Filter Early**: Include WHERE clauses in custom queries to reduce data processing
4. **Choose Appropriate Format**: Use `format: "table"` for human-readable output, `format: "json"` for programmatic processing

## Common Patterns

### Pattern 1: Dataset Discovery Flow
1. List all datasets with `operation: "list-datasets"`
2. Explore specific dataset with `operation: "list-tables"`
3. Investigate table details with `operation: "describe-table"`

### Pattern 2: Query Development Flow
1. Check table schema with `operation: "describe-table"`
2. Write and test query with `query` parameter
3. Review execution with `operation: "job-history"`

### Pattern 3: Cross-Dataset Analysis
```json
{
  "tool": "gcp-sql",
  "parameters": {
    "query": "SELECT a.*, b.category FROM `project.dataset1.table1` a JOIN `project.dataset2.table2` b ON a.id = b.id"
  }
}
```

## Troubleshooting

### Issue: Tool selection confusion
**Solution**: Always start with `gcp-sql` unless you need to create a dataset

### Issue: Missing required parameters
**Solution**: Check the inline comments in the operation enum:
- `list-tables` requires `dataset`
- `describe-table` requires both `dataset` and `table`
- `job-history` benefits from `hours` and `limit` parameters

### Issue: Query syntax errors
**Solution**: Use backticks for fully qualified table names: `` `project.dataset.table` ``

## Migration Guide

If you're updating from legacy tools:

| Old Command | New Command |
|-------------|-------------|
| `bq-list-datasets` | `gcp-sql` with `operation: "list-datasets"` |
| `bq-query` with `query: "SELECT..."` | `gcp-sql` with `query: "SELECT..."` |
| `bq-list-tables` with `datasetId: "X"` | `gcp-sql` with `operation: "list-tables", dataset: "X"` |

The only exception is `bq-create-dataset`, which remains necessary for dataset creation operations.