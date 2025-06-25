import express from "express";
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { InstancesClient, ZonesClient } from '@google-cloud/compute';
import { ServicesClient } from '@google-cloud/run';
import { ProjectsClient } from '@google-cloud/resource-manager';
import { exec } from 'child_process';
import { promisify } from 'util';

// Import enhanced BigQuery functions
import * as bqEnhanced from './bigquery-enhanced.js';

// Secret token for MCP endpoint protection
const MCP_SECRET = process.env.MCP_SECRET || 'change-this-secret-token';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware to check secret on MCP endpoints
app.use('/mcp', (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  // Skip check for OAuth endpoints (they come first)
  if (req.path.includes('authorize') || req.path.includes('token') || req.path.includes('register')) {
    return next();
  }
  
  // Check secret for MCP endpoints
  if (authHeader !== `Bearer ${MCP_SECRET}`) {
    console.log('Unauthorized access attempt from:', req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
});

// Initialize Google Cloud clients
const bigquery = new BigQuery();
const storage = new Storage();
const computeClient = new InstancesClient();
const zonesClient = new ZonesClient();
const runClient = new ServicesClient();
const resourceManager = new ProjectsClient();
const execAsync = promisify(exec);

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

// OAuth endpoints (keeping existing implementation)
app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const protocol = req.get('x-forwarded-proto') || 'https';
  const base = `${protocol}://${req.get("host")}`;
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"]
  });
});

app.post("/register", (req, res) => {
  res.status(201).json({
    client_id: "mcp-client",
    client_secret: "not-used",
    redirect_uris: req.body.redirect_uris || ["http://localhost"]
  });
});

app.get("/authorize", (req, res) => {
  const { redirect_uri, state } = req.query;
  if (redirect_uri) {
    const url = new URL(redirect_uri);
    url.searchParams.set("code", "dummy-code");
    if (state) url.searchParams.set("state", state);
    res.redirect(url.toString());
  }
});

app.post("/token", (req, res) => {
  res.json({
    access_token: "dummy-token",
    token_type: "Bearer",
    expires_in: 3600
  });
});

// MCP handshake
app.get("/mcp", (req, res) => {
  res.json({ 
    name: "gcp-mcp", 
    transport: "http", 
    version: "1.0",
    description: "GCP MCP Server with full platform control",
    capabilities: {
      tools: true
    }
  });
});

