if (!customElements.get('shoppable-media-slider')) {
  customElements.define('shoppable-media-slider', class ShoppableMediaSlider extends HTMLElement {
    static lastIndexBySection = new Map();

    constructor() {
      super();
      this.swiper = null;
      this.sectionId = this.dataset.sectionId;
    }

    connectedCallback() {
      if (this.swiper || !window.Swiper) return;

      this.initSwiper();
      this.setEventListeners();

      if (Shopify.designMode) {
        this.setDesignModeListeners();
      }
    }

    initSwiper() {
      if (this.swiper) {
        this.swiper.destroy(true, true);
        this.swiper = null;
      }
    
      const styles = getComputedStyle(this);
      const { canLoop, slidesPerView, loopAdditionalSlides } = this.computeSliderParams();
      const initialSlideIndex = ShoppableMediaSlider.lastIndexBySection.has(this.sectionId)
        ? Number(ShoppableMediaSlider.lastIndexBySection.get(this.sectionId))
        : 0;
      const userEnabledLoop = this.dataset.loop === 'true';

      this.slideOffset = parseInt(styles.getPropertyValue('--slide-offset'), 10) || 0;
      this.activeSlideOffset = parseInt(styles.getPropertyValue('--active-slide-offset'), 10) || 0;
      this.sliderSpeed = 200;
      this.canLoop = canLoop;
      this.loopAdditionalSlides = loopAdditionalSlides;
      this.currentSlidesPerView = slidesPerView;
      this.videos = this.querySelectorAll('video');

      const swiperConfig = {
        initialSlide: initialSlideIndex,
        slidesPerView: slidesPerView, 
        loop: userEnabledLoop && canLoop,
        spaceBetween: this.slideOffset,
        freeMode: false,
        autoHeight: false,
        roundLengths: true,
        resistanceRatio: 0,
        loopAdditionalSlides: loopAdditionalSlides,
        speed: this.sliderSpeed,
        grabCursor: true,
        centeredSlides: true,
        slideToClickedSlide: false,
        navigation: {
          nextEl: ".swiper-button-next",
          prevEl: ".swiper-button-prev"
        },
        on: {
          init: () => this.onSliderInit(),
          resize: () => this.updateNavPosition(),
          slideChangeTransitionStart: () => this.pauseAllVideos(),
          slideChangeTransitionEnd: () => this.handleSlideChangeTransitionEnd(),
          click: (swiper, event) => this.slideToClickedSlide(swiper, event),
          touchStart: () => this.handleTouchStart(),
          touchMove: (event) => this.handleTouchMove(event),
          touchEnd: () => this.handleTouchEnd(),
          touchCancel: () => this.handleTouchEnd(),
        }
      };
    
      this.swiper = new Swiper(this, swiperConfig);
    }

    computeSliderParams() {
      const containerWidth =
        (this.getBoundingClientRect && this.getBoundingClientRect().width) ||
        this.clientWidth ||
        this.offsetWidth ||
        0;
    
      const MIN_SLIDES_PER_VIEW = 1.4;
      const MOBILE_THRESHOLD = 768;
      const isMobileContainer = containerWidth <= MOBILE_THRESHOLD;
    
      const styles = getComputedStyle(this);
      const SLIDES_GAP = parseInt(styles.getPropertyValue('--slide-offset'), 10) || 0;
      const DESKTOP_SLIDE_WIDTH = parseInt(styles.getPropertyValue('--desktop-slide-width'), 10) || 0;
      const MOBILE_SLIDE_WIDTH = parseInt(styles.getPropertyValue('--mobile-slide-width'), 10) || 0;
      const SLIDE_WIDTH = isMobileContainer ? MOBILE_SLIDE_WIDTH : DESKTOP_SLIDE_WIDTH;

      const slidesPerView = Math.max(MIN_SLIDES_PER_VIEW, (containerWidth + SLIDES_GAP) / (SLIDE_WIDTH + SLIDES_GAP));
      const slidesAmount = this.querySelectorAll('.shoppable-media-slider__slide').length;
      const canLoop = slidesAmount >= Math.ceil(slidesPerView) + 1;
      const loopAdditionalSlides = isMobileContainer ? 1 : 0;

      this._lastContainerWidth = containerWidth;
    
      return { slidesPerView, canLoop, loopAdditionalSlides };
    }

    setEventListeners() {
      this.debouncedReinitIfParamsChanged = debounce(this.reinitIfParamsChanged.bind(this), 10);
      window.addEventListener('resize', this.debouncedReinitIfParamsChanged);
    
      this.soundControls = this.querySelectorAll('.shoppable-media-slider__control--sound');
      this.handleSoundControlClick = this.handleSoundControlClick.bind(this);
      this.soundControls.forEach(el => el.addEventListener('click', this.handleSoundControlClick));
    
      this.playbackControls = this.querySelectorAll('.shoppable-media-slider__control--playback');
      this.handlePlaybackControlClick = this.handlePlaybackControlClick.bind(this);
      this.playbackControls.forEach(el => el.addEventListener('click', this.handlePlaybackControlClick));
    }

    setDesignModeListeners() {
      this.onSectionLoad = (event) => {
        const sectionId = event.detail?.sectionId;

        if (sectionId === this.sectionId && this.swiper) {
          this.swiper.update();
        }
      };

      this.onBlockSelect = (event) => {
        const sectionId = event.detail?.sectionId;

        if (sectionId === this.sectionId  && this.swiper) {
          const block = event.target;
          const blockSlideIndex = this.getSlideIndex(block);

          if (blockSlideIndex !== this.getCurrentIndex()) {
            this.slideTo(blockSlideIndex);
          }
        }
      };

      document.addEventListener('shopify:block:select', this.onBlockSelect);
      document.addEventListener('shopify:section:load', this.onSectionLoad);
    }

    reinitIfParamsChanged() {
      const { canLoop, loopAdditionalSlides, slidesPerView } = this.computeSliderParams();
    
      if (
        canLoop !== this.canLoop ||
        loopAdditionalSlides !== this.loopAdditionalSlides ||
        slidesPerView !== this.currentSlidesPerView
      ) {
        this.initSwiper();
      }
    }

    slideToClickedSlide(swiper, event) {
      const clickedSlide = event.target.closest('.shoppable-media-slider__slide-main-content');

      if (!clickedSlide || clickedSlide.closest('.swiper-slide-active')) {
        return;
      }

      const slideIndex = this.getSlideIndex(swiper.clickedSlide);

      if (slideIndex === this.getCurrentIndex()) {
        return;
      }

      clickedSlide.classList.add('cursor-pointer');

      this.slideTo(slideIndex);

      setTimeout(() => {
        clickedSlide.classList.remove('cursor-pointer');
      }, this.sliderSpeed);
    }

    handleTouchStart() {
      this.dragStarted = false;
      this._touchIntent = null; // 'horizontal' | 'vertical' | null
    
      const activeSlide = this.querySelector('.swiper-slide-active');
      activeSlide?.classList.add('shoppable-media-slider__slide--large-margins');
    }
    
    handleTouchMove(event) {
      const touches = event.touches;
      if (!touches) return;
    
      const dx = Math.abs(touches.currentX - touches.previousX);
      const dy = Math.abs(touches.currentY - touches.previousY);
      const THRESHOLD = 5; 
    
      if (!this._touchIntent) {
        if (dx > dy && dx > THRESHOLD) this._touchIntent = 'horizontal';
        else if (dy > dx && dy > THRESHOLD) this._touchIntent = 'vertical';
      }

      if (this._touchIntent === 'horizontal' && !this.dragStarted) {
        this.dragStarted = true;
        this.classList.add('is-dragging');
      }
    
      if (this._touchIntent === 'vertical' && this.classList.contains('is-dragging')) {
        this.dragStarted = false;
        this.classList.remove('is-dragging');
      }
    }
    
    handleTouchEnd() {
      this.dragStarted = false;
      this.classList.remove('is-dragging');
      this._touchIntent = null;
    
      const slideWithLargeMargins = this.querySelector('.shoppable-media-slider__slide--large-margins');
      slideWithLargeMargins?.classList.remove('shoppable-media-slider__slide--large-margins');
    }

    handleSlideChangeTransitionEnd() {
      this.playActiveSlideVideo();
    }

    handleSoundControlClick(event) {
      const soundControl = event.currentTarget;
      const soundControlsMuteIcons = this.querySelectorAll('.shoppable-media-slider__control-icon--mute');
      const soundControlsUnmuteIcons = this.querySelectorAll('.shoppable-media-slider__control-icon--unmute');
      const muteIcon = soundControl.querySelector('.shoppable-media-slider__control-icon--mute');
      const unmuteIcon = soundControl.querySelector('.shoppable-media-slider__control-icon--unmute');

      const isMuted = muteIcon.classList.contains('hidden');
      const isUnmuted = unmuteIcon.classList.contains('hidden');

      if (+isMuted + +isUnmuted !== 1) {
        return;
      }

      const video = soundControl.closest('.shoppable-media-slider__slide-main-content').querySelector('video');
      video.muted = !video.muted;

      soundControlsMuteIcons.forEach(icon => icon.classList.toggle('hidden'));
      soundControlsUnmuteIcons.forEach(icon => icon.classList.toggle('hidden'));
      this.soundControls.forEach(control => control.setAttribute('aria-label', `${isMuted ? window.accessibilityStrings.unmute : window.accessibilityStrings.mute}`));

      if (isMuted) {
        this.removeAttribute("data-muted");
      } else {
        this.setAttribute("data-muted", "true");
      }
    }

    handlePlaybackControlClick(event) {
      const playbackControl = event.currentTarget;
      const playbackControlsPlayIcons = this.querySelectorAll('.shoppable-media-slider__control-icon--play');
      const playbackControlsPauseIcons = this.querySelectorAll('.shoppable-media-slider__control-icon--pause');
      const playIcon = playbackControl.querySelector('.shoppable-media-slider__control-icon--play');
      const pauseIcon = playbackControl.querySelector('.shoppable-media-slider__control-icon--pause');

      const isPlaying = playIcon.classList.contains('hidden');
      const isPaused = pauseIcon.classList.contains('hidden');

      if (+isPlaying + +isPaused !== 1) {
        return;
      }

      const video = playbackControl.closest('.shoppable-media-slider__slide-main-content').querySelector('video');
      if (video.paused && isPaused) {
        video.play();
        video.muted = Boolean(this.dataset.muted);
      } else if (!video.paused && isPlaying) {
        video.pause();
      } 

      playbackControlsPlayIcons.forEach(icon => icon.classList.toggle('hidden'));
      playbackControlsPauseIcons.forEach(icon => icon.classList.toggle('hidden'));
      this.playbackControls.forEach(control => control.setAttribute('aria-label', `${isPlaying ? window.accessibilityStrings.play : window.accessibilityStrings.pause}`));

      if (isPaused) {
        this.setAttribute("data-allow-video-autoplay", "true");
      } else {
        this.removeAttribute("data-allow-video-autoplay");
      }
    }

    pauseAllVideos() {
      this.videos.forEach(video => {
        video.pause();
      });
    }

    playActiveSlideVideo() {
      if (!this.dataset.allowVideoAutoplay) return;

      requestAnimationFrame(() => {
        const activeSlide = this.querySelector('.swiper-slide-active');
        const activeVideo = activeSlide?.querySelector('video');

        if (activeVideo) {
          activeVideo.play();
          activeVideo.muted = Boolean(this.dataset.muted);
        };
      });
    }

    onSliderInit() {
      this.updateNavPosition();
      this.pauseAllVideos();
      this.playActiveSlideVideo();
    }

    updateNavPosition() {
      if (!this.swiper) return;
  
      const activeSlide = this.swiper.slides[this.swiper.activeIndex];
      const prevButton = this.swiper.navigation.prevEl;
      const nextButton = this.swiper.navigation.nextEl;
  
      if (!activeSlide || !prevButton || !nextButton) return;

      const sliderWidth = this.offsetWidth;
      const activeSlideMediaHeight = activeSlide.querySelector('.shoppable-media-slider__slide-main-content').offsetHeight;
      const activeSlideWidth = activeSlide.offsetWidth;
      const prevButtonWidth = prevButton.offsetWidth;
      const nextButtonWidth = nextButton.offsetWidth;

      const buttonOffsetFromSliderCenter = sliderWidth / 2 - activeSlideWidth / 2 - this.activeSlideOffset / 2;
      const prevButtonCenterToEdgeDistance = prevButtonWidth / 2;
      const nextButtonCenterToEdgeDistance = nextButtonWidth / 2;

      prevButton.style.insetInlineStart = `${buttonOffsetFromSliderCenter - prevButtonCenterToEdgeDistance}px`;
      prevButton.style.top = `${activeSlideMediaHeight / 2}px`;
      nextButton.style.insetInlineEnd = `${buttonOffsetFromSliderCenter - nextButtonCenterToEdgeDistance}px`;
      nextButton.style.top = `${activeSlideMediaHeight / 2}px`;
    }

    disconnectedCallback() {
      const lastViewedBlockIndex = this.getCurrentIndex();
      ShoppableMediaSlider.lastIndexBySection.set(this.sectionId, lastViewedBlockIndex);

      if (this.onBlockSelect) {
        document.removeEventListener('shopify:block:select', this.onBlockSelect);
        this.onBlockSelect = null;
      }

      if (this.onSectionLoad) {
        document.removeEventListener('shopify:section:load', this.onSectionLoad);
        this.onSectionLoad = null;
      }

      if (this.debouncedReinitIfParamsChanged) {
        window.removeEventListener('resize', this.debouncedReinitIfParamsChanged);
      }

      if (this.soundControls) {
        this.soundControls.forEach(soundControl => {
          soundControl.removeEventListener('click', this.handleSoundControlClick);
        });
      }
      
      if (this.playbackControls) {
        this.playbackControls.forEach(playbackControl => {
          playbackControl.removeEventListener('click', this.handlePlaybackControlClick);
        });
      }
      
      if (this.swiper) {
        this.swiper.destroy(true, true);
        this.swiper = null;
      }
    }

    getCurrentIndex() {
      if (!this.swiper) return 0;

      return this.swiper.params.loop ? this.swiper.realIndex : this.swiper.activeIndex;
    }

    getSlideIndex(slide) {
      return +slide.dataset.swiperSlideIndex || (parseInt(slide.getAttribute('aria-label'), 10) - 1);
    }

    slideTo(index, speed = this.sliderSpeed) {
      if (this.swiper.params.loop) {
        this.swiper.slideToLoop(index, speed);
      } else {
        this.swiper.slideTo(index, speed);
      }
    }
  });
}
