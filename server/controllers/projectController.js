// server/controllers/projectController.js
import Project from '../models/Project.js';

export const getProjects = async (req, res) => {
  try {
    const projects = await Project.getAllWithDetails();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// server/controllers/projectController.js
export const createProject = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.ProjectName || !req.body.ClientID) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate ClientID using Project model
    const clientExists = await Project.clientExists(req.body.ClientID);
    if (!clientExists) {
      return res.status(400).json({ message: 'Invalid ClientID' });
    }

    const newId = await Project.create(req.body);
    res.status(201).json({ id: newId });
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      details: error.originalError?.info?.message 
    });
  }
};

export const updateProject = async (req, res) => {
  try {
    await Project.update(req.params.id, req.body);
    res.json({ message: 'Project updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    await Project.delete(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// server/controllers/projectController.js
export const getProjectById = async (req, res) => {
    try {
      const project = await Project.getById(req.params.id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };



  export const cloneProject = async (req, res) => {
    try {
      // req.params.id is the old project ID
      // req.body should include { ProjectName, ClientID, StartDate, Status }
      const newId = await Project.cloneProject(
        req.params.id,
        req.body
      );
      res.status(201).json({ ProjectID: newId });
    } catch (error) {
      console.error('Clone error:', error);
      res.status(500).json({ message: 'Cloning failed', error: error.message });
    }
  };



  export const cloneRecurringProject = async (req, res) => {
  try {
    const newId = await Project.cloneRecurringProject(req.params.id);
    res.status(201).json({ ProjectID: newId });
  } catch (error) {
    console.error('Recurring clone error:', error);
    res.status(500).json({ message: 'Recurring clone failed', error: error.message });
  }
};
