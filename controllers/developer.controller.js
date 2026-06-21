const { pool } = require('../config/db');
const { calculateScores } = require('../services/scoring.service');
const { getRecommendations } = require('../services/gemini.service');
const { generateReport } = require('../services/pdf.service');

async function logAudit(userId, action, entityType, entityId, ip) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, entityType, entityId, ip]
    );
  } catch (e) { console.error('Audit log error:', e.message); }
}

async function getProjects(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM assessments a WHERE a.project_id = p.id) AS has_assessment
       FROM projects p 
       WHERE p.developer_id = $1 
       ORDER BY p.submitted_at DESC`,
      [req.user.id]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createProject(req, res) {
  const { title, description, ai_type, purpose, dataset_info } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!title) {
    return res.status(400).json({ error: 'Project title is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO projects (developer_id, title, description, ai_type, purpose, dataset_info)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, title, description, ai_type, purpose, dataset_info]
    );
    const project = result.rows[0];
    await logAudit(req.user.id, 'PROJECT_CREATED', 'projects', project.id, ip);
    res.status(201).json({ message: 'Project created', project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getProject(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND developer_id = $2',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function submitAssessment(req, res) {
  const { id } = req.params;
  const ip = req.ip || req.connection.remoteAddress;
  const answers = req.body;

  try {
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND developer_id = $2',
      [id, req.user.id]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    // Validate answers
    const questionKeys = ['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10',
      'q11','q12','q13','q14','q15','q16','q17','q18','q19','q20'];
    for (const key of questionKeys) {
      if (answers[key] === undefined || answers[key] === null) {
        return res.status(400).json({ error: `Answer for ${key} is required` });
      }
    }

    // Convert to boolean
    const boolAnswers = {};
    questionKeys.forEach(k => {
      boolAnswers[k] = answers[k] === true || answers[k] === 'true' || answers[k] === 1 || answers[k] === '1';
    });

    const scores = calculateScores(boolAnswers);

    // Get AI recommendations
    const projectDesc = `${project.title}: ${project.description || ''} Purpose: ${project.purpose || ''}`;
    const aiRecs = await getRecommendations(scores, projectDesc);

    // Delete previous assessment if exists
    await pool.query('DELETE FROM assessments WHERE project_id = $1', [id]);

    // Insert assessment
    const aResult = await pool.query(
      `INSERT INTO assessments (
        project_id, q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,q15,q16,q17,q18,q19,q20,
        privacy_score, fairness_score, security_score, transparency_score, accountability_score,
        overall_score, risk_level, ai_recommendations
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
        $22,$23,$24,$25,$26,$27,$28,$29) RETURNING *`,
      [
        id,
        boolAnswers.q1, boolAnswers.q2, boolAnswers.q3, boolAnswers.q4,
        boolAnswers.q5, boolAnswers.q6, boolAnswers.q7, boolAnswers.q8,
        boolAnswers.q9, boolAnswers.q10, boolAnswers.q11, boolAnswers.q12,
        boolAnswers.q13, boolAnswers.q14, boolAnswers.q15, boolAnswers.q16,
        boolAnswers.q17, boolAnswers.q18, boolAnswers.q19, boolAnswers.q20,
        scores.privacyScore, scores.fairnessScore, scores.securityScore,
        scores.transparencyScore, scores.accountabilityScore,
        scores.overall, scores.riskLevel, aiRecs
      ]
    );

    // Update project status
    await pool.query(
      'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
      ['under_review', id]
    );

    await logAudit(req.user.id, 'ASSESSMENT_SUBMITTED', 'assessments', aResult.rows[0].id, ip);

    res.status(201).json({
      message: 'Assessment submitted successfully',
      assessment: aResult.rows[0],
    });
  } catch (err) {
    console.error('Submit assessment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getResults(req, res) {
  const { id } = req.params;
  try {
    const projectResult = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND developer_id = $2',
      [id, req.user.id]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const assessResult = await pool.query(
      'SELECT * FROM assessments WHERE project_id = $1 ORDER BY assessed_at DESC LIMIT 1',
      [id]
    );
    if (assessResult.rows.length === 0) {
      return res.status(404).json({ error: 'No assessment found for this project' });
    }

    const reviewResult = await pool.query(
      `SELECT r.*, u.full_name AS officer_name 
       FROM reviews r JOIN users u ON r.officer_id = u.id 
       WHERE r.project_id = $1 ORDER BY r.reviewed_at DESC LIMIT 1`,
      [id]
    );

    res.json({
      project: projectResult.rows[0],
      assessment: assessResult.rows[0],
      review: reviewResult.rows[0] || null,
    });
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function downloadReport(req, res) {
  const { id } = req.params;
  try {
    const projectResult = await pool.query(
      `SELECT p.*, u.full_name, u.email FROM projects p 
       JOIN users u ON p.developer_id = u.id 
       WHERE p.id = $1 AND p.developer_id = $2`,
      [id, req.user.id]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const assessResult = await pool.query(
      'SELECT * FROM assessments WHERE project_id = $1 ORDER BY assessed_at DESC LIMIT 1',
      [id]
    );
    if (assessResult.rows.length === 0) {
      return res.status(404).json({ error: 'No assessment found' });
    }

    const reviewResult = await pool.query(
      `SELECT r.*, u.full_name AS officer_name 
       FROM reviews r JOIN users u ON r.officer_id = u.id 
       WHERE r.project_id = $1 ORDER BY r.reviewed_at DESC LIMIT 1`,
      [id]
    );

    const projectRow = projectResult.rows[0];
    const pdfBuffer = await generateReport({
      project: projectRow,
      developer: { full_name: projectRow.full_name, email: projectRow.email },
      assessment: assessResult.rows[0],
      review: reviewResult.rows[0] || null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="aceas-report-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Report download error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getProjects, createProject, getProject, submitAssessment, getResults, downloadReport };
