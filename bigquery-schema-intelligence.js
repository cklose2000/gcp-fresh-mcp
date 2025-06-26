/**
 * BigQuery Schema Intelligence Tools for GCP Fresh MCP Server
 * 
 * This module provides advanced schema analysis and AI-powered tools for BigQuery databases.
 * It includes deep schema analysis, natural language SQL generation, intelligent query suggestions,
 * and pattern detection capabilities.
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
const DatasetIdSchema = z.string().min(1).describe('BigQuery dataset ID');
const TableIdSchema = z.string().min(1).describe('BigQuery table ID');

// Schema for deep schema analysis
const AnalyzeSchemaSchema = z.object({
  projectId: ProjectIdSchema,
  datasetId: DatasetIdSchema,
  tableId: TableIdSchema,
  analysisDepth: z.enum(['basic', 'intermediate', 'advanced']).default('intermediate').describe('Depth of analysis to perform')
});

// Schema for natural language SQL generation
const GenerateSqlSchema = z.object({
  naturalLanguageQuery: z.string().min(1).describe('Natural language description of the query'),
  projectId: ProjectIdSchema,
  targetDatasets: z.array(z.string()).optional().describe('List of dataset IDs to consider for query generation'),
  outputFormat: z.enum(['standard', 'optimized', 'explained']).default('standard').describe('Output format for generated SQL')
});

// Schema for smart query suggestions
const SmartSuggestSchema = z.object({
  projectId: ProjectIdSchema,
  datasetId: DatasetIdSchema,
  queryContext: z.string().optional().describe('Context or goal for query suggestions'),
  suggestionType: z.enum(['analytics', 'reporting', 'exploration', 'optimization']).default('analytics').describe('Type of suggestions to generate')
});

// Schema for pattern detection
const PatternDetectorSchema = z.object({
  projectId: ProjectIdSchema,
  datasetId: DatasetIdSchema,
  analysisScope: z.enum(['table', 'dataset', 'project']).default('dataset').describe('Scope of pattern analysis'),
  patternTypes: z.array(z.enum(['join', 'aggregation', 'filter', 'partition', 'cluster'])).optional().describe('Specific pattern types to detect')
});

/**
 * Performs deep schema analysis for query optimization
 * 
 * @param {Object} params - Analysis parameters
 * @returns {Object} MCP-compliant response with schema analysis results
 */
export async function bqAnalyzeSchema(params) {
  try {
    const validatedParams = AnalyzeSchemaSchema.parse(params);
    const { projectId, datasetId, tableId, analysisDepth } = validatedParams;

    // Get table metadata
    const table = bigquery.dataset(datasetId, { projectId }).table(tableId);
    const [metadata] = await table.getMetadata();
    
    const analysis = {
      tableInfo: {
        name: tableId,
        dataset: datasetId,
        project: projectId || 'default',
        creationTime: metadata.creationTime,
        lastModifiedTime: metadata.lastModifiedTime,
        numBytes: metadata.numBytes,
        numRows: metadata.numRows,
        type: metadata.type
      },
      schema: {
        fields: [],
        complexity: null,
        depth: 0
      },
      partitioning: null,
      clustering: null,
      optimization: {
        recommendations: [],
        dataQualityIssues: [],
        performanceHints: []
      }
    };

    // Analyze schema structure
    if (metadata.schema && metadata.schema.fields) {
      analysis.schema.fields = analyzeSchemaFields(metadata.schema.fields);
      analysis.schema.complexity = calculateSchemaComplexity(metadata.schema.fields);
      analysis.schema.depth = calculateSchemaDepth(metadata.schema.fields);
    }

    // Analyze partitioning
    if (metadata.timePartitioning || metadata.rangePartitioning) {
      analysis.partitioning = analyzePartitioning(metadata);
    }

    // Analyze clustering
    if (metadata.clustering) {
      analysis.clustering = analyzeClustering(metadata.clustering, analysis.schema.fields);
    }

    // Generate optimization recommendations based on analysis depth
    if (analysisDepth !== 'basic') {
      analysis.optimization = await generateOptimizationRecommendations(
        analysis,
        analysisDepth === 'advanced'
      );
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(analysis, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error analyzing schema: ${error.message}`
      }],
      isError: true
    };
  }
}

/**
 * Generates SQL queries from natural language descriptions
 * 
 * @param {Object} params - Generation parameters
 * @returns {Object} MCP-compliant response with generated SQL
 */
export async function bqGenerateSql(params) {
  try {
    const validatedParams = GenerateSqlSchema.parse(params);
    const { naturalLanguageQuery, projectId, targetDatasets, outputFormat } = validatedParams;

    // Get schema information for target datasets
    let schemaContext = {};
    if (targetDatasets && targetDatasets.length > 0) {
      schemaContext = await gatherSchemaContext(projectId, targetDatasets);
    }

    // Generate SQL based on natural language
    const generatedSql = await generateSqlFromNaturalLanguage(
      naturalLanguageQuery,
      schemaContext,
      outputFormat
    );

    // Validate the generated SQL
    const validation = await validateGeneratedSql(generatedSql.query, projectId);

    const response = {
      query: generatedSql.query,
      confidence: generatedSql.confidence,
      explanation: generatedSql.explanation,
      validation: validation,
      alternatives: generatedSql.alternatives || []
    };

    if (outputFormat === 'optimized' && validation.isValid) {
      // Apply optimizations
      const optimized = await optimizeGeneratedQuery(generatedSql.query, projectId);
      response.optimizedQuery = optimized.query;
      response.optimizations = optimized.appliedOptimizations;
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(response, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error generating SQL: ${error.message}`
      }],
      isError: true
    };
  }
}

/**
 * Provides intelligent query suggestions based on data patterns
 * 
 * @param {Object} params - Suggestion parameters
 * @returns {Object} MCP-compliant response with query suggestions
 */