// GCP Tool handler
async function handleGCPTool(toolName, args) {
  try {
    // Enhanced BigQuery tools
    if (toolName.startsWith('bq_') && bqEnhanced[toolName]) {
      // Ensure projectId is set
      if (!args.projectId) {
        args.projectId = await getProjectId();
      }
      return await bqEnhanced[toolName](args);
    }
    
    switch (toolName) {
      // Legacy BigQuery tools (keep for compatibility)
      case "bq_list_datasets": {
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
            text: `Found ${datasetList.length} datasets in project ${projectId}:\n${datasetList.map(ds => `- ${ds.id} (${ds.location}, created: ${ds.created})`).join('\n')}`
          }]
        };
      }
      
      case "bq_query": {
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
            text: `Query returned ${rows.length} rows${truncated ? ' (showing first 100)' : ''}:\n\`\`\`json\n${JSON.stringify(displayRows, null, 2)}\n\`\`\``
          }]
        };
      }
      
      case "bq_create_dataset": {
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
      
      case "bq_list_tables": {
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
            text: `Found ${tableList.length} tables in dataset ${args.datasetId}:\n${tableList.map(t => `- ${t.id} (${t.type}, ${t.rows || 0} rows, ${t.size}MB)`).join('\n')}`
          }]
        };
      }
      
      // Cloud Storage tools
      case "gcs_list_buckets": {
        const projectId = await getProjectId(args.projectId);
        const [buckets] = await storage.getBuckets({ projectId });
        
        if (buckets.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No storage buckets found in project ${projectId}`
            }]
          };
        }
        
        const bucketList = buckets.map(bucket => ({
          name: bucket.name,
          location: bucket.metadata.location,
          storageClass: bucket.metadata.storageClass,
          created: bucket.metadata.timeCreated
        }));
        
        return {
          content: [{
            type: "text",
            text: `Found ${bucketList.length} buckets:\n${bucketList.map(b => `- gs://${b.name} (${b.location}, ${b.storageClass})`).join('\n')}`
          }]
        };
      }
      
      case "gcs_list_files": {
        const bucket = storage.bucket(args.bucketName);
        const [files] = await bucket.getFiles({
          prefix: args.prefix,
          maxResults: args.limit || 100
        });
        
        if (files.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No files found in gs://${args.bucketName}${args.prefix ? '/' + args.prefix : ''}`
            }]
          };
        }
        
        const fileList = files.map(file => ({
          name: file.name,
          size: (parseInt(file.metadata.size || 0) / 1024).toFixed(2),
          updated: file.metadata.updated,
          contentType: file.metadata.contentType
        }));
        
        return {
          content: [{
            type: "text",
            text: `Found ${fileList.length} files in gs://${args.bucketName}:\n${fileList.map(f => `- ${f.name} (${f.size}KB, ${f.contentType || 'unknown type'})`).join('\n')}`
          }]
        };
      }
      
      case "gcs_read_file": {
        const bucket = storage.bucket(args.bucketName);
        const file = bucket.file(args.fileName);
        
        // Check file size first
        const [metadata] = await file.getMetadata();
        const sizeMB = parseInt(metadata.size) / 1024 / 1024;
        
        if (sizeMB > 10) {
          return {
            content: [{
              type: "text",
              text: `File ${args.fileName} is too large (${sizeMB.toFixed(2)}MB). Maximum size for reading is 10MB.`
            }]
          };
        }
        
        const [contents] = await file.download();
        const text = contents.toString();
        
        // Truncate if too long
        const maxLength = 5000;
        const truncated = text.length > maxLength;
        const displayText = truncated ? text.substring(0, maxLength) + '...' : text;
        
        return {
          content: [{
            type: "text",
            text: `Contents of gs://${args.bucketName}/${args.fileName}${truncated ? ' (truncated)' : ''}:\n\`\`\`\n${displayText}\n\`\`\``
          }]
        };
      }
      
      // Compute Engine tools
      case "compute_list_instances": {
        const projectId = await getProjectId(args.projectId);
        
        if (args.zone) {
          const [response] = await computeClient.list({
            project: projectId,
            zone: args.zone
          });
          
          if (!response || response.length === 0) {
            return {
              content: [{
                type: "text",
                text: `No instances found in zone ${args.zone}`
              }]
            };
          }
          
          const instances = response.map(instance => ({
            name: instance.name,
            status: instance.status,
            machineType: instance.machineType.split('/').pop(),
            zone: args.zone,
            externalIP: instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || 'none'
          }));
          
          return {
            content: [{
              type: "text",
              text: `Instances in ${args.zone}:\n${instances.map(i => `- ${i.name} (${i.status}, ${i.machineType}, IP: ${i.externalIP})`).join('\n')}`
            }]
          };
        } else {
          // List all zones first
          const [zones] = await zonesClient.list({ project: projectId });
          const zoneList = zones.filter(z => z.status === 'UP').map(z => z.name).slice(0, 10);
          
          return {
            content: [{
              type: "text",
              text: `Please specify a zone. Available zones:\n${zoneList.map(z => `- ${z}`).join('\n')}\n\nExample: use zone "us-central1-a"`
            }]
          };
        }
      }
      
      case "compute_instance_action": {
        const projectId = await getProjectId(args.projectId);
        const request = {
          project: projectId,
          zone: args.zone,
          instance: args.instanceName
        };
        
        let operation;
        switch (args.action) {
          case "start":
            [operation] = await computeClient.start(request);
            break;
          case "stop":
            [operation] = await computeClient.stop(request);
            break;
          case "reset":
            [operation] = await computeClient.reset(request);
            break;
          default:
            throw new Error(`Invalid action: ${args.action}`);
        }
        
        return {
          content: [{
            type: "text",
            text: `Successfully initiated ${args.action} operation for instance ${args.instanceName} in zone ${args.zone}`
          }]
        };
      }
      
      // Cloud Run tools
      case "run_list_services": {
        const projectId = await getProjectId(args.projectId);
        const parent = `projects/${projectId}/locations/${args.region}`;
        
        try {
          const request = { parent };
          const iterable = runClient.listServicesAsync(request);
          
          const services = [];
          for await (const service of iterable) {
            services.push({
              name: service.metadata.name.split('/').pop(),
              url: service.status?.url,
              ready: service.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True',
              created: service.metadata.creationTimestamp
            });
          }
          
          if (services.length === 0) {
            return {
              content: [{
                type: "text",
                text: `No Cloud Run services found in ${args.region}`
              }]
            };
          }
          
          return {
            content: [{
              type: "text",
              text: `Cloud Run services in ${args.region}:\n${services.map(s => `- ${s.name} ${s.ready ? '✓' : '✗'} ${s.url || 'No URL'}`).join('\n')}`
            }]
          };
        } catch (error) {
          if (error.code === 7) {
            return {
              content: [{
                type: "text",
                text: `Invalid region: ${args.region}. Common regions: us-central1, us-east1, europe-west1, asia-northeast1`
              }]
            };
          }
          throw error;
        }
      }
      
      // Project tools
      case "list_projects": {
        const request = {
          query: 'state:ACTIVE'
        };
        
        const [projects] = await resourceManager.searchProjects(request);
        
        if (projects.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No accessible projects found"
            }]
          };
        }
        
        const projectList = projects.map(project => ({
          id: project.name.split('/')[1],
          displayName: project.displayName,
          state: project.state,
          createTime: project.createTime
        }));
        
        return {
          content: [{
            type: "text",
            text: `Accessible GCP Projects:\n${projectList.map(p => `- ${p.id} "${p.displayName}" (${p.state})`).join('\n')}`
          }]
        };
      }
      
      // Generic gcloud command
      case "gcloud_command": {
        // Security check - block dangerous commands
        const dangerous = ['rm', 'delete', 'destroy', 'iam', 'set-iam-policy'];
        if (dangerous.some(cmd => args.command.includes(cmd))) {
          return {
            content: [{
              type: "text",
              text: "This command has been blocked for safety. Please use specific MCP tools instead."
            }]
          };
        }
        
        try {
          const { stdout, stderr } = await execAsync(`gcloud ${args.command}`);
          const output = stdout || stderr || 'Command completed with no output';
          
          // Truncate long outputs
          const maxLength = 5000;
          const truncated = output.length > maxLength;
          const displayOutput = truncated ? output.substring(0, maxLength) + '...' : output;
          
          return {
            content: [{
              type: "text",
              text: `\`\`\`\n${displayOutput}\n\`\`\`${truncated ? '\n(Output truncated)' : ''}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Command failed: ${error.message}`
            }]
          };
        }
      }
      
      default:
        throw new Error(`Unknown GCP tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error in ${toolName}:`, error);
    throw error;
  }
}

