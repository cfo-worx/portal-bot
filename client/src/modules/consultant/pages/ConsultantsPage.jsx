// /var/www/html/client/src/modules/consultant/pages/ConsultantsPage.jsx

import React from 'react';
import { Typography } from '@mui/material';

const ConsultantsPage = () => {
  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Consultant Dashboard
      </Typography>
      <Typography>
        Welcome to the Consultant Dashboard! Here you can view your assignments and manage your tasks.
      </Typography>
      {/* Add more consultant-specific components here */}
    </div>
  );
};

export default ConsultantsPage;
