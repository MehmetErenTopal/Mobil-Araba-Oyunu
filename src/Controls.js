export class Controls {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false
    };

    this.initKeyboard();
    this.initTouch();
  }

  initKeyboard() {
    document.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW': this.keys.forward = true; break;
        case 'ArrowDown':
        case 'KeyS': this.keys.backward = true; break;
        case 'ArrowLeft':
        case 'KeyA': this.keys.left = true; break;
        case 'ArrowRight':
        case 'KeyD': this.keys.right = true; break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW': this.keys.forward = false; break;
        case 'ArrowDown':
        case 'KeyS': this.keys.backward = false; break;
        case 'ArrowLeft':
        case 'KeyA': this.keys.left = false; break;
        case 'ArrowRight':
        case 'KeyD': this.keys.right = false; break;
      }
    });
  }

  initTouch() {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnGas = document.getElementById('btn-gas');
    const btnBrake = document.getElementById('btn-brake');

    const addTouchEvents = (element, key) => {
      // Touch events
      element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.keys[key] = true;
        element.classList.add('active');
      }, { passive: false });

      element.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.keys[key] = false;
        element.classList.remove('active');
      }, { passive: false });

      // Mouse events for desktop testing
      element.addEventListener('mousedown', (e) => {
        this.keys[key] = true;
        element.classList.add('active');
      });

      element.addEventListener('mouseup', (e) => {
        this.keys[key] = false;
        element.classList.remove('active');
      });
      
      element.addEventListener('mouseleave', (e) => {
        this.keys[key] = false;
        element.classList.remove('active');
      });
    };

    if (btnLeft) addTouchEvents(btnLeft, 'left');
    if (btnRight) addTouchEvents(btnRight, 'right');
    if (btnGas) addTouchEvents(btnGas, 'forward');
    if (btnBrake) addTouchEvents(btnBrake, 'backward');
  }
}
