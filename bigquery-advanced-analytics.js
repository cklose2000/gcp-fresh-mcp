/**
 * BigQuery Advanced Analytics Tools for GCP Fresh MCP Server
 * 
 * This module provides advanced analytics and cross-dataset tools for BigQuery including
 * cross-dataset operations, partitioning analysis, performance profiling, and trend detection.
 * It integrates with the BigQuery Jobs API and follows MCP server patterns.
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

// Schema for cross-dataset join operations
const CrossDatasetJoinSchema = z.object({
  datasets: z.array(z.object({
    projectId: z.string().optional(),
    datasetId: z.string(),
    tableId: z.string(),
    alias: z.string().optional()
  })).min(2).describe('Array of datasets/tables to join'),
  joinConfig: z.object({
    joins: z.array(z.object({
      leftTable: z.string().describe('Alias or full table reference'),
      rightTable: z.string().describe('Alias or full table reference'),
      joinType: z.enum(['INNER', 'LEFT', 'RIGHT', 'FULL OUTER', 'CROSS']),
      conditions: z.array(z.object({
        leftField: z.string(),
        rightField: z.string(),
        operator: z.enum(['=', '!=', '>', '<', '>=', '<=']).default('=')
      }))
    })).describe('Join configurations'),
    selectFields: z.array(z.string()).optional().describe('Fields to select (default: all)'),
    whereConditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.any()
    })).optional(),
    groupBy: z.array(z.string()).optional(),
    orderBy: z.array(z.object({
      field: z.string(),
      direction: z.enum(['ASC', 'DESC']).default('ASC')
    })).optional(),
    limit: z.number().positive().optional()
  }).describe('Join query configuration'),
  outputConfig: z.object({
    destinationDataset: z.string().optional(),
    destinationTable: z.string().optional(),
    writeDisposition: z.enum(['WRITE_TRUNCATE', 'WRITE_APPEND', 'WRITE_EMPTY']).optional(),
    createDisposition: z.enum(['CREATE_IF_NEEDED', 'CREATE_NEVER']).optional()
  }).optional().describe('Output configuration for results'),
  optimizationLevel: z.enum(['none', 'basic', 'advanced']).default('basic').describe('Query optimization level')
});

// Schema for partition analysis
const PartitionAnalysisSchema = z.object({
  projectId: ProjectIdSchema,
  datasetId: z.string().describe('Dataset to analyze'),
  tableId: z.string().describe('Table to analyze'),
  dataProfile: z.object({
    sampleSize: z.number().optional().describe('Number of rows to sample for analysis'),
    timeColumn: z.string().optional().describe('Time column for temporal analysis'),
    includeStatistics: z.boolean().default(true).describe('Include detailed statistics')
  }).optional().describe('Data profiling options'),
  targetQueries: z.array(z.string()).optional().describe('Sample queries to optimize for')
});

// Schema for performance profiling
const PerformanceProfileSchema = z.object({
  query: z.string().describe('SQL query to analyze'),
  projectId: ProjectIdSchema,
  profilingOptions: z.object({
    executionMode: z.enum(['dry_run', 'actual_run']).default('dry_run'),
    includeExecutionPlan: z.boolean().default(true),
    includeResourceMetrics: z.boolean().default(true),
    includeOptimizationHints: z.boolean().default(true),
    timeout: z.number().optional().describe('Query timeout in milliseconds')
  }).optional().describe('Profiling configuration'),
  historicalAnalysis: z.object({
    enabled: z.boolean().default(false),
    lookbackDays: z.number().default(7),
    compareWithBaseline: z.boolean().default(true)
  }).optional().describe('Historical performance comparison')
});

// Schema for trend analysis
const TrendAnalysisSchema = z.object({
  projectId: ProjectIdSchema,
  datasetId: z.string().describe('Dataset containing time-series data'),
  timeColumn: z.string().describe('Column containing time values'),
  analysisWindow: z.object({
    start: z.string().optional().describe('Start date (ISO format)'),
    end: z.string().optional().describe('End date (ISO format)'),
    granularity: z.enum(['HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR']).default('DAY'),
    lookbackPeriods: z.number().optional().describe('Number of periods to analyze')
  }).describe('Time window for analysis'),
  trendType: z.enum(['linear', 'exponential', 'seasonal', 'decomposition', 'all']).default('all').describe('Type of trend analysis'),
  metrics: z.array(z.object({
    field: z.string(),
    aggregation: z.enum(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STDDEV'])
  })).optional().describe('Metrics to analyze for trends'),
  groupBy: z.array(z.string()).optional().describe('Dimensions to group by')
});

/**
 * Performs complex multi-dataset JOIN operations with optimization
 * 
 * @param {Object} params - Cross-dataset join parameters
 * @returns {Object} MCP-compliant response with generated query and results
 */
