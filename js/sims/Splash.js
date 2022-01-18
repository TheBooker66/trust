Loader.addToManifest(Loader.manifestPreload, {
    splash_peep: "assets/splash/splash_peep.json",
    connection: "assets/splash/connection.json",
    cssAsset13: "assets/ui/sound.png"
});

function Splash(config) {

    const self = this;
    self.id = config.id;

    // Dimensions, yo
    const width = $("#main").clientWidth;
    const height = $("#main").clientHeight;
    const x = -(width - 960) / 2;
    const y = -(height - 540) / 2;

    // DOM
    self.dom = document.createElement("div");
    self.dom.className = "object";
    self.dom.style.left = x + "px";
    self.dom.style.top = y + "px";

    // APP
    const app = new PIXI.Application(width, height, {transparent: true, resolution: 2});
    app.view.style.width = width;
    app.view.style.height = height;
    self.dom.appendChild(app.view);

    // CONTAINERS
    const edgesContainer = new PIXI.Container();
    const peepsContainer = new PIXI.Container();
    app.stage.addChild(edgesContainer);
    app.stage.addChild(peepsContainer);

    // PEEPS
    const peeps = [];
    self.addPeep = function (x, y) {
        const peep = new SplashPeep({x: x, y: y, app: app, blush: config.blush});
        peeps.push(peep);
        peepsContainer.addChild(peep.graphics);
    };

    // EDGES
    const edges = [];
    self.addEdge = function (from, to) {
        const edge = new SplashEdge({from: from, to: to});
        edges.push(edge);
        edgesContainer.addChild(edge.graphics);
    };

    // Create RINGS
    const _createRing = function (xRadius, count) {
        let yRadius = xRadius * (350 / 400);
        const increment = (Math.TAU / count) + 0.0001;
        for (let angle = 0; angle < Math.TAU; angle += increment) {
            const a = angle - (Math.TAU / 4);
            const x = width / 2 + Math.cos(a) * xRadius;
            const y = height / 2 + Math.sin(a) * yRadius;
            self.addPeep(x, y);
        }
    };
    _createRing(400, 20);
    _createRing(520, 25);
    _createRing(640, 30);
    _createRing(760, 35);

    // Connect all within a radius
    const _connectAllWithinRadius = function (radius) {

        const r2 = radius * radius;

        for (let i = 0; i < peeps.length; i++) {
            const peep1 = peeps[i];

            for (let j = i + 1; j < peeps.length; j++) {
                const peep2 = peeps[j];

                // Are they close enough?
                const dx = peep2.x - peep1.x;
                const dy = peep2.y - peep1.y;
                if (dx * dx + dy * dy < r2) {
                    self.addEdge(peep1, peep2);
                }

            }
        }
    };
    _connectAllWithinRadius(250);

    // Animiniminimination
    const update = function (delta) {
        Tween.tick();
        for (let i = 0; i < peeps.length; i++) peeps[i].update(delta);
        for (let i = 0; i < edges.length; i++) edges[i].update(delta);
    };
    app.ticker.add(update);
    update(0);

    ///////////////////////////////////////////////
    ///////////// ADD, REMOVE, KILL ///////////////
    ///////////////////////////////////////////////

    // Add...
    self.add = function () {
        _add(self);
    };

    // Remove...
    self.remove = function () {
        app.destroy();
        _remove(self);
    };

}

function SplashPeep(config) {

    const self = this;
    self.config = config;

    // Graphics!
    const g = _makeMovieClip("splash_peep", {scale: 0.3});
    self.graphics = g;
    if (config.blush) g.gotoAndStop(1);
    if (Math.random() < 0.5) g.scale.x *= -1; // Flip?

    // Them variables...
    self.app = config.app;
    self.x = config.x;
    self.y = config.y;
    const initX = config.x;
    const initY = config.y;
    const initRotation = (Math.random() - 0.5) * (Math.PI - 0.4);
    const radius = 5 + Math.random() * 20;
    const swing = 0.05 + Math.random() * 0.45;
    let angle = Math.random() * Math.TAU;
    const speed = (0.05 + Math.random() * 0.95) / 60;

    self.update = function (delta) {

        // Them variables...
        angle += speed * delta;
        const x = initX + Math.cos(angle) * radius;
        const y = initY + Math.sin(angle) * radius;
        const r = initRotation + Math.cos(angle) * swing;

        // NEAR MOUSE?
        const Mouse = self.app.renderer.plugins.interaction.mouse.global;
        const dx = Mouse.x - x;
        const dy = Mouse.y - y;
        const rad = 200;
        let bulgeX = 0;
        let bulgeY = 0;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < rad * rad) {
            const bulge = Math.sin(((rad - Math.sqrt(dist2)) / rad) * Math.TAU / 4) * 50;
            const bulgeAngle = Math.atan2(-dy, -dx);
            bulgeX = Math.cos(bulgeAngle) * bulge;
            bulgeY = Math.sin(bulgeAngle) * bulge;
        }

        // Graphics!
        g.x = x + bulgeX;
        g.y = y + bulgeY;
        g.rotation = r;


    };

}

function SplashEdge(config) {

    const self = this;
    self.config = config;

    // Graphics!
    const g = _makeMovieClip("connection");
    g.anchor.x = 0;
    g.anchor.y = 0.5;
    g.height = 1;
    self.graphics = g;

    // Them variables...
    self.from = config.from;
    self.to = config.to;

    self.update = function () {

        // Just update graphics!
        const f = self.from.graphics;
        const t = self.to.graphics;
        const dx = t.x - f.x;
        const dy = t.y - f.y;
        const a = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy);

        g.x = f.x;
        g.y = f.y;
        g.rotation = a;

        g.width = dist;

    };

}