import pool from './db';

export default async function handler(req, res) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const connection = await pool.getConnection();

    try {
      if (req.method === 'GET') {
        const [rows] = await connection.query('SELECT * FROM words ORDER BY created_at DESC');
        const words = rows.map(row => ({
          id: row.id,
          type: row.type,
          word: row.word,
          pinyin: row.pinyin,
          createdAt: Number(row.created_at),
          definitionData: row.definition_data,
          definitionMatchData: row.definition_match_data,
          poemData: row.poem_data,
          enabledTypes: row.enabled_types || [],
          testStatus: row.test_status || 'UNTESTED',
          passedAfterRetries: Boolean(row.passed_after_retries)
        }));
        return res.status(200).json(words);
      }

      if (req.method === 'POST') {
        const entry = req.body;
        await connection.query(
          `INSERT INTO words (id, type, word, pinyin, created_at, definition_data, definition_match_data, poem_data, enabled_types, test_status, passed_after_retries) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.id,
            entry.type,
            entry.word,
            entry.pinyin,
            entry.createdAt,
            JSON.stringify(entry.definitionData || null),
            JSON.stringify(entry.definitionMatchData || null),
            JSON.stringify(entry.poemData || null),
            JSON.stringify(entry.enabledTypes || []),
            entry.testStatus || 'UNTESTED',
            entry.passedAfterRetries || false
          ]
        );
        return res.status(201).json({ success: true });
      }

      if (req.method === 'PATCH') {
        const { id } = req.query; // Or extract from body if preferred, but usually ID is in path or query
        // Vercel functions often use query for path params like /api/words?id=123
        const targetId = id || req.body.id;
        
        if (!targetId) return res.status(400).json({ error: "Missing ID" });
        
        const updates = req.body;
        const fields = [];
        const values = [];

        if (updates.enabledTypes !== undefined) {
          fields.push('enabled_types = ?');
          values.push(JSON.stringify(updates.enabledTypes));
        }
        if (updates.testStatus !== undefined) {
          fields.push('test_status = ?');
          values.push(updates.testStatus);
        }
        if (updates.passedAfterRetries !== undefined) {
          fields.push('passed_after_retries = ?');
          values.push(updates.passedAfterRetries ? 1 : 0);
        }

        if (fields.length === 0) return res.status(200).json({ message: "No updates" });

        values.push(targetId);
        
        await connection.query(
          `UPDATE words SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
        return res.status(200).json({ success: true });
      }

      if (req.method === 'DELETE') {
        const { id } = req.query; // /api/words?id=xyz
        if (!id) return res.status(400).json({ error: "Missing ID" });
        await connection.query('DELETE FROM words WHERE id = ?', [id]);
        return res.status(200).json({ success: true });
      }

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ error: "Database operation failed", details: error.message });
  }
}
