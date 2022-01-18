window.Loader = {};

Loader.manifest = {};
Loader.manifestPreload = {}; // For Preloader
Loader.sounds = {};

/***************

 Actually LOAD all the assets in a manifest. Like so:

 Loader.loadAssets(Loader.manifest, function(){
	Loader.sceneManager.gotoScene(Loader.START_SCENE);
	Loader.startUpdateAndDraw();
});

 ***************/
Loader.loadAssets = function (manifest, completeCallback, progressCallback) {

    const deferred = Q.defer();
    completeCallback = completeCallback || function () {
    };
    progressCallback = progressCallback || function () {
    };

    // ABSOLUTE NUMBER OF ASSETS!
    let _isLoadingImages = 0;
    let _isLoadingSounds = 0;
    let _totalAssetsLoaded = 0;
    let _totalAssetsToLoad = 0;
    for (let key in manifest) {
        let src = manifest[key];

        // Loading sounds or images?
        if (src.slice(-4) === ".mp3") _isLoadingSounds = 1;
        else _isLoadingImages = 1;

        // Loading sprite or image?
        if (src.slice(-5) === ".json") _totalAssetsToLoad += 2; // Is Sprite. Actually TWO assets.
        else _totalAssetsToLoad += 1;

    }

    // When you load an asset
    const _onAssetLoad = function () {
        _totalAssetsLoaded++;
        if (progressCallback) {
            progressCallback(_totalAssetsLoaded / _totalAssetsToLoad); // Callback PROGRESS
        }
    };

    // When you load a group
    let _groupsToLoad = _isLoadingImages + _isLoadingSounds;
    const _onGroupLoaded = function () {
        _groupsToLoad--;
        if (_groupsToLoad === 0) {
            completeCallback(); // DONE.
            deferred.resolve();
        }
    };

    // HOWLER - Loading Sounds
    let _soundsToLoad = 0;
    const _onSoundLoad = function () {
        _soundsToLoad--;
        _onAssetLoad();
        if (_soundsToLoad === 0) _onGroupLoaded();
    };

    // PIXI - Loading Images & Sprites (or pass it to Howler)
    const loader = PIXI.loader;
    const resources = PIXI.loader.resources;
    for (let key in manifest) {
        let src = manifest[key];
        // Is MP3. Leave it to Howler.
        if (src.slice(-4) === ".mp3") {
            const sound = new Howl({src: [src]});
            _soundsToLoad++;
            sound.once('load', _onSoundLoad);
            Loader.sounds[key] = sound;
            continue;
        }

        // Otherwise, is an image (or json). Leave it to PIXI.
        loader.add(key, src);

    }
    loader.on('progress', _onAssetLoad);
    loader.once('complete', _onGroupLoaded);
    loader.load();

    // Promise!
    return deferred.promise;

};

/***************

 Add assets to manifest! Like so:

 Loader.addToManifest(Loader.manifest,{
	bg: "sprites/bg.png",
	button: "sprites/button/button.json",
	[key]: [filepath],
	[key]: [filepath],
	etc...
});

 ***************/
Loader.addToManifest = function (manifest, keyValues) {
    for (let key in keyValues) {
        manifest[key] = keyValues[key];
    }
};
