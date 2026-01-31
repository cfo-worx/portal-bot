// src/theme.js

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0D47A1', // Navy blue
    },
    secondary: {
      main: '#757575', // Gray
    },
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
  },
});

export default theme;
