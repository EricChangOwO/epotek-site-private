(function(){
  /* ---- Bilingual toggle: identical convention to index.html ----
     data-en holds the English string; the literal innerHTML (authored
     in Chinese) is captured as data-zh on load. Works across every
     detail page and stays in sync if the user navigates between pages. */
  var textEls = document.querySelectorAll('[data-en]');
  textEls.forEach(function(el){ el.dataset.zh = el.innerHTML; });

  var phEls = document.querySelectorAll('[data-en-placeholder]');
  phEls.forEach(function(el){ el.dataset.zhPlaceholder = el.placeholder; });

  function setLang(lang){
    textEls.forEach(function(el){
      el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.zh;
    });
    phEls.forEach(function(el){
      el.placeholder = lang === 'en' ? el.dataset.enPlaceholder : el.dataset.zhPlaceholder;
    });
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
    document.querySelectorAll('.lang-btn').forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    try{ localStorage.setItem('epotek-lang', lang); }catch(e){}
  }

  document.querySelectorAll('.lang-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ setLang(btn.dataset.lang); });
  });

  var saved = null;
  try{ saved = localStorage.getItem('epotek-lang'); }catch(e){}
  if(saved === 'en'){ setLang('en'); }

  /* ---- Stackup diagram renderer ----
     Builds a labelled copper/dielectric stack visual from a single
     data-layers count, e.g. <div class="stackup-visual" data-layers="8">.
     Avoids hand-authoring dozens of nested divs per layer count. */
  document.querySelectorAll('.stackup-visual[data-layers]').forEach(function(container){
    var n = parseInt(container.getAttribute('data-layers'), 10) || 2;
    var scale = n > 30 ? 0.32 : (n > 10 ? 0.6 : 1);
    for(var i = 1; i <= n; i++){
      var cu = document.createElement('div');
      cu.className = 'stackup-layer copper';
      cu.title = 'L' + i;
      cu.style.height = (7 * scale) + 'px';
      container.appendChild(cu);
      if(i < n){
        var di = document.createElement('div');
        di.className = 'stackup-layer dielectric';
        di.style.height = (11 * scale) + 'px';
        container.appendChild(di);
      }
    }
  });

  /* ---- Variant tab browser (e.g. Rigid PCB's 9 real spec-sheet variants) ----
     Structure: <div class="variant-tabs">...buttons...</div> followed by
     <div class="variant-panels">...panels...</div>. Supports #hash deep-linking. */
  document.querySelectorAll('.variant-tabs').forEach(function(tabsEl){
    var panelWrap = tabsEl.nextElementSibling;
    if(!panelWrap) return;
    var tabs = tabsEl.querySelectorAll('.variant-tab');
    var panels = panelWrap.querySelectorAll('.variant-panel');
    function activate(key, opts){
      var found = false;
      tabs.forEach(function(t){
        var match = t.getAttribute('data-tab') === key;
        t.classList.toggle('active', match);
        if(match) found = true;
      });
      if(!found) return;
      panels.forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-panel') === key); });
      if(opts && opts.scroll){ tabsEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
    tabsEl.epotekActivateVariant = activate;
    tabs.forEach(function(t){
      t.addEventListener('click', function(){
        activate(t.getAttribute('data-tab'));
        try{ history.replaceState(null, '', '#' + t.getAttribute('data-tab')); }catch(e){}
      });
    });
    var hash = window.location.hash.replace('#', '');
    if(hash && tabsEl.querySelector('[data-tab="' + hash + '"]')){
      activate(hash, { scroll: true });
    }
  });

  /* ---- Mini stack-chart interaction: clicking a bar/label highlights it,
     and jumps to the matching variant tab when data-variant-target is set ---- */
  var bars = document.querySelectorAll('.stack-bar');
  var labels = document.querySelectorAll('.stack-labels span');
  function highlight(idx, el){
    bars.forEach(function(b, i){ b.classList.toggle('active', i === idx); });
    labels.forEach(function(l, i){ l.classList.toggle('active', i === idx); });
    var targetKey = el && el.getAttribute('data-variant-target');
    if(targetKey){
      var tabsEl = document.querySelector('.variant-tabs');
      if(tabsEl && tabsEl.epotekActivateVariant){
        tabsEl.epotekActivateVariant(targetKey, { scroll: true });
        return;
      }
    }
    var row = document.querySelectorAll('.stackup-row')[idx];
    if(row){ row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  bars.forEach(function(bar, i){ bar.addEventListener('click', function(){ highlight(i, bar); }); });
  labels.forEach(function(lbl, i){ lbl.addEventListener('click', function(){ highlight(i, lbl); }); });
})();
