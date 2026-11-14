import api from '../config/api';

const hostelService = {
  getMyHostelDetails: (admissionNumber) => {
    const query = admissionNumber ? `?admission_number=${encodeURIComponent(admissionNumber)}` : '';
    return api.get(`/hostel/my-details${query}`);
  },

  getHostelMenu: () => {
    return api.get('/hostel/menu');
  },

  getHostelAnnouncements: () => {
    return api.get('/hostel/announcements');
  }
};

export default hostelService;

