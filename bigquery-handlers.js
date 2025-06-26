// ==================================================
// BigQuery Enhanced Tools - MCP Handler Integration
// ==================================================
// This file provides unified handler functions that bridge MCP tool calls to
// bigquery-enhanced.js functions. Addresses issue #2 integration requirements.

import { z } from 'zod';
import { BigQuerySchemas, FunctionNameMap } from './bigquery-schemas.js';

// ==================================================
// Response Helper Functions
// ==================================================

export function createTextResponse(text) {
  return {
    content: [{ type: "text", text }]
  };
}

export function createJSONResponse(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

export function createErrorResponse(error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ 
      type: "text", 
      text: `Error: ${errorMessage}` 
    }]
  };
}

// ==================================================
// Retry Logic
// ==================================================

export async function retry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

// ==================================================
// Project Context Helper
// ==================================================

export function getSelectedProject(providedProjectId) {
  // Use provided project ID, or fall back to environment variable
  return providedProjectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
}

// ==================================================
// Parameter Processing
// ==================================================

export function processParameters(toolName, args) {
  // Get the appropriate Zod schema for this tool
  const schema = BigQuerySchemas[toolName];
  if (!schema) {
    throw new Error(`No schema found for tool: ${toolName}`);
  }
  
  try {
    // Validate and parse parameters using Zod
    const validatedParams = schema.parse(args);
    
    // Add project context if not provided
    if ('projectId' in validatedParams && !validatedParams.projectId) {
      validatedParams.projectId = getSelectedProject();
      if (!validatedParams.projectId) {
        throw new Error('No project selected. Please select a project first or provide projectId parameter.');
      }
    }
    
    return validatedParams;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Invalid parameters: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
}

// ==================================================
// Function Import Helper
// ==================================================

export async function getBigQueryFunction(toolName) {
  // Map kebab-case tool name to camelCase function name
  const functionName = FunctionNameMap[toolName];
  if (!functionName) {
    throw new Error(`No function mapping found for tool: ${toolName}`);
  }
  
  try {
    // Dynamic import from bigquery-enhanced.js
    const bigqueryModule = await import('./bigquery-enhanced.js');
    const func = bigqueryModule[functionName];
    
    if (!func) {
      throw new Error(`Function ${functionName} not found in bigquery-enhanced.js`);
    }
    
    return func;
  } catch (error) {
    throw new Error(`Failed to import BigQuery function ${functionName}: ${error.message}`);
  }
}

// ==================================================
// Main BigQuery Handler
// ==================================================

export async function handleBigQueryTool(toolName, args) {
  try {
    // Step 1: Validate parameters
    const validatedParams = processParameters(toolName, args);
    
    // Step 2: Get the appropriate function
    const bigqueryFunction = await getBigQueryFunction(toolName);
    
    // Step 3: Execute with retry logic
    const result = await retry(async () => {
      return await bigqueryFunction(validatedParams);
    });
    
    // Step 4: Format response
    if (result === null || result === undefined) {
      return createTextResponse('Operation completed successfully (no data returned)');
    }
    
    if (typeof result === 'string') {
      return createTextResponse(result);
    }
    
    if (typeof result === 'object') {
      return createJSONResponse(result);
    }
    
    return createTextResponse(String(result));
    
  } catch (error) {
    console.error(`BigQuery tool ${toolName} error:`, error);
    return createErrorResponse(error);
  }
}

// ==================================================
// Individual Tool Handlers (for direct calling if needed)
// ==================================================

// Jobs API & Async Operations
export async function handleBqCreateQueryJob(args) {
  return handleBigQueryTool('bq-create-query-job', args);
}

export async function handleBqGetJob(args) {
  return handleBigQueryTool('bq-get-job', args);
}

export async function handleBqCancelJob(args) {
  return handleBigQueryTool('bq-cancel-job', args);
}

export async function handleBqListJobs(args) {
  return handleBigQueryTool('bq-list-jobs', args);
}

// Session Management
export async function handleBqCreateSession(args) {
  return handleBigQueryTool('bq-create-session', args);
}

export async function handleBqQueryWithSession(args) {
  return handleBigQueryTool('bq-query-with-session', args);
}

// Stored Procedures & Scripts
export async function handleBqExecuteProcedure(args) {
  return handleBigQueryTool('bq-execute-procedure', args);
}

export async function handleBqExecuteScript(args) {
  return handleBigQueryTool('bq-execute-script', args);
}

// Data Operations
export async function handleBqLoadData(args) {
  return handleBigQueryTool('bq-load-data', args);
}

export async function handleBqExportData(args) {
  return handleBigQueryTool('bq-export-data', args);
}

export async function handleBqStreamInsert(args) {
  return handleBigQueryTool('bq-stream-insert', args);
}

export async function handleBqCopyTable(args) {
  return handleBigQueryTool('bq-copy-table', args);
}

// Schema & Metadata
export async function handleBqGetTableSchema(args) {
  return handleBigQueryTool('bq-get-table-schema', args);
}

export async function handleBqGetRoutineDefinition(args) {
  return handleBigQueryTool('bq-get-routine-definition', args);
}

// Legacy Tools
export async function handleBqListDatasets(args) {
  return handleBigQueryTool('bq-list-datasets', args);
}

export async function handleBqQuery(args) {
  return handleBigQueryTool('bq-query', args);
}

export async function handleBqCreateDataset(args) {
  return handleBigQueryTool('bq-create-dataset', args);
}

export async function handleBqListTables(args) {
  return handleBigQueryTool('bq-list-tables', args);
}

// ==================================================
// Handler Map for Easy Routing
// ==================================================

export const BigQueryHandlers = {
  // Jobs API & Async Operations
  'bq-create-query-job': handleBqCreateQueryJob,
  'bq-get-job': handleBqGetJob,
  'bq-cancel-job': handleBqCancelJob,
  'bq-list-jobs': handleBqListJobs,
  
  // Session Management
  'bq-create-session': handleBqCreateSession,
  'bq-query-with-session': handleBqQueryWithSession,
  
  // Stored Procedures & Scripts
  'bq-execute-procedure': handleBqExecuteProcedure,
  'bq-execute-script': handleBqExecuteScript,
  
  // Data Operations
  'bq-load-data': handleBqLoadData,
  'bq-export-data': handleBqExportData,
  'bq-stream-insert': handleBqStreamInsert,
  'bq-copy-table': handleBqCopyTable,
  
  // Schema & Metadata
  'bq-get-table-schema': handleBqGetTableSchema,
  'bq-get-routine-definition': handleBqGetRoutineDefinition,
  
  // Legacy Tools
  'bq-list-datasets': handleBqListDatasets,
  'bq-query': handleBqQuery,
  'bq-create-dataset': handleBqCreateDataset,
  'bq-list-tables': handleBqListTables
};

// ==================================================
// Route Handler Function
// ==================================================

export async function routeBigQueryTool(toolName, args) {
  const handler = BigQueryHandlers[toolName];
  if (!handler) {
    throw new Error(`No handler found for BigQuery tool: ${toolName}`);
  }
  
  return await handler(args);
}

// ==================================================
// Validation Functions
// ==================================================

export function isBigQueryTool(toolName) {
  return toolName.startsWith('bq-') && toolName in BigQueryHandlers;
}

export function getBigQueryToolNames() {
  return Object.keys(BigQueryHandlers);
}

export function getBigQueryToolCount() {
  return Object.keys(BigQueryHandlers).length;
}

// ==================================================
// Logging & Debug
// ==================================================

console.log(`BigQuery Handlers Loaded: ${getBigQueryToolCount()} handlers available`);
console.log('Handler Names:', getBigQueryToolNames());