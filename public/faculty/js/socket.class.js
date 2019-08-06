'use strict';
class Socket {
    constructor(secure = true) {
        var url = (secure ? "wss://" : "ws://") + window.location.host;
        this.socket = new WebSocket(url);
        this.requests = new Map();
        this.callbacks = new Map();
        this.sendQueue = [];
        this.socket.onopen = () => {
            while(this.sendQueue.length > 0)
                this.socket.send(this.sendQueue.pop());
        };
        this.socket.onmessage = (msg) => {
            var message = JSON.parse(msg.data);
            console.log(message);
            if(message.meta && message.meta.code && this.requests.has(message.meta.code)) {
                this.requests.get(message.meta.code)(message);
                this.requests.delete(message.meta.code);
            }
            if(this.callbacks.has(message.tag)) {
                var cbs = this.callbacks.get(message.tag);
                for(var i=0; i < cbs.length; i++)
                    cbs[i](message);
            }
        };
    }

    static uuidv4() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    _Send(message, callback = (d) => {}) {
        var code = Socket.uuidv4();
        message.meta = { code: code, timestamp: Date.now() };
        this.requests.set(code, callback);
        if(this.socket.readyState !== this.socket.OPEN)
            this.sendQueue.push(JSON.stringify(message))
        else
            this.socket.send(JSON.stringify(message));
    }

    Login(username, password, callback = (d) => {}) {
        this._Send({
            tag: "login",
            data: {
                type: "faculty",
                username: username,
                password: password
            }
        }, callback);
    }

    Get(type, data, callback = (d) => {}) {
        this._Send({
            tag: "get." + type,
            data: data
        }, callback);
    }

    Set(type, data, callback = (d) => {}) {
        this._Send({
            tag: "set." + type,
            data: data
        }, callback);
    }

    Add(type, data, callback = (d) => {}) {
        this._Send({
            tag: "add." + type,
            data: data
        }, callback);
    }

    Remove(type, data, callback = (d) => {}) {
        this._Send({
            tag: "remove." + type,
            data: data
        }, callback);
    }

    StartSession(data, callback = (d) => {}) {
        this._Send({
            tag: "start.session",
            data: data
        }, callback);
    }

    StopSession(data, callback = (d) => {}) {
        this._Send({
            tag: "stop.session",
            data: data
        }, callback);
    }

    On(tag, callback) {
        if(this.callbacks.has(tag))
            this.callbacks.get(tag).push(callback);
        else
            this.callbacks.set(tag, [callback]);
    }
}