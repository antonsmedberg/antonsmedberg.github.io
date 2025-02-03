document.addEventListener('DOMContentLoaded', () => {
    // Utility Functions
    const select = selector => document.querySelector(selector);
    const selectAll = selector => document.querySelectorAll(selector);

    // Elements
    const navbar = select('.navbar-container');
    const sections = selectAll('section');
    const navLinks = selectAll('.navbar-nav a');

    // Scroll Handler with Improved Performance
    let lastScroll = 0;
    let ticking = false;

    const handleScroll = () => {
        const currentScroll = window.scrollY;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                // Navbar Transform
                if (currentScroll > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }

                // Update active section
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
                if (currentSection) {
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${currentSection}`) {
                            link.classList.add('active');
                        }
                    });
                }

                lastScroll = currentScroll;
                ticking = false;
            });

            ticking = true;
        }
    };

    // Intersection Observer for Animations
    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                observer.unobserve(entry.target);
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, {
        threshold: 0.2
    });

    // Observe all sections for animation
    sections.forEach(section => observer.observe(section));

    // Smooth Scroll with Enhanced UX
    const smoothScroll = (target, duration = 1000) => {
        const targetPosition = target.getBoundingClientRect().top + window.scrollY;
        const startPosition = window.scrollY;
        const distance = targetPosition - startPosition;
        let startTime = null;

        const animation = currentTime => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // Easing function for smooth acceleration and deceleration
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
            const target = select(anchor.getAttribute('href'));
            
            if (target) {
                smoothScroll(target);
            }
        });
    });

    // Initialize scroll handler
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    // Add loading animation to page
    document.body.classList.add('loaded');

    // Optional: Add parallax effect to hero section
    const hero = select('.hero');
    if (hero) {
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrolled = window.scrollY;
                    hero.style.transform = `translateY(${scrolled * 0.5}px)`;
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }
});
