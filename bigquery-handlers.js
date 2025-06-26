// Import enhanced BigQuery functions
import * as bqEnhanced from './bigquery-enhanced.js';

// List of BigQuery tool names
const bigQueryToolNames = [
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
      case 'bq-list-datasets':
        return await bqEnhanced.bqListDatasets(args);
      
      case 'bq-query':
        return await bqEnhanced.bqQuery(args);
      
      case 'bq-create-dataset':
        return await bqEnhanced.bqCreateDataset(args);
      
      case 'bq-list-tables':
        return await bqEnhanced.bqListTables(args);
      
      default:
        throw new Error(`Unknown BigQuery tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error in BigQuery tool ${toolName}:`, error);
    throw error;
  }
}