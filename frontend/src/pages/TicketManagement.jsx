import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ticket,
  Filter,
  Search,
  User,
  Calendar,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  UserPlus,
  Edit,
  Eye,
  Star,
  Send,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';
import TicketDetailsModal from '../components/Admin/TicketDetailsModal';

const STATUS_COLORS = {
  pending: 'bg-[var(--warning-light)] text-warning border-[var(--warning-light)]',
  approaching: 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]',
  resolving: 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]',
  completed: 'bg-[var(--success-light)] text-success border-[var(--success-light)]',
  closed: 'bg-background text-main border-border'
};

const STATUS_LABELS = {
  pending: 'Pending',
  approaching: 'Approaching',
  resolving: 'Resolving',
  completed: 'Completed',
  closed: 'Closed'
};

const TicketManagement = () => {
  const [filters, setFilters] = useState({
    status: '',
    category_id: '',
    assigned_to: '',
    search: ''
  });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ assigned_to: [], notes: '' });
  const [statusForm, setStatusForm] = useState({ status: '', notes: '' });
  const [commentForm, setCommentForm] = useState({ comment_text: '', is_internal: false });
  const queryClient = useQueryClient();

  // Fetch tickets
  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.category_id) params.append('category_id', filters.category_id);
      if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
      if (filters.search) params.append('search', filters.search);
      params.append('page', '1');
      params.append('limit', '100');

      const response = await api.get(`/tickets?${params.toString()}`);
      return response.data;
    }
  });

  // Fetch RBAC users for assignment
  const { data: usersData } = useQuery({
    queryKey: ['rbac-users'],
    queryFn: async () => {
      const response = await api.get('/rbac/users');
      return response.data?.data || [];
    }
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['complaint-categories'],
    queryFn: async () => {
      const response = await api.get('/complaint-categories');
      return response.data?.data || [];
    }
  });

  // Fetch ticket stats
  const { data: statsData } = useQuery({
    queryKey: ['ticket-stats'],
    queryFn: async () => {
      const response = await api.get('/tickets/stats');
      return response.data?.data || {};
    }
  });

  // Assign ticket mutation
  const assignMutation = useMutation({
    mutationFn: async ({ ticketId, data }) => {
      const response = await api.post(`/tickets/${ticketId}/assign`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Ticket assigned successfully');
      setShowAssignModal(false);
      setAssignForm({ assigned_to: [], notes: '' });
      queryClient.invalidateQueries(['tickets']);
      if (selectedTicket) {
        queryClient.invalidateQueries(['ticket', selectedTicket.id]);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to assign ticket');
    }
  });

  // Update status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, data }) => {
      const response = await api.put(`/tickets/${ticketId}/status`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Ticket status updated successfully');
      setShowStatusModal(false);
      setStatusForm({ status: '', notes: '' });
      queryClient.invalidateQueries(['tickets']);
      if (selectedTicket) {
        queryClient.invalidateQueries(['ticket', selectedTicket.id]);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: async ({ ticketId, data }) => {
      const response = await api.post(`/tickets/${ticketId}/comments`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Comment added successfully');
      setShowCommentModal(false);
      setCommentForm({ comment_text: '', is_internal: false });
      queryClient.invalidateQueries(['ticket', selectedTicket?.id]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    }
  });

  // Fetch single ticket details
  const { data: ticketDetails } = useQuery({
    queryKey: ['ticket', selectedTicket?.id],
    queryFn: async () => {
      const response = await api.get(`/tickets/${selectedTicket.id}`);
      return response.data?.data;
    },
    enabled: !!selectedTicket
  });

  const tickets = ticketsData?.data || [];
  const stats = statsData || {};

  const handleAssign = () => {
    if (assignForm.assigned_to.length === 0) {
      toast.error('Please select at least one user');
      return;
    }
    assignMutation.mutate({
      ticketId: selectedTicket.id,
      data: assignForm
    });
  };

  const handleStatusUpdate = () => {
    if (!statusForm.status) {
      toast.error('Please select a status');
      return;
    }
    statusMutation.mutate({
      ticketId: selectedTicket.id,
      data: statusForm
    });
  };

  const handleAddComment = () => {
    if (!commentForm.comment_text.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    commentMutation.mutate({
      ticketId: selectedTicket.id,
      data: commentForm
    });
  };

  const openAssignModal = (ticket) => {
    setSelectedTicket(ticket);
    setAssignForm({
      assigned_to: ticket.assignments?.map(a => a.assigned_to) || [],
      notes: ''
    });
    setShowAssignModal(true);
  };

  const openStatusModal = (ticket) => {
    setSelectedTicket(ticket);
    setStatusForm({
      status: ticket.status,
      notes: ''
    });
    setShowStatusModal(true);
  };

  const openCommentModal = (ticket) => {
    setSelectedTicket(ticket);
    setCommentForm({ comment_text: '', is_internal: false });
    setShowCommentModal(true);
  };

  if (isLoading) {
    return <LoadingAnimation />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-main">Maintenance Management</h1>
          <p className="text-sub mt-1">Manage and track student complaints</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {stats.by_status?.map((stat) => (
          <div key={stat.status} className="bg-surface rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-sub">{STATUS_LABELS[stat.status] || stat.status}</p>
                <p className="text-2xl font-bold text-main mt-1">{stat.count}</p>
              </div>
              <div className={`p-2 rounded-lg ${STATUS_COLORS[stat.status] || 'bg-background'}`}>
                <Ticket size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-lg border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Category</label>
            <select
              value={filters.category_id}
              onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">All Categories</option>
              {categoriesData?.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Assigned To</label>
            <select
              value={filters.assigned_to}
              onChange={(e) => setFilters({ ...filters, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">All Users</option>
              {usersData?.map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.username})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-text" size={18} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search tickets..."
                className="w-full pl-10 pr-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-surface rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">Ticket #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-background">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-main">{ticket.ticket_number}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-main">{ticket.student_name}</div>
                      <div className="text-sm text-muted-text">{ticket.admission_number}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-main">{ticket.category_name}</div>
                      {ticket.sub_category_name && (
                        <div className="text-xs text-muted-text">{ticket.sub_category_name}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-main max-w-xs truncate">{ticket.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[ticket.status] || 'bg-background'}`}>
                      {STATUS_LABELS[ticket.status] || ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-main">{ticket.assigned_users || 'Unassigned'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-text">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="text-primary hover:text-primary"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openAssignModal(ticket)}
                        className="text-success hover:text-success"
                        title="Assign"
                      >
                        <UserPlus size={16} />
                      </button>
                      <button
                        onClick={() => openStatusModal(ticket)}
                        className="text-secondary hover:text-secondary"
                        title="Update Status"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tickets.length === 0 && (
            <div className="text-center py-12">
              <Ticket className="mx-auto text-muted-text" size={48} />
              <p className="mt-4 text-muted-text">No tickets found</p>
            </div>
          )}
        </div>
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && !showAssignModal && !showStatusModal && !showCommentModal && (
        <TicketDetailsModal
          ticket={ticketDetails || selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onAssign={() => openAssignModal(selectedTicket)}
          onStatusUpdate={() => openStatusModal(selectedTicket)}
          onAddComment={() => openCommentModal(selectedTicket)}
        />
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTicket && (
        <AssignModal
          ticket={selectedTicket}
          users={usersData || []}
          form={assignForm}
          setForm={setAssignForm}
          onClose={() => setShowAssignModal(false)}
          onAssign={handleAssign}
          loading={assignMutation.isPending}
        />
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedTicket && (
        <StatusModal
          ticket={selectedTicket}
          form={statusForm}
          setForm={setStatusForm}
          onClose={() => setShowStatusModal(false)}
          onUpdate={handleStatusUpdate}
          loading={statusMutation.isPending}
        />
      )}

      {/* Comment Modal */}
      {showCommentModal && selectedTicket && (
        <CommentModal
          ticket={selectedTicket}
          form={commentForm}
          setForm={setCommentForm}
          onClose={() => setShowCommentModal(false)}
          onAdd={handleAddComment}
          loading={commentMutation.isPending}
        />
      )}
    </div>
  );
};

// Ticket Details Modal Component
// Removed inline component to use the one from src/components/Admin/TicketDetailsModal.jsx 
// Make sure to import it at the top of the file

// Assign Modal Component
const AssignModal = ({ ticket, users, form, setForm, onClose, onAssign, loading }) => {
  const toggleUser = (userId) => {
    if (form.assigned_to.includes(userId)) {
      setForm({ ...form, assigned_to: form.assigned_to.filter(id => id !== userId) });
    } else {
      setForm({ ...form, assigned_to: [...form.assigned_to, userId] });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg max-w-2xl w-full">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-main">Assign Ticket</h2>
          <button onClick={onClose} className="text-muted-text hover:text-sub">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-sub mb-2">Select Users</label>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {users.map((user) => (
                <label key={user.id} className="flex items-center p-3 hover:bg-background cursor-pointer border-b last:border-b-0">
                  <input
                    type="checkbox"
                    checked={form.assigned_to.includes(user.id)}
                    onChange={() => toggleUser(user.id)}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium text-main">{user.name}</p>
                    <p className="text-sm text-muted-text">{user.username} • {user.role}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-2">Notes (Optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
              placeholder="Add assignment notes..."
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-background text-sub rounded-lg hover:bg-background"
            >
              Cancel
            </button>
            <button
              onClick={onAssign}
              disabled={loading || form.assigned_to.length === 0}
              className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Status Modal Component
const StatusModal = ({ ticket, form, setForm, onClose, onUpdate, loading }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg max-w-md w-full">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-main">Update Status</h2>
          <button onClick={onClose} className="text-muted-text hover:text-sub">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-sub mb-2">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-2">Notes (Optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
              placeholder="Add status update notes..."
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-background text-sub rounded-lg hover:bg-background"
            >
              Cancel
            </button>
            <button
              onClick={onUpdate}
              disabled={loading || !form.status}
              className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Comment Modal Component
const CommentModal = ({ ticket, form, setForm, onClose, onAdd, loading }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg max-w-2xl w-full">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-main">Add Comment</h2>
          <button onClick={onClose} className="text-muted-text hover:text-sub">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-sub mb-2">Comment</label>
            <textarea
              value={form.comment_text}
              onChange={(e) => setForm({ ...form, comment_text: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={5}
              placeholder="Enter your comment..."
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_internal"
              checked={form.is_internal}
              onChange={(e) => setForm({ ...form, is_internal: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="is_internal" className="text-sm text-sub">
              Internal note (not visible to student)
            </label>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-background text-sub rounded-lg hover:bg-background"
            >
              Cancel
            </button>
            <button
              onClick={onAdd}
              disabled={loading || !form.comment_text.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Comment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketManagement;

