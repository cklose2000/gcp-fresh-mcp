import { BigQuery } from '@google-cloud/bigquery';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const bigquery = new BigQuery();

// Get default project ID from environment or metadata
const getProjectId = async (providedId) => {
  if (providedId) return providedId;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  
  try {
    const { stdout } = await execAsync('gcloud config get-value project');
    return stdout.trim();
  } catch {
    throw new Error('No project ID provided and unable to determine default project');
  }
};

// List datasets in a BigQuery project
export async function bqListDatasets(args) {
  const projectId = await getProjectId(args.projectId);
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
      text: `Found ${datasetList.length} datasets in project ${projectId}:
${datasetList.map(ds => `- ${ds.id} (${ds.location}, created: ${ds.created})`).join('\n')}`
    }]
  };
}

// Execute a BigQuery SQL query
export async function bqQuery(args) {
  const projectId = await getProjectId(args.projectId);
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
      text: `Query returned ${rows.length} rows${truncated ? ' (showing first 100)' : ''}:

\`\`\`json
${JSON.stringify(displayRows, null, 2)}
\`\`\``
    }]
  };
}

// Create a new BigQuery dataset
export async function bqCreateDataset(args) {
  const projectId = await getProjectId(args.projectId);
  const datasetId = args.datasetId;
  const location = args.location || 'US';
  
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
}

// List tables in a BigQuery dataset
export async function bqListTables(args) {
  const projectId = await getProjectId(args.projectId);
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
      text: `Found ${tableList.length} tables in dataset ${args.datasetId}:
${tableList.map(t => `- ${t.id} (${t.type}, ${t.rows || 0} rows, ${t.size}MB)`).join('\n')}`
    }]
  };
}