const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function logAudit(userId, action, entityType, entityId, ip) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, entityType, entityId, ip]
    );
  } catch (e) { console.error('Audit log error:', e.message); }
}

async function getUsers(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, is_active, mfa_enabled, failed_login_attempts, locked_until, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createUser(req, res) {
  const { full_name, email, password, role } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  const validRoles = ['ai_developer', 'compliance_officer', 'system_admin'];
  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role, is_active, created_at',
      [full_name.trim(), email.toLowerCase().trim(), passwordHash, role]
    );
    const newUser = result.rows[0];
    await logAudit(req.user.id, 'ADMIN_USER_CREATED', 'users', newUser.id, ip);
    res.status(201).json({ message: 'User created', user: newUser });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { full_name, email, role, is_active, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (full_name !== undefined) { updates.push(`full_name = $${idx++}`); values.push(full_name.trim()); }
    if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email.toLowerCase().trim()); }
    if (role !== undefined) {
      const validRoles = ['ai_developer', 'compliance_officer', 'system_admin'];
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      updates.push(`role = $${idx++}`); values.push(role);
    }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(!!is_active); }
    if (password !== undefined) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      const hash = await bcrypt.hash(password, 12);
      updates.push(`password_hash = $${idx++}`); values.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, full_name, email, role, is_active`,
      values
    );
    await logAudit(req.user.id, 'ADMIN_USER_UPDATED', 'users', parseInt(id), ip);
    res.json({ message: 'User updated', user: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteUser(req, res) {
  const { id } = req.params;
  const ip = req.ip || req.connection.remoteAddress;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    await logAudit(req.user.id, 'ADMIN_USER_DELETED', 'users', parseInt(id), ip);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAllProjects(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name AS developer_name, u.email AS developer_email,
        (SELECT overall_score FROM assessments a WHERE a.project_id = p.id ORDER BY assessed_at DESC LIMIT 1) AS overall_score,
        (SELECT risk_level FROM assessments a WHERE a.project_id = p.id ORDER BY assessed_at DESC LIMIT 1) AS risk_level
       FROM projects p JOIN users u ON p.developer_id = u.id ORDER BY p.submitted_at DESC`
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('Admin get projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAuditLog(req, res) {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const result = await pool.query(
      `SELECT al.*, u.full_name, u.email FROM audit_log al 
       LEFT JOIN users u ON al.user_id = u.id 
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await pool.query('SELECT COUNT(*) FROM audit_log');
    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getUsers, createUser, updateUser, deleteUser, getAllProjects, getAuditLog };
