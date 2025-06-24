#!/bin/bash

# GCP MCP Server Deployment Script with Secret Token Authentication
# This script deploys your MCP server with secret token protection

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 GCP MCP Server Deployment with Secret Token Authentication${NC}"
echo "=================================================================="

# Check if required tools are installed
check_tools() {
    echo -e "${BLUE}Checking required tools...${NC}"
    
    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}❌ gcloud CLI not found. Please install it first.${NC}"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Please install it first.${NC}"
        exit 1
    fi
    
    if ! command -v openssl &> /dev/null; then
        echo -e "${RED}❌ OpenSSL not found. Please install it first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All required tools found${NC}"
}

# Get project configuration
get_config() {
    echo -e "${BLUE}Getting project configuration...${NC}"
    
    # Get current project
    PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
    if [ -z "$PROJECT" ]; then
        echo -e "${RED}❌ No default project set. Please run: gcloud config set project YOUR_PROJECT_ID${NC}"
        exit 1
    fi
    
    # Set default values
    REGION=${REGION:-"us-central1"}
    SERVICE_NAME=${SERVICE_NAME:-"mcp-fresh-server"}
    REPOSITORY=${REPOSITORY:-"mcp"}
    TAG="v$(date +%Y%m%d-%H%M%S)"
    
    echo -e "${GREEN}✅ Configuration:${NC}"
    echo "   Project: $PROJECT"
    echo "   Region: $REGION"
    echo "   Service: $SERVICE_NAME"
    echo "   Repository: $REPOSITORY"
    echo "   Tag: $TAG"
}

# Generate secret token
generate_secret() {
    echo -e "${BLUE}Generating secret token...${NC}"
    
    MCP_SECRET=$(openssl rand -hex 32)
    echo -e "${GREEN}✅ Generated secret token${NC}"
    echo -e "${YELLOW}🔐 Your secret token: ${MCP_SECRET}${NC}"
    echo -e "${YELLOW}📝 Save this token securely - you'll need it for Claude Code configuration!${NC}"
    echo ""
    echo "Copy this token now:"
    echo -e "${GREEN}${MCP_SECRET}${NC}"
    echo ""
    read -p "Press Enter when you've copied the token..."
}

# Enable required APIs
enable_apis() {
    echo -e "${BLUE}Enabling required APIs...${NC}"
    
    APIs=(
        "run.googleapis.com"
        "artifactregistry.googleapis.com"
        "cloudbuild.googleapis.com"
        "bigquery.googleapis.com"
        "storage.googleapis.com"
        "compute.googleapis.com"
        "cloudresourcemanager.googleapis.com"
    )
    
    for api in "${APIs[@]}"; do
        echo "Enabling $api..."
        gcloud services enable $api --project=$PROJECT
    done
    
    echo -e "${GREEN}✅ APIs enabled${NC}"
}

# Create Artifact Registry repository
create_repository() {
    echo -e "${BLUE}Creating Artifact Registry repository...${NC}"
    
    # Check if repository exists
    if gcloud artifacts repositories describe $REPOSITORY --location=$REGION --project=$PROJECT &>/dev/null; then
        echo -e "${YELLOW}⚠️  Repository $REPOSITORY already exists${NC}"
    else
        echo "Creating repository $REPOSITORY..."
        gcloud artifacts repositories create $REPOSITORY \
            --repository-format=docker \
            --location=$REGION \
            --project=$PROJECT
        echo -e "${GREEN}✅ Repository created${NC}"
    fi
}

# Configure Docker authentication
configure_docker() {
    echo -e "${BLUE}Configuring Docker authentication...${NC}"
    
    gcloud auth configure-docker $REGION-docker.pkg.dev --quiet
    echo -e "${GREEN}✅ Docker authentication configured${NC}"
}

