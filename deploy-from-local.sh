#!/bin/bash
# Quick deployment script for local development
# Usage: ./deploy-from-local.sh

set -e

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-$(gcloud config get-value project)}
REGION=${REGION:-us-central1}
SERVICE_NAME=${SERVICE_NAME:-mcp-fresh-server}
REPOSITORY=${REPOSITORY:-mcp}

# Check if MCP_SECRET is set
if [ -z "$MCP_SECRET" ]; then
    echo "Error: MCP_SECRET environment variable not set"
    echo "Set it with: export MCP_SECRET=your-secret-token"
    exit 1
fi

echo "🚀 Deploying MCP Server..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Build locally
echo "📦 Building Docker image..."
IMAGE_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/mcp-server:$(date +%Y%m%d-%H%M%S)"
docker build -t $IMAGE_TAG .

# Push to Artifact Registry
echo "⬆️  Pushing to Artifact Registry..."
docker push $IMAGE_TAG

# Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_TAG \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --cpu 1 \
    --memory 512Mi \
    --max-instances 10 \
    --timeout 300 \
    --set-env-vars MCP_SECRET=$MCP_SECRET \
    --project $PROJECT_ID

echo "✅ Deployment complete!"
echo "🌐 Service URL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')"
