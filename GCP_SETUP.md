# GCP MCP Server - Setup and Authentication Guide

## Overview

This guide explains how to set up authentication and deploy the GCP MCP server with full platform control capabilities.

## Authentication Methods

The GCP MCP server supports two authentication methods:

### 1. Application Default Credentials (Recommended for Cloud Run)

When deployed on Cloud Run, the service automatically uses the Cloud Run service account. This is the simplest method.

### 2. Service Account Key (For local development)

For local development or specific permission control, use a service account key.

## Deployment Instructions

### Step 1: Set Up a Service Account

```bash
# Set your project ID
PROJECT_ID=your-project-id

# Create a service account
gcloud iam service-accounts create mcp-server \
    --display-name="MCP Server Service Account" \
    --project=$PROJECT_ID

# Grant necessary permissions
# Start with basic permissions and add more as needed
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:mcp-server@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/bigquery.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:mcp-server@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:mcp-server@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:mcp-server@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/compute.viewer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:mcp-server@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.viewer"

# For compute instance control, add:
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:mcp-server@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/compute.instanceAdmin"

# For cross-project access, add:
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:mcp-server@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/resourcemanager.projectViewer"
```

### Step 2: Deploy to Cloud Run

```bash
# Clone and navigate to the repository
git clone https://github.com/cklose2000/gcp-fresh-mcp.git
cd gcp-fresh-mcp

# Update the files with the new implementation
# (Copy the updated main.js, package.json, and Dockerfile)

# Set deployment variables
TAG=2.0.0
PROJECT=$(gcloud config get-value project)
REGION=us-central1

# Build the container
gcloud builds submit . \
  --tag $REGION-docker.pkg.dev/$PROJECT/mcp/mcp-server:$TAG

# Deploy to Cloud Run with the service account
gcloud run deploy mcp-fresh-server \
  --image $REGION-docker.pkg.dev/$PROJECT/mcp/mcp-server:$TAG \
  --region $REGION \
  --cpu 2 --memory 2Gi \
  --timeout 300 \
  --service-account mcp-server@$PROJECT.iam.gserviceaccount.com \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT" \
  --allow-unauthenticated
```

### Step 3: Configure Claude Code

```bash
# Remove old configuration
claude mcp remove gcp

# Add the updated server
claude mcp add --transport http gcp https://your-service-url.run.app/mcp
```

## Available GCP Tools

After deployment, you'll have access to these tools:

### BigQuery Tools
- `bq_list_datasets` - List all datasets
- `bq_query` - Execute SQL queries
- `bq_create_dataset` - Create new datasets
- `bq_list_tables` - List tables in a dataset

### Cloud Storage Tools
- `gcs_list_buckets` - List all buckets
- `gcs_list_files` - List files in a bucket
- `gcs_read_file` - Read file contents

### Compute Engine Tools
- `compute_list_instances` - List VM instances
- `compute_instance_action` - Start/stop/restart instances

### Cloud Run Tools
- `run_list_services` - List Cloud Run services

### Project Management
- `list_projects` - List accessible projects
- `gcloud_command` - Execute gcloud commands

## Usage Examples

Once connected in Claude Code:

```
# List your BigQuery datasets
Use the bq_list_datasets tool

# Run a BigQuery query
Use bq_query to run "SELECT * FROM `project.dataset.table` LIMIT 10"

# List Cloud Storage buckets
Use gcs_list_buckets tool

# List Compute Engine instances in us-central1-a
Use compute_list_instances with zone "us-central1-a"

# Execute a gcloud command
Use gcloud_command with command "config list"
```

## Security Considerations

1. **Principle of Least Privilege**: Only grant the minimum permissions needed
2. **Audit Logs**: Cloud Run automatically logs all API calls
3. **Network Security**: Cloud Run provides built-in DDoS protection
4. **Command Filtering**: The `gcloud_command` tool blocks dangerous operations

## Troubleshooting

### Permission Denied Errors
- Check service account permissions
- Ensure the Cloud Run service is using the correct service account
- Verify API enablement: BigQuery API, Storage API, Compute Engine API

### Authentication Errors
- For local testing, set `GOOGLE_APPLICATION_CREDENTIALS`
- For Cloud Run, ensure service account is attached to the service

### Tool Not Working
- Check Cloud Run logs: `gcloud run services logs read mcp-fresh-server --region $REGION`
- Verify the tool name matches exactly
- Check if required parameters are provided

## Local Development

For local testing with authentication:

```bash
# Download service account key (for local dev only!)
gcloud iam service-accounts keys create ./service-account-key.json \
    --iam-account=mcp-server@$PROJECT_ID.iam.gserviceaccount.com

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
export GOOGLE_CLOUD_PROJECT=$PROJECT_ID

# Run locally
npm install
npm start
```

**Important**: Never commit service account keys to git!

## Adding More Permissions

As you expand usage, you may need additional permissions:

```bash
# For creating/modifying resources
--role="roles/bigquery.admin"
--role="roles/storage.admin"
--role="roles/compute.admin"

# For Cloud SQL access
--role="roles/cloudsql.client"

# For Firestore/Datastore
--role="roles/datastore.user"

# For Pub/Sub
--role="roles/pubsub.editor"
```

## Next Steps

1. Deploy the updated server
2. Test each tool to ensure proper permissions
3. Add custom tools for your specific GCP workflows
4. Monitor usage via Cloud Run metrics

Remember: With great power comes great responsibility. This server provides significant control over your GCP resources, so secure it appropriately!