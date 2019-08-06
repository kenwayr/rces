const ModalTheme = {
    default: {
        root: 'display: block; margin: 8px; border: 1px solid #000;',
        title: 'display: block; font-size: 16pt; border-bottom: 1px solid #000; font-weight: bolder;',
        body: 'display: block;',
        footer: 'display: block;',
    }
};

class Modal {
    constructor(target) {
        var container = document.querySelector(target);
        container.style = "display: block; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40%; min-width: 400px; height: auto;";
        this.root = document.createElement('div');
        this.root.style = "display: block; margin: 8px;";
        container.appendChild(this.root);
    }

    SetHTML(html) {
        this.root.innerHTML = html;
    }

    Set({ theme = 'default', title, type = 'info', message = "", fields = [], buttons = [] }) {
        this.storage = {
            form: {}
        };

        this.root.style = ModalTheme[theme].root;
        
        var title = document.createElement('header');
        title.style = ModalTheme[theme].title;
        this.root.appendChild(title);
        
        var body = document.createElement('div');
        body.style = ModalTheme[theme].body;
        if(type === 'info') {
            body.textContent = message;
        }
        else if(type === 'form') {
            for(var i=0; i < fields.length; i++) {
                var el;
                if(fields[i].type === 'textbox') {
                    el = document.createElement('input');
                    el.type = "text";
                    el.placeholder = fields[i].placeholder || "Enter here";
                }
                else if(fields[i].type === 'password') {
                    el = document.createElement('input');
                    el.type = "password";
                }
                this.storage.form[fields[i].name] = fields[i].default || "";
                el.addEventListener('change', () => {
                    this.storage.form[fields[i].name] = el.value;
                });
                body.appendChild(el);
            }
        }
        this.root.appendChild(body);

        var footer = document.createElement('div');
        footer.style = ModalTheme[theme].footer;
        
        for(var i=0; i < buttons.length; i++) {
            var button = document.createElement('button');
            button.textContent = buttons[i].text;
            button.style.backgroundColor = buttons[i].color.background;
            button.style.color = buttons[i].color.text;
            button.addEventListener('click', buttons[i].callback);
        }
        this.root.appendChild(footer);
    }
}