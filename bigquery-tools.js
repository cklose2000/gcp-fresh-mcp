// ==================================================
// BigQuery Enhanced Tools - Tool Definitions for MCP Integration
// ==================================================
// This file contains all BigQuery tool definitions with proper kebab-case naming
// and comprehensive inputSchemas for MCP protocol integration.
// Addresses integration requirements from issue #2.

// ==================================================
// Jobs API & Async Operations Tools
// ==================================================

export const jobsApiTools = [
  {
    name: "bq-create-query-job",
    description: "Create an async BigQuery query job with advanced options",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL query to execute"
        },
        destinationDataset: {
          type: "string",
          description: "Dataset for destination table"
        },
        destinationTable: {
          type: "string", 
          description: "Table name to write results to"
        },
        dryRun: {
          type: "boolean",
          description: "Validate query without executing",
          default: false
        },
        location: {
          type: "string",
          description: "Query location (default: US)",
          default: "US"
        },
        priority: {
          type: "string",
          enum: ["INTERACTIVE", "BATCH"],
          description: "Query priority"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional)"
        },
        timeoutMs: {
          type: "string",
          description: "Job timeout in milliseconds"
        },
        useLegacySql: {
          type: "boolean",
          description: "Use legacy SQL syntax",
          default: false
        },
        writeDisposition: {
          type: "string",
          enum: ["WRITE_TRUNCATE", "WRITE_APPEND", "WRITE_EMPTY"],
          description: "How to write results"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "bq-get-job",
    description: "Get status and results of a BigQuery job",
    inputSchema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "Job ID to check"
        },
        getResults: {
          type: "boolean",
          description: "Retrieve query results if available",
          default: true
        },
        maxResults: {
          type: "number",
          description: "Max results to return"
        }
      },
      required: ["jobId"]
    }
  },
  {
    name: "bq-cancel-job",
    description: "Cancel a running BigQuery job",
    inputSchema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "Job ID to cancel"
        }
      },
      required: ["jobId"]
    }
  },
  {
    name: "bq-list-jobs",
    description: "List BigQuery jobs",
    inputSchema: {
      type: "object",
      properties: {
        allUsers: {
          type: "boolean",
          description: "List jobs from all users"
        },
        maxResults: {
          type: "number",
          description: "Maximum results to return"
        },
        minCreationTime: {
          type: "string",
          description: "Min creation time (ISO format)"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional)"
        },
        projection: {
          type: "string",
          enum: ["full", "minimal"],
          description: "Response detail level"
        },
        stateFilter: {
          type: "string",
          enum: ["pending", "running", "done"],
          description: "Filter by job state"
        }
      },
      required: []
    }
  }
];

// ==================================================
// Session Management Tools
// ==================================================

export const sessionTools = [
  {
    name: "bq-create-session",
    description: "Create a BigQuery session for stateful operations",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Session location (default: US)",
          default: "US"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional)"
        }
      },
      required: []
    }
  },
  {
    name: "bq-query-with-session",
    description: "Execute query within a BigQuery session",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL query to execute"
        },
        sessionId: {
          type: "string",
          description: "Session ID to use"
        },
        location: {
          type: "string",
          description: "Query location"
        }
      },
      required: ["query", "sessionId"]
    }
  }
];

// ==================================================
// Stored Procedures & Scripts Tools
// ==================================================

export const proceduresTools = [
  {
    name: "bq-execute-procedure",
    description: "Execute a stored procedure with proper parameter handling",
    inputSchema: {
      type: "object",
      properties: {
        procedureName: {
          type: "string",
          description: "Procedure name"
        },
        datasetId: {
          type: "string",
          description: "Dataset containing the procedure"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID"
        },
        parameters: {
          type: "array",
          description: "Array of parameters with {value, type, name}",
          items: {
            type: "object",
            properties: {
              value: {
                description: "Parameter value"
              },
              type: {
                type: "string",
                description: "Parameter type"
              },
              name: {
                type: "string",
                description: "Parameter name"
              }
            },
            required: ["value", "type"]
          }
        },
        location: {
          type: "string",
          description: "Procedure location"
        },
        timeoutMs: {
          type: "string",
          description: "Execution timeout"
        },
        waitForCompletion: {
          type: "boolean",
          description: "Wait for procedure to complete",
          default: true
        }
      },
      required: ["procedureName", "datasetId", "projectId"]
    }
  },
  {
    name: "bq-execute-script",
    description: "Execute multiple SQL statements as a script",
    inputSchema: {
      type: "object",
      properties: {
        statements: {
          type: "array",
          description: "Array of SQL statements",
          items: {
            type: "string"
          },
          minItems: 1
        },
        projectId: {
          type: "string",
          description: "GCP Project ID"
        },
        sessionId: {
          type: "string",
          description: "Optional session ID"
        },
        location: {
          type: "string",
          description: "Script location"
        },
        timeoutMs: {
          type: "string",
          description: "Script timeout"
        },
        waitForCompletion: {
          type: "boolean",
          description: "Wait for script completion",
          default: true
        }
      },
      required: ["statements", "projectId"]
    }
  }
];

// ==================================================
// Data Operations Tools
// ==================================================

