window.addEventListener("load", function () {

    // Find the "sharing" dom
    const sharingDOM = document.body.querySelector("sharing");

    // URL encodeable
    const title = sharingDOM.getAttribute("title");
    let text = sharingDOM.getAttribute("text");
    let link = sharingDOM.getAttribute("link");
    text = encodeURIComponent(text);
    link = encodeURIComponent(link);

    // Create full html
    const sharing = document.createElement("div");
    sharing.className = "sharing";
    sharing.innerHTML = '<a href="mailto:?subject=' + title + '&body=' + text + " " + link + '" target="_blank" title="שלח אימייל"><img alt="Send email" src="social/email.png"></a>'
        + '<a href="https://twitter.com/intent/tweet?source=' + link + '&text=' + text + '%20' + link + '" target="_blank" title="צייץ"><img alt="Tweet" src="social/twitter.png"></a>'
        + '<a href="https://api.whatsapp.com/send?text=' + title + text + '" target="_blank" title="שלח הודעת וואטסאפ"><img alt="Send WhatsApp Message" src="social/whatsapp.png"></a>';

    // Replace it in the dom
    sharingDOM.parentNode.replaceChild(sharing, sharingDOM);
});