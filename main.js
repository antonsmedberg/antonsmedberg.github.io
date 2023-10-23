// Wrap your code in an IIFE to avoid polluting the global scope
(function() {
    document.addEventListener("DOMContentLoaded", function() {

        const navbar = document.querySelector('.navbar');
        const navbarCollapse = document.querySelector('.collapse');
        const fadeElements = document.querySelectorAll('.fade-in');

        const textToType = "Welcome to My Portfolio";
        const outputContainer = document.getElementById('typed-output');
        const cursorSpan = document.createElement('span');
        cursorSpan.classList.add('cursor');
        outputContainer.appendChild(cursorSpan);
        let index = 0;

       
        function typeCharacter() {
            if(index < textToType.length) {
                outputContainer.textContent = textToType.substring(0, index + 1);
                index++;
                setTimeout(typeCharacter, 100);  // Set typing speed (100ms between characters in this case)
            } else {
                blinkCursor();  // Start blinking cursor animation after typing
            }
        }
        
        function blinkCursor() {
            let blink = true;
            setInterval(function() {
                cursorSpan.style.visibility = blink ? 'visible' : 'hidden';
                blink = !blink;
            }, 500);  // Set cursor blink speed (500ms in this case)
        }

        typeCharacter();  // Start typing
        

        let observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if(entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);  // Stop observing this element
                }
            });
        }, { threshold: 0.5 });  // Configure observer to trigger when element is 50% visible

        fadeElements.forEach(element => {
            observer.observe(element);  // Start observing each element
        });

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

        window.addEventListener('scroll', handleNavbarChangeOnScroll);  // No need for debounce with one-off check

    });

    // Moved the script inside the IIFE
    window.addEventListener('scroll', function() {
        let navbar = document.querySelector('.navbar');
        if(window.scrollY > 10) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

})();  // Corrected this line
