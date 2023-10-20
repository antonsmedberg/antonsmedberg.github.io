document.addEventListener("DOMContentLoaded", function() {
    
    const navbar = document.querySelector('.navbar');
    const navbarCollapse = document.querySelector('.collapse');
    const fadeElements = document.querySelectorAll('.fade-in');

    // Debounce function to optimize scroll events
    function debounce(func, wait, immediate) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    function handleNavbarChangeOnScroll() {
        let scrolled = window.scrollY;
        if (scrolled > 100) { 
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    navbarCollapse.addEventListener('show.bs.collapse', function() {
        window.removeEventListener('scroll', handleNavbarChangeOnScroll);
    });

    navbarCollapse.addEventListener('hidden.bs.collapse', function() {
        window.addEventListener('scroll', handleNavbarChangeOnScroll);
    });

    window.addEventListener('scroll', debounce(handleNavbarChangeOnScroll, 20));

    function fadeInOnScroll() {
        let windowBottom = window.scrollY + window.innerHeight;
        fadeElements.forEach((element, index) => {
            let elementBottom = element.offsetTop + element.offsetHeight;
            if (elementBottom < windowBottom) {
                setTimeout(() => {
                    element.classList.add('visible');
                }, index * 50);
            }
        });
    }

    window.addEventListener('scroll', debounce(fadeInOnScroll, 20));
});