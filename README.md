# GCP Fresh MCP Server

A Model Context Protocol (MCP) server designed for Google Cloud Platform deployment with built-in OAuth flow support for Claude Code integration.

## 🚀 Version 2.0 - Now with Real GCP Tools + Secret Token Security!

This MCP server now provides comprehensive control over your Google Cloud Platform resources through Claude Code with enterprise-grade security.

## 🔐 Security Features

- **Secret Token Authentication**: Protects MCP endpoints with secure token authentication
- **OAuth Flow Support**: Implements a complete OAuth flow to satisfy Claude Code's authentication requirements
- **Dual-Layer Security**: OAuth for initial handshake + secret token for actual tool calls
- **Access Monitoring**: Logs unauthorized access attempts
- **Command Filtering**: Dangerous gcloud commands are blocked

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
TAG=2.0.1
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
┌─────────────────┐      OAuth Flow     ┌─────────────────┐
│                 │ ←──────────────────→ │                 │
│   Claude Code   │                     │   MCP Server    │
│                 │ ←──────────────────→ │  (Cloud Run)   │
└─────────────────┘     JSON-RPC 2.0     └─────────────────┘
                        over HTTP                │
                                                 │
                                                 ▼
                ┌──────────────────────────────────────────────────┐
                │           Google Cloud Platform             │
                │ ┌──────────┐ ┌────────────────┐ │
                │ │BigQuery  │ │Cloud Storage│ │
                │ └──────────┘ └────────────────┘ │
                │ ┌──────────┐ ┌────────────────┐ │
                │ │Compute   │ │   Cloud Run    │ │
                │ │ Engine   │ │                │ │
                │ └──────────┘ └────────────────┘ │
                └──────────────────────────────────────────────────┘
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

### Can't access OAuth endpoints
- OAuth endpoints should work without the secret
- If they don't, check your Cloud Run deployment

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built with the goal of providing maximum GCP control through Claude Code's MCP interface with enterprise-grade security.