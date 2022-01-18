Tournament.resetGlobalVariables = function () {

    Tournament.SELECTION = 5;
    Tournament.NUM_TURNS = 10;

    Tournament.INITIAL_AGENTS = [
        {strategy: "tft", count: 3},
        {strategy: "all_d", count: 3},
        {strategy: "all_c", count: 3},
        {strategy: "grudge", count: 3},
        {strategy: "prober", count: 3},
        {strategy: "tf2t", count: 3},
        {strategy: "pavlov", count: 3},
        {strategy: "random", count: 4}
    ];

    Tournament.FLOWER_CONNECTIONS = false;

    publish("pd/defaultPayoffs");

    PD.NOISE = 0;

};

Tournament.resetGlobalVariables();

subscribe("rules/evolution", function (value) {
    Tournament.SELECTION = value;
});

subscribe("rules/turns", function (value) {
    Tournament.NUM_TURNS = value;
});

// OH THAT'S SO COOL. Mostly C: Pavlov wins, Mostly D: tit for two tats wins (with 5% mistake!)
// ALSO, NOISE: tft vs all_d. no random: tft wins. low random: tf2t wins. high random: all_d wins. totally random: nobody wins

//////////////////////////////////////////////
//////////////////////////////////////////////

// REGULAR LOAD
Loader.addToManifest(Loader.manifest, {
    tournament_peep: "assets/tournament/tournament_peep.json",
    connection_flower: "assets/tournament/connection_flower.json",

    // SFX
    squeak: "assets/sounds/squeak.mp3",
    bonk: "assets/sounds/bonk.mp3"

});

