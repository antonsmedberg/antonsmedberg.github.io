document.addEventListener('DOMContentLoaded', () => {
    // Utility functions
    const select = selector => document.querySelector(selector);
    const selectAll = selector => document.querySelectorAll(selector);

    // Elements
    const header = select('.header');
    const menuToggle = select('.menu-toggle');
    const navLinks = select('.nav-links');
    const skillBars = selectAll('.skill-level');
    const contactForm = select('.contact-form');
    
    // Handle scroll
    const handleScroll = () => {
        const scrolled = window.scrollY > 50;
        header.classList.toggle('scrolled', scrolled);
        
        // Update active section
        document.querySelectorAll('section').forEach(section => {
            if (section.getBoundingClientRect().top <= 100) {
                const id = section.getAttribute('id');
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            }
        });
    };

    // Mobile menu toggle
    menuToggle?.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            e.preventDefault();
            navLinks.classList.remove('active');
            document.body.classList.remove('menu-open');

            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Animate skill bars
    const animateSkills = () => {
        skillBars.forEach(bar => {
            const level = bar.getAttribute('data-level');
            bar.style.width = `${level}%`;
        });
    };

    // Initialize skill animations when in view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateSkills();
                observer.unobserve(entry.target);
            }
        });
    });

    select('#skills')?.forEach(section => observer.observe(section));

    // Handle contact form
    contactForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = contactForm.querySelector('button');
        const formData = new FormData(contactForm);
        
        try {
            submitBtn.disabled = true;
            const response = await fetch(contactForm.action, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                contactForm.reset();
                showNotification('Message sent successfully!');
            } else {
                throw new Error('Failed to send message');
            }
        } catch (error) {
            showNotification('Failed to send message. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Show notification
    const showNotification = (message, type = 'success') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    };

    // Set copyright year
    const yearEl = select('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Initialize
    window.addEventListener('scroll', handleScroll);
    handleScroll();
});
