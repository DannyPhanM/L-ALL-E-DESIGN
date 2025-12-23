class QuickViewDrawer extends HTMLElement {
    constructor() {
      super();

      this.addEventListener('close', () => {
        const drawerContent = this.querySelector('.quick-view__content');
        drawerContent.innerHTML = '';
        drawerContent.classList.remove('hide-cover');
  
        document.dispatchEvent(new CustomEvent('quickview:close'));
      });
    }
  }
  customElements.define('quick-view-drawer', QuickViewDrawer);
  
  class QuickViewButton extends HTMLElement {
    constructor() {
      super();
  
      this.addEventListener('click', (event) => {
        if (event.target.closest('.card-quick-view') || event.target.closest('.product-slide-caption')) event.preventDefault()
          
        this.closest('body').classList.add('hidden', 'quick-view-open')
        const drawer = document.querySelector('quick-view-drawer');
        if (drawer) {
          drawer.querySelector('quick-view').setAttribute('data-product-url', `${this.dataset.productVariantUrl}`)
          drawer.querySelector('summary').click();
          document.dispatchEvent(new CustomEvent('quickview:open', {
            detail: {
              productUrl: this.dataset.productUrl
            }
          }));
        }
        else if (this.dataset.productUrl) {
          window.location = this.dataset.productUrl;
        }
      });
      this.quickButton = this.querySelector('.quick') || this.closest('.quick')
      if(this.quickButton.closest('.card__extras')) {
        this.quickButton.addEventListener('focus', () => {
          this.quickButton.closest('.card__extras').style.bottom = '8px'
        })
        this.quickButton.addEventListener('blur', () => {
          this.quickButton.closest('.card__extras').style.bottom = '-54px'
        })
        this.quickButton.addEventListener('quickview:open', () => {
          this.quickButton.closest('.card__extras').style.bottom = '-54px'
        })
      }
    }
  }
  customElements.define('quick-view-button', QuickViewButton);
  
  class QuickView extends HTMLElement {
    constructor() {
      super();
      this.overlay = document.querySelector('body > .overlay')
      this.quickModal = this.querySelector('.popup-wrapper')
      this.closeButton = this.querySelector('.button-close')
      this.addEventListener('click', (event) => {
        if (!event.target.closest('.popup-wrapper') || event.target.closest('.button-close')) this.closeQuickView()
      })
      document.addEventListener('keyup', (event) => {
        if (event.code && event.code.toUpperCase() === 'ESCAPE' && this.querySelector('.popup-wrapper.open')) this.closeQuickView()
      })
    }
  
    connectedCallback() {
      new IntersectionObserver(this.handleIntersection.bind(this)).observe(this);
    }
  
    handleIntersection(entries, _observer) {
      if (!entries[0].isIntersecting) return;
      const selector = '.quick-view__content';
      const drawerContent = this.querySelector(selector);
      this.productUrl = this.dataset.productUrl
      this.sectionUrl = `${this.productUrl}&view=quick-view`;
      
      fetch(this.sectionUrl)
        .then(response => response.text())
        .then(responseText => {
          setTimeout(() => {
            const responseHTML = new DOMParser().parseFromString(responseText, 'text/html');
            const productElement = responseHTML.querySelector(selector);
            this.setInnerHTML(drawerContent, productElement.innerHTML);
  
            if (window.Shopify && Shopify.PaymentButton) {
              Shopify.PaymentButton.init();
            }
          }, 1);

          document.body.classList.add('quick-view-load')

          setTimeout(() => {
            drawerContent.classList.add('hide-cover');
  
            document.dispatchEvent(new CustomEvent('quickview:loaded', {
              detail: {
                productUrl: this.dataset.productUrl
              }
            }));
          }, 1);
        })
        .catch(e => {
          console.error(e);
        });
    }
  
    setInnerHTML(element, html) {
      element.innerHTML = html;
  
      // Reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
      element.querySelectorAll('script').forEach(oldScriptTag => {
        const newScriptTag = document.createElement('script');
        Array.from(oldScriptTag.attributes).forEach(attribute => {
          newScriptTag.setAttribute(attribute.name, attribute.value)
        });
        newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
        oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
        this.overlay.classList.add('open')
      });
    }

    closeQuickView() {
      const drawerContent = this.querySelector('.quick-view__content');
      drawerContent.innerHTML = '';
      drawerContent.classList.remove('hide-cover');
      this.closest('body').classList.remove('hidden', 'quick-view-open', 'quick-view-load')
      document.dispatchEvent(new CustomEvent('body:visible'));
      // if(!this.closest('.image-with-hotspots')) {
      //   this.closest('.card-container').querySelector('.card__extras').style.bottom = '-54px'
      //   this.closest('.card-container').querySelector('.quick').classList.remove('active')
      // }
      document.dispatchEvent(new CustomEvent('quickview:close'));
      this.closest('details').removeAttribute('open')
      this.overlay.classList.remove('open')
    }
  }
  customElements.define('quick-view', QuickView);
  