function Tournament(config) {

    const self = this;
    self.id = config.id;

    // APP
    const app = new PIXI.Application(500, 500, {transparent: true, resolution: 2});
    self.dom = app.view;

    // DOM
    self.dom.className = "object";
    self.dom.style.width = 500;
    self.dom.style.height = 500;
    self.dom.style.left = config.x + "px";
    self.dom.style.top = config.y + "px";
    //self.dom.style.border = "1px solid rgba(0,0,0,0.2)";

    const _convertCountToArray = function () {
        const array = [];
        for (let i = 0; i < AGENTS.length; i++) {
            const A = AGENTS[i];
            const strategy = A.strategy;
            const count = A.count;
            for (let j = 0; j < count; j++) {
                array.push(strategy);
            }
        }
        return array;
    };

    self.agents = [];
    self.connections = [];

    self.networkContainer = new PIXI.Container();
    self.agentsContainer = new PIXI.Container();
    app.stage.addChild(self.networkContainer);
    app.stage.addChild(self.agentsContainer);

    self.populateAgents = function () {

        // Clear EVERYTHING
        while (self.agents.length > 0) self.agents[0].kill();

        // Convert to an array
        self.agents = _convertCountToArray(AGENTS);

        // Put 'em in a ring
        const count = 0;
        for (let i = 0; i < self.agents.length; i++) {

            // Angle
            const angle = (i / self.agents.length) * Math.TAU - Math.TAU / 4;

            // What kind of agent?
            const strategy = self.agents[i];
            const agent = new TournamentAgent({angle: angle, strategy: strategy, tournament: self});
            self.agentsContainer.addChild(agent.graphics);

            // Remember me!
            self.agents[i] = agent;

        }

        // (sort agents by depth)
        self.sortAgentsByDepth();

    };
    self.sortAgentsByDepth = function () {
        self.agentsContainer.children.sort(function (a, b) {
            return a.y - b.y;
        });
    };

    self.createNetwork = function () {

        // Clear EVERYTHING
        while (self.connections.length > 0) self.connections[0].kill();

        // Connect all of 'em
        for (let i = 0; i < self.agents.length; i++) {
            const playerA = self.agents[i];
            let flip = false;
            for (let j = i + 1; j < self.agents.length; j++) {
                const playerB = self.agents[j];
                const connection = new TournamentConnection({
                    tournament: self,
                    from: playerA,
                    to: playerB,
                    flower_flip: flip
                });
                self.networkContainer.addChild(connection.graphics);
                self.connections.push(connection);
                flip = !flip;
            }
        }

    };
    self.actuallyRemoveConnection = function (connection) {
        const index = self.connections.indexOf(connection);
        self.connections.splice(index, 1);
    };


    ///////////////////////
    // RESET //////////////
    ///////////////////////

    let AGENTS;
    self.reset = function () {

        // Agents & Network...
        AGENTS = JSON.parse(JSON.stringify(Tournament.INITIAL_AGENTS));
        self.populateAgents();
        self.createNetwork();

        // Animation...
        self.STAGE = STAGE_REST;
        _playIndex = 0;
        _tweenTimer = 0;

        // Stop autoplay!
        publish("tournament/autoplay/stop");
        _step = 0;

    };

    listen(self, "tournament/reset", self.reset);

    self.reset();

    ////////////////////////////////////
    // SHOW MATCHES ////////////////////
    ////////////////////////////////////

    self.playMatch = function (number) {

        // GET OUR MATCH
        const matches = [];
        for (let a = 0; a < self.agents.length; a++) {
            for (let b = a + 1; b < self.agents.length; b++) {
                matches.push([self.agents[a], self.agents[b]]);
            }
        }
        const match = matches[number];

        // Highlight match
        self.dehighlightAllConnections();
        const connections = match[0].connections;
        const connection = connections.filter(function (c) {
            if (c.from === match[0] && c.to === match[1]) return true;
            if (c.from === match[1] && c.to === match[0]) return true;
            return false;
        })[0];
        connection.highlight();

        // Actually PLAY the game -- HACK: HARD-CODE 10 ROUNDS
        const scores = PD.playRepeatedGame(match[0], match[1], 10);

        // Return ALL this data...
        return {
            charA: match[0].strategyName,
            charB: match[1].strategyName,
            scoreA: scores.totalA,
            scoreB: scores.totalB,
            payoffs: scores.payoffs
        }

    };
    self.dehighlightAllConnections = function () {
        for (let i = 0; i < self.connections.length; i++) self.connections[i].dehighlight();
    };

    ////////////////////////////////////
    // EVOLUTION ///////////////////////
    ////////////////////////////////////

    // Play one tournament
    self.agentsSorted = null;
    self.playOneTournament = function () {
        PD.playOneTournament(self.agents, Tournament.NUM_TURNS);
        self.agentsSorted = _shuffleArray(self.agents.slice());
        self.agentsSorted.sort(function (a, b) {
            return a.coins - b.coins;
        });
    };

    // Get rid of X worst
    self.eliminateBottom = function (X) {

        // The worst X
        const worst = self.agentsSorted.slice(0, X);

        // For each one, subtract from AGENTS count, and KILL.
        for (let i = 0; i < worst.length; i++) {
            const badAgent = worst[i];
            const config = AGENTS.find(function (config) {
                return config.strategy === badAgent.strategyName;
            });
            config.count--; // remove one
            badAgent.eliminate(); // ELIMINATE
        }

    };
    self.actuallyRemoveAgent = function (agent) {
        const index = self.agents.indexOf(agent);
        self.agents.splice(index, 1);
    };

    // Reproduce the top X
    self.reproduceTop = function (X) {

        // The top X
        const best = self.agentsSorted.slice(self.agentsSorted.length - X, self.agentsSorted.length);

        // For each one, add to AGENTS count
        for (let i = 0; i < best.length; i++) {
            let goodAgent = best[i];
            const config = AGENTS.find(function (config) {
                return config.strategy === goodAgent.strategyName;
            });
            config.count++; // ADD one
        }

        // ADD agents, splicing right AFTER
        for (let i = 0; i < best.length; i++) {

            // Properties...
            let goodAgent = best[i];
            let angle = goodAgent.angle + 0.1;
            const strategy = goodAgent.strategyName;

            // Create agent!
            let agent = new TournamentAgent({angle: angle, strategy: strategy, tournament: self});
            self.agentsContainer.addChild(agent.graphics);

            // Splice RIGHT AFTER
            const index = self.agents.indexOf(goodAgent);
            self.agents.splice(index, 0, agent);

        }

        // What are the agents' GO-TO angles?
        for (let i = 0; i < self.agents.length; i++) {
            let agent = self.agents[i];
            agent.gotoAngle = (i / self.agents.length) * Math.TAU - Math.TAU / 4;
        }

        // ADD connections
        self.createNetwork();

    };

    // ANIMATE the PLAYING, ELIMINATING, or REPRODUCING
    let STAGE_REST = 0;
    const STAGE_PLAY = 1;
    const STAGE_ELIMINATE = 2;
    const STAGE_REPRODUCE = 3;
    self.STAGE = STAGE_REST;

    // AUTOPLAY
    self.isAutoPlaying = false;
    let _step = 0;
    const _nextStep = function () {
        if (self.STAGE !== STAGE_REST) return;
        if (_step === 0) publish("tournament/play");
        if (_step === 1) publish("tournament/eliminate");
        if (_step === 2) publish("tournament/reproduce");
        _step = (_step + 1) % 3;
    };
    const _startAutoPlay = function () {
        self.isAutoPlaying = true;
        _nextStep();
        setTimeout(function () {
            if (self.isAutoPlaying) _startAutoPlay();
        }, 150);
    };
    const _stopAutoPlay = function () {
        self.isAutoPlaying = false;
    };
    listen(self, "tournament/autoplay/start", _startAutoPlay);
    listen(self, "tournament/autoplay/stop", _stopAutoPlay);
    listen(self, "tournament/step", function () {
        publish("tournament/autoplay/stop");
        _nextStep();
    });

    // ANIMATE
    let _playIndex = 0;
    let _tweenTimer = 0;
    const _tick = function () {

        // Tick
        Tween.tick();

        // PLAY!
        if (self.STAGE === STAGE_PLAY) {
            /*if(self.isAutoPlaying){
                self.playOneTournament(); // FOR REAL, NOW.
                _playIndex = 0;
                _tweenTimer = 0;
                self.STAGE = STAGE_REST;
                publish("tournament/step/completed", ["play"]);
            }else{*/
            if (_playIndex > 0 && _playIndex < self.agents.length + 1) self.agents[_playIndex - 1].dehighlightConnections();
            if (_playIndex > 1 && _playIndex < self.agents.length + 2) self.agents[_playIndex - 2].dehighlightConnections();
            if (_playIndex < self.agents.length) {
                self.agents[_playIndex].highlightConnections();
                _playIndex += self.isAutoPlaying ? 2 : 1;
            } else {
                self.playOneTournament(); // FOR REAL, NOW.
                _playIndex = 0;
                _tweenTimer = 0;
                self.STAGE = STAGE_REST;
                publish("tournament/step/completed", ["play"]);
            }
            //}
        }

        // ELIMINATE!
        if (self.STAGE === STAGE_ELIMINATE) {
            self.eliminateBottom(Tournament.SELECTION);
            _tweenTimer++;
            if (_tweenTimer === _s(0.3) || self.isAutoPlaying) {
                _tweenTimer = 0;
                self.STAGE = STAGE_REST;
                publish("tournament/step/completed", ["eliminate"]);
            }
        }

        // REPRODUCE!
        if (self.STAGE === STAGE_REPRODUCE) {

            // Start
            if (_tweenTimer === 0) {
                self.reproduceTop(Tournament.SELECTION);
            }

            // Middle...
            _tweenTimer += self.isAutoPlaying ? 0.15 : 0.05;
            if (_tweenTimer > 1) _tweenTimer = 1;
            for (let i = 0; i < self.agents.length; i++) {
                const a = self.agents[i];
                a.tweenAngle(_tweenTimer);
                a.updatePosition();
            }
            self.sortAgentsByDepth();
            for (let i = 0; i < self.connections.length; i++) self.connections[i].updateGraphics();

            // End
            if (_tweenTimer >= 1) {
                _tweenTimer = 0;
                self.STAGE = STAGE_REST;
                publish("tournament/step/completed", ["reproduce"]);
            }

        }

    };
    app.ticker.add(_tick);

    // PLAY A TOURNAMENT
    self._startPlay = function () {
        if (!self.isAutoPlaying) {
            Loader.sounds.coin_get.volume(0.1).play();
        }
        self.STAGE = STAGE_PLAY;
    };
    listen(self, "tournament/play", self._startPlay);
    self._startEliminate = function () {
        if (!self.isAutoPlaying) {
            Loader.sounds.squeak.volume(0.4).play();
        }
        self.STAGE = STAGE_ELIMINATE;
    };
    listen(self, "tournament/eliminate", self._startEliminate);
    self._startReproduce = function () {
        if (!self.isAutoPlaying) {
            Loader.sounds.bonk.volume(0.3).play();
        }
        self.STAGE = STAGE_REPRODUCE;
    };
    listen(self, "tournament/reproduce", self._startReproduce);

    // Add...
    self.add = function () {
        _add(self);
    };

    // Remove...
    self.remove = function () {
        _stopAutoPlay();
        for (let i = 0; i < self.agents.length; i++) unlisten(self.agents[i]);
        unlisten(self);
        app.destroy();
        _remove(self);
    };

}

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

