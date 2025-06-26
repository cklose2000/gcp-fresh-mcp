# BigQuery Tools Integration Guide for main.js

This document provides the integration code needed to add the new BigQuery tools to main.js following the MCP protocol requirements from issue #2.

## Prerequisites

Ensure these files are in place:
- `bigquery-schemas.js` - Zod schemas for parameter validation
- `bigquery-tools.js` - Tool definitions with kebab-case naming
- `bigquery-handlers.js` - Handler functions for MCP integration
- `bigquery-enhanced.js` - Enhanced BigQuery functions (already exists)

## Required Imports

Add these imports to the top of main.js:

```javascript
// Add these imports to main.js after existing imports
import { allBigQueryTools, BIGQUERY_TOOL_COUNT } from './bigquery-tools.js';
import { 
  routeBigQueryTool, 
  isBigQueryTool, 
  getBigQueryToolNames,
  createTextResponse,
  createErrorResponse
} from './bigquery-handlers.js';
```

## 1. Tool Registration (ListToolsRequestSchema Handler)

Find the existing ListToolsRequestSchema handler in main.js and add BigQuery tools to the tools array:

```javascript
// In the ListToolsRequestSchema handler, find where tools are returned
// Add this code to include BigQuery tools in the response

if (method === "tools/list") {
  // Existing tools (keep as-is)
  const existingTools = [
    // ... your existing GCS, Compute, Cloud Run tools
  ];
  
  // Add BigQuery tools
  const allTools = [
    ...existingTools,
    ...allBigQueryTools
  ];
  
  response.result = { tools: allTools };
  
  // Optional: Log tool count for verification
  console.log(`Total tools registered: ${allTools.length} (includes ${BIGQUERY_TOOL_COUNT} BigQuery tools)`);
}
```

## 2. Tool Execution (CallToolRequestSchema Handler)

Find the existing CallToolRequestSchema handler and add BigQuery tool routing:

```javascript
// In the CallToolRequestSchema handler, add BigQuery routing
if (method === "tools/call") {
  const { name: toolName, arguments: args } = params;
  
  try {
    // Check if it's a BigQuery tool
    if (isBigQueryTool(toolName)) {
      const result = await routeBigQueryTool(toolName, args);
      response.result = result;
    }
    // Existing tool routing (keep as-is)
    else if (toolName.startsWith("gcs_")) {
      // ... existing GCS tool handling
    }
    else if (toolName.startsWith("compute_")) {
      // ... existing Compute tool handling
    }
    else if (toolName.startsWith("run_")) {
      // ... existing Cloud Run tool handling
    }
    else {
      // Unknown tool
      response.error = {
        code: -32601,
        message: `Unknown tool: ${toolName}`
      };
    }
  } catch (error) {
    console.error(`Tool execution error for ${toolName}:`, error);
    response.error = {
      code: -32603,
      message: error.message || "Internal server error"
    };
  }
}
```

## 3. Optional: Tool Discovery Endpoint

Add a new endpoint for tool discovery (optional but helpful for debugging):

```javascript
// Add this new endpoint after existing endpoints
app.get('/tools/bigquery', (req, res) => {
  res.json({
    count: BIGQUERY_TOOL_COUNT,
    tools: getBigQueryToolNames(),
    categories: {
      'Jobs API & Async Operations': 4,
      'Session Management': 2,
      'Stored Procedures & Scripts': 2,
      'Data Operations': 4,
      'Schema & Metadata': 2,
      'Legacy Tools': 4
    }
  });
});
```

## 4. Error Handling Enhancement

Ensure proper error handling for BigQuery tools:

```javascript
// In your error handling section, you can add specific BigQuery error handling
function handleToolError(toolName, error) {
  // Log the error
  console.error(`Error in ${toolName}:`, error);
  
  // Return appropriate MCP error response
  if (error.message.includes('Invalid parameters')) {
    return {
      code: -32602,
      message: `Invalid parameters for ${toolName}: ${error.message}`
    };
  } else if (error.message.includes('No project selected')) {
    return {
      code: -32603,
      message: 'No GCP project selected. Please select a project first.'
    };
  } else {
    return {
      code: -32603,
      message: `${toolName} execution failed: ${error.message}`
    };
  }
}
```

