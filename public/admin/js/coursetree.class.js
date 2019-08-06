class CourseTreeBuilder {
    constructor(target) {
        this.root = target;
        this.root.className = "coursetree";
        
        this.data = {};
        if(document.getElementsByTagName("style").length > 0) {
            var stylesheets = document.getElementsByTagName("style");
            for(var i=0; i < stylesheets.length; i++)
                if(stylesheets.item(i).hasAttribute("data-id") && stylesheets.item(i).getAttribute("data-id") === "coursetree")
                    return;
        }

        var rules = ".coursetree, .coursetree ul { list-style: none; font-family: sans-serif; } .coursetree li > span { display: inline-block; padding: 5px; margin-bottom: 2px; border-radius: 10px; cursor: pointer; } .coursetree li > span > .btn { display: inline-block; opacity: 0; color: #000; padding: 2px 5px; border-radius: 20px; } .coursetree li > span > .btn:hover { opacity: 1; background-color: rgba(0, 0, 0, 0.24); } .coursetree-base { appearance: none; color: #fff; background-color: rgb(76, 93, 247); font-size: 12pt; font-family: sans-serif; cursor: pointer; outline: none; border: none; padding: 3px 10px; border-radius: 5px; border: 2px solid rgba(8, 18, 107, 0); } .coursetree-base:hover { border: 2px solid rgba(8, 18, 107, 1); }";
        var style = document.createElement("style");
        style.appendChild(document.createTextNode(rules));
        style.setAttribute("data-id", "coursetree");
        document.head.appendChild(style);

    }

    Add({entity, parentId = null, entityId = null}) {
        var id = entityId || this.GenerateId(6);
        if(parentId !== null)
            return this.AddEntity(this.data, parentId, {id: id, data: entity});
        else
            this.data[id] = entity;
        return true;
    }

    Remove(id) {
        return this.RemoveEntity(this.data, id);
    }

    AddEntity(root, id, entity) {
        for(var i in root) {
            if(i == id) {
                if(!root[i].hasOwnProperty('children'))
                    root[i]['children'] = {};
                root[i].children[entity.id] = entity.data;
                return true;
            } else if(root[i].hasOwnProperty('children')) {
                if(this.AddEntity(root[i].children, id, entity))
                    return true;
            }
        }
        return false;
    }

    RemoveEntity(root, id) {
        for(var i in root) {
            if(i == id) {
                delete root[i];
                return true;
            } else if(root[i].hasOwnProperty('children')) {
                if(this.RemoveEntity(root[i].children, id))
                    return true;
            }
        }
        return false;
    }

    GenerateId(length) {
        var result           = '';
        var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for ( var i = 0; i < length; i++ ) {
           result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
     }
}

class CourseTree {
    constructor(target) {
        var container = document.getElementById(target);
        container.innerHTML = "";
        var button = document.createElement('button');
        button.className = "coursetree-base";
        button.textContent = "+ Add Base Node";
        var list = document.createElement('ul');
        container.appendChild(button);
        container.appendChild(list);
        this.builder = new CourseTreeBuilder(list);
        this.baseButton = button;
        this.baseButton.addEventListener('click', () => {
            this.Add(null);
            this.Render();
        });
        this.Render();
    }

    Add(parentId) {
        var id = prompt("Enter a unique identifier for the entity. Leave blank to auto-generate.", "");
        id = (id.trim() == "") ? null: id;
        var title = prompt("Enter a title for the entity","");
        this.builder.Add({
            entity: {
                title: title
            },
            entityId: id,
            parentId: parentId
        });
    }

    Render() {
        var baselist = this._Render(this.builder.data);
        this.builder.root.innerHTML = '';
        for(var i=0; i < baselist.length; i++) {
            this.builder.root.append(baselist[i]);
        }
    }
    
    _Render(root) {
        var list = [];
        for(var id in root) {
            var item = document.createElement('li');
            var view = document.createElement('span');
            var addBtn = document.createElement('i');
            addBtn.className = 'btn';
            addBtn.innerText = '+';
            addBtn.addEventListener('click', () => {
                this.Add(id);
                this.Render();
            });
            var deleteBtn = document.createElement('i');
            deleteBtn.className = 'btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', () => {
                this.builder.Remove(id);
                this.Render();
            });
            var titleText = document.createTextNode(root[id].title);
            view.append(addBtn);
            view.append(titleText);
            view.append(deleteBtn);
            item.append(view);
            if(root[id].hasOwnProperty('children')) {
                var sublist = this._Render(root[id].children);
                var sublistview = document.createElement('ul');
                for(var i=0; i < sublist.length; i++) {
                    sublistview.append(sublist[i]);
                }
                item.append(sublistview);
            }
            list.push(item);
        }
        return list;
    }

    _Compile(root) {
        var finaldata = [];
        for(var code in root) {
            if(root[code].hasOwnProperty('children')) {
                root[code].children = this._Compile(root[code].children);
            }
            var entry = root[code];
            entry['code'] = code;
            finaldata.push(entry);
        }
        return finaldata;
    }

    Compile() {
        return this._Compile(this.builder.data);
    }
}