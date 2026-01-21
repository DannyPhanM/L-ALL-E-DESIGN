window.theme = window.theme || {};

theme.config = {
  mqlSmall: false,
  mediaQuerySmall: 'screen and (max-width: 749px)',
  isTouch: ('ontouchstart' in window) || window.DocumentTouch && window.document instanceof DocumentTouch || window.navigator.maxTouchPoints || window.navigator.msMaxTouchPoints ? true : false,
  rtl: document.documentElement.getAttribute('dir') === 'rtl' ? true : false
};

function configurePageFadeInOnLoad() {
  const fadeInDuration = getFadeInDuration();
  if (!fadeInDuration) return;

  if (Shopify.designMode) {
    markOverlappingSectionInEditor();
  }

  updateHeaderGroupHeight();
  hideFadeInOverlayAfterDelay(fadeInDuration);
}

function getFadeInDuration() {
  const duration = getComputedStyle(document.documentElement)
    .getPropertyValue('--fade-in-duration')
    .trim();
    
  return duration || null;
}

function markOverlappingSectionInEditor() {
  const sections = document.querySelectorAll('main .shopify-section');
  if (!sections.length) return;

  const firstSection = sections[0];
  const overlapping = firstSection.querySelector(".overlapping-section");

  if (overlapping) {
    overlapping.classList.add("overlapping-section--first");
  }
}

function updateHeaderGroupHeight() {
  const insideContent = document.querySelector('.inside-content.fade-in--content');
  if (!insideContent) return;

  const isMobile = window.matchMedia('(max-width: 920px)').matches;
  const insideContentRect = insideContent.getBoundingClientRect();

  if (isMobile) {
    const main = document.querySelector('main');
    const mainRect = main.getBoundingClientRect();

    document.documentElement.style.setProperty(
      '--header-group-height',
      `${mainRect.top - insideContentRect.top}px`
    );
  } else {
    const header = document.querySelector('.header-group') || document.querySelector('.header-section');
    const headerRect = header.getBoundingClientRect();

    document.documentElement.style.setProperty(
      '--header-group-height',
      `${headerRect.bottom - insideContentRect.top}px`
    );

    const overlappingSection = document.querySelector('html:has(.fade-in) .overlapping-section--first');
    if (overlappingSection) {
      const announcementBar = document.querySelector('.announcement-bar-section');

      if (announcementBar) {
        const announcementBarRect = announcementBar.getBoundingClientRect();

        document.documentElement.style.setProperty(
          '--header-group-height',
          `${announcementBarRect.bottom}px`
        );
      }
    }
  }
}

function hideFadeInOverlayAfterDelay(durationSeconds) {
  const durationMs = parseInt(durationSeconds) * 1000;
  const delay = 400;

  setTimeout(() => {
    document.body.style.setProperty("--fade-in-element-display", "none");
  }, durationMs + delay);
}


document.addEventListener("DOMContentLoaded", () => {
  configurePageFadeInOnLoad();

  document.body.classList.add("loaded");
  
  const lang = document.documentElement.lang || 'en';
  document.body.classList.add(`lang-${lang}`);
});

const PUB_SUB_EVENTS = {
  cartUpdate: 'cart-update',
  quantityUpdate: 'quantity-update',
  variantChange: 'variant-change',
  cartError: 'cart-error'
};

const SECTION_REFRESH_RESOURCE_TYPE = {
  product: 'product',
};

let subscribers = {}

function subscribe(eventName, callback) {
  if (subscribers[eventName] === undefined) {
    subscribers[eventName] = []
  }

  subscribers[eventName] = [...subscribers[eventName], callback];

  return function unsubscribe() {
    subscribers[eventName] = subscribers[eventName].filter((cb) => {
      return cb !== callback
    });
  }
};

function publish(eventName, data) {
  if (subscribers[eventName]) {
    subscribers[eventName].forEach((callback) => {
      callback(data)
    })
  }
}

if (window.Shopify && window.Shopify.designMode) {
  document.documentElement.style.setProperty(
      "--scrollbar-width",
      `${window.innerWidth - document.documentElement.clientWidth}px`
  );
}

function filterShopifyEvent(event, domElement, callback) {
  let executeCallback = false;
  if (event.type.includes('shopify:section')) {
    if (domElement.hasAttribute('data-section-id') && domElement.getAttribute('data-section-id') === event.detail.sectionId) {
      executeCallback = true;
    }
  }
  else if (event.type.includes('shopify:block') && event.target === domElement) {
    executeCallback = true;
  }
  if (executeCallback) {
    callback(event);
  }
}

function parseNode(nodeString) {
  const tempElement = document.createElement('div');
  tempElement.innerHTML = nodeString;

  return tempElement.firstElementChild;
}

// Init section function when it's visible, then disable observer
theme.initWhenVisible = function(options) {
  const threshold = options.threshold ? options.threshold : 0;

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (typeof options.callback === 'function') {
          options.callback();
          observer.unobserve(entry.target);
        }
      }
    });
  }, {rootMargin: `0px 0px ${threshold}px 0px`});

  observer.observe(options.element);
};

function getFocusableElements(container) {
    return Array.from(
      container?.querySelectorAll(
        "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
      )
    );
}

class HTMLUpdateUtility {
  #preProcessCallbacks = [];
  #postProcessCallbacks = [];

  constructor() {}

  addPreProcessCallback(callback) {
    this.#preProcessCallbacks.push(callback);
  }

  addPostProcessCallback(callback) {
    this.#postProcessCallbacks.push(callback);
  }

  /**
   * Used to swap an HTML node with a new node.
   * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
   *
   * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  viewTransition(oldNode, newContent) {
    this.#preProcessCallbacks.forEach((callback) => callback(newContent));

    const newNode = oldNode.cloneNode();
    HTMLUpdateUtility.setInnerHTML(newNode, newContent.innerHTML);
    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = 'none';

    this.#postProcessCallbacks.forEach((callback) => callback(newNode));

    setTimeout(() => oldNode.remove(), 1000);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    element.querySelectorAll('script').forEach((oldScriptTag) => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}
  
document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));

  if(summary.nextElementSibling.getAttribute('id')) {
    summary.setAttribute('aria-controls', summary.nextElementSibling.id);
  }

  summary.addEventListener('click', (event) => {
    event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
  });

  if (summary.closest('header-drawer')) return;
  summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});


document.addEventListener("DOMContentLoaded", () => {
  const ltrInputs = document.querySelectorAll('input[type="email"], input[type="tel"], input[type="number"], input[type="url"]');

  ltrInputs.forEach(ltrInput => {
    const placeholder = ltrInput.getAttribute('placeholder');

    if (placeholder) {
      const isPlaceholderRTL = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(placeholder); 

      ltrInput.style.setProperty("--placeholder-align", isPlaceholderRTL ? "right" : "left");
    }
  })
});

function simulateHoverOnTouch(elementSelector) {
  function removeActiveByTypeClass(selector) {
    document.querySelectorAll(`${selector}.active-by-tap`).forEach((activeCard) => {
      activeCard.classList.remove("active-by-tap");
    });
  }

  const bannersWithHover = document.querySelectorAll(elementSelector);

  bannersWithHover.forEach((el) => {
    el.addEventListener("click", (event) => {
      if (window.innerWidth <= 1024 || !theme.config.isTouch) return;

      const link = el.closest("a");

      if (!el.classList.contains("active-by-tap")) {
        event.preventDefault(); 

        removeActiveByTypeClass(elementSelector);
        el.classList.add("active-by-tap"); 
      } else if (link) {
        event.preventDefault();  

        link.target === "_blank" ? window.open(link.href, "_blank") : window.open(link.href, "_self");
      }      
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(elementSelector)) {
      removeActiveByTypeClass(elementSelector);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const selectorsOfElementsWithHover = [
    'a.banner__wrapper.hover-content', 
    'a.banner-gallery__card.hover-content', 
    'a.banner-grid__card.hover-content'
  ];

  selectorsOfElementsWithHover.forEach(simulateHoverOnTouch);
});

  const trapFocusHandlers = {};
  
  function trapFocus(container, elementToFocus = container) {
  
    var elements = getFocusableElements(container);
    
    var first = elements[0];
    var last = elements[elements.length - 1];
  
    removeTrapFocus();
  
    trapFocusHandlers.focusin = (event) => {
      if (
        event.target !== container &&
        event.target !== last &&
        event.target !== first
      )
        return;
  
      document.addEventListener('keydown', trapFocusHandlers.keydown);
    };
  
    trapFocusHandlers.focusout = function() {
      document.removeEventListener('keydown', trapFocusHandlers.keydown);
    };
    trapFocusHandlers.keydown = function(event) {
      if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
      // On the last focusable element and tab forward, focus the first element.
      if (event.target === last && !event.shiftKey) {
        event.preventDefault();
        first.focus();
      }
  
      //  On the first focusable element and tab backward, focus the last element.
      if (
        (event.target === container || event.target === first) &&
        event.shiftKey
      ) {
        event.preventDefault();
        last.focus();
      }
    };
  
    document.addEventListener('focusout', trapFocusHandlers.focusout);
    document.addEventListener('focusin', trapFocusHandlers.focusin);
  
    elementToFocus?.focus();
  }
  focusVisiblePolyfill()
  
  // Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
  try {
    document.querySelector(":focus-visible");
  } catch(e) {
    focusVisiblePolyfill();
  }
  
  function focusVisiblePolyfill() {
    const navKeys = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'TAB', 'ENTER', 'SPACE', 'ESCAPE', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN']
    let currentFocusedElement = null;
    let mouseClick = null;
  
    window.addEventListener('keydown', (event) => {
      if(event.code && navKeys.includes(event.code.toUpperCase())) {
        mouseClick = false;
      }
    });
  
    window.addEventListener('mousedown', (event) => {
      mouseClick = true;
    });
  
    window.addEventListener('focus', () => {
      if (currentFocusedElement) currentFocusedElement.classList.remove('focused');
      if (mouseClick) return;
      currentFocusedElement = document.activeElement;
      currentFocusedElement.classList.add('focused');
  
    }, true);
  }

  function getMediaType(media) {
    if (!media) {
      return null;
    }

    const mediaType =
      media.tagName.toUpperCase() === "VIDEO"
        ? "VIDEO"
        : media.tagName.toUpperCase() === "IMG"
        ? "IMAGE"
        : media.classList.contains("js-youtube")
        ? "YOUTUBE"
        : media.classList.contains("js-vimeo")
        ? "VIMEO"
        : media.tagName.toUpperCase() === 'PRODUCT-MODEL'
        ? 'MODEL'
        : null;

    return mediaType;
  }
  
  function pauseAllMedia() {
    document.querySelector('.theme-content').querySelectorAll('.js-youtube').forEach(pauseYoutubeVideo);
    document.querySelector('.theme-content').querySelectorAll('.js-vimeo').forEach(pauseVimeoVideo);
    document.querySelector('.theme-content').querySelectorAll('video').forEach(pauseVideo);
    document.querySelector('.theme-content').querySelectorAll('product-model').forEach(pauseModel);
  }

  function handleMediaAction(media, actions, isAutoplayEnabled = false) {
    if (!media) {
      return;
    }
  
    const mediaType = getMediaType(media);
    const action = actions[mediaType];

    if (action) {
      action(media, isAutoplayEnabled);
    }
  }
  
  function pauseMedia(media, isAutoplayEnabled = false) {
    handleMediaAction(media, {
      'VIDEO': pauseVideo,
      'YOUTUBE': pauseYoutubeVideo,
      'VIMEO': pauseVimeoVideo,
      'MODEL': pauseModel
    }, isAutoplayEnabled);
  }
  
  function playMedia(media, isAutoplayEnabled = false, forcePlay = false) {
    if (!forcePlay && media && media.dataset.pausedByScript === 'false' && isAutoplayEnabled) {
      return;
    }

    handleMediaAction(media, {
      'VIDEO': playVideo,
      'YOUTUBE': playYoutubeVideo,
      'VIMEO': playVimeoVideo,
      'MODEL': playModel
    }, isAutoplayEnabled);
  }

  async function playYoutubeVideo(video, isAutoplayEnabled = false) {
    if (!video || video.tagName !== 'IFRAME') {
      console.warn('Invalid video element provided');
      return;
    }

    try {
      await loadScript('youtube');

      const youtubePlayer = await getYoutubePlayer(video);

      if (isAutoplayEnabled) {
        youtubePlayer.mute();
      }

      youtubePlayer.playVideo();
    } catch (error) {
      console.error('Error handling YouTube video play:', error);
    }
  }

  async function pauseYoutubeVideo(video, isAutoplayEnabled = false) {
    if (!video || video.tagName !== 'IFRAME') {
      console.warn('Invalid video element provided');
      return;
    }
  
    try {
      await loadScript('youtube');
  
      const youtubePlayer = await getYoutubePlayer(video);
      const playerState = youtubePlayer.getPlayerState();
  
      if (playerState === YT.PlayerState.PAUSED) {
        return; 
      }
  
      youtubePlayer.pauseVideo();
  
      if (isAutoplayEnabled) {
        video.setAttribute('data-paused-by-script', 'true');
  
        // Attach a one-time event listener for the play event
        const handleStateChange = (event) => {
          if (event.data === YT.PlayerState.PLAYING) {
            video.setAttribute('data-paused-by-script', 'false');
            youtubePlayer.removeEventListener('onStateChange', handleStateChange);
          }
        };
  
        youtubePlayer.addEventListener('onStateChange', handleStateChange);
      }
    } catch (error) {
      console.error('Error handling YouTube video pause:', error);
    }
  }
  
  function getYoutubePlayer(video) {
    return new Promise((resolve) => {
      window.YT.ready(() => {
        const existingPlayer = YT.get(video.id);

        if (existingPlayer) {
          resolve(existingPlayer);
        } else {
          const playerInstance = new YT.Player(video, {
            events: {
              onReady: (event) => resolve(event.target),
            },
          });
        }
      });
    });
  }

  function removeYoutubePlayer(videoId) {
    const existingPlayer = YT.get(videoId);

    if (existingPlayer) {
      existingPlayer.destroy(); 
    }
  }

  function playVimeoVideo(video, isAutoplayEnabled = false) {
    if (!video || video.tagName !== 'IFRAME') {
      return;
    }

    if (isAutoplayEnabled) {
      video.contentWindow?.postMessage(
        JSON.stringify({ method: 'setVolume', value: 0 }),
        '*'
      );
    }

    video.contentWindow?.postMessage('{"method":"play"}', '*');
  }

  async function pauseVimeoVideo(video, isAutoplayEnabled = false) {
    if (!video || video.tagName !== 'IFRAME') {
      return;
    }

    try {
      await loadScript('vimeo');

      const vimeoPlayer = new Vimeo.Player(video);
      const isPaused = await vimeoPlayer.getPaused();
  
      if (isPaused) {
        return; 
      }
  
      video.contentWindow?.postMessage('{"method":"pause"}', '*');
      
      if (isAutoplayEnabled) { 
        video.setAttribute('data-paused-by-script', 'true');  

        const handlePlay = () => {
          video.setAttribute('data-paused-by-script', 'false');
          vimeoPlayer.off('play', handlePlay);
        };
  
        vimeoPlayer.on('play', handlePlay);
      }
    } catch (error) {
      console.error('Error handling Vimeo video pause:', error);
    }
  }

  function playVideo(video, isAutoplayEnabled = false) {
    if (!video || !(video instanceof HTMLVideoElement)) {
      return;
    }

    if (isAutoplayEnabled) {
      video.muted = true;
    }

    video.play();
  }

  function pauseVideo(video, isAutoplayEnabled = false) {
    if (!video || !(video instanceof HTMLVideoElement)) {
      return;
    }

    if (video.paused) { 
      return;
    } 

    video.pause();
    
    if (isAutoplayEnabled) {  
      video.setAttribute('data-paused-by-script', 'true');  

      video.addEventListener('play', () => { 
        video.setAttribute('data-paused-by-script', 'false');
      }, { once: true })
    }
  }

  function playModel(model) {
    if (model.modelViewerUI) model.modelViewerUI.play();
  }

  function pauseModel(model) {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  }

  function loadScript(mediaType) {
    return new Promise((resolve, reject) => {
      let scriptId;
  
      switch (mediaType) {
        case 'youtube':
          scriptId = 'youtube-iframe-api';
          break;
        case 'vimeo':
          scriptId = 'vimeo-player-api';
          break;
        default:
          reject();
          return;
      }
  
      if (document.getElementById(scriptId)) {
        resolve();

        return;
      }
  
      const script = document.createElement('script');
      script.id = scriptId; 
      document.body.appendChild(script);
  
      script.onload = resolve;
      script.onerror = reject;
      script.async = true;
  
      switch (mediaType) {
        case 'youtube':
          script.src = 'https://www.youtube.com/iframe_api';
          break;
        case 'vimeo':
          script.src = '//player.vimeo.com/api/player.js';
          break;
        default:
          reject();
          return;
      }
    });
  }
  
  // Play or pause a video/product model if it’s visible or not
  setTimeout(() => {
    document.querySelector('.theme-content').querySelectorAll('video').forEach((video) => {
      if(!video.closest('.none-autoplay')) {
        let isVisible = elemInViewport(video);
        let isPlaying = video.currentTime > 0 && !video.paused && !video.ended && video.readyState > video.HAVE_CURRENT_DATA;
        let isSlideshow = !!(video.closest('.slideshow') || video.closest('.shoppable-media-slider'));
        let isCurrentSlide = !!(video.closest('.current') || video.closest('.swiper-slide-active'))

        if (isSlideshow && isVisible) {
          if (isCurrentSlide) {
            video.play()
          } else {
            video.pause()
          } 
        }

        if (isVisible) {
          if (!isPlaying) {
            video.play()
          }
        } else {
          video.pause()
        }
      }
    })
    document.querySelector('.theme-content').querySelectorAll('product-model').forEach((model) => {
      if (model.modelViewerUI) {
        let isVisible = elemInViewport(model);
        isVisible ? model.modelViewerUI.play() : model.modelViewerUI.pause();
      }
    })
  }, 10)

  document.addEventListener('scroll', () => {
    document.querySelector('.theme-content').querySelectorAll('video').forEach((video) => {
      if(!video.closest('.none-autoplay')) {
        let isVisible = elemInViewport(video);
        let isPlaying = video.currentTime > 0 && !video.paused && !video.ended && video.readyState > video.HAVE_CURRENT_DATA;
        if(isVisible) {
          if(!isPlaying) {
            video.play()
          }
        } else {
          video.pause()
        }
      }
    })
  })  

  if (Shopify.designMode) {
    document.addEventListener('shopify:section:load', () => {
      document.querySelector('.theme-content').querySelectorAll('video').forEach((video) => {
        if(!video.closest('.none-autoplay')) {
          let isVisible = elemInViewport(video);
          let isPlaying = video.currentTime > 0 && !video.paused && !video.ended && video.readyState > video.HAVE_CURRENT_DATA;
          if(isVisible) {
            if(!isPlaying) {
              video.play()
            }
          } else {
            video.pause()
          }
        }
      })
    })
  }

  function elemInViewport(elem) {
    let box = elem.getBoundingClientRect();
    let top = box.top;
    let bottom = box.bottom;
    let height = document.documentElement.clientHeight;
    let maxHeight = 0;
    return Math.min(height,bottom)- Math.max(0,top) >= maxHeight
  }
  
  function removeTrapFocus(elementToFocus = null) {
    document.removeEventListener('focusin', trapFocusHandlers.focusin);
    document.removeEventListener('focusout', trapFocusHandlers.focusout);
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  
    if (elementToFocus) elementToFocus.focus();
  }
  
  function onKeyUpEscape(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;
  
    const openDetailsElement = event.target.closest('details[open]');
    if (!openDetailsElement) return;
  
    const summaryElement = openDetailsElement.querySelector('summary');
    openDetailsElement.removeAttribute('open');
    summaryElement.setAttribute('aria-expanded', false);
    summaryElement.focus();
  }
  
  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  
  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
  
  function fetchConfig(type = 'json') {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': `application/${type}` }
    };
  }
  
function isStorageSupported (type) {
  // Return false if we are in an iframe without access to sessionStorage
  if (window.self !== window.top) {
    return false;
  }

  const testKey = 'avante-theme:test';
  let storage;
  if (type === 'session') {
    storage = window.sessionStorage;
  }
  if (type === 'local') {
    storage = window.localStorage;
  }

  try {
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  }
  catch (error) {
    // Do nothing, this may happen in Safari in incognito mode
    return false;
  }
}

  /*
    * Shopify Common JS
    */
  if ((typeof window.Shopify) == 'undefined') {
    window.Shopify = {};
  }
  
  Shopify.bind = function(fn, scope) {
    return function() {
      return fn.apply(scope, arguments);
    }
  };
  
  Shopify.setSelectorByValue = function(selector, value) {
    for (var i = 0, count = selector.options.length; i < count; i++) {
      var option = selector.options[i];
      if (value == option.value || value == option.innerHTML) {
        selector.selectedIndex = i;
        return i;
      }
    }
  };
  
  Shopify.addListener = function(target, eventName, callback) {
    target.addEventListener ? target.addEventListener(eventName, callback, false) : target.attachEvent('on'+eventName, callback);
  };
  
  Shopify.postLink = function(path, options) {
    options = options || {};
    var method = options['method'] || 'post';
    var params = options['parameters'] || {};
    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);
  
