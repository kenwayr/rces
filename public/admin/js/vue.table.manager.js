class TableManager {
    constructor ({ headers }) {
        this.headers = headers;
        var primaryHeader = headers.find((v) => v.primaryKey === true);
        if(!primaryHeader)
            throw "Exactly one primary key required";
        else
            this.primaryKey = primaryHeader.fieldName || primaryHeader.title;
        this.data = new Map();
        this.page = 1;
        this.cache = false;
        this.cacheResults = [];
    }
    Add(data) {
        if(!this.data.has(data[this.primaryKey])) {
            this.data.set(data[this.primaryKey], data);
        }
        this.cache = false;
    }
    Get(key) {
        return this.data.get(key);
    }
    Set(data) {
        this.data.set(data[this.primaryKey], data);
        this.cache = false;
    }
    Remove(key) {
        this.data.delete(key, data);
        this.cache = false;
    }
    Clear() {
        this.data = new Map();
        this.cache = false;
    }
    CreateFrom(data) {
        this.data = new Map(data.map((v) => [v[this.primaryKey], v]));
        this.cache = false;
    }
    GetHeaders() {
        return this.headers.map((v) => v.title);
    }
    GetRows() {
        if(this.cache)
            return this.cacheResults;
        else {
            var keys = this.data.keys();
            var rows = [];
            for(var key of keys) {
                var rowData = this.data.get(key);
                var row = [];
                for(var i=0; i < this.headers.length; i++) {
                    if(this.headers[i].fieldName)
                        row.push(rowData[this.headers[i].fieldName]);
                    else
                        row.push(rowData[this.headers[i].title]);
                }
                rows.push({key: rowData[this.primaryKey], data: row});
            }
            this.cacheResults = rows;
            this.cache = true;
            return rows;
        }
    }
}