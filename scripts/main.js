(function() {
  class Request {
    static get(...args) {
      Request.send('GET', ...args);
    }

    static send(method, url, cb) {
      let request = new XMLHttpRequest();
      request.onreadystatechange = function() {
        if (request.readyState === 4) {
          if (request.status >= 200 && request.status <= 204) {
            cb(null, request);
          } else {
            cb(new Error(`Could not fetch '${url}'`));
          }
        }
      };
      request.open(method, url);
      request.send();
    }
  }

  class Build {
    constructor(app, attrs) {
      this.kind = app.kinds.findById(attrs.kind);
      this.name = attrs.name;
      this.description = attrs.description;
      this.phone = attrs.phone;
      this.email = attrs.email;
      this.location = attrs.location;
      this.latLng = new google.maps.LatLng(attrs.location.lat, attrs.location.lng);
      this.createdAt = attrs.created_at && new Date(attrs.created_at);
    }

    toMarker(map) {
      let self = this;
      return this.marker || (this.marker = new google.maps.Marker({
        title: self.name,
        position: self.latLng,
        visible: false,
        icon: self.kind.icon,
        map: map,
        build: self
      }));
    }

    toInfoWindow() {
      if (!this.infoWindow) {
        let body = [];

        if (this.description) {
          body.push(`<p>Descrição: ${this.description}</p>`);
        }

        if (this.phone) {
          body.push(`<p>Fone: ${this.phone}</p>`);
        }

        if (this.email) {
          body.push(`<p>Email: <a href="mailto:${this.email}">${this.email}</a></p>`);
        }

        if (this.createdAt) {
          body.push(`<p>Criado em: ${this.createdAt}</p>`);
        }

        this.infoWindow = new google.maps.InfoWindow({
          content: `
            <div class="build-info-window">
              <h1>${this.name}</h1>
              ${body.join("\n")}
            </div>
          `
        });
      }

      return this.infoWindow;
    }
  }

  class Buildings {
    constructor(app) {
      this.app = app;
      this.gmap = app.map.gmap;
      this.markers = [];
      this.fetchAll((err) => {
        if (err) {
          this.app.logger.error(err);
        } else {
          this.setMarkers();
        }
      });
    }

    fetchAll(cb) {
      if (!this.buildings) {
        let self = this;
        Request.get('/buildings.json', (err, response) => {
          if (err) {
            cb(err);
          } else {
            self.buildings = JSON.parse(response.responseText).map((build) => new Build(self.app, build));
            cb(null, self.buildings);
          }
        });
      } else {
        cb(null, this.buildings);
      }
    }

    setMarkers() {
      this.buildings.forEach((build) => {
        let self = this;
        let marker = build.toMarker(this.gmap);
        let infoWindow = build.toInfoWindow();
        this.markers.push(marker);
        marker.addListener('click', (e) => {
          infoWindow.open(self.gmap, marker);
        });
      });
    }
  }

  class Kind {
    constructor(app, el) {
      let self = this;

      this.app = app;
      this.el = el;
      this.id = el.getAttribute('data-kind-id');
      this.color = el.getAttribute('data-kind-color');

      el.addEventListener('change', () => {
        if (el.checked) {
          self.enable();
        } else {
          self.disable();
        }
      });

      // Set markers color
      [...el.parentNode.children]
        .filter((e) => !!/(?:\s)?nav\-menu\-item\-marker(?:\s)?(.?)/.exec(e.getAttribute('class')))
        .forEach((e) => e.style.borderColor = el.getAttribute('data-kind-color'));
    }

    get markers() {
      if (this.app.buildings) {
        let self = this;
        return this.app.buildings.markers.filter((marker) => marker.build.kind.id === self.id);
      } else {
        return [];
      }
    }

    get icon() {
      return `images/pin-mark-${this.el.getAttribute('data-kind-icon')}.png`;
    }

    enable() {
      this._setMarkersVisibility(true);
    }

    disable() {
      this._setMarkersVisibility(false);
    }

    _setMarkersVisibility(visibility) {
      this.markers.forEach((marker) => marker.setVisible(!!visibility));
    }
  }

  class Kinds {
    constructor(app) {
      this.app = app;
      this.kinds = [...document.querySelectorAll('.map-nav-kind')].map((el) => new Kind(app, el));
    }

    findById(id) {
      return this.kinds.filter((kind) => kind.id === id)[0];
    }
  }

  class Map {
    constructor(app) {
      this.app = app;
      this.gmap = new google.maps.Map(document.getElementById('map'), {
        center: {
          lat: -15.6142309,
          lng: -56.1120186
        },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        zoomControlOptions: {
          position: google.maps.ControlPosition.LEFT_BOTTOM
        },
        panControlOptions: {
          position: google.maps.ControlPosition.LEFT_BOTTOM
        }
      });
    }
  }

  class Nav {
    constructor() {
      let self = this;
      this.navEl = document.getElementById('map-nav');
      this.togglerEl = document.querySelector('.nav-toggler');
      this.togglerEl.addEventListener('click', () => self.toggle());
    }

    toggle() {
      if (this.isOpened()) {
        this.navEl.className = this.navEl.className.replace(/(?:\s)?nav\-opened(?:\s)?/, '');
      } else {
        this.navEl.className += ' nav-opened';
      }
    }

    isOpened() {
      return !!this.navEl.getAttribute('class').match(/(?:\s)?nav\-opened(?:\s)?(.?)/);
    }
  }

  class Logger {
    constructor(app, label) {
      this.label = label || 'App';
      ['log', 'info', 'warn', 'error'].forEach((level) => {
        this[level] = function(...args) {
          args.unshift('[' + this.label + ']');
          console[level](...args);
        }
      });
    }
  }

  class App {
    constructor() {
      this.logger = new Logger(this);
      this.nav = new Nav(this);
      this.map = new Map(this);
      this.kinds = new Kinds(this);
      this.buildings = new Buildings(this);
    }
  }

  window.initMap = () => new App();
}());