export async function bqSmartSuggest(params) {
  try {
    const validatedParams = SmartSuggestSchema.parse(params);
    const { projectId, datasetId, queryContext, suggestionType } = validatedParams;

    // Gather dataset metadata
    const dataset = bigquery.dataset(datasetId, { projectId });
    const [tables] = await dataset.getTables();
    
    const suggestions = {
      type: suggestionType,
      context: queryContext || 'general',
      suggestions: []
    };

    // Generate suggestions based on type
    switch (suggestionType) {
      case 'analytics':
        suggestions.suggestions = await generateAnalyticsSuggestions(
          dataset,
          tables,
          queryContext
        );
        break;
      
      case 'reporting':
        suggestions.suggestions = await generateReportingSuggestions(
          dataset,
          tables,
          queryContext
        );
        break;
      
      case 'exploration':
        suggestions.suggestions = await generateExplorationSuggestions(
          dataset,
          tables,
          queryContext
        );
        break;
      
      case 'optimization':
        suggestions.suggestions = await generateOptimizationSuggestions(
          dataset,
          tables,
          queryContext
        );
        break;
    }

    // Add metadata to each suggestion
    suggestions.suggestions = suggestions.suggestions.map((suggestion, index) => ({
      id: `${suggestionType}_${index + 1}`,
      ...suggestion,
      estimatedComplexity: estimateQueryComplexity(suggestion.query),
      requiredTables: extractRequiredTables(suggestion.query)
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify(suggestions, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error generating suggestions: ${error.message}`
      }],
      isError: true
    };
  }
}

/**
 * Detects optimal query patterns and opportunities
 * 
 * @param {Object} params - Pattern detection parameters
 * @returns {Object} MCP-compliant response with detected patterns
 */
export async function bqPatternDetector(params) {
  try {
    const validatedParams = PatternDetectorSchema.parse(params);
    const { projectId, datasetId, analysisScope, patternTypes } = validatedParams;

    const patterns = {
      scope: analysisScope,
      detectedPatterns: [],
      recommendations: []
    };

    // Define pattern types to analyze
    const typesToAnalyze = patternTypes || ['join', 'aggregation', 'filter', 'partition', 'cluster'];

    // Analyze based on scope
    switch (analysisScope) {
      case 'table':
        // Analyze patterns within tables
        const dataset = bigquery.dataset(datasetId, { projectId });
        const [tables] = await dataset.getTables();
        
        for (const table of tables) {
          const tablePatterns = await analyzeTablePatterns(
            table,
            typesToAnalyze
          );
          patterns.detectedPatterns.push(...tablePatterns);
        }
        break;
      
      case 'dataset':
        // Analyze patterns across dataset
        patterns.detectedPatterns = await analyzeDatasetPatterns(
          projectId,
          datasetId,
          typesToAnalyze
        );
        break;
      
      case 'project':
        // Analyze patterns across project
        patterns.detectedPatterns = await analyzeProjectPatterns(
          projectId,
          typesToAnalyze
        );
        break;
    }

    // Generate recommendations based on detected patterns
    patterns.recommendations = generatePatternRecommendations(patterns.detectedPatterns);

    // Add pattern scores and confidence
    patterns.detectedPatterns = patterns.detectedPatterns.map(pattern => ({
      ...pattern,
      confidence: calculatePatternConfidence(pattern),
      impact: estimatePatternImpact(pattern)
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify(patterns, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error detecting patterns: ${error.message}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function analyzeSchemaFields(fields, parentPath = '') {
  const analyzedFields = [];
  
  for (const field of fields) {
    const fieldPath = parentPath ? `${parentPath}.${field.name}` : field.name;
    const analyzedField = {
      name: field.name,
      path: fieldPath,
      type: field.type,
      mode: field.mode || 'NULLABLE',
      description: field.description || '',
      analysis: {
        isNested: field.type === 'RECORD',
        isRepeated: field.mode === 'REPEATED',
        isRequired: field.mode === 'REQUIRED',
        dataTypeEfficiency: assessDataTypeEfficiency(field),
        namingConvention: assessNamingConvention(field.name)
      }
    };

    // Recursively analyze nested fields
    if (field.fields && field.fields.length > 0) {
      analyzedField.nestedFields = analyzeSchemaFields(field.fields, fieldPath);
    }

    analyzedFields.push(analyzedField);
  }

  return analyzedFields;
}

function calculateSchemaComplexity(fields) {
  let complexity = {
    score: 0,
    factors: [],
    level: 'simple' // simple, moderate, complex
  };

  // Count total fields including nested
  const totalFields = countTotalFields(fields);
  if (totalFields > 50) {
    complexity.score += 3;
    complexity.factors.push(`High field count: ${totalFields}`);
  } else if (totalFields > 20) {
    complexity.score += 1;
    complexity.factors.push(`Moderate field count: ${totalFields}`);
  }

  // Check for nested structures
  const nestedDepth = calculateSchemaDepth(fields);
  if (nestedDepth > 3) {
    complexity.score += 3;
    complexity.factors.push(`Deep nesting: ${nestedDepth} levels`);
  } else if (nestedDepth > 1) {
    complexity.score += 1;
    complexity.factors.push(`Nested structures: ${nestedDepth} levels`);
  }

  // Check for repeated fields
  const repeatedCount = countRepeatedFields(fields);
  if (repeatedCount > 5) {
    complexity.score += 2;
    complexity.factors.push(`Multiple repeated fields: ${repeatedCount}`);
  } else if (repeatedCount > 0) {
    complexity.score += 1;
    complexity.factors.push(`Repeated fields: ${repeatedCount}`);
  }

  // Determine complexity level
  if (complexity.score >= 5) {
    complexity.level = 'complex';
  } else if (complexity.score >= 2) {
    complexity.level = 'moderate';
  }

  return complexity;
}

function calculateSchemaDepth(fields, currentDepth = 0) {
  let maxDepth = currentDepth;
  
  for (const field of fields) {
    if (field.fields && field.fields.length > 0) {
      const fieldDepth = calculateSchemaDepth(field.fields, currentDepth + 1);
      maxDepth = Math.max(maxDepth, fieldDepth);
    }
  }
  
  return maxDepth;
}

function analyzePartitioning(metadata) {
  const partitioning = {
    type: null,
    field: null,
    effectiveness: null,
    recommendations: []
  };

  if (metadata.timePartitioning) {
    partitioning.type = 'TIME';
    partitioning.field = metadata.timePartitioning.field || '_PARTITIONTIME';
    partitioning.granularity = metadata.timePartitioning.type;
    partitioning.expirationMs = metadata.timePartitioning.expirationMs;
    
    // Assess effectiveness
    partitioning.effectiveness = assessPartitioningEffectiveness(
      'TIME',
      metadata.numRows,
      metadata.numBytes
    );
  } else if (metadata.rangePartitioning) {
    partitioning.type = 'RANGE';
    partitioning.field = metadata.rangePartitioning.field;
    partitioning.range = metadata.rangePartitioning.range;
    
    // Assess effectiveness
    partitioning.effectiveness = assessPartitioningEffectiveness(
      'RANGE',
      metadata.numRows,
      metadata.numBytes
    );
  }

  // Generate recommendations
  if (!partitioning.type && metadata.numRows > 1000000) {
    partitioning.recommendations.push({
      type: 'ADD_PARTITIONING',
      reason: 'Large table would benefit from partitioning',
      suggestion: 'Consider time-based or integer range partitioning'
    });
  }

  return partitioning;
}

function analyzeClustering(clusteringInfo, schemaFields) {
  const clustering = {
    fields: clusteringInfo.fields,
    effectiveness: null,
    cardinality: {},
    recommendations: []
  };

  // Analyze cardinality of clustering fields
  for (const fieldName of clustering.fields) {
    const field = findFieldByName(schemaFields, fieldName);
    if (field) {
      clustering.cardinality[fieldName] = {
        dataType: field.type,
        isHighCardinality: isHighCardinalityType(field.type),
        recommendation: null
      };

      // Check if field is suitable for clustering
      if (field.type === 'STRING' && clustering.fields.indexOf(fieldName) > 2) {
        clustering.recommendations.push({
          type: 'REORDER_CLUSTERING',
          field: fieldName,
          reason: 'High cardinality STRING fields should be in first 3 clustering columns'
        });
      }
    }
  }

  clustering.effectiveness = assessClusteringEffectiveness(clustering);

  return clustering;
}

async function generateOptimizationRecommendations(analysis, isAdvanced) {
  const recommendations = {
    recommendations: [],
    dataQualityIssues: [],
    performanceHints: []
  };

  // Schema-based recommendations
  if (analysis.schema.complexity.level === 'complex') {
    recommendations.recommendations.push({
      type: 'SCHEMA_SIMPLIFICATION',
      priority: 'medium',
      description: 'Consider flattening deeply nested structures for better query performance',
      impact: 'Can improve query speed by 20-40%'
    });
  }

  // Check for inefficient data types
  for (const field of analysis.schema.fields) {
    if (field.analysis.dataTypeEfficiency === 'inefficient') {
      recommendations.dataQualityIssues.push({
        field: field.name,
        issue: 'Inefficient data type',
        suggestion: getDataTypeSuggestion(field)
      });
    }
  }

  // Partitioning recommendations
  if (!analysis.partitioning.type && analysis.tableInfo.numRows > 1000000) {
    recommendations.performanceHints.push({
      type: 'ADD_PARTITIONING',
      priority: 'high',
      description: 'Large table would benefit from partitioning',
      suggestion: 'Use TIME partitioning on date/timestamp column or INTEGER partitioning on ID column'
    });
  }

  // Clustering recommendations
  if (!analysis.clustering && analysis.tableInfo.numRows > 10000000) {
    recommendations.performanceHints.push({
      type: 'ADD_CLUSTERING',
      priority: 'medium',
      description: 'Very large table would benefit from clustering',
      suggestion: 'Cluster on frequently filtered columns (up to 4 columns)'
    });
  }

  if (isAdvanced) {
    // Advanced analysis - check for materialized view opportunities
    recommendations.recommendations.push({
      type: 'MATERIALIZED_VIEW',
      priority: 'low',
      description: 'Consider creating materialized views for frequently queried aggregations',
      impact: 'Can reduce query costs by 50-90% for aggregate queries'
    });
  }

  return recommendations;
}

async function gatherSchemaContext(projectId, datasetIds) {
  const context = {
    datasets: {},
    relationships: []
  };

  for (const datasetId of datasetIds) {
    try {
      const dataset = bigquery.dataset(datasetId, { projectId });
      const [tables] = await dataset.getTables();
      
      context.datasets[datasetId] = {
        tables: {}
      };

      for (const table of tables.slice(0, 10)) { // Limit to first 10 tables
        const [metadata] = await table.getMetadata();
        if (metadata.schema && metadata.schema.fields) {
          context.datasets[datasetId].tables[table.id] = {
            fields: metadata.schema.fields.map(f => ({
              name: f.name,
              type: f.type,
              mode: f.mode
            })),
            rowCount: metadata.numRows,
            sizeBytes: metadata.numBytes
          };
        }
      }
    } catch (error) {
      console.error(`Error gathering schema for dataset ${datasetId}:`, error);
    }
  }

  // Detect potential relationships
  context.relationships = detectTableRelationships(context.datasets);

  return context;
}

async function generateSqlFromNaturalLanguage(nlQuery, schemaContext, outputFormat) {
  // This is a simplified SQL generation logic
  // In a real implementation, you might use an LLM or more sophisticated NLP
  
  const result = {
    query: '',
    confidence: 0,
    explanation: '',
    alternatives: []
  };

  // Convert to lowercase for pattern matching
  const queryLower = nlQuery.toLowerCase();

  // Detect query intent
  const intent = detectQueryIntent(queryLower);
  
  // Extract entities and conditions
  const entities = extractEntities(nlQuery, schemaContext);
  const conditions = extractConditions(nlQuery);
  const aggregations = extractAggregations(queryLower);

  // Build SQL based on intent
  switch (intent) {
    case 'select':
      result.query = buildSelectQuery(entities, conditions, aggregations, schemaContext);
      result.confidence = 0.8;
      result.explanation = 'Generated SELECT query based on identified entities and conditions';
      break;
    
    case 'aggregate':
      result.query = buildAggregateQuery(entities, conditions, aggregations, schemaContext);
      result.confidence = 0.75;
      result.explanation = 'Generated aggregate query with GROUP BY clause';
      break;
    
    case 'join':
      result.query = buildJoinQuery(entities, conditions, schemaContext);
      result.confidence = 0.7;
      result.explanation = 'Generated JOIN query based on detected relationships';
      break;
    
    default:
      result.query = buildDefaultQuery(entities, schemaContext);
      result.confidence = 0.5;
      result.explanation = 'Generated basic query - intent unclear';
  }

  // Generate alternatives
  if (outputFormat !== 'standard') {
    result.alternatives = generateQueryAlternatives(
      result.query,
      intent,
      entities,
      conditions
    );
  }

  // Add optimization notes for explained format
  if (outputFormat === 'explained') {
    result.breakdown = {
      intent,
      entities,
      conditions,
      aggregations,
      sqlComponents: breakdownSqlComponents(result.query)
    };
  }

  return result;
}

// Additional helper functions...

function assessDataTypeEfficiency(field) {
  // Check if data type is efficient for the expected data
  if (field.type === 'STRING' && field.name.toLowerCase().includes('id')) {
    return 'inefficient'; // IDs should typically be INTEGER
  }
  if (field.type === 'FLOAT64' && field.name.toLowerCase().includes('count')) {
    return 'inefficient'; // Counts should be INTEGER
  }
  return 'efficient';
}

function assessNamingConvention(fieldName) {
  // Check naming conventions
  const conventions = {
    camelCase: /^[a-z][a-zA-Z0-9]*$/.test(fieldName),
    snake_case: /^[a-z][a-z0-9_]*$/.test(fieldName),
    hasSpecialChars: /[^a-zA-Z0-9_]/.test(fieldName)
  };
  
  return conventions;
}

function countTotalFields(fields) {
  let count = fields.length;
  for (const field of fields) {
    if (field.fields) {
      count += countTotalFields(field.fields);
    }
  }
  return count;
}

function countRepeatedFields(fields) {
  let count = 0;
  for (const field of fields) {
    if (field.mode === 'REPEATED') {
      count++;
    }
    if (field.fields) {
      count += countRepeatedFields(field.fields);
    }
  }
  return count;
}

function assessPartitioningEffectiveness(type, numRows, numBytes) {
  const bytesPerRow = numBytes / numRows;
  const effectiveness = {
    score: 0,
    level: 'unknown',
    factors: []
  };

  if (type === 'TIME') {
    if (numRows > 10000000) {
      effectiveness.score = 90;
      effectiveness.factors.push('Large table benefits significantly from time partitioning');
    } else if (numRows > 1000000) {
      effectiveness.score = 70;
      effectiveness.factors.push('Moderate benefits from time partitioning');
    } else {
      effectiveness.score = 30;
      effectiveness.factors.push('Limited benefits due to small table size');
    }
  }

  effectiveness.level = effectiveness.score > 70 ? 'high' : 
                       effectiveness.score > 40 ? 'medium' : 'low';

  return effectiveness;
}

function findFieldByName(fields, name, currentPath = '') {
  for (const field of fields) {
    const fieldPath = currentPath ? `${currentPath}.${field.name}` : field.name;
    if (field.name === name || fieldPath === name) {
      return field;
    }
    if (field.fields) {
      const found = findFieldByName(field.fields, name, fieldPath);
      if (found) return found;
    }
  }
  return null;
}

function isHighCardinalityType(type) {
  return ['STRING', 'BYTES', 'TIMESTAMP', 'DATETIME'].includes(type);
}

function assessClusteringEffectiveness(clustering) {
  const effectiveness = {
    score: 0,
    level: 'unknown',
    recommendations: []
  };

  // Check if clustering fields are in optimal order
  let highCardinalityCount = 0;
  for (const [fieldName, info] of Object.entries(clustering.cardinality)) {
    if (info.isHighCardinality) {
      highCardinalityCount++;
    }
  }

  if (highCardinalityCount > 0 && clustering.fields.length <= 4) {
    effectiveness.score = 80;
    effectiveness.level = 'high';
  } else if (clustering.fields.length > 4) {
    effectiveness.score = 50;
    effectiveness.level = 'medium';
    effectiveness.recommendations.push('Consider reducing clustering columns to 4 or fewer');
  }

  return effectiveness;
}

function getDataTypeSuggestion(field) {
  if (field.type === 'STRING' && field.name.toLowerCase().includes('id')) {
    return `Consider using INT64 instead of STRING for ${field.name}`;
  }
  if (field.type === 'FLOAT64' && field.name.toLowerCase().includes('count')) {
    return `Consider using INT64 instead of FLOAT64 for ${field.name}`;
  }
  return null;
}

function detectTableRelationships(datasets) {
  const relationships = [];
  const tables = [];

  // Flatten all tables
  for (const [datasetId, dataset] of Object.entries(datasets)) {
    for (const [tableId, table] of Object.entries(dataset.tables)) {
      tables.push({
        datasetId,
        tableId,
        fields: table.fields
      });
    }
  }

  // Look for potential foreign key relationships
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const table1 = tables[i];
      const table2 = tables[j];

      // Check for matching field names that might indicate relationships
      for (const field1 of table1.fields) {
        for (const field2 of table2.fields) {
          if (isPotentialRelationship(field1, field2, table1.tableId, table2.tableId)) {
            relationships.push({
              from: `${table1.datasetId}.${table1.tableId}.${field1.name}`,
              to: `${table2.datasetId}.${table2.tableId}.${field2.name}`,
              type: 'potential_foreign_key',
              confidence: calculateRelationshipConfidence(field1, field2)
            });
          }
        }
      }
    }
  }

  return relationships;
}

function isPotentialRelationship(field1, field2, table1Name, table2Name) {
  // Check if field names suggest a relationship
  if (field1.name === `${table2Name}_id` || field2.name === `${table1Name}_id`) {
    return true;
  }
  if (field1.name === field2.name && field1.name.includes('_id')) {
    return true;
  }
  return false;
}

function calculateRelationshipConfidence(field1, field2) {
  let confidence = 0.5;
  
  // Same data type increases confidence
  if (field1.type === field2.type) {
    confidence += 0.2;
  }
  
  // Matching names increase confidence
  if (field1.name === field2.name) {
    confidence += 0.2;
  }
  
  // ID suffix increases confidence
  if (field1.name.endsWith('_id') && field2.name.endsWith('_id')) {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

function detectQueryIntent(query) {
  if (query.includes('sum') || query.includes('count') || query.includes('average') || 
      query.includes('total') || query.includes('group by')) {
    return 'aggregate';
  }
  if (query.includes('join') || query.includes('combine') || query.includes('merge')) {
    return 'join';
  }
  if (query.includes('trend') || query.includes('over time') || query.includes('timeline')) {
    return 'timeseries';
  }
  return 'select';
}

function extractEntities(nlQuery, schemaContext) {
  const entities = [];
  
  // Extract table references
  for (const [datasetId, dataset] of Object.entries(schemaContext.datasets)) {
    for (const tableId of Object.keys(dataset.tables)) {
      if (nlQuery.toLowerCase().includes(tableId.toLowerCase())) {
        entities.push({
          type: 'table',
          dataset: datasetId,
          name: tableId
        });
      }
    }
  }
  
  return entities;
}

function extractConditions(nlQuery) {
  const conditions = [];
  
  // Simple pattern matching for common conditions
  const patterns = [
    { regex: /where\s+(\w+)\s*=\s*['"]?([^'"]+)['"]?/i, type: 'equals' },
    { regex: /(\w+)\s+greater\s+than\s+(\d+)/i, type: 'greater_than' },
    { regex: /(\w+)\s+less\s+than\s+(\d+)/i, type: 'less_than' },
    { regex: /between\s+['"]?([^'"]+)['"]?\s+and\s+['"]?([^'"]+)['"]?/i, type: 'between' },
    { regex: /last\s+(\d+)\s+(days?|months?|years?)/i, type: 'time_range' }
  ];
  
  for (const pattern of patterns) {
    const match = nlQuery.match(pattern.regex);
    if (match) {
      conditions.push({
        type: pattern.type,
        matches: match.slice(1)
      });
    }
  }
  
  return conditions;
}

function extractAggregations(query) {
  const aggregations = [];
  
  const aggPatterns = {
    'sum': 'SUM',
    'total': 'SUM',
    'count': 'COUNT',
    'average': 'AVG',
    'avg': 'AVG',
    'maximum': 'MAX',
    'max': 'MAX',
    'minimum': 'MIN',
    'min': 'MIN'
  };
  
  for (const [pattern, sqlFunc] of Object.entries(aggPatterns)) {
    if (query.includes(pattern)) {
      aggregations.push(sqlFunc);
    }
  }
  
  return [...new Set(aggregations)];
}

function buildSelectQuery(entities, conditions, aggregations, schemaContext) {
  if (entities.length === 0) {
    return '-- Unable to identify tables from query';
  }
  
  const table = entities[0];
  const tableRef = `\`${table.dataset}.${table.name}\``;
  
  let query = `SELECT `;
  
  // Add fields
  if (aggregations.length > 0) {
    query += aggregations.map(agg => `${agg}(*) as ${agg.toLowerCase()}_value`).join(', ');
  } else {
    query += '*';
  }
  
  query += `\nFROM ${tableRef}`;
  
  // Add conditions
  if (conditions.length > 0) {
    query += '\nWHERE ';
    query += buildWhereClause(conditions);
  }
  
  return query;
}

function buildAggregateQuery(entities, conditions, aggregations, schemaContext) {
  if (entities.length === 0) {
    return '-- Unable to identify tables from query';
  }
  
  const table = entities[0];
  const tableRef = `\`${table.dataset}.${table.name}\``;
  const tableInfo = schemaContext.datasets[table.dataset].tables[table.name];
  
  // Find dimension fields (non-numeric fields)
  const dimensionFields = tableInfo.fields
    .filter(f => !['INT64', 'FLOAT64', 'NUMERIC'].includes(f.type))
    .slice(0, 2)
    .map(f => f.name);
  
  let query = 'SELECT ';
  
  // Add dimensions
  if (dimensionFields.length > 0) {
    query += dimensionFields.join(', ') + ',\n  ';
  }
  
  // Add aggregations
  const metricFields = tableInfo.fields
    .filter(f => ['INT64', 'FLOAT64', 'NUMERIC'].includes(f.type))
    .map(f => f.name);
  
  if (aggregations.length > 0 && metricFields.length > 0) {
    query += aggregations.map(agg => 
      `${agg}(${metricFields[0]}) as ${agg.toLowerCase()}_${metricFields[0]}`
    ).join(',\n  ');
  } else {
    query += 'COUNT(*) as record_count';
  }
  
  query += `\nFROM ${tableRef}`;
  
  // Add conditions
  if (conditions.length > 0) {
    query += '\nWHERE ' + buildWhereClause(conditions);
  }
  
  // Add GROUP BY
  if (dimensionFields.length > 0) {
    query += '\nGROUP BY ' + dimensionFields.join(', ');
  }
  
  return query;
}

function buildJoinQuery(entities, conditions, schemaContext) {
  if (entities.length < 2) {
    return buildSelectQuery(entities, conditions, [], schemaContext);
  }
  
  const table1 = entities[0];
  const table2 = entities[1];
  
  let query = 'SELECT t1.*, t2.*\nFROM ';
  query += `\`${table1.dataset}.${table1.name}\` t1\n`;
  query += `INNER JOIN \`${table2.dataset}.${table2.name}\` t2\n`;
  
  // Try to find join condition
  const relationships = schemaContext.relationships.filter(r => 
    (r.from.includes(table1.name) && r.to.includes(table2.name)) ||
    (r.from.includes(table2.name) && r.to.includes(table1.name))
  );
  
  if (relationships.length > 0) {
    const rel = relationships[0];
    query += `  ON ${rel.from.split('.').pop()} = ${rel.to.split('.').pop()}`;
  } else {
    query += '  ON t1.id = t2.id -- Update join condition';
  }
  
  // Add conditions
  if (conditions.length > 0) {
    query += '\nWHERE ' + buildWhereClause(conditions);
  }
  
  return query;
}

function buildDefaultQuery(entities, schemaContext) {
  if (entities.length === 0) {
    return '-- Please specify table name in your query';
  }
  
  const table = entities[0];
  return `SELECT *\nFROM \`${table.dataset}.${table.name}\`\nLIMIT 100`;
}

function buildWhereClause(conditions) {
  const clauses = [];
  
  for (const condition of conditions) {
    switch (condition.type) {
      case 'equals':
        clauses.push(`${condition.matches[0]} = '${condition.matches[1]}'`);
        break;
      case 'greater_than':
        clauses.push(`${condition.matches[0]} > ${condition.matches[1]}`);
        break;
      case 'less_than':
        clauses.push(`${condition.matches[0]} < ${condition.matches[1]}`);
        break;
      case 'between':
        clauses.push(`date_column BETWEEN '${condition.matches[0]}' AND '${condition.matches[1]}'`);
        break;
      case 'time_range':
        const amount = condition.matches[0];
        const unit = condition.matches[1].toUpperCase().replace(/S$/, '');
        clauses.push(`date_column >= DATE_SUB(CURRENT_DATE(), INTERVAL ${amount} ${unit})`);
        break;
    }
  }
  
  return clauses.join(' AND ');
}

function generateQueryAlternatives(baseQuery, intent, entities, conditions) {
  const alternatives = [];
  
  // Add LIMIT if not present
  if (!baseQuery.includes('LIMIT')) {
    alternatives.push({
      query: baseQuery + '\nLIMIT 1000',
      description: 'Added LIMIT clause for safety'
    });
  }
  
  // Add ORDER BY for aggregate queries
  if (intent === 'aggregate' && !baseQuery.includes('ORDER BY')) {
    const orderQuery = baseQuery + '\nORDER BY 2 DESC';
    alternatives.push({
      query: orderQuery,
      description: 'Added ORDER BY to sort results'
    });
  }
  
  return alternatives;
}

function breakdownSqlComponents(query) {
  return {
    selectClause: query.match(/SELECT[\s\S]*?FROM/i)?.[0] || '',
    fromClause: query.match(/FROM[\s\S]*?(?:WHERE|GROUP BY|ORDER BY|LIMIT|$)/i)?.[0] || '',
    whereClause: query.match(/WHERE[\s\S]*?(?:GROUP BY|ORDER BY|LIMIT|$)/i)?.[0] || '',
    groupByClause: query.match(/GROUP BY[\s\S]*?(?:ORDER BY|LIMIT|$)/i)?.[0] || '',
    orderByClause: query.match(/ORDER BY[\s\S]*?(?:LIMIT|$)/i)?.[0] || '',
    limitClause: query.match(/LIMIT\s+\d+/i)?.[0] || ''
  };
}

async function validateGeneratedSql(query, projectId) {
  try {
    const options = {
      query: query,
      dryRun: true,
      useLegacySql: false
    };

    const [job] = await bigquery.createQueryJob(options);
    
    return {
      isValid: true,
      estimatedBytes: job.metadata.statistics?.query?.estimatedBytesProcessed || 0,
      referencedTables: job.metadata.statistics?.query?.referencedTables || []
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message,
      errorLocation: error.location || null
    };
  }
}

async function optimizeGeneratedQuery(query, projectId) {
  // This is a simplified optimization
  const optimizations = [];
  let optimizedQuery = query;
  
  // Remove SELECT * if present
  if (query.includes('SELECT *')) {
    optimizedQuery = optimizedQuery.replace('SELECT *', 'SELECT /* specify needed columns */');
    optimizations.push('Replaced SELECT * with column specification placeholder');
  }
  
  // Add partition filter if missing
  if (!query.includes('_PARTITIONTIME') && !query.includes('_PARTITIONDATE')) {
    optimizations.push('Consider adding partition filter for better performance');
  }
  
  return {
    query: optimizedQuery,
    appliedOptimizations: optimizations
  };
}

// Analytics suggestions functions
async function generateAnalyticsSuggestions(dataset, tables, context) {
  const suggestions = [];
  
  // Time series analysis
  suggestions.push({
    title: 'Time Series Analysis',
    description: 'Analyze trends over time',
    query: `
-- Time series analysis template
SELECT 
  DATE_TRUNC(timestamp_column, MONTH) as period,
  COUNT(*) as event_count,
  AVG(metric_column) as avg_metric
FROM \`${dataset.id}.your_table\`
WHERE timestamp_column >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
GROUP BY period
ORDER BY period DESC`,
    useCase: 'Track metrics evolution over time'
  });
  
  // Cohort analysis
  suggestions.push({
    title: 'Cohort Analysis',
    description: 'Analyze user behavior by cohort',
    query: `
-- Cohort retention analysis
WITH cohorts AS (
  SELECT 
    user_id,
    DATE_TRUNC(first_seen_date, MONTH) as cohort_month
  FROM \`${dataset.id}.users\`
)
SELECT 
  cohort_month,
  COUNT(DISTINCT user_id) as cohort_size,
  COUNT(DISTINCT CASE WHEN active_in_month = cohort_month THEN user_id END) as month_0,
  COUNT(DISTINCT CASE WHEN active_in_month = DATE_ADD(cohort_month, INTERVAL 1 MONTH) THEN user_id END) as month_1
FROM cohorts
JOIN \`${dataset.id}.user_activity\` USING(user_id)
GROUP BY cohort_month
ORDER BY cohort_month`,
    useCase: 'Measure user retention by signup cohort'
  });
  
  return suggestions;
}

// Reporting suggestions functions
async function generateReportingSuggestions(dataset, tables, context) {
  const suggestions = [];
  
  // Daily summary report
  suggestions.push({
    title: 'Daily Summary Report',
    description: 'Key metrics summary by day',
    query: `
-- Daily business metrics summary
SELECT 
  DATE(timestamp_column) as report_date,
  COUNT(DISTINCT user_id) as daily_active_users,
  COUNT(*) as total_events,
  SUM(revenue) as daily_revenue,
  AVG(session_duration) as avg_session_duration
FROM \`${dataset.id}.events\`
WHERE DATE(timestamp_column) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY report_date
ORDER BY report_date DESC`,
    useCase: 'Executive dashboard daily metrics'
  });
  
  // Top performers report
  suggestions.push({
    title: 'Top Performers Report',
    description: 'Identify top performing entities',
    query: `
-- Top performing products/categories
SELECT 
  category,
  product_name,
  COUNT(*) as transaction_count,
  SUM(amount) as total_revenue,
  AVG(amount) as avg_transaction_value
FROM \`${dataset.id}.transactions\`
WHERE DATE(transaction_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY category, product_name
ORDER BY total_revenue DESC
LIMIT 20`,
    useCase: 'Identify best performing products or categories'
  });
  
  return suggestions;
}

// Exploration suggestions functions
async function generateExplorationSuggestions(dataset, tables, context) {
  const suggestions = [];
  
  // Data distribution exploration
  suggestions.push({
    title: 'Data Distribution Analysis',
    description: 'Explore data distributions and patterns',
    query: `
-- Analyze distribution of key metrics
SELECT 
  APPROX_QUANTILES(metric_column, 100) as percentiles,
  AVG(metric_column) as mean_value,
  STDDEV(metric_column) as std_deviation,
  MIN(metric_column) as min_value,
  MAX(metric_column) as max_value
FROM \`${dataset.id}.your_table\``,
    useCase: 'Understand data distribution and identify outliers'
  });
  
  // Correlation analysis
  suggestions.push({
    title: 'Correlation Analysis',
    description: 'Find correlations between metrics',
    query: `
-- Correlation analysis between metrics
SELECT 
  CORR(metric1, metric2) as correlation_coefficient,
  COUNT(*) as sample_size,
  AVG(metric1) as avg_metric1,
  AVG(metric2) as avg_metric2
FROM \`${dataset.id}.your_table\`
WHERE metric1 IS NOT NULL AND metric2 IS NOT NULL`,
    useCase: 'Discover relationships between different metrics'
  });
  
  return suggestions;
}

// Optimization suggestions functions
async function generateOptimizationSuggestions(dataset, tables, context) {
  const suggestions = [];
  
  // Query performance optimization
  suggestions.push({
    title: 'Optimize Large Table Scans',
    description: 'Use partitioning and clustering effectively',
    query: `
-- Optimized query with partition pruning
SELECT 
  column1,
  column2,
  AGG_FUNCTION(metric) as aggregated_metric
FROM \`${dataset.id}.large_table\`
WHERE _PARTITIONDATE BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND CURRENT_DATE()
  AND clustering_column = 'specific_value'
GROUP BY column1, column2`,
    useCase: 'Reduce query costs on large partitioned tables'
  });
  
  // Materialized view suggestion
  suggestions.push({
    title: 'Materialized View Candidate',
    description: 'Create materialized view for repeated aggregations',
    query: `
-- Create materialized view for frequent aggregations
CREATE MATERIALIZED VIEW \`${dataset.id}.daily_aggregates\`
PARTITION BY DATE(date_column)
CLUSTER BY category
AS
SELECT 
  DATE(timestamp_column) as date_column,
  category,
  COUNT(*) as event_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM \`${dataset.id}.raw_events\`
GROUP BY date_column, category`,
    useCase: 'Pre-aggregate data for faster queries and lower costs'
  });
  
  return suggestions;
}

function estimateQueryComplexity(query) {
  let complexity = 'simple';
  let score = 0;
  
  // Check for JOINs
  if (query.match(/JOIN/gi)) {
    score += (query.match(/JOIN/gi).length * 2);
  }
  
  // Check for subqueries
  if (query.includes('(SELECT')) {
    score += 3;
  }
  
  // Check for window functions
  if (query.match(/OVER\s*\(/gi)) {
    score += 3;
  }
  
  // Check for CTEs
  if (query.match(/WITH\s+\w+\s+AS/gi)) {
    score += 2;
  }
  
  if (score >= 5) complexity = 'complex';
  else if (score >= 2) complexity = 'moderate';
  
  return complexity;
}

function extractRequiredTables(query) {
  const tables = [];
  
  // Extract table references from FROM and JOIN clauses
  const tableRegex = /(?:FROM|JOIN)\s+`?([^`\s]+\.[^`\s]+)`?/gi;
  let match;
  
  while ((match = tableRegex.exec(query)) !== null) {
    tables.push(match[1]);
  }
  
  return [...new Set(tables)];
}

// Pattern detection functions
async function analyzeTablePatterns(table, patternTypes) {
  const patterns = [];
  const [metadata] = await table.getMetadata();
  
  if (patternTypes.includes('partition') && metadata.timePartitioning) {
    patterns.push({
      type: 'partition',
      table: table.id,
      details: {
        field: metadata.timePartitioning.field,
        type: metadata.timePartitioning.type,
        recommendation: 'Table is already partitioned'
      }
    });
  }
  
  if (patternTypes.includes('cluster') && metadata.clustering) {
    patterns.push({
      type: 'cluster',
      table: table.id,
      details: {
        fields: metadata.clustering.fields,
        recommendation: 'Table is already clustered'
      }
    });
  }
  
  return patterns;
}

async function analyzeDatasetPatterns(projectId, datasetId, patternTypes) {
  const patterns = [];
  const dataset = bigquery.dataset(datasetId, { projectId });
  const [tables] = await dataset.getTables();
  
  // Analyze join patterns
  if (patternTypes.includes('join')) {
    const joinPatterns = await detectJoinPatterns(tables);
    patterns.push(...joinPatterns);
  }
  
  // Analyze aggregation patterns
  if (patternTypes.includes('aggregation')) {
    const aggPatterns = detectAggregationPatterns(tables);
    patterns.push(...aggPatterns);
  }
  
  return patterns;
}

async function analyzeProjectPatterns(projectId, patternTypes) {
  // Simplified implementation - would analyze across all datasets
  return [{
    type: 'project_wide',
    pattern: 'cross_dataset_joins',
    recommendation: 'Consider consolidating related tables into same dataset for better performance'
  }];
}

async function detectJoinPatterns(tables) {
  const patterns = [];
  
  // Look for common join patterns based on table names and schemas
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const table1 = tables[i];
      const table2 = tables[j];
      
      // Check if tables might be related
      if (areTablesRelated(table1.id, table2.id)) {
        patterns.push({
          type: 'join',
          tables: [table1.id, table2.id],
          pattern: 'potential_relationship',
          details: {
            confidence: 0.7,
            suggestedJoinType: 'INNER JOIN',
            recommendation: `Consider joining ${table1.id} with ${table2.id}`
          }
        });
      }
    }
  }
  
  return patterns;
}

function areTablesRelated(table1Name, table2Name) {
  // Simple heuristic - check for common prefixes or suffixes
  const commonPatterns = ['fact_', 'dim_', '_details', '_summary'];
  
  for (const pattern of commonPatterns) {
    if (table1Name.includes(pattern) || table2Name.includes(pattern)) {
      // Check if they share a common base name
      const base1 = table1Name.replace(pattern, '');
      const base2 = table2Name.replace(pattern, '');
      if (base1 === base2 || table1Name.includes(base2) || table2Name.includes(base1)) {
        return true;
      }
    }
  }
  
  return false;
}

function detectAggregationPatterns(tables) {
  const patterns = [];
  
  // Look for tables that might benefit from aggregation
  for (const table of tables) {
    if (table.id.includes('raw') || table.id.includes('events') || table.id.includes('logs')) {
      patterns.push({
        type: 'aggregation',
        table: table.id,
        pattern: 'raw_data_aggregation_opportunity',
        details: {
          recommendation: `Consider creating aggregated views for ${table.id}`,
          suggestedAggregations: ['daily_summary', 'hourly_metrics', 'user_aggregates']
        }
      });
    }
  }
  
  return patterns;
}

function generatePatternRecommendations(patterns) {
  const recommendations = [];
  
  // Group patterns by type
  const patternsByType = patterns.reduce((acc, pattern) => {
    if (!acc[pattern.type]) acc[pattern.type] = [];
    acc[pattern.type].push(pattern);
    return acc;
  }, {});
  
  // Generate recommendations for each type
  for (const [type, typePatterns] of Object.entries(patternsByType)) {
    switch (type) {
      case 'join':
        if (typePatterns.length > 3) {
          recommendations.push({
            type: 'data_model',
            priority: 'high',
            description: 'Multiple join patterns detected - consider creating a unified data model',
            action: 'Create views or materialized views to simplify common join patterns'
          });
        }
        break;
      
      case 'aggregation':
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          description: 'Raw data tables identified for potential aggregation',
          action: 'Create scheduled queries to maintain aggregated tables'
        });
        break;
      
      case 'partition':
        const unpartitionedCount = patterns.filter(p => 
          p.type === 'partition' && !p.details.recommendation.includes('already')
        ).length;
        if (unpartitionedCount > 0) {
          recommendations.push({
            type: 'cost_optimization',
            priority: 'high',
            description: `${unpartitionedCount} tables could benefit from partitioning`,
            action: 'Implement time-based or integer range partitioning'
          });
        }
        break;
    }
  }
  
  return recommendations;
}

function calculatePatternConfidence(pattern) {
  // Base confidence on pattern type and details
  let confidence = 0.5;
  
  if (pattern.details && pattern.details.confidence) {
    confidence = pattern.details.confidence;
  } else {
    // Calculate based on pattern characteristics
    if (pattern.type === 'join' && pattern.tables && pattern.tables.length === 2) {
      confidence = 0.7;
    } else if (pattern.type === 'aggregation' && pattern.pattern === 'raw_data_aggregation_opportunity') {
      confidence = 0.8;
    }
  }
  
  return confidence;
}

function estimatePatternImpact(pattern) {
  // Estimate the potential impact of implementing the pattern
  const impact = {
    performance: 'low',
    cost: 'low',
    complexity: 'low'
  };
  
  switch (pattern.type) {
    case 'partition':
      impact.performance = 'high';
      impact.cost = 'high';
      break;
    
    case 'cluster':
      impact.performance = 'medium';
      impact.cost = 'medium';
      break;
    
    case 'join':
      impact.performance = 'medium';
      impact.complexity = 'medium';
      break;
    
    case 'aggregation':
      impact.performance = 'high';
      impact.cost = 'medium';
      impact.complexity = 'low';
      break;
  }
  
  return impact;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const schemaIntelligenceTools = [
  {
    name: "bq-analyze-schema",
    description: "Perform deep schema analysis for optimization opportunities",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "GCP Project ID (optional)" },
        datasetId: { type: "string", description: "BigQuery dataset ID" },
        tableId: { type: "string", description: "BigQuery table ID" },
        analysisDepth: { 
          type: "string", 
          enum: ["basic", "intermediate", "advanced"],
          description: "Depth of analysis to perform" 
        }
      },
      required: ["datasetId", "tableId"]
    }
  },
  {
    name: "bq-generate-sql",
    description: "Generate SQL queries from natural language descriptions",
    inputSchema: {
      type: "object",
      properties: {
        naturalLanguageQuery: { type: "string", description: "Natural language query description" },
        projectId: { type: "string", description: "GCP Project ID (optional)" },
        targetDatasets: { 
          type: "array", 
          items: { type: "string" },
          description: "Dataset IDs to consider" 
        },
        outputFormat: { 
          type: "string", 
          enum: ["standard", "optimized", "explained"],
          description: "Output format for generated SQL" 
        }
      },
      required: ["naturalLanguageQuery"]
    }
  },
  {
    name: "bq-smart-suggest",
    description: "Get intelligent query suggestions based on data patterns",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "GCP Project ID" },
        datasetId: { type: "string", description: "BigQuery dataset ID" },
        queryContext: { type: "string", description: "Context for suggestions" },
        suggestionType: { 
          type: "string", 
          enum: ["analytics", "reporting", "exploration", "optimization"],
          description: "Type of suggestions to generate" 
        }
      },
      required: ["datasetId"]
    }
  },
  {
    name: "bq-pattern-detector",
    description: "Detect optimal query patterns and opportunities",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "GCP Project ID" },
        datasetId: { type: "string", description: "BigQuery dataset ID" },
        analysisScope: { 
          type: "string", 
          enum: ["table", "dataset", "project"],
          description: "Scope of pattern analysis" 
        },
        patternTypes: { 
          type: "array", 
          items: { 
            type: "string",
            enum: ["join", "aggregation", "filter", "partition", "cluster"]
          },
          description: "Pattern types to detect" 
        }
      },
      required: ["datasetId"]
    }
  }
];