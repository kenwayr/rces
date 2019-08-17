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

        this.resources = {};
    }

    AddResource(key, resource) {
        this.resources[key] = resource;
    }

    GetResources() {
        return this.resources;
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
            resources: this.resources
        };
    }
}
module.exports = class SessionManager {
    constructor({assetsPath}) {
        this.path = {
            media: assetsPath + "/media/",
            recording: assetsPath + "/recording/"
        };
        this.sessions = new Map();
        this.publicResources = new Map();
    }

    StartSession(faculty, course, room) {
        var filename = faculty + "_" + course.code + "_" + Date.now() + ".ogg";
        var token = uniqid();
        this.sessions.set(token, {
            session: new Session(faculty, course, room),
            audio: {
                id: filename,
                stream: fs.createWriteStream(this.path.recording + filename, {flags: 'a'})
            }
        });
        return token;
    }

    GetSession(token) {
        return this.sessions.get(token);
    }

    Has(token) {
        return this.sessions.has(token);
    }

    AddResource(token, file, isPublic = false) {
        var filename = Date.now() + "_" + file.originalname;
        var id = Date.now() + uniqid();
        fs.writeFile(this.path.media + filename, file.buffer, (err) => {
            if(err) Logger.Error(err);
            var resourceObject = {resource_id: id, name: filename, type: "media"};
            this.sessions.get(token).session.AddResource(file.originalname, resourceObject);
            if(isPublic)
                this.publicResources.set(id, resourceObject);
        });
    }

    AddEvent(token, event) {
        event.timestamp = Date.now();
        this.sessions.get(token).session.AddEvent(event);
    }

    GetResource({token = null, resource_id = null }) {
        if(token !== null) {
            var resources = this.sessions.get(token).session.GetResources();
            if(resource_id === null)
                return resources;
            else
                return resources.filter((v) => v.resource_id === resource_id)[0] || null;
        }
        else if(this.publicResources.has(resource_id)){
            return this.publicResources.get(resource_id);
        }
        else {
            Logger.Error("No such resource found");
        }
    }

    AddMediaChunk(token, chunk) {
        this.sessions.get(token).audio.stream.write(Buffer.from(chunk));
    }

    EndSession(token) {
        var sessionObject = this.sessions.get(token);
        var id = Date.now() + uniqid();
        sessionObject.session.AddResource('recording', {resource_id: id, name: sessionObject.audio.id, type: "recording"});
        sessionObject.session.End();
        sessionObject.audio.stream.end();

        var data = sessionObject.session.toJSON();
        this.sessions.delete(token);
        return data;
    }
}