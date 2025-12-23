class PredictiveSearch extends HTMLElement {
    constructor() {
      super();
  
      this.modal = this.closest('.search-modal');
      this.cachedResults = {};
      this.input = this.querySelector('.search__input');
      this.predictiveSearchResults = this.querySelector('[data-predictive-search]');
      this.loadingSpinner = this.querySelector('.loading-overlay__spinner')
      this.abortController = new AbortController();
      this.setupEventListeners();
    }
  
    setupEventListeners() {
      this.querySelector('form.search-modal__form').addEventListener('submit', this.onFormSubmit.bind(this));
      this.querySelector('button[type="reset"]').addEventListener('click', this.clear.bind(this));
  
      this.input.addEventListener('input', debounce((event) => {
        this.onChange(event);
      }, 500).bind(this));
      this.input.addEventListener('focus', this.onFocus.bind(this));
      this.modal.querySelector('.button-close').addEventListener('click', (event) => {
        this.clear(event)
        this.close(true)
      })
      document.querySelector('body > .overlay').addEventListener('click', (event) => {
        this.clear(event)
        this.close(true)
      })
      this.addEventListener('keyup', this.onKeyup.bind(this));
      this.addEventListener('keydown', this.onKeydown.bind(this));
      
    }
  
    getQuery() {
      return this.input.value.trim();
    }
  
    onChange() {
      const searchTerm = this.getQuery();
  
      if (searchTerm.length === 0) {
        this.clear();
        return;
      }
  
      this.getSearchResults(searchTerm)
    }
  
    onFormSubmit(event) {
      if (!this.getQuery().length || this.querySelector('[aria-selected="true"] a')) event.preventDefault();
    }
  
    onFocus() {
      document.body.classList.add('predictive-search--focus');
      const searchTerm = this.getQuery();
  
      if (!searchTerm.length) return;
  
      if (this.getAttribute('results') === 'true') {
        this.open();
      } else {
        this.getSearchResults(searchTerm);
      }
    } 
  
    onFocusOut() {
      setTimeout(() => {
        if (!this.contains(document.activeElement)) this.close();
      })
    }
  
    onKeyup(event) {
      if (!this.getQuery().length) this.clear(event);
      event.preventDefault();
  
      switch (event.code) {
        case 'ArrowUp':
          this.switchOption('up')
          break;
        case 'ArrowDown':
          this.switchOption('down');
          break;
        case 'Enter':
          this.selectOption();
          break;
      }
    }
  
    onKeydown(event) {
      // Prevent the cursor from moving in the input when using the up and down arrow keys
      if (
        event.code === 'ArrowUp' ||
        event.code === 'ArrowDown'
      ) {
        event.preventDefault();
      }
    }
  
    switchOption(direction) {
      if (!this.getAttribute('open')) return;
      
      const moveUp = direction === 'up';
      const selectedElement = this.querySelector('[aria-selected="true"]');
      const allElements = this.querySelectorAll('li');
      let activeElement = this.querySelector('li');
  
      if (moveUp && !selectedElement) return;
  
      this.statusElement.textContent = ''; 
  
      if (!moveUp && selectedElement) {
        activeElement = selectedElement.nextElementSibling || allElements[0];
      } else if (moveUp) {
        activeElement = selectedElement.previousElementSibling || allElements[allElements.length - 1];
      }
  
      if (activeElement === selectedElement) return;
  
      activeElement.setAttribute('aria-selected', true);
      if (selectedElement) selectedElement.setAttribute('aria-selected', false);
   
      this.setLiveRegionText(activeElement.textContent);
      this.input.setAttribute('aria-activedescendant', activeElement.id);
    }
  
    selectOption() {
      const selectedProduct = this.querySelector('[aria-selected="true"] a, [aria-selected="true"] button');
  
      if (selectedProduct) selectedProduct.click();
    }
  
    getSearchResults(searchTerm) {
      const queryKey = searchTerm.replace(" ", "-").toLowerCase();
      this.setLiveRegionLoadingState();
  
      if (this.cachedResults[queryKey]) {
        this.renderSearchResults(this.cachedResults[queryKey]);
        if (this.modal) this.modal.classList.add('searching');
        return;
      }
  
      fetch(`${window.routes.predictive_search_url}?q=${encodeURIComponent(searchTerm)}&${encodeURIComponent('resources[limit_scope]')}=each&section_id=predictive-search`, {
        signal: this.abortController.signal,
        })
        .then((response) => { 
          if (!response.ok) {
            var error = new Error(response.status);
            this.close();
            throw error;
          }
  
          return response.text();
        })
        .then((text) => {
          const resultsMarkup = new DOMParser().parseFromString(text, 'text/html').querySelector('#shopify-section-predictive-search').innerHTML;
          this.cachedResults[queryKey] = resultsMarkup;
          this.renderSearchResults(resultsMarkup);

          
          if (this.modal) {
            setTimeout(() => {
              this.modal.classList.add('searching')
            }, 100)
          }
        })
        .catch((error) => {
          this.close();
          throw error;
        });

    }
  
    setLiveRegionLoadingState() {
      this.loadingSpinner.classList.remove('hidden')
      this.statusElement = this.statusElement || this.querySelector('.predictive-search-status');
      this.loadingText = this.loadingText || this.getAttribute('data-loading-text');
      this.setLiveRegionText(this.loadingText);
      this.setAttribute('loading', true);
      this.querySelector('.search__button-text').classList.add('hidden')
    }
  
    setLiveRegionText(statusText) {
      this.statusElement.setAttribute('aria-hidden', 'false');
      this.statusElement.textContent = statusText;
      
      setTimeout(() => {
        this.statusElement.setAttribute('aria-hidden', 'true');
      }, 1000);
    }
  
    renderSearchResults(resultsMarkup) {
      this.predictiveSearchResults.innerHTML = resultsMarkup;
      this.setAttribute('results', true);  
      this.predictiveSearchResults.classList.remove('visually-hidden')
      this.setLiveRegionResults();
      this.open();
    }
  
    setLiveRegionResults() { 
      this.loadingSpinner.classList.add('hidden')
      this.removeAttribute('loading');
      this.querySelector('.search__button-text').classList.remove('hidden')
      this.setLiveRegionText(this.querySelector('[data-predictive-search-live-region-count-value]').textContent);
    }
  
    open() {
      this.setAttribute('open', true);
      this.input.setAttribute('aria-expanded', true);
      document.body.classList.add('predictive-search--focus');
    }
  
    close(clearSearchTerm = false) {
      if (!clearSearchTerm) this.setLiveRegionResults();
      if (clearSearchTerm) {
        this.removeAttribute('results');
        this.input.value = ''
      }
      const selected = this.querySelector('[aria-selected="true"]');
  
      if (selected) selected.setAttribute('aria-selected', false);
  
      this.input.setAttribute('aria-activedescendant', '');
      this.removeAttribute('open');
      this.removeAttribute('results');
      this.input.value = ''
      this.predictiveSearchResults.classList.add('visually-hidden')
      this.input.setAttribute('aria-expanded', false);
      document.body.classList.remove('predictive-search--focus');
      if (this.modal) this.modal.classList.remove('searching');
    }
  
    clear(event) {
      event.preventDefault();
      this.querySelector('.search__button-text').classList.add('hidden')
      this.input.value = '';
      this.removeAttribute('open');
      this.removeAttribute('results');
      this.predictiveSearchResults.classList.add('visually-hidden')
      this.input.focus();
      if (this.modal) this.modal.classList.remove('searching');
    }
  }
  
  customElements.define('predictive-search', PredictiveSearch);
  