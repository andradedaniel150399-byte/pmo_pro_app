// Simple responsive navigation bar injected on each page
// Provides links to main sections and highlights the active one

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.createElement('nav');
  nav.className = 'bg-indigo-600 text-white';
  nav.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
      <a href="/" class="font-semibold text-lg">PMO Pro</a>
      <button id="nav-toggle" class="md:hidden">☰</button>
      <div id="nav-links" class="hidden md:flex md:items-center md:gap-4">
        <a href="/#tab-dashboard" class="nav-link hover:underline">Dashboard</a>
        <a href="/#tab-projects" class="nav-link hover:underline">Projetos</a>
        <a href="/#tab-kanban" class="nav-link hover:underline">Kanban</a>
      </div>
    </div>
    <div id="nav-mobile" class="md:hidden hidden px-4 pb-4 flex flex-col gap-2 bg-indigo-600">
      <a href="/#tab-dashboard" class="nav-link">Dashboard</a>
      <a href="/#tab-projects" class="nav-link">Projetos</a>
      <a href="/#tab-kanban" class="nav-link">Kanban</a>
    </div>
  `;
  document.body.prepend(nav);

  const toggle = nav.querySelector('#nav-toggle');
  toggle.addEventListener('click', () => {
    nav.querySelector('#nav-links').classList.toggle('hidden');
    nav.querySelector('#nav-mobile').classList.toggle('hidden');
  });

  const current = window.location.pathname + (window.location.hash || '#tab-dashboard');
  nav.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === current) {
      link.classList.add('underline', 'font-semibold');
    }
  });
});
