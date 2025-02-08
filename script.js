document.addEventListener("DOMContentLoaded", function () {
  const navbar = document.getElementById("navbar");
  const navbarContainer = document.getElementById("navbar-container");
  const mobileMenuButton = document.getElementById("mobile-menu-button");
  const mobileMenu = document.getElementById("mobile-menu");
  let isMenuOpen = false;

  /** 
   * 🟣 Improved Navbar Scroll Effect  
   * - Prevents up/down movement
   * - Ensures smooth shrinking without flickering
   */
  function adjustNavbar() {
      let currentScroll = window.scrollY;

      if (currentScroll > 50) {
          navbarContainer.classList.add(
              "max-w-3xl", "px-5", "py-2", "shadow-lg", 
              "backdrop-blur-lg", "scale-95", "transition-all", "duration-300", "ease-out"
          );
          navbarContainer.classList.remove("max-w-4xl", "px-6", "py-3");
      } else {
          navbarContainer.classList.add("max-w-4xl", "px-6", "py-3");
          navbarContainer.classList.remove(
              "max-w-3xl", "px-5", "py-2", "shadow-lg", 
              "backdrop-blur-lg", "scale-95"
          );
      }
  }

  window.addEventListener("scroll", adjustNavbar);
  adjustNavbar(); // Ensure correct positioning on load

  /** 
   * 🟡 Smooth Mobile Menu Animations  
   */
  function toggleMobileMenu() {
      if (isMenuOpen) {
          mobileMenu.classList.add("opacity-0", "translate-y-[-10px]");
          setTimeout(() => mobileMenu.classList.add("hidden"), 200);
      } else {
          mobileMenu.classList.remove("hidden");
          setTimeout(() => mobileMenu.classList.remove("opacity-0", "translate-y-[-10px]"), 10);
      }
      isMenuOpen = !isMenuOpen;
  }

  mobileMenuButton.addEventListener("click", () => {
      toggleMobileMenu();
  });

  /** 
   * 🔵 Close Mobile Menu on Click Outside  
   */
  document.addEventListener("click", (event) => {
      if (isMenuOpen && !mobileMenu.contains(event.target) && !mobileMenuButton.contains(event.target)) {
          toggleMobileMenu();
      }
  });

  /** 
   * 🔴 Close Menu on Escape Key  
   */
  document.addEventListener("keydown", (event) => {
      if (isMenuOpen && event.key === "Escape") {
          toggleMobileMenu();
      }
  });
});
