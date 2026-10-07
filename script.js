function showGlobalMessage(text, type) {
  var box = document.getElementById("formGlobalMessage");
  if (!box) return;
  box.textContent = text;
  box.className = "global-message " + type;
}

function hideGlobalMessage() {
  var box = document.getElementById("formGlobalMessage");
  if (box) box.classList.add("hidden");
}

function showError(fieldId, message) {
  var input = document.getElementById(fieldId);
  var error = document.getElementById("err-" + fieldId);
  if (error) error.textContent = message;
  if (input && input.closest(".form-row")) input.closest(".form-row").classList.add("has-error");
}

function clearError(fieldId) {
  var input = document.getElementById(fieldId);
  var error = document.getElementById("err-" + fieldId);
  if (error) error.textContent = "";
  if (input && input.closest(".form-row")) input.closest(".form-row").classList.remove("has-error");
}

function isEmpty(value) {
  return !value || value.trim() === "";
}

async function apiRequest(action, data, method) {
  var options = {
    method: method || "POST",
    credentials: "same-origin",
    headers: { "Accept": "application/json" }
  };
  var url = "api.php?action=" + encodeURIComponent(action);

  if (options.method === "POST") {
    var sessionResponse = await fetch("api.php?action=session", {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    });
    var sessionData = await sessionResponse.json();
    if (!sessionResponse.ok) throw new Error(sessionData.error || "Could not start a secure session.");
    options.headers["Content-Type"] = "application/json";
    options.headers["X-CSRF-Token"] = sessionData.csrfToken;
    options.body = JSON.stringify(data || {});
  }

  var response = await fetch(url, options);
  var result = await response.json();
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function initHomePage() {
  var studentButton = document.getElementById("openStudentOptions");
  var collegeButton = document.getElementById("openCollegeOptions");
  if (studentButton) studentButton.addEventListener("click", function () {
    document.getElementById("studentSubOptions").classList.toggle("hidden");
  });
  if (collegeButton) collegeButton.addEventListener("click", function () {
    document.getElementById("collegeSubOptions").classList.toggle("hidden");
  });
}

function initRegistrationPage() {
  var form = document.getElementById("registrationForm");
  if (!form) return;

  var fields = [
    "studentName", "email", "mobile", "dob", "gender", "course", "year",
    "division", "qualification", "firstPreference", "secondPreference",
    "guardianName", "relationship", "emergencyContact", "password", "confirmPassword"
  ];

  fields.forEach(function (fieldId) {
    var field = document.getElementById(fieldId);
    field.addEventListener("input", function () { clearError(fieldId); });
    field.addEventListener("change", function () { clearError(fieldId); });
  });

  var clearButton = document.getElementById("clearFormBtn");
  clearButton.addEventListener("click", function () {
    form.reset();
    fields.forEach(clearError);
    hideGlobalMessage();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideGlobalMessage();
    var valid = true;

    fields.forEach(function (fieldId) {
      var field = document.getElementById(fieldId);
      clearError(fieldId);
      if (isEmpty(field.value)) {
        showError(fieldId, "This field is required.");
        valid = false;
      }
    });

    var email = document.getElementById("email").value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("email", "Please enter a valid email address.");
      valid = false;
    }

    ["mobile", "emergencyContact"].forEach(function (fieldId) {
      var value = document.getElementById(fieldId).value.trim();
      if (value && !/^[0-9]{10}$/.test(value)) {
        showError(fieldId, "Number must be exactly 10 digits.");
        valid = false;
      }
    });

    if (document.getElementById("password").value !== document.getElementById("confirmPassword").value) {
      showError("confirmPassword", "Passwords do not match.");
      valid = false;
    }

    if (document.getElementById("firstPreference").value === document.getElementById("secondPreference").value) {
      showError("secondPreference", "Second preference must differ from the first.");
      valid = false;
    }

    if (!valid) {
      showGlobalMessage("Please fix the highlighted fields before submitting.", "error");
      return;
    }

    var submitButton = document.getElementById("registerBtn");
    submitButton.disabled = true;
    try {
      var data = {};
      fields.forEach(function (fieldId) {
        if (fieldId !== "confirmPassword") {
          data[fieldId] = document.getElementById(fieldId).value.trim();
        }
      });
      await apiRequest("register", data);
      form.reset();
      showGlobalMessage("Registration submitted. The college will review it and assign your Student ID after verification.", "success");
    } catch (error) {
      showGlobalMessage(error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  });
}

function initExistingStudentPage() {
  var form = document.getElementById("existingStudentForm");
  if (!form) return;
  ["loginStudentId", "loginPassword"].forEach(function (fieldId) {
    document.getElementById(fieldId).addEventListener("input", function () { clearError(fieldId); });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideGlobalMessage();
    var studentId = document.getElementById("loginStudentId").value.trim();
    var password = document.getElementById("loginPassword").value;
    var valid = true;
    [["loginStudentId", studentId], ["loginPassword", password]].forEach(function (item) {
      clearError(item[0]);
      if (isEmpty(item[1])) {
        showError(item[0], "This field is required.");
        valid = false;
      }
    });
    if (!valid) {
      showGlobalMessage("Enter your Student ID and password.", "error");
      return;
    }

    try {
      await apiRequest("student_login", { studentId: studentId, password: password });
      window.location.href = "student_dashboard.html";
    } catch (error) {
      showGlobalMessage(error.message, "error");
    }
  });
}

function initCollegeLoginPage() {
  var form = document.getElementById("collegeLoginForm");
  if (!form) return;
  ["collegeId", "collegePassword"].forEach(function (fieldId) {
    document.getElementById(fieldId).addEventListener("input", function () { clearError(fieldId); });
  });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideGlobalMessage();
    var collegeId = document.getElementById("collegeId").value.trim();
    var password = document.getElementById("collegePassword").value;
    if (isEmpty(collegeId) || isEmpty(password)) {
      if (isEmpty(collegeId)) showError("collegeId", "This field is required.");
      if (isEmpty(password)) showError("collegePassword", "This field is required.");
      showGlobalMessage("Enter your College ID and password.", "error");
      return;
    }
    try {
      await apiRequest("college_login", { collegeId: collegeId, password: password });
      window.location.href = "college_dashboard.html";
    } catch (error) {
      showGlobalMessage(error.message, "error");
    }
  });
}

