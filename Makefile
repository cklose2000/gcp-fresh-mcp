# Makefile for GCP MCP Server deployment

# Configuration
PROJECT_ID ?= $(shell gcloud config get-value project)
REGION ?= us-central1
SERVICE_NAME ?= mcp-fresh-server
REPOSITORY ?= mcp
IMAGE_TAG ?= $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPOSITORY)/mcp-server:$(shell date +%Y%m%d-%H%M%S)

# Check for required environment variables
check-env:
ifndef MCP_SECRET
	$(error MCP_SECRET is not set. Run: export MCP_SECRET=your-secret-token)
endif

# Install dependencies
install:
	npm install

# Run locally for development
dev:
	npm run dev

# Build Docker image
build:
	docker build -t $(IMAGE_TAG) .

# Push to Artifact Registry
push: build
	docker push $(IMAGE_TAG)

# Deploy to Cloud Run
deploy: check-env push
	gcloud run deploy $(SERVICE_NAME) \
		--image $(IMAGE_TAG) \
		--region $(REGION) \
		--platform managed \
		--allow-unauthenticated \
		--cpu 1 \
		--memory 512Mi \
		--max-instances 10 \
		--timeout 300 \
		--set-env-vars MCP_SECRET=$(MCP_SECRET) \
		--project $(PROJECT_ID)
	@echo "✅ Deployment complete!"
	@echo "🌐 Service URL: $$(gcloud run services describe $(SERVICE_NAME) --region $(REGION) --format 'value(status.url)')"

# Quick deploy (build, push, and deploy in one command)
quick-deploy: deploy

# Show current configuration
config:
	@echo "Current configuration:"
	@echo "  PROJECT_ID: $(PROJECT_ID)"
	@echo "  REGION: $(REGION)"
	@echo "  SERVICE_NAME: $(SERVICE_NAME)"
	@echo "  REPOSITORY: $(REPOSITORY)"
	@echo "  MCP_SECRET: $${MCP_SECRET:0:10}... (hidden)"

# View logs
logs:
	gcloud run logs tail $(SERVICE_NAME) --region=$(REGION)

# Get service URL
url:
	@gcloud run services describe $(SERVICE_NAME) --region $(REGION) --format 'value(status.url)'

# Test the deployment
test:
	@SERVICE_URL=$$(gcloud run services describe $(SERVICE_NAME) --region $(REGION) --format 'value(status.url)'); \
	echo "Testing OAuth endpoint..."; \
	curl -s $$SERVICE_URL/.well-known/oauth-authorization-server | jq . || echo "OAuth test failed"; \
	echo "\nTesting MCP endpoint (should fail without auth)..."; \
	curl -s $$SERVICE_URL/mcp | jq . || echo "Expected failure"; \
	echo "\nTesting MCP endpoint with auth..."; \
	curl -s -H "Authorization: Bearer $(MCP_SECRET)" $$SERVICE_URL/mcp | jq .

# Clean up local Docker images
clean:
	docker image prune -f

# Help
help:
	@echo "Available commands:"
	@echo "  make install       - Install npm dependencies"
	@echo "  make dev          - Run locally for development"
	@echo "  make build        - Build Docker image"
	@echo "  make push         - Push image to Artifact Registry"
	@echo "  make deploy       - Build, push, and deploy to Cloud Run"
	@echo "  make quick-deploy - Alias for deploy"
	@echo "  make config       - Show current configuration"
	@echo "  make logs         - View Cloud Run logs"
	@echo "  make url          - Get service URL"
	@echo "  make test         - Test the deployment"
	@echo "  make clean        - Clean up local Docker images"
	@echo "  make help         - Show this help message"

.PHONY: check-env install dev build push deploy quick-deploy config logs url test clean help
