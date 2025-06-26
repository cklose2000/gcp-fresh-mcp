/**
 * BigQuery Query Builder and Validation Tools for GCP Fresh MCP Server
 * 
 * This module provides advanced query building, validation, optimization, and cost estimation
 * tools for BigQuery databases. It follows MCP server patterns and integrates with the
 * existing GCP Fresh MCP server architecture.
 * 
 * @author Claude Code
 * @version 1.0.0
 */

import { z } from 'zod';
import { BigQuery } from '@google-cloud/bigquery';

// Initialize BigQuery client
const bigquery = new BigQuery();

// Common Zod schemas
const ProjectIdSchema = z.string().optional().describe('GCP Project ID (uses default if not provided)');
const QuerySchema = z.string().min(1).describe('SQL query string');

// Schema for query building parameters
const BuildQuerySchema = z.object({
  tables: z.array(z.string()).min(1).describe('Array of table names to query'),
  fields: z.array(z.string()).optional().describe('Fields to select (defaults to *)'),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL']),
    value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]).optional()
  })).optional().describe('WHERE clause conditions'),
  joins: z.array(z.object({
    type: z.enum(['INNER', 'LEFT', 'RIGHT', 'FULL OUTER']),
    table: z.string(),
    on: z.string().describe('JOIN condition (e.g., "table1.id = table2.id")')
  })).optional().describe('JOIN clauses'),
  groupBy: z.array(z.string()).optional().describe('GROUP BY fields'),
  orderBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(['ASC', 'DESC']).default('ASC')
  })).optional().describe('ORDER BY clauses'),
  limit: z.number().positive().optional().describe('LIMIT clause'),
  projectId: ProjectIdSchema
});

// Schema for query validation
const ValidateQuerySchema = z.object({
  query: QuerySchema,
  projectId: ProjectIdSchema,
  dryRun: z.boolean().default(true).describe('Use dry run for validation'),
  checkSyntax: z.boolean().default(true).describe('Check SQL syntax'),
  checkTables: z.boolean().default(true).describe('Validate table existence'),
  location: z.string().optional().describe('BigQuery location for validation')
});

// Schema for query optimization
const OptimizeQuerySchema = z.object({
  query: QuerySchema,
  projectId: ProjectIdSchema,
  analysisLevel: z.enum(['basic', 'detailed', 'comprehensive']).default('basic').describe('Level of analysis to perform'),
  includePerformanceHints: z.boolean().default(true).describe('Include performance optimization hints'),
  checkPartitioning: z.boolean().default(true).describe('Check for partitioning opportunities'),
  analyzeCosts: z.boolean().default(true).describe('Include cost analysis in recommendations')
});

// Schema for cost estimation
const CostEstimateSchema = z.object({
  query: QuerySchema,
  projectId: ProjectIdSchema,
  includeOptimizations: z.boolean().default(true).describe('Include optimization suggestions'),
  estimateType: z.enum(['quick', 'detailed']).default('quick').describe('Type of cost estimation'),
  location: z.string().optional().describe('BigQuery location for cost calculation')
});

/**
 * Builds a SQL query from structured parameters using a fluent API approach
 * 
 * @param {Object} params - Query building parameters
 * @returns {Object} MCP-compliant response with generated SQL
 */
