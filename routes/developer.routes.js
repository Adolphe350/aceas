const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const {
  getProjects, createProject, getProject,
  submitAssessment, getResults, downloadReport
} = require('../controllers/developer.controller');

router.use(authenticateToken);
router.use(requireRole('ai_developer'));

router.get('/projects', getProjects);
router.post('/projects', createProject);
router.get('/projects/:id', getProject);
router.post('/projects/:id/assess', submitAssessment);
router.get('/projects/:id/results', getResults);
router.get('/projects/:id/report', downloadReport);

module.exports = router;
