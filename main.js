document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements with error checking
    const elements = {
        header: document.getElementById('main-header'),
        announcement: document.getElementById('announcement-bar'),
        menuToggle: document.getElementById('menu-toggle'),
        menuContent: document.getElementById('menu-content'),
        menuIcon: document.querySelector('.menu-icon'),
        closeIcon: document.querySelector('.close-icon'),
        sections: document.querySelectorAll('.section-button'),
        projects: document.querySelectorAll('.project-item'),
        contactBtn: document.querySelector('.contact-floating-button')
    };

    // State Management
    const state = {
        lastScroll: 0,
        isMenuOpen: false,
        isScrolling: false,
        scrollTimeout: null,
        activeSection: null
    };

    // Enhanced Scroll Handler with Throttling
    function handleScroll() {
        if (state.isScrolling) return;
        state.isScrolling = true;

        requestAnimationFrame(() => {
            const currentScroll = window.pageYOffset;
            const scrollingDown = currentScroll > state.lastScroll;
            
            // Header Visibility with Smooth Transition
            if (currentScroll > 100) {
                if (scrollingDown) {
                    elements.header.style.transform = 'translateY(-100%)';
                } else {
                    elements.header.style.transform = 'translateY(0)';
                }
            } else {
                elements.header.style.transform = 'translateY(0)';
            }

            // Announcement Bar with Fade Effect
            elements.announcement.style.opacity = Math.max(0, 1 - (currentScroll / 100));
            if (currentScroll > 100) {
                elements.announcement.style.height = '0px';
            } else {
                elements.announcement.style.height = '40px';
            }

            // Dynamic Navigation Styling
            const navContainer = elements.header.querySelector('.nav-container');
            const scrollProgress = Math.min(currentScroll / 100, 1);
            navContainer.style.padding = `${0.75 - (scrollProgress * 0.25)}rem ${1.5 - (scrollProgress * 0.5)}rem`;
            
            state.lastScroll = currentScroll;
            state.isScrolling = false;
        });
    }

    // Enhanced Menu Toggle with Animations
    function toggleMenu(forceClose = false) {
        state.isMenuOpen = forceClose ? false : !state.isMenuOpen;
        
        // Toggle Menu Classes
        elements.menuContent.classList.toggle('active', state.isMenuOpen);
        document.body.style.overflow = state.isMenuOpen ? 'hidden' : '';
        
        // Animate Icons
        elements.menuIcon.style.transform = state.isMenuOpen ? 'rotate(-180deg)' : 'rotate(0)';
        elements.closeIcon.style.transform = state.isMenuOpen ? 'rotate(0)' : 'rotate(180deg)';
        elements.menuIcon.style.opacity = state.isMenuOpen ? '0' : '1';
        elements.closeIcon.style.opacity = state.isMenuOpen ? '1' : '0';
        
        // Add backdrop blur to main content
        document.querySelector('main').style.filter = state.isMenuOpen ? 'blur(5px)' : 'none';
        
        // Animate menu items
        const menuItems = elements.menuContent.querySelectorAll('.section-button, .project-card, .contact-btn, .download-btn');
        menuItems.forEach((item, index) => {
            item.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            item.style.transitionDelay = state.isMenuOpen ? `${index * 0.05}s` : '0s';
            item.style.transform = state.isMenuOpen ? 'translateX(0)' : 'translateX(20px)';
            item.style.opacity = state.isMenuOpen ? '1' : '0';
        });
    }

    // Enhanced Section Toggle with Smooth Animations
    function toggleSection(event) {
        const button = event.currentTarget;
        const sectionId = button.getAttribute('data-section');
        const content = document.getElementById(`${sectionId}-content`);
        const icon = button.querySelector('i');
        
        if (state.activeSection === sectionId) {
            // Close section
            content.style.maxHeight = '0px';
            button.classList.remove('active');
            icon.style.transform = 'rotate(0deg)';
            state.activeSection = null;
        } else {
            // Close previous section
            if (state.activeSection) {
                const prevContent = document.getElementById(`${state.activeSection}-content`);
                const prevButton = document.querySelector(`[data-section="${state.activeSection}"]`);
                prevContent.style.maxHeight = '0px';
                prevButton.classList.remove('active');
                prevButton.querySelector('i').style.transform = 'rotate(0deg)';
            }
            
            // Open new section
            content.style.maxHeight = `${content.scrollHeight}px`;
            button.classList.add('active');
            icon.style.transform = 'rotate(90deg)';
            state.activeSection = sectionId;
        }
    }

    // Enhanced Project Interactions
    function setupProjectInteractions() {
        elements.projects.forEach(project => {
            const link = project.querySelector('.project-external-link');
            const img = project.querySelector('img');
            
            project.addEventListener('mouseenter', () => {
                link.style.transform = 'translate(-5px, -5px)';
                img.style.transform = 'scale(1.05)';
            });
            
            project.addEventListener('mouseleave', () => {
                link.style.transform = 'translate(0, 0)';
                img.style.transform = 'scale(1)';
            });

            // Add click ripple effect
            project.addEventListener('click', (e) => {
                const ripple = document.createElement('div');
                ripple.classList.add('ripple');
                const rect = project.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${e.clientX - rect.left - size/2}px`;
                ripple.style.top = `${e.clientY - rect.top - size/2}px`;
                project.appendChild(ripple);
                setTimeout(() => ripple.remove(), 1000);
            });
        });
    }

    // Enhanced Contact Button
    function setupContactButton() {
        if (!elements.contactBtn) return;
        
        let pulseTimeout;
        elements.contactBtn.addEventListener('mouseenter', () => {
            clearTimeout(pulseTimeout);
            elements.contactBtn.classList.add('pulse');
        });
        
        elements.contactBtn.addEventListener('mouseleave', () => {
            pulseTimeout = setTimeout(() => {
                elements.contactBtn.classList.remove('pulse');
            }, 200);
        });
        
        elements.contactBtn.addEventListener('click', () => {
            // Create and animate contact form modal
            showContactModal();
        });
    }

    // Contact Modal
    function showContactModal() {
        const modal = document.createElement('div');
        modal.className = 'contact-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="close-modal">&times;</button>
                <h2>Get in Touch</h2>
                <form id="contact-form">
                    <input type="text" placeholder="Name" required>
                    <input type="email" placeholder="Email" required>
                    <textarea placeholder="Message" required></textarea>
                    <button type="submit">Send Message</button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        });
    }

    // Initialize all event listeners and features
    function init() {
        // Scroll handling with debounce
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(handleScroll, 10);
        }, { passive: true });
        
        // Menu toggle
        elements.menuToggle.addEventListener('click', () => toggleMenu());
        
        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.isMenuOpen) toggleMenu(true);
        });
        
        // Close menu on outside click
        document.addEventListener('click', (e) => {
            if (state.isMenuOpen && 
                !elements.menuContent.contains(e.target) && 
                !elements.menuToggle.contains(e.target)) {
                toggleMenu(true);
            }
        });
        
        // Section toggles
        elements.sections.forEach(button => {
            button.addEventListener('click', toggleSection);
        });
        
        // Setup other interactions
        setupProjectInteractions();
        setupContactButton();
        
        // Initial scroll position check
        handleScroll();
    }

    // Initialize everything
    init();
});
