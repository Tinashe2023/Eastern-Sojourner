// Set current year
document.getElementById('year').textContent = new Date().getFullYear();

// Back to top button
const backToTopBtn = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
        backToTopBtn.style.opacity = '1';
    } else {
        backToTopBtn.style.opacity = '0';
    }
});

backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Itinerary tabs
function showItinerary(type) {
    document.querySelectorAll('.itinerary-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('itinerary-' + type).classList.remove('hidden');
    
    document.querySelectorAll('.itinerary-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600');
        btn.classList.add('bg-gray-700');
    });
    document.getElementById('btn-' + type).classList.add('bg-indigo-600');
    document.getElementById('btn-' + type).classList.remove('bg-gray-700');
}

// FAQ Toggle
function toggleFAQ(num) {
    const faq = document.getElementById('faq-' + num);
    faq.classList.toggle('hidden');
}

// Mobile menu
const mobileMenuButton = document.getElementById('mobile-menu-button');
if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', function() {
        alert('Mobile menu functionality - to be implemented');
    });
}