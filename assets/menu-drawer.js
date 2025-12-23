class MenuDrawer extends HTMLElement {
    constructor() {
      super();

      this.elements = {
        sidebarDrawer: this.querySelector('.menu-drawer'),
        overlay:  document.querySelector('body > .overlay'),
        sidebarDrawerButton: this.querySelectorAll('.button-close'),
        focusableElements: Array.from(this.querySelectorAll('summary, a[href], button:enabled, [tabindex="0"], [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe')),
        shopifySection: document.querySelector('#shopify-section-menu-drawer') || document.querySelector('#shopify-section-mega-menu-drawer')
      };
      document.querySelectorAll('.burger-menu').forEach(item => item.addEventListener('click', this.openDrawer.bind(this)));
      document.querySelectorAll('.burger-menu').forEach(item => {
        item.addEventListener('keyup', (event) => {
          if (event.code.toUpperCase() === 'ENTER') {
            this.openDrawer()
            trapFocus(
              event.target.closest('.burger-menu'),
              this.elements.focusableElements[0]
            );
          }
        })
      });
      if (Shopify.designMode) {
        this.elements.shopifySection.addEventListener('shopify:section:select', this.openDrawer.bind(this));
        this.elements.shopifySection.addEventListener('shopify:section:deselect', this.closeDrawer.bind(this));
        this.elements.shopifySection.addEventListener('shopify:section:unload', this.openDrawer.bind(this))
        window.addEventListener('shopify:section:load', () => document.querySelectorAll('.burger-menu').forEach(item => item.addEventListener('click', this.openDrawer.bind(this))))
      }

      this.elements.sidebarDrawerButton.forEach(item => item.addEventListener('click', this.closeDrawer.bind(this)));
        document.addEventListener('keyup', (event) => {
          if (event.code?.toUpperCase() === 'ESCAPE' && this.elements.sidebarDrawer.classList.contains('open')) this.closeDrawer()
        })
      if (this.elements.overlay) this.elements.overlay.addEventListener('click', this.closeDrawer.bind(this));
      window.addEventListener('resize', this.offsetHeight.bind(this))
    }
  
    openDrawer() {
      this.elements.sidebarDrawer.removeAttribute('hidden')
      setTimeout(() => {
        this.elements.sidebarDrawer.classList.add('open')
      }, 100)
      document.body.classList.add('hidden')
      if (document.querySelector('#shopify-section-mega-menu-drawer')) this.elements.overlay.classList.add('open')
      if(document.querySelector('[id$="menu-drawer"] .pinned-block') && document.querySelector('[id$="menu-drawer"] .nested-submenu')) {
        let bottomPadding = document.querySelector('[id$="menu-drawer"] .pinned-block').offsetHeight + 16
        this.elements.sidebarDrawer.setAttribute('style', `--height-pinned-block: ${bottomPadding}px`)
      }
    }

    offsetHeight() {
      if(document.querySelector('[id$="menu-drawer"] .pinned-block') && document.querySelector('[id$="menu-drawer"] .nested-submenu')) {
        let bottomPadding = document.querySelector('[id$="menu-drawer"] .pinned-block').offsetHeight + 16
        this.elements.sidebarDrawer.setAttribute('style', `--height-pinned-block: ${bottomPadding}px`)
      }
    }
  
    closeDrawer() {
      this.elements.sidebarDrawer.setAttribute('hidden', 'true')
      this.elements.sidebarDrawer.classList.remove('open')
      if (document.querySelector('#shopify-section-mega-menu-drawer')) this.elements.overlay.classList.remove('open')
      document.body.classList.remove('hidden')
      document.dispatchEvent(new CustomEvent('body:visible'));
      document.querySelectorAll('.burger-menu').forEach(item => item.blur());
    }
  }
  customElements.define('menu-drawer', MenuDrawer);  