function TournamentConnection(config) {

    const self = this;
    self.config = config;
    self.tournament = config.tournament;

    // Connect from & to
    self.from = config.from;
    self.to = config.to;
    self.from.connections.push(self);
    self.to.connections.push(self);

    // Graphics!
    let g;
    if (Tournament.FLOWER_CONNECTIONS) {
        g = _makeMovieClip("connection_flower");
        g.anchor.x = 0;
        g.anchor.y = 0;
        g.scale.set(0.5);
    } else {
        g = _makeMovieClip("connection");
        g.anchor.x = 0;
        g.anchor.y = 0.5;
        g.height = 1;
    }
    self.graphics = g;
    let _flowerLong = false;
    const _updateFlower = function (highlight) {
        let frame = 0;
        if (highlight) frame += 2;
        if (_flowerLong) frame += 1;
        g.gotoAndStop(frame);
    };
    if (config.flower_flip) {
        g.scale.y *= -1;
    }

    // Highlight or no?
    self.highlight = function () {
        if (Tournament.FLOWER_CONNECTIONS) {
            _updateFlower(true);
        } else {
            g.height = 3;
            g.gotoAndStop(1);
        }
    };
    self.dehighlight = function () {
        if (Tournament.FLOWER_CONNECTIONS) {
            _updateFlower(false);
        } else {
            g.height = 1;
            g.gotoAndStop(0);
        }
    };
    self.dehighlight();

    // Stretch dat bad boy
    self.updateGraphics = function () {

        const f = self.from.graphics;
        const t = self.to.graphics;
        const dx = t.x - f.x;
        const dy = t.y - f.y;
        const a = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy);

        g.x = f.x;
        g.y = f.y;

        if (Tournament.FLOWER_CONNECTIONS) {
            if (dist < 250) {
                _flowerLong = false;
                if (config.flower_flip) {
                    g.rotation = a + Math.TAU / 10;
                } else {
                    g.rotation = a - Math.TAU / 10;
                }
            } else {
                _flowerLong = true;
                if (config.flower_flip) {
                    g.rotation = a + Math.TAU / 5;
                } else {
                    g.rotation = a - Math.TAU / 5;
                }
            }
            _updateFlower();
        } else {
            g.rotation = a;
            g.width = dist;
        }

    };
    self.updateGraphics();

    // KILL
    self.IS_DEAD = false;
    self.kill = function () {
        if (self.IS_DEAD) return;
        self.IS_DEAD = true;
        self.graphics.parent.removeChild(self.graphics); // remove self's graphics
        self.tournament.actuallyRemoveConnection(self);
    };

}

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

