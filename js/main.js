document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const select = selector => document.querySelector(selector);
    const selectAll = selector => document.querySelectorAll(selector);

    // Elements
    const header = select('.header');
    const menuToggle = select('.menu-toggle');
    const navLinks = select('.nav-links');
    const sections = selectAll('section');
    const skillBars = selectAll('.skill-progress');
    const themeToggle = select('#theme-toggle');

    // Scroll Handler
    const handleScroll = () => {
        // Header scroll effect
        const scrolled = window.scrollY > 50;
        header.classList.toggle('scrolled', scrolled);

        // Update active section in navigation
        let currentSection = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            if (window.scrollY >= sectionTop) {
                currentSection = section.getAttribute('id');
            }
        });

        // Update active nav link
        selectAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href').substring(1);
            link.classList.toggle('active', href === currentSection);
        });
    };

    // Mobile Menu
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuToggle.classList.toggle('active');
            document.body.classList.toggle('menu-open');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-links') && 
                !e.target.closest('.menu-toggle') && 
                navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    }

    // Theme Toggle
    if (themeToggle) {
        const body = document.body;

        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            
            // Update theme toggle icon
            const currentIcon = themeToggle.querySelector('svg');
            currentIcon.setAttribute('data-feather', body.classList.contains('dark-mode') ? 'sun' : 'moon');
            feather.replace();
        });
    }

    // Smooth Scroll
    selectAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            e.preventDefault();
            const target = select(anchor.getAttribute('href'));
            
            if (target) {
                // Close mobile menu if open
                navLinks.classList.remove('active');
                menuToggle?.classList.remove('active');
                document.body.classList.remove('menu-open');

                // Smooth scroll to target
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Animate skill bars when in view
    const animateSkills = () => {
        skillBars.forEach(bar => {
            const level = bar.getAttribute('data-level');
            bar.style.width = `${level}%`;
        });
    };

    // Intersection Observer for animations
    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                
                // Animate skill bars if skills section
                if (entry.target.id === 'skills') {
                    setTimeout(animateSkills, 300);
                }
                
                observer.unobserve(entry.target);
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, {
        threshold: 0.2
    });

    // Observe sections for animation
    sections.forEach(section => observer.observe(section));

    // Contact Form
    const contactForm = select('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                
                // Simulate form submission (replace with your actual endpoint)
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Success
                showNotification('Message sent successfully!', 'success');
                contactForm.reset();
            } catch (error) {
                showNotification('Failed to send message. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // Notification System
    const showNotification = (message, type = 'success') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.add('hide');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }, 100);
    };

    // Initialize
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    
    // Update copyright year
    const yearEl = select('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
});
