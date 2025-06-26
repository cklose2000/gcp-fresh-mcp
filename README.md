# GCP Fresh MCP Server

A Model Context Protocol (MCP) server designed for Google Cloud Platform deployment with built-in OAuth flow support for Claude Code integration.

## 🚀 Version 3.0 - Enhanced BigQuery Capabilities + Full GCP Control!

This MCP server now provides comprehensive control over your Google Cloud Platform resources through Claude Code with enterprise-grade security and **full BigQuery capabilities including Jobs API, Sessions, Stored Procedures, and more!**

## 🔐 Security Features

- **Secret Token Authentication**: Protects MCP endpoints with secure token authentication
- **OAuth Flow Support**: Implements a complete OAuth flow to satisfy Claude Code's authentication requirements
- **OAuth Authorization Server Discovery**: Supports RFC 8414 OAuth 2.0 Authorization Server Metadata discovery
- **Dual-Layer Security**: OAuth for initial handshake + secret token for actual tool calls
- **Access Monitoring**: Logs unauthorized access attempts
- **Command Filtering**: Dangerous gcloud commands are blocked

## Features

- **OAuth Flow Support**: Implements a complete OAuth flow to satisfy Claude Code's authentication requirements
- **OAuth Authorization Server Discovery**: Automatic discovery of OAuth endpoints via `/.well-known/oauth-authorization-server` (RFC 8414)
- **JSON-RPC 2.0 Compliant**: Properly formatted responses for MCP protocol compatibility
- **Cloud Run Ready**: Designed for easy deployment on Google Cloud Platform
- **Comprehensive GCP Control**: Tools for BigQuery, Cloud Storage, Compute Engine, Cloud Run, and more
- **Enhanced BigQuery Features**: Jobs API, Sessions, Stored Procedures, Data Loading/Export, Streaming
- **Secure by Default**: Built-in safety checks and permission controls

## OAuth Authorization Server Discovery

This server implements OAuth 2.0 Authorization Server Metadata discovery as specified in RFC 8414, which is now supported by Claude Code. This allows Claude Code to automatically discover OAuth endpoints without manual configuration.

### How It Works

1. Claude Code requests `/.well-known/oauth-authorization-server` from your server
2. The server returns metadata including:
   - `issuer`: Your authorization server URL
   - `authorization_endpoint`: Where to send authorization requests
   - `token_endpoint`: Where to exchange codes for tokens
   - `response_types_supported`: OAuth response types (e.g., "code")
   - `code_challenge_methods_supported`: PKCE methods (e.g., "S256")

### Benefits

- **Automatic Configuration**: No need to manually specify OAuth endpoints
- **Standards Compliant**: Follows RFC 8414 specification
- **Future-Proof**: Endpoints can be changed without updating client configuration
- **Better Security**: Supports PKCE and other modern OAuth features

