/* ── Notify me form ─────────────────────────────────────── */
function handleNotify(e) {
  e.preventDefault();
  const form    = document.getElementById('notifyForm');
  const success = document.getElementById('notifySuccess');
  const btn     = form.querySelector('button');

  btn.disabled    = true;
  btn.textContent = 'Done ✓';

  form.style.display = 'none';
  success.classList.add('show');
}

/* ── Scroll-reveal ──────────────────────────────────────── */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.scroll-fade').forEach(el => io.observe(el));
