document.addEventListener('DOMContentLoaded', () => {
    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    // Hamburger Menu Toggle
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close mobile menu when a nav link is clicked
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Smooth Scrolling for Navigation Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Smooth scroll with offset for fixed navbar
                const offset = document.querySelector('.navbar').offsetHeight;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Active Navigation Highlighting on Scroll
    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            const navbarHeight = document.querySelector('.navbar').offsetHeight;

            if (window.scrollY >= sectionTop - navbarHeight) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').substring(1) === current) {
                link.classList.add('active');
            }
        });
    });

    // Form Submission Handler (client-side validation)
    const contactForm = document.querySelector('.contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Basic form validation
            const nameInput = this.querySelector('input[type="text"]');
            const emailInput = this.querySelector('input[type="email"]');
            const messageInput = this.querySelector('textarea');

            // Simple validation checks
            if (!nameInput.value.trim()) {
                alert('Please enter your name');
                nameInput.focus();
                return;
            }

            if (!emailInput.value.trim() || !isValidEmail(emailInput.value)) {
                alert('Please enter a valid email address');
                emailInput.focus();
                return;
            }

            if (!messageInput.value.trim()) {
                alert('Please enter your message');
                messageInput.focus();
                return;
            }

            // In a real-world scenario, you would send this to a backend
            alert('Message sent successfully! (Note: This is a demo, no actual sending occurs)');
            this.reset();
        });
    }

    // Email validation helper function
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Typing Effect for Home Title (Optional)
    const typingElement = document.querySelector('.home-content h1');
    if (typingElement) {
        const text = typingElement.textContent;
        typingElement.textContent = '';

        let index = 0;
        function typeWriter() {
            if (index < text.length) {
                typingElement.textContent += text.charAt(index);
                index++;
                setTimeout(typeWriter, 100);
            }
        }

        typeWriter();
    }

    // Project Hover Effects (Optional Enhancement)
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'scale(1.05)';
            card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        });
    });
});

// Optional: Dark Mode Toggle (can be expanded)
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}
