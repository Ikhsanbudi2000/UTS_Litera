function gantiTab(tab) {
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');

  if (!loginForm || !registerForm || !loginTab || !registerTab) return;

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    loginTab.classList.remove('active');
    registerTab.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');

  loginTab?.addEventListener('click', () => gantiTab('login'));
  registerTab?.addEventListener('click', () => gantiTab('register'));

  loginForm?.addEventListener('submit', (event) => {
    if (typeof window.prosesLogin === 'function') {
      window.prosesLogin(event);
    }
  });

  registerForm?.addEventListener('submit', (event) => {
    if (typeof window.prosesRegister === 'function') {
      window.prosesRegister(event);
    }
  });
});