## 5. Health Check Enhancement

Update your health check endpoint to include BigQuery tool status:

```javascript
// In your health check endpoint (/health or similar)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    tools: {
      total: 'X', // your total count
      bigquery: BIGQUERY_TOOL_COUNT,
      gcs: 'X', // your GCS tool count
      compute: 'X', // your compute tool count
      // ... other tool counts
    },
    bigquery_tools: getBigQueryToolNames()
  });
});
```

## 6. Environment Variables

Ensure these environment variables are available for BigQuery tools:

```javascript
// These should be set in your .env file or deployment environment
const requiredEnvVars = [
  'GOOGLE_CLOUD_PROJECT',  // or GCP_PROJECT_ID
  'GOOGLE_APPLICATION_CREDENTIALS', // for service account auth
  'MCP_SECRET' // for MCP authentication
];

// Optional: Add environment validation
function validateEnvironment() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
  }
}
```

## 7. Logging Enhancement

Add logging for BigQuery tool usage:

```javascript
// Add this logging function
function logToolUsage(toolName, success, duration) {
  console.log(`[${new Date().toISOString()}] Tool: ${toolName}, Success: ${success}, Duration: ${duration}ms`);
}

// Use in your tool execution code
const startTime = Date.now();
try {
  const result = await routeBigQueryTool(toolName, args);
  logToolUsage(toolName, true, Date.now() - startTime);
  response.result = result;
} catch (error) {
  logToolUsage(toolName, false, Date.now() - startTime);
  throw error;
}
```

## Complete Integration Example

Here's how the key sections of main.js should look after integration:

```javascript
// === IMPORTS ===
import express from 'express';
import { BigQuery } from '@google-cloud/bigquery';
// ... other existing imports
import { allBigQueryTools, BIGQUERY_TOOL_COUNT } from './bigquery-tools.js';
import { routeBigQueryTool, isBigQueryTool } from './bigquery-handlers.js';

// === MCP HANDLER ===
app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  const response = { jsonrpc: "2.0", id: req.body.id };

  try {
    if (method === "tools/list") {
      const allTools = [
        ...existingGCSTools,
        ...existingComputeTools,
        ...existingCloudRunTools,
        ...allBigQueryTools  // ADD THIS LINE
      ];
      response.result = { tools: allTools };
      
    } else if (method === "tools/call") {
      const { name: toolName, arguments: args } = params;
      
      if (isBigQueryTool(toolName)) {  // ADD THIS BLOCK
        const result = await routeBigQueryTool(toolName, args);
        response.result = result;
      } else if (toolName.startsWith("gcs_")) {
        // ... existing GCS handling
      } else if (toolName.startsWith("compute_")) {
        // ... existing Compute handling
      } else {
        response.error = { code: -32601, message: `Unknown tool: ${toolName}` };
      }
    }
    
    res.json(response);
  } catch (error) {
    response.error = { code: -32603, message: error.message };
    res.json(response);
  }
});
```

## Testing the Integration

After implementing these changes:

1. **Restart your server**
2. **Test tool discovery**: Call the `/mcp` endpoint with `tools/list` method
3. **Verify BigQuery tools are listed**: Look for tools starting with `bq-`
4. **Test a simple tool**: Try `bq-list-datasets` or `bq-query` with a simple query
5. **Check logs**: Verify no errors in server logs
6. **Test from Claude Desktop**: Use the MCP server in Claude Desktop to test BigQuery functionality

## Verification Checklist

- [ ] All 18+ BigQuery tools appear in tools/list response
- [ ] Tool names use kebab-case (e.g., `bq-create-query-job`)
- [ ] Parameter validation works (test with invalid parameters)
- [ ] Error handling returns proper MCP error responses
- [ ] Project context is automatically applied when not provided
- [ ] Retry logic works for transient failures
- [ ] Response format is consistent with MCP protocol

This completes the MCP protocol integration for all BigQuery tools, making them accessible through Claude Desktop and other MCP clients!