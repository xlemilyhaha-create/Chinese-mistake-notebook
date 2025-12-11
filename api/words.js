import mysql from 'mysql2/promise';

// Database connection pool
let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'yuwen_cuoti',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }
  return pool;
}

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const pool = getPool();
    const { method } = req;

    switch (method) {
      case 'GET':
        return await handleGet(req, res, pool);
      case 'POST':
        return await handlePost(req, res, pool);
      case 'PUT':
        return await handlePut(req, res, pool);
      case 'PATCH':
        return await handlePatch(req, res, pool);
      case 'DELETE':
        return await handleDelete(req, res, pool);
      default:
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('Database API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// GET - List words with filters
async function handleGet(req, res, pool) {
  const { questionTypes, testStatuses, isMultipleAttempts } = req.query;
  
  let query = 'SELECT * FROM word_entries WHERE 1=1';
  const params = [];

  if (questionTypes) {
    const types = Array.isArray(questionTypes) ? questionTypes : [questionTypes];
    if (types.length > 0) {
      // Filter entries that have at least one of the specified question types enabled
      query += ' AND (';
      types.forEach((type, idx) => {
        if (idx > 0) query += ' OR ';
        query += 'JSON_CONTAINS(enabled_types, ?)';
        params.push(JSON.stringify([type]));
      });
      query += ')';
    }
  }

  if (testStatuses) {
    const statuses = Array.isArray(testStatuses) ? testStatuses : [testStatuses];
    if (statuses.length > 0) {
      query += ' AND test_status IN (?)';
      params.push(statuses);
    }
  }

  if (isMultipleAttempts !== undefined && isMultipleAttempts !== null && isMultipleAttempts !== '') {
    // 支持数组类型（多选）
    if (Array.isArray(isMultipleAttempts) && isMultipleAttempts.length > 0) {
      const values = isMultipleAttempts.map(v => v === 'true' || v === true);
      query += ' AND is_multiple_attempts IN (?)';
      params.push(values);
    } else {
      query += ' AND is_multiple_attempts = ?';
      params.push(isMultipleAttempts === 'true' || isMultipleAttempts === true);
    }
  }

  query += ' ORDER BY created_at DESC';

  const [rows] = await pool.execute(query, params);
  
  // Helper function to safely parse JSON (handles both string and already-parsed objects)
  const safeJsonParse = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value; // Already parsed
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return null;
      }
    }
    return value;
  };
  
  // Parse JSON fields
  const words = rows.map(row => ({
    id: row.id,
    type: row.type,
    word: row.word,
    pinyin: row.pinyin,
    createdAt: row.created_at,
    definitionData: safeJsonParse(row.definition_data),
    definitionMatchData: safeJsonParse(row.definition_match_data),
    poemData: safeJsonParse(row.poem_data),
    enabledTypes: safeJsonParse(row.enabled_types) || [],
    testStatus: row.test_status,
    isMultipleAttempts: Boolean(row.is_multiple_attempts),
    previousTestStatus: row.previous_test_status || null
  }));

  return res.status(200).json(words);
}

// POST - Create new word entry
async function handlePost(req, res, pool) {
  const entry = req.body;
  
  const query = `
    INSERT INTO word_entries (
      id, type, word, pinyin, created_at,
      definition_data, definition_match_data, poem_data,
      enabled_types, test_status, is_multiple_attempts, previous_test_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    entry.id,
    entry.type,
    entry.word,
    entry.pinyin,
    entry.createdAt || Date.now(),
    entry.definitionData ? JSON.stringify(entry.definitionData) : null,
    entry.definitionMatchData ? JSON.stringify(entry.definitionMatchData) : null,
    entry.poemData ? JSON.stringify(entry.poemData) : null,
    JSON.stringify(entry.enabledTypes || []),
    entry.testStatus || 'NOT_TESTED',
    entry.isMultipleAttempts ? 1 : 0,
    entry.previousTestStatus || null
  ];

  await pool.execute(query, params);
  return res.status(201).json({ success: true, id: entry.id });
}

// PUT - Update word entry
async function handlePut(req, res, pool) {
  const { id } = req.query;
  const updates = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID is required' });
  }

  const fields = [];
  const params = [];

  if (updates.word !== undefined) {
    fields.push('word = ?');
    params.push(updates.word);
  }
  if (updates.pinyin !== undefined) {
    fields.push('pinyin = ?');
    params.push(updates.pinyin);
  }
  if (updates.definitionData !== undefined) {
    fields.push('definition_data = ?');
    params.push(updates.definitionData ? JSON.stringify(updates.definitionData) : null);
  }
  if (updates.definitionMatchData !== undefined) {
    fields.push('definition_match_data = ?');
    params.push(updates.definitionMatchData ? JSON.stringify(updates.definitionMatchData) : null);
  }
  if (updates.poemData !== undefined) {
    fields.push('poem_data = ?');
    params.push(updates.poemData ? JSON.stringify(updates.poemData) : null);
  }
  if (updates.enabledTypes !== undefined) {
    fields.push('enabled_types = ?');
    params.push(JSON.stringify(updates.enabledTypes));
  }
  if (updates.testStatus !== undefined) {
    fields.push('test_status = ?');
    params.push(updates.testStatus);
  }
  if (updates.isMultipleAttempts !== undefined) {
    fields.push('is_multiple_attempts = ?');
    params.push(updates.isMultipleAttempts ? 1 : 0);
  }
  if (updates.previousTestStatus !== undefined) {
    fields.push('previous_test_status = ?');
    params.push(updates.previousTestStatus);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(id);
  const query = `UPDATE word_entries SET ${fields.join(', ')} WHERE id = ?`;

  await pool.execute(query, params);
  return res.status(200).json({ success: true });
}

// PATCH - Batch update test status
async function handlePatch(req, res, pool) {
  const { ids, testStatus } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs array is required' });
  }

  if (!testStatus) {
    return res.status(400).json({ error: 'testStatus is required' });
  }

  // Get current entries to check previous status
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id, test_status, previous_test_status, is_multiple_attempts FROM word_entries WHERE id IN (${placeholders})`,
    ids
  );

  // Update each entry with proper status tracking
  for (const row of rows) {
    const currentStatus = row.test_status;
    const previousStatus = row.previous_test_status;
    let newPreviousStatus = previousStatus;
    let isMultipleAttempts = Boolean(row.is_multiple_attempts);

    // If status is changing from NOT_TESTED to PASSED, set isMultipleAttempts to false
    // Otherwise, if changing to PASSED, set isMultipleAttempts to true
    if (currentStatus === 'NOT_TESTED' && testStatus === 'PASSED') {
      isMultipleAttempts = false;
      newPreviousStatus = 'NOT_TESTED';
    } else if (currentStatus !== testStatus && testStatus === 'PASSED') {
      isMultipleAttempts = true;
      newPreviousStatus = currentStatus;
    } else {
      // For other status changes, update previous status
      newPreviousStatus = currentStatus;
    }

    await pool.execute(
      `UPDATE word_entries SET test_status = ?, previous_test_status = ?, is_multiple_attempts = ? WHERE id = ?`,
      [testStatus, newPreviousStatus, isMultipleAttempts ? 1 : 0, row.id]
    );
  }

  return res.status(200).json({ success: true, updated: ids.length });
}

// DELETE - Delete word entry
async function handleDelete(req, res, pool) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID is required' });
  }

  await pool.execute('DELETE FROM word_entries WHERE id = ?', [id]);
  return res.status(200).json({ success: true });
}

