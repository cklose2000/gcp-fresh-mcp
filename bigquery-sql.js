import { BigQuery } from '@google-cloud/bigquery';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const bigquery = new BigQuery();

// Helper function to parse BigQuery timestamps
function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  
  // Handle BigQuery timestamp objects with value property
  if (timestamp && typeof timestamp === 'object' && 'value' in timestamp) {
    return new Date(timestamp.value);
  }
  
  // Handle string timestamps
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  // Handle numeric timestamps (milliseconds)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  return timestamp;
}

// Helper function to format timestamps for display
function formatTimestamp(timestamp) {
  const date = parseTimestamp(timestamp);
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return timestamp; // Return original if parsing fails
  }
  
  // Format as ISO string with timezone
  return date.toISOString();
}

// Helper function to process row data and format timestamps
function processRowData(row) {
  const processed = {};
  const timestampFields = ['creation_time', 'start_time', 'end_time', 'last_modified_time', 'creationTime', 'updateTime'];
  
  for (const [key, value] of Object.entries(row)) {
    // Check if this field is a timestamp field
    if (timestampFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      processed[key] = formatTimestamp(value);
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
}

// Debug logging
const DEBUG = process.env.DEBUG_GCP_MCP === 'true';
const log = (message, ...args) => {
  if (DEBUG) {
    console.log(`[BigQuery-SQL] ${message}`, ...args);
  }
};

// Error handling from enhanced module
class BigQueryAuthError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'BigQueryAuthError';
    this.originalError = originalError;
  }
}

class BigQueryPermissionError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'BigQueryPermissionError';
    this.originalError = originalError;
  }
}

class BigQueryAPIError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'BigQueryAPIError';
    this.originalError = originalError;
  }
}

// Get default project ID
const getProjectId = async (providedId) => {
  if (providedId) {
    log(`Using provided project ID: ${providedId}`);
    return providedId;
  }
  
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    log(`Using GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT}`);
    return process.env.GOOGLE_CLOUD_PROJECT;
  }
  
  if (process.env.GCP_PROJECT) {
    log(`Using GCP_PROJECT: ${process.env.GCP_PROJECT}`);
    return process.env.GCP_PROJECT;
  }
  
  try {
    const { stdout } = await execAsync('gcloud config get-value project');
    const projectId = stdout.trim();
    if (projectId) {
      log(`Using gcloud default project: ${projectId}`);
      return projectId;
    }
  } catch (error) {
    log('Failed to get project from gcloud:', error.message);
  }
  
  throw new Error('No project ID provided and unable to determine default project. Please set GOOGLE_CLOUD_PROJECT environment variable or run: gcloud config set project YOUR_PROJECT_ID');
};

// SQL Query Templates - leverage INFORMATION_SCHEMA for metadata
const QUERY_TEMPLATES = {
  'list-datasets': `
    SELECT 
      schema_name as dataset_id,
      location,
      creation_time,
      last_modified_time
    FROM \`region-us.INFORMATION_SCHEMA.SCHEMATA\`
    WHERE catalog_name = '{project}' AND schema_name != 'INFORMATION_SCHEMA'
    ORDER BY schema_name
  `,
  
  'list-tables': `
    SELECT 
      table_name,
      table_type,
      creation_time
    FROM \`{project}.{dataset}.INFORMATION_SCHEMA.TABLES\`
    ORDER BY table_name
  `,
  
  'describe-table': `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM \`{project}.{dataset}.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = '{table}'
    ORDER BY ordinal_position
  `,
  
  'table-schema': `
    SELECT 
      table_name,
      table_type,
      creation_time
    FROM \`{project}.{dataset}.INFORMATION_SCHEMA.TABLES\`
    WHERE table_name = '{table}'
  `,
  
  'dataset-info': `
    SELECT 
      schema_name as dataset_id,
      option_name,
      option_value
    FROM \`{project}.region-us.INFORMATION_SCHEMA.SCHEMATA_OPTIONS\`
    WHERE schema_name = '{dataset}'
  `,
  
  'list-views': `
    SELECT 
      table_name as view_name,
      view_definition
    FROM \`{project}.{dataset}.INFORMATION_SCHEMA.VIEWS\`
    ORDER BY table_name
  `,
  
  'list-routines': `
    SELECT 
      routine_name,
      routine_type,
      language,
      creation_time,
      routine_definition
    FROM \`{project}.{dataset}.INFORMATION_SCHEMA.ROUTINES\`
    ORDER BY routine_name
  `,
  
  'job-history': `
    SELECT 
      job_id,
      creation_time,
      start_time,
      end_time,
      state,
      job_type,
      statement_type,
      query,
      total_bytes_processed,
      total_slot_ms,
      ROUND(total_bytes_processed / 1024 / 1024 / 1024, 2) as gb_processed
    FROM \`{project}.region-us.INFORMATION_SCHEMA.JOBS_BY_PROJECT\`
    WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {hours} HOUR)
    ORDER BY creation_time DESC
    LIMIT {limit}
  `,
  
  'current-project': `
    SELECT @@PROJECT_ID as project_id, SESSION_USER() as current_user
  `
};

