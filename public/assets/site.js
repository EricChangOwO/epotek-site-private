(function(){
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
      if(window.innerWidth > 900) closeMenu(false);
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

    form.removeAttribute('onsubmit');
    form.addEventListener('submit', async function(event){
      event.preventDefault();
      if(!form.reportValidity()) return;

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
        submit.disabled = false;
        submit.removeAttribute('aria-busy');
        submit.innerHTML = originalLabel;
      }
    });
  }

  document.querySelectorAll('.nav').forEach(setupNavigation);
  document.querySelectorAll('.form-mock').forEach(setupContactForm);
})();
