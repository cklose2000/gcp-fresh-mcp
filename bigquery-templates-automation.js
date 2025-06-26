/**
 * BigQuery Templates and Automation Tools for GCP Fresh MCP
 * 
 * This module provides template library, query composition, and automatic indexing
 * recommendation tools for BigQuery operations.
 */

import { z } from 'zod';
import { BigQuery } from '@google-cloud/bigquery';

// Initialize BigQuery client
const bigquery = new BigQuery();

// ============================================================================
// SCHEMAS
// ============================================================================

// Schema for bq-template-library
const templateLibrarySchema = z.object({
  templateCategory: z.enum(['reporting', 'etl', 'data_quality', 'analytics', 'ml_prep']),
  useCase: z.string().describe('Specific use case within the category'),
  customization: z.object({
    dataset: z.string().optional(),
    table: z.string().optional(),
    timeColumn: z.string().optional(),
    dimensions: z.array(z.string()).optional(),
    metrics: z.array(z.string()).optional(),
    filters: z.record(z.any()).optional(),
    timeRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      interval: z.string().optional()
    }).optional()
  }).optional(),
  projectContext: z.string().optional()
});

// Schema for bq-query-composer
const queryComposerSchema = z.object({
  components: z.array(z.object({
    id: z.string(),
    type: z.enum(['source', 'transformation', 'aggregation', 'filter', 'join']),
    query: z.string(),
    dependencies: z.array(z.string()).optional(),
    alias: z.string().optional()
  })),
  compositionStrategy: z.enum(['union', 'join', 'subquery', 'cte', 'materialized']),
  optimizationLevel: z.enum(['none', 'basic', 'advanced']).default('basic'),
  outputFormat: z.object({
    includeExplanation: z.boolean().default(false),
    formatSql: z.boolean().default(true),
    includePerformanceHints: z.boolean().default(true)
  }).optional()
});

// Schema for bq-auto-index
const autoIndexSchema = z.object({
  projectId: z.string(),
  datasetId: z.string(),
  tableId: z.string(),
  queryPatterns: z.array(z.object({
    query: z.string(),
    frequency: z.number().optional(),
    avgExecutionTime: z.number().optional()
  })).optional(),
  recommendationType: z.enum(['clustering', 'partitioning', 'both']).default('both'),
  costAnalysis: z.boolean().default(true)
});

// ============================================================================
// TEMPLATE LIBRARY
// ============================================================================

