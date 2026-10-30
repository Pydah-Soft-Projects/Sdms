const fs = require('fs');

const wizardPath = 'd:/pydahsoft projects/Student-Data-Management-Application/frontend/src/pages/admin/AddServiceWizard.jsx';
let code = fs.readFileSync(wizardPath, 'utf8').replace(/\r\n/g, '\n');

const oldPreview = `  const generatePreview = async () => {
    // Logic to prepare preview URL for final review
    try {
      const blob = await serviceService.previewTemplate({
        template_type: "dynamic",
        service_name: serviceData.name,
        template_config: {
          ...templateData,
          // If URLs are needed, they are in templateData or resolved by backend
        },
      });
      const url = URL.createObjectURL(blob);
      setFinalPreviewJson(url);
    } catch (e) {
      console.error(e);
    }
  };`;

const newPreview = `  const generatePreview = async () => {
    // Logic to prepare preview URL for final review
    try {
      const selectedCollegeId = serviceData.college_id || templateData.college_id;
      const blob = await serviceService.previewTemplate({
        template_type: "dynamic",
        service_name: serviceData.name,
        college_id: selectedCollegeId,
        template_config: {
          ...templateData,
          college_id: selectedCollegeId,
        },
      });
      const url = URL.createObjectURL(blob);
      setFinalPreviewJson(url);
    } catch (e) {
      console.error("Preview generation error:", e);
      toast.error("Failed to generate preview: " + (e.response?.data?.message || e.message));
    }
  };`;

if (!code.includes(oldPreview)) {
  console.error('oldPreview not found!');
  process.exit(1);
}

code = code.replace(oldPreview, newPreview);
fs.writeFileSync(wizardPath, code, 'utf8');
console.log('Successfully updated generatePreview in AddServiceWizard.jsx!');

