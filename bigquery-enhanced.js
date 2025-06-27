import { BigQuery } from '@google-cloud/bigquery';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const bigquery = new BigQuery();

// Debug logging
const DEBUG = process.env.DEBUG_GCP_MCP === 'true';
const log = (message, ...args) => {
  if (DEBUG) {
    console.log(`[BigQuery] ${message}`, ...args);
  }
};

// Error types for better error handling
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

// Helper to format error responses consistently
function formatErrorResponse(error) {
  let errorMessage = error.message;
  let errorType = 'unknown';
  let suggestions = [];

  if (error instanceof BigQueryAuthError) {
    errorType = 'authentication';
    suggestions = [
      'Ensure you have valid Google Cloud credentials',
      'Run: gcloud auth application-default login',
      'Or set GOOGLE_APPLICATION_CREDENTIALS environment variable'
    ];
  } else if (error instanceof BigQueryPermissionError) {
    errorType = 'permission';
    suggestions = [
      'Check that your service account has BigQuery permissions',
      'Required roles: BigQuery Data Viewer (for list/read), BigQuery Data Editor (for create)',
      'Visit: https://console.cloud.google.com/iam-admin/iam'
    ];
  } else if (error instanceof BigQueryAPIError) {
    errorType = 'api';
    suggestions = [
      'Check if BigQuery API is enabled for your project',
      'Visit: https://console.cloud.google.com/apis/library/bigquery.googleapis.com'
    ];
  } else if (error.code === 404) {
    errorType = 'not_found';
    suggestions = ['Verify the project ID is correct', 'Check if the resource exists'];
  }

  return {
    content: [{
      type: "text",
      text: `BigQuery Error (${errorType}): ${errorMessage}\n\nSuggestions:\n${suggestions.map(s => `- ${s}`).join('\n')}\n\nOriginal error: ${error.originalError?.message || error.message}`
    }]
  };
}

// Validate authentication and permissions
export async function validateAuthentication() {
  log('Validating BigQuery authentication...');
  
  try {
    // Try to get the current project to validate auth
    const projectId = await getProjectId();
    log(`Using project ID: ${projectId}`);
    
    // Check which auth method is being used
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      log(`Using service account from: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    } else {
      log('Using Application Default Credentials (ADC)');
    }
    
    // Try to list datasets as a basic permission check
    const [datasets] = await bigquery.getDatasets({ 
      projectId, 
      maxResults: 1 
    });
    
    log('Authentication validated successfully');
    return { success: true, projectId };
  } catch (error) {
    log('Authentication validation failed:', error);
    
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
    } else {
      throw error;
    }
  }
}

// Get default project ID from environment or metadata
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

// List datasets in a BigQuery project
export async function bqListDatasets(args) {
  try {
    const projectId = await getProjectId(args.projectId);
    log(`Listing datasets for project: ${projectId}`);
    
    const [datasets] = await bigquery.getDatasets({ projectId });
    
    if (datasets.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No datasets found in project ${projectId}`
        }]
      };
    }
    
    const datasetList = datasets.map(dataset => ({
      id: dataset.id,
      location: dataset.metadata.location,
      created: new Date(parseInt(dataset.metadata.creationTime)).toISOString()
    }));
    
    return {
      content: [{
        type: "text",
        text: `Found ${datasetList.length} datasets in project ${projectId}:\n${datasetList.map(ds => `- ${ds.id} (${ds.location}, created: ${ds.created})`).join('\n')}`
      }]
    };
  } catch (error) {
    log('Error in bqListDatasets:', error);
    
    if (error.code === 403) {
      throw new BigQueryPermissionError(
        `Permission denied. You don't have access to list datasets in project ${args.projectId || 'default'}`,
        error
      );
    } else if (error.code === 404) {
      throw new Error(`Project not found: ${args.projectId || await getProjectId()}`);
    }
    
    return formatErrorResponse(error);
  }
}

// Execute a BigQuery SQL query
export async function bqQuery(args) {
  try {
    const projectId = await getProjectId(args.projectId);
    log(`Executing query in project: ${projectId}`);
    
    const options = {
      query: args.query,
      useLegacySql: args.useLegacySql || false,
      projectId: projectId
    };
    
    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    
    // Format results nicely
    if (rows.length === 0) {
      return {
        content: [{
          type: "text",
          text: "Query completed successfully but returned no results."
        }]
      };
    }
    
    // For large results, truncate
    const displayRows = rows.slice(0, 100);
    const truncated = rows.length > 100;
    
    return {
      content: [{
        type: "text",
        text: `Query returned ${rows.length} rows${truncated ? ' (showing first 100)' : ''}:\n\n\`\`\`json\n${JSON.stringify(displayRows, null, 2)}\n\`\`\``
      }]
    };
  } catch (error) {
    log('Error in bqQuery:', error);
    
    if (error.code === 403) {
      throw new BigQueryPermissionError(
        'Permission denied. You need BigQuery Data Viewer role to run queries.',
        error
      );
    }
    
    return formatErrorResponse(error);
  }
}

// Create a new BigQuery dataset
export async function bqCreateDataset(args) {
  try {
    const projectId = await getProjectId(args.projectId);
    const datasetId = args.datasetId;
    const location = args.location || 'US';
    
    log(`Creating dataset ${datasetId} in project ${projectId}, location ${location}`);
    
    const [dataset] = await bigquery.createDataset(datasetId, {
      location: location,
      projectId: projectId
    });

    return {
      content: [{
        type: "text",
        text: `Successfully created dataset ${dataset.id} in ${location} for project ${projectId}`
      }]
    };
  } catch (error) {
    log('Error in bqCreateDataset:', error);
    
    if (error.code === 403) {
      throw new BigQueryPermissionError(
        'Permission denied. You need BigQuery Data Editor role to create datasets.',
        error
      );
    } else if (error.code === 409) {
      throw new Error(`Dataset ${args.datasetId} already exists`);
    }
    
    return formatErrorResponse(error);
  }
}

// List tables in a BigQuery dataset
export async function bqListTables(args) {
  try {
    const projectId = await getProjectId(args.projectId);
    log(`Listing tables in dataset ${args.datasetId} for project ${projectId}`);
    
    const dataset = bigquery.dataset(args.datasetId, { projectId });
    const [tables] = await dataset.getTables();
    
    if (tables.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No tables found in dataset ${args.datasetId}`
        }]
      };
    }
    
    const tableList = tables.map(table => ({
      id: table.id,
      type: table.metadata.type,
      created: new Date(parseInt(table.metadata.creationTime)).toISOString(),
      rows: table.metadata.numRows,
      size: (parseInt(table.metadata.numBytes || 0) / 1024 / 1024).toFixed(2)
    }));
    
    return {
      content: [{
        type: "text",
        text: `Found ${tableList.length} tables in dataset ${args.datasetId}:\n${tableList.map(t => `- ${t.id} (${t.type}, ${t.rows || 0} rows, ${t.size}MB)`).join('\n')}`
      }]
    };
  } catch (error) {
    log('Error in bqListTables:', error);
    
    if (error.code === 404) {
      throw new Error(`Dataset not found: ${args.datasetId}`);
    } else if (error.code === 403) {
      throw new BigQueryPermissionError(
        `Permission denied. You don't have access to dataset ${args.datasetId}`,
        error
      );
    }
    
    return formatErrorResponse(error);
  }
}

// Initialize and validate on first use
let initialized = false;
export async function ensureInitialized() {
  if (!initialized) {
    try {
      await validateAuthentication();
      initialized = true;
    } catch (error) {
      console.error('BigQuery initialization failed:', error);
      throw error;
    }
  }
}