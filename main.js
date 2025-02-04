document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const header = document.getElementById('main-header');
    const announcementBar = document.getElementById('announcement-bar');
    const menuToggle = document.getElementById('menu-toggle');
    const menuContent = document.getElementById('menu-content');
    const menuIcon = menuToggle.querySelector('.menu-icon');
    const closeIcon = menuToggle.querySelector('.close-icon');
    const sectionButtons = document.querySelectorAll('.section-button');
    
    // State
    let lastScroll = 0;
    let isMenuOpen = false;

    // Scroll Handler
    function handleScroll() {
        const currentScroll = window.pageYOffset;
        
        // Handle header visibility
        if (currentScroll > lastScroll && currentScroll > 50) {
            header.classList.add('header-hidden');
        } else {
            header.classList.remove('header-hidden');
        }
        
        // Handle announcement bar
        if (currentScroll > 100) {
            announcementBar.classList.add('hidden');
        } else {
            announcementBar.classList.remove('hidden');
        }
        
        // Update nav padding
        if (currentScroll > 50) {
            header.querySelector('.nav-container').style.paddingTop = '0.5rem';
        } else {
            header.querySelector('.nav-container').style.paddingTop = '1rem';
        }
        
        lastScroll = currentScroll;
    }

    // Toggle Menu
    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
        
        if (isMenuOpen) {
            menuContent.classList.add('active');
            menuIcon.classList.add('hidden');
            closeIcon.classList.remove('hidden');
        } else {
            menuContent.classList.remove('active');
            menuIcon.classList.remove('hidden');
            closeIcon.classList.add('hidden');
        }
    }

    // Section Toggle
    function toggleSection(event) {
        const button = event.currentTarget;
        const sectionId = button.getAttribute('data-section');
        const content = document.getElementById(`${sectionId}-content`);
        const icon = button.querySelector('i');
        
        // Check if this section is already active
        const isActive = content.classList.contains('active');
        
        // Close all sections first
        document.querySelectorAll('.section-content').forEach(section => {
            section.classList.remove('active');
        });
        document.querySelectorAll('.section-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.section-button i').forEach(icon => {
            icon.style.transform = 'rotate(0deg)';
        });
        
        // Toggle the clicked section
        if (!isActive) {
            content.classList.add('active');
            button.classList.add('active');
            icon.style.transform = 'rotate(90deg)';
        }
    }

    // Project Hover Effects
    function setupProjectHoverEffects() {
        const projects = document.querySelectorAll('.project-item');
        
        projects.forEach(project => {
            project.addEventListener('mouseenter', () => {
                const link = project.querySelector('.project-external-link');
                if (link) link.style.opacity = '1';
            });
            
            project.addEventListener('mouseleave', () => {
                const link = project.querySelector('.project-external-link');
                if (link) link.style.opacity = '0.9';
            });
        });
    }

    // Contact Button Animation
    function setupContactButton() {
        const contactBtn = document.querySelector('.contact-floating-button');
        
        contactBtn.addEventListener('mouseenter', () => {
            const icon = contactBtn.querySelector('i');
            icon.style.transform = 'scale(1.1)';
        });
        
        contactBtn.addEventListener('mouseleave', () => {
            const icon = contactBtn.querySelector('i');
            icon.style.transform = 'scale(1)';
        });
        
        // Handle contact button click
        contactBtn.addEventListener('click', () => {
            // You can customize this to open a contact form or mailto link
            window.location.href = 'mailto:contact@example.com';
        });
    }

    // Smooth Scroll for Navigation
    function setupSmoothScroll() {
        const links = document.querySelectorAll('a[href^="#"]');
        
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    // Close menu if open
                    if (isMenuOpen) {
                        toggleMenu();
                    }
                }
            });
        });
    }

    // Download CV Handler
    function setupDownloadCV() {
        const downloadBtn = document.querySelector('.download-btn');
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                // Replace with actual CV download link
                const cvUrl = 'path/to/your/cv.pdf';
                const link = document.createElement('a');
                link.href = cvUrl;
                link.download = 'JohnDoe_CV.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    }

    // Section Intersection Observer
    function setupSectionObserver() {
        const sections = document.querySelectorAll('section');
        const observerOptions = {
            threshold: 0.2,
            rootMargin: '-20% 0px -20% 0px'
        };

        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('section-visible');
                }
            });
        }, observerOptions);

        sections.forEach(section => {
            sectionObserver.observe(section);
            section.classList.add('section-animate');
        });
    }

    // Initialize all event listeners
    function init() {
        // Scroll handling
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Menu toggle
        menuToggle.addEventListener('click', toggleMenu);
        
        // Section toggles
        sectionButtons.forEach(button => {
            button.addEventListener('click', toggleSection);
        });
        
        // Setup all other interactions
        setupProjectHoverEffects();
        setupContactButton();
        setupSmoothScroll();
        setupDownloadCV();
        setupSectionObserver();
        
        // Handle click outside menu to close
        document.addEventListener('click', (event) => {
            const isClickInsideMenu = menuContent.contains(event.target) || 
                                    menuToggle.contains(event.target);
            
            if (isMenuOpen && !isClickInsideMenu) {
                toggleMenu();
            }
        });
        
        // Handle escape key to close menu
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && isMenuOpen) {
                toggleMenu();
            }
        });
    }

    // Initialize everything
    init();
});
