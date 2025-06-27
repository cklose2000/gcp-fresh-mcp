// Import enhanced BigQuery functions
import * as bqEnhanced from './bigquery-enhanced.js';
// Import the new SQL-first interface
import { gcpSQL } from './bigquery-sql.js';

// List of BigQuery tool names
const bigQueryToolNames = [
  'gcp-sql',  // NEW: Universal SQL interface
  'bq-list-datasets',
  'bq-query', 
  'bq-create-dataset',
  'bq-list-tables'
];

// Check if a tool name is a BigQuery tool
export function isBigQueryTool(toolName) {
  return bigQueryToolNames.includes(toolName);
}

// Get all BigQuery tool names
export function getBigQueryToolNames() {
  return [...bigQueryToolNames];
}

// Route BigQuery tool calls to appropriate handlers
export async function routeBigQueryTool(toolName, args) {
  try {
    switch (toolName) {
      case 'gcp-sql':
        // NEW: Route to universal SQL interface
        return await gcpSQL(args);
      
      case 'bq-list-datasets':
        // Ensure BigQuery is initialized before any operation
        await bqEnhanced.ensureInitialized();
        return await bqEnhanced.bqListDatasets(args);
      
      case 'bq-query':
        await bqEnhanced.ensureInitialized();
        return await bqEnhanced.bqQuery(args);
      
      case 'bq-create-dataset':
        await bqEnhanced.ensureInitialized();
        return await bqEnhanced.bqCreateDataset(args);
      
      case 'bq-list-tables':
        await bqEnhanced.ensureInitialized();
        return await bqEnhanced.bqListTables(args);
      
      default:
        throw new Error(`Unknown BigQuery tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error in BigQuery tool ${toolName}:`, error);
    
    // If the error has already been formatted by our enhanced error handling,
    // return it as is. Otherwise, create a proper error response.
    if (error.content) {
      return error;
    }
    
    // Return error in MCP format
    return {
      content: [{
        type: "text",
        text: `Error executing ${toolName}: ${error.message}`
      }]
    };
  }
}