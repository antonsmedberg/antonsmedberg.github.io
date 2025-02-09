/**
 * Portfolio Navigation and Mobile Menu Controller
 * @author Anton Smedberg
 * @version 1.0.0
 */

class NavigationController {
    constructor() {
        // DOM Elements
        this.elements = {
            navbar: document.getElementById("navbar"),
            navbarContainer: document.getElementById("navbar-container"),
            mobileMenuButton: document.getElementById("mobile-menu-button"),
            mobileMenu: document.getElementById("mobile-menu")
        };

        // State Management
        this.state = {
            isMenuOpen: false,
            lastScrollY: window.scrollY,
            navbarVisible: true,
            isScrolling: false
        };

        // Constants
        this.SCROLL_THRESHOLD = 80;
        this.SCROLL_SHRINK_THRESHOLD = 50;
        this.NAVBAR_CLASSES = {
            scrolled: ["max-w-3xl", "px-5", "py-2", "shadow-md", "scale-95"],
            default: ["max-w-4xl", "px-6", "py-3"]
        };

        this.init();
    }

    /**
     * Initialize all event listeners and initial state
     * @private
     */
    init() {
        // Verify all required elements exist
        if (!this.validateElements()) {
            console.error("Required DOM elements not found. Navigation initialization failed.");
            return;
        }

        this.bindEvents();
        this.adjustNavbarSize();
    }

    /**
     * Validate all required DOM elements exist
     * @private
     * @returns {boolean}
     */
    validateElements() {
        return Object.values(this.elements).every(element => element !== null);
    }

    /**
     * Bind all event listeners
     * @private
     */
    bindEvents() {
        // Scroll handling
        window.addEventListener("scroll", this.handleScroll.bind(this));

        // Mobile menu
        this.elements.mobileMenuButton?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleMobileMenu();
        });

        // Close menu on outside click
        document.addEventListener("click", this.handleOutsideClick.bind(this));

        // Keyboard navigation
        document.addEventListener("keydown", this.handleKeyPress.bind(this));

        // Menu item clicks
        this.elements.mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (this.state.isMenuOpen) this.toggleMobileMenu();
            });
        });
    }

    /**
     * Handle scroll events with throttling
     * @private
     */
    handleScroll() {
        if (this.state.isScrolling) return;
        this.state.isScrolling = true;

        requestAnimationFrame(() => {
            this.updateNavbarVisibility();
            this.adjustNavbarSize();
            this.state.isScrolling = false;
        });
    }

    /**
     * Update navbar visibility based on scroll direction
     * @private
     */
    updateNavbarVisibility() {
        const currentScroll = window.scrollY;

        if (currentScroll > this.state.lastScrollY && 
            currentScroll > this.SCROLL_THRESHOLD && 
            this.state.navbarVisible) {
            this.hideNavbar();
        } else if (currentScroll < this.state.lastScrollY && !this.state.navbarVisible) {
            this.showNavbar();
        }

        this.state.lastScrollY = currentScroll;
    }

    /**
     * Hide navbar with animation
     * @private
     */
    hideNavbar() {
        this.elements.navbar.classList.add("navbar-hidden");
        this.elements.navbar.classList.remove("navbar-visible");
        this.state.navbarVisible = false;
    }

    /**
     * Show navbar with animation
     * @private
     */
    showNavbar() {
        this.elements.navbar.classList.add("navbar-visible");
        this.elements.navbar.classList.remove("navbar-hidden");
        this.state.navbarVisible = true;
    }

    /**
     * Adjust navbar size based on scroll position
     * @private
     */
    adjustNavbarSize() {
        const isScrolled = window.scrollY > this.SCROLL_SHRINK_THRESHOLD;
        const { scrolled, default: defaultClasses } = this.NAVBAR_CLASSES;

        scrolled.forEach(className => {
            this.elements.navbarContainer.classList.toggle(className, isScrolled);
        });

        defaultClasses.forEach(className => {
            this.elements.navbarContainer.classList.toggle(className, !isScrolled);
        });
    }

    /**
     * Toggle mobile menu state
     * @private
     */
    toggleMobileMenu() {
        this.state.isMenuOpen = !this.state.isMenuOpen;
        
        this.elements.mobileMenuButton.setAttribute('aria-expanded', this.state.isMenuOpen);
        this.elements.mobileMenu.classList.toggle('active');
        
        this.updateMenuIcon();
    }

    /**
     * Update mobile menu icon
     * @private
     */
    updateMenuIcon() {
        const menuIcon = this.elements.mobileMenuButton.querySelector('i');
        menuIcon.setAttribute('data-lucide', this.state.isMenuOpen ? 'x' : 'menu');
        lucide.createIcons();
    }

    /**
     * Handle clicks outside mobile menu
     * @private
     * @param {Event} event
     */
    handleOutsideClick(event) {
        if (
            this.state.isMenuOpen &&
            !this.elements.mobileMenu.contains(event.target) &&
            !this.elements.mobileMenuButton.contains(event.target)
        ) {
            this.toggleMobileMenu();
        }
    }

    /**
     * Handle keyboard events
     * @private
     * @param {KeyboardEvent} event
     */
    handleKeyPress(event) {
        if (event.key === "Escape" && this.state.isMenuOpen) {
            this.toggleMobileMenu();
        }
    }
}

// Initialize navigation when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    new NavigationController();
});