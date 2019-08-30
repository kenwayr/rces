class QRGenerator {
    constructor() {
        this.root = document.createElement('div');

        var wrapperHTML = `
            <div class="header">
                <i class="icon fire-mono"></i>
                FIRE<br/>
                (Formative Interaction and Rapid Evaluation)</p>
            </div>
            <div class="body">
                
            </div>
            <div class="footer">
                Take care of this position marker. It triggers your attendance.
            </div>`;
        var el = document.createElement('div');
        el.innerHTML = wrapperHTML;
        el.className = 'card';
        this.template = {
            container: document.createElement('div'),
            image: document.createElement('div'),
            label: document.createElement('span'),
            wrapper: el
        };
        this.template.image.style = 'display: block; margin: 0.2cm auto; width: 100%; padding-top: 0.5cm;';
        this.template.label.style = 'display: block; text-align: center; font-size: 12pt; font-weight: bold; color: #000;';
        this.codes = [];
    }
    Add(code, label) {
        this.codes.push({code: code, label: label});
    }
    Print() {
        this.root = document.createElement('div');
        for(var i=0; i < this.codes.length; i++) {
            var container = this.template.container.cloneNode();
            
            var image = this.template.image.cloneNode();
            var qrcode = new QRCode(image, {
                text: this.codes[i].code,
                width: 128,
                height: 128,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
            
            var label = this.template.label.cloneNode();
            var wrapper = this.template.wrapper.cloneNode(true);
            label.textContent = this.codes[i].label;
            container.appendChild(image);
            container.appendChild(label);
            wrapper.getElementsByClassName('body')[0].appendChild(container);
            this.root.appendChild(wrapper);
        }

        var PrintWindow = window.open('','');

        var iconsheet = document.createElement('link');
        iconsheet.rel = 'stylesheet';
        iconsheet.type = 'text/css';
        iconsheet.href = window.location.origin + '/common/css/icons.css';
        iconsheet.media = 'all';

        var stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.type = 'text/css';
        stylesheet.href = window.location.origin + '/admin/template/default.css';
        stylesheet.media = 'all';

        PrintWindow.document.head.appendChild(iconsheet);
        PrintWindow.document.head.appendChild(stylesheet);
        PrintWindow.document.body.appendChild(this.root);
    }
}