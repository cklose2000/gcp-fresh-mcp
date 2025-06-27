import { z } from 'zod';

// ===================================================================
// BigQuery Enhanced Tools - Zod Schemas for MCP Integration
// ===================================================================
// This file contains all Zod schemas for BigQuery tools to enable
// proper parameter validation in the MCP protocol integration.
// Addresses integration requirements from issue #2.

// ===================================================================
// SQL-First Universal Interface (NEW - Issue #9 Optimization)
// ===================================================================

export const GcpSQLSchema = z.object({
  // Core parameters
  operation: z.enum([
    'list-datasets',
    'list-tables', 
    'describe-table',
    'table-schema',
    'dataset-info',
    'list-views',
    'list-routines',
    'job-history',
    'current-project'
  ]).optional().describe('Pre-defined operation using INFORMATION_SCHEMA queries'),
  
  query: z.string().optional().describe('Direct SQL query to execute'),
  
  // Common parameters
  projectId: z.string().optional().describe('GCP Project ID (optional, uses default if not provided)'),
  dataset: z.string().optional().describe('Dataset ID (required for table/view operations)'),
  table: z.string().optional().describe('Table name (required for table-specific operations)'),
  
  // Query execution options
  location: z.string().optional().describe('Query location (e.g., US, EU)'),
  useLegacySql: z.boolean().optional().default(false).describe('Use legacy SQL syntax (default: false)'),
  
  // Output formatting
  format: z.enum(['json', 'table', 'csv']).optional().default('json').describe('Output format (default: json)'),
  maxRows: z.number().optional().default(100).describe('Maximum rows to return (default: 100)'),
  
  // Operation-specific parameters
  hours: z.number().optional().default(24).describe('Hours of job history to retrieve (for job-history operation)'),
  limit: z.number().optional().default(100).describe('Limit for job history results (for job-history operation)')
}).refine(
  (data) => data.operation || data.query,
  {
    message: "Either 'operation' or 'query' parameter is required",
    path: ['operation', 'query']
  }
);

// ===================================================================
// Jobs API & Async Operations Schemas
// ===================================================================

export const BqCreateQueryJobSchema = z.object({
  query: z.string().describe('SQL query to execute'),
  destinationDataset: z.string().optional().describe('Dataset for destination table'),
  destinationTable: z.string().optional().describe('Table name to write results to'),
  dryRun: z.boolean().optional().default(false).describe('Validate query without executing'),
  location: z.string().optional().default('US').describe('Query location (default: US)'),
  priority: z.enum(['INTERACTIVE', 'BATCH']).optional().describe('Query priority'),
  projectId: z.string().optional().describe('GCP Project ID (optional)'),
  timeoutMs: z.string().optional().describe('Job timeout in milliseconds'),
  useLegacySql: z.boolean().optional().default(false).describe('Use legacy SQL syntax'),
  writeDisposition: z.enum(['WRITE_TRUNCATE', 'WRITE_APPEND', 'WRITE_EMPTY']).optional().describe('How to write results')
});

export const BqGetJobSchema = z.object({
  jobId: z.string().describe('Job ID to check'),
  getResults: z.boolean().optional().default(true).describe('Retrieve query results if available'),
  maxResults: z.number().optional().describe('Max results to return')
});

export const BqCancelJobSchema = z.object({
  jobId: z.string().describe('Job ID to cancel')
});

export const BqListJobsSchema = z.object({
  allUsers: z.boolean().optional().describe('List jobs from all users'),
  maxResults: z.number().optional().describe('Maximum results to return'),
  minCreationTime: z.string().optional().describe('Min creation time (ISO format)'),
  projectId: z.string().optional().describe('GCP Project ID (optional)'),
  projection: z.enum(['full', 'minimal']).optional().describe('Response detail level'),
  stateFilter: z.enum(['pending', 'running', 'done']).optional().describe('Filter by job state')
});

// ===================================================================
// Session Management Schemas
// ===================================================================

export const BqCreateSessionSchema = z.object({
  location: z.string().optional().default('US').describe('Session location (default: US)'),
  projectId: z.string().optional().describe('GCP Project ID (optional)')
});

export const BqQueryWithSessionSchema = z.object({
  query: z.string().describe('SQL query to execute'),
  sessionId: z.string().describe('Session ID to use'),
  location: z.string().optional().describe('Query location')
});

