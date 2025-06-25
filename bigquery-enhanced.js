import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

// Helper to format parameters based on type
function formatParameter(param) {
  switch(param.type?.toUpperCase()) {
    case 'DATE':
      return `DATE '${param.value}'`;
    case 'TIMESTAMP':
      return `TIMESTAMP '${param.value}'`;
    case 'DATETIME':
      return `DATETIME '${param.value}'`;
    case 'TIME':
      return `TIME '${param.value}'`;
    case 'STRING':
      return `'${param.value.replace(/'/g, "''")}'`; // Escape single quotes
    case 'INT64':
    case 'FLOAT64':
    case 'NUMERIC':
    case 'BIGNUMERIC':
    case 'BOOL':
      return param.value;
    case 'BYTES':
      return `B"${param.value}"`;
    case 'ARRAY':
      return `[${param.value.map(v => formatParameter({value: v, type: param.elementType})).join(', ')}]`;
    case 'STRUCT':
      return `STRUCT(${Object.entries(param.value).map(([k, v]) => `${v} AS ${k}`).join(', ')})`;
    default:
      // Try to infer type
      if (typeof param.value === 'string') {
        return `'${param.value.replace(/'/g, "''")}'`;
      }
      return param.value;
  }
}

// Helper to format values for DML operations
function formatValue(value, type) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (type) {
    return formatParameter({ value, type });
  }
  
  // Auto-infer type
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  } else if (typeof value === 'number') {
    return value;
  } else if (typeof value === 'boolean') {
    return value;
  } else if (Array.isArray(value)) {
    return `[${value.map(v => formatValue(v)).join(', ')}]`;
  } else if (typeof value === 'object') {
    const pairs = Object.entries(value).map(([k, v]) => `${formatValue(v)} AS ${k}`);
    return `STRUCT(${pairs.join(', ')})`;
  }
  
  return value;
}

// Helper to build CREATE TABLE DDL
function buildCreateTableDDL(args) {
  let ddl = `CREATE TABLE`;
  
  if (args.orReplace) {
    ddl = `CREATE OR REPLACE TABLE`;
  } else if (args.ifNotExists) {
    ddl = `CREATE TABLE IF NOT EXISTS`;
  }
  
  ddl += ` \`${args.projectId || bigquery.projectId}.${args.datasetId}.${args.tableId}\``;
  
  // Add column definitions
  if (args.schema && args.schema.length > 0) {
    const columns = args.schema.map(field => {
      let columnDef = `${field.name} ${field.type}`;
      if (field.mode === 'REQUIRED') {
        columnDef += ' NOT NULL';
      }
      if (field.description) {
        columnDef += ` OPTIONS(description="${field.description}")`;
      }
      return columnDef;
    });
    ddl += ` (${columns.join(', ')})`;
  }
  
  // Add partitioning
  if (args.partitioning) {
    if (args.partitioning.type === 'TIME') {
      ddl += ` PARTITION BY ${args.partitioning.field}`;
      if (args.partitioning.granularity && args.partitioning.granularity !== 'DAY') {
        ddl += `(${args.partitioning.granularity})`;
      }
    } else if (args.partitioning.type === 'RANGE') {
      ddl += ` PARTITION BY RANGE_BUCKET(${args.partitioning.field}, GENERATE_ARRAY(${args.partitioning.range.start}, ${args.partitioning.range.end}, ${args.partitioning.range.interval}))`;
    }
  }
  
  // Add clustering
  if (args.clustering && args.clustering.length > 0) {
    ddl += ` CLUSTER BY ${args.clustering.join(', ')}`;
  }
  
  // Add table options
  const options = [];
  if (args.description) {
    options.push(`description="${args.description}"`);
  }
  if (args.labels && Object.keys(args.labels).length > 0) {
    const labelPairs = Object.entries(args.labels).map(([k, v]) => `"${k}"="${v}"`);
    options.push(`labels=[${labelPairs.join(', ')}]`);
  }
  if (args.expirationTime) {
    options.push(`expiration_timestamp=TIMESTAMP("${args.expirationTime}")`);
  }
  
  if (options.length > 0) {
    ddl += ` OPTIONS(${options.join(', ')})`;
  }
  
  // Add AS SELECT clause if provided
  if (args.query) {
    ddl += ` AS (${args.query})`;
  }
  
  return ddl;
}

