import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    X,
    Camera,
    MapPin,
    CheckCircle2,
    Loader2,
    Building2
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import { compressTicketPhoto, MAX_TICKET_PHOTO_BYTES } from '../../utils/ticketPhoto';
import { SkeletonBox } from '../../components/SkeletonLoader';
import '../../styles/student-pages.css';

const DEFAULT_COLLEGES = [
    { id: '1', name: 'Pydah College of Engineering', code: 'PCE' },
    { id: '2', name: 'Pydah Degree College', code: 'PDC' },
    { id: '3', name: 'Pydah College of Pharmacy', code: 'PCP' },
    { id: '4', name: 'Pydah College of Education', code: 'PCOE' },
    { id: '5', name: 'Pydah Polytechnic', code: 'POLY' }
];

const RaiseTicket = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        category_id: '',
        sub_category_id: '',
        college_id: '',
        block_no: '',
        floor_no: '',
        room_no: '',
        title: '',
        description: '',
        photo: null
    });

    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoProcessing, setPhotoProcessing] = useState(false);

    // Fetch active categories
    const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
        queryKey: ['complaint-categories-active'],
        queryFn: async () => {
            const response = await api.get('/complaint-categories/active');
            return response.data?.data || [];
        }
    });

    // Fetch active colleges
    const { data: collegesData } = useQuery({
        queryKey: ['colleges-active'],
        queryFn: async () => {
            try {
                const response = await api.get('/colleges/public');
                return response.data?.data || [];
            } catch (_) {
                try {
                    const response = await api.get('/colleges/active');
                    return response.data?.data || [];
                } catch {
                    return [];
                }
            }
        }
    });

    const categories = categoriesData || [];
    const collegesList = (collegesData && collegesData.length > 0) ? collegesData : DEFAULT_COLLEGES;

    const selectedCategory = categories.find((c) => String(c.id) === String(formData.category_id));

    // Handle photo file selection
    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file (JPG, PNG, WebP)');
            e.target.value = '';
            return;
        }

        try {
            setPhotoProcessing(true);
            const compressed = await compressTicketPhoto(file, {
                maxSizeBytes: MAX_TICKET_PHOTO_BYTES,
                maxWidth: 1600,
                maxHeight: 1600,
                quality: 0.8
            });

            setFormData((prev) => ({ ...prev, photo: compressed }));

            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result);
            };
            reader.readAsDataURL(compressed);
        } catch (err) {
            console.error('Photo compression error:', err);
            toast.error('Could not process this image. Try another.');
        } finally {
            setPhotoProcessing(false);
            e.target.value = '';
        }
    };

    const removePhoto = () => {
        setFormData((prev) => ({ ...prev, photo: null }));
        setPhotoPreview(null);
    };

    // Create ticket mutation
    const createMutation = useMutation({
        mutationFn: async (formDataToSend) => {
            const formDataObj = new FormData();
            formDataObj.append('category_id', formDataToSend.category_id);
            if (formDataToSend.sub_category_id) {
                formDataObj.append('sub_category_id', formDataToSend.sub_category_id);
            }
            if (formDataToSend.college_id) {
                formDataObj.append('college_id', formDataToSend.college_id);
                const selectedCol = collegesList.find(c => String(c.id) === String(formDataToSend.college_id));
                if (selectedCol) {
                    formDataObj.append('college_name', selectedCol.name);
                }
            }
            if (formDataToSend.block_no) {
                formDataObj.append('block_no', formDataToSend.block_no);
            }
            if (formDataToSend.floor_no) {
                formDataObj.append('floor_no', formDataToSend.floor_no);
            }
            if (formDataToSend.room_no) {
                formDataObj.append('room_no', formDataToSend.room_no);
            }
            formDataObj.append('title', formDataToSend.title || '');
            formDataObj.append('description', formDataToSend.description || '');
            if (formDataToSend.photo) {
                formDataObj.append('photo', formDataToSend.photo);
            }

            const response = await api.post('/tickets', formDataObj, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        },
        onSuccess: (res) => {
            toast.success('Ticket submitted successfully! Maintenance team notified.');
            queryClient.invalidateQueries(['student-tickets']);
            queryClient.invalidateQueries(['student-stats']);
            setFormData({
                category_id: '',
                sub_category_id: '',
                college_id: '',
                block_no: '',
                floor_no: '',
                room_no: '',
                title: '',
                description: '',
                photo: null
            });
            setPhotoPreview(null);
            navigate('/student/my-tickets');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to submit ticket. Please check fields.');
        }
    });

    const handleCategoryChange = (catId) => {
        setFormData((prev) => ({
            ...prev,
            category_id: catId,
            sub_category_id: ''
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.category_id) {
            toast.error('Please select a category');
            return;
        }

        if (!formData.title.trim()) {
            toast.error('Please enter a subject line');
            return;
        }

        createMutation.mutate(formData);
    };

    if (categoriesLoading) {
        return (
            <div className="space-y-4 max-w-4xl mx-auto py-2 animate-pulse">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
                    <SkeletonBox height="h-10" width="w-full" className="rounded-xl" />
                    <SkeletonBox height="h-10" width="w-full" className="rounded-xl" />
                    <SkeletonBox height="h-28" width="w-full" className="rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full pb-12 font-sans">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-7 space-y-5">
                        {/* Category & Sub-Category Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Category Selection */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Category <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => handleCategoryChange(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-xl text-sm font-medium text-slate-800 transition-all outline-none"
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                {selectedCategory?.description && (
                                    <p className="mt-1 text-xs text-sky-600 font-medium italic">
                                        Note: {selectedCategory.description}
                                    </p>
                                )}
                            </div>

                            {/* Sub-Category Selection */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Specific Issue <span className="text-slate-400 font-normal lowercase">(optional)</span>
                                </label>
                                <select
                                    value={formData.sub_category_id}
                                    onChange={(e) => setFormData({ ...formData, sub_category_id: e.target.value })}
                                    disabled={!selectedCategory || !selectedCategory.sub_categories?.length}
                                    className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-xl text-sm font-medium text-slate-800 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">
                                        {selectedCategory?.sub_categories?.length ? 'Select a sub-category' : 'No sub-categories available'}
                                    </option>
                                    {selectedCategory?.sub_categories?.map((subCategory) => (
                                        <option key={subCategory.id} value={subCategory.id}>
                                            {subCategory.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Location Details Section Card */}
                        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 sm:p-5 space-y-3.5">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                                <MapPin size={16} className="text-sky-600" />
                                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                    Physical Location
                                </span>
                                <span className="text-xs text-slate-400 font-normal">
                                    (Helps technician locate the issue)
                                </span>
                            </div>

                            {/* College Dropdown */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    College Campus
                                </label>
                                <select
                                    value={formData.college_id}
                                    onChange={(e) => setFormData({ ...formData, college_id: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-xl text-sm text-slate-800 transition-all outline-none"
                                >
                                    <option value="">Select College Campus</option>
                                    {collegesList.map((col) => (
                                        <option key={col.id} value={col.id}>
                                            {col.name} {col.code ? `(${col.code})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Block, Floor, Room Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Block / Wing</label>
                                    <input
                                        type="text"
                                        value={formData.block_no}
                                        onChange={(e) => setFormData({ ...formData, block_no: e.target.value })}
                                        placeholder="e.g. Block A"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Floor Level</label>
                                    <input
                                        type="text"
                                        value={formData.floor_no}
                                        onChange={(e) => setFormData({ ...formData, floor_no: e.target.value })}
                                        placeholder="e.g. 2nd Floor"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Room / Lab No</label>
                                    <input
                                        type="text"
                                        value={formData.room_no}
                                        onChange={(e) => setFormData({ ...formData, room_no: e.target.value })}
                                        placeholder="e.g. Room 204"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Subject Line */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                Subject Line <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                                placeholder="Brief summary of the issue (e.g. Projector not working in Room 204)"
                                className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                            />
                        </div>

                        {/* Detailed Description */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                Detailed Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                placeholder="Provide any additional context or specific details to help resolve this quickly..."
                                className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all outline-none resize-none"
                            />
                        </div>

                        {/* Attachment / Photo Upload */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                Attachment / Photo <span className="text-slate-400 font-normal lowercase">(optional)</span>
                            </label>
                            {!photoPreview ? (
                                <div className="border-2 border-dashed border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 rounded-xl p-5 text-center cursor-pointer transition-all bg-slate-50/40">
                                    <input
                                        type="file"
                                        id="photo-upload"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        className="hidden"
                                    />
                                    <label htmlFor="photo-upload" className="cursor-pointer block">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center mx-auto mb-2 shadow-2xs">
                                            <Camera size={20} />
                                        </div>
                                        <p className="text-xs font-semibold text-slate-800 mb-0.5">
                                            Click or drag photo to attach
                                        </p>
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            JPG, PNG, or WebP up to 1MB
                                        </p>
                                    </label>
                                </div>
                            ) : (
                                <div className="relative rounded-xl border border-sky-200 bg-sky-50/30 p-2 max-w-sm">
                                    <img
                                        src={photoPreview}
                                        alt="Preview"
                                        className="w-full max-h-48 object-cover rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={removePhoto}
                                        className="absolute top-3 right-3 p-1.5 bg-slate-900/80 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer shadow-sm"
                                        title="Remove photo"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Submit Actions */}
                        <div className="pt-2 flex items-center gap-3">
                            <button
                                type="submit"
                                disabled={createMutation.isPending || photoProcessing}
                                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 shadow-sm shadow-sky-500/25 hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                            >
                                {createMutation.isPending || photoProcessing ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>{photoProcessing ? 'Processing photo...' : 'Submitting...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        <span>Submit Ticket</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/student/my-tickets')}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
        </div>
    );
};

export default RaiseTicket;
