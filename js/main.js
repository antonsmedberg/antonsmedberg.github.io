document.addEventListener("DOMContentLoaded", function () {
    const menuToggle = document.getElementById("menuToggle");
    const menuContent = document.getElementById("menuContent");
    const header = document.getElementById("header");
    const announcement = document.getElementById("announcement");
    const menuLinks = menuContent.querySelectorAll('a');

    let lastScrollY = window.scrollY;
    let isMenuOpen = false;

    // Toggle menu visibility with smooth transition
    menuToggle.addEventListener("click", function () {
        isMenuOpen = !isMenuOpen;
        menuContent.classList.toggle('active');
        menuToggle.setAttribute('aria-expanded', isMenuOpen);
        
        // Prevent body scrolling when menu is open
        document.body.style.overflow = isMenuOpen ? 'hidden' : 'auto';
    });

    // Close menu when a link is clicked
    menuLinks.forEach(link => {
        link.addEventListener('click', () => {
            menuContent.classList.remove('active');
            isMenuOpen = false;
            menuToggle.setAttribute('aria-expanded', false);
            document.body.style.overflow = 'auto';
        });
    });

    // Smooth scrolling for navigation links
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Dynamic header and announcement visibility on scroll
    window.addEventListener("scroll", function () {
        const currentScrollY = window.scrollY;
        const scrollThreshold = 50;

        if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold) {
            header.style.transform = "translateY(-100%)";
            announcement.style.opacity = "0";
        } else {
            header.style.transform = "translateY(0)";
            announcement.style.opacity = "1";
        }

        lastScrollY = currentScrollY;
    });

    // Typing effect for hero section
    const heroTitle = document.querySelector('.hero-content h2');
    const heroSubtitle = document.querySelector('.hero-content p');
    
    function typeWriter(element, text, speed = 50) {
        element.textContent = '';
        let i = 0;
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    if (heroTitle && heroSubtitle) {
        typeWriter(heroTitle, heroTitle.textContent);
        setTimeout(() => {
            typeWriter(heroSubtitle, heroSubtitle.textContent, 30);
        }, 1000);
    }

    // Project hover effect
    const projects = document.querySelectorAll('.project');
    projects.forEach(project => {
        project.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
        });

        project.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        });
    });
});
