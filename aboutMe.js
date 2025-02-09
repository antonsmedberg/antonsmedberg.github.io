class AboutMeManager {
    constructor() {
        this.container = document.getElementById("about-me-container");
    }

    async initialize() {
        if (!this.container) {
            console.error("Error: '#about-me-container' not found in the DOM.");
            return;
        }
        try {
            await this.loadContent();
            await this.initializeComponents();

            // Use global function to reinitialize icons
            if (window.reinitializeLucideIcons) {
                window.reinitializeLucideIcons();
            }

        } catch (error) {
            console.error("Error initializing About Me section:", error);
        }
    }

    // New method to reinitialize Lucide icons
    reinitializeLucideIcons() {
        try {
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                // Remove existing Lucide icons and recreate
                const existingIcons = document.querySelectorAll('[data-lucide]');
                existingIcons.forEach(icon => {
                    const newIcon = icon.cloneNode(true);
                    icon.parentNode.replaceChild(newIcon, icon);
                });

                lucide.createIcons({
                    attrs: {
                        class: 'lucide',
                        'stroke-width': 2
                    }
                });
                console.log("Lucide icons reinitialized successfully after content load");
            } else {
                console.error("Lucide icons not available for reinitialization");
            }
        } catch (error) {
            console.error("Error reinitializing Lucide icons:", error);
        }
    }

    async loadContent() {
        try {
            const response = await fetch("aboutMe.html");
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            this.container.innerHTML = await response.text();
        } catch (error) {
            console.error("Error loading About Me section:", error);
            throw error;
        }
    }

    async initializeComponents() {
        try {
            const linkedinScript = document.querySelector(
                'script[src="https://platform.linkedin.com/badges/js/profile.js"]'
            );
            if (!linkedinScript) {
                await this.loadLinkedInBadge();
            } else {
                await this.renderLinkedInBadges();
            }
        } catch (error) {
            console.error("Error initializing LinkedIn components:", error);
        }
    }

    loadLinkedInBadge() {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://platform.linkedin.com/badges/js/profile.js";
            script.async = true;
            script.defer = true;
            script.onload = () => {
                this.reinitializeLucideIcons(); // Reinitialize icons after LinkedIn script loads
                resolve();
            };
            script.onerror = () => reject(new Error("Failed to load LinkedIn badge script."));
            document.body.appendChild(script);
        });
    }

    async renderLinkedInBadges() {
        return new Promise((resolve) => {
            const checkAndRender = () => {
                if (typeof window.LIRenderAll === "function") {
                    window.LIRenderAll();
                    this.reinitializeLucideIcons(); // Reinitialize icons after rendering
                    resolve();
                } else {
                    setTimeout(checkAndRender, 500);
                }
            };
            checkAndRender();
        });
    }
}

// Initialize About Me Section
document.addEventListener("DOMContentLoaded", () => {
    const aboutMeManager = new AboutMeManager();
    aboutMeManager.initialize();
});