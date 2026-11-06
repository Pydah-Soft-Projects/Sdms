import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Eye, EyeOff, GripVertical, Calendar, Clock, Star } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

const FeedbackFormBuilder = () => {
    const { formId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(null);
    const [formData, setFormData] = useState({
        formName: '',
        formDescription: '',
        recurrence: {
            enabled: false,
            durationDays: 10
        },
        formFields: []
    });
    const [draggedIndex, setDraggedIndex] = useState(null);

    // Predefined field types
    const AVAILABLE_FIELD_TYPES = [
        { key: 'text', label: 'Text Input', icon: '📝', color: 'from-primary to-primary' },
        { key: 'textarea', label: 'Text Area', icon: '📄', color: 'from-secondary to-secondary' },
        { key: 'select', label: 'Dropdown', icon: '📋', color: 'from-success to-success' },
        { key: 'radio', label: 'Radio Buttons', icon: '🔘', color: 'from-warning to-warning' },
        { key: 'checkbox', label: 'Checkboxes', icon: '☑️', color: 'from-accent to-accent' },
        { key: 'rating', label: 'Rating (1-5)', icon: '⭐', color: 'from-warning to-warning' }
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
            const response = await api.get(`/feedback-forms/${formId}`);
            const formData = response.data.data;
            setForm(formData);

            // Parse recurrence config
            let recurrence = { enabled: false, durationDays: 10 };
            if (formData.recurrence_config) {
                const parsed = typeof formData.recurrence_config === 'string'
                    ? JSON.parse(formData.recurrence_config)
                    : formData.recurrence_config;
                recurrence = {
                    enabled: parsed.enabled || false,
                    durationDays: parsed.durationDays || 10
                };
            }

            setFormData({
                formName: formData.form_name,
                formDescription: formData.form_description,
                recurrence,
                formFields: formData.form_fields || []
            });
        } catch (error) {
            toast.error('Failed to fetch feedback form');
            navigate('/feedback-forms');
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
            options: fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox'
                ? ['Excellent', 'Good', 'Average', 'Poor']
                : [],
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

    // Drag and drop
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
        updatedFields.splice(draggedIndex, 1);
        updatedFields.splice(dropIndex, 0, draggedField);

        setFormData({ ...formData, formFields: updatedFields });
        setDraggedIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const changeFieldType = (index, newType) => {
        const updatedFields = [...formData.formFields];
        const field = updatedFields[index];

        updatedFields[index] = {
            ...field,
            type: newType,
            options: (newType === 'select' || newType === 'radio' || newType === 'checkbox')
                ? (field.options && field.options.length > 0 ? field.options : ['Excellent', 'Good', 'Average', 'Poor'])
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
                recurrence: formData.recurrence,
                formFields: formData.formFields
            };

            if (formId) {
                await api.put(`/feedback-forms/${formId}`, submissionData);
                toast.success('Feedback form updated successfully');
            } else {
                await api.post('/feedback-forms', submissionData);
                toast.success('Feedback form created successfully');
            }
            navigate('/feedback-forms');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save form');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingAnimation width={32} height={32} message="Loading feedback form builder..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[var(--background)] via-[var(--primary-light)] to-[var(--primary-light)] p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/feedback-forms')}
                        className="p-3 hover:bg-[var(--surface)]/80 rounded-xl transition-all shadow-sm border border-border bg-surface"
                    >
                        <ArrowLeft size={24} className="text-sub" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                            {formId ? 'Edit Feedback Form' : 'Create New Feedback Form'}
                        </h1>
                        <p className="text-sub mt-1 text-sm sm:text-base">Design student feedback surveys with custom questions</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Form Details */}
                    <div className="bg-surface rounded-2xl shadow-lg border border-border p-6 sm:p-8 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg">
                                <Calendar className="text-white" size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-main">Form Details</h2>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-sub mb-2">Form Name *</label>
                                <input
                                    type="text"
                                    value={formData.formName}
                                    onChange={(e) => setFormData({ ...formData, formName: e.target.value })}
                                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-secondary focus:border-secondary outline-none transition-all"
                                    placeholder="e.g., Academic Feedback Form"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-sub mb-2">Description</label>
                                <textarea
                                    value={formData.formDescription}
                                    onChange={(e) => setFormData({ ...formData, formDescription: e.target.value })}
                                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-secondary focus:border-secondary outline-none transition-all"
                                    rows="3"
                                    placeholder="Provide feedback on teaching quality and course content"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Schedule Settings */}
                    <div className="bg-surface rounded-2xl shadow-lg border border-border p-6 sm:p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg">
                                    <Clock className="text-white" size={24} />
                                </div>
                                <h2 className="text-2xl font-bold text-main">Schedule Sender</h2>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={formData.recurrence?.enabled}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        recurrence: { ...formData.recurrence, enabled: e.target.checked }
                                    })}
                                />
                                <div className="w-14 h-7 bg-background peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--primary-light)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-border-strong after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-secondary peer-checked:to-accent shadow-inner"></div>
                                <span className="ml-3 text-sm font-semibold text-sub">Enable</span>
                            </label>
                        </div>

                        {formData.recurrence?.enabled && (
                            <div className="space-y-6 animate-fadeIn">
                                {/* Duration Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-sub mb-3">Active Duration</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[7, 10, 15, 20, 30].map((days) => (
                                            <button
                                                key={days}
                                                type="button"
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    recurrence: { ...formData.recurrence, durationDays: days }
                                                })}
                                                className={`px-4 py-3 rounded-xl font-semibold transition-all ${formData.recurrence.durationDays === days
                                                    ? 'bg-gradient-to-r from-secondary to-accent text-white shadow-lg scale-105'
                                                    : 'bg-background text-sub hover:bg-background'
                                                    }`}
                                            >
                                                {days} Days
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add Fields */}
                    <div className="bg-surface rounded-2xl shadow-lg border border-border p-6 sm:p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-gradient-to-br from-success to-primary rounded-xl shadow-lg">
                                <Plus className="text-white" size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-main">Add Question Fields</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {AVAILABLE_FIELD_TYPES.map((fieldType) => (
                                <button
                                    key={fieldType.key}
                                    type="button"
                                    onClick={() => addField(fieldType.key)}
                                    className={`group relative overflow-hidden flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-border-strong hover:border-transparent transition-all hover:scale-105 hover:shadow-xl bg-gradient-to-br ${fieldType.color} hover:from-opacity-100`}
                                >
                                    <div className="absolute inset-0 bg-surface opacity-90 group-hover:opacity-0 transition-opacity"></div>
                                    <span className="text-3xl relative z-10">{fieldType.icon}</span>
                                    <span className="text-xs font-bold text-sub group-hover:text-white relative z-10 text-center transition-colors">
                                        {fieldType.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Form Fields */}
                    {formData.formFields.length > 0 && (
                        <div className="bg-surface rounded-2xl shadow-lg border border-border p-6 sm:p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-gradient-to-br from-warning to-danger rounded-xl shadow-lg">
                                        <Star className="text-white" size={24} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-main">Questions ({formData.formFields.length})</h2>
                                </div>
                                <div className="text-xs sm:text-sm text-muted-text bg-[var(--primary-light)] px-4 py-2 rounded-xl border border-[var(--primary-light)]">
                                    💡 Drag to reorder • Toggle visibility
                                </div>
                            </div>
                            <div className="space-y-4">
                                {formData.formFields.map((field, index) => (
                                    <div
                                        key={field.id}
                                        className={`border-2 rounded-2xl p-5 transition-all duration-200 ${field.isEnabled
                                            ? 'border-border bg-surface shadow-sm hover:shadow-md'
                                            : 'border-border bg-background opacity-60'
                                            } ${draggedIndex === index ? 'opacity-50 scale-95' : ''}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, index)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="cursor-move p-2 hover:bg-background rounded-lg transition-colors">
                                                    <GripVertical size={18} className="text-muted-text" />
                                                </div>
                                                <span className="text-2xl">{AVAILABLE_FIELD_TYPES.find(ft => ft.key === field.type)?.icon || '📝'}</span>
                                                <div>
                                                    <span className="font-bold text-main block">{field.label || `Question ${index + 1}`}</span>
                                                    <span className="text-xs bg-gradient-to-r from-primary to-secondary text-white px-2 py-1 rounded-full">
                                                        {field.type}
                                                    </span>
                                                </div>
                                                {field.required && (
                                                    <span className="text-xs bg-[var(--danger-light)] text-danger px-2 py-1 rounded-full font-semibold">
                                                        Required
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleFieldEnabled(index)}
                                                    className={`p-2 rounded-lg transition-all ${field.isEnabled
                                                        ? 'text-success bg-[var(--success-light)] hover:bg-[var(--success-light)]'
                                                        : 'text-muted-text bg-background hover:bg-background'
                                                        }`}
                                                >
                                                    {field.isEnabled ? <Eye size={18} /> : <EyeOff size={18} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeField(index)}
                                                    className="p-2 text-danger bg-[var(--danger-light)] hover:bg-[var(--danger-light)] rounded-lg transition-all"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-sub mb-2">Question Label *</label>
                                                <input
                                                    type="text"
                                                    value={field.label}
                                                    onChange={(e) => updateField(index, 'label', e.target.value)}
                                                    className="w-full px-3 py-2 border-2 border-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary outline-none text-sm"
                                                    placeholder="Enter question"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-sub mb-2">Field Type</label>
                                                <select
                                                    value={field.type}
                                                    onChange={(e) => changeFieldType(index, e.target.value)}
                                                    className="w-full px-3 py-2 border-2 border-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary outline-none text-sm"
                                                >
                                                    {AVAILABLE_FIELD_TYPES.map((type) => (
                                                        <option key={type.key} value={type.key}>
                                                            {type.icon} {type.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-sub mb-2">Placeholder</label>
                                                <input
                                                    type="text"
                                                    value={field.placeholder}
                                                    onChange={(e) => updateField(index, 'placeholder', e.target.value)}
                                                    className="w-full px-3 py-2 border-2 border-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary outline-none text-sm"
                                                    placeholder="Hint text"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={field.required}
                                                    onChange={(e) => updateField(index, 'required', e.target.checked)}
                                                    className="w-5 h-5 text-secondary border-border-strong rounded focus:ring-secondary"
                                                />
                                                <span className="text-sm font-semibold text-sub">Required field</span>
                                            </label>
                                        </div>

                                        {/* Options for select, radio, checkbox */}
                                        {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                                            <div className="mt-4 p-4 bg-background rounded-xl border border-border">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-sm font-bold text-sub">Options</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => addOption(index)}
                                                        className="flex items-center gap-1 text-sm text-secondary hover:text-secondary font-semibold"
                                                    >
                                                        <Plus size={16} />
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
                                                                className="flex-1 px-3 py-2 border-2 border-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary outline-none text-sm"
                                                                placeholder="Option text"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeOption(index, optionIndex)}
                                                                className="p-2 text-danger bg-[var(--danger-light)] hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={16} />
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
                    <div className="flex items-center gap-4 sticky bottom-6 bg-[var(--surface)]/80 backdrop-blur-lg p-6 rounded-2xl shadow-2xl border border-border">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-3 bg-gradient-to-r from-secondary via-accent to-danger text-white px-8 py-4 rounded-xl font-bold text-lg
                            hover:from-danger hover:via-accent hover:to-secondary focus:ring-4 focus:ring-[var(--primary-light)]
                            transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed
                            shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95"
                        >
                            <Save size={22} />
                            {saving ? 'Saving...' : (formId ? 'Update Form' : 'Create Form')}
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate('/feedback-forms')}
                            className="px-6 py-4 border-2 border-border-strong text-sub rounded-xl hover:bg-background transition-all font-semibold"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FeedbackFormBuilder;
