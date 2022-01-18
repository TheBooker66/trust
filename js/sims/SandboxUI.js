function SandboxUI(config) {

    const self = this;
    self.id = config.id;
    self.slideshow = config.slideshow;

    // Create DOM
    self.dom = document.createElement("div");
    self.dom.className = "object";
    const dom = self.dom;

    /////////////////////////////////////////
    // BUTTONS for playing //////////////////
    /////////////////////////////////////////

    const playButton = new Button({
        x: 172, y: 135, text_id: "label_start", size: "short",
        onclick: function () {
            if (slideshow.objects.tournament.isAutoPlaying) {
                publish("tournament/autoplay/stop");
            } else {
                publish("tournament/autoplay/start");
            }
        }
    });
    listen(self, "tournament/autoplay/stop", function () {
        playButton.setText("label_start");
    });
    listen(self, "tournament/autoplay/start", function () {
        playButton.setText("label_stop");
    });
    dom.appendChild(playButton.dom);

    const stepButton = new Button({
        x: 172, y: 135 + 70, text_id: "label_step", message: "tournament/step", size: "short"
    });
    dom.appendChild(stepButton.dom);

    const resetButton = new Button({
        x: 172,
        y: 135 + 70 * 2,
        text_id: "label_reset",
        message: "tournament/reset",
        size: "short"
    });
    dom.appendChild(resetButton.dom);

    /////////////////////////////////////////
    // Create TABS & PAGES //////////////////
    /////////////////////////////////////////

    // Tabs
    const tabs = document.createElement("div");
    tabs.id = "sandbox_tabs";
    dom.appendChild(tabs);

    // Tab Hitboxes
    const _makeHitbox = function (label, x, width, pageIndex) {

        label = label.toUpperCase();

        const hitbox = document.createElement("div");
        hitbox.className = "hitbox";
        hitbox.style.left = x + "px";
        hitbox.style.width = width + "px";
        hitbox.innerHTML = label;
        tabs.appendChild(hitbox);

        (function (pageIndex) {
            hitbox.onclick = function () {
                _goToPage(pageIndex);
            };
        })(pageIndex);

    };
    _makeHitbox(Words.get("label_population"), 30, 100, 0);
    _makeHitbox(Words.get("label_payoffs"), 220, 100, 1);
    _makeHitbox(Words.get("label_rules"), 366, 100, 2);

    // Pages
    const pages = [];
    const _makePage = function () {
        const page = document.createElement("div");
        page.className = "sandbox_page";
        tabs.appendChild(page);
        pages.push(page);
    };
    for (let i = 0; i < 3; i++) _makePage(); // make three pages

    // Go To Page
    let _goToPage = function (showIndex) {

        // Background
        tabs.style.backgroundPosition = (-showIndex * 500) + "px 0px";

        // Show page
        for (let i = 0; i < pages.length; i++) pages[i].style.display = "none";
        pages[showIndex].style.display = "block";

    };
    _goToPage(0);

    /////////////////////////////////////////
    // PAGE 0: POPULATION ///////////////////
    /////////////////////////////////////////

    page = pages[0];

    // Labels
    page.appendChild(_makeLabel("sandbox_population", {x: 0, y: 0, w: 433}));

    // Create an icon, label, and slider... that all interact with each other.
    const sliders = [];
    const _makePopulationControl = function (x, y, peepID, defaultValue) {

        // DOM
        const popDOM = document.createElement("div");
        popDOM.className = "sandbox_pop";
        popDOM.style.left = x;
        popDOM.style.top = y;
        page.appendChild(popDOM);

        // Message
        const message = "sandbox/pop/" + peepID;

        // Icon
        const popIcon = document.createElement("div");
        popIcon.className = "sandbox_pop_icon";
        popIcon.style.backgroundPosition = (-PEEP_METADATA[peepID].frame * 40) + "px 0px";
        popDOM.appendChild(popIcon);

        // Label: Name
        const popName = document.createElement("div");
        popName.className = "sandbox_pop_label";
        popName.innerHTML = Words.get("label_short_" + peepID).toUpperCase();
        popName.style.color = PEEP_METADATA[peepID].color;
        popDOM.appendChild(popName);

        // Label: Amount
        const popAmount = document.createElement("div");
        popAmount.className = "sandbox_pop_label";
        popAmount.style.textAlign = "right";
        popAmount.style.color = PEEP_METADATA[peepID].color;
        popDOM.appendChild(popAmount);
        listen(self, message, function (value) {
            popAmount.innerHTML = value;
        });

        // Slider
        (function (peepID) {
            const popSlider = new Slider({
                x: 0, y: 35, width: 200,
                min: 0, max: 25, step: 1,
                message: message,
                onselect: function () {
                    _anchorPopulation(peepID);
                },
                onchange: function (value) {
                    _adjustPopulation(peepID, value);
                }
            });
            sliders.push(popSlider);
            popSlider.slideshow = self.slideshow;
            popDOM.appendChild(popSlider.dom);
        })(peepID);

        // Default value!
        publish(message, [defaultValue]);

    };
    const xDiff = 220;
    const yDiff = 80;
    const yOff = 40;
    _makePopulationControl(0, yOff, "tft", 3);
    _makePopulationControl(xDiff, yOff, "all_d", 3);
    _makePopulationControl(0, yOff + yDiff, "all_c", 3);
    _makePopulationControl(xDiff, yOff + yDiff, "grudge", 3);
    _makePopulationControl(0, yOff + yDiff * 2, "prober", 3);
    _makePopulationControl(xDiff, yOff + yDiff * 2, "tf2t", 3);
    _makePopulationControl(0, yOff + yDiff * 3, "pavlov", 3);
    _makePopulationControl(xDiff, yOff + yDiff * 3, "random", 4);

    // Adjust the WHOLE population...
    /******************************

     Adjust by SCALING. (and in the edge case of "all zero", scale equally)
     Round to integers. (if above or below 25 in total, keep adding/subtracting 1 down the line)

     ******************************/
    let _population;
    let _remainder;
    let _anchoredIndex;
    let _anchorPopulation = function (peepID) {

        // Which index should be anchored?
        _anchoredIndex = Tournament.INITIAL_AGENTS.findIndex(function (config) {
            return config.strategy === peepID;
        });
        const initValue = Tournament.INITIAL_AGENTS[_anchoredIndex].count;

        // SPECIAL CASE: THIS IS ALREADY FULL
        if (initValue === 25) {

            // Pretend it was 1 for all seven others, 25-7 for this.
            _population = [];
            for (let i = 0; i < Tournament.INITIAL_AGENTS.length; i++) {
                if (i === _anchoredIndex) {
                    _population.push(18);
                } else {
                    _population.push(1);
                }
            }

            // Remainder is 7
            _remainder = 7;

        } else {

            // Create array of all initial agents...
            _population = [];
            for (let i = 0; i < Tournament.INITIAL_AGENTS.length; i++) {
                const conf = Tournament.INITIAL_AGENTS[i];
                _population.push(conf.count);
            }

            // Remainder sum of those NOT anchored (25-anchor.count)
            _remainder = 25 - initValue;

        }

    };
    let _adjustPopulation = function (peepID, value) {

        // Change the anchored one
        Tournament.INITIAL_AGENTS.find(function (config) {
            return config.strategy === peepID;
        }).count = value;

        // What's the scale for the rest of 'em?
        const newRemainder = 25 - value;
        const scale = newRemainder / _remainder;

        // Adjust everyone to scale, ROUNDING.
        let total = 0;
        for (let i = 0; i < Tournament.INITIAL_AGENTS.length; i++) {

            // do NOT adjust anchor.
            let conf = Tournament.INITIAL_AGENTS[i];
            if (conf.strategy === peepID) continue;

            const initCount = _population[i];
            const newCount = Math.round(initCount * scale);
            conf.count = newCount;

            // Count total!
            total += newCount;

        }
        total += value; // total

        // Difference...
        let diff = 25 - total;
        // If negative, remove one starting from BOTTOM, skipping anchor.
        // (UNLESS IT'S ZERO)
        if (diff < 0) {
            for (let i = Tournament.INITIAL_AGENTS.length - 1; i >= 0 && diff < 0; i--) {
                // do NOT adjust anchor.
                let conf = Tournament.INITIAL_AGENTS[i];
                if (conf.strategy === peepID) continue;
                if (conf.count === 0) continue; // DON'T DO IT IF IT'S ZERO
                conf.count--; // REMOVE
                diff++; // yay
            }
        }
        // If positive, add one starting from TOP, skipping anchor.
        // (UNLESS IT'S ZERO)
        const everyoneElseWasZero = true;
        if (diff > 0) {
            for (let i = 0; i < Tournament.INITIAL_AGENTS.length && diff > 0; i++) {
                // do NOT adjust anchor.
                let conf = Tournament.INITIAL_AGENTS[i];
                if (conf.strategy === peepID) continue;
                if (conf.count === 0) continue; // DO NOT ADD IF ZERO
                everyoneWasZero = false;
                conf.count++; // ADD
                diff--; // yay
            }
        }
        // ...edge case. fine w/e
        if (everyoneElseWasZero) {
            for (let i = 0; i < Tournament.INITIAL_AGENTS.length && diff > 0; i++) {
                // do NOT adjust anchor.
                let conf = Tournament.INITIAL_AGENTS[i];
                if (conf.strategy === peepID) continue;
                // if(conf.count==0) continue; // DO NOT ADD IF ZERO
                // everyoneWasZero = false;
                conf.count++; // ADD
                diff--; // yay
            }
        }

        // NOW adjust UI
        for (let i = 0; i < Tournament.INITIAL_AGENTS.length; i++) {
            // do NOT adjust anchor.
            let conf = Tournament.INITIAL_AGENTS[i];
            if (conf.strategy === peepID) continue;
            publish("sandbox/pop/" + conf.strategy, [conf.count]);
        }

        // Reset!
        publish("tournament/reset");

    };

    /////////////////////////////////////////
    // PAGE 1: PAYOFFS //////////////////////
    /////////////////////////////////////////

    let page = pages[1];

    // Labels
    page.appendChild(_makeLabel("sandbox_payoffs", {x: 0, y: 0, w: 433}));

    // PAYOFFS
    const payoffsUI = new PayoffsUI({x: 84, y: 41, scale: 0.9, slideshow: self});
    page.appendChild(payoffsUI.dom);

    // Reset
    const resetPayoffs = new Button({
        x: 240, y: 300, text_id: "sandbox_reset_payoffs",
        message: "pd/defaultPayoffs"
    });
    page.appendChild(resetPayoffs.dom);

    /////////////////////////////////////////
    // PAGE 2: RULES ////////////////////////
    /////////////////////////////////////////

    page = pages[2];

    // Rule: Number of turns (1 to 50)
    const rule_turns = _makeLabel("sandbox_rules_1", {x: 0, y: 0, w: 433});
    const slider_turns = new Slider({
        x: 0, y: 35, width: 430,
        min: 1, max: 50, step: 1,
        message: "rules/turns"
    });
    sliders.push(slider_turns);
    slider_turns.slideshow = self.slideshow;
    listen(self, "rules/turns", function (value) {
        let words = (value === 1) ? Words.get("sandbox_rules_1_single") : Words.get("sandbox_rules_1"); // plural?
        words = words.replace(/\[N\]/g, value + ""); // replace [N] with the number value
        rule_turns.innerHTML = words;
    });
    page.appendChild(rule_turns);
    page.appendChild(slider_turns.dom);

    // Rule: Eliminate/Reproduce how many? (1 to 12)
    const rule_evolution = _makeLabel("sandbox_rules_2", {x: 0, y: 100, w: 433});
    const slider_evolution = new Slider({
        x: 0, y: 165, width: 430,
        min: 1, max: 10, step: 1,
        message: "rules/evolution"
    });
    sliders.push(slider_evolution);
    slider_evolution.slideshow = self.slideshow;
    listen(self, "rules/evolution", function (value) {
        let words = (value === 1) ? Words.get("sandbox_rules_2_single") : Words.get("sandbox_rules_2"); // plural?
        words = words.replace(/\[N\]/g, value + ""); // replace [N] with the number value
        rule_evolution.innerHTML = words;
    });
    page.appendChild(rule_evolution);
    page.appendChild(slider_evolution.dom);

    // Rule: Noise (0% to 50%)
    const rule_noise = _makeLabel("sandbox_rules_3", {x: 0, y: 225, w: 433});
    const slider_noise = new Slider({
        x: 0, y: 290, width: 430,
        min: 0.00, max: 0.50, step: 0.01,
        message: "rules/noise"
    });
    sliders.push(slider_noise);
    slider_noise.slideshow = self.slideshow;
    listen(self, "rules/noise", function (value) {
        value = Math.round(value * 100);
        let words = Words.get("sandbox_rules_3");
        words = words.replace(/\[N\]/g, value + ""); // replace [N] with the number value
        rule_noise.innerHTML = words;
    });
    page.appendChild(rule_noise);
    page.appendChild(slider_noise.dom);

    // DEFAULTS
    publish("rules/turns", [10]);
    publish("rules/evolution", [5]);
    publish("rules/noise", [0.05]);

    /////////////////////////////////////////
    // Add & Remove Object //////////////////
    /////////////////////////////////////////

    // Add...
    self.add = function () {
        _add(self);
    };

    // Remove...
    self.remove = function () {
        payoffsUI.remove();
        //for(var i=0;i<numbers.length;i++) unlisten(numbers[i]);
        for (let i = 0; i < sliders.length; i++) unlisten(sliders[i]);
        unlisten(self);
        _remove(self);
    };

}