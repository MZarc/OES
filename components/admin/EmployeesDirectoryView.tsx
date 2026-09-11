'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getEmployeesPaginatedAction,
  getAvailableShiftsAction,
  createEmployeeAction,
  updateEmployeeAction,
  deleteEmployeeAction,
  bulkDeleteEmployeesAction,
  reactivateEmployeeAction,
  sendEmployeePasswordResetAction,
  exportEmployeesAction,
} from '@/app/actions/employees';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatDateDisplay } from '@/lib/utils';
import {
  Search,
  Users,
  UserPlus,
  Mail,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Send,
  Building2,
  Clock,
  ShieldCheck,
  ArrowUpDown,
  Download,
  KeyRound,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';

interface EmployeeItem {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string | null;
  designation: string | null;
  status: string;
  dateJoined: string | null;
  shiftId: string;
  shiftName: string;
  shiftCode: string;
}

interface ShiftItem {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
}

import { useToast } from '@/components/ui/Toast';
import { CustomSelect } from '@/components/ui/CustomSelect';

export function EmployeesDirectoryView() {
  const toast = useToast();
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [shiftsList, setShiftsList] = useState<ShiftItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeItem | null>(null);

  // Bulk deletion & multi-select states
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Password reset modal state
  const [passwordResetTarget, setPasswordResetTarget] = useState<EmployeeItem | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  // Reactivation loader
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  // Form states
  const [actionLoading, setActionLoading] = useState(false);
  const [editPassword, setEditPassword] = useState('');

  // Add form fields
  const [formData, setFormData] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    department: 'General',
    designation: 'Staff',
    shiftId: '',
    status: 'PENDING_ACTIVATION',
  });

  async function loadData(page: number, size: number, search: string, status: string, by = sortBy, order = sortOrder) {
    setLoading(true);
    try {
      const res = await getEmployeesPaginatedAction({
        page,
        limit: size,
        search,
        status,
        sortBy: by,
        sortOrder: order,
      });
      setEmployees(res.records as any);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setCurrentPage(res.page);
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadShifts() {
    try {
      const s = await getAvailableShiftsAction();
      setShiftsList(s as any);
      if (s.length > 0 && !formData.shiftId) {
        setFormData((prev) => ({ ...prev, shiftId: s[0].id }));
      }
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
    }
  }

  useEffect(() => {
    loadShifts();
  }, []);

  useEffect(() => {
    loadData(currentPage, pageSize, searchTerm, statusFilter, sortBy, sortOrder);
  }, [currentPage, pageSize, searchTerm, statusFilter, sortBy, sortOrder]);

  // Export Employees to CSV
  async function handleExportEmployees() {
    setActionLoading(true);
    try {
      const list = await exportEmployeesAction(searchTerm, 'ALL', statusFilter);
      const headers = ['Employee Code', 'Full Name', 'Email', 'Department', 'Designation', 'Shift', 'Status', 'Date Joined'];
      const rows = list.map((e) => [
        `"${e.employeeCode}"`,
        `"${e.fullName.replace(/"/g, '""')}"`,
        `"${e.email}"`,
        `"${(e.department || '').replace(/"/g, '""')}"`,
        `"${(e.designation || '').replace(/"/g, '""')}"`,
        `"${(e.shiftName || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.dateJoined || ''}"`,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `employees_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${list.length} employee records.`);
    } catch (err: any) {
      toast.error('Failed to export employees.');
    } finally {
      setActionLoading(false);
    }
  }

  // Create Employee
  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      await createEmployeeAction(formData);
      toast.success(`Employee ${formData.fullName} (${formData.employeeCode}) created successfully.`);
      setShowAddModal(false);
      setFormData({
        employeeCode: '',
        fullName: '',
        email: '',
        department: 'General',
        designation: 'Staff',
        shiftId: shiftsList[0]?.id || '',
        status: 'PENDING_ACTIVATION',
      });
      loadData(currentPage, pageSize, searchTerm, statusFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create employee.');
    } finally {
      setActionLoading(false);
    }
  }

  // Update Employee
  async function handleUpdateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;
    setActionLoading(true);
    try {
      await updateEmployeeAction({
        id: editingEmployee.id,
        employeeCode: editingEmployee.employeeCode,
        fullName: editingEmployee.fullName,
        email: editingEmployee.email,
        password: editPassword,
        department: editingEmployee.department || 'General',
        designation: editingEmployee.designation || 'Staff',
        shiftId: editingEmployee.shiftId,
        status: editingEmployee.status,
      });
      toast.success(`Employee ${editingEmployee.fullName} (${editingEmployee.employeeCode}) updated successfully.`);
      setEditingEmployee(null);
      setEditPassword('');
      loadData(currentPage, pageSize, searchTerm, statusFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update employee.');
    } finally {
      setActionLoading(false);
    }
  }

  // Delete Employee (Soft Delete)
  async function handleDeleteEmployee() {
    if (!deletingEmployee) return;
    setActionLoading(true);
    try {
      await deleteEmployeeAction(deletingEmployee.id);
      toast.success(`Employee ${deletingEmployee.fullName} deactivated. Historical records preserved.`);
      setDeletingEmployee(null);
      loadData(currentPage, pageSize, searchTerm, statusFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete employee.');
    } finally {
      setActionLoading(false);
    }
  }

  // Bulk Deactivate Employees
  async function handleBulkDelete() {
    if (selectedEmployeeIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await bulkDeleteEmployeesAction(selectedEmployeeIds);
      toast.success(`Successfully deactivated ${res.count} employee(s). Historical records preserved.`);
      setSelectedEmployeeIds([]);
      setShowBulkDeleteModal(false);
      loadData(currentPage, pageSize, searchTerm, statusFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate selected employees.');
    } finally {
      setBulkDeleting(false);
    }
  }

  // Reactivate Employee
  async function handleReactivate(emp: EmployeeItem) {
    setReactivatingId(emp.id);
    try {
      await reactivateEmployeeAction(emp.id);
      toast.success(`Employee ${emp.fullName} reactivated successfully.`);
      loadData(currentPage, pageSize, searchTerm, statusFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reactivate employee.');
    } finally {
      setReactivatingId(null);
    }
  }

  // Send Password Reset Link
  async function handleSendPasswordReset() {
    if (!passwordResetTarget) return;
    setSendingReset(true);
    try {
      await sendEmployeePasswordResetAction(passwordResetTarget.id);
      toast.success(`Password reset link sent to ${passwordResetTarget.email}`);
      setPasswordResetTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send password reset email.');
    } finally {
      setSendingReset(false);
    }
  }

  const allSelectedOnPage =
    employees.length > 0 && employees.every((e) => selectedEmployeeIds.includes(e.id));
  const someSelectedOnPage =
    employees.some((e) => selectedEmployeeIds.includes(e.id)) && !allSelectedOnPage;

  return (
    <div className="space-y-4">
      {/* Top Header with Side-by-Side Export & Import Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Employee Master Data
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage 250+ employees, assigned shift policies, and onboarding invitations with fast pagination.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportEmployees}
            disabled={actionLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            title="Export Employees List to CSV"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
            ) : (
              <Download className="h-4 w-4 text-slate-600" />
            )}
            Export (.csv)
          </button>
          <Link
            href="/admin/employees/import"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import Roster from Excel
          </Link>
        </div>
      </div>

      {/* Action Bar & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by code, name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-200/60 cursor-pointer"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto justify-between sm:justify-end">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium text-slate-500 hidden sm:inline">Sort:</span>
            <CustomSelect
              size="sm"
              value={`${sortBy}_${sortOrder}`}
              onChange={(val) => {
                const [b, o] = val.split('_');
                setSortBy(b);
                setSortOrder(o as 'asc' | 'desc');
                setCurrentPage(1);
              }}
              options={[
                { value: 'createdAt_desc', label: 'Date Added (Newest)' },
                { value: 'createdAt_asc', label: 'Date Added (Oldest)' },
                { value: 'fullName_asc', label: 'Name (A - Z)' },
                { value: 'fullName_desc', label: 'Name (Z - A)' },
                { value: 'employeeCode_asc', label: 'Code (Ascending)' },
                { value: 'employeeCode_desc', label: 'Code (Descending)' },
              ]}
            />
          </div>

          {/* Filter Tabs including Deactivated */}
          <div className="flex items-center gap-1.5">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'ACTIVE', label: 'Active' },
              { key: 'PENDING_ACTIVATION', label: 'Pending' },
              { key: 'DEACTIVATED', label: 'Deactivated' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setStatusFilter(tab.key);
                  setCurrentPage(1);
                  setSelectedEmployeeIds([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs flex-shrink-0 cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Multi-Select Bulk Action Bar */}
      {selectedEmployeeIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50/80 border border-blue-200 rounded-xl animate-fade-in text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <span className="font-bold bg-blue-600 text-white px-2 py-0.5 rounded-md text-[11px]">
              {selectedEmployeeIds.length}
            </span>
            <span className="font-medium">
              {selectedEmployeeIds.length === 1 ? 'employee selected' : 'employees selected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedEmployeeIds([])}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-medium hover:bg-blue-100/60 rounded-lg transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Deactivate Selected ({selectedEmployeeIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <TableSkeleton columns={8} rows={6} />
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-semibold text-slate-700">No employees found</h3>
            <p className="mt-1">Try adjusting your search criteria or add a new employee.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="w-10 px-3 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelectedOnPage;
                      }}
                      onChange={() => {
                        if (allSelectedOnPage) {
                          setSelectedEmployeeIds((prev) =>
                            prev.filter((id) => !employees.some((e) => e.id === id))
                          );
                        } else {
                          const toAdd = employees
                            .map((e) => e.id)
                            .filter((id) => !selectedEmployeeIds.includes(id));
                          setSelectedEmployeeIds((prev) => [...prev, ...toAdd]);
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                      title="Select All on Current Page"
                    />
                  </th>
                  <th className="px-4 py-3.5">Employee</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Assigned Shift</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Joined</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const isSelected = selectedEmployeeIds.includes(emp.id);
                  const isDeactivated = emp.status === 'DEACTIVATED' || emp.status === 'DELETED';
                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="w-10 px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedEmployeeIds((prev) =>
                              prev.includes(emp.id)
                                ? prev.filter((id) => id !== emp.id)
                                : [...prev, emp.id]
                            );
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{emp.fullName}</div>
                        <div className="text-[11px] font-mono text-slate-400">{emp.employeeCode}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                        {emp.email}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-medium">
                        {emp.department || 'General'}
                        <div className="text-[10px] text-slate-400">{emp.designation || 'Staff'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-medium rounded-md border border-slate-200">
                          {emp.shiftName}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            emp.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : emp.status === 'PENDING_ACTIVATION'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : isDeactivated
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {emp.status === 'ACTIVE'
                            ? 'Active'
                            : emp.status === 'PENDING_ACTIVATION'
                            ? 'Pending'
                            : isDeactivated
                            ? 'Deactivated'
                            : emp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                        {emp.dateJoined ? formatDateDisplay(emp.dateJoined) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setPasswordResetTarget(emp)}
                            className="p-1.5 rounded-md hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                            title="Send Password Reset Link"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          {isDeactivated && (
                            <button
                              onClick={() => handleReactivate(emp)}
                              disabled={reactivatingId === emp.id}
                              className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                              title="Reactivate Employee"
                            >
                              {reactivatingId === emp.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => setEditingEmployee({ ...emp })}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Edit Employee"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {!isDeactivated && (
                            <button
                              onClick={() => setDeletingEmployee(emp)}
                              className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Deactivate Employee"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={total}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="relative my-auto bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Add New Employee</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP005"
                    value={formData.employeeCode}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeCode: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alexander Pierce"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alexander@oes.local"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Production"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Engineer"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Shift *
                  </label>
                  <CustomSelect
                    className="w-full"
                    value={formData.shiftId}
                    onChange={(val) => setFormData({ ...formData, shiftId: val })}
                    options={shiftsList.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${s.startTime} - ${s.endTime})`,
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <div className="w-full px-3 py-2 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    Pending Activation
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Activation invite link is generated automatically for the Mail System.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-xs transition-colors"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating Employee...</span>
                    </>
                  ) : (
                    <span>Create Employee</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="relative my-auto bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Edit {editingEmployee.fullName} ({editingEmployee.employeeCode})
                </h3>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.employeeCode}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, employeeCode: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={editingEmployee.email}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingEmployee.fullName}
                  onChange={(e) =>
                    setEditingEmployee({ ...editingEmployee, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reset Password (optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep existing password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.department || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, department: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.designation || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, designation: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Shift
                  </label>
                  <CustomSelect
                    className="w-full"
                    value={editingEmployee.shiftId}
                    onChange={(val) => setEditingEmployee({ ...editingEmployee, shiftId: val })}
                    options={shiftsList.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${s.startTime} - ${s.endTime})`,
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <CustomSelect
                    className="w-full"
                    value={editingEmployee.status}
                    onChange={(val) => setEditingEmployee({ ...editingEmployee, status: val })}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'PENDING_ACTIVATION', label: 'Pending Activation' },
                      { value: 'DEACTIVATED', label: 'Deactivated' },
                    ]}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-xs transition-colors"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Confirmation Modal */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="relative my-auto bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Deactivate Employee</h3>
                <p className="text-xs text-slate-500">Soft-delete with audit protection</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to deactivate <strong className="text-slate-900">{deletingEmployee.fullName}</strong> ({deletingEmployee.employeeCode})?
              Their historical overtime and expense records will remain completely intact in reports and audits.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 shadow-xs transition-colors"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deactivating...</span>
                  </>
                ) : (
                  <span>Confirm Deactivation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Deactivation Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="relative my-auto bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Deactivate Selected Employees</h3>
                <p className="text-xs text-slate-500">Bulk soft-delete with session termination</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to deactivate <strong className="text-slate-900">{selectedEmployeeIds.length}</strong> selected employee(s)?
              Their active sessions will be terminated and status set to Deactivated. Historical overtime and expense logs will remain completely preserved.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
              >
                {bulkDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deactivating Employees...</span>
                  </>
                ) : (
                  <span>Deactivate {selectedEmployeeIds.length} Employees</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Confirmation Modal */}
      {passwordResetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="relative my-auto bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-blue-600">
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Send Password Reset Link</h3>
                <p className="text-xs text-slate-500">Direct employee email dispatch</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Send a secure password reset link to <strong className="text-slate-900">{passwordResetTarget.fullName}</strong> at <span className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{passwordResetTarget.email}</span>?
              The link will be valid for 24 hours.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={sendingReset}
                onClick={() => setPasswordResetTarget(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendPasswordReset}
                disabled={sendingReset}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
              >
                {sendingReset ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
