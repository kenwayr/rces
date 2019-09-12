const fs = require('fs');
const ObjectID = require('mongodb').ObjectID;
const uniqid = require('uniqid');
const Logger = require('./Logger.class');

module.exports = class ResourceManager {
    constructor() {
        this.resources = new Map();
        this.base = './resources/';
    }
    AddResources(resources) {
        for(var i=0; i < resources.length; i++) {
            this.resources.set(resources[i]._id.toHexString(), resources[i]);
        }
    }
    Has(resource_id) {
        return this.resources.has(resource_id);
    }
    GetResource(resource_id) {
        return this.resources.get(resource_id);
    }
    GetFormattedResource(formatter, resource_id) {
        return formatter(this.resources.get(resource_id));
    }
    GetResources() {
        var resourceList = [];
        for(var key of this.resources.keys()) {
            resourceList.push(this.resources.get(key));
        }
        return resourceList;
    }
    CreateResource(data, file=null) {
        var resource = {
            _id: new ObjectID(),
            filename: data.filename || uniqid(),
            type: data.type || 'unknown',
            preferences: data.preferences || {}
        };
        var id = resource._id.toHexString();
        if(file)
            fs.writeFile(this.base + id, file.buffer, {flag: 'w'}, (err) => {
                if(err) Logger.Error(err);
            });
        else
            fs.closeSync(fs.openSync(this.base + id, 'w'));
        this.resources.set(id, resource);
        return id;
    }
    RemoveResource(resource_id) {
        if(this.resources.has(resource_id)) {
            fs.unlinkSync(this.base + resource_id);
            this.resources.delete(resource_id);
        }
        return true;
    }
    GetResourceWriteStream(id, flags='a') {
        if(this.resources.has(id))
            return fs.createWriteStream(this.base + id, {flags: flags});
        return null;
    }
    GetResourceStats(id) {
        if(this.resources.has(id))
            return fs.statSync(this.base + id);
        return null;
    }
    GetResourceReadStream(id) {
        if(this.resources.has(id))
            return fs.createReadStream(this.base + id);
        return null;
    }
}