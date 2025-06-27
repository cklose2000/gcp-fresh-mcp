# BigQuery Tool Selection Test Prompts

## Test Prompts for Verifying Tool Selection

### 1. Listing Datasets
**Prompt**: "List all BigQuery datasets in my project"
**Expected Tool**: `gcp-sql` with `operation: "list-datasets"`

### 2. Listing Tables
**Prompt**: "Show me all tables in the analytics dataset"
**Expected Tool**: `gcp-sql` with `operation: "list-tables", dataset: "analytics"`

### 3. Getting Table Schema
**Prompt**: "What's the schema of the users table in the production dataset?"
**Expected Tool**: `gcp-sql` with `operation: "describe-table", dataset: "production", table: "users"`

### 4. Running Custom Query
**Prompt**: "Run this query: SELECT COUNT(*) FROM production.users WHERE created_date > '2024-01-01'"
**Expected Tool**: `gcp-sql` with `query: "SELECT COUNT(*) FROM production.users WHERE created_date > '2024-01-01'"`

### 5. Getting Dataset Information
**Prompt**: "Get metadata about the analytics dataset"
**Expected Tool**: `gcp-sql` with `operation: "dataset-info", dataset: "analytics"`

### 6. Listing Views
**Prompt**: "Show all views in the reporting dataset"
**Expected Tool**: `gcp-sql` with `operation: "list-views", dataset: "reporting"`

### 7. Job History
**Prompt**: "Show me the last 50 BigQuery jobs from the past 12 hours"
**Expected Tool**: `gcp-sql` with `operation: "job-history", hours: 12, limit: 50`

### 8. Current Project
**Prompt**: "What's my current GCP project?"
**Expected Tool**: `gcp-sql` with `operation: "current-project"`

### 9. Creating Dataset
**Prompt**: "Create a new dataset called test_dataset in EU region"
**Expected Tool**: `bq-create-dataset` with `datasetId: "test_dataset", location: "EU"`

### 10. Complex Schema Query
**Prompt**: "Find all tables in the analytics dataset that have a column named 'user_id'"
**Expected Tool**: `gcp-sql` with custom query using INFORMATION_SCHEMA

## Verification Process

1. Each prompt should result in Claude selecting the correct tool on the first attempt
2. No trial-and-error should be needed
3. The tool parameters should be correctly populated based on the prompt
4. Legacy tools should only be used when explicitly necessary (e.g., dataset creation)