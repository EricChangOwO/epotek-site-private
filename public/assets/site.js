(function(){
  var turnstileLoader;

  function loadTurnstile(){
    if(window.turnstile) return Promise.resolve(window.turnstile);
    if(turnstileLoader) return turnstileLoader;

    turnstileLoader = new Promise(function(resolve, reject){
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = function(){
        if(window.turnstile) resolve(window.turnstile);
        else reject(new Error('Turnstile did not initialize.'));
      };
      script.onerror = function(){ reject(new Error('Unable to load Turnstile.')); };
      document.head.appendChild(script);
    });

    return turnstileLoader;
  }

  function setupNavigation(nav, navIndex){
    var menu = nav.querySelector('.mobile-menu');
    var links = nav.querySelector('.nav-links');
    if(!menu || !links) return;

    var navId = links.id || ('primary-nav-' + navIndex);
    links.id = navId;
    links.setAttribute('aria-label', 'Primary navigation');
    menu.setAttribute('aria-controls', navId);
    menu.setAttribute('aria-expanded', 'false');

    function updateMenuLabel(expanded){
      var isEnglish = document.documentElement.lang === 'en';
      menu.setAttribute(
        'aria-label',
        expanded ? (isEnglish ? 'Close menu' : '關閉選單') : (isEnglish ? 'Open menu' : '開啟選單')
      );
    }

    function closeMenu(returnFocus){
      links.classList.remove('is-open');
      menu.setAttribute('aria-expanded', 'false');
      updateMenuLabel(false);
      if(returnFocus) menu.focus();
    }

    function openMenu(){
      links.classList.add('is-open');
      menu.setAttribute('aria-expanded', 'true');
      updateMenuLabel(true);
    }

    menu.addEventListener('click', function(){
      if(menu.getAttribute('aria-expanded') === 'true') closeMenu(false);
      else openMenu();
    });

    links.addEventListener('click', function(event){
      if(event.target.closest('a')) closeMenu(false);
    });

    document.addEventListener('click', function(event){
      if(!nav.contains(event.target)) closeMenu(false);
    });

    document.addEventListener('keydown', function(event){
      if(event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true'){
        closeMenu(true);
      }
    });

    window.addEventListener('resize', function(){
      if(window.innerWidth > 1180) closeMenu(false);
    });

    nav.querySelectorAll('.lang-btn').forEach(function(button){
      button.addEventListener('click', function(){
        updateMenuLabel(menu.getAttribute('aria-expanded') === 'true');
      });
    });

    updateMenuLabel(false);
  }

  function setupContactForm(form){
    var fields = form.querySelectorAll('input, textarea');
    var name = fields[0];
    var company = fields[1];
    var email = fields[2];
    var message = fields[3];
    var submit = form.querySelector('[type="submit"]');
    if(!name || !company || !email || !message || !submit) return;

    name.name = 'name';
    name.autocomplete = 'name';
    name.required = true;
    company.name = 'company';
    company.autocomplete = 'organization';
    email.name = 'email';
    email.autocomplete = 'email';
    email.required = true;
    message.name = 'message';
    message.required = true;
    message.minLength = 10;

    var honeypot = document.createElement('label');
    honeypot.className = 'hp-field';
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.innerHTML = 'Website<input name="website" type="text" tabindex="-1" autocomplete="off">';
    form.insertBefore(honeypot, submit);

    var status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.appendChild(status);

    var turnstileContainer = document.createElement('div');
    turnstileContainer.className = 'turnstile-container cf-turnstile';
    turnstileContainer.setAttribute('data-action', 'turnstile-spin-v2');
    form.insertBefore(turnstileContainer, submit);

    var turnstileNotice = document.createElement('p');
    turnstileNotice.className = 'turnstile-notice';
    form.insertBefore(turnstileNotice, submit);

    var turnstileToken = '';
    var turnstileWidgetId = null;
    var verificationState = 'loading';
    submit.disabled = true;

    function updateVerificationNotice(state){
      verificationState = state;
      var isEnglish = document.documentElement.lang === 'en';
      var messages = {
        loading: isEnglish ? 'Loading verification…' : '載入人機驗證中…',
        ready: isEnglish ? 'Complete the verification before submitting.' : '請先完成人機驗證。',
        verified: isEnglish ? 'Verification complete.' : '人機驗證已完成。',
        expired: isEnglish ? 'Verification expired. Please try again.' : '驗證已過期，請重新完成。',
        error: isEnglish ? 'Verification is unavailable. Please try again later.' : '人機驗證暫時無法使用，請稍後再試。'
      };
      turnstileNotice.textContent = messages[state] || '';
      turnstileNotice.className = 'turnstile-notice' + (state === 'error' || state === 'expired' ? ' is-error' : '');
    }

    async function initializeTurnstile(){
      updateVerificationNotice('loading');
      try{
        var configResponse = await fetch('/api/contact', {
          method:'GET',
          headers:{'Accept':'application/json'},
          cache:'no-store'
        });
        var config = await configResponse.json().catch(function(){ return {}; });
        if(!configResponse.ok || !config.siteKey) throw new Error('Turnstile is not configured.');
        turnstileContainer.setAttribute('data-sitekey', config.siteKey);

        var turnstile = await loadTurnstile();
        turnstileWidgetId = turnstile.render(turnstileContainer, {
          sitekey:config.siteKey,
          theme:'dark',
          size:'flexible',
          action:'turnstile-spin-v2',
          'response-field':false,
          callback:function(token){
            turnstileToken = token;
            submit.disabled = false;
            updateVerificationNotice('verified');
          },
          'expired-callback':function(){
            turnstileToken = '';
            submit.disabled = true;
            updateVerificationNotice('expired');
          },
          'error-callback':function(){
            turnstileToken = '';
            submit.disabled = true;
            updateVerificationNotice('error');
          }
        });
        updateVerificationNotice('ready');
      }catch(error){
        submit.disabled = true;
        updateVerificationNotice('error');
      }
    }

    document.querySelectorAll('.lang-btn').forEach(function(button){
      button.addEventListener('click', function(){
        updateVerificationNotice(verificationState);
      });
    });

    form.removeAttribute('onsubmit');
    form.addEventListener('submit', async function(event){
      event.preventDefault();
      if(!form.reportValidity()) return;
      if(!turnstileToken){
        updateVerificationNotice('ready');
        return;
      }

      var isEnglish = document.documentElement.lang === 'en';
      var originalLabel = submit.innerHTML;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = isEnglish ? 'Sending…' : '傳送中…';
      status.className = 'form-status';
      status.textContent = '';

      try{
        var response = await fetch('/api/contact', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            name:name.value,
            company:company.value,
            email:email.value,
            message:message.value,
            website:form.querySelector('[name="website"]').value,
            turnstileToken:turnstileToken,
            language:isEnglish ? 'en' : 'zh-Hant',
            source:window.location.href
          })
        });
        var result = await response.json().catch(function(){ return {}; });
        if(!response.ok) throw new Error(result.error || (isEnglish ? 'Unable to send your inquiry.' : '目前無法送出詢價。'));

        form.reset();
        status.className = 'form-status is-success';
        status.textContent = isEnglish ? 'Thank you. Your inquiry has been sent.' : '謝謝，您的詢價已成功送出。';
      }catch(error){
        status.className = 'form-status is-error';
        status.textContent = error && error.message ? error.message : (isEnglish ? 'Please try again later.' : '請稍後再試。');
      }finally{
        turnstileToken = '';
        if(turnstileWidgetId !== null && window.turnstile){
          window.turnstile.reset(turnstileWidgetId);
          updateVerificationNotice('ready');
        }
        submit.disabled = true;
        submit.removeAttribute('aria-busy');
        submit.innerHTML = originalLabel;
      }
    });

    initializeTurnstile();
  }

  document.querySelectorAll('.nav').forEach(setupNavigation);
  document.querySelectorAll('.form-mock').forEach(setupContactForm);
})();
