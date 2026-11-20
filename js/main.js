/* ==========================================================================
   AAEMS — Site interactions and motion
   Behaviour (navigation, gallery, form) is plain JavaScript. Motion is layered
   on top with GSAP + ScrollTrigger and Lenis (js/vendor). If those are missing,
   or the visitor prefers reduced motion, the page stays fully usable and
   static: nothing is hidden by default.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktopNav = window.matchMedia('(min-width: 1180px)');

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const motion = Boolean(gsap && ScrollTrigger) && !reduceMotion;
  if (motion) {
    root.classList.add('has-motion');
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: 'power3.out', duration: 1 });
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* ---- Smooth scrolling ------------------------------------------------ */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  let scrollLocks = 0;
  const lockScroll = (lock) => {
    scrollLocks = Math.max(0, scrollLocks + (lock ? 1 : -1));
    root.style.overflow = scrollLocks ? 'hidden' : '';
    if (lenis) { if (scrollLocks) lenis.stop(); else lenis.start(); }
  };

  const header = $('[data-header]');
  const scrollToTarget = (target) => {
    const offset = -((header ? header.offsetHeight : 0) + 12);
    if (lenis) {
      // Measure where the target will rest, ignoring any reveal offset it still carries
      const pending = parseFloat(gsap.getProperty(target, 'y')) || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - pending + offset;
      lenis.scrollTo(Math.max(0, top), { duration: 1.5 });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };

  /* ---- Header state + scroll progress ---------------------------------- */
  const progress = $('[data-progress]');
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (progress) {
      const max = root.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0})`;
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---- Text splitting -------------------------------------------------- */
  // Wraps each word of an element (keeping <em>, <br> and links intact).
  const wrapWords = (el, build) => {
    let index = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
            else frag.appendChild(build(part, index++));
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
  };

  if (motion) {
    // Headings: each word rises out of its own mask
    $$('[data-split]').forEach((el) => {
      wrapWords(el, (word) => {
        const outer = document.createElement('span');
        outer.className = 'w';
        const inner = document.createElement('span');
        inner.className = 'w__i';
        inner.textContent = word;
        outer.appendChild(inner);
        return outer;
      });
    });
    // Hero headline: letter by letter
    $$('[data-hero-title] .hero__line').forEach((line) => {
      wrapWords(line, (word) => {
        const outer = document.createElement('span');
        outer.className = 'hero__word';
        Array.from(word).forEach((letter) => {
          const ch = document.createElement('span');
          ch.className = 'ch';
          ch.textContent = letter;
          outer.appendChild(ch);
        });
        return outer;
      });
    });
    // Motto: word by word
    $$('[data-motto-text]').forEach((el) => {
      wrapWords(el, (word) => {
        const span = document.createElement('span');
        span.className = 'sw';
        span.textContent = word;
        return span;
      });
    });
  }

  /* ---- Navigation ------------------------------------------------------ */
  const burger = $('[data-burger]');
  const setNav = (open) => {
    if (!burger || root.classList.contains('nav-open') === open) return;
    root.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', String(open));
    lockScroll(open);
  };
  if (burger) {
    burger.addEventListener('click', () => setNav(!root.classList.contains('nav-open')));
    desktopNav.addEventListener('change', (e) => { if (e.matches) setNav(false); });
    $$('.primary-nav a').forEach((a) => a.addEventListener('click', () => setNav(false)));
  }

  $$('.nav-item.has-menu').forEach((item) => {
    const toggle = $('.nav-toggle', item);
    const setOpen = (open) => {
      item.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      $$('.nav-item.has-menu.is-open').forEach((other) => {
        if (other !== item) {
          other.classList.remove('is-open');
          $('.nav-toggle', other).setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.remove('is-dismissed');
      setOpen(open);
    });
    item.addEventListener('mouseleave', () => {
      item.classList.remove('is-dismissed');
      if (desktopNav.matches) setOpen(false);
    });
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) {
        item.classList.remove('is-dismissed');
        if (desktopNav.matches) setOpen(false);
      }
    });
    item.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !desktopNav.matches) return;
      setOpen(false);
      item.classList.add('is-dismissed');
      $('.nav-link', item).focus();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('nav-open')) {
      setNav(false);
      burger.focus();
    }
  });

  /* ---- Hero slideshow -------------------------------------------------- */
  const hero = $('[data-hero]');
  let startHero = () => {};
  if (hero) {
    const slides = $$('.hero__slide', hero);
    const dots = $$('.hero__dots button', hero);
    const indexEl = $('[data-hero-index]', hero);
    const captionEl = $('[data-hero-caption]', hero);
    const INTERVAL = 7000;
    let current = 0;
    let timer = null;

    hero.style.setProperty('--hero-interval', `${INTERVAL}ms`);

    const hydrate = (slide) => {
      const img = $('img[data-src]', slide);
      if (!img) return;
      img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    };

    const goTo = (next) => {
      next = (next + slides.length) % slides.length;
      hydrate(slides[next]);
      hydrate(slides[(next + 1) % slides.length]);
      slides.forEach((s, i) => s.classList.toggle('is-active', i === next));
      dots.forEach((d, i) => {
        d.classList.remove('is-active');
        if (i === next) { void d.offsetWidth; d.classList.add('is-active'); } // restart progress
      });
      indexEl.textContent = String(next + 1).padStart(2, '0');
      captionEl.textContent = dots[next].dataset.caption;
      current = next;
    };

    const play = () => {
      window.clearInterval(timer);
      if (reduceMotion) return;
      timer = window.setInterval(() => goTo(current + 1), INTERVAL);
    };

    dots.forEach((dot, i) => dot.addEventListener('click', () => { goTo(i); play(); }));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) window.clearInterval(timer); else play();
    });

    startHero = () => {
      if (reduceMotion) { hero.classList.add('is-paused'); return; }
      goTo(0);
      play();
    };
  }

  /* ---- Philosophy triptych --------------------------------------------- */
  const trip = $('[data-trip]');
  if (trip) {
    const panels = $$('.trip__panel', trip);
    const activate = (panel) => {
      if (panel.classList.contains('is-active')) return;
      panels.forEach((p) => {
        const on = p === panel;
        p.classList.toggle('is-active', on);
        $('.trip__toggle', p).setAttribute('aria-expanded', String(on));
      });
    };
    panels.forEach((panel) => {
      panel.addEventListener('click', () => activate(panel));
      panel.addEventListener('focusin', () => activate(panel));
      if (finePointer) panel.addEventListener('mouseenter', () => activate(panel));
    });
  }

  /* ---- Marquees --------------------------------------------------------- */
  const marquees = $$('[data-marquee]').map((el) => {
    const track = $('.marquee__track', el);
    const copies = Math.ceil(window.innerWidth / Math.max(track.offsetWidth, 1)) + 2;
    for (let i = 1; i < copies; i += 1) el.appendChild(track.cloneNode(true));
    return { el, dir: parseFloat(el.dataset.marquee) || -1, tween: null };
  });

  /* ---- Gallery: filters + lightbox ------------------------------------- */
  const gallery = $('[data-gallery]');
  if (gallery) {
    const items = $$('.g-item', gallery);
    const filters = $$('[data-filter]');
    const visible = () => items.filter((item) => !item.hidden);

    filters.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        filters.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        const cat = btn.dataset.filter;
        const apply = () => {
          items.forEach((item) => { item.hidden = cat !== 'all' && item.dataset.cat !== cat; });
          gallery.classList.remove('is-switching');
          if (motion) {
            gsap.killTweensOf(items);
            gsap.fromTo(visible(),
              { autoAlpha: 0, y: 30, scale: 0.96 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.04, overwrite: true });
            ScrollTrigger.refresh();
          }
        };
        if (!motion) { apply(); return; }
        gallery.classList.add('is-switching');
        window.setTimeout(apply, 360);
      });
    });

    const box = $('[data-lightbox]');
    if (box) {
      const img = $('[data-lightbox-img]', box);
      const caption = $('[data-lightbox-caption]', box);
      const count = $('[data-lightbox-count]', box);
      const closeBtn = $('[data-lightbox-close]', box);
      const controls = [closeBtn, $('[data-lightbox-prev]', box), $('[data-lightbox-next]', box)];
      let set = [];
      let at = 0;
      let opener = null;

      box.hidden = false;

      const show = (i) => {
        at = (i + set.length) % set.length;
        const item = set[at];
        img.classList.remove('is-ready');
        const next = new Image();
        next.onload = () => {
          img.src = next.src;
          img.alt = $('img', item).alt;
          window.requestAnimationFrame(() => img.classList.add('is-ready'));
        };
        next.src = item.href;
        caption.textContent = item.dataset.caption;
        count.textContent = `${String(at + 1).padStart(2, '0')} / ${String(set.length).padStart(2, '0')}`;
      };
      const open = (item) => {
        set = visible();
        opener = item;
        box.classList.add('is-open');
        lockScroll(true);
        show(set.indexOf(item));
        closeBtn.focus();
      };
      const close = () => {
        box.classList.remove('is-open');
        lockScroll(false);
        if (opener) opener.focus({ preventScroll: true });
      };

      items.forEach((item) => item.addEventListener('click', (e) => { e.preventDefault(); open(item); }));
      closeBtn.addEventListener('click', close);
      controls[1].addEventListener('click', () => show(at - 1));
      controls[2].addEventListener('click', () => show(at + 1));
      box.addEventListener('click', (e) => { if (e.target.classList.contains('lightbox__stage')) close(); });

      document.addEventListener('keydown', (e) => {
        if (!box.classList.contains('is-open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') show(at - 1);
        if (e.key === 'ArrowRight') show(at + 1);
        if (e.key === 'Tab') {
          const i = controls.indexOf(document.activeElement);
          e.preventDefault();
          controls[(i + (e.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
        }
      });

      let touchX = null;
      box.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1));
        touchX = null;
      }, { passive: true });
    }
  }

  /* ---- Enquiry / visit form -------------------------------------------- */
  const form = $('[data-enquiry]');
  if (form) {
    const modeInputs = $$('input[name="mode"]', form);
    const title = $('[data-enquiry-title]', form);
    const intro = $('[data-enquiry-intro]', form);
    const body = $('.enquiry__body', form);
    const done = $('[data-enquiry-done]', form);
    const doneVisit = $('[data-enquiry-done-visit]', form);
    const dateInput = $('#f-date', form);

    const copy = {
      enquiry: {
        title: 'Send us an enquiry',
        intro: 'Tell us a little about your child and what you would like to know. The school office will reply as soon as it can.',
      },
      visit: {
        title: 'Book a campus visit',
        intro: 'The best way to understand AAEMS is to see it. Tell us when you would like to come — the office will confirm a time and someone to show you around.',
      },
    };

    const mode = () => modeInputs.find((input) => input.checked).value;
    const setMode = (value, animate = false) => {
      modeInputs.forEach((input) => { input.checked = input.value === value; });
      $$('.enquiry__only-visit', form).forEach((el) => { el.hidden = value !== 'visit'; });
      $$('.enquiry__only-enquiry', form).forEach((el) => { el.hidden = value !== 'enquiry'; });
      title.textContent = copy[value].title;
      intro.textContent = copy[value].intro;
      if (animate && motion) {
        gsap.fromTo([title, intro, ...$$('.enquiry__grid > .field:not([hidden])', form)],
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.04, overwrite: true });
      }
    };
    modeInputs.forEach((input) => input.addEventListener('change', () => setMode(mode(), true)));

    if (dateInput) {
      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      dateInput.min = today.toISOString().slice(0, 10);
    }

    // "Book a visit" links anywhere on the page open the form in visit mode
    $$('[data-visit]').forEach((link) => link.addEventListener('click', () => {
      setMode('visit');
      body.hidden = false;
      done.hidden = true;
    }));
    setMode(window.location.hash === '#visit' ? 'visit' : 'enquiry');

    const setError = (input, message) => {
      const field = input.closest('.field');
      field.classList.toggle('has-error', Boolean(message));
      input.setAttribute('aria-invalid', String(Boolean(message)));
      const slot = $('.field__error', field);
      if (slot) slot.textContent = message || '';
    };

    const validate = () => {
      const { name, email, phone } = form.elements;
      const errors = [];
      const check = (input, message) => { setError(input, message); if (message) errors.push(input); };
      check(name, name.value.trim().length < 2 ? 'Please enter your name.' : '');
      check(email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()) ? '' : 'Please enter a valid email address.');
      const digits = phone.value.replace(/\D/g, '');
      check(phone, phone.value.trim() && digits.length < 8 ? 'Please check this number.' : '');
      return errors;
    };

    ['name', 'email', 'phone'].forEach((key) => {
      form.elements[key].addEventListener('input', () => setError(form.elements[key], ''));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const errors = validate();
      if (errors.length) { errors[0].focus(); return; }

      const f = form.elements;
      const isVisit = mode() === 'visit';
      const rows = [
        ['Name', f.name.value],
        ['Email', f.email.value],
        ['Phone', f.phone.value],
        ['Grade sought', f.grade.value],
      ];
      if (isVisit) {
        rows.push(['Preferred date', f.date.value], ['Preferred time', f.time.value]);
      } else {
        rows.push(['Enquiry about', f.topic.value], ['Day scholar / boarder', f.residency.value]);
      }
      const lines = rows
        .filter(([, value]) => value.trim())
        .map(([label, value]) => `${label}: ${value.trim()}`);
      if (f.message.value.trim()) lines.push('', f.message.value.trim());

      const subject = isVisit ? 'Campus visit request' : `Enquiry — ${f.topic.value}`;
      window.location.href = `mailto:info@aaems.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;

      doneVisit.hidden = !isVisit;
      body.hidden = true;
      done.hidden = false;
      done.focus({ preventScroll: true });
      if (motion) gsap.from(done.children, { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.08 });
    });

    $('[data-enquiry-reset]', form).addEventListener('click', () => {
      done.hidden = true;
      body.hidden = false;
      form.elements.name.focus();
    });
  }

  /* ---- In-page anchors and page-to-page transition --------------------- */
  const loader = $('[data-loader]');
  const samePage = (url) =>
    url.pathname.replace(/index\.html$/, '') === window.location.pathname.replace(/index\.html$/, '');

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const url = new URL(link.href, window.location.href);
    if (!/^(https?|file):$/.test(url.protocol) || url.origin !== window.location.origin) return;

    if (samePage(url)) {
      if (!url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target);
      window.history.replaceState(null, '', url.hash);
      return;
    }

    if (!motion || !loader) return;
    e.preventDefault();
    $('[data-loader-count]', loader).textContent = '';
    gsap.set(loader, { autoAlpha: 1 });
    gsap.fromTo(loader, { yPercent: 100 }, {
      yPercent: 0,
      duration: 0.7,
      ease: 'expo.inOut',
      onComplete: () => { window.location.href = url.href; },
    });
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && motion && loader) gsap.set(loader, { yPercent: -100 });
  });

  /* ---- Footer year ----------------------------------------------------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ======================================================================
     MOTION
     ====================================================================== */
  const whenLoaded = new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
    window.setTimeout(resolve, 3000);
  });

  if (!motion) {
    root.classList.add('is-loaded');
    startHero();
    return;
  }

  /* ---- Cursor ----------------------------------------------------------- */
  const cursor = $('[data-cursor-el]');
  if (cursor && finePointer) {
    const label = $('[data-cursor-label]', cursor);
    const moveX = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' });
    const moveY = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' });
    window.addEventListener('mousemove', (e) => {
      cursor.classList.remove('is-hidden');
      moveX(e.clientX);
      moveY(e.clientY);
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('mouseover', (e) => {
      const labelled = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button, label, [role="tab"], .trip__panel');
      cursor.classList.toggle('is-active', Boolean(labelled));
      cursor.classList.toggle('is-link', Boolean(link) && !labelled);
      if (labelled) label.textContent = labelled.dataset.cursor;
    });
  }

  /* ---- Magnetic buttons -------------------------------------------------- */
  if (finePointer) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - (r.left + r.width / 2)) * 0.28,
          y: (e.clientY - (r.top + r.height / 2)) * 0.4,
          duration: 0.5,
          overwrite: 'auto',
        });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
      });
    });
  }

  /* ---- Marquee motion: speed and direction follow the scroll ------------ */
  marquees.forEach((m) => {
    const tracks = $$('.marquee__track', m.el);
    m.tween = gsap.fromTo(tracks,
      { xPercent: m.dir < 0 ? 0 : -100 },
      { xPercent: m.dir < 0 ? -100 : 0, duration: 26, ease: 'none', repeat: -1 });
    m.tween.totalTime(m.tween.duration() * 500); // room to run backwards
  });
  if (marquees.length) {
    let settle = null;
    ScrollTrigger.create({
      onUpdate(self) {
        const boost = clamp(Math.abs(self.getVelocity()) / 300, 0, 7);
        const sign = self.direction < 0 ? -1 : 1;
        marquees.forEach((m) => gsap.to(m.tween, { timeScale: sign * (1 + boost), duration: 0.25, overwrite: true }));
        if (settle) settle.kill();
        settle = gsap.delayedCall(0.25, () => {
          marquees.forEach((m) => gsap.to(m.tween, { timeScale: sign, duration: 1.2, overwrite: true }));
        });
      },
    });
  }

  /* ---- Hero: intro, then the arch opens as you scroll ------------------- */
  const intro = gsap.timeline({ paused: true });
  if (hero) {
    const win = $('[data-hero-window]', hero);
    const media = $('[data-hero-media]', hero);
    const copy = $('[data-hero-copy]', hero);
    const shade = $('[data-hero-shade]', hero);
    const motto = $('[data-hero-motto]', hero);
    const mottoWords = $$('.sw', motto);
    const extras = [$('[data-hero-badge]', hero), $('[data-hero-pager]', hero), $('[data-hero-scroll]', hero), $('.hero__lattice', hero)];

    intro
      .from('.site-header', { yPercent: -100, duration: 1.1, ease: 'expo.out', clearProps: 'transform' }, 0.25)
      .from($$('.hero__title .ch', hero), { yPercent: 125, rotate: 6, duration: 1.3, ease: 'expo.out', stagger: 0.024 }, 0.1)
      .from('.hero__eyebrow', { autoAlpha: 0, y: 20, duration: 0.9 }, 0.2)
      .from('.hero__visual', { autoAlpha: 0, yPercent: 14, duration: 1.6, ease: 'expo.out' }, 0.15)
      .from('.hero__slide img', { filter: 'blur(14px)', duration: 1.4, ease: 'power2.out', clearProps: 'filter' }, 0.15)
      .from('.hero__lead', { autoAlpha: 0, y: 30, duration: 1 }, 0.75)
      .from('.hero__actions > *', { autoAlpha: 0, y: 30, duration: 0.9, stagger: 0.1 }, 0.9)
      .from('.hero__badge-disc', { scale: 0, rotate: -160, duration: 1.4, ease: 'back.out(1.5)' }, 0.95)
      .from('.hero__pager, .hero__scroll', { autoAlpha: 0, y: 12, duration: 0.8 }, 1.25);

    const mm = gsap.matchMedia();

    mm.add('(min-width: 900px)', () => {
      const ARCH = 'inset(15vh 6vw 10vh 62vw round 16vw 16vw 0vw 0vw)';
      const FULL = 'inset(0vh 0vw 0vh 0vw round 0vw 0vw 0vw 0vw)';
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: '+=150%',
          pin: true,
          scrub: 0.7,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
      tl.fromTo(win, { clipPath: ARCH }, { clipPath: FULL, duration: 0.62, ease: 'power2.inOut' }, 0)
        .fromTo(media, { x: () => window.innerWidth * 0.28, scale: 1.12 }, { x: 0, scale: 1, duration: 0.62, ease: 'power2.inOut' }, 0)
        .to(copy, { yPercent: -14, autoAlpha: 0, duration: 0.26 }, 0)
        .to(extras, { autoAlpha: 0, duration: 0.2 }, 0)
        .fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.38)
        .fromTo($('.eyebrow', motto), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.52)
        .fromTo(mottoWords, { autoAlpha: 0, yPercent: 60, rotate: 4 }, { autoAlpha: 1, yPercent: 0, rotate: 0, duration: 0.16, stagger: 0.03, ease: 'power2.out' }, 0.55)
        .fromTo($('.hero__motto-sub', motto), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.86)
        .to({}, { duration: 0.08 });
    });

    mm.add('(max-width: 899px)', () => {
      gsap.fromTo(media, { yPercent: -4 }, {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: { trigger: win, start: 'top bottom', end: 'bottom top', scrub: true },
      });
      gsap.fromTo(mottoWords, { opacity: 0.14 }, {
        opacity: 1,
        stagger: 0.1,
        ease: 'none',
        scrollTrigger: { trigger: motto, start: 'top 80%', end: 'center 45%', scrub: true },
      });
    });
  }

  /* ---- Reusable scroll effects ------------------------------------------ */
  const delayOf = (el) => (parseFloat(el.style.getPropertyValue('--d')) || 0) / 1000;

  const applyEffects = (scope) => {
    $$('[data-split]', scope).forEach((el) => {
      gsap.from($$('.w__i', el), {
        yPercent: 120,
        rotate: 5,
        duration: 1.15,
        ease: 'expo.out',
        stagger: 0.055,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });

    $$('[data-reveal]', scope).forEach((el) => {
      const type = el.dataset.reveal;
      const st = { trigger: type === 'wipe' ? el.parentElement : el, start: 'top 88%', once: true };
      if (type === 'wipe') {
        gsap.fromTo(el,
          { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', delay: delayOf(el), scrollTrigger: st, clearProps: 'clipPath' });
        const img = $('img', el);
        if (img) gsap.from(img, { scale: 1.4, duration: 2.1, ease: 'expo.out', delay: delayOf(el), scrollTrigger: st });
      } else {
        gsap.from(el, {
          autoAlpha: 0,
          y: type === 'fade' ? 0 : 44,
          duration: 1.1,
          delay: delayOf(el),
          scrollTrigger: st,
        });
      }
    });

    $$('[data-stagger]', scope).forEach((el) => {
      gsap.from(el.children, {
        autoAlpha: 0,
        y: 36,
        duration: 0.9,
        stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });

    $$('.draw', scope).forEach((svg) => {
      gsap.fromTo($$('[pathLength]', svg),
        { strokeDasharray: 1, strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.18, scrollTrigger: { trigger: svg, start: 'top 90%', once: true } });
    });

    $$('[data-count]', scope).forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const state = { v: 0 };
      el.textContent = '0';
      gsap.to(state, {
        v: target,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(state.v); },
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      });
    });

    $$('[data-parallax-img]', scope).forEach((img) => {
      const frame = img.parentElement;
      gsap.fromTo(img, { y: 0 }, {
        y: () => -(img.offsetHeight - frame.offsetHeight),
        ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
    });

    $$('[data-drift]', scope).forEach((el) => {
      const dir = parseFloat(el.dataset.drift) || 1;
      gsap.fromTo(el, { xPercent: -14 * dir }, {
        xPercent: 14 * dir,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    });

    $$('[data-rotate]', scope).forEach((el) => {
      gsap.fromTo(el, { rotate: 0 }, {
        rotate: 90,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    });

    $$('ol.thread', scope).forEach((el) => {
      gsap.fromTo(el, { '--p': 0 }, {
        '--p': 1,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 55%', scrub: 0.5 },
      });
      gsap.from(el.children, {
        autoAlpha: 0,
        x: 30,
        duration: 0.9,
        stagger: 0.18,
        scrollTrigger: { trigger: el, start: 'top 82%', once: true },
      });
    });
  };

  /* ---- Section-specific effects ----------------------------------------- */
  const sectionEffects = {
    pillars(scope) {
      gsap.from($$('.trip__panel', scope), {
        autoAlpha: 0,
        y: 90,
        duration: 1.3,
        ease: 'expo.out',
        stagger: 0.12,
        scrollTrigger: { trigger: $('.trip', scope), start: 'top 85%', once: true },
      });
    },

    academics(scope) {
      gsap.from($$('.stage__list li', scope), {
        autoAlpha: 0,
        x: -24,
        duration: 0.7,
        stagger: 0.06,
        scrollTrigger: { trigger: $('.stages', scope), start: 'top 65%', once: true },
      });
    },

    // The campus section pins and vertical scroll drives the row sideways
    campus(scope) {
      const pin = $('[data-hscroll]', scope);
      const track = $('[data-hscroll-track]', scope);
      const bar = $('[data-hscroll-bar]', scope);
      const ghost = $('[data-hscroll-ghost]', scope);
      const cards = $$('.hcard', track);

      const mm = gsap.matchMedia();
      mm.add('(min-width: 960px) and (min-height: 620px)', () => {
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const slide = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress.toFixed(4)})`; },
          },
        });
        gsap.fromTo(ghost, { x: () => window.innerWidth * 0.2 }, {
          x: () => -distance() * 0.35,
          ease: 'none',
          scrollTrigger: { trigger: pin, start: 'top top', end: () => `+=${distance()}`, scrub: 0.8, invalidateOnRefresh: true },
        });
        cards.forEach((card) => {
          const img = $('.hcard__media img', card);
          if (img) {
            gsap.fromTo(img, { xPercent: 6 }, {
              xPercent: -6,
              ease: 'none',
              scrollTrigger: { trigger: card, containerAnimation: slide, start: 'left right', end: 'right left', scrub: true },
            });
          }
          gsap.from(card, {
            autoAlpha: 0,
            y: 70,
            rotate: 3,
            duration: 1,
            scrollTrigger: { trigger: card, containerAnimation: slide, start: 'left 96%', once: true },
          });
        });
      });

      mm.add('(max-width: 959px), (max-height: 619px)', () => {
        gsap.from(cards, {
          autoAlpha: 0,
          x: 60,
          duration: 0.9,
          stagger: 0.08,
          scrollTrigger: { trigger: track, start: 'top 85%', once: true },
        });
      });
    },

    gallery(scope) {
      const items = $$('.g-item', scope);
      gsap.set(items, { autoAlpha: 0, y: 50, scale: 0.95 });
      ScrollTrigger.batch(items, {
        start: 'top 94%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, scale: 1, duration: 0.95, stagger: 0.07, overwrite: true }),
      });
    },

    admissions(scope) {
      gsap.from($$('.steps li', scope), {
        autoAlpha: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.1,
        scrollTrigger: { trigger: $('.steps', scope), start: 'top 88%', once: true },
      });
    },
  };

  // Build triggers in document order so pinned sections measure correctly.
  $$('main > *, .site-footer').forEach((scope) => {
    if (scope === hero) return;
    Object.keys(sectionEffects).forEach((name) => {
      if (scope.classList.contains(name)) sectionEffects[name](scope);
    });
    applyEffects(scope);
  });

  /* ---- Loader, then the intro ------------------------------------------- */
  const reveal = () => {
    root.classList.add('is-loaded');
    intro.play();
    startHero();
    ScrollTrigger.refresh();
  };

  if (loader) {
    const countEl = $('[data-loader-count]', loader);
    const state = { v: 0 };
    const counted = new Promise((resolve) => {
      gsap.to(state, {
        v: 100,
        duration: 1.5,
        ease: 'power2.inOut',
        onUpdate: () => { countEl.textContent = Math.round(state.v); },
        onComplete: resolve,
      });
    });
    Promise.all([counted, whenLoaded]).then(() => {
      gsap.timeline()
        .to(loader.children, { autoAlpha: 0, y: -30, duration: 0.45, stagger: 0.05, ease: 'power2.in' })
        .to(loader, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, 0.3)
        .add(reveal, 0.55)
        .set(loader.children, { autoAlpha: 1, y: 0 });
    });
  } else {
    whenLoaded.then(reveal);
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
