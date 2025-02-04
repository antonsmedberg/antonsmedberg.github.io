document.addEventListener('DOMContentLoaded', () => {
    // Performance and Accessibility Optimization
    const lazyLoadImages = () => {
        const images = document.querySelectorAll('img[loading="lazy"]');
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const image = entry.target;
                        image.src = image.dataset.src || image.src;
                        image.classList.add('loaded');
                        observer.unobserve(image);
                    }
                });
            }, { rootMargin: '50px 0px' });

            images.forEach(img => imageObserver.observe(img));
        }
    };

    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const mainHeader = document.getElementById('main-header');
    const announcementBar = document.getElementById('announcement-bar');
    const menuIconOpen = document.getElementById('menu-icon-open');
    const menuIconClose = document.getElementById('menu-icon-close');
    const sectionsContainer = document.getElementById('sections-container');
    const projectsContainer = document.getElementById('projects-grid');
    const mainProjectsGrid = document.getElementById('main-projects-grid');

    // Error Handling Wrapper
    const safeRender = (renderFunction) => {
        try {
            renderFunction();
        } catch (error) {
            console.error('Rendering error:', error);
            // Optional: Add user-friendly error notification
        }
    };

    const sections = [
        { 
            name: 'SKILLS', 
            items: ['Frontend Development', 'Backend Development', 'DevOps', 'Mobile Development'] 
        },
        { 
            name: 'EXPERIENCE', 
            items: ['Senior Developer at TechCorp', 'Lead Engineer at StartupX', 'Full-Stack Developer at WebCo'] 
        },
        { 
            name: 'EDUCATION', 
            items: ['Master in Computer Science', 'Bachelor in Software Engineering', 'Technical Certifications'] 
        }
    ];

    const projects = [
        {
            title: 'E-Commerce Platform',
            image: 'https://via.placeholder.com/400x500',
            tag: 'REACT & NODE.JS',
            description: 'Full-stack e-commerce solution with modern web technologies'
        },
        {
            title: 'AI-Powered Analytics',
            image: 'https://via.placeholder.com/400x500',
            tag: 'PYTHON & TENSORFLOW',
            description: 'Machine learning analytics dashboard with predictive insights'
        }
    ];

    let activeSection = null;
    let isMenuOpen = false;
    let lastScrollY = 0;

    // Render Sections with Accessibility
    const renderSections = () => {
        sections.forEach((section, index) => {
            const sectionElement = document.createElement('div');
            sectionElement.innerHTML = `
                <button 
                    class="w-full flex items-center justify-between group py-2" 
                    aria-expanded="false" 
                    aria-controls="section-${index}"
                >
                    <span class="text-2xl font-medium text-white group-hover:text-blue-400 transition-colors">
                        ${section.name}
                    </span>
                    <i data-lucide="chevron-right" class="text-slate-400 transition-transform duration-300"></i>
                </button>
                
                <div 
                    id="section-${index}" 
                    class="grid gap-2 pl-4 overflow-hidden transition-all duration-300 max-h-0 opacity-0"
                    aria-hidden="true"
                >
                    ${section.items.map(item => `
                        <button class="text-slate-400 hover:text-white text-left transition-colors py-1" tabindex="-1">
                            ${item}
                        </button>
                    `).join('')}
                </div>
            `;

            const sectionButton = sectionElement.querySelector('button');
            const sectionContent = sectionElement.querySelector('div');

            sectionButton.addEventListener('click', () => {
                const isActive = activeSection === index;
                
                sectionsContainer.querySelectorAll('div > div').forEach(content => {
                    content.classList.remove('max-h-40', 'opacity-100', 'mt-2');
                    content.classList.add('max-h-0', 'opacity-0');
                    content.setAttribute('aria-hidden', 'true');
                });

                sectionsContainer.querySelectorAll('button').forEach(btn => {
                    btn.setAttribute('aria-expanded', 'false');
                });

                sectionsContainer.querySelectorAll('button i[data-lucide="chevron-right"]').forEach(icon => {
                    icon.classList.remove('rotate-90');
                });

                if (!isActive) {
                    sectionContent.classList.remove('max-h-0', 'opacity-0');
                    sectionContent.classList.add('max-h-40', 'opacity-100', 'mt-2');
                    sectionContent.setAttribute('aria-hidden', 'false');
                    sectionButton.setAttribute('aria-expanded', 'true');
                    sectionButton.querySelector('i').classList.add('rotate-90');
                    activeSection = index;
                } else {
                    activeSection = null;
                }
            });

            sectionsContainer.appendChild(sectionElement);
        });
    };

    // Render Projects with Performance Optimization
    const renderProjects = () => {
        const renderProjectGrid = (container, imageClass) => {
            projects.forEach(project => {
                const projectElement = document.createElement('div');
                projectElement.className = 'group cursor-pointer';
                projectElement.innerHTML = `
                    <div class="relative rounded-2xl overflow-hidden bg-slate-800">
                        <img
                            src="${project.image}"
                            alt="${project.title}"
                            class="${imageClass}"
                            loading="lazy"
                        />
                        <div class="absolute top-4 right-4">
                            <i data-lucide="external-link" class="text-white/90 hover:text-white transition-colors"></i>
                        </div>
                        <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                            <h3 class="text-white font-medium">${project.title}</h3>
                            <p class="text-slate-300 text-sm">${project.tag}</p>
                        </div>
                    </div>
                `;
                container.appendChild(projectElement);
            });
        };

        renderProjectGrid(projectsContainer, 'w-full h-32 object-cover opacity-90 group-hover:opacity-100 transform group-hover:scale-105 transition-all duration-300');
        renderProjectGrid(mainProjectsGrid, 'w-full h-64 object-cover transform group-hover:scale-105 transition-transform duration-500');
    };

    // Performance and Accessibility Initialization
    safeRender(renderSections);
    safeRender(renderProjects);
    lazyLoadImages();

    // Menu Toggle with Accessibility
    menuToggle.addEventListener('click', () => {
        isMenuOpen = !isMenuOpen;
        mobileMenu.classList.toggle('max-h-0', !isMenuOpen);
        mobileMenu.classList.toggle('opacity-0', !isMenuOpen);
        mobileMenu.classList.toggle('max-h-screen', isMenuOpen);
        mobileMenu.classList.toggle('opacity-100', isMenuOpen);
        mobileMenu.setAttribute('aria-hidden', !isMenuOpen);

        menuIconOpen.classList.toggle('opacity-0', isMenuOpen);
        menuIconOpen.classList.toggle('rotate-90', isMenuOpen);
        menuIconClose.classList.toggle('opacity-0', !isMenuOpen);
        menuIconClose.classList.toggle('rotate-0', isMenuOpen);
    });

    // Scroll Handling
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        const scrollThreshold = 50;

        if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold) {
            mainHeader.style.transform = 'translateY(-100%)';
            announcementBar.style.opacity = '0';
            announcementBar.style.height = '0';
        } else {
            mainHeader.style.transform = 'translateY(0)';
            announcementBar.style.opacity = '1';
            announcementBar.style.height = 'auto';
        }

        lastScrollY = currentScrollY;
    });
});
