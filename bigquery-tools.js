// BigQuery MCP tool definitions
export const allBigQueryTools = [
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