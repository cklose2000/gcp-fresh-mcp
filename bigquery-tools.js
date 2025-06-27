// BigQuery MCP tool definitions
export const allBigQueryTools = [
  {
    name: "gcp-sql",
    description: "Universal SQL interface for BigQuery operations using INFORMATION_SCHEMA - replaces multiple tools with a single efficient interface",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: [
            "list-datasets",
            "list-tables", 
            "describe-table",
            "table-schema",
            "dataset-info",
            "list-views",
            "list-routines",
            "job-history",
            "current-project"
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
      }
      // anyOf removed - validation will be handled in the implementation
    }
  },
  {
    name: "bq-list-datasets",
    description: "List all BigQuery datasets in a project",
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
    description: "Execute a BigQuery SQL query (legacy - use bq_create_query_job for advanced features)",
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
    description: "List tables in a BigQuery dataset",
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