// Format query results consistently
function formatResults(rows, format = 'json', maxRows = 100) {
  if (!rows || rows.length === 0) {
    return {
      success: true,
      data: [],
      metadata: { 
        row_count: 0,
        message: "Query completed successfully but returned no results."
      }
    };
  }

  // Process rows to format timestamps
  const processedRows = rows.map(row => processRowData(row));
  const displayRows = processedRows.slice(0, maxRows);
  const truncated = rows.length > maxRows;

  switch (format.toLowerCase()) {
    case 'table':
      return {
        success: true,
        data: displayRows,
        metadata: {
          row_count: rows.length,
          truncated,
          format: 'table'
        },
        content: [{
          type: "text",
          text: formatAsTable(displayRows, truncated, rows.length)
        }]
      };
      
    case 'csv':
      return {
        success: true,
        data: displayRows,
        metadata: {
          row_count: rows.length,
          truncated,
          format: 'csv'
        },
        content: [{
          type: "text", 
          text: formatAsCSV(displayRows, truncated, rows.length)
        }]
      };
      
    default: // json
      return {
        success: true,
        data: displayRows,
        metadata: {
          row_count: rows.length,
          truncated,
          format: 'json'
        },
        content: [{
          type: "text",
          text: `Query returned ${rows.length} rows${truncated ? ` (showing first ${maxRows})` : ''}:\n\n\`\`\`json\n${JSON.stringify(displayRows, null, 2)}\n\`\`\``
        }]
      };
  }
}

// Format results as table
function formatAsTable(rows, truncated, totalRows) {
  if (rows.length === 0) return "No results found.";
  
  const headers = Object.keys(rows[0]);
  const maxWidths = headers.map(h => Math.max(h.length, 
    Math.max(...rows.map(r => String(r[h] || '').length))
  ));
  
  let table = '```\n';
  
  // Header row
  table += '| ' + headers.map((h, i) => h.padEnd(maxWidths[i])).join(' | ') + ' |\n';
  
  // Separator row
  table += '|-' + maxWidths.map(w => '-'.repeat(w)).join('|-') + '|\n';
  
  // Data rows
  rows.forEach(row => {
    table += '| ' + headers.map((h, i) => 
      String(row[h] || '').padEnd(maxWidths[i])
    ).join(' | ') + ' |\n';
  });
  
  table += '```';
  
  if (truncated) {
    table += `\n\n**Note**: Showing first ${rows.length} of ${totalRows} rows.`;
  }
  
  return table;
}

// Format results as CSV
function formatAsCSV(rows, truncated, totalRows) {
  if (rows.length === 0) return "No results found.";
  
  const headers = Object.keys(rows[0]);
  let csv = '```csv\n';
  
  // Header row
  csv += headers.join(',') + '\n';
  
  // Data rows
  rows.forEach(row => {
    csv += headers.map(h => {
      const value = row[h];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    }).join(',') + '\n';
  });
  
  csv += '```';
  
  if (truncated) {
    csv += `\n\n**Note**: Showing first ${rows.length} of ${totalRows} rows.`;
  }
  
  return csv;
}

// Handle errors consistently
function handleError(error, operation = 'unknown') {
  log(`Error in ${operation}:`, error);
  
  if (error.code === 401 || error.code === 403) {
    throw new BigQueryAuthError(
      'Authentication failed. Please check your Google Cloud credentials.',
      error
    );
  } else if (error.message?.includes('API has not been used')) {
    throw new BigQueryAPIError(
      'BigQuery API is not enabled for this project.',
      error
    );
  } else if (error.code === 404) {
    throw new Error(`Resource not found: ${error.message}`);
  }
  
  // Return formatted error response
  return {
    success: false,
    error: {
      type: error.name || 'BigQueryError',
      message: error.message,
      suggestions: getErrorSuggestions(error)
    },
    content: [{
      type: "text",
      text: formatErrorMessage(error)
    }]
  };
}

