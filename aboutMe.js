/**
 * Dynamically loads the "About Me" section and initializes LinkedIn badge.
 */
document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("about-me-container");

  if (!container) {
      console.error("Error: '#about-me-container' not found in the DOM.");
      return;
  }

  // Fetch the "About Me" component
  fetch("aboutMe.html")
      .then(response => {
          if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.text();
      })
      .then(htmlContent => {
          // Inject the fetched HTML into the container
          container.innerHTML = htmlContent;

          // Check if LinkedIn script already exists before adding it
          if (!document.querySelector('script[src="https://platform.linkedin.com/badges/js/profile.js"]')) {
              loadLinkedInBadge();
          } else {
              console.info("LinkedIn badge script already loaded. Re-rendering badges.");
              renderLinkedInBadges();
          }
      })
      .catch(error => console.error("Error loading the About Me section:", error));
});

/**
* Loads LinkedIn's badge script dynamically and ensures badges render correctly.
*/
function loadLinkedInBadge() {
  const linkedinScript = document.createElement("script");
  linkedinScript.src = "https://platform.linkedin.com/badges/js/profile.js";
  linkedinScript.async = true;
  linkedinScript.defer = true;

  linkedinScript.onload = function () {
      console.info("LinkedIn badge script loaded successfully.");
      renderLinkedInBadges();
  };

  linkedinScript.onerror = function () {
      console.error("Failed to load LinkedIn badge script.");
  };

  document.body.appendChild(linkedinScript);
}

/**
* Re-renders LinkedIn badges after injecting the component.
*/
function renderLinkedInBadges() {
  if (typeof window.LIRenderAll === "function") {
      window.LIRenderAll();
      console.info("LinkedIn badges re-rendered successfully.");
  } else {
      console.warn("LIRenderAll() not available yet. Retrying...");
      setTimeout(renderLinkedInBadges, 500); // Retry after 500ms if not available
  }
}