    for(var key in params) {
      var hiddenField = document.createElement("input");
      hiddenField.setAttribute("type", "hidden");
      hiddenField.setAttribute("name", key);
      hiddenField.setAttribute("value", params[key]);
      form.appendChild(hiddenField);
    }
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };
  
  Shopify.CountryProvinceSelector = function(country_domid, province_domid, options) {
    this.countryEl 
    this.provinceEl
    this.provinceContainer

    if(document.querySelector('#main-cart')) {
      this.shippingCalculators = document.querySelectorAll('shipping-calculator')
      this.shippingCalculators.forEach(shippingCalculator => {
        this.countryEl         = shippingCalculator.querySelector(`#${country_domid}`);
        this.provinceEl        = shippingCalculator.querySelector(`#${province_domid}`);
        this.provinceContainer = shippingCalculator.querySelector(`#${options['hideElement']}` || `#${province_domid}`);

        Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));
    
        this.initCountry();
        this.initProvince();
      })
    } else {
      this.countryEl         = document.getElementById(country_domid);
      this.provinceEl        = document.getElementById(province_domid);
      this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

      Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));

      this.initCountry();
      this.initProvince();
    }
  };

  Shopify.CountryProvinceSelector.prototype = {
    initCountry: function() {
      var value = this.countryEl.getAttribute('data-default');
      Shopify.setSelectorByValue(this.countryEl, value);
      this.countryHandler();
    },
  
    initProvince: function() {
      var value = this.provinceEl.getAttribute('data-default');
      if (value && this.provinceEl.options.length > 0) {
        Shopify.setSelectorByValue(this.provinceEl, value);
      }
    },
  
    countryHandler: function(e) {
      var opt       = this.countryEl.options[this.countryEl.selectedIndex];
      var raw       = opt.getAttribute('data-provinces');
      var provinces = JSON.parse(raw);
  
      this.clearOptions(this.provinceEl);
      if (provinces && provinces.length == 0) {
        this.provinceContainer.style.display = 'none';
      } else {
        for (var i = 0; i < provinces.length; i++) {
          var opt = document.createElement('option');
          opt.value = provinces[i][0];
          opt.innerHTML = provinces[i][1];
          this.provinceEl.appendChild(opt);
        }
        this.provinceContainer.style.display = "";
      }
    },
  
    clearOptions: function(selector) {
      while (selector.firstChild) {
        selector.removeChild(selector.firstChild);
      }
    },
  
    setOptions: function(selector, values) {
      for (var i = 0, count = values.length; i < values.length; i++) {
        var opt = document.createElement('option');
        opt.value = values[i];
        opt.innerHTML = values[i];
        selector.appendChild(opt);
      }
    }
  };

  document.addEventListener('quickview:loaded', () => {
    window.ProductModel = {
      loadShopifyXR() {
        Shopify.loadFeatures([
          {
            name: 'shopify-xr',
            version: '1.0',
            onLoad: this.setupShopifyXR.bind(this),
          },
        ]);
      },
    
      setupShopifyXR(errors) {
        if (errors) return;
    
        if (!window.ShopifyXR) {
          document.addEventListener('shopify_xr_initialized', () =>
            this.setupShopifyXR()
          );
          return;
        }
    
        document.querySelectorAll('[id^="ProductJSON-"]').forEach((modelJSON) => {
          window.ShopifyXR.addModels(JSON.parse(modelJSON.textContent));
          modelJSON.remove();
        });
        window.ShopifyXR.setupXRElements();
      },
    };
    if (window.ProductModel) {
        window.ProductModel.loadShopifyXR();
    }
  });

  class Breadcrumbs extends HTMLElement {
    constructor() {
      super();
  
      this.template = this.dataset.currentTemplate; 
      if (this.template != 'product' && this.template != 'collection') return;

      this.cookieName = 'avante-theme:active-category';
      this.cookieUrl = 'avante-theme:active-category-url';
      this.storageItem = this.querySelector('.breadcrumbs__item--storage');
      this.metafieldItem = this.querySelector('.breadcrumbs__item--metafield');
      this.menuItems = document.querySelectorAll('.menu__list a');
      this.collectionItem = this.querySelector('.breadcrumbs__item--collection');
      if (this.metafieldItem && this.metafieldItem.dataset.tags) this.tagItems = this.metafieldItem.dataset.tags.split(',');
  
      this.setMetafieldLink();
      this.setStorageCategory();
  
      document.addEventListener('shopify:section-load', () => {
        this.setMetafieldLink();
      })
    }
  
    setMetafieldLink() {
      this.menuItems.forEach(menuItem => {
        let dataTitle = menuItem.dataset.title;

        if (dataTitle) dataTitle.toLowerCase();

        if (this.metafieldItem && this.metafieldItem.querySelector('a').innerHTML == dataTitle) this.metafieldItem.querySelector('a').setAttribute('href', `${menuItem.href}`);
        
        if (this.tagItems && this.tagItems.length > 0) {
          this.tagItems.forEach(tagItem => {
            if (dataTitle && tagItem == dataTitle.toLowerCase()) {
              this.metafieldItem.querySelector('a').setAttribute('href', `${menuItem.href}`);
              this.metafieldItem.querySelector('a').innerHTML = dataTitle;

              setTimeout( () => {
                if (this.collectionItem && this.collectionItem.querySelector('a').innerHTML == this.metafieldItem.querySelector('a').innerHTML) this.collectionItem.style.display = 'none';
              }, 10)
            }
          })
        }
      })
    }
  
    setStorageCategory() {
      if (isStorageSupported('local')) {
        const activeCategory = window.localStorage.getItem(this.cookieName);
        const activeCategoryUrl = window.localStorage.getItem(this.cookieUrl);

        if (this.storageItem && activeCategory && activeCategoryUrl) {
          this.storageItem.querySelector('a').setAttribute('href', `${activeCategoryUrl}`);
          this.storageItem.querySelector('a').innerHTML = `${activeCategory}`;

          if (this.collectionItem && this.collectionItem.querySelector('a').innerHTML == activeCategory) this.collectionItem.style.display = 'none';
        }
      }
    }
  }
  
  customElements.define('breadcrumbs-component', Breadcrumbs);

  function validateFormInput (inputElement) {
    const inputType = inputElement.getAttribute('type');
    let isValid = false;
  
    switch (inputType) {
      case 'checkbox':
        const fieldWrapper = inputElement.closest('label');
        if (fieldWrapper.dataset.group) {
          const groupWrapper = fieldWrapper.parentElement;
          const minSelection = parseInt(groupWrapper.dataset.min) > 0 ? parseInt(groupWrapper.dataset.min) : 1;
          const checkedElms = groupWrapper.querySelectorAll('input[type=checkbox]:checked');
          const errorMessage = groupWrapper.parentElement.querySelector('.input-error-message');
  
          if (checkedElms.length < minSelection) {
            isValid = false;
            if (errorMessage) errorMessage.classList.remove('visually-hidden');
            const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
            const headerOffset = parseInt(headerHeight?.replace('px', '')) || 0;
            const topOffset = errorMessage.closest('.custom-options').getBoundingClientRect().top + window.pageYOffset - headerOffset;
            window.scrollTo({ top: topOffset, behavior: 'smooth' });
  
          } else {
            isValid = true;
            if (errorMessage) errorMessage.classList.add('visually-hidden');
          }
        } else {
          isValid = inputElement.checked;
        }
  
        break;
      case 'file':
        isValid = inputElement.value !== '';
        const dropZone = inputElement.closest('.drop-zone-wrap');
        const errorMessage = dropZone.querySelector('.input-error-message');
  
        if (dropZone && !isValid) {
          dropZone.classList.add('drop-zone-wrap--error');
          if (errorMessage) {
            errorMessage.textContent = window.variantStrings.fileRequiredError;
            errorMessage.classList.remove('visually-hidden');
            const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
            const headerOffset = parseInt(headerHeight?.replace('px', '')) || 0;
            const topOffset = errorMessage.closest('.custom-options').getBoundingClientRect().top + window.pageYOffset - headerOffset;
            window.scrollTo({ top: topOffset, behavior: 'smooth' });
          }
        }
  
        break;
      default:
        isValid = inputElement.value !== '';
  
        if ( inputElement.name === 'address[country]' || inputElement.name === 'country') {
          isValid = inputElement.value !== '---';
        }
    }
  
    if (!isValid) {
      const fieldWrapper = inputElement.parentElement;
      const hasErrorMessage = fieldWrapper.querySelector('.input-error-message');
  
      if (hasErrorMessage) {
        hasErrorMessage.classList.remove('visually-hidden');
        const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
        const headerOffset = parseInt(headerHeight?.replace('px', '')) || 0;
        const topOffset = hasErrorMessage.closest('.custom-options').getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: topOffset, behavior: 'smooth' });
      }
  
      inputElement.classList.add('invalid');
      inputElement.setAttribute('aria_invalid', 'true');
      inputElement.setAttribute('aria_describedby', `${inputElement.id}-error`);
    }
  
    return isValid;
  }
  
  function removeErrorStyle (inputElem) {
    const fieldWrapper = inputElem.parentElement;
    const hasErrorMessage = fieldWrapper.querySelector('.input-error-message');
  
  
    if (hasErrorMessage) {
      hasErrorMessage.classList.add('visually-hidden');
    }
  
    inputElem.classList.remove('invalid');
    inputElem.removeAttribute('aria_invalid');
    inputElem.removeAttribute('aria_describedby');
  }

  class LocalizationForm extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        input: this.querySelector('input[name="locale_code"], input[name="country_code"]'),
        inputLanguage: this.querySelector('input[name="locale_code"]'),
        button: this.querySelector('button'),
        panel: this.querySelector('.disclosure__list-wrapper'),
      };
      this.elements.button.addEventListener('click', this.openSelector.bind(this));
      this.addEventListener('keyup', this.onContainerKeyUp.bind(this));
      this.querySelectorAll('a').forEach(item => item.addEventListener('click', this.onItemClick.bind(this)));
      this.elements.button.closest('.shopify-section').querySelector('div').addEventListener('scroll', this.hidePanel.bind(this))
      document.addEventListener('scroll', this.hidePanel.bind(this))
      this.addEventListener('focusout', this.closeSelector.bind(this));

    }
    
    alignPanel() {
      const isRTL = document.documentElement.dir === 'rtl';

      this.elements.panel.style.insetInlineEnd = 'auto'
      this.buttonCoordinate = this.elements.button.getBoundingClientRect()
      this.viewportHeight = window.innerHeight
      this.viewportWidth = window.innerWidth
      this.elements.panel.style.top = this.buttonCoordinate.bottom + 'px'
      this.elementCoordinate = this.elements.panel.getBoundingClientRect();
      const elementOverflowsViewport = isRTL ? this.elementCoordinate.left - 16 < 0 : this.elementCoordinate.right + 16 > this.viewportWidth;
      
      if (this.elementCoordinate.bottom > this.viewportHeight) this.elements.panel.style.top = this.buttonCoordinate.top - this.elements.panel.offsetHeight + 'px'
      if (elementOverflowsViewport) this.elements.panel.style.insetInlineEnd = '16px';
    }

    hidePanel() {
      if (this.elements.panel.hasAttribute('hidden')) return
      this.elements.button.setAttribute('aria-expanded', 'false');
      this.elements.panel.setAttribute('hidden', true);
      this.elements.button.querySelectorAll('.disclosure__button-icon').forEach(item => item.classList.toggle('open'));
    }

    onContainerKeyUp(event) {
      if (event.code.toUpperCase() !== 'ESCAPE') return;
      this.hidePanel();
      this.elements.button.focus();
    }

    onItemClick(event) {
      event.preventDefault();
      const form = this.querySelector('form');
      this.elements.input.value = event.currentTarget.dataset.value;
      if (this.elements.inputLanguage) {
        document.body.classList.forEach(className => {
          if (className.startsWith('lang-')) document.body.classList.remove(className);
        });
        document.body.classList.add(`lang-${this.elements.inputLanguage.value}`);
      }
      if (form) form.submit();
    }

    openSelector() {
      this.elements.button.focus();
      this.elements.panel.toggleAttribute('hidden');
      this.elements.button.querySelectorAll('.disclosure__button-icon').forEach(item => item.classList.toggle('open'));
      this.elements.button.setAttribute('aria-expanded', (this.elements.button.getAttribute('aria-expanded') === 'false').toString());
      setTimeout(this.alignPanel(), 20) 
    }

    closeSelector(event) {
      // const shouldClose = event.relatedTarget && event.relatedTarget.nodeName === 'BUTTON';
      // if (event.relatedTarget === null || shouldClose) {
      //   this.hidePanel();
      //   this.elements.button.querySelectorAll('.disclosure__button-icon').forEach(item => item.classList.remove('open'));
      // }
      if (event.relatedTarget && !event.relatedTarget.closest('.disclosure__list-wrapper')) {
        this.hidePanel();
        this.elements.button.querySelectorAll('.disclosure__button-icon').forEach(item => item.classList.remove('open'));
      }
    }
  }
  customElements.define('localization-form', LocalizationForm);


  class MenuDropdown extends HTMLElement {
    constructor() {
      super();
  
      this.elements = {
        firstLevelLinkHeader: this.querySelectorAll('.menu__item-title--header'),
        dropdownFirstLevelLink: this.querySelectorAll('.menu__item-title--simple_slide_out'),
        firstLevelCollapsibleButton: this.querySelectorAll('.menu__item-title--collapsible .dropdown-icon--first-level'),
        secondLevelButton: this.querySelectorAll('.dropdown-icon--second-level'),
        secondLevelLink: this.querySelectorAll('.menu__item-title--second-level'),
        headerDropdownChild: this.querySelectorAll('.menu__item-title--header ~ .menu__dropdown-container'),
        sidebarDropdownChild: this.querySelectorAll('.menu__item-title--simple_slide_out ~ .menu__dropdown-container'),
        sidebarDivider: this.querySelectorAll('.menu__item-title--slide_out ~ .menu-divider'),
        dropdownChildList: this.querySelectorAll('.menu__dropdown-child'),
        navContainer: this.querySelectorAll('.menu__navigation'),
        links: this.querySelectorAll('.menu__list a'),
        secondarySidebar: document.querySelector('.secondary-sidebar-section'),
        overlapFirstLevelLink: this.querySelectorAll('.menu__item-title--overlap_slide_out_first-item'),
        overlapGrandchildContainers: this.querySelectorAll('.menu__dropdown-grandchild-container--overlap_slide_out'),
        sidebarOverlapDropdownChild: this.querySelectorAll('.menu__item-title--overlap_slide_out_first-item ~ .menu__dropdown-container')
      };
      this.zTimers = new WeakMap();
      this._reopenBlock = new WeakMap();
      this.sidebarWidth = 0
      if (this.elements.secondarySidebar) this.sidebarWidth = this.elements.secondarySidebar.offsetWidth
  
      /* Script for Header menu */
      this.elements.firstLevelLinkHeader.forEach(item => item.addEventListener('mouseenter', (event) => {
        this.openHeaderMenu(event, item)
      }))

      this.ensureNoAnimStyle();
  
      this.elements.firstLevelLinkHeader.forEach(item => {
        this.icon = item.querySelector('.dropdown-icon--first-level')
        if (this.icon) {
          this.icon.addEventListener('keyup', (event) => {
            if (event.code.toUpperCase() === 'ENTER') {
              if(!item.classList.contains('open')) this.openHeaderMenu(event, item)
              else if(item.classList.contains('open')) {
                this.elements.headerDropdownChild.forEach(item => item.classList.remove('open'))
                this.elements.firstLevelLinkHeader.forEach(item => item.classList.remove('open'))
                this.closeSecondDropdown(item)
              }
            }
          })
        }
      })
  
      this.elements.firstLevelLinkHeader.forEach(item => item.addEventListener('mouseleave', (event) => {
        if (event.relatedTarget && !event.relatedTarget.closest('.menu__dropdown-container') && !event.relatedTarget.closest('.menu__item')) {
          this.elements.headerDropdownChild.forEach(item => {
            item.classList.remove('open')
            if (item.classList.contains('mega-menu')) item.removeAttribute('style')
          })
          this.elements.firstLevelLinkHeader.forEach(item => item.classList.remove('open'))
          this.closeSecondDropdown(item)
        }
      }))
  
      this.elements.headerDropdownChild.forEach(item => item.addEventListener('mouseleave', (event) => {
        if (item.classList.contains('mega-menu') && item.classList.contains('mega-menu--wide') && item.closest('.header').offsetWidth > 1024) item.removeAttribute('style')
        if (event.relatedTarget != item.previousElementSibling && !Array.from(item.previousElementSibling.children).includes(event.relatedTarget)) {
          this.elements.firstLevelLinkHeader.forEach(item => item.classList.remove('open'))
          this.closeSecondDropdown(item)
        }
      }))
      /*Script for Collapsible menu type in Main sidebar and Menu in Menu Drawer section */
      this.elements.firstLevelCollapsibleButton.forEach(item => item.addEventListener('click', () => {
        this.toggleCollapsibleMenu(item)
      }))
  
      this.elements.firstLevelCollapsibleButton.forEach(item => item.addEventListener('keyup', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          this.toggleCollapsibleMenu(item)
        }
      }))
  
      this.elements.secondLevelButton.forEach(item => item.addEventListener('click', () => {
        this.toggleSecondLevelMenu(item)
      }))
      this.elements.secondLevelButton.forEach(item => item.addEventListener('keyup', (event) => {
        if (event.code.toUpperCase() === 'ENTER') this.toggleSecondLevelMenu(item)
      }))
  
      /*Script for Slide out menu type in Main Sidebar */
      if (theme.config.isTouch && this.elements.dropdownFirstLevelLink.length > 0) {
        this.closest('.main-sidebar').style.position = 'absolute'
        this.querySelector('.menu__list--main-sidebar').style.width = 'calc(100% + 6px)'
      }
      this.elements.dropdownFirstLevelLink.forEach(item => item.addEventListener('mouseenter', () => {
        this.openSlideOutMenu(item)
      }))
      this.elements.dropdownFirstLevelLink.forEach(item => {
        this.icon = item.querySelector('.dropdown-icon--first-level')
        if (this.icon) {
          this.icon.addEventListener('keyup', (event) => {
            if (event.code.toUpperCase() === 'ENTER') {
              if(!item.classList.contains('open')) this.openSlideOutMenu(item)
              else if(item.classList.contains('open')) {
                this.elements.dropdownFirstLevelLink.forEach(item => item.classList.remove('open'))
              }
            }
          })
        }
      })
      this.elements.dropdownFirstLevelLink.forEach(item => item.addEventListener('mouseleave', (event) => {
        if (item.classList.contains('open') && !event.relatedTarget.classList.contains('menu-divider') && !event.relatedTarget.classList.contains('menu__dropdown-container') && !Array.from(item.nextElementSibling.children).includes(event.relatedTarget) && !event.relatedTarget.classList.contains('menu__dropdown-child-item-link') && event.relatedTarget != item.closest('.menu-container')) {
          this.elements.dropdownFirstLevelLink.forEach(item => {
            item.classList.remove('open')
            item.closest('.main-sidebar-section').style.zIndex = 20
          })
        }
      }))
      this.elements.sidebarDropdownChild.forEach(item => item.addEventListener('mouseleave', (event) => {
        if (event.relatedTarget != item.previousElementSibling && !Array.from(item.previousElementSibling.children).includes(event.relatedTarget) && !event.relatedTarget.closest('.menu-divider')) {
          this.elements.dropdownFirstLevelLink.forEach(item => {
            item.classList.remove('open')
            item.closest('.main-sidebar-section').style.zIndex = 20
          })
        }
      }))
      document.addEventListener('touchend', (event) => {
        this.elements.dropdownFirstLevelLink.forEach(item => {
          if (item.classList.contains('open') && theme.config.isTouch) {
            if (event.target != item && !event.target.closest('.menu__dropdown-container') && !event.target.closest('.menu-divider')) {
              this.elements.dropdownFirstLevelLink.forEach(item => {
                item.classList.remove('open')
                item.closest('.main-sidebar-section').style.zIndex = 20
              })
            }
          }
        })
      })
  
      this.elements.links.forEach(link => {
        link.addEventListener('click', () => {
          if (link.getAttribute('href') == '#') return
          this.closeParentContainers(link)
        })
      })

      /*Script for Overlap slide out menu type in Main Sidebar */
      this.zTimers = this.zTimers || new WeakMap();
      this.closeFirstTimers = new WeakMap();
      this.hoverDelay = 320;   
      this.OVER_Z_DELAY = 800
      this.overlapTrigger = (this.getAttribute('data-overlap-trigger') || 'hover').toLowerCase();

      if (this.overlapTrigger === 'click') {
        this.initOverlapClick();
      } else {
        this.initOverlapHover();
      }
    }


    ensureNoAnimStyle() {
      if (document.getElementById('menu-dropdown-no-anim-style')) return;
      const style = document.createElement('style');
      style.id = 'menu-dropdown-no-anim-style';
      style.textContent = `
        .md-no-anim, .md-no-anim * {
          transition: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    withNoAnim(el, fn) {
      if (!el) { fn(); return; }
      const prevTransition = el.style.transition;
      el.style.transition = 'none';
      fn();
      // eslint-disable-next-line no-unused-expressions
      el.offsetWidth;
      requestAnimationFrame(() => {
        el.style.transition = prevTransition;
      });
    }

    initOverlapHover() {
      this.elements.overlapFirstLevelLink.forEach(first => {
        first.addEventListener('mouseenter', () => {
          this.elements.overlapFirstLevelLink.forEach(o => {
            if (o !== first && o.classList.contains('open')) this.closeFirst(o);
          });
          this.openOverlapSlideOutMenu(first);
          this.cancelCloseFirst(first);
        });

        first.addEventListener('mouseleave', (e) => {
          const second = first.nextElementSibling;
          const r = e.relatedTarget;

          const intoSecond = !!(r && second && second.contains(r));
          const intoDivider = !!(r && r.classList && r.classList.contains('menu-divider'));
          const stayingOnFirst = !!(r && first.contains(r));
          const intoThird     = !!(r && r.closest('.menu__dropdown-grandchild-container--overlap_slide_out'));

          if (intoSecond || intoDivider || stayingOnFirst || intoThird) {
            this.cancelCloseFirst(first);
            return;
          }
        
          const intoAnyFirst = !!(r && r.closest('.menu__item-title--overlap_slide_out_first'));
          if (intoAnyFirst && !first.contains(r)) {
            this.closeFirst(first);
            return;
          }
        
          this.closeFirst(first);
        });
      });

      this.elements.sidebarOverlapDropdownChild.forEach(second => {
        second.addEventListener('mouseenter', () => {
          const trigger = second.previousElementSibling;
          if (trigger) this.cancelCloseFirst(trigger);
        });

        second.addEventListener('mouseleave', (e) => {
          const trigger = second.previousElementSibling;
          const r = e.relatedTarget;
        
          const backToTrigger = !!(r && r === trigger);
          const intoAnyFirst  = !!(r && r.closest('.menu__item-title--overlap_slide_out_first'));
          const intoOtherFirst = intoAnyFirst && r !== trigger;
          const intoThird = !!(r && r.closest('.menu__dropdown-grandchild-container--overlap_slide_out'));
          const intoDivider = !!(r && r.classList && r.classList.contains('menu-divider'));
          const stillInSecond = !!(r && (r === second || second.contains(r) || r.closest('.menu__dropdown-container') === second));
        
          if (backToTrigger || intoThird || intoDivider || stillInSecond) {
            if (trigger) this.cancelCloseFirst(trigger);
            return;
          }
        
          if (intoOtherFirst || intoAnyFirst) {
            if (trigger) this.closeFirst(trigger);
            return;
          }
        
          if (trigger) this.closeFirst(trigger);
        });
        second.addEventListener('mousemove', (e) => {
          const overThird = e.target.closest('.menu__dropdown-grandchild-container--overlap_slide_out');
          const overThirdTrigger = e.target.closest('.menu__item-title--overlap_slide_out_second');
          if (!overThird && !overThirdTrigger) {
            this.closeAllGrandchildren(second);
          }
        });
      });

      const thirdTriggers = this.querySelectorAll('.menu__dropdown-child .menu__item-title--overlap_slide_out_second');
      thirdTriggers.forEach(t => {
        t.addEventListener('mouseenter', () => this.openThirdNoTransitionOnSwitch(t));
        t.addEventListener('mouseleave', (e) => {
          const trigger = t.previousElementSibling;
          const r = e.relatedTarget;
          const backToTrigger = !!(r && r === trigger);
          const intoSecond    = !!(r && r.closest('.menu__dropdown-container--overlap_slide_out'));
          const intoFirst     = !!(r && r.closest('.menu__item-title--overlap_slide_out_first'));
          const intoThird     = !!(r && r.closest('.menu__dropdown-grandchild-container--overlap_slide_out'));

          if (backToTrigger || intoSecond || intoFirst || intoThird) {
            this.cancelCloseFirst(trigger);
            return;
          }

          if (trigger) this.closeFirst(trigger);
        });

        const thirdContainer = t.nextElementSibling;
        if (thirdContainer) {
          thirdContainer.addEventListener('mouseleave', (e) => {
            const r = e.relatedTarget;
            const backToOwnTrigger = !!(r && r === t);
            const stillInThird = !!(r && thirdContainer.contains(r));
            if (!backToOwnTrigger && !stillInThird) this.closeGrandchild(t);
          });
        }
      });
    }
    openThirdNoTransitionOnSwitch(secondTrigger) {
      const secondWrap  = secondTrigger.closest('.menu__dropdown-container');
      const thirdToOpen = secondTrigger.nextElementSibling;
      if (!secondWrap) return;

      const hasThird = !!(thirdToOpen && thirdToOpen.matches('.menu__dropdown-grandchild-container'));

      if (!hasThird) {
        this.closeOpenGrandchildInSameSecond(secondTrigger, /* animated = */ false);
        return;
      }

      const anyOpen = secondWrap.querySelector('.menu__dropdown-grandchild-container.open, .menu__dropdown-grandchild-container.opened');

      if (!anyOpen) {
        this.closeOpenGrandchildInSameSecond(secondTrigger, /* animated = */ true);
        this.openOverlapSlideOutGrandchildMenu(secondTrigger, { animated: true, seamless: false });
        return;
      }

      this.closeOpenGrandchildInSameSecond(secondTrigger, /* animated = */ false);
      this.openOverlapSlideOutGrandchildMenu(secondTrigger, { animated: false, seamless: true });
    }
    initOverlapClick() {
      this.elements.overlapFirstLevelLink.forEach(first => {
        const hasSecond = !!(first.nextElementSibling && first.nextElementSibling.matches('.menu__dropdown-container'));
        const firstAnchor = first.querySelector('a');
        if (hasSecond && firstAnchor) {
          firstAnchor.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleFirstByClick(first);
          });
        }
        first.addEventListener('keyup', (e) => {
          if (e.code === 'Enter' || e.code === 'Space') {
            const hasSecond = !!(first.nextElementSibling && first.nextElementSibling.matches('.menu__dropdown-container'));
            if (hasSecond) {
              e.preventDefault();
              this.toggleFirstByClick(first);
            }
          }
        });
      });
    
      const secondTriggers = this.querySelectorAll('.menu__item-title--overlap_slide_out_second');
      secondTriggers.forEach(t => {
        const third = t.nextElementSibling;
        const hasThird = !!(third && third.matches('.menu__dropdown-grandchild-container'));
        const link = t.querySelector('a.menu__dropdown-child-item-link');
        if (hasThird && link) {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleThirdByClick(t);
          });
        }
        t.addEventListener('keyup', (e) => {
          if (e.code === 'Enter' || e.code === 'Space') {
            const hasThird = !!(t.nextElementSibling && t.nextElementSibling.matches('.menu__dropdown-grandchild-container'));
            if (hasThird) {
              e.preventDefault();
              this.toggleThirdByClick(t);
            }
          }
        });
      });
    
      this._outsideMainSidebarHandler = (e) => {
        const ms = document.querySelector('.main-sidebar');
        if (!ms) return;
      
        const isInside = ms.contains(e.target);
        if (!isInside) {
          this.closeAllReally();
        }
      };
      
      document.addEventListener('pointerdown', this._outsideMainSidebarHandler, { capture: true });
    }

    toggleFirstByClick(first) {
      const alreadyOpen = first.classList.contains('open') || first.classList.contains('opened');

      this.elements.overlapFirstLevelLink.forEach(o => {
        if (o !== first && (o.classList.contains('open') || o.classList.contains('opened'))) {
          this.closeFirst(o);
        }
      });

      if (alreadyOpen) {
        this.blockReopen(first);
        this.closeFirst(first);
        return;
      }

      if (this.isReopenBlocked(first)) return;

      this.openOverlapSlideOutMenu(first);
    }
    
    toggleThirdByClick(secondTrigger) {
      const third = secondTrigger.nextElementSibling;
      if (!third) return;
    
      const isOpen = third.classList.contains('open');
      if (isOpen) {
        this.closeGrandchild(secondTrigger);
      } else {
       this.openThirdNoTransitionOnSwitch(secondTrigger)
      }
    }

    enableGlobalOutsideClose(currentFirst) {
      if (this.overlapTrigger === 'click') return;
      this.globalOutsideHandler = (e) => {
        const t = e.target;
        const insideFirst  = !!(t && t.closest('.menu__item-title--overlap_slide_out_first'));
        const insideSecond = !!(t && (t.closest('.menu__dropdown-container') || t.closest('.menu-divider')));
        const insideThird  = !!(t && t.closest('.menu__dropdown-grandchild-container--overlap_slide_out'));
    
        if (!insideFirst && !insideSecond && !insideThird) {
          this.closeFirst(currentFirst);
        }
      };
    
      document.addEventListener('mousemove', this.globalOutsideHandler, { passive: true });
    
      this.globalWindowLeaveHandler = () => {
        this.closeFirst(currentFirst);
      };
      window.addEventListener('blur', this.globalWindowLeaveHandler);
      document.addEventListener('mouseleave', this.globalWindowLeaveHandler);
    }

    closeAllGrandchildren(secondWrapper) {
      if (!secondWrapper) return;
      secondWrapper.querySelectorAll('.menu__dropdown-grandchild-container.open').forEach(gc => {
        const trigger = gc.previousElementSibling;
        if (trigger) trigger.classList.remove('open');
        gc.classList.remove('open', 'change-index');
    
        const t = this.zTimers.get(gc);
        if (t) { clearTimeout(t); this.zTimers.delete(gc); }
    
        this.setTabindex(gc, false);
      });
    }
    
    disableGlobalOutsideClose() {
      if (this.globalOutsideHandler) {
        document.removeEventListener('mousemove', this.globalOutsideHandler);
        this.globalOutsideHandler = null;
      }
      if (this.globalWindowLeaveHandler) {
        window.removeEventListener('blur', this.globalWindowLeaveHandler);
        document.removeEventListener('mouseleave', this.globalWindowLeaveHandler);
        this.globalWindowLeaveHandler = null;
      }
    }

    cancelCloseFirst(trigger) {
      if (!this.closeFirstTimers) return;
      const t = this.closeFirstTimers.get(trigger);
      if (t) {
        clearTimeout(t);
        this.closeFirstTimers.delete(trigger);
      }
    }

    isRTL() {
      return document.documentElement.dir === 'rtl' || getComputedStyle(document.documentElement).direction === 'rtl';
    }
  
    openHeaderMenu(event, item) {
      if (event.target.closest('.menu__item-title--first-level.menu__item-title--header')) item.classList.add('open') 
      this.elements.headerDropdownChild.forEach(itemContainer => {
        if (itemContainer.classList.contains('mega-menu') && itemContainer.classList.contains('mega-menu--wide') && itemContainer.closest('.header').offsetWidth > 1024) {
          itemContainer.style.left = - item.getBoundingClientRect().left + itemContainer.closest('.header').getBoundingClientRect().left + 24 + 'px'
          itemContainer.style.width = itemContainer.closest('.header').offsetWidth - 48 + 'px' 
        } else if (itemContainer.classList.contains('mega-menu') && itemContainer.classList.contains('mega-menu--wide') && itemContainer.closest('.header').offsetWidth <= 1024) {
          setTimeout(this.alignDropdown(), 1000)
        } else if (!itemContainer.classList.contains('mega-menu') || itemContainer.classList.contains('mega-menu') && itemContainer.classList.contains('mega-menu--narrow')) {
          setTimeout(this.alignDropdown(), 1000)
        }
      })
      if (item.classList.contains('menu__item-title--slide_out')) {
        this.itemCoordinate = item.getBoundingClientRect()   
        this.elements.dropdownChildList.forEach(el => el.style.top = +this.itemCoordinate.top + 'px')
        this.elements.navContainer.forEach(item => {
          this.containerCoordinate = item.getBoundingClientRect()
          this.elements.dropdownChildList.forEach(element => element.style.top = -this.containerCoordinate.top + 'px')
        })
      }
      if (item.classList.contains('open')) {
        if (item.nextElementSibling) item.nextElementSibling.querySelectorAll('.menu__dropdown-child-item-link').forEach(link => link.setAttribute('tabindex', '0'))
      } else {
        if (item.nextElementSibling) item.nextElementSibling.querySelectorAll('.menu__dropdown-child-item-link').forEach(link => link.setAttribute('tabindex', '-1'))
      }  
    }
  
    openSlideOutMenu(item) {
      if (!item.nextElementSibling) return
      item.closest('.main-sidebar-section').style.zIndex = 21
      let itemParentStyles = window.getComputedStyle(item.closest('.main-sidebar'))
      let padding = +itemParentStyles.getPropertyValue("padding-inline-start").slice(0, -2)
      item.nextElementSibling.style.insetInlineStart = item.closest('.menu__item').offsetWidth - 4 + 'px'
      item.parentElement.querySelector('.menu-divider').style.insetInlineStart = item.closest('.main-sidebar').offsetWidth + 'px'     
      this.itemCoordinate = item.getBoundingClientRect()
      let topMainSidebar = this.closest('.main-sidebar').getBoundingClientRect().top
      this.elements.sidebarDropdownChild.forEach(el => {
        el.style.top = topMainSidebar + 'px'
        el.style.setProperty('--top', `${topMainSidebar}px`);
      })
      this.elements.sidebarDivider.forEach(el => el.style.top = topMainSidebar + 'px')
      document.addEventListener('scroll', () => {
        topMainSidebar = this.closest('.main-sidebar').getBoundingClientRect().top
        this.elements.sidebarDropdownChild.forEach(el => {
          el.style.top = topMainSidebar + 'px'
          el.style.setProperty('--top', `${topMainSidebar}px`);
        })
        this.elements.sidebarDivider.forEach(el => el.style.top = topMainSidebar + 'px')
      })
      this.elements.dropdownChildList.forEach(el => el.style.top = +this.itemCoordinate.top - topMainSidebar + 'px')
      let scrollBarWidth = window.innerWidth - document.body.clientWidth
      this.dropdownWidth = item.closest('.main-sidebar').offsetWidth
      item.nextElementSibling.style.width = this.dropdownWidth + scrollBarWidth + 'px'
      item.classList.add('open')
      if (item.classList.contains('open')) {
        item.nextElementSibling.querySelectorAll('.menu__dropdown-child-item-link').forEach(link => link.setAttribute('tabindex', '0'))
      } else {
        panel.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'))
      }
      if (!item.closest('.menu__item-title--collapsible').classList.contains('open')) {
        let parentItem = item.closest('.menu__item')
        parentItem.querySelector('.menu__item-title--second-level').classList.remove('open')
        if(parentItem.querySelector('.menu__dropdown-grandchild-container')) parentItem.querySelector('.menu__dropdown-grandchild-container').style.maxHeight = ''
      }
      document.dispatchEvent(new CustomEvent('collapsible-menu:opened'));
  }

    handleScrollUpdate (second, divider) {
      let topMainSidebar = this.closest('.main-sidebar').getBoundingClientRect().top;
    
      second.style.top = topMainSidebar + 'px';
      second.style.setProperty('--top', `${topMainSidebar}px`);
  
      this.elements.sidebarOverlapDropdownChild.forEach(el => {
        el.style.top = topMainSidebar + 'px';
        el.style.setProperty('--top', `${topMainSidebar}px`);
      });
  
      if (divider) divider.style.top = topMainSidebar + 'px';
    }

    openOverlapSlideOutMenu(item) {
      if (this.isReopenBlocked && this.isReopenBlocked(item)) return; 
      const second = item.nextElementSibling;
      if (!second) return;
      setTimeout ( () => {
        const mainSidebar = item.closest('.main-sidebar');
        const section = item.closest('.main-sidebar-section');
        if (mainSidebar) mainSidebar.classList.add('overlap-slide-out-menu-opened');
        if (section) section.style.zIndex = 21;
      
        const cs = window.getComputedStyle(mainSidebar);
        const padding = parseFloat(cs.getPropertyValue('padding-inline-start')) || 0;
        const inset = (item.closest('.menu__item').offsetWidth) + 'px';
        second.style.setProperty('--inset-inline-start', inset);
      
        const divider = item.parentElement.querySelector('.menu__dropdown-container + .menu-divider');
        if (divider) divider.style.insetInlineStart = (item.closest('.menu__item').offsetWidth + padding + 2) + 'px';
      
        let topMainSidebar = this.closest('.main-sidebar').getBoundingClientRect().top;
        this.elements.sidebarOverlapDropdownChild.forEach(el => {
          el.style.top = topMainSidebar + 'px';
          el.style.setProperty('--top', `${topMainSidebar}px`);
        });
        divider.style.top = topMainSidebar + 'px'

        this.overlapScrollHandler = () => this.handleScrollUpdate(second, divider);
        window.addEventListener('scroll', this.overlapScrollHandler, { passive: true });
        this.overlapScrollHandler();
      
        const scrollBarWidth = window.innerWidth - document.body.clientWidth;
        const dropdownWidth = mainSidebar.offsetWidth;
        second.style.width = (dropdownWidth + scrollBarWidth) + 'px';
        item.classList.add('open', 'opened');
        second.classList.remove('change-index');
        const timer = setTimeout(() => second.classList.add('change-index'), this.OVER_Z_DELAY);
        this.zTimers.set(second, timer);
      
        this.sizeSlideWidths(mainSidebar, second, null);
        this.setTabindex(second, true);
        if (this.overlapTrigger === 'hover') {
          this.enableGlobalOutsideClose(item);
        }
      }, 50)
    }

    openOverlapSlideOutGrandchildMenu(item, opts = {}) {
    const third = item.nextElementSibling;
    if (!third) return;

    const ms = item.closest('.main-sidebar');
    const secondWrap = item.closest('.menu__dropdown-container');

    if (!opts.seamless) this.closeOpenGrandchildInSameSecond(item, /* animated = */ true);

    const scrollBarWidth = window.innerWidth - document.body.clientWidth;
    const rawW = ms.offsetWidth;
    const padLeft = parseFloat(getComputedStyle(secondWrap).getPropertyValue('padding-inline-start')) || 0;
    const ddWidth = rawW - padLeft;
    third.style.setProperty('--padding-left', `${padLeft}px`);
    third.style.width = (ddWidth + scrollBarWidth) + 'px';

    const rect = secondWrap.getBoundingClientRect();
    const inlineStart = this.isRTL()
      ? (window.innerWidth - rect.left - 1)
      : (rect.right - 1);
    third.style.setProperty('--inset-inline-start-third', `${inlineStart}px`);

    const divider = item.parentElement.querySelector('.menu__dropdown-grandchild-container--overlap_slide_out + .menu-divider');
    if (divider) divider.style.insetInlineStart = (inlineStart + 1) + 'px';

    const doOpen = () => {
      item.classList.add('open', 'opened');
      third.classList.add('open', 'opened');
      third.classList.remove('change-index');
      const timer = setTimeout(() => third.classList.add('change-index'), this.OVER_Z_DELAY);
      this.zTimers.set(third, timer);
      this.sizeSlideWidths(ms, secondWrap, third);
      requestAnimationFrame(() => this.setTabindex(third, true));
    };

    if (opts.animated === false) {
      this.withNoAnim(third, () => {
        this.withNoAnim(item, () => {
          doOpen();
        });
      });
    } else {
      doOpen();
    }
  }

    closeFirst(first) {
      setTimeout ( () => {
        first.classList.add('closed');
        first.classList.remove('open');
        setTimeout(() => {
          first.classList.remove('opened', 'closed');
        }, 200)
        const second = first.nextElementSibling;
        if (second) {
          second.classList.remove('change-index');
          const t = this.zTimers.get(second);
          if (t) { clearTimeout(t); this.zTimers.delete(second); }
      
          second.querySelectorAll('.menu__item-title--overlap_slide_out_second.open, .menu__dropdown-grandchild-container.open')
            .forEach(el => {
              el.classList.add('closed');
              el.classList.remove('open', 'change-index');
              setTimeout(() => {
                el.classList.remove('opened', 'closed');
              }, 200)
              const tt = this.zTimers.get(el);
              if (tt) { clearTimeout(tt); this.zTimers.delete(el); }
            });
      
          this.setTabindex(second, false);
          if (this.overlapScrollHandler) {
            window.removeEventListener('scroll', this.overlapScrollHandler);
            this.overlapScrollHandler = null;
          }
        }
        if (this._outsideClickHandler) {
          document.removeEventListener('click', this._outsideClickHandler, { capture: true });
          this._outsideClickHandler = null;
        }
        const ms = first.closest('.main-sidebar');
        if (ms) ms.classList.remove('overlap-slide-out-menu-opened');
        const section = first.closest('.main-sidebar-section');
        if (section) section.style.zIndex = 20;
        this.disableGlobalOutsideClose();
        const anyOpen = Array.from(this.elements.overlapFirstLevelLink).some(el => el.classList.contains('open'));
        if (!anyOpen) {
          if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler, { capture: true });
            this._outsideClickHandler = null;
          }
          if (this._outsideMainSidebarHandler) {
            document.removeEventListener('click', this._outsideMainSidebarHandler, { capture: true });
            this._outsideMainSidebarHandler = null;
          }
        }
      }, 50)
    }
    
    closeGrandchild(secondTrigger) {
      setTimeout ( () => {
        const third = secondTrigger?.nextElementSibling;
        if (!third) return;
        secondTrigger.classList.add('closed');
        secondTrigger.classList.remove('open');
        third.classList.add('closed');
        third.classList.remove('open', 'change-index');
        setTimeout(() => {
          secondTrigger.classList.remove('opened', 'closed');
          third.classList.remove('opened', 'closed');
        }, 200)
        const t = this.zTimers.get(third);
        if (t) { clearTimeout(t); this.zTimers.delete(third); }
      
        const section = secondTrigger.closest('.main-sidebar-section');
        if (section) section.style.zIndex = 20;
        this.setTabindex(third, false);
      }, 50)
    }

    closeOpenGrandchildInSameSecond(ref, animated = true) {
    const secondWrapper = ref.closest('.menu__dropdown-container');
    if (!secondWrapper) return;

    const toClose = [];
    secondWrapper.querySelectorAll('.menu__dropdown-grandchild-container.open, .menu__dropdown-grandchild-container.opened').forEach(gc => {
      const trigger = gc.previousElementSibling;
      if (!trigger || trigger === ref) return;
      toClose.push({ trigger, gc });
    });

    if (toClose.length === 0) return;

    if (animated) {
      toClose.forEach(({ trigger, gc }) => {
        trigger.classList.add('closed');
        trigger.classList.remove('open');
        gc.classList.add('closed');
        gc.classList.remove('open', 'change-index');
        setTimeout(() => {
          trigger.classList.remove('opened', 'closed');
          gc.classList.remove('opened', 'closed');
        }, 200);
        const tt = this.zTimers.get(gc);
        if (tt) { clearTimeout(tt); this.zTimers.delete(gc); }
        this.setTabindex(gc, false);
      });
      return;
    }

    toClose.forEach(({ trigger, gc }) => {
      this.withNoAnim(trigger, () => {
        this.withNoAnim(gc, () => {
          trigger.classList.remove('open', 'opened', 'closed');
          gc.classList.remove('open', 'opened', 'closed', 'change-index');
          const tt = this.zTimers.get(gc);
          if (tt) { clearTimeout(tt); this.zTimers.delete(gc); }
          this.setTabindex(gc, false);
        });
      });
    });
  }

    blockReopen(first, ms = 300) {
      if (this._reopenBlock.has(first)) {
        clearTimeout(this._reopenBlock.get(first));
      }
      const tid = setTimeout(() => this._reopenBlock.delete(first), ms);
      this._reopenBlock.set(first, tid);
    }
    
    isReopenBlocked(first) {
      return this._reopenBlock.has(first);
    }

    closeAllReally() {
      this.querySelectorAll(
        '.menu__dropdown-grandchild-container.open, .menu__dropdown-grandchild-container.opened'
      ).forEach(third => {
        const secondTrigger = third.previousElementSibling;
        if (secondTrigger) this.closeGrandchild(secondTrigger);
      });
    
      this.elements.overlapFirstLevelLink.forEach(first => {
        const second = first.nextElementSibling;
    
        const hasOpenInside = !!(second && second.querySelector(
          '.menu__item-title--overlap_slide_out_second.open,' +
          '.menu__item-title--overlap_slide_out_second.opened,' +
          '.menu__dropdown-grandchild-container.open,' +
          '.menu__dropdown-grandchild-container.opened'
        ));
    
        if (
          first.classList.contains('open') ||
          first.classList.contains('opened') ||
          hasOpenInside
        ) {
          this.closeFirst(first);
        }
      });
    }

    sizeSlideWidths(mainSidebar, secondEl, thirdEl) {
      if (!mainSidebar || !secondEl) return;
    
      const viewportW  = window.innerWidth;
      const scrollbarW = window.innerWidth - document.body.clientWidth;
      const firstW     = mainSidebar.offsetWidth;
      const freeW      = Math.max(0, viewportW - firstW - scrollbarW);
    
      const limitBySidebar = Math.min(this.SLIDE_MAX_WIDTH || 400, firstW);
      const MAX_SECOND = limitBySidebar;
      const MAX_THIRD  = limitBySidebar;
    
      if (!thirdEl) {
        const st        = window.getComputedStyle(secondEl);
        const padInline = parseFloat(st.getPropertyValue('padding-inline-start')) || 0;
        const targetContent = Math.min(MAX_SECOND, Math.floor(freeW / 2));
        const secondW       = Math.max(0, targetContent + padInline);
    
        secondEl.style.maxWidth = (MAX_SECOND + padInline) + 'px';
        secondEl.style.width    = secondW + 'px';
        secondEl.dataset.lockedWidth = String(secondW);
        return;
      }
    
      const secondLocked =
        parseFloat(secondEl.dataset.lockedWidth || '') ||
        parseFloat(secondEl.style.width) ||
        secondEl.getBoundingClientRect().width;
    
      const remain = Math.max(0, freeW - secondLocked);
      const thirdW = Math.min(MAX_THIRD, remain);
    
      thirdEl.style.maxWidth = MAX_THIRD + 'px';
      thirdEl.style.width    = thirdW + 'px';
    }

    setTabindex(container, on) {
      if (!container) return;
    
      const focusables = container.querySelectorAll(
        'a, button, input, select, textarea, [tabindex], .menu__dropdown-child-item-link, .menu__dropdown-grandchild-item-link'
      );
    
      focusables.forEach(el => {
        if (on) {
          if (el.hasAttribute('data-prev-tabindex')) {
            const prev = el.getAttribute('data-prev-tabindex');
            if (prev === '' || prev === null) el.removeAttribute('tabindex');
            else el.setAttribute('tabindex', prev);
            el.removeAttribute('data-prev-tabindex');
          } else {
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
          }
          el.removeAttribute('aria-hidden');
        } else {
          if (!el.hasAttribute('data-prev-tabindex')) {
            el.setAttribute('data-prev-tabindex', el.getAttribute('tabindex') ?? '');
          }
          el.setAttribute('tabindex', '-1');
          el.setAttribute('aria-hidden', 'true');
        }
      });
    }
  
    toggleCollapsibleMenu(item) {
      item.closest('.menu__item-title--collapsible').classList.toggle('open')
        if (item.classList.contains('dropdown-icon--plus')) {
          item.setAttribute('tabindex', '-1')
          item.nextElementSibling.setAttribute('tabindex', '0')
        }
        if (item.classList.contains('dropdown-icon--minus')) {
          item.setAttribute('tabindex', '-1')
          item.previousElementSibling.setAttribute('tabindex', '0')
        }
        let panel = item.closest('.menu__item-title--collapsible').nextElementSibling
        panel.style.maxHeight ? panel.style.maxHeight = null : panel.style.maxHeight = panel.scrollHeight + "px"
        if (item.closest('.menu__item-title--collapsible').classList.contains('open')) {
          panel.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '0'))
        } else {
          panel.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'))
        }
        if (!item.closest('.menu__item-title--collapsible').classList.contains('open')) {
          let parentItem = item.closest('.menu__item')
          parentItem.querySelector('.menu__item-title--second-level').classList.remove('open')
          if(parentItem.querySelector('.menu__dropdown-grandchild-container')) parentItem.querySelector('.menu__dropdown-grandchild-container').style.maxHeight = ''
        }
        document.dispatchEvent(new CustomEvent('collapsible-menu:opened'));
    }
  
    toggleSecondLevelMenu(item) {
      item.parentElement.classList.toggle('open')
      let childPanel = item.closest('.menu__item-title--second-level').nextElementSibling
      childPanel.style.maxHeight ? childPanel.style.maxHeight = null : childPanel.style.maxHeight = childPanel.scrollHeight + "px"
      if (item.closest('.menu__item-title--collapsible + .menu__dropdown-container')) {
        let parent = item.closest('.menu__item-title--collapsible + .menu__dropdown-container')
        let parentHeight = parent.offsetHeight
        parent.style.maxHeight = parentHeight + childPanel.scrollHeight + "px"
      }
      let panel = item.closest('.menu__item-title--second-level').nextElementSibling
        if (item.closest('.menu__item-title--second-level').classList.contains('open')) {
          panel.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '0'))
        } else {
          panel.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'))
        }
    }
  
    alignDropdown() {
      const isRTL = document.documentElement.dir === 'rtl';
  
      this.elements.headerDropdownChild.forEach(item => {
        this.itemCoordinate = item.getBoundingClientRect();
        this.viewportHeight = window.innerHeight
        this.viewportWidth = window.innerWidth
        this.header = item.closest('.header') 
        const elementOverflowsViewport = isRTL ? item.closest('.menu__item').getBoundingClientRect().left - item.offsetWidth < 0 : item.closest('.menu__item').getBoundingClientRect().left + item.offsetWidth + this.sidebarWidth > this.viewportWidth;
        
        if (elementOverflowsViewport) {
          item.style.left = isRTL 
            ?  0 - item.closest('.menu__item').getBoundingClientRect().left + 16 + 'px'
            : this.viewportWidth - (item.closest('.menu__item').getBoundingClientRect().left + item.offsetWidth) - 16 - this.sidebarWidth + 'px'
        }
        if (this.itemCoordinate.offsetHeight > this.viewportHeight) item.style.top = - this.itemCoordinate.height + 'px'
      })
    }
    closeParentContainers(link) {
      if (link.closest('.menu-drawer')) {
        link.closest('.menu-drawer').setAttribute('hidden', 'true')
        link.closest('.menu-drawer').classList.remove('open')
        document.body.classList.remove('hidden')
        document.dispatchEvent(new CustomEvent('body:visible'));
      }
      if (link.closest('.menu__list--header')) link.closest('.menu__item-title--header').classList.remove('open')
      if (link.closest('.menu__list--main-sidebar')) link.closest('.menu__item-title--slide_out').classList.remove('open')
    }
  
    closeSecondDropdown(parent) {
      let children = parent.querySelectorAll('.menu__dropdown-child-item')
      children.forEach(item => {
        item.querySelector('.menu__item-title--second-level').classList.remove('open')
        if (item.querySelector('.menu__dropdown-grandchild-container')) item.querySelector('.menu__dropdown-grandchild-container').style.maxHeight = ''
      })
    }
  }
customElements.define('menu-dropdown', MenuDropdown);

class StoreSelectorDrawer extends HTMLElement {
  constructor() {
    super();

    this.drawer = document.querySelector('.store-selector-drawer__inner')
    this.storeDrawerLinks = document.querySelectorAll('.store-selector-drawer-opener');
    this.originalParent = this.parentElement;
    this.originalNextSibling = this.nextElementSibling;
    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.overlay = document.querySelector('body > .overlay')
    this.initStoreSelectorTriggers();
    this.overlay.addEventListener('click', this.close.bind(this));
    document.addEventListener('shopify:section:load', this.initStoreSelectorTriggers.bind(this));
    document.querySelector('.store-selector-drawer').addEventListener('shopify:section:select', this.sectionSelect.bind(this));
    document.querySelector('.store-selector-drawer').addEventListener('shopify:section:deselect', this.close.bind(this));
  }

  connectedCallback() {
    this.storeCheckboxes = document.querySelectorAll('.store-selector-drawer .store-accordion__checkbox');
    this.changeStoreButton = document.querySelector('.store-selector-drawer .change-store-button');
    this.currentStore = Array.from(this.storeCheckboxes).find(cb => cb.checked)?.value;

    if (!this.currentStore) {
      this.resetSavedStore();
    }

    this.toggleChangeButtonState();
    this.setEventListeners();
  }

  async resetSavedStore() {
    try {
      await this.updateCartAttribute("store", '');

      const storeSelectorTexts = document.querySelectorAll('.store-selector__text');
      storeSelectorTexts.forEach(storeSelectorText => {
        storeSelectorText.innerHTML = storeSelectorText.dataset.placeholder;
      });

      const pickUpAvailabilities= document.querySelectorAll('.pickup-availability');
      pickUpAvailabilities.forEach(pickUpAvailability => {
        pickUpAvailability.classList.remove('pickup-availability--available');
        pickUpAvailability.classList.add('pickup-availability--unavailable');

        const text = pickUpAvailability.querySelector('.pickup-availability__text');
        text.innerHTML = text.dataset.placeholder;
      })     
    } catch (error) {
      console.error("Error updating store cart attribute:", error);
    }
  }

  toggleChangeButtonState() {
    const hasChecked = Array.from(this.storeCheckboxes).some(checkbox => checkbox.checked);
    this.changeStoreButton.disabled = !hasChecked;
  }

  setEventListeners() {
    this.storeCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handleCheckboxChange(checkbox));
    });

    this.changeStoreButton.addEventListener('click', () => this.handleChangeStore());

    document.addEventListener('store-selector-drawer:close', (e) => {
      if (e.detail.targetTag === 'store-selector-drawer') {
        this.restoreCheckedState();
      }
    });

    document.addEventListener('shopify:section:unload', (event) => {
      if (event.target.closest('.store-selector-drawer')) {
        this.resetSavedStore();
      }
    })
  }

  handleCheckboxChange(changedCheckbox) {
    if (changedCheckbox.checked) {
      this.storeCheckboxes.forEach((checkbox) => {
        if (checkbox !== changedCheckbox) {
          checkbox.checked = false;
          checkbox.removeAttribute('checked');
        }
      });

      changedCheckbox.setAttribute('checked', 'checked');
      this.changeStoreButton.disabled = false;
    } else {
      changedCheckbox.checked = true;
      changedCheckbox.setAttribute('checked', 'checked');
    }
  }

  async handleChangeStore() {
    const selectedCheckbox = Array.from(this.storeCheckboxes).find(cb => cb.checked);
    if (!selectedCheckbox) return;

    const storeName = selectedCheckbox.value;

    if (storeName === this.currentStore) {
      this.close();
      return;
    }

    try {
      let loader = this.changeStoreButton.querySelector('.change-store-button__loader');
      if (loader) loader.classList.remove('hidden');

      await this.updateCartAttribute("store", storeName);   
      window.location.reload();
    } catch (error) {
      console.error("Error updating store cart attribute:", error);
    } finally {
      let loader = this.changeStoreButton.querySelector('.change-store-button__loader');
      if (loader) loader.classList.add('hidden');
    }
  }

  restoreCheckedState() {
    this.storeCheckboxes.forEach((checkbox) => {
      const isMatch = checkbox.value === this.currentStore;
      checkbox.checked = isMatch;
      checkbox.toggleAttribute('checked', isMatch);
    });

    this.toggleChangeButtonState();
  }

  async updateCartAttribute(attribute, value) {
    return fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributes: { [attribute]: value } }),
    });
  }

  initStoreSelectorTriggers() {
    this.storeDrawerLinks = document.querySelectorAll('.store-selector-drawer-opener');
    Array.from(this.storeDrawerLinks).forEach(link => {
      link.setAttribute('role', 'button');
      link.setAttribute('aria-haspopup', 'dialog');
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.open(link)
      });
      link.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          event.preventDefault();
          this.open(link);
        }
      });
    })
  }

  sectionSelect() {
    this.storeDrawerLink = document.querySelector('.store-selector-drawer-opener')
    this.open(this.storeDrawerLink)
  }

  open(triggeredBy) {
    const menuDrawer = triggeredBy.closest('.menu-drawer');
    if (menuDrawer) {
      this.closeMenuDrawer(menuDrawer);
    }
    const existingInBody = Array.from(document.body.querySelectorAll('store-selector-drawer'))
    .find(el => el !== this);
    if (existingInBody) {
      existingInBody.classList.remove('active', 'animate');
      existingInBody.remove();
    }
    document.body.appendChild(this);
    if (triggeredBy) this.setActiveElement(triggeredBy);
    if (!this.overlay.classList.contains('open')) this.overlay.classList.add('open');
    setTimeout(() => {this.classList.add('animate', 'active')});
    document.body.classList.add('hidden');
    this.drawer.setAttribute('tabindex', '0')
    setTimeout(() => trapFocus(triggeredBy, this.drawer.querySelector('a')), 10)
  }

  closeMenuDrawer(menuDrawer) {
    menuDrawer.setAttribute('hidden', 'true')
    menuDrawer.classList.remove('open')
    document.querySelectorAll('.burger-menu').forEach(item => item.blur());
  }

  close() {
    if (this.overlay) this.overlay.classList.remove('open');
    this.classList.remove('active');
    if(this.activeElement) removeTrapFocus(this.activeElement);
    document.body.classList.remove('hidden')
    document.dispatchEvent(new CustomEvent('body:visible',
      {
        detail: {
          targetTag: 'store-selector-drawer'
        }
      }
    ));
    this.drawer.setAttribute('tabindex', '-1')
    if (this.originalParent) {
      if (this.originalNextSibling) {
        this.originalParent.insertBefore(this, this.originalNextSibling);
      } else {
        this.originalParent.appendChild(this);
      }
    }
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('store-selector-drawer', StoreSelectorDrawer);

class NewsDrawer extends HTMLElement {
  constructor() {
    super();

    this.drawer = this.querySelector('.news-drawer__inner')
    this.newsDrawerLinks = document.querySelectorAll('.news-drawer-opener');
    this.sectionEl = this.closest('.shopify-section') || this;
    this.sectionOriginalParent = this.sectionEl.parentElement;
    this.sectionOriginalNextSibling = this.sectionEl.nextElementSibling;
    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.overlay = document.querySelector('body > .overlay')
    let newsDrawerSection = this.sectionEl;
    document.addEventListener('shopify:section:load', (evt) => {
      if (evt?.detail?.sectionId) {
        const loaded = document.querySelector(`#shopify-section-${evt.detail.sectionId}`);
        if (loaded && loaded.contains(this)) {
          this.overlay = document.querySelector('body > .overlay');
          this.newsDrawerLinks = document.querySelectorAll('.news-drawer-opener');
          this.newsDrawerLinks.forEach(link => link.addEventListener('click', () => this.open(link)));
          this.sectionEl = this.closest('.shopify-section') || this;
          this.sectionOriginalParent = this.sectionEl.parentElement;
          this.sectionOriginalNextSibling = this.sectionEl.nextElementSibling;
          newsDrawerSection = this.sectionEl;
          this.updateUnreadIndicator();
          if (Shopify.designMode) {
            document.body.classList.add('disable-scroll-body');
          }
          this.open(this)
        }
      }
    })
    this.overlay?.addEventListener('click', this.close.bind(this));
    this.newsDrawerLinks.forEach(link => link.addEventListener('click', () => this.open(link)))
    newsDrawerSection?.addEventListener('shopify:section:select', (event) => {
      if (Shopify.designMode) {
        document.body.classList.add('disable-scroll-body');
      }
      this.open(this)
    });
    newsDrawerSection?.addEventListener('shopify:section:deselect', this.close.bind(this));

    this.storageKey = 'newsDrawerSeenVersion';
    this.currentVersion = (this.dataset.newsVersion || '').trim();
    this.updateUnreadIndicator();
  }

  connectedCallback() {
    const all = document.querySelectorAll('news-drawer');
    all.forEach(el => {
      if (el !== this) {
        el.classList?.remove('active', 'animate');
        el.closest('.shopify-section').remove();
      }
    });
  }

  updateUnreadIndicator() {
    try {
      const seen = localStorage.getItem(this.storageKey) || '';
      const hasUnread = !!this.currentVersion && this.currentVersion !== seen;
      this.newsDrawerLinks = document.querySelectorAll('.news-drawer-opener');
      this.newsDrawerLinks.forEach(btn => {
        btn.classList.toggle('has-unread', hasUnread);
      });
    } catch (e) {
    }
  }

  markAsSeen() {
    try {
      if (this.currentVersion) {
        localStorage.setItem(this.storageKey, this.currentVersion);
      }
    } catch (e) {}
    this.updateUnreadIndicator();
  }

  sectionSelect() {
    this.newsDrawerLink = document.querySelector('.news-drawer-opener')
    this.open(this.newsDrawerLink)
  }

  open(triggeredBy) {
    const existing = Array.from(document.body.querySelectorAll('.shopify-section'))
      .find(sec => sec !== this.sectionEl && sec.contains(document.querySelector('news-drawer')));
    if (existing) {
      const otherDrawer = existing.querySelector('news-drawer');
      if (otherDrawer?.close) {
        try { otherDrawer.close(); } catch(e) {}
      }
    }

    document.body.appendChild(this.sectionEl);
    if (triggeredBy) this.setActiveElement(triggeredBy);
    if (!this.overlay.classList.contains('open')) this.overlay.classList.add('open');
    setTimeout(() => {this.classList.add('animate', 'active')});
    document.body.classList.add('hidden');
    this.drawer.setAttribute('tabindex', '0')
    if(triggeredBy) setTimeout(() => trapFocus(triggeredBy, this.drawer.querySelector('a')), 10)
    this.markAsSeen();
  }

  close() {
    if (Shopify.designMode) {
      document.body.classList.remove('disable-scroll-body');
    }
    if (this.overlay) this.overlay.classList.remove('open');
    this.classList.remove('active');
    document.body.classList.remove('hidden')
    document.dispatchEvent(new CustomEvent('body:visible', {
      detail: { targetTag: 'store-selector-drawer' }
    }));
    this.drawer.setAttribute('tabindex', '-1')
    if (this.sectionOriginalParent) {
      if (this.sectionOriginalNextSibling) {
        this.sectionOriginalParent.insertBefore(this.sectionEl, this.sectionOriginalNextSibling);
      } else {
        this.sectionOriginalParent.appendChild(this.sectionEl);
      }
    }
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}
customElements.define('news-drawer', NewsDrawer);

