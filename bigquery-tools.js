// BigQuery MCP tool definitions
export const allBigQueryTools = [
  {
    name: "gcp-sql",
    description: `Universal SQL interface for BigQuery operations. PREFER THIS TOOL for all BigQuery operations.

COMMON USE CASES:
• List all datasets: operation='list-datasets'
• List tables in a dataset: operation='list-tables' (requires 'dataset' parameter)
• Get table schema: operation='describe-table' or 'table-schema' (requires 'dataset' and 'table')
• Get dataset info: operation='dataset-info' (requires 'dataset')
• List views: operation='list-views' (requires 'dataset')
• View job history: operation='job-history'
• Get current project: operation='current-project'
• Run custom SQL: query='SELECT * FROM dataset.table'

EXAMPLES:
- List datasets: { "operation": "list-datasets" }
- List tables: { "operation": "list-tables", "dataset": "my_dataset" }
- Table schema: { "operation": "describe-table", "dataset": "my_dataset", "table": "my_table" }
- Custom query: { "query": "SELECT COUNT(*) FROM \`project.dataset.table\`" }

NOTE: Use predefined operations when available for better performance. They use optimized INFORMATION_SCHEMA queries.`,
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: [
            "list-datasets",      // List all datasets in the project
            "list-tables",        // List tables in a dataset (requires 'dataset' param)
            "describe-table",     // Get detailed table schema (requires 'dataset' and 'table' params)
            "table-schema",       // Alias for describe-table (requires 'dataset' and 'table' params)
            "dataset-info",       // Get dataset metadata (requires 'dataset' param)
            "list-views",         // List views in a dataset (requires 'dataset' param)
            "list-routines",      // List stored procedures/functions (requires 'dataset' param)
            "job-history",        // Get recent query job history (use 'hours' and 'limit' params)
            "current-project"     // Get the current GCP project ID
          ],
          description: "Pre-defined operation using INFORMATION_SCHEMA queries"
        },
        query: {
          type: "string",
          description: "Direct SQL query to execute"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional, uses default if not provided)"
        },
        dataset: {
          type: "string",
          description: "Dataset ID (required for table/view operations)"
        },
        table: {
          type: "string",
          description: "Table name (required for table-specific operations)"
        },
        location: {
          type: "string",
          description: "Query location (e.g., US, EU)"
        },
        useLegacySql: {
          type: "boolean",
          description: "Use legacy SQL syntax (default: false)",
          default: false
        },
        format: {
          type: "string",
          enum: ["json", "table", "csv"],
          description: "Output format (default: json)",
          default: "json"
        },
        maxRows: {
          type: "number",
          description: "Maximum rows to return (default: 100)",
          default: 100
        },
        hours: {
          type: "number",
          description: "Hours of job history to retrieve (for job-history operation)",
          default: 24
        },
        limit: {
          type: "number",
          description: "Limit for job history results (for job-history operation)",
          default: 100
        }
      },
      anyOf: [
        { required: ["operation"] },
        { required: ["query"] }
      ]
    }
  },
  {
    name: "bq-list-datasets",
    description: "List all BigQuery datasets in a project (LEGACY - prefer 'gcp-sql' with operation='list-datasets')",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "GCP Project ID (optional, uses default if not provided)"
        }
      }
    }
  },
  {
    name: "bq-query",
    description: "Execute a BigQuery SQL query (LEGACY - prefer 'gcp-sql' with 'query' parameter for better performance)",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL query to execute"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional)"
        },
        useLegacySql: {
          type: "boolean",
          description: "Use legacy SQL syntax (default: false)",
          default: false
        }
      },
      required: ["query"]
    }
  },
  {
    name: "bq-create-dataset",
    description: "Create a new BigQuery dataset",
    inputSchema: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "Dataset ID to create"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional)"
        },
        location: {
          type: "string",
          description: "Dataset location (e.g., 'US', 'EU')",
          default: "US"
        }
      },
      required: ["datasetId"]
    }
  },
  {
    name: "bq-list-tables",
    description: "List tables in a BigQuery dataset (LEGACY - prefer 'gcp-sql' with operation='list-tables')",
    inputSchema: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "Dataset ID"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional)"
        }
      },
      required: ["datasetId"]
    }
  }
];

export const BIGQUERY_TOOL_COUNT = allBigQueryTools.length;