'use strict';

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const crypto = require('crypto');

module.exports = class DatabaseObject {
    constructor({hostname, port, database, accounts = 'accounts', students = 'students', courses = 'courses', rooms = 'rooms', sessions = 'sessions'}) {
        this.db = {
            config: {
                hostname: hostname,
                port: port,
                database: database,
                accounts: accounts,
                students: students,
                courses: courses,
                rooms: rooms,
                sessions: sessions,
                root: {
                    username: "root",
                    password: "password"
                }
            },
            instance: null,
            collections: {
                accounts: null,
                students: null,
                courses: null,
                rooms: null,
                sessions: null
            }
        };
    }

    async Init() {
        // var mongodb = await MongoClient.connect("mongodb://" + this.db.config.hostname + ":" + this.db.config.port, {useNewUrlParser: true});
        var mongodb = await MongoClient.connect("mongodb+srv://root:sagnikmodak98@clusterrces-6ol28.gcp.mongodb.net/test?retryWrites=true&w=majority");
        this.db.instance = mongodb.db(this.db.config.database);

        this.db.collections.accounts = this.db.instance.collection(this.db.config.accounts);
        this.db.collections.students = this.db.instance.collection(this.db.config.students);
        this.db.collections.courses = this.db.instance.collection(this.db.config.courses);
        this.db.collections.rooms = this.db.instance.collection(this.db.config.rooms);
        this.db.collections.sessions = this.db.instance.collection(this.db.config.sessions);

        if(!await this.GetAccount({type: "admin", username: this.db.config.root.username, password: this.db.config.root.password})) {
            this.CreateAccount({type: "admin", username: this.db.config.root.username, password: this.db.config.root.password});
        }
    }
    
    async CreateAccount({ type = 'faculty', name = null, username, password, authorizer = null, designation = null, email = null, phone = null }) {
        var salt = crypto.randomBytes(16).toString('hex');
        var hash = crypto.pbkdf2Sync(password, salt, 1000, 64, `sha512`).toString(`hex`);
        var data = {
            type: type,
            username: username,
            password: {
                salt: salt,
                hash: hash
            }
        };
        if(name !== null)
            data['name'] = name;
        if(authorizer !== null)
            data['authorizer'] = authorizer;
        if(designation !== null)
            data['designation'] = designation;
        if(email !== null)
            data['email'] = email;
        if(phone !== null)
            data['phone'] = phone;
        var res = await this.db.collections.accounts.insertOne(data);
        return res.insertedId;
    }

    async UpdateAccount(type, username, updates) {
        if(updates.$set.username)
            delete updates.$set.username;
        if(updates.$set.password)
            delete updates.$set.password;
        if(updates.$set.type)
            delete updates.$set.type;
        await this.db.collections.accounts.updateOne({username: username, type: type}, updates);
        var res = await this.db.collections.students.findOne({username: username, type: type}); //optimize later
        return res;
    }

    async GetAccounts(filters = {}) {
        var accounts = await this.db.collections.accounts.find(filters).toArray();
        return accounts;
    }

    async CreateStudent({ device_id, number, identifier = null, fullname = null, email = null, gender = "U", grade = "", address = {}, dob = {}, courses = []}) {
        var data = arguments[0];
        data.verified = false;
        var res = await this.db.collections.students.insertOne(data);
        return res.insertedId;
    }

    async DeleteStudent(number) {
        var res = await this.db.collections.students.deleteOne({number: number});
        return res;
    }

    async UpdateStudent(number, updates) {
        if(updates.$set.device_id)
            delete updates.$set.device_id;
        if(updates.$set.number)
            delete updates.$set.number;
        
        await this.db.collections.students.updateOne({number: number}, updates);
        var res = await this.db.collections.students.findOne({number: number}); //optimize later
        return res;
    }

    async GetStudent({number}) {
        var student = await this.db.collections.students.findOne({number: number});
        return student;
    }

    async GetStudents(filters = {}) {
        var students = await this.db.collections.students.find(filters).toArray();
        return students;
    }

    /* async CreateRoom({room_id, is_available = false, seat_matrix = [], capacity = 0, creator}) {
        var data = arguments[0];
        var res = await this.db.collections.rooms.insertOne(data);
        return res.insertedId;
    } */

    async LoadRooms() {
        var res = await this.db.collections.rooms.find({}).toArray();
        return res;
    }

    async SaveRooms(rooms) {
        var updates = rooms.map((room) => {
            return {
                "updateOne": {
                    "filter": { "_id": room._id || new ObjectID() },
                    "update": { "$set": { "code": room.code, "capacity": room.capacity, "seat_matrix": room.seat_matrix, "available": room.available } },
                    "upsert": true
                }
            }
        })
        var res = null;
        if(updates.length > 0)
            res = await this.db.collections.rooms.bulkWrite(updates);
        return res;
    }

    async CreateCourse({code, title, parent = null, start_year = 0, capacity = 0, remarks = ""}) {
        var data = arguments[0];
        var res = await this.db.collections.courses.insertOne(data);
        return res.insertedId;
    }

    async LoadCourses() {
        var res = await this.db.collections.courses.find({}).toArray();
        return res;
    }

    async SaveCourses(courses) {
        var updates = courses.map((course) => {
            return {
                "updateOne": {
                    "filter": { "_id": course._id || new ObjectID() },
                    "update": { "$set": { "code": course.code, "title": course.title, "start": course.start, "remarks": course.remarks } },
                    "upsert": true
                }
            }
        })
        var res = null;
        if(updates.length > 0)
            res = await this.db.collections.courses.bulkWrite(updates);
        return res;
    }

    async GetAccount({ type = 'faculty', username, password }) {
        var account = await this.db.collections.accounts.findOne({"type": type, "username": username});
        if(!account)
            return null;
        var hash = crypto.pbkdf2Sync(password, account.password.salt, 1000, 64, `sha512`).toString(`hex`);
        if(account.password.hash === hash) {
            delete account.password;
            return account;
        } else
            return null;
    }

    async GetSessions(faculty) {
        var res = await this.db.collections.sessions.find({faculty: faculty}).toArray();
        return res;
    }

    async SaveSession(data) {
        var res = await this.db.collections.sessions.insertOne(data);
        return res;
    }

    Close() {
        // this.db.instance.close();
    }
}