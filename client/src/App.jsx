import { useState, useCallback, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import PatientRegistration from "./PatientRegistration";
import QRScanner from "./QRScanner";
import HealthWorkerLogin from "./HealthWorkerLogin";
import ProtectedRoute from "./ProtectedRoute";
import { API_BASE_URL, parseApiResponse } from "./api";
import {
  Activity,
  ArrowRight,
  Files,
  HeartPulse,
  Home,
  LogOut,
  QrCode,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import "./App.css";

const healthIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const initialHistoryForm = {
  allergies: "",
  existingConditions: "",
  currentMedications: "",
  pastIllnessesOrSurgeries: "",
  familyMedicalHistory: "",
  visitDate: "",
  symptomsOrVisitNotes: "",
  providerNotes: "",
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState(() => localStorage.getItem("healthWorkerAuth") || "");
  const [worker, setWorker] = useState(null);
  const [authChecking, setAuthChecking] = useState(() => Boolean(localStorage.getItem("healthWorkerAuth")));
  const [authMessage, setAuthMessage] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientRecord, setPatientRecord] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [patientError, setPatientError] = useState("");
  const [patientLoading, setPatientLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyForm, setHistoryForm] = useState(initialHistoryForm);
  const [historyMessage, setHistoryMessage] = useState("");
  const [historySuccess, setHistorySuccess] = useState(false);
  const [registeredPatients, setRegisteredPatients] = useState([]);
  const [patientListSearch, setPatientListSearch] = useState("");
  const [patientListQuery, setPatientListQuery] = useState("");
  const [patientListPage, setPatientListPage] = useState(1);
  const [patientListTotalPages, setPatientListTotalPages] = useState(1);
  const [patientListTotal, setPatientListTotal] = useState(0);
  const [patientListLoading, setPatientListLoading] = useState(false);
  const [patientListError, setPatientListError] = useState("");
  const [patientListReload, setPatientListReload] = useState(0);

  const menu = [
    { name: "Home", Icon: Home },
    { name: "Register Patient", Icon: UserPlus },
    { name: "Patient Records", Icon: Files },
    { name: "Logout", Icon: LogOut },
  ];

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let active = true;

    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await parseApiResponse(response);
        return data.worker;
      })
      .then((authenticatedWorker) => {
        if (active) {
          setWorker(authenticatedWorker);
          setAuthMessage("");
        }
      })
      .catch((error) => {
        if (active) {
          localStorage.removeItem("healthWorkerAuth");
          setToken("");
          setWorker(null);
          setAuthMessage(error.message || "Unable to verify your session. Please sign in again.");
        }
      })
      .finally(() => {
        if (active) {
          setAuthChecking(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (
      !token ||
      (location.pathname !== "/patient-records" &&
        !location.pathname.startsWith("/add-medical-history/"))
    ) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadPatientList() {
      setPatientListLoading(true);
      setPatientListError("");

      try {
        const query = new URLSearchParams({
          page: String(patientListPage),
          limit: "20",
          search: patientListQuery,
        });
        const response = await fetch(`${API_BASE_URL}/api/patients?${query}`, {
          headers: { Authorization: "Bearer " + token },
          signal: controller.signal,
        });
        const data = await parseApiResponse(response);

        if (controller.signal.aborted) {
          return;
        }

        setRegisteredPatients(Array.isArray(data.patients) ? data.patients : []);
        setPatientListTotal(data.pagination?.total || 0);
        setPatientListTotalPages(Math.max(1, data.pagination?.totalPages || 1));
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          setRegisteredPatients([]);
          setPatientListTotal(0);
          setPatientListTotalPages(1);
          setPatientListError(error.message || "Unable to load registered patients.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setPatientListLoading(false);
        }
      }
    }

    void loadPatientList();

    return () => controller.abort();
  }, [token, location.pathname, patientListPage, patientListQuery, patientListReload]);

  const fetchPatientHistory = useCallback(
    async (healthId) => {
      if (!token || !healthId) {
        setPatientHistory([]);
        return;
      }

      setHistoryLoading(true);
      setHistoryMessage("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/patients/${encodeURIComponent(healthId)}/history`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await parseApiResponse(response);

        setPatientHistory(Array.isArray(data.history) ? data.history : []);
      } catch (error) {
        setPatientHistory([]);
        setHistoryMessage(error.message || "Unable to load patient history.");
        setHistorySuccess(false);
      } finally {
        setHistoryLoading(false);
      }
    },
    [token]
  );

  const handlePatientLookup = useCallback(async (value) => {
    const nextValue = String(value ?? "").trim();

    if (!healthIdPattern.test(nextValue)) {
      setPatientRecord(null);
      setPatientHistory([]);
      setPatientError("Please enter a valid Health ID.");
      return;
    }

    if (!token) {
      setPatientRecord(null);
      setPatientHistory([]);
      setPatientError("Please sign in to view patient records.");
      return;
    }

    setPatientLoading(true);
    setPatientError("");
    setPatientRecord(null);
    setPatientHistory([]);
    setHistoryForm(initialHistoryForm);
    setHistoryMessage("");
    setHistorySuccess(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patients/${encodeURIComponent(nextValue)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await parseApiResponse(response);

      setPatientRecord(data.patient);
      setPatientSearch(nextValue);
      await fetchPatientHistory(nextValue);
    } catch (error) {
      setPatientRecord(null);
      setPatientError(error.message || "Unable to load patient record.");
    } finally {
      setPatientLoading(false);
    }
  }, [token, fetchPatientHistory]);

  useEffect(() => {
    const match = location.pathname.match(/^\/add-medical-history\/([^/]+)$/);

    if (!token || !match) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void handlePatientLookup(match[1]);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [token, location.pathname, handlePatientLookup]);

  function handleLogout() {
    localStorage.removeItem("healthWorkerAuth");
    setToken("");
    setWorker(null);
    setAuthMessage("");
    setPatientSearch("");
    setPatientRecord(null);
    setPatientHistory([]);
    setRegisteredPatients([]);
    setPatientListSearch("");
    setPatientListQuery("");
    setPatientListPage(1);
    setPatientError("");
    setHistoryMessage("");
    setHistorySuccess(false);
    setHistoryForm(initialHistoryForm);
    navigate("/health-worker-login", { replace: true });
  }

  function handleLogin(data) {
    localStorage.setItem("healthWorkerAuth", data.token);
    setWorker(data.worker);
    setToken(data.token);
    setAuthChecking(false);
    setAuthMessage("");
    setPatientSearch("");
    setPatientRecord(null);
    setPatientHistory([]);
    setRegisteredPatients([]);
    setPatientListSearch("");
    setPatientListQuery("");
    setPatientListPage(1);
    setPatientError("");
    setHistoryMessage("");
    setHistorySuccess(false);
    setHistoryForm(initialHistoryForm);
    navigate("/", { replace: true });
  }

  function handleNavigation(name) {
    if (name === "Logout") {
      handleLogout();
      return;
    }

    const routes = {
      Home: "/",
      "Register Patient": "/register-patient",
      "Patient Records": "/patient-records",
    };
    navigate(routes[name] || "/");
  }

  function handleLookupSubmit(event) {
    event.preventDefault();
    handlePatientLookup(patientSearch);
  }

  function handleScannedHealthId(healthId) {
    setPatientSearch(healthId);
    setPatientError("");
    void handlePatientLookup(healthId);
  }

  function handlePatientListSearch(event) {
    event.preventDefault();
    setPatientListPage(1);
    setPatientListQuery(patientListSearch.trim());
  }

  function handlePatientRegistered() {
    setPatientListSearch("");
    setPatientListQuery("");
    setPatientListPage(1);
    setPatientListReload((previous) => previous + 1);
  }

  function handleHistoryFieldChange(event) {
    const { name, value } = event.target;

    setHistoryForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleHistorySubmit(event) {
    event.preventDefault();

    if (!patientRecord?.healthId || !token) {
      setHistoryMessage("Please load a patient record before adding medical history.");
      setHistorySuccess(false);
      return;
    }

    if (!historyForm.visitDate) {
      setHistoryMessage("Please select a visit date before saving medical history.");
      setHistorySuccess(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryMessage("");
    setHistorySuccess(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patients/${encodeURIComponent(patientRecord.healthId)}/history`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            allergies: historyForm.allergies,
            existingConditions: historyForm.existingConditions,
            currentMedications: historyForm.currentMedications,
            pastIllnessesOrSurgeries: historyForm.pastIllnessesOrSurgeries,
            familyMedicalHistory: historyForm.familyMedicalHistory,
            visitDate: historyForm.visitDate,
            symptomsOrVisitNotes: historyForm.symptomsOrVisitNotes,
            providerNotes: historyForm.providerNotes,
          }),
        }
      );

      await parseApiResponse(response);

      setHistoryForm(initialHistoryForm);
      setHistoryMessage("Medical history saved successfully.");
      setHistorySuccess(true);
      await fetchPatientHistory(patientRecord.healthId);
    } catch (error) {
      setHistoryMessage(error.message || "Unable to save medical history.");
      setHistorySuccess(false);
    } finally {
      setHistoryLoading(false);
    }
  }

  const renderDashboard = (currentPage) => (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <HeartPulse aria-hidden="true" size={30} />
          </div>

          <div>
            <h1>Digital Health Record Kiosk</h1>
            <p>Safe <span aria-hidden="true">·</span> Simple <span aria-hidden="true">·</span> Accessible</p>
          </div>
        </div>

        <div className="worker-label">
          <span>Welcome, {worker.name}</span>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className="sidebar">
          <nav>
            {menu.map((item) => (
              <button
                key={item.name}
                type="button"
                className={currentPage === item.name ? "nav-item active" : "nav-item"}
                onClick={() => handleNavigation(item.name)}
              >
                <span className="nav-icon">
                  <item.Icon aria-hidden="true" size={20} />
                </span>
                {item.name}
              </button>
            ))}
          </nav>

          <div className="sidebar-note">
            <span><HeartPulse aria-hidden="true" size={42} /></span>
            <strong>Better Health</strong>
            <p>For a brighter future</p>
          </div>
        </aside>

        <main className="main-content">
          <section className="welcome-banner">
            <div>
              <p className="eyebrow">WELCOME TO YOUR WORKSPACE</p>

              <h2>{currentPage === "Home" ? "Digital Health Record Kiosk" : currentPage}</h2>

              <p>Manage patient registration and Health IDs in one place.</p>
            </div>

            <div className="banner-art">
              <Activity aria-hidden="true" size={64} />
            </div>
          </section>

          {currentPage === "Home" && (
            <>
              <div className="stats-grid">
                <article className="stat-card">
                  <span className="stat-icon blue">
                    <UserPlus aria-hidden="true" size={22} />
                  </span>
                  <p>Patient Registration</p>
                  <h3>Register a Patient</h3>

                  <button className="icon-button" type="button" onClick={() => handleNavigation("Register Patient")}>
                    Get Started <ArrowRight aria-hidden="true" size={16} />
                  </button>
                </article>

                <article className="stat-card">
                  <span className="stat-icon purple">
                    <QrCode aria-hidden="true" size={22} />
                  </span>
                  <p>Quick Access</p>
                  <h3>Scan Patient QR</h3>

                  <button className="icon-button" type="button" onClick={() => handleNavigation("Patient Records")}>
                    Open Patient Records <ArrowRight aria-hidden="true" size={16} />
                  </button>
                </article>

                <article className="stat-card">
                  <span className="stat-icon green">
                    <ShieldCheck aria-hidden="true" size={22} />
                  </span>
                  <p>Privacy First</p>
                  <h3>Secure Health IDs</h3>

                  <span className="stat-description">
                    QR codes contain only the Health ID.
                  </span>
                </article>
              </div>

              <section className="panel">
                <h3>Getting Started</h3>

                <p>
                  Sign in as an authorized health worker, then register a patient to generate a unique Health ID and QR code.
                </p>

                <p className="security-note">
                  Patient information must only be accessible through authenticated and authorized backend endpoints.
                </p>
              </section>
            </>
          )}

          {currentPage === "Register Patient" && (
            <PatientRegistration token={token} onRegistered={handlePatientRegistered} />
          )}

          {currentPage === "Patient Records" && (
            <section className="panel patient-records">
              <h3>Patient Records</h3>

              <>
                  <p>Welcome, {worker.name}. You are signed in.</p>

                  <section className="registered-patient-list" aria-labelledby="registered-patients-heading">
                    <div className="patient-list-heading">
                      <div>
                        <h4 id="registered-patients-heading">Registered Patients</h4>
                        <p>{patientListTotal} patient{patientListTotal === 1 ? "" : "s"} registered</p>
                      </div>
                    </div>

                    <form className="patient-search-form" onSubmit={handlePatientListSearch}>
                      <input
                        type="search"
                        value={patientListSearch}
                        onChange={(event) => setPatientListSearch(event.target.value)}
                        placeholder="Search by name, Health ID, or village"
                        aria-label="Search registered patients"
                        maxLength={100}
                      />
                      <button type="submit" disabled={patientListLoading}>
                        Search Patients
                      </button>
                    </form>

                    {patientListError && (
                      <p className="error-message" role="alert">{patientListError}</p>
                    )}
                    {patientListLoading && (
                      <p className="loading-message" role="status">Loading registered patients...</p>
                    )}
                    {!patientListLoading && !patientListError && registeredPatients.length === 0 && (
                      <div className="empty-state">
                        {patientListQuery
                          ? "No registered patients match your search."
                          : "No patients have been registered yet."}
                      </div>
                    )}
                    {registeredPatients.length > 0 && (
                      <>
                        <div className="patient-table-wrapper">
                          <table className="patient-table">
                            <thead>
                              <tr>
                                <th scope="col">Name</th>
                                <th scope="col">Health ID</th>
                                <th scope="col">Village</th>
                                <th scope="col">Registered</th>
                                <th scope="col"><span className="visually-hidden">Actions</span></th>
                              </tr>
                            </thead>
                            <tbody>
                              {registeredPatients.map((patient) => (
                                <tr key={patient.healthId}>
                                  <td>{patient.name}</td>
                                  <td>{patient.healthId}</td>
                                  <td>{patient.village}</td>
                                  <td>
                                    {patient.registrationDate
                                      ? new Date(patient.registrationDate).toLocaleDateString()
                                      : "Unavailable"}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="patient-select-button"
                                      onClick={() => void handlePatientLookup(patient.healthId)}
                                      disabled={patientLoading}
                                    >
                                      View record
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="patient-pagination" aria-label="Patient list pagination">
                          <button
                            type="button"
                            onClick={() => setPatientListPage((page) => Math.max(1, page - 1))}
                            disabled={patientListPage <= 1 || patientListLoading}
                          >
                            Previous
                          </button>
                          <span>
                            Page {patientListPage} of {patientListTotalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPatientListPage((page) => Math.min(patientListTotalPages, page + 1))}
                            disabled={patientListPage >= patientListTotalPages || patientListLoading}
                          >
                            Next
                          </button>
                        </div>
                      </>
                    )}
                  </section>

                  <section className="patient-record-scanner" aria-labelledby="patient-record-scanner-heading">
                    <h4 id="patient-record-scanner-heading">Scan Patient Health ID</h4>
                    <QRScanner onScan={handleScannedHealthId} />
                  </section>

                  <form className="patient-search-form" onSubmit={handleLookupSubmit}>
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(event) => setPatientSearch(event.target.value)}
                      placeholder="Search by Health ID"
                      aria-label="Search patient by Health ID"
                    />
                    <button type="submit" disabled={patientLoading}>
                      {patientLoading ? "Searching..." : "Search"}
                    </button>
                  </form>

                  {patientError && <p className="error-message" role="alert">{patientError}</p>}

                  {patientRecord ? (
                    <div className="patient-record-details">
                      <div className="patient-card">
                        <div className="record-field">
                          <span>Health ID</span>
                          <strong>{patientRecord.healthId}</strong>
                        </div>

                        <div className="record-field">
                          <span>Name</span>
                          <strong>{patientRecord.name}</strong>
                        </div>

                        <div className="record-field">
                          <span>Age</span>
                          <strong>{patientRecord.age}</strong>
                        </div>

                        <div className="record-field">
                          <span>Gender</span>
                          <strong>{patientRecord.gender}</strong>
                        </div>

                        <div className="record-field">
                          <span>Village</span>
                          <strong>{patientRecord.village}</strong>
                        </div>
                      </div>

                      <div className="medical-history-panel">
                        <h4>Medical History</h4>

                        {historyLoading && <p className="loading-message">Loading medical history...</p>}

                        {historyMessage && (
                          <p className={historySuccess ? "success-message" : "error-message"} role={historySuccess ? "status" : "alert"}>
                            {historyMessage}
                          </p>
                        )}

                        {patientHistory.length > 0 ? (
                          <div className="history-list">
                            {patientHistory.map((entry) => (
                              <article key={entry._id} className="history-entry">
                                <div className="history-header">
                                  <strong>{new Date(entry.visitDate).toLocaleDateString()}</strong>
                                </div>

                                <div className="history-grid">
                                  <div>
                                    <span>Known allergies</span>
                                    <p>{entry.allergies || "Not recorded"}</p>
                                  </div>
                                  <div>
                                    <span>Existing medical conditions</span>
                                    <p>{entry.existingConditions || "Not recorded"}</p>
                                  </div>
                                  <div>
                                    <span>Current medications</span>
                                    <p>{entry.currentMedications || "Not recorded"}</p>
                                  </div>
                                  <div>
                                    <span>Past illnesses or surgeries</span>
                                    <p>{entry.pastIllnessesOrSurgeries || "Not recorded"}</p>
                                  </div>
                                  <div>
                                    <span>Family medical history</span>
                                    <p>{entry.familyMedicalHistory || "Not recorded"}</p>
                                  </div>
                                  <div>
                                    <span>Symptoms or visit notes</span>
                                    <p>{entry.symptomsOrVisitNotes || "Not recorded"}</p>
                                  </div>
                                  <div className="history-provider">
                                    <span>Doctor / provider notes</span>
                                    <p>{entry.providerNotes || "Not recorded"}</p>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="empty-state">No medical history recorded for this patient yet.</div>
                        )}

                        <form className="medical-history-form" onSubmit={handleHistorySubmit}>
                          <fieldset className="medical-history-section">
                            <legend>Patient-reported information</legend>

                            <label htmlFor="patient-history-health-id">Patient Health ID</label>
                            <input id="patient-history-health-id" type="text" value={patientRecord.healthId} readOnly />

                            <label htmlFor="patient-history-allergies">Known allergies</label>
                            <textarea
                              id="patient-history-allergies"
                              name="allergies"
                              value={historyForm.allergies}
                              onChange={handleHistoryFieldChange}
                              rows={3}
                              placeholder="List any known allergies"
                            />

                            <label htmlFor="patient-history-existingConditions">Existing medical conditions</label>
                            <textarea
                              id="patient-history-existingConditions"
                              name="existingConditions"
                              value={historyForm.existingConditions}
                              onChange={handleHistoryFieldChange}
                              rows={3}
                              placeholder="Current or chronic medical conditions"
                            />

                            <label htmlFor="patient-history-currentMedications">Current medications</label>
                            <textarea
                              id="patient-history-currentMedications"
                              name="currentMedications"
                              value={historyForm.currentMedications}
                              onChange={handleHistoryFieldChange}
                              rows={3}
                              placeholder="Current prescriptions or treatments"
                            />

                            <label htmlFor="patient-history-pastIllnessesOrSurgeries">Past illnesses or surgeries</label>
                            <textarea
                              id="patient-history-pastIllnessesOrSurgeries"
                              name="pastIllnessesOrSurgeries"
                              value={historyForm.pastIllnessesOrSurgeries}
                              onChange={handleHistoryFieldChange}
                              rows={3}
                              placeholder="Earlier illnesses, procedures, or surgeries"
                            />

                            <label htmlFor="patient-history-familyMedicalHistory">Family medical history (optional)</label>
                            <textarea
                              id="patient-history-familyMedicalHistory"
                              name="familyMedicalHistory"
                              value={historyForm.familyMedicalHistory}
                              onChange={handleHistoryFieldChange}
                              rows={3}
                              placeholder="Relevant family history"
                            />
                          </fieldset>

                          <fieldset className="medical-history-section">
                            <legend>Healthcare professional notes</legend>

                            <label htmlFor="patient-history-visitDate">Visit date</label>
                            <input
                              id="patient-history-visitDate"
                              type="date"
                              name="visitDate"
                              value={historyForm.visitDate}
                              onChange={handleHistoryFieldChange}
                              required
                            />

                            <label htmlFor="patient-history-symptomsOrVisitNotes">Symptoms or visit notes</label>
                            <textarea
                              id="patient-history-symptomsOrVisitNotes"
                              name="symptomsOrVisitNotes"
                              value={historyForm.symptomsOrVisitNotes}
                              onChange={handleHistoryFieldChange}
                              rows={4}
                              placeholder="Symptoms and examination findings"
                            />

                            <label htmlFor="patient-history-providerNotes">Doctor or healthcare provider notes</label>
                            <textarea
                              id="patient-history-providerNotes"
                              name="providerNotes"
                              value={historyForm.providerNotes}
                              onChange={handleHistoryFieldChange}
                              rows={4}
                              placeholder="Verified clinical assessment and plan"
                            />
                          </fieldset>

                          <button type="submit" className="primary-button" disabled={historyLoading}>
                            {historyLoading ? "Saving..." : "Add History Entry"}
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      Select a registered patient, search by Health ID, or scan a QR code to view the authorized patient record.
                    </div>
                  )}
              </>
            </section>
          )}

          <footer>
            <span className="footer-security">
              <ShieldCheck aria-hidden="true" size={16} />
              Secure · Private · Community Health
            </span>
            <span>Version 1.0</span>
          </footer>
        </main>
      </div>
    </div>
  );

  if (authChecking) {
    return (
      <main className="auth-loading" role="status" aria-live="polite">
        Verifying your health-worker session...
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/health-worker-login"
        element={
          token ? (
            <Navigate to="/" replace />
          ) : (
            <main className="login-page">
              <HealthWorkerLogin onLogin={handleLogin} initialMessage={authMessage} />
            </main>
          )
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute token={token}>
            {() => renderDashboard("Home")}
          </ProtectedRoute>
        }
      />
      <Route
        path="/register-patient"
        element={
          <ProtectedRoute token={token}>
            {() => renderDashboard("Register Patient")}
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient-records"
        element={
          <ProtectedRoute token={token}>
            {() => renderDashboard("Patient Records")}
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-medical-history/:healthId"
        element={
          <ProtectedRoute token={token}>
            {() => renderDashboard("Patient Records")}
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={token ? "/" : "/health-worker-login"} replace />} />
    </Routes>
  );
}