// Helper to build ALTER TABLE DDL
function buildAlterTableDDL(args) {
  const tableRef = `\`${args.projectId || bigquery.projectId}.${args.datasetId}.${args.tableId}\``;
  let ddl = `ALTER TABLE ${tableRef}`;
  
  switch (args.operation.toUpperCase()) {
    case 'ADD_COLUMN':
      ddl += ` ADD COLUMN ${args.columnName} ${args.columnType}`;
      if (args.columnMode === 'REQUIRED') {
        ddl += ' NOT NULL';
      }
      if (args.columnDescription) {
        ddl += ` OPTIONS(description="${args.columnDescription}")`;
      }
      break;
      
    case 'DROP_COLUMN':
      ddl += ` DROP COLUMN ${args.columnName}`;
      break;
      
    case 'RENAME_COLUMN':
      ddl += ` RENAME COLUMN ${args.oldColumnName} TO ${args.newColumnName}`;
      break;
      
    case 'ALTER_COLUMN_TYPE':
      ddl += ` ALTER COLUMN ${args.columnName} SET DATA TYPE ${args.newType}`;
      break;
      
    case 'ALTER_COLUMN_OPTIONS':
      const options = [];
      if (args.description !== undefined) {
        options.push(`description="${args.description}"`);
      }
      if (options.length > 0) {
        ddl += ` ALTER COLUMN ${args.columnName} SET OPTIONS(${options.join(', ')})`;
      }
      break;
      
    case 'SET_OPTIONS':
      const tableOptions = [];
      if (args.description !== undefined) {
        tableOptions.push(`description="${args.description}"`);
      }
      if (args.labels) {
        const labelPairs = Object.entries(args.labels).map(([k, v]) => `"${k}"="${v}"`);
        tableOptions.push(`labels=[${labelPairs.join(', ')}]`);
      }
      if (args.expirationTime) {
        tableOptions.push(`expiration_timestamp=TIMESTAMP("${args.expirationTime}")`);
      }
      if (tableOptions.length > 0) {
        ddl += ` SET OPTIONS(${tableOptions.join(', ')})`;
      }
      break;
      
    default:
      throw new Error(`Unsupported ALTER TABLE operation: ${args.operation}`);
  }
  
  return ddl;
}

// Helper to build CREATE VIEW DDL
function buildCreateViewDDL(args) {
  let ddl = `CREATE VIEW`;
  
  if (args.orReplace) {
    ddl = `CREATE OR REPLACE VIEW`;
  }
  
  ddl += ` \`${args.projectId || bigquery.projectId}.${args.datasetId}.${args.viewId}\``;
  
  // Add view options
  const options = [];
  if (args.description) {
    options.push(`description="${args.description}"`);
  }
  if (args.labels && Object.keys(args.labels).length > 0) {
    const labelPairs = Object.entries(args.labels).map(([k, v]) => `"${k}"="${v}"`);
    options.push(`labels=[${labelPairs.join(', ')}]`);
  }
  
  if (options.length > 0) {
    ddl += ` OPTIONS(${options.join(', ')})`;
  }
  
  ddl += ` AS ${args.query}`;
  
  return ddl;
}

// Helper to build INSERT DML
function buildInsertDML(args) {
  const tableRef = `\`${args.projectId || bigquery.projectId}.${args.datasetId}.${args.tableId}\``;
  let dml = `INSERT INTO ${tableRef}`;
  
  if (args.columns && args.columns.length > 0) {
    dml += ` (${args.columns.join(', ')})`;
  }
  
  if (args.query) {
    // INSERT ... SELECT
    dml += ` ${args.query}`;
  } else if (args.values && args.values.length > 0) {
    // INSERT ... VALUES
    const valueRows = args.values.map(row => {
      if (Array.isArray(row)) {
        return `(${row.map(val => formatValue(val)).join(', ')})`;
      } else if (typeof row === 'object') {
        // Handle object with column mappings
        const orderedValues = args.columns 
          ? args.columns.map(col => formatValue(row[col]))
          : Object.values(row).map(val => formatValue(val));
        return `(${orderedValues.join(', ')})`;
      }
      return `(${formatValue(row)})`;
    });
    dml += ` VALUES ${valueRows.join(', ')}`;
  }
  
  return dml;
}