// MCP protocol handler
app.post("/mcp", async (req, res) => {
  const { method, params, id } = req.body;
  console.log(`\nMCP Method: ${method}`);
  console.log("Request ID:", id);
  
  // Build JSON-RPC response
  const response = {
    jsonrpc: "2.0",
    id: id
  };
  
  try {
    if (method === "initialize") {
      response.result = {
        protocolVersion: params?.protocolVersion || "2025-03-26",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        serverInfo: {
          name: "gcp-mcp",
          version: "3.0.0",
          description: "GCP MCP Server with comprehensive platform control and enhanced BigQuery capabilities"
        }
      };
    } else if (method === "tools/list") {
      response.result = {
        tools: [
          // Enhanced BigQuery Tools
          {
            name: "bq_create_query_job",
            description: "Create an async BigQuery query job with advanced options",
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
                location: {
                  type: "string",
                  description: "Query location (default: US)"
                },
                destinationTable: {
                  type: "string",
                  description: "Table name to write results to"
                },
                destinationDataset: {
                  type: "string",
                  description: "Dataset for destination table"
                },
                writeDisposition: {
                  type: "string",
                  enum: ["WRITE_TRUNCATE", "WRITE_APPEND", "WRITE_EMPTY"],
                  description: "How to write results"
                },
                timeoutMs: {
                  type: "string",
                  description: "Job timeout in milliseconds"
                },
                dryRun: {
                  type: "boolean",
                  description: "Validate query without executing"
                },
                useLegacySql: {
                  type: "boolean",
                  description: "Use legacy SQL syntax"
                },
                priority: {
                  type: "string",
                  enum: ["INTERACTIVE", "BATCH"],
                  description: "Query priority"
                }
              },
              required: ["query"]
            }
          },
          {
            name: "bq_get_job",
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
                  description: "Retrieve query results if available"
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
            name: "bq_cancel_job",
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
            name: "bq_create_session",
            description: "Create a BigQuery session for stateful operations",
            inputSchema: {
              type: "object",
              properties: {
                projectId: { 
                  type: "string",
                  description: "GCP Project ID (optional)"
                },
                location: {
                  type: "string",
                  description: "Session location (default: US)"
                }
              }
            }
          },
          {
            name: "bq_query_with_session",
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
          },
          {
            name: "bq_execute_procedure",
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
                      value: { type: ["string", "number", "boolean", "array", "object"] },
                      type: { type: "string" },
                      name: { type: "string" }
                    }
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
                  description: "Wait for procedure to complete"
                }
              },
              required: ["procedureName", "datasetId", "projectId"]
            }
          },
          {
            name: "bq_execute_script",
            description: "Execute multiple SQL statements as a script",
            inputSchema: {
              type: "object",
              properties: {
                statements: { 
                  type: "array",
                  description: "Array of SQL statements",
                  items: { type: "string" }
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
                  description: "Wait for script completion"
                }
              },
              required: ["statements", "projectId"]
            }
          },
          {
            name: "bq_load_data",
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
                writeDisposition: {
                  type: "string",
                  enum: ["WRITE_TRUNCATE", "WRITE_APPEND", "WRITE_EMPTY"],
                  description: "How to write data"
                },
                createDisposition: {
                  type: "string",
                  enum: ["CREATE_IF_NEEDED", "CREATE_NEVER"],
                  description: "Table creation behavior"
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
                allowQuotedNewlines: {
                  type: "boolean",
                  description: "Allow quoted newlines (CSV)"
                },
                allowJaggedRows: {
                  type: "boolean",
                  description: "Allow jagged rows (CSV)"
                },
                location: {
                  type: "string",
                  description: "Job location"
                },
                waitForCompletion: {
                  type: "boolean",
                  description: "Wait for load to complete"
                }
              },
              required: ["sourceUri", "datasetId", "tableId"]
            }
          },
          {
            name: "bq_export_data",
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
                compress: {
                  type: "boolean",
                  description: "Compress output with gzip"
                },
                fieldDelimiter: {
                  type: "string",
                  description: "Field delimiter (CSV)"
                },
                printHeader: {
                  type: "boolean",
                  description: "Include header row (CSV)"
                },
                location: {
                  type: "string",
                  description: "Job location"
                },
                waitForCompletion: {
                  type: "boolean",
                  description: "Wait for export to complete"
                }
              },
              required: ["datasetId", "tableId", "destinationUri"]
            }
          },
          {
            name: "bq_stream_insert",
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
                  items: { type: "object" }
                },
                insertIds: {
                  type: "array",
                  description: "Optional insert IDs for deduplication",
                  items: { type: "string" }
                },
                skipInvalidRows: {
                  type: "boolean",
                  description: "Skip invalid rows"
                },
                ignoreUnknownValues: {
                  type: "boolean",
                  description: "Ignore unknown field values"
                }
              },
              required: ["datasetId", "tableId", "rows"]
            }
          },
          {
            name: "bq_get_table_schema",
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
            name: "bq_get_routine_definition",
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
          },
          {
            name: "bq_copy_table",
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
                writeDisposition: {
                  type: "string",
                  enum: ["WRITE_TRUNCATE", "WRITE_APPEND", "WRITE_EMPTY"],
                  description: "How to write data"
                },
                createDisposition: {
                  type: "string",
                  enum: ["CREATE_IF_NEEDED", "CREATE_NEVER"],
                  description: "Table creation behavior"
                },
                waitForCompletion: {
                  type: "boolean",
                  description: "Wait for copy to complete"
                }
              },
              required: ["sourceDatasetId", "sourceTableId", "destinationDatasetId", "destinationTableId"]
            }
          },
          {
            name: "bq_list_jobs",
            description: "List BigQuery jobs",
            inputSchema: {
              type: "object",
              properties: {
                projectId: { 
                  type: "string",
                  description: "GCP Project ID (optional)"
                },
                maxResults: {
                  type: "number",
                  description: "Maximum results to return"
                },
                allUsers: {
                  type: "boolean",
                  description: "List jobs from all users"
                },
                stateFilter: {
                  type: "string",
                  enum: ["pending", "running", "done"],
                  description: "Filter by job state"
                },
                minCreationTime: {
                  type: "string",
                  description: "Min creation time (ISO format)"
                },
                projection: {
                  type: "string",
                  enum: ["full", "minimal"],
                  description: "Response detail level"
                }
              }
            }
          },
          
          // Legacy BigQuery Tools (for compatibility)
          {
            name: "bq_list_datasets",
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
            name: "bq_query",
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
            name: "bq_create_dataset",
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
            name: "bq_list_tables",
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
          },
          
          // Cloud Storage Tools
          {
            name: "gcs_list_buckets",
            description: "List all Cloud Storage buckets",
            inputSchema: {
              type: "object",
              properties: {
                projectId: { 
                  type: "string",
                  description: "GCP Project ID (optional)"
                }
              }
            }
          },
          {
            name: "gcs_list_files",
            description: "List files in a Cloud Storage bucket",
            inputSchema: {
              type: "object",
              properties: {
                bucketName: { 
                  type: "string",
                  description: "Bucket name"
                },
                prefix: {
                  type: "string",
                  description: "File prefix/folder path (optional)"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of files to return",
                  default: 100
                }
              },
              required: ["bucketName"]
            }
          },
          {
            name: "gcs_read_file",
            description: "Read a file from Cloud Storage (max 10MB)",
            inputSchema: {
              type: "object",
              properties: {
                bucketName: { 
                  type: "string",
                  description: "Bucket name"
                },
                fileName: {
                  type: "string",
                  description: "File path in bucket"
                }
              },
              required: ["bucketName", "fileName"]
            }
          },
          
          // Compute Engine Tools
          {
            name: "compute_list_instances",
            description: "List all Compute Engine instances",
            inputSchema: {
              type: "object",
              properties: {
                projectId: { 
                  type: "string",
                  description: "GCP Project ID (optional)"
                },
                zone: {
                  type: "string",
                  description: "Zone (required, e.g., 'us-central1-a')"
                }
              }
            }
          },
          {
            name: "compute_instance_action",
            description: "Start, stop, or restart a Compute Engine instance",
            inputSchema: {
              type: "object",
              properties: {
                instanceName: { 
                  type: "string",
                  description: "Instance name"
                },
                zone: {
                  type: "string",
                  description: "Instance zone"
                },
                action: {
                  type: "string",
                  enum: ["start", "stop", "reset"],
                  description: "Action to perform"
                },
                projectId: { 
                  type: "string",
                  description: "GCP Project ID (optional)"
                }
              },
              required: ["instanceName", "zone", "action"]
            }
          },
          
          // Cloud Run Tools
          {
            name: "run_list_services",
            description: "List all Cloud Run services",
            inputSchema: {
              type: "object",
              properties: {
                projectId: { 
                  type: "string",
                  description: "GCP Project ID (optional)"
                },
                region: {
                  type: "string",
                  description: "Region (e.g., 'us-central1')"
                }
              },
              required: ["region"]
            }
          },
          
          // Project Tools
          {
            name: "list_projects",
            description: "List all accessible GCP projects",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          
          // Generic gcloud command
          {
            name: "gcloud_command",
            description: "Execute any gcloud command (some commands blocked for safety)",
            inputSchema: {
              type: "object",
              properties: {
                command: { 
                  type: "string",
                  description: "Full gcloud command (without 'gcloud' prefix)"
                }
              },
              required: ["command"]
            }
          },
          
          // Keep the echo tool for testing
          {
            name: "echo",
            description: "Echo a message (test tool)",
            inputSchema: {
              type: "object",
              properties: {
                message: { 
                  type: "string",
                  description: "Message to echo"
                }
              },
              required: ["message"]
            }
          }
        ]
      };
    } else if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments;
      
      // List of all tools
      const allTools = [
        // Enhanced BQ tools
        "bq_create_query_job", "bq_get_job", "bq_cancel_job", "bq_create_session",
        "bq_query_with_session", "bq_execute_procedure", "bq_execute_script",
        "bq_load_data", "bq_export_data", "bq_stream_insert", "bq_get_table_schema",
        "bq_get_routine_definition", "bq_copy_table", "bq_list_jobs",
        // Legacy BQ tools
        "bq_list_datasets", "bq_query", "bq_create_dataset", "bq_list_tables",
        // Other GCP tools
        "gcs_list_buckets", "gcs_list_files", "gcs_read_file",
        "compute_list_instances", "compute_instance_action",
        "run_list_services", "list_projects", "gcloud_command"
      ];
      
      if (allTools.includes(toolName)) {
        response.result = await handleGCPTool(toolName, args);
      } else if (toolName === "echo") {
        response.result = {
          content: [{
            type: "text",
            text: `Echo: ${args?.message || "no message"}`
          }]
        };
      } else {
        response.error = {
          code: -32602,
          message: `Unknown tool: ${toolName}`
        };
      }
    } else {
      response.error = {
        code: -32601,
        message: `Method not found: ${method}`
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error("Error processing request:", error);
    response.error = {
      code: -32603,
      message: "Internal error",
      data: error.message
    };
    res.json(response);
  }
});

// Catch all
app.all("*", (req, res) => {
  console.log(`!!! Unhandled: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ GCP MCP server on port ${PORT}`);
  console.log("Enhanced BigQuery capabilities: Jobs API, Sessions, Stored Procedures, Data Loading, and more!");
  console.log("Available tools: BigQuery, Cloud Storage, Compute Engine, Cloud Run, and more!");
});