class FormState extends HTMLElement {
  constructor() {
    super();

    this.formInputs = this.querySelectorAll('input.required, select[required]');
    this.form = this.querySelector('form');
    if (this.form) this.buttonSubmit = this.form.querySelector('button[type="submit"]') || this.form.querySelector('.button--submit');

    this.formInputs.forEach((input) => {
      input.addEventListener('input', this.onInputChange.bind(this));
    });
    if (this.buttonSubmit) this.buttonSubmit.addEventListener('click', this.onSubmitHandler.bind(this));
  }

  onInputChange(event) {
    if(event.target.closest('.invalid')) event.target.classList.remove('invalid');
    event.target.classList.add('valid');
  }

  onSubmitHandler() {
    this.formInputs.forEach((input) => {
      if(input.hasAttribute('type') && input.getAttribute('type') == 'password' || input.hasAttribute('type') && input.getAttribute('type') == 'text') {
        input.value.length == 0 ? this.invalidInput(input) : this.validInput(input)
      }
      if(input.hasAttribute('type') && input.getAttribute('type') == 'email') {
        input.value.includes('@') ? this.validInput(input) : this.invalidInput(input)
      }
      if(!input.hasAttribute('type')) {
        input.value === input.dataset.empty ? this.invalidInput(input) : this.validInput(input)
      }
    });
    if(!this.closest('.promo-popup')) {
      document.dispatchEvent(new CustomEvent('form:submitted'));
    }
  }

  invalidInput(input) {
    if(input.closest('.valid')) input.classList.remove('valid');
    input.classList.add('invalid');
  }
  validInput(input) {
    if(input.closest('.invalid')) input.classList.remove('invalid');
    input.classList.add('valid');
  }
}
customElements.define('form-state', FormState);  

class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true })
    this.querySelectorAll('button').forEach(
      (button) => button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;
    event.target.name === 'plus' ? this.input.stepUp() : this.input.stepDown();
    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);
  }
}
customElements.define('quantity-input', QuantityInput);

class ModalDialog extends HTMLElement {
  constructor() {
    super();

    this.elements = {
      body: document.querySelector('body'),
      buttons: this.querySelectorAll('.open-popup'),
      overlay: document.querySelector('body > .overlay'),
      buttonsClose: this.querySelectorAll('.close-popup'),
      filterGroups: this.querySelectorAll('.filter-group')
    };

    this.originalPopupState = new WeakMap();
    this.popup = null;

    this.elements.buttons.forEach(button => {
      const popup = button.parentNode.querySelector('.popup-wrapper');
      if (popup) {
        button.dataset.popupId = this.generatePopupId();
        popup.dataset.popupId = button.dataset.popupId;

        this.originalPopupState.set(popup, {
          parent: popup.parentNode,
          nextSibling: popup.nextSibling
        });
      }

      button.addEventListener('click', (event) => this.openContainer(event));
      button.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') this.openContainer(event);
      });
    });

    if (this.elements.overlay) {
      this.elements.overlay.addEventListener('click', this.closeContainer.bind(this));
    }

    if (this.elements.buttonsClose) {
      this.elements.buttonsClose.forEach(buttonClose =>
        buttonClose.addEventListener('click', this.closeContainer.bind(this))
      );
    }

    document.addEventListener('keyup', (event) => {
      if (event.code && event.code.toUpperCase() === 'ESCAPE' && document.body.querySelector('.popup-wrapper.open')) {
        this.closeContainer(event);
      }
    });

    if (this.closest('.only-mobile.snippet-facets')) {
      window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && this.popup && this.popup.classList.contains('open')) {
          this.closeContainer({ target: this.querySelector('.close-popup') });
        }
      });
    }
  }

  generatePopupId() {
    return 'popup-' + Math.random().toString(36).substr(2, 9);
  }

  openContainer(event) {
    const trigger = event.target.closest('.open-popup');
    if (!trigger) return;

    const popupId = trigger.dataset.popupId;
    const popup = document.querySelector(`.popup-wrapper[data-popup-id="${popupId}"]`);
    if (!popup) return;

    this.popup = popup;

    document.body.appendChild(this.popup);
    this.popup.classList.add('open');
    this.elements.overlay.classList.add('open');

    if (this.closest('.container--sticky')) this.closest('.container--sticky').style.position = 'static';
    if (this.popup.closest('.hover-content')) this.popup.closest('.banner__content')?.style.setProperty('opacity', 1, 'important');
    if (this.popup.closest('.slider__grid')) this.popup.closest('.slider__grid').style.overflow = 'visible';

    const inputPassword = this.popup.querySelector('input.enter-using-password');
    if (inputPassword) inputPassword.focus();

    if (!this.elements.body.classList.contains('hidden')) {
      this.elements.body.classList.add('hidden');
    }

    document.dispatchEvent(new CustomEvent('dialog:after-show'));
  }

  closeContainer(event) {
    const eventTarget = event?.target || event;

    if (eventTarget.closest?.('a.media-with-text__card')) event.preventDefault();
    if (eventTarget.closest?.('.card-quick-view')) {
      event.preventDefault();
      eventTarget.closest('.card-quick-view').classList.remove('no-hover');
    }

    this.popup = document.body.querySelector('.popup-wrapper.open');
    if (!this.popup) return;

    if (this.popup.querySelector)

    this.popup.classList.remove('open');
    this.elements.overlay.classList.remove('open');

    const original = this.originalPopupState.get(this.popup);
    if (original) {
      original.parent.insertBefore(this.popup, original.nextSibling);
    }

    if (this.closest('.container--sticky')) this.closest('.container--sticky').style.position = 'sticky';
    if (this.popup.closest('.hover-content')) this.popup.closest('.banner__content')?.style.removeProperty('opacity');
    if (this.popup.closest('.slider__grid')) {
      this.popup.closest('.slider__grid').style.overflowX = 'auto';
      this.popup.closest('.slider__grid').style.overflowY = 'hidden';
    }

    if (this.elements.body.classList.contains('hidden')) {
      this.elements.body.classList.remove('hidden');
      document.dispatchEvent(new CustomEvent('body:visible'));
    }

    this.elements.filterGroups.forEach(item => {
      if (item.hasAttribute('open')) item.setAttribute('open', '');
    });

    document.dispatchEvent(new CustomEvent('dialog:after-hide'));
  }
}

customElements.define('modal-dialog', ModalDialog);

class ModalWindow extends HTMLElement {
  constructor() {
    super();

    this.originalContentParent = null;
    this.contentPlaceholder = document.createComment('modal-content-placeholder');
    this.cookieName = 'avante-theme:form-submitted';

    this.handleCloseClick = this.handleCloseClick.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    document.addEventListener('click', this.handleCloseClick);

    document.querySelector('body > .overlay')?.addEventListener('click', this.handleOverlayClick);

    this.addEventListener('keyup', this.handleKeyUp);

    document.addEventListener('form:submitted', () => {
      this.detectSubmittedForm();
    });
  }

  handleCloseClick(event) {
    const closeBtn = event.target.closest('.product-popup-modal__content [id^="ModalClose-"]');
    if (closeBtn) {
      this.hide();
      document.dispatchEvent(new CustomEvent('product-modal:close'));
    }
  }

  handleOverlayClick() {
    this.hide();
  }

  handleKeyUp(event) {
    if (event.code.toUpperCase() === 'ESCAPE') {
      this.hide();
    }
  }

  show(opener) {
    this.openedBy = opener;
    this.popupContent = this.querySelector('.product-popup-modal__content');

    if (this.popupContent) {
      this.originalContentParent = this.popupContent.parentNode;
      this.originalContentParent.insertBefore(this.contentPlaceholder, this.popupContent);
      document.body.appendChild(this.popupContent);
      this.popupContent.classList.add('open');
    }

    document.body.classList.add('hidden');
    this.setAttribute('open', '');

    if(!opener?.closest('.product__modal-opener')) document.querySelector('body > .overlay')?.classList.add('open');

    if (this.classList.contains('product-popup-modal--question')) {
      this.input = this.querySelector('.field.product-url input');
      if (this.input) {
        this.input.setAttribute('value', `${window.location.href}`);
      }
    }

    const popup = this.querySelector('.template-popup');
    if (popup && typeof popup.loadContent === 'function') {
      popup.loadContent();
    }

    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
  }

  hide() {
    if (this.popupContent && this.originalContentParent) {
      this.popupContent.classList.remove('open');
      this.originalContentParent.insertBefore(this.popupContent, this.contentPlaceholder);
      this.contentPlaceholder.remove();
    }

    this.hideSubmittedForm();
    document.body.classList.remove('hidden');
    document.dispatchEvent(new CustomEvent('body:visible'));
    this.removeAttribute('open');

    if(!opener?.closest('.product__modal-opener')) document.querySelector('body > .overlay')?.classList.remove('open');

    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();

    this.popupContent = null;
    this.originalContentParent = null;
  }

  detectSubmittedForm() {
    if (isStorageSupported('local')) {
      window.localStorage.setItem(this.cookieName, true);
    }
  }

  hideSubmittedForm() {
    if (isStorageSupported('local')) {
      window.localStorage.removeItem(this.cookieName);
      this.classList.remove('form-submitted');
    }
  }
}

customElements.define('modal-window', ModalWindow);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    this.button = this.querySelector('button');
    this.posX1 
    this.posInit 
    this.posX2
    this.posY1
    this.posY2 
    this.posInitY
    this.cookieName = 'avante-theme:form-submitted'
    if (this.classList.contains('zoom-disabled')) return
    if (!this.button) return;
    this.button.addEventListener('mousedown', this.mouseDown.bind(this))
    this.button.addEventListener('mousemove', this.mouseMove.bind(this))
    this.button.addEventListener('mouseup', this.mouseUp.bind(this))
    document.addEventListener('shopify:section:load', () => {
      this.button = this.querySelector('button');
      document.body.classList.remove('hidden')
    })
    this.checkIfFormSubmitted()
  }

  getEvent (event) {
    return event.type.search('touch') !== -1 ? event.touches[0] : event;
  }

  mouseDown(event) {
    let evt = this.getEvent(event);
    this.posInit = this.posX1 = evt.clientX;
    this.posInitY = this.posY1 = evt.clientY
  }

  mouseMove() {
    let evt = this.getEvent(event)
    this.posX2 = this.posX1 - evt.clientX;
    this.posX1 = evt.clientX;
    this.posY2 = this.posY1 - evt.clientY;
    this.posY1 = evt.clientY;
  }

  mouseUp() {
    if ((Math.abs(this.posInit - this.posX1) - Math.abs(this.posInitY - this.posY1) > 5)) return
    const modal = document.querySelector(this.getAttribute('data-modal'));
    if (modal) modal.show(this.button)
    if (modal && this.closest('.product__modal-opener')) {
      let mediaId = this.button.dataset.mediaId
      document.dispatchEvent(new CustomEvent('product-modal:open', { detail: mediaId } ));
    }
  }

  checkIfFormSubmitted() {
    if (isStorageSupported('local')) {
      const formSubmitted = window.localStorage.getItem(this.cookieName);
      if (formSubmitted) {
        const modal = document.querySelector(this.getAttribute('data-modal'));
        if (modal && this.button.classList.contains('popup-button--form')) {
          modal.classList.add('form-submitted')
          modal.show(this.button);
        }
      }
    }
  }

}
customElements.define('modal-opener', ModalOpener);

class SliderComponent extends HTMLElement {
  constructor() {
    super();
    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.mediaId
    this.hasGlobalMediaSettings = Array.from(this.sliderItems).some(item => 
      item.querySelector('img.product-modal-image')
    ); 

    if (this.slider?.closest('.product-media-modal')) this.slider.style.scrollBehavior = 'auto'

    this.scrollbar = this.querySelector('.slider-scrollbar')
    this.scrollbarTrack = this.querySelector('.slider-scrollbar__track')
    this.scrollbarThumb = this.querySelector('.slider-scrollbar__thumb')
    if (this.slider && this.slider.closest('.product-media-modal')) this.slider.style.scrollBehavior = 'auto'

    document.addEventListener('product-modal:close', () => {
      if (this.slider.closest('.product-media-modal')) {
        this.sliderItems.forEach(item => {
          item.style.marginTop = '';
        })
      }
    })

    document.addEventListener('product-modal:open', (event) => {
      if (this.slider.closest('.product-media-modal')) {
        const modalContent = this.closest('.product-media-modal__content');
        if (modalContent) modalContent.scrollTop = 0;

        this.slider.style.scrollBehavior = 'auto'
      }

      if (this.hasGlobalMediaSettings) {
        this.sliderItems.forEach(item => item.classList.remove('is-active'))
        this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
        this.sliderItems = Array.from(this.sliderItems).filter(item => {
          const image = item.querySelector('img.product-modal-image');
          return !image || (
            image.classList.contains('product__media-item--variant--alt') ||
            image.classList.contains('product__media-item--variant-show') || image.classList.contains('product__media-item--show')
          );  
        });
        this.mediaId = event.detail
        this.sliderItems.forEach(item => {
          if (item.querySelector(`[data-media-id="${this.mediaId}"]`)) {
            item.classList.add('is-active')
            return
          }
        })
        this.activeSlide = this.slider.querySelector('.is-active')
        let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)

        if (this.slider.closest('.product-media-modal')) {
          this.querySelector('.slider__grid').style.setProperty('height', this.sliderItems[activeSlideIndex].clientHeight + 'px');
        }

        if (this.prevButton && this.nextButton) {
          activeSlideIndex == 0 ? this.prevButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.prevButton.forEach(button => button.removeAttribute('disabled'))
          activeSlideIndex == this.totalPages - 1 ? this.nextButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.nextButton.forEach(button => button.removeAttribute('disabled'))
        }
      }
   
      if (this.slider.closest('.product-media-modal')) {
        this.sliderItems.forEach(item => {       
          const visualViewportHeight = window.visualViewport.height;

          if (item.offsetHeight < visualViewportHeight) {
            item.style.marginTop = `${(visualViewportHeight - item.offsetHeight) / 2}px`;
          }
        });
      }
    })

    this.sliderGrid = this.querySelector('.slider__grid');
    this.thumbnails = this.querySelector('[id^="Slider-Thumbnails"]');
    this.enableSliderLooping = false;
    this.pages = this.querySelector('.slider-counter')
    this.sliderViewport = this.querySelector('.slider__viewport')
    this.currentPageElement = this.querySelector('.slider-counter--current');
    this.pageTotalElement = this.querySelector('.slider-counter--total');
    this.prevButton = this.querySelectorAll('button[name="previous"]');
    this.nextButton = this.querySelectorAll('button[name="next"]');
    this.parentContainer = this.closest('section') || this
    this.posX1 
    this.posInit 
    this.posX2
    this.posY1
    this.posY2 
    this.posInitY
    this.widthItem
    this.gapValue
    this.fullWidthItem  
    this.isOnButtonClick = '0'
    this.disableSwipe = false
    this.linkElem

    if (!this.slider) return;
    
    if (this.closest('.product__media-wrapper') && this.slider.classList.contains('organize_images')) this.initProductGallery()
    document.addEventListener('updateVariantMedia', () => {
      this.initSlider()
      if (this.pages) this.update()
    } )
    this.sliderDataCount = this.slider.getAttribute('data-count')
    this.sliderMobileDataCount = this.slider.getAttribute('data-count-mobile')
    if (this.pages) {
      this.initPages();
      const resizeObserver = new ResizeObserver(entries => this.initPages());
      resizeObserver.observe(this.slider);
    }
    if (this.scrollbar) setTimeout(() => this.setScrollBar(), 1)
    // If slider made up of section blocks, make selected block active in theme editor
    if(this.closest('.scroll-to-block') && Shopify.designMode) {
      document.addEventListener('shopify:block:select', (event) => {
        let activeBlock = event.target
        if(!this.querySelector(`#${activeBlock.getAttribute('id')}`)) return
        let activeSlide = this.slider.querySelector('.is-active')
        if(!activeSlide) return
        activeSlide.classList.remove('is-active')
        activeBlock.classList.add('is-active')
        let activeSlideIndex = Array.from(this.sliderItems).indexOf(activeBlock) 
        this.disableButtons()
        this.update()
        if(this.sliderItems[activeSlideIndex]) this.slider.scrollLeft = this.sliderItems[activeSlideIndex].offsetLeft
      })
    }
    
    if (this.prevButton || this.nextButton) {
      this.prevButton.forEach(button => button.addEventListener('click', this.onButtonClick.bind(this, 'previous', false)));
      this.nextButton.forEach(button => button.addEventListener('click', this.onButtonClick.bind(this, 'next', false)));
      this.disableButtons()
    }  
    
    setTimeout(() => this.resizeImage(this.slider.querySelector('.is-active')), 1)

    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
    this.setActiveModel(activeSlideIndex)

    window.addEventListener('resize', () => {
      this.resizeImage(this.slider.querySelector('.is-active'))
      this.disableButtons()
    })
    document.addEventListener('shopify:section:load', () => {
      this.resizeImage(this.slider.querySelector('.is-active'))
      if (this.closest('.product__media-wrapper') && this.slider.classList.contains('organize_images')) this.initProductGallery()
    })

