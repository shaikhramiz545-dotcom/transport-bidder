(function () {
  'use strict';

  // Year in footer
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav toggle
  var navToggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', !expanded);
      nav.classList.toggle('is-open');
      document.body.style.overflow = expanded ? '' : 'hidden';
    });
    // Close on link click (anchor)
    nav.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // Phone screen: random animation style, changes periodically
  var phoneTours = document.getElementById('phone-tours');
  var animStyles = ['slide-left', 'slide-up', 'slide-right', 'fade', 'scale', 'bounce'];
  function pickRandomAnim() {
    return animStyles[Math.floor(Math.random() * animStyles.length)];
  }
  function applyPhoneAnim(style) {
    if (!phoneTours) return;
    phoneTours.setAttribute('data-anim-style', '');
    phoneTours.offsetHeight; // force reflow
    phoneTours.setAttribute('data-anim-style', style);
  }
  if (phoneTours) {
    applyPhoneAnim(pickRandomAnim());
    setInterval(function () {
      var next = pickRandomAnim();
      applyPhoneAnim(next);
    }, 4000);
  }

  // Scroll animations
  function animateOnScroll() {
    var heroItems = document.querySelectorAll('.hero .animate-in');
    heroItems.forEach(function (el) {
      if (isInView(el)) el.classList.add('visible');
    });
    var dataAnimate = document.querySelectorAll('[data-animate]');
    dataAnimate.forEach(function (el) {
      if (isInView(el)) el.classList.add('visible');
    });
  }

  function isInView(el) {
    var rect = el.getBoundingClientRect();
    var margin = 80;
    return rect.top < window.innerHeight - margin;
  }

  window.addEventListener('scroll', animateOnScroll);
  window.addEventListener('load', animateOnScroll);
  animateOnScroll();

  // Contact form (static: no backend, just UX)
  var form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('#name');
      var email = form.querySelector('#email');
      var msg = form.querySelector('#message');
      if (name && name.value && email && email.value && msg && msg.value) {
        alert('Thank you! We will get back to you soon. (Form is static — connect to your backend for real submission.)');
        form.reset();
      }
    });
  }
})();