// ===================================================================
// Stored Procedures & Scripts Schemas
// ===================================================================

export const BqExecuteProcedureSchema = z.object({
  procedureName: z.string().describe('Procedure name'),
  datasetId: z.string().describe('Dataset containing the procedure'),
  projectId: z.string().describe('GCP Project ID'),
  parameters: z.array(z.object({
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.any()), z.object({})]).describe('Parameter value'),
    type: z.string().describe('Parameter type'),
    name: z.string().optional().describe('Parameter name')
  })).optional().describe('Array of parameters with {value, type, name}'),
  location: z.string().optional().describe('Procedure location'),
  timeoutMs: z.string().optional().describe('Execution timeout'),
  waitForCompletion: z.boolean().optional().default(true).describe('Wait for procedure to complete')
});

export const BqExecuteScriptSchema = z.object({
  statements: z.array(z.string()).min(1).describe('Array of SQL statements'),
  projectId: z.string().describe('GCP Project ID'),
  sessionId: z.string().optional().describe('Optional session ID'),
  location: z.string().optional().describe('Script location'),
  timeoutMs: z.string().optional().describe('Script timeout'),
  waitForCompletion: z.boolean().optional().default(true).describe('Wait for script completion')
});

// ===================================================================
// Data Operations Schemas
// ===================================================================

export const BqLoadDataSchema = z.object({
  sourceUri: z.string().describe('Source file URI (gs://...)'),
  datasetId: z.string().describe('Target dataset ID'),
  tableId: z.string().describe('Target table ID'),
  format: z.enum(['CSV', 'JSON', 'AVRO', 'PARQUET', 'ORC']).optional().describe('Source file format'),
  autodetect: z.boolean().optional().describe('Auto-detect schema'),
  schema: z.object({}).optional().describe('Table schema if not auto-detecting'),
  skipLeadingRows: z.number().optional().describe('Rows to skip (CSV)'),
  fieldDelimiter: z.string().optional().describe('Field delimiter (CSV)'),
  allowJaggedRows: z.boolean().optional().describe('Allow jagged rows (CSV)'),
  allowQuotedNewlines: z.boolean().optional().describe('Allow quoted newlines (CSV)'),
  createDisposition: z.enum(['CREATE_IF_NEEDED', 'CREATE_NEVER']).optional().describe('Table creation behavior'),
  writeDisposition: z.enum(['WRITE_TRUNCATE', 'WRITE_APPEND', 'WRITE_EMPTY']).optional().describe('How to write data'),
  location: z.string().optional().describe('Job location'),
  waitForCompletion: z.boolean().optional().default(true).describe('Wait for load to complete')
});

export const BqExportDataSchema = z.object({
  datasetId: z.string().describe('Source dataset ID'),
  tableId: z.string().describe('Source table ID'),
  destinationUri: z.string().describe('Destination URI (gs://...)'),
  format: z.enum(['CSV', 'JSON', 'AVRO', 'PARQUET']).optional().describe('Export format'),
  fieldDelimiter: z.string().optional().describe('Field delimiter (CSV)'),
  printHeader: z.boolean().optional().describe('Include header row (CSV)'),
  compress: z.boolean().optional().describe('Compress output with gzip'),
  location: z.string().optional().describe('Job location'),
  waitForCompletion: z.boolean().optional().default(true).describe('Wait for export to complete')
});

export const BqStreamInsertSchema = z.object({
  datasetId: z.string().describe('Dataset ID'),
  tableId: z.string().describe('Table ID'),
  rows: z.array(z.object({})).min(1).describe('Array of row objects to insert'),
  insertIds: z.array(z.string()).optional().describe('Optional insert IDs for deduplication'),
  ignoreUnknownValues: z.boolean().optional().describe('Ignore unknown field values'),
  skipInvalidRows: z.boolean().optional().describe('Skip invalid rows')
});

export const BqCopyTableSchema = z.object({
  sourceDatasetId: z.string().describe('Source dataset ID'),
  sourceTableId: z.string().describe('Source table ID'),
  destinationDatasetId: z.string().describe('Destination dataset ID'),
  destinationTableId: z.string().describe('Destination table ID'),
  createDisposition: z.enum(['CREATE_IF_NEEDED', 'CREATE_NEVER']).optional().describe('Table creation behavior'),
  writeDisposition: z.enum(['WRITE_TRUNCATE', 'WRITE_APPEND', 'WRITE_EMPTY']).optional().describe('How to write data'),
  waitForCompletion: z.boolean().optional().default(true).describe('Wait for copy to complete')
});