    if (this.slider.classList.contains('recently-viewed')) {
      this.sliderItems[0].classList.add('is-active')
      let lastChildIndex = this.sliderItems.length - 1
      let dataCount = +this.slider.dataset.count
      let sliderContainer = this.closest('.slider-container-js')
      if (lastChildIndex + 1 >= dataCount) this.sliderItems[lastChildIndex].classList.add('last-desktop')
      if (sliderContainer.offsetWidth < 769) {
        dataCount = +this.slider.dataset.countMobile
        if (lastChildIndex + 1 >= dataCount) this.sliderItems[lastChildIndex].classList.add('last-mobile')
      }
    }
    // Check if slider could be a grid
    if (!this.slider.classList.contains('grid') && this.closest('.slider-container-js').offsetWidth > 768 && this.sliderItems.length > 1 || this.closest('.slider-container-js').offsetWidth <= 768 && this.sliderItems.length > 1) {
      if (!this.slider.classList.contains('thumbnail-list')) {
        let scrollTimer; // For scrollEnd simulation
        this.activeSlide = this.slider.querySelector('.is-active')

        this.slider.addEventListener('scroll', () => {
          if (this.isOnButtonClick != 'onButtonClick') {
            if (this.slider.className.includes('disable-scroll')) return;

            if (this.slider.closest('.product-media-modal')) {
              clearTimeout(scrollTimer); // Reset the timer every time the user scrolls

              scrollTimer = setTimeout(() => {
                this.onAfterSlideChange(this.activeSlide)
              }, 0); 
            }

            this.slider.querySelectorAll('.snap-align').forEach(item => item.classList.remove('is-active'))
            if ((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below')) && !this.slider.closest('product-modal')) {
              this.galleryThumb = this.slider.closest('.slider-block').querySelector('[id^="GalleryThumbnails-"]')
              this.galleryThumb.querySelectorAll('.snap-align').forEach(item => item.classList.remove('is-active'))
            }

            if (this.slider.closest('.product-media-modal')) this.onBeforeSlideChange()

            this.changeActiveSlideOnScroll()
          }
        })
      }
      
      if (this.sliderItems.length > this.sliderDataCount && this.parentContainer.getBoundingClientRect().width > 768 || this.sliderItems.length > this.sliderMobileDataCount && this.parentContainer.getBoundingClientRect().width <= 768 || this.sliderItems.length >= this.sliderDataCount && this.sliderDataCount == 5 && this.parentContainer.getBoundingClientRect().width <= 1024 && this.parentContainer.getBoundingClientRect().width > 768) {
        this.slider.addEventListener('mousedown', this.swipeStart.bind(this));  
        this.slider.addEventListener('mousemove', this.swipeAction.bind(this));
        this.slider.addEventListener('mouseup', this.swipeEnd.bind(this));
      }
    }
    this.slider.addEventListener('keyup', (event) => {
      if (event.code.toUpperCase() === 'ARROWRIGHT' || event.code.toUpperCase() === 'ARROWLEFT') {
        let activElem = document.activeElement
        this.activeSlide = this.slider.querySelector('.is-active')
        if(!activElem.closest('[id^="Slide-"]').classList.contains('is-active')) {
          if(this.activeSlide) this.activeSlide.classList.remove('is-active')
          activElem.classList.add('is-active')
          this.update()
          // Check if product gallery has thumbnails
          if((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below')) && !this.slider.closest('product-modal')) {
            this.scrollThumbnail()
          } 
        }
      }
    })
    if(this.scrollbar) this.initEvents()
  }

  initSlider() {
    this.slider = this.querySelector('[id^="Slider-"]');
    if (this.slider && this.slider.classList.contains('variant-images') && this.slider.querySelectorAll('.product__media-item--variant-alt').length > 0) {
      this.sliderItems.forEach(item => item.classList.remove('is-active'))
      this.sliderItems = this.querySelectorAll('[id^="Slide-"].product__media-item--variant-alt')
      this.sliderItems[0].classList.add('is-active')
    }
  }

  initProductGallery() {
    this.slider.setAttribute('style', 'scroll-behavior: unset;')
    setTimeout(() => this.slider.scrollLeft = this.slider.querySelector('.is-active').offsetLeft, 10)
    setTimeout(() => this.slider.setAttribute('style', 'scroll-behavior: smooth;'), 100)
  }

  resizeImage(activeElem) {
    if(this.slider.classList.contains('slider-main--original')) {
      if(this.slider.classList.contains('grid--peek') && this.parentContainer.offsetWidth > 768) {
        this.sliderViewport.removeAttribute('style')
        return
      }
      let height = activeElem.offsetHeight
      if(this.parentContainer.offsetWidth < 769) {
        this.slider.closest('.product--side_thumbnails') && !this.slider.closest('product-modal') ? this.slider.closest('.slider-block').removeAttribute('style') : this.slider.removeAttribute('style')
        this.sliderViewport.style.height = height + 'px'
      } else {
        this.sliderViewport.removeAttribute('style')
        this.slider.closest('.product--side_thumbnails') && !this.slider.closest('product-modal') ? this.slider.closest('.slider-block').style.height = height + 'px' : this.slider.style.height = height + 'px'
      }
    }
    if(this.sliderItems.length > this.sliderDataCount && this.parentContainer.offsetWidth > 768 || this.sliderItems.length > this.sliderMobileDataCount && this.parentContainer.offsetWidth <= 768 || this.sliderItems.length >= this.sliderDataCount && this.sliderDataCount == 5 && this.parentContainer.offsetWidth <= 1024 && this.parentContainer.offsetWidth > 768) {
      this.disableSwipe = false
    } else {
      this.disableSwipe = true
    }
  }

  initPages() {
    this.sliderItemsToShow = Array.from(this.sliderItems).filter(element => element.clientWidth > 0);
    if (this.sliderItemsToShow.length < 2) return;
    this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
    this.slidesPerPage = Math.floor(this.slider.clientWidth / this.sliderItemOffset);
    this.totalPages = this.sliderItemsToShow.length
    this.update();
  }

  resetPages() {
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.initPages();
  }

  update() {
    if (!this.pages) return
    this.totalPages = Array.from(this.sliderItems).filter(element => element.clientWidth > 0).length 
    if (this.slider && this.slider.querySelectorAll('.product__media-item--variant-alt').length > 0) this.sliderItems = this.querySelectorAll('[id^="Slide-"].product__media-item--variant-alt')
    const previousPage = this.currentPage;
    this.activeSlide = this.slider.querySelector('.is-active')
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
    if (this.activeSlide) this.currentPage = Math.round(this.activeSlide.offsetLeft / this.sliderItemOffset) + 1
    if (this.currentPageElement && this.pageTotalElement) {
      this.currentPageElement.textContent = this.currentPage
      this.pageTotalElement.textContent = this.totalPages
    }
    this.totalPages == 1 ? this.pages.closest('.slider-buttons').classList.add('visually-hidden') : this.pages.closest('.slider-buttons').classList.remove('visually-hidden')
    if (this.currentPage != previousPage) {
      this.dispatchEvent(new CustomEvent('slideChanged', { detail: {
        currentPage: this.currentPage,
        currentElement: this.sliderItemsToShow[this.currentPage - 1]
      }}))
    }
    if (this.prevButton && this.nextButton) {
      activeSlideIndex == 0 ? this.prevButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.prevButton.forEach(button => button.removeAttribute('disabled'))
      activeSlideIndex == this.totalPages - 1 ? this.nextButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.nextButton.forEach(button => button.removeAttribute('disabled'))
    }
    if (this.scrollbar) setTimeout(() => this.setScrollBar(), 1)
  }

  disableButtons() {
    if (!this.prevButton || !this.nextButton) return
    this.activeSlide = this.slider.querySelector('.is-active')
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
    if(this.slider.closest('#cart-notification')) this.slider.setAttribute("data-count", "3")
    // dataCount - number of visible slides 
    let dataCount = +this.slider.dataset.count
    // If viewport width is lower than 1024px, five in a row slider becomes four in a row
    if (dataCount == 5 && this.closest('.slider-container-js').offsetWidth < 1025 ) dataCount = 4
    let sliderContainer
    !this.closest('.cart-drawer') && !this.closest('#cart-notification') ? sliderContainer = this.closest('.slider-container-js') : sliderContainer = document.querySelector('#body')
    // Change dataCount on mobile devices
    if (sliderContainer && sliderContainer.offsetWidth < 769) dataCount = +this.slider.dataset.countMobile
    let nextActiveSlide = dataCount
    if (this.classList.contains('slider--row-two') || this.classList.contains('slider--row-three')) nextActiveSlide = nextActiveSlide - 1
    activeSlideIndex > this.sliderItems.length - 1 - nextActiveSlide ? this.nextButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.nextButton.forEach(button => button.removeAttribute('disabled'))
    activeSlideIndex == 0 ? this.prevButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.prevButton.forEach(button => button.removeAttribute('disabled'))
  }

  setScrollBar() {
    const thumbWidth = (this.slider.clientWidth / this.slider.scrollWidth) * 100;
    this.scrollbarThumb.style.width = `${thumbWidth}%`;
    this.updateScrollbarPosition();
  }

  initEvents(e) {
    this.slider.addEventListener('scroll', () => this.updateScrollbarPosition());
    this.scrollbarTrack.addEventListener('click', (e) => this.scrollByClick(e));
    this.scrollbarThumb.addEventListener('mousedown', (e) => this.onDragStart(e));
    document.addEventListener('mouseup', () => this.onDragEnd());
    document.addEventListener('mousemove', (e) => this.onDragMove(e));
  }

  updateScrollbarPosition() {
    const scrollOffset = theme.config.rtl ? Math.abs(this.slider.scrollLeft) : this.slider.scrollLeft;
    const scrollRatio = scrollOffset / (this.slider.scrollWidth - this.slider.clientWidth);
    const maxLeft = this.scrollbarTrack.clientWidth - this.scrollbarThumb.clientWidth;
    const thumbPosition = maxLeft * scrollRatio;
    this.scrollbarThumb.style.left = theme.config.rtl ? `${maxLeft- thumbPosition}px` : `${thumbPosition}px`;
  }

  scrollByClick(event) {
    if (event.target === this.scrollbarThumb) return;
    const trackRect = this.scrollbarTrack.getBoundingClientRect();
    const clickPosition = event.clientX - trackRect.left;
    const thumbCenter = this.scrollbarThumb.clientWidth / 2;
    const newLeft = clickPosition - thumbCenter;
    const scrollRatio = newLeft / (trackRect.width - this.scrollbarThumb.clientWidth);
    this.slider.scrollLeft = scrollRatio * (this.slider.scrollWidth - this.slider.clientWidth);
  }

  onDragStart(event) {
    event.preventDefault();
    this.isDragging = true;
    this.startX = event.clientX;
    this.thumbStartLeft = this.scrollbarThumb.offsetLeft;
    this.scrollbarThumb.classList.add('dragging');
  }

  onDragMove(event) {
    if (!this.isDragging) return;
    event.preventDefault();
    const deltaX = event.clientX - this.startX;
    const newLeft = Math.max(0, Math.min(this.thumbStartLeft + deltaX, this.scrollbarTrack.clientWidth - this.scrollbarThumb.clientWidth));
    const scrollRatio = newLeft / (this.scrollbarTrack.clientWidth - this.scrollbarThumb.clientWidth);
    this.slider.scrollLeft = scrollRatio * (this.slider.scrollWidth - this.slider.clientWidth);
  }

  onDragEnd() {
    this.isDragging = false;
    this.scrollbarThumb.classList.remove('dragging');
  }

  scrollThumbnail() {
    this.activeSlide = this.slider.querySelector('.is-active')
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
    this.galleryThumb = this.slider.closest('.slider-block').querySelector('[id^="Slider-Thumbnails"]')
    this.galleryThumb.classList.contains('variant-thumbs') ? this.sliderThumbs = this.galleryThumb.querySelectorAll('[id^="Slide-Thumbnails"].product__media-item--variant-alt') : this.sliderThumbs = this.galleryThumb.querySelectorAll('[id^="Slide-Thumbnails"]')
    let activeThumb = this.sliderThumbs[activeSlideIndex]
    if(!activeThumb) return
    let prevActiveSlide = this.galleryThumb.querySelector('.is-active')
    if (prevActiveSlide) prevActiveSlide.classList.remove('is-active')  
    activeThumb.classList.add('is-active')
    // Check thumbnails gallery position   
    if (this.galleryThumb.classList.contains('thumbnail-list--column')) {
      this.galleryThumb.closest('.thumbnail-slider--column').scrollTo({
        top: activeThumb.offsetTop - activeThumb.offsetHeight - 8,
        behavior: 'smooth'
      })
    } else {
      this.galleryThumb.scrollTo({
        left: activeThumb.offsetLeft - activeThumb.offsetWidth - 8,
        behavior: 'smooth'
      })
    }
  }

  changeActiveSlideOnScroll() {
    if (this.dataset.enableAutoplay === 'false') {
      window.pauseAllMedia();
    }

    let sliderLeft = Math.round(this.sliderViewport.getBoundingClientRect().left)
    let sliderItemLeft 
    this.sliderItems.forEach((item) => {
      sliderItemLeft = Math.round(item.getBoundingClientRect().left)
      if (Math.abs(sliderLeft - sliderItemLeft) < 7) {
        item.classList.add('is-active')
        this.resizeImage(item)
      } else {
        if(this.closest('.advantages')) this.querySelectorAll('[id^="Slide-"]')[this.sliderItems.length - 2].classList.add('is-active')
      }
    })
    // Make the gallery flexible if media ratio is original
    if(this.slider.classList.contains('slider-main--original') && this.slider.querySelector('.is-active')) {
      if(this.slider.classList.contains('grid--peek') && this.parentContainer.offsetWidth > 768) {
        this.sliderViewport.removeAttribute('style')
        return
      }
      setTimeout(() => {
        let height = this.slider.querySelector('.is-active').offsetHeight
        if(this.parentContainer.offsetWidth < 769) {
          this.slider.closest('.product--side_thumbnails') && !this.slider.closest('product-modal') ? this.slider.closest('.slider-block').removeAttribute('style') : this.slider.removeAttribute('style')

          this.sliderViewport.style.height = height + 'px'
        } else {
          this.sliderViewport.removeAttribute('style')
          this.slider.closest('.product--side_thumbnails') && !this.slider.closest('product-modal') ? this.slider.closest('.slider-block').style.height = height + 'px' : this.slider.style.height = height + 'px'
        }
      }, 100)
    }
    if((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below')) && !this.slider.closest('product-modal')) {
      this.scrollThumbnail()
    } 
    this.disableButtons()
    this.update() 
    this.activeSlide = this.slider.querySelector('.is-active')
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
    this.setActiveModel(activeSlideIndex)
  }

  setActiveModel(activeSlideIndex) {
    if (!this.classList.contains('slider-mobile-gutter')) return;

    let activeMediaId;
    if (this.sliderItems[activeSlideIndex]) {
      activeMediaId = this.sliderItems[activeSlideIndex].dataset.mediaId;
    }

    if (activeMediaId) {
      this.toggleXrButton(activeMediaId);
    }
  }

  toggleXrButton(activeMediaId) {
    const xrButtons = document.querySelectorAll('slider-component ~ .product__xr-button');
    
    if (xrButtons.length == 0) return;

    xrButtons.forEach(button => {
      button.classList.add('product__xr-button--hidden');
    });

    const activeXrButton = document.querySelector(`slider-component ~ .product__xr-button[data-media-id="${activeMediaId}"]`);
    if (activeXrButton) {
      activeXrButton.classList.remove('product__xr-button--hidden');
    }
  }

  onBeforeSlideChange() {
    clearTimeout(this.adaptSlideHeightTimeout); // In case of a recurring click on the button

    const modalContent = this.closest('.product-media-modal__content');
    modalContent.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  onAfterSlideChange(activeSlide) {
    const slideTransitionSpeed = 750; // Approximate value of scroll-behavior: smooth in browsers

    if (typeof activeSlide === 'number') {
      activeSlide = this.sliderItems[activeSlide]
    } 

    this.adaptSlideHeightTimeout = setTimeout(() => {
      this.querySelector('.slider__grid').style.setProperty('height', activeSlide.offsetHeight + 'px');
    }, slideTransitionSpeed)
  }

  onButtonClick(direction, nextActiveSlideSwipe) {
    window.pauseAllMedia()

      const isRTL = document.documentElement.dir === 'rtl'

    if (this.slider.closest('.product-media-modal')) this.onBeforeSlideChange()

      if (this.slider.classList.contains('thumbnail-list')) return
      this.activeSlide = this.slider.querySelector('.is-active')
      let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
      if ((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below')) && !this.slider.closest('product-modal')) {
        this.galleryThumb = this.slider.closest('.slider-block').querySelector('[id^="GalleryThumbnails-"]')
        let activeThumb = this.galleryThumb.querySelectorAll('[id^="Slide-"]')[activeSlideIndex]
        activeThumb.classList.remove('is-active')
      }
      if(this.slider.closest('#cart-notification')) this.slider.setAttribute("data-count", "3")
      let dataCount = +this.slider.dataset.count
      if (dataCount == 5 && this.closest('.slider-container-js').offsetWidth < 1025 ) dataCount = 4
      let sliderContainer
      !this.closest('.cart-drawer') && !this.closest('#cart-notification') ? sliderContainer = this.closest('.slider-container-js') : sliderContainer = document.querySelector('#body')
      if (sliderContainer.offsetWidth < 769) dataCount = +this.slider.dataset.countMobile
      let nextActiveSlide
      // Determine the step for changing the active slide
      nextActiveSlideSwipe ? nextActiveSlide = nextActiveSlideSwipe : nextActiveSlide = dataCount
      if (direction == 'next') {
        let sliderItemsLength = this.sliderItems.length - 1
        if (this.closest('.advantages') && window.innerWidth < 768 || this.closest('.testimonials')) sliderItemsLength = this.sliderItems.length
        // Restrict gallery scrolling at the end
        activeSlideIndex = Math.min(sliderItemsLength, activeSlideIndex + nextActiveSlide);
        this.activeSlide.classList.remove('is-active')
        if (this.sliderItems[activeSlideIndex]) this.sliderItems[activeSlideIndex].classList.add('is-active')
        this.resizeImage(this.sliderItems[activeSlideIndex])
        if (this.slider.closest('.product-media-modal')) this.slider.style.scrollBehavior = 'smooth'
        if (this.classList.contains('slider--row') && this.parentElement.offsetWidth > 768) {
          const activeSlide = this.sliderItems[activeSlideIndex]
          const scrollPosition  = isRTL 
            ? (this.getBoundingClientRect().width - activeSlide.offsetLeft - activeSlide.offsetWidth) * -1 + activeSlide.offsetWidth
            : activeSlide.offsetLeft - activeSlide.offsetWidth

          setTimeout(() => {
            this.slider.scrollLeft = scrollPosition
          }, 1)
        } else {
          const activeSlide = this.sliderItems[activeSlideIndex]
          const scrollPosition  = isRTL 
            ? (this.getBoundingClientRect().width - activeSlide.offsetLeft - activeSlide.offsetWidth) * -1 
            : activeSlide.offsetLeft

          setTimeout(() => {
            this.slider.scrollLeft = scrollPosition
          }, 1)
        }
      }
      if (direction == 'previous') {  
        activeSlideIndex - nextActiveSlide < 0 ? activeSlideIndex = 0 : activeSlideIndex = activeSlideIndex - nextActiveSlide
        if (this.activeSlide) this.activeSlide.classList.remove('is-active')  
        this.sliderItems[activeSlideIndex].classList.add('is-active')
        this.resizeImage(this.sliderItems[activeSlideIndex])
        if (this.slider.closest('.product-media-modal')) this.slider.style.scrollBehavior = 'smooth'
        // Restrict gallery scrolling at the beginnig
        if (this.classList.contains('slider--row') && this.offsetWidth > 768) {
          const activeSlide = this.sliderItems[activeSlideIndex]
          const scrollPosition  = isRTL 
            ? (this.getBoundingClientRect().width - activeSlide.offsetLeft - activeSlide.offsetWidth) * -1 + activeSlide.offsetWidth
            : activeSlide.offsetLeft - activeSlide.offsetWidth

          this.slider.scrollLeft = scrollPosition 
        } else {
          const activeSlide = this.sliderItems[activeSlideIndex]
          const scrollPosition  = isRTL 
            ? (this.getBoundingClientRect().width - activeSlide.offsetLeft - activeSlide.offsetWidth) * -1 
            : activeSlide.offsetLeft
            
          this.slider.scrollLeft = scrollPosition
        }       
      }
      if((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below')) && !this.slider.closest('product-modal')) {
        this.scrollThumbnail()
      } 
      this.update()
      this.disableButtons()
      this.isOnButtonClick = 'onButtonClick'
      this.setActiveModel(activeSlideIndex)
      this.slider.addEventListener('wheel', () => this.isOnButtonClick = 0)
      this.slider.addEventListener('touchstart', () => this.isOnButtonClick = 0)
      this.slider.addEventListener('touchmove', () => this.isOnButtonClick = 0)
      this.slider.addEventListener('touchend', () => this.isOnButtonClick = 0)

      if (this.slider.closest('.product-media-modal')) this.onAfterSlideChange(activeSlideIndex)
  }

  getEvent (event) {
    return event.type.search('touch') !== -1 ? event.touches[0] : event;
  }

  swipeStart(event) {
    if (event.target.closest('.swiper-button')) return;

    if (event.target.closest('.slider__grid').getAttribute('id') != this.slider.getAttribute('id')) return
    if(this.disableSwipe) return
    if (event.target.closest('.card__extras') || event.target.closest('.quick-view') || event.target.closest('.swatches_container') || event.target.closest('.only-mobile-slider') && this.closest('section').offsetWidth > 768) return
    if(event.button == 2) return
    event.preventDefault()
    if(event.target.closest('.thumbnail-slider') || event.target.classList.contains('3d-model')) return
    this.slider.style.userSelect = 'none'
    this.slider.style.cursor = 'grab'
   
    setTimeout(() => {
      this.sliderItems.forEach(item => {
        if (item.querySelector('a.card-js')) item.querySelector('a.card-js').style.pointerEvents = 'none'
      }, 20)
    })
    this.sliderItems.forEach(item => {
      item.querySelector('.card-js') ? item.querySelector('.card-js').style.cursor = 'grab' : item.closest('.card-js').style.cursor = 'grab'
    })
    let evt = this.getEvent(event);
    this.posInit = this.posX1 = evt.clientX;
    this.posInitY = this.posY1 = evt.clientY
    this.widthItem = +this.sliderItems[0].offsetWidth
    this.gapValue = +window.getComputedStyle(this.slider).getPropertyValue("gap").slice(0, -2)
    this.fullWidthItem = this.widthItem + this.gapValue
  }

  swipeAction(event) {
    if (event.target.closest('.swiper-button')) return;

    if (event.target.closest('.slider__grid').getAttribute('id') != this.slider.getAttribute('id')) return
    if(this.slider.classList.contains('disable-scroll')) this.slider.classList.remove('disable-scroll')
    if(event.target.closest('.thumbnail-slider')) return
    let evt = this.getEvent(event)
    this.posX2 = this.posX1 - evt.clientX;
    this.posX1 = evt.clientX;
    this.posY2 = this.posY1 - evt.clientY;
    this.posY1 = evt.clientY;
  }

  swipeEnd(event) {
    if (event.target.closest('.swiper-button')) return;

    if (event.target.closest('.slider__grid').getAttribute('id') != this.slider.getAttribute('id')) return
    if(this.disableSwipe) return
    if(event.target.closest('.thumbnail-slider') || event.target.classList.contains('3d-model')) return
    if (event.target.closest('.color-swatch')) return
    // Return default cursor value
    this.slider.style.userSelect = 'auto'
    this.slider.style.cursor = 'default'
    let parentOrChild
    this.sliderItems.forEach(item => {
      item.querySelector('.card-js') ? parentOrChild = item.querySelector('.card-js') : parentOrChild = item.closest('.card-js')
      parentOrChild.style.cursor = 'pointer'
      if (item.querySelector('.product-labels__item')) item.querySelector('.product-labels__item').style.cursor = 'auto'
      parentOrChild.style.pointerEvents = 'auto'
      if (item.querySelector('.testimonials_card')) item.querySelector('.testimonials_card').style.cursor = 'auto'
      if(item.closest('.logo-slider') || item.closest('.banner-gallery')) {
        parentOrChild.style.cursor = 'default'
        if(item.querySelector('a.card-js')) item.querySelector('a.card-js').style.cursor = 'pointer'
      }
    })
    // Check right click
    if(event.button == 2) return
    if (event.target.closest('.card__extras') || event.target.closest('.only-mobile-slider') && this.closest('section').offsetWidth > 768) return
    // Check if swipe was horizontal or vertical
    let isHorizontalSwipe = Math.abs(this.posInit - this.posX1) > Math.abs(this.posInitY - this.posY1)
    let horizontalSwipeIsOk = Math.abs(this.posInit - this.posX1) > 50
    let swipeVertical = Math.abs(this.posInitY - this.posY1) > 20
    let swipeHorizontal = Math.abs(this.posInit - this.posX1) > 20
    if(!swipeHorizontal && !swipeVertical) {
      if(event.target.closest('a')) {
        this.linkElem = event.target.closest('a')
      } 
      else {
        if(event.target == this.slider || event.target == this.sliderViewport || event.target == this) return;
        if(event.target.querySelector('a') && !event.target.querySelector('a').closest('.richtext')) this.linkElem = event.target.querySelector('a')
      }
      if(this.linkElem) this.linkElem.hasAttribute('target') && !Shopify.designMode ? window.open(this.linkElem.href, '_blank') : location.href = this.linkElem.href
    }
    this.slider.removeEventListener('mousemove', this.swipeAction.bind(this));
    this.slider.removeEventListener('mouseup', this.swipeEnd.bind(this));
    if (!isHorizontalSwipe || !horizontalSwipeIsOk) return
    if (this.slider.closest('.product-media-modal')) this.slider.style.scrollBehavior = 'smooth'
    // Check slider direction
    let posFinal = this.posInit - this.posX1;
    let direction;
    const isRTL = document.documentElement.dir === 'rtl'
    if (isRTL) {
      posFinal > 0 ? direction = 'previous' : direction = 'next'
    } else {
      posFinal > 0 ? direction = 'next' : direction = 'previous'
    }
    // nextActiveSlideSwipe variable determines how many slides the galery will scroll through
    let nextActiveSlideSwipe = 0 // The step between active slide could be equal to the number of slides in visible area, so the variable = 0
    if(!this.slider.closest('.slider-block')) if(Math.abs(posFinal) < this.fullWidthItem) nextActiveSlideSwipe = 1
    this.onButtonClick(direction, nextActiveSlideSwipe)
  }
}
customElements.define('slider-component', SliderComponent);

class BaseProductCardSlider {
  constructor(sliderEl) {
    this.sliderEl = sliderEl;
    this.isRTL = this.sliderEl.getAttribute('dir') === 'rtl';
    this.speed = parseInt(sliderEl.dataset.transitionDuration, 10) || 300;
    this.autoplaySpeed = parseInt(sliderEl.dataset.autoplaySpeed, 10) || 5000;
    this.autoplay = sliderEl.dataset.autoplay === "true";
    this.loop = sliderEl.dataset.loop === "true";
    this.showOnlyVariantsMedia = sliderEl.dataset.showOnlyVariantsMedia === "true";
    this.slidesLoaded = false;
    this.allSlides = null;
    this.isDragging = false;
    this.swiperInstance = null;
    this.firstSlideIndex = 0;

    this.swiperBaseConfiguration = {
      a11y: {
        slideRole: 'listitem'
      },
      slidesPerView: 'auto',
      loop: this.loop,
      pagination: {
        el: this.sliderEl.querySelector('.swiper-pagination'),
        type: 'bullets'
      },
      navigation: {
        nextEl: this.sliderEl.querySelector('.swiper-button-next'),
        prevEl: this.sliderEl.querySelector('.swiper-button-prev'),
      },
      speed: this.speed,
      lazy: {
        loadPrevNext: true,
      },
      roundLengths: false,
    };

    this.initializeSwiperInstance();
    this.configureListeners();
  }

  playVideoOnActiveSlide(sourceTag = '') {
    const activeSlide = this.sliderEl.querySelector('.swiper-slide-active');
    if (!activeSlide) return;

    let video = activeSlide.querySelector('video.card__image--video');

    if (!video) {
      video = this.sliderEl.querySelector('video.card__image--video');
    }
    if (!video) return;

    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const playPromise = video.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(err => {
        console.log('[playVideoOnActiveSlide] play() rejected:', err);
      });
    }
  }
  pauseVideoOnSlide(slide) {
    if (!slide) return;
    const video = slide.querySelector('video.card__image--video');
    if (video && !video.paused) {
      video.pause();
    }
  }

  updateSwiper() {
    if (this.swiperInstance) {
      this.swiperInstance.destroy(false, true);
      this.initializeSwiperInstance?.();
    }
  }

  getAllSlides() {
    const template = this.sliderEl.querySelector('.all-product-card-images-template');
    const allSlidesTemplate = template.content.cloneNode(true);
    return [...allSlidesTemplate.querySelectorAll('.swiper-slide')];
  }

  loadSlides() {
    const activeSwatch = this.sliderEl.closest('.card').querySelector('.active-swatch');

    if (this.showOnlyVariantsMedia && activeSwatch) {
      const activeSwatchColor = activeSwatch.dataset.colorName;
      const activeSwatchFirstMedia = parseNode(activeSwatch.dataset.firstMediaNode).dataset.id;
      this.showSlidesByVariant(activeSwatchColor, activeSwatchFirstMedia);
    } else {
      this.showAllSlides();
    }

    this.slidesLoaded = true;
  }

  adaptModelViewersSize() {
    this.sliderEl.querySelectorAll('model-viewer').forEach(model => {
      const parentSlide = model.closest('.swiper-slide');
      if (!parentSlide) return;

      const parentHeight = parentSlide.offsetHeight;
      const parentWidth = parentSlide.offsetWidth;

      model.style.height = `${parentHeight}px`;
      model.style.width = `${parentWidth}px`;
    });
  }

  showAllSlides() {
    if (!this.allSlides) {
      this.allSlides = this.getAllSlides();
    }

    const sliderWrapper = this.sliderEl.querySelector('.swiper-wrapper');
    const firstPreloadedSlide = this.sliderEl.querySelector('#card__product-image--1');

    if (firstPreloadedSlide) {
      const allSlidesWithoutFirst = this.allSlides.filter(
        slide => slide.dataset.id !== firstPreloadedSlide.dataset.id
      );

      sliderWrapper.append(...allSlidesWithoutFirst);
      this.adaptModelViewersSize();
      this.updateSwiper();
    } else {
      this.replaceSlides(sliderWrapper, this.allSlides);
    }

    this.sliderEl.setAttribute('style', `--total-slides: ${this.allSlides.length};`);
    this.slidesLoaded = true;
    this.firstSlideIndex = 0;
  }

  showSlidesByVariant(colorName, firstMediaId) {
    if (!this.allSlides) {
      this.allSlides = this.getAllSlides();
    }

    const sliderWrapper = this.sliderEl.querySelector('.swiper-wrapper');

    let variantSlides = this.allSlides.filter(slide =>
      slide.dataset.swiperSlideAlt.includes(`(${colorName})`) ||
      slide.dataset.swiperSlideAlt.includes(`(${capitalizeFirstLetter(colorName)})`) ||
      slide.dataset.showSlide == 'true'
    );

    let firstSlideIndex = 0;

    if (!variantSlides.length) {
      const colorSwatchMedia = this.allSlides.find(slide => slide.dataset.id == firstMediaId);

      if (!colorSwatchMedia) {
        this.showAllSlides();
        return;
      }

      variantSlides = [colorSwatchMedia];
    }

    if (firstMediaId && variantSlides.length > 1) {
      const firstSlide = variantSlides.find(slide => slide.dataset.id == firstMediaId);
      if (firstSlide) {
        firstSlideIndex = variantSlides.indexOf(firstSlide);
      }
    }

    const freshSlides = variantSlides.map(s => s.cloneNode(true));
    this.replaceSlides(sliderWrapper, freshSlides);

    if (this.loop) {
      this.swiperInstance.slideToLoop(firstSlideIndex, 0);
    } else {
      this.swiperInstance.slideTo(firstSlideIndex, 0);
    }

    this.sliderEl.setAttribute('style', `--total-slides: ${variantSlides.length};`);

    this.slidesLoaded = false;
    this.firstSlideIndex = firstSlideIndex;
  }

  replaceSlides(sliderWrapper, slides) {
    const { pagination, navigation } = this.swiperInstance;

    sliderWrapper.replaceChildren(...slides);
    this.updateSwiper();

    if (slides.length === 1) {
      pagination.el?.classList.add('swiper-pagination-hidden');
      navigation.prevEl?.classList.add('swiper-button-hidden');
      navigation.nextEl?.classList.add('swiper-button-hidden');
    } else {
      pagination.el?.classList.remove('swiper-pagination-hidden');
      navigation.prevEl?.classList.remove('swiper-button-hidden');
      navigation.nextEl?.classList.remove('swiper-button-hidden');
    }
  }

  configureListeners() {
    this.isSliding = false;
    if (window.innerWidth > 768 && this.autoplay) {
      this.sliderEl.addEventListener('mouseenter', () => {
        this.swiperInstance.params.autoplay = {
          delay: this.autoplaySpeed,
          disableOnInteraction: false
        };
        this.swiperInstance.autoplay.start();
      });

      this.sliderEl.addEventListener('mouseleave', () => {
        if (this.swiperInstance.autoplay.running) {
          this.swiperInstance.autoplay.stop();
        }
      });
    }

    const swiperNextButtonElement = this.sliderEl.querySelector('.swiper-button-next');
    if (swiperNextButtonElement) {
      swiperNextButtonElement.addEventListener('click', () => {
        if (!this.slidesLoaded) {
          this.loadSlides();
        }

        setTimeout(() => {
          this.swiperInstance.slideNext();
        }, 50);
      });
    }

    const swiperPrevButtonElement = this.sliderEl.querySelector('.swiper-button-prev');
    if (swiperPrevButtonElement) {
      swiperPrevButtonElement.addEventListener('click', () => {
        if (!this.slidesLoaded) {
          this.loadSlides();
        }

        setTimeout(() => {
          this.swiperInstance.slidePrev();
        }, 50);
      });
    }

    this.swiperInstance.on('sliderFirstMove', () => {
      const diffX = this.swiperInstance.touches.currentX - this.swiperInstance.touches.startX;
      const diffY = this.swiperInstance.touches.currentY - this.swiperInstance.touches.startY;

      if (!this.slidesLoaded) {
        this.loadSlides();

        let direction;
        if (Math.abs(diffX) > Math.abs(diffY)) {
          direction = diffX > 0 ? 'right' : 'left';
        }

        setTimeout(() => {
          if (direction === 'left') {
            this.swiperInstance.slideNext(300);
          } else {
            this.swiperInstance.slidePrev(300);
          }
        }, 50);
      }
    });

    this.swiperInstance.on('slideChange', (e) => {
      const previousSlide = e.slides[e.previousIndex];
      const currentSlide = e.slides[e.activeIndex];

      this.isSliding = true;
      setTimeout(() => {
        this.isSliding = false;
      }, 100);
      this.pauseVideoOnSlide(previousSlide);
      this.playVideoOnActiveSlide('[slideChange]');
    });

    if (this.autoplay) {
      this.sliderEl.addEventListener('mouseenter', () => {
        if (!this.slidesLoaded) {
          this.loadSlides();
        }
      });
    }

    this.sliderEl.closest('.card').addEventListener('click', (e) => {
      if (this.isSliding) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    });

    this.sliderEl.addEventListener('color-swatch:change', (event) => {
      if (event.detail.colorName === 'all') {
        this.showAllSlides();
      } else {
        this.showSlidesByVariant(event.detail.colorName, event.detail.firstMediaId);
      }

      this.slidesLoaded = true;
    });
    setTimeout(() => {
      this.playVideoOnActiveSlide('[init timeout]');
    }, 50);

    let firstInteractionDone = false;

    const onFirstInteraction = () => {
      if (firstInteractionDone) return;
      firstInteractionDone = true;

      this.playVideoOnActiveSlide('[firstInteraction]');

      this.sliderEl.removeEventListener('touchstart', onFirstInteraction);
      this.sliderEl.removeEventListener('mousedown', onFirstInteraction);
      this.sliderEl.removeEventListener('pointerdown', onFirstInteraction);
    };

    this.sliderEl.addEventListener('touchstart', onFirstInteraction, { once: true });
    this.sliderEl.addEventListener('mousedown', onFirstInteraction, { once: true });
    this.sliderEl.addEventListener('pointerdown', onFirstInteraction, { once: true });
  }
}

class ProductCardSlider extends BaseProductCardSlider {
  constructor(sliderEl) {
    super(sliderEl);
  }

  initializeSwiperInstance() {
    this.swiperInstance = new Swiper(this.sliderEl, {
      ...this.swiperBaseConfiguration,
    });
  }
}

class ProductCardHoverGallery extends BaseProductCardSlider {
  constructor(sliderEl) {
    super(sliderEl);
    this.configureHoverListeners();
  }
  
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  initializeSwiperInstance() {
    this.swiperInstance = new Swiper(this.sliderEl, {
      ...this.swiperBaseConfiguration,
      loop: false,
      allowTouchMove: this.isTouchDevice(),
      simulateTouch: this.isTouchDevice(),
    });
  }

  configureHoverListeners() {
    this.sliderEl.addEventListener('mouseenter', () => {
      if (!this.slidesLoaded) {
        this.loadSlides();
      }
      this.playVideoOnActiveSlide('[hover-enter]');
    });

    this.sliderEl.addEventListener('mousemove', (e) => {
      const totalSlidesCount = this.sliderEl.querySelectorAll('.swiper-slide').length;
      const sliderViewportWidth = this.sliderEl.offsetWidth;
      const rect = this.sliderEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const percentage = mouseX / sliderViewportWidth;

      let targetIndex;

      if (this.isRTL) {
        targetIndex = Math.floor((1 - percentage) * totalSlidesCount);
      } else {
        targetIndex = Math.floor(percentage * totalSlidesCount);
      }
      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex > totalSlidesCount - 1) targetIndex = totalSlidesCount - 1;

      this.swiperInstance.slideTo(targetIndex, 0);

      this.playVideoOnActiveSlide('[hover-move]');
    });

    this.sliderEl.addEventListener("mouseleave", () => {
      this.swiperInstance.slideTo(this.firstSlideIndex || 0, 0);

      const activeSlide = this.sliderEl.querySelector('.swiper-slide-active');
      this.pauseVideoOnSlide(activeSlide);
    });

    window.addEventListener("resize", () => {
      this.swiperInstance.allowTouchMove = this.isTouchDevice();
      this.swiperInstance.simulateTouch = this.isTouchDevice();
    });
  }
}


class SwiperGallery extends HTMLElement {
  constructor() {
    super();

    if (this.classList.contains('swiper-product-card--slider')) {
      new ProductCardSlider(this);
    }

    if (this.classList.contains('swiper-product-card--hover-gallery')) {
      new ProductCardHoverGallery(this);
    }
  }
}

customElements.define('swiper-gallery', SwiperGallery);



function initStoriesSlideshow() {
  function playProductCardsMedia(container) {
    container.querySelectorAll('product-card-image .card__image').forEach(media => {
      playMedia(media);
    });
  }

  function pauseProductCardsMedia(container) {
    container.querySelectorAll('product-card-image .card__image').forEach(media => {
      pauseMedia(media);
    });
  }

  document.querySelectorAll(".stories-slideshow").forEach((storiesSlideshow) => {
    const autoplaySpeed = storiesSlideshow.dataset.autoplaySpeed || 8000;
    const mainSliderEl = storiesSlideshow.querySelector(".swiper-stories");
    const thumbnails = storiesSlideshow.querySelectorAll(".stories-slideshow__thumbnail");
    const slides = storiesSlideshow.querySelectorAll(".stories-slides");
    const storiesSlider = storiesSlideshow.querySelector(".stories-slider");
    const thumbnailsWrapper = storiesSlideshow.querySelector(".stories-slideshow__thumbnails");

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
          const thumbnails = entry.target.querySelectorAll(".stories-slideshow__thumbnail");
          
          if (entry.isIntersecting) {
              thumbnails.forEach((thumbnail, index) => {
                  setTimeout(() => {
                      thumbnail.classList.add("visible");
                  }, index * 2000);
              });
          } else {
              thumbnails.forEach((thumbnail) => thumbnail.classList.remove("visible"));
          }
      });
    }, { threshold: 0.9 });
    observer.observe(thumbnailsWrapper)

    let innerSwipers = [];
    let autoplayTimeout = null;
    let autoplayRemainingTime = 0;
    let autoplayStartTime = 0;
    let holdTimeout = null;
    let isHolding = false;
    let wasHolding = false;
    let holdStartTime = 0; 
    let mainSwiper = null;
    let swipe = false

    if (mainSliderEl) {
      initMainSlider()
      
      function initMainSlider() {
          mainSwiper = new Swiper(mainSliderEl, {
          slidesPerView: "auto",
          centeredSlides: true,
          modules: [EffectCarousel],
          loop: false,
          effect: 'carousel',
          carouselEffect: {
            opacityStep: 0.33,
            scaleStep: 0.09,
            sideSlides: 8,
          },
          on: {
            slideChange: function () {
              const oldIndex = mainSwiper.previousIndex;
              const newIndex = mainSwiper.realIndex;
          
              const oldInnerSwiper = innerSwipers[oldIndex];
              const newInnerSwiper = innerSwipers[newIndex];
              const oldSlide = slides[oldIndex];
          
              if (oldInnerSwiper) {
                oldInnerSwiper.autoplay.stop();
                oldInnerSwiper.slideTo(0, 0);
              }
          
              if (newInnerSwiper) {
                newInnerSwiper.slideTo(0, 0);
                resetBulletProgress(newInnerSwiper);

                const activeInnerSlide = newInnerSwiper.slides[newInnerSwiper.activeIndex];
                if (!activeInnerSlide) return;
          
                innerSwipers[newIndex].params.autoplay.delay = autoplaySpeed;
                autoplayRemainingTime = autoplaySpeed;
                mainSliderEl.style.setProperty('--active-slide-duration', `${(autoplaySpeed / 1000)}s`);

                const bulletActive = innerSwipers[newIndex].el.querySelector('.swiper-pagination-bullet-active');
                if (bulletActive) {
                  bulletActive.classList.remove('swiper-pagination-bullet-active');
                  void bulletActive.offsetWidth;
                  bulletActive.classList.add('swiper-pagination-bullet-active');
                }
                newInnerSwiper.autoplay.start();
                autoplayStartTime = Date.now();
                clearTimeout(autoplayTimeout);
                autoplayTimeout = setTimeout(() => {
                  const activeOuterSlide = mainSwiper.slides[mainSwiper.activeIndex];
                  const activeInnerSwiperEl = activeOuterSlide.querySelector('.swiper-story-inner');
                  const productsOpen = activeInnerSwiperEl?.querySelector('.stories__products.open');
        
                  if (!productsOpen && newInnerSwiper.isEnd && mainSwiper.realIndex === newIndex) {
                    handleNextSlide(mainSwiper, newIndex);
                  }
                }, autoplayRemainingTime);
              }
            }
          }
        });
      }

      function delayedHandleNextSlide(innerSwiper, mainSwiper, index) {
        if (innerSwiper._endTimeout) {
          return;
        }
        innerSwiper._endTimeout = true;
        clearTimeout(autoplayTimeout);
        autoplayRemainingTime = innerSwiper.params.autoplay.delay;
        autoplayStartTime = Date.now();

        autoplayTimeout = setTimeout(() => {
          const activeOuterSlide = mainSwiper.slides[mainSwiper.activeIndex];
          const activeInnerSwiperEl = activeOuterSlide.querySelector('.swiper-story-inner');
          const productsOpen = activeInnerSwiperEl.querySelector('.stories__products.open');

          if (!productsOpen && innerSwiper.isEnd) {
            handleNextSlide(mainSwiper, index);
            innerSwiper.autoplay.stop();
          }

          innerSwiper._endTimeout = false;
        }, autoplayRemainingTime);
      }

      slides.forEach((slide, index) => {
        const innerSliderEl = slide.querySelector(".swiper-story-inner");
        if(!innerSliderEl) return
        const innerSwiper = new Swiper(innerSliderEl, {
          slidesPerView: 1,
          spaceBetween: 0,
          loop: false,
          pagination: {
            el: innerSliderEl.querySelector(".stories-slider-pagination"),
            type: "bullets",
            clickable: true,
          },
          autoplay: {
            delay: autoplaySpeed,
            disableOnInteraction: false,
          },
          observer: true,
          observeParents: true,
          observeSlideChildren: true
        });

        innerSwipers.push(innerSwiper);
        innerSwiper.autoplay.stop();
        innerSwiper.allowTouchMove = false;

        innerSwiper.on("slideChange", function () {
          const isActiveExternalSlide = (mainSwiper.realIndex === index);
          if (!isActiveExternalSlide) {
            innerSwiper.autoplay.stop();
            return;
          }
                  
          const activeSlide = innerSwiper.slides[innerSwiper.activeIndex];
          const bulletActive = slide.querySelector('.swiper-pagination-bullet-active');
            mainSliderEl.style.setProperty('--active-slide-duration', `${(autoplaySpeed / 1000)}s`);
            innerSwiper.params.autoplay.delay = autoplaySpeed;
            bulletActive.classList.remove('swiper-pagination-bullet-active');
            void bulletActive.offsetWidth;
            bulletActive.classList.add('swiper-pagination-bullet-active');
            innerSwiper.autoplay.start();

          if (innerSwiper.slides.length === 1) {
            clearTimeout(autoplayTimeout);
            autoplayRemainingTime = innerSwiper.params.autoplay.delay;
            autoplayStartTime = Date.now();

            autoplayTimeout = setTimeout(() => {
              const productsOpen = slide.querySelector('.stories__products.open');
              if (!productsOpen) {
                handleNextSlide(mainSwiper, index);
              }
            }, autoplayRemainingTime);
          } else if (innerSwiper.isEnd) {
            delayedHandleNextSlide(innerSwiper, mainSwiper, index);
          }
        });

        slide.querySelectorAll('.swiper-slide').forEach((swSlide => {
          swSlide.querySelector(".stories-slider-button-next")?.addEventListener("click", function (e) {
            if (wasHolding || swipe) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            !innerSwiper.isEnd ? innerSwiper.slideNext() : handleNextSlide(mainSwiper, index);
          });

          swSlide.querySelector(".stories-slider-button-prev")?.addEventListener("click", function (e) {
            if (wasHolding) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if(!innerSwiper.isBeginning) {
              innerSwiper.slidePrev()
            } else {
              mainSwiper.slidePrev();
              const prevInnerSwiper = innerSwipers[mainSwiper.realIndex];
              if (prevInnerSwiper) {
                resetBulletProgress(prevInnerSwiper);
              }
            }
          });

          swSlide.querySelectorAll('.stories-slider-button').forEach(button => {
            button.addEventListener('pointerdown', (e) => handleHoldStart(e, innerSwiper, mainSwiper, index, swSlide));
            button.addEventListener('pointerup', (e) => handleHoldEnd(e, innerSwiper, mainSwiper, index, swSlide));
          });


          let autoplayStartTime = null;
          let autoplayOriginalDelay = autoplaySpeed;

          innerSwiper.on('autoplayStart', () => {
            autoplayStartTime = Date.now();
          });

          innerSwiper.on('autoplayStop', () => {
            const activeSlide = innerSwiper.slides[innerSwiper.activeIndex];
              const elapsed = Date.now() - autoplayStartTime;
              autoplayRemainingTime = innerSwiper.params.autoplay.delay - elapsed;
              if (autoplayRemainingTime < 0) autoplayRemainingTime = 0;
          });

          function customAutoplayResume() {
            const activeOuterSlide = mainSwiper.slides[mainSwiper.activeIndex];
            const activeInnerSwiperEl = activeOuterSlide.querySelector('.swiper-story-inner');
            const activeInnerSwiper = activeInnerSwiperEl?.swiper;
            const activeInnerSlide = activeInnerSwiper.slides[activeInnerSwiper.activeIndex];
              activeInnerSwiper.params.autoplay.delay = autoplayRemainingTime;
              activeInnerSwiper.autoplay.start();
              if (activeInnerSwiper.slides.length === 1) {
                clearTimeout(autoplayTimeout);
                autoplayRemainingTime = activeInnerSwiper.params.autoplay.delay;
                autoplayStartTime = Date.now();
                autoplayTimeout = setTimeout(() => {
                  const productsOpen = activeInnerSwiperEl.querySelector('.stories__products.open');
                  if (!productsOpen) {
                    handleNextSlide(mainSwiper, mainSwiper.realIndex);
                  }
                }, autoplayRemainingTime);
              }
          }

          const productTitle = swSlide.querySelector(".stories__products-title");
          const productsEl = swSlide.querySelector(".stories__products");

          productTitle?.addEventListener("click", function () {
            const isActiveExternalSlide = (mainSwiper.realIndex === index);
            const isActiveInnerSlide = (innerSwiper.activeIndex === Array.from(swSlide.parentNode.children).indexOf(swSlide));
        
            if (!isActiveExternalSlide || !isActiveInnerSlide) return;
            productsEl.classList.toggle('open');
            productsEl.closest('.swiper-story-inner').classList.toggle('products-open')
        
            const bulletActive = swSlide.closest('.swiper-story-inner').querySelector('.swiper-pagination-bullet-active');
        
            if (productsEl.classList.contains('open')) {
              productsEl.style.transitionDelay = '0s'
              innerSwiper.autoplay.stop();
              bulletActive.classList.add('paused');
              mainSwiper.allowTouchMove = false;
              playProductCardsMedia(productsEl);
            } else {
              bulletActive.classList.remove('paused');
              customAutoplayResume();
              mainSwiper.allowTouchMove = true;
              setTimeout(() => {
                if (productsEl.style.transitionDelay == '0s') productsEl.style.removeProperty('transition-delay');
              }, 100)
              pauseProductCardsMedia(productsEl);
            }
          });
        }))
      });

      function handleHoldStart(e, innerSwiper, mainSwiper, index, swSlide) {
        holdTimeout = setTimeout(() => {
          isHolding = true;
          wasHolding = true;
          const activeOuterSlide = mainSwiper.slides[mainSwiper.activeIndex];
          const activeInnerSwiperEl = activeOuterSlide.querySelector('.swiper-story-inner');
          const activeInnerSwiper = activeInnerSwiperEl?.swiper;
          const activeInnerSlide = activeInnerSwiper.slides[activeInnerSwiper.activeIndex];
          const bulletActive = activeInnerSwiperEl.querySelector('.swiper-pagination-bullet-active');
          const elapsed = Date.now() - autoplayStartTime;
          autoplayRemainingTime = Math.max(innerSwiper.params.autoplay.delay - elapsed, 0);
      
          holdStartTime = Date.now();
      
          innerSwiper.autoplay.pause();
          clearTimeout(autoplayTimeout);
      
          bulletActive?.classList.add('paused');
      
          mainSwiper.allowTouchMove = false;
        }, 200);
      }
      
      function handleHoldEnd(e, innerSwiper, mainSwiper, index, swSlide) {
        clearTimeout(holdTimeout);
        if (!isHolding) return;
        isHolding = false;
      
        const activeOuterSlide = mainSwiper.slides[mainSwiper.activeIndex];
        const activeInnerSwiperEl = activeOuterSlide.querySelector('.swiper-story-inner');
        const activeInnerSwiper = activeInnerSwiperEl?.swiper;
        const activeInnerSlide = activeInnerSwiper.slides[activeInnerSwiper.activeIndex];
        const bulletActive = activeInnerSwiperEl.querySelector('.swiper-pagination-bullet-active');
      
        mainSwiper.allowTouchMove = true;
      
        if (!innerSwiper || index == null) return;
      
        autoplayStartTime = Date.now();
        innerSwiper.autoplay.resume();
        bulletActive?.classList.remove('paused');

        setTimeout(() => {
          wasHolding = false;
        }, 150);
      }

      function handleNextSlide(mainSwiper, index) {
        if (index < slides.length - 1) {
          mainSwiper.slideNext();
          resetBulletProgress(innerSwipers[index + 1]);
        } else {
          mainSwiper.slideTo(0, 0)
        }
      }

      thumbnails.forEach((thumbnail, index) => {
        thumbnail.addEventListener("click", function (e) {
          // storiesSlider.querySelectorAll('.swiper-slide').forEach(slide => {slide.style.transition = 'none'})
          e.preventDefault();
          storiesSlider.classList.add("stories-slider-in");
          storiesSlider.classList.remove("visually-hidden");
          document.body.classList.add('hidden');
          mainSwiper.slideTo(index, 0);

          innerSwipers.forEach((sw, i) => {
            sw.autoplay.stop();
            sw.slideTo(0, 0);
          });
          const innerSwiper = innerSwipers[index];
          if (innerSwiper) {
            innerSwiper.slideTo(0, 0);
            resetBulletProgress(innerSwiper);
            if (!storiesSlider.classList.contains("stories-slider-in")) return;
            innerSwiper.autoplay.start();
            setTimeout(() => {
              if (innerSwiper.slides?.length > 0) {
                setTimeout(() => {}, 50)
                
                if (innerSwiper.slides.length === 1) {
                  clearTimeout(autoplayTimeout);
                  autoplayRemainingTime = innerSwiper.params.autoplay.delay;
                  autoplayStartTime = Date.now();

                  autoplayTimeout = setTimeout(() => {
                    const productsOpen = storiesSlideshow.querySelector('.stories__products.open');
                    if (!productsOpen) {
                      handleNextSlide(mainSwiper, index);
                    }
                  }, autoplayRemainingTime);
                } else if (innerSwiper.isEnd) {
                  delayedHandleNextSlide(innerSwiper, mainSwiper, index);
                }
              }
            }, 100);
          }
        });
      });
      function customAutoplayResume() {
        const activeOuterSlide = mainSwiper.slides[mainSwiper.activeIndex];
        const activeInnerSwiperEl = activeOuterSlide.querySelector('.swiper-story-inner');
        const activeInnerSwiper = activeInnerSwiperEl?.swiper;
        const activeInnerSlide = activeInnerSwiper.slides[activeInnerSwiper.activeIndex];
        activeInnerSwiper.params.autoplay.delay = autoplayRemainingTime || autoplaySpeed;
        activeInnerSwiper.autoplay.start();
        if (activeInnerSwiper.slides.length === 1) {
          clearTimeout(autoplayTimeout);
          autoplayRemainingTime = activeInnerSwiper.params.autoplay.delay;
          autoplayStartTime = Date.now();

          autoplayTimeout = setTimeout(() => {
            const productsOpen = activeInnerSwiperEl.querySelector('.stories__products.open');
            if (!productsOpen) {
              handleNextSlide(mainSwiper, mainSwiper.realIndex);
            }
          }, autoplayRemainingTime);
        }
      }
      document.addEventListener("click", function (e) {
        if(!storiesSlider.className.includes("stories-slider-in")) return 
        if (e.target.closest('.video-controls')) return
        if (e.target?.closest(".stories-slider-close-button") || e.target?.classList.contains('swiper-stories') && !storiesSlider.querySelector('.products-open') || e.target?.classList.contains('swiper-wrapper-stories') && !storiesSlider.querySelector('.products-open')) {
          closeStories();
        }
        const activeOuterSlide = mainSwiper.slides[mainSwiper.activeIndex];
        if(!activeOuterSlide) return
        const activeInnerSwiperEl = activeOuterSlide.querySelector('.swiper-story-inner');
        const activeInnerSwiper = activeInnerSwiperEl?.swiper;
        if (!activeInnerSwiper) return;

        const activeInnerSlide = activeInnerSwiper.slides[activeInnerSwiper.activeIndex];
        if (!activeInnerSlide) return;

        const productsEl = activeInnerSlide.querySelector('.stories__products');
        const bulletActive = activeInnerSwiperEl.querySelector('.swiper-pagination-bullet-active');

        const isClickInsideProducts = e.target.closest('.stories__products');
        const isClickOnTitle = e.target.closest('.stories__products-title');

        if (productsEl && isClickInsideProducts === null && !isClickOnTitle && isClickInsideProducts !== productsEl && isClickInsideProducts !== productsEl.firstChild && productsEl.classList.contains('open')) {
          productsEl.classList.remove('open');
          productsEl.closest('.swiper-story-inner').classList.remove('products-open')
          bulletActive.classList.remove('paused');
          mainSwiper.allowTouchMove = true; 
          customAutoplayResume()
          pauseProductCardsMedia(productsEl);
        }

        const  clickedWrapperSlide = e.target.closest(".swiper.swiper-story-inner")
        const clickedOuterSlide = e.target.closest(".swiper-slide.stories-slides");
        if (!e.target.closest('.stories-slider-button') && clickedWrapperSlide && clickedOuterSlide && !clickedOuterSlide.classList.contains("swiper-slide-active")) {
            const clickedIndex = Array.from(mainSwiper.slides).indexOf(clickedOuterSlide);
            if (clickedIndex !== -1) {
                mainSwiper.slideTo(clickedIndex, 300);
            }
        }
      });

      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (mainSwiper) {
            mainSwiper.destroy(true, true);
          }
          initMainSlider();
        }, 200);
      });
      function resetBulletProgress(innerSwiper) {
        const bullets = innerSwiper.el.querySelectorAll(".swiper-pagination-bullet");
        bullets.forEach((bullet) => {
          if (!bullet.closest('.swiper-pagination-bullet-active')) return
          bullet.classList.remove("swiper-pagination-bullet-active", "paused");
          void bullet.offsetWidth;
          bullet.classList.add("swiper-pagination-bullet-active");
        });
      }

      function closeStories() {
        if (mainSwiper) {
          mainSwiper.autoplay?.stop?.();
          mainSwiper.allowTouchMove = false;
        }

        innerSwipers.forEach(sw => {
          sw?.autoplay?.stop?.();
          sw.allowTouchMove = false;
        });

        clearTimeout(autoplayTimeout);
        autoplayTimeout = null;

        storiesSlider.classList.remove("stories-slider-in");
        storiesSlider.classList.add("visually-hidden");
        document.body.classList.remove('hidden');

        storiesSlideshow.querySelectorAll('.stories__products.open').forEach(productsEl => {
          productsEl.classList.remove('open');
          productsEl.closest('.swiper-story-inner')?.classList.remove('products-open');
          pauseProductCardsMedia(productsEl);
        });

        storiesSlideshow.querySelectorAll('.swiper-pagination-bullet.paused').forEach(bullet => {
          bullet.classList.remove('paused');
        });
      }

      function customAutoplayResume() {
            const activeOuterSlide = mainSwiper.slides[mainSwiper.activeIndex];
            const activeInnerSwiperEl = activeOuterSlide.querySelector('.swiper-story-inner');
            const activeInnerSwiper = activeInnerSwiperEl?.swiper;
            const activeInnerSlide = activeInnerSwiper.slides[activeInnerSwiper.activeIndex];
              activeInnerSwiper.params.autoplay.delay = autoplayRemainingTime || autoplaySpeed;
              activeInnerSwiper.autoplay.start();
              if (activeInnerSwiper.slides.length === 1) {
                clearTimeout(autoplayTimeout);
                autoplayRemainingTime = activeInnerSwiper.params.autoplay.delay;
                autoplayStartTime = Date.now();
                autoplayTimeout = setTimeout(() => {
                  const productsOpen = activeInnerSwiperEl.querySelector('.stories__products.open');
                  if (!productsOpen) {
                    handleNextSlide(mainSwiper, mainSwiper.realIndex);
                  }
                }, autoplayRemainingTime);
              }
          }
      
      document.addEventListener(
        'keyup',
        (event) => event.code && event.code.toUpperCase() === 'ESCAPE' && closeStories()
      );
    }
  });
}