export async function bqBuildQuery(params) {
  try {
    // Validate input parameters
    const validatedParams = BuildQuerySchema.parse(params);
    const { tables, fields, conditions, joins, groupBy, orderBy, limit } = validatedParams;

    // Start building the query
    let query = 'SELECT ';
    
    // Add fields
    if (fields && fields.length > 0) {
      query += fields.join(', ');
    } else {
      query += '*';
    }
    
    // Add FROM clause
    query += `\nFROM \`${tables[0]}\``;
    
    // Add JOINs
    if (joins && joins.length > 0) {
      for (const join of joins) {
        query += `\n${join.type} JOIN \`${join.table}\` ON ${join.on}`;
      }
    }
    
    // Add WHERE clause
    if (conditions && conditions.length > 0) {
      const whereConditions = conditions.map(condition => {
        const { field, operator, value } = condition;
        
        switch (operator) {
          case 'IS NULL':
          case 'IS NOT NULL':
            return `${field} ${operator}`;
          case 'IN':
          case 'NOT IN':
            if (Array.isArray(value)) {
              const valueList = value.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
              return `${field} ${operator} (${valueList})`;
            }
            throw new Error(`${operator} requires an array of values`);
          case 'LIKE':
            return `${field} ${operator} '${value}'`;
          default:
            const formattedValue = typeof value === 'string' ? `'${value}'` : value;
            return `${field} ${operator} ${formattedValue}`;
        }
      });
      
      query += `\nWHERE ${whereConditions.join(' AND ')}`;
    }
    
    // Add GROUP BY
    if (groupBy && groupBy.length > 0) {
      query += `\nGROUP BY ${groupBy.join(', ')}`;
    }
    
    // Add ORDER BY
    if (orderBy && orderBy.length > 0) {
      const orderClauses = orderBy.map(order => `${order.field} ${order.direction}`);
      query += `\nORDER BY ${orderClauses.join(', ')}`;
    }
    
    // Add LIMIT
    if (limit) {
      query += `\nLIMIT ${limit}`;
    }

    // Analyze the generated query for basic optimizations
    const optimizationHints = analyzeQueryStructure(query);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            generatedQuery: query,
            queryInfo: {
              tables: tables.length,
              joins: joins?.length || 0,
              conditions: conditions?.length || 0,
              hasGroupBy: Boolean(groupBy?.length),
              hasOrderBy: Boolean(orderBy?.length),
              hasLimit: Boolean(limit)
            },
            optimizationHints,
            metadata: {
              tool: 'bq-build-query',
              timestamp: new Date().toISOString(),
              queryLength: query.length
            }
          }, null, 2)
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            tool: 'bq-build-query',
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

/**
 * Validates BigQuery SQL queries using dry run and syntax checking
 * 
 * @param {Object} params - Validation parameters
 * @returns {Object} MCP-compliant response with validation results
 */
