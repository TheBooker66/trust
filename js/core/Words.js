/**********************

 Convert a word.html to a JSON containing innerHTMLs

 **********************/

window.Words = {};
Words.text = null;

Words.get = function (id) {
    return Words.text[id];
};

Words.convert = function (filepath) {

    // Promise
    const deferred = Q.defer();

    // Get dat stuff
    const request = pegasus(filepath);
    request.then(
        // success handler
        function (data, xhr) {

            // Convert HTML...
            const words = document.createElement("div");
            words.innerHTML = xhr.response;
            const paragraphs = words.querySelectorAll("p");

            // ...to a JSON
            Words.text = {}; // new one!
            for (let i = 0; i < paragraphs.length; i++) {
                const p = paragraphs[i];
                const id = p.id;
                Words.text[id] = p.innerHTML;
            }

            // Fulfil promise!
            deferred.resolve(Words.text);

        },

        // error handler (optional)
        function (data, xhr) {
            alert("AHHHHHHHHHHHH, PROBLEM LOADING WORDS");
            console.error(data, xhr.status)
        }
    );

    // Return Promise
    return deferred.promise;

};