function TournamentAgent(config) {

    const self = this;
    self.strategyName = config.strategy;
    self.tournament = config.tournament;
    self.angle = config.angle;
    self.gotoAngle = self.angle;

    // Connections
    self.connections = [];
    self.highlightConnections = function () {
        for (let i = 0; i < self.connections.length; i++) self.connections[i].highlight();
    };
    self.dehighlightConnections = function () {
        for (let i = 0; i < self.connections.length; i++) self.connections[i].dehighlight();
    };
    self.clearConnections = function () {
        for (let i = 0; i < self.connections.length; i++) {
            self.connections[i].kill();
        }
        self.connections = [];
    };

    // Number of coins
    self.coins = 0;
    self.addPayoff = function (payoff) {
        self.coins += payoff;
        self.updateScore();
    };

    // What's the image?
    const g = new PIXI.Container();
    self.graphics = g;

    // Body!
    const body = _makeMovieClip("tournament_peep");
    body.gotoAndStop(PEEP_METADATA[config.strategy].frame);
    body.scale.set(0.5);
    body.anchor.x = 0.5;
    body.anchor.y = 0.75;
    g.addChild(body);

    // Score!
    const textStyle = new PIXI.TextStyle({
        fontFamily: "FuturaHandwritten",
        fontSize: 16,
        fill: "#444"
    });
    const scoreText = new PIXI.Text("", textStyle);
    scoreText.anchor.x = 0.5;
    g.addChild(scoreText);
    self.updateScore = function () {
        scoreText.visible = true;
        scoreText.text = self.coins;
    };
    self.updateScore();
    scoreText.visible = false;
    listen(self, "tournament/reproduce", function () {
        scoreText.visible = false;
    });

    // What's the play logic?
    const LogicClass = window["Logic_" + self.strategyName];
    self.logic = new LogicClass();
    self.play = function () {
        return self.logic.play();
    };
    self.remember = function (own, other) {
        self.logic.remember(own, other);
    };

    // Reset!
    self.resetCoins = function () {
        self.coins = 0; // reset coins;
        self.updateScore();
    }
    self.resetLogic = function () {
        self.logic = new LogicClass(); // reset logic
    };

    // Tween angle...
    self.tweenAngle = function (t) {
        self.angle = self.gotoAngle * t + self.angle * (1 - t);
    };
    self.updatePosition = function () {
        g.x = Math.cos(self.angle) * 200 + 250;
        g.y = Math.sin(self.angle) * 200 + 265;
        scoreText.x = -Math.cos(self.angle) * 40;
        scoreText.y = -Math.sin(self.angle) * 48 - 22;
        body.scale.x = Math.abs(body.scale.x) * ((Math.cos(self.angle) < 0) ? 1 : -1);
    };
    self.updatePosition();

    // ELIMINATE
    self.eliminate = function () {

        // INSTA-KILL ALL CONNECTIONS
        self.clearConnections();
        scoreText.visible = false;

        // Tween -- DIE!
        const duration = self.tournament.isAutoPlaying ? 0.13 : 0.3;
        Tween_get(g).to({
            alpha: 0,
            x: g.x + Math.random() * 20 - 10,
            y: g.y + Math.random() * 20 - 10,
            rotation: Math.random() * 0.5 - 0.25
        }, _s(duration), Ease.circOut).call(self.kill);

    };

    // KILL (actually insta-remove)
    self.kill = function () {

        // Remove ANY tweens
        Tween.removeTweens(g);

        // NOW remove graphics.
        g.parent.removeChild(g);

        // AND remove self from tournament
        self.tournament.actuallyRemoveAgent(self);

        // Unsub
        unlisten(self);

    };

}

