// validation.js
export const validateClient = ({ ClientName }) => {
  const errors = [];
  if (!ClientName || ClientName.trim() === '') {
    errors.push('Client Name is required.');
  }
  return errors;
};


// validation.js
export const validateConsultant = ({
  FirstName,
  LastName,
  JobTitle,
  PayRate,
}) => {
  const errors = [];
  if (!FirstName || FirstName.trim() === '') {
    errors.push('First Name is required.');
  }
  if (!LastName || LastName.trim() === '') {
    errors.push('Last Name is required.');
  }
  if (!JobTitle || JobTitle.trim() === '') {
    errors.push('Job Title is required.');
  }
  if (PayRate === '' || PayRate === null) {
    errors.push('Pay Rate is required.');
  } else if (isNaN(PayRate) || PayRate < 0) {
    errors.push('Pay Rate must be a positive number.');
  }
  return errors;
};




export const validateContact = ({
  Name,
  Title,
  PhoneNumber,
  Email,
  Role,
}) => {
  const errors = [];
  if (!Name || Name.trim() === '') {
    errors.push('Contact Name is required.');
  }
  if (!Title || Title.trim() === '') {
    errors.push('Contact Title is required.');
  }
  if (!Email || Email.trim() === '') {
    errors.push('Contact Email is required.');
  } else if (!/^\S+@\S+\.\S+$/.test(Email)) {
    errors.push('Invalid email format.');
  }
  if (!Role || Role.trim() === '') {
    errors.push('Contact Role is required.');
  }
  return errors;
};



// frontend/src/utils/validation.js

export const validateUser = ({ FirstName, LastName, Email, Password, Roles }) => {
  const errors = [];
  if (!FirstName || FirstName.trim() === '') {
    errors.push('First Name is required.');
  }
  if (!LastName || LastName.trim() === '') {
    errors.push('Last Name is required.');
  }
  if (!Email || Email.trim() === '') {
    errors.push('Email is required.');
  } else if (!/^\S+@\S+\.\S+$/.test(Email)) {
    errors.push('Invalid email format.');
  }
  if (!Roles || Roles.length === 0) {
    errors.push('At least one role must be selected.');
  }
  return errors;
};