const templateLibrary = {
  reporting: {
    daily_summary: {
      name: 'Daily Summary Report',
      description: 'Aggregate daily metrics with comparison to previous period',
      template: `
WITH daily_metrics AS (
  SELECT
    DATE({timeColumn}) as report_date,
    {dimensions},
    {metrics}
  FROM \`{dataset}.{table}\`
  WHERE DATE({timeColumn}) BETWEEN '{start}' AND '{end}'
  GROUP BY report_date, {dimensionsList}
),
previous_period AS (
  SELECT
    DATE_ADD(DATE({timeColumn}), INTERVAL {interval} DAY) as report_date,
    {dimensions},
    {metrics}
  FROM \`{dataset}.{table}\`
  WHERE DATE({timeColumn}) BETWEEN DATE_SUB('{start}', INTERVAL {interval} DAY) 
    AND DATE_SUB('{end}', INTERVAL {interval} DAY)
  GROUP BY report_date, {dimensionsList}
)
SELECT
  d.report_date,
  {dimensionsSelect},
  {currentMetrics},
  {previousMetrics},
  {percentageChanges}
FROM daily_metrics d
LEFT JOIN previous_period p
  ON d.report_date = p.report_date {dimensionJoins}
ORDER BY d.report_date DESC`
    },
    cohort_analysis: {
      name: 'Cohort Analysis',
      description: 'User/customer cohort analysis for retention and behavior patterns',
      template: `
WITH cohorts AS (
  SELECT
    {cohortId} as cohort_id,
    DATE_TRUNC({cohortDate}, {cohortPeriod}) as cohort_period,
    COUNT(DISTINCT {userId}) as cohort_size
  FROM \`{dataset}.{table}\`
  WHERE {cohortFilter}
  GROUP BY cohort_id, cohort_period
),
cohort_data AS (
  SELECT
    c.cohort_id,
    c.cohort_period,
    DATE_DIFF({activityDate}, c.cohort_period, {cohortPeriod}) as periods_since_cohort,
    COUNT(DISTINCT a.{userId}) as active_users,
    {additionalMetrics}
  FROM cohorts c
  JOIN \`{dataset}.{activityTable}\` a
    ON c.cohort_id = a.{cohortId}
  WHERE a.{activityDate} >= c.cohort_period
  GROUP BY c.cohort_id, c.cohort_period, periods_since_cohort
)
SELECT
  cohort_period,
  periods_since_cohort,
  SUM(active_users) as total_active,
  SAFE_DIVIDE(SUM(active_users), SUM(cohort_size)) as retention_rate,
  {aggregatedMetrics}
FROM cohort_data
JOIN cohorts USING (cohort_id, cohort_period)
GROUP BY cohort_period, periods_since_cohort
ORDER BY cohort_period, periods_since_cohort`
    }
  },
  
  etl: {
    incremental_load: {
      name: 'Incremental Data Load',
      description: 'Load only new or modified records since last execution',
      template: `
-- Create temporary table for staging
CREATE TEMP TABLE staging_data AS
SELECT
  *,
  CURRENT_TIMESTAMP() as _loaded_at,
  '{loadId}' as _load_id
FROM \`{sourceDataset}.{sourceTable}\`
WHERE {updateColumn} > (
  SELECT IFNULL(MAX({updateColumn}), TIMESTAMP('1900-01-01'))
  FROM \`{targetDataset}.{targetTable}\`
);

-- Merge into target table
MERGE \`{targetDataset}.{targetTable}\` t
USING staging_data s
ON {primaryKey}
WHEN MATCHED AND s.{updateColumn} > t.{updateColumn} THEN
  UPDATE SET {updateColumns}
WHEN NOT MATCHED THEN
  INSERT ({insertColumns})
  VALUES ({insertValues});

-- Log load statistics
INSERT INTO \`{targetDataset}.{loadLogTable}\` (
  load_id,
  load_timestamp,
  records_inserted,
  records_updated,
  source_table,
  target_table
)
SELECT
  '{loadId}',
  CURRENT_TIMESTAMP(),
  COUNT(CASE WHEN t.{primaryKeyField} IS NULL THEN 1 END),
  COUNT(CASE WHEN t.{primaryKeyField} IS NOT NULL THEN 1 END),
  '{sourceDataset}.{sourceTable}',
  '{targetDataset}.{targetTable}'
FROM staging_data s
LEFT JOIN \`{targetDataset}.{targetTable}\` t
  ON {primaryKey};`
    },
    
    data_deduplication: {
      name: 'Data Deduplication',
      description: 'Remove duplicate records based on specified criteria',
      template: `
-- Identify and remove duplicates
CREATE OR REPLACE TABLE \`{dataset}.{table}_deduped\` AS
WITH ranked_data AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY {deduplicationKeys}
      ORDER BY {orderByColumn} DESC
    ) as rn
  FROM \`{dataset}.{table}\`
)
SELECT
  * EXCEPT(rn)
FROM ranked_data
WHERE rn = 1;

-- Verify deduplication results
SELECT
  'Original' as dataset,
  COUNT(*) as total_records,
  COUNT(DISTINCT CONCAT({deduplicationKeys})) as unique_records,
  COUNT(*) - COUNT(DISTINCT CONCAT({deduplicationKeys})) as duplicates
FROM \`{dataset}.{table}\`
UNION ALL
SELECT
  'Deduped' as dataset,
  COUNT(*) as total_records,
  COUNT(DISTINCT CONCAT({deduplicationKeys})) as unique_records,
  0 as duplicates
FROM \`{dataset}.{table}_deduped\`;`
    }
  },
  
  data_quality: {
    quality_checks: {
      name: 'Comprehensive Data Quality Checks',
      description: 'Run multiple data quality validations on a table',
      template: `
WITH quality_metrics AS (
  SELECT
    -- Completeness checks
    COUNT(*) as total_records,
    {nullChecks},
    
    -- Uniqueness checks
    COUNT(DISTINCT {primaryKey}) as unique_primary_keys,
    
    -- Validity checks
    {validityChecks},
    
    -- Consistency checks
    {consistencyChecks}
  FROM \`{dataset}.{table}\`
),
quality_summary AS (
  SELECT
    'Completeness' as check_type,
    'Primary Key Nulls' as check_name,
    CASE WHEN null_primary_keys = 0 THEN 'PASS' ELSE 'FAIL' END as status,
    CONCAT(null_primary_keys, ' / ', total_records) as details
  FROM quality_metrics
  
  UNION ALL
  
  SELECT
    'Uniqueness' as check_type,
    'Primary Key Duplicates' as check_name,
    CASE WHEN unique_primary_keys = total_records THEN 'PASS' ELSE 'FAIL' END as status,
    CONCAT(total_records - unique_primary_keys, ' duplicates found') as details
  FROM quality_metrics
  
  {additionalChecks}
)
SELECT
  check_type,
  check_name,
  status,
  details,
  CURRENT_TIMESTAMP() as check_timestamp
FROM quality_summary
ORDER BY 
  CASE status WHEN 'FAIL' THEN 1 ELSE 2 END,
  check_type,
  check_name;`
    }
  },
  
  analytics: {
    funnel_analysis: {
      name: 'Conversion Funnel Analysis',
      description: 'Analyze user conversion through defined funnel steps',
      template: `
WITH funnel_steps AS (
  SELECT
    {userId} as user_id,
    {sessionId} as session_id,
    TIMESTAMP({eventTime}) as event_time,
    {eventName} as event_name,
    {eventProperties}
  FROM \`{dataset}.{eventsTable}\`
  WHERE DATE({eventTime}) BETWEEN '{startDate}' AND '{endDate}'
    AND {eventName} IN ({funnelSteps})
),
user_funnel AS (
  SELECT
    user_id,
    session_id,
    MAX(CASE WHEN event_name = '{step1}' THEN event_time END) as step1_time,
    MAX(CASE WHEN event_name = '{step2}' THEN event_time END) as step2_time,
    MAX(CASE WHEN event_name = '{step3}' THEN event_time END) as step3_time,
    MAX(CASE WHEN event_name = '{step4}' THEN event_time END) as step4_time,
    MAX(CASE WHEN event_name = '{step5}' THEN event_time END) as step5_time
  FROM funnel_steps
  GROUP BY user_id, session_id
)
SELECT
  'Funnel Overview' as metric_type,
  COUNT(DISTINCT CASE WHEN step1_time IS NOT NULL THEN user_id END) as step1_users,
  COUNT(DISTINCT CASE WHEN step2_time IS NOT NULL AND step2_time > step1_time THEN user_id END) as step2_users,
  COUNT(DISTINCT CASE WHEN step3_time IS NOT NULL AND step3_time > step2_time THEN user_id END) as step3_users,
  COUNT(DISTINCT CASE WHEN step4_time IS NOT NULL AND step4_time > step3_time THEN user_id END) as step4_users,
  COUNT(DISTINCT CASE WHEN step5_time IS NOT NULL AND step5_time > step4_time THEN user_id END) as step5_users,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN step5_time IS NOT NULL AND step5_time > step4_time THEN user_id END),
    COUNT(DISTINCT CASE WHEN step1_time IS NOT NULL THEN user_id END)
  ) as overall_conversion_rate
FROM user_funnel;`
    },
    
    time_series_decomposition: {
      name: 'Time Series Decomposition',
      description: 'Decompose time series data into trend, seasonal, and residual components',
      template: `
WITH time_series_data AS (
  SELECT
    DATE({dateColumn}) as date,
    SUM({metricColumn}) as metric_value
  FROM \`{dataset}.{table}\`
  WHERE DATE({dateColumn}) BETWEEN '{startDate}' AND '{endDate}'
  GROUP BY date
),
moving_averages AS (
  SELECT
    date,
    metric_value,
    AVG(metric_value) OVER (
      ORDER BY date
      ROWS BETWEEN 6 PRECEDING AND 6 FOLLOWING
    ) as ma_13,
    AVG(metric_value) OVER (
      ORDER BY date
      ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING
    ) as ma_5
  FROM time_series_data
),
trend_component AS (
  SELECT
    date,
    metric_value,
    ma_13 as trend,
    metric_value - ma_13 as detrended
  FROM moving_averages
),
seasonal_component AS (
  SELECT
    date,
    metric_value,
    trend,
    detrended,
    AVG(detrended) OVER (
      PARTITION BY EXTRACT(DAYOFWEEK FROM date)
      ORDER BY date
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as seasonal
  FROM trend_component
)
SELECT
  date,
  metric_value as original,
  IFNULL(trend, metric_value) as trend,
  IFNULL(seasonal, 0) as seasonal,
  metric_value - IFNULL(trend, metric_value) - IFNULL(seasonal, 0) as residual,
  SAFE_DIVIDE(
    ABS(metric_value - IFNULL(trend, metric_value) - IFNULL(seasonal, 0)),
    metric_value
  ) as residual_pct
FROM seasonal_component
ORDER BY date;`
    }
  },
  
  ml_prep: {
    feature_engineering: {
      name: 'Feature Engineering for ML',
      description: 'Prepare features for machine learning models',
      template: `
WITH base_features AS (
  SELECT
    {targetId} as id,
    {targetVariable} as target,
    
    -- Numerical features
    {numericalFeatures},
    
    -- Categorical encoding
    {categoricalFeatures},
    
    -- Temporal features
    EXTRACT(YEAR FROM {dateColumn}) as year,
    EXTRACT(MONTH FROM {dateColumn}) as month,
    EXTRACT(DAYOFWEEK FROM {dateColumn}) as dayofweek,
    EXTRACT(HOUR FROM {dateColumn}) as hour,
    DATE_DIFF(CURRENT_DATE(), DATE({dateColumn}), DAY) as days_since,
    
    -- Window features
    {windowFeatures}
  FROM \`{dataset}.{table}\`
  WHERE {filterConditions}
),
feature_stats AS (
  SELECT
    -- Calculate statistics for normalization
    {featureStats}
  FROM base_features
),
normalized_features AS (
  SELECT
    id,
    target,
    
    -- Normalize numerical features
    {normalizedFeatures},
    
    -- Keep categorical features as-is
    {categoricalSelect}
  FROM base_features
  CROSS JOIN feature_stats
)
SELECT
  *,
  -- Add interaction features
  {interactionFeatures}
FROM normalized_features;`
    },
    
    train_test_split: {
      name: 'Train/Test/Validation Split',
      description: 'Split data into training, testing, and validation sets',
      template: `
WITH data_with_hash AS (
  SELECT
    *,
    FARM_FINGERPRINT(CAST({splitKey} AS STRING)) as hash_value
  FROM \`{dataset}.{table}\`
),
data_with_split AS (
  SELECT
    *,
    CASE
      WHEN MOD(ABS(hash_value), 100) < {trainPercent} THEN 'TRAIN'
      WHEN MOD(ABS(hash_value), 100) < {trainPercent} + {testPercent} THEN 'TEST'
      ELSE 'VALIDATION'
    END as split_type
  FROM data_with_hash
)
-- Create split tables
CREATE OR REPLACE TABLE \`{dataset}.{table}_train\` AS
SELECT * EXCEPT(hash_value, split_type)
FROM data_with_split
WHERE split_type = 'TRAIN';

CREATE OR REPLACE TABLE \`{dataset}.{table}_test\` AS
SELECT * EXCEPT(hash_value, split_type)
FROM data_with_split
WHERE split_type = 'TEST';

CREATE OR REPLACE TABLE \`{dataset}.{table}_validation\` AS
SELECT * EXCEPT(hash_value, split_type)
FROM data_with_split
WHERE split_type = 'VALIDATION';

-- Verify split proportions
SELECT
  split_type,
  COUNT(*) as record_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM data_with_split
GROUP BY split_type
ORDER BY split_type;`
    }
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Substitute template parameters with actual values
 */
function substituteTemplate(template, params) {
  let result = template;
  
  // Handle array parameters (convert to comma-separated lists)
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value.join(', '));
      result = result.replace(new RegExp(`{${key}List}`, 'g'), value.join(', '));
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested objects
      Object.entries(value).forEach(([subKey, subValue]) => {
        result = result.replace(new RegExp(`{${subKey}}`, 'g'), subValue);
      });
    } else {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
  });
  
  return result;
}