// ===================================================================
// Schema & Metadata Schemas
// ===================================================================

export const BqGetTableSchemaSchema = z.object({
  datasetId: z.string().describe('Dataset ID'),
  tableId: z.string().describe('Table ID'),
  projectId: z.string().optional().describe('GCP Project ID (optional)')
});

export const BqGetRoutineDefinitionSchema = z.object({
  datasetId: z.string().describe('Dataset ID'),
  routineId: z.string().describe('Routine (procedure/function) ID'),
  projectId: z.string().optional().describe('GCP Project ID (optional)')
});

// ===================================================================
// Legacy BigQuery Tools Schemas
// ===================================================================

export const BqListDatasetsSchema = z.object({
  projectId: z.string().optional().describe('GCP Project ID (optional, uses default if not provided)')
});

export const BqQuerySchema = z.object({
  query: z.string().describe('SQL query to execute'),
  projectId: z.string().optional().describe('GCP Project ID (optional)'),
  useLegacySql: z.boolean().optional().default(false).describe('Use legacy SQL syntax (default: false)')
});

export const BqCreateDatasetSchema = z.object({
  datasetId: z.string().describe('Dataset ID to create'),
  location: z.string().optional().default('US').describe('Dataset location (e.g., \'US\', \'EU\')'),
  projectId: z.string().optional().describe('GCP Project ID (optional)')
});

export const BqListTablesSchema = z.object({
  datasetId: z.string().describe('Dataset ID'),
  projectId: z.string().optional().describe('GCP Project ID (optional)')
});

// ===================================================================
// Schema Export Map for Easy Access
// ===================================================================

export const BigQuerySchemas = {
  // NEW: SQL-First Universal Interface
  'gcp-sql': GcpSQLSchema,
  
  // Jobs API & Async Operations
  'bq-create-query-job': BqCreateQueryJobSchema,
  'bq-get-job': BqGetJobSchema,
  'bq-cancel-job': BqCancelJobSchema,
  'bq-list-jobs': BqListJobsSchema,
  
  // Session Management
  'bq-create-session': BqCreateSessionSchema,
  'bq-query-with-session': BqQueryWithSessionSchema,
  
  // Stored Procedures & Scripts
  'bq-execute-procedure': BqExecuteProcedureSchema,
  'bq-execute-script': BqExecuteScriptSchema,
  
  // Data Operations
  'bq-load-data': BqLoadDataSchema,
  'bq-export-data': BqExportDataSchema,
  'bq-stream-insert': BqStreamInsertSchema,
  'bq-copy-table': BqCopyTableSchema,
  
  // Schema & Metadata
  'bq-get-table-schema': BqGetTableSchemaSchema,
  'bq-get-routine-definition': BqGetRoutineDefinitionSchema,
  
  // Legacy Tools
  'bq-list-datasets': BqListDatasetsSchema,
  'bq-query': BqQuerySchema,
  'bq-create-dataset': BqCreateDatasetSchema,
  'bq-list-tables': BqListTablesSchema
};

// ===================================================================
// Function Name Mapping (camelCase for imports)
// ===================================================================

export const FunctionNameMap = {
  'gcp-sql': 'gcpSQL',
  'bq-create-query-job': 'bqCreateQueryJob',
  'bq-get-job': 'bqGetJob',
  'bq-cancel-job': 'bqCancelJob',
  'bq-list-jobs': 'bqListJobs',
  'bq-create-session': 'bqCreateSession',
  'bq-query-with-session': 'bqQueryWithSession',
  'bq-execute-procedure': 'bqExecuteProcedure',
  'bq-execute-script': 'bqExecuteScript',
  'bq-load-data': 'bqLoadData',
  'bq-export-data': 'bqExportData',
  'bq-stream-insert': 'bqStreamInsert',
  'bq-copy-table': 'bqCopyTable',
  'bq-get-table-schema': 'bqGetTableSchema',
  'bq-get-routine-definition': 'bqGetRoutineDefinition',
  'bq-list-datasets': 'bqListDatasets',
  'bq-query': 'bqQuery',
  'bq-create-dataset': 'bqCreateDataset',
  'bq-list-tables': 'bqListTables'
};