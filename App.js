// src/App.js
import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
  Link
} from 'react-router-dom';
import './App.css';

// Always send cookies with requests
axios.defaults.withCredentials = true;

// --- Contexts & Guards ---
const UserContext = createContext();

// Only allow admins
function ProtectedAdmin({ children }) {
  const { user } = useContext(UserContext);
  return user.role === 'admin' ? children : <Navigate to="/" replace />;
}

// Allow admin + business
function ProtectedBusiness({ children }) {
  const { user } = useContext(UserContext);
  return ['admin','business'].includes(user.role)
    ? children
    : <Navigate to="/" replace />;
}

// --- Simple fallbacks for IssuePage ---
function LoadingFallback() {
  return (
    <div className="app-container">
      <div className="loading-container">
        <div className="loader" />
        <p>Loading issue details...</p>
      </div>
    </div>
  );
}
function ErrorFallback({ msg, onBack }) {
  return (
    <div className="app-container">
      <div className="error-container">
        <div className="error-icon" />
        <h2>An error occurred</h2>
        <p>{msg}</p>
        <button className="btn btn-primary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

// --- Page 1: Login ---
function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const navigate                 = useNavigate();
  const { setUser }              = useContext(UserContext);

  const handleLogin = async () => {
    setError(null);
    try {
      await axios.post(
        '/rest/auth/1/session',
        { username, password },
        { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }
      );
      // fetch current user + groups
      const me = await axios.get('/rest/api/2/myself?expand=groups');
      const name = me.data.name;
      const isAdmin = me.data.groups.items.some(g => g.name === 'jira-administrators');
      setUser({ name, role: isAdmin ? 'admin' : 'business' });
      navigate('/select');
    } catch {
      setError('Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="app-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon" />
          <h1>Project Hub</h1>
        </div>
        <h2 className="auth-title">Sign In</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="form-group">
          <label>Username</label>
          <input
            className="form-control"
            placeholder="Enter username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            className="form-control"
            placeholder="Enter password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-block" onClick={handleLogin}>
          Sign In
        </button>
      </div>
    </div>
  );
}

// --- Page 2: Select Project & Sprint ---
function SelectPage() {
  const [projects, setProjects]      = useState([]);
  const [sprints, setSprints]        = useState([]);
  const [projectKey, setProjectKey]  = useState('');
  const [sprintId, setSprintId]      = useState('');
  const [error, setError]            = useState(null);
  const navigate                      = useNavigate();
  const { user }                      = useContext(UserContext);

  useEffect(() => {
    axios.get('/rest/api/2/project')
      .then(res => {
        let all = res.data;
        if (user.role === 'business') {
          const matrix = JSON.parse(localStorage.getItem('accessMatrix') || '{}');
          const allowed = matrix[user.name]?.projects || [];
          all = all.filter(p => allowed.includes(p.key));
        }
        setProjects(all);
      })
      .catch(() => setError('Failed to load projects'));
  }, [user]);

  const loadSprints = async key => {
    setProjectKey(key);
    setSprintId('');
    setSprints([]);
    setError(null);
    if (!key) return;
    try {
      const boards = await axios.get('/rest/agile/1.0/board', {
        params: { projectKeyOrId: key }
      });
      const boardId = boards.data.values[0]?.id;
      const spr = await axios.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
        params: { state: 'active' }
      });
      setSprints(spr.data.values);
    } catch {
      setError('Failed to load sprints');
    }
  };

  const handleNext = () => {
    if (!projectKey || !sprintId) {
      setError('Please select both project and sprint');
      return;
    }
    navigate('/kanban', { state: { projectKey, sprintId } });
  };

  return (
    <div className="app-container">
      <div className="dashboard-container">
        <header className="app-header">
          <div className="header-logo">
            <div className="logo-icon small" />
            <h1>Project Hub</h1>
          </div>
          <div className="user-menu">
            {user.role === 'admin' && (
              <Link to="/users" className="btn btn-outline">User Mgmt</Link>
            )}
            <Link to="/" className="btn btn-outline">Logout</Link>
          </div>
        </header>
        <div className="content-card">
          <h2 className="card-title">Select Project & Sprint</h2>
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-container">
            <div className="form-group">
              <label>Project</label>
              <select
                className="form-control"
                value={projectKey}
                onChange={e => loadSprints(e.target.value)}
              >
                <option value="">Choose Project…</option>
                {projects.map(p => (
                  <option key={p.key} value={p.key}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Sprint</label>
              <select
                className="form-control"
                value={sprintId}
                onChange={e => setSprintId(e.target.value)}
                disabled={!projectKey}
              >
                <option value="">Choose Sprint…</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={!projectKey || !sprintId}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Page 3: Kanban Board ---
function KanbanPage() {
  const { state }                 = useLocation();
  const { projectKey, sprintId }  = state || {};
  const [issues, setIssues]       = useState([]);
  const [error, setError]         = useState(null);

  useEffect(() => {
    if (!sprintId) {
      setError('No sprint selected');
      return;
    }
    axios.get('/rest/api/2/search', {
      params: {
        jql: `sprint=${sprintId} AND issuetype in (Story,Bug)`,
        fields: 'summary,status,description',
        maxResults: 100
      }
    })
      .then(res => {
        console.log('Issues data:', res.data.issues);
        setIssues(res.data.issues);
      })
      .catch(() => setError('Failed to load issues'));
  }, [sprintId]);

  const columns = issues.reduce((acc, issue) => {
    const st = issue.fields.status.name;
    (acc[st] = acc[st] || []).push(issue);
    return acc;
  }, {});

  return (
    <div className="app-container">
      <div className="dashboard-container">
        <header className="app-header">
          <div className="header-logo">
            <div className="logo-icon small" />
            <h1>Project Hub</h1>
          </div>
          <div className="breadcrumb">
            <span>{projectKey}</span><span className="separator">/</span><span>Sprint {sprintId}</span>
          </div>
          <div className="user-menu">
            <Link to="/select" className="btn btn-outline">Change Sprint</Link>
            <Link to="/" className="btn btn-outline">Logout</Link>
          </div>
        </header>
        <div className="kanban-container">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="kanban-board">
            {Object.entries(columns).map(([status, items]) => (
              <div key={status} className="kanban-column" data-status={status.toLowerCase().replace(/\s+/g, '-')}>
                <div className="column-header">
                  <h3>{status}</h3><span className="item-count">{items.length}</span>
                </div>
                <div className="column-content">
                  {items.map(issue => (
                    <Link 
                      key={issue.id} 
                      to={`/issue/${issue.key}`} 
                      className="kanban-card"
                    >
                      <div className="card-id">{issue.key}</div>
                      <div className="card-title">
                        {issue.fields.summary || 'No Summary Available'}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Page 4: Issue Details & Commenting ---
function IssuePage() {
  const { issueKey }                = useParams();
  const navigate                    = useNavigate();
  const [issue, setIssue]           = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [selTrans, setSelTrans]     = useState('');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`/rest/api/2/issue/${issueKey}`, {
          params: {
            fields:
              'summary,description,assignee,reporter,created,updated,comment,attachment,labels,status,issuetype,priority',
            expand: 'renderedFields'
          }
        });
        setIssue(res.data);
        const tr = await axios.get(`/rest/api/2/issue/${issueKey}/transitions`);
        setTransitions(tr.data.transitions);
      } catch {
        setError('Error loading issue details');
      } finally {
        setLoading(false);
      }
    })();
  }, [issueKey]);

  const postComment = async () => {
    if (!newComment.trim()) return;
    try {
      await axios.post(`/rest/api/2/issue/${issueKey}/comment`, { body: newComment });
      setNewComment('');
      const cRes = await axios.get(`/rest/api/2/issue/${issueKey}`, { params: { fields: 'comment' } });
      setIssue(prev => ({
        ...prev,
        fields: { ...prev.fields, comment: cRes.data.fields.comment }
      }));
    } catch {
      alert('Failed to post comment');
    }
  };

  const applyTransition = async () => {
    if (!selTrans) return;
    setLoading(true);
    try {
      await axios.post(`/rest/api/2/issue/${issueKey}/transitions`, { transition: { id: selTrans } });
      navigate(-1);
    } catch {
      setError('Transition failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentDownload = async (url, filename) => {
    try {
      const u = new URL(url);
      const rel = u.pathname + u.search;
      const res = await axios.get(rel, {
        responseType: 'blob',
        withCredentials: true,
        headers: { 'X-Atlassian-Token': 'no-check' }
      });
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(blobUrl);
    } catch {
      alert('Failed to download attachment.');
    }
  };

  if (loading) return <LoadingFallback />;
  if (error)   return <ErrorFallback msg={error} onBack={() => navigate(-1)} />;

  const f  = issue.fields;
  const rf = issue.renderedFields || {};

  return (
    <div className="app-container">
      <div className="dashboard-container">
        <header className="app-header">
          <div className="header-logo">
            <div className="logo-icon small" />
            <h1>Project Hub</h1>
          </div>
          <div className="breadcrumb">
            <span className="clickable" onClick={() => navigate(-1)}>Board</span>
            <span className="separator">/</span>
            <span>{issueKey}</span>
          </div>
          <div className="user-menu">
            <Link to="/" className="btn btn-outline">Logout</Link>
          </div>
        </header>
        <div className="issue-container">
          <div className="issue-header">
            <h2>{f.summary || 'No summary available'}</h2>
            <div className="issue-meta">
              <span className="issue-key">{issueKey}</span>
              <span className={`issue-type ${f.issuetype?.name?.toLowerCase() || 'unknown'}`}>{f.issuetype?.name || 'Unknown Type'}</span>
              <span className={`issue-status ${f.status?.name?.toLowerCase().replace(/\s+/g,'-') || 'unknown'}`}>{f.status?.name || 'Unknown Status'}</span>
              {f.priority && (
                <span className={`issue-priority priority-${f.priority.name.toLowerCase()}`}>{f.priority.name}</span>
              )}
            </div>
          </div>
          <div className="issue-content">
            <div className="issue-main">
              <div className="content-section">
                <h3 className="section-title">Description</h3>
                <div className="description-content">
                  {rf.description ? (
                    <div
                      className="description-html"
                      dangerouslySetInnerHTML={{ __html: rf.description }}
                    />
                  ) : (
                    <p className="no-content">No description provided.</p>
                  )}
                </div>
              </div>
              <div className="content-section">
                <h3 className="section-title">Comments</h3>
                {f.comment?.comments?.length > 0 ? (
                  <div className="comments-list">
                    {f.comment.comments.map(c => (
                      <div key={c.id} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-author">{c.author?.displayName || 'Unknown User'}</span>
                          <span className="comment-date">{new Date(c.created).toLocaleString()}</span>
                        </div>
                        <div className="comment-content">{c.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-content">No comments yet.</p>
                )}
                <div className="add-comment">
                  <h4>Add Comment</h4>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Write your comment..."
                  />
                  <button className="btn btn-primary" onClick={postComment} disabled={!newComment.trim()}>
                    Post Comment
                  </button>
                </div>
              </div>
            </div>
            <div className="issue-sidebar">
              <div className="sidebar-section">
                <h3 className="section-title">Actions</h3>
                <label htmlFor="transition">Change Status</label>
                <select
                  id="transition"
                  className="form-control"
                  value={selTrans}
                  onChange={e => setSelTrans(e.target.value)}
                >
                  <option value="">Select status…</option>
                  {transitions.map(t => (
                    <option key={t.id} value={t.id}>{t.to.name}</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary btn-block"
                  onClick={applyTransition}
                  disabled={!selTrans}
                >
                  Update Status
                </button>
                <button
                  className="btn btn-outline btn-block"
                  onClick={() => navigate(-1)}
                >
                  Back to Board
                </button>
              </div>
              <div className="sidebar-section">
                <h3 className="section-title">Details</h3>
                <div className="detail-item"><span className="detail-label">Reporter</span><span className="detail-value">{f.reporter?.displayName || 'Unknown'}</span></div>
                <div className="detail-item"><span className="detail-label">Assignee</span><span className="detail-value">{f.assignee?.displayName || 'Unassigned'}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{f.created ? new Date(f.created).toLocaleString() : 'Unknown'}</span></div>
                <div className="detail-item"><span className="detail-label">Updated</span><span className="detail-value">{f.updated ? new Date(f.updated).toLocaleString() : 'Unknown'}</span></div>
                <div className="detail-item"><span className="detail-label">Labels</span><div className="detail-value">{f.labels && f.labels.length ? f.labels.map((lbl,i)=><span key={i} className="label-tag">{lbl}</span>) : 'None'}</div></div>
              </div>
              {f.attachment && f.attachment.length > 0 && (
                <div className="sidebar-section">
                  <h3 className="section-title">Attachments</h3>
                  <div className="attachments-list">
                    {f.attachment.map(att => (
                      <div key={att.id} className="attachment-item">
                        <button className="btn btn-link" onClick={() => handleAttachmentDownload(att.content, att.filename)}>
                          <span className="attachment-icon" /> <span className="attachment-name">{att.filename}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Page 5: User Management ---
function UserManagementPage() {
  const [users, setUsers]             = useState([]);
  const [projects, setProjects]       = useState([]);
  const [statuses, setStatuses]       = useState([]);
  const [matrix, setMatrix]           = useState(() => JSON.parse(localStorage.getItem('accessMatrix')||'{}'));
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm]   = useState('');
  const [loading, setLoading]         = useState(false);

  // Load initial users on component mount
  useEffect(() => {
    loadUsers('');
    loadProjects();
    loadStatuses();
  },[]);

  // Function to load users with search capability
  const loadUsers = async (term) => {
    setLoading(true);
    try {
      const res = await axios.get('/rest/api/2/user/search', { 
        params: { username: term }
      });
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load projects
  const loadProjects = async () => {
    try {
      const res = await axios.get('/rest/api/2/project');
      setProjects(res.data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  // Load statuses
  const loadStatuses = async () => {
    try {
      const res = await axios.get('/rest/api/2/status');
      setStatuses(res.data);
    } catch (err) {
      console.error("Failed to load statuses:", err);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    loadUsers(searchTerm);
  };

  // Toggle user access
  const toggle = (type, id) => {
    if (!selectedUser) return;
    
    const key = selectedUser.name;
    const userMat = matrix[key] || { projects: [], statuses: [] };
    const arr = userMat[type];
    const idx = arr.indexOf(id);
    
    if (idx > -1) {
      arr.splice(idx, 1);
    } else {
      arr.push(id);
    }
    
    setMatrix({...matrix, [key]: userMat});
  };

  // Save access matrix
  const saveMatrix = () => {
    localStorage.setItem('accessMatrix', JSON.stringify(matrix));
    alert('Access permissions saved successfully!');
  };

  return (
    <div className="app-container">
      <div className="dashboard-container">
        <header className="app-header">
          <div className="header-logo">
            <div className="logo-icon small" />
            <h1>User Management</h1>
          </div>
          <div className="user-menu">
            <Link to="/select" className="btn btn-outline">Back to Dashboard</Link>
          </div>
        </header>
        
        <div className="kanban-container">
          <div className="content-card p-lg">
            <h2 className="card-title">Manage User Access</h2>
            
            <div className="grid-container">
              {/* Left column - User selection */}
              <div className="content-section">
                <h3 className="section-title">Jira Users</h3>
                
                <form onSubmit={handleSearch} className="form-group">
                  <div className="input-group">
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Search users..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary">
                      Search
                    </button>
                  </div>
                </form>
                
                {loading ? (
                  <div className="text-center p-md">
                    <div className="loader" style={{ width: '30px', height: '30px' }}></div>
                    <p>Loading users...</p>
                  </div>
                ) : (
                  <div className="user-list custom-scrollbar" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {users.length > 0 ? (
                      users.map(user => (
                        <div
                          key={user.name}
                          className={`user-item ${selectedUser?.name === user.name ? 'user-item-selected' : ''}`}
                          onClick={() => setSelectedUser(user)}
                        >
                          <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="user-name">{user.displayName}</div>
                            <div className="user-email">{user.emailAddress || user.name}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">No users found</div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Right column - Permissions */}
              <div className="content-section">
                {selectedUser ? (
                  <>
                    <div className="permissions-container">
                      <div className="access-config-header">
                        <div className="user-avatar-large">
                          {selectedUser.displayName.charAt(0).toUpperCase()}
                        </div>
                        <h3>Configure Access for {selectedUser.displayName}</h3>
                      </div>
                      
                      <div className="permission-section">
                        <h4>Project Access</h4>
                        <p className="form-text">Select which projects this user can access:</p>
                        
                        <div className="permission-list custom-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {projects.map(project => (
                            <div key={project.key} className="checkbox-item">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={(matrix[selectedUser.name]?.projects || []).includes(project.key)}
                                  onChange={() => toggle('projects', project.key)}
                                />
                                <span>{project.name}</span>
                                <span className="project-key">{project.key}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="permission-section">
                        <h4>Status Access</h4>
                        <p className="form-text">Select which statuses this user can modify:</p>
                        
                        <div className="permission-list custom-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {statuses.map(status => (
                            <div key={status.id} className="checkbox-item">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={(matrix[selectedUser.name]?.statuses || []).includes(status.id.toString())}
                                  onChange={() => toggle('statuses', status.id.toString())}
                                />
                                <span>{status.name}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="permissions-form-actions">
                        <button className="btn btn-outline" onClick={() => setSelectedUser(null)}>
                          Cancel
                        </button>
                        <button className="btn btn-primary" onClick={saveMatrix}>
                          Save Permissions
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state-large">
                    <div className="empty-state-icon">👈</div>
                    <h3>No User Selected</h3>
                    <p>Please select a user from the list to configure their access permissions.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main App w/ Routing ---
export default function App() {
  const [user, setUser] = useState({ name:'', role:'' });

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />

          <Route path="/select"
                 element={<ProtectedBusiness><SelectPage/></ProtectedBusiness>} />
          <Route path="/kanban"
                 element={<ProtectedBusiness><KanbanPage/></ProtectedBusiness>} />
          <Route path="/issue/:issueKey"
                 element={<ProtectedBusiness><IssuePage/></ProtectedBusiness>} />

          <Route path="/users"
                 element={<ProtectedAdmin><UserManagementPage/></ProtectedAdmin>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </UserContext.Provider>
  );
}
