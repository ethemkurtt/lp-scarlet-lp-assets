/* =============================================================
   ELIT KLINIK - ALL-IN-ONE JS
   =============================================================
   Sections:
   1. Mobile Hamburger Menu
   2. Before/After Slider (click+drag only)
   3. Simulation Video Modal
   4. Steps Tabs
   5. Videos Section (inline play)
   6. FAQ Accordion
   ============================================================= */

document.addEventListener('DOMContentLoaded', function () {

  /* =============================================================
     SCARLET — swap hero bg image on mobile
     ============================================================= */
  (function swapScarletHeroBg() {
    var DESKTOP_BG = 'https://lp.elitklinik.com.tr/wp-content/uploads/2026/04/scarletx-kapak.webp';
    var MOBILE_BG  = 'https://lp.elitklinik.com.tr/wp-content/uploads/2026/04/kapak2.png';
    var bg = document.querySelector('.sx-hero__bg');
    if (!bg) return;
    function apply() {
      var isMobile = window.matchMedia('(max-width: 1024px)').matches;
      var target = isMobile ? MOBILE_BG : DESKTOP_BG;
      if (bg.getAttribute('src') !== target) bg.setAttribute('src', target);
    }
    apply();
    window.addEventListener('resize', apply);
  })();

  /* =============================================================
     GLOBAL REDIRECTS — always active, regardless of modals on page
     ============================================================= */
  document.querySelectorAll('[data-open-quiz], [data-open-contact]').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      window.open('https://lp.elitklinik.com.tr/rn-calc/', '_blank', 'noopener,noreferrer');
    });
  });

  /* =============================================================
     TOAST NOTIFICATION
     ============================================================= */
  function showToast(message, type) {
    type = type || 'success';
    var existing = document.querySelector('.ek-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'ek-toast ek-toast--' + type;

    var icon = type === 'success'
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" stroke="#34A853" stroke-width="2"/><path d="M7 12.5l3 3 7-7" stroke="#34A853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" stroke="#E53935" stroke-width="2"/><path d="M12 7v6M12 16v1" stroke="#E53935" stroke-width="2" stroke-linecap="round"/></svg>';

    toast.innerHTML = '<div class="ek-toast__icon">' + icon + '</div><span class="ek-toast__text">' + message + '</span>';
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function () {
      toast.classList.add('active');
    });

    // Auto dismiss
    setTimeout(function () {
      toast.classList.remove('active');
      setTimeout(function () { toast.remove(); }, 400);
    }, 4000);
  }

  /* =============================================================
     WEBHOOK: Secure form submission to Zapier
     - Sanitizes all input (strips HTML, control chars, length-limits)
     - Rate-limits to prevent spam/abuse (5s cooldown per session)
     - Disables submit button during request (no double-submit)
     - Adds timeout (12s) with AbortController
     - No sensitive data logged; no inline HTML from user input
     ============================================================= */

  var EK_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/19412362/uj6gtcl/';
  var EK_LAST_SUBMIT = 0;
  var EK_COOLDOWN_MS = 5000;

  function ekSanitizeStr(value, maxLen) {
    if (value === null || value === undefined) return '';
    maxLen = maxLen || 500;
    var str = String(value);
    // Strip HTML tags
    str = str.replace(/<[^>]*>/g, '');
    // Remove control characters except standard whitespace
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    str = str.trim();
    if (str.length > maxLen) str = str.substring(0, maxLen);
    return str;
  }

  function ekSanitizePayload(obj) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    var keys = Object.keys(obj).slice(0, 50); // cap key count
    keys.forEach(function (key) {
      var safeKey = ekSanitizeStr(key, 80);
      if (!safeKey) return;
      var val = obj[key];
      if (val === null || val === undefined) {
        out[safeKey] = '';
      } else if (typeof val === 'boolean' || typeof val === 'number') {
        out[safeKey] = val;
      } else if (Array.isArray(val)) {
        out[safeKey] = val.slice(0, 30).map(function (v) {
          return typeof v === 'string' ? ekSanitizeStr(v, 1000)
               : (v && typeof v === 'object') ? ekSanitizePayload(v)
               : v;
        });
      } else if (typeof val === 'object') {
        out[safeKey] = ekSanitizePayload(val);
      } else {
        out[safeKey] = ekSanitizeStr(val, 2000);
      }
    });
    return out;
  }

  function ekSubmitWebhook(type, data, button) {
    var now = Date.now();
    if (now - EK_LAST_SUBMIT < EK_COOLDOWN_MS) {
      showToast('Lütfen birkaç saniye bekleyip tekrar deneyin.', 'error');
      return Promise.reject(new Error('rate_limited'));
    }
    EK_LAST_SUBMIT = now;

    var payload = ekSanitizePayload(data || {});
    payload.type = ekSanitizeStr(type, 64);
    payload.submitted_at = new Date().toISOString();
    payload.page_url = (location.origin + location.pathname);
    payload.source = 'elit-klinik-website';

    if (button) {
      button.setAttribute('disabled', 'disabled');
      button.setAttribute('data-loading', '1');
    }

    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;

    // no-cors mode: avoids CORS preflight issues with Zapier hooks.
    // Browser downgrades Content-Type to text/plain, but Zapier still parses
    // JSON-looking bodies correctly. Response is opaque (cannot be read) —
    // that's fine for fire-and-forget form submissions.
    var fetchOpts = {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload)
    };
    if (controller) fetchOpts.signal = controller.signal;

    return fetch(EK_WEBHOOK_URL, fetchOpts).then(function (res) {
      if (timeoutId) clearTimeout(timeoutId);
      return res;
    }).catch(function (err) {
      if (timeoutId) clearTimeout(timeoutId);
      // Reset rate limit on failure so user can retry
      EK_LAST_SUBMIT = 0;
      throw err;
    }).then(function (r) {
      if (button) {
        button.removeAttribute('disabled');
        button.removeAttribute('data-loading');
      }
      return r;
    }, function (e) {
      if (button) {
        button.removeAttribute('disabled');
        button.removeAttribute('data-loading');
      }
      throw e;
    });
  }

  /* =============================================================
     1. MOBILE HAMBURGER MENU
     ============================================================= */

  var toggle = document.querySelector('.ek-header__mobile-toggle');
  var right = document.querySelector('.ek-header__right');

  if (toggle && right) {
    toggle.addEventListener('click', function () {
      right.classList.toggle('active');
    });
  }


  /* =============================================================
     2. BEFORE/AFTER SLIDER (click + drag only, no hover)
     ============================================================= */

  var slider = document.querySelector('.ek-results__slider');

  if (slider) {
    var afterImg = slider.querySelector('.ek-results__after');
    var handle = slider.querySelector('.ek-results__handle');
    var isDragging = false;
    var rafId = null;
    var currentX = 0;

    function updateSlider() {
      var rect = slider.getBoundingClientRect();
      var pos = (currentX - rect.left) / rect.width;
      pos = Math.max(0.02, Math.min(0.98, pos));
      var percent = pos * 100;

      afterImg.style.clipPath = 'inset(0 0 0 ' + percent + '%)';
      handle.style.left = percent + '%';
      rafId = null;
    }

    function requestUpdate(x) {
      currentX = x;
      if (!rafId) {
        rafId = requestAnimationFrame(updateSlider);
      }
    }

    handle.style.pointerEvents = 'auto';
    handle.style.cursor = 'ew-resize';

    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      isDragging = true;
    });

    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      e.preventDefault();
      requestUpdate(e.clientX);
    });

    document.addEventListener('mouseup', function () {
      isDragging = false;
    });

    handle.addEventListener('touchstart', function (e) {
      isDragging = true;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!isDragging) return;
      requestUpdate(e.touches[0].clientX);
    }, { passive: true });

    document.addEventListener('touchend', function () {
      isDragging = false;
    });
  }

  /* Results thumbs - NO modal, just static */


  /* =============================================================
     3. SIMULATION VIDEO - INLINE PLAY (no modal)
     ============================================================= */

  var simVideoWrap = document.querySelector('.ek-simulation__video');

  if (simVideoWrap) {

    // Convert <video> with YouTube URL to <iframe> on load
    (function () {
      var video = simVideoWrap.querySelector('video');
      if (!video) return;
      var src = video.getAttribute('src') || '';
      if (src.indexOf('youtube.com') === -1 && src.indexOf('youtu.be') === -1) return;

      var embedUrl = src;
      if (src.indexOf('youtu.be/') !== -1) {
        var vid = src.split('youtu.be/')[1].split('?')[0];
        embedUrl = 'https://www.youtube.com/embed/' + vid;
      } else if (src.indexOf('/watch?v=') !== -1) {
        var vid2 = src.split('v=')[1].split('&')[0];
        embedUrl = 'https://www.youtube.com/embed/' + vid2;
      }
      var iframe = document.createElement('iframe');
      iframe.setAttribute('data-src', embedUrl);
      iframe.setAttribute('allow', 'autoplay; encrypted-media');
      iframe.setAttribute('allowfullscreen', '');
      iframe.style.display = 'none';
      video.parentNode.replaceChild(iframe, video);
    })();

    simVideoWrap.addEventListener('click', function () {
      if (this.classList.contains('playing')) return;

      // Native <video> element
      var video = this.querySelector('video');
      if (video) {
        this.classList.add('playing');
        video.play();
        return;
      }

      // YouTube <iframe> embed
      var iframe = this.querySelector('iframe');
      if (iframe) {
        var src = iframe.getAttribute('data-src') || iframe.getAttribute('src');
        if (src) {
          if (src.indexOf('autoplay=1') === -1) {
            src += (src.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1';
          }
          iframe.src = src;
          iframe.style.display = 'block';
        }
        this.classList.add('playing');
      }
    });
  }


  /* =============================================================
     4. STEPS TABS
     ============================================================= */

  var tabs = document.querySelectorAll('.ek-steps__tab');
  var panels = document.querySelectorAll('.ek-steps__panel');

  if (tabs.length && panels.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = this.getAttribute('data-step');

        tabs.forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');

        panels.forEach(function (p) {
          if (p.getAttribute('data-step') === target) {
            p.classList.add('active');
            p.style.opacity = '0';
            requestAnimationFrame(function () {
              p.style.transition = 'opacity 0.3s ease';
              p.style.opacity = '1';
            });
          } else {
            p.classList.remove('active');
          }
        });
      });
    });
  }


  /* =============================================================
     5. VIDEOS SECTION - INLINE PLAY (no modal)
     ============================================================= */

  var videoCards = document.querySelectorAll('.ek-videos__card');

  if (videoCards.length) {

    // Convert <video> with YouTube URLs to <iframe> on page load
    videoCards.forEach(function (card) {
      var video = card.querySelector('video');
      if (video) {
        var src = video.getAttribute('src') || '';
        if (src.indexOf('youtube.com') !== -1 || src.indexOf('youtu.be') !== -1) {
          // Convert youtu.be/ID to youtube.com/embed/ID
          var embedUrl = src;
          if (src.indexOf('youtu.be/') !== -1) {
            var vid = src.split('youtu.be/')[1].split('?')[0];
            embedUrl = 'https://www.youtube.com/embed/' + vid;
          } else if (src.indexOf('/watch?v=') !== -1) {
            var vid = src.split('v=')[1].split('&')[0];
            embedUrl = 'https://www.youtube.com/embed/' + vid;
          }
          var iframe = document.createElement('iframe');
          iframe.setAttribute('data-src', embedUrl);
          iframe.setAttribute('allow', 'autoplay; encrypted-media');
          iframe.setAttribute('allowfullscreen', '');
          iframe.style.display = 'none';
          video.parentNode.replaceChild(iframe, video);
        }
      }
    });

    videoCards.forEach(function (card) {
      card.addEventListener('click', function () {

        // Native <video> element
        var video = this.querySelector('video');
        if (video) {
          if (this.classList.contains('playing')) {
            video.pause();
            this.classList.remove('playing');
          } else {
            this.classList.add('playing');
            video.play();
          }
          return;
        }

        // YouTube <iframe> embed
        var iframe = this.querySelector('iframe');
        if (iframe) {
          if (this.classList.contains('playing')) return;
          var src = iframe.getAttribute('data-src') || iframe.getAttribute('src');
          if (src) {
            if (src.indexOf('autoplay=1') === -1) {
              src += (src.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1';
            }
            iframe.src = src;
            iframe.style.display = 'block';
          }
          this.classList.add('playing');
        }
      });
    });
  }


  /* =============================================================
     6. FAQ ACCORDION
     ============================================================= */

  var faqItems = document.querySelectorAll('.ek-faq__item');

  if (faqItems.length) {
    faqItems.forEach(function (item) {
      var question = item.querySelector('.ek-faq__question');
      var answer = item.querySelector('.ek-faq__answer');

      if (question && answer) {
        question.addEventListener('click', function () {
          var isOpen = item.classList.contains('active');

          faqItems.forEach(function (i) {
            i.classList.remove('active');
            i.querySelector('.ek-faq__answer').style.maxHeight = '0';
          });

          if (!isOpen) {
            item.classList.add('active');
            answer.style.maxHeight = answer.scrollHeight + 'px';
          }
        });
      }
    });

    // Open first item by default
    var firstItem = faqItems[0];
    if (firstItem) {
      firstItem.classList.add('active');
      var firstAnswer = firstItem.querySelector('.ek-faq__answer');
      if (firstAnswer) {
        firstAnswer.style.maxHeight = firstAnswer.scrollHeight + 'px';
      }
    }
  }


  /* =============================================================
     7. QUIZ MODAL
     ============================================================= */

  var quiz = document.querySelector('.ek-quiz');

  if (quiz) {
    // Move quiz to <body> so position:fixed isn't broken by
    // transformed Elementor ancestors
    if (quiz.parentNode !== document.body) {
      document.body.appendChild(quiz);
    }

    var quizSteps = quiz.querySelectorAll('.ek-quiz__step');
    var progressSteps = quiz.querySelectorAll('.ek-quiz__progress > .ek-quiz__progress-step');
    var backBtn = quiz.querySelector('.ek-quiz__back');
    var closeBtn = quiz.querySelector('.ek-quiz__close');
    var currentStep = 0;
    var answers = {};

    function showStep(idx) {
      currentStep = idx;
      quizSteps.forEach(function (s, i) {
        s.classList.toggle('active', i === idx);
      });

      // Progress bar
      progressSteps.forEach(function (p, i) {
        p.classList.remove('active', 'done');
        if (i < idx) p.classList.add('done');
        if (i === idx) p.classList.add('active');
      });

      // Back button visibility
      if (backBtn) {
        backBtn.classList.toggle('hidden', idx === 0);
      }

      // Generate QR when reaching the upload step (last step)
      if (idx === quizSteps.length - 1) {
        generateUploadQR();
      }
    }

    function generateUploadQR() {
      var qrImg = quiz.querySelector('.ek-quiz__upload-qr-img');
      if (!qrImg) return;

      // Build quiz data from answers (only text answers, not files)
      var textAnswers = {};
      Object.keys(answers).forEach(function (key) {
        if (typeof answers[key] === 'string') {
          textAnswers[key] = answers[key];
        }
      });

      var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(textAnswers))));
      var currentUrl = window.location.origin + window.location.pathname;
      var qrUrl = currentUrl + '?quiz_data=' + encoded;

      qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrUrl);
    }

    function openQuiz() {
      // Re-parent to body every time in case Elementor re-wrapped it
      if (quiz.parentNode !== document.body) {
        document.body.appendChild(quiz);
      }
      quiz.classList.add('active');
      document.body.classList.add('ek-quiz-open');
      document.documentElement.classList.add('ek-quiz-open');
      window.scrollTo(0, 0);
      showStep(0);
    }

    function closeQuiz() {
      quiz.classList.remove('active');
      document.body.classList.remove('ek-quiz-open');
      document.documentElement.classList.remove('ek-quiz-open');
    }

    // Check URL for quiz_data (phone scanned QR)
    var urlParams = new URLSearchParams(window.location.search);
    var quizData = urlParams.get('quiz_data');
    if (quizData) {
      try {
        var decoded = JSON.parse(decodeURIComponent(escape(atob(quizData))));
        // Load answers
        Object.keys(decoded).forEach(function (key) {
          answers[key] = decoded[key];
        });

        // Mark previous step options as selected
        quizSteps.forEach(function (step, stepIdx) {
          var savedAnswer = answers['step' + (stepIdx + 1)];
          if (savedAnswer) {
            step.querySelectorAll('.ek-quiz__option').forEach(function (opt) {
              if (opt.textContent.trim() === savedAnswer) {
                opt.classList.add('selected');
              }
            });
          }
        });

        // Fill form fields if they exist
        var formInputs = quiz.querySelectorAll('.ek-quiz__form input');
        formInputs.forEach(function (input) {
          if (input.type === 'checkbox') {
            if (answers[input.name]) input.checked = true;
          } else if (answers[input.name]) {
            input.value = answers[input.name];
          }
        });

        // Update phone code if saved
        if (answers['phone_code']) {
          var phoneCode = quiz.querySelector('.ek-quiz__phone-code');
          if (phoneCode) phoneCode.textContent = answers['phone_code'];
        }

        // Open quiz directly at upload step
        if (quiz.parentNode !== document.body) {
          document.body.appendChild(quiz);
        }
        quiz.classList.add('active');
        document.body.classList.add('ek-quiz-open');
        document.documentElement.classList.add('ek-quiz-open');
        showStep(quizSteps.length - 1);

        // Trigger form ready check after filling (delay so DOM is ready)
        setTimeout(function () {
          checkFormReady();
        }, 200);

        // Clean URL without reload
        var cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {
        console.warn('Invalid quiz data in URL');
      }
    }

    // Open quiz triggers handled at top of file (global redirect)

    // Close quiz
    if (closeBtn) {
      closeBtn.addEventListener('click', closeQuiz);
    }

    // Back button
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (currentStep > 0) {
          showStep(currentStep - 1);
        }
      });
    }

    // Option click → save answer + go next
    quiz.querySelectorAll('.ek-quiz__option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        var step = this.closest('.ek-quiz__step');
        var stepIdx = Array.prototype.indexOf.call(quizSteps, step);

        // Mark selected
        step.querySelectorAll('.ek-quiz__option').forEach(function (o) {
          o.classList.remove('selected');
        });
        this.classList.add('selected');

        // Save answer
        answers['step' + (stepIdx + 1)] = this.textContent.trim();

        // Go to next after brief delay
        setTimeout(function () {
          if (stepIdx < quizSteps.length - 1) {
            showStep(stepIdx + 1);
          }
        }, 300);
      });
    });

    // Quiz phone country dropdown
    var quizPhoneSelect = quiz.querySelector('.ek-quiz__phone-select');
    if (quizPhoneSelect) {
      quizPhoneSelect.addEventListener('click', function (e) {
        e.stopPropagation();
        var dd = this.closest('.ek-quiz__phone-wrap').querySelector('.ek-quiz__country-dropdown');
        if (dd) dd.classList.toggle('open');
      });
    }

    quiz.querySelectorAll('.ek-quiz__country-option').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = this.closest('.ek-quiz__phone-wrap');
        var flag = wrap.querySelector('.ek-quiz__phone-flag');
        var code = wrap.querySelector('.ek-quiz__phone-code');
        if (flag) flag.src = this.querySelector('img').src;
        if (code) code.textContent = this.getAttribute('data-code');
        this.closest('.ek-quiz__country-dropdown').classList.remove('open');
      });
    });

    // Close quiz dropdowns on outside click
    document.addEventListener('click', function () {
      var dd = quiz.querySelector('.ek-quiz__country-dropdown.open');
      if (dd) dd.classList.remove('open');
    });

    // Form submit
    var quizForm = quiz.querySelector('.ek-quiz__form');
    var quizSubmitBtn = quizForm ? quizForm.querySelector('.ek-quiz__submit') : null;

    // Check if all required fields are filled (quiz-scope function)
    function checkFormReady() {
      if (!quizForm) return;
      var allFilled = true;
      quizForm.querySelectorAll('input[required]').forEach(function (input) {
        if (input.type === 'checkbox') {
          if (!input.checked) allFilled = false;
        } else {
          if (!input.value.trim()) allFilled = false;
        }
      });
      if (quizSubmitBtn) {
        quizSubmitBtn.classList.toggle('ready', allFilled);
      }
    }

    if (quizForm) {
      // Listen to all inputs
      quizForm.querySelectorAll('input').forEach(function (input) {
        input.addEventListener('input', checkFormReady);
        input.addEventListener('change', checkFormReady);
      });

      quizForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (quizSubmitBtn && !quizSubmitBtn.classList.contains('ready')) return;

        var formData = new FormData(quizForm);
        formData.forEach(function (value, key) {
          answers[key] = value;
        });

        console.log('Quiz answers:', answers);

        // Go to next step (photo upload)
        var formStep = quizForm.closest('.ek-quiz__step');
        var formStepIdx = Array.prototype.indexOf.call(quizSteps, formStep);
        if (formStepIdx < quizSteps.length - 1) {
          showStep(formStepIdx + 1);
        }
      });
    }

    /* ---- Photo Upload Step ---- */
    var uploadInput = quiz.querySelector('.ek-quiz__upload-input');
    var angleCards = quiz.querySelectorAll('.ek-quiz__upload-angle');
    var uploadSubmit = quiz.querySelector('.ek-quiz__upload-submit');
    var activeAngleCard = null;

    // Mobile: remove any capture attr so OS shows camera + gallery picker
    if (uploadInput) {
      uploadInput.removeAttribute('capture');
    }

    function checkUploadReady() {
      var allUploaded = true;
      angleCards.forEach(function (card) {
        if (!card.classList.contains('uploaded')) allUploaded = false;
      });
      if (uploadSubmit) {
        uploadSubmit.classList.toggle('ready', allUploaded);
      }
    }

    // Click angle card → open file picker
    angleCards.forEach(function (card) {
      card.addEventListener('click', function (e) {
        // Don't open picker if clicking the remove button
        if (e.target.closest('.ek-quiz__upload-angle-remove')) return;
        if (this.classList.contains('uploaded')) return;
        activeAngleCard = this;
        if (uploadInput) uploadInput.click();
      });
    });

    // File input change
    if (uploadInput) {
      uploadInput.addEventListener('change', function () {
        if (!this.files.length || !activeAngleCard) return;
        var file = this.files[0];
        if (!file.type.startsWith('image/')) return;

        var card = activeAngleCard;
        var angleName = card.getAttribute('data-angle');
        answers[angleName] = file;

        // Read and show preview
        var reader = new FileReader();
        reader.onload = function (e) {
          // Hide icon and label
          var icon = card.querySelector('.ek-quiz__upload-angle-icon');
          var label = card.querySelector('.ek-quiz__upload-angle-label');
          if (icon) icon.style.display = 'none';
          if (label) label.style.display = 'none';

          // Create preview wrapper
          var previewWrap = document.createElement('div');
          previewWrap.className = 'ek-quiz__upload-angle-preview';

          var img = document.createElement('img');
          img.src = e.target.result;

          var removeBtn = document.createElement('button');
          removeBtn.className = 'ek-quiz__upload-angle-remove';
          removeBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M4 12l8-8" stroke="#FFF" stroke-width="1.5" stroke-linecap="round"/></svg>';
          removeBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            // Remove preview, restore icon/label
            previewWrap.remove();
            if (icon) icon.style.display = '';
            if (label) label.style.display = '';
            card.classList.remove('uploaded');
            delete answers[angleName];
            checkUploadReady();
          });

          previewWrap.appendChild(img);
          previewWrap.appendChild(removeBtn);
          card.appendChild(previewWrap);
          card.classList.add('uploaded');
          checkUploadReady();
        };
        reader.readAsDataURL(file);

        // Reset
        this.value = '';
        activeAngleCard = null;
      });
    }

    // Final submit button (step 8)
    if (uploadSubmit) {
      uploadSubmit.addEventListener('click', function () {
        if (!this.classList.contains('ready')) return;
        console.log('Final quiz answers:', answers);
        // TODO: Send to backend / webhook
        showToast('Teşekkürler! En kısa sürede sizinle iletişime geçeceğiz.', 'success');
        closeQuiz();
      });
    }
  }


  /* =============================================================
     8. CONTACT SLIDE-IN PANEL
     ============================================================= */

  var contactPanel = document.querySelector('.ek-contact');
  var contactOverlay = document.querySelector('.ek-contact__overlay');

  if (contactPanel) {
    // Move to body
    if (contactPanel.parentNode !== document.body) {
      document.body.appendChild(contactPanel);
    }
    if (contactOverlay && contactOverlay.parentNode !== document.body) {
      document.body.appendChild(contactOverlay);
    }

    function openContact() {
      if (contactPanel.parentNode !== document.body) {
        document.body.appendChild(contactPanel);
      }
      if (contactOverlay && contactOverlay.parentNode !== document.body) {
        document.body.appendChild(contactOverlay);
      }
      // Force reflow for transition
      contactPanel.style.display = 'flex';
      contactPanel.offsetHeight;
      contactPanel.classList.add('active');
      if (contactOverlay) contactOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeContact() {
      contactPanel.classList.remove('active');
      if (contactOverlay) contactOverlay.classList.remove('active');
      document.body.style.overflow = '';
      setTimeout(function () {
        if (!contactPanel.classList.contains('active')) {
          contactPanel.style.display = 'none';
        }
      }, 350);
    }

    // Open contact triggers handled at top of file (global redirect)

    // Close button
    var contactClose = contactPanel.querySelector('.ek-contact__close');
    if (contactClose) {
      contactClose.addEventListener('click', closeContact);
    }

    // Overlay click closes
    if (contactOverlay) {
      contactOverlay.addEventListener('click', closeContact);
    }

    // Tab switching with content
    var contactTabs = contactPanel.querySelectorAll('.ek-contact__tab');
    var contactTabContents = contactPanel.querySelectorAll('.ek-contact__tab-content');
    contactTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        contactTabs.forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        var targetTab = this.getAttribute('data-tab');
        contactTabContents.forEach(function (tc) {
          tc.classList.toggle('active', tc.getAttribute('data-tab') === targetTab);
        });
      });
    });

    // Radio selection
    var contactRadios = contactPanel.querySelectorAll('.ek-contact__radio');
    contactRadios.forEach(function (radio) {
      radio.addEventListener('click', function () {
        contactRadios.forEach(function (r) { r.classList.remove('selected'); });
        this.classList.add('selected');
      });
    });

    // Country dropdown
    contactPanel.querySelectorAll('.ek-contact__phone-select').forEach(function (sel) {
      sel.addEventListener('click', function (e) {
        e.stopPropagation();
        var dd = this.querySelector('.ek-contact__country-dropdown');
        if (dd) dd.classList.toggle('open');
      });
    });

    contactPanel.querySelectorAll('.ek-contact__country-option').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = this.closest('.ek-contact__phone');
        var flag = wrap.querySelector('.ek-contact__phone-flag');
        var code = wrap.querySelector('.ek-contact__phone-code');
        flag.src = this.querySelector('img').src;
        code.textContent = this.getAttribute('data-code');
        this.closest('.ek-contact__country-dropdown').classList.remove('open');
      });
    });

    // Time slot picker
    contactPanel.querySelectorAll('.ek-contact__time-trigger').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var dd = this.closest('.ek-contact__time-wrap').querySelector('.ek-contact__time-dropdown');
        if (dd) dd.classList.toggle('open');
      });
    });

    contactPanel.querySelectorAll('.ek-contact__time-slot').forEach(function (slot) {
      slot.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = this.closest('.ek-contact__time-wrap');
        wrap.querySelectorAll('.ek-contact__time-slot').forEach(function (s) { s.classList.remove('selected'); });
        this.classList.add('selected');
        var input = wrap.querySelector('.ek-contact__time-hidden');
        if (input) input.value = this.textContent.trim();
        var label = wrap.querySelector('.ek-contact__time-label');
        if (label) label.textContent = this.textContent.trim();
        this.closest('.ek-contact__time-dropdown').classList.remove('open');
      });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', function () {
      contactPanel.querySelectorAll('.ek-contact__country-dropdown.open, .ek-contact__time-dropdown.open').forEach(function (dd) {
        dd.classList.remove('open');
      });
    });

    // Mark district input as required (common required field)
    contactPanel.querySelectorAll('.ek-contact__form input[name="ilce"]').forEach(function (input) {
      input.setAttribute('required', 'required');
    });

    // Form validation + submit
    contactPanel.querySelectorAll('.ek-contact__form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var valid = true;
        form.querySelectorAll('.ek-contact__field').forEach(function (field) {
          field.classList.remove('has-error');
          var input = field.querySelector('input[required]');
          if (input && !input.value.trim()) {
            field.classList.add('has-error');
            valid = false;
          }
        });
        if (!valid) return;

        var formData = new FormData(form);
        var data = {};
        formData.forEach(function (val, key) { data[key] = val; });

        var selectedRadio = form.querySelector('.ek-contact__radio.selected .ek-contact__radio-label');
        if (selectedRadio) data.gender = selectedRadio.textContent.trim();

        var phoneCodeEl = form.querySelector('.ek-contact__phone-code');
        if (phoneCodeEl) data.phone_country_code = phoneCodeEl.textContent.trim();

        // Detect form type from parent tab-content
        var tabContent = form.closest('.ek-contact__tab-content');
        var tabName = tabContent ? tabContent.getAttribute('data-tab') : '';
        var webhookType = (tabName === 'appointment') ? 'appointment_request' : 'callback_request';

        // Unified payload — same keys for every form.
        // Common fields (always filled): full_name, email, phone, district
        // Optional fields (may be empty): gender, appointment_date, appointment_time
        var fullName = ((data.ad || '') + ' ' + (data.soyad || '')).trim();
        // Combine country code + phone, strip all whitespace/non-digit-plus chars
        // Example output: "+905336639861"
        var rawPhone = (data.phone_country_code || '') + (data.telefon || '');
        var combinedPhone = rawPhone.replace(/[^\d+]/g, '');

        var mapped = {
          full_name: fullName,
          email: (data.eposta || data.email || '').trim().toLowerCase(),
          phone: combinedPhone,
          district: data.ilce || '',
          gender: data.gender || '',
          appointment_date: data.gun || '',
          appointment_time: data.saat || ''
        };

        var submitBtn = form.querySelector('.ek-contact__submit');

        ekSubmitWebhook(webhookType, mapped, submitBtn).then(function () {
          showToast('Teşekkürler! En kısa sürede sizinle iletişime geçeceğiz.', 'success');
          form.reset();
          // Reset radio visual state
          form.querySelectorAll('.ek-contact__radio').forEach(function (r, i) {
            r.classList.toggle('selected', i === 1);
          });
          // Reset time label if present
          var timeLabel = form.querySelector('.ek-contact__time-label');
          if (timeLabel) timeLabel.textContent = 'Saat seçiniz.';
          closeContact();
        }).catch(function (err) {
          if (err && err.message === 'rate_limited') return;
          showToast('Gönderim sırasında bir hata oluştu. Lütfen tekrar deneyin.', 'error');
        });
      });
    });
  }


  /* =============================================================
     GLOBAL: Escape key closes any active modal
     ============================================================= */

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var quizModal = document.querySelector('.ek-quiz.active');
    if (quizModal) {
      quizModal.classList.remove('active');
      document.body.classList.remove('ek-quiz-open');
      document.documentElement.classList.remove('ek-quiz-open');
    }
    // Also close contact panel
    var contactActive = document.querySelector('.ek-contact.active');
    if (contactActive) {
      contactActive.classList.remove('active');
      var overlay = document.querySelector('.ek-contact__overlay.active');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

});
