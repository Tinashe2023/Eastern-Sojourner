// Enhanced JavaScript for Eastern Sojourner Website

document.addEventListener('DOMContentLoaded', function() {
    
    // ===== SLIDESHOW FUNCTIONALITY =====
    const slides = document.querySelectorAll('.slide');
    let currentSlide = 0;
    const slideInterval = 6000; // 6 seconds
    let slideTimer;

    function nextSlide() {
        if (slides.length === 0) return;
        
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }

    function startSlideshow() {
        slideTimer = setInterval(nextSlide, slideInterval);
    }

    function stopSlideshow() {
        if (slideTimer) {
            clearInterval(slideTimer);
        }
    }

    // Start slideshow
    startSlideshow();

    // Pause slideshow on hover
    const slideshowContainer = document.querySelector('.slideshow-container');
    if (slideshowContainer) {
        slideshowContainer.addEventListener('mouseenter', stopSlideshow);
        slideshowContainer.addEventListener('mouseleave', startSlideshow);
    }

    // ===== ENHANCED NAVBAR FUNCTIONALITY =====
    const navbar = document.getElementById('navbar');
    let lastScrollTop = 0;
    let ticking = false;

    function updateNavbar() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 50) {
            navbar.classList.add('bg-slate-900', 'bg-opacity-95', 'backdrop-blur-md', 'shadow-2xl');
        } else {
            navbar.classList.remove('bg-slate-900', 'bg-opacity-95', 'backdrop-blur-md', 'shadow-2xl');
        }

        // Hide navbar on scroll down, show on scroll up
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
        ticking = false;
    }

    function requestNavbarUpdate() {
        if (!ticking) {
            requestAnimationFrame(updateNavbar);
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestNavbarUpdate);

    // ===== MOBILE MENU FUNCTIONALITY =====
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuIcon = mobileMenuButton.querySelector('i');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
            
            // Toggle hamburger/close icon
            if (mobileMenu.classList.contains('hidden')) {
                mobileMenuIcon.className = 'fas fa-bars fa-2x';
            } else {
                mobileMenuIcon.className = 'fas fa-times fa-2x';
            }
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!mobileMenuButton.contains(event.target) && !mobileMenu.contains(event.target)) {
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                    mobileMenuIcon.className = 'fas fa-bars fa-2x';
                }
            }
        });

        // Close mobile menu on window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth >= 768 && !mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
                mobileMenuIcon.className = 'fas fa-bars fa-2x';
            }
        });
    }

    // ===== STATS COUNTER ANIMATION =====
    const counters = document.querySelectorAll('.stats-counter');
    let countersAnimated = false;

    function animateCounters() {
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'));
            const duration = 2000; // 2 seconds
            const step = target / (duration / 16); // 60 FPS
            let current = 0;

            const updateCounter = () => {
                current += step;
                if (current < target) {
                    counter.textContent = Math.floor(current);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target;
                }
            };

            updateCounter();
        });
    }

    // ===== INTERSECTION OBSERVER FOR ANIMATIONS =====
    const observerOptions = {
        threshold: 0.3,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Animate stats counters
                if (entry.target.classList.contains('stats-counter') && !countersAnimated) {
                    setTimeout(animateCounters, 300);
                    countersAnimated = true;
                }

                // Add entrance animations
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.glass-card, .testimonial-card, .stats-counter');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // ===== BACK TO TOP BUTTON =====
    const backToTopBtn = document.getElementById('backToTop');
    
    if (backToTopBtn) {
        function toggleBackToTop() {
            if (window.scrollY > 300) {
                backToTopBtn.style.opacity = '1';
                backToTopBtn.style.transform = 'scale(1)';
            } else {
                backToTopBtn.style.opacity = '0';
                backToTopBtn.style.transform = 'scale(0.8)';
            }
        }

        window.addEventListener('scroll', toggleBackToTop);
        
        backToTopBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ===== SMOOTH SCROLLING FOR NAVIGATION LINKS =====
    const navLinks = document.querySelectorAll('a[href^="#"]');
    navLinks.forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const navbarHeight = navbar.offsetHeight;
                const targetPosition = targetElement.offsetTop - navbarHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Close mobile menu if open
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                    mobileMenuIcon.className = 'fas fa-bars fa-2x';
                }
            }
        });
    });

    // ===== IMAGE LOADING ANIMATION =====
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('load', function() {
            this.style.opacity = '1';
            this.classList.add('loaded');
        });

        // If image is already loaded
        if (img.complete) {
            img.style.opacity = '1';
            img.classList.add('loaded');
        }
    });

    // ===== NEWSLETTER FORM HANDLING =====
    const newsletterForm = document.querySelector('input[type="email"]');
    const subscribeBtn = document.querySelector('input[type="email"] + button');
    
    if (newsletterForm && subscribeBtn) {
        subscribeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const email = newsletterForm.value.trim();
            
            if (validateEmail(email)) {
                // Simulate subscription process
                subscribeBtn.textContent = 'Subscribing...';
                subscribeBtn.disabled = true;
                
                setTimeout(() => {
                    subscribeBtn.textContent = 'Subscribed!';
                    subscribeBtn.className = subscribeBtn.className.replace('bg-white text-indigo-900', 'bg-green-500 text-white');
                    newsletterForm.value = '';
                    
                    setTimeout(() => {
                        subscribeBtn.textContent = 'Subscribe';
                        subscribeBtn.className = subscribeBtn.className.replace('bg-green-500 text-white', 'bg-white text-indigo-900');
                        subscribeBtn.disabled = false;
                    }, 3000);
                }, 1500);
            } else {
                showNotification('Please enter a valid email address', 'error');
            }
        });

        // Enter key support for newsletter
        newsletterForm.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                subscribeBtn.click();
            }
        });
    }

    // ===== DESTINATION CARD INTERACTIONS =====
    const destinationCards = document.querySelectorAll('.glass-card');
    destinationCards.forEach(card => {
        const exploreBtn = card.querySelector('button');
        
        if (exploreBtn && exploreBtn.textContent.includes('Explore')) {
            exploreBtn.addEventListener('click', function() {
                const destination = card.querySelector('h3').textContent;
                showNotification(`Exploring ${destination}! Feature coming soon.`, 'info');
            });
        }
    });

    // ===== UTILITY FUNCTIONS =====
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`;
        
        // Set notification style based on type
        switch(type) {
            case 'error':
                notification.className += ' bg-red-500 text-white';
                break;
            case 'success':
                notification.className += ' bg-green-500 text-white';
                break;
            default:
                notification.className += ' bg-indigo-500 text-white';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 4000);
    }

    // ===== PERFORMANCE OPTIMIZATIONS =====
    // Debounce function for scroll events
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ===== ACCESSIBILITY ENHANCEMENTS =====
    // Keyboard navigation for custom buttons
    const customButtons = document.querySelectorAll('.pulse-glow, .glass-card button');
    customButtons.forEach(button => {
        button.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });

    // Focus management for mobile menu
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    }

    // ===== SET CURRENT YEAR =====
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // ===== LAZY LOADING FOR BACKGROUND IMAGES =====
    const lazyBackgrounds = document.querySelectorAll('.slide[style*="background-image"]');
    const backgroundObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.backgroundImage = entry.target.style.backgroundImage;
                backgroundObserver.unobserve(entry.target);
            }
        });
    });

    lazyBackgrounds.forEach(bg => {
        backgroundObserver.observe(bg);
    });

    // ===== ERROR HANDLING =====
    window.addEventListener('error', function(e) {
        console.warn('Eastern Sojourner: Non-critical error occurred:', e.error);
    });

    // ===== INITIALIZATION COMPLETE =====
    console.log('Eastern Sojourner website initialized successfully!');
});