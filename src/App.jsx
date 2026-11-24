
import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Html5QrcodeScanner } from "html5-qrcode";

import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  QrCode,
  Settings,
  Bell,
  Search,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Menu,
  Plus,
  ArrowLeft,
  Camera,
  Clock,
  Smartphone,
} from "lucide-react";

import "./App.css";

// AWS API Gateway
const API =
  import.meta.env.VITE_API_BASE_URL ||
  "https://qipsv2dwa3.execute-api.ap-southeast-2.amazonaws.com";

// --------------------------------------
// QR SCANNER COMPONENT
// --------------------------------------

function StudentScanner({ onScan }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "student-qr-reader",
      {
        fps: 10,
        qrbox: { width: 230, height: 230 },
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        scanner.clear().catch(() => {});
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="scanner-wrapper">
      <div id="student-qr-reader"></div>
    </div>
  );
}

// --------------------------------------
// READ QR DATA
// --------------------------------------

function parseQRData(decodedText) {
  try {
    // QR code containing a website URL
    const url = new URL(decodedText);

    const session_id = url.searchParams.get("session_id");
    const qr_token = url.searchParams.get("qr_token");

    if (session_id && qr_token) {
      return {
        session_id,
        qr_token,
        subject: url.searchParams.get("subject") || "Cloud Computing",
      };
    }
  } catch (error) {
    // Try JSON format below
  }

  // Backward compatibility with old JSON QR codes
  try {
    const data = JSON.parse(decodedText);

    if (data.session_id && data.qr_token) {
      return data;
    }
  } catch (error) {
    // Invalid QR
  }

  throw new Error("Invalid attendance QR code");
}

// --------------------------------------
// API RESPONSE HANDLER
// --------------------------------------

async function readAPIResponse(response) {
  const result = await response.json();

  const data =
    typeof result.body === "string"
      ? JSON.parse(result.body)
      : result.body || result;

  if (
    !response.ok ||
    (result.statusCode && result.statusCode >= 400)
  ) {
    throw new Error(
      data.error ||
      data.message ||
      "AWS request failed"
    );
  }

  return data;
}

