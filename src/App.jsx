
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
  RefreshCw,
  User,
  BookOpen,
} from "lucide-react";

import "./App.css";

// ======================================
// AWS API CONFIGURATION
// ======================================

const API =
  import.meta.env.VITE_API_BASE_URL ||
  "https://qipsv2dwa3.execute-api.ap-southeast-2.amazonaws.com";

// ======================================
// SAFE API RESPONSE HANDLER
// ======================================

async function readAPIResponse(response) {
  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid response received from AWS.");
  }

  // API Gateway Lambda proxy response
  let data = result;

  if (typeof result.body === "string") {
    try {
      data = JSON.parse(result.body);
    } catch {
      data = {};
    }
  } else if (result.body && typeof result.body === "object") {
    data = result.body;
  }

  const statusCode = result.statusCode || response.status;

  if (!response.ok || statusCode >= 400) {
    throw new Error(
      data.error || data.message || "AWS request failed."
    );
  }

  return data || {};
}

// ======================================
// SAFE ATTENDANCE DATA HANDLER
// ======================================

function getRecords(data) {
  if (!data || typeof data !== "object") {
    return [];
  }

  const records = data.records;

  return Array.isArray(records) ? records : [];
}

function getSubjectSummary(data) {
  if (!data || typeof data !== "object") {
    return [];
  }

  return Array.isArray(data.subject_summary)
    ? data.subject_summary
    : [];
}

// ======================================
// QR DATA PARSER
// ======================================

function parseQRData(decodedText) {
  try {
    const url = new URL(decodedText);

    const session_id = url.searchParams.get("session_id");
    const qr_token = url.searchParams.get("qr_token");

    if (session_id && qr_token) {
      return {
        session_id,
        qr_token,
        subject:
          url.searchParams.get("subject") || "Cloud Computing",
      };
    }
  } catch {
    // Try JSON format
  }

  try {
    const data = JSON.parse(decodedText);

    if (data.session_id && data.qr_token) {
      return data;
    }
  } catch {
    // Invalid QR
  }

  throw new Error("Invalid attendance QR code.");
}

// ======================================
// QR SCANNER
// ======================================

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

// ======================================
// INITIAL ATTENDANCE STATE
// ======================================

const emptyAttendance = {
  view: "",
  student_id: "",
  subject: "",
  present_count: 0,
  total_classes: 0,
  percentage: 0,
  subject_summary: [],
  records: [],
};