// Helper to build UPDATE DML
function buildUpdateDML(args) {
  const tableRef = `\`${args.projectId || bigquery.projectId}.${args.datasetId}.${args.tableId}\``;
  let dml = `UPDATE ${tableRef}`;
  
  // Build SET clause
  const setClauses = [];
  if (args.set) {
    for (const [column, value] of Object.entries(args.set)) {
      setClauses.push(`${column} = ${formatValue(value)}`);
    }
  }
  
  if (setClauses.length === 0) {
    throw new Error('UPDATE statement requires at least one SET clause');
  }
  
  dml += ` SET ${setClauses.join(', ')}`;
  
  // Add WHERE clause
  if (args.where) {
    dml += ` WHERE ${args.where}`;
  }
  
  return dml;
}

// Helper to build DELETE DML
function buildDeleteDML(args) {
  const tableRef = `\`${args.projectId || bigquery.projectId}.${args.datasetId}.${args.tableId}\``;
  let dml = `DELETE FROM ${tableRef}`;
  
  // WHERE clause is required for safety
  if (!args.where && !args.confirmed) {
    throw new Error('DELETE requires WHERE clause or explicit confirmation. Add "confirmed": true to delete all rows.');
  }
  
  if (args.where) {
    dml += ` WHERE ${args.where}`;
  }
  
  return dml;
}

// Helper to build MERGE DML
function buildMergeDML(args) {
  const targetRef = `\`${args.projectId || bigquery.projectId}.${args.targetDatasetId}.${args.targetTableId}\``;
  let dml = `MERGE ${targetRef} AS target`;
  
  // Add USING clause
  if (args.sourceQuery) {
    dml += ` USING (${args.sourceQuery}) AS source`;
  } else if (args.sourceDatasetId && args.sourceTableId) {
    const sourceRef = `\`${args.projectId || bigquery.projectId}.${args.sourceDatasetId}.${args.sourceTableId}\``;
    dml += ` USING ${sourceRef} AS source`;
  } else {
    throw new Error('MERGE requires either sourceQuery or sourceDatasetId/sourceTableId');
  }
  
  // Add ON clause
  if (!args.on) {
    throw new Error('MERGE requires ON clause for matching condition');
  }
  dml += ` ON ${args.on}`;
  
  // Add WHEN clauses
  if (args.whenMatched) {
    dml += ` WHEN MATCHED THEN ${args.whenMatched}`;
  }
  
  if (args.whenNotMatched) {
    dml += ` WHEN NOT MATCHED THEN ${args.whenNotMatched}`;
  }
  
  if (args.whenNotMatchedBySource) {
    dml += ` WHEN NOT MATCHED BY SOURCE THEN ${args.whenNotMatchedBySource}`;
  }
  
  return dml;
}

