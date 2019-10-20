'use strict';

var Map = require('collections/map');
var fs = require('fs');
var uniqid = require('uniqid');
const Bank = require('./Bank.class');

class Test {
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

        this.bank = new Bank();
    }

    async Init() {
        await this.bank.Init();
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
        this.data = this.bank.GetData();
    }

    toJSON() {
        return {
            faculty: this.faculty,
            course: this.course,
            room: this.room,
            date: this.date,
            duration: this.duration,
            data: this.data
        };
    }
}
module.exports = class TestManager {
    constructor() {
        this.tests = new Map();
    }

    StartTest(faculty, course, room) {
        var token = uniqid();
        var test = new Test(faculty, course, room);
        test.Init();
        this.tests.set(token, test);
        return token;
    }

    GetTest(token) {
        return this.tests.get(token);
    }

    Has(token) {
        return this.tests.has(token);
    }

    EndTest(token) {
        var test = this.tests.get(token);
        test.End();

        var data = test.toJSON();
        this.tests.delete(token);
        return data;
    }
}