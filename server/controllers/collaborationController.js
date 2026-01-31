import Collaboration from '../models/Collaboration.js';

export const listSpaces = async (req, res) => {
  try {
    const rows = await Collaboration.listSpacesForUser({ userID: req.user?.id || null });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list spaces', error: e.message });
  }
};

export const createSpace = async (req, res) => {
  try {
    const { name, description = null, isPrivate = false, memberUserIDs = [] } = req.body || {};
    if (!name) return res.status(400).json({ message: 'name is required' });
    const row = await Collaboration.createSpace({
      name,
      description,
      isPrivate: !!isPrivate,
      createdByUserID: req.user?.id || null,
      memberUserIDs,
    });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: 'Failed to create space', error: e.message });
  }
};

export const getSpace = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await Collaboration.getSpace({ spaceID: id });
    if (!row) return res.status(404).json({ message: 'Space not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: 'Failed to get space', error: e.message });
  }
};

export const addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role = 'MEMBER' } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    const row = await Collaboration.addMember({ spaceID: id, userID: userId, role });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: 'Failed to add member', error: e.message });
  }
};

// Alias for route compatibility
export const addSpaceMember = addMember;

export const listTasks = async (req, res) => {
  try {
    const { spaceId = null, status = null, assignedToUserId = null, includeClosed = false } = req.query;
    const rows = await Collaboration.listTasks({ 
      spaceID: spaceId, 
      status, 
      assignedToUserID: assignedToUserId,
      includeClosed: includeClosed === 'true' || includeClosed === true,
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list tasks', error: e.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.spaceId || !payload.title) {
      return res.status(400).json({ message: 'spaceId and title are required' });
    }
    const row = await Collaboration.createTask({
      spaceID: payload.spaceId,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      priority: payload.priority,
      status: payload.status,
      dueDate: payload.dueDate,
      clientID: payload.clientId,
      contractID: payload.contractId,
      projectID: payload.projectId,
      assignedToUserID: payload.assignedToUserId,
      createdByUserID: req.user?.id || null,
    });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: 'Failed to create task', error: e.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body || {};
    // Map camelCase to the format expected by the model
    const mappedPatch = {};
    if (patch.title !== undefined) mappedPatch.Title = patch.title;
    if (patch.description !== undefined) mappedPatch.Description = patch.description;
    if (patch.category !== undefined) mappedPatch.Category = patch.category;
    if (patch.priority !== undefined) mappedPatch.Priority = patch.priority;
    if (patch.status !== undefined) mappedPatch.Status = patch.status;
    if (patch.dueDate !== undefined) mappedPatch.DueDate = patch.dueDate;
    if (patch.clientId !== undefined) mappedPatch.ClientID = patch.clientId;
    if (patch.contractId !== undefined) mappedPatch.ContractID = patch.contractId;
    if (patch.projectId !== undefined) mappedPatch.ProjectID = patch.projectId;
    if (patch.assignedToUserId !== undefined) mappedPatch.AssignedToUserID = patch.assignedToUserId;
    const row = await Collaboration.updateTask({ taskID: id, patch: mappedPatch });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: 'Failed to update task', error: e.message });
  }
};

export const listComments = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await Collaboration.listComments({ taskID: id });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list comments', error: e.message });
  }
};

export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body || {};
    if (!body) return res.status(400).json({ message: 'body is required' });
    const row = await Collaboration.addComment({ taskID: id, body, userID: req.user?.id || null });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: 'Failed to add comment', error: e.message });
  }
};

// Aliases for route compatibility
export const listTaskComments = listComments;
export const addTaskComment = addComment;