// Jobs API - Async query execution
export async function bq_create_query_job(args) {
  const projectId = args.projectId;
  const options = {
    query: args.query,
    location: args.location || 'US',
    useLegacySql: args.useLegacySql || false,
    maximumBillingTier: args.maximumBillingTier,
    useQueryCache: args.useQueryCache !== false,
    jobTimeoutMs: args.timeoutMs || '600000',
    dryRun: args.dryRun || false,
    labels: args.labels || {},
    priority: args.priority || 'INTERACTIVE'
  };

  if (args.destinationTable) {
    options.destination = bigquery.dataset(args.destinationDataset).table(args.destinationTable);
    options.writeDisposition = args.writeDisposition || 'WRITE_TRUNCATE';
  }

  if (args.parameters) {
    options.params = args.parameters;
    options.parameterMode = 'NAMED';
  }

  try {
    const [job] = await bigquery.createQueryJob(options);
    
    if (args.dryRun) {
      const metadata = job.metadata;
      return {
        content: [{
          type: "text",
          text: `Dry run successful. Query would process ${metadata.statistics.query.totalBytesProcessed} bytes.`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Query job created successfully.\nJob ID: ${job.id}\nProject: ${projectId}\nLocation: ${options.location}\nStatus: ${job.metadata.status.state}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to create query job: ${error.message}`);
  }
}

// Create table with comprehensive DDL support
export async function bq_create_table(args) {
  try {
    const ddl = buildCreateTableDDL(args);
    
    const options = {
      query: ddl,
      location: args.location || 'US',
      useLegacySql: false,
      dryRun: args.dryRun || false
    };
    
    const [job] = await bigquery.createQueryJob(options);
    
    if (args.dryRun) {
      return {
        content: [{
          type: "text",
          text: `Dry run successful. CREATE TABLE DDL validated:\n${ddl}`
        }]
      };
    }
    
    if (args.waitForCompletion !== false) {
      await job.promise();
      
      return {
        content: [{
          type: "text",
          text: `Table ${args.datasetId}.${args.tableId} created successfully.\nDDL executed: ${ddl}\nJob ID: ${job.id}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `CREATE TABLE job created.\nJob ID: ${job.id}\nDDL: ${ddl}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to create table: ${error.message}`);
  }
}

// Alter table structure and properties
export async function bq_alter_table(args) {
  try {
    const ddl = buildAlterTableDDL(args);
    
    const options = {
      query: ddl,
      location: args.location || 'US',
      useLegacySql: false,
      dryRun: args.dryRun || false
    };
    
    const [job] = await bigquery.createQueryJob(options);
    
    if (args.dryRun) {
      return {
        content: [{
          type: "text",
          text: `Dry run successful. ALTER TABLE DDL validated:\n${ddl}`
        }]
      };
    }
    
    if (args.waitForCompletion !== false) {
      await job.promise();
      
      return {
        content: [{
          type: "text",
          text: `Table ${args.datasetId}.${args.tableId} altered successfully.\nOperation: ${args.operation}\nDDL executed: ${ddl}\nJob ID: ${job.id}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `ALTER TABLE job created.\nJob ID: ${job.id}\nDDL: ${ddl}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to alter table: ${error.message}`);
  }
}

// Drop table with safety confirmation
export async function bq_drop_table(args) {
  try {
    const tableRef = `\`${args.projectId || bigquery.projectId}.${args.datasetId}.${args.tableId}\``;
    let ddl = `DROP TABLE`;
    
    if (args.ifExists) {
      ddl += ` IF EXISTS`;
    }
    
    ddl += ` ${tableRef}`;
    
    // Safety check - require explicit confirmation for destructive operations
    if (!args.confirmed && !args.dryRun) {
      return {
        content: [{
          type: "text",
          text: `⚠️ WARNING: This will permanently delete table ${args.datasetId}.${args.tableId}\nTo proceed, add "confirmed": true to your request.\nTo preview the operation, add "dryRun": true.`
        }]
      };
    }
    
    const options = {
      query: ddl,
      location: args.location || 'US',
      useLegacySql: false,
      dryRun: args.dryRun || false
    };
    
    const [job] = await bigquery.createQueryJob(options);
    
    if (args.dryRun) {
      return {
        content: [{
          type: "text",
          text: `Dry run successful. DROP TABLE DDL validated:\n${ddl}`
        }]
      };
    }
    
    if (args.waitForCompletion !== false) {
      await job.promise();
      
      return {
        content: [{
          type: "text",
          text: `Table ${args.datasetId}.${args.tableId} dropped successfully.\nDDL executed: ${ddl}\nJob ID: ${job.id}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `DROP TABLE job created.\nJob ID: ${job.id}\nDDL: ${ddl}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to drop table: ${error.message}`);
  }
}

// Create view with comprehensive options
export async function bq_create_view(args) {
  try {
    const ddl = buildCreateViewDDL(args);
    
    const options = {
      query: ddl,
      location: args.location || 'US',
      useLegacySql: false,
      dryRun: args.dryRun || false
    };
    
    const [job] = await bigquery.createQueryJob(options);
    
    if (args.dryRun) {
      return {
        content: [{
          type: "text",
          text: `Dry run successful. CREATE VIEW DDL validated:\n${ddl}`
        }]
      };
    }
    
    if (args.waitForCompletion !== false) {
      await job.promise();
      
      return {
        content: [{
          type: "text",
          text: `View ${args.datasetId}.${args.viewId} created successfully.\nDDL executed: ${ddl}\nJob ID: ${job.id}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `CREATE VIEW job created.\nJob ID: ${job.id}\nDDL: ${ddl}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to create view: ${error.message}`);
  }
}

// Insert data using DML
export async function bq_insert_data(args) {
  try {
    const dml = buildInsertDML(args);
    
    const options = {
      query: dml,
      location: args.location || 'US',
      useLegacySql: false,
      dryRun: args.dryRun || false
    };
    
    if (args.sessionId) {
      options.connectionProperties = {
        session_id: args.sessionId
      };
    }
    
    const [job] = await bigquery.createQueryJob(options);
    
    if (args.dryRun) {
      return {
        content: [{
          type: "text",
          text: `Dry run successful. INSERT DML validated:\n${dml}`
        }]
      };
    }
    
    if (args.waitForCompletion !== false) {
      await job.promise();
      const [metadata] = await job.getMetadata();
      const rowsAffected = metadata.statistics.query?.dmlStats?.insertedRowCount || 'unknown';
      
      return {
        content: [{
          type: "text",
          text: `Data inserted successfully into ${args.datasetId}.${args.tableId}.\nRows inserted: ${rowsAffected}\nDML executed: ${dml}\nJob ID: ${job.id}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `INSERT job created.\nJob ID: ${job.id}\nDML: ${dml}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to insert data: ${error.message}`);
  }
}

// Update data using DML
export async function bq_update_data(args) {
  try {
    const dml = buildUpdateDML(args);
    
    const options = {
      query: dml,
      location: args.location || 'US',
      useLegacySql: false,
      dryRun: args.dryRun || false
    };
    
    if (args.sessionId) {
      options.connectionProperties = {
        session_id: args.sessionId
      };
    }
    
    const [job] = await bigquery.createQueryJob(options);
    
    if (args.dryRun) {
      return {
        content: [{
          type: "text",
          text: `Dry run successful. UPDATE DML validated:\n${dml}`
        }]
      };
    }
    
    if (args.waitForCompletion !== false) {
      await job.promise();
      const [metadata] = await job.getMetadata();
      const rowsAffected = metadata.statistics.query?.dmlStats?.updatedRowCount || 'unknown';
      
      return {
        content: [{
          type: "text",
          text: `Data updated successfully in ${args.datasetId}.${args.tableId}.\nRows updated: ${rowsAffected}\nDML executed: ${dml}\nJob ID: ${job.id}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `UPDATE job created.\nJob ID: ${job.id}\nDML: ${dml}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to update data: ${error.message}`);
  }
}

// Delete data using DML
export async function bq_delete_data(args) {
  try {
    const dml = buildDeleteDML(args);
    
    const options = {
      query: dml,
      location: args.location || 'US',
      useLegacySql: false,
      dryRun: args.dryRun || false
    };
    
    if (args.sessionId) {
      options.connectionProperties = {
        session_id: args.sessionId
      };
    }
    
    const [job] = await bigquery.createQueryJob(options);
    
    if (args.dryRun) {
      return {
        content: [{
          type: "text",
          text: `Dry run successful. DELETE DML validated:\n${dml}`
        }]
      };
    }
    
    if (args.waitForCompletion !== false) {
      await job.promise();
      const [metadata] = await job.getMetadata();
      const rowsAffected = metadata.statistics.query?.dmlStats?.deletedRowCount || 'unknown';
      
      return {
        content: [{
          type: "text",
          text: `Data deleted successfully from ${args.datasetId}.${args.tableId}.\nRows deleted: ${rowsAffected}\nDML executed: ${dml}\nJob ID: ${job.id}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `DELETE job created.\nJob ID: ${job.id}\nDML: ${dml}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to delete data: ${error.message}`);
  }
}

// Merge data using MERGE statement
export async function bq_merge_data(args) {
  try {
    const dml = buildMergeDML(args);
    
    const options = {
      query: dml,
      location: args.location || 'US',
      useLegacySql: false,
      dryRun: args.dryRun || false
    };
    
    if (args.sessionId) {
      options.connectionProperties = {
        session_id: args.sessionId
      };
    }
    
    const [job] = await bigquery.createQueryJob(options);
    
    if (args.dryRun) {
      return {
        content: [{
          type: "text",
          text: `Dry run successful. MERGE DML validated:\n${dml}`
        }]
      };
    }
    
    if (args.waitForCompletion !== false) {
      await job.promise();
      const [metadata] = await job.getMetadata();
      const stats = metadata.statistics.query?.dmlStats;
      const summary = [];
      
      if (stats?.insertedRowCount) summary.push(`${stats.insertedRowCount} rows inserted`);
      if (stats?.updatedRowCount) summary.push(`${stats.updatedRowCount} rows updated`);
      if (stats?.deletedRowCount) summary.push(`${stats.deletedRowCount} rows deleted`);
      
      return {
        content: [{
          type: "text",
          text: `MERGE operation completed successfully.\n${summary.length > 0 ? summary.join(', ') : 'No rows affected'}\nTarget table: ${args.targetDatasetId}.${args.targetTableId}\nDML executed: ${dml}\nJob ID: ${job.id}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `MERGE job created.\nJob ID: ${job.id}\nDML: ${dml}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to merge data: ${error.message}`);
  }
}

// Get job status and results
export async function bq_get_job(args) {
  const job = bigquery.job(args.jobId);
  const [metadata] = await job.getMetadata();
  
  const response = {
    jobId: args.jobId,
    state: metadata.status.state,
    creationTime: new Date(parseInt(metadata.statistics.creationTime)).toISOString(),
    startTime: metadata.statistics.startTime ? new Date(parseInt(metadata.statistics.startTime)).toISOString() : null,
    endTime: metadata.statistics.endTime ? new Date(parseInt(metadata.statistics.endTime)).toISOString() : null,
    totalBytesProcessed: metadata.statistics.query?.totalBytesProcessed,
    totalSlotMs: metadata.statistics.query?.totalSlotMs,
    errorResult: metadata.status.errorResult
  };

  if (metadata.status.state === 'DONE' && !metadata.status.errorResult) {
    if (args.getResults && metadata.configuration.query) {
      const [rows] = await job.getQueryResults({ maxResults: args.maxResults || 100 });
      response.resultCount = rows.length;
      response.results = rows;
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(response, null, 2)
    }]
  };
}

// Cancel a running job
export async function bq_cancel_job(args) {
  const job = bigquery.job(args.jobId);
  await job.cancel();
  
  return {
    content: [{
      type: "text",
      text: `Job ${args.jobId} cancellation requested.`
    }]
  };
}

// Session management for stateful operations
export async function bq_create_session(args) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create a test query to initialize the session
  const query = `
    CREATE TEMP TABLE _session_info AS
    SELECT 
      '${sessionId}' as session_id,
      CURRENT_TIMESTAMP() as created_at
  `;
  
  const options = {
    query: query,
    location: args.location || 'US',
    createSession: true
  };
  
  const [job] = await bigquery.createQueryJob(options);
  const [metadata] = await job.getMetadata();
  const bqSessionId = metadata.statistics.sessionInfo?.sessionId;
  
  return {
    content: [{
      type: "text",
      text: `Session created.\nSession ID: ${sessionId}\nBigQuery Session: ${bqSessionId}\nLocation: ${args.location || 'US'}`
    }]
  };
}

// Execute query within a session
export async function bq_query_with_session(args) {
  const options = {
    query: args.query,
    location: args.location || 'US',
    useLegacySql: false,
    connectionProperties: {
      session_id: args.sessionId
    }
  };
  
  const [job] = await bigquery.createQueryJob(options);
  const [rows] = await job.getQueryResults();
  
  return {
    content: [{
      type: "text",
      text: `Query executed in session ${args.sessionId}.\nReturned ${rows.length} rows:\n${JSON.stringify(rows.slice(0, 100), null, 2)}`
    }]
  };
}

// Execute stored procedure with proper parameter handling
export async function bq_execute_procedure(args) {
  // Build parameter list
  let paramList = '';
  if (args.parameters && args.parameters.length > 0) {
    paramList = args.parameters
      .map(p => formatParameter(p))
      .join(', ');
  }
  
  const procedureCall = `CALL \`${args.projectId}.${args.datasetId}.${args.procedureName}\`(${paramList})`;
  
  // Use jobs API for better control
  const options = {
    query: procedureCall,
    location: args.location || 'US',
    useLegacySql: false,
    jobTimeoutMs: args.timeoutMs || '600000'
  };
  
  try {
    const [job] = await bigquery.createQueryJob(options);
    
    // Wait for completion if requested
    if (args.waitForCompletion !== false) {
      const [metadata] = await job.getMetadata();
      
      // Poll for completion
      let attempts = 0;
      const maxAttempts = 300; // 5 minutes with 1 second intervals
      
      while (metadata.status.state !== 'DONE' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await job.getMetadata();
        attempts++;
      }
      
      if (metadata.status.errorResult) {
        throw new Error(`Procedure failed: ${metadata.status.errorResult.message}`);
      }
      
      const [rows] = await job.getQueryResults();
      
      return {
        content: [{
          type: "text",
          text: `Procedure ${args.procedureName} executed successfully.\nJob ID: ${job.id}\nRows returned: ${rows.length}\n${rows.length > 0 ? `Results:\n${JSON.stringify(rows, null, 2)}` : ''}`
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `Procedure ${args.procedureName} job created.\nJob ID: ${job.id}\nUse bq_get_job to check status.`
        }]
      };
    }
  } catch (error) {
    throw new Error(`Failed to execute procedure: ${error.message}`);
  }
}

// Execute multiple SQL statements in a transaction/script
export async function bq_execute_script(args) {
  // Join statements with semicolons
  const script = args.statements.join(';\n') + ';';
  
  const options = {
    query: script,
    location: args.location || 'US',
    useLegacySql: false,
    jobTimeoutMs: args.timeoutMs || '600000'
  };
  
  if (args.sessionId) {
    options.connectionProperties = {
      session_id: args.sessionId
    };
  }
  
  const [job] = await bigquery.createQueryJob(options);
  const [metadata] = await job.getMetadata();
  
  if (args.waitForCompletion !== false) {
    // Wait for completion
    let attempts = 0;
    const maxAttempts = 300;
    
    while (metadata.status.state !== 'DONE' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await job.getMetadata();
      attempts++;
    }
    
    if (metadata.status.errorResult) {
      throw new Error(`Script failed: ${metadata.status.errorResult.message}`);
    }
    
    return {
      content: [{
        type: "text",
        text: `Script executed successfully.\nJob ID: ${job.id}\nStatements: ${args.statements.length}`
      }]
    };
  }
  
  return {
    content: [{
      type: "text",
      text: `Script job created.\nJob ID: ${job.id}\nStatements: ${args.statements.length}`
    }]
  };
}

// Load data from various sources
export async function bq_load_data(args) {
  const dataset = bigquery.dataset(args.datasetId);
  const table = dataset.table(args.tableId);
  
  const options = {
    sourceFormat: args.format || 'CSV',
    skipLeadingRows: args.skipLeadingRows || (args.format === 'CSV' ? 1 : 0),
    writeDisposition: args.writeDisposition || 'WRITE_APPEND',
    createDisposition: args.createDisposition || 'CREATE_IF_NEEDED',
    autodetect: args.autodetect !== false,
    location: args.location || 'US'
  };
  
  if (args.schema) {
    options.schema = args.schema;
    options.autodetect = false;
  }
  
  if (args.format === 'CSV') {
    options.fieldDelimiter = args.fieldDelimiter || ',';
    options.allowQuotedNewlines = args.allowQuotedNewlines || true;
    options.quote = args.quote || '"';
    options.allowJaggedRows = args.allowJaggedRows || false;
  }
  
  if (args.format === 'JSON') {
    options.sourceFormat = 'NEWLINE_DELIMITED_JSON';
  }
  
  const [job] = await table.load(args.sourceUri, options);
  
  if (args.waitForCompletion !== false) {
    await job.promise();
    const [metadata] = await job.getMetadata();
    
    return {
      content: [{
        type: "text",
        text: `Data loaded successfully into ${args.datasetId}.${args.tableId}\nJob ID: ${job.id}\nRows loaded: ${metadata.statistics.load?.outputRows || 'unknown'}`
      }]
    };
  }
  
  return {
    content: [{
      type: "text",
      text: `Load job created for ${args.datasetId}.${args.tableId}\nJob ID: ${job.id}\nSource: ${args.sourceUri}`
    }]
  };
}

// Export data to Cloud Storage
export async function bq_export_data(args) {
  const dataset = bigquery.dataset(args.datasetId);
  const table = dataset.table(args.tableId);
  
  const options = {
    format: args.format || 'CSV',
    gzip: args.compress || false,
    location: args.location || 'US'
  };
  
  if (args.format === 'CSV') {
    options.fieldDelimiter = args.fieldDelimiter || ',';
    options.printHeader = args.printHeader !== false;
  }
  
  const [job] = await table.export(args.destinationUri, options);
  
  if (args.waitForCompletion !== false) {
    await job.promise();
    
    return {
      content: [{
        type: "text",
        text: `Data exported successfully from ${args.datasetId}.${args.tableId}\nDestination: ${args.destinationUri}\nFormat: ${args.format || 'CSV'}`
      }]
    };
  }
  
  return {
    content: [{
      type: "text",
      text: `Export job created.\nJob ID: ${job.id}`
    }]
  };
}

// Stream insert rows
export async function bq_stream_insert(args) {
  const dataset = bigquery.dataset(args.datasetId);
  const table = dataset.table(args.tableId);
  
  const rows = args.rows.map((row, index) => ({
    insertId: args.insertIds?.[index] || `${Date.now()}_${index}`,
    json: row
  }));
  
  try {
    const [response] = await table.insert(rows, {
      skipInvalidRows: args.skipInvalidRows || false,
      ignoreUnknownValues: args.ignoreUnknownValues || false
    });
    
    return {
      content: [{
        type: "text",
        text: `Successfully inserted ${args.rows.length} rows into ${args.datasetId}.${args.tableId}`
      }]
    };
  } catch (error) {
    if (error.errors && error.errors.length > 0) {
      const errorDetails = error.errors.map(e => 
        `Row ${e.row}: ${e.errors.map(err => err.message).join(', ')}`
      ).join('\n');
      
      throw new Error(`Stream insert failed:\n${errorDetails}`);
    }
    throw error;
  }
}

// Get detailed table schema
export async function bq_get_table_schema(args) {
  const dataset = bigquery.dataset(args.datasetId);
  const table = dataset.table(args.tableId);
  const [metadata] = await table.getMetadata();
  
  const schemaInfo = {
    fields: metadata.schema.fields,
    numRows: metadata.numRows,
    numBytes: metadata.numBytes,
    creationTime: new Date(parseInt(metadata.creationTime)).toISOString(),
    lastModifiedTime: new Date(parseInt(metadata.lastModifiedTime)).toISOString(),
    description: metadata.description,
    type: metadata.type,
    location: metadata.location,
    timePartitioning: metadata.timePartitioning,
    clustering: metadata.clustering,
    requirePartitionFilter: metadata.requirePartitionFilter
  };
  
  return {
    content: [{
      type: "text",
      text: `Table: ${args.datasetId}.${args.tableId}\n${JSON.stringify(schemaInfo, null, 2)}`
    }]
  };
}

// Get stored procedure/function definition
export async function bq_get_routine_definition(args) {
  const dataset = bigquery.dataset(args.datasetId);
  const routine = dataset.routine(args.routineId);
  const [metadata] = await routine.getMetadata();
  
  const routineInfo = {
    routineType: metadata.routineType,
    language: metadata.language,
    arguments: metadata.arguments,
    returnType: metadata.returnType,
    body: metadata.definitionBody,
    description: metadata.description,
    creationTime: new Date(parseInt(metadata.creationTime)).toISOString(),
    lastModifiedTime: new Date(parseInt(metadata.lastModifiedTime)).toISOString()
  };
  
  return {
    content: [{
      type: "text",
      text: `Routine: ${args.datasetId}.${args.routineId}\n${JSON.stringify(routineInfo, null, 2)}`
    }]
  };
}

// Copy table
export async function bq_copy_table(args) {
  const sourceDataset = bigquery.dataset(args.sourceDatasetId);
  const sourceTable = sourceDataset.table(args.sourceTableId);
  
  const destDataset = bigquery.dataset(args.destinationDatasetId);
  const destTable = destDataset.table(args.destinationTableId);
  
  const [job] = await sourceTable.copy(destTable, {
    writeDisposition: args.writeDisposition || 'WRITE_TRUNCATE',
    createDisposition: args.createDisposition || 'CREATE_IF_NEEDED'
  });
  
  if (args.waitForCompletion !== false) {
    await job.promise();
    
    return {
      content: [{
        type: "text",
        text: `Table copied successfully from ${args.sourceDatasetId}.${args.sourceTableId} to ${args.destinationDatasetId}.${args.destinationTableId}`
      }]
    };
  }
  
  return {
    content: [{
      type: "text",
      text: `Copy job created.\nJob ID: ${job.id}`
    }]
  };
}

// List jobs
export async function bq_list_jobs(args) {
  const options = {
    maxResults: args.maxResults || 50,
    allUsers: args.allUsers || false,
    projection: args.projection || 'full'
  };
  
  if (args.stateFilter) {
    options.stateFilter = args.stateFilter;
  }
  
  if (args.minCreationTime) {
    options.minCreationTime = args.minCreationTime;
  }
  
  const [jobs] = await bigquery.getJobs(options);
  
  const jobList = jobs.map(job => ({
    id: job.id,
    state: job.metadata.status.state,
    type: job.metadata.configuration.jobType,
    creationTime: new Date(parseInt(job.metadata.statistics.creationTime)).toISOString(),
    user: job.metadata.user_email
  }));
  
  return {
    content: [{
      type: "text",
      text: `Found ${jobList.length} jobs:\n${JSON.stringify(jobList, null, 2)}`
    }]
  };
}