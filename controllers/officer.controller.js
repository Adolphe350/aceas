const { pool } = require('../config/db');
const { sendReviewNotification } = require('../services/email.service');

async function logAudit(userId, action, entityType, entityId, ip) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, entityType, entityId, ip]
    );
  } catch (e) { console.error('Audit log error:', e.message); }
}

async function getAllProjects(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name AS developer_name, u.email AS developer_email,
        (SELECT COUNT(*) FROM assessments a WHERE a.project_id = p.id) AS has_assessment,
        (SELECT overall_score FROM assessments a WHERE a.project_id = p.id ORDER BY assessed_at DESC LIMIT 1) AS overall_score,
        (SELECT risk_level FROM assessments a WHERE a.project_id = p.id ORDER BY assessed_at DESC LIMIT 1) AS risk_level
       FROM projects p 
       JOIN users u ON p.developer_id = u.id
       ORDER BY p.submitted_at DESC`
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('Get all projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getProjectDetail(req, res) {
  const { id } = req.params;
  try {
    const projectResult = await pool.query(
      `SELECT p.*, u.full_name AS developer_name, u.email AS developer_email 
       FROM projects p JOIN users u ON p.developer_id = u.id WHERE p.id = $1`,
      [id]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const assessResult = await pool.query(
      'SELECT * FROM assessments WHERE project_id = $1 ORDER BY assessed_at DESC LIMIT 1',
      [id]
    );

    const reviewsResult = await pool.query(
      `SELECT r.*, u.full_name AS officer_name FROM reviews r 
       JOIN users u ON r.officer_id = u.id WHERE r.project_id = $1 ORDER BY r.reviewed_at DESC`,
      [id]
    );

    res.json({
      project: projectResult.rows[0],
      assessment: assessResult.rows[0] || null,
      reviews: reviewsResult.rows,
    });
  } catch (err) {
    console.error('Get project detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function reviewProject(req, res) {
  const { id } = req.params;
  const { decision, comments } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  const validDecisions = ['approved', 'rejected', 'changes_requested'];
  if (!decision || !validDecisions.includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision. Must be: approved, rejected, or changes_requested' });
  }

  try {
    const projectResult = await pool.query(
      'SELECT p.*, u.full_name AS developer_name, u.email AS developer_email FROM projects p JOIN users u ON p.developer_id = u.id WHERE p.id = $1',
      [id]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    // Insert review
    const reviewResult = await pool.query(
      'INSERT INTO reviews (project_id, officer_id, comments, decision) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, req.user.id, comments, decision]
    );

    // Update project status
    const statusMap = {
      approved: 'approved',
      rejected: 'rejected',
      changes_requested: 'changes_requested',
    };
    await pool.query(
      'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
      [statusMap[decision], id]
    );

    await logAudit(req.user.id, `PROJECT_${decision.toUpperCase()}`, 'projects', parseInt(id), ip);

    // Notify developer
    sendReviewNotification(
      project.developer_email,
      project.developer_name,
      project.title,
      decision,
      comments
    ).catch(err => console.error('Review notification error:', err));

    res.json({
      message: `Project ${decision.replace('_', ' ')} successfully`,
      review: reviewResult.rows[0],
    });
  } catch (err) {
    console.error('Review project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAllProjects, getProjectDetail, reviewProject };
