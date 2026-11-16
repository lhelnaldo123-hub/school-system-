// Keep the API URL here. The SBA grading add-on loads after the existing portal scripts.
const API = "https://school-system-pe93.onrender.com/api";
window.addEventListener("load", function loadSBAGrading() {
  const script = document.createElement("script");
  script.src = "sba-grading.js";
  script.async = true;
  script.onerror = () => console.error("Could not load SBA grading rules");
  document.head.appendChild(script);
}, { once: true });
