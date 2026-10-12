const form = document.getElementById("loginForm");
const message = document.getElementById("loginMessage");
const button = form.querySelector("button[type=submit]");
let loginReady = false;

// Prevent an old session cookie from surviving a browser-restored tab. Wait for
// logout to finish before enabling the form, so it cannot race with a new login.
async function prepareLogin() {
  button.disabled = true;
  if (sessionStorage.getItem("adminSession")) {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (response.ok) {
        window.location.replace("/dashboard");
        return;
      }
    } catch (_) {}
    sessionStorage.removeItem("adminSession");
  }

  try {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
  } catch (_) {
    // The server will still reject an expired or invalid session on protected routes.
  }
  loginReady = true;
  button.disabled = false;
}
prepareLogin();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginReady) return;

  message.textContent = "Checking...";
  button.disabled = true;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        code: document.getElementById("code").value.replace(/\\s/g, "")
      })
    });

    const data = await response.json().catch(() => ({}));
    if (data.needs2fa) {
      document.getElementById("codeWrap").hidden = false;
      document.getElementById("code").focus();
    }
    if (!response.ok) throw new Error(data.message || "Login failed");

    sessionStorage.setItem("adminSession", "1");
    window.location.replace("/dashboard");
  } catch (error) {
    message.textContent = error.message || "Login failed";
    button.disabled = false;
  }
});