document.addEventListener("DOMContentLoaded", initStoriesSlideshow);
document.addEventListener("shopify:section:load", initStoriesSlideshow);

class AddToCart extends HTMLElement {
  constructor() {
    super();
    if (this.classList.contains('cart-drawer')) this.miniCart = document.querySelector('cart-drawer');
    if (this.classList.contains('cart-notification')) this.miniCart = document.querySelector('cart-notification');
   
    this.addEventListener('click', (event) => {
      event.preventDefault()
      if (this.querySelector('button[disabled]')) return
      this.onClickHandler(this)
    }) 
  }

  onClickHandler() {
    const variantId = this.dataset.variantId;

    if (variantId) {
      if (document.body.classList.contains('template-cart') ) {
        Shopify.postLink(window.routes.cart_add_url, {
          parameters: {
            id: variantId,
            quantity: 1
          },
        });
        return;
      }

      this.setAttribute('disabled', true);
      this.classList.add('loading');
      const sections = this.miniCart ? this.miniCart.getSectionsToRender().map((section) => section.id) : this.getSectionsToRender().map((section) => section.id);

      const body = JSON.stringify({
        id: variantId,
        quantity: 1,
        sections: sections,
        sections_url: window.location.pathname
      });

      fetch(`${window.routes.cart_add_url}`, { ...fetchConfig('javascript'), body })
        .then((response) => response.json())
        .then((parsedState) => {
          if (parsedState.status === 422) {
             document.dispatchEvent(new CustomEvent('ajaxProduct:error', {
                detail: {
                  errorMessage: parsedState.description
                }
              }));
           }
           else {
            this.miniCart && this.miniCart.renderContents(parsedState);
            this.renderContents(parsedState)
             document.dispatchEvent(new CustomEvent('ajaxProduct:added', {
              detail: {
                product: parsedState
              }
            }));
          }
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          this.classList.remove('loading');
          this.removeAttribute('disabled');
        });
    }
  }
  getSectionsToRender() {
    let arraySections = []
    if (window.innerWidth > 920 && document.querySelector('.header-without-sidebars')) {
      arraySections = [
        {
          id: 'cart-drawer',
          selector: '#CartDrawer'
        },
        {
          id: 'menu-drawer',
          selector: '#cart-icon-bubble-menu-drawer'
        },
        {
          id: 'header',
          selector: '#cart-icon-bubble-header'
        },
        {
          id: 'secondary-sidebar',
          selector: '#cart-icon-bubble-secondary-sidebar'
        },
        {
          id: 'main-sidebar',
          selector: '#cart-icon-bubble-main-sidebar'
        }
      ];
    } else if (window.innerWidth > 920 && document.querySelector('.secondary-header-section')) {
      arraySections = [
        {
          id: 'cart-drawer',
          selector: '#CartDrawer'
        },
        {
          id: 'menu-drawer',
          selector: '#cart-icon-bubble-menu-drawer'
        },
        {
          id: 'secondary-header',
          selector: '#cart-icon-bubble-secondary-header'
        },
        {
          id: 'secondary-sidebar',
          selector: '#cart-icon-bubble-secondary-sidebar'
        },
        {
          id: 'main-sidebar',
          selector: '#cart-icon-bubble-main-sidebar'
        }
      ];
    } else {
      arraySections = [
        {
          id: 'cart-drawer',
          selector: '#CartDrawer'
        },
        {
          id: 'menu-drawer',
          selector: '#cart-icon-bubble-menu-drawer'
        },
        {
          id: 'mobile-header',
          selector: '#cart-icon-bubble-mobile-header'
        }
      ];
    }
    return arraySections
  }
  renderContents(parsedState) {
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section => {
      const sectionElements = document.querySelectorAll(section.selector);
      if(sectionElements) {
        Array.from(sectionElements).forEach(sectionElement => {
          sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
        })
      } 
    }));
  }
  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }
}
customElements.define('add-to-cart', AddToCart);

// This script works both for Slideshow section and for Anouncement bar
class SlideshowComponent extends HTMLElement {
  constructor() {
    super();
      this.debug = false;
      
          this.slideshow = this.querySelector('.slideshow__slider');
          this.fade = this.slideshow.classList.contains("animation-fade") ? true : false;
          this.data = this.slideshow.dataset;
          this.time = 500;
          this.posX1 
          this.posInit 
          this.posX2
          this.posY1
          this.posY2 
          this.posInitY
          this.swipeVertical
          this.swipeHorizontal
          this.init(this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.data.start? this.data.start : 1)+")"));
  
          if (Shopify.designMode) {
            document.addEventListener('shopify:section:load', (event) => {
              if (event.target.closest('.slideshow-section')) {
                this.init(this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.data.start? this.data.start : 1)+")"))
              }
            })
            document.addEventListener('shopify:section:reorder', () => {
              this.init(this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.data.start? this.data.start : 1)+")"))
            })
            document.addEventListener('shopify:block:select', (event) => {
              this.slideshow.querySelectorAll('.slideshow__slide').forEach(slide => {
                if (event.target.getAttribute('id') == slide.getAttribute('id')) this.init(slide)
              } )        
            })
          }
          
          this.controls = {
            "buttonNext": this.querySelector('.slideshow__controls--next'),
            "buttonPrev": this.querySelector('.slideshow__controls--prev'),
            "currentSlideNumber": this.querySelector('.slideshow__controls-current'),
            "slides": this.querySelectorAll('.slideshow__slide')
          };
          if (this.controls.buttonNext || this.controls.buttonPrev) {
            this.controls.buttonNext.addEventListener('click', () => {
              this.next('next')
              this.autoplay = this.data.autoplay ? this.data.autoplay : false
              if(this.autoplay) {
                this.stopAutoplay();
                this.start()
              }
            })
            this.controls.buttonPrev.addEventListener('click', () => {
              this.prev('prev')
              this.autoplay = this.data.autoplay ? this.data.autoplay : false
              if(this.autoplay) {
                this.stopAutoplay();
                this.start()
              }
            })
          }

          if (!this.data.autoplay) return
          this.querySelectorAll('.slideshow__content-js').forEach(content => {
            content.addEventListener('mouseenter', this.stopAutoplay.bind(this))
            content.addEventListener('mouseleave', this.start.bind(this))
          })
          if (this.controls.buttonNext || this.controls.buttonPrev) {
            this.controls.buttonNext.addEventListener('mouseenter', this.stopAutoplay.bind(this))
            this.controls.buttonPrev.addEventListener('mouseenter', this.stopAutoplay.bind(this))
          }
  }

  init(element) {   
      this.slideshow.querySelectorAll(".slideshow__slide").forEach(slide => {
        slide.classList.remove('loaded')
        slide.classList.remove('current')
        if (slide.querySelector('video')) slide.querySelector('video').pause()
        slide.classList.remove('before-load')
      })
      this.current = {
          "int": this.data.start? parseInt(this.data.start) : 1,
          "element": element
      }
      if (this.current.element && this.current.element.classList){ 
          this.current.element.classList.add("current");
          if (this.current.element.querySelector('video')) this.current.element.querySelector('video').play()
      }
      
      this.length = parseInt(this.slideshow.querySelectorAll(".slideshow__slide").length);

      this.autoplay = this.data.autoplay ? this.data.autoplay : false;
      this.timeout = null;
      if(this.autoplay) this.start();
      this.refreshControls()
      this.classList.add("slideshow-initialized");
  }

  prev(useAnimation = true){ 
    this.slideshow.querySelectorAll('.slideshow__slide').forEach(slide => slide.classList.remove('prev'))
      var temp = this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.current.int - 1)+")")
      if(temp){
        var prev = {
          "int": this.current.int - 1,
          "element": temp
        }
      } 
      else {
        var prev = {
          "int": this.length,
          "element": this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.length)+")")
        }
      }

      this.setPosition(prev, 'prev', useAnimation)
      this.refreshControls()
  }

  next(useAnimation = true){  
      var temp = this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.current.int + 1)+")")
      if(temp)
          var next = {
              "int": this.current.int + 1,
              "element": temp
          }
      else
          var next = {
              "int": 1,
              "element": this.slideshow.querySelector(".slideshow__slide:nth-child(1)")
          }
      this.setPosition(next, 'next', useAnimation);
      this.refreshControls()
  }

  set(index, useAnimation = true){
      index = parseInt(index)
      var temp = this.slideshow.querySelector(`.slideshow__slide:nth-child(${index})`)
      if(temp){
          if(this.autoplay){
              this.stopAutoplay();
          }
          this.autoplay = false;
          this.setPosition({
              "int": index,
              "element": temp
          }, useAnimation);
      }
  }

  setPosition(to, direction){
    if(this.current.int != to.int) {
        this.stop();
        var after = function () {
          let arr = Array.from(this.slideshow.querySelectorAll('.slideshow__slide'))
            this.current.element.classList.remove("current");
            if (this.current.element.querySelector('video')) this.current.element.querySelector('video').pause()
            arr.forEach(slide => {
              slide.classList.add('animate')
              slide.classList.remove('prev', `direction-${direction}`)
            })
            if (this.current.element.querySelector(".slide-content.slide-background>img")) {
                this.current.element.querySelector(".slide-content.slide-background>img").style.removeProperty("transform");
            }
            to.element.classList.add("current");
            if (to.element.querySelector('video')) to.element.querySelector('video').play()
            this.current = to;

            if (this.querySelectorAll('.slideshow__button a').length > 0) this.querySelectorAll('.slideshow__button a').forEach(button => {
              button.closest('.current') ? button.setAttribute('tabindex', '0') : button.setAttribute('tabindex', '-1')
            })
            this.currentElementIndex = arr.indexOf(this.current.element)
            
            if (direction == 'next') {
              this.current.element.classList.add(`direction-${direction}`)
              if (this.currentElementIndex > 0) {
                this.prevElement = arr[this.currentElementIndex - 1]
                this.prevElement.classList.add(`direction-${direction}`)
              } else {
                this.prevElement = arr[arr.length - 1]
                this.prevElement.classList.add(`direction-${direction}`)
              }
            } else {
              this.current.element.classList.add(`direction-${direction}`)
              if (this.currentElementIndex == arr.length - 1) {
                this.prevElement = arr[0]
                this.prevElement.classList.add(`direction-${direction}`)
              } else {
                this.prevElement = arr[this.currentElementIndex + 1]
                this.prevElement.classList.add(`direction-${direction}`)
              }
            }
            if (this.slideshow.classList.contains('text-blocks')) this.slideshow.style.insetInlineStart = `calc(-100% * ${this.currentElementIndex})`
            if (this.prevElement.classList) this.prevElement.classList.add('prev')
            if(this.autoplay) this.start();
            this.lock = false;
            this.refreshControls()
        }.bind(this);
        after()
      }
  }

  start() {
      this.autoplay = this.data.autoplay ? this.data.autoplay : false;

      this.slideshow.classList.add("slideshow-playing");
      this.slideshow.classList.remove("slideshow-stopped");
      
      this.timeout = setTimeout(this.next.bind(this), this.autoplay);
      
  } 
  stop() {
      clearTimeout(this.timeout);
  }
  stopAutoplay(){
      if(this.slideshow.classList.contains("slideshow-playing")){
          this.slideshow.classList.add("slideshow-stopped");
          this.slideshow.classList.remove("slideshow-playing");
      }
      this.stop();
  }

  changeSlide(direction) {
    if (direction == 'next') {
      this.currentSlide = this.querySelector('.slideshow__slide.current')
      let index = Array.from(this.controls.slides).indexOf(this.currentSlide) + 1
  
      if (index < this.controls.slides.length) {
        this.set((index + 1));
        this.start();
      }
      else {
        this.set((1));
        this.start();
      }
      this.refreshControls()
    }
    if (direction == 'prev') {
      this.currentSlide = this.querySelector('.slideshow__slide.current')
      let index = Array.from(this.controls.slides).indexOf(this.currentSlide) + 1
  
      this.set((index + 1));
      if (index > 1) {
        this.set((index - 1));
        this.start();
      }
      else {
        this.set((this.controls.slides.length));
        this.start();
      }
      this.refreshControls()
    }
  }

  refreshControls() {
    this.currentSlide = this.querySelector('.slideshow__slide.current')
    this.currentSlideNumber = this.querySelector('.slideshow__controls-current')
    if (!this.currentSlideNumber) return
    this.currentSlideNumber.innerHTML = this.currentSlide.dataset.position
  }

  touchStart(event) {
    if (event.target.closest('.slideshow__controls--prev') || event.target.closest('.slideshow__controls--next')) return
    let evt = event.changedTouches[0];
    this.posInit = this.posX1 = evt.clientX;
    this.posInitY = this.posY1 = evt.clientY
  }

  touchMove(event) {
    if (event.target.closest('.slideshow__controls')) return
    let evt = event.changedTouches[0];
    this.posX2 = this.posX1 - evt.clientX;
    this.posX1 = evt.clientX;
    this.posY2 = this.posY1 - evt.clientY;
    this.posY1 = evt.clientY;
    // this.rads = Math.atan(this.posY2/this.posX2)
    // this.deg = Math.abs(this.rads * (180/3.14))
  }

  touchEnd(event) {
    if (event.target.closest('.slideshow__controls--prev') || event.target.closest('.slideshow__controls--next')) return
    let isHorizontalSwipe = Math.abs(this.posInit - this.posX1) > Math.abs(this.posInitY - this.posY1)
    let horizontalSwipeIsOk = Math.abs(this.posInit - this.posX1) > 50
    let swipeVertical = Math.abs(this.posInitY - this.posY1) > 80
    let swipeHorizontal = Math.abs(this.posInit - this.posX1) > 60
    if (isHorizontalSwipe && horizontalSwipeIsOk) {
      this.slideshow.removeEventListener('touchmove', this.touchMove.bind(this));
      this.slideshow.removeEventListener('touchend', this.touchEnd.bind(this));
      let posFinal = this.posInit - this.posX1;
      let direction = 'next'
      posFinal > 0 ? direction = 'next' : direction = 'previous'
      if (direction == 'next') {
        this.next('next')
        this.autoplay = this.data.autoplay ? this.data.autoplay : false
        if(this.autoplay) {
          this.stopAutoplay();
          this.start()
        }
      }
      if (direction == 'previous') {
        this.prev('prev')
        this.autoplay = this.data.autoplay ? this.data.autoplay : false
        if(this.autoplay) {
          this.stopAutoplay();
          this.start()
        }
      }
    }
  }
}
customElements.define('slideshow-component', SlideshowComponent);