For implementation details, see the [MCP OAuth specification](https://modelcontextprotocol.io/docs/concepts/authentication#oauth-20).

## Available GCP Tools

### Enhanced BigQuery Tools (NEW!)

#### Jobs API & Async Operations
- `bq_create_query_job` - Create async query jobs with advanced options (dry run, destination tables, priority)
- `bq_get_job` - Get job status and retrieve results
- `bq_cancel_job` - Cancel running jobs
- `bq_list_jobs` - List all BigQuery jobs with filtering

#### Session Management
- `bq_create_session` - Create sessions for stateful operations
- `bq_query_with_session` - Execute queries within a session (temp tables, variables)

#### Stored Procedures & Scripts
- `bq_execute_procedure` - Execute stored procedures with proper parameter type handling
- `bq_execute_script` - Execute multiple SQL statements as a transaction/script

#### Data Operations
- `bq_load_data` - Load data from Cloud Storage (CSV, JSON, AVRO, PARQUET)
- `bq_export_data` - Export tables to Cloud Storage
- `bq_stream_insert` - Stream insert rows with deduplication
- `bq_copy_table` - Copy tables between datasets

#### Schema & Metadata
- `bq_get_table_schema` - Get detailed table schema and metadata
- `bq_get_routine_definition` - Get stored procedure/function definitions

#### Legacy BigQuery Tools (Still Available)
- `bq_list_datasets` - List all BigQuery datasets
- `bq_query` - Execute SQL queries (simple mode)
- `bq_create_dataset` - Create new datasets
- `bq_list_tables` - List tables in a dataset

### Cloud Storage
- `gcs_list_buckets` - List all storage buckets
- `gcs_list_files` - List files in a bucket
- `gcs_read_file` - Read file contents (up to 10MB)

### Compute Engine
- `compute_list_instances` - List VM instances by zone
- `compute_instance_action` - Start/stop/restart instances

### Cloud Run
- `run_list_services` - List Cloud Run services by region

### Project Management
- `list_projects` - List all accessible GCP projects
- `gcloud_command` - Execute gcloud commands (with safety filters)

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/cklose2000/gcp-fresh-mcp.git
cd gcp-fresh-mcp
```

### 2. Set Up Authentication

See [GCP_SETUP.md](GCP_SETUP.md) for detailed authentication setup instructions.

### 3. Deploy with Secret Token (Recommended)

Use the automated deployment script:

```bash
# Make the script executable
chmod +x deploy.sh

# Run the deployment script
./deploy.sh
```

The script will:
- Generate a secure secret token
- Enable required GCP APIs
- Build and deploy to Cloud Run
- Test the deployment
- Provide Claude Code configuration instructions

### 4. Manual Deployment (Alternative)

```bash
# Generate a secret token
MCP_SECRET=$(openssl rand -hex 32)
echo "Your secret: $MCP_SECRET"  # Save this!

# Set variables
TAG=3.0.0
PROJECT=$(gcloud config get-value project)
REGION=us-central1

# Build and deploy
gcloud builds submit . \
  --tag $REGION-docker.pkg.dev/$PROJECT/mcp/mcp-server:$TAG

gcloud run deploy mcp-fresh-server \
  --image $REGION-docker.pkg.dev/$PROJECT/mcp/mcp-server:$TAG \
  --region $REGION \
  --cpu 1 --memory 512Mi \
  --set-env-vars "MCP_SECRET=$MCP_SECRET" \
  --allow-unauthenticated
```

### 5. Configure Claude Code

```bash
# Remove old configuration (if exists)
claude mcp remove gcp 2>/dev/null || true

# Add with secret token authentication
claude mcp add --transport http gcp \
  https://your-service-url.run.app/mcp \
  --header "Authorization: Bearer YOUR_SECRET_TOKEN"
```

Replace `YOUR_SECRET_TOKEN` with the token generated during deployment.

## Usage Examples

Once connected in Claude Code:

### Enhanced BigQuery Operations
```
# Async query execution
"Create a BigQuery job to analyze last month's sales data with results written to analytics.monthly_summary"

# Stored procedures
"Execute the stored procedure calculate_customer_lifetime_value with parameters customer_id='12345' and end_date='2025-06-01'"

# Session-based operations
"Create a BigQuery session and create temporary tables for my analysis"

# Data loading
"Load the CSV file gs://my-data/sales_2025.csv into dataset.sales_table with auto-detected schema"

# Streaming inserts
"Stream insert these 5 new customer records into the customers table"

# Export operations
"Export the processed_data table to gs://my-exports/data.parquet in Parquet format with gzip compression"
```

### Legacy BigQuery Operations
```
# Standard queries
"List my BigQuery datasets"
"Run query: SELECT COUNT(*) FROM `project.dataset.table`"
"Create a new dataset called analytics_temp"
```

### Cloud Storage Operations
```
"Show me all my storage buckets"
"List files in bucket my-data-bucket"
"Read the config.json file from my-config-bucket"
```

### Compute Engine Operations
```
"List all VM instances in zone us-central1-a"
"Stop instance web-server-1 in zone us-central1-a"
```

### Multi-service Workflows
```
"Show me all my GCP projects"
"List Cloud Run services in us-central1"
"Execute gcloud command: config get-value project"
```

## Advanced BigQuery Examples

### Working with Jobs API
```
# Create a dry run query to estimate costs
"Do a dry run of this query: SELECT * FROM bigquery-public-data.samples.shakespeare"

# Monitor long-running jobs
"Check the status of job ID bqjob_r123456789"

# Cancel a job
"Cancel the running job bqjob_r987654321"
```

### Session Management
```
# Create a session for complex analysis
"Create a BigQuery session for my data analysis workflow"

# Use temporary tables
"In my session, create a temp table with top customers and then join it with orders"
```

### Stored Procedures
```
# Execute procedures with complex parameters
"Call the ETL procedure sp_process_daily_data with date='2025-06-01' and mode='FULL'"

# Execute multi-statement scripts
"Run this script: CREATE TEMP TABLE x AS ...; UPDATE dataset.table SET ...; INSERT INTO ..."
```

## Security

- **Secret Token**: MCP endpoints protected by secret token authentication
- **Service Account**: Uses dedicated service account with minimal required permissions
- **Command Filtering**: Dangerous gcloud commands are blocked
- **Size Limits**: File reads limited to 10MB
- **Audit Logging**: All operations logged via Cloud Run
- **OAuth Endpoints**: Remain open for Claude Code authentication (as required)

## How Security Works

1. **OAuth Flow**: Claude Code completes OAuth authentication (no secret required)
2. **Secret Token**: After OAuth, all MCP tool calls require the secret token
3. **Header Authentication**: Secret token sent in `Authorization: Bearer TOKEN` header
4. **Monitoring**: Unauthorized access attempts are logged with IP addresses

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MCP_SECRET` | Secret token for MCP authentication | Yes |
| `GOOGLE_CLOUD_PROJECT` | Default GCP project | Optional |
| `PORT` | Service port (auto-set by Cloud Run) | No |

## Required GCP Permissions

The service account needs these roles:
- **BigQuery**:
  - `bigquery.dataEditor` - For data operations
  - `bigquery.jobUser` - For creating jobs
  - `bigquery.user` - For running queries
- **Cloud Storage**:
  - `storage.objectViewer` - For reading files
  - `storage.legacyBucketReader` - For listing buckets
- **Compute Engine**:
  - `compute.instanceAdmin` - For instance management
- **Cloud Run**:
  - `run.viewer` - For listing services
- **Resource Manager**:
  - `resourcemanager.projectsViewer` - For listing projects

## Verification

Test your deployment:

```bash
# OAuth endpoint should work without secret
curl https://your-url/.well-known/oauth-authorization-server

# MCP endpoint should require secret
curl https://your-url/mcp
# Should return: {"error":"Unauthorized"}

# MCP endpoint should work with secret
curl -H "Authorization: Bearer YOUR_SECRET" https://your-url/mcp
# Should return server info
```

## Architecture

```
┌──────────────────┐       OAuth Flow     ┌──────────────────┐
│                  │ ←─────────────────────→ │                  │
│   Claude Code    │                         │   MCP Server     │
│                  │ ←─────────────────────→ │  (Cloud Run)     │
└──────────────────┘      JSON-RPC 2.0      └──────────────────┘
                         over HTTP                │
                                                 │
                                                 ▼
        ┌────────────────────────────────────────────────────────────────────────┐
        │                    Google Cloud Platform                               │
        │ ┌──────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
        │ │BigQuery  │ │Cloud Storage   │ │Compute Engine  │ │   Cloud Run    ││
        │ │- Jobs    │ │                │ │                │ │                ││
        │ │- Sessions│ │                │ │                │ │                ││
        │ │- Procs   │ │                │ │                │ │                ││
        │ └──────────┘ └────────────────┘ └────────────────┘ └────────────────┘│
        └────────────────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### "Unauthorized" errors
- Check that you included the `Authorization: Bearer SECRET` header
- Verify the secret matches what's deployed to Cloud Run
- Ensure you're hitting MCP endpoints, not OAuth endpoints

### Claude Code not working
- Make sure OAuth completed successfully first
- Verify the header format in your configuration
- Check Cloud Run logs for detailed error messages

### BigQuery stored procedures failing
- Ensure proper parameter types are specified
- Check that the procedure exists in the specified dataset
- Verify the service account has execute permissions
- Use `bq_get_job` to check detailed error messages

### Can't access OAuth endpoints
- OAuth endpoints should work without the secret
- If they don't, check your Cloud Run deployment

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built with the goal of providing maximum GCP control through Claude Code's MCP interface with enterprise-grade security and full BigQuery capabilities.