export const dataOperationsTools = [
  {
    name: "bq-load-data",
    description: "Load data from Cloud Storage into BigQuery",
    inputSchema: {
      type: "object",
      properties: {
        sourceUri: {
          type: "string",
          description: "Source file URI (gs://...)"
        },
        datasetId: {
          type: "string",
          description: "Target dataset ID"
        },
        tableId: {
          type: "string",
          description: "Target table ID"
        },
        format: {
          type: "string",
          enum: ["CSV", "JSON", "AVRO", "PARQUET", "ORC"],
          description: "Source file format"
        },
        autodetect: {
          type: "boolean",
          description: "Auto-detect schema"
        },
        schema: {
          type: "object",
          description: "Table schema if not auto-detecting"
        },
        skipLeadingRows: {
          type: "number",
          description: "Rows to skip (CSV)"
        },
        fieldDelimiter: {
          type: "string",
          description: "Field delimiter (CSV)"
        },
        allowJaggedRows: {
          type: "boolean",
          description: "Allow jagged rows (CSV)"
        },
        allowQuotedNewlines: {
          type: "boolean",
          description: "Allow quoted newlines (CSV)"
        },
        createDisposition: {
          type: "string",
          enum: ["CREATE_IF_NEEDED", "CREATE_NEVER"],
          description: "Table creation behavior"
        },
        writeDisposition: {
          type: "string",
          enum: ["WRITE_TRUNCATE", "WRITE_APPEND", "WRITE_EMPTY"],
          description: "How to write data"
        },
        location: {
          type: "string",
          description: "Job location"
        },
        waitForCompletion: {
          type: "boolean",
          description: "Wait for load to complete",
          default: true
        }
      },
      required: ["sourceUri", "datasetId", "tableId"]
    }
  },
  {
    name: "bq-export-data",
    description: "Export BigQuery data to Cloud Storage",
    inputSchema: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "Source dataset ID"
        },
        tableId: {
          type: "string",
          description: "Source table ID"
        },
        destinationUri: {
          type: "string",
          description: "Destination URI (gs://...)"
        },
        format: {
          type: "string",
          enum: ["CSV", "JSON", "AVRO", "PARQUET"],
          description: "Export format"
        },
        fieldDelimiter: {
          type: "string",
          description: "Field delimiter (CSV)"
        },
        printHeader: {
          type: "boolean",
          description: "Include header row (CSV)"
        },
        compress: {
          type: "boolean",
          description: "Compress output with gzip"
        },
        location: {
          type: "string",
          description: "Job location"
        },
        waitForCompletion: {
          type: "boolean",
          description: "Wait for export to complete",
          default: true
        }
      },
      required: ["datasetId", "tableId", "destinationUri"]
    }
  },
  {
    name: "bq-stream-insert",
    description: "Stream insert rows into a BigQuery table",
    inputSchema: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "Dataset ID"
        },
        tableId: {
          type: "string",
          description: "Table ID"
        },
        rows: {
          type: "array",
          description: "Array of row objects to insert",
          items: {
            type: "object"
          },
          minItems: 1
        },
        insertIds: {
          type: "array",
          description: "Optional insert IDs for deduplication",
          items: {
            type: "string"
          }
        },
        ignoreUnknownValues: {
          type: "boolean",
          description: "Ignore unknown field values"
        },
        skipInvalidRows: {
          type: "boolean",
          description: "Skip invalid rows"
        }
      },
      required: ["datasetId", "tableId", "rows"]
    }
  },
  {
    name: "bq-copy-table",
    description: "Copy a BigQuery table",
    inputSchema: {
      type: "object",
      properties: {
        sourceDatasetId: {
          type: "string",
          description: "Source dataset ID"
        },
        sourceTableId: {
          type: "string",
          description: "Source table ID"
        },
        destinationDatasetId: {
          type: "string",
          description: "Destination dataset ID"
        },
        destinationTableId: {
          type: "string",
          description: "Destination table ID"
        },
        createDisposition: {
          type: "string",
          enum: ["CREATE_IF_NEEDED", "CREATE_NEVER"],
          description: "Table creation behavior"
        },
        writeDisposition: {
          type: "string",
          enum: ["WRITE_TRUNCATE", "WRITE_APPEND", "WRITE_EMPTY"],
          description: "How to write data"
        },
        waitForCompletion: {
          type: "boolean",
          description: "Wait for copy to complete",
          default: true
        }
      },
      required: ["sourceDatasetId", "sourceTableId", "destinationDatasetId", "destinationTableId"]
    }
  }
];

// ==================================================
// Schema & Metadata Tools
// ==================================================

export const metadataTools = [
  {
    name: "bq-get-table-schema",
    description: "Get detailed schema and metadata for a table",
    inputSchema: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "Dataset ID"
        },
        tableId: {
          type: "string",
          description: "Table ID"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional)"
        }
      },
      required: ["datasetId", "tableId"]
    }
  },
  {
    name: "bq-get-routine-definition",
    description: "Get stored procedure or function definition",
    inputSchema: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "Dataset ID"
        },
        routineId: {
          type: "string",
          description: "Routine (procedure/function) ID"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional)"
        }
      },
      required: ["datasetId", "routineId"]
    }
  }
];

// ==================================================
// Legacy BigQuery Tools
// ==================================================

export const legacyTools = [
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
      },
      required: []
    }
  },
  {
    name: "bq-query",
    description: "Execute a BigQuery SQL query (legacy - use bq-create-query-job for advanced features)",
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
        location: {
          type: "string",
          description: "Dataset location (e.g., 'US', 'EU')",
          default: "US"
        },
        projectId: {
          type: "string",
          description: "GCP Project ID (optional)"
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

// ==================================================
// Combined BigQuery Tools Export
// ==================================================

export const allBigQueryTools = [
  ...jobsApiTools,
  ...sessionTools,
  ...proceduresTools,
  ...dataOperationsTools,
  ...metadataTools,
  ...legacyTools
];

// Tool count for validation
export const BIGQUERY_TOOL_COUNT = allBigQueryTools.length;

// Tool names for easy reference
export const BigQueryToolNames = allBigQueryTools.map(tool => tool.name);

console.log(`BigQuery Tools Loaded: ${BIGQUERY_TOOL_COUNT} tools available`);
console.log('Tool Names:', BigQueryToolNames);