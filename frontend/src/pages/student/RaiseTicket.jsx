import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Ticket,
  AlertCircle,
  Sparkles,
  Plus,
  MapPin
} from 'lucide-react';
import api from '../../config/api';
import { maintenanceApiUrl } from '../../config/maintenanceApi';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

import { motion } from 'framer-motion';
import { SkeletonBox } from '../../components/SkeletonLoader';

const RaiseTicket = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [formData, setFormData] = useState({
    category_id: '',
    sub_category_id: '',
    block_no: '',
    floor_no: '',
    room_no: '',
    title: '',
    description: ''
  });
  const queryClient = useQueryClient();

  // Fetch active categories
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
    error: categoriesRequestError,
    refetch: refetchCategories
  } = useQuery({
    queryKey: ['complaint-categories-active'],
    queryFn: async () => {
      const response = await api.get(maintenanceApiUrl('/complaint-categories/active'));
      return response.data?.data || [];
    }
  });

  // Create ticket mutation
  const createMutation = useMutation({
    mutationFn: async (formDataToSend) => {
      const response = await api.post(maintenanceApiUrl('/tickets'), formDataToSend);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Ticket raised successfully!');
      queryClient.invalidateQueries({ queryKey: ['student-tickets'] });
      navigate('/student/my-tickets');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to raise ticket');
    }
  });

  const categories = categoriesData || [];
  const selectedCategory = categories.find(cat => cat.id === parseInt(formData.category_id));

  const handleCategoryChange = (categoryId) => {
    setFormData({
      ...formData,
      category_id: categoryId,
      sub_category_id: '' // Reset sub-category when main category changes
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.category_id) {
      toast.error('Please select a complaint category');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    // Description is now optional
    createMutation.mutate(formData);
  };

  if (categoriesLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="space-y-2">
          <SkeletonBox height="h-8" width="w-48" />
          <SkeletonBox height="h-4" width="w-72" />
        </div>
        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div className="space-y-2">
            <SkeletonBox height="h-4" width="w-32" />
            <SkeletonBox height="h-10" width="w-full" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <SkeletonBox height="h-4" width="w-24" />
            <SkeletonBox height="h-10" width="w-full" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <SkeletonBox height="h-4" width="w-32" />
            <SkeletonBox height="h-32" width="w-full" className="rounded-lg" />
            <SkeletonBox height="h-3" width="w-full" />
          </div>
          <SkeletonBox height="h-20" width="w-full" className="rounded-lg" />
          <div className="flex gap-4 pt-4 border-t">
            <SkeletonBox height="h-12" width="w-full" className="rounded-lg" />
            <SkeletonBox height="h-12" width="w-32" className="rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (categoriesError) {
    return (
      <div role="alert" className="max-w-3xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h1 className="text-lg font-bold">Complaint categories could not be loaded</h1>
        <p className="mt-2 text-sm">{categoriesRequestError.response?.data?.message || categoriesRequestError.message}</p>
        <button
          type="button"
          onClick={() => refetchCategories()}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-2 flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
              <Ticket size={28} />
            </div>
            Support Terminal
          </h1>
          <div className="text-slate-400 font-bold uppercase tracking-widest text-[10px] items-center flex gap-2 ml-14">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
            Dispatching queries to infrastructure management
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 lg:p-12 space-y-10 shadow-xl shadow-slate-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>

        {/* Category Selection */}
        <div className="relative z-10">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
            Classification <span className="text-rose-500">*</span>
          </label>
          <select
            value={formData.category_id}
            onChange={(e) => handleCategoryChange(e.target.value)}
            required
            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-[1.2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-50/50 transition-all outline-none font-bold text-slate-700 appearance-none shadow-sm"
          >
            <option value="">Select Category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {selectedCategory?.description && (
            <p className="mt-2 text-xs text-blue-600 font-semibold px-1 italic">
              Tip: {selectedCategory.description}
            </p>
          )}
        </div>

        {/* Sub-Category Selection (if available) */}
        {selectedCategory && selectedCategory.has_sub_categories && selectedCategory.sub_categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="relative z-10"
          >
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
              Specify Issue <span className="text-slate-300 text-[8px] italic ml-2">(Optional)</span>
            </label>
            <select
              value={formData.sub_category_id}
              onChange={(e) => setFormData({ ...formData, sub_category_id: e.target.value })}
              className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-50 rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all outline-none font-medium appearance-none"
            >
              <option value="">Select a sub-category</option>
              {selectedCategory.sub_categories.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
          </motion.div>
        )}

        {/* Physical Location Details Section */}
        <div className="relative z-10 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
            <MapPin size={15} className="text-blue-600" />
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Physical Location</span>
            <span className="text-[10px] text-slate-400 font-medium">(Pinpoint issue location)</span>
          </div>

          {/* Student scope is resolved by the backend from the authenticated student's record. */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
              College <span className="text-slate-300 text-[8px] italic ml-1">(From student details)</span>
            </label>
            <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-600">
              {user?.college || user?.college_name || 'Not available in student details'}
            </div>
          </div>

          {/* Block, Floor, Room Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">
                Block No
              </label>
              <input
                type="text"
                value={formData.block_no}
                onChange={(e) => setFormData({ ...formData, block_no: e.target.value })}
                placeholder="e.g. Block A"
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-50/50 transition-all outline-none font-medium text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">
                Floor No
              </label>
              <input
                type="text"
                value={formData.floor_no}
                onChange={(e) => setFormData({ ...formData, floor_no: e.target.value })}
                placeholder="e.g. 2nd Floor"
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-50/50 transition-all outline-none font-medium text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">
                Room No
              </label>
              <input
                type="text"
                value={formData.room_no}
                onChange={(e) => setFormData({ ...formData, room_no: e.target.value })}
                placeholder="e.g. Room 204"
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-50/50 transition-all outline-none font-medium text-xs"
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="relative z-10">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
            Incident Heading <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            placeholder="Headline of your query"
            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-[1.2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-50/50 transition-all outline-none font-bold text-slate-700 shadow-sm"
          />
        </div>

        {/* Description */}
        <div className="relative z-10">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
            Detailed Exposition <span className="text-slate-300 text-[8px] italic ml-2">(Optional)</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={6}
            placeholder="Provide context for rapid resolution..."
            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-50/50 transition-all outline-none font-bold text-slate-700 resize-none shadow-sm"
          />
        </div>

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 relative z-10">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full sm:flex-1 px-8 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 shadow-xl shadow-indigo-200 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 active:scale-95 group"
          >
            {createMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-4 border-white/20 border-b-white"></div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Sparkles size={22} className="group-hover:animate-pulse text-blue-200" />
                <span>Submit Complaint</span>
                <Plus size={22} className="transition-transform group-hover:rotate-90" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/student/my-tickets')}
            className="w-full sm:w-auto px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95 shadow-sm"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-blue-50 border border-blue-100 rounded-3xl p-6 lg:p-8"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-2xl text-blue-600 shadow-sm border border-blue-100">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-blue-900 mb-2 italic">What's next?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-black text-blue-400 tracking-tighter">Phase 01</p>
                <p className="text-sm font-bold text-blue-800 leading-tight">Review by administration</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-black text-blue-400 tracking-tighter">Phase 02</p>
                <p className="text-sm font-bold text-blue-800 leading-tight">Resource allocation</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-black text-blue-400 tracking-tighter">Phase 03</p>
                <p className="text-sm font-bold text-blue-800 leading-tight">Solution & Feedback</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default RaiseTicket;
