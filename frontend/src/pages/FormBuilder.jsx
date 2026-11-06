import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Eye, EyeOff, GripVertical, Settings } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

const FormBuilder = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [formData, setFormData] = useState({
    formName: '',
    formDescription: '',
    formFields: []
  });
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Predefined field types that admins can add
  const AVAILABLE_FIELD_TYPES = [
    { key: 'text', label: 'Text Input', icon: '📝' },
    { key: 'email', label: 'Email', icon: '📧' },
    { key: 'tel', label: 'Phone Number', icon: '📱' },
    { key: 'number', label: 'Number', icon: '🔢' },
    { key: 'date', label: 'Date', icon: '📅' },
    { key: 'textarea', label: 'Text Area', icon: '📄' },
    { key: 'select', label: 'Dropdown', icon: '📋' },
    { key: 'radio', label: 'Radio Buttons', icon: '🔘' },
    { key: 'checkbox', label: 'Checkboxes', icon: '☑️' }
  ];

  useEffect(() => {
    if (formId) {
      fetchForm();
    } else {
      setLoading(false);
    }
  }, [formId]);

  const fetchForm = async () => {
    try {
      const response = await api.get(`/forms/${formId}`);
      const formData = response.data.data;
      setForm(formData);
      setFormData({
        formName: formData.form_name,
        formDescription: formData.form_description,
        formFields: formData.form_fields || []
      });
    } catch (error) {
      toast.error('Failed to fetch form');
      navigate('/forms');
    } finally {
      setLoading(false);
    }
  };

  const addField = (fieldType) => {
    const newField = {
      id: Date.now().toString(),
      key: `field_${Date.now()}`,
      label: '',
      type: fieldType,
      required: false,
      placeholder: '',
      options: fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' ? ['Option 1', 'Option 2'] : [],
      isEnabled: true
    };

    setFormData({
      ...formData,
      formFields: [...formData.formFields, newField]
    });
  };

  const updateField = (index, field, value) => {
    const updatedFields = [...formData.formFields];
    updatedFields[index] = { ...updatedFields[index], [field]: value };
    setFormData({ ...formData, formFields: updatedFields });
  };

  const removeField = (index) => {
    const updatedFields = formData.formFields.filter((_, i) => i !== index);
    setFormData({ ...formData, formFields: updatedFields });
  };

  const toggleFieldEnabled = (index) => {
    const updatedFields = [...formData.formFields];
    updatedFields[index].isEnabled = !updatedFields[index].isEnabled;
    setFormData({ ...formData, formFields: updatedFields });
  };

  const addOption = (fieldIndex) => {
    const updatedFields = [...formData.formFields];
    updatedFields[fieldIndex].options = [...updatedFields[fieldIndex].options, `Option ${updatedFields[fieldIndex].options.length + 1}`];
    setFormData({ ...formData, formFields: updatedFields });
  };

  const updateOption = (fieldIndex, optionIndex, value) => {
    const updatedFields = [...formData.formFields];
    updatedFields[fieldIndex].options[optionIndex] = value;
    setFormData({ ...formData, formFields: updatedFields });
  };

  const removeOption = (fieldIndex, optionIndex) => {
    const updatedFields = [...formData.formFields];
    updatedFields[fieldIndex].options = updatedFields[fieldIndex].options.filter((_, i) => i !== optionIndex);
    setFormData({ ...formData, formFields: updatedFields });
  };

  // Drag and drop functionality
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const updatedFields = [...formData.formFields];
    const draggedField = updatedFields[draggedIndex];
    
    // Remove dragged field
    updatedFields.splice(draggedIndex, 1);
    // Insert at new position
    updatedFields.splice(dropIndex, 0, draggedField);
    
    setFormData({ ...formData, formFields: updatedFields });
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Change field type
  const changeFieldType = (index, newType) => {
    const updatedFields = [...formData.formFields];
    const field = updatedFields[index];
    
    // Reset field properties based on new type
    updatedFields[index] = {
      ...field,
      type: newType,
      options: (newType === 'select' || newType === 'radio' || newType === 'checkbox') 
        ? (field.options && field.options.length > 0 ? field.options : ['Option 1', 'Option 2'])
        : []
    };
    
    setFormData({ ...formData, formFields: updatedFields });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.formName.trim()) {
      toast.error('Form name is required');
      return;
    }

    if (formData.formFields.length === 0) {
      toast.error('Please add at least one field');
      return;
    }

    // Validate fields
    for (let i = 0; i < formData.formFields.length; i++) {
      const field = formData.formFields[i];
      if (!field.label.trim()) {
        toast.error(`Field ${i + 1} label is required`);
        return;
      }
      if ((field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && field.options.length === 0) {
        toast.error(`${field.label} must have at least one option`);
        return;
      }
    }

    setSaving(true);
    try {
      const submissionData = {
        formName: formData.formName,
        formDescription: formData.formDescription,
        formFields: formData.formFields
      };

      if (formId) {
        await api.put(`/forms/${formId}`, submissionData);
        toast.success('Form updated successfully');
      } else {
        await api.post('/forms', submissionData);
        toast.success('Form created successfully');
      }
      navigate('/forms');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <LoadingAnimation
            width={32}
            height={32}
            message="Loading form builder..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/forms')} className="p-2 hover:bg-background rounded-lg transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-main">
            {formId ? 'Edit Student Form' : 'Create New Form'}
          </h1>
          <p className="text-sub mt-1">Customize the student registration form fields</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Details */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-xl font-semibold text-main mb-4">Form Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-sub mb-2">Form Name *</label>
              <input 
                type="text" 
                value={formData.formName} 
                onChange={(e) => setFormData({ ...formData, formName: e.target.value })} 
                className="w-full px-4 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="Enter form name" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sub mb-2">Description</label>
              <textarea 
                value={formData.formDescription} 
                onChange={(e) => setFormData({ ...formData, formDescription: e.target.value })} 
                className="w-full px-4 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                rows="3" 
                placeholder="Enter form description" 
              />
            </div>
          </div>
        </div>

        {/* Add Fields */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-xl font-semibold text-main mb-4">Add Fields</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {AVAILABLE_FIELD_TYPES.map((fieldType) => (
              <button
                key={fieldType.key}
                type="button"
                onClick={() => addField(fieldType.key)}
                className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border-strong rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                <span className="text-2xl">{fieldType.icon}</span>
                <span className="text-sm font-medium text-sub">{fieldType.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Fields */}
        {formData.formFields.length > 0 && (
          <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-main">Form Fields ({formData.formFields.length})</h2>
              <div className="text-sm text-muted-text bg-[var(--primary-light)] px-3 py-2 rounded-lg">
                💡 Drag fields to reorder • Toggle visibility for student form • Change field types anytime
              </div>
            </div>
            <div className="space-y-4">
              {formData.formFields.map((field, index) => (
                <div 
                  key={field.id} 
                  className={`border rounded-lg p-4 transition-all duration-200 ${
                    field.isEnabled ? 'border-border bg-surface' : 'border-border bg-background'
                  } ${draggedIndex === index ? 'opacity-50 scale-95' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="cursor-move p-1 hover:bg-background rounded">
                        <GripVertical size={16} className="text-muted-text" />
                      </div>
                      <span className="text-lg">
                        {AVAILABLE_FIELD_TYPES.find(ft => ft.key === field.type)?.icon || '📝'}
                      </span>
                      <span className="font-medium text-sub">
                        {field.label || `Field ${index + 1}`}
                      </span>
                      <span className="text-xs bg-background text-sub px-2 py-1 rounded">
                        {field.type}
                      </span>
                      {field.required && (
                        <span className="text-xs bg-[var(--danger-light)] text-danger px-2 py-1 rounded">
                          Required
                        </span>
                      )}
                      {!field.isEnabled && (
                        <span className="text-xs bg-[var(--warning-light)] text-warning px-2 py-1 rounded">
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFieldEnabled(index)}
                        className={`p-2 rounded-lg transition-colors ${
                          field.isEnabled 
                            ? 'text-success hover:bg-[var(--success-light)]'
                            : 'text-muted-text hover:bg-background'
                        }`}
                        title={field.isEnabled ? 'Hide from student form' : 'Show in student form'}
                      >
                        {field.isEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="p-2 text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                        title="Delete field permanently"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-sub mb-1">Label *</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(index, 'label', e.target.value)}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                        placeholder="Field label"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-sub mb-1">Field Type</label>
                      <select
                        value={field.type}
                        onChange={(e) => changeFieldType(index, e.target.value)}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                      >
                        {AVAILABLE_FIELD_TYPES.map((type) => (
                          <option key={type.key} value={type.key}>
                            {type.icon} {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-sub mb-1">Placeholder</label>
                      <input
                        type="text"
                        value={field.placeholder}
                        onChange={(e) => updateField(index, 'placeholder', e.target.value)}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                        placeholder="Placeholder text"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(index, 'required', e.target.checked)}
                        className="w-4 h-4 text-primary-600 border-border-strong rounded focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-sub">Required field</span>
                    </label>
                  </div>

                  {/* Options for select, radio, checkbox */}
                  {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-sub">Options</label>
                        <button
                          type="button"
                          onClick={() => addOption(index)}
                          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                        >
                          <Plus size={14} />
                          Add Option
                        </button>
                      </div>
                      <div className="space-y-2">
                        {field.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                              className="flex-1 px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                              placeholder="Option text"
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(index, optionIndex)}
                              className="p-2 text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
  type="submit"
  disabled={saving}
  className="flex items-center gap-2 bg-gradient-to-r from-primary via-secondary to-accent text-white px-8 py-3 rounded-xl font-semibold
             hover:from-accent hover:via-secondary hover:to-primary focus:ring-4 focus:ring-[var(--primary-light)]
             transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed
             shadow-md hover:shadow-xl transform hover:scale-105 active:scale-95"
>
  <Save size={20} />
  {saving ? 'Saving...' : (formId ? 'Update Form' : 'Create Form')}
</button>

          <button
            type="button"
            onClick={() => navigate('/forms')}
            className="px-6 py-3 border border-border-strong text-sub rounded-lg hover:bg-background transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormBuilder;