/**
 * Analyze query patterns to identify optimization opportunities
 */
function analyzeQueryPatterns(queries) {
  const patterns = {
    filterColumns: new Map(),
    joinColumns: new Map(),
    groupByColumns: new Map(),
    orderByColumns: new Map(),
    aggregations: new Map()
  };
  
  queries.forEach(({ query, frequency = 1 }) => {
    // Extract filter columns
    const whereMatches = query.match(/WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)/is);
    if (whereMatches) {
      const conditions = whereMatches[1].split(/\s+AND\s+/i);
      conditions.forEach(cond => {
        const colMatch = cond.match(/(\w+)\s*[=<>]/);
        if (colMatch) {
          const col = colMatch[1];
          patterns.filterColumns.set(col, (patterns.filterColumns.get(col) || 0) + frequency);
        }
      });
    }
    
    // Extract join columns
    const joinMatches = query.matchAll(/JOIN\s+.+?\s+ON\s+(.+?)(?:WHERE|GROUP|ORDER|JOIN|$)/gis);
    for (const match of joinMatches) {
      const conditions = match[1].split(/\s+AND\s+/i);
      conditions.forEach(cond => {
        const colMatch = cond.match(/(\w+)\s*=\s*\w+\.(\w+)/);
        if (colMatch) {
          patterns.joinColumns.set(colMatch[2], (patterns.joinColumns.get(colMatch[2]) || 0) + frequency);
        }
      });
    }
    
    // Extract group by columns
    const groupByMatch = query.match(/GROUP\s+BY\s+(.+?)(?:HAVING|ORDER|LIMIT|$)/is);
    if (groupByMatch) {
      const columns = groupByMatch[1].split(',').map(c => c.trim());
      columns.forEach(col => {
        patterns.groupByColumns.set(col, (patterns.groupByColumns.get(col) || 0) + frequency);
      });
    }
    
    // Extract order by columns
    const orderByMatch = query.match(/ORDER\s+BY\s+(.+?)(?:LIMIT|$)/is);
    if (orderByMatch) {
      const columns = orderByMatch[1].split(',').map(c => c.trim().split(/\s+/)[0]);
      columns.forEach(col => {
        patterns.orderByColumns.set(col, (patterns.orderByColumns.get(col) || 0) + frequency);
      });
    }
  });
  
  return patterns;
}

