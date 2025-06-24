# GCP Fresh MCP Server

A Model Context Protocol (MCP) server designed for Google Cloud Platform deployment with built-in OAuth flow support for Claude Code integration.

## 🚀 Version 2.0 - Now with Real GCP Tools!

This MCP server now provides comprehensive control over your Google Cloud Platform resources through Claude Code.

## Features

- **OAuth Flow Support**: Implements a complete OAuth flow to satisfy Claude Code's authentication requirements
- **JSON-RPC 2.0 Compliant**: Properly formatted responses for MCP protocol compatibility
- **Cloud Run Ready**: Designed for easy deployment on Google Cloud Platform
- **Comprehensive GCP Control**: Tools for BigQuery, Cloud Storage, Compute Engine, Cloud Run, and more
- **Secure by Default**: Built-in safety checks and permission controls

## Available GCP Tools

### BigQuery
- `bq_list_datasets` - List all BigQuery datasets
- `bq_query` - Execute SQL queries
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

### 3. Deploy to Cloud Run

```bash
TAG=2.0.0
PROJECT=$(gcloud config get-value project)
REGION=us-central1

# Build and deploy
gcloud builds submit . \
  --tag $REGION-docker.pkg.dev/$PROJECT/mcp/mcp-server:$TAG

gcloud run deploy mcp-fresh-server \
  --image $REGION-docker.pkg.dev/$PROJECT/mcp/mcp-server:$TAG \
  --region $REGION \
  --cpu 2 --memory 2Gi \
  --timeout 300 \
  --service-account mcp-server@$PROJECT.iam.gserviceaccount.com \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT" \
  --allow-unauthenticated
```

### 4. Configure Claude Code

```bash
claude mcp remove gcp 2>/dev/null || true
claude mcp add --transport http gcp https://your-service-url.run.app/mcp
```

## Usage Examples

Once connected in Claude Code:

```
# BigQuery operations
"List my BigQuery datasets"
"Run query: SELECT COUNT(*) FROM `project.dataset.table`"
"Create a new dataset called analytics_temp"

# Cloud Storage operations
"Show me all my storage buckets"
"List files in bucket my-data-bucket"
"Read the config.json file from my-config-bucket"

# Compute Engine operations
"List all VM instances in zone us-central1-a"
"Stop instance web-server-1 in zone us-central1-a"

# Multi-service workflows
"Show me all my GCP projects"
"List Cloud Run services in us-central1"
"Execute gcloud command: config get-value project"
```

## Security

- **Service Account**: Uses dedicated service account with minimal required permissions
- **Command Filtering**: Dangerous gcloud commands are blocked
- **Size Limits**: File reads limited to 10MB
- **Audit Logging**: All operations logged via Cloud Run

## Architecture

```
┌─────────────┐     OAuth Flow    ┌──────────────┐
│             │ ←─────────────────→│              │
│ Claude Code │                    │  MCP Server  │
│             │ ←─────────────────→│ (Cloud Run)  │
└─────────────┘    JSON-RPC 2.0    └──────┬───────┘
                   over HTTP                │
                                           │
                                           ▼
                          ┌─────────────────────────────┐
                          │   Google Cloud Platform     │
                          │ ┌─────────┐ ┌─────────────┐ │
                          │ │BigQuery │ │Cloud Storage│ │
                          │ └─────────┘ └─────────────┘ │
                          │ ┌─────────┐ ┌─────────────┐ │
                          │ │Compute  │ │  Cloud Run  │ │
                          │ │ Engine  │ │             │ │
                          │ └─────────┘ └─────────────┘ │
                          └─────────────────────────────┘
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built with the goal of providing maximum GCP control through Claude Code's MCP interface.