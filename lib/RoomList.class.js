'use strict';

var Map = require('collections/map');

module.exports = class RoomList {
    constructor() {
        this.list = new Map();
    }
    AddRooms(rooms = []) {
        for(var i=0; i < rooms.length; i++) {
            rooms[i].usage = { inUse: false };
            this.list.set(rooms[i].code, rooms[i]);
        }
    }
    AddRoom(room) {
        room.usage = {inUse: false};
        this.list.set(room.code, room);
    }
    GetRoom(room_code) {
        return this.list.get(room_code);
    }
    GetRooms() {
        var rooms = [];
        for(var key of this.list.keys()) {
            rooms.push(this.list.get(key))
        }
        return rooms;
    }
    RemoveRoom(room_code) {
        this.list.delete(room_code);
    }
    UpdateRoom(room) {
        if(this.list.has(room.code) && this.list.get(room.code).usage.inUse === false) {
            this.list.set(room.code, room);
            return true;
        }
        return false;
    }
    Has(room_code) {
        return this.list.has(room_code);
    }
    SetAvailable(room_code, status = true) {
        var room = this.list.get(room_code);
        if(room.usage.inUse) {
            Logger.Error("Cannot change properties while room is in use.");
            return false;
        }
        else {
            room.available = status;
            this.list.set(room_code, room);
            return true;
        }
    }
    GetRoomCodes() {
        return this.list.keys();
    }
    SetSession(room_code, session_token) {
        var room = this.list.get(room_code);
        if(room.usage.inUse) {
            Logger.Error("A new session cannot be started while another session is already going on in the same room.");
            return false;
        }
        else if(!room.available) {
            Logger.Error("Cannot use a room that is not available.");
            return false;
        }
        else {
            room.usage.inUse = true;
            room.usage.sessionId = session_token;
        }
        this.list.set(room.code, room);
    }
    UnsetSession(room_code) {
        this.list.get(room_code).inUse = false;
    }
}