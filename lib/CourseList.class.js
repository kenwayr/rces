'use strict';
var Map = require('collections/map');

module.exports = class CourseList {
    constructor() {
        this.list = new Map();
    }
    AddCourses(courses) {
        for(var i=0; i < courses.length; i++)
            this.list.set(courses[i].code, courses[i]);
    }
    AddCourse(course) {
        this.list.set(course.code, course);
    }
    GetCourse(course_code) {
        return this.list.get(course_code);
    }
    GetCourses() {
        var courses = [];
        for(var key of this.list.keys())
            courses.push(this.list.get(key))
        return courses;
    }
    RemoveCourse(course_code) {
        this.list.delete(course_code);
    }
    Has(course_code) {
        return this.list.has(course_code)
    }
    UpdateCourse(course) {
        if(this.list.has(course.code)) {
            this.list.set(course.code, course);
            return true;
        }
        else {
            Logger.Error("Course not found.");
            return false;
        }
    }
}