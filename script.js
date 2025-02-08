document.addEventListener("DOMContentLoaded", function () {
    const navbar = document.getElementById("navbar");
    const navbarContainer = document.getElementById("navbar-container");
    const mobileMenuButton = document.getElementById("mobile-menu-button");
    const mobileMenu = document.getElementById("mobile-menu");

    let isMenuOpen = false;
    let lastScrollY = window.scrollY;
    let navbarVisible = true;
    let isScrolling = false;

    /**
     * 🟣 Smooth Hide & Show Navbar on Scroll (Prevents Flickering)
     */
    function handleNavbarScroll() {
        const currentScroll = window.scrollY;
        const scrollThreshold = 80; // Trigger after 80px scroll

        if (currentScroll > lastScrollY && currentScroll > scrollThreshold && navbarVisible) {
            navbar.classList.add("navbar-hidden");
            navbar.classList.remove("navbar-visible");
            navbarVisible = false;
        } else if (currentScroll < lastScrollY && !navbarVisible) {
            navbar.classList.add("navbar-visible");
            navbar.classList.remove("navbar-hidden");
            navbarVisible = true;
        }

        lastScrollY = currentScroll;
    }

    /**
     * 🟢 Navbar Shrink Effect on Scroll (Fixes Blur Issue)
     */
    function adjustNavbarSize() {
        const isScrolled = window.scrollY > 50;

        navbarContainer.classList.toggle("max-w-3xl", isScrolled);
        navbarContainer.classList.toggle("px-5", isScrolled);
        navbarContainer.classList.toggle("py-2", isScrolled);
        navbarContainer.classList.toggle("shadow-md", isScrolled);
        navbarContainer.classList.toggle("scale-95", isScrolled);

        // ✅ Fixes blur issue by ensuring backdrop blur is only applied in normal state
        navbarContainer.classList.toggle("backdrop-blur-md", !isScrolled);
        navbarContainer.classList.toggle("max-w-4xl", !isScrolled);
        navbarContainer.classList.toggle("px-6", !isScrolled);
        navbarContainer.classList.toggle("py-3", !isScrolled);
    }

    /**
     * 🟡 Optimized Scroll Event (Throttle for High Performance)
     */
    function handleScroll() {
        if (isScrolling) return;
        isScrolling = true;

        requestAnimationFrame(() => {
            handleNavbarScroll();
            adjustNavbarSize();
            isScrolling = false;
        });
    }

    window.addEventListener("scroll", handleScroll);
    adjustNavbarSize(); // Ensure correct navbar size on load

    /**
     * 🟠 Mobile Menu - Open/Close with Smooth Animation
     */
    function toggleMobileMenu() {
        isMenuOpen = !isMenuOpen;

        mobileMenu.classList.toggle("hidden", !isMenuOpen);
        mobileMenu.classList.toggle("opacity-0", !isMenuOpen);
        mobileMenu.classList.toggle("translate-y-[-10px]", !isMenuOpen);
    }

    mobileMenuButton?.addEventListener("click", toggleMobileMenu);

    /**
     * 🔵 Close Mobile Menu on Click Outside
     */
    document.addEventListener("click", (event) => {
        if (
            isMenuOpen &&
            !mobileMenu.contains(event.target) &&
            !mobileMenuButton.contains(event.target)
        ) {
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