// ======================================
// MAIN APPLICATION
// ======================================

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  // QR SESSION
  const [sessionData, setSessionData] = useState(null);
  const [showSession, setShowSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // STUDENT SCANNER
  const [studentId, setStudentId] = useState("");
  const [scannedData, setScannedData] = useState(null);
  const [scanMessage, setScanMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ATTENDANCE VIEW
  const [attendanceMode, setAttendanceMode] = useState("teacher");
  const [attendanceData, setAttendanceData] =
    useState(emptyAttendance);

  const [attendanceStudentId, setAttendanceStudentId] =
    useState("STU001");

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [attendanceError, setAttendanceError] = useState("");

  const [selectedSubject, setSelectedSubject] =
    useState("all");

  // ======================================
  // NAVIGATION
  // ======================================

  const navigation = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Students", icon: Users },
    { name: "Attendance", icon: ClipboardCheck },
    { name: "QR Sessions", icon: QrCode },
    { name: "Student Scanner", icon: Camera },
    { name: "Settings", icon: Settings },
  ];

  const weeklyData = [
    { day: "Mon", attendance: 72 },
    { day: "Tue", attendance: 85 },
    { day: "Wed", attendance: 78 },
    { day: "Thu", attendance: 92 },
    { day: "Fri", attendance: 88 },
    { day: "Sat", attendance: 95 },
    { day: "Sun", attendance: 82 },
  ];

  // ======================================
  // AUTOMATIC QR REDIRECTION
  // ======================================

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

  // ======================================
  // GENERATE QR SESSION
  // ======================================

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
        throw new Error("Session ID or QR token missing.");
      }

      setSessionData(data);
    } catch (err) {
      console.error("Session error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ======================================
  // CREATE QR ATTENDANCE URL
  // ======================================

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

  // ======================================
  // SCAN QR CODE
  // ======================================

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

  // ======================================
  // MARK ATTENDANCE
  // ======================================

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
        `SUCCESS! Attendance marked for ${data.student_id || studentId}.`
      );

      // Keep the submitted ID available for viewing attendance
      setAttendanceStudentId(studentId.trim());
      setAttendanceMode("student");

      setScannedData(null);
      setStudentId("");

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

    } catch (err) {
      console.error("Attendance error:", err);
      setScanMessage(err.message || "Unable to mark attendance.");
    } finally {
      setSubmitting(false);
    }
  }

  // ======================================
  // FETCH ATTENDANCE FROM AWS
  // ======================================

  async function fetchAttendance(mode, id = "") {
    setAttendanceLoading(true);
    setAttendanceError("");
    setAttendanceData(emptyAttendance);

    try {
      const params = new URLSearchParams();

      if (mode === "teacher") {
        // Request all attendance records
        params.set("view", "all");
      } else {
        if (!id.trim()) {
          throw new Error("Please enter a Student ID.");
        }

        params.set("view", "student");
        params.set("student_id", id.trim());
      }

      const response = await fetch(
        `${API}/attendance?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await readAPIResponse(response);

      // Protect against null or malformed API responses
      const safeData = {
        ...emptyAttendance,
        ...data,
        records: getRecords(data),
        subject_summary: getSubjectSummary(data),
      };

      setAttendanceData(safeData);

    } catch (err) {
      console.error("Attendance fetch error:", err);
      setAttendanceError(
        err.message || "Unable to retrieve attendance."
      );
      setAttendanceData(emptyAttendance);
    } finally {
      setAttendanceLoading(false);
    }
  }

  // ======================================
  // ATTENDANCE PAGE INITIAL LOAD
  // ======================================

  useEffect(() => {
    if (activePage === "Attendance") {
      fetchAttendance(
        attendanceMode,
        attendanceStudentId
      );
    }
    // Fetch when the attendance page or mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, attendanceMode]);

  // ======================================
  // SWITCH ATTENDANCE MODE
  // ======================================

  function switchAttendanceMode(mode) {
    setAttendanceMode(mode);
    setSelectedSubject("all");
  }

  // ======================================
  // STUDENT PAGE RESET
  // ======================================

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

  // ======================================
  // FORMAT DATE
  // ======================================

  function formatDate(value) {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("en-IN");
  }

  // ======================================
  // EXPIRY DISPLAY
  // ======================================

  function formatExpiry(value) {
    if (!value) return "5 minutes after creation";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("en-IN");
  }

  // ======================================
  // FILTER RECORDS
  // ======================================

  const allRecords = getRecords(attendanceData);

  const filteredRecords =
    selectedSubject === "all"
      ? allRecords
      : allRecords.filter(
          (record) => record.subject === selectedSubject
        );

  const subjectOptions = [
    ...new Set(
      allRecords
        .map((record) => record.subject)
        .filter(Boolean)
    ),
  ];

  // ======================================
  // RENDER APPLICATION
  // ======================================

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

        {/* ==================================
            DASHBOARD
        ================================== */}

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
                        <strong>{item.attendance}%</strong>

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

            {/* RECENT LIVE ATTENDANCE */}

            <section className="panel attendance-panel">
              <div className="panel-heading">
                <div>
                  <h3>Recent Attendance</h3>
                  <p>Records retrieved from AWS</p>
                </div>

                <button
                  className="view-button"
                  onClick={() => {
                    setAttendanceMode("teacher");
                    setActivePage("Attendance");
                  }}
                >
                  View All
                </button>
              </div>

              <button
                className="view-button"
                onClick={() => fetchAttendance("teacher")}
              >
                <RefreshCw size={15} />
                Refresh Records
              </button>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Subject</th>
                      <th>Date & Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {allRecords.length > 0 ? (
                      [...allRecords]
                        .sort((a, b) =>
                          (b.check_in_time || "").localeCompare(
                            a.check_in_time || ""
                          )
                        )
                        .slice(0, 5)
                        .map((record, index) => (
                          <tr key={record.session_id || index}>
                            <td>{record.student_id}</td>
                            <td>{record.subject}</td>
                            <td>{formatDate(record.check_in_time)}</td>
                            <td>
                              <span className="status present">
                                {record.status || "Present"}
                              </span>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan="4">
                          Open Attendance to load live AWS records.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        )}

        {/* ==================================
            ATTENDANCE PAGE
        ================================== */}

        {activePage === "Attendance" && (
          <div className="dashboard">

            <section className="welcome-section">
              <div>
                <span className="eyebrow">ATTENDANCE MANAGEMENT</span>
                <h1>Attendance Records</h1>
                <p>
                  View teacher records and individual student attendance.
                </p>
              </div>

              <button
                className="primary-button"
                onClick={() =>
                  fetchAttendance(
                    attendanceMode,
                    attendanceStudentId
                  )
                }
                disabled={attendanceLoading}
              >
                <RefreshCw size={17} />
                Refresh
              </button>
            </section>

            {/* MODE SWITCH */}

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Attendance View</h3>
                  <p>Select the records you want to view.</p>
                </div>
              </div>

              <div className="attendance-switch">
                <button
                  className={
                    attendanceMode === "teacher"
                      ? "primary-button"
                      : "view-button"
                  }
                  onClick={() => switchAttendanceMode("teacher")}
                >
                  <Users size={17} />
                  Teacher View
                </button>

                <button
                  className={
                    attendanceMode === "student"
                      ? "primary-button"
                      : "view-button"
                  }
                  onClick={() => switchAttendanceMode("student")}
                >
                  <User size={17} />
                  Student View
                </button>
              </div>

              {/* STUDENT ID SEARCH */}

              {attendanceMode === "student" && (
                <div className="student-search">
                  <label>Enter Student ID</label>

                  <div className="student-search-row">
                    <input
                      className="student-input"
                      value={attendanceStudentId}
                      onChange={(e) =>
                        setAttendanceStudentId(e.target.value)
                      }
                      placeholder="Example: STU001"
                    />

                    <button
                      className="primary-button"
                      onClick={() =>
                        fetchAttendance(
                          "student",
                          attendanceStudentId
                        )
                      }
                      disabled={attendanceLoading}
                    >
                      Search
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* LOADING */}

            {attendanceLoading && (
              <div className="panel">
                <p>Loading attendance records from AWS...</p>
              </div>
            )}

            {/* ERROR */}

            {attendanceError && (
              <div className="panel">
                <p className="scan-message">
                  {attendanceError}
                </p>
              </div>
            )}

            {/* STUDENT SUMMARY */}

            {!attendanceLoading &&
              !attendanceError &&
              attendanceMode === "student" && (
                <>
                  <section className="stats-grid">

                    <div className="stat-card">
                      <div className="stat-top">
                        Student ID
                        <User />
                      </div>
                      <h2>{attendanceData.student_id || attendanceStudentId}</h2>
                    </div>

                    <div className="stat-card">
                      <div className="stat-top">
                        Present Classes
                        <CheckCircle2 />
                      </div>
                      <h2>{attendanceData.present_count ?? 0}</h2>
                    </div>

                    <div className="stat-card">
                      <div className="stat-top">
                        Total Classes
                        <BookOpen />
                      </div>
                      <h2>{attendanceData.total_classes ?? 0}</h2>
                    </div>

                    <div className="stat-card">
                      <div className="stat-top">
                        Attendance Percentage
                        <ClipboardCheck />
                      </div>
                      <h2>{attendanceData.percentage ?? 0}%</h2>
                    </div>

                  </section>

                  {/* SUBJECT SUMMARY */}

                  {getSubjectSummary(attendanceData).length > 0 && (
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h3>Subject-wise Attendance</h3>
                          <p>Attendance summary for each subject</p>
                        </div>
                      </div>

                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Subject</th>
                              <th>Present</th>
                              <th>Total Classes</th>
                              <th>Percentage</th>
                            </tr>
                          </thead>

                          <tbody>
                            {getSubjectSummary(attendanceData).map(
                              (item, index) => (
                                <tr key={item.subject || index}>
                                  <td>{item.subject}</td>
                                  <td>{item.present_count}</td>
                                  <td>{item.total_classes}</td>
                                  <td>
                                    <strong>
                                      {item.percentage}%
                                    </strong>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>
              )}

            {/* TEACHER SUMMARY */}

            {!attendanceLoading &&
              !attendanceError &&
              attendanceMode === "teacher" && (
                <section className="stats-grid">

                  <div className="stat-card">
                    <div className="stat-top">
                      Total Attendance Records
                      <ClipboardCheck />
                    </div>
                    <h2>{allRecords.length}</h2>
                  </div>

                  <div className="stat-card">
                    <div className="stat-top">
                      Present Records
                      <CheckCircle2 />
                    </div>
                    <h2>
                      {
                        allRecords.filter(
                          (record) =>
                            String(record.status || "present").toLowerCase() ===
                            "present"
                        ).length
                      }
                    </h2>
                  </div>

                  <div className="stat-card">
                    <div className="stat-top">
                      Subjects
                      <BookOpen />
                    </div>
                    <h2>{subjectOptions.length}</h2>
                  </div>

                  <div className="stat-card">
                    <div className="stat-top">
                      Students Recorded
                      <Users />
                    </div>
                    <h2>
                      {
                        new Set(
                          allRecords.map(
                            (record) => record.student_id
                          ).filter(Boolean)
                        ).size
                      }
                    </h2>
                  </div>

                </section>
              )}

            {/* ATTENDANCE HISTORY */}

            {!attendanceLoading && !attendanceError && (
              <section className="panel attendance-panel">

                <div className="panel-heading">
                  <div>
                    <h3>
                      {attendanceMode === "teacher"
                        ? "All Student Attendance"
                        : "My Attendance History"}
                    </h3>

                    <p>
                      {attendanceMode === "teacher"
                        ? "Attendance records stored in DynamoDB"
                        : `Attendance history for ${
                            attendanceData.student_id ||
                            attendanceStudentId
                          }`}
                    </p>
                  </div>
                </div>

                {/* SUBJECT FILTER */}

                {subjectOptions.length > 0 && (
                  <div className="student-search">
                    <label>Filter by Subject</label>

                    <select
                      className="student-input"
                      value={selectedSubject}
                      onChange={(e) =>
                        setSelectedSubject(e.target.value)
                      }
                    >
                      <option value="all">All Subjects</option>

                      {subjectOptions.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        {attendanceMode === "teacher" && (
                          <th>Student ID</th>
                        )}

                        <th>Subject</th>
                        <th>Session ID</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRecords.length > 0 ? (
                        filteredRecords.map((record, index) => (
                          <tr
                            key={
                              record.session_id +
                              record.student_id +
                              index
                            }
                          >
                            {attendanceMode === "teacher" && (
                              <td>{record.student_id || "N/A"}</td>
                            )}

                            <td>{record.subject || "N/A"}</td>

                            <td>
                              {record.session_id
                                ? record.session_id.slice(0, 12) + "..."
                                : "N/A"}
                            </td>

                            <td>
                              {formatDate(record.check_in_time)}
                            </td>

                            <td>
                              <span className="status present">
                                {record.status || "Present"}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={
                              attendanceMode === "teacher" ? 5 : 4
                            }
                          >
                            No attendance records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </section>
            )}

          </div>
        )}

        {/* ==================================
            STUDENT SCANNER PAGE
        ================================== */}

        {activePage === "Student Scanner" && (
          <div className="dashboard">

            <section className="welcome-section">
              <div>
                <span className="eyebrow">STUDENT PORTAL</span>
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

              <p>Enter your registered Student ID.</p>

              <input
                className="student-input"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
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

                  <CheckCircle2 size={35} color="#27a56a" />

                  <h3>QR Code Recognized!</h3>

                  <p>
                    Subject: {scannedData.subject}
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
                <p className="scan-message">{scanMessage}</p>
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

        {/* ==================================
            OTHER PAGES
        ================================== */}

        {activePage !== "Dashboard" &&
          activePage !== "Attendance" &&
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

        {/* ==================================
            QR SESSION MODAL
        ================================== */}

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
                  <XCircle size={45} color="#e35e67" />

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

                  <p>Display this QR code to your students.</p>
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
