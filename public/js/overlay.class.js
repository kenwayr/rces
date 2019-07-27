class Modal {
    constructor(target) {
        var container = document.getElementById(target);
        container.style = "display: block; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40%; min-width: 400px; height: auto;";
        this.root = document.createElement('div');
        this.root.style = "display: block; margin: 8px;";
        container.appendChild(this.root);
    }

    SetHTML(html) {
        this.root.innerHTML = html;
    }
}