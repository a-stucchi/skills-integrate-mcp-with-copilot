document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userMenuButton = document.getElementById("user-menu-button");
  const teacherStatus = document.getElementById("teacher-status");
  const loginModal = document.getElementById("login-modal");
  const closeModalButton = document.getElementById("close-modal-button");
  const loginForm = document.getElementById("login-form");

  const AUTH_TOKEN_KEY = "teacherAuthToken";
  const AUTH_USER_KEY = "teacherUsername";

  function getTeacherToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  function getTeacherUsername() {
    return localStorage.getItem(AUTH_USER_KEY);
  }

  function setTeacherSession(token, username) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, username);
  }

  function clearTeacherSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  function isTeacherLoggedIn() {
    return Boolean(getTeacherToken());
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateTeacherUI() {
    if (isTeacherLoggedIn()) {
      const username = getTeacherUsername();
      teacherStatus.textContent = `Teacher: ${username}`;
      userMenuButton.textContent = "🚪";
      userMenuButton.setAttribute("aria-label", "Logout teacher");
      signupForm.querySelector("button[type='submit']").disabled = false;
      signupForm.querySelector("button[type='submit']").textContent = "Register Student";
    } else {
      teacherStatus.textContent = "Student mode";
      userMenuButton.textContent = "👤";
      userMenuButton.setAttribute("aria-label", "Teacher login");
      signupForm.querySelector("button[type='submit']").disabled = true;
      signupForm.querySelector("button[type='submit']").textContent = "Login Required";
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}" ${
                        isTeacherLoggedIn() ? "" : "disabled"
                      }>❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherLoggedIn()) {
      showMessage("Teacher login required to unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "X-Teacher-Token": getTeacherToken(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else if (response.status === 401) {
        clearTeacherSession();
        updateTeacherUI();
        showMessage("Teacher session expired. Please login again.", "error");
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacherLoggedIn()) {
      showMessage("Teacher login required to register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "X-Teacher-Token": getTeacherToken(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else if (response.status === 401) {
        clearTeacherSession();
        updateTeacherUI();
        showMessage("Teacher session expired. Please login again.", "error");
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to register student. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuButton.addEventListener("click", () => {
    if (isTeacherLoggedIn()) {
      clearTeacherSession();
      updateTeacherUI();
      fetchActivities();
      showMessage("Teacher logged out.", "info");
      return;
    }

    loginModal.classList.remove("hidden");
  });

  closeModalButton.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
        }
      );
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Unable to login.", "error");
        return;
      }

      setTeacherSession(result.token, result.username);
      updateTeacherUI();
      fetchActivities();
      showMessage(result.message, "success");
      loginModal.classList.add("hidden");
      loginForm.reset();
    } catch (error) {
      showMessage("Login failed. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  // Initialize app
  updateTeacherUI();
  fetchActivities();
});
