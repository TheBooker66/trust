function Background(config) {

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
    self.dom.style.width = width + "px";
    self.dom.style.height = height + "px";
    self.dom.style.background = config.color;

    // Add & Remove
    self.add = function () {
        _add(self);
    };
    self.remove = function () {
        _remove(self);
    };

}