class VariantSelects extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('change', (event) => this.handleProductUpdate(event));
    this.initializeProductSwapUtility();
    this.priceInsideButton = false
    this.buttonIcon = false
    if(this.closest('.product__info-wrapper').querySelector('.price-inside-button')) this.priceInsideButton = true
    if(document.querySelector('.product-sticky-cart')) this.buttonIcon = true
    this.querySelectorAll('.color__swatch').forEach(colorSwatch => colorSwatch.addEventListener('mouseenter', (e) => this.alignSwatchTooltip(e))) 
    this.querySelectorAll('.color__swatch').forEach(colorSwatch => colorSwatch.addEventListener('touchstart', (e) => this.alignSwatchTooltip(e))) 
  }

  alignSwatchTooltip(e) {
    const colorSwatch = e.currentTarget || e.target;
    const tooltip = colorSwatch.querySelector('.color__swatch-tooltip');
    if (!tooltip) return;
    const viewport = colorSwatch.closest('.product');

    tooltip.style.setProperty('--tooltip-arrow-left', 'auto');
    tooltip.style.setProperty('--tooltip-arrow-transform', 'none');
    tooltip.removeAttribute('style');

    if (viewport && viewport.getBoundingClientRect().left >= tooltip.getBoundingClientRect().left) {
      tooltip.setAttribute('style', `right: calc(50% - ${(Math.abs(tooltip.getBoundingClientRect().left - viewport.getBoundingClientRect().left))}px);`);
      tooltip.style.setProperty('--tooltip-arrow-left', `${colorSwatch.getBoundingClientRect().width / 2}px`);
      tooltip.style.setProperty('--tooltip-arrow-transform', `translateX(-50%)`);
    }
  }

  initializeProductSwapUtility() {
    this.swapProductUtility = new HTMLUpdateUtility();
    this.swapProductUtility.addPreProcessCallback((html) => {
      return html;
    });
    this.swapProductUtility.addPostProcessCallback((newNode) => {
      window?.Shopify?.PaymentButton?.init();
      window?.ProductModel?.loadShopifyXR();
      publish(PUB_SUB_EVENTS.sectionRefreshed, {
        data: {
          sectionId: this.dataset.section,
          resource: {
            type: SECTION_REFRESH_RESOURCE_TYPE.product,
            id: newNode.querySelector('variant-selects').dataset.productId,
          },
        },
      });
    });
  }

  handleProductUpdate(event) {
    let loader 
    if (document.querySelector('.product-form__submit .loading-overlay__spinner')) loader = document.querySelector('.product-form__submit .loading-overlay__spinner').innerHTML
    const addButton = document.querySelector('.product-form__submit[name="add"]');
    if (addButton) addButton.innerHTML = `<div class="loading-overlay__spinner">${loader}</div>`
    this.handleFunctionProductUpdate(event)
    
    document.dispatchEvent(new CustomEvent('variant:change', {
      detail: {
        variant: this.currentVariant
      }
    }))
  }

  handleFunctionProductUpdate(event) {
    const input = this.getInputForEventTarget(event.target);
    const targetId = input.id;
    let targetUrl = input.dataset.productUrl;
    this.currentVariant = this.getVariantData(targetId);

    const optionName = (event.target.name || "").toLowerCase();
    const isSize = optionName.includes('size') || optionName.includes('kích thước');
    const isColor = optionName.includes('color') || optionName.includes('colour') || optionName.includes('màu') || optionName.includes('colorway');

    const sectionId = this.dataset.originalSection || this.dataset.section;
    this.updateSelectedSwatchValue(event);
    this.toggleAddButton(true, '', false);
    this.removeErrorMessage();

    let callback = () => {};
    if (!this.currentVariant) {
      this.toggleAddButton(true, '', true);
      this.setUnavailable();
      if(this.querySelector('.product-combined-listings')) callback = this.handleSwapProduct(sectionId, true)
    } else if (this.dataset.url !== targetUrl) {
      if (isColor) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      this.updateMedia(false);
      this.updateURL(targetUrl);
      this.updateVariantInput();
      this.querySelector('.product-combined-listings') ? callback = this.handleSwapProduct(sectionId) : callback = this.handleUpdateProductInfo(sectionId);
    }
    this.renderProductInfo(sectionId, targetUrl, targetId, callback);
  }

  updateSelectedSwatchValue({ target }) {
    const { value, tagName } = target;
    if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = target.closest(`.product-form__input`).querySelector('[data-selected-value]');
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
    }
  }

  updateMedia(isScroll = true) {
    if (!this.currentVariant) return;
    if (this.currentVariant.featured_media) {
      const mediaGallery = document.getElementById(`MediaGallery-${this.dataset.section}`);
      mediaGallery.setActiveMedia(`${this.dataset.section}-${this.currentVariant.featured_media.id}`, isScroll);
    } else if (!this.currentVariant.featured_media && document.querySelector('.product__media-list.variant-images')) {
      const mediaGallery = document.getElementById(`MediaGallery-${this.dataset.section}`);
      mediaGallery.setActiveMedia(`false`, isScroll);
    }
    document.dispatchEvent(new CustomEvent('updateVariantMedia'))
  }

  updateURL(url) {
    if (this.dataset.updateUrl === 'false') return;
    window.history.replaceState({ }, '', `${url}${this.currentVariant?.id ? `?variant=${this.currentVariant.id}` : ''}`);
  }

  updateVariantInput() {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-${this.dataset.section}--alt, #product-form-installment`);
    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = this.currentVariant ? this.currentVariant.id : ''
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  updatePickupAvailability() {
    const pickUpAvailability = document.querySelector('pickup-availability');
    if (!pickUpAvailability) return;
    if (this.currentVariant && this.currentVariant.available) {
      pickUpAvailability.fetchAvailability(this.currentVariant.id);
    } else {
      pickUpAvailability.removeAttribute('available');
      pickUpAvailability.innerHTML = '';
    }
  }

  getInputForEventTarget(target) {
    return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
  }

  getVariantData(inputId) {
    return JSON.parse(this.getVariantDataElement(inputId).textContent);
  }

  getVariantDataElement(inputId) {
    return this.querySelector(`script[type="application/json"][data-resource="${inputId}"]`);
  }

  removeErrorMessage() {
    const section = this.closest('section');
    if (!section) return;

    const productForm = section.querySelector('product-form');
    if (productForm && typeof productForm.handleErrorMessage === 'function') {
      productForm.handleErrorMessage();
    }
  }

  getWrappingSection(sectionId) {
    return (
      this.closest(`section[data-section="${sectionId}"]`) || // main-product
      this.closest(`#shopify-section-${sectionId}`) || // featured-product
      null
    );
  }

  handleSwapProduct(sectionId, unavailableProduct = false) {
    return (html) => {
      const oldContent = this.getWrappingSection(sectionId);
      if (!oldContent) {
        return;
      }
      document.getElementById(`ProductModal-${sectionId}`)?.remove();

      const response =
        html.querySelector(`section[data-section="${sectionId}"]`) /* main/quick-view */ ||
        html.getElementById(`shopify-section-${sectionId}`); /* featured product*/

      this.swapProductUtility.viewTransition(oldContent, response);
      this.updateCurrentVariant(html)
      this.updateVariantImage(html)
      if(unavailableProduct) {
        this.toggleAddButton(true, '', true);
        this.setUnavailable();
      } else {
        if (this.currentVariant) this.toggleAddButton(!this.currentVariant.available, variantStrings.soldOut);
      }
    };
  }

  handleUpdateProductInfo(sectionId) {
    return (html) => {
      this.updatePickupAvailability();
      this.updateSKU(html);
      this.updateStoreLocator(html);
      this.updatePrice(html);
      this.updatePriceAlt(html);
      this.updateCurrentVariant(html)
      this.updateVariantImage(html)
      this.updateColorName(html);
      this.updateInventoryStatus(html);
      if (this.currentVariant) this.toggleAddButton(!this.currentVariant.available, variantStrings.soldOut);
      this.updateOptionValues(html);
      this.updateProductUrl(html);
      publish(PUB_SUB_EVENTS.variantChange, {
        data: {
          sectionId,
          html,
          variant: this.currentVariant,
        },
      });
    };
  }

  updateOptionValues(html) {
    const variantSelects = html.querySelector('variant-selects');
    if (variantSelects) this.innerHTML = variantSelects.innerHTML;
  }

  getSelectedOptionValues() {
    const elements = this.querySelectorAll('select option[selected], fieldset input:checked');

    let selectedValues = Array.from(elements).map(
      (element) => element.dataset.optionValueId
    );

    this.optionsSize = this.dataset.optionsSize
    if (selectedValues.length < this.optionsSize) {
      const fieldsets = this.querySelectorAll('fieldset');
      fieldsets.forEach((fieldset) => {
        const checkedInput = fieldset.querySelector('input:checked');
        if (!checkedInput) {
          const fallbackInput = fieldset.querySelector('input[checked]');
          if (fallbackInput) {
            const value = fallbackInput.dataset.optionValueId;
            if (value && !selectedValues.includes(value)) selectedValues.push(value);
          }
        }
      });
    }

  return selectedValues;
  }

  renderProductInfo(sectionId, url, targetId, callback) {
    const variantParam = this.currentVariant?.id
    ? `variant=${this.currentVariant.id}`
    : '';

    if(!url) url = this.dataset.url
    const fetchUrl = variantParam
    ? `${url}?${variantParam}&section_id=${sectionId}`
    : `${url}?section_id=${sectionId}`;

    fetch(fetchUrl)
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        callback(html);
      })
      .then(() => {
        const el = document.getElementById(targetId);
        if (el) el.focus({ preventScroll: true });
      })
  }

  updateSKU(html) {
    const id = `sku-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
    if (!source && destination) destination.classList.add('visually-hidden')
  }

  updateStoreLocator(html) {
    const id = `store_locator-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
    if (!source && destination) destination.classList.add('visually-hidden')
  }

  updatePrice(html) {
    const id = `price-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateCurrentVariant(html) {
    const id = `current-variant-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateVariantImage(html) {
    const id = `variant-image-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updatePriceAlt(html) {
    const id = `price-${this.dataset.section}--alt`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateColorName(html) {
    const id = `color-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateInventoryStatus(html) {
    const id = `inventory-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateProductUrl(html) {
    const currentUrl = window.location.href;
    const id = `#product-url-${this.dataset.section} input`;
    const destination = document.querySelector(id);
    const source = html.querySelector(id);
    if (source && destination) destination.setAttribute('value', `${currentUrl}`);
    if (destination) destination.classList.remove('visually-hidden');
  }

  toggleAddButton(disable = true, text, modifyClass = true) {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-${this.dataset.section}--alt`);
    const loader = document.querySelector('.loading-overlay__spinner').innerHTML
    productForms.forEach((productForm) => {
      const addButton = productForm.querySelector('[name="add"]');
      if (!addButton) return;
      let priceContent = ''
      let buttonIcon = ''
      if(this.buttonIcon) buttonIcon = document.querySelector('.product-form__buttons-icon').innerHTML
      if(this.priceInsideButton) priceContent = document.getElementById(`price-${this.dataset.section}`).querySelector('.price').innerHTML
      if (disable) {
        addButton.setAttribute('disabled', true);
        addButton.setAttribute('data-sold-out', true);
        if (text) addButton.innerHTML = `<span class="price-inside-button">${priceContent}</span><span>${text}</span><span class="product-form__buttons-icon">${buttonIcon}</span> <div class="loading-overlay__spinner hidden">${loader}</div>`;      }
      else {
        addButton.removeAttribute('disabled');
        addButton.removeAttribute('data-sold-out');
        addButton.innerHTML = addButton.dataset.preOrder === 'true' ? `<span class="price-inside-button">${priceContent}</span><span>${variantStrings.preOrder}</span><span class="product-form__buttons-icon">${buttonIcon}</span> <div class="loading-overlay__spinner hidden">${loader}</div>` : `<span class="price-inside-button">${priceContent}</span><span>${variantStrings.addToCart}</span><span class="product-form__buttons-icon">${buttonIcon}</span> <div class="loading-overlay__spinner hidden">${loader}</div>`;
      }
      if (!modifyClass) return;
    });
  }

  setUnavailable() {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-${this.dataset.section}--alt`);
    const loader = document.querySelector('.loading-overlay__spinner').innerHTML
    productForms.forEach((productForm) => {
      const addButton = productForm.querySelector('[name="add"]');
      if (!addButton) return;
      addButton.removeAttribute('data-sold-out');
      let priceContent = ''
      let buttonIcon = ''
      if(this.buttonIcon) buttonIcon = document.querySelector('.product-form__buttons-icon').innerHTML
      if(this.priceInsideButton) priceContent = document.getElementById(`price-${this.dataset.section}`).querySelector('.price').innerHTML
      addButton.innerHTML = `<span class="price-inside-button">${priceContent}</span><span>${variantStrings.unavailable}</span> <span class="product-form__buttons-icon">${buttonIcon}</span> <div class="loading-overlay__spinner hidden">${loader}</div>`;

      const price = document.getElementById(`price-${this.dataset.section}`);
      if (price) price.classList.add('visually-hidden');

      const priceAlt = document.getElementById(`price-${this.dataset.section}--alt`);
      if (priceAlt) priceAlt.classList.add('visually-hidden');

      const inventory = document.getElementById(`inventory-${this.dataset.section}`);
      if (inventory) inventory.classList.add('visually-hidden');

      const sku = document.getElementById(`sku-${this.dataset.section}`);
      if (sku) sku.classList.add('visually-hidden');

      const storeLocator = document.getElementById(`store_locator${this.dataset.section}`);
      if (storeLocator) storeLocator.classList.add('visually-hidden');
    });
  }
}
customElements.define('variant-selects', VariantSelects);
class VariantRadios extends VariantSelects {}
customElements.define('variant-radios', VariantRadios);

class ProgressBar extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 0
    });
  }

  init() {
    setTimeout(() => {
      const quantity = parseInt(this.dataset.quantity);
      const totalQuantity = parseInt(this.dataset.total);
      this.style.setProperty('--progress-bar-width', `${quantity / totalQuantity * 100}%`);
    }, 300);
  }
}
customElements.define('progress-bar', ProgressBar);

class CountdownTimer extends HTMLElement {
  constructor() {
    super();

    const endDate = this.getAttribute('end-date'),
          endTime = this.getAttribute('end-time') || "00:00",
          timezoneOffset = this.getAttribute('timezone-offset'),
          expirationAction = this.getAttribute('expiration-action'),
          enableAnimation = this.getAttribute('enable-animation'),
          sectionBlocksCount = this.getAttribute('section-blocks-count'),
          sectionId = this.getAttribute('section-id'),
          productHandle = this.getAttribute('product-handle');

    this.endDate = endDate;
    this.endTime = endTime;
    this.timezoneOffset = timezoneOffset;
    this.expirationAction = expirationAction;
    this.enableAnimation = enableAnimation === "true";
    this.sectionBlocksCount = sectionBlocksCount;
    this.sectionId = sectionId;
    this.productHandle = productHandle;
    this.animationDuration = 300;

    this.init()
  }

  async fetchEndDateTimeAndMessage() {
    await fetch(`/products/${this.productHandle}`)
    .then(response => response.text())
    .then(html => {
      const parser = new DOMParser();
      const timerOnProductPage = parser.parseFromString(html, 'text/html').querySelector('.countdown');

      const endDate = timerOnProductPage.getAttribute('end-date');
      const endTime = timerOnProductPage.getAttribute('end-time');
      
      this.setAttribute('end-date', endDate);
      this.setAttribute('end-time', endTime);
      
      const completeMessage = timerOnProductPage.getAttribute('complete-message');
      const completeMessageElement = this.querySelector('.countdown__complete-message');

      if (completeMessageElement) {
        completeMessageElement.innerHTML = completeMessage;
        this.setAttribute('complete-message', completeMessage);
      }
      
      this.endDate = endDate;
      this.endTime = endTime;

      const timerBlock = document.querySelector(`.countdown`);
      const timerBlockCopy = timerBlock.cloneNode(true);

      timerBlock.replaceWith(timerBlockCopy); // trigger rerender of countdown timer block
    })
    .catch(err => { 
      this.hideCountdownTimer();
    });
  }

  async init() {
    if (!this.endDate && this.productHandle) {
      await this.fetchEndDateTimeAndMessage();
    }

    this.deadlineTimestamp = new Date(`${this.endDate}T${this.endTime}`).getTime();

    const isDateValid = /^\d{4}-\d{2}-\d{2}$/.test(this.endDate) && this.doesDateExist(this.endDate);
    const isTimeValid = /^\d{2}:\d{2}$/.test(this.endTime);
    const remainingTime = this.getRemainingTime(this.deadlineTimestamp);

    if (!isDateValid || !isTimeValid || !this.deadlineTimestamp || remainingTime.days > 99) {     
      if (Shopify.designMode) {
        this.classList.add('countdown--visible');
      } else {
        this.hideCountdownTimer();
      }

      return;
    }
    
    this.countdownTimer = this.querySelector('#countdownTimer');
    this.countdownCompleteMessage = this.querySelector('#countdownCompleteMessage');
    this.daysTens = this.querySelector('#countdownDaysTens');
    this.daysOnes = this.querySelector('#countdownDaysOnes');
    this.hoursTens = this.querySelector('#countdownHoursTens');
    this.hoursOnes = this.querySelector('#countdownHoursOnes');
    this.minutesTens = this.querySelector('#countdownMinutesTens');
    this.minutesOnes = this.querySelector('#countdownMinutesOnes');
    this.secondsTens = this.querySelector('#countdownSecondsTens');
    this.secondsOnes = this.querySelector('#countdownSecondsOnes');
    
    if (remainingTime.total > 0) {
      this.updateTimer();

      this.updateTimerIntervalId = setInterval(this.updateTimer.bind(this), 1000);
    } else if (this.productHandle) {
      this.onTimerExpire()
    } else if (this.expirationAction === 'hide_timer' || (this.expirationAction === 'show_message' && !this.countdownCompleteMessage)) {
      this.hideCountdownParent();
    }    

    this.classList.add('countdown--visible');   
  }

  disconnectedCallback() {
    clearInterval(this.updateTimerIntervalId);
  }

  updateTimer() {
    const padWithZero = (num) => num.toString().padStart(2, '0');

    const remainingTime = this.getRemainingTime(this.deadlineTimestamp);
    const [days, hours, minutes, seconds] = [
      padWithZero(remainingTime.days),
      padWithZero(remainingTime.hours),
      padWithZero(remainingTime.minutes),
      padWithZero(remainingTime.seconds)
    ];
  
    const timerPartsMap = [
      { tens: this.daysTens, ones: this.daysOnes, value: days },
      { tens: this.hoursTens, ones: this.hoursOnes, value: hours },
      { tens: this.minutesTens, ones: this.minutesOnes, value: minutes },
      { tens: this.secondsTens, ones: this.secondsOnes, value: seconds }
    ];
  
    timerPartsMap.forEach(({ tens, ones, value }) => {
      this.animateNumberChange(tens, value[0]);
      this.animateNumberChange(ones, value[1]);
    });

    if (remainingTime.total <= 0) {
      setTimeout(() => this.onTimerExpire(), this.animationDuration);
    }
  }
  
  animateNumberChange(wrapper, newValue) {
    const currentNumber = wrapper.querySelector('.countdown__number--current');

    if (!this.enableAnimation) {
      currentNumber.innerText = newValue; 

      return;
    }

    const previousNumber = wrapper.querySelector('.countdown__number--previous');
  
    if (currentNumber.innerText !== newValue) {
      previousNumber.innerText = currentNumber.innerText; 
      currentNumber.innerText = newValue; 
  
      previousNumber.classList.add('countdown__number--animated');
      currentNumber.classList.add('countdown__number--animated');
  
      setTimeout(() => {
        previousNumber.classList.remove('countdown__number--animated');
        currentNumber.classList.remove('countdown__number--animated');
      }, this.animationDuration); 
    }
  }

  hideCountdownParent() {
    const sectionElement = document.getElementById('shopify-section-' + this.sectionId);
  
    if (!sectionElement) return;

    if (this.sectionBlocksCount === "1") {
      const sectionToRemovalTargetMap = {
        'rich-text': '.rich-text',
        'image-banner': '.banner__content',
        'section-newsletter': '.banner__content',
        'video-banner': '.banner__content',
        'media-with-text': '.ordinal-section:has(.media-with-text__media .placeholder-svg)',
      };

      for (const [sectionClass, removalTargetClass] of Object.entries(sectionToRemovalTargetMap)) {
        if (sectionElement.classList.contains(sectionClass)) {
          const targetElement = sectionElement.querySelector(removalTargetClass);

          targetElement?.remove();
        }
      }
    }
  
    const sectionToRemovalTargetMap = {
      'announcement-bar-section': '.slideshow__slide',
      'slideshow-section': '.slideshow__content',
    };
    
    for (const [sectionClass, removalTargetClass] of Object.entries(sectionToRemovalTargetMap)) {
      if (sectionElement.classList.contains(sectionClass)) {
        const targetElement = this.closest(removalTargetClass);

        if (targetElement && targetElement.children.length === 1) {
          targetElement.remove();
        }
      }
    };
  }  

  hideCountdownTimer() {
    this.hideCountdownParent();

    setTimeout(() => { this.remove() })
  }

  onTimerExpire() {
    switch (this.expirationAction) {
      case "hide_timer":
        this.hideCountdownTimer();

        break;
      case "show_message":
        if (!this.countdownCompleteMessage) {
          this.hideCountdownTimer();

          break;
        } 
          
        const timer = this.querySelector('.countdown__timer');

        timer.remove();
        this.countdownCompleteMessage.removeAttribute('hidden');   
      
        break;
      case "show_zeros_and_message":
        if (this.countdownCompleteMessage) {
          this.countdownCompleteMessage.removeAttribute('hidden');
        }
        
        break;
    }

    clearInterval(this.updateTimerIntervalId);
  }

  getRemainingTime(deadline) {
    const total = deadline - this.getTimestampInStoreTimezone();
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return {
      total,
      days,
      hours,
      minutes,
      seconds
    };
  }

  getTimestampInStoreTimezone() {
    const match = this.timezoneOffset.match(/([+-]?)(\d{2})(\d{2})/);
  
    if (!match) {
      console.error("Invalid timezone format:", this.timezoneOffset);
      return;
    }
  
    const now = new Date();
    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3], 10);
    const offsetMilliseconds = sign * ((hours * 60 + minutes) * 60000);
    const utcTimestamp = now.getTime() + now.getTimezoneOffset() * 60000; 
  
    return utcTimestamp + offsetMilliseconds;
  }

  doesDateExist(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day;
  }
}

customElements.define('countdown-timer', CountdownTimer);

class AccordionBlock extends HTMLElement {
  constructor() {
    super();
    this.item = this.querySelector('.accordion-toggle')
    this.panel = this.querySelector('.accordion__panel')
    this.links = this.panel.querySelectorAll('a')
    this.textareas = this.panel.querySelectorAll('textarea')
    this.inputs = this.panel.querySelectorAll('input')
    this.selects = this.panel.querySelectorAll('select')
    this.buttons = this.panel.querySelectorAll('button')
    this.panelHeight
    this.item.addEventListener('mousedown', () => this.item.closest('body').classList.add('no-user-select'))
    this.item.addEventListener('mouseup', () => this.item.closest('body').classList.remove('no-user-select'))
    if (!this.item.classList.contains('is-open')) this.blurElements()
    if(this.closest('.snippet-facets--horizontal')) {
      document.addEventListener('click', (event) => {
        if (!event.target.closest('.accordion-toggle') && this.item.classList.contains('is-open')) this.item.classList.remove('is-open')
      })
    }

    if (this.item.classList.contains('js-filter')) {
      document.addEventListener('filters:rerendered', ()=> {
        if(this.closest('.snippet-facets--horizontal')) return
        let filters = this.querySelectorAll('.accordion-toggle')
        filters.forEach((filter) => {
          this.panel = filter.querySelector('.accordion__panel')
          this.panel.style.transitionDuration = '0s'
          !filter.classList.contains('is-open') ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panel.scrollHeight + "px"
          setTimeout(() => {this.panel.style.transitionDuration = '0.3s'}, 100)
        })
      })

      this.item.addEventListener('click', (event) => {
        this.panel = this.querySelector('.accordion__panel')
        if(this.closest('.snippet-facets--horizontal')) {
          let facets = this.closest('.snippet-facets--horizontal')
          facets.querySelectorAll('.accordion-toggle').forEach(item => {
            if(item.classList.contains('is-open') && event.target.closest('.accordion-toggle') != item) item.classList.remove('is-open')
          })
        }
        if (!event.target.closest('.mobile-facets__summary')) return
        this.item.classList.toggle('is-open')
        if(this.closest('.snippet-facets--horizontal')) return
        this.panelHeight = this.panel.scrollHeight + "px"
        
        this.panel.style.setProperty('--max-height', `${this.panelHeight}`)
        !this.item.classList.contains('is-open') ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panelHeight
        this.item.classList.contains('is-open') ? this.focusElements() : this.blurElements()
      })

      this.item.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          this.panel = this.querySelector('.accordion__panel')
          if(this.closest('.snippet-facets--horizontal')) {
            let facets = this.closest('.snippet-facets--horizontal')
            facets.querySelectorAll('.accordion-toggle').forEach(item => {
              if(item.classList.contains('is-open') && event.target.closest('.accordion-toggle') != item) item.classList.remove('is-open')
            })
          }
          if (event.target.closest('.accordion__panel')) return
          this.item.classList.toggle('is-open')
          if(this.closest('.snippet-facets--horizontal')) return
          this.panelHeight = this.panel.scrollHeight + "px"
          this.panel.style.setProperty('--max-height', `${this.panelHeight}`)
          !this.item.classList.contains('is-open') ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panelHeight
        }
        if (event.code.toUpperCase() === 'ESCAPE') {
          this.item.classList.remove('is-open')
          this.panel.style.maxHeight = null
        }
        this.item.classList.contains('is-open') ? this.focusElements() : this.blurElements()
      })
    } 
    else {
      this.item.querySelector('.accordion__summary > input[type="checkbox"]') ? this.accordionButton = this.item.querySelector('.accordion__summary > input[type="checkbox"]') : this.accordionButton = this.item.querySelector('.accordion__summary')
      if(this.item.className.includes('not_collapsible')) return

      if(this.item.className.includes('open_collapsible')) {
        this.panel.style.maxHeight = this.panel.scrollHeight + "px"
      }

      this.accordionButton.addEventListener('click', (event) => {
        if (this.closest('.store-accordion') && !event.target.closest('.icon-accordion')) {
          return;
        }
    
        !this.item.className.includes('is-open') ? this.item.classList.add('is-open') : this.item.classList.remove('is-open')
        this.panel.style.maxHeight ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panel.scrollHeight + "px"
        this.item.classList.contains('is-open') ? this.focusElements() : this.blurElements()
      })

      this.accordionButton.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          if (this.closest('.store-accordion') && !event.target.closest('.icon-accordion')) {
            return;
          }
      
          !this.item.className.includes('is-open') ? this.item.classList.add('is-open') : this.item.classList.remove('is-open')
          this.panel.style.maxHeight ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panel.scrollHeight + "px"
        }
        if (event.code.toUpperCase() === 'ESCAPE') {
          if (this.closest('.store-accordion') && !event.target.closest('.icon-accordion')) {
            return;
          }
      
          this.item.classList.remove('is-open')
          this.panel.style.maxHeight = null
        }
        this.item.classList.contains('is-open') ? this.focusElements() : this.blurElements()
      })
    }

    this.querySelectorAll('.store-accordion__toggle-area').forEach(toggle => {
      toggle.addEventListener('click', (event) => {
        const checkbox = toggle.querySelector('.store-accordion__checkbox');

        if (event.target === checkbox) return;

        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }

  blurElements() {
    this.links.forEach(link => link.setAttribute('tabindex', '-1'))
    this.textareas.forEach(textarea => textarea.setAttribute('tabindex', '-1'))
    this.inputs.forEach(input => input.setAttribute('tabindex', '-1'))
    this.selects.forEach(select => select.setAttribute('tabindex', '-1'))
    this.buttons.forEach(button => button.setAttribute('tabindex', '-1'))
  }
  focusElements() {
    this.links.forEach(link => link.setAttribute('tabindex', '0'))
    this.inputs.forEach(input => input.setAttribute('tabindex', '0'))
    this.selects.forEach(select => select.setAttribute('tabindex', '0'))
    this.buttons.forEach(button => button.setAttribute('tabindex', '0'))
  }
}
customElements.define('accordion-block', AccordionBlock);

class ProductRecommendations extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);

      fetch(this.dataset.url)
        .then(response => response.text())
        .then(text => {
          const html = document.createElement('div');
          html.innerHTML = text;
          const recommendations = html.querySelector('product-recommendations');

          if (recommendations && recommendations.innerHTML.trim().length) {
            this.innerHTML = recommendations.innerHTML;
            document.dispatchEvent(new CustomEvent('product-recommendations:load'));
          }

          if (!this.querySelector('slideshow-component') && this.classList.contains('complementary-products')) {
            this.remove();
          }

          this.classList.add('product-recommendations--loaded');
        })
        .catch(e => {
          console.error(e);
        });
    }

    new IntersectionObserver(handleIntersection.bind(this), {rootMargin: '0px 0px 400px 0px'}).observe(this);
  }
}
customElements.define('product-recommendations', ProductRecommendations);

class ComplementaryProducts extends HTMLElement {
  constructor() {
    super();
    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.prevButton = this.querySelectorAll('button[name="previous"]');
    this.nextButton = this.querySelectorAll('button[name="next"]');

    if (this.prevButton || this.nextButton) {
      this.prevButton.forEach(button => button.addEventListener('click', this.onButtonClick.bind(this, 'previous')));
      this.nextButton.forEach(button => button.addEventListener('click', this.onButtonClick.bind(this, 'next')));
      this.disableButtons()
    }  
  }
  disableButtons() {
    if (!this.prevButton || !this.nextButton) return
    this.activeSlide = this.querySelector('.is-active')
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
    let nextActiveSlide = 1
    activeSlideIndex > this.sliderItems.length - 1 - nextActiveSlide ? this.nextButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.nextButton.forEach(button => button.removeAttribute('disabled'))
    activeSlideIndex == 0 ? this.prevButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.prevButton.forEach(button => button.removeAttribute('disabled'))
  }

  onButtonClick(direction) {
      this.activeSlide = this.slider.querySelector('.is-active')
      let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
      let dataCount = 1
      let nextActiveSlide
      nextActiveSlide = dataCount
      if (direction == 'next') {
        let sliderItemsLength = this.sliderItems.length - 1
        activeSlideIndex + nextActiveSlide > sliderItemsLength ? activeSlideIndex = this.sliderItems.length - nextActiveSlide : activeSlideIndex = activeSlideIndex + nextActiveSlide
        this.activeSlide.classList.remove('is-active')
        if(this.sliderItems[activeSlideIndex]) this.sliderItems[activeSlideIndex].classList.add('is-active')
      }
      if (direction == 'previous') {   
        activeSlideIndex - nextActiveSlide < 0 ? activeSlideIndex = 0 : activeSlideIndex = activeSlideIndex - nextActiveSlide
        if(this.activeSlide) this.activeSlide.classList.remove('is-active')  
        this.sliderItems[activeSlideIndex].classList.add('is-active')
      }
      this.disableButtons()
  }
}
customElements.define('complementary-products', ComplementaryProducts);

class ProductRecentlyViewed extends HTMLElement {
  constructor() {
    super();
    
    // Save the product ID in local storage to be eventually used for recently viewed section
    if (isStorageSupported('local')) {
      const productId = parseInt(this.dataset.productId);
      const cookieName = 'avante-theme:recently-viewed';
      const items = JSON.parse(window.localStorage.getItem(cookieName) || '[]');

      // Check if the current product already exists, and if it does not, add it at the start
      if (!items.includes(productId)) {
        items.unshift(productId);
      }

      // By keeping only the 10 most recent
      window.localStorage.setItem(cookieName, JSON.stringify(items.slice(0, 10)));
    }
  }
}
customElements.define('product-recently-viewed', ProductRecentlyViewed);

class RecentlyViewedProducts extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    fetch(this.dataset.url + this.getQueryString())
      .then(response => response.text())
      .then(text => {
        const html = document.createElement('div');
        html.innerHTML = text;
        const recommendations = html.querySelector('recently-viewed-products');
        if (recommendations && recommendations.innerHTML.trim().length) {
          this.innerHTML = recommendations.innerHTML;
        }
      })
      .catch(e => {
        console.error(e);
      });
  }

  getQueryString() {
    const cookieName = 'avante-theme:recently-viewed';
    let items = JSON.parse(window.localStorage.getItem(cookieName) || "[]");
    items = items.filter(item => item != null)
    if (this.dataset.productId && items.includes(parseInt(this.dataset.productId))) {
      items.splice(items.indexOf(parseInt(this.dataset.productId)), 1);
    }
    return items.map((item) => "id:" + item).slice(0, 10).join(" OR ");
  }
}
customElements.define('recently-viewed-products', RecentlyViewedProducts);