function initStudentDashboardPage() {
  var details = document.getElementById("studentDetails");
  if (!details) return;
  apiRequest("student_details").then(function (student) {
    details.innerHTML = "";
    [
      ["Student ID", student.student_id],
      ["Name", student.student_name],
      ["Email", student.email],
      ["Mobile", student.mobile],
      ["Date of Birth", student.dob],
      ["Gender", student.gender],
      ["Course", student.course],
      ["Year", student.year],
      ["Division", student.division],
      ["Previous Qualification", student.qualification],
      ["First Course Preference", student.first_preference],
      ["Second Course Preference", student.second_preference],
      ["Parent / Guardian", student.guardian_name],
      ["Relationship", student.relationship],
      ["Emergency Contact", student.emergency_contact],
      ["Attendance", student.attendance === null ? "Not entered" : student.attendance + "%"],
      ["Eligibility", student.eligibility || "Not calculated yet"]
    ].forEach(function (item) {
      var row = document.createElement("p");
      var label = document.createElement("strong");
      label.textContent = item[0] + ": ";
      row.appendChild(label);
      row.appendChild(document.createTextNode(item[1]));
      details.appendChild(row);
    });
  }).catch(function () {
    window.location.href = "existing_student.html";
  });
  var logout = document.getElementById("studentLogout");
  logout.addEventListener("click", async function () {
    try {
      await apiRequest("student_logout");
      window.location.href = "index.html";
    } catch (error) {
      showGlobalMessage(error.message, "error");
    }
  });
}