/**
 * Generate index recommendations based on query patterns
 */
function generateIndexRecommendations(patterns, tableInfo) {
  const recommendations = [];
  
  // Sort columns by usage frequency
  const sortByFrequency = (map) => 
    Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  
  // Clustering recommendations
  const topFilterColumns = sortByFrequency(patterns.filterColumns).slice(0, 4);
  const topGroupByColumns = sortByFrequency(patterns.groupByColumns).slice(0, 4);
  
  if (topFilterColumns.length > 0) {
    recommendations.push({
      type: 'clustering',
      columns: topFilterColumns.map(([col]) => col),
      reason: 'Frequently used in WHERE clauses',
      impact: 'High',
      confidence: 0.9
    });
  }
  
  if (topGroupByColumns.length > 0 && topGroupByColumns[0][0] !== topFilterColumns[0]?.[0]) {
    recommendations.push({
      type: 'clustering',
      columns: topGroupByColumns.map(([col]) => col),
      reason: 'Frequently used in GROUP BY clauses',
      impact: 'Medium',
      confidence: 0.8
    });
  }
  
  // Partitioning recommendations
  const dateColumns = Array.from(patterns.filterColumns.keys()).filter(col => 
    col.toLowerCase().includes('date') || col.toLowerCase().includes('time')
  );
  
  if (dateColumns.length > 0 && !tableInfo.partitioned) {
    recommendations.push({
      type: 'partitioning',
      column: dateColumns[0],
      partitionType: 'TIME',
      reason: 'Date/time column frequently used in filters',
      impact: 'High',
      confidence: 0.95
    });
  }
  
  return recommendations;
}

