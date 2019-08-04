'use strict';

var Map = require('collections/map');

module.exports = class ClientList {
    constructor() {
        this.clientMap = new Map();
        this.connectionMap = new Map();

        this.callbacks = {
            onAdd: [],
            onRemove: [],
            onConnectionChange: [],
            onRecordChange: []
        };
    }

    AddCallback(type, callback) {
        var id = -1;
        var callbackType = null;
        switch(type) {
            case 'add':                 callbackType = 'onAdd';
                                        break;
            case 'remove':              callbackType = 'onRemove';
                                        break;
            case 'connection.change':   callbackType = 'onConnectionChange';
                                        break;
            case 'record.change':       callbackType = 'onRecordChange';
                                        break;
            default:                    break;
        }
        if(callbackType !== null)
            id = this.callbacks[callbackType].push(callback);
        return id;
    }

    async Add(identifier, record, connection) {
        this.clientMap.set(identifier, record);
        this.connectionMap.set(identifier, connection);
        for(var i=0; i < this.callbacks.onAdd.length; i++)
            this.callbacks.onAdd[i]();
    }

    async Remove(identifier) {
        this.clientMap.delete(identifier);
        this.connectionMap.delete(identifier);
        for(var i=0; i < this.callbacks.onRemove.length; i++)
            this.callbacks.onRemove[i]();
    }

    GetBroadcastList(sender = null) {
        var list = [];
        for(var id of this.connectionMap.keys()) {
            if(sender === null || id !== sender)
                list.push(this.connectionMap.get(id));
        }
        return list;
    }

    GetRecord(identifier) {
        return this.clientMap.get(identifier);
    }

    GetRecords() {
        var records = [];
        for(var key of this.clientMap.keys())
            records.push(this.clientMap.get(key))
        return records;
    }

    Has(identifier) {
        return this.clientMap.has(identifier);
    }

    GetIdentifier(connection) {
        return [...this.connectionMap.keys()].find( key => this.connectionMap.get(key).id == connection.id );
    }

    async ChangeConnection(identifier, newConnection) {
        this.connectionMap.set(identifier, newConnection);
        for(var i=0; i < this.callbacks.onConnectionChange.length; i++)
            this.callbacks.onConnectionChange[i]();
    }

    async ChangeRecord(identifier, newRecord) {
        this.clientMap.set(identifier, newRecord);
        for(var i=0; i < this.callbacks.onRecordChange.length; i++)
            this.callbacks.onRecordChange[i]();
    }
}