export async function bqCrossDatasetJoin(params) {
  try {
    const validatedParams = CrossDatasetJoinSchema.parse(params);
    const { datasets, joinConfig, outputConfig, optimizationLevel } = validatedParams;

    // Build table references with aliases
    const tableReferences = buildTableReferences(datasets);
    
    // Analyze join complexity and optimization opportunities
    const joinAnalysis = analyzeJoinComplexity(datasets, joinConfig.joins);
    
    // Generate optimized cross-dataset query
    const query = buildCrossDatasetQuery(tableReferences, joinConfig, optimizationLevel);
    
    // Apply optimization strategies
    const optimizedQuery = optimizationLevel !== 'none' 
      ? applyJoinOptimizations(query, joinAnalysis, optimizationLevel)
      : query;
    
    // Execute or prepare the query
    const executionPlan = await analyzeExecutionPlan(optimizedQuery, datasets[0].projectId);
    
    // Handle output configuration if specified
    const outputDetails = outputConfig 
      ? prepareOutputConfiguration(outputConfig)
      : null;

    const result = {
      generatedQuery: optimizedQuery,
      joinAnalysis: {
        tablesInvolved: datasets.length,
        joinComplexity: joinAnalysis.complexity,
        estimatedCost: joinAnalysis.estimatedCost,
        optimizationsApplied: joinAnalysis.optimizations
      },
      executionPlan,
      performanceEstimate: {
        estimatedBytesProcessed: executionPlan.bytesProcessed,
        estimatedSlotMilliseconds: executionPlan.slotMilliseconds,
        cacheEligible: executionPlan.cacheEligible
      },
      ...(outputDetails && { outputConfiguration: outputDetails })
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            result,
            metadata: {
              tool: 'bq-cross-dataset-join',
              timestamp: new Date().toISOString(),
              optimizationLevel
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
            tool: 'bq-cross-dataset-join',
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

/**
 * Analyzes table partitioning and recommends optimal strategies
 * 
 * @param {Object} params - Partition analysis parameters
 * @returns {Object} MCP-compliant response with partitioning recommendations
 */
export async function bqPartitionAnalysis(params) {
  try {
    const validatedParams = PartitionAnalysisSchema.parse(params);
    const { projectId, datasetId, tableId, dataProfile, targetQueries } = validatedParams;

    // Get current table metadata and partitioning info
    const table = bigquery.dataset(datasetId, { projectId }).table(tableId);
    const [metadata] = await table.getMetadata();
    
    // Analyze current partitioning effectiveness
    const currentPartitioning = analyzeCurrentPartitioning(metadata);
    
    // Profile data distribution
    const dataDistribution = await profileDataDistribution(
      projectId, 
      datasetId, 
      tableId, 
      dataProfile
    );
    
    // Analyze query patterns from target queries
    const queryPatterns = targetQueries 
      ? analyzeQueryPatterns(targetQueries)
      : null;
    
    // Generate partitioning recommendations
    const recommendations = generatePartitioningRecommendations(
      metadata,
      dataDistribution,
      queryPatterns,
      currentPartitioning
    );
    
    // Estimate performance impact
    const performanceImpact = estimatePartitioningImpact(
      metadata,
      recommendations,
      dataDistribution
    );

    const result = {
      currentPartitioning: {
        isPartitioned: Boolean(currentPartitioning),
        type: currentPartitioning?.type,
        field: currentPartitioning?.field,
        effectiveness: currentPartitioning?.effectiveness
      },
      dataProfile: {
        totalRows: metadata.numRows,
        totalBytes: metadata.numBytes,
        distribution: dataDistribution,
        cardinality: dataDistribution.cardinality
      },
      recommendations: recommendations.map(rec => ({
        strategy: rec.strategy,
        type: rec.type,
        field: rec.field,
        reason: rec.reason,
        estimatedImprovement: rec.estimatedImprovement,
        implementationSQL: rec.implementationSQL
      })),
      performanceImpact: {
        estimatedQuerySpeedup: performanceImpact.querySpeedup,
        estimatedCostReduction: performanceImpact.costReduction,
        storageOverhead: performanceImpact.storageOverhead
      },
      ...(queryPatterns && { queryAnalysis: queryPatterns })
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            result,
            metadata: {
              tool: 'bq-partition-analysis',
              timestamp: new Date().toISOString(),
              tableAnalyzed: `${datasetId}.${tableId}`
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
            tool: 'bq-partition-analysis',
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

/**
 * Profiles query performance and identifies bottlenecks
 * 
 * @param {Object} params - Performance profiling parameters
 * @returns {Object} MCP-compliant response with performance analysis
 */
export async function bqPerformanceProfile(params) {
  try {
    const validatedParams = PerformanceProfileSchema.parse(params);
    const { query, projectId, profilingOptions, historicalAnalysis } = validatedParams;

    let performanceMetrics = {};
    let executionStats = null;
    let queryPlan = null;

    if (profilingOptions?.executionMode === 'actual_run') {
      // Execute query with profiling enabled
      const jobConfig = {
        query: query,
        useLegacySql: false,
        ...(projectId && { projectId }),
        ...(profilingOptions?.timeout && { timeoutMs: profilingOptions.timeout })
      };

      const [job] = await bigquery.createQueryJob(jobConfig);
      await job.promise();
      const [metadata] = await job.getMetadata();
      
      executionStats = extractExecutionStatistics(metadata);
      queryPlan = metadata.statistics?.query?.queryPlan;
    } else {
      // Dry run for analysis
      const [job] = await bigquery.createQueryJob({
        query: query,
        dryRun: true,
        useLegacySql: false,
        ...(projectId && { projectId })
      });

      const metadata = job.metadata;
      executionStats = {
        estimatedBytesProcessed: metadata.statistics?.query?.totalBytesProcessed,
        estimatedSlotMilliseconds: metadata.statistics?.query?.totalSlotMs,
        statementType: metadata.statistics?.query?.statementType
      };
    }

    // Analyze query structure for bottlenecks
    const bottlenecks = identifyQueryBottlenecks(query, queryPlan);
    
    // Generate optimization recommendations
    const optimizations = generatePerformanceOptimizations(
      query,
      executionStats,
      bottlenecks
    );
    
    // Historical comparison if enabled
    let historicalComparison = null;
    if (historicalAnalysis?.enabled) {
      historicalComparison = await compareWithHistoricalPerformance(
        query,
        executionStats,
        historicalAnalysis
      );
    }

    const result = {
      executionStatistics: executionStats,
      bottlenecks: bottlenecks.map(b => ({
        type: b.type,
        severity: b.severity,
        location: b.location,
        description: b.description,
        impact: b.impact
      })),
      optimizationRecommendations: optimizations.map(opt => ({
        category: opt.category,
        priority: opt.priority,
        recommendation: opt.recommendation,
        estimatedImprovement: opt.estimatedImprovement,
        implementation: opt.implementation
      })),
      queryComplexity: {
        estimatedComplexity: calculateQueryComplexity(query),
        subqueries: countSubqueries(query),
        joins: countJoins(query),
        aggregations: countAggregations(query)
      },
      ...(profilingOptions?.includeResourceMetrics && {
        resourceMetrics: {
          estimatedCPUTime: executionStats.estimatedSlotMilliseconds,
          estimatedMemoryUsage: estimateMemoryUsage(query, executionStats),
          parallelizationLevel: estimateParallelization(queryPlan)
        }
      }),
      ...(historicalComparison && { historicalAnalysis: historicalComparison })
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            result,
            metadata: {
              tool: 'bq-performance-profile',
              timestamp: new Date().toISOString(),
              profilingMode: profilingOptions?.executionMode || 'dry_run'
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
            tool: 'bq-performance-profile',
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

/**
 * Detects trends and patterns in time-series data
 * 
 * @param {Object} params - Trend analysis parameters
 * @returns {Object} MCP-compliant response with trend insights
 */
export async function bqTrendAnalysis(params) {
  try {
    const validatedParams = TrendAnalysisSchema.parse(params);
    const { projectId, datasetId, timeColumn, analysisWindow, trendType, metrics, groupBy } = validatedParams;

    // Build time series queries based on analysis type
    const queries = buildTrendAnalysisQueries(
      datasetId,
      timeColumn,
      analysisWindow,
      trendType,
      metrics,
      groupBy
    );
    
    // Execute trend analysis queries
    const trendResults = await executeTrendQueries(queries, projectId);
    
    // Perform statistical analysis
    const statisticalAnalysis = performStatisticalAnalysis(trendResults, trendType);
    
    // Detect patterns and anomalies
    const patterns = detectTemporalPatterns(trendResults, analysisWindow);
    
    // Generate trend insights
    const insights = generateTrendInsights(
      statisticalAnalysis,
      patterns,
      trendType
    );
    
    // Generate visualization recommendations
    const visualizations = recommendVisualizations(
      trendType,
      patterns,
      metrics
    );
    
    // Generate SQL for ongoing monitoring
    const monitoringQueries = generateMonitoringQueries(
      datasetId,
      timeColumn,
      insights,
      metrics
    );

    const result = {
      trendAnalysis: {
        type: trendType,
        window: analysisWindow,
        dataPoints: trendResults.length,
        timeRange: {
          start: trendResults[0]?.time,
          end: trendResults[trendResults.length - 1]?.time
        }
      },
      statisticalInsights: {
        ...statisticalAnalysis,
        confidence: calculateConfidenceLevel(statisticalAnalysis)
      },
      detectedPatterns: patterns.map(p => ({
        type: p.type,
        description: p.description,
        strength: p.strength,
        periodicity: p.periodicity,
        significance: p.significance
      })),
      insights: insights.map(i => ({
        category: i.category,
        finding: i.finding,
        impact: i.impact,
        recommendation: i.recommendation
      })),
      visualizationRecommendations: visualizations,
      monitoringQueries: monitoringQueries.map(q => ({
        purpose: q.purpose,
        sql: q.sql,
        schedule: q.schedule
      })),
      forecastingOpportunities: identifyForecastingOpportunities(
        patterns,
        statisticalAnalysis
      )
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            result,
            metadata: {
              tool: 'bq-trend-analysis',
              timestamp: new Date().toISOString(),
              analysisType: trendType
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
            tool: 'bq-trend-analysis',
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

// Helper functions for cross-dataset operations

function buildTableReferences(datasets) {
  return datasets.map(ds => ({
    fullReference: `${ds.projectId || ''}${ds.projectId ? '.' : ''}${ds.datasetId}.${ds.tableId}`,
    alias: ds.alias || `t${datasets.indexOf(ds) + 1}`,
    dataset: ds
  }));
}

function analyzeJoinComplexity(datasets, joins) {
  const complexity = {
    score: 0,
    factors: [],
    optimizations: [],
    estimatedCost: 0
  };

  // Analyze number of tables
  if (datasets.length > 5) {
    complexity.score += 3;
    complexity.factors.push('High number of tables');
    complexity.optimizations.push('Consider breaking into smaller joins');
  }

  // Analyze join types
  const outerJoins = joins.filter(j => j.joinType.includes('OUTER')).length;
  if (outerJoins > 0) {
    complexity.score += outerJoins * 2;
    complexity.factors.push(`${outerJoins} outer joins detected`);
    complexity.optimizations.push('Consider if INNER joins are sufficient');
  }

  // Analyze cross-project joins
  const projects = new Set(datasets.map(d => d.projectId).filter(Boolean));
  if (projects.size > 1) {
    complexity.score += 2;
    complexity.factors.push('Cross-project joins detected');
    complexity.optimizations.push('Consider replicating data to single project');
  }

  complexity.complexity = complexity.score < 3 ? 'low' : complexity.score < 7 ? 'medium' : 'high';
  complexity.estimatedCost = complexity.score * 0.5; // Simplified cost estimate

  return complexity;
}

function buildCrossDatasetQuery(tableReferences, joinConfig, optimizationLevel) {
  let query = 'SELECT ';

  // Build SELECT clause
  if (joinConfig.selectFields && joinConfig.selectFields.length > 0) {
    query += joinConfig.selectFields.join(', ');
  } else {
    query += tableReferences.map(ref => `${ref.alias}.*`).join(', ');
  }

  // Build FROM clause with first table
  query += `\nFROM \`${tableReferences[0].fullReference}\` AS ${tableReferences[0].alias}`;

  // Build JOIN clauses
  joinConfig.joins.forEach(join => {
    query += `\n${join.joinType} JOIN `;
    
    // Find the right table reference
    const rightTable = tableReferences.find(ref => 
      ref.alias === join.rightTable || ref.fullReference === join.rightTable
    );
    
    query += `\`${rightTable.fullReference}\` AS ${rightTable.alias} ON `;
    
    // Build join conditions
    const conditions = join.conditions.map(cond => 
      `${join.leftTable}.${cond.leftField} ${cond.operator} ${join.rightTable}.${cond.rightField}`
    );
    
    query += conditions.join(' AND ');
  });

  // Add WHERE clause
  if (joinConfig.whereConditions && joinConfig.whereConditions.length > 0) {
    const whereClauses = joinConfig.whereConditions.map(cond => {
      const value = typeof cond.value === 'string' ? `'${cond.value}'` : cond.value;
      return `${cond.field} ${cond.operator} ${value}`;
    });
    query += `\nWHERE ${whereClauses.join(' AND ')}`;
  }

  // Add GROUP BY
  if (joinConfig.groupBy && joinConfig.groupBy.length > 0) {
    query += `\nGROUP BY ${joinConfig.groupBy.join(', ')}`;
  }

  // Add ORDER BY
  if (joinConfig.orderBy && joinConfig.orderBy.length > 0) {
    const orderClauses = joinConfig.orderBy.map(o => `${o.field} ${o.direction}`);
    query += `\nORDER BY ${orderClauses.join(', ')}`;
  }

  // Add LIMIT
  if (joinConfig.limit) {
    query += `\nLIMIT ${joinConfig.limit}`;
  }

  return query;
}

function applyJoinOptimizations(query, joinAnalysis, level) {
  let optimizedQuery = query;

  if (level === 'basic') {
    // Add optimization hints
    optimizedQuery = `-- Query optimization level: ${level}\n` + optimizedQuery;
    
    // Add partitioning hints if applicable
    if (query.includes('WHERE') && query.match(/date|timestamp/i)) {
      optimizedQuery = optimizedQuery.replace('WHERE', 'WHERE -- Consider partition pruning\n');
    }
  } else if (level === 'advanced') {
    // More aggressive optimizations
    optimizedQuery = `-- Advanced optimizations applied\n` + optimizedQuery;
    
    // Suggest materialized views for complex joins
    if (joinAnalysis.complexity === 'high') {
      optimizedQuery = `-- Consider creating materialized view for this join pattern\n` + optimizedQuery;
    }
    
    // Add cluster hints
    if (query.includes('ORDER BY')) {
      optimizedQuery = optimizedQuery.replace('ORDER BY', '-- Leverage clustering if available\nORDER BY');
    }
  }

  return optimizedQuery;
}

async function analyzeExecutionPlan(query, projectId) {
  try {
    const [job] = await bigquery.createQueryJob({
      query: query,
      dryRun: true,
      useLegacySql: false,
      ...(projectId && { projectId })
    });

    const metadata = job.metadata;
    return {
      bytesProcessed: metadata.statistics?.query?.totalBytesProcessed || '0',
      slotMilliseconds: metadata.statistics?.query?.totalSlotMs || '0',
      cacheEligible: metadata.configuration?.query?.useQueryCache || false,
      statementType: metadata.statistics?.query?.statementType || 'SELECT'
    };
  } catch (error) {
    return {
      error: error.message,
      bytesProcessed: '0',
      slotMilliseconds: '0',
      cacheEligible: false
    };
  }
}

function prepareOutputConfiguration(outputConfig) {
  const config = {
    destination: `${outputConfig.destinationDataset}.${outputConfig.destinationTable}`,
    writeDisposition: outputConfig.writeDisposition || 'WRITE_TRUNCATE',
    createDisposition: outputConfig.createDisposition || 'CREATE_IF_NEEDED'
  };

  return config;
}

// Helper functions for partition analysis

function analyzeCurrentPartitioning(metadata) {
  if (metadata.timePartitioning) {
    return {
      type: 'TIME',
      field: metadata.timePartitioning.field,
      granularity: metadata.timePartitioning.type,
      expirationMs: metadata.timePartitioning.expirationMs,
      effectiveness: calculatePartitioningEffectiveness(metadata)
    };
  } else if (metadata.rangePartitioning) {
    return {
      type: 'RANGE',
      field: metadata.rangePartitioning.field,
      range: metadata.rangePartitioning.range,
      effectiveness: calculatePartitioningEffectiveness(metadata)
    };
  }
  
  return null;
}

function calculatePartitioningEffectiveness(metadata) {
  // Simplified effectiveness calculation
  let score = 0;
  
  if (metadata.numRows > 1000000) {
    score += 0.3; // Large table benefits from partitioning
  }
  
  if (metadata.clustering) {
    score += 0.2; // Clustering complements partitioning
  }
  
  if (metadata.timePartitioning?.requirePartitionFilter) {
    score += 0.3; // Partition filter requirement improves efficiency
  }
  
  return Math.min(score, 1.0);
}

async function profileDataDistribution(projectId, datasetId, tableId, dataProfile) {
  const distribution = {
    cardinality: {},
    temporalDistribution: null,
    numericRanges: {},
    skewness: {}
  };

  try {
    // Sample data for profiling
    const sampleSize = dataProfile?.sampleSize || 10000;
    const query = `
      SELECT *
      FROM \`${datasetId}.${tableId}\`
      TABLESAMPLE SYSTEM (${sampleSize} ROWS)
    `;

    const [rows] = await bigquery.query({
      query: query,
      ...(projectId && { projectId })
    });

    // Analyze temporal distribution if time column specified
    if (dataProfile?.timeColumn && rows.length > 0) {
      distribution.temporalDistribution = analyzeTemporalDistribution(
        rows,
        dataProfile.timeColumn
      );
    }

    // Analyze cardinality of key fields
    if (rows.length > 0) {
      const fields = Object.keys(rows[0]);
      fields.forEach(field => {
        const uniqueValues = new Set(rows.map(r => r[field]));
        distribution.cardinality[field] = {
          unique: uniqueValues.size,
          total: rows.length,
          ratio: uniqueValues.size / rows.length
        };
      });
    }

  } catch (error) {
    console.error('Error profiling data distribution:', error);
  }

  return distribution;
}

function analyzeTemporalDistribution(rows, timeColumn) {
  const timestamps = rows
    .map(r => r[timeColumn])
    .filter(t => t)
    .map(t => new Date(t).getTime());

  if (timestamps.length === 0) return null;

  timestamps.sort((a, b) => a - b);
  
  return {
    min: new Date(timestamps[0]),
    max: new Date(timestamps[timestamps.length - 1]),
    range: timestamps[timestamps.length - 1] - timestamps[0],
    gaps: detectTimeGaps(timestamps),
    density: calculateTemporalDensity(timestamps)
  };
}

function detectTimeGaps(timestamps) {
  const gaps = [];
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1];
    if (gap > 86400000) { // More than 1 day
      gaps.push({
        start: new Date(timestamps[i - 1]),
        end: new Date(timestamps[i]),
        duration: gap
      });
    }
  }
  return gaps;
}

function calculateTemporalDensity(timestamps) {
  if (timestamps.length < 2) return 0;
  
  const totalRange = timestamps[timestamps.length - 1] - timestamps[0];
  const expectedInterval = totalRange / (timestamps.length - 1);
  
  let varianceSum = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const actualInterval = timestamps[i] - timestamps[i - 1];
    varianceSum += Math.pow(actualInterval - expectedInterval, 2);
  }
  
  const variance = varianceSum / (timestamps.length - 1);
  const density = 1 / (1 + Math.sqrt(variance) / expectedInterval);
  
  return density;
}

function analyzeQueryPatterns(queries) {
  const patterns = {
    filters: [],
    aggregations: [],
    joins: [],
    timeRanges: []
  };

  queries.forEach(query => {
    // Extract filter patterns
    const whereMatch = query.match(/WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)/is);
    if (whereMatch) {
      patterns.filters.push({
        clause: whereMatch[1],
        fields: extractFieldsFromClause(whereMatch[1])
      });
    }

    // Extract aggregation patterns
    if (query.match(/GROUP BY/i)) {
      const groupMatch = query.match(/GROUP BY\s+(.+?)(?:HAVING|ORDER|LIMIT|$)/is);
      if (groupMatch) {
        patterns.aggregations.push({
          fields: groupMatch[1].split(',').map(f => f.trim())
        });
      }
    }

    // Extract time range patterns
    const timePatterns = query.match(/[a-zA-Z_]+\s*[><=]+\s*(?:CURRENT_DATE|DATE|TIMESTAMP)/gi);
    if (timePatterns) {
      patterns.timeRanges.push(...timePatterns);
    }
  });

  return patterns;
}

function extractFieldsFromClause(clause) {
  const fieldPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*[><=!]/g;
  const fields = [];
  let match;
  
  while ((match = fieldPattern.exec(clause)) !== null) {
    fields.push(match[1]);
  }
  
  return [...new Set(fields)];
}

function generatePartitioningRecommendations(metadata, distribution, queryPatterns, currentPartitioning) {
  const recommendations = [];

  // Check if table needs partitioning
  if (!currentPartitioning && metadata.numRows > 1000000) {
    // Recommend time partitioning if temporal column exists
    if (distribution.temporalDistribution) {
      recommendations.push({
        strategy: 'time_partitioning',
        type: 'DAY',
        field: Object.keys(distribution.cardinality).find(f => f.includes('date') || f.includes('time')),
        reason: 'Large table with temporal data would benefit from time partitioning',
        estimatedImprovement: '60-80% query cost reduction for time-filtered queries',
        implementationSQL: generatePartitioningSQL('TIME', metadata)
      });
    }

    // Recommend integer range partitioning for high cardinality integer fields
    Object.entries(distribution.cardinality).forEach(([field, stats]) => {
      if (stats.ratio > 0.8 && field.toLowerCase().includes('id')) {
        recommendations.push({
          strategy: 'range_partitioning',
          type: 'INTEGER',
          field: field,
          reason: `High cardinality field ${field} suitable for range partitioning`,
          estimatedImprovement: '40-60% performance improvement for filtered queries',
          implementationSQL: generatePartitioningSQL('RANGE', metadata, field)
        });
      }
    });
  }

  // Recommend clustering for partitioned tables
  if (currentPartitioning && !metadata.clustering) {
    const clusteringFields = identifyClusteringCandidates(distribution, queryPatterns);
    if (clusteringFields.length > 0) {
      recommendations.push({
        strategy: 'clustering',
        type: 'CLUSTER',
        field: clusteringFields.join(', '),
        reason: 'Clustering would complement existing partitioning',
        estimatedImprovement: '20-40% additional performance improvement',
        implementationSQL: generateClusteringSQL(metadata, clusteringFields)
      });
    }
  }

  return recommendations;
}

function generatePartitioningSQL(type, metadata, field) {
  const tableName = metadata.id;
  
  if (type === 'TIME') {
    return `
-- Create new partitioned table
CREATE TABLE \`${tableName}_partitioned\`
PARTITION BY DATE(${field || 'timestamp_field'})
AS SELECT * FROM \`${tableName}\`;

-- Copy data
INSERT INTO \`${tableName}_partitioned\`
SELECT * FROM \`${tableName}\`;

-- Rename tables
ALTER TABLE \`${tableName}\` RENAME TO \`${tableName}_backup\`;
ALTER TABLE \`${tableName}_partitioned\` RENAME TO \`${tableName}\`;
`;
  } else if (type === 'RANGE') {
    return `
-- Create range partitioned table
CREATE TABLE \`${tableName}_partitioned\`
PARTITION BY RANGE_BUCKET(${field}, GENERATE_ARRAY(0, 1000000, 10000))
AS SELECT * FROM \`${tableName}\`;
`;
  }
  
  return '';
}

function generateClusteringSQL(metadata, fields) {
  return `
-- Add clustering to existing table
CREATE OR REPLACE TABLE \`${metadata.id}\`
CLUSTER BY ${fields.join(', ')}
AS SELECT * FROM \`${metadata.id}\`;
`;
}

function identifyClusteringCandidates(distribution, queryPatterns) {
  const candidates = [];
  
  // High cardinality fields that appear in filters
  if (queryPatterns?.filters) {
    const filterFields = queryPatterns.filters.flatMap(f => f.fields);
    
    Object.entries(distribution.cardinality).forEach(([field, stats]) => {
      if (stats.ratio > 0.1 && filterFields.includes(field)) {
        candidates.push(field);
      }
    });
  }
  
  return candidates.slice(0, 4); // BigQuery supports up to 4 clustering columns
}

function estimatePartitioningImpact(metadata, recommendations, distribution) {
  const impact = {
    querySpeedup: 0,
    costReduction: 0,
    storageOverhead: 0
  };

  recommendations.forEach(rec => {
    if (rec.strategy === 'time_partitioning') {
      // Estimate based on temporal distribution
      if (distribution.temporalDistribution) {
        const rangeInDays = distribution.temporalDistribution.range / (1000 * 60 * 60 * 24);
        impact.querySpeedup += Math.min(0.7, rangeInDays / 365);
        impact.costReduction += 0.6; // Typical cost reduction for time-filtered queries
      }
    } else if (rec.strategy === 'range_partitioning') {
      impact.querySpeedup += 0.5;
      impact.costReduction += 0.4;
    } else if (rec.strategy === 'clustering') {
      impact.querySpeedup += 0.3;
      impact.costReduction += 0.2;
    }
  });

  // Storage overhead for partitioning
  impact.storageOverhead = recommendations.length * 0.02; // ~2% per strategy

  return impact;
}

// Helper functions for performance profiling

function extractExecutionStatistics(metadata) {
  const stats = metadata.statistics?.query || {};
  
  return {
    totalBytesProcessed: stats.totalBytesProcessed,
    totalBytesBilled: stats.totalBytesBilled,
    totalSlotMs: stats.totalSlotMs,
    cacheHit: stats.cacheHit || false,
    statementType: stats.statementType,
    totalTablesProcessed: stats.totalTablesProcessed,
    totalPartitionsProcessed: stats.totalPartitionsProcessed,
    estimatedBytesProcessed: stats.estimatedBytesProcessed,
    timeline: stats.timeline,
    queryPlan: stats.queryPlan
  };
}

function identifyQueryBottlenecks(query, queryPlan) {
  const bottlenecks = [];

  // Check for SELECT * 
  if (query.includes('SELECT *')) {
    bottlenecks.push({
      type: 'wide_select',
      severity: 'medium',
      location: 'SELECT clause',
      description: 'Selecting all columns increases data processing',
      impact: 'Higher bytes processed and slower query'
    });
  }

  // Check for missing WHERE clause
  if (!query.toUpperCase().includes('WHERE')) {
    bottlenecks.push({
      type: 'full_table_scan',
      severity: 'high',
      location: 'Query structure',
      description: 'No WHERE clause may result in full table scan',
      impact: 'Processes entire table, high cost'
    });
  }

  // Check for complex joins
  const joinCount = (query.match(/JOIN/gi) || []).length;
  if (joinCount > 3) {
    bottlenecks.push({
      type: 'complex_joins',
      severity: 'high',
      location: 'JOIN operations',
      description: `Query contains ${joinCount} joins`,
      impact: 'Increased complexity and processing time'
    });
  }

  // Check for subqueries
  const subqueryCount = (query.match(/SELECT(?![^(]*\))/gi) || []).length - 1;
  if (subqueryCount > 2) {
    bottlenecks.push({
      type: 'nested_subqueries',
      severity: 'medium',
      location: 'Subqueries',
      description: `Query contains ${subqueryCount} nested subqueries`,
      impact: 'May prevent query optimization'
    });
  }

  // Analyze query plan if available
  if (queryPlan && queryPlan.length > 0) {
    const expensiveStages = queryPlan.filter(stage => 
      stage.computeMsAvg > 1000 || stage.shuffleOutputBytes > 1024 * 1024 * 1024
    );
    
    expensiveStages.forEach(stage => {
      bottlenecks.push({
        type: 'expensive_stage',
        severity: 'high',
        location: `Stage ${stage.id}: ${stage.name}`,
        description: `High compute time (${stage.computeMsAvg}ms) or shuffle (${stage.shuffleOutputBytes} bytes)`,
        impact: 'Performance bottleneck in execution'
      });
    });
  }

  return bottlenecks;
}

function generatePerformanceOptimizations(query, executionStats, bottlenecks) {
  const optimizations = [];

  // Optimize based on bottlenecks
  bottlenecks.forEach(bottleneck => {
    switch (bottleneck.type) {
      case 'wide_select':
        optimizations.push({
          category: 'column_selection',
          priority: 'medium',
          recommendation: 'Select only required columns instead of SELECT *',
          estimatedImprovement: '20-50% reduction in bytes processed',
          implementation: 'Replace SELECT * with specific column names'
        });
        break;
      
      case 'full_table_scan':
        optimizations.push({
          category: 'filtering',
          priority: 'high',
          recommendation: 'Add WHERE clause to filter data',
          estimatedImprovement: 'Up to 90% cost reduction',
          implementation: 'Add appropriate WHERE conditions based on your use case'
        });
        break;
      
      case 'complex_joins':
        optimizations.push({
          category: 'join_optimization',
          priority: 'high',
          recommendation: 'Consider breaking into smaller queries or using materialized views',
          estimatedImprovement: '30-60% performance improvement',
          implementation: 'Create intermediate tables or views for complex join patterns'
        });
        break;
    }
  });

  // Add general optimizations based on stats
  if (executionStats.totalBytesProcessed > 1024 * 1024 * 1024 * 100) { // > 100GB
    optimizations.push({
      category: 'partitioning',
      priority: 'high',
      recommendation: 'Consider partitioning tables to reduce data scanned',
      estimatedImprovement: '50-80% cost reduction for filtered queries',
      implementation: 'Partition by date or another high-cardinality field'
    });
  }

  return optimizations;
}

function calculateQueryComplexity(query) {
  let complexity = 0;
  
  // Base complexity from query length
  complexity += query.length / 1000;
  
  // Add complexity for various operations
  complexity += (query.match(/JOIN/gi) || []).length * 2;
  complexity += (query.match(/SELECT(?![^(]*\))/gi) || []).length - 1; // Subqueries
  complexity += (query.match(/GROUP BY/gi) || []).length;
  complexity += (query.match(/WINDOW/gi) || []).length * 3;
  complexity += (query.match(/WITH/gi) || []).length * 2;
  
  return Math.min(complexity, 10); // Cap at 10
}

function countSubqueries(query) {
  return (query.match(/SELECT(?![^(]*\))/gi) || []).length - 1;
}

function countJoins(query) {
  return (query.match(/JOIN/gi) || []).length;
}

function countAggregations(query) {
  const aggFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ARRAY_AGG', 'STRING_AGG'];
  let count = 0;
  
  aggFunctions.forEach(func => {
    const matches = query.match(new RegExp(`\\b${func}\\s*\\(`, 'gi'));
    if (matches) count += matches.length;
  });
  
  return count;
}

function estimateMemoryUsage(query, executionStats) {
  // Simplified memory estimation based on query patterns
  let memoryMB = 100; // Base memory
  
  // Add memory for joins
  memoryMB += countJoins(query) * 500;
  
  // Add memory for aggregations
  memoryMB += countAggregations(query) * 200;
  
  // Add memory based on data size
  const bytesProcessed = parseInt(executionStats.totalBytesProcessed || 0);
  memoryMB += bytesProcessed / (1024 * 1024) * 0.1;
  
  return Math.round(memoryMB);
}

function estimateParallelization(queryPlan) {
  if (!queryPlan || queryPlan.length === 0) return 1;
  
  // Find maximum parallel workers from query plan
  const maxParallel = Math.max(...queryPlan.map(stage => stage.parallelInputs || 1));
  
  return maxParallel;
}

async function compareWithHistoricalPerformance(query, currentStats, config) {
  // This would typically query a performance history table
  // For now, return simulated comparison
  
  return {
    historicalAverage: {
      bytesProcessed: currentStats.totalBytesProcessed * 0.9,
      slotMilliseconds: currentStats.totalSlotMs * 0.95,
      executionTime: 5000
    },
    comparison: {
      bytesProcessedChange: '+10%',
      performanceChange: '+5%',
      trend: 'degrading'
    },
    recommendations: [
      'Query performance has degraded by 5% over the past week',
      'Consider refreshing table statistics or rebuilding indexes'
    ]
  };
}

// Helper functions for trend analysis

function buildTrendAnalysisQueries(datasetId, timeColumn, window, trendType, metrics, groupBy) {
  const queries = [];
  const tables = identifyRelevantTables(datasetId, timeColumn, metrics);
  
  tables.forEach(table => {
    // Base time series query
    let query = `
WITH time_series AS (
  SELECT 
    ${generateTimeGranularity(timeColumn, window.granularity)} as time_period,
    ${groupBy ? groupBy.join(', ') + ',' : ''}
    ${generateMetricAggregations(metrics || [])}
  FROM \`${datasetId}.${table}\`
  WHERE ${generateTimeFilter(timeColumn, window)}
  GROUP BY time_period${groupBy ? ', ' + groupBy.join(', ') : ''}
)`;

    // Add trend-specific analysis
    switch (trendType) {
      case 'linear':
        query += generateLinearTrendQuery();
        break;
      case 'exponential':
        query += generateExponentialTrendQuery();
        break;
      case 'seasonal':
        query += generateSeasonalTrendQuery(window.granularity);
        break;
      case 'decomposition':
        query += generateDecompositionQuery();
        break;
      case 'all':
        // Generate comprehensive analysis
        queries.push({ type: 'linear', sql: query + generateLinearTrendQuery() });
        queries.push({ type: 'seasonal', sql: query + generateSeasonalTrendQuery(window.granularity) });
        return;
    }

    queries.push({ type: trendType, sql: query });
  });

  return queries;
}

function identifyRelevantTables(datasetId, timeColumn, metrics) {
  // In a real implementation, this would query the dataset schema
  // For now, return a placeholder
  return ['main_table'];
}

function generateTimeGranularity(timeColumn, granularity) {
  switch (granularity) {
    case 'HOUR':
      return `TIMESTAMP_TRUNC(${timeColumn}, HOUR)`;
    case 'DAY':
      return `DATE(${timeColumn})`;
    case 'WEEK':
      return `DATE_TRUNC(${timeColumn}, WEEK)`;
    case 'MONTH':
      return `DATE_TRUNC(${timeColumn}, MONTH)`;
    case 'QUARTER':
      return `DATE_TRUNC(${timeColumn}, QUARTER)`;
    case 'YEAR':
      return `EXTRACT(YEAR FROM ${timeColumn})`;
    default:
      return `DATE(${timeColumn})`;
  }
}

function generateMetricAggregations(metrics) {
  if (metrics.length === 0) {
    return 'COUNT(*) as record_count';
  }

  return metrics.map(metric => {
    const alias = `${metric.aggregation.toLowerCase()}_${metric.field}`;
    return `${metric.aggregation}(${metric.field}) as ${alias}`;
  }).join(',\n    ');
}

function generateTimeFilter(timeColumn, window) {
  const filters = [];
  
  if (window.start) {
    filters.push(`${timeColumn} >= '${window.start}'`);
  }
  
  if (window.end) {
    filters.push(`${timeColumn} <= '${window.end}'`);
  }
  
  if (window.lookbackPeriods && !window.start) {
    const lookbackClause = generateLookbackClause(timeColumn, window.granularity, window.lookbackPeriods);
    filters.push(lookbackClause);
  }
  
  return filters.length > 0 ? filters.join(' AND ') : '1=1';
}

function generateLookbackClause(timeColumn, granularity, periods) {
  const interval = {
    'HOUR': `INTERVAL ${periods} HOUR`,
    'DAY': `INTERVAL ${periods} DAY`,
    'WEEK': `INTERVAL ${periods} WEEK`,
    'MONTH': `INTERVAL ${periods} MONTH`,
    'QUARTER': `INTERVAL ${periods * 3} MONTH`,
    'YEAR': `INTERVAL ${periods} YEAR`
  };
  
  return `${timeColumn} >= CURRENT_TIMESTAMP() - ${interval[granularity] || 'INTERVAL 30 DAY'}`;
}

function generateLinearTrendQuery() {
  return `
, linear_regression AS (
  SELECT
    time_period,
    record_count,
    -- Calculate linear regression
    record_count - AVG(record_count) OVER() as deviation,
    ROW_NUMBER() OVER (ORDER BY time_period) as period_number,
    COUNT(*) OVER() as total_periods
  FROM time_series
)
SELECT 
  *,
  -- Trend line calculation
  AVG(record_count) OVER() + 
    (SUM(deviation * (period_number - (total_periods + 1) / 2)) OVER() / 
     SUM(POW(period_number - (total_periods + 1) / 2, 2)) OVER()) * 
    (period_number - (total_periods + 1) / 2) as trend_value
FROM linear_regression
ORDER BY time_period`;
}

function generateExponentialTrendQuery() {
  return `
, exponential_trend AS (
  SELECT
    time_period,
    record_count,
    -- Calculate exponential smoothing
    FIRST_VALUE(record_count) OVER (ORDER BY time_period) * 
    POW(
      AVG(record_count / LAG(record_count) OVER (ORDER BY time_period)) OVER(),
      ROW_NUMBER() OVER (ORDER BY time_period) - 1
    ) as exponential_trend
  FROM time_series
)
SELECT * FROM exponential_trend
ORDER BY time_period`;
}

function generateSeasonalTrendQuery(granularity) {
  const seasonalPeriod = {
    'HOUR': 24,
    'DAY': 7,
    'WEEK': 4,
    'MONTH': 12,
    'QUARTER': 4,
    'YEAR': 1
  };
  
  const period = seasonalPeriod[granularity] || 7;
  
  return `
, seasonal_analysis AS (
  SELECT
    time_period,
    record_count,
    -- Calculate seasonal component
    AVG(record_count) OVER (
      PARTITION BY MOD(ROW_NUMBER() OVER (ORDER BY time_period), ${period})
    ) as seasonal_avg,
    -- Calculate trend
    AVG(record_count) OVER (
      ORDER BY time_period 
      ROWS BETWEEN ${Math.floor(period/2)} PRECEDING AND ${Math.floor(period/2)} FOLLOWING
    ) as trend,
    -- Calculate residual
    record_count - AVG(record_count) OVER (
      PARTITION BY MOD(ROW_NUMBER() OVER (ORDER BY time_period), ${period})
    ) as residual
  FROM time_series
)
SELECT * FROM seasonal_analysis
ORDER BY time_period`;
}

function generateDecompositionQuery() {
  return `
, decomposition AS (
  SELECT
    time_period,
    record_count,
    -- Moving average for trend
    AVG(record_count) OVER (
      ORDER BY time_period 
      ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
    ) as trend_component,
    -- Detrended series
    record_count - AVG(record_count) OVER (
      ORDER BY time_period 
      ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
    ) as detrended,
    -- Seasonal component (simplified)
    AVG(record_count - AVG(record_count) OVER (
      ORDER BY time_period 
      ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
    )) OVER (
      PARTITION BY EXTRACT(DAYOFWEEK FROM time_period)
    ) as seasonal_component
  FROM time_series
)
SELECT 
  *,
  -- Irregular component
  record_count - trend_component - seasonal_component as irregular_component
FROM decomposition
ORDER BY time_period`;
}

async function executeTrendQueries(queries, projectId) {
  const results = [];
  
  for (const queryObj of queries) {
    try {
      const [rows] = await bigquery.query({
        query: queryObj.sql,
        ...(projectId && { projectId })
      });
      
      results.push({
        type: queryObj.type,
        data: rows
      });
    } catch (error) {
      console.error(`Error executing ${queryObj.type} trend query:`, error);
      results.push({
        type: queryObj.type,
        error: error.message
      });
    }
  }
  
  return results;
}

function performStatisticalAnalysis(trendResults, trendType) {
  const analysis = {
    mean: 0,
    standardDeviation: 0,
    trend: null,
    seasonality: null,
    correlation: 0
  };

  // Find the main result set
  const mainResult = trendResults.find(r => r.type === trendType) || trendResults[0];
  if (!mainResult || !mainResult.data || mainResult.data.length === 0) {
    return analysis;
  }

  const values = mainResult.data.map(row => row.record_count || 0);
  
  // Calculate basic statistics
  analysis.mean = values.reduce((a, b) => a + b, 0) / values.length;
  
  const variance = values.reduce((sum, val) => sum + Math.pow(val - analysis.mean, 2), 0) / values.length;
  analysis.standardDeviation = Math.sqrt(variance);
  
  // Calculate trend strength
  if (trendType === 'linear' || trendType === 'all') {
    analysis.trend = calculateTrendStrength(mainResult.data);
  }
  
  // Calculate seasonality strength
  if (trendType === 'seasonal' || trendType === 'all') {
    analysis.seasonality = calculateSeasonalityStrength(mainResult.data);
  }
  
  return analysis;
}

function calculateTrendStrength(data) {
  if (data.length < 2) return { direction: 'flat', strength: 0 };
  
  const values = data.map(row => row.record_count || 0);
  const n = values.length;
  
  // Simple linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const correlation = Math.abs(slope) / (Math.max(...values) - Math.min(...values));
  
  return {
    direction: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'flat',
    strength: Math.min(correlation, 1),
    slope: slope
  };
}

function calculateSeasonalityStrength(data) {
  if (data.length < 7) return { detected: false, strength: 0 };
  
  // Simple seasonality detection using autocorrelation
  const values = data.map(row => row.record_count || 0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  
  // Calculate autocorrelation for different lags
  const correlations = [];
  for (let lag = 1; lag <= Math.min(12, Math.floor(values.length / 2)); lag++) {
    let correlation = 0;
    let count = 0;
    
    for (let i = lag; i < values.length; i++) {
      correlation += (values[i] - mean) * (values[i - lag] - mean);
      count++;
    }
    
    correlations.push({
      lag: lag,
      correlation: correlation / count
    });
  }
  
  // Find the strongest correlation
  const maxCorrelation = Math.max(...correlations.map(c => Math.abs(c.correlation)));
  const strongestLag = correlations.find(c => Math.abs(c.correlation) === maxCorrelation);
  
  return {
    detected: maxCorrelation > 0.5,
    strength: maxCorrelation,
    period: strongestLag?.lag || 0
  };
}

function detectTemporalPatterns(trendResults, analysisWindow) {
  const patterns = [];
  
  trendResults.forEach(result => {
    if (!result.data || result.data.length === 0) return;
    
    const values = result.data.map(row => row.record_count || 0);
    
    // Detect spikes
    const spikes = detectSpikes(values, result.data);
    patterns.push(...spikes);
    
    // Detect cycles
    const cycles = detectCycles(values, analysisWindow.granularity);
    patterns.push(...cycles);
    
    // Detect anomalies
    const anomalies = detectAnomalies(values, result.data);
    patterns.push(...anomalies);
  });
  
  return patterns;
}

function detectSpikes(values, data) {
  const patterns = [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
  
  values.forEach((value, index) => {
    const zScore = (value - mean) / stdDev;
    
    if (Math.abs(zScore) > 2) {
      patterns.push({
        type: 'spike',
        description: `${zScore > 0 ? 'Positive' : 'Negative'} spike detected`,
        strength: Math.min(Math.abs(zScore) / 3, 1),
        periodicity: null,
        significance: Math.abs(zScore) > 3 ? 'high' : 'medium',
        timestamp: data[index].time_period
      });
    }
  });
  
  return patterns;
}

function detectCycles(values, granularity) {
  const patterns = [];
  
  // Simple cycle detection using peak analysis
  const peaks = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
      peaks.push(i);
    }
  }
  
  if (peaks.length >= 2) {
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const consistency = 1 - (Math.max(...intervals) - Math.min(...intervals)) / avgInterval;
    
    if (consistency > 0.7) {
      patterns.push({
        type: 'cycle',
        description: `Regular cycle detected with period of ${avgInterval} ${granularity}s`,
        strength: consistency,
        periodicity: avgInterval,
        significance: consistency > 0.9 ? 'high' : 'medium'
      });
    }
  }
  
  return patterns;
}

function detectAnomalies(values, data) {
  const patterns = [];
  
  // Moving average anomaly detection
  const windowSize = Math.min(7, Math.floor(values.length / 4));
  
  for (let i = windowSize; i < values.length; i++) {
    const windowValues = values.slice(i - windowSize, i);
    const windowMean = windowValues.reduce((a, b) => a + b, 0) / windowSize;
    const windowStdDev = Math.sqrt(
      windowValues.reduce((sum, val) => sum + Math.pow(val - windowMean, 2), 0) / windowSize
    );
    
    const deviation = Math.abs(values[i] - windowMean);
    
    if (deviation > 2.5 * windowStdDev) {
      patterns.push({
        type: 'anomaly',
        description: 'Unusual value detected compared to recent history',
        strength: Math.min(deviation / (3 * windowStdDev), 1),
        periodicity: null,
        significance: deviation > 3 * windowStdDev ? 'high' : 'medium',
        timestamp: data[i].time_period
      });
    }
  }
  
  return patterns;
}

function generateTrendInsights(statisticalAnalysis, patterns, trendType) {
  const insights = [];

  // Trend insights
  if (statisticalAnalysis.trend) {
    const trend = statisticalAnalysis.trend;
    insights.push({
      category: 'trend',
      finding: `Data shows ${trend.strength > 0.7 ? 'strong' : 'moderate'} ${trend.direction} trend`,
      impact: trend.direction === 'increasing' ? 'positive' : 'negative',
      recommendation: trend.direction === 'increasing' 
        ? 'Consider capacity planning for continued growth'
        : 'Investigate causes of decline and implement corrective measures'
    });
  }

  // Seasonality insights
  if (statisticalAnalysis.seasonality?.detected) {
    insights.push({
      category: 'seasonality',
      finding: `Seasonal pattern detected with period of ${statisticalAnalysis.seasonality.period}`,
      impact: 'neutral',
      recommendation: 'Adjust forecasting models to account for seasonal variations'
    });
  }

  // Pattern insights
  const spikes = patterns.filter(p => p.type === 'spike');
  if (spikes.length > 0) {
    insights.push({
      category: 'volatility',
      finding: `${spikes.length} significant spikes detected in the data`,
      impact: 'warning',
      recommendation: 'Implement alerting for unusual activity and investigate root causes'
    });
  }

  // Anomaly insights
  const anomalies = patterns.filter(p => p.type === 'anomaly');
  if (anomalies.length > 0) {
    insights.push({
      category: 'anomalies',
      finding: `${anomalies.length} anomalous data points identified`,
      impact: 'warning',
      recommendation: 'Review anomalous periods for data quality issues or special events'
    });
  }

  return insights;
}

function recommendVisualizations(trendType, patterns, metrics) {
  const recommendations = [];

  // Base visualization based on trend type
  switch (trendType) {
    case 'linear':
      recommendations.push({
        type: 'line_chart',
        title: 'Trend Analysis',
        configuration: {
          xAxis: 'time_period',
          yAxis: metrics?.map(m => `${m.aggregation}_${m.field}`) || ['record_count'],
          trendLine: true
        }
      });
      break;
    
    case 'seasonal':
      recommendations.push({
        type: 'seasonal_plot',
        title: 'Seasonal Decomposition',
        configuration: {
          components: ['trend', 'seasonal', 'residual'],
          cycleHighlight: true
        }
      });
      break;
    
    case 'decomposition':
      recommendations.push({
        type: 'multi_panel_chart',
        title: 'Time Series Decomposition',
        configuration: {
          panels: ['original', 'trend', 'seasonal', 'irregular']
        }
      });
      break;
  }

  // Add pattern-specific visualizations
  if (patterns.some(p => p.type === 'spike')) {
    recommendations.push({
      type: 'control_chart',
      title: 'Statistical Process Control',
      configuration: {
        centerLine: 'mean',
        controlLimits: [2, 3],
        highlightOutOfControl: true
      }
    });
  }

  if (patterns.some(p => p.type === 'cycle')) {
    recommendations.push({
      type: 'periodogram',
      title: 'Frequency Analysis',
      configuration: {
        showDominantFrequencies: true,
        annotatePerids: true
      }
    });
  }

  return recommendations;
}

function generateMonitoringQueries(datasetId, timeColumn, insights, metrics) {
  const queries = [];

  // Generate queries based on insights
  insights.forEach(insight => {
    switch (insight.category) {
      case 'trend':
        queries.push({
          purpose: 'Monitor trend continuation',
          sql: `
SELECT 
  DATE(${timeColumn}) as date,
  ${generateMetricAggregations(metrics || [])}
FROM \`${datasetId}.main_table\`
WHERE ${timeColumn} >= CURRENT_DATE() - INTERVAL 7 DAY
GROUP BY date
ORDER BY date DESC`,
          schedule: 'daily'
        });
        break;
      
      case 'anomalies':
        queries.push({
          purpose: 'Detect anomalies in real-time',
          sql: `
WITH recent_stats AS (
  SELECT 
    AVG(record_count) as avg_count,
    STDDEV(record_count) as stddev_count
  FROM (
    SELECT DATE(${timeColumn}) as date, COUNT(*) as record_count
    FROM \`${datasetId}.main_table\`
    WHERE ${timeColumn} >= CURRENT_DATE() - INTERVAL 30 DAY
    GROUP BY date
  )
)
SELECT 
  CURRENT_TIMESTAMP() as alert_time,
  COUNT(*) as current_count,
  (COUNT(*) - avg_count) / stddev_count as z_score
FROM \`${datasetId}.main_table\`, recent_stats
WHERE ${timeColumn} >= CURRENT_TIMESTAMP() - INTERVAL 1 HOUR
GROUP BY avg_count, stddev_count
HAVING ABS(z_score) > 2`,
          schedule: 'hourly'
        });
        break;
    }
  });

  return queries;
}

function calculateConfidenceLevel(analysis) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on data quality indicators
  if (analysis.standardDeviation > 0 && analysis.mean > 0) {
    const coefficientOfVariation = analysis.standardDeviation / analysis.mean;
    confidence += (1 - Math.min(coefficientOfVariation, 1)) * 0.2;
  }
  
  // Increase confidence for strong trends
  if (analysis.trend?.strength > 0.7) {
    confidence += 0.2;
  }
  
  // Increase confidence for detected seasonality
  if (analysis.seasonality?.detected && analysis.seasonality.strength > 0.6) {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 0.95);
}

function identifyForecastingOpportunities(patterns, statisticalAnalysis) {
  const opportunities = [];

  // Check for stable trends
  if (statisticalAnalysis.trend?.strength > 0.6) {
    opportunities.push({
      method: 'linear_regression',
      suitability: 'high',
      description: 'Strong linear trend suitable for regression-based forecasting',
      forecastHorizon: 'medium'
    });
  }

  // Check for seasonality
  if (statisticalAnalysis.seasonality?.detected) {
    opportunities.push({
      method: 'seasonal_arima',
      suitability: 'high',
      description: `Seasonal pattern with period ${statisticalAnalysis.seasonality.period} suitable for SARIMA`,
      forecastHorizon: 'long'
    });
  }

  // Check for cycles
  const cycles = patterns.filter(p => p.type === 'cycle');
  if (cycles.length > 0) {
    opportunities.push({
      method: 'fourier_transform',
      suitability: 'medium',
      description: 'Cyclical patterns detected, suitable for frequency-based forecasting',
      forecastHorizon: 'medium'
    });
  }

  // Default opportunity if data is stable
  if (opportunities.length === 0 && statisticalAnalysis.standardDeviation < statisticalAnalysis.mean * 0.3) {
    opportunities.push({
      method: 'moving_average',
      suitability: 'medium',
      description: 'Stable data suitable for simple moving average forecasting',
      forecastHorizon: 'short'
    });
  }

  return opportunities;
}

// Export all tools for MCP integration
export const advancedAnalyticsTools = [
  {
    name: 'bq-cross-dataset-join',
    description: 'Complex multi-dataset JOIN operations with optimization',
    inputSchema: {
      type: 'object',
      properties: {
        datasets: { type: 'array', items: { type: 'object' } },
        joinConfig: { type: 'object' },
        outputConfig: { type: 'object' },
        optimizationLevel: { type: 'string', enum: ['none', 'basic', 'advanced'] }
      },
      required: ['datasets', 'joinConfig']
    }
  },
  {
    name: 'bq-partition-analysis',
    description: 'Analyze and recommend optimal partitioning strategies',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        datasetId: { type: 'string' },
        tableId: { type: 'string' },
        dataProfile: { type: 'object' },
        targetQueries: { type: 'array', items: { type: 'string' } }
      },
      required: ['datasetId', 'tableId']
    }
  },
  {
    name: 'bq-performance-profile',
    description: 'Profile query performance and identify bottlenecks',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        projectId: { type: 'string' },
        profilingOptions: { type: 'object' },
        historicalAnalysis: { type: 'object' }
      },
      required: ['query']
    }
  },
  {
    name: 'bq-trend-analysis',
    description: 'Detect trends and patterns in time-series data',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        datasetId: { type: 'string' },
        timeColumn: { type: 'string' },
        analysisWindow: { type: 'object' },
        trendType: { type: 'string', enum: ['linear', 'exponential', 'seasonal', 'decomposition', 'all'] },
        metrics: { type: 'array', items: { type: 'object' } },
        groupBy: { type: 'array', items: { type: 'string' } }
      },
      required: ['datasetId', 'timeColumn', 'analysisWindow']
    }
  }
];