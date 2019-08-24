'use strict';

var Map = require('collections/map');
var fs = require('fs');
var uniqid = require('uniqid')

class Session {
    constructor(faculty, course, room) {
        
        this.faculty = faculty;
        
        this.course = course;
        
        this.room = room;
        
        var now = Date.now();
        var nowDate = new Date(now);
        this.date = {
            start: {
                UTCTimestampMillis: now,
                WeekDay: nowDate.getDay(),
                Date: nowDate.getDate(),
                Month: nowDate.getMonth(),
                Year: nowDate.getFullYear()
            },
            end: null
        };
        
        this.events = [];

        this.resources = new Set();

        this.recording = null;
    }

    SetRecording(resource_id) {
        this.recording = resource_id;
    }

    AddResource(resource_id) {
        this.resources.add(resource_id);
    }

    RemoveResource(resource_id) {
        this.resources.delete(resource_id);
    }

    GetResources() {
        return Array.from(this.resources);
    }

    AddEvent(event) {
        this.events.push(event);
    }

    End() {
        var now = Date.now();
        var nowDate = new Date(now);

        var timediff = new Date(now - this.date.start.UTCTimestampMillis);
        this.date.end = {
            UTCTimestampMillis: now,
            WeekDay: nowDate.getDay(),
            Date: nowDate.getDate(),
            Month: nowDate.getMonth(),
            Year: nowDate.getFullYear()
        };
        this.duration = {
            Hours: timediff.getUTCHours(),
            Minutes: timediff.getUTCMinutes(),
            Seconds: timediff.getUTCSeconds()
        };
    }

    toJSON() {
        return {
            faculty: this.faculty,
            course: this.course,
            room: this.room,
            date: this.date,
            duration: this.duration,
            events: this.events,
            resources: this.resources,
            recording: this.recording
        };
    }
}
module.exports = class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    StartSession(faculty, course, room, recordResourceId, recordResourceStream) {
        var token = uniqid();
        this.sessions.set(token, {
            session: new Session(faculty, course, room),
            audioStream: recordResourceStream
        });
        this.sessions.get(token).session.SetRecording(recordResourceId);
        return token;
    }

    GetSession(token) {
        return this.sessions.get(token);
    }

    Has(token) {
        return this.sessions.has(token);
    }

    AddResource(token, resource_id) {
        this.sessions.get(token).session.AddResource(resource_id);
    }

    RemoveResource(token, resource_id) {
        this.sessions.get(token).session.RemoveResource(resource_id);
    }

    AddEvent(token, event) {
        event.timestamp = Date.now();
        this.sessions.get(token).session.AddEvent(event);
    }

    GetResources(token) {
        return this.sessions.get(token).GetResources();
    }

    AddMediaChunk(token, chunk) {
        this.sessions.get(token).audioStream.write(Buffer.from(chunk));
    }

    EndSession(token) {
        var sessionObject = this.sessions.get(token);
        sessionObject.session.End();
        sessionObject.audioStream.end();

        var data = sessionObject.session.toJSON();
        this.sessions.delete(token);
        return data;
    }
}