function initCollegeDashboardPage() {
  var tableBody = document.getElementById("studentsTableBody");
  if (!tableBody) return;
  var searchForm = document.getElementById("studentSearchForm");
  var searchInput = document.getElementById("searchStudentId");
  var message = document.getElementById("dashboardMessage");

  function showDashboardMessage(text, type) {
    message.textContent = text;
    message.className = "global-message " + type;
  }

  function renderStudents(students) {
    tableBody.innerHTML = "";
    students.forEach(function (student) {
      var row = document.createElement("tr");
      [student.student_id || "Not assigned", student.student_name, student.course,
        student.year, student.status === "pending" ? "Pending verification" : "Verified",
        student.eligibility || "Not calculated yet"].forEach(function (value) {
        var cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      var attendanceCell = document.createElement("td");
      var actions = document.createElement("td");
      var review = document.createElement("details");
      var reviewSummary = document.createElement("summary");
      reviewSummary.textContent = "Review details";
      review.appendChild(reviewSummary);
      [
        ["Email", student.email],
        ["Mobile", student.mobile],
        ["Date of Birth", student.dob],
        ["Gender", student.gender],
        ["Division", student.division],
        ["Previous Qualification", student.qualification],
        ["First Preference", student.first_preference],
        ["Second Preference", student.second_preference],
        ["Guardian", student.guardian_name],
        ["Relationship", student.relationship],
        ["Emergency Contact", student.emergency_contact]
      ].forEach(function (item) {
        var detail = document.createElement("p");
        detail.textContent = item[0] + ": " + item[1];
        review.appendChild(detail);
      });
      actions.appendChild(review);
      if (student.status === "pending") {
        attendanceCell.textContent = "Available after verification";
        var approve = document.createElement("button");
        approve.type = "button";
        approve.className = "btn btn-primary btn-small";
        approve.textContent = "Verify & Assign ID";
        approve.addEventListener("click", async function () {
          approve.disabled = true;
          try {
            var result = await apiRequest("approve_student", { id: student.id });
            showDashboardMessage("Verified. Student ID assigned: " + result.studentId, "success");
            await loadStudents();
          } catch (error) {
            approve.disabled = false;
            showDashboardMessage(error.message, "error");
          }
        });
        actions.appendChild(approve);
      } else {
        var attendanceLabel = document.createElement("label");
        var attendance = document.createElement("input");
        var attendanceId = "attendance-" + student.id;
        attendanceLabel.htmlFor = attendanceId;
        attendanceLabel.textContent = "Attendance %";
        attendance.id = attendanceId;
        attendance.type = "number";
        attendance.min = "0";
        attendance.max = "100";
        attendance.step = "0.01";
        attendance.placeholder = "0–100";
        attendance.value = student.attendance === null ? "" : student.attendance;
        attendance.setAttribute("aria-label", "Attendance percentage for " + student.student_name);
        var save = document.createElement("button");
        save.type = "button";
        save.className = "btn btn-secondary btn-small";
        save.textContent = "Save";
        save.addEventListener("click", async function () {
          var value = attendance.value === "" ? NaN : Number(attendance.value);
          if (isNaN(value) || value < 0 || value > 100) {
            showDashboardMessage("Enter attendance between 0 and 100.", "error");
            return;
          }
          save.disabled = true;
          try {
            await apiRequest("update_attendance", { id: student.id, attendance: value });
            showDashboardMessage("Attendance saved. Eligibility was recalculated.", "success");
            await loadStudents();
          } catch (error) {
            save.disabled = false;
            showDashboardMessage(error.message, "error");
          }
        });
        attendanceCell.appendChild(attendanceLabel);
        attendanceCell.appendChild(attendance);
        attendanceCell.appendChild(save);
      }
      row.appendChild(attendanceCell);
      row.appendChild(actions);
      tableBody.appendChild(row);
    });
  }

  async function loadStudents(search) {
    try {
      var students = await apiRequest("college_students", { search: search || "" });
      renderStudents(students);
      if (!students.length) showDashboardMessage("No matching student records.", "success");
    } catch (error) {
      showDashboardMessage(error.message, "error");
    }
  }

  searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    loadStudents(searchInput.value.trim());
  });
  document.getElementById("showAllStudents").addEventListener("click", function () {
    searchInput.value = "";
    loadStudents();
  });
  document.getElementById("collegeLogout").addEventListener("click", async function () {
    try {
      await apiRequest("college_logout");
      window.location.href = "index.html";
    } catch (error) {
      showDashboardMessage(error.message, "error");
    }
  });
  loadStudents();
}

document.addEventListener("DOMContentLoaded", function () {
  initHomePage();
  initRegistrationPage();
  initExistingStudentPage();
  initCollegeLoginPage();
  initStudentDashboardPage();
  initCollegeDashboardPage();
});
