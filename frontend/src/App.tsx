import { useCallback, useEffect, useState, type FormEvent } from "react";

import "./App.css";

import AuthPage from "./components/AuthPage";
import ResumeMatcher from "./components/ResumeMatcher";

import { getCurrentUser, type AuthUser } from "./api/auth";



type JobApplication = {

  id: number;

  company: string;

  job_title: string;

  status: string;

  application_date: string;

  job_url: string | null;

  notes: string | null;

};



type ApplicationForm = {

  company: string;

  job_title: string;

  status: string;

  application_date: string;

  job_url: string;

  notes: string;

};



const API_URL =

  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";



function getToday() {

  const now = new Date();



  const localDate = new Date(

    now.getTime() - now.getTimezoneOffset() * 60000

  );



  return localDate.toISOString().split("T")[0];

}



function emptyForm(): ApplicationForm {

  return {

    company: "",

    job_title: "",

    status: "Applied",

    application_date: getToday(),

    job_url: "",

    notes: "",

  };

}



type DashboardProps = {

  token: string;

  user: AuthUser;

  onLogout: () => void;

};



function Dashboard({ token, user, onLogout }: DashboardProps) {

  const [applications, setApplications] = useState<JobApplication[]>([]);

  const [form, setForm] = useState<ApplicationForm>(emptyForm);

  const [editingId, setEditingId] = useState<number | null>(null);



  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);



  const [error, setError] = useState("");

  const [formError, setFormError] = useState("");

  const [success, setSuccess] = useState("");



  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");



  // Dashboard statistics

  const statistics = {

    total: applications.length,

    applied: applications.filter(

      (app) => app.status === "Applied"

    ).length,

    interviewing: applications.filter(

      (app) => app.status === "Interviewing"

    ).length,

    offers: applications.filter(

      (app) => app.status === "Offer"

    ).length,

    rejected: applications.filter(

      (app) => app.status === "Rejected"

    ).length,

  };



  // Search and status filtering

  const filteredApplications = applications.filter((application) => {

    const query = searchQuery.trim().toLowerCase();



    const matchesSearch =

      application.company.toLowerCase().includes(query) ||

      application.job_title.toLowerCase().includes(query);



    const matchesStatus =

      statusFilter === "All" ||

      application.status === statusFilter;



    return matchesSearch && matchesStatus;

  });



  // Load applications from FastAPI

  useEffect(() => {

    let cancelled = false;



    async function fetchApplications() {

      try {

        const response = await fetch(`${API_URL}/applications`, {

          headers: {

            Authorization: `Bearer ${token}`,

          },

        });



        if (cancelled) return;



        if (response.status === 401) {

          onLogout();

          return;

        }



        if (!response.ok) {

          throw new Error("Failed to fetch applications");

        }



        const data: JobApplication[] = await response.json();



        if (!cancelled) {

          setApplications(data);

        }

      } catch (err) {

        if (!cancelled) {

          setError(

            err instanceof Error

              ? err.message

              : "Failed to load applications"

          );

        }

      } finally {

        if (!cancelled) {

          setLoading(false);

        }

      }

    }



    void fetchApplications();



    return () => {

      cancelled = true;

    };

  }, [token, onLogout]);



  function updateField(

    field: keyof ApplicationForm,

    value: string

  ) {

    setForm((previous) => ({

      ...previous,

      [field]: value,

    }));

  }



  function resetForm() {

    setForm(emptyForm());

    setEditingId(null);

    setFormError("");

  }



  // Populate form when editing

  function startEditing(application: JobApplication) {

    setEditingId(application.id);



    setForm({

      company: application.company,

      job_title: application.job_title,

      status: application.status,

      application_date: application.application_date,

      job_url: application.job_url ?? "",

      notes: application.notes ?? "",

    });



    setFormError("");

    setSuccess("");



    window.scrollTo({

      top: 0,

      behavior: "smooth",

    });

  }



  // Create or update application

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();



    if (saving) return;



    setSaving(true);

    setFormError("");

    setSuccess("");



    const isEditing = editingId !== null;



    const payload = {

      company: form.company.trim(),

      job_title: form.job_title.trim(),

      status: form.status,

      application_date: form.application_date,

      job_url: form.job_url.trim() || null,

      notes: form.notes.trim() || null,

    };



    if (!payload.company || !payload.job_title) {

      setFormError("Company and job title are required.");

      setSaving(false);

      return;

    }



    try {

      const endpoint = isEditing

        ? `${API_URL}/applications/${editingId}`

        : `${API_URL}/applications`;



      const response = await fetch(endpoint, {

        method: isEditing ? "PUT" : "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify(payload),

      });



      if (response.status === 401) {

        onLogout();

        return;

      }



      if (!response.ok) {

        throw new Error(

          isEditing

            ? "Failed to update application"

            : "Failed to create application"

        );

      }



      const saved: JobApplication = await response.json();



      if (isEditing) {

        setApplications((previous) =>

          previous.map((application) =>

            application.id === saved.id

              ? saved

              : application

          )

        );



        setSuccess("Application updated successfully!");

      } else {

        setApplications((previous) => [

          saved,

          ...previous,

        ]);



        setSuccess("Application added successfully!");

      }



      resetForm();

    } catch (err) {

      setFormError(

        err instanceof Error

          ? err.message

          : "Something went wrong"

      );

    } finally {

      setSaving(false);

    }

  }



  // Delete application

  async function handleDelete(application: JobApplication) {

    if (deletingId !== null) return;



    const confirmed = window.confirm(

      `Delete your application for ${application.job_title} at ${application.company}?`

    );



    if (!confirmed) return;



    setDeletingId(application.id);

    setError("");

    setSuccess("");



    try {

      const response = await fetch(

        `${API_URL}/applications/${application.id}`,

        {

          method: "DELETE",

          headers: {

            Authorization: `Bearer ${token}`,

          },

        }

      );



      if (response.status === 401) {

        onLogout();

        return;

      }



      if (!response.ok) {

        throw new Error("Failed to delete application");

      }



      setApplications((previous) =>

        previous.filter(

          (item) => item.id !== application.id

        )

      );



      if (editingId === application.id) {

        resetForm();

      }



      setSuccess("Application deleted successfully!");

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Failed to delete application"

      );

    } finally {

      setDeletingId(null);

    }

  }



  return (

    <div className="dashboard">

      <header>

        <h1>ApplyPilot Lite</h1>

        <p>Your AI-powered job application tracker</p>



        <div

          style={{

            display: "flex",

            gap: "12px",

            alignItems: "center",

            flexWrap: "wrap",

            marginTop: "12px",

          }}

        >

          <span>Signed in as {user.email}</span>



          <button type="button" onClick={onLogout}>

            Log Out

          </button>

        </div>

      </header>



      <main>
        {/* AI Resume Matching */}
        <ResumeMatcher token={token} onLogout={onLogout} />

        {/* Add / Edit Form */}

        <section className="form-section">

          <h2>

            {editingId !== null

              ? "Edit Job Application"

              : "Add Job Application"}

          </h2>



          <form onSubmit={handleSubmit}>

            <div className="form-grid">

              <label>

                Company *

                <input

                  required

                  maxLength={150}

                  value={form.company}

                  onChange={(e) =>

                    updateField("company", e.target.value)

                  }

                  placeholder="e.g. Microsoft"

                />

              </label>



              <label>

                Job Title *

                <input

                  required

                  maxLength={150}

                  value={form.job_title}

                  onChange={(e) =>

                    updateField("job_title", e.target.value)

                  }

                  placeholder="e.g. Software Engineer"

                />

              </label>



              <label>

                Status

                <select

                  value={form.status}

                  onChange={(e) =>

                    updateField("status", e.target.value)

                  }

                >

                  <option value="Applied">Applied</option>

                  <option value="Interviewing">Interviewing</option>

                  <option value="Offer">Offer</option>

                  <option value="Rejected">Rejected</option>

                </select>

              </label>



              <label>

                Application Date

                <input

                  type="date"

                  required

                  value={form.application_date}

                  onChange={(e) =>

                    updateField("application_date", e.target.value)

                  }

                />

              </label>

            </div>



            <label>

              Job URL

              <input

                type="url"

                value={form.job_url}

                onChange={(e) =>

                  updateField("job_url", e.target.value)

                }

                placeholder="https://example.com/job"

              />

            </label>



            <label>

              Notes

              <textarea

                rows={3}

                value={form.notes}

                onChange={(e) =>

                  updateField("notes", e.target.value)

                }

                placeholder="Add notes about this application..."

              />

            </label>



            {formError && (

              <p className="error">{formError}</p>

            )}



            <div className="form-actions">

              <button type="submit" disabled={saving}>

                {saving

                  ? "Saving..."

                  : editingId !== null

                    ? "Save Changes"

                    : "Add Application"}

              </button>



              {editingId !== null && (

                <button

                  type="button"

                  className="cancel-button"

                  onClick={resetForm}

                  disabled={saving}

                >

                  Cancel

                </button>

              )}

            </div>

          </form>

        </section>



        {/* Dashboard Statistics */}

        <section className="statistics-section">

          <h2>Dashboard Overview</h2>



          <div className="statistics-grid">

            <div className="stat-card">

              <p>Total Applications</p>

              <h3>{statistics.total}</h3>

            </div>



            <div className="stat-card">

              <p>Applied</p>

              <h3>{statistics.applied}</h3>

            </div>



            <div className="stat-card">

              <p>Interviewing</p>

              <h3>{statistics.interviewing}</h3>

            </div>



            <div className="stat-card">

              <p>Offers</p>

              <h3>{statistics.offers}</h3>

            </div>



            <div className="stat-card">

              <p>Rejected</p>

              <h3>{statistics.rejected}</h3>

            </div>

          </div>

        </section>



        {/* Applications Table */}

        <section className="applications-section">

          <h2>

            My Job Applications ({applications.length})

          </h2>



          {/* Search and Filter */}

          <div className="filter-controls">

            <input

              type="search"

              placeholder="Search company or job title..."

              value={searchQuery}

              onChange={(event) =>

                setSearchQuery(event.target.value)

              }

              aria-label="Search applications"

            />



            <select

              value={statusFilter}

              onChange={(event) =>

                setStatusFilter(event.target.value)

              }

              aria-label="Filter by status"

            >

              <option value="All">All Statuses</option>

              <option value="Applied">Applied</option>

              <option value="Interviewing">Interviewing</option>

              <option value="Offer">Offer</option>

              <option value="Rejected">Rejected</option>

            </select>

          </div>



          <p className="results-count">

            Showing {filteredApplications.length} of{" "}

            {applications.length} applications

          </p>



          {success && (

            <p className="success">{success}</p>

          )}



          {loading && (

            <p>Loading applications...</p>

          )}



          {error && (

            <p className="error">{error}</p>

          )}



          {!loading &&

            !error &&

            applications.length === 0 && (

              <p>

                No applications yet. Add your first one above!

              </p>

            )}



          {!loading &&

            !error &&

            applications.length > 0 && (

              <>

                {filteredApplications.length === 0 && (

                  <p>

                    No applications match your search or filter.

                  </p>

                )}



                {filteredApplications.length > 0 && (

                  <div className="table-wrapper">

                    <table>

                      <thead>

                        <tr>

                          <th>Company</th>

                          <th>Job Title</th>

                          <th>Status</th>

                          <th>Date Applied</th>

                          <th>Actions</th>

                        </tr>

                      </thead>



                      <tbody>

                        {filteredApplications.map(

                          (application) => (

                            <tr key={application.id}>

                              <td>{application.company}</td>

                              <td>{application.job_title}</td>

                              <td>{application.status}</td>

                              <td>

                                {application.application_date}

                              </td>



                              <td>

                                <div className="table-actions">

                                  <button

                                    type="button"

                                    className="edit-button"

                                    onClick={() =>

                                      startEditing(application)

                                    }

                                  >

                                    Edit

                                  </button>



                                  <button

                                    type="button"

                                    className="delete-button"

                                    disabled={deletingId !== null}

                                    onClick={() =>

                                      handleDelete(application)

                                    }

                                  >

                                    {deletingId === application.id

                                      ? "Deleting..."

                                      : "Delete"}

                                  </button>

                                </div>

                              </td>

                            </tr>

                          )

                        )}

                      </tbody>

                    </table>

                  </div>

                )}

              </>

            )}

        </section>

      </main>

    </div>

  );

}



function App() {

  // Tokens are kept in memory, not localStorage.

  // Refreshing the page requires logging in again.

  const [token, setToken] = useState<string | null>(null);

  const [user, setUser] = useState<AuthUser | null>(null);

  const [checking, setChecking] = useState(false);

  const [authError, setAuthError] = useState("");



  const handleLogout = useCallback(() => {

    setToken(null);

    setUser(null);

    setAuthError("");

  }, []);



  async function handleLogin(accessToken: string) {

    setChecking(true);

    setAuthError("");



    try {

      const profile = await getCurrentUser(accessToken);



      setUser(profile);

      setToken(accessToken);

    } catch {

      setAuthError(

        "Unable to verify your login. Please try again."

      );

      setToken(null);

      setUser(null);

    } finally {

      setChecking(false);

    }

  }



  if (token && user) {

    return (

      <Dashboard

        token={token}

        user={user}

        onLogout={handleLogout}

      />

    );

  }



  return (

    <>

      {checking && (

        <p role="status">Signing in...</p>

      )}



      {authError && (

        <p role="alert" className="error">

          {authError}

        </p>

      )}



      <AuthPage

        onLogin={(accessToken) => {

          void handleLogin(accessToken);

        }}

      />

    </>

  );

}



export default App;
