import CRMStage from '../models/CRMStage.js';
import CRMLeadSource from '../models/CRMLeadSource.js';
import CRMCannedReply from '../models/CRMCannedReply.js';
import CRMRepGoal from '../models/CRMRepGoal.js';

// ========== STAGES ==========
export const getStages = async (req, res) => {
  try {
    const stages = await CRMStage.getAll(req.query.module || null);
    res.json(stages);
  } catch (error) {
    console.error('Error fetching stages:', error);
    res.status(500).json({ error: 'Failed to fetch stages' });
  }
};

export const updateStage = async (req, res) => {
  try {
    const stage = await CRMStage.update(req.params.id, req.body);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    res.json(stage);
  } catch (error) {
    console.error('Error updating stage:', error);
    res.status(500).json({ error: 'Failed to update stage' });
  }
};

// ========== LEAD SOURCES ==========
export const getLeadSources = async (req, res) => {
  try {
    const sources = await CRMLeadSource.getAll();
    res.json(sources);
  } catch (error) {
    console.error('Error fetching lead sources:', error);
    res.status(500).json({ error: 'Failed to fetch lead sources' });
  }
};

export const createLeadSource = async (req, res) => {
  try {
    const source = await CRMLeadSource.create(req.body);
    res.status(201).json(source);
  } catch (error) {
    console.error('Error creating lead source:', error);
    res.status(500).json({ error: 'Failed to create lead source' });
  }
};

export const updateLeadSource = async (req, res) => {
  try {
    const source = await CRMLeadSource.update(req.params.id, req.body);
    if (!source) {
      return res.status(404).json({ error: 'Lead source not found' });
    }
    res.json(source);
  } catch (error) {
    console.error('Error updating lead source:', error);
    res.status(500).json({ error: 'Failed to update lead source' });
  }
};

export const deleteLeadSource = async (req, res) => {
  try {
    await CRMLeadSource.delete(req.params.id);
    res.json({ message: 'Lead source deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead source:', error);
    res.status(500).json({ error: 'Failed to delete lead source' });
  }
};

// ========== CANNED REPLIES ==========
export const getCannedReplies = async (req, res) => {
  try {
    const replies = req.query.category
      ? await CRMCannedReply.getByCategory(req.query.category)
      : await CRMCannedReply.getAll();
    res.json(replies);
  } catch (error) {
    console.error('Error fetching canned replies:', error);
    res.status(500).json({ error: 'Failed to fetch canned replies' });
  }
};

export const createCannedReply = async (req, res) => {
  try {
    const reply = await CRMCannedReply.create(req.body);
    res.status(201).json(reply);
  } catch (error) {
    console.error('Error creating canned reply:', error);
    res.status(500).json({ error: 'Failed to create canned reply' });
  }
};

export const updateCannedReply = async (req, res) => {
  try {
    const reply = await CRMCannedReply.update(req.params.id, req.body);
    if (!reply) {
      return res.status(404).json({ error: 'Canned reply not found' });
    }
    res.json(reply);
  } catch (error) {
    console.error('Error updating canned reply:', error);
    res.status(500).json({ error: 'Failed to update canned reply' });
  }
};

export const deleteCannedReply = async (req, res) => {
  try {
    await CRMCannedReply.delete(req.params.id);
    res.json({ message: 'Canned reply deleted successfully' });
  } catch (error) {
    console.error('Error deleting canned reply:', error);
    res.status(500).json({ error: 'Failed to delete canned reply' });
  }
};

// ========== REP GOALS ==========
export const getRepGoals = async (req, res) => {
  try {
    const filters = {
      consultantId: req.query.consultantId || null,
      periodType: req.query.periodType || null,
      periodStart: req.query.periodStart || null,
      periodEnd: req.query.periodEnd || null,
    };
    const goals = await CRMRepGoal.getAll(filters);
    res.json(goals);
  } catch (error) {
    console.error('Error fetching rep goals:', error);
    res.status(500).json({ error: 'Failed to fetch rep goals' });
  }
};

export const createRepGoal = async (req, res) => {
  try {
    const goal = await CRMRepGoal.create(req.body);
    res.status(201).json(goal);
  } catch (error) {
    console.error('Error creating rep goal:', error);
    res.status(500).json({ error: 'Failed to create rep goal' });
  }
};

export const updateRepGoal = async (req, res) => {
  try {
    const goal = await CRMRepGoal.update(req.params.id, req.body);
    if (!goal) {
      return res.status(404).json({ error: 'Rep goal not found' });
    }
    res.json(goal);
  } catch (error) {
    console.error('Error updating rep goal:', error);
    res.status(500).json({ error: 'Failed to update rep goal' });
  }
};

export const getOrCreateRepGoal = async (req, res) => {
  try {
    const { consultantId, periodType, periodStart, periodEnd } = req.body;
    const goal = await CRMRepGoal.getOrCreate(
      consultantId,
      periodType,
      periodStart,
      periodEnd
    );
    res.json(goal);
  } catch (error) {
    console.error('Error getting or creating rep goal:', error);
    res.status(500).json({ error: 'Failed to get or create rep goal' });
  }
};

export const deleteRepGoal = async (req, res) => {
  try {
    await CRMRepGoal.delete(req.params.id);
    res.json({ message: 'Rep goal deleted successfully' });
  } catch (error) {
    console.error('Error deleting rep goal:', error);
    res.status(500).json({ error: 'Failed to delete rep goal' });
  }
};