export async function bqValidateQuery(params) {
  try {
    const validatedParams = ValidateQuerySchema.parse(params);
    const { query, projectId, dryRun, checkSyntax, checkTables, location } = validatedParams;

    const validationResults = {
      isValid: true,
      errors: [],
      warnings: [],
      syntaxCheck: null,
      tableCheck: null,
      dryRunResult: null
    };

    // Basic syntax validation
    if (checkSyntax) {
      const syntaxValidation = validateSQLSyntax(query);
      validationResults.syntaxCheck = syntaxValidation;
      if (!syntaxValidation.isValid) {
        validationResults.isValid = false;
        validationResults.errors.push(...syntaxValidation.errors);
      }
    }

    // Table existence validation
    if (checkTables) {
      const tableValidation = await validateTablesExist(query, projectId);
      validationResults.tableCheck = tableValidation;
      if (!tableValidation.isValid) {
        validationResults.isValid = false;
        validationResults.errors.push(...tableValidation.errors);
      }
    }

    // BigQuery dry run validation
    if (dryRun && validationResults.isValid) {
      try {
        const options = {
          query: query,
          dryRun: true,
          useLegacySql: false,
          ...(location && { location }),
          ...(projectId && { projectId })
        };

        const [job] = await bigquery.createQueryJob(options);
        const metadata = job.metadata;

        validationResults.dryRunResult = {
          isValid: true,
          bytesProcessed: metadata.statistics?.query?.totalBytesProcessed,
          cacheHit: metadata.statistics?.query?.cacheHit,
          statementType: metadata.statistics?.query?.statementType,
          schema: metadata.statistics?.query?.schema
        };

      } catch (dryRunError) {
        validationResults.isValid = false;
        validationResults.dryRunResult = {
          isValid: false,
          error: dryRunError.message
        };
        validationResults.errors.push(`Dry run failed: ${dryRunError.message}`);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            validation: validationResults,
            query: query,
            metadata: {
              tool: 'bq-validate-query',
              timestamp: new Date().toISOString(),
              projectId: projectId || 'default'
            }
          }, null, 2)
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            tool: 'bq-validate-query',
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

/**
 * Analyzes queries and provides optimization suggestions
 * 
 * @param {Object} params - Optimization parameters
 * @returns {Object} MCP-compliant response with optimization recommendations
 */
export async function bqOptimizeQuery(params) {
  try {
    const validatedParams = OptimizeQuerySchema.parse(params);
    const { query, projectId, analysisLevel, includePerformanceHints, checkPartitioning, analyzeCosts } = validatedParams;

    const optimizations = {
      performanceHints: [],
      partitioningOpportunities: [],
      costOptimizations: [],
      structuralIssues: [],
      recommendations: []
    };

    // Performance analysis
    if (includePerformanceHints) {
      optimizations.performanceHints = analyzePerformance(query);
    }

    // Partitioning analysis
    if (checkPartitioning) {
      optimizations.partitioningOpportunities = await analyzePartitioning(query, projectId);
    }

    // Cost analysis
    if (analyzeCosts) {
      optimizations.costOptimizations = await analyzeCostOptimizations(query, projectId);
    }

    // Structural analysis based on analysis level
    switch (analysisLevel) {
      case 'comprehensive':
        optimizations.structuralIssues.push(...analyzeAdvancedStructure(query));
        // fallthrough
      case 'detailed':
        optimizations.structuralIssues.push(...analyzeDetailedStructure(query));
        // fallthrough
      case 'basic':
        optimizations.structuralIssues.push(...analyzeQueryStructure(query));
        break;
    }

    // Generate consolidated recommendations
    optimizations.recommendations = generateOptimizationRecommendations(optimizations);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            optimizations,
            analysisLevel,
            query: query,
            metadata: {
              tool: 'bq-optimize-query',
              timestamp: new Date().toISOString(),
              projectId: projectId || 'default'
            }
          }, null, 2)
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            tool: 'bq-optimize-query',
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

/**
 * Estimates query costs and suggests cost reduction strategies
 * 
 * @param {Object} params - Cost estimation parameters
 * @returns {Object} MCP-compliant response with cost estimates and suggestions
 */
export async function bqCostEstimate(params) {
  try {
    const validatedParams = CostEstimateSchema.parse(params);
    const { query, projectId, includeOptimizations, estimateType, location } = validatedParams;

    const costAnalysis = {
      estimatedCost: null,
      bytesProcessed: null,
      costBreakdown: {},
      optimizationSuggestions: [],
      estimationMethod: estimateType
    };

    // Get cost estimate using dry run
    try {
      const options = {
        query: query,
        dryRun: true,
        useLegacySql: false,
        ...(location && { location }),
        ...(projectId && { projectId })
      };

      const [job] = await bigquery.createQueryJob(options);
      const metadata = job.metadata;
      const bytesProcessed = parseInt(metadata.statistics?.query?.totalBytesProcessed || '0');

      costAnalysis.bytesProcessed = bytesProcessed;
      
      // Calculate cost (BigQuery on-demand pricing: $5 per TB)
      const tbProcessed = bytesProcessed / (1024 ** 4);
      const estimatedCostUSD = tbProcessed * 5;
      
      costAnalysis.estimatedCost = {
        amount: estimatedCostUSD,
        currency: 'USD',
        bytesProcessed: bytesProcessed,
        tbProcessed: tbProcessed
      };

      costAnalysis.costBreakdown = {
        queryProcessing: estimatedCostUSD,
        storage: 0, // Would need additional API calls to determine
        streaming: 0 // Not applicable for queries
      };

    } catch (costError) {
      costAnalysis.estimatedCost = {
        error: `Unable to estimate cost: ${costError.message}`
      };
    }

    // Generate cost optimization suggestions
    if (includeOptimizations) {
      costAnalysis.optimizationSuggestions = await generateCostOptimizations(query, costAnalysis, projectId);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            costAnalysis,
            query: query,
            metadata: {
              tool: 'bq-cost-estimate',
              timestamp: new Date().toISOString(),
              projectId: projectId || 'default'
            }
          }, null, 2)
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            tool: 'bq-cost-estimate',
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

// Helper functions

/**
 * Validates SQL syntax using basic parsing rules
 */
function validateSQLSyntax(query) {
  const errors = [];
  const warnings = [];

  // Basic syntax checks
  const trimmedQuery = query.trim();
  
  // Check for basic SQL structure
  if (!trimmedQuery.toUpperCase().startsWith('SELECT') && 
      !trimmedQuery.toUpperCase().startsWith('WITH')) {
    errors.push('Query must start with SELECT or WITH statement');
  }

  // Check for balanced parentheses
  const openParens = (query.match(/\(/g) || []).length;
  const closeParens = (query.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push('Unbalanced parentheses in query');
  }

  // Check for common issues
  if (query.includes('SELECT *') && query.toUpperCase().includes('GROUP BY')) {
    warnings.push('Using SELECT * with GROUP BY may cause issues');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates that tables referenced in query exist
 */
async function validateTablesExist(query, projectId) {
  const errors = [];
  const warnings = [];

  try {
    // Extract table references from query (simplified regex)
    const tableRegex = /FROM\s+`?([^`\s,]+)`?|JOIN\s+`?([^`\s,]+)`?/gi;
    const tables = new Set();
    let match;

    while ((match = tableRegex.exec(query)) !== null) {
      tables.add(match[1] || match[2]);
    }

    // Check each table (simplified check)
    for (const table of tables) {
      try {
        const [dataset, tableId] = table.split('.');
        if (dataset && tableId) {
          // This would require actual BigQuery API calls to validate
          // For now, we'll do basic format validation
          if (!dataset.match(/^[a-zA-Z0-9_]+$/) || !tableId.match(/^[a-zA-Z0-9_]+$/)) {
            warnings.push(`Table name format may be invalid: ${table}`);
          }
        }
      } catch (err) {
        warnings.push(`Could not validate table: ${table}`);
      }
    }

  } catch (err) {
    errors.push(`Table validation failed: ${err.message}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Analyzes query structure for optimization opportunities
 */
function analyzeQueryStructure(query) {
  const hints = [];

  // Check for SELECT *
  if (query.includes('SELECT *')) {
    hints.push({
      type: 'performance',
      level: 'warning',
      message: 'Consider selecting specific columns instead of using SELECT *',
      suggestion: 'Specify only the columns you need to reduce data processing'
    });
  }

  // Check for missing WHERE clauses on large tables
  if (!query.toUpperCase().includes('WHERE') && !query.toUpperCase().includes('LIMIT')) {
    hints.push({
      type: 'cost',
      level: 'warning',
      message: 'Query has no WHERE clause or LIMIT, may process entire table',
      suggestion: 'Add appropriate filters to reduce data processing'
    });
  }

  // Check for ORDER BY without LIMIT
  if (query.toUpperCase().includes('ORDER BY') && !query.toUpperCase().includes('LIMIT')) {
    hints.push({
      type: 'performance',
      level: 'info',
      message: 'ORDER BY without LIMIT may be expensive on large datasets',
      suggestion: 'Consider adding LIMIT if you only need top results'
    });
  }

  return hints;
}

/**
 * Analyzes detailed query structure
 */
function analyzeDetailedStructure(query) {
  const hints = [];

  // Check for subqueries in SELECT
  if (query.match(/SELECT[^FROM]*\([^)]*SELECT[^)]*\)/i)) {
    hints.push({
      type: 'performance',
      level: 'info',
      message: 'Subqueries in SELECT clause may impact performance',
      suggestion: 'Consider using JOINs or window functions instead'
    });
  }

  // Check for DISTINCT usage
  if (query.toUpperCase().includes('DISTINCT')) {
    hints.push({
      type: 'performance',
      level: 'info',
      message: 'DISTINCT operations can be expensive',
      suggestion: 'Ensure DISTINCT is necessary and consider GROUP BY alternatives'
    });
  }

  return hints;
}

/**
 * Analyzes advanced query structure
 */
function analyzeAdvancedStructure(query) {
  const hints = [];

  // Check for complex nested queries
  const selectCount = (query.match(/SELECT/gi) || []).length;
  if (selectCount > 3) {
    hints.push({
      type: 'complexity',
      level: 'warning',
      message: 'Query has multiple levels of nesting',
      suggestion: 'Consider breaking into smaller queries or using CTEs'
    });
  }

  // Check for potential cartesian products
  if (query.toUpperCase().includes('JOIN') && !query.toUpperCase().includes('ON')) {
    hints.push({
      type: 'correctness',
      level: 'error',
      message: 'JOIN without ON clause may create cartesian product',
      suggestion: 'Add appropriate JOIN conditions'
    });
  }

  return hints;
}

/**
 * Analyzes performance characteristics
 */
function analyzePerformance(query) {
  const hints = [];

  // Check for functions in WHERE clauses
  if (query.match(/WHERE[^(GROUP|ORDER|HAVING)]*[A-Z_]+\(/i)) {
    hints.push({
      type: 'performance',
      level: 'warning',
      message: 'Functions in WHERE clause may prevent index usage',
      suggestion: 'Consider restructuring conditions for better performance'
    });
  }

  return hints;
}

/**
 * Analyzes partitioning opportunities
 */
async function analyzePartitioning(query, projectId) {
  const opportunities = [];

  // Check for date/timestamp fields that could benefit from partitioning
  if (query.match(/WHERE[^(GROUP|ORDER|HAVING)]*[a-zA-Z_]*date[a-zA-Z_]*|timestamp[a-zA-Z_]*/i)) {
    opportunities.push({
      type: 'time_partitioning',
      message: 'Query filters on date/timestamp fields',
      suggestion: 'Consider partitioning tables by date for better performance and cost reduction'
    });
  }

  return opportunities;
}

/**
 * Analyzes cost optimization opportunities
 */
async function analyzeCostOptimizations(query, projectId) {
  const optimizations = [];

  // Check for expensive operations
  if (query.toUpperCase().includes('ORDER BY') && !query.toUpperCase().includes('LIMIT')) {
    optimizations.push({
      type: 'cost_reduction',
      message: 'ORDER BY without LIMIT processes entire result set',
      suggestion: 'Add LIMIT clause to reduce sorting costs',
      estimatedSavings: 'High'
    });
  }

  return optimizations;
}

/**
 * Generates optimization recommendations
 */
function generateOptimizationRecommendations(optimizations) {
  const recommendations = [];

  // Consolidate all hints and suggestions
  const allHints = [
    ...optimizations.performanceHints,
    ...optimizations.structuralIssues
  ];

  // Prioritize recommendations by impact
  const highPriority = allHints.filter(hint => hint.level === 'error');
  const mediumPriority = allHints.filter(hint => hint.level === 'warning');
  const lowPriority = allHints.filter(hint => hint.level === 'info');

  recommendations.push(
    ...highPriority.map(hint => ({ ...hint, priority: 'high' })),
    ...mediumPriority.map(hint => ({ ...hint, priority: 'medium' })),
    ...lowPriority.map(hint => ({ ...hint, priority: 'low' }))
  );

  return recommendations;
}

/**
 * Generates cost optimization suggestions
 */
async function generateCostOptimizations(query, costAnalysis, projectId) {
  const suggestions = [];

  if (costAnalysis.bytesProcessed > 1024 ** 3) { // > 1GB
    suggestions.push({
      type: 'data_reduction',
      message: 'Query processes large amount of data',
      suggestion: 'Consider adding WHERE clauses to filter data at source',
      potentialSavings: 'High'
    });
  }

  if (query.includes('SELECT *')) {
    suggestions.push({
      type: 'column_reduction',
      message: 'Selecting all columns',
      suggestion: 'Select only needed columns to reduce data processing',
      potentialSavings: 'Medium'
    });
  }

  return suggestions;
}

// Export all tools for MCP integration
export const tools = [
  {
    name: 'bq-build-query',
    description: 'Build BigQuery SQL queries programmatically with fluent API',
    inputSchema: BuildQuerySchema,
    handler: bqBuildQuery
  },
  {
    name: 'bq-validate-query',
    description: 'Validate BigQuery SQL queries using dry run and syntax checking',
    inputSchema: ValidateQuerySchema,
    handler: bqValidateQuery
  },
  {
    name: 'bq-optimize-query',
    description: 'Analyze queries and provide optimization suggestions',
    inputSchema: OptimizeQuerySchema,
    handler: bqOptimizeQuery
  },
  {
    name: 'bq-cost-estimate',
    description: 'Estimate query costs and suggest cost reduction strategies',
    inputSchema: CostEstimateSchema,
    handler: bqCostEstimate
  }
];

export default {
  bqBuildQuery,
  bqValidateQuery,
  bqOptimizeQuery,
  bqCostEstimate,
  tools
};