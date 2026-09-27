import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Ban,
  CheckCircle,
  ShieldAlert,
  Award,
  Clock,
  Trash2,
  AlertCircle,
  UserCheck,
  LogIn,
  KeyRound,
  FileCheck2,
  Calendar,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UserProfile, StudentAttempt } from '../../types/exam';
import { getAllAttempts } from '../../services/examService';
import { getAllRegisteredUsers, deleteUserCompletely } from '../../services/authService';

export const StudentManager: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'registered' | 'joined'>('all');
  const [expandedUid, setExpandedUid] = useState<string | null>(null);

  const [blockedUids, setBlockedUids] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pariksha_blocked_students');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersList, att] = await Promise.all([
        getAllRegisteredUsers(),
        getAllAttempts(),
      ]);
      setUsers(usersList.filter((u) => u.role !== 'admin'));
      setAttempts(att);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for cross-tab student deletions or attempts
    const bc =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('pariksha_realtime_channel')
        : null;

    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'USER_DELETED' || e.data?.type === 'ATTEMPT_SUBMITTED') {
        loadData();
      }
    };
    bc?.addEventListener('message', handleMsg);

    return () => {
      bc?.removeEventListener('message', handleMsg);
      bc?.close();
    };
  }, []);

  // Consolidate users from Firestore and any attempts that might not have a user doc yet
  const userMap = new Map<string, UserProfile & { attemptsCount: number; highestScore: number; testsList: string[] }>();

  // 1. Populate all users from Firestore 'users' collection
  users.forEach((u) => {
    userMap.set(u.uid, {
      ...u,
      attemptsCount: u.totalExamsSubmitted || 0,
      highestScore: 0,
      testsList: (u.joinedExams || []).map((e) => e.testTitle || e.testId),
    });
  });

  // 2. Integrate real test attempts stats
  attempts.forEach((a) => {
    const existing = userMap.get(a.studentId);
    if (existing) {
      existing.attemptsCount++;
      if (a.finalScore > existing.highestScore) existing.highestScore = a.finalScore;
      if (!existing.testsList.includes(a.testTitle)) {
        existing.testsList.push(a.testTitle);
      }
      if (new Date(a.submittedAt) > new Date(existing.lastActive || existing.createdAt || '')) {
        existing.lastActive = a.submittedAt;
      }
    } else {
      userMap.set(a.studentId, {
        uid: a.studentId,
        name: a.studentName,
        email: a.studentEmail,
        role: 'student',
        registrationType: 'direct_exam_join',
        isRegistered: false,
        hasJoined: true,
        joinedAt: a.submittedAt,
        createdAt: a.submittedAt,
        lastLogin: a.submittedAt,
        lastActive: a.submittedAt,
        totalExamsJoined: 1,
        totalExamsSubmitted: 1,
        attemptsCount: 1,
        highestScore: a.finalScore,
        testsList: [a.testTitle],
        joinedExams: [
          {
            testId: a.testId,
            testTitle: a.testTitle,
            joinedAt: a.submittedAt,
            status: 'submitted',
            score: a.finalScore,
            percentage: a.percentage,
            submittedAt: a.submittedAt,
          },
        ],
      });
    }
  });

  const allUsersList = Array.from(userMap.values());

  // Filter based on search and tab
  const filteredUsers = allUsersList.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      s.uid.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'registered') {
      return s.isRegistered || s.registrationType === 'registered';
    }
    if (filterType === 'joined') {
      return s.hasJoined || s.registrationType === 'direct_exam_join' || (s.joinedExams && s.joinedExams.length > 0);
    }
    return true;
  });

  const registeredCount = allUsersList.filter((u) => u.isRegistered || u.registrationType === 'registered').length;
  const joinedCount = allUsersList.filter((u) => u.hasJoined || u.registrationType === 'direct_exam_join' || (u.joinedExams && u.joinedExams.length > 0)).length;

  const handleToggleBlock = (uid: string) => {
    let next: string[];
    if (blockedUids.includes(uid)) {
      next = blockedUids.filter((id) => id !== uid);
    } else {
      next = [...blockedUids, uid];
    }
    setBlockedUids(next);
    localStorage.setItem('pariksha_blocked_students', JSON.stringify(next));
  };

  const handleDeleteStudent = async (student: { uid: string; name: string; email: string }) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete user "${student.name}" (${student.email}) from Firebase?\n\nThis will remove their profile from the Firestore 'users' collection and all their examination attempts. This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setDeletingUid(student.uid);
      await deleteUserCompletely(student.uid);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete student from Firebase: ${err?.message || 'Unknown error'}`);
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Users & Candidates Collection
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time Firestore user profiles for all registered accounts and exam joiners.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{allUsersList.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Users in Firestore</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{registeredCount}</div>
            <div className="text-xs text-slate-500 font-medium">Registered Accounts (Sign Up)</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{joinedCount}</div>
            <div className="text-xs text-slate-500 font-medium">Exam Joiners (Direct Code/Link)</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterType === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Users ({allUsersList.length})
        </button>

        <button
          onClick={() => setFilterType('registered')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterType === 'registered'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Registered Accounts ({registeredCount})
        </button>

        <button
          onClick={() => setFilterType('joined')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterType === 'joined'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Exam Joiners ({joinedCount})
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">User / Candidate</th>
                <th className="py-3 px-4">Type / Source</th>
                <th className="py-3 px-4">Exams Joined & Taken</th>
                <th className="py-3 px-4">Best Score</th>
                <th className="py-3 px-4">Registered / Joined</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Loading users collection from Firestore...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center space-y-2">
                    <Users className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600 text-sm">No users found matching filter</p>
                    <p className="text-slate-400 text-xs">
                      When users register or join an exam, their record will appear in the Firestore users collection.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((st) => {
                  const isBlocked = blockedUids.includes(st.uid);
                  const isBeingDeleted = deletingUid === st.uid;
                  const isExpanded = expandedUid === st.uid;
                  const isRegistered = st.isRegistered || st.registrationType === 'registered';
                  const joinedExams = st.joinedExams || [];

                  return (
                    <React.Fragment key={st.uid}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{st.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex flex-col gap-0.5 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-500">UID: {st.uid}</span>
                            <span className="truncate max-w-[200px]">{st.email}</span>
                            {st.phone && (
                              <span className="text-slate-600 font-semibold flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{st.phone}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <UserCheck className="w-3 h-3" />
                              <span>Registered</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                              <KeyRound className="w-3 h-3" />
                              <span>Exam Joiner</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-800">
                              {joinedExams.length > 0 ? `${joinedExams.length} Exams` : `${st.attemptsCount} Attempts`}
                            </span>
                            {joinedExams.length > 0 && (
                              <button
                                onClick={() => setExpandedUid(isExpanded ? null : st.uid)}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>{isExpanded ? 'Hide Exams' : 'View Joined Exams'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-indigo-700">
                            {st.highestScore > 0 ? `${st.highestScore} Marks` : '—'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {st.registeredAt
                            ? new Date(st.registeredAt).toLocaleDateString()
                            : st.joinedAt
                            ? new Date(st.joinedAt).toLocaleDateString()
                            : st.createdAt
                            ? new Date(st.createdAt).toLocaleDateString()
                            : '—'}
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {st.lastActive
                            ? new Date(st.lastActive).toLocaleDateString()
                            : st.lastLogin
                            ? new Date(st.lastLogin).toLocaleDateString()
                            : '—'}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isBlocked
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isBlocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleBlock(st.uid)}
                              disabled={isBeingDeleted}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                                isBlocked
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {isBlocked ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(st)}
                              disabled={isBeingDeleted}
                              title="Delete from Firestore users collection and attempts"
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span className="hidden sm:inline">
                                {isBeingDeleted ? 'Deleting...' : 'Delete'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded View for Joined Exams */}
                      {isExpanded && joinedExams.length > 0 && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={8} className="py-3 px-6">
                            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                                <span>Joined Examinations for {st.name}:</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {joinedExams.map((je, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                                  >
                                    <div className="font-bold text-slate-900 truncate">
                                      {je.testTitle || je.testId}
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                                      <span>Code: {je.accessCode || 'Direct'}</span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          je.status === 'submitted'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}
                                      >
                                        {je.status}
                                      </span>
                                    </div>
                                    {je.score !== undefined && (
                                      <div className="text-[11px] font-bold text-indigo-700">
                                        Score: {je.score} Marks ({je.percentage}%)
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