function getErrorSuggestions(error) {
  if (error instanceof BigQueryAuthError) {
    return [
      'Ensure you have valid Google Cloud credentials',
      'Run: gcloud auth application-default login',
      'Or set GOOGLE_APPLICATION_CREDENTIALS environment variable'
    ];
  } else if (error instanceof BigQueryPermissionError) {
    return [
      'Check that your service account has BigQuery permissions',
      'Required roles: BigQuery Data Viewer (for read), BigQuery Data Editor (for write)',
      'Visit: https://console.cloud.google.com/iam-admin/iam'
    ];
  } else if (error instanceof BigQueryAPIError) {
    return [
      'Check if BigQuery API is enabled for your project',
      'Visit: https://console.cloud.google.com/apis/library/bigquery.googleapis.com'
    ];
  }
  return [];
}

function formatErrorMessage(error) {
  const suggestions = getErrorSuggestions(error);
  return `BigQuery Error: ${error.message}\n\n${suggestions.length > 0 ? 
    `Suggestions:\n${suggestions.map(s => `- ${s}`).join('\n')}\n\n` : 
    ''}Original error: ${error.originalError?.message || error.message}`;
}

// Main SQL interface function
export async function gcpSQL(args) {
  try {
    const projectId = await getProjectId(args.projectId);
    log(`Executing SQL operation in project: ${projectId}`);
    
    let query;
    let queryParams = { project: projectId };
    
    // Handle operation templates
    if (args.operation) {
      const template = QUERY_TEMPLATES[args.operation];
      if (!template) {
        throw new Error(`Unknown operation: ${args.operation}. Available operations: ${Object.keys(QUERY_TEMPLATES).join(', ')}`);
      }
      
      // Add operation-specific parameters
      Object.assign(queryParams, args);
      
      // Special handling for some operations
      switch (args.operation) {
        case 'job-history':
          queryParams.hours = args.hours || 24;
          queryParams.limit = args.limit || 100;
          break;
        case 'list-tables':
        case 'describe-table':
        case 'table-schema':
        case 'dataset-info':
        case 'list-views':
        case 'list-routines':
          if (!args.dataset) {
            throw new Error(`Operation '${args.operation}' requires a 'dataset' parameter`);
          }
          break;
        case 'describe-table':
        case 'table-schema':
          if (!args.table) {
            throw new Error(`Operation '${args.operation}' requires a 'table' parameter`);
          }
          break;
      }
      
      // Replace template variables
      query = template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = queryParams[key];
        if (value === undefined) {
          throw new Error(`Missing required parameter for operation '${args.operation}': ${key}`);
        }
        return value;
      });
      
    } else if (args.query) {
      // Direct SQL query
      query = args.query;
    } else {
      throw new Error('Either "operation" or "query" parameter is required');
    }
    
    log(`Executing query: ${query.substring(0, 200)}...`);
    
    // Execute the query
    const options = {
      query: query.trim(),
      useLegacySql: args.useLegacySql || false,
      projectId: projectId,
      location: args.location
    };
    
    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    
    // Format and return results
    const format = args.format || 'json';
    const maxRows = args.maxRows || 100;
    
    return formatResults(rows, format, maxRows);
    
  } catch (error) {
    return handleError(error, args.operation || 'sql-query');
  }
}

// Convenience functions for common operations
export async function listDatasets(args = {}) {
  return gcpSQL({ ...args, operation: 'list-datasets' });
}

export async function listTables(args) {
  if (!args.dataset) {
    throw new Error('dataset parameter is required');
  }
  return gcpSQL({ ...args, operation: 'list-tables' });
}

export async function describeTable(args) {
  if (!args.dataset || !args.table) {
    throw new Error('dataset and table parameters are required');
  }
  return gcpSQL({ ...args, operation: 'describe-table' });
}

export async function getJobHistory(args = {}) {
  return gcpSQL({ 
    ...args, 
    operation: 'job-history',
    hours: args.hours || 24,
    limit: args.limit || 100 
  });
}

export async function getCurrentProject(args = {}) {
  return gcpSQL({ ...args, operation: 'current-project' });
}

// Initialize and validate on first use
let initialized = false;
export async function ensureInitialized() {
  if (!initialized) {
    try {
      // Test basic connectivity
      await getCurrentProject();
      initialized = true;
      log('BigQuery SQL interface initialized successfully');
    } catch (error) {
      console.error('BigQuery SQL interface initialization failed:', error);
      throw error;
    }
  }
}

// Export available operations for discovery
export const AVAILABLE_OPERATIONS = Object.keys(QUERY_TEMPLATES);

// Export the main interface
export default gcpSQL;