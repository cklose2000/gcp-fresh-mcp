/**
 * BigQuery Complex Query Tools Integration for GCP Fresh MCP
 * 
 * This file integrates all the new complex query tools into the MCP server
 * and provides the necessary exports and handlers.
 */

// Import all the new tool modules
import { queryBuilderTools } from './bigquery-query-builder.js';
import { schemaIntelligenceTools } from './bigquery-schema-intelligence.js';
import { advancedAnalyticsTools } from './bigquery-advanced-analytics.js';
import { templateAutomationTools } from './bigquery-templates-automation.js';

// Import individual tool functions
import {
  bqBuildQuery,
  bqValidateQuery,
  bqOptimizeQuery,
  bqCostEstimate
} from './bigquery-query-builder.js';

import {
  bqAnalyzeSchema,
  bqGenerateSql,
  bqSmartSuggest,
  bqPatternDetector
} from './bigquery-schema-intelligence.js';

import {
  bqCrossDatasetJoin,
  bqPartitionAnalysis,
  bqPerformanceProfile,
  bqTrendAnalysis
} from './bigquery-advanced-analytics.js';

import {
  bqTemplateLibrary,
  bqQueryComposer,
  bqAutoIndex
} from './bigquery-templates-automation.js';

// Combine all tools into a single array
export const allComplexQueryTools = [
  ...queryBuilderTools,
  ...schemaIntelligenceTools,
  ...advancedAnalyticsTools,
  ...templateAutomationTools
];

// Create a map of all tool functions for easy routing
export const complexQueryToolHandlers = {
  'bq-build-query': bqBuildQuery,
  'bq-validate-query': bqValidateQuery,
  'bq-optimize-query': bqOptimizeQuery,
  'bq-cost-estimate': bqCostEstimate,
  'bq-analyze-schema': bqAnalyzeSchema,
  'bq-generate-sql': bqGenerateSql,
  'bq-smart-suggest': bqSmartSuggest,
  'bq-pattern-detector': bqPatternDetector,
  'bq-cross-dataset-join': bqCrossDatasetJoin,
  'bq-partition-analysis': bqPartitionAnalysis,
  'bq-performance-profile': bqPerformanceProfile,
  'bq-trend-analysis': bqTrendAnalysis,
  'bq-template-library': bqTemplateLibrary,
  'bq-query-composer': bqQueryComposer,
  'bq-auto-index': bqAutoIndex
};

// Check if a tool is a complex query tool
export function isComplexQueryTool(toolName) {
  return toolName in complexQueryToolHandlers;
}

// Route complex query tool calls
export async function routeComplexQueryTool(toolName, args) {
  const handler = complexQueryToolHandlers[toolName];
  if (!handler) {
    throw new Error(`Unknown complex query tool: ${toolName}`);
  }
  
  try {
    // Ensure project context if needed
    if (args && !args.projectId && typeof args === 'object') {
      // Import getProjectId from main utilities if available
      // For now, we'll check environment variables
      args.projectId = args.projectId || 
                      process.env.GOOGLE_CLOUD_PROJECT || 
                      process.env.GCP_PROJECT;
    }
    
    return await handler(args);
  } catch (error) {
    console.error(`Error in complex query tool ${toolName}:`, error);
    return {
      content: [{
        type: "text",
        text: `Error executing ${toolName}: ${error.message}`
      }]
    };
  }
}

// Get list of complex query tool names
export function getComplexQueryToolNames() {
  return Object.keys(complexQueryToolHandlers);
}

// Get tool count
export const COMPLEX_QUERY_TOOL_COUNT = allComplexQueryTools.length;

// Integration instructions for main.js
export const INTEGRATION_INSTRUCTIONS = `
/**
 * Integration Instructions for main.js
 * 
 * Add these imports at the top of main.js:
 */

import { 
  allComplexQueryTools, 
  COMPLEX_QUERY_TOOL_COUNT,
  isComplexQueryTool,
  routeComplexQueryTool,
  getComplexQueryToolNames
} from './bigquery-complex-tools-integration.js';

/**
 * In the tools/list handler, add the complex query tools:
 */

// Existing code:
response.result = {
  tools: [
    ...allBigQueryTools,
    // Add this line:
    ...allComplexQueryTools,
    // Keep existing tools like echo
    {
      name: "echo",
      // ...
    }
  ]
};

/**
 * In the tools/call handler, add routing for complex query tools:
 */

// After checking for BigQuery tools:
if (isBigQueryTool(toolName)) {
  response.result = await routeBigQueryTool(toolName, args);
} 
// Add this new condition:
else if (isComplexQueryTool(toolName)) {
  response.result = await routeComplexQueryTool(toolName, args);
}
else if (toolName === "echo") {
  // existing echo implementation
}

/**
 * Update the server startup message to reflect new tools:
 */

console.log(\`✅ GCP MCP server on port \${PORT}\`);
console.log("Enhanced BigQuery capabilities: Jobs API, Sessions, Stored Procedures, Data Loading, and more!");
console.log(\`Advanced Complex Query Tools: \${COMPLEX_QUERY_TOOL_COUNT} new tools for query building, analysis, and optimization!\`);
console.log("Available tools: BigQuery (30+ tools), Cloud Storage, Compute Engine, Cloud Run, and more!");
`;

// Test function to verify all tools are properly exported
export function verifyComplexQueryTools() {
  const issues = [];
  
  // Check that all tools have handlers
  allComplexQueryTools.forEach(tool => {
    if (!complexQueryToolHandlers[tool.name]) {
      issues.push(`Missing handler for tool: ${tool.name}`);
    }
  });
  
  // Check that all handlers are functions
  Object.entries(complexQueryToolHandlers).forEach(([name, handler]) => {
    if (typeof handler !== 'function') {
      issues.push(`Handler for ${name} is not a function`);
    }
  });
  
  // Check tool count
  if (allComplexQueryTools.length !== 15) {
    issues.push(`Expected 15 tools, found ${allComplexQueryTools.length}`);
  }
  
  return {
    success: issues.length === 0,
    issues: issues,
    toolCount: allComplexQueryTools.length,
    toolNames: getComplexQueryToolNames()
  };
}

// Export summary for documentation
export const COMPLEX_QUERY_TOOLS_SUMMARY = {
  categories: {
    'Query Building': [
      'bq-build-query',
      'bq-validate-query', 
      'bq-optimize-query',
      'bq-cost-estimate'
    ],
    'Schema Intelligence': [
      'bq-analyze-schema',
      'bq-generate-sql',
      'bq-smart-suggest',
      'bq-pattern-detector'
    ],
    'Advanced Analytics': [
      'bq-cross-dataset-join',
      'bq-partition-analysis',
      'bq-performance-profile',
      'bq-trend-analysis'
    ],
    'Templates & Automation': [
      'bq-template-library',
      'bq-query-composer',
      'bq-auto-index'
    ]
  },
  totalTools: 15,
  description: 'Advanced BigQuery tools for complex query operations, intelligent SQL generation, performance optimization, and automated analytics'
};