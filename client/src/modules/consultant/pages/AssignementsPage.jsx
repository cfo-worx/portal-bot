// /var/www/html/client/src/modules/consultant/pages/AssignmentsPage.jsx

import React from 'react';
import { Typography, List, ListItem, ListItemText } from '@mui/material';

const AssignmentsPage = () => {
  // Example assignments data
  const assignments = [
    { id: 1, title: 'Project Alpha', description: 'Complete initial setup.' },
    { id: 2, title: 'Project Beta', description: 'Conduct market research.' },
    // Add more assignments as needed
  ];

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Assignments
      </Typography>
      <List>
        {assignments.map((assignment) => (
          <ListItem key={assignment.id}>
            <ListItemText
              primary={assignment.title}
              secondary={assignment.description}
            />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default AssignmentsPage;