class VideoSection extends HTMLElement {
  constructor() {
    super();

    this.background = this.dataset.initMode !== 'template';
    this.popup = this.closest('modal-dialog') 
    if(this.popup) {
      this.buttonClose = this.popup.querySelector('.close-popup')
      this.overlay = document.querySelector('body > .overlay')
      this.openPopup = this.popup.querySelector('.open-popup')
      this.bannersWrapper = this.openPopup.closest('.banner__wrapper')
      this.videoButton = this.openPopup.closest('.video-button-block')
      this.buttonClose.addEventListener('click', () => { 
        if(this.player && this.dataset.type == 'youtube') {
          this.player.pauseVideo()
        } else if (this.player) {
          this.player.pause()
        }
        this.hiddenVideoPopup()
      })
      this.buttonClose.addEventListener('keydown', (event) => { 
        if (event.code.toUpperCase() === 'ENTER') {
          if(this.player && this.dataset.type == 'youtube') {
            this.player.pauseVideo()
          } else if (this.player) {
            this.player.pause()
          }
          this.hiddenVideoPopup()
        }
      })
      this.overlay.addEventListener('click', () => {
        if(this.player && this.dataset.type == 'youtube') {
          this.player.pauseVideo()
        } else if (this.player) {
          this.player.pause()
        }
        this.hiddenVideoPopup()
      })
      this.openPopup.addEventListener('click', () => {
        this.visuallyVideoPopup()
        if(this.player && this.dataset.type == 'youtube') {
          this.player.playVideo()
        } else if (this.player) {
          this.player.play()
        }
      })
      this.openPopup.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          this.visuallyVideoPopup()
          if(this.player && this.dataset.type == 'youtube') {
            this.player.playVideo()
          } else if (this.player) {
            this.player.play()
          }
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ESCAPE' && this.player) {
          if(this.player && this.dataset.type == 'youtube') {
            this.player.pauseVideo()
          } else if (this.player) {
            this.player.pause()
          }
          this.hiddenVideoPopup()
        }
      })
    }

    if (this.background) {
      theme.initWhenVisible({
        element: this,
        callback: this.init.bind(this),
        threshold: 600
      });
    }
    else {
      this.init();
    }
  }

  hiddenVideoPopup() {
    if(this.bannersWrapper) {
      this.bannersWrapper.style.zIndex="1"
      if(!this.bannersWrapper.closest('.overlapping-section')) this.bannersWrapper.style.overflow="hidden"
    }
    if(this.videoButton) this.videoButton.style.zIndex="1"
  }
  visuallyVideoPopup() {
    if(this.bannersWrapper) {
      this.bannersWrapper.style.zIndex="40"
      this.bannersWrapper.style.overflow="visible"
    }
    if(this.videoButton) this.videoButton.style.zIndex="40"
  }

  init() {
    this.parentSelector = this.dataset.parent || '.deferred-media';
    this.parent = this.closest(this.parentSelector);

    switch(this.dataset.type) {
      case 'youtube':
        this.initYoutubeVideo();
        break;

      case 'vimeo':
        this.initVimeoVideo();
        break;

      case 'mp4':
        this.initMp4Video();
        break;
    }
  }

  initYoutubeVideo() {
    window.loadScript('youtube').then(this.setupYoutubePlayer.bind(this));
  }

  initVimeoVideo() {
    window.loadScript('vimeo').then(this.setupVimeoPlayer.bind(this));
  }

  initMp4Video() {
    const player = this.querySelector('video');

    if (player) {
      const promise = player.play();

      // Edge does not return a promise (video still plays)
      if (typeof promise !== 'undefined') {
        promise.then(function() {
          // playback normal
        }).catch(function() {
          player.setAttribute('controls', '');
        });
      }
    }
  }

  setAsLoaded() {
    this.parent.setAttribute('loaded', true);
  }

  setupYoutubePlayer() {
    const videoId = this.dataset.videoId;
    
    const playerInterval = setInterval(() => {
      if (window.YT) {
        window.YT.ready(() => {
          const element = document.createElement('div');
          this.appendChild(element);

          this.player = new YT.Player(element, {
            videoId: videoId,
            playerVars: {
              showinfo: 0,
              controls: !this.background,
              fs: !this.background,
              rel: 0,
              height: '100%',
              width: '100%',
              iv_load_policy: 3,
              html5: 1,
              loop: 1,
              playsinline: 1,
              modestbranding: 1,
              disablekb: 1
            },
            events: {
              onReady: this.onYoutubeReady.bind(this),
              onStateChange: this.onYoutubeStateChange.bind(this)
            }
          });
          clearInterval(playerInterval);
        });
      }
    }, 50);
  }

  onYoutubeReady() {
    this.iframe = this.querySelector('iframe'); // iframe once YT loads
    this.iframe.classList.add('js-youtube')
    this.iframe.setAttribute('tabindex', '-1');

    if(theme.config.isTouch) this.player.mute();
    if (typeof this.player.playVideo === 'function') this.player.playVideo();

    this.setAsLoaded();

    // pause when out of view
    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        entry.isIntersecting ? this.youtubePlay() : this.youtubePause();
      });
    }, {rootMargin: '0px 0px 50px 0px'});

    observer.observe(this.iframe);
  }

  onYoutubeStateChange(event) {
    switch (event.data) {
      case -1: // unstarted
        // Handle low power state on iOS by checking if
        // video is reset to unplayed after attempting to buffer
        if (this.attemptedToPlay) {
          this.setAsLoaded();
        }
        break;
      case 0: // ended, loop it
        this.youtubePlay();
        break;
      case 1: // playing
        this.setAsLoaded();
        break;
      case 3: // buffering
        this.attemptedToPlay = true;
        break;
    }
  }

  youtubePlay() {
    if (this.background && this.player && typeof this.player.playVideo === 'function') {
      this.player.playVideo();
    }
  }

  youtubePause() {
    if (this.background && this.player && typeof this.player.pauseVideo === 'function') {
      this.player.pauseVideo();
    }
  }

  setupVimeoPlayer() {
    const videoId = this.dataset.videoId;

    const playerInterval = setInterval(() => {
      if (window.Vimeo) {
        this.player = new Vimeo.Player(this, {
          id: videoId,
          autoplay: true,
          autopause: false,
          background: this.background,
          controls: !this.background,
          loop: true,
          height: '100%',
          width: '100%'
        });
        this.player.ready().then(this.onVimeoReady.bind(this));

        clearInterval(playerInterval);
      }
    }, 50);
  }

  onVimeoReady() {
    this.iframe = this.querySelector('iframe');
    this.iframe.classList.add('js-vimeo')
    this.iframe.setAttribute('tabindex', '-1');

    if(theme.config.isTouch) this.player.setMuted(true);

    this.setAsLoaded();

    // pause when out of view
    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.vimeoPlay();
        } else {
          this.vimeoPause();
        }
      });
    }, {rootMargin: '0px 0px 50px 0px'});

    observer.observe(this.iframe);
  }

  vimeoPlay() {
    if (this.background && this.player && typeof this.player.play === 'function') {
      this.player.play();
    }
  }

  vimeoPause() {
    if (this.background && this.player && typeof this.player.pause === 'function') {
      this.player.pause();
    }
  }
  
}
customElements.define('video-section', VideoSection);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();

    this.poster = this.querySelector('[id^="Deferred-Poster-"]');
    this.popupVideo = this.querySelector('.popup-video');
    this.swipeVertical = false
    this.swipeHorizontal = false
    this.enableAutoplay = this.dataset.enableAutoplay === "true";
    this.mediaVisibilityWhenScrollByInMs = 300;

    if (this.poster) {
      this.poster.addEventListener('click', (event) => event.preventDefault()); 
      this.poster.addEventListener('mousedown', this.swipeStart.bind(this));     
      this.poster.addEventListener('mousemove', this.swipeAction.bind(this));
      this.poster.addEventListener('mouseup', this.swipeEnd.bind(this));
      this.poster.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') this.swipeEnd();
      });
    }

    if (this.enableAutoplay) {
      this.autoplayMediaWhenFirstVisible();
    }
  }

  getObserverOptions(targetElement) {
    const isMediaTwiceLargerThanScreen = targetElement.offsetHeight / 2 > window.innerHeight;

    const observerOptions = isMediaTwiceLargerThanScreen
    ? { rootMargin: `-${window.innerHeight / 2}px 0px -${window.innerHeight / 2}px 0px` }
    : { threshold: 0.5 };

    return observerOptions;
  }

  autoplayMediaWhenFirstVisible() {
    const mediaWrapper = this.closest('.product__media-item');
 
    if (!mediaWrapper) return;
  
    const observer = new IntersectionObserver((entries, observerInstance) => {
      entries.forEach(entry => {
        const isVisible = entry.isIntersecting;
        const element = entry.target;
  
        if (isVisible) {
          if (!element.intersectTimeout) {
            // Set a timeout to ensure the element remains visible for 500ms before triggering
            element.intersectTimeout = setTimeout(() => {
              if (!element.dataset.intersected) {
                element.dataset.intersected = 'true';
                this.triggerPosterEvents();
                observerInstance.unobserve(mediaWrapper); // Stop observing after the first interaction
              }
            }, 500);
          }
        } else {
          // Clear timeout if the element is no longer visible
          if (element.intersectTimeout) {
            clearTimeout(element.intersectTimeout);
            element.intersectTimeout = null;
          }
        }
      });
    }, this.getObserverOptions(mediaWrapper));
  
    observer.observe(mediaWrapper);
  }
  
  triggerPosterEvents() {
    if (!this.poster) return;
  
    const events = [
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
      new MouseEvent('mousemove', { bubbles: true, cancelable: true }),
      new MouseEvent('click', { bubbles: true, cancelable: true }),
      new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Enter' }),
    ];
  
    events.forEach(event => this.poster.dispatchEvent(event));
  }

  setPauseMediaWhenNotVisible(media, mediaWrapperToObserve) {
    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          media.dataset.visible = true;
        } else if (media.dataset.visible) {          
          window.pauseMedia(media);

          media.dataset.visible = false;
        }
      });
    }, this.getObserverOptions(mediaWrapperToObserve || media));  

    observer.observe(mediaWrapperToObserve || media);
  }

  observeMediaVisibility(media, mediaWrapperToObserve) {
    media.dataset.visible = true;

    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        const element = entry.target;

        if (entry.isIntersecting) {
          if (!element.intersectTimeout) {
            element.intersectTimeout = setTimeout(() => {
              window.playMedia(media, this.enableAutoplay);

              media.dataset.visible = true;
            }, this.mediaVisibilityWhenScrollByInMs); 
          }
        } else {   
          if (element.intersectTimeout) {
            clearTimeout(element.intersectTimeout);
            element.intersectTimeout = null;
          }

          if (media.dataset.visible) {     
            window.pauseMedia(media, this.enableAutoplay);

            media.dataset.visible = false;
          }
        }
      });
    }, this.getObserverOptions(mediaWrapperToObserve || media));  

    observer.observe(mediaWrapperToObserve || media);
  }

  loadContent(focus = true) {
    const isProductOverviewSection = !!this.closest('.product-overview-section');

    if (!isProductOverviewSection) {
      window.pauseAllMedia(); 
    }

    if (this.getAttribute('loaded')) return;
    if (this.querySelector('.template-video')) return;
      
    const content = document.createElement('div');
    content.classList.add('template-video')

    const template = this.querySelector('template');
    const media = template.content.firstElementChild.cloneNode(true)
    content.appendChild(media);

    if (content.querySelector('video-section')) {
      this.popupVideo ? this.popupVideo.appendChild(content).focus() : this.appendChild(content).focus();
    } else {            
      const deferredElement = this.appendChild(content.querySelector('video, model-viewer, iframe'));

      this.setAttribute('loaded', true);

      if (focus) deferredElement.focus();  
    }

    if (isProductOverviewSection && media) {
      const mediaWrapper = template.closest('.product__media-item');

      if (this.enableAutoplay) {
        this.observeMediaVisibility(media, mediaWrapper);
      } else {
        this.setPauseMediaWhenNotVisible(media, mediaWrapper);
      }
    }
    
    window.playMedia(media, this.enableAutoplay);
  }

  getEvent (event) {
    return event.type.search('touch') !== -1 ? event.touches[0] : event;
  }

  swipeStart(event) {
    event.preventDefault()

    let evt = this.getEvent(event);
    this.posInit = this.posX1 = evt.clientX;
    this.posInitY = this.posY1 = evt.clientY
  }

  swipeAction(event) {
    let evt = this.getEvent(event);
    this.posX2 = this.posX1 - evt.clientX;
    this.posX1 = evt.clientX;
    this.posY2 = this.posY1 - evt.clientY;
    this.posY1 = evt.clientY;
  }

  swipeEnd() {
    this.swipeVertical = Math.abs(this.posInitY - this.posY1) > 20
    this.swipeHorizontal = Math.abs(this.posInit - this.posX1) > 20

    if (!this.swipeVertical && !this.swipeHorizontal) {
      this.loadContent();

      let buttonStop = this.querySelector('.stop-video')

      if (!buttonStop) return

      if (this.closest('.product__media-item')) this.closest('.product__media-item').style.overflow = 'visible'
      
      buttonStop.style.display = 'flex'

      buttonStop.addEventListener('click', this.handleStopButtonClick.bind(this))  
    }
  }

  handleStopButtonClick() {
    const media = this.querySelector('iframe');

    media?.remove()

    if (getMediaType(media) === 'YOUTUBE') {
      removeYoutubePlayer(media.id);
    }

    this.removeAttribute('loaded')

    if (this.closest('.product__media-item')) this.closest('.product__media-item').style.overflow = 'hidden'

    let buttonStop = this.querySelector('.stop-video')
    buttonStop.style.display = 'none'
  }
}
customElements.define('deferred-media', DeferredMedia);

class DoubleHover extends HTMLElement {
  constructor() {
    super();
    // Link defocus animation when hovered over a link inside it
    this.cardLink = this.querySelector('.double-hover');
    this.elementsHover = this.querySelectorAll('.elem-hover')
    this.richtext = this.querySelectorAll('.richtext')
    if (this.richtext) {
      this.richtext.forEach(item => {
        if (item.querySelectorAll('a')) {
          item.querySelectorAll('a').forEach(link => {
          link.addEventListener('mouseleave', () => link.closest('.double-hover').classList.remove('no-hover'))
          link.addEventListener('mouseenter', () => link.closest('.double-hover').classList.add('no-hover'))
        })
        }
      })
    } 
    if (this.elementsHover) {
      this.elementsHover.forEach(item => {
        // Return hover effect to parent link if we move mouse away from child link
        item.addEventListener('mouseleave', () => {
          this.cardLink.classList.remove('no-hover');
          if(item.classList.contains('disabled')) this.cardLink.style.cursor = 'pointer'
        })
        // If we hover over the child link, we add class to parent link to cancel hover effect on it
        item.addEventListener('mouseenter', () => {
          this.cardLink.classList.add('no-hover');
          if(item.classList.contains('disabled')) this.cardLink.style.cursor = 'default'
        }) 
        if(item.classList.contains('disabled')) {
          item.addEventListener('click', event => event.preventDefault())
        }
      })
    } 
  }
}
customElements.define('double-hover', DoubleHover);

class MediaTabs extends HTMLElement {
  constructor() {
    super();
    
    this.tabs = this.querySelectorAll('.tab-js')
    this.allMedia = this.closest('.tabs-container-js').querySelectorAll('.tab-media-js')
    this.contents = this.closest('.tabs-container-js').querySelectorAll('.tab-content-js')

    if (this.closest('.tabs-container-js.predictive-search-results')) { 
      if (this.tabs.length > 0) this.tabs[0].classList.add('active')
      if (this.contents.length > 0) this.contents[0].classList.add('active')
    }
    if(this.allMedia.length > 0) {
      this.allMedia.forEach(media => {
        if(media.querySelector('video') && !media.closest('.active')) media.querySelector('video').pause();
      })
    }
    this.contents.forEach(content => {
      if(!content.closest('.active')) content.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'))
    })

    this.addEventListener('click', this.changeActiveTab.bind(this));  
    this.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'ENTER') this.changeActiveTab(event)
    })

    document.addEventListener('shopify:block:select', (event) => {
      let activeTab = event.target
      if(!this.closest('section').querySelector(`#${activeTab.getAttribute('id')}`)) return
      this.tabs.forEach(tab =>  tab.classList.remove('active'))
      if(this.allMedia.length > 0) this.allMedia.forEach(media => this.hiddenContentPrevActiveTab(media))
      if(this.contents.length > 0) this.contents.forEach(content => this.hiddenContentPrevActiveTab(content))
      activeTab.classList.add('active')
      let activeElemID = activeTab.getAttribute('id')
      if(activeTab.closest('.tab-media-js')) activeElemID = activeElemID.split('media-')[1]
      if(this.closest('.media-with-tabs')) document.getElementById(activeElemID).classList.add('active')
      if(this.contents.length == 0) return
      this.contents.forEach(content => this.visibleElementActiveTab(content, activeElemID))
    })
  }

  changeActiveTab(event) {
    let eventTarget
    (event.target) ? eventTarget = event.target : eventTarget = event
    if(eventTarget.closest('.tab-js')) {
      this.tabs.forEach(tab => tab.classList.remove('active'))
      let activeElem = eventTarget.closest('.tab-js')
      activeElem.classList.add('active')
      let activeElemID = activeElem.getAttribute('id')
      if(this.allMedia.length > 0) {
        this.allMedia.forEach(media => this.hiddenContentPrevActiveTab(media))
        this.allMedia.forEach(media => this.visibleElementActiveTab(media, activeElemID))
      }
      if(this.contents.length > 0) {
        this.contents.forEach(content => this.hiddenContentPrevActiveTab(content))
        this.contents.forEach(content => this.visibleElementActiveTab(content, activeElemID))
      }
    }
  }

  hiddenContentPrevActiveTab(element) {
    element.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'))
    element.classList.remove('active');
    // Pause any video
    if(element.querySelector('video') && !element.closest('.active')) element.querySelector('video').pause();
    if(element.querySelector('.js-youtube') && !element.closest('.active')) {
      element.querySelector('.js-youtube').contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
    }
    if(element.querySelector('.js-vimeo') && !element.closest('.active')) {
      element.querySelector('.js-vimeo').contentWindow.postMessage('{"method":"pause"}', '*')
    }
  }

  visibleElementActiveTab(element, activeElemID) {
    let elemID 
    
    if(element.closest('.tab-content-js')) elemID = element.getAttribute('id').split('content-')[1]
    if(element.closest('.tab-media-js')) elemID = element.getAttribute('id').split('media-')[1]
    if(elemID == activeElemID) {
      element.classList.add('active');
      element.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '0'))
    }
    // Play autoplay video if it exists
    if(element.querySelector('video') && !element.closest('.none-autoplay')) element.querySelector('video').play();
  }
}
customElements.define('component-tabs', MediaTabs);

class HoverImageReveal extends HTMLElement {
  constructor() {
      super();

      if (window.innerWidth < 1024 || theme.config.isTouch) return

      this.reveal = this.querySelector('.hover-reveal');
      this.revealInner = this.querySelector('.hover-reveal__inner');
      this.revealInner.style.overflow = 'hidden';
      this.revealImg = this.revealInner.querySelector('.hover-reveal__img');
      this.windowWidth = window.innerWidth;
      this.imageWidth = this.revealInner.offsetWidth;
      this.imageHeight = this.revealInner.offsetHeight * 0.8;
      this.header = document.querySelector('.shopify-section-header .header');
      this.sidebar = document.querySelector('.secondary-sidebar-section')
      this.header ? this.headerHeight = this.header.offsetHeight : this.headerHeight = 0;
      this.sidebar ? this.windowWidth = window.innerWidth - 96 : this.windowWidth = window.innerWidth

      setTimeout(() => this.initEvents(), 1200)

      window.addEventListener('resize', () => {
        this.windowWidth = window.innerWidth
        this.imageWidth = this.revealInner.offsetWidth
        this.imageHeight = this.revealInner.offsetHeight * 0.8
        this.header ? this.headerHeight = this.header.offsetHeight : this.headerHeight = 0;
        this.sidebar ? this.windowWidth = window.innerWidth - 96 : this.windowWidth = window.innerWidth
      })
  }

  getMousePos(e) {
      let posx = 0;
      let posy = 0;
      if (!e) e = window.event;
      if (e.pageX || e.pageY) {
          posx = e.pageX;
          posy = e.pageY;
      }
      else if (e.clientX || e.clientY) {
          posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
          posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
      }
      return { x : posx, y : posy }
  }

  initEvents() {
      this.positionElement = (ev) => {
          // Align the image on hover to be always visible 
          this.windowWidth = window.innerWidth
          this.imageWidth = this.revealInner.offsetWidth
          this.imageHeight = this.revealInner.offsetHeight * 0.8
          this.header ? this.headerHeight = this.header.offsetHeight : this.headerHeight = 0;
          if (this.header) this.header.closest('.disable') ? this.headerHeight = 0 : this.headerHeight = this.header.offsetHeight
          this.sidebar ? this.windowWidth = window.innerWidth - 96 : this.windowWidth = window.innerWidth
          let mousePos = this.getMousePos(ev);
          let docScrolls = {
              left : document.body.scrollLeft + document.documentElement.scrollLeft, 
              top : document.body.scrollTop + document.documentElement.scrollTop
          };
          
          const CURSOR_OFFSET_Y = 20;
          let horizontalPosition = mousePos.x + CURSOR_OFFSET_Y
          let verticalPosition = mousePos.y + CURSOR_OFFSET_Y - docScrolls.top

          if (horizontalPosition + this.imageWidth + 16 > this.windowWidth) {
              horizontalPosition = this.windowWidth - this.imageWidth - 16
          } 

          if (this.closest('.section-scrolling-promotion')) {
            const triggerRect = this.getBoundingClientRect();
            const cursorToImageY = triggerRect.height - CURSOR_OFFSET_Y;
            const imageOverflowPixels = (verticalPosition + this.revealInner.offsetHeight + cursorToImageY) - window.innerHeight;

            if (imageOverflowPixels > 0) {
              verticalPosition = verticalPosition - imageOverflowPixels;
            }

            this.reveal.style.left = `${horizontalPosition - triggerRect.left - docScrolls.left}px`;
            this.reveal.style.top = `${verticalPosition - triggerRect.top + cursorToImageY}px`;

            return;
          } 

          if (this.headerHeight + 16 + this.imageHeight > verticalPosition) {
            verticalPosition = this.headerHeight + 16 + this.imageHeight
          }

          this.reveal.style.left = `${horizontalPosition - docScrolls.left}px`;
          this.reveal.style.top = `${verticalPosition}px`;
      };
      this.mouseenterFn = (ev) => {
          this.positionElement(ev);
          if(TweenMax) this.showImage();
      };
      this.mousemoveFn = ev => requestAnimationFrame(() => {
          this.positionElement(ev);
      });
      this.mouseleaveFn = () => {
        if(TweenMax) this.hideImage();
      };
      
      this.addEventListener('mouseenter', this.mouseenterFn);
      this.addEventListener('mousemove', this.mousemoveFn);
      this.addEventListener('mouseleave', this.mouseleaveFn);
  }

  showImage(event) {
      TweenMax.killTweensOf(this.revealInner);
      TweenMax.killTweensOf(this.revealImg);

      const startAtYCoord = this.closest('.section-scrolling-promotion') ? '0%' : '50%';
      const yCoord = this.closest('.section-scrolling-promotion') ? '0%' : '-80%';

      this.tl = new TimelineMax({
          onStart: () => {
              this.reveal.style.opacity = 1; 
              TweenMax.set(this, {zIndex: 5});
          }
      })
      .delay(0.2)
      .add('begin')
      .add(new TweenMax(this.revealInner, 0.8, {
          ease: Expo.easeOut,
          startAt: {opacity: 0, y: startAtYCoord, rotation: -15, scale: 0},
          y: yCoord,
          rotation: 0,
          opacity: 1,
          scale: 1
      }), 'begin')
      .add(new TweenMax(this.revealImg, 0.8, {
          ease: Expo.easeOut,
          startAt: {rotation: 15, scale: 2},
          rotation: 0,
          scale: 1
      }), 'begin');
       
  }
  hideImage() {
      TweenMax.killTweensOf(this.revealInner);
      TweenMax.killTweensOf(this.revealImg);

      this.tl = new TimelineMax({
          onStart: () => {
              TweenMax.set(this, {zIndex: 4});
          },
          onComplete: () => {
              TweenMax.set(this, {zIndex: ''});
              TweenMax.set(this.reveal, {opacity: 0});
          }
      })
      .add('begin')
      .add(new TweenMax(this.revealInner, 0.15, {
          ease: Sine.easeOut,
          y: '-40%',
          rotation: 10,
          scale: 0.9,
          opacity: 0
      }), 'begin')
      .add(new TweenMax(this.revealImg, 0.15, {
          ease: Sine.easeOut,
          rotation: -10,
          scale: 1.5
      }), 'begin')
  }

}
customElements.define('link-hover-image', HoverImageReveal);

class SwatchesWrapper extends HTMLElement {
  constructor() {
    super();

    this.productCard = this.closest('.card')

    this.addEventListener('mouseleave', () => {
      this.productCard.classList.remove('no-hover')
    })
    this.addEventListener('mouseenter', (event) => {
      this.productCard.classList.add('no-hover')
    }) 
  }
}
customElements.define('swatches-wrapper', SwatchesWrapper);

class ProductCardImage extends HTMLElement {
  constructor() {
    super();

    this.showSecondMedia = this.getAttribute('show-second-media') === 'true';
  }

  connectedCallback() {
    this.init()
  }

  disconnectedCallback() {
    if (this.card) {
      this.card.removeEventListener('mouseenter', this.handleCardMouseEnterBound);
      this.card.removeEventListener('mouseleave', this.handleCardMouseLeaveBound);
    }
  }

  init() {
    this.firstMedia = this.querySelector('.card__image:first-child');
    this.secondMedia = this.querySelector('.card__image:nth-child(2)');

    if (this.querySelector('.lazy-image'))  {
      this.firstMedia = this.querySelector('.lazy-image:first-child .card__image');
      this.secondMedia = this.querySelector('.lazy-image:nth-child(2) .card__image');
    }

    this.firstMediaType = getMediaType(this.firstMedia);
    this.secondMediaType = getMediaType(this.secondMedia);

    this.card = this.closest('.card');
    this.swatches = this.card.querySelector('swatches-wrapper');

    const bothMediaAreImages = this.firstMediaType === 'IMAGE' && this.secondMediaType === 'IMAGE';
    
    if (this.firstMediaType === 'YOUTUBE') {
      window.playYoutubeVideo(this.firstMedia, true);
    }

    if (this.card && this.showSecondMedia && this.secondMedia && !bothMediaAreImages) {
      this.handleCardHover();

      this.card.addEventListener('media-update-by-swatch', () => {
        this.card.removeEventListener('mouseenter', this.handleCardMouseEnterBound);
        this.card.removeEventListener('mouseleave', this.handleCardMouseLeaveBound);

        this.init();
      });
    }
  }

  handleCardMouseEnter() {
    if (!this.card.classList.contains('no-hover')) {
      this.isHovered = true; 

      window.pauseMedia(this.firstMedia);
      window.playMedia(this.secondMedia, true);
    }
  }

  handleCardMouseLeave() {
    if (!this.card.classList.contains('no-hover')) {
      this.isHovered = false; 

      window.pauseMedia(this.secondMedia);
      window.playMedia(this.firstMedia, true);
    }
  }

  handleCardHover() {
    this.isHovered = false;

    this.handleCardMouseEnterBound = this.handleCardMouseEnter.bind(this);
    this.handleCardMouseLeaveBound = this.handleCardMouseLeave.bind(this);

    this.card.addEventListener('mouseenter', this.handleCardMouseEnterBound);
    this.card.addEventListener('mouseleave', this.handleCardMouseLeaveBound);

    // Observe class changes to .no-hover
    const observer = new MutationObserver(() => {
      const hasNoHover = this.card.classList.contains('no-hover');

      if (hasNoHover && this.isHovered) {
        // Trigger mouseleave if .no-hover is added while hovered
        this.isHovered = false; 
        window.pauseMedia(this.secondMedia);
        window.playMedia(this.firstMedia);
      } else if (!hasNoHover && !this.isHovered && this.card.matches(':hover')) {
        // Trigger mouseenter if .no-hover is removed and still hovered
        this.isHovered = true; 
        window.pauseMedia(this.firstMedia);
        window.playMedia(this.secondMedia);
      }
    });

    observer.observe(this.card, { attributes: true, attributeFilter: ['class'] });
  }
}

customElements.define('product-card-image', ProductCardImage);

class ColorSwatch extends HTMLElement {
  constructor() {
    super();

    this.cached = {};
    this.variantId = this.dataset.variantId;
    this.colorsContainer = this.closest('.card__colors')
    this.tooltip = this.querySelector('.color-swatch__title')
    this.quickViewButton = this.closest('.card-container').querySelector('.quick-view')
    this.productCard = this.closest('.card');
    if (!this.productCard) return;

    this.productHref = this.productCard.href;
    this.mediaContainer = this.productCard.querySelector('.card__product-image');
    this.hoverBehavior = this.dataset.hoverBehavior;

    this.firstMedia = this.productCard.querySelector('.card__product-image .card__image')?.cloneNode(true);
    this.secondMedia = this.productCard.querySelector('.card__product-image .card__image--second')?.cloneNode(true);
    this.variantFirstMedia = parseNode(this.dataset.firstMediaNode);
    this.variantSecondMedia = parseNode(this.dataset.secondMediaNode);
    this.priceInCard = this.productCard.querySelector('.price')?.innerHTML;

    this.addEventListener('click', (event) => {
      this.onClickHandler()

      if (event.target.closest('a')) return false
    });

    this.closest('.color-swatch').addEventListener('mouseenter', () => { this.alignSwatches() }) 
    this.closest('.color-swatch').addEventListener('touchstart', () => { this.alignSwatches() }) 

    if (this.classList.contains('active-swatch')) {
      this.activateColorSwatch();
    }
  }

  onClickHandler() {
    if (this.closest('.show-first-image') && this.closest('.active-swatch')) {
      this.resetSwatch();

      return;
    }

    if (this.closest('.active-swatch')) {
      return;
    }

    this.activateColorSwatch();
  }

  activateColorSwatch() {
    if (this.productCard.querySelector('.swiper-product-card')) {
      const firstMediaId = parseNode(this.dataset.firstMediaNode).dataset.id;

      this.productCard.querySelector('.swiper-product-card').dispatchEvent(new CustomEvent('color-swatch:change', {
        detail: {
          colorName: this.dataset.colorName,
          firstMediaId: firstMediaId
        }
      }));
    }
    
    const swatches = this.colorsContainer.querySelectorAll('.color-swatch');

    swatches.forEach((swatch) => {
      swatch.classList.remove('active-swatch');
    });

    this.classList.add('active-swatch');
    this.updateURL();

    if (
      (this.hoverBehavior == 'second_image' || this.hoverBehavior == 'nothing') && 
      this.firstMedia && 
      !this.firstMedia.classList.contains('card__image-placeholder') && 
      this.variantFirstMedia
    ) {
      this.updateMedia(this.variantFirstMedia, this.variantSecondMedia);
    }

    if (this.closest('.show-selected-value')) this.colorSwatchFetch()
  }

  resetSwatch() {
    this.classList.remove('active-swatch');
    this.productCard.href = this.productHref;

    if (this.productCard.querySelector('.swiper-product-card')) {
      this.productCard.querySelector('.swiper-product-card').dispatchEvent(new CustomEvent('color-swatch:change', {
        detail: {
          colorName: 'all'
        }
      }));
    }

    if (this.className.includes('show-selected-value')) this.productCard.querySelector('.price').innerHTML = this.priceInCard

    if (
      (this.hoverBehavior === 'second_image' || this.hoverBehavior === 'nothing') &&
      this.firstMedia &&
      !this.firstMedia.classList.contains('card__image-placeholder')
    ) {
      this.updateMedia(this.firstMedia, this.secondMedia);
    }
  }

  updateMedia(firstMedia, secondMedia) {
    this.deleteAllChildren(this.mediaContainer);
  
    if (firstMedia) {
      this.mediaContainer.appendChild(firstMedia);
      window.playMedia(firstMedia, true);
    }
  
    if (secondMedia && this.productCard.querySelector('.card__product-image--show-second')) {
      this.mediaContainer.appendChild(secondMedia);
    }
  
    this.dispatchMediaUpdateEvent();
  }

