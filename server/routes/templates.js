import express  from 'express';
import Template from '../models/Template.js';

const router = express.Router();

/* GET /templates */
router.get('/', async (_req, res, next) => {
  try {
    const data = await Template.getAllWithDetails();
    res.json(data);
  } catch (err) { next(err); }
});

/* POST /projects/:id/save-as-template */
router.post('/from-project/:id', async (req, res, next) => {
  try {
    const templateID = await Template.saveFromProject(req.params.id, req.body.TemplateName);
    res.status(201).json({ TemplateID: templateID });
  } catch (err) { next(err); }
});

/* POST /templates/:id/clone  (create live project) */
router.post('/:id/clone', async (req, res, next) => {
  try {
    const newPID = await Template.cloneToProject(req.params.id, req.body);
    res.status(201).json({ ProjectID: newPID });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req,res,next)=>{
  try {
    await Template.delete(req.params.id);
    res.sendStatus(204);
  } catch(err){next(err);}
});

export default router;