# Build and push Docker image
build_and_push() {
    echo -e "${BLUE}Building and pushing Docker image...${NC}"
    
    IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT/$REPOSITORY/mcp-server:$TAG"
    
    echo "Building Docker image..."
    docker build -t $IMAGE_URI .
    
    echo "Pushing Docker image..."
    docker push $IMAGE_URI
    
    echo -e "${GREEN}✅ Image built and pushed: $IMAGE_URI${NC}"
}

# Deploy to Cloud Run
deploy_service() {
    echo -e "${BLUE}Deploying to Cloud Run...${NC}"
    
    IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT/$REPOSITORY/mcp-server:$TAG"
    
    gcloud run deploy $SERVICE_NAME \
        --image $IMAGE_URI \
        --region $REGION \
        --project $PROJECT \
        --cpu 1 \
        --memory 512Mi \
        --set-env-vars "MCP_SECRET=$MCP_SECRET" \
        --allow-unauthenticated \
        --port 8080 \
        --max-instances 10 \
        --timeout 300 \
        --quiet
    
    # Get the service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT --format="value(status.url)")
    
    echo -e "${GREEN}✅ Service deployed successfully!${NC}"
    echo -e "${GREEN}🌐 Service URL: ${SERVICE_URL}${NC}"
}

# Test the deployment
test_deployment() {
    echo -e "${BLUE}Testing deployment...${NC}"
    
    # Test OAuth endpoint (should work without secret)
    echo "Testing OAuth endpoint..."
    if curl -s -f "$SERVICE_URL/.well-known/oauth-authorization-server" > /dev/null; then
        echo -e "${GREEN}✅ OAuth endpoint working${NC}"
    else
        echo -e "${RED}❌ OAuth endpoint failed${NC}"
        return 1
    fi
    
    # Test MCP endpoint without secret (should fail)
    echo "Testing MCP endpoint without secret..."
    if curl -s "$SERVICE_URL/mcp" | grep -q "Unauthorized"; then
        echo -e "${GREEN}✅ MCP endpoint properly protected${NC}"
    else
        echo -e "${RED}❌ MCP endpoint not properly protected${NC}"
        return 1
    fi
    
    # Test MCP endpoint with secret (should work)
    echo "Testing MCP endpoint with secret..."
    if curl -s -H "Authorization: Bearer $MCP_SECRET" "$SERVICE_URL/mcp" | grep -q "gcp-mcp"; then
        echo -e "${GREEN}✅ MCP endpoint working with secret${NC}"
    else
        echo -e "${RED}❌ MCP endpoint not working with secret${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All tests passed!${NC}"
}

# Show configuration instructions
show_config_instructions() {
    echo ""
    echo -e "${BLUE}🎉 Deployment Complete!${NC}"
    echo "=================================================="
    echo ""
    echo -e "${YELLOW}📋 Claude Code Configuration:${NC}"
    echo ""
    echo "1. Remove any existing configuration:"
    echo "   claude mcp remove gcp"
    echo ""
    echo "2. Add your MCP server with authentication:"
    echo -e "   ${GREEN}claude mcp add --transport http gcp ${SERVICE_URL}/mcp --header \"Authorization: Bearer ${MCP_SECRET}\"${NC}"
    echo ""
    echo -e "${YELLOW}🔐 Important Security Notes:${NC}"
    echo "• Keep your secret token secure"
    echo "• Don't commit the secret to version control"
    echo "• Rotate the secret regularly"
    echo "• Monitor Cloud Run logs for unauthorized access attempts"
    echo ""
    echo -e "${YELLOW}📊 Monitoring:${NC}"
    echo "• View logs: gcloud run logs tail $SERVICE_NAME --region=$REGION"
    echo "• View metrics: Check Cloud Console -> Cloud Run -> $SERVICE_NAME"
    echo ""
    echo -e "${GREEN}✅ Your secure GCP MCP server is ready to use with Claude Code!${NC}"
}

# Main execution
main() {
    check_tools
    get_config
    generate_secret
    enable_apis
    create_repository
    configure_docker
    build_and_push
    deploy_service
    test_deployment
    show_config_instructions
}

# Run main function
main "$@"