/**
 * Compose queries based on components and strategy
 */
function composeQueries(components, strategy, optimizationLevel) {
  // Sort components by dependencies
  const sorted = topologicalSort(components);
  
  switch (strategy) {
    case 'cte':
      return composeCTE(sorted, optimizationLevel);
    case 'subquery':
      return composeSubquery(sorted, optimizationLevel);
    case 'join':
      return composeJoin(sorted, optimizationLevel);
    case 'union':
      return composeUnion(sorted, optimizationLevel);
    case 'materialized':
      return composeMaterialized(sorted, optimizationLevel);
    default:
      throw new Error(`Unknown composition strategy: ${strategy}`);
  }
}

/**
 * Topological sort for component dependencies
 */
function topologicalSort(components) {
  const visited = new Set();
  const result = [];
  
  function visit(component) {
    if (visited.has(component.id)) return;
    visited.add(component.id);
    
    if (component.dependencies) {
      component.dependencies.forEach(depId => {
        const dep = components.find(c => c.id === depId);
        if (dep) visit(dep);
      });
    }
    
    result.push(component);
  }
  
  components.forEach(visit);
  return result;
}

/**
 * Compose queries using Common Table Expressions
 */
function composeCTE(components, optimizationLevel) {
  const ctes = components.map(comp => 
    `${comp.alias || comp.id} AS (\n${comp.query}\n)`
  ).join(',\n');
  
  const finalComponent = components[components.length - 1];
  const finalQuery = `WITH ${ctes}\nSELECT * FROM ${finalComponent.alias || finalComponent.id}`;
  
  if (optimizationLevel === 'advanced') {
    return optimizeCTEQuery(finalQuery);
  }
  
  return finalQuery;
}

/**
 * Compose queries using subqueries
 */
function composeSubquery(components, optimizationLevel) {
  let query = components[components.length - 1].query;
  
  for (let i = components.length - 2; i >= 0; i--) {
    const comp = components[i];
    const placeholder = new RegExp(`\\b${comp.id}\\b`, 'g');
    query = query.replace(placeholder, `(${comp.query})`);
  }
  
  return query;
}

/**
 * Compose queries using joins
 */
function composeJoin(components, optimizationLevel) {
  const base = components[0];
  let query = `SELECT * FROM (${base.query}) ${base.alias || base.id}`;
  
  for (let i = 1; i < components.length; i++) {
    const comp = components[i];
    query += `\nJOIN (${comp.query}) ${comp.alias || comp.id} USING (${comp.joinKey || 'id'})`;
  }
  
  return query;
}

