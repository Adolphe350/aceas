const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const {
  getUsers, createUser, updateUser, deleteUser,
  getAllProjects, getAuditLog
} = require('../controllers/admin.controller');

router.use(authenticateToken);
router.use(requireRole('system_admin'));

router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/projects', getAllProjects);
router.get('/audit-log', getAuditLog);

module.exports = router;
