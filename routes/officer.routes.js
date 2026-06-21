const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { getAllProjects, getProjectDetail, reviewProject } = require('../controllers/officer.controller');

router.use(authenticateToken);
router.use(requireRole('compliance_officer', 'system_admin'));

router.get('/projects', getAllProjects);
router.get('/projects/:id', getProjectDetail);
router.post('/projects/:id/review', reviewProject);

module.exports = router;
