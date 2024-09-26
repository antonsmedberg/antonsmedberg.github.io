// main.js

document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    const header = document.querySelector('header');
    const navHeight = header.offsetHeight;

    window.addEventListener('scroll', () => {
        if (window.scrollY > navHeight) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            navLinks.classList.remove('active');

            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Typing effect for hero subtitle
    const subtitleElement = document.querySelector('.hero .subtitle');
    const subtitleText = subtitleElement.textContent;
    subtitleElement.textContent = '';
    subtitleElement.classList.add('typing');

    let i = 0;
    function typeWriter() {
        if (i < subtitleText.length) {
            subtitleElement.textContent += subtitleText.charAt(i);
            i++;
            setTimeout(typeWriter, 50);
        }
    }
    typeWriter();

    // Animate skill levels
    const skillLevels = document.querySelectorAll('.skill-level');
    const animateSkills = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.width = entry.target.getAttribute('data-level') + '%';
                observer.unobserve(entry.target);
            }
        });
    };

    const skillObserver = new IntersectionObserver(animateSkills, {
        threshold: 0.5
    });

    skillLevels.forEach(skill => {
        skillObserver.observe(skill);
    });

    // Animate sections on scroll
    const sections = document.querySelectorAll('section');
    const animateSections = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    };

    const sectionObserver = new IntersectionObserver(animateSections, {
        threshold: 0.1
    });

    sections.forEach(section => {
        sectionObserver.observe(section);
    });

    // Form submission handling
    const form = document.querySelector('.contact-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const response = await fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            form.reset();
            alert('Thanks for your message! I\'ll get back to you soon.');
        } else {
            alert('Oops! There was a problem submitting your form. Please try again.');
        }
    });

    // Dynamic copyright year
    const currentYear = new Date().getFullYear();
    document.querySelector('footer p').textContent = `© ${currentYear} Anton Smedberg. All Rights Reserved.`;

    // Project filter functionality
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.getAttribute('data-filter');
            
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            projectCards.forEach(card => {
                if (filter === 'all' || card.classList.contains(filter)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // Lazy loading for project images
    const projectImages = document.querySelectorAll('.project-image');
    const lazyLoadImages = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.getAttribute('data-src');
                img.style.backgroundImage = `url(${src})`;
                observer.unobserve(img);
            }
        });
    };

    const imageObserver = new IntersectionObserver(lazyLoadImages, {
        threshold: 0.1
    });

    projectImages.forEach(img => {
        imageObserver.observe(img);
    });
});
