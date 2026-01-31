import React, { useEffect, useState } from 'react';
import ConsultantList from '../components/Team/ConsultantList';
import ConsultantForm from '../components/Team/ConsultantForm';
import Button from '@mui/material/Button';
import { getConsultants } from '../../../api/consultants';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

const TeamPage = () => {
  const [consultants, setConsultants] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [consultantStatusFilter, setConsultantStatusFilter] = useState("active");

  useEffect(() => {
    fetchConsultants();
  }, []);

  // Fetch all consultants (no filtering on Status in the SQL query)
  const fetchConsultants = async () => {
    try {
        const raw = await getConsultants();
   const sorted = [...raw].sort((a, b) =>
     `${a.FirstName} ${a.LastName}`.localeCompare(
       `${b.FirstName} ${b.LastName}`
     )
   );
   setConsultants(sorted);
    } catch (error) {
      console.error('Error fetching consultants:', error);
    }
  };

  const handleAddConsultant = () => {
    setSelectedConsultant(null);
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleViewConsultant = (consultant) => {
    setSelectedConsultant(consultant);
    setIsEditMode(false);
    setShowModal(true);
  };

  const handleEditConsultant = (consultant) => {
    setSelectedConsultant(consultant);
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedConsultant(null);
    setIsEditMode(false);
  };

  const handleStatusFilterChange = (event, newFilter) => {
    if (newFilter !== null) {
      setConsultantStatusFilter(newFilter);
    }
  };

  // Filter the consultants based on the Status value.
  // Using loose equality (==) so that numbers and strings can match.
  const filteredConsultants = consultants.filter((consultant) => {
    if (consultantStatusFilter === "active") {
      return consultant.Status == 1;
    } else {
      return consultant.Status == 0;
    }
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-semibold mb-4">Consultants</h1>
      {/* Controls Row: Add Consultant on the left; Active/Inactive toggle on the right */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="contained"
          color="primary"
          sx={{
            backgroundColor: '#1976d2',
            '&:hover': { backgroundColor: '#115293' },
            padding: '8px 16px',
            fontSize: '14px',
          }}
          onClick={handleAddConsultant}
        >
          Add Consultant
        </Button>
        <ToggleButtonGroup
          value={consultantStatusFilter}
          exclusive
          onChange={handleStatusFilterChange}
          aria-label="Consultant Status Filter"
          sx={{ padding: '8px' }}
        >
          <ToggleButton value="active" aria-label="Active Consultants">
            Active
          </ToggleButton>
          <ToggleButton value="inactive" aria-label="Inactive Consultants">
            Inactive
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
      <ConsultantList
        consultants={filteredConsultants}
        onView={handleViewConsultant}
        onEdit={handleEditConsultant}
      />
      {showModal && (
        <ConsultantForm
          consultant={selectedConsultant}
          isEditMode={isEditMode}
          onClose={handleCloseModal}
          refreshConsultants={fetchConsultants}
        />
      )}
    </div>
  );
};

export default TeamPage;