  dispatchMediaUpdateEvent() {
    const event = new CustomEvent('media-update-by-swatch', {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  colorSwatchFetch() {
    this.productHandle = this.dataset.productHandle;
    this.productUrl = this.dataset.productUrl.split('/')[2]
    if(this.productUrl && this.productHandle != this.productUrl) this.productHandle = this.productUrl
    const collectionHandle = this.dataset.collectionHandle;
    let sectionUrl = `${window.routes.root_url}/products/${this.productHandle}?variant=${this.variantId}&view=card`;

    if (collectionHandle.length > 0) {
      sectionUrl = `${window.routes.root_url}/collections/${collectionHandle}/products/${this.productHandle}?variant=${this.variantId}&view=card`;
    }

    // remove double `/` in case shop might have /en or language in URL
    sectionUrl = sectionUrl.replace('//', '/');

    if (this.cached[sectionUrl]) {
      this.renderProductInfo(this.cached[sectionUrl]);
      return;
    }

    fetch(sectionUrl)
      .then(response => response.text())
      .then(responseText => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        this.cached[sectionUrl] = html;
        this.renderProductInfo(html);
      })
      .catch(e => {
        console.error(e);
      });
  }

  renderProductInfo(html) {
    this.updatePrice(html);
    this.updateSize(html);
    this.updateBadge(html);
    this.updateTitle(html);
  }

  updatePrice(html) {
    const selector = '.price';
    const destination = this.productCard.querySelector(selector);
    const source = html.querySelector('main').querySelector(selector);

    if (source && destination) destination.innerHTML = source.innerHTML;
  }

  updateSize(html) {
    const selector = '.card__sizes';
    const destination = this.productCard.querySelector(selector);
    const source = html.querySelector('main').querySelector(selector);

    if (source && destination) destination.innerHTML = source.innerHTML;
  }

  updateBadge(html) {
    const selector = '.card__badges';
    const destination = this.productCard.querySelector(selector);
    const source = html.querySelector('main').querySelector(selector);

    if (source && destination) destination.innerHTML = source.innerHTML;
  }

  updateTitle(html) {
    const selector = '.card__title-js';
    const destination = this.productCard.querySelector(selector);
    const source = html.querySelector('main').querySelector(selector);
    const name_characters = destination.closest('.card__title').dataset.nameCharacters

    let source_innerHTML
    if (source) source_innerHTML = source.innerHTML
    if (name_characters && source.innerHTML.trim().length > name_characters) source_innerHTML = source.innerHTML.trim().slice(0, name_characters) + '...'
    if (source && destination) destination.innerHTML = source_innerHTML;
  }

  updateURL() {
    const activeSwatch = this.colorsContainer.querySelector('.active-swatch')
    const activeVariantURL = activeSwatch.querySelector('.color-swatch__link').getAttribute('href')
    this.productCard.setAttribute('href', activeVariantURL)
    if (this.quickViewButton) this.quickViewButton.dataset.productUrl = activeVariantURL
    document.dispatchEvent(new CustomEvent('product_cart:update_url'));
  }

  alignSwatches() {
    this.cardViewport =
      this.tooltip.closest('.slider__viewport') ||
      this.tooltip.closest('.component-tabs__content') ||
      this.tooltip.closest('.shopify-section');

    this.tooltip.removeAttribute('style')

    if (this.cardViewport && this.cardViewport.getBoundingClientRect().left >= this.tooltip.getBoundingClientRect().left) {
      this.tooltip.setAttribute('style', `right: calc(50% - ${(Math.abs(this.tooltip.getBoundingClientRect().left - this.cardViewport.getBoundingClientRect().left))}px);`)
    }
  }

  deleteAllChildren(parent) {
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }
  }
}
customElements.define('color-swatch', ColorSwatch);

class ScrollingPromotion extends HTMLElement {
  constructor() {
    super();

    this.config = {
      moveTime: parseFloat(this.dataset.speed), // 100px going to move for
      space: 100,  // 100px
    };

    this.promotion = this.querySelector('.promotion');

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    if (this.childElementCount === 1) {
      this.promotion.classList.add('promotion--animated');

      for (let index = 0; index < 10; index++) {
        this.clone = this.promotion.cloneNode(true);
        this.clone.setAttribute('aria-hidden', true);
        this.appendChild(this.clone);

        let imageWrapper = this.clone.querySelector('.promotion__item');
        if (imageWrapper) imageWrapper.classList.remove('loading');
      }
      let animationTimeFrame = (this.promotion.clientWidth / this.config.space) * this.config.moveTime;
      this.style.setProperty('--duration', `${animationTimeFrame}s`);

      this.widthPromotion = this.promotion.offsetWidth
      this.widthWrapper = this.offsetWidth
      this.percent = this.widthPromotion * 100 / this.widthWrapper
      // Define a variable to assign a scroll step. Do not use transform property, this may cause the animation (HoverImageReveal) to work incorrectly
      this.style.setProperty('--left-position', `-${this.percent}%`);

      window.addEventListener('resize', () => {
        this.widthPromotion = this.promotion.offsetWidth
        this.widthWrapper = this.offsetWidth
        this.percent = this.widthPromotion * 100 / this.widthWrapper
        this.style.setProperty('--left-position', `-${this.percent}%`);
        let animationTimeFrame = (this.promotion.clientWidth / this.config.space) * this.config.moveTime;
        this.style.setProperty('--duration', `${animationTimeFrame}s`);
      })

      // pause when out of view
      const observer = new IntersectionObserver((entries, _observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.scrollingPlay();
          } else {
            this.scrollingPause();
          }
        });
      }, {rootMargin: '0px 0px 50px 0px'});

      observer.observe(this);
    }
  }

  scrollingPlay() {
    this.classList.remove('scrolling-promotion--paused');
  }

  scrollingPause() {
    this.classList.add('scrolling-promotion--paused');
  }
}
customElements.define('scrolling-promotion', ScrollingPromotion);

class CascadingGrid extends HTMLElement {
  constructor() {
    super();

    this.createGrid();
  }

  createGrid() {
    const isRTL = document.documentElement.dir === 'rtl';
    const containerSelector = this.getAttribute("container-selector");
    const itemSelector = this.getAttribute("item-selector");
    const gridContainer = this.querySelector(containerSelector);

    if (gridContainer) {
      this.masonry = new Masonry(gridContainer, { itemSelector, originLeft: !isRTL });
    }
  }

  connectedCallback() {
    setTimeout(() => this.masonry.layout(), 0);
  }
}

customElements.define('cascading-grid', CascadingGrid);

class ShowMoreButton extends HTMLElement {
  constructor() {
    super();
    const button = this.querySelector('button');
    button.addEventListener('click', (event) => {
      this.expandShowMore(event)
    });
    this.parentPanel = this.closest('.accordion__panel')

    document.addEventListener('filters:rerendered', (event)=> {
      if(this.querySelector('.label-show--more').className.includes('hidden')) this.expandShowMore(button)
    })
  }
  expandShowMore(event) {
    let eventTarget
    event.target ? eventTarget = event.target : eventTarget = event
    const parentDisplay = eventTarget.closest('[id^="Show-More-"]').closest('.js-filter');
    this.querySelectorAll('.label-show').forEach((element) => element.classList.toggle('hidden'));
    parentDisplay.querySelectorAll('.show-more-item').forEach((item) => item.classList.toggle('hidden'));
    this.parentPanel.style.maxHeight = this.parentPanel.scrollHeight + "px"
  }
}

customElements.define('show-more-button', ShowMoreButton);

class InfiniteScroll extends HTMLElement {
  constructor() {
    super();

    this.sectionId = this.closest('section').id.split('shopify-section-')[1]
    if(this.closest('.section-collection-tabs')) {
      this.sectionId = this.closest('.component-tabs__content').id.split('content-')[1]
    }
    this.querySelector('button').addEventListener('click', this.onClickHandler.bind(this));
    if (this.dataset.trigger == 'auto') {
      new IntersectionObserver(this.handleIntersection.bind(this), {rootMargin: '0px 0px 200px 0px'}).observe(this);
    }
  }

  onClickHandler() {
    if (this.classList.contains('loading') || this.classList.contains('disabled')) return;
    this.classList.add('loading');
    this.classList.add('disabled');
    this.querySelector('button').innerHTML = this.querySelector('.loading-overlay__spinner').innerHTML
    const sections = InfiniteScroll.getSections(this.sectionId);
    sections.forEach(() => {
      const url = this.dataset.url;
      InfiniteScroll.renderSectionFromFetch(url, this.sectionId );
    });
  }

  handleIntersection(entries, observer) {
    if (!entries[0].isIntersecting) return;
    observer.unobserve(this);

    this.onClickHandler();
  }

  static getSections(sectionID) {
    return [
      {
        section: document.getElementById(`product-grid--${sectionID}`).dataset.id,
      }
    ]
  }

  static renderSectionFromFetch(url, sectionId) {
    fetch(url)
      .then(response => response.text())
      .then((responseText) => {
        const html = responseText;
        InfiniteScroll.renderPagination(html, sectionId);
        InfiniteScroll.renderProductGridContainer(html, sectionId);
      })
      .catch((e) => {
        console.error(e);
      });
  }

  static renderPagination(html, sectionId) {
    const container = document.getElementById(`ProductGridContainer--${sectionId}`).querySelector('.pagination-wrapper');
    const pagination = new DOMParser().parseFromString(html, 'text/html').getElementById(`ProductGridContainer--${sectionId}`).querySelector('.pagination-wrapper');
    if (pagination) {
      container.innerHTML = pagination.innerHTML;
    }
    else {
      container.remove();
    }
  }

  static renderProductGridContainer(html, sectionId) {
    const container = document.getElementById(`product-grid--${sectionId}`);
    const products = new DOMParser().parseFromString(html, 'text/html').getElementById(`product-grid--${sectionId}`);
    container.insertAdjacentHTML('beforeend', products.innerHTML);
  }
}
customElements.define('infinite-scroll', InfiniteScroll);  

class ImageComparison extends HTMLElement {
  constructor() {
    super();

    this.range = this.querySelector('.image-comparison__range');
    this.isRTL = document.documentElement.dir === 'rtl';

    const updatePosition = (value) => {
      const position = this.isRTL ? 100 - value : value;
      this.style.setProperty('--position', `${position}%`);
    };
    
    this.range.addEventListener('input', (e) => updatePosition(e.target.value));
    this.range.addEventListener('change', (e) => updatePosition(e.target.value));
    
    this.setValue()
    window.addEventListener('resize', this.setValue.bind(this))
  }

  setValue () {
    this.width = this.offsetWidth;
    this.min = Math.max(Math.ceil(8 * 100 / this.width * 10) / 10, 0)
    this.max = 100 - this.min
    this.range.setAttribute('min', this.min)
    this.range.setAttribute('max', this.max)
  }
}
customElements.define('image-comparison', ImageComparison);

class ImageWithHotspots extends HTMLElement {
  constructor() {
    super();
    this.timeout

    this.dots = this.querySelectorAll('.image-with-hotspots__dot');
    this.dropdowns = this.querySelectorAll('.image-with-hotspots__dot ~ .image-with-hotspots__content');
    this.dots.forEach(dot => dot.addEventListener('mouseenter', (event) => {
      if (event.target.closest('.image-with-hotspots__dot')) this.openDropdown(event.target.closest('.image-with-hotspots__dot')) 
    }))

    this.dots.forEach(dot => dot.addEventListener('mousemove', (event) => {
      if (event.target.closest('.image-with-hotspots__dot')) this.openDropdown(event.target.closest('.image-with-hotspots__dot')) 
    }))

    this.dots.forEach(dot => dot.addEventListener('mouseleave', (event) => {
      if (event.relatedTarget && !event.relatedTarget.closest('.image-with-hotspots__content')) this.closeDropdown(dot)
    }))

    this.dropdowns.forEach(dropdown => dropdown.addEventListener('mouseleave', (event) => {
      if (event.relatedTarget != dropdown.previousElementSibling) this.closeDropdown(dropdown.previousElementSibling)
    }))

    this.dropdowns.forEach(dropdown => dropdown.addEventListener('click', (event) => {
      if(event.target.closest('quick-view-button') && event.target.closest('quick-view-button').previousElementSibling.closest('.open')) this.closeDropdown(event.target.closest('quick-view-button').previousElementSibling)
    }))
  }

  openDropdown(item) {
    this.stopAnimation()
    this.alignDropdown(item.nextElementSibling)
    item.classList.add('open', 'active')
    item.classList.remove('closing')
    item.closest('.image-with-hotspots__hotspot').style.zIndex = 6
  }

  closeDropdown(item) {
    item.classList.add('closing')
    this.timeout = setTimeout(() => {
      item.classList.remove('closing')
      item.classList.remove('open')
      item.closest('.image-with-hotspots__hotspot').removeAttribute('style')
      this.content = item.nextElementSibling
      this.contentIcon = this.content.querySelector('.image-with-hotspots__content-icon')
      this.content.removeAttribute('style')
      this.contentIcon.removeAttribute('style')
    }, 300);

    item.classList.remove('active')
  }

  alignDropdown(item) {
    this.itemCoordinate = item.getBoundingClientRect();
    this.contentIcon = item.querySelector('.image-with-hotspots__content-icon')
    this.itemWidth = item.offsetWidth
    this.viewportWidth = window.innerWidth
    this.dotPosition = Math.round(item.closest('.image-with-hotspots__hotspot').getBoundingClientRect().left)
    if(this.itemCoordinate.left < 0) {
      item.style.left = 0 - this.dotPosition + 'px';
      item.style.right = 'auto';
      this.contentIcon.style.left = this.dotPosition + 22 - 8 + 'px';
      this.contentIcon.style.right = 'auto';
    } else if (this.itemCoordinate.right  > this.viewportWidth) {
      item.style.right = 'auto';
      item.style.left = this.viewportWidth - this.dotPosition - this.itemWidth + 'px';
      this.contentIcon.style.left = 'auto';
      this.contentIcon.style.right = this.viewportWidth - this.dotPosition - 22 - 8 + 'px';
    } 
  }

  stopAnimation() {
    clearTimeout(this.timeout)
    this.querySelectorAll('.image-with-hotspots__hotspot').forEach(item => item.removeAttribute('style'))
  }
}
customElements.define('image-with-hotspots', ImageWithHotspots);

class PromoPopup extends HTMLElement {
  constructor() {
    super();

    if (window.location.pathname === '/challenge') return;

    this.cookieName = this.getAttribute('data-section-id');

    this.classes = {
      bodyClass: 'hidden',
      openClass: 'open',
      closingClass: 'is-closing',
      showImage: 'show-image'
    };

    this.originalSection = this.closest('section');
    this.popup = this.querySelector('.popup-wrapper');
    this.popupPlaceholder = document.createComment('popup-placeholder');
    this.stickyTab = this.querySelector('.promo-sticky-tab');
    this.openTabButton = this.querySelector('.open-sticky-tab');
    this.closeTabButton = this.querySelector('.close-sticky-tab');
    this.overlay = document.querySelector('body > .overlay');
    if(this.querySelector('.age-verification__overlay')) this.overlay = this.querySelector('.age-verification__overlay')
    this.hasPopupedUp = false;
    this.flyout = false

    if (this.popup.dataset.position == 'right_flyout' || this.popup.dataset.position == 'left_flyout') this.flyout = true

    this.querySelectorAll('[data-popup-toggle]').forEach((button) => {
      button.addEventListener('click', this.onButtonClick.bind(this));
    });

    this.openStickyTab();

    if (!this.getCookie(this.cookieName)) {
      this.init();
    }

    document.addEventListener('keydown', (event) => {
      if (event.code?.toUpperCase() === 'ESCAPE' && this.popup.classList.contains('open')) {
        this.closePopup();
      }
    });
    document.addEventListener('cart-drawer:open', (event) => {this.closePopup(event)})

    if (this.closeTabButton) {
      this.closeTabButton.addEventListener('click', this.closeStickyTab.bind(this));
    }
  }

  connectedCallback() {
    if (Shopify.designMode) {
      this.onShopifySectionLoad = this.onSectionLoad.bind(this);
      this.onShopifySectionSelect = this.onSectionSelect.bind(this);
      this.onShopifySectionDeselect = this.onSectionDeselect.bind(this);
      document.addEventListener('shopify:section:load', this.onShopifySectionLoad);
      document.addEventListener('shopify:section:select', this.onShopifySectionSelect);
      document.addEventListener('shopify:section:deselect', this.onShopifySectionDeselect);
    }
  }

  disconnectedCallback() {
    if (Shopify.designMode) {
      document.removeEventListener('shopify:section:load', this.onShopifySectionLoad);
      document.removeEventListener('shopify:section:select', this.onShopifySectionSelect);
      document.removeEventListener('shopify:section:deselect', this.onShopifySectionDeselect);
      document.body.classList.remove(this.classes.bodyClass);
    }
  }

  onSectionLoad(event) {
    filterShopifyEvent(event, this, () => this.openPopup.bind(this));
  }
  onSectionSelect(event) {
    filterShopifyEvent(event, this, this.openPopup.bind(this));
  }
  onSectionDeselect(event) {
    filterShopifyEvent(event, this, this.closePopup.bind(this));
  }

  init() {
    if (Shopify && Shopify.designMode) return;

    if (this.dataset.delayType === 'timer') {
      const delayValue = Shopify.designMode ? 0 : parseInt(this.dataset.delay);
      setTimeout(() => {
        if (!document.body.classList.contains('hidden')) {
          this.openPopup();
        } else if (!this.getCookie(this.cookieName)) {
          document.addEventListener('body:visible', () => {
            if (!document.body.classList.contains('hidden')) {
              setTimeout(() => this.openPopup(), 1000);
            }
          });
        }
      }, delayValue * 1000);
    } else if (this.dataset.delayType === 'scroll') {
      const delayValue = parseInt(this.dataset.delay.slice(10).slice(0, -1), 10);
      const scrollPercent = delayValue / 100;
      window.addEventListener('load', () => {
        const scrollTarget = (document.body.scrollHeight - window.innerHeight) * scrollPercent;
        document.addEventListener('scroll', () => {
          if (window.scrollY >= scrollTarget && !this.hasPopupedUp) {
            this.openPopup();
          }
        });
      });
    }
  }

  onButtonClick(event) {
    event.preventDefault();
    this.popup.classList.contains(this.classes.openClass) ? this.closePopup(event) : this.openPopup();
  }

  openPopup() {
    const popupId = this.popup.dataset.popupId;

    document.querySelectorAll('.promo-popup[data-popup-id]').forEach((popupEl) => {
      if (
        popupEl.dataset.popupId === popupId &&
        popupEl !== this.popup &&
        document.body.contains(popupEl)
      ) {
        popupEl.remove();
      }
    });
    if (!this.popupPlaceholder.parentNode) {
      this.popup.parentNode.insertBefore(this.popupPlaceholder, this.popup);
    }
    document.body.appendChild(this.popup);

    document.body.classList.remove(this.classes.bodyClass);
    this.popup.classList.add(this.classes.openClass);
    if (!this.flyout && this.overlay && !this.overlay.classList.contains(this.classes.openClass)) {
      this.overlay.classList.add(this.classes.openClass);
    }

    if (this.popup.dataset.position === 'popup') {
      document.body.classList.add(this.classes.bodyClass);
    }

    if (this.stickyTab) this.closeStickyTab();
    this.hasPopupedUp = true;
  }

  closePopup(event) {
    this.popup.classList.add(this.classes.closingClass);

    setTimeout(() => {
      this.popup.classList.remove(this.classes.openClass);
      if (this.overlay && event.type != 'cart-drawer:open') this.overlay.classList.remove(this.classes.openClass);
      this.popup.classList.remove(this.classes.closingClass);
      this.popup.classList.remove(this.classes.showImage);
      this.openStickyTab();

      // Restore popup to original location
      if (this.popupPlaceholder && this.popupPlaceholder.parentNode) {
        this.popupPlaceholder.parentNode.insertBefore(this.popup, this.popupPlaceholder);
        this.popupPlaceholder.remove();
      }

      document.querySelectorAll('promo-popup').forEach(item => {
        if (item.closest('section').getAttribute('style')) item.closest('section').removeAttribute('style');
      });

      if (this.popup.dataset.position === 'popup' && event.type != 'cart-drawer:open') {
        document.body.classList.remove(this.classes.bodyClass);
      }

      if (this.querySelector('.age-verification')) {
        document.dispatchEvent(new CustomEvent('body:visible'));
      }
    });

    if (Shopify.designMode) {
      this.removeCookie(this.cookieName);
      return;
    }

    this.setCookie(this.cookieName, this.dataset.frequency);
  }

  openStickyTab() {
    if (!this.stickyTab) return;
    document.addEventListener('searchmodal:open', () => {
      this.closest('section').style.zIndex = '9';
    });
    this.stickyTab.classList.add(this.classes.openClass);
  }

  closeStickyTab() {
    if (!this.stickyTab) return;
    this.stickyTab.classList.remove(this.classes.openClass);
  }

  getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match[2] : null;
  }

  setCookie(name, frequency) {
    document.cookie = `${name}=true; max-age=${(frequency * 60 * 60)}; path=/`;
  }

  removeCookie(name) {
    document.cookie = `${name}=; max-age=0`;
  }
}
customElements.define('promo-popup', PromoPopup);

class AnimateSticky extends HTMLElement {
  constructor() {
    super();
    this.buttons = this.closest('section').querySelector('.product-form__buttons')
  }

  connectedCallback() {
    this.onScrollHandler = this.onScroll.bind(this);

    window.addEventListener('scroll', this.onScrollHandler, false);
    this.onScrollHandler();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScrollHandler);
  }

  onScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > this.getOffsetTop(this.buttons)) {
      window.requestAnimationFrame(this.reveal.bind(this));
    } else {
      window.requestAnimationFrame(this.reset.bind(this));
    }  
    if (document.documentElement.scrollTop + document.documentElement.clientHeight == document.documentElement.scrollHeight) {
      window.requestAnimationFrame(this.reset.bind(this));
    }
  }

  reveal() {
    this.setAttribute('animate', '');
  }

  reset() {
    this.removeAttribute('animate');
  }

  getOffsetTop(element) {
    let offsetTop = 0;
    while(element) {
      offsetTop += element.offsetTop;
      element = element.offsetParent;
    }
    return offsetTop;
  }
}
customElements.define('animate-sticky', AnimateSticky);

class DrawerMenu extends HTMLElement {
  constructor() {
    super();

    this.summaryElement = this.firstElementChild
    this.contentElement = this.summaryElement.nextElementSibling
    this.summaryElement.addEventListener('click', this.onSummaryClicked.bind(this))
    if (this.contentElement) this.button = this.contentElement.querySelector('button')
    if (this.button) this.button.addEventListener('click', () => {
      this.isOpen = JSON.parse(this.getAttribute('open'))
      if (this.isOpen) {
        this.button.closest('.nested-submenu').previousElementSibling.setAttribute('open', 'false')
        this.button.closest('.nested-submenu').previousElementSibling.classList.add('closing') 
        this.updateTabIndex(this.contentElement, false)
        setTimeout(() => {
          this.button.closest('.nested-submenu').previousElementSibling.classList.remove('closing')
        }, 400)
      }
    })

    document.addEventListener('body:visible', () => {
      if (!document.querySelector('#shopify-section-menu-drawer .menu-drawer.open') || !document.querySelector('#shopify-section-mega-menu-drawer .menu-drawer.open')) {
        document.querySelectorAll('.nested-submenu').forEach(submenu => {
          if (submenu.previousElementSibling.getAttribute('open') == 'true') {
            submenu.previousElementSibling.setAttribute('open', 'false')
            submenu.previousElementSibling.classList.add('closing')
            this.updateTabIndex(submenu, false)
            setTimeout(() => {
              submenu.previousElementSibling.classList.remove('closing')
            }, 500)
          }
        })
      }
    })

    this.detectClickOutsideListener = this.detectClickOutside.bind(this)
    this.detectEscKeyboardListener = this.detectEscKeyboard.bind(this)
    this.detectFocusOutListener = this.detectFocusOut.bind(this)
    this.addEventListener('keydown', this.onKeyDown.bind(this));
  }


  onSummaryClicked(event) {
    if (event && event.target && event.target.closest('a')) return
    this.isOpen = JSON.parse(this.summaryElement.getAttribute('open'))

    if (this.isOpen) {
      this.summaryElement.setAttribute('open', 'false')
      this.setAttribute('open', 'false')
      this.updateTabIndex(this.contentElement, false);
      
    } else {
      this.summaryElement.setAttribute('open', 'true')
      this.setAttribute('open', 'true')
      this.updateTabIndex(this.contentElement, true);
    }
  }

  detectClickOutside(event) {
    if (!this.contains(event.target) && !(event.target.closest('details') instanceof DetailsDropdown)) this.open = false
  }

  detectEscKeyboard(event) {
    if (event.code === 'Escape') {
      const targetMenu = event.target.closest('details[open]')
      if (targetMenu) {
        targetMenu.open = false
      }
    }
  }

  onKeyDown(event) {
    const currentFocus = document.activeElement;


    switch (event.code) {
      case 'Enter':
        if (currentFocus === this.summaryElement) {
          event.preventDefault();
          this.onSummaryClicked();
        }
        break;

      case 'Escape':
        this.updateTabIndex(this.contentElement, false)
        break;
    }
  }

  updateTabIndex(menuElement, isOpen) {
    if (!menuElement) return;

    const directFocusableElements = Array.from(
      menuElement.querySelectorAll(
        ':scope > ul > li > drawer-menu > summary > .menu__item-title > a[href], :scope > ul > li > drawer-menu > summary > .menu__item-title > button:not([disabled]), :scope > .menu-drawer__header button, :scope > ul > li > a[href'
      )
    );

    directFocusableElements.forEach(element => {
      isOpen ? element.setAttribute('tabindex', '0') : element.setAttribute('tabindex', '-1')
    });
  }

  getFocusableElements() {
    if (!menuElement) return 
    return Array.from(
      this.contentElement?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []
    );
  }

  detectFocusOut(event) {
    if (event.relatedTarget && !this.contains(event.relatedTarget)) {
      this.open = false
    }
  }

  detectHover(event) {
    if (this.trigger !== 'hover') return;

    if (event.type === 'mouseenter') {
      this.open = true
    }
    else {
      this.open = false
    }
  }
}
customElements.define('drawer-menu', DrawerMenu)

class BannerHScroll extends HTMLElement {
  constructor() {
    super();

    this.rootSelector = this.getAttribute('root') || '.horizontal-banners';
    this.useVisualViewport = this.getAttribute('use-visual-viewport') !== 'false';
    this.scrollSpeed = parseFloat(this.getAttribute('scroll-speed') || '1');
    this.smooth = Math.max(0, Math.min(0.95, parseFloat(this.getAttribute('smooth') || '0.18')));
    this.forceWheelRedirect = this.getAttribute('force-wheel-redirect') === 'true';

    this.root = this.closest(this.rootSelector)
      || this.parentElement?.closest(this.rootSelector)
      || document.querySelector(this.rootSelector);

    this.wrapper = this.root?.querySelector('.horizontal-banners__wrapper') || null;
    this.track   = this.root?.querySelector('.horizontal-banners__blocks') || null;

    this.enabled = false;
    this.startY = 0;
    this.endY   = 0;
    this.maxX   = 0;
    this.x      = 0;
    this.animX  = 0;
    this.animFrame = null;

    this._touchActive = false;
    this._touchLastX = 0;
    this._touchLastY = 0;
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchIntent = null; // null | 'horizontal' | 'vertical'

    this._vvTick = false;
    this._pollLazyFrames = 0;

    this.isCoarse = typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : 'ontouchstart' in window;

    this.onScrollHandler     = this.onScroll.bind(this);
    this.onResizeHandler     = this.onResize.bind(this);
    this.onVvResizeHandler   = this.onVvResize.bind(this);
    this.onWheelHandler      = this.onWheel.bind(this);
    this.onTouchStartHandler = this.onTouchStart.bind(this);
    this.onTouchMoveHandler  = this.onTouchMove.bind(this);
    this.onTouchEndHandler   = this.onTouchEnd.bind(this);

    this.resizeObserver = new ResizeObserver(() => this.recompute());
  }

  connectedCallback() {
    if (!this.root || !this.wrapper || !this.track) return;

    try {
      this.root.style.overscrollBehavior = this.root.style.overscrollBehavior || 'contain';
      this.track.style.willChange = this.track.style.willChange || 'transform';
      this.track.style.backfaceVisibility = this.track.style.backfaceVisibility || 'hidden';
    } catch (_) {}

    window.addEventListener('scroll', this.onScrollHandler, { passive: true });
    window.addEventListener('resize', this.onResizeHandler, { passive: true });
    if (this.useVisualViewport && window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onVvResizeHandler, { passive: true });
      window.visualViewport.addEventListener('scroll',  this.onVvResizeHandler, { passive: true });
    }

    this.root.addEventListener('touchstart', this.onTouchStartHandler, { passive: true });
    this.root.addEventListener('touchmove',  this.onTouchMoveHandler,  { passive: false });
    this.root.addEventListener('touchend',   this.onTouchEndHandler,   { passive: true  });
    this.root.addEventListener('touchcancel', this.onTouchEndHandler,  { passive: true  });

    if (this.isCoarse || this.forceWheelRedirect) {
      this.root.addEventListener('wheel', this.onWheelHandler, { passive: false });
    }

    this.resizeObserver.observe(this.track);

    this.updateEnabledByWidth();
    this.pollImages();
  }

  disconnectedCallback() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    window.removeEventListener('scroll', this.onScrollHandler);
    window.removeEventListener('resize', this.onResizeHandler);
    if (this.useVisualViewport && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.onVvResizeHandler);
      window.visualViewport.removeEventListener('scroll',  this.onVvResizeHandler);
    }

    if (this.root) {
      this.root.removeEventListener('touchstart', this.onTouchStartHandler);
      this.root.removeEventListener('touchmove',  this.onTouchMoveHandler);
      this.root.removeEventListener('touchend',   this.onTouchEndHandler);
      this.root.removeEventListener('touchcancel', this.onTouchEndHandler);
      this.root.removeEventListener('wheel',      this.onWheelHandler);
    }

    this.resizeObserver.disconnect();
    this.disable();
  }

  updateEnabledByWidth() {
    const mobile = window.innerWidth < 768;
    const hasNativeScrollAttr = this.hasAttribute('data-native-scroll-on-mobile');

    if (mobile && hasNativeScrollAttr) {
      this.disable();
    } else {
      this.enable();
    }
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.root.setAttribute('data-hscroll', 'enabled');

    if (this.track) {
      this.track.style.willChange = 'transform';
      this.track.style.backfaceVisibility = 'hidden';
    }

    this.recompute();
    this.onScroll();
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    this.root.removeAttribute('data-hscroll');
    this.root.style.removeProperty('--pin-height');

    if (this.track) {
      this.track.style.removeProperty('will-change');
      this.track.style.removeProperty('backface-visibility');
      this.track.style.removeProperty('transform');
    }
  }

  getViewportH() {
    if (this.useVisualViewport && window.visualViewport?.height) {
      return Math.round(window.visualViewport.height);
    }
    return window.innerHeight;
  }
  getContainerW() {
    return Math.round(this.wrapper.getBoundingClientRect().width);
  }

  pollImages() {
    if (this._pollLazyFrames > 8) return;
    this._pollLazyFrames++;
    this.recompute();
    requestAnimationFrame(() => this.pollImages());
  }

  recompute() {
    if (!this.enabled) {
      this.root.style.setProperty('--pin-height', 'auto');
      if (this.track) this.track.style.transform = '';
      return;
    }

    const viewportW = this.getContainerW();
    const viewportH = this.getViewportH();

    const prev = this.track.style.transform;
    this.track.style.transform = 'translate3d(0,0,0)';

    const trackLeftDoc = this.track.getBoundingClientRect().left + (window.scrollX || window.pageXOffset || 0);
    let lastChild = this.track.lastElementChild;
    while (lastChild && lastChild.offsetParent === null) lastChild = lastChild.previousElementSibling;

    let lastRightDoc;
    if (lastChild) {
      const r = lastChild.getBoundingClientRect();
      lastRightDoc = r.right + (window.scrollX || window.pageXOffset || 0);
    } else {
      lastRightDoc = trackLeftDoc + this.track.scrollWidth;
    }

    const fullContentWidth = Math.max(0, lastRightDoc - trackLeftDoc);
    this.maxX = Math.max(0, Math.ceil(fullContentWidth - viewportW));

    this.track.style.transform = prev;

    if (this.maxX <= 0) {
      this.root.style.setProperty('--pin-height', 'auto');
      this.startY = Number.POSITIVE_INFINITY;
      this.endY   = Number.NEGATIVE_INFINITY;
      this.x = 0;
      this.applyTransform();
      return;
    }

    const pinHeight = viewportH + this.maxX;
    this.root.style.setProperty('--pin-height', `${pinHeight}px`);

    const rootRect = this.root.getBoundingClientRect();
    const docY = window.scrollY || window.pageYOffset || 0;
    this.startY = docY + rootRect.top;
    this.endY   = this.startY + pinHeight - viewportH;

    const y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (y <= this.startY) this.x = 0;
    else if (y >= this.endY) this.x = this.maxX;
    else {
      const progress = (y - this.startY) / (this.endY - this.startY);
      this.x = this.clamp(Math.round(this.maxX * progress), 0, this.maxX);
    }
    this.applyTransform();
  }

  isInsidePin(y) { 
    return y >= this.startY && y <= this.endY; 
  }

  canConsume(delta) {
    if (delta === 0) return false;
    if (delta > 0)  return this.x < this.maxX; 

    return this.x > 0;                      
  }

  onScroll() {
    if (!this.enabled) return;

    const y = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (y <= this.startY) {
      this.x = 0;
    } else if (y >= this.endY) {
      this.x = this.maxX;
    } else {
      const progress = (y - this.startY) / (this.endY - this.startY);
      this.x = this.clamp(Math.round(this.maxX * progress), 0, this.maxX);
    }
    this.applyTransform();
  }

  onResize() {
    this.updateEnabledByWidth();
    if (this.enabled) { 
      this.recompute(); 
      this.onScroll(); 
    }
  }

  onVvResize() {
    if (!this.enabled) return;
    if (this._vvTick) return;
    this._vvTick = true;
    requestAnimationFrame(() => {
      this._vvTick = false;
      this.recompute();
      this.onScroll();
    });
  }

  onWheel(e) {
    if (!this.enabled || this.maxX <= 0) return;

    const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (!this.isInsidePin(pageY)) return;

    const dyPrimary = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    let delta = dyPrimary * this.scrollSpeed;

    if (!this.canConsume(delta)) return; 

    e.preventDefault();
    const before = this.x;
    const target = this.clamp(before + delta, 0, this.maxX);
    this.x = target;
    this.applyTransform();
  }

  onTouchStart(e) {
    if (!this.enabled || this.maxX <= 0 || !e.touches?.length) return;

    const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (!this.isInsidePin(pageY)) return;

    const t = e.touches[0];

    this._touchActive = true;
    this._touchStartX = this._touchLastX = t.clientX;
    this._touchStartY = this._touchLastY = t.clientY;
    this._touchIntent = null; 
  }

  onTouchMove(e) {
    if (!this.enabled || !this._touchActive || !e.touches?.length) return;

    const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (!this.isInsidePin(pageY)) return;

    const t = e.touches[0];
    const dxTotal = t.clientX - this._touchStartX;
    const dyTotal = t.clientY - this._touchStartY;
    const absDx = Math.abs(dxTotal);
    const absDy = Math.abs(dyTotal);

    if (!this._touchIntent) {
      const threshold = 5; 
      if (absDx < threshold && absDy < threshold) {
        return;
      }

      if (absDx > absDy * 1.2) {
        this._touchIntent = 'horizontal';
      } else if (absDy >= absDx) {
        this._touchIntent = 'vertical';
        this._touchActive = false;
        return;
      }
    }

    if (this._touchIntent !== 'horizontal') {
      return;
    }

    const dx = this._touchLastX - t.clientX; 
    this._touchLastX = t.clientX;

    let delta = dx * this.scrollSpeed;

    if (!this.canConsume(delta)) return;

    if (e.cancelable) e.preventDefault();
    const before = this.x;
    const target = this.clamp(before + delta, 0, this.maxX);
    this.x = target;
    this.applyTransform();
  }

  onTouchEnd() {
    this._touchActive = false;
    this._touchIntent = null;
  }

  applyTransform() {
    if (!this.enabled || !this.track) return;
    
    if (this.smooth <= 0) {
      this.track.style.transform = `translate3d(${-this.x}px,0,0)`;
      return;
    }
    if (this.animFrame) cancelAnimationFrame(this.animFrame);

    const tick = () => {
      this.animX += (this.x - this.animX) * this.smooth;
      if (Math.abs(this.x - this.animX) < 0.5) this.animX = this.x;

      this.track.style.transform = `translate3d(${-this.animX}px,0,0)`;

      if (this.animX !== this.x) {
        this.animFrame = requestAnimationFrame(tick);
      } else {
        this.animFrame = null;
      }
    };
    this.animFrame = requestAnimationFrame(tick);
  }

  clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
}

customElements.define('banner-hscroll', BannerHScroll);