'use strict';

var Map = require('collections/map');

module.exports = class RoomList {
    constructor() {
        this.list = new Map();
    }
    AddRooms(rooms = []) {
        for(var i=0; i < rooms.length; i++) {
            rooms[i].usage = { inUse: false };
            rooms[i].occupancy = Array.from(rooms[i].seat_matrix);
            this.list.set(rooms[i].code, rooms[i]);
        }
    }
    AddRoom(room) {
        room.usage = {inUse: false};
        room.occupancy = Array.from(room.seat_matrix);
        this.list.set(room.code, room);
    }
    SetOccupancy(room_code, nrow, ncol, status) {
        var room = this.list.get(room_code);
        if(room.occupancy[nrow] && room.occupancy[nrow][ncol])
            this.list.get(room_code).occupancy[nrow][ncol] = status ? 2 : 1;
        else
            return false;
        return true;
    }
    GetOccupancy(room_code, nrow, ncol) {
        var room = this.list.get(room_code);
        if(room.occupancy[nrow])
            return room.occupancy[nrow][ncol] > 1;
        return false;
    }
    static CopyFrom(object) {
        return JSON.parse(JSON.stringify(object));
    }
    GetRoom(room_code) {
        var room = RoomList.CopyFrom(this.list.get(room_code));
        delete room.occupancy;
        return room;
    }
    GetRooms() {
        var rooms = [];
        for(var key of this.list.keys()) {
            rooms.push(this.GetRoom(key))
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
    SetSession(room_code, session_token, session_type="session") {
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
            room.usage.sessionType = session_type;
        }
        this.list.set(room.code, room);
    }
    UnsetSession(room_code) {
        var room = this.list.get(room_code);
        room.usage.inUse = false;
        room.seat_matrix = room.seat_matrix.map((u) => u.map((v) => v !== false ? true : false));
        this.list.set(room_code, room);
    }
}