// server/routes/projectRoutes.js
import express from 'express';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  cloneProject,
  cloneRecurringProject
} from '../controllers/projectController.js';

import Template from '../models/Template.js';

const router = express.Router();

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.post('/:id/clone', cloneProject);
router.post('/:id/clone-recurring', cloneRecurringProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);

router.post('/:id/save-as-template', async (req, res, next) => {
  try {
    const templateID = await Template.saveFromProject(req.params.id, req.body.TemplateName);
    res.status(201).json({ TemplateID: templateID });
  } catch (err) { next(err); }
});

export default router;