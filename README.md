# GCP Fresh MCP Server

A Model Context Protocol (MCP) server designed for Google Cloud Platform deployment with built-in OAuth flow support for Claude Code integration.

## Overview

This MCP server implements a dummy OAuth authentication flow that satisfies Claude Code's requirements while providing a simple, extensible framework for adding custom tools. It's designed to be deployed on Google Cloud Run and includes a working example with an echo tool.

## Features

- **OAuth Flow Support**: Implements a complete OAuth flow to satisfy Claude Code's authentication requirements
- **JSON-RPC 2.0 Compliant**: Properly formatted responses for MCP protocol compatibility
- **Cloud Run Ready**: Designed for easy deployment on Google Cloud Platform
- **Extensible**: Simple framework for adding custom tools
- **Example Tool**: Includes a working "echo" tool for testing

## Prerequisites

- Google Cloud SDK (`gcloud`) installed and configured
- A Google Cloud Project with billing enabled
- Docker (handled by Cloud Build)
- Claude Code CLI installed locally

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/cklose2000/gcp-fresh-mcp.git
cd gcp-fresh-mcp
```

### 2. Deploy to Google Cloud Run

Set your configuration:
```bash
TAG=1.0.0
PROJECT=$(gcloud config get-value project)
REGION=us-central1  # or your preferred region
```

Build and deploy:
```bash
# Build the container
gcloud builds submit . \
  --tag $REGION-docker.pkg.dev/$PROJECT/mcp/mcp-server:$TAG

# Deploy to Cloud Run
gcloud run deploy mcp-fresh-server \
  --image $REGION-docker.pkg.dev/$PROJECT/mcp/mcp-server:$TAG \
  --region $REGION \
  --cpu 1 --memory 512Mi \
  --allow-unauthenticated
```

### 3. Configure Claude Code

After deployment, note your service URL from the output. Configure Claude Code:

```bash
# Remove any existing configuration
claude mcp remove gcp 2>/dev/null || true

# Add the MCP server
claude mcp add --transport http gcp YOUR_SERVICE_URL/mcp
```

Replace `YOUR_SERVICE_URL` with the URL from your Cloud Run deployment (e.g., `https://mcp-fresh-server-655704941376.us-central1.run.app`).

### 4. Connect in Claude Code

1. Start Claude Code: `claude`
2. You'll see an authentication prompt - a browser window will open
3. The OAuth flow will automatically complete
4. Your MCP server should show as connected!

## How It Works

### OAuth Flow

The server implements a dummy OAuth flow that:
1. Provides OAuth discovery metadata at `/.well-known/oauth-authorization-server`
2. Handles client registration at `/register`
3. Immediately redirects authorization requests with a dummy code
4. Returns a dummy token for all token requests

This satisfies Claude Code's OAuth requirements without requiring actual authentication.

### MCP Protocol

The server implements the MCP protocol with:
- **Handshake**: Returns server metadata at `/mcp` (GET)
- **JSON-RPC Handler**: Processes MCP requests at `/mcp` (POST)
- **Initialize**: Responds with server capabilities
- **Tools**: Lists available tools and executes tool calls

## Adding Custom Tools

To add your own tools, modify the `main.js` file:

1. Add your tool to the `tools/list` response:
```javascript
} else if (method === "tools/list") {
  response.result = {
    tools: [{
      name: "your_tool_name",
      description: "What your tool does",
      inputSchema: {
        type: "object",
        properties: {
          param1: { 
            type: "string",
            description: "Parameter description"
          }
        },
        required: ["param1"]
      }
    }]
  };
}
```

2. Handle the tool execution in `tools/call`:
```javascript
} else if (method === "tools/call") {
  const toolName = params?.name;
  const args = params?.arguments;
  
  if (toolName === "your_tool_name") {
    // Your tool logic here
    response.result = {
      content: [{
        type: "text",
        text: `Result: ${args.param1}`
      }]
    };
  }
}
```

## Monitoring

View logs from your deployed service:
```bash
gcloud run services logs read mcp-fresh-server --region $REGION --limit 50
```

## Troubleshooting

### "Authentication Failed" in Claude Code
1. Clear authentication: Select option 2 in Claude Code
2. Check logs for errors
3. Ensure the service URL ends with `/mcp`

### Browser doesn't open for authentication
This is common in environments without a GUI. Copy the URL shown and open it manually in any browser.

### Connection succeeds but tools don't work
Check that your tool responses follow the JSON-RPC 2.0 format with proper `result` fields.

## Development

To run locally for development:

```bash
npm install
PORT=8080 node main.js
```

Then use ngrok or similar to expose your local server for testing with Claude Code.

## Architecture

```
┌─────────────┐     OAuth Flow    ┌──────────────┐
│             │ ←─────────────────→│              │
│ Claude Code │                    │  MCP Server  │
│             │ ←─────────────────→│ (Cloud Run)  │
└─────────────┘    JSON-RPC 2.0    └──────────────┘
                   over HTTP
```

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

Built with [FastMCP](https://github.com/elyxium-labs/fastmcp) for initial experimentation, though the final implementation uses Express.js directly for better control over the OAuth flow.