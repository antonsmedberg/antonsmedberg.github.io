// Main Portfolio JavaScript with optimized animations and interactions
document.addEventListener('DOMContentLoaded', () => {
  // Utility functions
  const select = (selector) => document.querySelector(selector);
  const selectAll = (selector) => document.querySelectorAll(selector);
  
  // Cache DOM elements
  const elements = {
    header: select('header'),
    navLinks: select('.nav-links'),
    menuToggle: select('.hamburger-menu'),
    sections: selectAll('section'),
    skillLevels: selectAll('.skill-level'),
    projectCards: selectAll('.project-card'),
    filterButtons: selectAll('.filter-btn'),
    contactForm: select('.contact-form')
  };

  // Intersection Observer configurations
  const observerOptions = {
    threshold: 0.2,
    rootMargin: '0px'
  };

  // Animation class names
  const CLASSES = {
    active: 'active',
    scrolled: 'scrolled',
    visible: 'visible',
    fadeIn: 'fade-in',
    slideIn: 'slide-in'
  };

  // Handle navbar scroll effect
  const handleScroll = () => {
    const scrolled = window.scrollY > 20;
    elements.header.classList.toggle(CLASSES.scrolled, scrolled);
    
    // Update active navigation link based on scroll position
    const currentSection = Array.from(elements.sections).find(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= 100 && rect.bottom >= 100;
    });

    if (currentSection) {
      selectAll('.nav-links a').forEach(link => {
        const isActive = link.getAttribute('href').slice(1) === currentSection.id;
        link.classList.toggle(CLASSES.active, isActive);
      });
    }
  };

  // Initialize smooth scrolling
  const initSmoothScroll = () => {
    selectAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        elements.navLinks.classList.remove(CLASSES.active);
        
        const target = select(anchor.getAttribute('href'));
        if (target) {
          const headerOffset = elements.header.offsetHeight;
          const elementPosition = target.offsetTop;
          const offsetPosition = elementPosition - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  };

  // Handle mobile menu
  const initMobileMenu = () => {
    elements.menuToggle.addEventListener('click', () => {
      elements.navLinks.classList.toggle(CLASSES.active);
      elements.menuToggle.classList.toggle(CLASSES.active);
      
      // Prevent body scroll when menu is open
      document.body.style.overflow = 
        elements.navLinks.classList.contains(CLASSES.active) ? 'hidden' : '';
    });
  };

  // Initialize section animations
  const initSectionAnimations = () => {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(CLASSES.visible);
          entry.target.classList.add(CLASSES.fadeIn);
          sectionObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    elements.sections.forEach(section => {
      section.classList.add('transition-opacity', 'duration-1000', 'opacity-0');
      sectionObserver.observe(section);
    });
  };

  // Initialize skill level animations
  const initSkillAnimations = () => {
    const skillObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const level = entry.target.getAttribute('data-level');
          entry.target.style.width = `${level}%`;
          entry.target.classList.add(CLASSES.visible);
          skillObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    elements.skillLevels.forEach(skill => {
      skill.style.width = '0%';
      skillObserver.observe(skill);
    });
  };

  // Project filtering functionality
  const initProjectFilters = () => {
    elements.filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.getAttribute('data-filter');
        
        elements.filterButtons.forEach(btn => 
          btn.classList.toggle(CLASSES.active, btn === button));

        elements.projectCards.forEach(card => {
          const shouldShow = filter === 'all' || card.classList.contains(filter);
          card.style.opacity = '0';
          
          setTimeout(() => {
            card.style.display = shouldShow ? 'block' : 'none';
            if (shouldShow) {
              requestAnimationFrame(() => {
                card.style.opacity = '1';
              });
            }
          }, 300);
        });
      });
    });
  };

  // Handle contact form submission with validation
  const initContactForm = () => {
    elements.contactForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(elements.contactForm);
      const submitButton = elements.contactForm.querySelector('button[type="submit"]');
      
      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        
        const response = await fetch(elements.contactForm.action, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          elements.contactForm.reset();
          showNotification('Message sent successfully!', 'success');
        } else {
          throw new Error('Failed to send message');
        }
      } catch (error) {
        showNotification('Failed to send message. Please try again.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send Message';
      }
    });
  };

  // Show notification
  const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };

  // Initialize parallax effect
  const initParallax = () => {
    const parallaxSections = selectAll('.parallax');
    
    window.addEventListener('scroll', () => {
      requestAnimationFrame(() => {
        parallaxSections.forEach(section => {
          const speed = 0.5;
          const rect = section.getBoundingClientRect();
          const visible = rect.top < window.innerHeight && rect.bottom > 0;
          
          if (visible) {
            const yPos = -(rect.top * speed);
            section.style.backgroundPositionY = `${yPos}px`;
          }
        });
      });
    });
  };

  // Initialize dark mode toggle
  const initDarkMode = () => {
    const darkModeToggle = select('#darkModeToggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    const setDarkMode = (isDark) => {
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem('darkMode', isDark);
    };

    if (darkModeToggle) {
      const savedDarkMode = localStorage.getItem('darkMode') === 'true';
      setDarkMode(savedDarkMode ?? prefersDark.matches);

      darkModeToggle.addEventListener('click', () => {
        setDarkMode(!document.documentElement.classList.contains('dark'));
      });

      prefersDark.addEventListener('change', (e) => setDarkMode(e.matches));
    }
  };

  // Initialize page load animations
  const initPageLoadAnimations = () => {
    document.body.classList.add('loaded');
    
    const animateElements = selectAll('.animate-on-load');
    animateElements.forEach((el, index) => {
      setTimeout(() => {
        el.classList.add(CLASSES.visible);
      }, 100 * index);
    });
  };

  // Initialize all features
  const init = () => {
    window.addEventListener('scroll', handleScroll);
    initSmoothScroll();
    initMobileMenu();
    initSectionAnimations();
    initSkillAnimations();
    initProjectFilters();
    initContactForm();
    initParallax();
    initDarkMode();
    initPageLoadAnimations();
    
    // Initial scroll check
    handleScroll();
  };

  // Start initialization
  init();
});

export default Portfolio;