/**
 * Compose queries using UNION
 */
function composeUnion(components, optimizationLevel) {
  return components.map(comp => comp.query).join('\nUNION ALL\n');
}

/**
 * Compose queries for materialized views
 */
function composeMaterialized(components, optimizationLevel) {
  const views = [];
  
  components.forEach((comp, index) => {
    views.push(`
CREATE OR REPLACE VIEW \`{{dataset}}.${comp.id}_view\` AS
${comp.query};`);
  });
  
  const finalView = `
-- Final aggregated view
CREATE OR REPLACE VIEW \`{{dataset}}.final_view\` AS
SELECT * FROM \`{{dataset}}.${components[components.length - 1].id}_view\`;`;
  
  return views.join('\n') + '\n' + finalView;
}

/**
 * Optimize CTE query
 */
function optimizeCTEQuery(query) {
  // Add optimization hints
  let optimized = query;
  
  // Add clustering hints for large CTEs
  optimized = optimized.replace(/AS \(/g, 'AS (\n  -- @{USE_CLUSTERING}\n  ');
  
  return optimized;
}

// ============================================================================
// MAIN TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * bq-template-library: Common analytics query templates
 */
export async function bqTemplateLibrary(args) {
  try {
    const params = templateLibrarySchema.parse(args);
    const { templateCategory, useCase, customization = {}, projectContext } = params;
    
    // Get the template
    const categoryTemplates = templateLibrary[templateCategory];
    if (!categoryTemplates) {
      throw new Error(`Unknown template category: ${templateCategory}`);
    }
    
    const template = categoryTemplates[useCase];
    if (!template) {
      const availableUseCases = Object.keys(categoryTemplates);
      throw new Error(`Unknown use case '${useCase}' for category '${templateCategory}'. Available: ${availableUseCases.join(', ')}`);
    }
    
    // Apply customizations
    let query = template.template;
    if (customization && Object.keys(customization).length > 0) {
      query = substituteTemplate(query, customization);
    }
    
    // Add project context if provided
    if (projectContext) {
      query = query.replace(/`/g, `\`${projectContext}.`);
    }
    
    // Get list of required parameters that weren't provided
    const missingParams = [];
    const paramMatches = query.matchAll(/{(\w+)}/g);
    for (const match of paramMatches) {
      const param = match[1];
      if (!customization[param] && !customization[param.replace(/List$/, '')]) {
        missingParams.push(param);
      }
    }
    
    return {
      content: [{
        type: "text",
        text: `Generated ${template.name} template:\n\`\`\`sql\n${query}\n\`\`\`\n\n` +
              `Description: ${template.description}\n` +
              `Category: ${templateCategory}\n` +
              `Use Case: ${useCase}\n` +
              (missingParams.length > 0 ? `\nRequired parameters to customize: ${missingParams.join(', ')}` : '') +
              `\n\nAvailable templates in '${templateCategory}' category: ${Object.keys(categoryTemplates).join(', ')}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error accessing template library: ${error.message}`
      }]
    };
  }
}

/**
 * bq-query-composer: Compose complex queries from components
 */
export async function bqQueryComposer(args) {
  try {
    const params = queryComposerSchema.parse(args);
    const { components, compositionStrategy, optimizationLevel, outputFormat = {} } = params;
    
    // Validate component dependencies
    const componentIds = new Set(components.map(c => c.id));
    for (const comp of components) {
      if (comp.dependencies) {
        for (const dep of comp.dependencies) {
          if (!componentIds.has(dep)) {
            throw new Error(`Component '${comp.id}' depends on unknown component '${dep}'`);
          }
        }
      }
    }
    
    // Compose the query
    const composedQuery = composeQueries(components, compositionStrategy, optimizationLevel);
    
    // Format output
    let output = '';
    
    if (outputFormat.includeExplanation) {
      output += `Composition Strategy: ${compositionStrategy}\n`;
      output += `Optimization Level: ${optimizationLevel}\n`;
      output += `Components: ${components.length}\n\n`;
    }
    
    output += 'Composed Query:\n```sql\n';
    output += outputFormat.formatSql ? composedQuery : composedQuery;
    output += '\n```';
    
    if (outputFormat.includePerformanceHints) {
      output += '\n\nPerformance Hints:\n';
      
      switch (compositionStrategy) {
        case 'cte':
          output += '- CTEs are materialized once and can improve performance for repeated references\n';
          output += '- Consider creating materialized views for frequently used CTEs\n';
          break;
        case 'subquery':
          output += '- Subqueries are evaluated for each row; consider CTEs for better performance\n';
          output += '- Ensure proper indexing on join columns\n';
          break;
        case 'join':
          output += '- Ensure join columns are properly indexed or clustered\n';
          output += '- Consider join order for optimal performance\n';
          break;
        case 'union':
          output += '- UNION ALL is more performant than UNION (which removes duplicates)\n';
          output += '- Ensure consistent column types across all components\n';
          break;
        case 'materialized':
          output += '- Materialized views improve query performance but require storage\n';
          output += '- Consider refresh frequency based on data update patterns\n';
          break;
      }
    }
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error composing query: ${error.message}`
      }]
    };
  }
}

/**
 * bq-auto-index: Automatic index recommendations
 */
export async function bqAutoIndex(args) {
  try {
    const params = autoIndexSchema.parse(args);
    const { projectId, datasetId, tableId, queryPatterns = [], recommendationType, costAnalysis } = params;
    
    // Get table metadata
    const table = bigquery.dataset(datasetId, { projectId }).table(tableId);
    const [metadata] = await table.getMetadata();
    
    const tableInfo = {
      totalRows: metadata.numRows,
      totalBytes: metadata.numBytes,
      partitioned: !!metadata.timePartitioning,
      clustered: !!metadata.clustering,
      currentClustering: metadata.clustering?.fields || [],
      currentPartitioning: metadata.timePartitioning?.field
    };
    
    // Analyze query patterns
    const patterns = analyzeQueryPatterns(queryPatterns);
    
    // Generate recommendations
    const recommendations = generateIndexRecommendations(patterns, tableInfo);
    
    // Filter by recommendation type
    const filteredRecommendations = recommendations.filter(rec => {
      if (recommendationType === 'clustering') return rec.type === 'clustering';
      if (recommendationType === 'partitioning') return rec.type === 'partitioning';
      return true; // 'both'
    });
    
    // Generate implementation scripts
    const scripts = filteredRecommendations.map(rec => {
      if (rec.type === 'clustering') {
        return `
-- Clustering recommendation: ${rec.reason}
CREATE OR REPLACE TABLE \`${projectId}.${datasetId}.${tableId}_clustered\` 
CLUSTER BY ${rec.columns.join(', ')}
AS SELECT * FROM \`${projectId}.${datasetId}.${tableId}\`;

-- Rename tables to apply clustering
ALTER TABLE \`${projectId}.${datasetId}.${tableId}\` RENAME TO \`${projectId}.${datasetId}.${tableId}_backup\`;
ALTER TABLE \`${projectId}.${datasetId}.${tableId}_clustered\` RENAME TO \`${projectId}.${datasetId}.${tableId}\`;`;
      } else if (rec.type === 'partitioning') {
        return `
-- Partitioning recommendation: ${rec.reason}
CREATE OR REPLACE TABLE \`${projectId}.${datasetId}.${tableId}_partitioned\`
PARTITION BY DATE(${rec.column})
${tableInfo.clustered ? `CLUSTER BY ${tableInfo.currentClustering.join(', ')}` : ''}
AS SELECT * FROM \`${projectId}.${datasetId}.${tableId}\`;

-- Rename tables to apply partitioning
ALTER TABLE \`${projectId}.${datasetId}.${tableId}\` RENAME TO \`${projectId}.${datasetId}.${tableId}_backup\`;
ALTER TABLE \`${projectId}.${datasetId}.${tableId}_partitioned\` RENAME TO \`${projectId}.${datasetId}.${tableId}\`;`;
      }
      return '';
    });
    
    // Cost analysis
    let costEstimate = '';
    if (costAnalysis) {
      const storageCostPerTB = 20; // USD per TB per month
      const currentStorageGB = parseInt(tableInfo.totalBytes) / (1024 * 1024 * 1024);
      const currentStorageCost = (currentStorageGB / 1024) * storageCostPerTB;
      
      costEstimate = `
      
Cost Analysis:
- Current table size: ${currentStorageGB.toFixed(2)} GB
- Current storage cost: $${currentStorageCost.toFixed(2)}/month
- Clustering overhead: ~5% temporary storage during rebuild
- Partitioning can reduce query costs by 50-95% for time-filtered queries
- No ongoing storage cost increase for clustering or partitioning`;
    }
    
    // Format output
    const output = `
Index Recommendation Analysis for ${projectId}.${datasetId}.${tableId}

Table Information:
- Total rows: ${parseInt(tableInfo.totalRows).toLocaleString()}
- Total size: ${(parseInt(tableInfo.totalBytes) / (1024 * 1024 * 1024)).toFixed(2)} GB
- Currently partitioned: ${tableInfo.partitioned ? 'Yes (' + tableInfo.currentPartitioning + ')' : 'No'}
- Currently clustered: ${tableInfo.clustered ? 'Yes (' + tableInfo.currentClustering.join(', ') + ')' : 'No'}

Query Pattern Analysis:
- Analyzed queries: ${queryPatterns.length}
- Most filtered columns: ${Array.from(patterns.filterColumns.entries()).slice(0, 3).map(([col, count]) => `${col} (${count})`).join(', ')}
- Most used in GROUP BY: ${Array.from(patterns.groupByColumns.entries()).slice(0, 3).map(([col, count]) => `${col} (${count})`).join(', ')}

Recommendations (${filteredRecommendations.length}):
${filteredRecommendations.map((rec, i) => `
${i + 1}. ${rec.type.toUpperCase()} Recommendation
   - Columns: ${Array.isArray(rec.columns) ? rec.columns.join(', ') : rec.column}
   - Reason: ${rec.reason}
   - Impact: ${rec.impact}
   - Confidence: ${(rec.confidence * 100).toFixed(0)}%`).join('\n')}

Implementation Scripts:
${scripts.join('\n')}
${costEstimate}

Next Steps:
1. Review recommendations and validate against your use cases
2. Test on a sample dataset first
3. Schedule implementation during low-traffic period
4. Monitor query performance improvements after implementation`;
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error generating index recommendations: ${error.message}`
      }]
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export individual functions
export {
  bqTemplateLibrary as bq_template_library,
  bqQueryComposer as bq_query_composer,
  bqAutoIndex as bq_auto_index
};

// Export tools array for MCP integration
export const templateAutomationTools = [
  {
    name: "bq-template-library",
    description: "Access common analytics query templates for reporting, ETL, data quality, analytics, and ML preparation",
    inputSchema: {
      type: "object",
      properties: {
        templateCategory: {
          type: "string",
          enum: ["reporting", "etl", "data_quality", "analytics", "ml_prep"],
          description: "Category of templates to access"
        },
        useCase: {
          type: "string",
          description: "Specific use case within the category"
        },
        customization: {
          type: "object",
          description: "Parameters to customize the template",
          properties: {
            dataset: { type: "string" },
            table: { type: "string" },
            timeColumn: { type: "string" },
            dimensions: { type: "array", items: { type: "string" } },
            metrics: { type: "array", items: { type: "string" } },
            filters: { type: "object" },
            timeRange: {
              type: "object",
              properties: {
                start: { type: "string" },
                end: { type: "string" },
                interval: { type: "string" }
              }
            }
          }
        },
        projectContext: {
          type: "string",
          description: "Optional project ID for context"
        }
      },
      required: ["templateCategory", "useCase"]
    }
  },
  {
    name: "bq-query-composer",
    description: "Compose complex queries from multiple components using various strategies",
    inputSchema: {
      type: "object",
      properties: {
        components: {
          type: "array",
          description: "Query components to compose",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: {
                type: "string",
                enum: ["source", "transformation", "aggregation", "filter", "join"]
              },
              query: { type: "string" },
              dependencies: {
                type: "array",
                items: { type: "string" }
              },
              alias: { type: "string" }
            },
            required: ["id", "type", "query"]
          }
        },
        compositionStrategy: {
          type: "string",
          enum: ["union", "join", "subquery", "cte", "materialized"],
          description: "Strategy for composing components"
        },
        optimizationLevel: {
          type: "string",
          enum: ["none", "basic", "advanced"],
          default: "basic"
        },
        outputFormat: {
          type: "object",
          properties: {
            includeExplanation: { type: "boolean", default: false },
            formatSql: { type: "boolean", default: true },
            includePerformanceHints: { type: "boolean", default: true }
          }
        }
      },
      required: ["components", "compositionStrategy"]
    }
  },
  {
    name: "bq-auto-index",
    description: "Analyze query patterns and recommend indexing strategies (clustering and partitioning)",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "GCP project ID"
        },
        datasetId: {
          type: "string",
          description: "BigQuery dataset ID"
        },
        tableId: {
          type: "string",
          description: "BigQuery table ID"
        },
        queryPatterns: {
          type: "array",
          description: "Sample queries to analyze",
          items: {
            type: "object",
            properties: {
              query: { type: "string" },
              frequency: { type: "number" },
              avgExecutionTime: { type: "number" }
            },
            required: ["query"]
          }
        },
        recommendationType: {
          type: "string",
          enum: ["clustering", "partitioning", "both"],
          default: "both"
        },
        costAnalysis: {
          type: "boolean",
          default: true,
          description: "Include cost analysis in recommendations"
        }
      },
      required: ["projectId", "datasetId", "tableId"]
    }
  }
];