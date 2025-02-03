// Enhanced Portfolio JavaScript with Premium Features
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
    filterButtons: selectAll('.btn-filter'),
    contactForm: select('.contact-form'),
    darkModeToggle: select('#darkModeToggle'),
    scrollTopBtn: select('#scrollToTop'),
    heroTitle: select('.hero-title'),
    heroSubtitle: select('.hero-subtitle')
  };

  // Animation configurations
  const ANIMATION_DURATION = 300;
  const SCROLL_THRESHOLD = 50;
  
  // Premium scroll effects
  const handleScroll = () => {
    const scrolled = window.scrollY > SCROLL_THRESHOLD;
    requestAnimationFrame(() => {
      // Enhanced header transformation
      elements.header.style.setProperty('--scroll-progress', Math.min(1, window.scrollY / window.innerHeight));
      elements.header.classList.toggle('scrolled', scrolled);
      
      // Parallax effect for hero section
      const hero = select('.hero');
      if (hero) {
        const yPos = window.scrollY * 0.5;
        hero.style.transform = `translateY(${yPos}px)`;
      }

      // Show/hide scroll to top with smooth transition
      if (elements.scrollTopBtn) {
        elements.scrollTopBtn.classList.toggle('active', scrolled);
      }
      
      // Update active navigation with smooth indicator
      updateActiveNavigation();
    });
  };

  // Enhanced active navigation update
  const updateActiveNavigation = () => {
    const currentSection = Array.from(elements.sections).find(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= 100 && rect.bottom >= 100;
    });

    if (currentSection) {
      selectAll('.nav-links a').forEach(link => {
        const isActive = link.getAttribute('href').slice(1) === currentSection.id;
        link.classList.toggle('active', isActive);
        
        // Move active indicator
        const indicator = select('.nav-indicator');
        if (indicator && isActive) {
          const linkRect = link.getBoundingClientRect();
          indicator.style.transform = `translateX(${linkRect.left}px)`;
          indicator.style.width = `${linkRect.width}px`;
        }
      });
    }
  };

  // Premium smooth scrolling
  const initSmoothScroll = () => {
    selectAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        elements.navLinks.classList.remove('active');
        
        const target = select(anchor.getAttribute('href'));
        if (target) {
          const headerOffset = elements.header.offsetHeight;
          const elementPosition = target.offsetTop;
          const offsetPosition = elementPosition - headerOffset;

          // Enhanced smooth scroll with easing
          const start = window.pageYOffset;
          const distance = offsetPosition - start;
          const duration = 1000;
          let startTime = null;

          const animation = currentTime => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // Easing function for smooth animation
            const ease = t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            
            window.scrollTo(0, start + distance * ease(progress));

            if (timeElapsed < duration) {
              requestAnimationFrame(animation);
            }
          };

          requestAnimationFrame(animation);
        }
      });
    });
  };

  // Enhanced mobile menu with animations
  const initMobileMenu = () => {
    elements.menuToggle.addEventListener('click', () => {
      const isOpen = elements.navLinks.classList.contains('active');
      
      // Animate hamburger icon
      elements.menuToggle.classList.toggle('active');
      
      // Animate menu items with stagger
      const menuItems = elements.navLinks.querySelectorAll('a');
      menuItems.forEach((item, index) => {
        setTimeout(() => {
          item.style.transform = isOpen ? 'translateY(-20px)' : 'translateY(0)';
          item.style.opacity = isOpen ? '0' : '1';
        }, index * 50);
      });

      // Toggle menu with transition
      elements.navLinks.classList.toggle('active');
      document.body.style.overflow = isOpen ? '' : 'hidden';
    });

    // Enhanced click outside handling
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-links') && 
          !e.target.closest('.hamburger-menu') && 
          elements.navLinks.classList.contains('active')) {
        closeMobileMenu();
      }
    });
  };

  const closeMobileMenu = () => {
    elements.menuToggle.classList.remove('active');
    elements.navLinks.classList.remove('active');
    document.body.style.overflow = '';
  };

  // Enhanced section animations
  const initSectionAnimations = () => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Add staggered animations for children
          const children = entry.target.children;
          Array.from(children).forEach((child, index) => {
            setTimeout(() => {
              child.classList.add('animate-in');
            }, index * 100);
          });
          
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, { 
      threshold: 0.2,
      rootMargin: '50px'
    });

    elements.sections.forEach(section => observer.observe(section));
  };

  // Enhanced skill animations with progress
  const initSkillAnimations = () => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const level = entry.target.getAttribute('data-level');
          const progressBar = entry.target.querySelector('.progress-bar');
          const value = entry.target.querySelector('.skill-value');
          
          // Animate progress bar
          progressBar.style.width = `${level}%`;
          
          // Animate number
          let current = 0;
          const interval = setInterval(() => {
            if (current >= level) {
              clearInterval(interval);
            } else {
              current++;
              if (value) value.textContent = `${current}%`;
            }
          }, 2000 / level);

          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    elements.skillLevels.forEach(skill => observer.observe(skill));
  };

  // Enhanced project filtering with transitions
  const initProjectFilters = () => {
    elements.filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.getAttribute('data-filter');
        
        // Update active button with slide effect
        elements.filterButtons.forEach(btn => {
          btn.classList.toggle('active', btn === button);
          if (btn === button) {
            const indicator = select('.filter-indicator');
            if (indicator) {
              const btnRect = btn.getBoundingClientRect();
              indicator.style.transform = `translateX(${btnRect.left}px)`;
              indicator.style.width = `${btnRect.width}px`;
            }
          }
        });

        // Filter projects with stagger and scale
        elements.projectCards.forEach((card, index) => {
          const shouldShow = filter === 'all' || card.classList.contains(filter);
          
          setTimeout(() => {
            card.style.transform = shouldShow ? 'scale(1)' : 'scale(0.8)';
            card.style.opacity = shouldShow ? '1' : '0';
            
            setTimeout(() => {
              card.style.display = shouldShow ? 'block' : 'none';
            }, shouldShow ? 0 : ANIMATION_DURATION);
          }, index * 50);
        });
      });
    });
  };

  // Enhanced contact form with loading states
  const initContactForm = () => {
    elements.contactForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      
      // Add loading spinner
      const spinner = document.createElement('span');
      spinner.className = 'loading-spinner';
      
      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '';
        submitBtn.appendChild(spinner);
        
        const formData = new FormData(form);
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          form.reset();
          showNotification('Message sent successfully! 🎉', 'success');
        } else {
          throw new Error('Failed to send message');
        }
      } catch (error) {
        showNotification('Failed to send message. Please try again. 😢', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  };

  // Enhanced notification system
  const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Add icon based on type
    const icon = document.createElement('span');
    icon.className = `notification-icon ${type}-icon`;
    notification.appendChild(icon);
    
    const text = document.createElement('span');
    text.textContent = message;
    notification.appendChild(text);
    
    document.body.appendChild(notification);

    // Slide in animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
      
      setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), ANIMATION_DURATION);
      }, 3000);
    });
  };

  // Initialize typing animation for hero text
  const initTypingAnimation = () => {
    if (elements.heroTitle) {
      const text = elements.heroTitle.textContent;
      elements.heroTitle.textContent = '';
      
      let i = 0;
      const type = () => {
        if (i < text.length) {
          elements.heroTitle.textContent += text.charAt(i);
          i++;
          setTimeout(type, 100);
        }
      };
      
      type();
    }
  };

  // Initialize all features
  const init = () => {
    // Add scroll listener with throttle
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    });

    initSmoothScroll();
    initMobileMenu();
    initSectionAnimations();
    initSkillAnimations();
    initProjectFilters();
    initContactForm();
    initDarkMode();
    initLoadingAnimation();
    initTypingAnimation();
    
    // Update copyright year
    const yearEl = select('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Initial checks
    handleScroll();
    
    // Remove loading screen
    document.body.classList.add('loaded');
  };

  // Start initialization
  init();
});
