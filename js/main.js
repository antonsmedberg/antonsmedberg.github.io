document.addEventListener("DOMContentLoaded", function () {
    let menuToggle = document.getElementById("menuToggle");
    let menuContent = document.getElementById("menuContent");
    let header = document.getElementById("header");
    let announcement = document.getElementById("announcement");

    let lastScrollY = window.scrollY;

    // Toggle menu visibility
    menuToggle.addEventListener("click", function () {
        if (menuContent.style.display === "block") {
            menuContent.style.display = "none";
        } else {
            menuContent.style.display = "block";
        }
    });

    // Hide/show header on scroll
    window.addEventListener("scroll", function () {
        let currentScrollY = window.scrollY;

        if (currentScrollY > lastScrollY && currentScrollY > 50) {
            header.style.transform = "translateY(-100%)";
            announcement.style.opacity = "0";
        } else {
            header.style.transform = "translateY(0)";
            announcement.style.opacity = "1";
        }

        lastScrollY = currentScrollY;
    });
});
