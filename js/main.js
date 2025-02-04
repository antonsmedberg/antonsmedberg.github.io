document.addEventListener('DOMContentLoaded', () => {
    // Utility Functions
    const select = selector => document.querySelector(selector);
    const selectAll = selector => document.querySelectorAll(selector);

    // Elements
    const navbar = select('.navbar-container');
    const mobileMenuToggle = select('.mobile-menu-toggle');
    const navbarMenu = select('.navbar-menu');
    const navLinks = selectAll('.nav-link');
    const sections = selectAll('section');
    const skillBars = selectAll('.skill-fill');

    // Scroll Variables
    let lastScroll = 0;
    let ticking = false;

    // Handle Scroll
    const handleScroll = () => {
        const currentScroll = window.scrollY;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                // Add scrolled class when page is scrolled
                if (currentScroll > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }

                // Update active section in navigation
                let currentSection = '';
                sections.forEach(section => {
                    const sectionTop = section.offsetTop - 100;
                    const sectionHeight = section.offsetHeight;
                    
                    if (currentScroll >= sectionTop && currentScroll < sectionTop + sectionHeight) {
                        currentSection = section.getAttribute('id');
                        section.classList.add('in-view');
                    }
                });

                // Update active nav link
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').slice(1) === currentSection) {
                        link.classList.add('active');
                    }
                });

                lastScroll = currentScroll;
                ticking = false;
            });

            ticking = true;
        }
    };

    // Mobile Menu Toggle
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            mobileMenuToggle.classList.toggle('active');
            navbarMenu.classList.toggle('active');
            document.body.classList.toggle('menu-open');
        });

        // Close mobile menu when clicking on a link
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuToggle.classList.remove('active');
                navbarMenu.classList.remove('active');
                document.body.classList.remove('menu-open');
            });
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.navbar-menu') && 
                !e.target.closest('.mobile-menu-toggle') && 
                navbarMenu.classList.contains('active')) {
                mobileMenuToggle.classList.remove('active');
                navbarMenu.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    }

    // Smooth Scroll
    const smoothScroll = (target, duration = 1000) => {
        const targetPosition = target.getBoundingClientRect().top + window.scrollY;
        const startPosition = window.scrollY;
        const distance = targetPosition - startPosition - 80; // Offset for fixed header
        let startTime = null;

        const animation = currentTime => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // Easing function
            const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            
            window.scrollTo(0, startPosition + distance * ease(progress));

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        };

        requestAnimationFrame(animation);
    };

    // Smooth scroll event listeners
    selectAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            e.preventDefault();
            const targetId = anchor.getAttribute('href');
            const targetSection = select(targetId);
            
            if (targetSection) {
                smoothScroll(targetSection);
            }
        });
    });

    // Intersection Observer for animations
    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                
                // Animate skill bars if in skills section
                if (entry.target.id === 'skills') {
                    skillBars.forEach(bar => {
                        const parentWidth = bar.parentElement.offsetWidth;
                        const targetWidth = bar.dataset.width || bar.style.width;
                        bar.style.width = '0';
                        
                        setTimeout(() => {
                            bar.style.width = targetWidth;
                        }, 100);
                    });
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

    // Contact Form Handling
    const contactForm = select('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                
                // Simulate form submission (replace with your actual form handling)
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Show success message
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
        
        // Animate notification
        setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.add('hide');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }, 100);
    };

    // Initialize
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    // Add loading complete class to body
    document.body.classList.add('loaded');
});