// --------------------------------------
// MAIN APPLICATION
// --------------------------------------

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const [sessionData, setSessionData] = useState(null);
  const [showSession, setShowSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [studentId, setStudentId] = useState("");
  const [scannedData, setScannedData] = useState(null);
  const [scanMessage, setScanMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const weeklyData = [
    { day: "Mon", attendance: 72 },
    { day: "Tue", attendance: 85 },
    { day: "Wed", attendance: 78 },
    { day: "Thu", attendance: 92 },
    { day: "Fri", attendance: 88 },
    { day: "Sat", attendance: 95 },
    { day: "Sun", attendance: 82 },
  ];

  const students = [
    {
      id: "STU001",
      name: "Aarav Sharma",
      subject: "Cloud Computing",
      status: "Present",
    },
    {
      id: "STU002",
      name: "Priya Patil",
      subject: "Cloud Computing",
      status: "Present",
    },
    {
      id: "STU003",
      name: "Rahul Deshmukh",
      subject: "Cloud Computing",
      status: "Absent",
    },
    {
      id: "STU004",
      name: "Sneha Kulkarni",
      subject: "Cloud Computing",
      status: "Present",
    },
    {
      id: "STU005",
      name: "Aditya Joshi",
      subject: "Cloud Computing",
      status: "Present",
    },
  ];

  const navigation = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Students", icon: Users },
    { name: "Attendance", icon: ClipboardCheck },
    { name: "QR Sessions", icon: QrCode },
    { name: "Student Scanner", icon: Camera },
    { name: "Settings", icon: Settings },
  ];

  // --------------------------------------
  // AUTOMATIC STUDENT REDIRECTION
  // --------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const session_id = params.get("session_id");
    const qr_token = params.get("qr_token");

    if (session_id && qr_token) {
      setScannedData({
        session_id,
        qr_token,
        subject: params.get("subject") || "Cloud Computing",
      });

      setActivePage("Student Scanner");

      setScanMessage(
        "Teacher QR code detected! Enter your Student ID."
      );
    }
  }, []);

  // --------------------------------------
  // GENERATE ATTENDANCE SESSION
  // --------------------------------------

  async function generateSession() {
    setLoading(true);
    setError("");
    setSessionData(null);
    setShowSession(true);

    try {
      const response = await fetch(`${API}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: "Cloud Computing",
          teacher_id: "teacher1",
        }),
      });

      const data = await readAPIResponse(response);

      if (!data.session_id || !data.qr_token) {
        throw new Error("Session ID or QR token missing");
      }

      setSessionData(data);
    } catch (err) {
      console.error("Session error:", err);
      setError(err.message || "Unable to connect to AWS");
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------
  // CREATE WEBSITE URL FOR QR CODE
  // --------------------------------------

  function getAttendanceURL() {
    if (!sessionData) return "";

    const url = new URL(
      window.location.pathname,
      window.location.origin
    );

    url.searchParams.set(
      "session_id",
      sessionData.session_id
    );

    url.searchParams.set(
      "qr_token",
      sessionData.qr_token
    );

    url.searchParams.set(
      "subject",
      sessionData.subject || "Cloud Computing"
    );

    return url.toString();
  }

  // --------------------------------------
  // SCAN QR CODE
  // --------------------------------------

  const handleScan = useCallback((decodedText) => {
    try {
      const data = parseQRData(decodedText);

      setScannedData(data);

      setScanMessage(
        "QR code scanned successfully. Enter your Student ID."
      );
    } catch (err) {
      setScanMessage(err.message);
      setScannedData(null);
    }
  }, []);

  // --------------------------------------
  // MARK STUDENT ATTENDANCE
  // --------------------------------------

  async function markAttendance() {
    if (!studentId.trim()) {
      setScanMessage("Please enter your Student ID.");
      return;
    }

    if (!scannedData) {
      setScanMessage("Please scan the teacher's QR code.");
      return;
    }

    setSubmitting(true);
    setScanMessage("");

    try {
      const response = await fetch(`${API}/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: scannedData.session_id,
          qr_token: scannedData.qr_token,
          student_id: studentId.trim(),
        }),
      });

      const data = await readAPIResponse(response);

      setScanMessage(
        `SUCCESS! Attendance marked for ${data.student_id}.`
      );

      setScannedData(null);
      setStudentId("");

      // Remove QR parameters after successful submission
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

    } catch (err) {
      console.error("Attendance error:", err);

      setScanMessage(
        err.message || "Unable to mark attendance."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // --------------------------------------
  // STUDENT PAGE RESET
  // --------------------------------------

  function closeScanner() {
    setScannedData(null);
    setScanMessage("");
    setStudentId("");

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    setActivePage("Dashboard");
  }

  // --------------------------------------
  // EXPIRY DISPLAY
  // --------------------------------------

  function formatExpiry(value) {
    if (!value) return "5 minutes after creation";

    const date =
      typeof value === "number"
        ? new Date(value)
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("en-IN");
  }

  // --------------------------------------
  // RENDER
  // --------------------------------------

  return (
    <div className="app-container">

      {/* SIDEBAR */}

      <aside
        className={`sidebar ${
          menuOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="brand">
          <div className="brand-icon">
            <QrCode size={25} />
          </div>

          <div>
            <h2>Attendify</h2>
            <span>SMART ATTENDANCE</span>
          </div>
        </div>

        <div className="nav-label">MENU</div>

        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`nav-item ${
                  activePage === item.name ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage(item.name);
                  setMenuOpen(false);
                  setScanMessage("");
                  setScannedData(null);
                }}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <QrCode size={26} />
            <h4>QR Attendance</h4>
            <p>
              Manage your classroom attendance digitally.
            </p>
          </div>

          <div className="teacher-profile">
            <div className="avatar">TC</div>

            <div>
              <strong>Teacher</strong>
              <span>Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">

        {/* TOPBAR */}

        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu size={22} />
            </button>

            <div>
              <h2>{activePage}</h2>
              <p>
                Welcome back! Manage your classroom attendance.
              </p>
            </div>
          </div>

          <div className="topbar-right">
            <div className="search-box">
              <Search size={17} />
              <input placeholder="Search..." />
            </div>

            <button className="icon-button">
              <Bell size={20} />
            </button>

            <div className="avatar top-avatar">TC</div>
          </div>
        </header>

        {/* DASHBOARD */}

        {activePage === "Dashboard" && (
          <div className="dashboard">

            <section className="welcome-section">
              <div>
                <span className="eyebrow">OVERVIEW</span>
                <h1>Teacher Dashboard</h1>
                <p>
                  Track student attendance and manage your classroom.
                </p>
              </div>

              <div className="date-display">
                <CalendarDays size={18} />
                {new Date().toLocaleDateString("en-IN")}
              </div>
            </section>

            {/* STATISTICS */}

            <section className="stats-grid">

              <div className="stat-card">
                <div className="stat-top">
                  Total Students
                  <div className="stat-icon purple">
                    <Users />
                  </div>
                </div>
                <h2>120</h2>
                <span className="stat-note">
                  Demo dashboard data
                </span>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  Present Today
                  <div className="stat-icon green">
                    <CheckCircle2 />
                  </div>
                </div>
                <h2>96</h2>
                <span className="stat-note">
                  Demo dashboard data
                </span>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  Absent Today
                  <div className="stat-icon red">
                    <XCircle />
                  </div>
                </div>
                <h2>24</h2>
                <span className="stat-note">
                  Demo dashboard data
                </span>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  Attendance Rate
                  <div className="stat-icon orange">
                    <ClipboardCheck />
                  </div>
                </div>
                <h2>80%</h2>
                <span className="stat-note">
                  Demo attendance rate
                </span>
              </div>

            </section>

            {/* CHART AND QUICK ACTIONS */}

            <section className="content-grid">

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Attendance Overview</h3>
                    <p>Weekly attendance trends</p>
                  </div>

                  <span className="chart-tag">
                    This Week
                  </span>
                </div>

                <div className="chart-container">
                  <div className="weekly-bars">
                    {weeklyData.map((item) => (
                      <div
                        className="bar-column"
                        key={item.day}
                      >
                        <strong>
                          {item.attendance}%
                        </strong>

                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              height: `${item.attendance}%`,
                            }}
                          />
                        </div>

                        <span>{item.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Quick Actions</h3>
                    <p>Manage attendance sessions</p>
                  </div>
                </div>

                <div className="qr-action">
                  <div className="qr-action-icon">
                    <QrCode size={35} />
                  </div>

                  <h3>Generate QR Code</h3>

                  <p>
                    Create a new attendance session for your students.
                  </p>

                  <button
                    className="primary-button"
                    onClick={generateSession}
                  >
                    <Plus size={18} />
                    Generate QR
                  </button>
                </div>

                <div className="session-info">
                  <Clock size={17} />
                  Sessions expire after 5 minutes.
                </div>
              </div>

            </section>

            {/* RECENT ATTENDANCE */}

            <section className="panel attendance-panel">
              <div className="panel-heading">
                <div>
                  <h3>Recent Attendance</h3>
                  <p>Sample attendance records</p>
                </div>

                <button
                  className="view-button"
                  onClick={() => setActivePage("Attendance")}
                >
                  View All
                </button>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Subject</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td>{student.id}</td>
                        <td>{student.name}</td>
                        <td>{student.subject}</td>
                        <td>
                          <span
                            className={`status ${student.status.toLowerCase()}`}
                          >
                            {student.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        )}

        {/* STUDENT SCANNER */}

        {activePage === "Student Scanner" && (
          <div className="dashboard">

            <section className="welcome-section">
              <div>
                <span className="eyebrow">
                  STUDENT PORTAL
                </span>

                <h1>Mark Your Attendance</h1>

                <p>
                  Scan the QR code displayed by your teacher.
                </p>
              </div>
            </section>

            <div className="panel scanner-panel">

              <div className="qr-action-icon">
                <Camera size={32} />
              </div>

              <h2>Student QR Scanner</h2>

              <p>
                Enter your registered Student ID.
              </p>

              <input
                className="student-input"
                value={studentId}
                onChange={(e) =>
                  setStudentId(e.target.value)
                }
                placeholder="Example: STU001"
              />

              {!scannedData && (
                <>
                  <h3>Scan Teacher's QR Code</h3>

                  <StudentScanner onScan={handleScan} />
                </>
              )}

              {scannedData && (
                <div className="scanned-details">

                  <CheckCircle2
                    size={35}
                    color="#27a56a"
                  />

                  <h3>QR Code Recognized!</h3>

                  <p>
                    Subject: {scannedData.subject || "Cloud Computing"}
                  </p>

                  <p>
                    Session ID: {scannedData.session_id}
                  </p>

                  <button
                    className="primary-button"
                    onClick={markAttendance}
                    disabled={submitting}
                  >
                    {submitting
                      ? "Submitting..."
                      : "Mark My Attendance"}
                  </button>
                </div>
              )}

              {scanMessage && (
                <p className="scan-message">
                  {scanMessage}
                </p>
              )}

              <button
                className="view-button"
                onClick={closeScanner}
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </button>

            </div>
          </div>
        )}

        {/* OTHER PAGES */}

        {activePage !== "Dashboard" &&
          activePage !== "Student Scanner" && (
            <div className="empty-page panel">

              <div className="qr-action-icon">
                <QrCode size={35} />
              </div>

              <h2>{activePage}</h2>

              <p>
                This section is not yet connected to live AWS records.
              </p>

              <button
                className="primary-button"
                onClick={() => setActivePage("Dashboard")}
              >
                Back to Dashboard
              </button>

            </div>
          )}

        {/* QR SESSION MODAL */}

        {showSession && (
          <div
            className="modal-overlay"
            onClick={() => setShowSession(false)}
          >
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
            >

              <button
                className="modal-close"
                onClick={() => setShowSession(false)}
              >
                ×
              </button>

              {loading && (
                <>
                  <h2>Creating Session...</h2>
                  <p>Connecting to AWS Lambda.</p>
                </>
              )}

              {!loading && error && (
                <>
                  <XCircle
                    size={45}
                    color="#e35e67"
                  />

                  <h2>Session Creation Failed</h2>

                  <p>{error}</p>

                  <button
                    className="primary-button"
                    onClick={generateSession}
                  >
                    Try Again
                  </button>
                </>
              )}

              {!loading && sessionData && (
                <>
                  <div className="qr-action-icon">
                    <QrCode size={32} />
                  </div>

                  <h2>Attendance QR Code</h2>

                  <div className="generated-qr">
                    <QRCodeSVG
                      value={getAttendanceURL()}
                      size={230}
                      level="H"
                      includeMargin
                    />
                  </div>

                  <span className="eyebrow">
                    SESSION CREATED SUCCESSFULLY
                  </span>

                  <p>
                    <strong>Subject:</strong>{" "}
                    {sessionData.subject || "Cloud Computing"}
                  </p>

                  <p>
                    <strong>Session ID:</strong>
                    <br />
                    {sessionData.session_id}
                  </p>

                  <p>
                    <strong>Expiry:</strong>{" "}
                    {formatExpiry(sessionData.expiry_time)}
                  </p>

                  <div className="session-info">
                    <Smartphone size={18} />
                    Students can scan using their phone camera.
                  </div>

                  <button
                    className="primary-button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        getAttendanceURL()
                      );
                    }}
                  >
                    Copy Student Attendance Link
                  </button>

                  <p>
                    Display this QR code to your students.
                  </p>
                </>
              )}

            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
