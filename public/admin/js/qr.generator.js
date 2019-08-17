class QRGenerator {
    constructor() {
        this.root = document.createElement('div');
        this.template = {
            container: document.createElement('div'),
            image: document.createElement('div'),
            label: document.createElement('span')
        };
        this.template.container.style = 'display: inline-block; margin: 20px;';
        this.template.image.style = 'display: block;margin:25px;';
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
                width: 256,
                height: 256,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
            
            var label = this.template.label.cloneNode();
            label.textContent = this.codes[i].label;
            container.appendChild(image);
            container.appendChild(label);
            this.root.appendChild(container);
        }

        var PrintWindow = window.open('','');
        PrintWindow.document.body.appendChild(this.root);
        PrintWindow.print();
    }
}