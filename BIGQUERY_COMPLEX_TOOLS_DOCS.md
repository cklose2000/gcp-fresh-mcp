# BigQuery Complex Query Tools Documentation

## Overview

This documentation covers the 15 new advanced BigQuery tools added to the GCP Fresh MCP server to enable complex query operations, intelligent SQL generation, performance optimization, and automated analytics.

## Table of Contents

1. [Query Builder Tools](#query-builder-tools)
2. [Schema Intelligence Tools](#schema-intelligence-tools)
3. [Advanced Analytics Tools](#advanced-analytics-tools)
4. [Templates & Automation Tools](#templates-automation-tools)
5. [Integration Guide](#integration-guide)
6. [Examples & Use Cases](#examples--use-cases)

---

## Query Builder Tools

### bq-build-query

**Purpose**: Programmatically construct SQL queries using a fluent API approach.

**Parameters**:
- `tables`: Array of table references with aliases
- `fields`: Array of fields to select (supports expressions)
- `conditions`: Array of WHERE conditions with operators
- `joins`: Array of JOIN specifications
- `groupBy`: Array of GROUP BY fields
- `orderBy`: Array of ORDER BY specifications
- `limit`: Result limit
- `projectId`: Optional GCP project ID

**Example**:
```javascript
{
  "tables": [
    { "name": "dataset.orders", "alias": "o" },
    { "name": "dataset.customers", "alias": "c" }
  ],
  "fields": ["c.name", "COUNT(o.id) as order_count", "SUM(o.total) as total_spent"],
  "joins": [{
    "type": "INNER",
    "table": "dataset.customers",
    "alias": "c",
    "on": "o.customer_id = c.id"
  }],
  "conditions": [
    { "field": "o.created_at", "operator": ">=", "value": "2024-01-01" },
    { "field": "o.status", "operator": "IN", "value": ["completed", "shipped"] }
  ],
  "groupBy": ["c.id", "c.name"],
  "orderBy": [{ "field": "total_spent", "direction": "DESC" }],
  "limit": 100
}
```

### bq-validate-query

**Purpose**: Validate SQL syntax and semantics using BigQuery's dry run capability.

**Parameters**:
- `query`: SQL query to validate
- `projectId`: Optional GCP project ID
- `location`: BigQuery location (default: US)
- `dryRun`: Whether to use dry run (default: true)

**Returns**: Validation results with syntax errors, table existence checks, and estimated bytes processed.

### bq-optimize-query

**Purpose**: Analyze queries and provide optimization suggestions.

**Parameters**:
- `query`: SQL query to optimize
- `projectId`: Optional GCP project ID
- `analysisLevel`: "basic", "detailed", or "comprehensive"

**Returns**: Optimization recommendations including:
- Performance hints (SELECT *, subquery usage, etc.)
- Partitioning opportunities
- Cost reduction strategies
- Query restructuring suggestions

### bq-cost-estimate

**Purpose**: Estimate query costs and suggest cost reduction strategies.

**Parameters**:
- `query`: SQL query to estimate
- `projectId`: Optional GCP project ID
- `includeOptimizations`: Include cost optimization suggestions
- `estimationType`: "quick" or "detailed"

**Returns**: Cost estimates with bytes processed, estimated price, and optimization opportunities.

---

## Schema Intelligence Tools

### bq-analyze-schema

**Purpose**: Perform deep schema analysis for optimization opportunities.

**Parameters**:
- `projectId`: GCP project ID
- `datasetId`: BigQuery dataset ID
- `tableId`: BigQuery table ID
- `analysisDepth`: "basic", "intermediate", or "advanced"

**Returns**: Comprehensive schema analysis including:
- Field-level recommendations
- Data quality issues
- Optimization opportunities
- Clustering effectiveness
- Schema complexity metrics

### bq-generate-sql

**Purpose**: Convert natural language descriptions into SQL queries.

**Parameters**:
- `naturalLanguageQuery`: Natural language description
- `projectId`: Optional GCP project ID
- `targetDatasets`: Array of datasets to consider
- `outputFormat`: "standard", "optimized", or "explained"

**Example**:
```javascript
{
  "naturalLanguageQuery": "Show me top 10 customers by total order value last month",
  "targetDatasets": ["sales_data", "customer_data"],
  "outputFormat": "optimized"
}
```

**Returns**: Generated SQL with confidence score and explanation.

### bq-smart-suggest

**Purpose**: Provide intelligent query suggestions based on data patterns.

**Parameters**:
- `projectId`: GCP project ID
- `datasetId`: BigQuery dataset ID
- `queryContext`: Optional context for suggestions
- `suggestionType`: "analytics", "reporting", "exploration", or "optimization"

**Returns**: Relevant query suggestions with:
- Query templates
- Join opportunities
- Aggregation patterns
- Performance insights

### bq-pattern-detector

**Purpose**: Identify optimal query patterns and opportunities.

**Parameters**:
- `projectId`: GCP project ID
- `datasetId`: BigQuery dataset ID
- `analysisScope`: "table", "dataset", or "project"
- `patternTypes`: Array of pattern types to detect

**Returns**: Pattern detection results including:
- Join patterns with confidence scores
- Aggregation opportunities
- Filter patterns
- Materialized view recommendations

---

## Advanced Analytics Tools

### bq-cross-dataset-join

**Purpose**: Build complex queries joining multiple datasets and projects.

**Parameters**:
- `datasets`: Array of dataset configurations
- `joinConfig`: JOIN specifications with conditions
- `outputConfig`: Output options
- `optimizationLevel`: "none", "basic", or "advanced"

**Example**:
```javascript
{
  "datasets": [
    { "projectId": "project1", "datasetId": "sales", "tableId": "orders", "alias": "o" },
    { "projectId": "project2", "datasetId": "inventory", "tableId": "products", "alias": "p" }
  ],
  "joinConfig": {
    "joins": [{
      "type": "INNER",
      "leftAlias": "o",
      "rightAlias": "p",
      "conditions": [{ "left": "o.product_id", "operator": "=", "right": "p.id" }]
    }]
  },
  "optimizationLevel": "advanced"
}
```

### bq-partition-analysis

**Purpose**: Analyze and recommend optimal partitioning strategies.

**Parameters**:
- `projectId`: GCP project ID
- `datasetId`: BigQuery dataset ID
- `tableId`: BigQuery table ID
- `dataProfile`: Optional data profiling options
- `targetQueries`: Sample queries for analysis

**Returns**: Partitioning recommendations with:
- Current effectiveness analysis
- Recommended strategies (time, range, integer)
- Performance impact estimates
- Implementation SQL

### bq-performance-profile

**Purpose**: Analyze query performance and identify bottlenecks.

**Parameters**:
- `query`: SQL query to profile
- `projectId`: Optional GCP project ID
- `profilingOptions`: Profiling configuration
- `historicalAnalysis`: Include historical comparison

**Returns**: Performance profile including:
- Execution metrics
- Bottleneck identification
- Resource usage estimates
- Optimization recommendations

### bq-trend-analysis

**Purpose**: Detect trends and generate trend analysis queries.

**Parameters**:
- `projectId`: GCP project ID
- `datasetId`: BigQuery dataset ID
- `timeColumn`: Time column for analysis
- `analysisWindow`: Time window configuration
- `trendType`: "linear", "exponential", "seasonal", or "decomposition"

**Returns**: Trend analysis results with:
- Detected patterns
- Statistical insights
- Visualization recommendations
- Monitoring queries

---

## Templates & Automation Tools

### bq-template-library

**Purpose**: Access pre-built query templates for common analytics patterns.

**Categories**:
- `reporting`: Daily summaries, cohort analysis
- `etl`: Incremental loads, deduplication
- `data_quality`: Quality checks, validation
- `analytics`: Funnel analysis, time series
- `ml_prep`: Feature engineering, train/test splits

**Parameters**:
- `templateCategory`: Template category
- `useCase`: Specific use case
- `customization`: Template parameters
- `projectContext`: Optional project context

**Example**:
```javascript
{
  "templateCategory": "analytics",
  "useCase": "funnel_analysis",
  "customization": {
    "dataset": "events_data",
    "eventsTable": "user_events",
    "funnelSteps": ["page_view", "add_to_cart", "checkout", "purchase"]
  }
}
```

### bq-query-composer

**Purpose**: Compose complex queries from reusable components.

**Parameters**:
- `components`: Array of query components
- `compositionStrategy`: "union", "join", "subquery", "cte", or "materialized"
- `optimizationLevel`: Optimization level
- `outputFormat`: Output formatting options

**Component Types**:
- `source`: Base data sources
- `transformation`: Data transformations
- `aggregation`: Aggregation logic
- `filter`: Filtering conditions
- `join`: Join operations

### bq-auto-index

**Purpose**: Automatically recommend indexing strategies.

**Parameters**:
- `projectId`: GCP project ID
- `datasetId`: BigQuery dataset ID
- `tableId`: BigQuery table ID
- `queryPatterns`: Sample queries for analysis
- `recommendationType`: "clustering", "partitioning", or "both"
- `costAnalysis`: Include cost analysis

**Returns**: Index recommendations with:
- Clustering column suggestions
- Partitioning strategies
- Implementation scripts
- Cost/benefit analysis

---

## Integration Guide

### Adding Tools to main.js

1. Import the integration module:
```javascript
import { 
  allComplexQueryTools, 
  isComplexQueryTool,
  routeComplexQueryTool
} from './bigquery-complex-tools-integration.js';
```

2. Add tools to the tools/list handler:
```javascript
response.result = {
  tools: [
    ...allBigQueryTools,
    ...allComplexQueryTools,
    // other tools
  ]
};
```

3. Add routing in tools/call handler:
```javascript
if (isComplexQueryTool(toolName)) {
  response.result = await routeComplexQueryTool(toolName, args);
}
```

---

## Examples & Use Cases

### Example 1: Building a Complex Analytics Query

```javascript
// Step 1: Analyze schema
{
  "tool": "bq-analyze-schema",
  "args": {
    "projectId": "my-project",
    "datasetId": "sales",
    "tableId": "transactions",
    "analysisDepth": "advanced"
  }
}

// Step 2: Generate SQL from natural language
{
  "tool": "bq-generate-sql",
  "args": {
    "naturalLanguageQuery": "Find customers who made purchases over $1000 in the last 30 days",
    "targetDatasets": ["sales"],
    "outputFormat": "optimized"
  }
}

// Step 3: Optimize the generated query
{
  "tool": "bq-optimize-query",
  "args": {
    "query": "/* generated SQL */",
    "analysisLevel": "comprehensive"
  }
}
```

### Example 2: ETL Pipeline Development

```javascript
// Step 1: Get incremental load template
{
  "tool": "bq-template-library",
  "args": {
    "templateCategory": "etl",
    "useCase": "incremental_load",
    "customization": {
      "sourceDataset": "staging",
      "targetDataset": "warehouse",
      "updateColumn": "modified_at"
    }
  }
}

// Step 2: Validate the generated ETL query
{
  "tool": "bq-validate-query",
  "args": {
    "query": "/* ETL query */",
    "projectId": "my-project"
  }
}

// Step 3: Estimate costs
{
  "tool": "bq-cost-estimate",
  "args": {
    "query": "/* ETL query */",
    "includeOptimizations": true
  }
}
```

### Example 3: Performance Optimization Workflow

```javascript
// Step 1: Profile query performance
{
  "tool": "bq-performance-profile",
  "args": {
    "query": "SELECT * FROM large_table WHERE date > '2024-01-01'",
    "profilingOptions": {
      "mode": "actual",
      "includeExecutionPlan": true
    }
  }
}

// Step 2: Analyze partitioning opportunities
{
  "tool": "bq-partition-analysis",
  "args": {
    "projectId": "my-project",
    "datasetId": "analytics",
    "tableId": "large_table",
    "targetQueries": ["/* sample queries */"]
  }
}

// Step 3: Get indexing recommendations
{
  "tool": "bq-auto-index",
  "args": {
    "projectId": "my-project",
    "datasetId": "analytics",
    "tableId": "large_table",
    "recommendationType": "both",
    "costAnalysis": true
  }
}
```

---

## Best Practices

1. **Start with Schema Analysis**: Always analyze your schema before building complex queries
2. **Use Templates**: Leverage the template library for common patterns
3. **Validate Before Execution**: Always validate queries, especially generated ones
4. **Monitor Costs**: Use cost estimation tools before running expensive queries
5. **Optimize Iteratively**: Use performance profiling to continuously improve queries
6. **Leverage Natural Language**: Use SQL generation for quick prototyping
7. **Compose Reusable Components**: Build complex queries from tested components

---

## Troubleshooting

### Common Issues

1. **Project ID Not Found**
   - Ensure GOOGLE_CLOUD_PROJECT or GCP_PROJECT environment variable is set
   - Explicitly provide projectId in tool parameters

2. **Schema Analysis Fails**
   - Verify table exists and you have permissions
   - Check if dataset is in the correct location

3. **SQL Generation Produces Incorrect Queries**
   - Provide more specific natural language descriptions
   - Include target dataset information
   - Use the "explained" output format for debugging

4. **Performance Profiling Times Out**
   - Use dry run mode for large queries
   - Reduce the analysis scope
   - Consider sampling the data first

---

## Further Resources

- [BigQuery Best Practices](https://cloud.google.com/bigquery/docs/best-practices)
- [SQL Optimization Guide](https://cloud.google.com/bigquery/docs/best-practices-performance)
- [Cost Optimization](https://cloud.google.com/bigquery/docs/best-practices-costs)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)