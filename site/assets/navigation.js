const menuToggle = document.querySelector('.menu-toggle');
const mainNavigation = document.querySelector('#main-nav');
function closeMenu() { menuToggle?.setAttribute('aria-expanded', 'false'); mainNavigation?.classList.remove('is-open'); }
menuToggle?.addEventListener('click', () => { const open = menuToggle.getAttribute('aria-expanded') !== 'true'; menuToggle.setAttribute('aria-expanded', String(open)); mainNavigation.classList.toggle('is-open', open); });
mainNavigation?.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') { closeMenu(); menuToggle.focus(); } });
