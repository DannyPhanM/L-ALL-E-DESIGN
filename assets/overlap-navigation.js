class OverlapNavigation extends HTMLElement {
    constructor() {
      super();
  
      
      if (Shopify.designMode) {
        ['shopify:section:load', 'shopify:section:reorder', 'shopify:section:unload'].forEach((eventName) => {
          document.addEventListener(eventName, () => this._handleSectionChanges());
        });
      }
      document.addEventListener('collapsible-menu:opened', () => {
        setTimeout(() => {this._handleSectionChanges()}, 350)
      })
    }
  
    connectedCallback() {
      this._handleSectionChanges();
      if (window.innerWidth > 920) {
        document.addEventListener("scroll", () => this._onScroll())
        this.querySelectorAll('.transparent-sidebar').forEach(sidebar => sidebar.addEventListener("scroll", () => {this._onScroll()}))
      } else {
        document.addEventListener("scroll", () => this._onMobileScroll())
      } 
      let lastWidth = window.innerWidth;
      window.addEventListener('resize', () => {
        const currentWidth = window.innerWidth;
        if (currentWidth !== lastWidth) {
          this._handleSectionChanges()
          if (window.innerWidth > 920) {
            document.addEventListener("scroll", () => this._onScroll())
            this.querySelectorAll('.transparent-sidebar').forEach(sidebar => sidebar.addEventListener("scroll", () => {this._onScroll()}))
          } else {
            document.addEventListener("scroll", () => this._onMobileScroll())
          } 
          lastWidth = currentWidth;
        } 
      })
    }

    _handleSectionChanges() {
      this.init();
      this._initInvertedElements();
      this._updateSectionStyles();
      this._updateHeaderStyles();
      this.classList.add('loaded')
    }

    init() {
      this.firstSec = this.querySelector('main .shopify-section:first-child:has(.overlapping-section)');
      this.header = this.querySelector('.transparent-header');
      this.footer = this.querySelector('.shopify-section-footer');
      this.invertedElements = this.querySelectorAll('.scroll-color');
      this.sidebars = this.querySelectorAll('.transparent-sidebar');
      this.announcementBar = this.querySelector('.announcement-bar-section')
      if (this.announcementBar) this.announcementBarHeight = this.announcementBar.offsetHeight
      this.headerGroup = this.querySelector('.header-group')
      this.headerGroupSections = this.headerGroup.querySelectorAll('.shopify-section-group-more-header-sections')
      this.currentScrollPos = 0;
      this.lastScrollPos = 0;
      this.scrollDelta = false;
      if (window.innerWidth < 920) this.header = this.querySelector('.mobile-header-section.transparent-header')
    }
  
    _initInvertedElements() {
      this.invertedElements.forEach((element) => this.invertNavigationColor(element));
    }
  
    _updateHeaderStyles() {
      if (!this.header) return;
      if (this.firstSec && this.header.classList.contains('secondary-header-section')) this.header.classList.remove('colored')
      this.firstSec ? this.header.classList.add('transparent') : this.header.classList.add('colored')
      if (!this.header.classList.contains('header--disable-sticky')) this.sidebars.length > 0 ? this.invertHeaderBetweenSidebars() : this.invertHeader()
    }

    _updateSectionStyles() {
        if (!this.firstSec) return

        this.marginTop = this.firstSec.offsetTop
        if (this.announcementBar && this.firstSec.querySelector('.full-height--desktop') || this.announcementBar && this.firstSec.querySelector('.full-height--mobile')) {
            this.firstSec.setAttribute("style", `--announcement-height: ${this.announcementBarHeight}px;`)
        }

        let headerSection;
        if (window.innerWidth < 920) {
          headerSection = this.querySelector('.mobile-header-section')
        } else {
          headerSection = this.querySelector('.header-section')
        }
        
        this.header ? this.headerHeight = headerSection.offsetHeight : this.headerHeight = 0
        this.headerGroupSections.length > 0 ? this.headerGroupHeight = this.headerGroup.querySelector('.header-group__sections').offsetHeight : this.headerGroupHeight = 0

        if (this.headerGroupSections.length > 0) {
          this.headerGroup.setAttribute("style", `top: ${this.headerHeight}px; z-index: 4;`)

          if (window.innerWidth < 920 && !this.headerGroup.classList.contains('header-group--mobile-overlap-enabled')) {
            this.headerGroupSections.forEach(headerGroupSection => {
              headerGroupSection.classList.remove('transparent')
            })
          } else {
            this.headerGroupSections.forEach(headerGroupSection => {
              headerGroupSection.classList.add('transparent')
            })
          }
        }

        this.sectionContent = this.firstSec.querySelectorAll('.overlapping-section .overlapping-content-js')
        this.sectionContent.forEach(content => content.style.marginTop = this.headerGroupHeight + this.headerHeight + 'px')
    }
  
    _onScroll() {
      if (this.header && !this.header.classList.contains('header--disable-sticky')) this.sidebars.length === 0 ? this.invertHeader() : this.invertHeaderBetweenSidebars()
      this.invertElementsOnScroll();
    }

    _onMobileScroll() {
        if (this.header && !this.header.classList.contains('header--disable-sticky')) this.invertHeader()
      }
  
    invertElementsOnScroll() {
      if (window.innerWidth < 920) return;
      this.currentScrollPos = window.scrollY;
      this.scrollDelta = (this.lastScrollPos <= this.currentScrollPos);
      this.lastScrollPos = this.currentScrollPos;
      this.invertedElements.forEach((el) => this.invertNavigationColor(el));
    }
  
    invertNavigationColor(invertedElement) {
      invertedElement.classList.remove("section-color", "footer-color");
      const invertedRect = invertedElement.getBoundingClientRect();
      const themeContent = this.querySelector(".theme-content");
      if (!themeContent) return; 
      const themeTop = themeContent.getBoundingClientRect().top;
      const footerRect = this.footer?.getBoundingClientRect();
      const sectionRect = this.firstSec?.getBoundingClientRect();
      if (window.scrollY === 0) {
        if (sectionRect && invertedRect.top > themeTop && invertedRect.bottom < sectionRect.bottom) invertedElement.classList.add("section-color")
          if (invertedRect.bottom > footerRect.top) invertedElement.classList.add("footer-color");
        return;
      }
      if (this.scrollDelta) {
        if (this.footer && this.firstSec) {
          if (invertedRect.top > themeTop && invertedRect.top < footerRect.top && invertedRect.bottom < sectionRect.bottom) {
            invertedElement.classList.add("section-color");
          }
          else if (invertedRect.bottom > footerRect.top) {
            invertedElement.classList.add("footer-color");
          }
          else if (invertedRect.top < footerRect.top && invertedRect.bottom > sectionRect.bottom) {
            invertedElement.classList.remove("section-color", "footer-color");
          }
        } else if (!this.footer && this.firstSec) {
          invertedRect.top > themeTop && invertedRect.bottom < sectionRect.bottom ? invertedElement.classList.add("section-color") : invertedElement.classList.remove("section-color", "footer-color")
        } else if (this.footer && !this.firstSec) {
          if (invertedRect.bottom > footerRect.top) invertedElement.classList.add("footer-color")
        }
      }
      else {
        if (this.footer && this.firstSec) {
          if (invertedRect.top > themeTop && invertedRect.top < footerRect.top && invertedRect.top < sectionRect.bottom) {
            invertedElement.classList.add("section-color");
          } else if (invertedRect.top > footerRect.top) {
            invertedElement.classList.add("footer-color");
          } else if (invertedRect.top < footerRect.top && invertedRect.top > sectionRect.bottom) {
            invertedElement.classList.remove("section-color", "footer-color");
          }
        } else if (!this.footer && this.firstSec) {
          invertedRect.top > themeTop && invertedRect.top < sectionRect.bottom ? invertedElement.classList.add("section-color") : invertedElement.classList.remove("section-color", "footer-color")
        } else if (this.footer && !this.firstSec) {
          if (invertedRect.top > footerRect.top) invertedElement.classList.add("footer-color")
        }
      }
    }

    invertHeader() {
      if (!this.firstSec || !this.header) return;
      if (this.header.querySelector('.header--sticky') && this.header.getBoundingClientRect().top < 0) this.header.classList.replace('transparent', 'colored')
      if (this.header.closest('.shopify-section-header-sticky') || this.header.closest('.shopify-section-mobile-header-sticky')) this.header.classList.replace('transparent', 'colored')
      setTimeout(() => {
        if (this.header.querySelector('.header--sticky') && this.header.getBoundingClientRect().top >= 0) this.header.classList.replace('colored', 'transparent')  
        if ((this.header.closest('.shopify-section-header:not(.shopify-section-header-sticky)') || this.header.closest('.shopify-section-mobile-header:not(.shopify-section-mobile-header-sticky)')) && !this.header.querySelector('.header--sticky')) this.header.classList.replace('colored', 'transparent')
      }, 10);
    }
    
    _setHeaderState(isColored) {
      const hasClass = this.header.classList.contains('colored');
      if (isColored && !hasClass) {
        this.header.classList.replace('transparent', 'colored');
      } else if (!isColored && hasClass) {
        this.header.classList.replace('colored', 'transparent');
      }
    }
  
    invertHeaderBetweenSidebars() {
      if (!this.header || !this.footer) return;
      if (this.header.querySelector('.header--disable-sticky')) return;
      const headerContainer = this.header.closest('.shopify-section-header');
      if (!headerContainer) return;
      headerContainer.classList.remove('header--static');
      let sectionRect
      if (this.firstSec) sectionRect = this.firstSec.getBoundingClientRect();
      const footerHeight = this.querySelector('.shopify-section-footer')?.getBoundingClientRect().height || 0;
      const footerTop = document.documentElement.offsetHeight - footerHeight;
      const scrolledEnough = (sectionRect && sectionRect.bottom + 500 > 0) || (footerTop < window.pageYOffset + 500);
      scrolledEnough ? headerContainer.classList.add('header--static') : headerContainer.classList.remove('header--static')
      !headerContainer.classList.contains('header--static') ? headerContainer.classList.add('sticky') : headerContainer.classList.remove('sticky')
      if (sectionRect && !this.header.classList.contains('transparent')) this.header.classList.replace('colored', 'transparent')
      if (sectionRect && sectionRect.bottom > window.pageYOffset || sectionRect && sectionRect.top == window.pageYOffset - 500) return
      if (this.header.querySelector('.header--sticky') && this.header.getBoundingClientRect().top < 0) this.header.classList.replace('transparent', 'colored')
      if (this.header.closest('.shopify-section-header-sticky')) this.header.classList.replace('transparent', 'colored')
      if (this.header.querySelector('.header--sticky') && this.header.getBoundingClientRect().top >= 0) this.header.classList.replace('colored', 'transparent')
      if (!this.firstSec) this.header.classList.replace('transparent', 'colored')
    }
  }
  
customElements.define("overlap-navigation", OverlapNavigation);